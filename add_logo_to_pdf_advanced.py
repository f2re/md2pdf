#!/usr/bin/env python3
"""
Расширенный скрипт добавления изображений в PDF
- Стандартные логотипы в углах
- Широкий баннер внизу страницы
- Чередующиеся изображения на четных/нечетных страницах

Использование: python add_logo_to_pdf_advanced.py [options]

Автор: AI Assistant
Требует: pip install pymupdf
"""

import sys
import os
import argparse
import pymupdf  # PyMuPDF


class PDFLogoAdder:
    """Класс для добавления различных типов изображений в PDF"""

    def __init__(self, input_pdf, output_pdf):
        self.input_pdf = input_pdf
        self.output_pdf = output_pdf
        self.doc = None
        self.total_pages = 0

    def open_document(self):
        """Открыть PDF документ"""
        if not os.path.exists(self.input_pdf):
            raise FileNotFoundError(f"Файл {self.input_pdf} не найден")

        print(f"📄 Открываю PDF: {self.input_pdf}")
        self.doc = pymupdf.open(self.input_pdf)
        self.total_pages = self.doc.page_count
        print(f"📊 Всего страниц: {self.total_pages}")

    def close_document(self):
        """Закрыть и сохранить документ"""
        print(f"\n💾 Сохраняю PDF: {self.output_pdf}")
        self.doc.save(self.output_pdf)
        self.doc.close()

        output_size = os.path.getsize(self.output_pdf) / (1024 * 1024)
        print()
        print("="*60)
        print("✅ ГОТОВО!")
        print("="*60)
        print(f"📦 Выходной файл: {self.output_pdf}")
        print(f"📊 Размер файла: {output_size:.2f} MB")
        print(f"📄 Обработано страниц: {self.total_pages}")
        print("="*60)

    def add_corner_logo(self, logo_path, position='bottom-right', size=50, margin=15):
        """
        Добавить логотип в угол на всех страницах

        Args:
            logo_path: путь к изображению
            position: bottom-right, bottom-left, top-right, top-left
            size: размер в пунктах
            margin: отступ от края
        """
        print(f"\n🖼️  Режим: Логотип в углу")
        print(f"📍 Позиция: {position}")
        print(f"📏 Размер: {size} пунктов")

        pixmap = self._load_image(logo_path)
        img_width, img_height = self._calculate_size(pixmap, size)

        for page_num in range(self.total_pages):
            page = self.doc[page_num]
            page_rect = page.rect

            x, y = self._get_corner_position(
                page_rect, position, img_width, img_height, margin
            )

            target_rect = pymupdf.Rect(x, y, x + img_width, y + img_height)
            page.insert_image(target_rect, pixmap=pixmap, overlay=True)

            print(f"  ✓ Страница {page_num + 1}/{self.total_pages}")

        pixmap = None

    def add_footer_banner(self, banner_path, height=30, margin=5):
        """
        Добавить широкий баннер внизу каждой страницы

        Args:
            banner_path: путь к изображению баннера
            height: высота баннера в пунктах
            margin: отступ снизу
        """
        print(f"\n🎨 Режим: Широкий баннер внизу")
        print(f"📏 Высота баннера: {height} пунктов (~{height*0.35:.1f} мм)")

        pixmap = self._load_image(banner_path)

        for page_num in range(self.total_pages):
            page = self.doc[page_num]
            page_rect = page.rect

            # Баннер на всю ширину страницы минус отступы
            banner_width = page_rect.width - (margin * 2)
            banner_height = height

            x = margin
            y = page_rect.height - banner_height - margin

            target_rect = pymupdf.Rect(x, y, x + banner_width, y + banner_height)
            page.insert_image(target_rect, pixmap=pixmap, overlay=True)

            print(f"  ✓ Страница {page_num + 1}/{self.total_pages}")

        pixmap = None

    def add_alternating_logos(self, logo_left, logo_right, size=50, margin=15):
        """
        Чередовать изображения на нечетных/четных страницах

        Нечетные страницы (1, 3, 5...): logo_left в левом нижнем углу
        Четные страницы (2, 4, 6...): logo_right в правом нижнем углу

        Args:
            logo_left: изображение для левого угла (нечетные страницы)
            logo_right: изображение для правого угла (четные страницы)
            size: размер логотипа
            margin: отступ от края
        """
        print(f"\n🔄 Режим: Чередующиеся изображения")
        print(f"📏 Размер: {size} пунктов")
        print(f"📄 Нечетные страницы (1,3,5...): {os.path.basename(logo_left)} → левый нижний")
        print(f"📄 Четные страницы (2,4,6...): {os.path.basename(logo_right)} → правый нижний")

        pixmap_left = self._load_image(logo_left)
        pixmap_right = self._load_image(logo_right)

        img_width_left, img_height_left = self._calculate_size(pixmap_left, size)
        img_width_right, img_height_right = self._calculate_size(pixmap_right, size)

        for page_num in range(self.total_pages):
            page = self.doc[page_num]
            page_rect = page.rect

            # Нумерация страниц с 1 (page_num + 1)
            page_number = page_num + 1

            if page_number % 2 == 1:  # Нечетная страница
                # Левый нижний угол
                x = margin
                y = page_rect.height - img_height_left - margin
                img_width = img_width_left
                img_height = img_height_left
                pixmap = pixmap_left
                position_text = "левый нижний"
            else:  # Четная страница
                # Правый нижний угол
                x = page_rect.width - img_width_right - margin
                y = page_rect.height - img_height_right - margin
                img_width = img_width_right
                img_height = img_height_right
                pixmap = pixmap_right
                position_text = "правый нижний"

            target_rect = pymupdf.Rect(x, y, x + img_width, y + img_height)
            page.insert_image(target_rect, pixmap=pixmap, overlay=True)

            print(f"  ✓ Страница {page_number}/{self.total_pages} ({position_text})")

        pixmap_left = None
        pixmap_right = None

    def _load_image(self, image_path):
        """Загрузить изображение"""
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Изображение не найдено: {image_path}")

        try:
            pixmap = pymupdf.Pixmap(image_path)
            print(f"  📸 Загружено: {os.path.basename(image_path)} ({pixmap.width}x{pixmap.height} px)")
            return pixmap
        except Exception as e:
            raise ValueError(f"Ошибка загрузки изображения {image_path}: {e}")

    def _calculate_size(self, pixmap, target_size):
        """Вычислить размеры с сохранением пропорций"""
        aspect_ratio = pixmap.width / pixmap.height
        if aspect_ratio > 1:
            width = target_size
            height = target_size / aspect_ratio
        else:
            height = target_size
            width = target_size * aspect_ratio
        return width, height

    def _get_corner_position(self, page_rect, position, img_width, img_height, margin):
        """Получить координаты угла"""
        positions = {
            'bottom-right': (page_rect.width - img_width - margin, 
                           page_rect.height - img_height - margin),
            'bottom-left': (margin, 
                          page_rect.height - img_height - margin),
            'top-right': (page_rect.width - img_width - margin, 
                        margin),
            'top-left': (margin, margin)
        }

        if position not in positions:
            raise ValueError(f"Неизвестная позиция: {position}. "
                           f"Доступные: {', '.join(positions.keys())}")

        return positions[position]


