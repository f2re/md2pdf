/**
 * LLM 自动纠错模块
 * 负责调用 LMStudio API 修正 LaTeX 公式错误
 */

import readline from 'readline';
import chalk from 'chalk';
import katex from 'katex';
import * as fs from 'fs/promises';

/**
 * LMStudio API 配置
 */
export const LMSTUDIO_CONFIG = {
  baseUrl: 'http://localhost:1234',
  model: 'qwen/qwen3-4b-thinking-2507',
  systemPrompt: '根据输入的latex和katex解析报错,输出修正过后的latex公式,不要输出其他任何东西,只要修正后的公式'
};

/**
 * KaTeX 验证配置
 */
const KATEX_VALIDATION_CONFIG = {
  throwOnError: true,
  output: 'html',
  trust: false,
  strict: false
};

/**
 * 提取非思维链内容（去除 <think> 标签内的内容）
 * @param {string} content - 包含思维链的完整内容
 * @returns {string} 提取的最终答案
 */
function extractNonThinkingContent(content) {
  if (!content) return '';
  
  // 移除 <think>...</think> 标签及其内容
  let result = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
  
  // 移除可能的其他思维链标记
  result = result.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  
  // 清理多余的空白字符
  result = result.trim();
  
  // 如果结果为空，尝试查找最后一个思维链标签后的内容
  if (!result && content.includes('</think>')) {
    const lastThinkEnd = content.lastIndexOf('</think>');
    if (lastThinkEnd !== -1) {
      result = content.substring(lastThinkEnd + 8).trim(); // 8 是 '</think>' 的长度
    }
  }
  
  // 如果结果为空，尝试查找最后一个 thinking 标签后的内容
  if (!result && content.includes('</thinking>')) {
    const lastThinkingEnd = content.lastIndexOf('</thinking>');
    if (lastThinkingEnd !== -1) {
      result = content.substring(lastThinkingEnd + 11).trim(); // 11 是 '</thinking>' 的长度
    }
  }
  
  return result;
}

/**
 * 调用 LMStudio API 修正 LaTeX 公式
 * @param {string} formula - 错误的公式
 * @param {string} error - 错误信息
 * @returns {string|null} 修正后的公式或 null
 */
