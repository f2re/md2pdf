#!/usr/bin/env node

/**
 * 统一KaTeX渲染错误检测脚本
 * 支持快速模式和详细模式
 * 用法: node katex-unified-check.js <文件夹路径> [选项]
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import katex from 'katex';
import chalk from 'chalk';
import { cpus } from 'os';
import { 
  fixSingleFormulaError, 
  fixSingleDetailedFormulaError 
} from './llm-fixer.js';

/**
 * 数学公式分隔符配置
 */
const MATH_DELIMITERS = {
  inline: [
    ['$', '$'],
    ['\\(', '\\)']
  ],
  block: [
    ['$$', '$$'],
    ['\\[', '\\]']
  ]
};

/**
 * KaTeX配置
 */
const KATEX_CONFIG = {
  throwOnError: true,
  output: 'html',
  trust: false,
  strict: false
};

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 自然排序函数 - 正确处理数字顺序
 * @param {string} a - 第一个文件路径
 * @param {string} b - 第二个文件路径
 * @returns {number} 排序结果
 */
function naturalSort(a, b) {
  // 提取文件名进行比较
  const aName = path.basename(a);
  const bName = path.basename(b);
  
  // 分割字符串和数字部分
  const aParts = aName.split(/(\d+)/);
  const bParts = bName.split(/(\d+)/);
  
  const maxLength = Math.max(aParts.length, bParts.length);
  
  for (let i = 0; i < maxLength; i++) {
    const aPart = aParts[i] || '';
    const bPart = bParts[i] || '';
    
    // 如果两个部分都是数字，按数值比较
    if (/^\d+$/.test(aPart) && /^\d+$/.test(bPart)) {
      const aNum = parseInt(aPart, 10);
      const bNum = parseInt(bPart, 10);
      if (aNum !== bNum) {
        return aNum - bNum;
      }
    } else {
      // 否则按字符串比较
      if (aPart !== bPart) {
        return aPart.localeCompare(bPart);
      }
    }
  }
  
  return 0;
}

/**
 * 快速提取并检测数学公式（快速模式）
 * @param {string} content - Markdown内容
 * @returns {Array} 错误数组
 */
function quickCheckMath(content) {
  const errors = [];
  
  // 匹配所有可能的数学公式
  const patterns = [
    /\$\$([^$]+?)\$\$/g,           // 块级公式 $$...$$
    /\\\[([^\]]+?)\\\]/g,          // 块级公式 \[...\]
    /\$([^$\n]+?)\$/g,             // 行内公式 $...$
    /\\\(([^)]+?)\\\)/g            // 行内公式 \(...\)
  ];
  
  patterns.forEach((pattern, patternIndex) => {
    let match;
    const isBlock = patternIndex < 2;
    
    while ((match = pattern.exec(content)) !== null) {
      const mathContent = match[1].trim();
      if (!mathContent) continue;
      
      try {
        katex.renderToString(mathContent, {
          throwOnError: true,
          displayMode: isBlock,
          output: 'html',
          strict: false
        });
      } catch (error) {
        errors.push({
          formula: match[0],
          content: mathContent,
          error: error.message,
          position: match.index,
          type: isBlock ? 'block' : 'inline'
        });
      }
    }
  });
  
  return errors;
}

/**
 * 详细提取数学公式（详细模式）
 * @param {string} content - Markdown内容
 * @returns {Array} 数学公式数组
 */
function extractMathExpressions(content) {
  const mathExpressions = [];
  let processedContent = content;

  // 处理块级数学表达式
  for (const [startDelim, endDelim] of MATH_DELIMITERS.block) {
    const regex = new RegExp(
      escapeRegExp(startDelim) + '([\\s\\S]*?)' + escapeRegExp(endDelim),
      'g'
    );

    let match;
    while ((match = regex.exec(processedContent)) !== null) {
      mathExpressions.push({
        type: 'block',
        content: match[1].trim(),
        raw: match[0],
        start: match.index,
        end: match.index + match[0].length
      });
    }
  }

  // 处理行内数学表达式
  for (const [startDelim, endDelim] of MATH_DELIMITERS.inline) {
    const regex = new RegExp(
      escapeRegExp(startDelim) + '([^\\n]*?)' + escapeRegExp(endDelim),
      'g'
    );

    let match;
    while ((match = regex.exec(processedContent)) !== null) {
      // 避免与块级公式重复
      const isInsideBlock = mathExpressions.some(expr => 
        match.index >= expr.start && match.index < expr.end
      );
      
      if (!isInsideBlock && match[1].trim()) {
        mathExpressions.push({
          type: 'inline',
          content: match[1].trim(),
          raw: match[0],
          start: match.index,
          end: match.index + match[0].length
        });
      }
    }
  }

  return mathExpressions;
}

