
# 🎨 Расширенное добавление изображений в PDF

## 🆕 Новые возможности

### 1. 📏 Широкий баннер внизу страницы
Растягивает изображение на всю ширину страницы внизу (как footer)

### 2. 🔄 Чередующиеся изображения
Разные изображения на четных и нечетных страницах:
- **Нечетные** (1, 3, 5, ...) → левое изображение в **левом нижнем** углу
- **Четные** (2, 4, 6, ...) → правое изображение в **правом нижнем** углу

### 3. 🎯 Комбинация режимов
Можно совмещать баннер с логотипами

---

## 📦 Установка

```bash
pip install pymupdf
```

---

## 🚀 Команды

### 1️⃣ Широкий баннер внизу страницы

```bash
# Базовое использование (высота 30pt)
python add_logo_to_pdf_advanced.py input.pdf output.pdf \
  --footer-banner banner.png

# С настройкой высоты (40pt ~ 14mm)
python add_logo_to_pdf_advanced.py input.pdf output.pdf \
  --footer-banner banner.png \
  --banner-height 40

# Высокий баннер (60pt ~ 21mm)
python add_logo_to_pdf_advanced.py input.pdf output.pdf \
  --footer-banner banner.png \
  --banner-height 60
```

**Результат:** Изображение растянуто на всю ширину страницы внизу

---

### 2️⃣ Чередующиеся изображения (Odd/Even)

```bash
# Базовое чередование
python add_logo_to_pdf_advanced.py input.pdf output.pdf \
  --alternating logo_left.png logo_right.png

# С настройкой размера (70pt)
python add_logo_to_pdf_advanced.py input.pdf output.pdf \
  --alternating logo_left.png logo_right.png \
  --alt-size 70

# С настройкой отступа
python add_logo_to_pdf_advanced.py input.pdf output.pdf \
  --alternating logo_left.png logo_right.png \
  --alt-size 60 \
  --margin 20
```

**Как работает:**
```
Страница 1 (нечетная) → logo_left.png в левом нижнем углу
Страница 2 (четная)   → logo_right.png в правом нижнем углу
Страница 3 (нечетная) → logo_left.png в левом нижнем углу
Страница 4 (четная)   → logo_right.png в правом нижнем углу
...
```

---

### 3️⃣ Стандартный логотип в углу (как раньше)

```bash
# Правый нижний угол (по умолчанию)
python add_logo_to_pdf_advanced.py input.pdf output.pdf \
  --corner logo.png

# Левый нижний угол
python add_logo_to_pdf_advanced.py input.pdf output.pdf \
  --corner logo.png \
  --position bottom-left

# С размером и отступом
python add_logo_to_pdf_advanced.py input.pdf output.pdf \
  --corner logo.png \
  --position bottom-right \
  --size 70 \
  --margin 20
```

---

### 4️⃣ Комбинированные режимы

#### Баннер + обычный логотип

```bash
python add_logo_to_pdf_advanced.py input.pdf output.pdf \
  --footer-banner banner.png \
  --corner logo.png \
  --position top-right
```

#### Баннер + чередующиеся логотипы

```bash
python add_logo_to_pdf_advanced.py input.pdf output.pdf \
  --footer-banner banner.png \
  --banner-height 40 \
  --alternating logo_left.png logo_right.png \
  --alt-size 60
```

---

## 📊 Таблица параметров

### Общие параметры

| Параметр | Описание | По умолчанию |
|----------|----------|--------------|
| `--margin` | Отступ от края (пунктов) | 15 |

### Угловой логотип

| Параметр | Описание | По умолчанию |
|----------|----------|--------------|
| `--corner` | Путь к изображению | - |
| `--position` | bottom-right/bottom-left/top-right/top-left | bottom-right |
| `--size` | Размер логотипа (пунктов) | 50 |

### Баннер внизу

| Параметр | Описание | По умолчанию |
|----------|----------|--------------|
| `--footer-banner` | Путь к изображению баннера | - |
| `--banner-height` | Высота баннера (пунктов) | 30 |

### Чередующиеся логотипы

| Параметр | Описание | По умолчанию |
|----------|----------|--------------|
| `--alternating` | Два изображения: LEFT RIGHT | - |
| `--alt-size` | Размер логотипов (пунктов) | 50 |

---

## 💡 Размеры в миллиметрах

| Пунктов | Миллиметров | Применение |
|---------|-------------|------------|
| 30 | ~10mm | Маленький логотип |
| 40 | ~14mm | Средний логотип / баннер |
| 50 | ~17mm | Стандартный логотип |
| 60 | ~21mm | Большой баннер |
| 70 | ~25mm | Большой логотип |
| 100 | ~35mm | Очень большой |

---

## 🎯 Примеры для конкретных задач

### Пример 1: Книга с чередующимися номерами страниц

