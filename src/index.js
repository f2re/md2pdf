/**
 * Module entry file - exports all public APIs
 */

// Export main converter class and functions
export { MarkdownToPdfConverter, convertMarkdownToPdf, convertMarkdownToHtml, convertMarkdownBatch } from './converter.js';

// Export renderer
export { MarkdownLatexRenderer } from './renderer.js';

// Export utility functions
export { escapeHtml, escapeRegExp, getOutputPath, fileExists } from './utils.js';

// Export configuration options
export * from './config.js';

// Export template functions
export { generateHtmlDocument, getCssStyles, generateMathHtml } from './template.js';

// Export CLI related (optional)
export { createCLI, showTitle, runCLI } from './cli.js';