/**
 * 检测单个数学公式的KaTeX渲染（详细模式）
 * @param {Object} mathExpr - 数学公式对象
 * @returns {Object} 检测结果
 */
function checkMathExpression(mathExpr) {
  try {
    katex.renderToString(mathExpr.content, {
      ...KATEX_CONFIG,
      displayMode: mathExpr.type === 'block'
    });
    
    return {
      success: true,
      expression: mathExpr,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      expression: mathExpr,
      error: {
        message: error.message,
        name: error.name
      }
    };
  }
}

/**
 * 检测单个Markdown文件（快速模式）
 * @param {string} filePath - 文件路径
 * @returns {Object} 检测结果
 */
async function quickCheckFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const errors = quickCheckMath(content);
    
    return {
      file: filePath,
      success: errors.length === 0,
      errors: errors,
      mathCount: errors.length
    };
  } catch (error) {
    return {
      file: filePath,
      success: false,
      errors: [{ formula: 'FILE_ERROR', error: error.message }],
      mathCount: 0
    };
  }
}

/**
 * 检测单个Markdown文件（详细模式）
 * @param {string} filePath - 文件路径
 * @returns {Object} 检测结果
 */
async function detailedCheckFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const mathExpressions = extractMathExpressions(content);
    
    if (mathExpressions.length === 0) {
      return {
        file: filePath,
        mathCount: 0,
        errors: [],
        success: true
      };
    }

    const results = mathExpressions.map(checkMathExpression);
    const errors = results.filter(result => !result.success);
    
    return {
      file: filePath,
      mathCount: mathExpressions.length,
      errors: errors,
      success: errors.length === 0
    };
  } catch (error) {
    return {
      file: filePath,
      mathCount: 0,
      errors: [{
        success: false,
        expression: { raw: 'FILE_READ_ERROR' },
        error: { message: error.message, name: 'FileReadError' }
      }],
      success: false
    };
  }
}

/**
 * 获取文件夹中的所有Markdown文件
 * @param {string} folderPath - 文件夹路径
 * @param {boolean} recursive - 是否递归搜索
 * @returns {Array} Markdown文件路径数组
 */