```bash
# Создать изображения с номерами (через ImageMagick или другой инструмент)
# page_left.png - для нечетных страниц
# page_right.png - для четных страниц

python add_logo_to_pdf_advanced.py book.pdf book_numbered.pdf \
  --alternating page_left.png page_right.png \
  --alt-size 40
```

### Пример 2: Корпоративный документ с баннером и логотипом

```bash
python add_logo_to_pdf_advanced.py report.pdf corporate_report.pdf \
  --footer-banner company_banner.png \
  --banner-height 50 \
  --corner company_logo.png \
  --position top-right \
  --size 60
```

### Пример 3: Рекламный буклет с брендингом

```bash
python add_logo_to_pdf_advanced.py brochure.pdf branded_brochure.pdf \
  --alternating brand_left.png brand_right.png \
  --alt-size 80 \
  --footer-banner promo_banner.png \
  --banner-height 60
```

### Пример 4: Учебное пособие с навигацией

```bash
python add_logo_to_pdf_advanced.py textbook.pdf textbook_nav.pdf \
  --alternating prev_icon.png next_icon.png \
  --alt-size 50 \
  --margin 10
```

---

## 🔄 Полный workflow: Markdown → PDF → Брендированный PDF

```bash
# Шаг 1: Создать PDF с хорошими отступами
node md2pdf.js document.md temp.pdf \
  --margin 30mm \
  --font-size large \
  --line-spacing loose \
  --paragraph-spacing 1.5em

# Шаг 2: Добавить баннер и чередующиеся логотипы
python add_logo_to_pdf_advanced.py temp.pdf final.pdf \
  --footer-banner footer.png \
  --banner-height 40 \
  --alternating logo_left.png logo_right.png \
  --alt-size 60

# Шаг 3: Удалить временный файл
rm temp.pdf
```

---

## 🎨 Советы по созданию изображений

### Для баннера внизу страницы

**Рекомендуемый размер:**
- Ширина: 2000-3000 пикселей (будет растянут на всю страницу A4)
- Высота: 100-200 пикселей (для banner-height 30-60pt)
- Формат: PNG с прозрачным фоном или цветным

**Пример создания баннера (ImageMagick):**
```bash
# Простой градиентный баннер
convert -size 2000x150 gradient:blue-lightblue banner.png

# Баннер с текстом
convert -size 2000x150 xc:blue -font Arial -pointsize 60 \
  -fill white -gravity center -annotate +0+0 'Company Name' \
  banner.png
```

### Для чередующихся логотипов

**Рекомендации:**
- Размер: 200x200 - 400x400 пикселей
- Формат: PNG с прозрачным фоном
- Можно использовать иконки навигации (← →)
- Можно использовать разные логотипы для брендинга

**Создание стрелок (ImageMagick):**
```bash
# Левая стрелка
convert -size 200x200 xc:none -fill blue -pointsize 120 \
  -gravity center -annotate +0+0 '←' arrow_left.png

# Правая стрелка
convert -size 200x200 xc:none -fill blue -pointsize 120 \
  -gravity center -annotate +0+0 '→' arrow_right.png
```

---

## 📝 Справка

```bash
# Полная справка
python add_logo_to_pdf_advanced.py --help

# Примеры использования
python add_logo_to_pdf_advanced.py --help | grep -A 20 "ПРИМЕРЫ"
```

---

## ⚠️ Важные замечания

### Совместимость режимов

✅ **Можно совмещать:**
- `--footer-banner` + `--corner`
- `--footer-banner` + `--alternating`

❌ **Нельзя совмещать:**
- `--corner` + `--alternating` (конфликт позиций)

### Производительность

- Большие изображения увеличивают размер PDF
- Баннеры 2000x150px оптимальны
- Логотипы 300x300px оптимальны
- Используйте сжатые PNG для экономии места

---

## 🆚 Сравнение версий

| Функция | Базовый скрипт | Расширенный скрипт |
|---------|---------------|-------------------|
| Логотип в углу | ✅ | ✅ |
| Выбор позиции | ✅ | ✅ |
| Широкий баннер | ❌ | ✅ |
| Чередование odd/even | ❌ | ✅ |
| Комбинация режимов | ❌ | ✅ |
| Argparse CLI | ❌ | ✅ |

---

## 🚀 Быстрая шпаргалка

```bash
# Баннер внизу
python add_logo_to_pdf_advanced.py in.pdf out.pdf --footer-banner b.png

# Чередование left/right
python add_logo_to_pdf_advanced.py in.pdf out.pdf --alternating l.png r.png

# Обычный логотип
python add_logo_to_pdf_advanced.py in.pdf out.pdf --corner logo.png

# Всё вместе
python add_logo_to_pdf_advanced.py in.pdf out.pdf \
  --footer-banner banner.png --alternating l.png r.png
```

**Готово к использованию!** 🎉
