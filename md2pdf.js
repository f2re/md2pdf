#!/usr/bin/env node

/**
 * Markdown LaTeX to PDF Converter - 纯JavaScript版本
 * 
 * 功能：将包含LaTeX数学公式的Markdown文件转换为PDF
 * 使用：node md2pdf.js <markdown文件路径> [输出PDF路径]
 */

import MarkdownIt from 'markdown-it';
import katex from 'katex';
import * as fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import { program } from 'commander';
import chalk from 'chalk';

// ===== 工具函数 =====

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ===== Markdown渲染器 =====

class MarkdownLatexRenderer {
  constructor() {
    // 初始化 markdown-it
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
      breaks: false,
    });

    // 数学公式分隔符
    this.mathInlineDelimiters = [
      ['$', '$'],
      ['\\(', '\\)']
    ];
    this.mathBlockDelimiters = [
      ['$$', '$$'],
      ['\\[', '\\]']
    ];

    // 添加代码高亮支持
    this.md.set({
      highlight: function (str, lang) {
        if (lang && lang.trim()) {
          return `<pre class="hljs"><code class="language-${lang}">${escapeHtml(str)}</code></pre>`;
        }
        return `<pre class="hljs"><code>${escapeHtml(str)}</code></pre>`;
      }
    });
  }

  processMathExpressions(content) {
    const mathExpressions = [];
    let processedContent = content;

    // 处理块级数学表达式（必须先处理）
    for (const [startDelim, endDelim] of this.mathBlockDelimiters) {
      const regex = new RegExp(
        escapeRegExp(startDelim) + '([\\s\\S]*?)' + escapeRegExp(endDelim),
        'g'
      );

      processedContent = processedContent.replace(regex, (match, mathContent) => {
        const placeholder = `<!--MATH_BLOCK_${mathExpressions.length}-->`;
        mathExpressions.push({
          type: 'block',
          content: mathContent.trim(),
          placeholder
        });
        return placeholder;
      });
    }

    // 处理行内数学表达式
    for (const [startDelim, endDelim] of this.mathInlineDelimiters) {
      let regex;
      
      if (startDelim === '$' && endDelim === '$') {
        // 特殊处理单美元符号
        regex = /(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g;
      } else {
        regex = new RegExp(
          escapeRegExp(startDelim) + '([\\s\\S]*?)' + escapeRegExp(endDelim),
          'g'
        );
      }

      processedContent = processedContent.replace(regex, (match, mathContent) => {
        const placeholder = `<!--MATH_INLINE_${mathExpressions.length}-->`;
        mathExpressions.push({
          type: 'inline',
          content: mathContent.trim(),
          placeholder
        });
        return placeholder;
      });
    }

    return { processedContent, mathExpressions };
  }

  renderMath(content, displayMode = false) {
    try {
      return katex.renderToString(content, {
        displayMode,
        throwOnError: false,
        output: 'html',
        trust: false,
        strict: 'warn'
      });
    } catch (error) {
      console.warn('KaTeX rendering error:', error);
      return displayMode ? `$$${content}$$` : `$${content}$`;
    }
  }

  render(content) {
    // 1. 处理数学表达式
    const { processedContent, mathExpressions } = this.processMathExpressions(content);

    // 2. 渲染 Markdown
    let html = this.md.render(processedContent);

    // 3. 还原数学表达式
    for (const expr of mathExpressions) {
      const renderedMath = this.renderMath(expr.content, expr.type === 'block');
      
      if (expr.type === 'block') {
        const mathDiv = `<div class="math-block">${renderedMath}</div>`;
        html = html.replace(expr.placeholder, mathDiv);
      } else {
        const mathSpan = `<span class="math-inline">${renderedMath}</span>`;
        html = html.replace(expr.placeholder, mathSpan);
      }
    }

    // 4. 包装成完整的 HTML 文档
    return this.wrapHTML(html);
  }

  wrapHTML(content) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Markdown LaTeX Preview</title>

    <!-- KaTeX CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">

    <style>
        /* 基础样式 */
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
            background-color: #fff;
        }

        /* 数学公式样式 */
        .math-block {
            margin: 20px 0;
            text-align: center;
            overflow-x: auto;
        }

        .math-inline {
            display: inline;
        }

        /* 代码样式 */
        pre {
            background-color: #f6f8fa;
            border: 1px solid #e1e4e8;
            border-radius: 6px;
            padding: 16px;
            overflow-x: auto;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 14px;
            line-height: 1.45;
        }

        code {
            background-color: rgba(175, 184, 193, 0.2);
            border-radius: 6px;
            padding: 2px 4px;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 85%;
        }

        pre code {
            background-color: transparent;
            border-radius: 0;
            padding: 0;
            font-size: 100%;
        }

        /* 表格样式 */
        table {
            border-collapse: collapse;
            margin: 25px 0;
            font-size: 0.9em;
            min-width: 400px;
            border-radius: 5px 5px 0 0;
            overflow: hidden;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.15);
        }

        table thead tr {
            background-color: #009879;
            color: #ffffff;
            text-align: left;
        }

        table th,
        table td {
            padding: 12px 15px;
            border: 1px solid #dddddd;
        }

        table tbody tr {
            border-bottom: 1px solid #dddddd;
        }

        table tbody tr:nth-of-type(even) {
            background-color: #f3f3f3;
        }

        /* 引用样式 */
        blockquote {
            border-left: 4px solid #dfe2e5;
            padding: 0 16px;
            color: #6a737d;
            background-color: #f6f8fa;
            margin: 20px 0;
        }

        /* 标题样式 */
        h1, h2, h3, h4, h5, h6 {
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
        }

        h1 {
            font-size: 2em;
            border-bottom: 1px solid #eaecef;
            padding-bottom: 0.3em;
        }

        h2 {
            font-size: 1.5em;
            border-bottom: 1px solid #eaecef;
            padding-bottom: 0.3em;
        }

        /* 链接样式 */
        a {
            color: #0366d6;
            text-decoration: none;
        }

        a:hover {
            text-decoration: underline;
        }

        /* 打印样式 */
        @media print {
            body {
                max-width: none;
                margin: 0;
                padding: 15mm;
                font-size: 12pt;
            }

            .math-block {
                page-break-inside: avoid;
            }

            pre {
                page-break-inside: avoid;
                white-space: pre-wrap;
            }

            table {
                page-break-inside: avoid;
            }

            h1, h2, h3, h4, h5, h6 {
                page-break-after: avoid;
            }
        }
    </style>
