/**
 * 模块入口文件 - 导出所有公共API
 */

// 导出主要转换器类和函数
export { MarkdownToPdfConverter, convertMarkdownToPdf, convertMarkdownToHtml } from './converter.js';

// 导出渲染器
export { MarkdownLatexRenderer } from './renderer.js';

// 导出工具函数
export { escapeHtml, escapeRegExp, getOutputPath, fileExists } from './utils.js';

// 导出配置选项
export * from './config.js';

// 导出模板函数
export { generateHtmlDocument, getCssStyles, generateMathHtml } from './template.js';

// 导出CLI相关（可选）
export { createCLI, showTitle, runCLI } from './cli.js';
