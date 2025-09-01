/**
 * PDF转换器模块
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs/promises';
import { MarkdownLatexRenderer } from './renderer.js';
import { getOutputPath } from './utils.js';
import { BROWSER_CONFIG, PDF_CONFIG, PAGE_CONFIG, KATEX_RENDER_DELAY } from './config.js';

/**
 * Markdown 到 PDF 转换器类
 */
export class MarkdownToPdfConverter {
  constructor() {
    this.renderer = new MarkdownLatexRenderer();
    this.browser = null;
  }

  /**
   * 转换 Markdown 文件
   * @param {Object} options - 转换选项
   * @param {string} options.input - 输入文件路径
   * @param {string} [options.output] - 输出文件路径
   * @param {string} [options.format='pdf'] - 输出格式 (pdf|html)
   * @param {Object} [options.pdfOptions] - PDF选项
   * @param {Object} [options.styleOptions] - 样式选项
   * @returns {Promise<string>} 输出文件路径
   */
  async convert(options) {
    const { input, output, format = 'pdf', pdfOptions = {}, styleOptions = {} } = options;

    // 读取 Markdown 文件
    const markdownContent = await fs.readFile(input, 'utf-8');
    
    // 渲染为 HTML
    const html = await this.renderer.render(markdownContent, styleOptions);

    if (format === 'html') {
      const outputPath = output || await getOutputPath(input, 'html');
      await fs.writeFile(outputPath, html, 'utf-8');
      return outputPath;
    }

    if (format === 'pdf') {
      const outputPath = output || await getOutputPath(input, 'pdf');
      await this.generatePdf(html, outputPath, pdfOptions);
      return outputPath;
    }

    throw new Error(`Unsupported format: ${format}`);
  }

  /**
   * 生成PDF文件
   * @param {string} html - HTML内容
   * @param {string} outputPath - 输出路径
   * @param {Object} pdfOptions - PDF配置选项
   */
  async generatePdf(html, outputPath, pdfOptions = {}) {
    this.browser = await puppeteer.launch(BROWSER_CONFIG);

    try {
      const page = await this.browser.newPage();
      
      // 设置内容
      await page.setContent(html, PAGE_CONFIG);

      // 等待渲染完成（KaTeX 已在 Node 侧完成，MathJax 也在 Node 侧完成）
      await page.waitForTimeout(Math.max(KATEX_RENDER_DELAY, 300));

      // 生成 PDF
      const finalPdfOptions = {
        ...PDF_CONFIG,
        ...pdfOptions
      };

      await page.pdf({
        path: outputPath,
        ...finalPdfOptions
      });

      console.log(`PDF generated successfully: ${outputPath}`);
    } finally {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * 关闭浏览器实例
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

/**
 * 便捷函数：转换 Markdown 文件为 PDF
 * @param {string} inputFile - 输入文件路径
 * @param {string} [outputFile] - 输出文件路径
 * @param {Object} [options] - 转换选项
 * @returns {Promise<string>} 输出文件路径
 */
export async function convertMarkdownToPdf(inputFile, outputFile, options = {}) {
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

/**
 * 便捷函数：转换 Markdown 文件为 HTML
 * @param {string} inputFile - 输入文件路径
 * @param {string} [outputFile] - 输出文件路径
 * @param {Object} [options] - 转换选项
 * @returns {Promise<string>} 输出文件路径
 */
export async function convertMarkdownToHtml(inputFile, outputFile, options = {}) {
  const converter = new MarkdownToPdfConverter();
  
  try {
    return await converter.convert({
      input: inputFile,
      output: outputFile,
      format: 'html',
      ...options
    });
  } finally {
    await converter.close();
  }
}
