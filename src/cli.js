/**
 * CLI界面模块
 */

import { program } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import { fileExists } from './utils.js';
import { convertMarkdownToPdf } from './converter.js';

/**
 * 显示工具标题
 */
export function showTitle() {
  console.log(chalk.cyan.bold(`
┌──────────────────────────────────┐
│  📄 Markdown LaTeX → PDF 转换器  │
│  🧮 支持数学公式 | 🎨 美观排版   │
└──────────────────────────────────┘
`));
}

/**
 * 创建CLI程序
 * @returns {Command} Commander程序实例
 */
export function createCLI() {
  return program
    .name('md2pdf')
    .description('将Markdown文件(含LaTeX公式)转换为PDF')
    .version('1.0.0')
    .argument('<input>', 'Markdown输入文件路径')
    .argument('[output]', 'PDF输出文件路径(可选)')
    .option('-v, --verbose', '显示详细信息')
    .option('-f, --format <format>', '输出格式 (pdf|html)', 'pdf')
    .option('--margin <margin>', 'PDF页边距 (例如: 20mm)', '20mm')
    .option('--landscape', '横向页面')
    .option('--font-size <size>', '字体大小 (small|medium|large|xlarge 或具体数值如 14px)', 'medium')
    .option('--chinese-font <font>', '中文字体 (simsun|simhei|simkai|fangsong|yahei|auto)', 'auto')
    .option('--font-weight <weight>', '文字厚度 (light|normal|medium|semibold|bold|black 或数值如 400)', 'normal')
    .action(async (input, output, options) => {
      await handleConvert(input, output, options);
    });
}

/**
 * 处理转换命令
 * @param {string} input - 输入文件路径
 * @param {string} output - 输出文件路径
 * @param {Object} options - 命令选项
 */
async function handleConvert(input, output, options) {
  try {
    // 检查输入文件是否存在
    if (!await fileExists(input)) {
      console.error(chalk.red(`❌ 错误: 文件 '${input}' 不存在`));
      process.exit(1);
    }

    // 自动生成输出文件名
    if (!output) {
      const path = await import('path');
      const parsed = path.parse(input);
      const extension = options.format === 'html' ? 'html' : 'pdf';
      output = path.join(parsed.dir, `${parsed.name}.${extension}`);
    }

    console.log(chalk.blue('🔄 开始转换...'));
    console.log(chalk.gray(`📖 输入: ${input}`));
    console.log(chalk.gray(`📁 输出: ${output}`));
    console.log(chalk.gray(`📝 格式: ${options.format.toUpperCase()}`));
    console.log(chalk.gray(`🎨 字体大小: ${options.fontSize}`));
    console.log(chalk.gray(`📏 页边距: ${options.margin}`));
    console.log(chalk.gray(`🇨🇳 中文字体: ${options.chineseFont}`));
    console.log(chalk.gray(`💪 文字厚度: ${options.fontWeight}`));
    if (options.landscape) {
      console.log(chalk.gray(`📱 页面方向: 横向`));
    }

    // 准备PDF选项
    const pdfOptions = {};
    if (options.margin) {
      pdfOptions.margin = {
        top: options.margin,
        right: options.margin,
        bottom: options.margin,
        left: options.margin
      };
    }
    if (options.landscape) {
      pdfOptions.landscape = true;
    }

    // 准备样式选项
    const styleOptions = {
      fontSize: options.fontSize,
      chineseFont: options.chineseFont,
      fontWeight: options.fontWeight
    };

    // 执行转换
    const startTime = Date.now();
    
    if (options.format === 'pdf') {
      await convertMarkdownToPdf(input, output, { pdfOptions, styleOptions });
    } else if (options.format === 'html') {
      const { convertMarkdownToHtml } = await import('./converter.js');
      await convertMarkdownToHtml(input, output, { styleOptions });
    } else {
      throw new Error(`不支持的格式: ${options.format}`);
    }
    
    const duration = Date.now() - startTime;

    console.log(chalk.green(`✅ 转换完成! (耗时: ${duration}ms)`));
    console.log(chalk.yellow(`🎉 文件已生成: ${output}`));

  } catch (error) {
    console.error(chalk.red(`❌ 转换失败: ${error.message}`));
    if (options.verbose) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

/**
 * 运行CLI程序
 */
export function runCLI() {
  showTitle();
  const cli = createCLI();
  cli.parse();
}
