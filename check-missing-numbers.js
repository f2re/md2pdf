#!/usr/bin/env node

/**
 * Detects missing numbers in a folder when sorted by filename numbers.
 * Usage: node check-missing-numbers.js <folderPath> [options]
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';

/**
 * Extracts numbers from a filename.
 * @param {string} filename - The filename.
 * @returns {Array} An array of numbers.
 */
function extractNumbers(filename) {
  const numbers = filename.match(/\d+/g);
  return numbers ? numbers.map(num => parseInt(num, 10)) : [];
}

/**
 * Extracts the main number from a filename (usually the first or the largest).
 * @param {string} filename - The filename.
 * @returns {number|null} The main number.
 */
function extractMainNumber(filename) {
  const numbers = extractNumbers(filename);
  if (numbers.length === 0) return null;
  
  // Strategy 1: Use the first number
  // return numbers[0];
  
  // Strategy 2: Use the largest number (suitable for page numbers, etc.)
  return Math.max(...numbers);
}

/**
 * Checks for missing file numbers in a folder.
 * @param {string} folderPath - The path to the folder.
 * @param {Object} options - The options.
 * @returns {Object} The check result.
 */
async function checkMissingNumbers(folderPath, options = {}) {
  const {
    fileExtension = '',  // File extension filter, e.g., '.md', '.txt'
    recursive = false,   // Whether to search recursively
    strategy = 'max'     // Number extraction strategy: 'first' | 'max'
  } = options;

  try {
    const files = [];
    
    // Get the list of files
    async function scanDirectory(dirPath, currentDepth = 0) {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory() && recursive) {
          await scanDirectory(fullPath, currentDepth + 1);
        } else if (entry.isFile()) {
          // Filter by file extension
          if (fileExtension && !entry.name.toLowerCase().endsWith(fileExtension.toLowerCase())) {
            continue;
          }
          
          const relativePath = path.relative(folderPath, fullPath);
          files.push({
            name: entry.name,
            path: relativePath,
            fullPath: fullPath
          });
        }
      }
    }
    
    await scanDirectory(folderPath);
    
    // Extract files with numbers
    const filesWithNumbers = [];
    const filesWithoutNumbers = [];
    
    files.forEach(file => {
      const mainNumber = strategy === 'first' 
        ? extractNumbers(file.name)[0] || null
        : extractMainNumber(file.name);
      
      if (mainNumber !== null) {
        filesWithNumbers.push({
          ...file,
          number: mainNumber
        });
      } else {
        filesWithoutNumbers.push(file);
      }
    });
    
    // Sort by number
    filesWithNumbers.sort((a, b) => a.number - b.number);
    
    // Detect missing numbers
    const numbers = filesWithNumbers.map(f => f.number);
    const missingNumbers = [];
    
    if (numbers.length > 0) {
      const min = Math.min(...numbers);
      const max = Math.max(...numbers);
      
      for (let i = min; i <= max; i++) {
        if (!numbers.includes(i)) {
          missingNumbers.push(i);
        }
      }
    }
    
    // Detect duplicate numbers
    const duplicates = [];
    const numberCounts = {};
    
    numbers.forEach(num => {
      numberCounts[num] = (numberCounts[num] || 0) + 1;
    });
    
    Object.entries(numberCounts).forEach(([num, count]) => {
      if (count > 1) {
        const duplicateFiles = filesWithNumbers.filter(f => f.number === parseInt(num));
        duplicates.push({
          number: parseInt(num),
          count: count,
          files: duplicateFiles
        });
      }
    });
    
    return {
      totalFiles: files.length,
      filesWithNumbers: filesWithNumbers,
      filesWithoutNumbers: filesWithoutNumbers,
      missingNumbers: missingNumbers,
      duplicates: duplicates,
      numberRange: numbers.length > 0 ? { min: Math.min(...numbers), max: Math.max(...numbers) } : null
    };
    
  } catch (error) {
    throw new Error(`Unable to scan folder ${folderPath}: ${error.message}`);
  }
}

/**
 * Generates a detailed report.
 * @param {Object} result - The check result.
 * @param {Object} options - The options.
 */
