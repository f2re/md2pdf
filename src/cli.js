/**
 * CLI Interface Module
 */

import { program } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import { fileExists } from './utils.js';
import { convertMarkdownToPdf } from './converter.js';
import { MATH_ENGINE, DEFAULT_MATH_ENGINE } from './config.js';

/**
 * Automatically adds units to numeric options.
 * Options that support automatic unit addition:
 * - margin: adds mm unit to pure numbers
 * - fontSize: adds px unit to pure numbers
 * - fontWeight: numeric value remains unchanged (CSS supports pure numbers)
 * - lineSpacing: pure number remains unchanged (line-height supports pure numbers)
 * - paragraphSpacing: adds em unit to pure numbers
 * - mathSpacing: adds px unit to pure numbers
 * 
 * @param {Object} options - The original options object
 * @returns {Object} The processed options object
 */
function normalizeNumericOptions(options) {
  const normalized = { ...options };
  
  // Process margin option - if it's a pure number (integer or decimal), add mm unit
  if (normalized.margin && /^(\d+|\d*\.\d+)$/.test(normalized.margin)) {
    normalized.margin = normalized.margin + 'mm';
    console.log(chalk.dim(`  🔧 Automatically adding unit: margin ${options.margin} → ${normalized.margin}`));
  }
  
  // Process font-size option - if it's a pure number (integer or decimal), add px unit
  if (normalized.fontSize && /^(\d+|\d*\.\d+)$/.test(normalized.fontSize)) {
    normalized.fontSize = normalized.fontSize + 'px';
    console.log(chalk.dim(`  🔧 Automatically adding unit: fontSize ${options.fontSize} → ${normalized.fontSize}`));
  }
  
  // Process paragraph-spacing option - if it's a pure number (integer or decimal), add em unit
  if (normalized.paragraphSpacing && /^(\d+|\d*\.\d+)$/.test(normalized.paragraphSpacing)) {
    normalized.paragraphSpacing = normalized.paragraphSpacing + 'em';
    console.log(chalk.dim(`  🔧 Automatically adding unit: paragraphSpacing ${options.paragraphSpacing} → ${normalized.paragraphSpacing}`));
  }
  
  // Process math-spacing option - if it's a pure number (integer or decimal), add px unit
  if (normalized.mathSpacing && /^(\d+|\d*\.\d+)$/.test(normalized.mathSpacing)) {
    normalized.mathSpacing = normalized.mathSpacing + 'px';
    console.log(chalk.dim(`  🔧 Automatically adding unit: mathSpacing ${options.mathSpacing} → ${normalized.mathSpacing}`));
  }
  
  // font-weight and line-spacing options do not need units, CSS supports pure numbers and keywords
  
  return normalized;
}

/**
 * Displays the tool title
 */
export function showTitle() {
  console.log(chalk.cyan.bold(`
┌──────────────────────────────────┐
│  📄 Markdown LaTeX → PDF Converter  │
│  🧮 Supports Math Formulas | 🎨 Beautiful Typesetting   │
└──────────────────────────────────┘
`));
}

/**
 * Creates the CLI program
 * @returns {Command} Commander program instance
 */
export function createCLI() {
  return program
    .name('md2pdf')
    .description('Converts Markdown files (with LaTeX formulas) to PDF')
    .version('1.0.0')
    .argument('<input>', 'Markdown input file path')
    .argument('[output]', 'PDF output file path (optional)')
    .option('-v, --verbose', 'Show detailed information')
    .option('-f, --format <format>', 'Output format (pdf|html)', 'pdf')
    .option('--margin <margin>', 'PDF page margin (e.g., 20mm)', '0mm')
    .option('--landscape', 'Landscape page orientation')
    .option('--font-size <size>', 'Font size (small|medium|large|xlarge or a specific value like 14px)', 'large')
    .option('--chinese-font <font>', 'Chinese font (simsun|simhei|simkai|fangsong|yahei|auto)', 'auto')
    .option('--font-weight <weight>', 'Font weight (light|normal|medium|semibold|bold|black or a numeric value like 400)', 'medium')
    .option('--line-spacing <spacing>', 'Line spacing (tight|normal|loose|relaxed or a numeric value like 1.6)', 'normal')
    .option('--paragraph-spacing <spacing>', 'Paragraph spacing (tight|normal|loose|relaxed or a numeric value like 1em)', 'normal')
    .option('--math-spacing <spacing>', 'Vertical spacing for math formulas (tight|normal|loose|relaxed or a numeric value like 20px)', 'tight')
    .option('--math-engine <engine>', 'Math engine (auto|katex|mathjax)', DEFAULT_MATH_ENGINE)
    .action(async (input, output, options) => {
      await handleConvert(input, output, options);
    });
}

