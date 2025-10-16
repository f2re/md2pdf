#!/usr/bin/env node

/**
 * Merges Markdown files in a folder and converts them to PDF
 * Usage: node merge-md-to-pdf.js <folderPath> [outputFileName]
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { MarkdownToPdfConverter } from './src/converter.js';
import chalk from 'chalk';

/**
 * Natural sort comparison function, correctly handles the order of numbers
 * @param {string} a - The first filename
 * @param {string} b - The second filename
 * @returns {number} The sort result
 */
function naturalSort(a, b) {
  // Decompose filenames into numeric and non-numeric parts
  const regex = /(\d+|\D+)/g;
  const aParts = a.match(regex) || [];
  const bParts = b.match(regex) || [];
  
  const maxLength = Math.max(aParts.length, bParts.length);
  
  for (let i = 0; i < maxLength; i++) {
    const aPart = aParts[i] || '';
    const bPart = bParts[i] || '';
    
    // If both parts are numbers, compare them numerically
    if (/^\d+$/.test(aPart) && /^\d+$/.test(bPart)) {
      const numA = parseInt(aPart, 10);
      const numB = parseInt(bPart, 10);
      if (numA !== numB) {
        return numA - numB;
      }
    } else {
      // Compare as strings
      if (aPart !== bPart) {
        return aPart.localeCompare(bPart);
      }
    }
  }
  
  return 0;
}

/**
 * Gets all Markdown files in a folder and sorts them in natural order
 * @param {string} folderPath - The folder path
 * @returns {Promise<string[]>} An array of sorted Markdown file paths
 */
async function getMarkdownFiles(folderPath) {
  try {
    const files = await fs.readdir(folderPath);
    const markdownFiles = files
      .filter(file => /\.md$/i.test(file))
      .sort(naturalSort) // Use natural sort to handle numbers correctly
      .map(file => path.join(folderPath, file));
    
    return markdownFiles;
  } catch (error) {
    throw new Error(`Failed to read folder: ${error.message}`);
  }
}

/**
 * Reads and merges multiple Markdown files
 * @param {string[]} filePaths - An array of Markdown file paths
 * @returns {Promise<string>} The merged Markdown content
 */
