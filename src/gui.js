/**
 * GUI Module - Markdown to PDF GUI
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
 * GUI Server Class
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
   * Set up middleware
   */
  setupMiddleware() {
    // Static file serving
    this.app.use('/static', express.static(path.join(__dirname, '../web')));
    this.app.use('/output', express.static(this.outputDir));
    
    // JSON parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // File upload configuration
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
          cb(new Error('Only Markdown files (.md) are supported'));
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
      }
    });
  }

  /**
   * Set up routes
   */
  setupRoutes() {
    // Home page
    this.app.get('/', (req, res) => {
      res.redirect('/static/index.html');
    });

    // Upload and convert
    this.app.post('/convert', this.upload.single('markdown'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'Please select a Markdown file' });
        }

        const options = this.parseConvertOptions(req.body);
        const inputPath = req.file.path;
        const outputFilename = this.generateOutputFilename(req.file.originalname, options.format);
        const outputPath = path.join(this.outputDir, outputFilename);

        await this.ensureDir(this.outputDir);

        // Read file content for preview
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
        console.error('Conversion error:', error);
        res.status(500).json({ 
          error: 'Conversion failed', 
          message: error.message 
        });
      }
    });

    // Get conversion history
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
        res.status(500).json({ error: 'Failed to get history' });
      }
    });

    // Delete file
    this.app.delete('/file/:filename', async (req, res) => {
      try {
        const filename = req.params.filename;
        const filePath = path.join(this.outputDir, filename);
        
        if (await fileExists(filePath)) {
          await fs.unlink(filePath);
          res.json({ success: true });
        } else {
          res.status(404).json({ error: 'File not found' });
        }
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete file' });
      }
    });

    // Get file content for review
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
            res.status(400).json({ error: 'Unsupported file type' });
          }
        } else {
          res.status(404).json({ error: 'File not found' });
        }
      } catch (error) {
        res.status(500).json({ error: 'Failed to get file content' });
      }
    });
  }

  /**
   * Parses conversion options
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
   * Generates an output filename
   */
  generateOutputFilename(originalName, format) {
    const timestamp = Date.now();
    const baseName = path.parse(originalName).name;
    const extension = format === 'pdf' ? 'pdf' : 'html';
    return `${timestamp}-${baseName}.${extension}`;
  }

  /**
   * Ensures a directory exists
   */
  async ensureDir(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Starts the server
   */
  async start() {
    await this.ensureDir(this.uploadsDir);
    await this.ensureDir(this.outputDir);
    
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`🌐 Markdown PDF GUI server started`);
        console.log(`📍 Address: http://localhost:${this.port}`);
        console.log(`📁 Upload directory: ${this.uploadsDir}`);
        console.log(`📁 Output directory: ${this.outputDir}`);
        resolve();
      });
    });
  }

  /**
   * Stops the server
   */
  stop() {
    if (this.server) {
      this.server.close();
    }
  }
}

/**
 * Starts the GUI server
 */
export async function startGUI(options = {}) {
  const gui = new MarkdownPdfGUI(options);
  await gui.start();
  return gui;
}