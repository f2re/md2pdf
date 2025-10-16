/**
 * PDF Converter Module
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs/promises';
import { MarkdownLatexRenderer } from './renderer.js';
import { getOutputPath } from './utils.js';
import { BROWSER_CONFIG, PDF_CONFIG, PAGE_CONFIG } from './config.js';

/**
 * Markdown to PDF Converter Class
 */
export class MarkdownToPdfConverter {
  constructor(options = {}) {
    this.renderer = new MarkdownLatexRenderer();
    this.browser = null;
    this.reuseInstance = options.reuseInstance !== false; // Enable instance reuse by default
    this.maxPages = options.maxPages || Infinity; // Remove page count limit
    this.openPages = new Set(); // Track open pages
    this.progressCallback = options.progressCallback || null; // Progress callback
  }

  /**
   * Sets the progress callback function
   * @param {Function} callback - The progress callback function, receives (phase, data) arguments
   */
  setProgressCallback(callback) {
    this.progressCallback = callback;
    // Also set the renderer's progress callback
    this.renderer.setProgressCallback((renderedCount, totalCount) => {
      if (this.progressCallback) {
        this.progressCallback('formula_rendering', {
          phase: 'formula_rendering',
          renderedFormulas: renderedCount,
          totalFormulas: totalCount,
          progress: totalCount > 0 ? (renderedCount / totalCount) * 100 : 0
        });
      }
    });
  }

  /**
   * Converts a Markdown file
   * @param {Object} options - The conversion options
   * @param {string} options.input - The input file path
   * @param {string} [options.output] - The output file path
   * @param {string} [options.format='pdf'] - The output format (pdf|html)
   * @param {Object} [options.pdfOptions] - The PDF options
   * @param {Object} [options.styleOptions] - The style options
   * @returns {Promise<string>} The output file path
   */
  async convert(options) {
    const { input, output, format = 'pdf', pdfOptions = {}, styleOptions = {} } = options;

    try {
      // Stage 1: Read file
      if (this.progressCallback) {
        this.progressCallback('reading_file', {
          phase: 'reading_file',
          message: 'Reading Markdown file...',
          progress: 10
        });
      }

      // Read Markdown file
      const markdownContent = await fs.readFile(input, 'utf-8');
      
      // Stage 2: Start rendering
      if (this.progressCallback) {
        this.progressCallback('rendering_html', {
          phase: 'rendering_html',
          message: 'Rendering HTML content...',
          progress: 20
        });
      }

      // Render to HTML
      const html = await this.renderer.render(markdownContent, styleOptions);

      if (format === 'html') {
        // Stage 3: Save HTML
        if (this.progressCallback) {
          this.progressCallback('saving_html', {
            phase: 'saving_html',
            message: 'Saving HTML file...',
            progress: 90
          });
        }

        const outputPath = output || await getOutputPath(input, 'html');
        await fs.writeFile(outputPath, html, 'utf-8');
        
        if (this.progressCallback) {
          this.progressCallback('completed', {
            phase: 'completed',
            message: 'HTML conversion complete',
            progress: 100
          });
        }
        
        return outputPath;
      }

      if (format === 'pdf') {
        // Stage 3: Generate PDF
        if (this.progressCallback) {
          this.progressCallback('generating_pdf', {
            phase: 'generating_pdf',
            message: 'Generating PDF file...',
            progress: 70
          });
        }

        const outputPath = output || await getOutputPath(input, 'pdf');
        await this.generatePdf(html, outputPath, pdfOptions);
        
        if (this.progressCallback) {
          this.progressCallback('completed', {
            phase: 'completed',
            message: 'PDF conversion complete',
            progress: 100
          });
        }
        
        return outputPath;
      }

      throw new Error(`Unsupported format: ${format}`);
    } catch (error) {
      if (this.progressCallback) {
        this.progressCallback('error', {
          phase: 'error',
          message: `Conversion failed: ${error.message}`,
          error: error.message
        });
      }
      throw error;
    }
  }

  /**
   * Gets or creates a browser instance
   */
  async getBrowser() {
    if (!this.browser || this.browser.isConnected() === false) {
      this.browser = await puppeteer.launch(BROWSER_CONFIG);
    }
    return this.browser;
  }

