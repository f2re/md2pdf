/**
 * Markdown LaTeX 渲染器模块
 */

import MarkdownIt from 'markdown-it';
import katex from 'katex';
import { escapeHtml, escapeRegExp } from './utils.js';
import { MATH_DELIMITERS, MARKDOWN_CONFIG, KATEX_CONFIG, FONT_SIZE_CONFIG, DEFAULT_FONT_SIZE, CHINESE_FONT_CONFIG, DEFAULT_CHINESE_FONT, FONT_WEIGHT_CONFIG, DEFAULT_FONT_WEIGHT, MATH_ENGINE, DEFAULT_MATH_ENGINE } from './config.js';
import { renderTeXToCHTML } from './mathjax.js';
import { generateHtmlDocument, generateMathHtml } from './template.js';

/**
 * Markdown LaTeX 渲染器类
 */
export class MarkdownLatexRenderer {
  constructor() {
    // 抑制KaTeX的控制台警告输出
    this.originalConsoleWarn = console.warn;
    this.suppressKatexWarnings();
    
    // 初始化 markdown-it
    this.md = new MarkdownIt(MARKDOWN_CONFIG);

    // 添加代码高亮支持
    this.md.set({
      highlight: function (str, lang) {
        if (lang && lang.trim()) {
          return `<pre class="hljs"><code class="language-${lang}">${escapeHtml(str)}</code></pre>`;
        }
        return `<pre class="hljs"><code>${escapeHtml(str)}</code></pre>`;
      }
    });
  }

  /**
   * 抑制KaTeX的控制台警告输出
   */
  suppressKatexWarnings() {
    console.warn = (...args) => {
      const message = args.join(' ');
      // 过滤掉KaTeX相关的警告信息
      if (message.includes('LaTeX-incompatible input') || 
          message.includes('unicodeTextInMathMode') ||
          message.includes('strict mode is set to') ||
          message.includes('Unicode text character')) {
        // 忽略这些警告
        return;
      }
      // 其他警告正常输出
      this.originalConsoleWarn.apply(console, args);
    };
  }

  /**
   * 恢复原始的console.warn
   */
  restoreConsoleWarn() {
    if (this.originalConsoleWarn) {
      console.warn = this.originalConsoleWarn;
    }
  }

  /**
   * 处理数学表达式
   * @param {string} content - 原始内容
   * @returns {Object} 处理后的内容和数学表达式数组
   */
  processMathExpressions(content) {
    const mathExpressions = [];
    let processedContent = content;

    // 处理块级数学表达式（必须先处理）
    for (const [startDelim, endDelim] of MATH_DELIMITERS.block) {
      const regex = new RegExp(
        escapeRegExp(startDelim) + '([\\s\\S]*?)' + escapeRegExp(endDelim),
        'g'
      );

      processedContent = processedContent.replace(regex, (match, mathContent) => {
        const placeholder = `<!--MATH_BLOCK_${mathExpressions.length}-->`;
        mathExpressions.push({
          type: 'block',
          content: mathContent.trim(),
          placeholder
        });
        return placeholder;
      });
    }

    // 处理行内数学表达式
    for (const [startDelim, endDelim] of MATH_DELIMITERS.inline) {
      let regex;
      
      if (startDelim === '$' && endDelim === '$') {
        // 特殊处理单美元符号
        // 支持多行内容，但区分行内和块级
        regex = /(?<!\$)\$(?!\$)([\s\S]*?)\$(?!\$)/g;
      } else {
        regex = new RegExp(
          escapeRegExp(startDelim) + '([\\s\\S]*?)' + escapeRegExp(endDelim),
          'g'
        );
      }

      processedContent = processedContent.replace(regex, (match, mathContent) => {
        // 检查是否包含换行符，如果是则作为块级处理
        const isBlock = mathContent.includes('\n');
        const type = isBlock ? 'block' : 'inline';
        const placeholder = isBlock ? 
          `<!--MATH_BLOCK_${mathExpressions.length}-->` : 
          `<!--MATH_INLINE_${mathExpressions.length}-->`;
        
        mathExpressions.push({
          type: type,
          content: mathContent.trim(),
          placeholder
        });
        return placeholder;
      });
    }

    return { processedContent, mathExpressions };
  }