export async function callLMStudioAPI(formula, error) {
  try {
    const prompt = `原始公式: ${formula}\n错误信息: ${error}`;
    
    const response = await fetch(`${LMSTUDIO_CONFIG.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: LMSTUDIO_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: LMSTUDIO_CONFIG.systemPrompt
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 1
      })
    });

    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let correctedFormula = data.choices?.[0]?.message?.content?.trim();
    
    if (!correctedFormula) {
      throw new Error('API 返回为空');
    }
    
    // 提取非思维链内容（去除 <think> 标签内的内容）
    correctedFormula = extractNonThinkingContent(correctedFormula);
    
    if (!correctedFormula) {
      throw new Error('提取最终答案后内容为空');
    }
    
    return correctedFormula;
  } catch (error) {
    console.error(chalk.red(`   ❌ API 调用失败: ${error.message}`));
    return null;
  }
}

/**
 * 用户确认修正
 * @param {string} originalFormula - 原始公式
 * @param {string} correctedFormula - 修正后的公式
 * @param {string} error - 错误信息
 * @returns {boolean} 用户是否确认
 */
export async function confirmCorrection(originalFormula, correctedFormula, error) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log(chalk.cyan('\n📝 公式修正建议:'));
    console.log(chalk.yellow(`   原始公式: ${originalFormula}`));
    console.log(chalk.red(`   错误信息: ${error}`));
    console.log(chalk.green(`   修正建议: ${correctedFormula}`));
    
    rl.question(chalk.blue('   是否应用此修正? (y/N): '), (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * 验证修正后的公式
 * @param {string} formula - 公式内容
 * @param {boolean} isBlock - 是否为块级公式
 * @returns {boolean} 是否通过验证
 */
export function validateCorrectedFormula(formula, isBlock = false) {
  try {
    katex.renderToString(formula, {
      ...KATEX_VALIDATION_CONFIG,
      displayMode: isBlock
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 替换文件中的公式
 * @param {string} filePath - 文件路径
 * @param {string} originalFormula - 原始公式
 * @param {string} correctedFormula - 修正后的公式
 * @returns {boolean} 是否成功替换
 */
export async function replaceFormulaInFile(filePath, originalFormula, correctedFormula) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // 查找并替换公式
    const updatedContent = content.replace(originalFormula, correctedFormula);
    
    if (updatedContent === content) {
      console.log(chalk.yellow(`   ⚠️ 在文件中未找到完全匹配的公式`));
      return false;
    }
    
    await fs.writeFile(filePath, updatedContent, 'utf-8');
    console.log(chalk.green(`   ✅ 公式已成功替换`));
    return true;
  } catch (error) {
    console.log(chalk.red(`   ❌ 替换失败: ${error.message}`));
    return false;
  }
}

/**
 * 提取公式内容（去除分隔符）
 * @param {string} formula - 完整公式
 * @returns {string} 公式内容
 */
export function extractFormulaContent(formula) {
  let content = formula;
  
  // 去除分隔符
  if (content.startsWith('$$') && content.endsWith('$$')) {
    content = content.slice(2, -2).trim();
  } else if (content.startsWith('$') && content.endsWith('$')) {
    content = content.slice(1, -1).trim();
  } else if (content.startsWith('\\[') && content.endsWith('\\]')) {
    content = content.slice(2, -2).trim();
  } else if (content.startsWith('\\(') && content.endsWith('\\)')) {
    content = content.slice(2, -2).trim();
  }
  
  return content;
}

/**
 * 构建完整的修正公式（添加分隔符）
 * @param {string} originalFormula - 原始公式
 * @param {string} correctedContent - 修正后的内容
 * @returns {string} 完整的修正公式
 */
export function buildCorrectedFormula(originalFormula, correctedContent) {
  if (originalFormula.startsWith('$$')) {
    return `$$${correctedContent}$$`;
  } else if (originalFormula.startsWith('\\[')) {
    return `\\[${correctedContent}\\]`;
  } else if (originalFormula.startsWith('\\(')) {
    return `\\(${correctedContent}\\)`;
  } else {
    return `$${correctedContent}$`;
  }
}

/**
 * 处理单个公式错误的修正
 * @param {Object} error - 错误对象
 * @param {string} filePath - 文件路径
 * @param {Object} config - 配置对象
 * @returns {boolean} 是否成功修正
 */
export async function fixSingleFormulaError(error, filePath, config = {}) {
  const { autoConfirm = false } = config;
  
  console.log(chalk.cyan('   🔧 正在尝试自动修正...'));
  
  // 提取公式内容
  const formulaContent = error.content || extractFormulaContent(error.formula);
  
  // 调用 LMStudio API
  const correctedFormula = await callLMStudioAPI(formulaContent, error.error);
  
  if (!correctedFormula) {
    return false;
  }
  
  // 验证修正后的公式
  const isBlock = error.type === 'block' || 
    error.formula.includes('$$') || 
    error.formula.includes('\\[');
  const isValid = validateCorrectedFormula(correctedFormula, isBlock);
  
  if (!isValid) {
    console.log(chalk.red(`   ❌ 修正后的公式仍有错误，跳过`));
    return false;
  }
  
  console.log(chalk.green(`   ✅ 验证通过: ${correctedFormula}`));
  
  // 用户确认或自动确认
  let shouldApply = autoConfirm;
  
  if (!shouldApply) {
    const fullCorrectedFormula = buildCorrectedFormula(error.formula, correctedFormula);
    shouldApply = await confirmCorrection(error.formula, fullCorrectedFormula, error.error);
  }
  
  if (shouldApply) {
    // 构建完整的修正公式并替换
    const fullCorrectedFormula = buildCorrectedFormula(error.formula, correctedFormula);
    return await replaceFormulaInFile(filePath, error.formula, fullCorrectedFormula);
  } else {
    console.log(chalk.gray(`   ↩️ 跳过修正`));
    return false;
  }
}

/**
 * 处理详细模式的单个公式错误修正
 * @param {Object} error - 错误对象（详细模式格式）
 * @param {string} filePath - 文件路径
 * @param {Object} config - 配置对象
 * @returns {boolean} 是否成功修正
 */
export async function fixSingleDetailedFormulaError(error, filePath, config = {}) {
  const { autoConfirm = false } = config;
  
  const expr = error.expression;
  
  if (!expr.raw || expr.raw === 'FILE_READ_ERROR') {
    return false;
  }
  
  console.log(chalk.cyan('   🔧 正在尝试自动修正...'));
  
  // 提取公式内容
  let formulaContent = expr.content || '';
  if (!formulaContent && expr.raw) {
    formulaContent = extractFormulaContent(expr.raw);
  }
  
  // 调用 LMStudio API
  const correctedFormula = await callLMStudioAPI(formulaContent, error.error.message);
  
  if (!correctedFormula) {
    return false;
  }
  
  // 验证修正后的公式
  const isBlock = expr.type === 'block';
  const isValid = validateCorrectedFormula(correctedFormula, isBlock);
  
  if (!isValid) {
    console.log(chalk.red(`   ❌ 修正后的公式仍有错误，跳过`));
    return false;
  }
  
  console.log(chalk.green(`   ✅ 验证通过: ${correctedFormula}`));
  
  // 用户确认或自动确认
  let shouldApply = autoConfirm;
  
  if (!shouldApply) {
    const fullCorrectedFormula = buildCorrectedFormula(expr.raw, correctedFormula);
    shouldApply = await confirmCorrection(expr.raw, fullCorrectedFormula, error.error.message);
  }
  
  if (shouldApply) {
    // 构建完整的修正公式并替换
    const fullCorrectedFormula = buildCorrectedFormula(expr.raw, correctedFormula);
    return await replaceFormulaInFile(filePath, expr.raw, fullCorrectedFormula);
  } else {
    console.log(chalk.gray(`   ↩️ 跳过修正`));
    return false;
  }
}
