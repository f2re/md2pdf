#!/usr/bin/env node

/**
 * Unified KaTeX rendering error detection script
 * Supports quick mode and detailed mode
 * Usage: node katex-check.js <folderPath> [options]
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import katex from 'katex';
import chalk from 'chalk';
import { cpus } from 'os';
import { 
  fixSingleFormulaError, 
  fixSingleDetailedFormulaError 
} from './llm-fixer.js';

/**
 * Advanced syntax check - detects complex syntax that may cause PDF conversion to fail
 * @param {string} content - The content of the math formula
 * @returns {Array} An array of warning messages
 */
function advancedSyntaxCheck(content) {
  const warnings = [];
  
  // Check 1: Multi-line math environment in a single-line math environment
  // First find all single $ formulas (excluding $$), then check if they contain a gather environment
  const singleDollarMatches = content.match(/(?:^|[^$])\$([^$]+?)\$(?:[^$]|$)/g);
  if (singleDollarMatches) {
    singleDollarMatches.forEach(match => {
      if (/\\begin\{gather\*?\}.*?\\end\{gather\*?\}/s.test(match)) {
        warnings.push({
          type: 'environment_mismatch',
          message: 'Multi-line math environment (gather*) found in single-line math environment ($...$)',
          suggestion: 'Use $$...$$'
        });
      }
    });
  }
  
  // Check 2: aligned environment in a single-line math environment
  // First find all single $ formulas (excluding $$), then check if they contain an aligned environment
  if (singleDollarMatches) {
    singleDollarMatches.forEach(match => {
      if (/\\begin\{aligned\}.*?\\end\{aligned\}/s.test(match)) {
        warnings.push({
          type: 'environment_mismatch', 
          message: 'aligned environment found in single-line math environment ($...$)',
          suggestion: 'Use $$...$$'
        });
      }
    });
  }
  
  // Check 3: Inconsistent number of columns in array environment
  const arrayMatches = content.match(/\\begin\{array\}\{([^}]+)\}(.*?)\\end\{array\}/gs);
  if (arrayMatches) {
    arrayMatches.forEach(arrayMatch => {
      const colSpec = arrayMatch.match(/\\begin\{array\}\{([^}]+)\}/)[1];
      const expectedCols = colSpec.length;
      const rows = arrayMatch.split('\\\\').slice(0, -1); // Exclude the last empty element
      
      rows.forEach((row, index) => {
        const cells = row.split('&').length;
        if (cells !== expectedCols && cells > 1) {
          warnings.push({
            type: 'array_column_mismatch',
            message: `Array row ${index + 1} has ${cells} columns, but ${expectedCols} were defined`,
            suggestion: 'Check for consistency in the number of array columns'
          });
        }
      });
    });
  }
  
  // Check 4: Unsupported commands
  const unsupportedCommands = [
    '\\multicolumn',
    '\\multirow', 
    '\\cline',
    '\\hline',
    '\\centering',
    '\\raggedright',
    '\\raggedleft'
  ];
  
  unsupportedCommands.forEach(cmd => {
    if (content.includes(cmd)) {
      warnings.push({
        type: 'unsupported_command',
        message: `Used a potentially incompatible command: ${cmd}`,
        suggestion: 'Consider using a KaTeX-supported alternative'
      });
    }
  });
  
  // Check 5: Complex nested environments
  const complexNesting = /\\begin\{gather\*?\}.*?\\begin\{aligned\}.*?\\begin\{array\}/gs;
  if (complexNesting.test(content)) {
    warnings.push({
      type: 'complex_nesting',
      message: 'Detected complex nesting of math environments (gather* + aligned + array)',
      suggestion: 'Consider simplifying the math environment structure'
    });
  }
  
  return warnings;
}

/**
 * Math formula delimiter configuration
 */
