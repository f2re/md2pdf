#!/usr/bin/env node

/**
 * KaTeX Checker GUI Server Startup Script
 */

import chalk from 'chalk';
import { startKatexCheckGUI } from './src/katex-gui.js';

const PORT = process.env.PORT || 3001;

console.log(chalk.cyan('📐 Starting LaTeX Formula Fixer Assistant server...'));
console.log(chalk.gray(`📍 Port: ${PORT}`));

try {
  const gui = await startKatexCheckGUI({ port: PORT });
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 Shutting down server...'));
    gui.stop();
    process.exit(0);
  });
  
} catch (error) {
  console.error(chalk.red('❌ Startup failed:'), error.message);
  process.exit(1);
}