  /**
   * Creates an optimized page instance
   */
  async createPage() {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    
    // Set page default timeout to 0 (unlimited)
    page.setDefaultTimeout(0);
    page.setDefaultNavigationTimeout(0);
    
    // Performance optimization settings
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      // Block unnecessary resource loading to improve performance
      const resourceType = request.resourceType();
      if (['image', 'media', 'font'].includes(resourceType)) {
        // Block loading unless it's a necessary font file
        const url = request.url();
        if (resourceType === 'font' && (url.includes('katex') || url.includes('math'))) {
          request.continue();
        } else if (resourceType === 'image' && url.startsWith('data:')) {
          // Allow inline images
          request.continue();
        } else {
          request.abort();
        }
      } else {
        request.continue();
      }
    });

    // Set viewport to optimize rendering
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 1
    });

    this.openPages.add(page);
    return page;
  }

  /**
   * Cleans up a page instance
   */
  async closePage(page) {
    if (page && !page.isClosed()) {
      await page.close();
      this.openPages.delete(page);
    }
  }
  /**
   * Waits for the page to finish rendering - a fully condition-based waiting mechanism
   * @param {Object} page - The Puppeteer page object
   */
  async waitForPageReady(page) {
    try {
      // Execute multiple checks in parallel to improve performance
      const checks = [];

      // Check 1: Wait for all images to load (no timeout)
      checks.push(
        page.waitForFunction(() => {
          const images = document.querySelectorAll('img');
          return Array.from(images).every(img => img.complete || img.naturalHeight > 0);
        }).catch((error) => {
          console.warn('Image loading check exception:', error.message);
        })
      );

      // Check 2: Wait for fonts to load
      checks.push(
        page.evaluate(() => {
          if (document.fonts && document.fonts.ready) {
            return document.fonts.ready;
          }
          return Promise.resolve();
        }).catch(() => {
          console.warn('Font loading check failed');
        })
      );

      // Check 3: Wait for CSS animations to complete (no timeout)
      checks.push(
        page.waitForFunction(() => {
          const animations = document.getAnimations ? document.getAnimations() : [];
          return animations.length === 0 || animations.every(anim => anim.playState === 'finished');
        }).catch((error) => {
          console.warn('Animation check exception:', error.message);
        })
      );

      // Execute basic checks in parallel
      await Promise.allSettled(checks);

      // Check if there are KaTeX math formulas to render
      const hasKatex = await page.evaluate(() => {
        return document.querySelector('.katex') !== null;
      });

      if (hasKatex) {
        // Wait for KaTeX to finish rendering (no timeout)
        await page.waitForFunction(() => {
          const katexElements = document.querySelectorAll('.katex');
          return Array.from(katexElements).every(el => 
            el.getAttribute('data-rendered') === 'true' || 
            !el.classList.contains('katex-loading') ||
            el.querySelector('.katex-html') !== null
          );
        }).catch((error) => {
          console.warn('KaTeX rendering check exception:', error.message);
        });
      }

      // Finally, wait for the browser to finish layout calculations
      await page.evaluate(() => {
        return new Promise(resolve => {
          if (window.requestIdleCallback) {
            // Completely remove timeout, wait for true idle state
            window.requestIdleCallback(resolve);
          } else {
            // Compatibility fallback, complete immediately
            resolve();
          }
        });
      });

    } catch (error) {
      console.warn('An error occurred during the page readiness check, continuing execution:', error.message);
    }
  }

  /**
   * Generates a PDF file
   * @param {string} html - The HTML content
   * @param {string} outputPath - The output path
   * @param {Object} pdfOptions - The PDF configuration options
   */
  async generatePdf(html, outputPath, pdfOptions = {}) {
    let page = null;
    
    try {
      // Use the optimized page creation method
      page = await this.createPage();
      
      // Set content, using the optimized PAGE_CONFIG
      await page.setContent(html, {
        ...PAGE_CONFIG,
        waitUntil: ['domcontentloaded', 'networkidle0'] // Optimized wait conditions
      });

      // Intelligently wait for the page to finish rendering, instead of a fixed delay
      await this.waitForPageReady(page);

      // Generate PDF, remove timeout configuration to let Puppeteer use default behavior
      const finalPdfOptions = {
        ...PDF_CONFIG,
        ...pdfOptions
        // Do not set timeout, let Puppeteer adjust automatically based on page complexity
      };

      await page.pdf({
        path: outputPath,
        ...finalPdfOptions
      });

      console.log(`PDF generated successfully: ${outputPath}`);
    } finally {
      // Decide whether to close the page and browser based on the configuration
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
   * Closes the browser instance
   */
  async close() {
    // Close all open pages
    for (const page of this.openPages) {
      await this.closePage(page);
    }
    
    // Clean up renderer resources
    if (this.renderer && this.renderer.cleanup) {
      this.renderer.cleanup();
    }
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Batch converts multiple files (performance-optimized version)
   * @param {Array} conversions - An array of conversion tasks, each element containing {input, output, pdfOptions, styleOptions}
   * @returns {Promise<Array>} An array of output file paths
   */
  async convertBatch(conversions) {
    const results = [];
    
    try {
      // Enable instance reuse to improve batch conversion performance
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
      // Close the browser after batch conversion is complete
      await this.close();
    }
  }
}

/**
 * Convenience function: Converts a Markdown file to PDF
 * @param {string} inputFile - The input file path
 * @param {string} [outputFile] - The output file path
 * @param {Object} [options] - The conversion options
 * @returns {Promise<string>} The output file path
 */
export async function convertMarkdownToPdf(inputFile, outputFile, options = {}) {
  const converter = new MarkdownToPdfConverter({
    reuseInstance: false  // Do not reuse instance for single conversion
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
 * Convenience function: Converts a Markdown file to HTML
 * @param {string} inputFile - The input file path
 * @param {string} [outputFile] - The output file path
 * @param {Object} [options] - The conversion options
 * @returns {Promise<string>} The output file path
 */
export async function convertMarkdownToHtml(inputFile, outputFile, options = {}) {
  const converter = new MarkdownToPdfConverter({
    reuseInstance: false  // Do not reuse instance for single conversion
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
 * Batch conversion function: High-performance batch conversion of multiple files
 * @param {Array} conversions - An array of conversion tasks
 * @returns {Promise<Array>} An array of output file paths
 */
export async function convertMarkdownBatch(conversions) {
  const converter = new MarkdownToPdfConverter({
    reuseInstance: true  // Enable instance reuse for batch conversion
    // Remove page limit
  });
  
  return await converter.convertBatch(conversions);
}
