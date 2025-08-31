/**
 * Markdown LaTeX 渲染器模块
 */

import MarkdownIt from 'markdown-it';
import katex from 'katex';
import { escapeHtml, escapeRegExp } from './utils.js';
import { MATH_DELIMITERS, MARKDOWN_CONFIG, KATEX_CONFIG } from './config.js';
import { generateHtmlDocument, generateMathHtml } from './template.js';

/**
 * Markdown LaTeX 渲染器类
 */
export class MarkdownLatexRenderer {
  constructor() {
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
        regex = /(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g;
      } else {
        regex = new RegExp(
          escapeRegExp(startDelim) + '([\\s\\S]*?)' + escapeRegExp(endDelim),
          'g'
        );
      }

      processedContent = processedContent.replace(regex, (match, mathContent) => {
        const placeholder = `<!--MATH_INLINE_${mathExpressions.length}-->`;
        mathExpressions.push({
          type: 'inline',
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
  renderMath(content, displayMode = false) {
    try {
      return katex.renderToString(content, {
        ...KATEX_CONFIG,
        displayMode
      });
    } catch (error) {
      console.warn('KaTeX rendering error:', error);
      return displayMode ? `$$${content}$$` : `$${content}$`;
    }
  }

  /**
   * 渲染 Markdown 内容为 HTML
   * @param {string} content - Markdown 内容
   * @returns {string} 完整的 HTML 文档
   */
  render(content) {
    // 1. 处理数学表达式
    const { processedContent, mathExpressions } = this.processMathExpressions(content);

    // 2. 渲染 Markdown
    let html = this.md.render(processedContent);

    // 3. 还原数学表达式
    for (const expr of mathExpressions) {
      const renderedMath = this.renderMath(expr.content, expr.type === 'block');
      const mathHtml = generateMathHtml(renderedMath, expr.type === 'block');
      html = html.replace(expr.placeholder, mathHtml);
    }

    // 4. 包装成完整的 HTML 文档
    return generateHtmlDocument(html);
  }
}
