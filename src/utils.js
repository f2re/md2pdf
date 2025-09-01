/**
 * 通用工具函数模块
 */

import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getLocalKatexCssWithInlineFonts } from './katex-assets.js';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * HTML转义函数
 * @param {string} text - 需要转义的文本
 * @returns {string} 转义后的HTML安全文本
 */
export function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * 正则表达式转义函数
 * @param {string} string - 需要转义的字符串
 * @returns {string} 转义后的正则表达式安全字符串
 */
export function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 生成输出文件路径
 * @param {string} inputPath - 输入文件路径
 * @param {string} extension - 输出文件扩展名
 * @returns {Promise<string>} 输出文件路径
 */
export async function getOutputPath(inputPath, extension) {
  const path = await import('path');
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}.${extension}`);
}

/**
 * 检查文件是否存在
 * @param {string} filePath - 文件路径
 * @returns {Promise<boolean>} 文件是否存在
 */
export async function fileExists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取本地 KaTeX CSS 内容（使用内联字体）
 * @returns {Promise<string>} KaTeX CSS 内容
 */
export async function getLocalKatexCss() {
  return await getLocalKatexCssWithInlineFonts();
}
