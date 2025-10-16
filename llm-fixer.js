/**
 * LLM Auto-Correction Module
 * Responsible for calling LMStudio or Ollama API to correct LaTeX formula errors
 */

import readline from 'readline';
import chalk from 'chalk';
import katex from 'katex';
import * as fs from 'fs/promises';

/**
 * LMStudio API Configuration
 */
export const LMSTUDIO_CONFIG = {
  baseUrl: 'http://localhost:1234',
  model: 'qwen/qwen3-4b-thinking-2507',
  systemPrompt: 'Based on the input latex and katex parsing error, output the corrected latex formula. Do not output anything else, just the corrected formula.'
};

/**
 * Ollama API Configuration
 */
export const OLLAMA_CONFIG = {
  baseUrl: 'http://localhost:11434',
  model: 'qwen2.5:7b',
  systemPrompt: 'Based on the input latex and katex parsing error, output the corrected latex formula. Do not output anything else, just the corrected formula.'
};

/**
 * OpenAI Compatible API Configuration
 */
export const OPENAI_CONFIG = {
  baseUrl: 'https://api.openai.com',
  model: 'gpt-3.5-turbo',
  apiKey: process.env.OPENAI_API_KEY || '',
  systemPrompt: 'Based on the input latex and katex parsing error, output the corrected latex formula. Do not output anything else, just the corrected formula.'
};

/**
 * LLM Provider Types
 */
export const LLM_PROVIDERS = {
  LMSTUDIO: 'lmstudio',
  OLLAMA: 'ollama',
  OPENAI: 'openai'
};

/**
 * KaTeX Validation Configuration
 */
const KATEX_VALIDATION_CONFIG = {
  throwOnError: true,
  output: 'html',
  trust: false,
  strict: false
};

/**
 * Extracts non-chain-of-thought content (removes content within <think> tags)
 * @param {string} content - The full content including chain-of-thought
 * @returns {string} The extracted final answer
 */
function extractNonThinkingContent(content) {
  if (!content) return '';
  
  // Remove <think>...</think> tags and their content
  let result = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
  
  // Remove other possible chain-of-thought markers
  result = result.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  
  // Clean up extra whitespace
  result = result.trim();
  
  // If the result is empty, try to find the content after the last chain-of-thought tag
  if (!result && content.includes('</think>')) {
    const lastThinkEnd = content.lastIndexOf('</think>');
    if (lastThinkEnd !== -1) {
      result = content.substring(lastThinkEnd + 8).trim(); // 8 is the length of '</think>'
    }
  }
  
  // If the result is empty, try to find the content after the last thinking tag
  if (!result && content.includes('</thinking>')) {
    const lastThinkingEnd = content.lastIndexOf('</thinking>');
    if (lastThinkingEnd !== -1) {
      result = content.substring(lastThinkingEnd + 11).trim(); // 11 is the length of '</thinking>'
    }
  }
  
  return result;
}

/**
 * Calls the LMStudio API to correct a LaTeX formula
 * @param {string} formula - The incorrect formula
 * @param {string} error - The error message
 * @returns {string|null} The corrected formula or null
 */
export async function callLMStudioAPI(formula, error) {
  try {
    const prompt = `Original formula: ${formula}\nError message: ${error}`;
    
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
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let correctedFormula = data.choices?.[0]?.message?.content?.trim();
    
    if (!correctedFormula) {
      throw new Error('API returned empty');
    }
    
    // Extract non-chain-of-thought content (removes content within <think> tags)
    correctedFormula = extractNonThinkingContent(correctedFormula);
    
    if (!correctedFormula) {
      throw new Error('Content is empty after extracting the final answer');
    }
    
    return correctedFormula;
  } catch (error) {
    console.error(chalk.red(`   ❌ LMStudio API call failed: ${error.message}`));
    return null;
  }
}

/**
 * Calls the Ollama API to correct a LaTeX formula
 * @param {string} formula - The incorrect formula
 * @param {string} error - The error message
 * @returns {string|null} The corrected formula or null
 */
