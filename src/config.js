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

/**
 * 中文字体配置
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
 * 默认中文字体
 */
export const DEFAULT_CHINESE_FONT = 'auto';

/**
 * 文字厚度配置
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
 * 默认文字厚度
 */
export const DEFAULT_FONT_WEIGHT = 'normal';