/**
 * Handles the convert command
 * @param {string} input - The input file path
 * @param {string} output - The output file path
 * @param {Object} options - The command options
 */
async function handleConvert(input, output, options) {
  try {
    // Normalize numeric options, automatically adding units
    const normalizedOptions = normalizeNumericOptions(options);
    
    // Check if the input file exists
    if (!await fileExists(input)) {
      console.error(chalk.red(`❌ Error: File '${input}' does not exist`));
      process.exit(1);
    }

    // Automatically generate the output filename
    if (!output) {
      const path = await import('path');
      const parsed = path.parse(input);
      const extension = normalizedOptions.format === 'html' ? 'html' : 'pdf';
      output = path.join(parsed.dir, `${parsed.name}.${extension}`);
    }

    console.log(chalk.blue('🔄 Starting conversion...'));
    console.log(chalk.gray(`📖 Input: ${input}`));
    console.log(chalk.gray(`📁 Output: ${output}`));
    console.log(chalk.gray(`📝 Format: ${normalizedOptions.format.toUpperCase()}`));
    console.log(chalk.gray(`🎨 Font Size: ${normalizedOptions.fontSize}`));
    console.log(chalk.gray(`📏 Page Margin: ${normalizedOptions.margin}`));
    console.log(chalk.gray(`🇨🇳 Chinese Font: ${normalizedOptions.chineseFont}`));
    console.log(chalk.gray(`💪 Font Weight: ${normalizedOptions.fontWeight}`));
    console.log(chalk.gray(`📐 Line Spacing: ${normalizedOptions.lineSpacing}`));
    console.log(chalk.gray(`📄 Paragraph Spacing: ${normalizedOptions.paragraphSpacing}`));
    console.log(chalk.gray(`🧮 Formula Spacing: ${normalizedOptions.mathSpacing}`));
  if (normalizedOptions.mathEngine) {
      console.log(chalk.gray(`🧠 Math Engine: ${normalizedOptions.mathEngine}`));
    }
    if (normalizedOptions.landscape) {
      console.log(chalk.gray(`📱 Page Orientation: Landscape`));
    }

    // Prepare PDF options
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

    // Prepare style options
    const styleOptions = {
      fontSize: normalizedOptions.fontSize,
      chineseFont: normalizedOptions.chineseFont,
      fontWeight: normalizedOptions.fontWeight,
      lineSpacing: normalizedOptions.lineSpacing,
      paragraphSpacing: normalizedOptions.paragraphSpacing,
      mathSpacing: normalizedOptions.mathSpacing,
      mathEngine: normalizedOptions.mathEngine
    };

    // Execute the conversion
    const startTime = Date.now();
    
    if (normalizedOptions.format === 'pdf') {
      await convertMarkdownToPdf(input, output, { pdfOptions, styleOptions });
    } else if (normalizedOptions.format === 'html') {
      const { convertMarkdownToHtml } = await import('./converter.js');
      await convertMarkdownToHtml(input, output, { styleOptions });
    } else {
      throw new Error(`Unsupported format: ${normalizedOptions.format}`);
    }
    
    const duration = Date.now() - startTime;

    console.log(chalk.green(`✅ Conversion complete! (Time taken: ${duration}ms)`));
    console.log(chalk.yellow(`🎉 File generated: ${output}`));

  } catch (error) {
    console.error(chalk.red(`❌ Conversion failed: ${error.message}`));
    if (options && options.verbose) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

/**
 * Runs the CLI program
 */
export function runCLI() {
  showTitle();
  const cli = createCLI();
  cli.parse();
}
