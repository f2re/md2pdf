/**
 * HTML模板生成模块
 */

/**
 * 生成完整的HTML文档
 * @param {string} content - HTML内容
 * @param {string} title - 文档标题
 * @returns {string} 完整的HTML文档
 */
export function generateHtmlDocument(content, title = 'Markdown LaTeX Preview') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>

    <!-- KaTeX CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">

    <style>
        ${getCssStyles()}
    </style>
</head>
<body>
    ${content}
</body>
</html>`;
}

/**
 * 获取CSS样式
 * @returns {string} CSS样式字符串
 */
export function getCssStyles() {
  return `
        /* 基础样式 */
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
            background-color: #fff;
        }

        /* 数学公式样式 */
        .math-block {
            margin: 20px 0;
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
            margin: 20px 0;
        }

        /* 标题样式 */
        h1, h2, h3, h4, h5, h6 {
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
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
                font-size: 12pt;
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
