#!/usr/bin/env node

/**
 * KaTeX检查器GUI服务器启动脚本
 */

import chalk from 'chalk';
import { startKatexCheckGUI } from './src/katex-gui.js';

const PORT = process.env.PORT || 3001;

console.log(chalk.cyan('📐 启动 LaTeX公式修复助手 服务器...'));
console.log(chalk.gray(`📍 端口: ${PORT}`));

try {
  const gui = await startKatexCheckGUI({ port: PORT });
  
  // 优雅关闭
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 正在关闭服务器...'));
    gui.stop();
    process.exit(0);
  });
  
} catch (error) {
  console.error(chalk.red('❌ 启动失败:'), error.message);
  process.exit(1);
}