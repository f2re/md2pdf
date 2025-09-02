#!/usr/bin/env node

/**
 * 检测文件夹中按文件名数字排序时缺失的编号
 * 用法: node check-missing-numbers.js <文件夹路径> [选项]
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';

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
 * @returns {number|null} 主要数字
 */
function extractMainNumber(filename) {
  const numbers = extractNumbers(filename);
  if (numbers.length === 0) return null;
  
  // 策略1: 使用第一个数字
  // return numbers[0];
  
  // 策略2: 使用最大的数字（适合页码等场景）
  return Math.max(...numbers);
}

/**
 * 检测文件夹中的文件
 * @param {string} folderPath - 文件夹路径
 * @param {Object} options - 选项
 * @returns {Object} 检测结果
 */
async function checkMissingNumbers(folderPath, options = {}) {
  const {
    fileExtension = '',  // 文件扩展名过滤，如 '.md', '.txt'
    recursive = false,   // 是否递归搜索
    strategy = 'max'     // 数字提取策略: 'first' | 'max'
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
      const mainNumber = strategy === 'first' 
        ? extractNumbers(file.name)[0] || null
        : extractMainNumber(file.name);
      
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
 * 生成详细报告
 * @param {Object} result - 检测结果
 * @param {Object} options - 选项
 */
function generateReport(result, options = {}) {
  const { folderPath, showDetails = false } = options;
  
  console.log(chalk.cyan('\n📋 文件编号检测报告'));
  console.log(chalk.cyan('=================='));
  
  if (folderPath) {
    console.log(chalk.blue(`📁 扫描路径: ${folderPath}`));
  }
  
  console.log(chalk.blue(`📄 总文件数: ${result.totalFiles}`));
  console.log(chalk.green(`🔢 带数字文件: ${result.filesWithNumbers.length}`));
  console.log(chalk.gray(`📝 无数字文件: ${result.filesWithoutNumbers.length}`));
  
  if (result.numberRange) {
    console.log(chalk.blue(`📊 数字范围: ${result.numberRange.min} - ${result.numberRange.max}`));
  }
  
  // 缺失数字
  if (result.missingNumbers.length > 0) {
    console.log(chalk.red(`\n❌ 缺失的数字 (${result.missingNumbers.length}个):`));
    console.log(chalk.red('================='));
    
    // 按连续范围分组显示
    const ranges = [];
    let start = result.missingNumbers[0];
    let end = start;
    
    for (let i = 1; i < result.missingNumbers.length; i++) {
      if (result.missingNumbers[i] === end + 1) {
        end = result.missingNumbers[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = result.missingNumbers[i];
        end = start;
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    
    console.log(chalk.yellow(`缺失编号: ${ranges.join(', ')}`));
  } else if (result.filesWithNumbers.length > 0) {
    console.log(chalk.green('\n✅ 没有缺失的数字'));
  }
  
  // 重复数字
  if (result.duplicates.length > 0) {
    console.log(chalk.red(`\n⚠️ 重复的数字 (${result.duplicates.length}个):`));
    console.log(chalk.red('================'));
    
    result.duplicates.forEach(dup => {
      console.log(chalk.yellow(`数字 ${dup.number} (出现 ${dup.count} 次):`));
      dup.files.forEach(file => {
        console.log(chalk.gray(`  - ${file.name}`));
      });
    });
  }
  
  // 无数字文件
  if (result.filesWithoutNumbers.length > 0 && showDetails) {
    console.log(chalk.gray(`\n📝 无数字的文件 (${result.filesWithoutNumbers.length}个):`));
    console.log(chalk.gray('==============='));
    
    result.filesWithoutNumbers.forEach(file => {
      console.log(chalk.gray(`  - ${file.name}`));
    });
  }
  
  // 详细文件列表
  if (showDetails && result.filesWithNumbers.length > 0) {
    console.log(chalk.blue(`\n📋 按数字排序的文件列表:`));
    console.log(chalk.blue('===================='));
    
    result.filesWithNumbers.forEach(file => {
      console.log(chalk.white(`${String(file.number).padStart(4)}: ${file.name}`));
    });
  }
}

/**
 * 解析命令行参数
 */
function parseArguments() {
  const args = process.argv.slice(2);
  
  const config = {
    folderPath: null,
    fileExtension: '',
    recursive: false,
    strategy: 'max',
    showDetails: false,
    help: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      config.help = true;
    } else if (arg === '--recursive' || arg === '-r') {
      config.recursive = true;
    } else if (arg === '--details' || arg === '-d') {
      config.showDetails = true;
    } else if (arg === '--strategy=first') {
      config.strategy = 'first';
    } else if (arg === '--strategy=max') {
      config.strategy = 'max';
    } else if (arg.startsWith('--ext=')) {
      config.fileExtension = arg.split('=')[1];
    } else if (!arg.startsWith('-')) {
      if (!config.folderPath) {
        config.folderPath = arg;
      }
    }
  }
  
  return config;
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(chalk.cyan('文件编号缺失检测脚本'));
  console.log(chalk.cyan('=================='));
  console.log(chalk.blue('\n用法:'));
  console.log(chalk.white('  node check-missing-numbers.js <文件夹路径> [选项]'));
  
  console.log(chalk.blue('\n选项:'));
  console.log(chalk.white('  --ext=<扩展名>     只检查指定扩展名的文件 (如: --ext=.md)'));
  console.log(chalk.white('  --recursive, -r    递归搜索子目录'));
  console.log(chalk.white('  --details, -d      显示详细信息'));
  console.log(chalk.white('  --strategy=first   使用文件名中第一个数字'));
  console.log(chalk.white('  --strategy=max     使用文件名中最大的数字 (默认)'));
  console.log(chalk.white('  --help, -h         显示帮助信息'));
  
  console.log(chalk.blue('\n示例:'));
  console.log(chalk.white('  node check-missing-numbers.js ./docs'));
  console.log(chalk.white('  node check-missing-numbers.js ./pages --ext=.md'));
  console.log(chalk.white('  node check-missing-numbers.js ./files -r -d'));
  console.log(chalk.white('  node check-missing-numbers.js ./chapters --strategy=first'));
  
  console.log(chalk.blue('\n说明:'));
  console.log(chalk.white('  - 脚本会从文件名中提取数字并检测缺失的编号'));
  console.log(chalk.white('  - 默认使用文件名中最大的数字作为文件编号'));
  console.log(chalk.white('  - 支持连续范围显示 (如: 5-8, 12, 15-17)'));
  console.log(chalk.white('  - 可以检测重复编号和无编号文件'));
}

/**
 * 主函数
 */
async function main() {
  const config = parseArguments();
  
  if (config.help) {
    showHelp();
    return;
  }
  
  if (!config.folderPath) {
    console.error(chalk.red('❌ 请提供文件夹路径'));
    showHelp();
    process.exit(1);
  }
  
  try {
    console.log(chalk.cyan('🔍 开始检测文件编号...'));
    
    const result = await checkMissingNumbers(config.folderPath, {
      fileExtension: config.fileExtension,
      recursive: config.recursive,
      strategy: config.strategy
    });
    
    generateReport(result, {
      folderPath: config.folderPath,
      showDetails: config.showDetails
    });
    
    // 根据结果设置退出码
    const hasIssues = result.missingNumbers.length > 0 || result.duplicates.length > 0;
    process.exit(hasIssues ? 1 : 0);
    
  } catch (error) {
    console.error(chalk.red('❌ 检测失败:'), error.message);
    process.exit(1);
  }
}

// 运行主函数
main().catch(error => {
  console.error(chalk.red('❌ 未捕获的错误:'), error);
  process.exit(1);
});