const MATH_DELIMITERS = {
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
 * KaTeX configuration
 */
const KATEX_CONFIG = {
  throwOnError: true,
  output: 'html',
  trust: false,
  strict: false
};

/**
 * Escapes special characters in a regular expression
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Natural sort function - correctly handles the order of numbers
 * @param {string} a - The first file path
 * @param {string} b - The second file path
 * @returns {number} The sort result
 */
function naturalSort(a, b) {
  // Extract filenames for comparison
  const aName = path.basename(a);
  const bName = path.basename(b);
  
  // Split strings and number parts
  const aParts = aName.split(/(\d+)/);
  const bParts = bName.split(/(\d+)/);
  
  const maxLength = Math.max(aParts.length, bParts.length);
  
  for (let i = 0; i < maxLength; i++) {
    const aPart = aParts[i] || '';
    const bPart = bParts[i] || '';
    
    // If both parts are numbers, compare them numerically
    if (/^\d+$/.test(aPart) && /^\d+$/.test(bPart)) {
      const aNum = parseInt(aPart, 10);
      const bNum = parseInt(bPart, 10);
      if (aNum !== bNum) {
        return aNum - bNum;
      }
    } else {
      // Otherwise, compare them as strings
      if (aPart !== bPart) {
        return aPart.localeCompare(bPart);
      }
    }
  }
  
  return 0;
}

/**
 * Quickly extracts and checks math formulas (quick mode)
 * @param {string} content - The Markdown content
 * @returns {Array} An array of errors
 */
function quickCheckMath(content) {
  const errors = [];
  
  // Match all possible math formulas
  const patterns = [
    /\$\$([\s\S]*?)\$\$/g,         // Block-level formula $$...$$ (allows multiple lines)
    /\\\[([\s\S]*?)\\\]/g,         // Block-level formula \[...\] (allows multiple lines)
    /\$([^$\n]+?)\$/g,             // Inline formula $...$ (single line)
    /\\\(([^)]+?)\\\)/g            // Inline formula \(...\)
  ];
  
  patterns.forEach((pattern, patternIndex) => {
    let match;
    const isBlock = patternIndex < 2;
    
    while ((match = pattern.exec(content)) !== null) {
      const mathContent = match[1].trim();
      if (!mathContent) continue;
      
      // Basic KaTeX syntax check
      try {
        katex.renderToString(mathContent, {
          throwOnError: true,
          displayMode: isBlock,
          output: 'html',
          strict: false
        });
      } catch (error) {
        errors.push({
          formula: match[0],
          content: mathContent,
          error: error.message,
          position: match.index,
          type: isBlock ? 'block' : 'inline'
        });
        continue; // Skip advanced check on KaTeX error
      }
      
      // Advanced syntax check - detects issues that may cause PDF conversion to fail
      const warnings = advancedSyntaxCheck(match[0]);
      warnings.forEach(warning => {
        errors.push({
          formula: match[0],
          content: mathContent,
          error: `⚠️ ${warning.message}`,
          suggestion: warning.suggestion,
          position: match.index,
          type: isBlock ? 'block' : 'inline',
          severity: 'warning'
        });
      });
    }
  });
  
  return errors;
}

/**
 * Extracts math formulas in detail (detailed mode)
 * @param {string} content - The Markdown content
 * @returns {Array} An array of math formulas
 */
function extractMathExpressions(content) {
  const mathExpressions = [];
  let processedContent = content;

  // Process block-level math expressions
  for (const [startDelim, endDelim] of MATH_DELIMITERS.block) {
    const regex = new RegExp(
      escapeRegExp(startDelim) + '([\\s\\S]*?)' + escapeRegExp(endDelim),
      'g'
    );

    let match;
    while ((match = regex.exec(processedContent)) !== null) {
      mathExpressions.push({
        type: 'block',
        content: match[1].trim(),
        raw: match[0],
        start: match.index,
        end: match.index + match[0].length
      });
    }
  }

  // Process inline math expressions
  for (const [startDelim, endDelim] of MATH_DELIMITERS.inline) {
    const regex = new RegExp(
      escapeRegExp(startDelim) + '([^\\n]*?)' + escapeRegExp(endDelim),
      'g'
    );

    let match;
    while ((match = regex.exec(processedContent)) !== null) {
      // Avoid duplication with block-level formulas
      const isInsideBlock = mathExpressions.some(expr => 
        match.index >= expr.start && match.index < expr.end
      );
      
      if (!isInsideBlock && match[1].trim()) {
        mathExpressions.push({
          type: 'inline',
          content: match[1].trim(),
          raw: match[0],
          start: match.index,
          end: match.index + match[0].length
        });
      }
    }
  }

  return mathExpressions;
}

/**
 * Checks KaTeX rendering for a single math formula (detailed mode)
 * @param {Object} mathExpr - The math formula object
 * @returns {Object} The check result
 */
