#!/usr/bin/env node

/**
 * Markdown文件合并GUI服务器
 * 提供可视化界面来合并文件夹中的Markdown文件并转换为PDF
 */

import express from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import { MarkdownToPdfConverter } from './src/converter.js';
import chalk from 'chalk';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MergeGUIServer {
  constructor(options = {}) {
    this.app = express();
    this.port = options.port || 3001;
    this.uploadsDir = path.join(__dirname, 'merge-uploads');
    this.outputDir = path.join(__dirname, 'merge-output');
    this.tempDir = path.join(__dirname, 'merge-temp');
    
    // 创建HTTP服务器
    this.server = createServer(this.app);
    
    // 创建WebSocket服务器
    this.wss = new WebSocketServer({ server: this.server });
    this.wsClients = new Set();
    
    this.setupWebSocket();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * 设置WebSocket连接
   */
  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log(chalk.blue('🔗 WebSocket客户端连接'));
      this.wsClients.add(ws);
      
      ws.on('close', () => {
        console.log(chalk.blue('❌ WebSocket客户端断开'));
        this.wsClients.delete(ws);
      });
      
      ws.on('error', (error) => {
        console.error(chalk.red('WebSocket错误:'), error);
        this.wsClients.delete(ws);
      });
    });
  }

  /**
   * 广播进度消息到所有连接的客户端
   */
  broadcastProgress(data) {
    const message = JSON.stringify(data);
    this.wsClients.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(message);
        } catch (error) {
          console.error(chalk.red('发送WebSocket消息失败:'), error);
          this.wsClients.delete(ws);
        }
      }
    });
  }

  /**
   * 设置中间件
   */
  setupMiddleware() {
    this.app.use(cors());
    // 移除所有JSON和URL编码大小限制
    this.app.use(express.json({ limit: Infinity })); 
    this.app.use(express.urlencoded({ extended: true, limit: Infinity }));
    
    // 静态文件服务
    this.app.use('/static', express.static(path.join(__dirname, 'merge-web')));
    this.app.use('/output', express.static(this.outputDir));
    
    // 文件上传配置
    const storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        await this.ensureDir(this.uploadsDir);
        cb(null, this.uploadsDir);
      },
      filename: (req, file, cb) => {
        const timestamp = Date.now();
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, `${timestamp}-${originalName}`);
      }
    });

    this.upload = multer({ 
      storage,
      fileFilter: (req, file, cb) => {
        console.log(chalk.blue(`🔍 检查文件: ${file.originalname}`));
        console.log(chalk.blue(`   MIME类型: ${file.mimetype}`));
        console.log(chalk.blue(`   字段名: ${file.fieldname}`));
        
        // 检查字段名
        if (file.fieldname !== 'markdownFiles') {
          console.log(chalk.red(`❌ 错误的字段名: ${file.fieldname}, 期望: markdownFiles`));
          return cb(new Error(`错误的字段名: ${file.fieldname}, 期望: markdownFiles`));
        }
        
        // 检查文件类型 - 放宽检查条件
        const isMarkdown = file.mimetype === 'text/markdown' || 
                          file.mimetype === 'text/plain' ||
                          file.mimetype === 'application/octet-stream' ||
                          path.extname(file.originalname).toLowerCase() === '.md';
        
        if (isMarkdown) {
          console.log(chalk.green(`✅ 文件类型检查通过: ${file.originalname}`));
          cb(null, true);
        } else {
          console.log(chalk.yellow(`⚠️ 可能不是Markdown文件，但允许上传: ${file.originalname}`));
          cb(null, true); // 允许所有文件通过
        }
      }
      // 移除所有limits限制
    });
  }

  /**
   * 设置路由
   */
  setupRoutes() {
    // 主页
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'merge-web', 'index.html'));
    });

    // 上传多个Markdown文件
    this.app.post('/upload', (req, res, next) => {
      console.log(chalk.cyan('📤 收到上传请求'));
      console.log(chalk.blue('Content-Type:', req.get('Content-Type')));
      
      // 移除文件数量限制，使用默认的无限制
      this.upload.array('markdownFiles')(req, res, (err) => {
        if (err) {
          console.error(chalk.red('Multer错误:'), err);
          if (err instanceof multer.MulterError) {
            if (err.code === 'UNEXPECTED_FIELD') {
              return res.status(400).json({ 
                error: `不期望的字段名。期望: 'markdownFiles', 收到: '${err.field}'` 
              });
            }
            // 移除所有文件大小和数量限制的错误处理
          }
          return res.status(500).json({ error: err.message });
        }
        next();
      });
    }, async (req, res) => {
      try {
        console.log(chalk.cyan('📋 处理上传文件...'));
        console.log(chalk.blue('文件数量:', req.files ? req.files.length : 0));
        
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ error: '请至少上传一个文件' });
        }

        const files = req.files.map(file => ({
          originalName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
          filename: file.filename,
          path: file.path,
          size: file.size
        }));

        console.log(chalk.green(`📁 成功处理 ${files.length} 个文件`));
        files.forEach((file, index) => {
          console.log(chalk.gray(`   ${index + 1}. ${file.originalName} (${file.size} bytes)`));
        });

        res.json({
          success: true,
          message: '文件上传成功',
          files: files
        });
      } catch (error) {
        console.error(chalk.red('处理错误:'), error);
        res.status(500).json({ error: error.message });
      }
    });

    // 合并并转换为PDF
    this.app.post('/merge-convert', async (req, res) => {
      try {
        const { files, outputName, styleOptions } = req.body;
        
        if (!files || files.length === 0) {
          return res.status(400).json({ error: '没有文件需要合并' });
        }

        // 按文件名自然排序
        const sortedFiles = files.sort((a, b) => this.naturalSort(a.originalName, b.originalName));
        
        console.log(chalk.cyan('🔗 开始合并文件...'));
        console.log(chalk.blue('文件顺序:'));
        sortedFiles.forEach((file, index) => {
          console.log(chalk.gray(`   ${index + 1}. ${file.originalName}`));
        });

        // 合并文件内容
        const mergedContent = await this.mergeMarkdownFiles(sortedFiles);

        // 创建临时合并文件
        await this.ensureDir(this.tempDir);
        const tempPath = path.join(this.tempDir, `merged-${Date.now()}.md`);
        await fs.writeFile(tempPath, mergedContent, 'utf-8');

        // 转换为PDF
        const timestamp = Date.now();
        const pdfName = outputName || `merged-document-${timestamp}.pdf`;
        const pdfPath = path.join(this.outputDir, pdfName);
        
        await this.ensureDir(this.outputDir);

        const converter = new MarkdownToPdfConverter({
          reuseInstance: true
          // 完全移除maxPages限制
        });

        // 设置进度回调
        converter.setProgressCallback((phase, data) => {
          this.broadcastProgress({
            type: 'conversion_progress',
            phase,
            ...data
          });
        });

        await converter.convert({
          input: tempPath,
          output: pdfPath,
          format: 'pdf',
          pdfOptions: {
            format: 'A4',
            margin: {
              top: '0mm',
              right: '0mm',
              bottom: '0mm',
              left: '0mm'
            },
            printBackground: true,
            preferCSSPageSize: true
          },
          styleOptions: {
            fontSize: styleOptions?.fontSize || 'large',
            chineseFont: styleOptions?.chineseFont || 'auto',
            fontWeight: styleOptions?.fontWeight || 'medium',
            lineSpacing: styleOptions?.lineSpacing || 'normal',
            paragraphSpacing: styleOptions?.paragraphSpacing || 'normal',
            mathSpacing: styleOptions?.mathSpacing || 'tight',
            mathEngine: styleOptions?.mathEngine || 'auto'
          }
        });

        await converter.close();

        // 清理临时文件
        try {
          await fs.unlink(tempPath);
        } catch (error) {
          console.warn(chalk.yellow('⚠️ 无法删除临时文件:', error.message));
        }

        console.log(chalk.green('✅ PDF合并转换完成!'));

        res.json({
          success: true,
          message: 'PDF转换完成',
          filename: pdfName,
          downloadUrl: `/output/${pdfName}`,
          fileCount: sortedFiles.length
        });

      } catch (error) {
        console.error(chalk.red('转换错误:'), error);
        res.status(500).json({ error: error.message });
      }
    });

    // 获取历史文件列表
    this.app.get('/history', async (req, res) => {
      try {
        await this.ensureDir(this.outputDir);
        const files = await fs.readdir(this.outputDir);
        const pdfFiles = files.filter(file => file.endsWith('.pdf'));
        
        const fileList = await Promise.all(
          pdfFiles.map(async (file) => {
            const filePath = path.join(this.outputDir, file);
            const stats = await fs.stat(filePath);
            return {
              name: file,
              size: stats.size,
              created: stats.birthtime,
              downloadUrl: `/output/${file}`
            };
          })
        );

        // 按创建时间倒序排列
        fileList.sort((a, b) => new Date(b.created) - new Date(a.created));

        res.json({ files: fileList });
      } catch (error) {
        console.error(chalk.red('获取历史文件错误:'), error);
        res.status(500).json({ error: error.message });
      }
    });

    // 删除文件
    this.app.delete('/history/:filename', async (req, res) => {
      try {
        const filename = req.params.filename;
        const filePath = path.join(this.outputDir, filename);
        
        await fs.unlink(filePath);
        console.log(chalk.yellow(`🗑️ 删除文件: ${filename}`));
        
        res.json({ success: true, message: '文件删除成功' });
      } catch (error) {
        console.error(chalk.red('删除文件错误:'), error);
        res.status(500).json({ error: error.message });
      }
    });

    // 清理上传的文件
    this.app.post('/cleanup', async (req, res) => {
      try {
        const { files } = req.body;
        
        if (files && files.length > 0) {
          for (const file of files) {
            try {
              await fs.unlink(file.path);
            } catch (error) {
              console.warn(chalk.yellow(`⚠️ 无法删除文件 ${file.filename}:`, error.message));
            }
          }
        }

        res.json({ success: true, message: '清理完成' });
      } catch (error) {
        console.error(chalk.red('清理错误:'), error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  /**
   * 合并Markdown文件
   */
  async mergeMarkdownFiles(files) {
    const contents = [];
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file.path, 'utf-8');
        contents.push(content.trim());
        console.log(chalk.blue(`📖 读取文件: ${file.originalName}`));
      } catch (error) {
        console.warn(chalk.yellow(`⚠️ 无法读取文件 ${file.originalName}:`, error.message));
      }
    }
    
    return contents.join('\n\n');
  }

  /**
   * 自然排序比较函数
   */
  naturalSort(a, b) {
    const regex = /(\d+|\D+)/g;
    const aParts = a.match(regex) || [];
    const bParts = b.match(regex) || [];
    
    const maxLength = Math.max(aParts.length, bParts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const aPart = aParts[i] || '';
      const bPart = bParts[i] || '';
      
      if (/^\d+$/.test(aPart) && /^\d+$/.test(bPart)) {
        const numA = parseInt(aPart, 10);
        const numB = parseInt(bPart, 10);
        if (numA !== numB) {
          return numA - numB;
        }
      } else {
        if (aPart !== bPart) {
          return aPart.localeCompare(bPart);
        }
      }
    }
    
    return 0;
  }

  /**
   * 确保目录存在
   */
  async ensureDir(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * 启动服务器
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server.listen(this.port, () => {
          console.log(chalk.green(`🌐 合并GUI服务器启动在端口 ${this.port}`));
          console.log(chalk.blue(`📡 WebSocket服务器已启动`));
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 停止服务器
   */
  async stop() {
    // 关闭所有WebSocket连接
    this.wsClients.forEach(ws => {
      ws.close();
    });
    this.wsClients.clear();
    
    if (this.server) {
      this.server.close();
    }
  }
}

// 启动函数
export async function startMergeGUI(options = {}) {
  const server = new MergeGUIServer(options);
  await server.start();
  return server;
}

// 直接运行
async function main() {
  console.log(chalk.cyan.bold(`
┌─────────────────────────────────────────┐
│  📚 Markdown 文件合并可视化界面          │
│  🔗 智能合并 | 📄 PDF转换 | 🎨 样式定制    │
└─────────────────────────────────────────┘
`));

  try {
    const port = process.env.PORT || 3003;
    const server = await startMergeGUI({ port });
    
    console.log(chalk.green('\n✨ 合并GUI服务器启动成功!'));
    console.log(chalk.yellow(`🌍 请在浏览器中访问: http://localhost:${port}`));
    console.log(chalk.blue('📁 支持拖拽上传多个Markdown文件'));
    console.log(chalk.blue('🔄 自动按文件名自然排序'));
    console.log(chalk.blue('🎨 可自定义PDF样式选项'));
    console.log(chalk.gray('\n按 Ctrl+C 停止服务器\n'));
    
    // 优雅地处理退出
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n👋 正在关闭服务器...'));
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error(chalk.red('❌ 启动失败:'), error.message);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
