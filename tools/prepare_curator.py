from pathlib import Path
from PIL import Image
import re

root = Path('.')
sheet = Image.open('assets/curator-poses.png').convert('RGBA')
a = sheet.getchannel('A')
if a.getextrema()[0] == 255:
    raise SystemExit('Sprite sheet is opaque. No assets changed. Obtain a genuinely transparent PNG; do not erase black clothing by colour threshold.')
w, h = sheet.size
names = ['neutral', 'present', 'explain', 'alert']
parts = []
for i, name in enumerate(names):
    crop = sheet.crop((round(w*i/4), 0, round(w*(i+1)/4), h))
    bbox = crop.getchannel('A').point(lambda x: 255 if x > 16 else 0).getbbox()
    if not bbox:
        raise SystemExit(f'Empty pose: {name}')
    if bbox[0] < 2 or bbox[2] > crop.width-2:
        raise SystemExit(f'Pose touches column boundary: {name}. Review sheet layout before cropping.')
    crop = crop.crop(bbox)
    parts.append((name, crop))
engine = Path('gallery-scenes.js')
text = engine.read_text()
old = "human='KakaoTalk_20261114_191639676.png'"
new = "human='assets/curator/neutral.png'"
if old not in text and new not in text:
    raise SystemExit('Unexpected engine version: manual integration required, no assets changed.')
anchor = "const small=matchMedia('(max-width:700px)').matches,variant=S.index%4;"
replacement = anchor + "const pose=night?'alert':['neutral','present','explain','present'][variant];const poseSrc='assets/curator/'+pose+'.png';if(actor.getAttribute('src')!==poseSrc)actor.src=poseSrc;"
if anchor not in text:
    raise SystemExit('Staging integration anchor missing: no assets changed.')
text = text.replace(old, new)
if "const poseSrc='assets/curator/'" not in text:
    text = text.replace(anchor, replacement, 1)
folder = Path('assets/curator')
folder.mkdir(exist_ok=True)
for name, crop in parts:
    crop.save(folder / (name+'.png'), optimize=True)
engine.write_text(text)
candidates = ['gallery-guide.svg', 'guide-curator-anime.svg', 'guide-live2d-cold.svg', 'museum-curator-black-hair.png', 'museum-curator-low-ponytail.png', 'museum-curator.png']
candidates += ['guide-costume-'+n+'.svg' for n in ['arena','commander','duelist','egypt','knight','maid']]
candidates += ['guide-egypt-'+n+'.svg' for n in ['calm','present','welcome']]
candidates += ['guide-hires-'+n+'.webp' for n in ['calm','present','welcome']]
candidates += ['gallery-scene-pose-'+str(i)+'.avif' for i in range(4)]
sources = [p for p in root.rglob('*') if p.is_file() and '.git' not in p.parts and p.suffix in ['.js','.css','.html']]
content = '\n'.join(p.read_text(errors='replace') for p in sources)
deleted, kept = [], []
for name in candidates:
    p = Path('assets') / name
    if not p.exists():
        continue
    dynamic = (name.startswith('guide-costume-') and 'guide-costume-' in content) or (name.startswith('guide-hires-') and 'guide-hires-' in content) or (name.startswith('gallery-scene-pose-') and 'gallery-scene-pose-' in content) or (name.startswith('guide-egypt-') and 'guide-egypt-' in content)
    if name in content or dynamic:
        kept.append(str(p))
    else:
        p.unlink()
        deleted.append(str(p))
Path('docs').mkdir(exist_ok=True)
Path('docs/CURATOR_ASSET_AUDIT.md').write_text('# Curator asset processing\n\nApproved sheet split into neutral/present/explain/alert. Alpha channel verified; remaining matte/fringe quality and identity require visual review. No black-colour keying used. Original PNG and sheet preserved. Browser tests not executed by this workflow.\n\n## Removed (no detected runtime text reference)\n'+ '\n'.join('- '+x for x in deleted)+'\n\n## Kept (referenced or dynamically addressed; dependencies must be retired before removal)\n'+ '\n'.join('- '+x for x in kept)+'\n')