</head>
<body>
    ${content}
</body>
</html>`;
  }
}

// ===== PDF转换器 =====

class MarkdownToPdfConverter {
  constructor() {
    this.renderer = new MarkdownLatexRenderer();
    this.browser = null;
  }

  async convert(options) {
    const { input, output, format } = options;

    // 读取 Markdown 文件
    const markdownContent = await fs.readFile(input, 'utf-8');
    
    // 渲染为 HTML
    const html = this.renderer.render(markdownContent);

    if (format === 'html') {
      const outputPath = output || this.getOutputPath(input, 'html');
      await fs.writeFile(outputPath, html, 'utf-8');
      return outputPath;
    }

    if (format === 'pdf') {
      const outputPath = output || this.getOutputPath(input, 'pdf');
      await this.generatePdf(html, outputPath);
      return outputPath;
    }

    throw new Error(`Unsupported format: ${format}`);
  }

  async generatePdf(html, outputPath, pdfOptions = {}) {
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await this.browser.newPage();
      
      // 设置内容
      await page.setContent(html, { 
        waitUntil: ['load', 'networkidle0'],
        timeout: 30000 
      });

      // 等待 KaTeX 渲染完成
      await page.waitForTimeout(1000);

      // 生成 PDF
      const defaultPdfOptions = {
        format: 'A4',
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        },
        printBackground: true,
        landscape: false
      };

      await page.pdf({
        path: outputPath,
        ...defaultPdfOptions,
        ...pdfOptions
      });

      console.log(`PDF generated successfully: ${outputPath}`);
    } finally {
      await this.browser.close();
      this.browser = null;
    }
  }

  getOutputPath(inputPath, extension) {
    const parsed = path.parse(inputPath);
    return path.join(parsed.dir, `${parsed.name}.${extension}`);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// ===== 便捷函数 =====

async function convertMarkdownToPdf(inputFile, outputFile, options = {}) {
  const converter = new MarkdownToPdfConverter();
  
  try {
    return await converter.convert({
      input: inputFile,
      output: outputFile,
      format: 'pdf',
      ...options
    });
  } finally {
    await converter.close();
  }
}

// ===== CLI界面 =====

// 显示工具标题
console.log(chalk.cyan.bold(`
┌──────────────────────────────────┐
│  📄 Markdown LaTeX → PDF 转换器  │
│  🧮 支持数学公式 | 🎨 美观排版   │
└──────────────────────────────────┘
`));

program
  .name('md2pdf')
  .description('将Markdown文件(含LaTeX公式)转换为PDF')
  .version('1.0.0')
  .argument('<input>', 'Markdown输入文件路径')
  .argument('[output]', 'PDF输出文件路径(可选)')
  .option('-v, --verbose', '显示详细信息')
  .action(async (input, output, options) => {
    try {
      // 检查输入文件是否存在
      const inputStats = await fs.stat(input).catch(() => null);
      if (!inputStats) {
        console.error(chalk.red(`❌ 错误: 文件 '${input}' 不存在`));
        process.exit(1);
      }

      // 自动生成输出文件名
      if (!output) {
        const parsed = path.parse(input);
        output = path.join(parsed.dir, `${parsed.name}.pdf`);
      }

      console.log(chalk.blue('🔄 开始转换...'));
      console.log(chalk.gray(`📖 输入: ${input}`));
      console.log(chalk.gray(`📁 输出: ${output}`));

      // 执行转换
      const startTime = Date.now();
      await convertMarkdownToPdf(input, output);
      const duration = Date.now() - startTime;

      console.log(chalk.green(`✅ 转换完成! (耗时: ${duration}ms)`));
      console.log(chalk.yellow(`🎉 PDF文件已生成: ${output}`));

    } catch (error) {
      console.error(chalk.red(`❌ 转换失败: ${error.message}`));
      if (options.verbose) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  });

program.parse();