def main():
    parser = argparse.ArgumentParser(
        description='Расширенное добавление изображений в PDF',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
ПРИМЕРЫ:

  # Стандартный логотип в правом нижнем углу
  python %(prog)s input.pdf output.pdf --corner logo.png --position bottom-right

  # Широкий баннер внизу страницы
  python %(prog)s input.pdf output.pdf --footer-banner banner.png --height 40

  # Чередующиеся изображения (нечетные/четные страницы)
  python %(prog)s input.pdf output.pdf --alternating logo1.png logo2.png

  # Комбинация: баннер + логотип
  python %(prog)s input.pdf output.pdf --footer-banner banner.png --corner logo.png

  # Комбинация: чередующиеся + баннер
  python %(prog)s input.pdf output.pdf --alternating logo1.png logo2.png --footer-banner banner.png
        """
    )

    parser.add_argument('input_pdf', help='Входной PDF файл')
    parser.add_argument('output_pdf', help='Выходной PDF файл')

    # Режимы
    parser.add_argument('--corner', metavar='IMAGE', 
                       help='Логотип в углу на всех страницах')
    parser.add_argument('--position', default='bottom-right',
                       choices=['bottom-right', 'bottom-left', 'top-right', 'top-left'],
                       help='Позиция углового логотипа (по умолчанию: bottom-right)')
    parser.add_argument('--size', type=int, default=50,
                       help='Размер углового логотипа в пунктах (по умолчанию: 50)')

    parser.add_argument('--footer-banner', metavar='IMAGE',
                       help='Широкий баннер внизу каждой страницы')
    parser.add_argument('--banner-height', type=int, default=30,
                       help='Высота баннера в пунктах (по умолчанию: 30)')

    parser.add_argument('--alternating', nargs=2, metavar=('LEFT_IMG', 'RIGHT_IMG'),
                       help='Чередующиеся изображения: нечетные(левый угол) четные(правый угол)')
    parser.add_argument('--alt-size', type=int, default=50,
                       help='Размер чередующихся логотипов (по умолчанию: 50)')

    parser.add_argument('--margin', type=int, default=15,
                       help='Отступ от края в пунктах (по умолчанию: 15)')

    args = parser.parse_args()

    # Проверка: хотя бы один режим должен быть выбран
    if not (args.corner or args.footer_banner or args.alternating):
        parser.error('Нужно указать хотя бы один режим: --corner, --footer-banner или --alternating')

    # Проверка: corner и alternating несовместимы
    if args.corner and args.alternating:
        parser.error('Нельзя использовать --corner и --alternating одновременно')

    try:
        adder = PDFLogoAdder(args.input_pdf, args.output_pdf)
        adder.open_document()

        # Применить режимы
        if args.alternating:
            adder.add_alternating_logos(
                args.alternating[0], 
                args.alternating[1],
                size=args.alt_size,
                margin=args.margin
            )
        elif args.corner:
            adder.add_corner_logo(
                args.corner,
                position=args.position,
                size=args.size,
                margin=args.margin
            )

        if args.footer_banner:
            adder.add_footer_banner(
                args.footer_banner,
                height=args.banner_height,
                margin=args.margin
            )

        adder.close_document()

    except Exception as e:
        print(f"\n❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
