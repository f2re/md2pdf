# Markdown LaTeX to PDF Converter

Convert Markdown files with LaTeX math formulas to beautiful PDFs.

## Features

- LaTeX math formulas (inline and block)
- Professional PDF formatting
- Code syntax highlighting
- **Font size customization (small, medium, large, xlarge or custom values)**
- **Chinese font support (宋体、黑体、楷体、仿宋、微软雅黑等)**
- **Font weight control (light, normal, medium, semibold, bold, black)**
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

# Combined options
node md2pdf.js input.md --font-size large --chinese-font yahei --font-weight semibold --margin 30mm

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
  }
});

await converter.close();
```

## Math Formula Support

- **Inline**: `$E = mc^2$` or `\(E = mc^2\)`
- **Block**: `$$E = mc^2$$` or `\[E = mc^2\]`