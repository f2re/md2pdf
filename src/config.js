/**
 * 配置选项模块
 */

/**
 * 数学公式分隔符配置
 */
export const MATH_DELIMITERS = {
  inline: [
    ['$', '$'],
    ['\\(', '\\)']
  ],
  block: [
    ['$$', '$$'],
    ['\\[', '\\]']
  ]
};

/**
 * Markdown-it 默认配置
 */
export const MARKDOWN_CONFIG = {
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
};

/**
 * KaTeX 渲染配置
 */
export const KATEX_CONFIG = {
  throwOnError: false,
  output: 'html',
  trust: false,
  strict: 'warn'
};

/**
 * Puppeteer 浏览器配置
 */
export const BROWSER_CONFIG = {
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
};

/**
 * PDF 生成默认配置
 */
export const PDF_CONFIG = {
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

/**
 * 页面加载配置
 */
export const PAGE_CONFIG = {
  waitUntil: ['load', 'networkidle0'],
  timeout: 30000
};

/**
 * KaTeX 渲染等待时间
 */
export const KATEX_RENDER_DELAY = 1000;

/**
 * 字体大小配置
 */
export const FONT_SIZE_CONFIG = {
  small: '12px',
  medium: '14px',
  large: '16px',
  xlarge: '18px'
};

/**
 * 默认字体大小
 */
export const DEFAULT_FONT_SIZE = 'medium';
