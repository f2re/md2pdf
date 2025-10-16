/**
 * KaTeX Local Asset Management Module
 */

import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory path of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Converts a file to a base64 data URL
 * @param {string} filePath - The file path
 * @param {string} mimeType - The MIME type
 * @returns {Promise<string>} The base64 data URL
 */
async function fileToBase64DataUrl(filePath, mimeType) {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const base64 = fileBuffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.warn(`Failed to read font file ${filePath}:`, error.message);
    return '';
  }
}

/**
 * Gets the MIME type of a font
 * @param {string} fontPath - The font file path
 * @returns {string} The MIME type
 */
function getFontMimeType(fontPath) {
  if (fontPath.endsWith('.woff2')) return 'font/woff2';
  if (fontPath.endsWith('.woff')) return 'font/woff';
  if (fontPath.endsWith('.ttf')) return 'font/ttf';
  return 'font/ttf';
}

/**
 * Gets the fully localized KaTeX CSS (with inline fonts)
 * @returns {Promise<string>} The KaTeX CSS with inline fonts
 */
export async function getLocalKatexCssWithInlineFonts() {
  try {
    // Read KaTeX CSS
    const katexCssPath = join(__dirname, '..', 'assets', 'katex', 'katex.min.css');
    let katexCss = await fs.readFile(katexCssPath, 'utf-8');
    
    // Font file directory
    const fontsDir = join(__dirname, '..', 'assets', 'katex', 'fonts');
    
    // Regular expression to match all url(fonts/...)
    const urlRegex = /url\(fonts\/([^)]+)\)/g;
    
    // Get all matching font files
    const matches = [...katexCss.matchAll(urlRegex)];
    
    // Create a base64 data URL for each font file
    for (const match of matches) {
      const fontFile = match[1];
      const fontPath = join(fontsDir, fontFile);
      const mimeType = getFontMimeType(fontFile);
      const dataUrl = await fileToBase64DataUrl(fontPath, mimeType);
      
      if (dataUrl) {
        // Replace the original url(fonts/...) with the data URL
        katexCss = katexCss.replace(match[0], `url(${dataUrl})`);
      }
    }
    
    return katexCss;
  } catch (error) {
    console.warn('Failed to generate KaTeX CSS with inline fonts, will use basic styles:', error.message);
    return getBasicKatexStyles();
  }
}

/**
 * Gets basic KaTeX styles (without relying on font files)
 * @returns {string} Basic KaTeX styles
 */
function getBasicKatexStyles() {
  return `
    .katex { 
      font: normal 1.21em KaTeX_Main, Times New Roman, serif; 
      line-height: 1.2; 
      text-indent: 0; 
      text-rendering: auto; 
    }
    .katex * {
      -ms-high-contrast-adjust: none !important;
      border-color: currentColor;
    }
    .katex .katex-mathml {
      clip: rect(1px, 1px, 1px, 1px);
      border: 0;
      height: 1px;
      overflow: hidden;
      padding: 0;
      position: absolute;
      width: 1px;
    }
    .katex .katex-html > .newline {
      display: block;
    }
    .katex .base {
      position: relative;
      white-space: nowrap;
      width: min-content;
    }
    .katex .base,
    .katex .strut {
      display: inline-block;
    }
    .katex-display {
      display: block;
      margin: 1em 0;
      text-align: center;
    }
    .katex-display > .katex {
      display: block;
      text-align: center;
      white-space: nowrap;
    }
    .katex-display > .katex > .katex-html {
      display: block;
      position: relative;
    }
  `;
}
