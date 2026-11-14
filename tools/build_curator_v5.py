"""Build a newly illustrated, crisp pixel curator from the original v5 art sheet.

The 1536x1024 illustration is a newly drawn 4x2 sheet. Unlike v4, we do not
upscale the old 228x408 artwork or apply Lanczos sharpening to its body. Each
pose keeps its 1:1 source pixels and is tightly cropped with alpha intact.
The middle transformation is an ordered-dither animation, avoiding blurry
cross-fades that made pixel artwork appear muddy.
"""
from pathlib import Path
from PIL import Image
import hashlib
import json

SOURCE = Path('assets/curator-v5/curator-atlas.webp')
OUT = Path('assets/curator-v5')
AUDIT = Path('docs/CURATOR_V5_RENDER_AUDIT.json')
CW, CH = 384, 512
HUMAN = ('neutral', 'present', 'explain', 'alert')
MONSTERS = ('disturbed', 'approach', 'lunge', 'watch')
MORPH_COUNT = 12


def bbox(img):
    return img.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()


def crop_full_height(img, margin=13):
    b = bbox(img)
    if not b or b[2] - b[0] < 80 or b[3] - b[1] < 350:
        raise ValueError(f'Unexpected empty/truncated curator: {b}')
    left, right = max(0, b[0] - margin), min(CW, b[2] + margin)
    result = img.crop((left, 0, right, CH))
    # The side cropping must have truly transparent edges.
    if result.getchannel('A').getextrema()[0] != 0:
        raise ValueError('Extracted character has no transparent area')
    return result


def align_center(img):
    b = bbox(img)
    if not b:
        raise ValueError('Empty morph frame')
    shift = round((CW - b[0] - b[2]) / 2)
    result = Image.new('RGBA', (CW, CH))
    result.alpha_composite(img, (shift, 0))
    return result


def dither_morph(start, end, progress, step):
    # Stagger the replacement at 4x4-pixel blocks, matching blocky pixel art.
    # Both poses stay fully opaque rather than superimposing translucent ghosts.
    bayer = ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))
    # Thumbnail-quality frame replacement is not enough; order-dithering
    # makes every intermediate frame sharp with no blurred alpha blend.
    mask = Image.new('L', (CW, CH), 0)
    pixels = mask.load()
    threshold = progress * 16
    for y in range(CH):
        row = bayer[(y // 3 + step % 2) % 4]
        for x in range(CW):
            pixels[x, y] = 255 if row[(x // 3) % 4] < threshold else 0
    return Image.composite(end, start, mask)


def main():
    if not SOURCE.is_file():
        raise SystemExit(f'Approved v5 atlas missing: {SOURCE}')
    atlas = Image.open(SOURCE).convert('RGBA')
    if atlas.size != (CW * 4, CH * 2):
        raise SystemExit(f'Incorrect v5 source dimensions: {atlas.size}')
    OUT.mkdir(parents=True, exist_ok=True)
    written = {}
    source_frames = []
    for row, names, prefix in ((0, HUMAN, 'guide'), (1, MONSTERS, 'monster')):
        for i, name in enumerate(names):
            frame = atlas.crop((i * CW, row * CH, (i + 1) * CW, (row + 1) * CH))
            source_frames.append(frame)
            cropped = crop_full_height(frame)
            file = OUT / f'{prefix}-{name}.webp'
            cropped.save(file, 'WEBP', lossless=True, method=6)
            written[file.name] = {'width': cropped.width, 'height': cropped.height, 'bytes': file.stat().st_size}
    before = align_center(source_frames[3])
    after = align_center(source_frames[4])
    # Keep one canvas width for the complete transition to avoid page jitter.
    for i in range(MORPH_COUNT):
        t = i / (MORPH_COUNT - 1)
        ease = t * t * (3 - 2*t)
        frame = dither_morph(before, after, ease, i)
        frame = crop_full_height(frame, margin=15)
        file = OUT / f'morph-{i:02}.webp'
        frame.save(file, 'WEBP', lossless=True, method=6)
        written[file.name] = {'width': frame.width, 'height': frame.height, 'bytes': file.stat().st_size}
    if len(written) != 8 + MORPH_COUNT:
        raise SystemExit('Incomplete character output')
    AUDIT.parent.mkdir(parents=True, exist_ok=True)
    AUDIT.write_text(json.dumps({
        'source':'assets/curator-v5/curator-atlas.webp',
        'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'source_grid':[4,2], 'source_frame':[CW,CH],
        'method':'new 1:1 source pixels + alpha crop, lossless WebP; ordered-dither 12-step morph',
        'never_pixelated':'Blender backgrounds, game art, labels, HTML text',
        'generated':written,
        'limitations':['One 1536x1024 illustration sheet; no bone-rigged animation',
                       'Morph uses ordered-dither frame transition, not drawn in-betweens']
    },ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('PASS newly drawn v5 sprite output:', len(written), 'WebPs; total bytes',sum(x['bytes'] for x in written.values()))
    print([(k,v['width']) for k,v in written.items()])

if __name__ == '__main__':
    main()