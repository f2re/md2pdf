# Markdown LaTeX to PDF Converter

Convert Markdown files with LaTeX math formulas to beautiful PDFs.

## Features

- LaTeX math formulas (inline and block)
- KaTeX local rendering (fonts inlined)
- Auto fallback to MathJax when KaTeX fails (or force MathJax), fully local (no CDN)
- Professional PDF formatting
- Code syntax highlighting
- **Font size customization (small, medium, large, xlarge or custom values)**
- **Chinese font support (宋体、黑体、楷体、仿宋、微软雅黑等)**
- **Font weight control (light, normal, medium, semibold, bold, black)**
- **Line spacing control (tight, normal, loose, relaxed or custom values)**
- **Paragraph spacing control (tight, normal, loose, relaxed or custom values)**
- **Math formula spacing control (tight, normal, loose, relaxed or custom values)**
- Modular architecture
- CLI and programmatic usage

## Installation

```bash
npm install
```

## CLI Usage

```bash
# Basic conversion
node md2pdf.js input.md

# Custom output
node md2pdf.js input.md output.pdf

# HTML output
node md2pdf.js input.md --format html

# Choose math engine
node md2pdf.js input.md output.pdf --math-engine auto     # default, KaTeX first, fallback to MathJax
node md2pdf.js input.md output.pdf --math-engine katex    # force KaTeX (offline)
node md2pdf.js input.md output.pdf --math-engine mathjax  # force MathJax (higher compatibility)

# MathJax is rendered locally on Node side; no CDN needed

# Custom margins
node md2pdf.js input.md --margin 25mm

# Landscape orientation
node md2pdf.js input.md --landscape

# Font size options
node md2pdf.js input.md --font-size small    # 12px
node md2pdf.js input.md --font-size medium   # 14px (default)
node md2pdf.js input.md --font-size large    # 16px
node md2pdf.js input.md --font-size xlarge   # 18px
node md2pdf.js input.md --font-size 20px     # Custom size

# Chinese font options
node md2pdf.js input.md --chinese-font auto      # Auto selection (default)
node md2pdf.js input.md --chinese-font simsun    # 宋体 (SimSun)
node md2pdf.js input.md --chinese-font simhei    # 黑体 (SimHei)
node md2pdf.js input.md --chinese-font simkai    # 楷体 (KaiTi)
node md2pdf.js input.md --chinese-font fangsong  # 仿宋 (FangSong)
node md2pdf.js input.md --chinese-font yahei     # 微软雅黑 (Microsoft YaHei)

# Font weight options
node md2pdf.js input.md --font-weight light      # 细体 (300)
node md2pdf.js input.md --font-weight normal     # 正常 (400, default)
node md2pdf.js input.md --font-weight medium     # 中等 (500)
node md2pdf.js input.md --font-weight semibold   # 半粗体 (600)
node md2pdf.js input.md --font-weight bold       # 粗体 (700)
node md2pdf.js input.md --font-weight black      # 超粗体 (900)
node md2pdf.js input.md --font-weight 600        # Custom weight

# Line spacing options
node md2pdf.js input.md --line-spacing tight     # 紧密行间距 (1.2)
node md2pdf.js input.md --line-spacing normal    # 正常行间距 (1.6, default)
node md2pdf.js input.md --line-spacing loose     # 宽松行间距 (2.0)
node md2pdf.js input.md --line-spacing relaxed   # 极宽松行间距 (2.4)
node md2pdf.js input.md --line-spacing 1.8       # Custom line height

# Paragraph spacing options
node md2pdf.js input.md --paragraph-spacing tight     # 紧密段落间距 (0.5em)
node md2pdf.js input.md --paragraph-spacing normal    # 正常段落间距 (1em, default)
node md2pdf.js input.md --paragraph-spacing loose     # 宽松段落间距 (1.5em)
node md2pdf.js input.md --paragraph-spacing relaxed   # 极宽松段落间距 (2em)
node md2pdf.js input.md --paragraph-spacing 1.2em     # Custom spacing

# Math formula spacing options
node md2pdf.js input.md --math-spacing tight     # 紧密公式间距 (10px)
node md2pdf.js input.md --math-spacing normal    # 正常公式间距 (20px, default)
node md2pdf.js input.md --math-spacing loose     # 宽松公式间距 (30px)
node md2pdf.js input.md --math-spacing relaxed   # 极宽松公式间距 (40px)
node md2pdf.js input.md --math-spacing 25px      # Custom spacing

# Combined options
node md2pdf.js input.md --font-size large --chinese-font yahei --font-weight semibold --line-spacing loose --paragraph-spacing relaxed --math-spacing loose --margin 30mm

# Help
node md2pdf.js --help
```

## Programmatic Usage

### Simple conversion

```javascript
import { convertMarkdownToPdf, convertMarkdownToHtml } from './src/index.js';

// Convert to PDF
await convertMarkdownToPdf('input.md', 'output.pdf');

// Convert to HTML
await convertMarkdownToHtml('input.md', 'output.html');
```

### Advanced usage

```javascript
import { MarkdownToPdfConverter } from './src/index.js';

const converter = new MarkdownToPdfConverter();

await converter.convert({
  input: 'input.md',
  output: 'output.pdf',
  format: 'pdf',
  pdfOptions: {
    format: 'A4',
    margin: { top: '25mm', bottom: '25mm' },
    landscape: false
  },
  styleOptions: {
    fontSize: '16px',
    chineseFont: 'yahei',
    fontWeight: 'medium',
    lineSpacing: 'loose',
    paragraphSpacing: '1.5em',
  mathSpacing: '25px',
  mathEngine: 'auto'
  }
});

await converter.close();
```

## Math Formula Support

- **Inline**: `$E = mc^2$` or `\(E = mc^2\)`
- **Block**: `$$E = mc^2$$` or `\[E = mc^2\]`

### Fallback behavior
- When KaTeX throws on unsupported commands, we render with MathJax (server-side) and embed CHTML directly.
- No network required; PDF export only waits a small delay for layout stabilization.