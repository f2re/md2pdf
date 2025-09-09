#!/usr/bin/env node

/**
 * 文件编号检测 GUI 服务器
 * 提供可视化界面来检测文件夹中缺失的编号
 */

import express from 'express';
import multer from 'multer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建 Express 应用
const app = express();

// 中间件配置
app.use(express.json({ limit: '50mb' })); // 增加JSON请求体大小限制
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // 增加URL编码请求体大小限制

// 静态文件服务
app.use('/static', express.static(path.join(__dirname, 'check-numbers-web')));

/**
 * 从文件名中提取数字
 * @param {string} filename - 文件名
 * @returns {Array} 数字数组
 */
function extractNumbers(filename) {
  const numbers = filename.match(/\d+/g);
  return numbers ? numbers.map(num => parseInt(num, 10)) : [];
}

/**
 * 从文件名中提取主要数字（通常是第一个或最大的数字）
 * @param {string} filename - 文件名
 * @param {string} strategy - 提取策略: 'first' | 'max'
 * @returns {number|null} 主要数字
 */
function extractMainNumber(filename, strategy = 'max') {
  const numbers = extractNumbers(filename);
  if (numbers.length === 0) return null;
  
  if (strategy === 'first') {
    return numbers[0];
  } else {
    // 策略: 使用最大的数字（适合页码等场景）
    return Math.max(...numbers);
  }
}

/**
 * 检测文件夹中的文件
 * @param {string} folderPath - 文件夹路径
 * @param {Object} options - 选项
 * @returns {Object} 检测结果
 */