export async function callOllamaAPI(formula, error) {
  try {
    const prompt = `Original formula: ${formula}\nError message: ${error}`;
    
    const response = await fetch(`${OLLAMA_CONFIG.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: OLLAMA_CONFIG.systemPrompt
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let correctedFormula = data.message?.content?.trim();
    
    if (!correctedFormula) {
      throw new Error('API returned empty');
    }
    
    // Extract non-chain-of-thought content (removes content within <think> tags)
    correctedFormula = extractNonThinkingContent(correctedFormula);
    
    if (!correctedFormula) {
      throw new Error('Content is empty after extracting the final answer');
    }
    
    return correctedFormula;
  } catch (error) {
    console.error(chalk.red(`   ❌ Ollama API call failed: ${error.message}`));
    return null;
  }
}

/**
 * Calls an OpenAI compatible API to correct a LaTeX formula
 * @param {string} formula - The incorrect formula
 * @param {string} error - The error message
 * @returns {string|null} The corrected formula or null
 */
export async function callOpenAIAPI(formula, error) {
  try {
    if (!OPENAI_CONFIG.apiKey) {
      throw new Error('API Key not configured, please set the OPENAI_API_KEY environment variable');
    }

    const prompt = `Original formula: ${formula}\nError message: ${error}`;
    
    const response = await fetch(`${OPENAI_CONFIG.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_CONFIG.apiKey}`
      },
      body: JSON.stringify({
        model: OPENAI_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: OPENAI_CONFIG.systemPrompt
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
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let correctedFormula = data.choices?.[0]?.message?.content?.trim();
    
    if (!correctedFormula) {
      throw new Error('API returned empty');
    }
    
    // Extract non-chain-of-thought content (removes content within <think> tags)
    correctedFormula = extractNonThinkingContent(correctedFormula);
    
    if (!correctedFormula) {
      throw new Error('Content is empty after extracting the final answer');
    }
    
    return correctedFormula;
  } catch (error) {
    console.error(chalk.red(`   ❌ OpenAI API call failed: ${error.message}`));
    return null;
  }
}

/**
 * Unified LLM API call function
 * @param {string} formula - The incorrect formula
 * @param {string} error - The error message
 * @param {string} provider - The LLM provider ('lmstudio', 'ollama', or 'openai')
 * @returns {string|null} The corrected formula or null
 */
export async function callLLMAPI(formula, error, provider = LLM_PROVIDERS.LMSTUDIO) {
  switch (provider) {
    case LLM_PROVIDERS.OLLAMA:
      return await callOllamaAPI(formula, error);
    case LLM_PROVIDERS.OPENAI:
      return await callOpenAIAPI(formula, error);
    case LLM_PROVIDERS.LMSTUDIO:
    default:
      return await callLMStudioAPI(formula, error);
  }
}

/**
 * Confirms the correction with the user
 * @param {string} originalFormula - The original formula
 * @param {string} correctedFormula - The corrected formula
 * @param {string} error - The error message
 * @returns {boolean} Whether the user confirmed
 */
export async function confirmCorrection(originalFormula, correctedFormula, error) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log(chalk.cyan('\n📝 Formula Correction Suggestion:'));
    console.log(chalk.yellow(`   Original formula: ${originalFormula}`));
    console.log(chalk.red(`   Error message: ${error}`));
    console.log(chalk.green(`   Suggested correction: ${correctedFormula}`));
    
    rl.question(chalk.blue('   Apply this correction? (y/N): '), (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Validates the corrected formula
 * @param {string} formula - The formula content
 * @param {boolean} isBlock - Whether it is a block-level formula
 * @returns {boolean} Whether it passed validation
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
 * Replaces the formula in the file
 * @param {string} filePath - The file path
 * @param {string} originalFormula - The original formula
 * @param {string} correctedFormula - The corrected formula
 * @returns {boolean} Whether the replacement was successful
 */
export async function replaceFormulaInFile(filePath, originalFormula, correctedFormula) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Find and replace the formula
    const updatedContent = content.replace(originalFormula, correctedFormula);
    
    if (updatedContent === content) {
      console.log(chalk.yellow(`   ⚠️ No exact match for the formula found in the file`));
      return false;
    }
    
    await fs.writeFile(filePath, updatedContent, 'utf-8');
    console.log(chalk.green(`   ✅ Formula replaced successfully`));
    return true;
  } catch (error) {
    console.log(chalk.red(`   ❌ Replacement failed: ${error.message}`));
    return false;
  }
}

/**
 * Extracts the formula content (removes delimiters)
 * @param {string} formula - The full formula
 * @returns {string} The formula content
 */
export function extractFormulaContent(formula) {
  let content = formula;
  
  // Remove delimiters
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
 * Builds the full corrected formula (adds delimiters)
 * @param {string} originalFormula - The original formula
 * @param {string} correctedContent - The corrected content
 * @returns {string} The full corrected formula
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
 * Handles the correction of a single formula error
 * @param {Object} error - The error object
 * @param {string} filePath - The file path
 * @param {Object} config - The configuration object
 * @returns {boolean} Whether the correction was successful
 */
export async function fixSingleFormulaError(error, filePath, config = {}) {
  const { autoConfirm = false, provider = LLM_PROVIDERS.LMSTUDIO } = config;
  
  console.log(chalk.cyan('   🔧 Attempting to auto-correct...'));
  
  // Extract formula content
  const formulaContent = error.content || extractFormulaContent(error.formula);
  
  // Call LLM API
  const correctedFormula = await callLLMAPI(formulaContent, error.error, provider);
  
  if (!correctedFormula) {
    return false;
  }
  
  // Validate the corrected formula
  const isBlock = error.type === 'block' || 
    error.formula.includes('$$') || 
    error.formula.includes('\\[');
  const isValid = validateCorrectedFormula(correctedFormula, isBlock);
  
  if (!isValid) {
    console.log(chalk.red(`   ❌ The corrected formula still has errors, skipping`));
    return false;
  }
  
  console.log(chalk.green(`   ✅ Validation passed: ${correctedFormula}`));
  
  // User confirmation or auto-confirmation
  let shouldApply = autoConfirm;
  
  if (!shouldApply) {
    const fullCorrectedFormula = buildCorrectedFormula(error.formula, correctedFormula);
    shouldApply = await confirmCorrection(error.formula, fullCorrectedFormula, error.error);
  }
  
  if (shouldApply) {
    // Build the full corrected formula and replace
    const fullCorrectedFormula = buildCorrectedFormula(error.formula, correctedFormula);
    return await replaceFormulaInFile(filePath, error.formula, fullCorrectedFormula);
  } else {
    console.log(chalk.gray(`   ↩️ Skipping correction`));
    return false;
  }
}

/**
 * Handles the correction of a single formula error in detailed mode
 * @param {Object} error - The error object (detailed mode format)
 * @param {string} filePath - The file path
 * @param {Object} config - The configuration object
 * @returns {boolean} Whether the correction was successful
 */
export async function fixSingleDetailedFormulaError(error, filePath, config = {}) {
  const { autoConfirm = false, provider = LLM_PROVIDERS.LMSTUDIO } = config;
  
  const expr = error.expression;
  
  if (!expr.raw || expr.raw === 'FILE_READ_ERROR') {
    return false;
  }
  
  console.log(chalk.cyan('   🔧 Attempting to auto-correct...'));
  
  // Extract formula content
  let formulaContent = expr.content || '';
  if (!formulaContent && expr.raw) {
    formulaContent = extractFormulaContent(expr.raw);
  }
  
  // Call LLM API
  const correctedFormula = await callLLMAPI(formulaContent, error.error.message, provider);
  
  if (!correctedFormula) {
    return false;
  }
  
  // Validate the corrected formula
  const isBlock = expr.type === 'block';
  const isValid = validateCorrectedFormula(correctedFormula, isBlock);
  
  if (!isValid) {
    console.log(chalk.red(`   ❌ The corrected formula still has errors, skipping`));
    return false;
  }
  
  console.log(chalk.green(`   ✅ Validation passed: ${correctedFormula}`));
  
  // User confirmation or auto-confirmation
  let shouldApply = autoConfirm;
  
  if (!shouldApply) {
    const fullCorrectedFormula = buildCorrectedFormula(expr.raw, correctedFormula);
    shouldApply = await confirmCorrection(expr.raw, fullCorrectedFormula, error.error.message);
  }
  
  if (shouldApply) {
    // Build the full corrected formula and replace
    const fullCorrectedFormula = buildCorrectedFormula(expr.raw, correctedFormula);
    return await replaceFormulaInFile(filePath, expr.raw, fullCorrectedFormula);
  } else {
    console.log(chalk.gray(`   ↩️ Skipping correction`));
    return false;
  }
}

/**
 * Checks the availability of an LLM provider
 * @param {string} provider - The LLM provider
 * @returns {boolean} Whether it is available
 */
export async function checkLLMProviderAvailability(provider) {
  try {
    let url, headers = {};
    
    switch (provider) {
      case LLM_PROVIDERS.OLLAMA:
        url = `${OLLAMA_CONFIG.baseUrl}/api/tags`;
        break;
      case LLM_PROVIDERS.OPENAI:
        url = `${OPENAI_CONFIG.baseUrl}/v1/models`;
        if (OPENAI_CONFIG.apiKey) {
          headers['Authorization'] = `Bearer ${OPENAI_CONFIG.apiKey}`;
        } else {
          console.log(chalk.yellow(`   ⚠️ OpenAI API Key not configured`));
          return false;
        }
        break;
      case LLM_PROVIDERS.LMSTUDIO:
      default:
        url = `${LMSTUDIO_CONFIG.baseUrl}/v1/models`;
        break;
    }
    
    const response = await fetch(url, { 
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(5000) // 5-second timeout
    });
    
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Automatically selects an available LLM provider
 * @param {string} preferredProvider - The preferred provider
 * @returns {string} The available provider
 */
export async function selectAvailableLLMProvider(preferredProvider = LLM_PROVIDERS.LMSTUDIO) {
  // First check the preferred provider
  if (await checkLLMProviderAvailability(preferredProvider)) {
    console.log(chalk.green(`   ✅ Using ${preferredProvider.toUpperCase()} provider`));
    return preferredProvider;
  }
  
  // If the preferred provider is not available, try other providers
  const providers = Object.values(LLM_PROVIDERS);
  for (const provider of providers) {
    if (provider !== preferredProvider && await checkLLMProviderAvailability(provider)) {
      console.log(chalk.yellow(`   ⚠️ ${preferredProvider.toUpperCase()} is not available, switching to ${provider.toUpperCase()}`));
      return provider;
    }
  }
  
  console.log(chalk.red(`   ❌ All LLM providers are unavailable`));
  return null;
}

/**
 * Sets the OpenAI compatible API configuration
 * @param {Object} config - The configuration object
 * @param {string} config.baseUrl - The API base URL
 * @param {string} config.model - The model name
 * @param {string} config.apiKey - The API Key
 * @param {string} config.systemPrompt - The system prompt
 */
export function setOpenAIConfig(config) {
  if (config.baseUrl !== undefined) {
    OPENAI_CONFIG.baseUrl = config.baseUrl;
  }
  if (config.model !== undefined) {
    OPENAI_CONFIG.model = config.model;
  }
  if (config.apiKey !== undefined) {
    OPENAI_CONFIG.apiKey = config.apiKey;
  }
  if (config.systemPrompt !== undefined) {
    OPENAI_CONFIG.systemPrompt = config.systemPrompt;
  }
}

/**
 * Gets the current OpenAI configuration
 * @returns {Object} The current configuration
 */
export function getOpenAIConfig() {
  return {
    baseUrl: OPENAI_CONFIG.baseUrl,
    model: OPENAI_CONFIG.model,
    apiKey: OPENAI_CONFIG.apiKey ? '***' + OPENAI_CONFIG.apiKey.slice(-4) : '',
    systemPrompt: OPENAI_CONFIG.systemPrompt
  };
}

/**
 * Gets a configuration overview of all LLM providers
 * @returns {Object} The configuration overview
 */
export function getAllLLMConfigs() {
  return {
    lmstudio: {
      baseUrl: LMSTUDIO_CONFIG.baseUrl,
      model: LMSTUDIO_CONFIG.model
    },
    ollama: {
      baseUrl: OLLAMA_CONFIG.baseUrl,
      model: OLLAMA_CONFIG.model
    },
    openai: {
      baseUrl: OPENAI_CONFIG.baseUrl,
      model: OPENAI_CONFIG.model,
      hasApiKey: !!OPENAI_CONFIG.apiKey
    }
  };
}
