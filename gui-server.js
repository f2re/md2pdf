#!/usr/bin/env node

/**
 * GUI startup script
 */

import { startGUI } from './src/gui.js';
import chalk from 'chalk';

async function main() {
  console.log(chalk.cyan.bold(`
┌─────────────────────────────────────────┐
│  🌐 Markdown to PDF GUI Launcher        │
│  📄→📁 Visual Conversion | 🔍 Real-time Preview | 📚 History Management   │
└─────────────────────────────────────────┘
`));

  try {
    const port = process.env.PORT || 3000;
    await startGUI({ port });
    
    console.log(chalk.green('\n✨ GUI server started successfully!'));
    console.log(chalk.yellow(`🌍 Please visit in your browser: http://localhost:${port}`));
    console.log(chalk.gray('\nPress Ctrl+C to stop the server\n'));
    
    // Gracefully handle exit
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n👋 Shutting down server...'));
      process.exit(0);
    });

  } catch (error) {
    console.error(chalk.red('❌ Startup failed:'), error.message);
    process.exit(1);
  }
}

main();