function checkMathExpression(mathExpr) {
  const result = {
    success: true,
    expression: mathExpr,
    error: null,
    warnings: []
  };
  
  // Basic KaTeX syntax check
  try {
    katex.renderToString(mathExpr.content, {
      ...KATEX_CONFIG,
      displayMode: mathExpr.type === 'block'
    });
  } catch (error) {
    result.success = false;
    result.error = {
      message: error.message,
      name: error.name
    };
    return result; // Return directly on KaTeX error, no advanced check
  }
  
  // Advanced syntax check - detects issues that may cause PDF conversion to fail
  const warnings = advancedSyntaxCheck(mathExpr.raw);
  if (warnings.length > 0) {
    result.warnings = warnings;
    // Even with warnings, it's still considered successful if the basic syntax is correct
    // But the warning messages will be displayed in the report
  }
  
  return result;
}

/**
 * Checks a single Markdown file (quick mode)
 * @param {string} filePath - The file path
 * @returns {Object} The check result
 */
async function quickCheckFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const errors = quickCheckMath(content);
    
    // Differentiate between real errors and warnings
    const realErrors = errors.filter(error => error.severity !== 'warning');
    const warnings = errors.filter(error => error.severity === 'warning');
    
    return {
      file: filePath,
      success: realErrors.length === 0, // Only real errors affect the success status
      errors: realErrors,
      warnings: warnings,
      mathCount: errors.length
    };
  } catch (error) {
    return {
      file: filePath,
      success: false,
      errors: [{ formula: 'FILE_ERROR', error: error.message }],
      warnings: [],
      mathCount: 0
    };
  }
}

/**
 * Checks a single Markdown file (detailed mode)
 * @param {string} filePath - The file path
 * @returns {Object} The check result
 */
async function detailedCheckFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const mathExpressions = extractMathExpressions(content);
    
    if (mathExpressions.length === 0) {
      return {
        file: filePath,
        mathCount: 0,
        errors: [],
        warnings: [],
        success: true
      };
    }

    const results = mathExpressions.map(checkMathExpression);
    const errors = results.filter(result => !result.success);
    const warnings = results.filter(result => result.success && result.warnings && result.warnings.length > 0)
                            .reduce((allWarnings, result) => allWarnings.concat(result.warnings), []);
    
    return {
      file: filePath,
      mathCount: mathExpressions.length,
      errors: errors,
      warnings: warnings,
      success: errors.length === 0
    };
  } catch (error) {
    return {
      file: filePath,
      mathCount: 0,
      errors: [{
        success: false,
        expression: { raw: 'FILE_READ_ERROR' },
        error: { message: error.message, name: 'FileReadError' }
      }],
      warnings: [],
      success: false
    };
  }
}

/**
 * Gets all Markdown files in a folder
 * @param {string} folderPath - The folder path
 * @param {boolean} recursive - Whether to search recursively
 * @returns {Array} An array of Markdown file paths
 */
async function getMarkdownFiles(folderPath, recursive = true) {
  const markdownFiles = [];
  
  async function scanDirectory(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory() && recursive) {
          await scanDirectory(fullPath);
        } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
          markdownFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Unable to read directory ${dirPath}: ${error.message}`));
    }
  }
  
  await scanDirectory(folderPath);
  
  // Use natural sort to ensure numbers are sorted correctly (1, 2, 3, ..., 10, 11 instead of 1, 10, 11, 2, 3)
  return markdownFiles.sort(naturalSort);
}

/**
 * Resolves input paths, supporting folders, single files, or multiple files
 * @param {string} primaryPath - The primary path (the first argument)
 * @param {Array} additionalPaths - An array of additional paths
 * @param {boolean} recursive - Whether to search recursively (only for folders)
 * @returns {Array} An array of Markdown file paths
 */
async function resolveInputPaths(primaryPath, additionalPaths = [], recursive = true) {
  const allPaths = [primaryPath, ...additionalPaths];
  const markdownFiles = [];
  
  for (const inputPath of allPaths) {
    const resolvedPath = path.resolve(inputPath);
    
    try {
      const stats = await fs.stat(resolvedPath);
      
      if (stats.isDirectory()) {
        // If it's a directory, scan for Markdown files in it
        const dirFiles = await getMarkdownFiles(resolvedPath, recursive);
        markdownFiles.push(...dirFiles);
        console.log(chalk.blue(`📁 Scanning directory: ${resolvedPath} (found ${dirFiles.length} files)`));
      } else if (stats.isFile()) {
        // If it's a file, check if it's a Markdown file
        if (/\.md$/i.test(path.basename(resolvedPath))) {
          markdownFiles.push(resolvedPath);
          console.log(chalk.blue(`📄 Adding file: ${resolvedPath}`));
        } else {
          console.warn(chalk.yellow(`⚠️ Skipping non-Markdown file: ${resolvedPath}`));
        }
      } else {
        console.warn(chalk.yellow(`⚠️ Skipping unknown type: ${resolvedPath}`));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Unable to access path ${resolvedPath}: ${error.message}`));
    }
  }
  
  // Deduplicate and sort
  const uniqueFiles = [...new Set(markdownFiles)];
  return uniqueFiles.sort(naturalSort);
}

