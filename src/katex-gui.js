/**
 * KaTeX检查可视化界面模块
 */

import express from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { fileExists } from './utils.js';
import katex from 'katex';
import { callLMStudioAPI, callOllamaAPI, callOpenAIAPI, LLM_PROVIDERS, setOpenAIConfig } from '../llm-fixer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * KaTeX GUI服务器类
 */
export class KatexCheckGUI {
  constructor(options = {}) {
    this.app = express();
    this.port = options.port || 3001;
    this.uploadsDir = path.join(__dirname, '../katex-uploads');
    this.outputDir = path.join(__dirname, '../katex-output');
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * 设置中间件
   */
  setupMiddleware() {
    // 静态文件服务
    this.app.use('/static', express.static(path.join(__dirname, '../katex-web')));
    this.app.use('/output', express.static(this.outputDir));
    
    // JSON解析
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

    // 检查单个文件
    this.app.post('/check', this.upload.single('markdown'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: '请选择Markdown文件' });
        }

        const content = await fs.readFile(req.file.path, 'utf-8');
        const results = await this.checkMathFormulas(content, req.file.originalname);
        
        res.json({
          success: true,
          filename: req.file.originalname,
          results: results,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('检查错误:', error);
        res.status(500).json({ 
          error: '检查失败', 
          message: error.message 
        });
      }
    });

