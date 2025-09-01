/**
 * KaTeX 本地资源管理模块
 */

import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 将文件转换为 base64 数据 URL
 * @param {string} filePath - 文件路径
 * @param {string} mimeType - MIME 类型
 * @returns {Promise<string>} base64 数据 URL
 */
async function fileToBase64DataUrl(filePath, mimeType) {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const base64 = fileBuffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.warn(`无法读取字体文件 ${filePath}:`, error.message);
    return '';
  }
}

/**
 * 获取字体的 MIME 类型
 * @param {string} fontPath - 字体文件路径
 * @returns {string} MIME 类型
 */
function getFontMimeType(fontPath) {
  if (fontPath.endsWith('.woff2')) return 'font/woff2';
  if (fontPath.endsWith('.woff')) return 'font/woff';
  if (fontPath.endsWith('.ttf')) return 'font/ttf';
  return 'font/ttf';
}

/**
 * 获取完全本地化的 KaTeX CSS（包含内联字体）
 * @returns {Promise<string>} 包含内联字体的 KaTeX CSS
 */
export async function getLocalKatexCssWithInlineFonts() {
  try {
    // 读取 KaTeX CSS
    const katexCssPath = join(__dirname, '..', 'assets', 'katex', 'katex.min.css');
    let katexCss = await fs.readFile(katexCssPath, 'utf-8');
    
    // 字体文件目录
    const fontsDir = join(__dirname, '..', 'assets', 'katex', 'fonts');
    
    // 匹配所有 url(fonts/...) 的正则表达式
    const urlRegex = /url\(fonts\/([^)]+)\)/g;
    
    // 获取所有匹配的字体文件
    const matches = [...katexCss.matchAll(urlRegex)];
    
    // 为每个字体文件创建 base64 数据 URL
    for (const match of matches) {
      const fontFile = match[1];
      const fontPath = join(fontsDir, fontFile);
      const mimeType = getFontMimeType(fontFile);
      const dataUrl = await fileToBase64DataUrl(fontPath, mimeType);
      
      if (dataUrl) {
        // 替换原始的 url(fonts/...) 为 data URL
        katexCss = katexCss.replace(match[0], `url(${dataUrl})`);
      }
    }
    
    return katexCss;
  } catch (error) {
    console.warn('无法生成内联字体的 KaTeX CSS，将使用基本样式:', error.message);
    return getBasicKatexStyles();
  }
}

/**
 * 获取基本的 KaTeX 样式（不依赖字体文件）
 * @returns {string} 基本的 KaTeX 样式
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