async function checkMissingNumbers(folderPath, options = {}) {
  const {
    fileExtension = '',
    recursive = false,
    strategy = 'max'
  } = options;

  try {
    const files = [];
    
    // 获取文件列表
    async function scanDirectory(dirPath, currentDepth = 0) {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory() && recursive) {
          await scanDirectory(fullPath, currentDepth + 1);
        } else if (entry.isFile()) {
          // 文件扩展名过滤
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
    
    // 提取带数字的文件
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
    
    // 按数字排序
    filesWithNumbers.sort((a, b) => a.number - b.number);
    
    // 检测缺失的数字
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
    
    // 检测重复数字
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
    throw new Error(`无法扫描文件夹 ${folderPath}: ${error.message}`);
  }
}

/**
 * 格式化缺失数字为范围显示
 * @param {Array} missingNumbers - 缺失的数字数组
 * @returns {Array} 格式化的范围数组
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

// 路由处理

// 主页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'check-numbers-web', 'index.html'));
});

// API: 从文件列表中提取文件夹路径
app.post('/api/extract-folder-path', async (req, res) => {
  try {
    const { files } = req.body;
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供文件列表'
      });
    }
    
    // 从第一个文件的路径中提取文件夹路径
    const firstFile = files[0];
    if (!firstFile.webkitRelativePath) {
      return res.status(400).json({
        success: false,
        error: '无法获取文件路径信息'
      });
    }
    
    const pathParts = firstFile.webkitRelativePath.split('/');
    if (pathParts.length > 1) {
      // 移除文件名，只保留文件夹路径
      pathParts.pop();
      const relativeFolderPath = pathParts.join('/');
      
      // 尝试推断绝对路径
      const possibleAbsolutePaths = [];
      
      // Windows路径推断
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
        // Unix-like系统路径推断
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
          possibleAbsolutePaths: possibleAbsolutePaths.slice(0, 5), // 限制返回数量
          platform: process.platform
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: '无法从文件路径中提取文件夹信息'
      });
    }
    
  } catch (error) {
    console.error('提取文件夹路径错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API: 使用文件系统句柄检测编号
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
        error: '请提供文件列表' 
      });
    }
    
    // 过滤文件
    let filteredFiles = files;
    if (fileExtension) {
      filteredFiles = files.filter(file => 
        file.name.toLowerCase().endsWith(fileExtension.toLowerCase())
      );
    }
    
    // 提取带数字的文件
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
    
    // 按数字排序
    filesWithNumbers.sort((a, b) => a.number - b.number);
    
    // 检测缺失的数字
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
    
    // 检测重复数字
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
    
    // 格式化缺失范围
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
        enhancedMode: true, // 标记为增强模式
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
    console.error('文件系统句柄检测错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API: 注册自定义协议处理器
app.post('/api/register-protocol', (req, res) => {
  try {
    const protocolInfo = {
      protocol: 'filecheck://',
      description: '文件编号检测工具协议',
      supported: false,
      instructions: [
        '1. 创建注册表项 (Windows):',
        'HKEY_CLASSES_ROOT\\filecheck',
        'HKEY_CLASSES_ROOT\\filecheck\\shell\\open\\command',
        '2. 设置命令值: "node check-missing-numbers-gui-server.js --path=%1"',
        '3. 在文件管理器中使用: filecheck://C:\\path\\to\\folder'
      ]
    };
    
    res.json({
      success: true,
      data: protocolInfo
    });
    
  } catch (error) {
    console.error('协议注册错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API: 本地路径检测
app.post('/api/check-local-path', async (req, res) => {
  try {
    const { localPath } = req.body;
    
    if (!localPath) {
      return res.status(400).json({
        success: false,
        error: '请提供本地路径'
      });
    }
    
    // 检查路径是否存在
    try {
      await fs.access(localPath);
      
      // 获取路径信息
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
          error: '指定的路径不是文件夹'
        });
      }
      
    } catch (error) {
      res.json({
        success: false,
        error: `路径不存在或无法访问: ${localPath}`
      });
    }
    
  } catch (error) {
    console.error('本地路径检测错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API: 检测文件编号
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
        error: '请提供文件夹路径' 
      });
    }
    
    // 检查文件夹是否存在
    try {
      await fs.access(folderPath);
    } catch (error) {
      return res.status(400).json({ 
        success: false, 
        error: `文件夹不存在或无法访问: ${folderPath}` 
      });
    }
    
    const result = await checkMissingNumbers(folderPath, {
      fileExtension,
      recursive,
      strategy
    });
    
    // 格式化缺失范围
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
    console.error('检测错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API: 获取文件夹列表 (用于路径提示)
app.post('/api/list-folders', async (req, res) => {
  try {
    const { parentPath = process.cwd() } = req.body;
    
    // 特殊处理：如果是Windows根路径或为空，显示驱动器列表
    if (process.platform === 'win32' && (!parentPath || parentPath === '' || parentPath === 'drives')) {
      const drives = await getWindowsDrives();
      return res.json({
        success: true,
        data: {
          currentPath: '计算机',
          folders: drives
        }
      });
    }
    
    // 检查路径是否存在
    try {
      await fs.access(parentPath);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: `路径不存在或无法访问: ${parentPath}`
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
      .slice(0, 50); // 限制返回数量
    
    res.json({
      success: true,
      data: {
        currentPath: parentPath,
        folders: folders
      }
    });
    
  } catch (error) {
    console.error('获取文件夹列表错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取Windows驱动器列表
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
        name: `${letter}: 驱动器`,
        path: drivePath
      });
    } catch (error) {
      // 驱动器不存在，跳过
    }
  }
  
  return drives;
}

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

/**
 * 启动服务器
 */
async function startServer() {
  const port = process.env.PORT || 3003;
  
  // 确保web目录存在
  const webDir = path.join(__dirname, 'check-numbers-web');
  try {
    await fs.access(webDir);
  } catch (error) {
    console.log(chalk.yellow('📁 正在创建web目录...'));
    await fs.mkdir(webDir, { recursive: true });
  }
  
  app.listen(port, () => {
    console.log(chalk.cyan.bold(`
┌─────────────────────────────────────────┐
│  🔍 文件编号检测 可视化界面启动器        │
│  📊 编号分析 | 🚨 缺失检测 | 📋 详细报告   │
└─────────────────────────────────────────┘
`));
    
    console.log(chalk.green('✨ 服务器启动成功!'));
    console.log(chalk.yellow(`🌍 请在浏览器中访问: http://localhost:${port}`));
    console.log(chalk.blue(`📁 Web文件目录: ${webDir}`));
    console.log(chalk.gray('\n按 Ctrl+C 停止服务器\n'));
  });
  
  // 优雅地处理退出
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n👋 正在关闭服务器...'));
    process.exit(0);
  });
  
  process.on('uncaughtException', (error) => {
    console.error(chalk.red('❌ 未捕获的异常:'), error);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('❌ 未处理的Promise拒绝:'), reason);
    process.exit(1);
  });
}

// 如果直接运行此文件，启动服务器
if (process.argv[1] && process.argv[1].endsWith('check-missing-numbers-gui-server.js')) {
  startServer().catch(error => {
    console.error(chalk.red('❌ 启动失败:'), error);
    process.exit(1);
  });
}

export { startServer, checkMissingNumbers };