    // 检查文本内容
    this.app.post('/check-text', async (req, res) => {
      try {
        const { content, filename = 'untitled.md' } = req.body;
        
        if (!content) {
          return res.status(400).json({ error: '请提供文本内容' });
        }

        const results = await this.checkMathFormulas(content, filename);
        
        res.json({
          success: true,
          filename: filename,
          results: results,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('检查错误:', error);
        res.status(500).json({ 
          error: '检查失败', 
          message: error.message 
        });
      }
    });

    // LLM纠错
    this.app.post('/fix-formula', async (req, res) => {
      try {
        const { formula, error, provider = 'lmstudio', config } = req.body;
        
        if (!formula || !error) {
          return res.status(400).json({ error: '请提供公式和错误信息' });
        }

        // 如果提供了配置，先更新相应的配置
        if (config) {
          await this.updateLLMConfig(provider, config);
        }

        let fixedFormula;
        switch (provider) {
          case 'ollama':
            fixedFormula = await callOllamaAPI(formula, error);
            break;
          case 'openai':
            fixedFormula = await callOpenAIAPI(formula, error);
            break;
          case 'lmstudio':
          default:
            fixedFormula = await callLMStudioAPI(formula, error);
            break;
        }

        if (!fixedFormula) {
          return res.status(500).json({ error: 'LLM未能生成修正结果' });
        }

        // 验证修正后的公式
        const validation = await this.validateFormula(fixedFormula);
        
        res.json({
          success: true,
          original: formula,
          fixed: fixedFormula,
          validation: validation,
          provider: provider
        });
      } catch (error) {
        console.error('纠错失败:', error);
        res.status(500).json({ 
          error: '纠错失败', 
          message: error.message 
        });
      }
    });

    // 批量纠错
    this.app.post('/fix-batch', async (req, res) => {
      try {
        const { errors, provider = 'lmstudio', config } = req.body;
        
        if (!errors || !Array.isArray(errors)) {
          return res.status(400).json({ error: '请提供错误列表' });
        }

        // 如果提供了配置，先更新相应的配置
        if (config) {
          await this.updateLLMConfig(provider, config);
        }

        const results = [];
        for (const errorItem of errors) {
          try {
            let fixedFormula;
            switch (provider) {
              case 'ollama':
                fixedFormula = await callOllamaAPI(errorItem.formula, errorItem.error);
                break;
              case 'openai':
                fixedFormula = await callOpenAIAPI(errorItem.formula, errorItem.error);
                break;
              case 'lmstudio':
              default:
                fixedFormula = await callLMStudioAPI(errorItem.formula, errorItem.error);
                break;
            }

            if (fixedFormula) {
              const validation = await this.validateFormula(fixedFormula);
              results.push({
                id: errorItem.id,
                success: true,
                original: errorItem.formula,
                fixed: fixedFormula,
                validation: validation
              });
            } else {
              results.push({
                id: errorItem.id,
                success: false,
                error: 'LLM未能生成修正结果'
              });
            }
          } catch (error) {
            results.push({
              id: errorItem.id,
              success: false,
              error: error.message
            });
          }
        }

        res.json({
          success: true,
          results: results,
          provider: provider
        });
      } catch (error) {
        console.error('批量纠错失败:', error);
        res.status(500).json({ 
          error: '批量纠错失败', 
          message: error.message 
        });
      }
    });

    // 文件夹批量检查
    this.app.post('/check-folder', async (req, res) => {
      try {
        const { folderPath } = req.body;
        
        if (!folderPath) {
          return res.status(400).json({ error: '请提供文件夹路径' });
        }

        const results = await this.checkFolder(folderPath);
        
        res.json({
          success: true,
          folderPath: folderPath,
          results: results,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('文件夹检查错误:', error);
        res.status(500).json({ 
          error: '文件夹检查失败', 
          message: error.message 
        });
      }
    });

    // 读取文件内容（用于文件夹模式的应用修正）
    this.app.post('/read-file', async (req, res) => {
      try {
        const { filePath } = req.body;
        
        if (!filePath) {
          return res.status(400).json({ error: '请提供文件路径' });
        }

        // 安全检查：确保路径是绝对路径且存在
        if (!path.isAbsolute(filePath)) {
          return res.status(400).json({ error: '只支持绝对路径' });
        }

        const content = await fs.readFile(filePath, 'utf-8');
        
        res.json({
          success: true,
          content: content,
          filePath: filePath
        });
      } catch (error) {
        console.error('读取文件错误:', error);
        res.status(500).json({ 
          error: '读取文件失败', 
          message: error.message 
        });
      }
    });

    // 应用修正并替换浏览器选择的文件（模拟文件下载替换）
    this.app.post('/apply-fixes-browser', async (req, res) => {
      try {
        const { content, fixes, filename } = req.body;
        
        if (!content || !fixes) {
          return res.status(400).json({ error: '请提供内容和修正信息' });
        }

        let modifiedContent = content;
        
        // 按位置倒序排列，避免位置偏移
        const sortedFixes = fixes.sort((a, b) => b.position - a.position);
        
        for (const fix of sortedFixes) {
          if (fix.accepted && fix.fixed) {
            modifiedContent = modifiedContent.substring(0, fix.position) + 
                            fix.fixed + 
                            modifiedContent.substring(fix.position + fix.original.length);
          }
        }

        // 对于浏览器文件，我们返回修正后的内容，让前端处理文件替换
        res.json({
          success: true,
          content: modifiedContent,
          filename: filename,
          appliedFixes: fixes.filter(f => f.accepted).length
        });
      } catch (error) {
        console.error('应用修正失败:', error);
        res.status(500).json({ 
          error: '应用修正失败', 
          message: error.message 
        });
      }
    });

    // 应用修正并替换原文件
    this.app.post('/apply-fixes-inplace', async (req, res) => {
      try {
        const { content, fixes, filePath, mode } = req.body;
        
        if (!content || !fixes) {
          return res.status(400).json({ error: '请提供内容和修正信息' });
        }

        let modifiedContent = content;
        
        // 按位置倒序排列，避免位置偏移
        const sortedFixes = fixes.sort((a, b) => b.position - a.position);
        
        for (const fix of sortedFixes) {
          if (fix.accepted && fix.fixed) {
            modifiedContent = modifiedContent.substring(0, fix.position) + 
                            fix.fixed + 
                            modifiedContent.substring(fix.position + fix.original.length);
          }
        }

        if (mode === 'folder' && filePath) {
          // 文件夹模式：直接替换原文件
          if (!path.isAbsolute(filePath)) {
            return res.status(400).json({ error: '只支持绝对路径' });
          }

          await fs.writeFile(filePath, modifiedContent, 'utf-8');
          
          res.json({
            success: true,
            message: '文件已更新',
            filePath: filePath,
            appliedFixes: fixes.filter(f => f.accepted).length
          });
        } else {
          // 单文件或文本模式：生成新文件（保持原有行为）
          const outputFilename = this.generateFixedFilename(req.body.filename || 'untitled.md');
          const outputPath = path.join(this.outputDir, outputFilename);
          await this.ensureDir(this.outputDir);
          await fs.writeFile(outputPath, modifiedContent, 'utf-8');

          res.json({
            success: true,
            filename: outputFilename,
            path: `/output/${outputFilename}`,
            appliedFixes: fixes.filter(f => f.accepted).length
          });
        }
      } catch (error) {
        console.error('应用修正失败:', error);
        res.status(500).json({ 
          error: '应用修正失败', 
          message: error.message 
        });
      }
    });

    // 获取可用模型列表
    this.app.post('/get-models', async (req, res) => {
      try {
        const { provider, config } = req.body;
        
        if (!provider) {
          return res.status(400).json({ error: '请提供LLM提供商' });
        }

        let url;
        let headers = {};

        switch (provider) {
          case 'lmstudio':
            url = `${config.endpoint}/v1/models`;
            break;
          case 'ollama':
            url = `${config.endpoint}/api/tags`;
            break;
          case 'openai':
            url = `${config.endpoint}/v1/models`;
            if (config.apikey) {
              headers['Authorization'] = `Bearer ${config.apikey}`;
            }
            break;
          default:
            return res.status(400).json({ error: '不支持的提供商' });
        }

        const response = await fetch(url, { 
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        let models = [];

        switch (provider) {
          case 'lmstudio':
          case 'openai':
            models = data.data ? data.data.map(model => model.id) : [];
            break;
          case 'ollama':
            models = data.models ? data.models.map(model => model.name) : [];
            break;
        }

        res.json({
          success: true,
          provider: provider,
          models: models
        });

      } catch (error) {
        console.error(`获取 ${provider} 模型列表失败:`, error);
        res.status(500).json({ 
          error: '获取模型列表失败', 
          message: error.message 
        });
      }
    });

    // 测试LLM连接
    this.app.post('/test-connection', async (req, res) => {
      try {
        const { provider, config } = req.body;
        
        if (!provider || !config) {
          return res.status(400).json({ error: '请提供LLM提供商和配置' });
        }

        let url;
        let headers = {};

        switch (provider) {
          case 'lmstudio':
            url = `${config.endpoint}/v1/models`;
            break;
          case 'ollama':
            url = `${config.endpoint}/api/tags`;
            break;
          case 'openai':
            url = `${config.endpoint}/v1/models`;
            if (config.apikey) {
              headers['Authorization'] = `Bearer ${config.apikey}`;
            } else {
              return res.status(400).json({ error: 'OpenAI需要提供API Key' });
            }
            break;
          default:
            return res.status(400).json({ error: '不支持的提供商' });
        }

        const response = await fetch(url, { 
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(5000)
        });

        res.json({
          success: response.ok,
          provider: provider,
          status: response.status,
          message: response.ok ? '连接成功' : `连接失败: ${response.statusText}`
        });

      } catch (error) {
        console.error(`测试 ${provider} 连接失败:`, error);
        res.status(500).json({ 
          error: '连接测试失败', 
          message: error.message,
          success: false
        });
      }
    });

  }

  /**
   * 检查文件夹中的所有Markdown文件
   */
  async checkFolder(folderPath) {
    const results = {
      folderPath: folderPath,
      totalFiles: 0,
      processedFiles: 0,
      filesWithErrors: 0,
      totalFormulas: 0,
      totalErrors: 0,
      files: []
    };

    try {
      // 读取文件夹内容
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      
      // 递归查找所有Markdown文件
      const mdFiles = await this.findMarkdownFiles(folderPath);
      results.totalFiles = mdFiles.length;

      // 检查每个文件
      for (const filePath of mdFiles) {
        try {
          const relativePath = path.relative(folderPath, filePath);
          const content = await fs.readFile(filePath, 'utf-8');
          const fileResult = await this.checkMathFormulas(content, relativePath);
          
          results.files.push({
            path: relativePath,
            fullPath: filePath,
            ...fileResult
          });
          
          results.processedFiles++;
          results.totalFormulas += fileResult.totalFormulas;
          results.totalErrors += fileResult.errors.length;
          
          if (fileResult.hasErrors) {
            results.filesWithErrors++;
          }
        } catch (error) {
          console.error(`检查文件失败 ${filePath}:`, error);
          results.files.push({
            path: path.relative(folderPath, filePath),
            fullPath: filePath,
            error: error.message,
            totalFormulas: 0,
            validFormulas: 0,
            errors: [],
            formulas: [],
            hasErrors: false
          });
          results.processedFiles++;
        }
      }

      return results;
    } catch (error) {
      throw new Error(`无法访问文件夹: ${error.message}`);
    }
  }

  /**
   * 递归查找所有Markdown文件
   */
  async findMarkdownFiles(dir) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // 递归查找子目录
          const subFiles = await this.findMarkdownFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
          files.push(fullPath);
        }
      }
      
      return files;
    } catch (error) {
      console.error(`读取目录失败 ${dir}:`, error);
      return [];
    }
  }

  /**
   * 检查数学公式
   */
  async checkMathFormulas(content, filename) {
    const errors = [];
    const formulas = [];
    
    // 提取数学公式的正则表达式
    const patterns = [
      { regex: /\$\$([\s\S]*?)\$\$/g, type: 'block', delim: '$$' },
      { regex: /\\\[([\s\S]*?)\\\]/g, type: 'block', delim: '\\[' },
      { regex: /\$([^$\n]+?)\$/g, type: 'inline', delim: '$' },
      { regex: /\\\(([^)]+?)\\\)/g, type: 'inline', delim: '\\(' }
    ];

    let formulaId = 0;
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const mathContent = match[1].trim();
        if (!mathContent) continue;

        formulaId++;
        const formula = {
          id: formulaId,
          content: mathContent,
          raw: match[0],
          type: pattern.type,
          position: match.index,
          valid: false,
          error: null,
          rendered: null
        };

        try {
          // 尝试渲染公式
          const rendered = katex.renderToString(mathContent, {
            throwOnError: true,
            displayMode: pattern.type === 'block',
            output: 'html',
            strict: false
          });
          
          formula.valid = true;
          formula.rendered = rendered;
        } catch (error) {
          formula.valid = false;
          formula.error = error.message;
          errors.push(formula);
        }

        formulas.push(formula);
      }
    }

    return {
      filename: filename,
      totalFormulas: formulas.length,
      validFormulas: formulas.filter(f => f.valid).length,
      errors: errors,
      formulas: formulas,
      hasErrors: errors.length > 0
    };
  }

  /**
   * 验证修正后的公式
   */
  async validateFormula(formula) {
    try {
      const rendered = katex.renderToString(formula, {
        throwOnError: true,
        displayMode: true,
        output: 'html',
        strict: false
      });
      
      return {
        valid: true,
        rendered: rendered,
        error: null
      };
    } catch (error) {
      return {
        valid: false,
        rendered: null,
        error: error.message
      };
    }
  }

  /**
   * 生成修正后的文件名
   */
  generateFixedFilename(originalName) {
    const timestamp = Date.now();
    const parsed = path.parse(originalName);
    return `${timestamp}-${parsed.name}-fixed${parsed.ext}`;
  }

  /**
   * 更新LLM配置
   */
  async updateLLMConfig(provider, config) {
    try {
      if (provider === 'openai' && config) {
        // 动态更新 OpenAI 配置
        setOpenAIConfig({
          baseUrl: config.endpoint,
          model: config.model,
          apiKey: config.apikey,
          systemPrompt: config.prompt
        });
      }
      // 对于 LMStudio 和 Ollama，配置会在llm-fixer.js中处理
      // 这里可以扩展支持动态更新其他提供商的配置
    } catch (error) {
      console.error(`更新 ${provider} 配置失败:`, error);
      throw error;
    }
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
        console.log(`📐 LaTeX公式修复助手 服务器启动`);
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
 * 启动KaTeX检查GUI服务器
 */
export async function startKatexCheckGUI(options = {}) {
  const gui = new KatexCheckGUI(options);
  await gui.start();
  return gui;
}