/**
 * Processes files in batches (used in detailed mode)
 * @param {Array} files - An array of file paths
 * @param {number} concurrency - The number of concurrent processes
 * @param {Function} checkFunction - The check function
 * @returns {Array} An array of check results
 */
async function processFilesInBatches(files, concurrency, checkFunction) {
  const results = [];
  const batches = [];
  
  // Split files into batches
  for (let i = 0; i < files.length; i += concurrency) {
    batches.push(files.slice(i, i + concurrency));
  }
  
  console.log(chalk.blue(`📊 Processing ${files.length} files with ${concurrency} concurrency`));
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(chalk.gray(`Processing batch ${i + 1}/${batches.length} (${batch.length} files)`));
    
    // Process the current batch in parallel
    const batchPromises = batch.map(file => checkFunction(file));
    const batchResults = await Promise.all(batchPromises);
    
    results.push(...batchResults);
    
    // Show progress
    const processed = results.length;
    const percentage = Math.round((processed / files.length) * 100);
    console.log(chalk.green(`✅ Processed: ${processed}/${files.length} (${percentage}%)`));
  }
  
  return results;
}

/**
 * Generates a quick report
 * @param {Array} results - An array of check results
 * @param {Object} config - The configuration object
 */
async function generateQuickReport(results, config = {}) {
  const errorFiles = results.filter(r => !r.success);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + (r.warnings ? r.warnings.length : 0), 0);
  
  console.log(chalk.cyan('\n📋 Check Results'));
  console.log(chalk.cyan('============'));
  console.log(chalk.blue(`📁 Total Files: ${results.length}`));
  console.log(chalk.green(`✅ Normal Files: ${results.length - errorFiles.length}`));
  console.log(chalk.red(`❌ Error Files: ${errorFiles.length}`));
  console.log(chalk.red(`💥 Total Errors: ${totalErrors}`));
  
  if (totalWarnings > 0) {
    console.log(chalk.yellow(`⚠️ Syntax Warnings: ${totalWarnings}`));
  }
  
  // Show error details
  if (errorFiles.length > 0) {
    console.log(chalk.red('\n💥 Error Details:'));
    console.log(chalk.red('============'));
    
    // Sort error files by natural sort
    const sortedErrorFiles = errorFiles.sort((a, b) => naturalSort(a.file, b.file));
    
    let fixedCount = 0;
    
    for (let fileIndex = 0; fileIndex < sortedErrorFiles.length; fileIndex++) {
      const result = sortedErrorFiles[fileIndex];
      console.log(chalk.red(`\n${fileIndex + 1}. ${path.basename(result.file)}`));
      
      for (let errorIndex = 0; errorIndex < result.errors.length; errorIndex++) {
        const error = result.errors[errorIndex];
        
        if (error.formula === 'FILE_ERROR') {
          console.log(chalk.yellow(`   File error: ${error.error}`));
          continue;
        }
        
        console.log(chalk.yellow(`   Formula ${errorIndex + 1}: ${error.formula}`));
        console.log(chalk.red(`   Error: ${error.error}`));
        
        // If auto-fix is enabled
        if (config.autoFix) {
          const fixed = await fixSingleFormulaError(error, result.file, {
            autoConfirm: config.autoConfirm
          });
          if (fixed) {
            fixedCount++;
          }
        }
      }
    }
    
    if (config.autoFix && fixedCount > 0) {
      console.log(chalk.green(`\n🎉 Successfully fixed ${fixedCount} formula errors!`));
      console.log(chalk.yellow('💡 It is recommended to run the check again to confirm the fix'));
    }
  }
  
  // Show warning messages (if any)
  const warningFiles = results.filter(r => r.warnings && r.warnings.length > 0);
  if (warningFiles.length > 0) {
    console.log(chalk.yellow('\n⚠️ Syntax Warnings:'));
    console.log(chalk.yellow('============'));
    
    const sortedWarningFiles = warningFiles.sort((a, b) => naturalSort(a.file, b.file));
    
    for (let fileIndex = 0; fileIndex < sortedWarningFiles.length; fileIndex++) {
      const result = sortedWarningFiles[fileIndex];
      console.log(chalk.yellow(`\n${fileIndex + 1}. ${path.basename(result.file)}`));
      
      for (let warningIndex = 0; warningIndex < result.warnings.length; warningIndex++) {
        const warning = result.warnings[warningIndex];
        console.log(chalk.yellow(`   ⚠️ Warning ${warningIndex + 1}: ${warning.formula || 'Formula'}`));
        console.log(chalk.yellow(`   Problem: ${warning.error}`));
        if (warning.suggestion) {
          console.log(chalk.cyan(`   Suggestion: ${warning.suggestion}`));
        }
      }
    }
    
    console.log(chalk.yellow('\n💡 These warnings may cause PDF conversion to fail, it is recommended to fix them'));
  }
  
  // Summary
  if (errorFiles.length === 0 && totalWarnings === 0) {
    console.log(chalk.green('\n🎉 All KaTeX formulas in all files are normal!'));
    return true;
  } else if (errorFiles.length === 0) {
    console.log(chalk.yellow('\n✅ All KaTeX formulas are syntactically correct!'));
    console.log(chalk.yellow('⚠️ But some warnings that may affect PDF conversion were found'));
    return true; // Still return success when there are only warnings
  } else {
    return false; // There are real errors
  }
}

