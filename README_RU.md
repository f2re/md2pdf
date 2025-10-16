# Конвертер Markdown LaTeX в PDF

<!-- Improved README with badges and emojis -->
<div align="center">

![](https://img.shields.io/badge/Status-Active-success?style=for-the-badge&logo=github)
![](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge&logo=github)
![](https://img.shields.io/badge/Node.js-18%2B-success?style=for-the-badge&logo=node.js)
![](https://img.shields.io/badge/Python-3%2B-success?style=for-the-badge&logo=python)
![](https://img.shields.io/badge/KaTeX-Pre%20rendered-yellow?style=for-the-badge&logo=github)

</div>

> 📄 Конвертируйте Markdown файлы с LaTeX формулами в красивые PDF документы

## 🌟 Основные возможности

- 🔢 Формулы LaTeX (встроенные и блочные)
- 🧮 Локальный рендеринг KaTeX (шрифты встроены)
- 🔄 Автоматический переход на MathJax при ошибке KaTeX (или принудительно), полностью локальный (без CDN)
- 🤖 **Проверка и автокоррекция формул KaTeX с ИИ интеграцией**
- 🎨 Профессиональное форматирование PDF
- 💻 Подсветка синтаксиса кода
- 📏 **Настройка размера шрифта** (small, medium, large, xlarge или пользовательские значения)
- 🇨🇳 **Поддержка китайских шрифтов** (宋体、黑体、楷体、仿宋、微软雅黑 и др.)
- 💪 **Настройка насыщенности шрифта** (light, normal, medium, semibold, bold, black)
- 📐 **Настройка межстрочного интервала** (tight, normal, loose, relaxed или пользовательские значения)
- 📄 **Настройка интервала между абзацами** (tight, normal, loose, relaxed или пользовательские значения)
- 🧮 **Настройка интервала формул** (tight, normal, loose, relaxed или пользовательские значения)
- 🔄 **Пост-обработка: Добавление логотипов и изображений в PDF после генерации**
- 🏗️ Модульная архитектура
- 💻 CLI и программное использование

## 📦 Установка

```bash
npm install
```

## 🧪 Проверка формул KaTeX

Перед конвертацией Markdown в PDF вы можете проверить и автоматически исправить формулы LaTeX с помощью проверки KaTeX.

### Базовое использование

```bash
# Проверить один файл
node katex-check.js document.md

# Проверить несколько файлов
node katex-check.js file1.md file2.md file3.md

# Проверить директорию
node katex-check.js ./docs

# Комбинированный режим (директория + файлы)
node katex-check.js ./docs README.md CHANGELOG.md
```

### Расширенные опции

```bash
# Быстрая проверка (без детальной информации об ошибках)
node katex-check.js document.md --quick

# Детальная информация об ошибках
node katex-check.js document.md --detailed

# Авто-исправление с ИИ (требуется LMStudio)
node katex-check.js document.md --auto-fix

# Авто-исправление с авто-подтверждением
node katex-check.js document.md --auto-fix --auto-confirm

# Не рекурсивное сканирование директории
node katex-check.js ./docs --no-recursive

# Пользовательская параллельность
node katex-check.js ./docs --concurrency=8

# Комбинированные опции
# Авто-исправление с ИИ (требуется LMStudio или Ollama)
node katex-check.js ./docs README.md --detailed --auto-fix --concurrency=4
```

### Настройка ИИ автокоррекции

Функция автокоррекции поддерживает как LMStudio, так и Ollama:

#### Вариант 1: LMStudio
1. Установите и запустите [LMStudio](https://lmstudio.ai/)
2. Загрузите модель мышления (например, `qwen/qwen3-4b-thinking-2507`)
3. Запустите локальный сервер на `http://localhost:1234`

#### Вариант 2: Ollama (Рекомендуемый)
1. Установите [Ollama](https://ollama.ai/)
2. Загрузите модель: `ollama pull qwen2.5:7b`
3. Запустите сервис: `ollama serve` (работает на `http://localhost:11434`)

Система автоматически обнаружит доступных провайдеров и будет использовать лучший вариант. ИИ будет анализировать ошибки LaTeX и предлагать исправления, которые вы можете просмотреть и применить.

**Поддерживаемые модели:**
- Ollama: `qwen2.5:7b`, `llama3.1:8b`, `gemma2:9b` и др.
- LMStudio: `qwen/qwen3-4b-thinking-2507` и др.

## 💻 CLI использование

```bash
# Основная конвертация
node md2pdf.js input.md

# Пользовательский вывод
node md2pdf.js input.md output.pdf

# HTML вывод
node md2pdf.js input.md --format html

# Выбор движка для формул
node md2pdf.js input.md output.pdf --math-engine auto     # по умолчанию, сначала KaTeX, откат к MathJax
node md2pdf.js input.md output.pdf --math-engine katex    # принудительно KaTeX (оффлайн)
node md2pdf.js input.md output.pdf --math-engine mathjax  # принудительно MathJax (лучшая совместимость)

# MathJax рендерится локально на Node.js стороне; без CDN

# Пользовательские отступы
node md2pdf.js input.md --margin 25mm

# Альбомная ориентация
node md2pdf.js input.md --landscape

# Опции размера шрифта
node md2pdf.js input.md --font-size small    # 12px
node md2pdf.js input.md --font-size medium   # 14px (по умолчанию)
node md2pdf.js input.md --font-size large    # 16px
node md2pdf.js input.md --font-size xlarge   # 18px
node md2pdf.js input.md --font-size 20px     # Пользовательский размер

# Опции китайских шрифтов
node md2pdf.js input.md --chinese-font auto      # Автоматический выбор (по умолчанию)
node md2pdf.js input.md --chinese-font simsun    # 宋体 (SimSun)
node md2pdf.js input.md --chinese-font simhei    # 黑体 (SimHei)
node md2pdf.js input.md --chinese-font simkai    # 楷体 (KaiTi)
node md2pdf.js input.md --chinese-font fangsong  # 仿宋 (FangSong)
node md2pdf.js input.md --chinese-font yahei     # 微软雅黑 (Microsoft YaHei)

# Опции насыщенности шрифта
node md2pdf.js input.md --font-weight light      # Тонкий (300)
node md2pdf.js input.md --font-weight normal     # Нормальный (400, по умолчанию)
node md2pdf.js input.md --font-weight medium     # Средний (500)
node md2pdf.js input.md --font-weight semibold   # Полужирный (600)
node md2pdf.js input.md --font-weight bold       # Жирный (700)
node md2pdf.js input.md --font-weight black      # Черный (900)
node md2pdf.js input.md --font-weight 600        # Пользовательская насыщенность

# Опции межстрочного интервала
node md2pdf.js input.md --line-spacing tight     # Тесный интервал (1.2)
node md2pdf.js input.md --line-spacing normal    # Нормальный интервал (1.6, по умолчанию)
node md2pdf.js input.md --line-spacing loose     # Свободный интервал (2.0)
node md2pdf.js input.md --line-spacing relaxed   # Расслабленный интервал (2.4)
node md2pdf.js input.md --line-spacing 1.8       # Пользовательский интервал

# Опции интервала между абзацами
node md2pdf.js input.md --paragraph-spacing tight     # Тесный интервал (0.5em)
node md2pdf.js input.md --paragraph-spacing normal    # Нормальный интервал (1em, по умолчанию)
node md2pdf.js input.md --paragraph-spacing loose     # Свободный интервал (1.5em)
node md2pdf.js input.md --paragraph-spacing relaxed   # Расслабленный интервал (2em)
node md2pdf.js input.md --paragraph-spacing 1.2em     # Пользовательский интервал

# Опции интервала формул
node md2pdf.js input.md --math-spacing tight     # Тесный интервал (10px)
node md2pdf.js input.md --math-spacing normal    # Нормальный интервал (20px, по умолчанию)
node md2pdf.js input.md --math-spacing loose     # Свободный интервал (30px)
node md2pdf.js input.md --math-spacing relaxed   # Расслабленный интервал (40px)
node md2pdf.js input.md --math-spacing 25px      # Пользовательский интервал

# Комбинированные опции
node md2pdf.js input.md --font-size large --chinese-font yahei --font-weight semibold --line-spacing loose --paragraph-spacing relaxed --math-spacing loose --margin 30mm

# Рекомендуемая команда с оптимальными параметрами для профессиональной генерации PDF
node md2pdf.js document.md output.pdf \
  --margin 30mm \
  --font-size large \
  --line-spacing loose \
  --paragraph-spacing loose \
  --math-spacing loose \
  --font-weight medium

# Справка
node md2pdf.js --help
```

## 🧠 Программное использование

### Простая конвертация

```javascript
import { convertMarkdownToPdf, convertMarkdownToHtml } from './src/index.js';

// Конвертация в PDF
await convertMarkdownToPdf('input.md', 'output.pdf');

// Конвертация в HTML
await convertMarkdownToHtml('input.md', 'output.html');
```

### Расширенное использование

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

## 🔢 Поддержка формул

- **Встроенные**: `$E = mc^2$` или `\(E = mc^2\)`
- **Блочные**: `$$E = mc^2$$` или `\[E = mc^2\]`

### Проверка KaTeX
Перед конвертацией в PDF используйте проверку KaTeX для валидации формул:
- Обнаруживает синтаксические ошибки и неподдерживаемые команды
- Предоставляет детальные сообщения об ошибках с номерами строк
- Поддерживает автокоррекцию с ИИ интеграцией (LMStudio & Ollama)
- Обрабатывает одиночные файлы, несколько файлов или целые директории

### Поведение отката
- Когда KaTeX выдает ошибку из-за неподдерживаемых команд, используется MathJax (на стороне сервера) с встраиванием CHTML.
- Сеть не требуется; экспорт PDF ожидает небольшую задержку для стабилизации макета.

## 🔄 Пост-обработка: Добавление изображений в PDF

После генерации PDF можно добавить логотипы, баннеры и другие изображения с помощью Python скрипта `add_logo_to_pdf_advanced.py`. Для этого скрипта требуются Python 3 и PyMuPDF:

```bash
pip install pymupdf
```

### Базовое использование:
```bash
# Добавить логотип в правый нижний угол
python add_logo_to_pdf_advanced.py input.pdf output.pdf --corner logo.png --position bottom-right

# Добавить широкий баннер внизу
python add_logo_to_pdf_advanced.py input.pdf output.pdf --footer-banner banner.png --height 40

# Добавить чередующиеся логотипы на четных/нечетных страницах
python add_logo_to_pdf_advanced.py input.pdf output.pdf --alternating logo1.png logo2.png

# Комбинировать баннер и логотип
python add_logo_to_pdf_advanced.py input.pdf output.pdf --footer-banner banner.png --corner logo.png
```

### Опции:
- `--corner IMAGE`: Добавить логотип в угол каждой страницы
- `--position`: Позиция для углового логотипа (bottom-right, bottom-left, top-right, top-left)
- `--size`: Размер углового логотипа в точках (по умолчанию: 50)
- `--footer-banner IMAGE`: Добавить широкий баннер внизу каждой страницы
- `--banner-height`: Высота баннера в точках (по умолчанию: 30)
- `--alternating LEFT_IMG RIGHT_IMG`: Чередовать логотипы на нечетных/четных страницах
- `--alt-size`: Размер чередующихся логотипов (по умолчанию: 50)
- `--margin`: Отступ от края в точках (по умолчанию: 15)

## 📎 Обработка ссылок и файлов

Инструмент поддерживает все стандартные возможности Markdown, включая ссылки на внутренние документы. При ссылке на другие markdown файлы в вашем документе используйте относительные пути:

```markdown
Смотрите [Главу 1](./chapter1.md) для получения дополнительной информации.

Для продвинутых тем посмотрите [Главу 3](./chapter3.md).
```

Если у вас есть папка с связанными Markdown файлами, вы можете объединить их сначала с помощью:
```bash
node merge-md-to-pdf.js ./docs output.pdf
```

Эта команда:
- Найдет все `.md` файлы в папке `./docs`
- Отсортирует их в естественном порядке (правильно обработает числа)
- Объединит их в один документ
- Конвертирует объединенное содержимое в PDF

## 🏗️ Структура проекта

```
├── src/                         # Основные модули конвертации
│   ├── cli.js                  # Интерфейс командной строки
│   ├── converter.js            # Основная логика конвертации
│   ├── katex-assets.js         # Управление ресурсами KaTeX
│   └── ...
├── katex-check.js              # Проверка формул KaTeX
├── llm-fixer.js               # Модуль ИИ автокоррекции (LMStudio & Ollama)
├── test-ollama-integration.js  # Тест интеграции Ollama
├── md2pdf.js                  # Основная точка входа CLI
├── merge-md-to-pdf.js         # Инструмент объединения нескольких MD файлов в PDF
├── add_logo_to_pdf_advanced.py # Python скрипт для добавления изображений в PDF
├── OLLAMA_INTEGRATION_GUIDE.md # Руководство по установке и использованию Ollama
└── assets/katex/              # Локальные ресурсы KaTeX
```

## 🤝 Вклад в проект

Мы приветствуем ваш вклад в проект! Пожалуйста, ознакомьтесь с [CONTRIBUTING.md](./CONTRIBUTING.md) для получения дополнительной информации о том, как начать.

## 📜 Кодекс поведения

Для обеспечения позитивной среды мы придерживаемся [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## 📄 Лицензия

Этот проект лицензирован в соответствии с [MIT License](./LICENSE).

---

<div align="center">

[![](https://visitcount.itsvg.in/api?id=md2pdf&icon=0&color=0)](https://visitcount.itsvg.in)

</div>

<div align="center">

### 🌐 Языки документации
[English](./README.md) | [Русский](./README_RU.md)

</div>