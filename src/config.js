/**
 * Configuration Options Module
 */

/**
 * Math formula delimiter configuration
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
 * Markdown-it default configuration
 */
export const MARKDOWN_CONFIG = {
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
};

/**
 * KaTeX rendering configuration
 */
export const KATEX_CONFIG = {
  // Will be overridden to true in the renderer to catch errors and fall back to MathJax
  throwOnError: false,
  output: 'html',
  trust: false,
  strict: false  // Completely disable strict mode warnings, including Unicode character warnings
};

/**
 * Math rendering engine configuration
 */
export const MATH_ENGINE = {
  AUTO: 'auto',      // Prioritize KaTeX, fall back to MathJax on failure
  KATEX: 'katex',    // Force the use of KaTeX
  MATHJAX: 'mathjax' // Force the use of MathJax
};

export const DEFAULT_MATH_ENGINE = MATH_ENGINE.AUTO;

/**
 * MathJax CDN (v3, TeX-CHTML output)
 */

/**
 * Puppeteer browser configuration
 */
export const BROWSER_CONFIG = {
  headless: 'new',
  timeout: 0,  // No timeout for browser launch
  args: [
    '--no-sandbox', 
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    '--disable-gpu',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--no-timeout'  // Disable internal timeout
  ]
};

/**
 * PDF generation default configuration
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
 * Page loading configuration
 */
export const PAGE_CONFIG = {
  waitUntil: ['load', 'networkidle0'],
  timeout: 0  // 0 means no timeout
};

/**
 * MathJax rendering wait time
 */
// Purely local MathJax rendering is done on the Node side, no need to wait for browser loading

/**
 * Font size configuration
 */
export const FONT_SIZE_CONFIG = {
  small: '12px',
  medium: '14px',
  large: '16px',
  xlarge: '18px'
};

/**
 * Default font size
 */
export const DEFAULT_FONT_SIZE = 'medium';

/**
 * Chinese font configuration
 */
export const CHINESE_FONT_CONFIG = {
  simsun: 'SimSun, "宋体", serif',
  simhei: 'SimHei, "黑体", sans-serif',
  simkai: 'KaiTi, "楷体", "STKaiti", serif',
  fangsong: 'FangSong, "仿宋", "STFangsong", serif',
  yahei: '"Microsoft YaHei", "微软雅黑", sans-serif',
  auto: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Microsoft YaHei", "微软雅黑", "SimSun", "宋体", sans-serif'
};

/**
 * Default Chinese font
 */
export const DEFAULT_CHINESE_FONT = 'auto';

/**
 * Font weight configuration
 */
export const FONT_WEIGHT_CONFIG = {
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  black: '900'
};

/**
 * Default font weight
 */
export const DEFAULT_FONT_WEIGHT = 'normal';

/**
 * Line spacing configuration
 */
export const LINE_SPACING_CONFIG = {
  tight: '1.2',
  normal: '1.6', 
  loose: '2.0',
  relaxed: '2.4'
};

/**
 * Default line spacing
 */
export const DEFAULT_LINE_SPACING = 'normal';

/**
 * Paragraph spacing configuration
 */
export const PARAGRAPH_SPACING_CONFIG = {
  tight: '0.5em',
  normal: '1em',
  loose: '1.5em',
  relaxed: '2em'
};

/**
 * Default paragraph spacing
 */
export const DEFAULT_PARAGRAPH_SPACING = 'normal';

/**
 * Vertical margin configuration for math formulas
 */
export const MATH_SPACING_CONFIG = {
  tight: '10px',
  normal: '20px',
  loose: '30px',
  relaxed: '40px'
};

/**
 * Default math formula spacing
 */
export const DEFAULT_MATH_SPACING = 'normal';
