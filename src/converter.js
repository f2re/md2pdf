/**
 * PDF转换器模块
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs/promises';
import { MarkdownLatexRenderer } from './renderer.js';
import { getOutputPath } from './utils.js';
import { BROWSER_CONFIG, PDF_CONFIG, PAGE_CONFIG } from './config.js';

/**
 * Markdown 到 PDF 转换器类
 */
export class MarkdownToPdfConverter {
  constructor(options = {}) {
    this.renderer = new MarkdownLatexRenderer();
    this.browser = null;
    this.reuseInstance = options.reuseInstance !== false; // 默认启用实例复用
    this.maxPages = options.maxPages || Infinity; // 移除页面数限制
    this.openPages = new Set(); // 跟踪打开的页面
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
   * 获取或创建浏览器实例
   */
  async getBrowser() {
    if (!this.browser || this.browser.isConnected() === false) {
      this.browser = await puppeteer.launch(BROWSER_CONFIG);
    }
    return this.browser;
  }

  /**
   * 创建优化的页面实例
   */
  async createPage() {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    
    // 设置页面默认超时为0（无限制）
    page.setDefaultTimeout(0);
    page.setDefaultNavigationTimeout(0);
    
    // 性能优化设置
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      // 阻止不必要的资源加载以提高性能
      const resourceType = request.resourceType();
      if (['image', 'media', 'font'].includes(resourceType)) {
        // 除非是必要的字体文件，否则阻止加载
        const url = request.url();
        if (resourceType === 'font' && (url.includes('katex') || url.includes('math'))) {
          request.continue();
        } else if (resourceType === 'image' && url.startsWith('data:')) {
          // 允许内联图片
          request.continue();
        } else {
          request.abort();
        }
      } else {
        request.continue();
      }
    });

    // 设置视口以优化渲染
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 1
    });

    this.openPages.add(page);
    return page;
  }

  /**
   * 清理页面实例
   */
  async closePage(page) {
    if (page && !page.isClosed()) {
      await page.close();
      this.openPages.delete(page);
    }
  }
  /**
   * 等待页面渲染完成 - 完全基于条件的等待机制
   * @param {Object} page - Puppeteer页面对象
   */
  async waitForPageReady(page) {
    try {
      // 并行执行多个检查以提高性能
      const checks = [];

      // 检查1: 等待所有图片加载完成（无超时限制）
      checks.push(
        page.waitForFunction(() => {
          const images = document.querySelectorAll('img');
          return Array.from(images).every(img => img.complete || img.naturalHeight > 0);
        }).catch((error) => {
          console.warn('图片加载检查异常:', error.message);
        })
      );

      // 检查2: 等待字体加载完成
      checks.push(
        page.evaluate(() => {
          if (document.fonts && document.fonts.ready) {
            return document.fonts.ready;
          }
          return Promise.resolve();
        }).catch(() => {
          console.warn('字体加载检查失败');
        })
      );

      // 检查3: 等待CSS动画完成（无超时限制）
      checks.push(
        page.waitForFunction(() => {
          const animations = document.getAnimations ? document.getAnimations() : [];
          return animations.length === 0 || animations.every(anim => anim.playState === 'finished');
        }).catch((error) => {
          console.warn('动画检查异常:', error.message);
        })
      );

      // 并行执行基础检查
      await Promise.allSettled(checks);

      // 检查是否有KaTeX数学公式需要渲染
      const hasKatex = await page.evaluate(() => {
        return document.querySelector('.katex') !== null;
      });

      if (hasKatex) {
        // 等待KaTeX渲染完成（无超时限制）
        await page.waitForFunction(() => {
          const katexElements = document.querySelectorAll('.katex');
          return Array.from(katexElements).every(el => 
            el.getAttribute('data-rendered') === 'true' || 
            !el.classList.contains('katex-loading') ||
            el.querySelector('.katex-html') !== null
          );
        }).catch((error) => {
          console.warn('KaTeX渲染检查异常:', error.message);
        });
      }

      // 最后等待浏览器完成布局计算
      await page.evaluate(() => {
        return new Promise(resolve => {
          if (window.requestIdleCallback) {
            // 完全移除timeout，等待真正的空闲状态
            window.requestIdleCallback(resolve);
          } else {
            // 兼容性回退，立即完成
            resolve();
          }
        });
      });

    } catch (error) {
      console.warn('页面准备检查过程中出现错误，继续执行:', error.message);
    }
  }

  /**
   * 生成PDF文件
   * @param {string} html - HTML内容
   * @param {string} outputPath - 输出路径
   * @param {Object} pdfOptions - PDF配置选项
   */
  async generatePdf(html, outputPath, pdfOptions = {}) {
    let page = null;
    
    try {
      // 使用优化的页面创建方法
      page = await this.createPage();
      
      // 设置内容，使用优化的PAGE_CONFIG
      await page.setContent(html, {
        ...PAGE_CONFIG,
        waitUntil: ['domcontentloaded', 'networkidle0'] // 优化等待条件
      });

      // 智能等待页面渲染完成，而不是固定延时
      await this.waitForPageReady(page);

      // 生成 PDF，移除timeout配置让Puppeteer使用默认行为
      const finalPdfOptions = {
        ...PDF_CONFIG,
        ...pdfOptions
        // 不设置timeout，让Puppeteer根据页面复杂度自动调整
      };

      await page.pdf({
        path: outputPath,
        ...finalPdfOptions
      });

      console.log(`PDF generated successfully: ${outputPath}`);
    } finally {
      // 根据配置决定是否关闭页面和浏览器
      if (page) {
        await this.closePage(page);
      }
      
      if (!this.reuseInstance && this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    }
  }

  /**
   * 关闭浏览器实例
   */
  async close() {
    // 关闭所有打开的页面
    for (const page of this.openPages) {
      await this.closePage(page);
    }
    
    // 清理渲染器资源
    if (this.renderer && this.renderer.cleanup) {
      this.renderer.cleanup();
    }
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * 批量转换多个文件（性能优化版本）
   * @param {Array} conversions - 转换任务数组，每个元素包含 {input, output, pdfOptions, styleOptions}
   * @returns {Promise<Array>} 输出文件路径数组
   */
  async convertBatch(conversions) {
    const results = [];
    
    try {
      // 启用实例复用以提高批量转换性能
      this.reuseInstance = true;
      
      for (const conversion of conversions) {
        const result = await this.convert({
          format: 'pdf',
          ...conversion
        });
        results.push(result);
      }
      
      return results;
    } finally {
      // 批量转换完成后关闭浏览器
      await this.close();
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
  const converter = new MarkdownToPdfConverter({
    reuseInstance: false  // 单次转换不复用实例
  });
  
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
  const converter = new MarkdownToPdfConverter({
    reuseInstance: false  // 单次转换不复用实例
  });
  
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

/**
 * 批量转换函数：高性能批量转换多个文件
 * @param {Array} conversions - 转换任务数组
 * @returns {Promise<Array>} 输出文件路径数组
 */
export async function convertMarkdownBatch(conversions) {
  const converter = new MarkdownToPdfConverter({
    reuseInstance: true  // 批量转换启用实例复用
    // 移除页面限制
  });
  
  return await converter.convertBatch(conversions);
}