function generateReport(result, options = {}) {
  const { folderPath, showDetails = false } = options;
  
  console.log(chalk.cyan('\n📋 File Number Check Report'));
  console.log(chalk.cyan('=================='));
  
  if (folderPath) {
    console.log(chalk.blue(`📁 Scan Path: ${folderPath}`));
  }
  
  console.log(chalk.blue(`📄 Total Files: ${result.totalFiles}`));
  console.log(chalk.green(`🔢 Files with Numbers: ${result.filesWithNumbers.length}`));
  console.log(chalk.gray(`📝 Files without Numbers: ${result.filesWithoutNumbers.length}`));
  
  if (result.numberRange) {
    console.log(chalk.blue(`📊 Number Range: ${result.numberRange.min} - ${result.numberRange.max}`));
  }
  
  // Missing numbers
  if (result.missingNumbers.length > 0) {
    console.log(chalk.red(`\n❌ Missing Numbers (${result.missingNumbers.length}):`));
    console.log(chalk.red('================='));
    
    // Group and display as continuous ranges
    const ranges = [];
    let start = result.missingNumbers[0];
    let end = start;
    
    for (let i = 1; i < result.missingNumbers.length; i++) {
      if (result.missingNumbers[i] === end + 1) {
        end = result.missingNumbers[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = result.missingNumbers[i];
        end = start;
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    
    console.log(chalk.yellow(`Missing numbers: ${ranges.join(', ')}`));
  } else if (result.filesWithNumbers.length > 0) {
    console.log(chalk.green('\n✅ No missing numbers'));
  }
  
  // Duplicate numbers
  if (result.duplicates.length > 0) {
    console.log(chalk.red(`\n⚠️ Duplicate Numbers (${result.duplicates.length}):`));
    console.log(chalk.red('================'));
    
    result.duplicates.forEach(dup => {
      console.log(chalk.yellow(`Number ${dup.number} (appeared ${dup.count} times):`));
      dup.files.forEach(file => {
        console.log(chalk.gray(`  - ${file.name}`));
      });
    });
  }
  
  // Files without numbers
  if (result.filesWithoutNumbers.length > 0 && showDetails) {
    console.log(chalk.gray(`\n📝 Files without Numbers (${result.filesWithoutNumbers.length}):`));
    console.log(chalk.gray('==============='));
    
    result.filesWithoutNumbers.forEach(file => {
      console.log(chalk.gray(`  - ${file.name}`));
    });
  }
  
  // Detailed file list
  if (showDetails && result.filesWithNumbers.length > 0) {
    console.log(chalk.blue(`\n📋 File List Sorted by Number:`));
    console.log(chalk.blue('===================='));
    
    result.filesWithNumbers.forEach(file => {
      console.log(chalk.white(`${String(file.number).padStart(4)}: ${file.name}`));
    });
  }
}

/**
 * Parses command-line arguments.
 */
function parseArguments() {
  const args = process.argv.slice(2);
  
  const config = {
    folderPath: null,
    fileExtension: '',
    recursive: false,
    strategy: 'max',
    showDetails: false,
    help: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      config.help = true;
    } else if (arg === '--recursive' || arg === '-r') {
      config.recursive = true;
    } else if (arg === '--details' || arg === '-d') {
      config.showDetails = true;
    } else if (arg === '--strategy=first') {
      config.strategy = 'first';
    } else if (arg === '--strategy=max') {
      config.strategy = 'max';
    } else if (arg.startsWith('--ext=')) {
      config.fileExtension = arg.split('=')[1];
    } else if (!arg.startsWith('-')) {
      if (!config.folderPath) {
        config.folderPath = arg;
      }
    }
  }
  
  return config;
}

/**
 * Displays help information.
 */
function showHelp() {
  console.log(chalk.cyan('File Number Missing Check Script'));
  console.log(chalk.cyan('=================='));
  console.log(chalk.blue('\nUsage:'));
  console.log(chalk.white('  node check-missing-numbers.js <folderPath> [options]'));
  
  console.log(chalk.blue('\nOptions:'));
  console.log(chalk.white('  --ext=<extension>     Only check files with the specified extension (e.g., --ext=.md)'));
  console.log(chalk.white('  --recursive, -r    Recursively search subdirectories'));
  console.log(chalk.white('  --details, -d      Show detailed information'));
  console.log(chalk.white('  --strategy=first   Use the first number in the filename'));
  console.log(chalk.white('  --strategy=max     Use the largest number in the filename (default)'));
  console.log(chalk.white('  --help, -h         Show help information'));
  
  console.log(chalk.blue('\nExamples:'));
  console.log(chalk.white('  node check-missing-numbers.js ./docs'));
  console.log(chalk.white('  node check-missing-numbers.js ./pages --ext=.md'));
  console.log(chalk.white('  node check-missing-numbers.js ./files -r -d'));
  console.log(chalk.white('  node check-missing-numbers.js ./chapters --strategy=first'));
  
  console.log(chalk.blue('\nDescription:'));
  console.log(chalk.white('  - The script extracts numbers from filenames and detects missing numbers.'));
  console.log(chalk.white('  - By default, it uses the largest number in the filename as the file number.'));
  console.log(chalk.white('  - Supports displaying continuous ranges (e.g., 5-8, 12, 15-17).'));
  console.log(chalk.white('  - Can detect duplicate numbers and files without numbers.'));
}

/**
 * Main function.
 */
async function main() {
  const config = parseArguments();
  
  if (config.help) {
    showHelp();
    return;
  }
  
  if (!config.folderPath) {
    console.error(chalk.red('❌ Please provide a folder path'));
    showHelp();
    process.exit(1);
  }
  
  try {
    console.log(chalk.cyan('🔍 Starting file number check...'));
    
    const result = await checkMissingNumbers(config.folderPath, {
      fileExtension: config.fileExtension,
      recursive: config.recursive,
      strategy: config.strategy
    });
    
    generateReport(result, {
      folderPath: config.folderPath,
      showDetails: config.showDetails
    });
    
    // Set exit code based on the result
    const hasIssues = result.missingNumbers.length > 0 || result.duplicates.length > 0;
    process.exit(hasIssues ? 1 : 0);
    
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
