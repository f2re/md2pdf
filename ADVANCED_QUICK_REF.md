
# ⚡ Быстрая шпаргалка: Расширенный скрипт

## 🎯 Основные команды

### 1. Широкий баннер внизу страницы

```bash
# Базовый (высота 30pt ~ 10mm)
python add_logo_to_pdf_advanced.py input.pdf output.pdf --footer-banner banner.png

# Средний (высота 40pt ~ 14mm)
python add_logo_to_pdf_advanced.py input.pdf output.pdf \
  --footer-banner banner.png --banner-height 40

# Высокий (высота 60pt ~ 21mm)
python add_logo_to_pdf_advanced.py input.pdf output.pdf \
  --footer-banner banner.png --banner-height 60
```

---

### 2. Чередующиеся изображения (Odd/Even)

```bash
# Базовый (размер 50pt)
python add_logo_to_pdf_advanced.py input.pdf output.pdf \
  --alternating logo_left.png logo_right.png

# Большие логотипы (70pt)
python add_logo_to_pdf_advanced.py input.pdf output.pdf \
  --alternating logo_left.png logo_right.png --alt-size 70

# С большим отступом
python add_logo_to_pdf_advanced.py input.pdf output.pdf \
  --alternating logo_left.png logo_right.png --margin 20
```

**Схема чередования:**
- Страница 1 → logo_left.png (левый нижний угол)
- Страница 2 → logo_right.png (правый нижний угол)
- Страница 3 → logo_left.png (левый нижний угол)
- и т.д.

---

### 3. Обычный логотип в углу

```bash
# Правый нижний (по умолчанию)
python add_logo_to_pdf_advanced.py input.pdf output.pdf --corner logo.png

# Левый нижний
python add_logo_to_pdf_advanced.py input.pdf output.pdf \
  --corner logo.png --position bottom-left

# Правый верхний с большим размером
python add_logo_to_pdf_advanced.py input.pdf output.pdf \
  --corner logo.png --position top-right --size 70
```

---

### 4. Комбинации

```bash
# Баннер + логотип вверху
python add_logo_to_pdf_advanced.py input.pdf output.pdf \
  --footer-banner banner.png \
  --corner logo.png --position top-right

# Баннер + чередующиеся логотипы
python add_logo_to_pdf_advanced.py input.pdf output.pdf \
  --footer-banner banner.png --banner-height 40 \
  --alternating logo_left.png logo_right.png --alt-size 60
```

---

## 📐 Таблица размеров

| Пунктов | ~Миллиметров | Применение |
|---------|--------------|------------|
| 30 | 10mm | Маленький |
| 40 | 14mm | Средний баннер |
| 50 | 17mm | Стандартный (по умолчанию) |
| 60 | 21mm | Большой |
| 70 | 25mm | Очень большой |

---

## 🎨 Позиции логотипа

- `bottom-right` - правый нижний (по умолчанию)
- `bottom-left` - левый нижний
- `top-right` - правый верхний
- `top-left` - левый верхний

---

## 🔄 Полный workflow

```bash
# 1. MD → PDF с красивыми отступами
node md2pdf.js doc.md temp.pdf \
  --margin 30mm --line-spacing loose --paragraph-spacing loose

# 2. Добавить баннер + чередующиеся логотипы
python add_logo_to_pdf_advanced.py temp.pdf final.pdf \
  --footer-banner footer.png --banner-height 40 \
  --alternating left.png right.png --alt-size 60

# 3. Удалить временный
rm temp.pdf
```

---

## 💡 Рекомендуемые размеры изображений

**Баннер:**
- 2000x150 пикселей (для banner-height 40-50pt)
- PNG с прозрачным или цветным фоном

**Логотипы:**
- 200x200 - 400x400 пикселей
- PNG с прозрачным фоном
- Квадратная форма

---

## ⚠️ Ограничения

❌ Нельзя: `--corner` + `--alternating` одновременно
✅ Можно: `--footer-banner` + `--corner`
✅ Можно: `--footer-banner` + `--alternating`

---

## 📝 Справка

```bash
python add_logo_to_pdf_advanced.py --help
```