/**
 * Generates a detailed report
 * @param {Array} results - An array of check results
 * @param {Object} config - The configuration object
 */
async function generateDetailedReport(results, config = {}) {
  const totalFiles = results.length;
  const successFiles = results.filter(r => r.success).length;
  const errorFiles = results.filter(r => !r.success).length;
  const totalMathExpressions = results.reduce((sum, r) => sum + r.mathCount, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  
  console.log(chalk.cyan('\n📋 KaTeX Rendering Check Report'));
  console.log(chalk.cyan('========================'));
  
  // Overall statistics
  console.log(chalk.blue(`📁 Scanned Files: ${totalFiles}`));
  console.log(chalk.green(`✅ Successful Files: ${successFiles}`));
  console.log(chalk.red(`❌ Error Files: ${errorFiles}`));
  console.log(chalk.blue(`🧮 Total Math Formulas: ${totalMathExpressions}`));
  console.log(chalk.red(`💥 Total Rendering Errors: ${totalErrors}`));
  
  // Count warnings
  const warningFiles = results.filter(r => r.success && r.warnings && r.warnings.length > 0).length;
  const totalWarnings = results.reduce((sum, r) => sum + ((r.warnings && r.warnings.length) || 0), 0);
  
  if (totalWarnings > 0) {
    console.log(chalk.yellow(`⚠️ Total Syntax Warnings: ${totalWarnings}`));
  }
  
  if (errorFiles > 0) {
    console.log(chalk.red('\n💥 Detailed Error Information:'));
    console.log(chalk.red('=================='));
    
    // Sort error files by natural sort
    const sortedErrorFiles = results.filter(r => !r.success).sort((a, b) => naturalSort(a.file, b.file));
    
    let fixedCount = 0;
    
    for (let fileIndex = 0; fileIndex < sortedErrorFiles.length; fileIndex++) {
      const result = sortedErrorFiles[fileIndex];
      console.log(chalk.red(`\n${fileIndex + 1}. ${path.basename(result.file)}`));
      console.log(chalk.gray(`   Path: ${result.file}`));
      
      for (let errorIndex = 0; errorIndex < result.errors.length; errorIndex++) {
        const error = result.errors[errorIndex];
        const expr = error.expression;
        
        console.log(chalk.yellow(`   Error ${errorIndex + 1}:`));
        console.log(chalk.yellow(`   Type: ${expr.type || 'unknown'}`));
        console.log(chalk.yellow(`   Formula: ${expr.raw || expr.content || 'N/A'}`));
        console.log(chalk.red(`   Error: ${error.error.message}`));
        
        // If auto-fix is enabled
        if (config.autoFix && expr.raw && expr.raw !== 'FILE_READ_ERROR') {
          const fixed = await fixSingleDetailedFormulaError(error, result.file, {
            autoConfirm: config.autoConfirm
          });
          if (fixed) {
            fixedCount++;
          }
        }
      }
    }
    
    if (config.autoFix && fixedCount > 0) {
      console.log(chalk.green(`\n🎉 Successfully fixed ${fixedCount} formula errors!`));
      console.log(chalk.yellow('💡 It is recommended to run the check again to confirm the fix'));
    }
  }
  
  // Show warning messages
  if (warningFiles > 0) {
    console.log(chalk.yellow('\n⚠️ Syntax Warning Information:'));
    console.log(chalk.yellow('=================='));
    
    const sortedWarningFiles = results.filter(r => r.success && r.warnings && r.warnings.length > 0)
      .sort((a, b) => naturalSort(a.file, b.file));
    
    for (let fileIndex = 0; fileIndex < sortedWarningFiles.length; fileIndex++) {
      const result = sortedWarningFiles[fileIndex];
      console.log(chalk.yellow(`\n${fileIndex + 1}. ${path.basename(result.file)}`));
      console.log(chalk.gray(`   Path: ${result.file}`));
      
      for (let warningIndex = 0; warningIndex < result.warnings.length; warningIndex++) {
        const warning = result.warnings[warningIndex];
        console.log(chalk.yellow(`   Warning ${warningIndex + 1}:`));
        console.log(chalk.yellow(`   Type: ${warning.type}`));
        console.log(chalk.yellow(`   Problem: ${warning.message}`));
        console.log(chalk.cyan(`   Suggestion: ${warning.suggestion}`));
      }
    }
    
    console.log(chalk.yellow('\n💡 These warnings may cause PDF conversion to fail, it is recommended to fix them'));
  }
  
  // Success rate statistics
  const successRate = totalFiles > 0 ? Math.round((successFiles / totalFiles) * 100) : 100;
  console.log(chalk.cyan(`\n📊 Success Rate: ${successRate}%`));
  
  if (successRate === 100 && totalWarnings === 0) {
    console.log(chalk.green('🎉 All KaTeX formulas in all files can be rendered correctly!'));
    return true;
  } else if (successRate === 100) {
    console.log(chalk.yellow('✅ All KaTeX formulas are syntactically correct!'));
    console.log(chalk.yellow('⚠️ But some warnings that may affect PDF conversion were found'));
    return true; // Still return success when there are only warnings
  } else {
    console.log(chalk.yellow('⚠️ Rendering errors were found, please check the detailed information above'));
    return false;
  }
}

/**
 * Parses command-line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  
  const config = {
    folderPath: null,
    filePaths: [],
    quick: false,
    detailed: false,
    recursive: true,
    concurrency: cpus().length,
    help: false,
    autoFix: false,
    autoConfirm: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      config.help = true;
    } else if (arg === '--quick' || arg === '-q') {
      config.quick = true;
    } else if (arg === '--detailed' || arg === '-d') {
      config.detailed = true;
    } else if (arg === '--no-recursive') {
      config.recursive = false;
    } else if (arg === '--auto-fix' || arg === '-f') {
      config.autoFix = true;
    } else if (arg === '--auto-confirm' || arg === '-y') {
      config.autoConfirm = true;
    } else if (arg.startsWith('--concurrency=')) {
      config.concurrency = parseInt(arg.split('=')[1]) || cpus().length;
    } else if (!arg.startsWith('-')) {
      // If it's not an option, it's a file/directory path
      if (!config.folderPath) {
        config.folderPath = arg;
      } else {
        config.filePaths.push(arg);
      }
    }
  }
  
  // Use quick mode by default
  if (!config.quick && !config.detailed) {
    config.quick = true;
  }
  
  return config;
}

/**
 * Displays help information
 */
function showHelp() {
  console.log(chalk.cyan('KaTeX Rendering Error Detection Script - Unified Version'));
  console.log(chalk.cyan('================================'));
  console.log(chalk.blue('\nUsage:'));
  console.log(chalk.white('  node katex-check.js <path> [more paths...] [options]'));
  console.log(chalk.white(''));
  console.log(chalk.white('  <path> can be:'));
  console.log(chalk.white('    • A folder path (scans for .md files in it)'));
  console.log(chalk.white('    • A single .md file'));
  console.log(chalk.white('    • Multiple .md files (space-separated)'));
  
  console.log(chalk.blue('\nMode Options:'));
  console.log(chalk.white('  --quick, -q        Quick mode (default)'));
  console.log(chalk.white('  --detailed, -d     Detailed mode'));
  
  console.log(chalk.blue('\nAuto-fix Options:'));
  console.log(chalk.white('  --auto-fix, -f     Enable auto-fix feature'));
  console.log(chalk.white('  --auto-confirm, -y Automatically confirm all fixes (use with --auto-fix)'));
  
  console.log(chalk.blue('\nOther Options:'));
  console.log(chalk.white('  --no-recursive     Do not search subdirectories recursively (only for folders)'));
  console.log(chalk.white('  --concurrency=N    Set the number of concurrent processes (default: number of CPU cores)'));
  console.log(chalk.white('  --help, -h         Show help information'));
  
  console.log(chalk.blue('\nExamples:'));
  console.log(chalk.white('  node katex-check.js ./docs                            # Scan a folder'));
  console.log(chalk.white('  node katex-check.js README.md                         # Check a single file'));
  console.log(chalk.white('  node katex-check.js file1.md file2.md file3.md        # Check multiple files'));
  console.log(chalk.white('  node katex-check.js ./docs README.md                  # Mix: folder + file'));
  console.log(chalk.white('  node katex-check.js ./docs --detailed                 # Detailed mode'));
  console.log(chalk.white('  node katex-check.js ./docs -f                         # Quick mode + auto-fix'));
  console.log(chalk.white('  node katex-check.js file.md -f -y                     # File + auto-fix'));
  console.log(chalk.white('  node katex-check.js ./docs -d -f --concurrency=8      # Detailed mode + auto-fix'));
  
  console.log(chalk.blue('\nMode Description:'));
  console.log(chalk.white('  Quick mode: Extremely fast, concise report, suitable for daily use'));
  console.log(chalk.white('  Detailed mode: Complete analysis, detailed report, suitable for in-depth debugging'));
  console.log(chalk.white('  Auto-fix feature: Automatically fixes incorrect LaTeX formulas using the LMStudio API'));
}

/**
 * Main function
 */
async function main() {
  const config = parseArguments();
  
  if (config.help) {
    showHelp();
    return;
  }
  
  if (!config.folderPath) {
    console.error(chalk.red('❌ Please provide at least one file or folder path'));
    showHelp();
    process.exit(1);
  }
  
  try {
    const mode = config.quick ? 'Quick' : 'Detailed';
    console.log(chalk.cyan(`🚀 Starting KaTeX rendering check (${mode} mode)...`));
    if (config.autoFix) {
      console.log(chalk.magenta(`🔧 Auto-fix feature: Enabled ${config.autoConfirm ? '(auto-confirm)' : '(manual confirm)'}`));
    }
    
    // Resolve input paths
    console.log(chalk.cyan('\n📋 Resolving input paths...'));
    const markdownFiles = await resolveInputPaths(config.folderPath, config.filePaths, config.recursive);
    
    if (markdownFiles.length === 0) {
      console.log(chalk.yellow('⚠️ No Markdown files found'));
      return;
    }
    
    console.log(chalk.green(`\n✅ Found a total of ${markdownFiles.length} Markdown files`));
    
    if (config.detailed) {
      console.log(chalk.blue(`⚡ Concurrency: ${config.concurrency}`));
    }
    
    // Start checking
    console.log(chalk.cyan(`\n🔍 Starting KaTeX rendering check (${mode} mode)...`));
    const startTime = Date.now();
    
    let results;
    let hasNoErrors;
    
    if (config.quick) {
      // Quick mode
      results = await Promise.all(markdownFiles.map(quickCheckFile));
      hasNoErrors = await generateQuickReport(results, config);
    } else {
      // Detailed mode
      results = await processFilesInBatches(markdownFiles, config.concurrency, detailedCheckFile);
      hasNoErrors = await generateDetailedReport(results, config);
    }
    
    const endTime = Date.now();
    console.log(chalk.cyan(`\n⏱️ Total time: ${((endTime - startTime) / 1000).toFixed(2)}s`));
    
    // Set exit code based on the result
    process.exit(hasNoErrors ? 0 : 1);
    
  } catch (error) {
    console.error(chalk.red('❌ Check failed:'), error.message);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error(chalk.red('❌ Uncaught error:'), error);
  process.exit(1);
});
