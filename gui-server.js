#!/usr/bin/env node

/**
 * GUI启动脚本
 */

import { startGUI } from './src/gui.js';
import chalk from 'chalk';

async function main() {
  console.log(chalk.cyan.bold(`
┌─────────────────────────────────────────┐
│  🌐 Markdown PDF 可视化界面启动器        │
│  📄→📁 直观转换 | 🔍 实时预览 | 📚 历史管理   │
└─────────────────────────────────────────┘
`));

  try {
    const port = process.env.PORT || 3000;
    await startGUI({ port });
    
    console.log(chalk.green('\n✨ GUI服务器启动成功!'));
    console.log(chalk.yellow(`🌍 请在浏览器中访问: http://localhost:${port}`));
    console.log(chalk.gray('\n按 Ctrl+C 停止服务器\n'));
    
    // 优雅地处理退出
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n👋 正在关闭服务器...'));
      process.exit(0);
    });

  } catch (error) {
    console.error(chalk.red('❌ 启动失败:'), error.message);
    process.exit(1);
  }
}

main();