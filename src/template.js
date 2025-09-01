/**
 * HTML模板生成模块
 */

import { CHINESE_FONT_CONFIG, FONT_WEIGHT_CONFIG, LINE_SPACING_CONFIG, PARAGRAPH_SPACING_CONFIG, MATH_SPACING_CONFIG } from './config.js';

/**
 * 生成完整的HTML文档
 * @param {string} content - HTML内容
 * @param {string} title - 文档标题
 * @param {Object} options - 生成选项
 * @param {string} options.fontSize - 字体大小
 * @returns {string} 完整的HTML文档
 */
export function generateHtmlDocument(content, title = 'Markdown LaTeX Preview', options = {}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>

    <!-- KaTeX CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">

    <style>
        ${getCssStyles(options)}
    </style>
</head>
<body>
    ${content}
</body>
</html>`;
}

/**
 * 获取CSS样式
 * @param {Object} options - 样式选项
 * @param {string} options.fontSize - 字体大小
 * @param {string} options.chineseFont - 中文字体
 * @param {string} options.fontWeight - 文字厚度
 * @param {string} options.lineSpacing - 行间距
 * @param {string} options.paragraphSpacing - 段落间距
 * @param {string} options.mathSpacing - 数学公式间距
 * @returns {string} CSS样式字符串
 */
export function getCssStyles(options = {}) {
  const { 
    fontSize = '14px', 
    chineseFont = 'auto', 
    fontWeight = 'normal',
    lineSpacing = 'normal',
    paragraphSpacing = 'normal',
    mathSpacing = 'normal'
  } = options;
  
  /**
   * 将 px 转换为 pt (用于打印样式)
   * @param {string} pxValue - px值，如 '14px'
   * @returns {string} pt值，如 '10.5pt'
   */
  function convertPxToPt(pxValue) {
    // 提取数字部分
    const pxNumber = parseFloat(pxValue.replace('px', ''));
    // 1px = 0.75pt (标准转换)
    const ptNumber = pxNumber * 0.75;
    return `${ptNumber}pt`;
  }

  /**
   * 获取字体族设置
   * @param {string} chineseFontType - 中文字体类型
   * @returns {string} 字体族CSS值
   */
  function getFontFamily(chineseFontType) {
    return CHINESE_FONT_CONFIG[chineseFontType] || CHINESE_FONT_CONFIG.auto;
  }

  /**
   * 获取字体厚度设置
   * @param {string} fontWeightType - 文字厚度类型
   * @returns {string} 字体厚度CSS值
   */
  function getFontWeight(fontWeightType) {
    return FONT_WEIGHT_CONFIG[fontWeightType] || fontWeightType;
  }

  /**
   * 获取行间距设置
   * @param {string} lineSpacingType - 行间距类型
   * @returns {string} 行间距CSS值
   */
  function getLineSpacing(lineSpacingType) {
    return LINE_SPACING_CONFIG[lineSpacingType] || lineSpacingType;
  }

  /**
   * 获取段落间距设置
   * @param {string} paragraphSpacingType - 段落间距类型
   * @returns {string} 段落间距CSS值
   */
  function getParagraphSpacing(paragraphSpacingType) {
    return PARAGRAPH_SPACING_CONFIG[paragraphSpacingType] || paragraphSpacingType;
  }

  /**
   * 获取数学公式间距设置
   * @param {string} mathSpacingType - 数学公式间距类型
   * @returns {string} 数学公式间距CSS值
   */
  function getMathSpacing(mathSpacingType) {
    return MATH_SPACING_CONFIG[mathSpacingType] || mathSpacingType;
  }
  
  return `
        /* 基础样式 */
        body {
            font-family: ${getFontFamily(chineseFont)};
            font-weight: ${getFontWeight(fontWeight)};
            line-height: ${getLineSpacing(lineSpacing)};
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
            background-color: #fff;
            font-size: ${fontSize};
        }

        /* 段落间距 */
        p {
            margin-top: 0;
            margin-bottom: ${getParagraphSpacing(paragraphSpacing)};
        }

        /* 列表项间距 */
        li {
            margin-bottom: calc(${getParagraphSpacing(paragraphSpacing)} * 0.5);
        }

        /* 数学公式样式 */
        .math-block {
            margin: ${getMathSpacing(mathSpacing)} 0;
            text-align: center;
            overflow-x: auto;
        }

        .math-inline {
            display: inline;
        }

        /* 代码样式 */
        pre {
            background-color: #f6f8fa;
            border: 1px solid #e1e4e8;
            border-radius: 6px;
            padding: 16px;
            overflow-x: auto;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 14px;
            line-height: 1.45;
        }

        code {
            background-color: rgba(175, 184, 193, 0.2);
            border-radius: 6px;
            padding: 2px 4px;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 85%;
        }

        pre code {
            background-color: transparent;
            border-radius: 0;
            padding: 0;
            font-size: 100%;
        }

        /* 表格样式 */
        table {
            border-collapse: collapse;
            margin: 25px 0;
            font-size: 0.9em;
            min-width: 400px;
            border-radius: 5px 5px 0 0;
            overflow: hidden;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.15);
        }

        table thead tr {
            background-color: #009879;
            color: #ffffff;
            text-align: left;
        }

        table th,
        table td {
            padding: 12px 15px;
            border: 1px solid #dddddd;
        }

        table tbody tr {
            border-bottom: 1px solid #dddddd;
        }

        table tbody tr:nth-of-type(even) {
            background-color: #f3f3f3;
        }

        /* 引用样式 */
        blockquote {
            border-left: 4px solid #dfe2e5;
            padding: 0 16px;
            color: #6a737d;
            background-color: #f6f8fa;
            margin: ${getParagraphSpacing(paragraphSpacing)} 0;
            line-height: ${getLineSpacing(lineSpacing)};
        }

        /* 标题样式 */
        h1, h2, h3, h4, h5, h6 {
            margin-top: calc(${getParagraphSpacing(paragraphSpacing)} * 1.5);
            margin-bottom: ${getParagraphSpacing(paragraphSpacing)};
            font-weight: 600;
            line-height: ${getLineSpacing(lineSpacing)};
        }

        h1 {
            font-size: 2em;
            border-bottom: 1px solid #eaecef;
            padding-bottom: 0.3em;
        }

        h2 {
            font-size: 1.5em;
            border-bottom: 1px solid #eaecef;
            padding-bottom: 0.3em;
        }

        /* 链接样式 */
        a {
            color: #0366d6;
            text-decoration: none;
        }

        a:hover {
            text-decoration: underline;
        }

        /* 打印样式 */
        @media print {
            body {
                max-width: none;
                margin: 0;
                padding: 15mm;
                font-size: ${convertPxToPt(fontSize)};
            }

            .math-block {
                page-break-inside: avoid;
            }

            pre {
                page-break-inside: avoid;
                white-space: pre-wrap;
            }

            table {
                page-break-inside: avoid;
            }

            h1, h2, h3, h4, h5, h6 {
                page-break-after: avoid;
            }
        }
`;
}

/**
 * 生成数学公式容器HTML
 * @param {string} renderedMath - 渲染后的数学公式
 * @param {boolean} isBlock - 是否为块级公式
 * @returns {string} 数学公式HTML
 */
export function generateMathHtml(renderedMath, isBlock = false) {
  if (isBlock) {
    return `<div class="math-block">${renderedMath}</div>`;
  } else {
    return `<span class="math-inline">${renderedMath}</span>`;
  }
}
