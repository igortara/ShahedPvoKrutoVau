import argparse
from PIL import Image
import os

def resize_png(input_path, output_path, size=(626, 626)):
    """
    Изменяет размер PNG-изображения до указанных размеров.

    Args:
        input_path (str): Путь к исходному PNG-файлу.
        output_path (str): Путь для сохранения измененного PNG-файла.
        size (tuple): Кортеж (ширина, высота) в пикселях. По умолчанию (626, 626).
    """
    try:
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Файл не найден: {input_path}")

        with Image.open(input_path) as img:
            # Проверяем, является ли изображение PNG, если важно
            # if img.format != 'PNG':
            #     print(f"Внимание: Файл {input_path} не является PNG. Будет обработан как есть.")

            img = img.resize(size, Image.Resampling.LANCZOS)
            img.save(output_path)
        print(f"Изображение успешно изменено и сохранено как: {output_path}")
    except FileNotFoundError as e:
        print(f"Ошибка: {e}")
    except Exception as e:
        print(f"Произошла ошибка при обработке изображения: {e}")

# --- Использование argparse ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Изменение размера PNG-изображения до 626x626 пикселей."
    )
    parser.add_argument(
        "input_image",
        type=str,
        help="Путь к исходному PNG-файлу, который нужно изменить."
    )
    parser.add_argument(
        "-o", "--output",
        type=str,
        default=None, # По умолчанию будет сгенерировано имя
        help="Путь для сохранения измененного изображения. Если не указан, создастся 'resized_[оригинальное_имя].png'."
    )

    args = parser.parse_args()

    input_file = args.input_image
    output_file = args.output

    # Генерируем имя выходного файла, если оно не указано
    if output_file is None:
        base_name = os.path.basename(input_file)
        name_without_ext, ext = os.path.splitext(base_name)
        output_file = f"resized_{name_without_ext}.png"

    resize_png(input_file, output_file)