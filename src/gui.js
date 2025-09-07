/**
 * 可视化界面模块 - Markdown to PDF GUI
 */

import express from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { convertMarkdownToPdf, convertMarkdownToHtml } from './converter.js';
import { fileExists } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * GUI服务器类
 */
export class MarkdownPdfGUI {
  constructor(options = {}) {
    this.app = express();
    this.port = options.port || 3000;
    this.uploadsDir = path.join(__dirname, '../uploads');
    this.outputDir = path.join(__dirname, '../output');
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * 设置中间件
   */
  setupMiddleware() {
    // 静态文件服务
    this.app.use('/static', express.static(path.join(__dirname, '../web')));
    this.app.use('/output', express.static(this.outputDir));
    
    // JSON解析
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

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
        if (file.mimetype === 'text/markdown' || file.originalname.endsWith('.md')) {
          cb(null, true);
        } else {
          cb(new Error('只支持Markdown文件(.md)'));
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
      }
    });
  }

  /**
   * 设置路由
   */
  setupRoutes() {
    // 主页
    this.app.get('/', (req, res) => {
      res.redirect('/static/index.html');
    });

    // 上传并转换
    this.app.post('/convert', this.upload.single('markdown'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: '请选择Markdown文件' });
        }

        const options = this.parseConvertOptions(req.body);
        const inputPath = req.file.path;
        const outputFilename = this.generateOutputFilename(req.file.originalname, options.format);
        const outputPath = path.join(this.outputDir, outputFilename);

        await this.ensureDir(this.outputDir);

        // 读取文件内容用于预览
        const content = await fs.readFile(inputPath, 'utf-8');

        let result;
        if (options.format === 'pdf') {
          await convertMarkdownToPdf(inputPath, outputPath, {
            pdfOptions: options.pdfOptions,
            styleOptions: options.styleOptions
          });
          result = {
            success: true,
            outputPath: `/output/${outputFilename}`,
            format: 'pdf',
            filename: outputFilename,
            content: content,
            previewUrl: `/output/${outputFilename}`
          };
        } else {
          await convertMarkdownToHtml(inputPath, outputPath, {
            styleOptions: options.styleOptions
          });
          result = {
            success: true,
            outputPath: `/output/${outputFilename}`,
            format: 'html',
            filename: outputFilename,
            content: content,
            previewUrl: `/output/${outputFilename}`
          };
        }

        res.json(result);
      } catch (error) {
        console.error('转换错误:', error);
        res.status(500).json({ 
          error: '转换失败', 
          message: error.message 
        });
      }
    });

    // 获取转换历史
    this.app.get('/history', async (req, res) => {
      try {
        const files = await fs.readdir(this.outputDir);
        const history = await Promise.all(
          files.map(async (file) => {
            const filePath = path.join(this.outputDir, file);
            const stats = await fs.stat(filePath);
            return {
              filename: file,
              path: `/output/${file}`,
              size: stats.size,
              created: stats.birthtime,
              type: path.extname(file).substring(1)
            };
          })
        );
        
        history.sort((a, b) => new Date(b.created) - new Date(a.created));
        res.json(history);
      } catch (error) {
        res.status(500).json({ error: '获取历史记录失败' });
      }
    });

    // 删除文件
    this.app.delete('/file/:filename', async (req, res) => {
      try {
        const filename = req.params.filename;
        const filePath = path.join(this.outputDir, filename);
        
        if (await fileExists(filePath)) {
          await fs.unlink(filePath);
          res.json({ success: true });
        } else {
          res.status(404).json({ error: '文件不存在' });
        }
      } catch (error) {
        res.status(500).json({ error: '删除文件失败' });
      }
    });

    // 获取文件内容用于审阅
    this.app.get('/review/:filename', async (req, res) => {
      try {
        const filename = req.params.filename;
        const filePath = path.join(this.outputDir, filename);
        
        if (await fileExists(filePath)) {
          const stats = await fs.stat(filePath);
          const ext = path.extname(filename).toLowerCase();
          
          if (ext === '.html') {
            const content = await fs.readFile(filePath, 'utf-8');
            res.json({
              type: 'html',
              content: content,
              size: stats.size,
              modified: stats.mtime
            });
          } else if (ext === '.pdf') {
            res.json({
              type: 'pdf',
              url: `/output/${filename}`,
              size: stats.size,
              modified: stats.mtime
            });
          } else {
            res.status(400).json({ error: '不支持的文件类型' });
          }
        } else {
          res.status(404).json({ error: '文件不存在' });
        }
      } catch (error) {
        res.status(500).json({ error: '获取文件内容失败' });
      }
    });
  }

  /**
   * 解析转换选项
   */
  parseConvertOptions(body) {
    const format = body.format || 'pdf';
    
    const pdfOptions = {
      margin: {
        top: body.margin || '0mm',
        right: body.margin || '0mm',
        bottom: body.margin || '0mm',
        left: body.margin || '0mm'
      },
      landscape: body.landscape === 'true'
    };

    const styleOptions = {
      fontSize: body.fontSize || 'large',
      chineseFont: body.chineseFont || 'auto',
      fontWeight: body.fontWeight || 'medium',
      lineSpacing: body.lineSpacing || 'normal',
      paragraphSpacing: body.paragraphSpacing || 'normal',
      mathSpacing: body.mathSpacing || 'tight',
      mathEngine: body.mathEngine || 'auto'
    };

    return { format, pdfOptions, styleOptions };
  }

  /**
   * 生成输出文件名
   */
  generateOutputFilename(originalName, format) {
    const timestamp = Date.now();
    const baseName = path.parse(originalName).name;
    const extension = format === 'pdf' ? 'pdf' : 'html';
    return `${timestamp}-${baseName}.${extension}`;
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
    await this.ensureDir(this.uploadsDir);
    await this.ensureDir(this.outputDir);
    
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`🌐 Markdown PDF GUI 服务器启动`);
        console.log(`📍 地址: http://localhost:${this.port}`);
        console.log(`📁 上传目录: ${this.uploadsDir}`);
        console.log(`📁 输出目录: ${this.outputDir}`);
        resolve();
      });
    });
  }

  /**
   * 停止服务器
   */
  stop() {
    if (this.server) {
      this.server.close();
    }
  }
}

/**
 * 启动GUI服务器
 */
export async function startGUI(options = {}) {
  const gui = new MarkdownPdfGUI(options);
  await gui.start();
  return gui;
}