async function mergeMarkdownFiles(filePaths) {
  const contents = [];
  
  for (const filePath of filePaths) {
    try {
      console.log(chalk.blue(`📖 Reading file: ${path.basename(filePath)}`));
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Add content directly, without any separators or filename identifiers
      contents.push(content.trim()); // Trim whitespace to keep content clean
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to read file ${filePath}: ${error.message}`));
    }
  }
  
  // Join content with double newlines to ensure proper spacing between paragraphs, but no page breaks
  return contents.join('\n\n');
}

/**
 * Writes the merged content to a temporary file
 * @param {string} content - The merged Markdown content
 * @param {string} tempPath - The temporary file path
 */
async function writeTempFile(content, tempPath) {
  await fs.writeFile(tempPath, content, 'utf-8');
  console.log(chalk.green(`📝 Temporary file created: ${tempPath}`));
}

/**
 * Cleans up the temporary file
 * @param {string} tempPath - The temporary file path
 */
async function cleanupTempFile(tempPath) {
  try {
    await fs.unlink(tempPath);
    console.log(chalk.gray(`🗑️  Temporary file deleted: ${tempPath}`));
  } catch (error) {
    console.warn(chalk.yellow(`⚠️  Failed to delete temporary file: ${error.message}`));
  }
}

/**
 * Displays help information
 */
function showHelp() {
  console.log(chalk.cyan.bold(`
┌──────────────────────────────────────────┐
│  📄 Markdown File Merge and Convert Tool   │
│  🔗 Merges all Markdown files in a folder │
│  📄 Converts to a single PDF document      │
└──────────────────────────────────────────┘
`));
  
  console.log(chalk.blue('Usage:'));
  console.log(chalk.white('  node merge-md-to-pdf.js <folderPath> [outputFileName]'));
  
  console.log(chalk.blue('\nArguments:'));
  console.log(chalk.white('  <folderPath>     Path to the folder containing Markdown files (required)'));
  console.log(chalk.white('  [outputFileName]   Output PDF filename (optional, default: merged-document.pdf)'));
  
  console.log(chalk.blue('\nOptions:'));
  console.log(chalk.white('  --help, -h       Show help information'));
  
  console.log(chalk.blue('\nExamples:'));
  console.log(chalk.white('  node merge-md-to-pdf.js ./docs'));
  console.log(chalk.white('  node merge-md-to-pdf.js ./docs combined.pdf'));
  console.log(chalk.white('  node merge-md-to-pdf.js "C:\\Documents\\MyProject" output.pdf'));
  
  console.log(chalk.blue('\nDefault Styles:'));
  console.log(chalk.white('  📏 Page Margin: 0mm (no margin)'));
  console.log(chalk.white('  🔤 Font Size: large'));
  console.log(chalk.white('  🇨🇳 Chinese Font: auto'));
  console.log(chalk.white('  💪 Font Weight: medium'));
  console.log(chalk.white('  📐 Line Spacing: normal'));
  console.log(chalk.white('  📄 Paragraph Spacing: normal'));
  console.log(chalk.white('  🧮 Math Spacing: tight'));
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Check for help argument
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    if (args.length === 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
  
  const folderPath = path.resolve(args[0]);
  const outputName = args[1] || 'merged-document.pdf';
  const outputPath = path.resolve(outputName);
  
  // Generate temporary Markdown file path
  const tempMarkdownPath = path.join(path.dirname(outputPath), 'temp-merged.md');
  
  try {
    console.log(chalk.cyan('🚀 Starting to merge Markdown files and convert to PDF...'));
    console.log(chalk.blue(`📁 Source folder: ${folderPath}`));
    console.log(chalk.blue(`📄 Output file: ${outputPath}`));
    
    // Check if the folder exists
    try {
      const stats = await fs.stat(folderPath);
      if (!stats.isDirectory()) {
        throw new Error('The specified path is not a folder');
      }
    } catch (error) {
      throw new Error(`Folder does not exist or is not accessible: ${error.message}`);
    }
    
    // 1. Get all Markdown files
    console.log(chalk.cyan('📋 Scanning for Markdown files...'));
    const markdownFiles = await getMarkdownFiles(folderPath);
    
    if (markdownFiles.length === 0) {
      throw new Error('No Markdown files (.md) found in the folder');
    }
    
    console.log(chalk.green(`✅ Found ${markdownFiles.length} Markdown files:`));
    markdownFiles.forEach((file, index) => {
      console.log(chalk.gray(`   ${index + 1}. ${path.basename(file)}`));
    });
    
    // 2. Merge Markdown files
    console.log(chalk.cyan('🔗 Merging Markdown files...'));
    const mergedContent = await mergeMarkdownFiles(markdownFiles);
    
    // 3. Write to temporary file
    await writeTempFile(mergedContent, tempMarkdownPath);
    
    // 4. Convert to PDF (using default style options from CLI)
    console.log(chalk.cyan('📄 Converting to PDF...'));
    const converter = new MarkdownToPdfConverter({
      reuseInstance: true,  // Enable instance reuse for better performance
      maxPages: 20          // Increase page limit to handle large documents
    });
    
    await converter.convert({
      input: tempMarkdownPath,
      output: outputPath,
      format: 'pdf',
      pdfOptions: {
        format: 'A4',
        margin: {
          top: '0mm',
          right: '0mm',
          bottom: '0mm',
          left: '0mm'
        },
        printBackground: true,
        preferCSSPageSize: true
      },
      styleOptions: {
        // Use default style options from CLI
        fontSize: 'large',           // Corresponds to CLI default --font-size large
        chineseFont: 'auto',         // Corresponds to CLI default --chinese-font auto
        fontWeight: 'medium',        // Corresponds to CLI default --font-weight medium
        lineSpacing: 'normal',       // Corresponds to CLI default --line-spacing normal
        paragraphSpacing: 'normal',  // Corresponds to CLI default --paragraph-spacing normal
        mathSpacing: 'tight',        // Corresponds to CLI default --math-spacing tight
        mathEngine: 'auto'           // Corresponds to CLI default --math-engine auto
      }
    });
    
    // Explicitly close the converter to release resources
    await converter.close();
    
    // 5. Clean up temporary file
    await cleanupTempFile(tempMarkdownPath);
    
    console.log(chalk.green('✅ PDF conversion complete!'));
    console.log(chalk.blue(`📄 Output file: ${outputPath}`));
    
  } catch (error) {
    console.error(chalk.red('❌ Conversion failed:'), error.message);
    
    // Clean up temporary file (if it exists)
    try {
      await fs.access(tempMarkdownPath);
      await cleanupTempFile(tempMarkdownPath);
    } catch {
      // Temporary file does not exist, ignore
    }
    
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error(chalk.red('❌ Uncaught error:'), error);
  process.exit(1);
});
