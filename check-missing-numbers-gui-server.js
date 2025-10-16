#!/usr/bin/env node

/**
 * File Number Check GUI Server
 * Provides a visual interface to detect missing numbers in a folder.
 */

import express from 'express';
import multer from 'multer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();

// Middleware configuration
app.use(express.json({ limit: '50mb' })); // Increase JSON request body size limit
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Increase URL-encoded request body size limit

// Static file serving
app.use('/static', express.static(path.join(__dirname, 'check-numbers-web')));

/**
 * Extracts numbers from a filename.
 * @param {string} filename - The filename.
 * @returns {Array} An array of numbers.
 */
function extractNumbers(filename) {
  const numbers = filename.match(/\d+/g);
  return numbers ? numbers.map(num => parseInt(num, 10)) : [];
}

/**
 * Extracts the main number from a filename (usually the first or the largest).
 * @param {string} filename - The filename.
 * @param {string} strategy - The extraction strategy: 'first' | 'max'.
 * @returns {number|null} The main number.
 */
function extractMainNumber(filename, strategy = 'max') {
  const numbers = extractNumbers(filename);
  if (numbers.length === 0) return null;
  
  if (strategy === 'first') {
    return numbers[0];
  } else {
    // Strategy: use the largest number (suitable for page numbers, etc.)
    return Math.max(...numbers);
  }
}

/**
 * Checks for missing file numbers in a folder.
 * @param {string} folderPath - The path to the folder.
 * @param {Object} options - The options.
 * @returns {Object} The check result.
 */
async function checkMissingNumbers(folderPath, options = {}) {
  const {
    fileExtension = '',
    recursive = false,
    strategy = 'max'
  } = options;

  try {
    const files = [];
    
    // Get the list of files
    async function scanDirectory(dirPath, currentDepth = 0) {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory() && recursive) {
          await scanDirectory(fullPath, currentDepth + 1);
        } else if (entry.isFile()) {
          // Filter by file extension
          if (fileExtension && !entry.name.toLowerCase().endsWith(fileExtension.toLowerCase())) {
            continue;
          }
          
          const relativePath = path.relative(folderPath, fullPath);
          files.push({
            name: entry.name,
            path: relativePath,
            fullPath: fullPath
          });
        }
      }
    }
    
    await scanDirectory(folderPath);
    
    // Extract files with numbers
    const filesWithNumbers = [];
    const filesWithoutNumbers = [];
    
    files.forEach(file => {
      const mainNumber = extractMainNumber(file.name, strategy);
      
      if (mainNumber !== null) {
        filesWithNumbers.push({
          ...file,
          number: mainNumber
        });
      } else {
        filesWithoutNumbers.push(file);
      }
    });
    
    // Sort by number
    filesWithNumbers.sort((a, b) => a.number - b.number);
    
    // Detect missing numbers
    const numbers = filesWithNumbers.map(f => f.number);
    const missingNumbers = [];
    
    if (numbers.length > 0) {
      const min = Math.min(...numbers);
      const max = Math.max(...numbers);
      
      for (let i = min; i <= max; i++) {
        if (!numbers.includes(i)) {
          missingNumbers.push(i);
        }
      }
    }
    
    // Detect duplicate numbers
    const duplicates = [];
    const numberCounts = {};
    
    numbers.forEach(num => {
      numberCounts[num] = (numberCounts[num] || 0) + 1;
    });
    
    Object.entries(numberCounts).forEach(([num, count]) => {
      if (count > 1) {
        const duplicateFiles = filesWithNumbers.filter(f => f.number === parseInt(num));
        duplicates.push({
          number: parseInt(num),
          count: count,
          files: duplicateFiles
        });
      }
    });
    
    return {
      totalFiles: files.length,
      filesWithNumbers: filesWithNumbers,
      filesWithoutNumbers: filesWithoutNumbers,
      missingNumbers: missingNumbers,
      duplicates: duplicates,
      numberRange: numbers.length > 0 ? { min: Math.min(...numbers), max: Math.max(...numbers) } : null
    };
    
  } catch (error) {
    throw new Error(`Unable to scan folder ${folderPath}: ${error.message}`);
  }
}