  /**
   * 渲染数学公式
   * @param {string} content - 数学公式内容
   * @param {boolean} displayMode - 是否为块级显示模式
   * @returns {string} 渲染后的HTML
   */
  renderMath(content, displayMode = false, mathEngine = DEFAULT_MATH_ENGINE) {
    // 强制使用 MathJax：返回原始 TeX，以便后续由 MathJax 处理
    if (mathEngine === MATH_ENGINE.MATHJAX) {
      const { html } = renderTeXToCHTML(content, displayMode);
      return html;
    }

    // 默认/KaTeX：先尝试 KaTeX，失败则回退为原始 TeX
    try {
      return katex.renderToString(content, {
        ...KATEX_CONFIG,
        // 为了能捕获不支持的指令并回退到 MathJax，这里强制抛错
        throwOnError: true,
        displayMode,
        // 明确禁用严格模式警告，避免Unicode字符警告
        strict: false
      });
    } catch (error) {
      console.warn('KaTeX rendering error:', error?.message || error);
      // 回退到本地 MathJax 渲染（服务端）
      try {
        const { html } = renderTeXToCHTML(content, displayMode);
        return html;
      } catch (err2) {
        console.warn('MathJax fallback error:', err2?.message || err2);
        // 最终保底：保留原始 TeX 文本
        return displayMode ? `$$${content}$$` : `$${content}$`;
      }
    }
  }

  /**
   * 渲染 Markdown 内容为 HTML
   * @param {string} content - Markdown 内容
   * @param {Object} [styleOptions] - 样式选项
   * @returns {Promise<string>} 完整的 HTML 文档
   */
  async render(content, styleOptions = {}) {
    // 1. 处理数学表达式
    const { processedContent, mathExpressions } = this.processMathExpressions(content);

    // 2. 渲染 Markdown
    let html = this.md.render(processedContent);

    // 3. 还原数学表达式
    const engine = styleOptions.mathEngine || DEFAULT_MATH_ENGINE;
    for (const expr of mathExpressions) {
      const renderedMath = this.renderMath(expr.content, expr.type === 'block', engine);
      const mathHtml = generateMathHtml(renderedMath, expr.type === 'block');
      html = html.replace(expr.placeholder, mathHtml);
    }

    // 4. 处理字体大小设置
    const processedStyleOptions = this.processStyleOptions(styleOptions);

    // 5. 包装成完整的 HTML 文档
    return await generateHtmlDocument(html, 'Markdown LaTeX Preview', processedStyleOptions);
  }

  /**
   * 处理样式选项
   * @param {Object} styleOptions - 原始样式选项
   * @returns {Object} 处理后的样式选项
   */
  processStyleOptions(styleOptions) {
    const { fontSize = DEFAULT_FONT_SIZE, chineseFont = DEFAULT_CHINESE_FONT, fontWeight = DEFAULT_FONT_WEIGHT } = styleOptions;
    
    // 如果是预设大小，转换为具体像素值
    let actualFontSize = fontSize;
    if (FONT_SIZE_CONFIG[fontSize]) {
      actualFontSize = FONT_SIZE_CONFIG[fontSize];
    }

    // 如果是预设厚度，转换为具体数值
    let actualFontWeight = fontWeight;
    if (FONT_WEIGHT_CONFIG[fontWeight]) {
      actualFontWeight = FONT_WEIGHT_CONFIG[fontWeight];
    }
    
    return {
      ...styleOptions,
      fontSize: actualFontSize,
      chineseFont: chineseFont,
      fontWeight: actualFontWeight
    };
  }

  /**
   * 清理资源，恢复console.warn
   */
  cleanup() {
    this.restoreConsoleWarn();
  }
}
