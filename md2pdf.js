#!/usr/bin/env node

/**
 * Markdown LaTeX to PDF Converter - Main entry file
 * 
 * Function: Converts Markdown files containing LaTeX math formulas to PDF
 * Usage: node md2pdf.js <markdownFilePath> [outputPdfPath]
 */

import { runCLI } from './src/cli.js';

// Run the CLI application
runCLI();