/**
 * Formats missing numbers into ranges for display.
 * @param {Array} missingNumbers - An array of missing numbers.
 * @returns {Array} An array of formatted ranges.
 */
function formatMissingRanges(missingNumbers) {
  if (missingNumbers.length === 0) return [];
  
  const ranges = [];
  let start = missingNumbers[0];
  let end = start;
  
  for (let i = 1; i < missingNumbers.length; i++) {
    if (missingNumbers[i] === end + 1) {
      end = missingNumbers[i];
    } else {
      ranges.push({
        start: start,
        end: end,
        display: start === end ? `${start}` : `${start}-${end}`
      });
      start = missingNumbers[i];
      end = start;
    }
  }
  ranges.push({
    start: start,
    end: end,
    display: start === end ? `${start}` : `${start}-${end}`
  });
  
  return ranges;
}

// Route handling

// Main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'check-numbers-web', 'index.html'));
});

// API: Extract folder path from file list
app.post('/api/extract-folder-path', async (req, res) => {
  try {
    const { files } = req.body;
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a file list'
      });
    }
    
    // Extract folder path from the path of the first file
    const firstFile = files[0];
    if (!firstFile.webkitRelativePath) {
      return res.status(400).json({
        success: false,
        error: 'Unable to get file path information'
      });
    }
    
    const pathParts = firstFile.webkitRelativePath.split('/');
    if (pathParts.length > 1) {
      // Remove the filename, keeping only the folder path
      pathParts.pop();
      const relativeFolderPath = pathParts.join('/');
      
      // Try to infer the absolute path
      const possibleAbsolutePaths = [];
      
      // Windows path inference
      if (process.platform === 'win32') {
        const drives = ['C:', 'D:', 'E:', 'F:'];
        const commonFolders = ['Users', 'Documents', 'Desktop', 'Downloads'];
        
        drives.forEach(drive => {
          commonFolders.forEach(folder => {
            possibleAbsolutePaths.push(`${drive}\\${folder}\\${relativeFolderPath.replace(/\//g, '\\')}`);
          });
          possibleAbsolutePaths.push(`${drive}\\${relativeFolderPath.replace(/\//g, '\\')}`);
        });
      } else {
        // Unix-like system path inference
        const commonFolders = ['/home', '/Users', '/Documents', '/Desktop'];
        commonFolders.forEach(folder => {
          possibleAbsolutePaths.push(`${folder}/${relativeFolderPath}`);
        });
        possibleAbsolutePaths.push(`/${relativeFolderPath}`);
      }
      
      res.json({
        success: true,
        data: {
          relativePath: relativeFolderPath,
          fileCount: files.length,
          possibleAbsolutePaths: possibleAbsolutePaths.slice(0, 5), // Limit the number of returned paths
          platform: process.platform
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Unable to extract folder information from file path'
      });
    }
    
  } catch (error) {
    console.error('Error extracting folder path:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API: Check numbers using file system handle
app.post('/api/check-with-handle', async (req, res) => {
  try {
    const { 
      files, 
      fileExtension = '', 
      recursive = false, 
      strategy = 'max' 
    } = req.body;
    
    if (!files || !Array.isArray(files)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide a file list' 
      });
    }
    
    // Filter files
    let filteredFiles = files;
    if (fileExtension) {
      filteredFiles = files.filter(file => 
        file.name.toLowerCase().endsWith(fileExtension.toLowerCase())
      );
    }
    
    // Extract files with numbers
    const filesWithNumbers = [];
    const filesWithoutNumbers = [];
    
    filteredFiles.forEach(file => {
      const mainNumber = extractMainNumber(file.name, strategy);
      
      if (mainNumber !== null) {
        filesWithNumbers.push({
          name: file.name,
          path: file.relativePath || file.name,
          fullPath: file.relativePath || file.name,
          number: mainNumber,
          size: file.size,
          lastModified: file.lastModified
        });
      } else {
        filesWithoutNumbers.push({
          name: file.name,
          path: file.relativePath || file.name,
          fullPath: file.relativePath || file.name,
          size: file.size,
          lastModified: file.lastModified
        });
      }
    });
    
    // Sort by number
    filesWithNumbers.sort((a, b) => a.number - b.number);
    
    // Detect missing numbers
    const numbers = filesWithNumbers.map(f => f.number);
    const missingNumbers = [];
    
    if (numbers.length > 0) {
      const min = Math.min(...numbers);
      const max = Math.max(...numbers);
      
      for (let i = min; i <= max; i++) {
        if (!numbers.includes(i)) {
          missingNumbers.push(i);
        }
      }
    }
    
    // Detect duplicate numbers
    const duplicates = [];
    const numberCounts = {};
    
    numbers.forEach(num => {
      numberCounts[num] = (numberCounts[num] || 0) + 1;
    });
    
    Object.entries(numberCounts).forEach(([num, count]) => {
      if (count > 1) {
        const duplicateFiles = filesWithNumbers.filter(f => f.number === parseInt(num));
        duplicates.push({
          number: parseInt(num),
          count: count,
          files: duplicateFiles
        });
      }
    });
    
    // Format missing ranges
    const missingRanges = formatMissingRanges(missingNumbers);
    
    res.json({
      success: true,
      data: {
        totalFiles: filteredFiles.length,
        filesWithNumbers: filesWithNumbers,
        filesWithoutNumbers: filesWithoutNumbers,
        missingNumbers: missingNumbers,
        duplicates: duplicates,
        numberRange: numbers.length > 0 ? { min: Math.min(...numbers), max: Math.max(...numbers) } : null,
        missingRanges: missingRanges,
        enhancedMode: true, // Mark as enhanced mode
        summary: {
          totalFiles: filteredFiles.length,
          filesWithNumbers: filesWithNumbers.length,
          filesWithoutNumbers: filesWithoutNumbers.length,
          missingCount: missingNumbers.length,
          duplicateCount: duplicates.length,
          hasIssues: missingNumbers.length > 0 || duplicates.length > 0
        }
      }
    });
    
  } catch (error) {
    console.error('File system handle check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API: Register custom protocol handler
app.post('/api/register-protocol', (req, res) => {
  try {
    const protocolInfo = {
      protocol: 'filecheck://',
      description: 'File Number Check Tool Protocol',
      supported: false,
      instructions: [
        '1. Create a registry entry (Windows):',
        'HKEY_CLASSES_ROOT\\filecheck',
        'HKEY_CLASSES_ROOT\\filecheck\\shell\\open\\command',
        '2. Set the command value: "node check-missing-numbers-gui-server.js --path=%1"',
        '3. Use in file manager: filecheck://C:\\path\\to\\folder'
      ]
    };
    
    res.json({
      success: true,
      data: protocolInfo
    });
    
  } catch (error) {
    console.error('Protocol registration error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API: Check local path
app.post('/api/check-local-path', async (req, res) => {
  try {
    const { localPath } = req.body;
    
    if (!localPath) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a local path'
      });
    }
    
    // Check if the path exists
    try {
      await fs.access(localPath);
      
      // Get path information
      const stats = await fs.stat(localPath);
      
      if (stats.isDirectory()) {
        res.json({
          success: true,
          data: {
            path: localPath,
            exists: true,
            isDirectory: true,
            absolutePath: path.resolve(localPath)
          }
        });
      } else {
        res.json({
          success: false,
          error: 'The specified path is not a folder'
        });
      }
      
    } catch (error) {
      res.json({
        success: false,
        error: `Path does not exist or is not accessible: ${localPath}`
      });
    }
    
  } catch (error) {
    console.error('Local path check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API: Check file numbers
app.post('/api/check', async (req, res) => {
  try {
    const { 
      folderPath, 
      fileExtension = '', 
      recursive = false, 
      strategy = 'max' 
    } = req.body;
    
    if (!folderPath) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide a folder path' 
      });
    }
    
    // Check if the folder exists
    try {
      await fs.access(folderPath);
    } catch (error) {
      return res.status(400).json({ 
        success: false, 
        error: `Folder does not exist or is not accessible: ${folderPath}` 
      });
    }
    
    const result = await checkMissingNumbers(folderPath, {
      fileExtension,
      recursive,
      strategy
    });
    
    // Format missing ranges
    const missingRanges = formatMissingRanges(result.missingNumbers);
    
    res.json({
      success: true,
      data: {
        ...result,
        missingRanges: missingRanges,
        summary: {
          totalFiles: result.totalFiles,
          filesWithNumbers: result.filesWithNumbers.length,
          filesWithoutNumbers: result.filesWithoutNumbers.length,
          missingCount: result.missingNumbers.length,
          duplicateCount: result.duplicates.length,
          hasIssues: result.missingNumbers.length > 0 || result.duplicates.length > 0
        }
      }
    });
    
  } catch (error) {
    console.error('Check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API: Get folder list (for path suggestions)
app.post('/api/list-folders', async (req, res) => {
  try {
    const { parentPath = process.cwd() } = req.body;
    
    // Special handling: if it's a Windows root path or empty, show the drive list
    if (process.platform === 'win32' && (!parentPath || parentPath === '' || parentPath === 'drives')) {
      const drives = await getWindowsDrives();
      return res.json({
        success: true,
        data: {
          currentPath: 'Computer',
          folders: drives
        }
      });
    }
    
    // Check if the path exists
    try {
      await fs.access(parentPath);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: `Path does not exist or is not accessible: ${parentPath}`
      });
    }
    
    const entries = await fs.readdir(parentPath, { withFileTypes: true });
    const folders = entries
      .filter(entry => entry.isDirectory())
      .map(entry => ({
        name: entry.name,
        path: path.join(parentPath, entry.name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 50); // Limit the number of returned items
    
    res.json({
      success: true,
      data: {
        currentPath: parentPath,
        folders: folders
      }
    });
    
  } catch (error) {
    console.error('Error getting folder list:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Gets the list of Windows drives.
 */
async function getWindowsDrives() {
  if (process.platform !== 'win32') {
    return [];
  }
  
  const drives = [];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  
  for (const letter of letters) {
    const drivePath = `${letter}:\\`;
    try {
      await fs.access(drivePath);
      drives.push({
        name: `${letter}: Drive`,
        path: drivePath
      });
    } catch (error) {
      // Drive does not exist, skip
    }
  }
  
  return drives;
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handling
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found'
  });
});

/**
 * Starts the server.
 */
async function startServer() {
  const port = process.env.PORT || 3003;
  
  // Ensure the web directory exists
  const webDir = path.join(__dirname, 'check-numbers-web');
  try {
    await fs.access(webDir);
  } catch (error) {
    console.log(chalk.yellow('📁 Creating web directory...'));
    await fs.mkdir(webDir, { recursive: true });
  }
  
  app.listen(port, () => {
    console.log(chalk.cyan.bold(`
┌─────────────────────────────────────────┐
│  🔍 File Number Check GUI Launcher      │
│  📊 Number Analysis | 🚨 Missing Detection | 📋 Detailed Report   │
└─────────────────────────────────────────┘
`));
    
    console.log(chalk.green('✨ Server started successfully!'));
    console.log(chalk.yellow(`🌍 Please visit in your browser: http://localhost:${port}`));
    console.log(chalk.blue(`📁 Web file directory: ${webDir}`));
    console.log(chalk.gray('\nPress Ctrl+C to stop the server\n'));
  });
  
  // Gracefully handle exit
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n👋 Shutting down server...'));
    process.exit(0);
  });
  
  process.on('uncaughtException', (error) => {
    console.error(chalk.red('❌ Uncaught exception:'), error);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('❌ Unhandled promise rejection:'), reason);
    process.exit(1);
  });
}

// If this file is run directly, start the server
if (process.argv[1] && process.argv[1].endsWith('check-missing-numbers-gui-server.js')) {
  startServer().catch(error => {
    console.error(chalk.red('❌ Startup failed:'), error);
    process.exit(1);
  });
}

export { startServer, checkMissingNumbers };
