#!/usr/bin/env node

/**
 * Markdown File Merge GUI Server
 * Provides a visual interface to merge Markdown files in a folder and convert them to PDF
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
    
    // Create HTTP server
    this.server = createServer(this.app);
    
    // Create WebSocket server
    this.wss = new WebSocketServer({ server: this.server });
    this.wsClients = new Set();
    
    this.setupWebSocket();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Set up WebSocket connection
   */
  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log(chalk.blue('🔗 WebSocket client connected'));
      this.wsClients.add(ws);
      
      ws.on('close', () => {
        console.log(chalk.blue('❌ WebSocket client disconnected'));
        this.wsClients.delete(ws);
      });
      
      ws.on('error', (error) => {
        console.error(chalk.red('WebSocket error:'), error);
        this.wsClients.delete(ws);
      });
    });
  }

  /**
   * Broadcast progress messages to all connected clients
   */
  broadcastProgress(data) {
    const message = JSON.stringify(data);
    this.wsClients.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(message);
        } catch (error) {
          console.error(chalk.red('Failed to send WebSocket message:'), error);
          this.wsClients.delete(ws);
        }
      }
    });
  }

  /**
   * Set up middleware
   */
  setupMiddleware() {
    this.app.use(cors());
    // Remove all JSON and URL-encoded size limits
    this.app.use(express.json({ limit: Infinity })); 
    this.app.use(express.urlencoded({ extended: true, limit: Infinity }));
    
    // Static file serving
    this.app.use('/static', express.static(path.join(__dirname, 'merge-web')));
    this.app.use('/output', express.static(this.outputDir));
    
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
        console.log(chalk.blue(`🔍 Checking file: ${file.originalname}`));
        console.log(chalk.blue(`   MIME type: ${file.mimetype}`));
        console.log(chalk.blue(`   Field name: ${file.fieldname}`));
        
        // Check field name
        if (file.fieldname !== 'markdownFiles') {
          console.log(chalk.red(`❌ Incorrect field name: ${file.fieldname}, expected: markdownFiles`));
          return cb(new Error(`Incorrect field name: ${file.fieldname}, expected: markdownFiles`));
        }
        
        // Check file type - relax the check conditions
        const isMarkdown = file.mimetype === 'text/markdown' || 
                          file.mimetype === 'text/plain' ||
                          file.mimetype === 'application/octet-stream' ||
                          path.extname(file.originalname).toLowerCase() === '.md';
        
        if (isMarkdown) {
          console.log(chalk.green(`✅ File type check passed: ${file.originalname}`));
          cb(null, true);
        } else {
          console.log(chalk.yellow(`⚠️ May not be a Markdown file, but allowed to upload: ${file.originalname}`));
          cb(null, true); // Allow all files to pass
        }
      }
      // Remove all limits
    });
  }

  /**
   * Set up routes
   */
  setupRoutes() {
    // Home page
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'merge-web', 'index.html'));
    });

    // Upload multiple Markdown files
    this.app.post('/upload', (req, res, next) => {
      console.log(chalk.cyan('📤 Received upload request'));
      console.log(chalk.blue('Content-Type:', req.get('Content-Type')));
      
      // Remove file count limit, use default unlimited
      this.upload.array('markdownFiles')(req, res, (err) => {
        if (err) {
          console.error(chalk.red('Multer error:'), err);
          if (err instanceof multer.MulterError) {
            if (err.code === 'UNEXPECTED_FIELD') {
              return res.status(400).json({ 
                error: `Unexpected field name. Expected: 'markdownFiles', received: '${err.field}'` 
              });
            }
            // Remove all file size and count limit error handling
          }
          return res.status(500).json({ error: err.message });
        }
        next();
      });
    }, async (req, res) => {
      try {
        console.log(chalk.cyan('📋 Processing uploaded files...'));
        console.log(chalk.blue('Number of files:', req.files ? req.files.length : 0));
        
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ error: 'Please upload at least one file' });
        }

        const files = req.files.map(file => ({
          originalName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
          filename: file.filename,
          path: file.path,
          size: file.size
        }));

        console.log(chalk.green(`📁 Successfully processed ${files.length} files`));
        files.forEach((file, index) => {
          console.log(chalk.gray(`   ${index + 1}. ${file.originalName} (${file.size} bytes)`));
        });

        res.json({
          success: true,
          message: 'Files uploaded successfully',
          files: files
        });
      } catch (error) {
        console.error(chalk.red('Processing error:'), error);
        res.status(500).json({ error: error.message });
      }
    });

    // Merge and convert to PDF
    this.app.post('/merge-convert', async (req, res) => {
      try {
        const { files, outputName, styleOptions } = req.body;
        
        if (!files || files.length === 0) {
          return res.status(400).json({ error: 'No files to merge' });
        }

        // Natural sort by filename
        const sortedFiles = files.sort((a, b) => this.naturalSort(a.originalName, b.originalName));
        
        console.log(chalk.cyan('🔗 Starting to merge files...'));
        console.log(chalk.blue('File order:'));
        sortedFiles.forEach((file, index) => {
          console.log(chalk.gray(`   ${index + 1}. ${file.originalName}`));
        });

        // Merge file content
        const mergedContent = await this.mergeMarkdownFiles(sortedFiles);

        // Create temporary merged file
        await this.ensureDir(this.tempDir);
        const tempPath = path.join(this.tempDir, `merged-${Date.now()}.md`);
        await fs.writeFile(tempPath, mergedContent, 'utf-8');

        // Convert to PDF
        const timestamp = Date.now();
        const pdfName = outputName || `merged-document-${timestamp}.pdf`;
        const pdfPath = path.join(this.outputDir, pdfName);
        
        await this.ensureDir(this.outputDir);

        const converter = new MarkdownToPdfConverter({
          reuseInstance: true
          // Completely remove maxPages limit
        });

        // Set progress callback
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

        // Clean up temporary file
        try {
          await fs.unlink(tempPath);
        } catch (error) {
          console.warn(chalk.yellow('⚠️ Failed to delete temporary file:'), error.message);
        }

        console.log(chalk.green('✅ PDF merge and conversion complete!'));

        res.json({
          success: true,
          message: 'PDF conversion complete',
          filename: pdfName,
          downloadUrl: `/output/${pdfName}`,
          fileCount: sortedFiles.length
        });

      } catch (error) {
        console.error(chalk.red('Conversion error:'), error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get history file list
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

        // Sort by creation date in descending order
        fileList.sort((a, b) => new Date(b.created) - new Date(a.created));

        res.json({ files: fileList });
      } catch (error) {
        console.error(chalk.red('Error getting history files:'), error);
        res.status(500).json({ error: error.message });
      }
    });

    // Delete file
    this.app.delete('/history/:filename', async (req, res) => {
      try {
        const filename = req.params.filename;
        const filePath = path.join(this.outputDir, filename);
        
        await fs.unlink(filePath);
        console.log(chalk.yellow(`🗑️ Deleted file: ${filename}`));
        
        res.json({ success: true, message: 'File deleted successfully' });
      } catch (error) {
        console.error(chalk.red('Error deleting file:'), error);
        res.status(500).json({ error: error.message });
      }
    });

    // Clean up uploaded files
    this.app.post('/cleanup', async (req, res) => {
      try {
        const { files } = req.body;
        
        if (files && files.length > 0) {
          for (const file of files) {
            try {
              await fs.unlink(file.path);
            } catch (error) {
              console.warn(chalk.yellow(`⚠️ Failed to delete file ${file.filename}:`), error.message);
            }
          }
        }

        res.json({ success: true, message: 'Cleanup complete' });
      } catch (error) {
        console.error(chalk.red('Cleanup error:'), error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  /**
   * Merge Markdown files
   */
  async mergeMarkdownFiles(files) {
    const contents = [];
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file.path, 'utf-8');
        contents.push(content.trim());
        console.log(chalk.blue(`📖 Reading file: ${file.originalName}`));
      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Failed to read file ${file.originalName}:`), error.message);
      }
    }
    
    return contents.join('\n\n');
  }

  /**
   * Natural sort comparison function
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
   * Ensure directory exists
   */
  async ensureDir(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Start the server
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server.listen(this.port, () => {
          console.log(chalk.green(`🌐 Merge GUI server started on port ${this.port}`));
          console.log(chalk.blue(`📡 WebSocket server started`));
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the server
   */
  async stop() {
    // Close all WebSocket connections
    this.wsClients.forEach(ws => {
      ws.close();
    });
    this.wsClients.clear();
    
    if (this.server) {
      this.server.close();
    }
  }
}

// Start function
export async function startMergeGUI(options = {}) {
  const server = new MergeGUIServer(options);
  await server.start();
  return server;
}

// Run directly
async function main() {
  console.log(chalk.cyan.bold(`
┌─────────────────────────────────────────┐
│  📚 Markdown File Merge GUI              │
│  🔗 Smart Merge | 📄 PDF Conversion | 🎨 Style Customization    │
└─────────────────────────────────────────┘
`));

  try {
    const port = process.env.PORT || 3003;
    const server = await startMergeGUI({ port });
    
    console.log(chalk.green('\n✨ Merge GUI server started successfully!'));
    console.log(chalk.yellow(`🌍 Please visit in your browser: http://localhost:${port}`));
    console.log(chalk.blue('📁 Supports drag-and-drop upload of multiple Markdown files'));
    console.log(chalk.blue('🔄 Automatically sorts by filename naturally'));
    console.log(chalk.blue('🎨 Customizable PDF style options'));
    console.log(chalk.gray('\nPress Ctrl+C to stop the server\n'));
    
    // Gracefully handle exit
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n👋 Shutting down server...'));
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error(chalk.red('❌ Startup failed:'), error.message);
    process.exit(1);
  }
}

// If this file is run directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