async function getMarkdownFiles(folderPath, recursive = true) {
  const markdownFiles = [];
  
  async function scanDirectory(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory() && recursive) {
          await scanDirectory(fullPath);
        } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
          markdownFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ 无法读取目录 ${dirPath}: ${error.message}`));
    }
  }
  
  await scanDirectory(folderPath);
  
  // 使用自然排序确保数字正确排序 (1, 2, 3, ..., 10, 11 而不是 1, 10, 11, 2, 3)
  return markdownFiles.sort(naturalSort);
}

/**
 * 解析输入路径，支持文件夹、单个文件或多个文件
 * @param {string} primaryPath - 主要路径（第一个参数）
 * @param {Array} additionalPaths - 额外的路径数组
 * @param {boolean} recursive - 是否递归搜索（仅对文件夹有效）
 * @returns {Array} Markdown文件路径数组
 */
async function resolveInputPaths(primaryPath, additionalPaths = [], recursive = true) {
  const allPaths = [primaryPath, ...additionalPaths];
  const markdownFiles = [];
  
  for (const inputPath of allPaths) {
    const resolvedPath = path.resolve(inputPath);
    
    try {
      const stats = await fs.stat(resolvedPath);
      
      if (stats.isDirectory()) {
        // 如果是目录，扫描其中的 Markdown 文件
        const dirFiles = await getMarkdownFiles(resolvedPath, recursive);
        markdownFiles.push(...dirFiles);
        console.log(chalk.blue(`📁 扫描目录: ${resolvedPath} (找到 ${dirFiles.length} 个文件)`));
      } else if (stats.isFile()) {
        // 如果是文件，检查是否为 Markdown 文件
        if (/\.md$/i.test(path.basename(resolvedPath))) {
          markdownFiles.push(resolvedPath);
          console.log(chalk.blue(`📄 添加文件: ${resolvedPath}`));
        } else {
          console.warn(chalk.yellow(`⚠️ 跳过非Markdown文件: ${resolvedPath}`));
        }
      } else {
        console.warn(chalk.yellow(`⚠️ 跳过未知类型: ${resolvedPath}`));
      }
    } catch (error) {
      console.error(chalk.red(`❌ 无法访问路径 ${resolvedPath}: ${error.message}`));
    }
  }
  
  // 去重并排序
  const uniqueFiles = [...new Set(markdownFiles)];
  return uniqueFiles.sort(naturalSort);
}

/**
 * 批量处理文件（详细模式使用）
 * @param {Array} files - 文件路径数组
 * @param {number} concurrency - 并发数
 * @param {Function} checkFunction - 检测函数
 * @returns {Array} 检测结果数组
 */
async function processFilesInBatches(files, concurrency, checkFunction) {
  const results = [];
  const batches = [];
  
  // 将文件分批
  for (let i = 0; i < files.length; i += concurrency) {
    batches.push(files.slice(i, i + concurrency));
  }
  
  console.log(chalk.blue(`📊 使用 ${concurrency} 个并发处理 ${files.length} 个文件`));
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(chalk.gray(`处理批次 ${i + 1}/${batches.length} (${batch.length} 个文件)`));
    
    // 并行处理当前批次
    const batchPromises = batch.map(file => checkFunction(file));
    const batchResults = await Promise.all(batchPromises);
    
    results.push(...batchResults);
    
    // 显示进度
    const processed = results.length;
    const percentage = Math.round((processed / files.length) * 100);
    console.log(chalk.green(`✅ 已处理: ${processed}/${files.length} (${percentage}%)`));
  }
  
  return results;
}

/**
 * 生成快速报告
 * @param {Array} results - 检测结果数组
 * @param {Object} config - 配置对象
 */
async function generateQuickReport(results, config = {}) {
  const errorFiles = results.filter(r => !r.success);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  
  console.log(chalk.cyan('\n📋 检测结果'));
  console.log(chalk.cyan('============'));
  console.log(chalk.blue(`📁 总文件数: ${results.length}`));
  console.log(chalk.green(`✅ 正常文件: ${results.length - errorFiles.length}`));
  console.log(chalk.red(`❌ 错误文件: ${errorFiles.length}`));
  console.log(chalk.red(`💥 错误总数: ${totalErrors}`));
  
  // 显示错误详情
  if (errorFiles.length > 0) {
    console.log(chalk.red('\n💥 错误详情:'));
    console.log(chalk.red('============'));
    
    // 对错误文件按自然排序
    const sortedErrorFiles = errorFiles.sort((a, b) => naturalSort(a.file, b.file));
    
    let fixedCount = 0;
    
    for (let fileIndex = 0; fileIndex < sortedErrorFiles.length; fileIndex++) {
      const result = sortedErrorFiles[fileIndex];
      console.log(chalk.red(`\n${fileIndex + 1}. ${path.basename(result.file)}`));
      
      for (let errorIndex = 0; errorIndex < result.errors.length; errorIndex++) {
        const error = result.errors[errorIndex];
        
        if (error.formula === 'FILE_ERROR') {
          console.log(chalk.yellow(`   文件错误: ${error.error}`));
          continue;
        }
        
        console.log(chalk.yellow(`   公式 ${errorIndex + 1}: ${error.formula}`));
        console.log(chalk.red(`   错误: ${error.error}`));
        
        // 如果启用了自动纠错
        if (config.autoFix) {
          const fixed = await fixSingleFormulaError(error, result.file, {
            autoConfirm: config.autoConfirm
          });
          if (fixed) {
            fixedCount++;
          }
        }
      }
    }
    
    if (config.autoFix && fixedCount > 0) {
      console.log(chalk.green(`\n🎉 成功修正了 ${fixedCount} 个公式错误！`));
      console.log(chalk.yellow('💡 建议重新运行检测以确认修正结果'));
    }
    
    return false; // 有错误
  } else {
    console.log(chalk.green('\n🎉 所有文件的KaTeX公式都正常！'));
    return true; // 无错误
  }
}

/**
 * 生成详细报告
 * @param {Array} results - 检测结果数组
 */
/**
 * 生成详细报告
 * @param {Array} results - 检测结果数组
 * @param {Object} config - 配置对象
 */
async function generateDetailedReport(results, config = {}) {
  const totalFiles = results.length;
  const successFiles = results.filter(r => r.success).length;
  const errorFiles = results.filter(r => !r.success).length;
  const totalMathExpressions = results.reduce((sum, r) => sum + r.mathCount, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  
  console.log(chalk.cyan('\n📋 KaTeX渲染检测报告'));
  console.log(chalk.cyan('========================'));
  
  // 总体统计
  console.log(chalk.blue(`📁 扫描文件数: ${totalFiles}`));
  console.log(chalk.green(`✅ 成功文件数: ${successFiles}`));
  console.log(chalk.red(`❌ 错误文件数: ${errorFiles}`));
  console.log(chalk.blue(`🧮 数学公式总数: ${totalMathExpressions}`));
  console.log(chalk.red(`💥 渲染错误总数: ${totalErrors}`));
  
  if (errorFiles > 0) {
    console.log(chalk.red('\n💥 详细错误信息:'));
    console.log(chalk.red('=================='));
    
    // 对错误文件按自然排序
    const sortedErrorFiles = results.filter(r => !r.success).sort((a, b) => naturalSort(a.file, b.file));
    
    let fixedCount = 0;
    
    for (let fileIndex = 0; fileIndex < sortedErrorFiles.length; fileIndex++) {
      const result = sortedErrorFiles[fileIndex];
      console.log(chalk.red(`\n${fileIndex + 1}. ${path.basename(result.file)}`));
      console.log(chalk.gray(`   路径: ${result.file}`));
      
      for (let errorIndex = 0; errorIndex < result.errors.length; errorIndex++) {
        const error = result.errors[errorIndex];
        const expr = error.expression;
        
        console.log(chalk.yellow(`   错误 ${errorIndex + 1}:`));
        console.log(chalk.yellow(`   类型: ${expr.type || 'unknown'}`));
        console.log(chalk.yellow(`   公式: ${expr.raw || expr.content || 'N/A'}`));
        console.log(chalk.red(`   错误: ${error.error.message}`));
        
        // 如果启用了自动纠错
        if (config.autoFix && expr.raw && expr.raw !== 'FILE_READ_ERROR') {
          const fixed = await fixSingleDetailedFormulaError(error, result.file, {
            autoConfirm: config.autoConfirm
          });
          if (fixed) {
            fixedCount++;
          }
        }
      }
    }
    
    if (config.autoFix && fixedCount > 0) {
      console.log(chalk.green(`\n🎉 成功修正了 ${fixedCount} 个公式错误！`));
      console.log(chalk.yellow('💡 建议重新运行检测以确认修正结果'));
    }
  }
  
  // 成功率统计
  const successRate = totalFiles > 0 ? Math.round((successFiles / totalFiles) * 100) : 100;
  console.log(chalk.cyan(`\n📊 成功率: ${successRate}%`));
  
  if (successRate === 100) {
    console.log(chalk.green('🎉 所有文件的KaTeX公式都能正确渲染！'));
    return true;
  } else {
    console.log(chalk.yellow('⚠️ 发现渲染错误，请检查上述详细信息'));
    return false;
  }
}

/**
 * 解析命令行参数
 */
function parseArguments() {
  const args = process.argv.slice(2);
  
  const config = {
    folderPath: null,
    filePaths: [],
    quick: false,
    detailed: false,
    recursive: true,
    concurrency: cpus().length,
    help: false,
    autoFix: false,
    autoConfirm: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      config.help = true;
    } else if (arg === '--quick' || arg === '-q') {
      config.quick = true;
    } else if (arg === '--detailed' || arg === '-d') {
      config.detailed = true;
    } else if (arg === '--no-recursive') {
      config.recursive = false;
    } else if (arg === '--auto-fix' || arg === '-f') {
      config.autoFix = true;
    } else if (arg === '--auto-confirm' || arg === '-y') {
      config.autoConfirm = true;
    } else if (arg.startsWith('--concurrency=')) {
      config.concurrency = parseInt(arg.split('=')[1]) || cpus().length;
    } else if (!arg.startsWith('-')) {
      // 如果不是选项，则是文件/目录路径
      if (!config.folderPath) {
        config.folderPath = arg;
      } else {
        config.filePaths.push(arg);
      }
    }
  }
  
  // 默认使用快速模式
  if (!config.quick && !config.detailed) {
    config.quick = true;
  }
  
  return config;
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(chalk.cyan('KaTeX渲染错误检测脚本 - 统一版'));
  console.log(chalk.cyan('================================'));
  console.log(chalk.blue('\n用法:'));
  console.log(chalk.white('  node katex-check.js <路径> [更多路径...] [选项]'));
  console.log(chalk.white(''));
  console.log(chalk.white('  <路径> 可以是:'));
  console.log(chalk.white('    • 文件夹路径 (扫描其中的 .md 文件)'));
  console.log(chalk.white('    • 单个 .md 文件'));
  console.log(chalk.white('    • 多个 .md 文件 (空格分隔)'));
  
  console.log(chalk.blue('\n模式选项:'));
  console.log(chalk.white('  --quick, -q        快速模式 (默认)'));
  console.log(chalk.white('  --detailed, -d     详细模式'));
  
  console.log(chalk.blue('\n纠错选项:'));
  console.log(chalk.white('  --auto-fix, -f     启用自动纠错功能'));
  console.log(chalk.white('  --auto-confirm, -y 自动确认所有修正 (与 --auto-fix 配合使用)'));
  
  console.log(chalk.blue('\n其他选项:'));
  console.log(chalk.white('  --no-recursive     不递归搜索子目录 (仅对文件夹有效)'));
  console.log(chalk.white('  --concurrency=N    设置并发数 (默认: CPU核心数)'));
  console.log(chalk.white('  --help, -h         显示帮助信息'));
  
  console.log(chalk.blue('\n示例:'));
  console.log(chalk.white('  node katex-check.js ./docs                            # 扫描文件夹'));
  console.log(chalk.white('  node katex-check.js README.md                         # 检查单个文件'));
  console.log(chalk.white('  node katex-check.js file1.md file2.md file3.md        # 检查多个文件'));
  console.log(chalk.white('  node katex-check.js ./docs README.md                  # 混合：文件夹+文件'));
  console.log(chalk.white('  node katex-check.js ./docs --detailed                 # 详细模式'));
  console.log(chalk.white('  node katex-check.js ./docs -f                         # 快速模式 + 纠错'));
  console.log(chalk.white('  node katex-check.js file.md -f -y                     # 文件 + 自动纠错'));
  console.log(chalk.white('  node katex-check.js ./docs -d -f --concurrency=8      # 详细模式 + 纠错'));
  
  console.log(chalk.blue('\n模式说明:'));
  console.log(chalk.white('  快速模式: 速度极快，简洁报告，适合日常使用'));
  console.log(chalk.white('  详细模式: 完整分析，详细报告，适合深度调试'));
  console.log(chalk.white('  纠错功能: 使用 LMStudio API 自动修正错误的 LaTeX 公式'));
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
    console.error(chalk.red('❌ 请提供至少一个文件或文件夹路径'));
    showHelp();
    process.exit(1);
  }
  
  try {
    const mode = config.quick ? '快速' : '详细';
    console.log(chalk.cyan(`🚀 开始KaTeX渲染检测 (${mode}模式)...`));
    if (config.autoFix) {
      console.log(chalk.magenta(`🔧 纠错功能: 已启用 ${config.autoConfirm ? '(自动确认)' : '(手动确认)'}`));
    }
    
    // 解析输入路径
    console.log(chalk.cyan('\n📋 解析输入路径...'));
    const markdownFiles = await resolveInputPaths(config.folderPath, config.filePaths, config.recursive);
    
    if (markdownFiles.length === 0) {
      console.log(chalk.yellow('⚠️ 未找到Markdown文件'));
      return;
    }
    
    console.log(chalk.green(`\n✅ 总共找到 ${markdownFiles.length} 个Markdown文件`));
    
    if (config.detailed) {
      console.log(chalk.blue(`⚡ 并发数: ${config.concurrency}`));
    }
    
    // 开始检测
    console.log(chalk.cyan(`\n🔍 开始检测KaTeX渲染 (${mode}模式)...`));
    const startTime = Date.now();
    
    let results;
    let hasNoErrors;
    
    if (config.quick) {
      // 快速模式
      results = await Promise.all(markdownFiles.map(quickCheckFile));
      hasNoErrors = await generateQuickReport(results, config);
    } else {
      // 详细模式
      results = await processFilesInBatches(markdownFiles, config.concurrency, detailedCheckFile);
      hasNoErrors = await generateDetailedReport(results, config);
    }
    
    const endTime = Date.now();
    console.log(chalk.cyan(`\n⏱️ 总耗时: ${((endTime - startTime) / 1000).toFixed(2)}秒`));
    
    // 根据结果设置退出码
    process.exit(hasNoErrors ? 0 : 1);
    
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
