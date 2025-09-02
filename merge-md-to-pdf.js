#!/usr/bin/env node

/**
 * 合并文件夹中的Markdown文件并转换为PDF
 * 用法: node merge-md-to-pdf.js <文件夹路径> [输出文件名]
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { MarkdownToPdfConverter } from './src/converter.js';
import chalk from 'chalk';

/**
 * 自然排序比较函数，正确处理数字顺序
 * @param {string} a - 第一个文件名
 * @param {string} b - 第二个文件名
 * @returns {number} 排序结果
 */
function naturalSort(a, b) {
  // 将文件名分解为数字和非数字部分
  const regex = /(\d+|\D+)/g;
  const aParts = a.match(regex) || [];
  const bParts = b.match(regex) || [];
  
  const maxLength = Math.max(aParts.length, bParts.length);
  
  for (let i = 0; i < maxLength; i++) {
    const aPart = aParts[i] || '';
    const bPart = bParts[i] || '';
    
    // 如果两个部分都是数字，按数字比较
    if (/^\d+$/.test(aPart) && /^\d+$/.test(bPart)) {
      const numA = parseInt(aPart, 10);
      const numB = parseInt(bPart, 10);
      if (numA !== numB) {
        return numA - numB;
      }
    } else {
      // 按字符串比较
      if (aPart !== bPart) {
        return aPart.localeCompare(bPart);
      }
    }
  }
  
  return 0;
}

/**
 * 获取文件夹中的所有Markdown文件并按自然顺序排序
 * @param {string} folderPath - 文件夹路径
 * @returns {Promise<string[]>} 排序后的Markdown文件路径数组
 */
async function getMarkdownFiles(folderPath) {
  try {
    const files = await fs.readdir(folderPath);
    const markdownFiles = files
      .filter(file => /\.md$/i.test(file))
      .sort(naturalSort) // 使用自然排序，正确处理数字顺序
      .map(file => path.join(folderPath, file));
    
    return markdownFiles;
  } catch (error) {
    throw new Error(`无法读取文件夹: ${error.message}`);
  }
}

/**
 * 读取并合并多个Markdown文件
 * @param {string[]} filePaths - Markdown文件路径数组
 * @returns {Promise<string>} 合并后的Markdown内容
 */
