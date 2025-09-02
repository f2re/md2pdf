# Markdown LaTeX to PDF Converter

Convert Markdown files with LaTeX math formulas to beautiful PDFs.

## Features

- LaTeX math formulas (inline and block)
- KaTeX local rendering (fonts inlined)
- Auto fallback to MathJax when KaTeX fails (or force MathJax), fully local (no CDN)
- **KaTeX formula validation and auto-correction with LLM integration**
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

## KaTeX Formula Validation

Before converting your Markdown to PDF, you can validate and auto-correct LaTeX formulas using our KaTeX checker.

### Basic Usage

```bash
# Check a single file
node katex-check.js document.md

# Check multiple files
node katex-check.js file1.md file2.md file3.md

# Check a directory
node katex-check.js ./docs

# Mixed mode (directory + files)
node katex-check.js ./docs README.md CHANGELOG.md
```

### Advanced Options

```bash
# Quick check (no detailed error info)
node katex-check.js document.md --quick

# Detailed error information
node katex-check.js document.md --detailed

# Auto-fix with LLM (requires LMStudio)
node katex-check.js document.md --auto-fix

# Auto-fix with auto-confirmation
node katex-check.js document.md --auto-fix --auto-confirm

# Non-recursive directory scan
node katex-check.js ./docs --no-recursive

# Custom concurrency
node katex-check.js ./docs --concurrency=8

# Combined options
# Auto-fix with LLM (requires LMStudio or Ollama)
node katex-check.js ./docs README.md --detailed --auto-fix --concurrency=4
```

### LLM Auto-Correction Setup

The auto-correction feature supports both LMStudio and Ollama:

#### Option 1: LMStudio
1. Install and run [LMStudio](https://lmstudio.ai/)
2. Load a thinking model (e.g., `qwen/qwen3-4b-thinking-2507`)
3. Start the local server at `http://localhost:1234`

#### Option 2: Ollama (Recommended)
1. Install [Ollama](https://ollama.ai/)
2. Download a model: `ollama pull qwen2.5:7b`
3. Start the service: `ollama serve` (runs on `http://localhost:11434`)

The system will automatically detect available providers and use the best option. The LLM will analyze LaTeX errors and suggest corrections, which you can review and apply.

**Supported Models:**
- Ollama: `qwen2.5:7b`, `llama3.1:8b`, `gemma2:9b`, etc.
- LMStudio: `qwen/qwen3-4b-thinking-2507`, etc.
```

### LLM Auto-Correction Setup

The auto-correction feature requires LMStudio running locally:

1. Install and run [LMStudio](https://lmstudio.ai/)
2. Load a thinking model (e.g., `qwen/qwen3-4b-thinking-2507`)
3. Start the local server at `http://localhost:1234`
4. Use `--auto-fix` flag to enable auto-correction

The LLM will analyze LaTeX errors and suggest corrections, which you can review and apply.

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

### KaTeX Validation
Before converting to PDF, use the KaTeX checker to validate your formulas:
- Detects syntax errors and unsupported commands
- Provides detailed error messages with line numbers
- Supports auto-correction with LLM integration (LMStudio & Ollama)
- Handles single files, multiple files, or entire directories

### Fallback behavior
- When KaTeX throws on unsupported commands, we render with MathJax (server-side) and embed CHTML directly.
- No network required; PDF export only waits a small delay for layout stabilization.

## Project Structure

```
├── src/                         # Core conversion modules
│   ├── cli.js                  # Command-line interface
│   ├── converter.js            # Main conversion logic
│   ├── katex-assets.js         # KaTeX asset management
│   └── ...
├── katex-check.js              # KaTeX formula validator
├── llm-fixer.js               # LLM auto-correction module (LMStudio & Ollama)
├── test-ollama-integration.js  # Ollama integration test
├── md2pdf.js                  # Main CLI entry point
├── OLLAMA_INTEGRATION_GUIDE.md # Ollama setup and usage guide
└── assets/katex/              # Local KaTeX assets
```