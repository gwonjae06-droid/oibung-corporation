"""Render high-quality sprites from the *existing approved v3 pixel illustrations*.

The source art is 228x408 per pose; increasing output dimensions cannot create
new hand-drawn detail. We improve edge quality, opacity and layout by rendering
512-high lossless frames, retaining all colours instead of reducing to 32/64.
All v3 assets remain intact for rollback. Night morph uses a short ten-frame
cross-dissolve/glitch between the SAME curator and the linked monster.
"""
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter, ImageChops
import json, hashlib

ROOT=Path("assets/curator-v3")
OUT=Path("assets/curator-v4")
REPORT=Path("docs/CURATOR_V4_RENDER_AUDIT.json")
PW, PH=228,408
OW, OH=288,512
HUMAN=("neutral","present","explain","alert")
MONSTER=("disturbed","approach","lunge","watch")
COUNT=10

def slice_atlas(name):
    path=ROOT / (name+"-atlas.webp")
    if not path.exists(): raise SystemExit(f"Missing original {path}")
    with Image.open(path) as source:
        im=source.convert("RGBA")
    if im.size != (PW*4,PH):
        raise SystemExit(f"Unexpected atlas dimension: {path} {im.size}")
    result=[]
    for i in range(4):
        item=im.crop((i*PW,0,(i+1)*PW,PH))
        visible=item.getchannel("A").getbbox()
        if not visible or visible[2]-visible[0]<35 or visible[3]-visible[1]<300:
            raise SystemExit(f"Damaged original sprite cell {name} {i}")
        result.append(item)
    return result

def enhance(item):
    # Keep real artwork colours, preserve original transparency.
    rendered=item.resize((OW,OH),Image.Resampling.LANCZOS)
    r,g,b,a=rendered.split()
    rgb=Image.merge("RGB",(r,g,b))
    rgb=ImageEnhance.Contrast(rgb).enhance(1.085)
    rgb=rgb.filter(ImageFilter.UnsharpMask(radius=.78,percent=115,threshold=3))
    return Image.merge("RGBA",(*rgb.split(),a))

def alpha_scale(item,amount):
    result=item.copy()
    alpha=result.getchannel("A")
    result.putalpha(alpha.point(lambda x:round(x*amount)))
    return result

def blend_frames(a,b,t,frame):
    # Cross-fading the same individual, not swapping with a different creature.
    # A local slice shift adds a slight physical distortion at the peak.
    result=Image.new("RGBA",(OW,OH))
    from_human=alpha_scale(a,1-t)
    to_creature=alpha_scale(b,t)
    result.alpha_composite(from_human)
    result.alpha_composite(to_creature)
    if 0.16<t<.92:
        from math import sin,pi
        amplitude=round(sin(t*pi)*4)
        y=round(OH*.20+frame*13)%max(1,OH-35)
        strip=result.crop((0,y,OW,y+12))
        result.paste(Image.new("RGBA",(OW,12)),(0,y))
        result.alpha_composite(strip,(max(0,amplitude),y))
    return result

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    h=[enhance(i) for i in slice_atlas("guide")]
    m=[enhance(i) for i in slice_atlas("monster")]
    written={}
    for prefix,names,imgs in (("guide",HUMAN,h),("monster",MONSTER,m)):
        for name,img in zip(names,imgs):
            file=OUT/f"{prefix}-{name}.webp"
            img.save(file,format="WEBP",lossless=True,method=6)
            written[file.name]={"width":img.width,"height":img.height,"bytes":file.stat().st_size}
    for idx in range(COUNT):
        t=idx/(COUNT-1)
        eased=t*t*(3-2*t)
        mixed=blend_frames(h[3],m[0],eased,idx)
        file=OUT/f"morph-{idx:02}.webp"
        mixed.save(file,format="WEBP",lossless=True,method=6)
        written[file.name]={"width":mixed.width,"height":mixed.height,"bytes":file.stat().st_size}
    REPORT.parent.mkdir(parents=True,exist_ok=True)
    report={
        "description":"v4 pixel curator edge improvement and ten-frame identity-linked morph",
        "source":{k:hashlib.sha256((ROOT/f"{k}-atlas.webp").read_bytes()).hexdigest() for k in ("guide","monster")},
        "original_frame":[PW,PH],"output_frame":[OW,OH],
        "color":"Full original source colors retained; not down-quantized to 32 or 64 colors",
        "caveat":"Upscale and sharpening cannot add real hand-painted features or replace custom animation drawings",
        "files":written,
    }
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Generated",len(written),"lossless RGBA WebP sprites (8 poses + 10 morph)")
    print("Size KB",round(sum(x['bytes'] for x in written.values())/1024))

if __name__=="__main__":main()
