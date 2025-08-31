# Markdown LaTeX to PDF Converter

Convert Markdown files with LaTeX math formulas to beautiful PDFs.

## Features

- LaTeX math formulas (inline and block)
- Professional PDF formatting
- Code syntax highlighting
- **Font size customization (small, medium, large, xlarge or custom values)**
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