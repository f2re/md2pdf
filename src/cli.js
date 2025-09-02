/**
 * CLI界面模块
 */

import { program } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import { fileExists } from './utils.js';
import { convertMarkdownToPdf } from './converter.js';
import { MATH_ENGINE, DEFAULT_MATH_ENGINE } from './config.js';

/**
 * 为数值类型选项自动添加单位
 * 支持自动单位添加的选项：
 * - margin: 纯数字自动添加 mm 单位
 * - fontSize: 纯数字自动添加 px 单位  
 * - fontWeight: 数值保持不变（CSS支持纯数字）
 * - lineSpacing: 纯数字保持不变（line-height支持纯数字）
 * - paragraphSpacing: 纯数字自动添加 em 单位
 * - mathSpacing: 纯数字自动添加 px 单位
 * 
 * @param {Object} options - 原始选项对象
 * @returns {Object} 处理后的选项对象
 */
function normalizeNumericOptions(options) {
  const normalized = { ...options };
  
  // 处理margin选项 - 如果是纯数字（整数或小数）则添加mm单位
  if (normalized.margin && /^(\d+|\d*\.\d+)$/.test(normalized.margin)) {
    normalized.margin = normalized.margin + 'mm';
    console.log(chalk.dim(`  🔧 自动添加单位: margin ${options.margin} → ${normalized.margin}`));
  }
  
  // 处理font-size选项 - 如果是纯数字（整数或小数）则添加px单位
  if (normalized.fontSize && /^(\d+|\d*\.\d+)$/.test(normalized.fontSize)) {
    normalized.fontSize = normalized.fontSize + 'px';
    console.log(chalk.dim(`  🔧 自动添加单位: fontSize ${options.fontSize} → ${normalized.fontSize}`));
  }
  
  // 处理paragraph-spacing选项 - 如果是纯数字（整数或小数）则添加em单位
  if (normalized.paragraphSpacing && /^(\d+|\d*\.\d+)$/.test(normalized.paragraphSpacing)) {
    normalized.paragraphSpacing = normalized.paragraphSpacing + 'em';
    console.log(chalk.dim(`  🔧 自动添加单位: paragraphSpacing ${options.paragraphSpacing} → ${normalized.paragraphSpacing}`));
  }
  
  // 处理math-spacing选项 - 如果是纯数字（整数或小数）则添加px单位
  if (normalized.mathSpacing && /^(\d+|\d*\.\d+)$/.test(normalized.mathSpacing)) {
    normalized.mathSpacing = normalized.mathSpacing + 'px';
    console.log(chalk.dim(`  🔧 自动添加单位: mathSpacing ${options.mathSpacing} → ${normalized.mathSpacing}`));
  }
  
  // font-weight和line-spacing选项不需要添加单位，CSS支持纯数字和关键词
  
  return normalized;
}

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
    .option('--margin <margin>', 'PDF页边距 (例如: 20mm)', '0mm')
    .option('--landscape', '横向页面')
    .option('--font-size <size>', '字体大小 (small|medium|large|xlarge 或具体数值如 14px)', 'large')
    .option('--chinese-font <font>', '中文字体 (simsun|simhei|simkai|fangsong|yahei|auto)', 'auto')
    .option('--font-weight <weight>', '文字厚度 (light|normal|medium|semibold|bold|black 或数值如 400)', 'medium')
    .option('--line-spacing <spacing>', '行间距 (tight|normal|loose|relaxed 或数值如 1.6)', 'normal')
    .option('--paragraph-spacing <spacing>', '段落间距 (tight|normal|loose|relaxed 或数值如 1em)', 'normal')
    .option('--math-spacing <spacing>', '数学公式上下间距 (tight|normal|loose|relaxed 或数值如 20px)', 'tight')
    .option('--math-engine <engine>', '数学引擎 (auto|katex|mathjax)', DEFAULT_MATH_ENGINE)
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
    // 规范化数值类型选项，自动添加单位
    const normalizedOptions = normalizeNumericOptions(options);
    
    // 检查输入文件是否存在
    if (!await fileExists(input)) {
      console.error(chalk.red(`❌ 错误: 文件 '${input}' 不存在`));
      process.exit(1);
    }

    // 自动生成输出文件名
    if (!output) {
      const path = await import('path');
      const parsed = path.parse(input);
      const extension = normalizedOptions.format === 'html' ? 'html' : 'pdf';
      output = path.join(parsed.dir, `${parsed.name}.${extension}`);
    }

    console.log(chalk.blue('🔄 开始转换...'));
    console.log(chalk.gray(`📖 输入: ${input}`));
    console.log(chalk.gray(`📁 输出: ${output}`));
    console.log(chalk.gray(`📝 格式: ${normalizedOptions.format.toUpperCase()}`));
    console.log(chalk.gray(`🎨 字体大小: ${normalizedOptions.fontSize}`));
    console.log(chalk.gray(`📏 页边距: ${normalizedOptions.margin}`));
    console.log(chalk.gray(`🇨🇳 中文字体: ${normalizedOptions.chineseFont}`));
    console.log(chalk.gray(`💪 文字厚度: ${normalizedOptions.fontWeight}`));
    console.log(chalk.gray(`📐 行间距: ${normalizedOptions.lineSpacing}`));
    console.log(chalk.gray(`📄 段落间距: ${normalizedOptions.paragraphSpacing}`));
    console.log(chalk.gray(`🧮 公式间距: ${normalizedOptions.mathSpacing}`));
  if (normalizedOptions.mathEngine) {
      console.log(chalk.gray(`🧠 数学引擎: ${normalizedOptions.mathEngine}`));
    }
    if (normalizedOptions.landscape) {
      console.log(chalk.gray(`📱 页面方向: 横向`));
    }

    // 准备PDF选项
    const pdfOptions = {};
    if (normalizedOptions.margin) {
      pdfOptions.margin = {
        top: normalizedOptions.margin,
        right: normalizedOptions.margin,
        bottom: normalizedOptions.margin,
        left: normalizedOptions.margin
      };
    }
    if (normalizedOptions.landscape) {
      pdfOptions.landscape = true;
    }

    // 准备样式选项
    const styleOptions = {
      fontSize: normalizedOptions.fontSize,
      chineseFont: normalizedOptions.chineseFont,
      fontWeight: normalizedOptions.fontWeight,
      lineSpacing: normalizedOptions.lineSpacing,
      paragraphSpacing: normalizedOptions.paragraphSpacing,
      mathSpacing: normalizedOptions.mathSpacing,
      mathEngine: normalizedOptions.mathEngine
    };

    // 执行转换
    const startTime = Date.now();
    
    if (normalizedOptions.format === 'pdf') {
      await convertMarkdownToPdf(input, output, { pdfOptions, styleOptions });
    } else if (normalizedOptions.format === 'html') {
      const { convertMarkdownToHtml } = await import('./converter.js');
      await convertMarkdownToHtml(input, output, { styleOptions });
    } else {
      throw new Error(`不支持的格式: ${normalizedOptions.format}`);
    }
    
    const duration = Date.now() - startTime;

    console.log(chalk.green(`✅ 转换完成! (耗时: ${duration}ms)`));
    console.log(chalk.yellow(`🎉 文件已生成: ${output}`));

  } catch (error) {
    console.error(chalk.red(`❌ 转换失败: ${error.message}`));
    if (options && options.verbose) {
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
