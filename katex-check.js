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
  return markdownFiles;
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
 */
function generateQuickReport(results) {
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
    
    errorFiles.forEach((result, index) => {
      console.log(chalk.red(`\n${index + 1}. ${path.basename(result.file)}`));
      
      result.errors.forEach((error, errorIndex) => {
        if (error.formula === 'FILE_ERROR') {
          console.log(chalk.yellow(`   文件错误: ${error.error}`));
        } else {
          console.log(chalk.yellow(`   公式 ${errorIndex + 1}: ${error.formula}`));
          console.log(chalk.red(`   错误: ${error.error}`));
        }
      });
    });
    
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
function generateDetailedReport(results) {
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
    
    results.filter(r => !r.success).forEach((result, index) => {
      console.log(chalk.red(`\n${index + 1}. ${path.basename(result.file)}`));
      console.log(chalk.gray(`   路径: ${result.file}`));
      
      result.errors.forEach((error, errorIndex) => {
        const expr = error.expression;
        console.log(chalk.yellow(`   错误 ${errorIndex + 1}:`));
        console.log(chalk.yellow(`   类型: ${expr.type || 'unknown'}`));
        console.log(chalk.yellow(`   公式: ${expr.raw || expr.content || 'N/A'}`));
        console.log(chalk.red(`   错误: ${error.error.message}`));
      });
    });
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
    quick: false,
    detailed: false,
    recursive: true,
    concurrency: cpus().length,
    help: false
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
    } else if (arg.startsWith('--concurrency=')) {
      config.concurrency = parseInt(arg.split('=')[1]) || cpus().length;
    } else if (!config.folderPath) {
      config.folderPath = arg;
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
  console.log(chalk.white('  node katex-unified-check.js <文件夹路径> [选项]'));
  
  console.log(chalk.blue('\n模式选项:'));
  console.log(chalk.white('  --quick, -q        快速模式 (默认)'));
  console.log(chalk.white('  --detailed, -d     详细模式'));
  
  console.log(chalk.blue('\n其他选项:'));
  console.log(chalk.white('  --no-recursive     不递归搜索子目录'));
  console.log(chalk.white('  --concurrency=N    设置并发数 (默认: CPU核心数)'));
  console.log(chalk.white('  --help, -h         显示帮助信息'));
  
  console.log(chalk.blue('\n示例:'));
  console.log(chalk.white('  node katex-unified-check.js ./docs                    # 快速模式'));
  console.log(chalk.white('  node katex-unified-check.js ./docs --detailed         # 详细模式'));
  console.log(chalk.white('  node katex-unified-check.js ./docs -d --concurrency=8 # 详细模式，8个并发'));
  console.log(chalk.white('  node katex-unified-check.js ./docs -q --no-recursive  # 快速模式，不递归'));
  
  console.log(chalk.blue('\n模式说明:'));
  console.log(chalk.white('  快速模式: 速度极快，简洁报告，适合日常使用'));
  console.log(chalk.white('  详细模式: 完整分析，详细报告，适合深度调试'));
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
  
  const folderPath = path.resolve(config.folderPath);
  
  try {
    // 检查目录是否存在
    try {
      const stats = await fs.stat(folderPath);
      if (!stats.isDirectory()) {
        throw new Error('指定的路径不是文件夹');
      }
    } catch (error) {
      throw new Error(`文件夹不存在或无法访问: ${error.message}`);
    }
    
    const mode = config.quick ? '快速' : '详细';
    console.log(chalk.cyan(`🚀 开始KaTeX渲染检测 (${mode}模式)...`));
    console.log(chalk.blue(`📁 扫描目录: ${folderPath}`));
    console.log(chalk.blue(`🔄 递归搜索: ${config.recursive ? '是' : '否'}`));
    if (config.detailed) {
      console.log(chalk.blue(`⚡ 并发数: ${config.concurrency}`));
    }
    
    // 获取所有Markdown文件
    console.log(chalk.cyan('\n📋 扫描Markdown文件...'));
    const markdownFiles = await getMarkdownFiles(folderPath, config.recursive);
    
    if (markdownFiles.length === 0) {
      console.log(chalk.yellow('⚠️ 未找到Markdown文件'));
      return;
    }
    
    console.log(chalk.green(`✅ 找到 ${markdownFiles.length} 个Markdown文件`));
    
    // 开始检测
    console.log(chalk.cyan(`\n🔍 开始检测KaTeX渲染 (${mode}模式)...`));
    const startTime = Date.now();
    
    let results;
    let hasNoErrors;
    
    if (config.quick) {
      // 快速模式
      results = await Promise.all(markdownFiles.map(quickCheckFile));
      hasNoErrors = generateQuickReport(results);
    } else {
      // 详细模式
      results = await processFilesInBatches(markdownFiles, config.concurrency, detailedCheckFile);
      hasNoErrors = generateDetailedReport(results);
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