async function mergeMarkdownFiles(filePaths) {
  const contents = [];
  
  for (const filePath of filePaths) {
    try {
      console.log(chalk.blue(`📖 读取文件: ${path.basename(filePath)}`));
      const content = await fs.readFile(filePath, 'utf-8');
      
      // 直接添加内容，不添加任何分隔符或文件名标识
      contents.push(content.trim()); // 去除首尾空白，保持内容整洁
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  无法读取文件 ${filePath}: ${error.message}`));
    }
  }
  
  // 用双换行符连接内容，确保段落间有适当间距，但不添加分页符
  return contents.join('\n\n');
}

/**
 * 将合并的内容写入临时文件
 * @param {string} content - 合并后的Markdown内容
 * @param {string} tempPath - 临时文件路径
 */
async function writeTempFile(content, tempPath) {
  await fs.writeFile(tempPath, content, 'utf-8');
  console.log(chalk.green(`📝 临时文件已创建: ${tempPath}`));
}

/**
 * 清理临时文件
 * @param {string} tempPath - 临时文件路径
 */
async function cleanupTempFile(tempPath) {
  try {
    await fs.unlink(tempPath);
    console.log(chalk.gray(`🗑️  临时文件已删除: ${tempPath}`));
  } catch (error) {
    console.warn(chalk.yellow(`⚠️  无法删除临时文件: ${error.message}`));
  }
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(chalk.cyan.bold(`
┌──────────────────────────────────────────┐
│  📄 Markdown 文件合并转换工具            │
│  🔗 合并文件夹中的所有Markdown文件       │
│  📄 转换为单一PDF文档                    │
└──────────────────────────────────────────┘
`));
  
  console.log(chalk.blue('用法:'));
  console.log(chalk.white('  node merge-md-to-pdf.js <文件夹路径> [输出文件名]'));
  
  console.log(chalk.blue('\n参数:'));
  console.log(chalk.white('  <文件夹路径>     包含Markdown文件的文件夹路径 (必需)'));
  console.log(chalk.white('  [输出文件名]     输出PDF文件名 (可选, 默认: merged-document.pdf)'));
  
  console.log(chalk.blue('\n选项:'));
  console.log(chalk.white('  --help, -h       显示帮助信息'));
  
  console.log(chalk.blue('\n示例:'));
  console.log(chalk.white('  node merge-md-to-pdf.js ./docs'));
  console.log(chalk.white('  node merge-md-to-pdf.js ./docs combined.pdf'));
  console.log(chalk.white('  node merge-md-to-pdf.js "C:\\Documents\\MyProject" output.pdf'));
  
  console.log(chalk.blue('\n默认样式:'));
  console.log(chalk.white('  📏 页边距: 0mm (无边距)'));
  console.log(chalk.white('  🔤 字体大小: large'));
  console.log(chalk.white('  🇨🇳 中文字体: auto'));
  console.log(chalk.white('  💪 文字厚度: medium'));
  console.log(chalk.white('  📐 行间距: normal'));
  console.log(chalk.white('  📄 段落间距: normal'));
  console.log(chalk.white('  🧮 数学间距: tight'));
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  // 检查帮助参数
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    if (args.length === 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
  
  const folderPath = path.resolve(args[0]);
  const outputName = args[1] || 'merged-document.pdf';
  const outputPath = path.resolve(outputName);
  
  // 生成临时Markdown文件路径
  const tempMarkdownPath = path.join(path.dirname(outputPath), 'temp-merged.md');
  
  try {
    console.log(chalk.cyan('🚀 开始合并Markdown文件并转换为PDF...'));
    console.log(chalk.blue(`📁 源文件夹: ${folderPath}`));
    console.log(chalk.blue(`📄 输出文件: ${outputPath}`));
    
    // 检查文件夹是否存在
    try {
      const stats = await fs.stat(folderPath);
      if (!stats.isDirectory()) {
        throw new Error('指定的路径不是文件夹');
      }
    } catch (error) {
      throw new Error(`文件夹不存在或无法访问: ${error.message}`);
    }
    
    // 1. 获取所有Markdown文件
    console.log(chalk.cyan('📋 扫描Markdown文件...'));
    const markdownFiles = await getMarkdownFiles(folderPath);
    
    if (markdownFiles.length === 0) {
      throw new Error('文件夹中没有找到Markdown文件 (.md)');
    }
    
    console.log(chalk.green(`✅ 找到 ${markdownFiles.length} 个Markdown文件:`));
    markdownFiles.forEach((file, index) => {
      console.log(chalk.gray(`   ${index + 1}. ${path.basename(file)}`));
    });
    
    // 2. 合并Markdown文件
    console.log(chalk.cyan('🔗 合并Markdown文件...'));
    const mergedContent = await mergeMarkdownFiles(markdownFiles);
    
    // 3. 写入临时文件
    await writeTempFile(mergedContent, tempMarkdownPath);
    
    // 4. 转换为PDF（使用CLI中的默认样式选项）
    console.log(chalk.cyan('📄 转换为PDF...'));
    const converter = new MarkdownToPdfConverter({
      reuseInstance: true,  // 启用实例复用以提高性能
      maxPages: 20          // 增加页面限制以处理大文档
    });
    
    await converter.convert({
      input: tempMarkdownPath,
      output: outputPath,
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
        // 使用CLI默认的样式选项
        fontSize: 'large',           // 对应CLI默认的 --font-size large
        chineseFont: 'auto',         // 对应CLI默认的 --chinese-font auto
        fontWeight: 'medium',        // 对应CLI默认的 --font-weight medium
        lineSpacing: 'normal',       // 对应CLI默认的 --line-spacing normal
        paragraphSpacing: 'normal',  // 对应CLI默认的 --paragraph-spacing normal
        mathSpacing: 'tight',        // 对应CLI默认的 --math-spacing tight
        mathEngine: 'auto'           // 对应CLI默认的 --math-engine auto
      }
    });
    
    // 显式关闭转换器以释放资源
    await converter.close();
    
    // 5. 清理临时文件
    await cleanupTempFile(tempMarkdownPath);
    
    console.log(chalk.green('✅ PDF转换完成!'));
    console.log(chalk.blue(`📄 输出文件: ${outputPath}`));
    
  } catch (error) {
    console.error(chalk.red('❌ 转换失败:'), error.message);
    
    // 清理临时文件（如果存在）
    try {
      await fs.access(tempMarkdownPath);
      await cleanupTempFile(tempMarkdownPath);
    } catch {
      // 临时文件不存在，忽略
    }
    
    process.exit(1);
  }
}

// 运行主函数
main().catch(error => {
  console.error(chalk.red('❌ 未捕获的错误:'), error);
  process.exit(1);
});
