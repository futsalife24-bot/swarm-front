from PIL import Image, ImageDraw
from pathlib import Path

p = Path('dist-validation/slug-silhouette-compare')
out = Image.new('RGB', (640, 380), '#0d1d29')
draw = ImageDraw.Draw(out)
for row, kind in enumerate(['SG-4', 'SG-7']):
    image = Image.open(p / (kind + '.png')).convert('RGBA')
    y = row * 182
    draw.text((12, y + 8), kind + '   96 x 36 / 4x', fill='white')
    background = Image.new('RGBA', image.size, '#152b39')
    background.alpha_composite(image)
    background = background.convert('RGB')
    out.paste(background, (12, y + 34))
    out.paste(background.resize((384, 144), Image.Resampling.NEAREST), (130, y + 26))
out.save(p / 'comparison.png')
