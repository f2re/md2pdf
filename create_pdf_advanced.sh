#!/bin/bash

##############################################################################
#         Расширенное создание PDF с изображениями из Markdown              #
##############################################################################
#
# Автор: AI Assistant
# Описание: Конвертирует MD в PDF и добавляет баннеры/логотипы
# Требует: node (md2pdf), python3 (pymupdf)
#
##############################################################################

set -e

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Функция справки
show_help() {
    cat << EOF
${CYAN}════════════════════════════════════════════════════════════════${NC}
${PURPLE}   Расширенное создание PDF с изображениями из Markdown${NC}
${CYAN}════════════════════════════════════════════════════════════════${NC}

${YELLOW}ИСПОЛЬЗОВАНИЕ:${NC}
  ./create_pdf_advanced.sh <input.md> <output.pdf> [options]

${YELLOW}РЕЖИМЫ:${NC}
  ${GREEN}--footer-banner <file> [height]${NC}
      Широкий баннер внизу страницы
      height: высота в пунктах (по умолчанию: 40)

  ${GREEN}--alternating <left> <right> [size]${NC}
      Чередующиеся изображения:
      - Нечетные страницы: left в левом углу
      - Четные страницы: right в правом углу
      size: размер в пунктах (по умолчанию: 60)

  ${GREEN}--corner <file> <position> [size]${NC}
      Обычный логотип в углу
      position: bottom-right/bottom-left/top-right/top-left
      size: размер в пунктах (по умолчанию: 50)

${YELLOW}ПРИМЕРЫ:${NC}

  ${GREEN}# Баннер внизу${NC}
  ./create_pdf_advanced.sh doc.md output.pdf --footer-banner banner.png

  ${GREEN}# Чередующиеся логотипы${NC}
  ./create_pdf_advanced.sh doc.md output.pdf --alternating left.png right.png

  ${GREEN}# Баннер + чередующиеся логотипы${NC}
  ./create_pdf_advanced.sh doc.md output.pdf \
    --footer-banner banner.png 40 \
    --alternating left.png right.png 60

  ${GREEN}# Обычный логотип${NC}
  ./create_pdf_advanced.sh doc.md output.pdf --corner logo.png bottom-right

${YELLOW}НАСТРОЙКИ PDF:${NC}
  - Поля: 30mm
  - Шрифт: large (16px)
  - Межстрочный интервал: loose (2.0)
  - Отступы параграфов: 1.5em

${CYAN}════════════════════════════════════════════════════════════════${NC}
EOF
}

# Проверка аргументов
if [ $# -lt 2 ] || [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    show_help
    exit 0
fi

INPUT_MD="$1"
OUTPUT_PDF="$2"
shift 2

# Проверка файлов
if [ ! -f "$INPUT_MD" ]; then
    echo -e "${RED}❌ Ошибка: Файл не найден: $INPUT_MD${NC}"
    exit 1
fi

# Временный PDF
TEMP_PDF="/tmp/temp_md2pdf_$(date +%s)_$$.pdf"

# Опции для advanced скрипта
ADVANCED_OPTIONS=""

# Парсинг опций
while [ $# -gt 0 ]; do
    case "$1" in
        --footer-banner)
            BANNER_FILE="$2"
            BANNER_HEIGHT="${3:-40}"
            if [ ! -f "$BANNER_FILE" ]; then
                echo -e "${RED}❌ Баннер не найден: $BANNER_FILE${NC}"
                exit 1
            fi
            ADVANCED_OPTIONS="$ADVANCED_OPTIONS --footer-banner $BANNER_FILE --banner-height $BANNER_HEIGHT"
            shift 2
            if [[ "$1" =~ ^[0-9]+$ ]]; then
                shift
            fi
            ;;
        --alternating)
            LEFT_IMG="$2"
            RIGHT_IMG="$3"
            ALT_SIZE="${4:-60}"
            if [ ! -f "$LEFT_IMG" ]; then
                echo -e "${RED}❌ Изображение не найдено: $LEFT_IMG${NC}"
                exit 1
            fi
            if [ ! -f "$RIGHT_IMG" ]; then
                echo -e "${RED}❌ Изображение не найдено: $RIGHT_IMG${NC}"
                exit 1
            fi
            ADVANCED_OPTIONS="$ADVANCED_OPTIONS --alternating $LEFT_IMG $RIGHT_IMG --alt-size $ALT_SIZE"
            shift 3
            if [[ "$1" =~ ^[0-9]+$ ]]; then
                shift
            fi
            ;;
        --corner)
            CORNER_FILE="$2"
            CORNER_POS="${3:-bottom-right}"
            CORNER_SIZE="${4:-50}"
            if [ ! -f "$CORNER_FILE" ]; then
                echo -e "${RED}❌ Логотип не найден: $CORNER_FILE${NC}"
                exit 1
            fi
            ADVANCED_OPTIONS="$ADVANCED_OPTIONS --corner $CORNER_FILE --position $CORNER_POS --size $CORNER_SIZE"
            shift 2
            if [[ "$1" =~ ^(bottom-right|bottom-left|top-right|top-left)$ ]]; then
                shift
            fi
            if [[ "$1" =~ ^[0-9]+$ ]]; then
                shift
            fi
            ;;
        *)
            echo -e "${RED}❌ Неизвестная опция: $1${NC}"
            exit 1
            ;;
    esac
done

# Проверка: хотя бы одна опция
if [ -z "$ADVANCED_OPTIONS" ]; then
    echo -e "${RED}❌ Ошибка: Укажите хотя бы один режим${NC}"
    echo -e "Используйте: --footer-banner, --alternating или --corner"
    exit 1
fi

echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${PURPLE}        Создание PDF с изображениями${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📄 Входной файл:${NC} $INPUT_MD"
echo -e "${BLUE}📦 Выходной файл:${NC} $OUTPUT_PDF"
echo -e "${BLUE}🎨 Опции:${NC} $ADVANCED_OPTIONS"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo

echo -e "${YELLOW}📄 Шаг 1/2: Конвертация Markdown в PDF...${NC}"
node md2pdf.js "$INPUT_MD" "$TEMP_PDF" \
  --margin 30mm \
  --font-size large \
  --font-weight medium \
  --line-spacing loose \
  --paragraph-spacing 1.5em \
  --math-spacing loose \
  --math-engine auto

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Ошибка конвертации MD в PDF${NC}"
    exit 1
fi

echo
echo -e "${YELLOW}🖼️  Шаг 2/2: Добавление изображений...${NC}"
python3 add_logo_to_pdf_advanced.py "$TEMP_PDF" "$OUTPUT_PDF" $ADVANCED_OPTIONS

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Ошибка добавления изображений${NC}"
    rm -f "$TEMP_PDF"
    exit 1
fi

# Удалить временный
rm -f "$TEMP_PDF"

echo
echo -e "${GREEN}✅ Готово! PDF создан: $OUTPUT_PDF${NC}"
echo

# Размер файла
if [ -f "$OUTPUT_PDF" ]; then
    FILE_SIZE=$(du -h "$OUTPUT_PDF" | cut -f1)
    echo -e "${BLUE}📊 Размер файла: $FILE_SIZE${NC}"
fi

# Опционально открыть
if command -v xdg-open &> /dev/null; then
    read -p "Открыть PDF? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        xdg-open "$OUTPUT_PDF" &> /dev/null &
    fi
elif command -v open &> /dev/null; then
    read -p "Открыть PDF? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        open "$OUTPUT_PDF" &> /dev/null &
    fi
fi
