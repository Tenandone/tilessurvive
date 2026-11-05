"""Normalize authentic artwork without editing originals (requires Pillow).

Transparent pixels alone are removed. Every nontransparent source pixel stays
inside the derived artboard; uniform safe margins and baselines replace canvas
padding differences. Run from any directory; outputs are deterministic WebP.
"""
from pathlib import Path
from PIL import Image
import hashlib
import io
import json

ROOT = Path(__file__).resolve().parents[1]
SHA = lambda value: hashlib.sha256(value).hexdigest()

def sources():
    result = {}
    for folder, kind in [('img/game-41/heroes', 'hero'), ('img/game-26300/heroes', 'hero'), ('img/game-40/pets', 'pet'), ('img/pets', 'pet')]:
        for file in sorted((ROOT / folder).glob('*')):
            if file.suffix in ['.png', '.webp']:
                result['/' + file.relative_to(ROOT).as_posix()] = kind
    for item in json.loads((ROOT / 'data/building-assets-51.json').read_text(encoding='utf-8'))['assets']:
        for role in ['catalog', 'detail']:
            for key in ['src', 'previousSrc']:
                src = item.get(role, {}).get(key)
                if src and (ROOT / src.lstrip('/')).is_file():
                    result[src] = 'building'
    return sorted(result.items())

def build():
    images = []
    changed = 0
    for src, kind in sources():
        raw = (ROOT / src.lstrip('/')).read_bytes()
        source = Image.open(io.BytesIO(raw)).convert('RGBA')
        bbox = source.getchannel('A').getbbox()
        if not bbox:
            raise ValueError('Empty authentic source: ' + src)
        cropped = source.crop(bbox)
        width, height = (480, 640) if kind == 'hero' else (384, 384)
        safe_x, safe_y = (0.92, 0.92) if kind == 'hero' else (0.86, 0.86)
        scale = min(width * safe_x / cropped.width, height * safe_y / cropped.height)
        size = (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale)))
        artwork = cropped.resize(size, Image.Resampling.LANCZOS)
        x = (width - size[0]) // 2
        y = round(height * .96) - size[1] if kind == 'hero' else (height - size[1]) // 2
        canvas = Image.new('RGBA', (width, height))
        canvas.alpha_composite(artwork, (x, y))
        buffer = io.BytesIO()
        canvas.save(buffer, format='WEBP', lossless=True, method=6, exact=True)
        output = buffer.getvalue()
        target = '/img/v61-normalized/' + kind + '/' + Path(src).stem + '-' + SHA(src.encode())[:8] + '.webp'
        file = ROOT / target.lstrip('/')
        file.parent.mkdir(parents=True, exist_ok=True)
        if not file.exists() or file.read_bytes() != output:
            file.write_bytes(output)
            changed += 1
        images.append({'source': src, 'sourceSHA256': SHA(raw), 'sourceWidth': source.width, 'sourceHeight': source.height,
                       'alphaBounds': list(bbox), 'kind': kind, 'src': target, 'width': width, 'height': height,
                       'visibleBounds': [x, y, x + size[0], y + size[1]], 'sha256': SHA(output), 'bytes': len(output)})
    manifest = {'schemaVersion': 1, 'normalization': 'alpha-nonzero-contain-v1', 'sourcePixelsRemoved': 'transparent-only',
                'originalsModified': False, 'images': images}
    target = ROOT / 'data/v61-image-assets.json'
    text = json.dumps(manifest, ensure_ascii=False, indent=2) + '\n'
    if not target.exists() or target.read_text(encoding='utf-8') != text:
        target.write_text(text, encoding='utf-8', newline='\n')
        changed += 1
    print(json.dumps({'images': len(images), 'changed': changed, 'bytes': sum(i['bytes'] for i in images)}))

if __name__ == '__main__':
    build()
