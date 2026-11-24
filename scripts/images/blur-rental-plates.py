"""Plate-only deterministic edits; no generated/replaced vehicles or scenery.

Usage: python3 scripts/images/blur-rental-plates.py INPUT_DIR OUTPUT_DIR
INPUT_DIR contains the original {key}-1280.webp files. All smaller outputs
are rebuilt from the blurred master, never from unredacted thumbnails.
Coordinates refer to the reviewed reference dimensions below.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

PLATES = {
    'car-ignis': ((1280, 764), [[(0, 286), (79, 282), (77, 321), (0, 326)]]),
    'car-swift': ((1280, 685), [[(986, 448), (1143, 440), (1144, 486), (987, 495)]]),
    'car-baleno': ((1280, 768), [[(168, 465), (356, 475), (359, 534), (171, 522)]]),
    'car-i20': ((1096, 768), [[(633, 531), (826, 528), (826, 576), (633, 579)]]),
    'car-punch': ((1153, 768), [[(269, 487), (467, 498), (470, 548), (272, 540)]]),
    'car-ertiga': ((1189, 768), [[(994, 490), (1125, 452), (1126, 519), (997, 560)]]),
    'car-innova-crysta': ((1178, 768), [[(984, 548), (1101, 520), (1099, 565), (982, 593)]]),
    'bike-himalayan-450': ((1071, 768), [
        [(29, 59), (68, 51), (74, 83), (36, 95)],
        [(346, 23), (366, 24), (367, 46), (346, 46)],
        [(868, 80), (895, 83), (894, 109), (864, 108)],
    ]),
}

def redact(source, reference, polygons):
    image = source.convert('RGB')
    sx, sy = image.width / reference[0], image.height / reference[1]
    for polygon in polygons:
        points = [(round(x * sx), round(y * sy)) for x, y in polygon]
        mask = Image.new('L', image.size, 0)
        ImageDraw.Draw(mask).polygon(points, fill=255)
        # Strong blur is burned into pixels, not a removable CSS overlay.
        height = max(y for _, y in points) - min(y for _, y in points)
        blurred = image.filter(ImageFilter.GaussianBlur(max(8, height * 0.55)))
        image = Image.composite(blurred, image, mask)
    return image

def main():
    source, output = map(Path, sys.argv[1:3])
    output.mkdir(parents=True, exist_ok=True)
    for key, (reference, polygons) in PLATES.items():
        master = redact(Image.open(source / f'{key}-1280.webp'), reference, polygons)
        master.save(output / f'{key}-master.png')
        for width in (480, 640, 828, 1280):
            resized = master.resize((width, round(master.height * width / master.width)), Image.Resampling.LANCZOS)
            resized.save(output / f'{key}-plates-blurred-{width}.webp', 'WEBP', quality=75, method=6)
            resized.save(output / f'{key}-plates-blurred-{width}.avif', 'AVIF', quality=38, speed=5)
        print(f'{key}: {len(polygons)} plates; four WebP + four AVIF sizes')

if __name__ == '__main__':
    main()