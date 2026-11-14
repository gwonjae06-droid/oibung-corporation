"""Produce crisp, original pixel sprites from the approved curator poses.

Only the curator and her altered form are pixelated. Museum photographs,
user artwork and HTML copy are never resampled. Source PNGs remain unchanged.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import math
import hashlib
import json

SOURCE_DIR=Path("assets/curator")
OUT=Path("assets/pixel")
PREVIEW=Path("artifacts")
NAMES=("neutral","present","explain","alert")
LOGICAL_HEIGHT=224
COLORS=32

def color_limit(src):
    # Quantize RGB but preserve the source alpha/transparent silhouette.
    alpha=src.getchannel("A")
    low=src.convert("RGB").quantize(
        colors=COLORS,method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE).convert("RGB")
    alpha=alpha.point(lambda a:0 if a<28 else (255 if a>224 else a))
    low.putalpha(alpha)
    return low

def small_sprite(file):
    with Image.open(file) as im:
        im=im.convert("RGBA")
    if im.getchannel("A").getextrema()[0]>0:
        raise ValueError(f"Missing true alpha transparency in {file}")
    w,h=im.size
    width=max(40,round(w*LOGICAL_HEIGHT/h))
    # Box reduction preserves high-contrast shapes without preblurring
    # the final enlarged pixel art (enlargement is done with nearest-neighbor).
    return color_limit(im.resize((width,LOGICAL_HEIGHT),Image.Resampling.BOX))

def haunted(base, intensity):
    """A deformed version of the SAME black-haired, vested, burgundy-tied curator."""
    w,h=base.size
    pad=22
    result=Image.new("RGBA",(w+2*pad,h+14))
    # Keep clothing/hair identity and recolor to desaturated moonlight.
    original=base.copy()
    pixels=original.load()
    for y in range(h):
        for x in range(w):
            red,green,blue,alpha=pixels[x,y]
            if alpha<20:continue
            luminance=(red*3+green*4+blue)/8
            if luminance>160: # White blouse: sickly ivory remains recognizable
                pixels[x,y]=(min(255,int(red*.79+22)),
                             min(255,int(green*.78+14)),
                             min(255,int(blue*.7+12)),alpha)
            elif red>green*1.19 and red>blue*1.2: # Burgundy tie persists
                pixels[x,y]=(min(255,int(red*1.02)),int(green*.38),
                             int(blue*.43),alpha)
            else: # Black ponytail and dark vest
                pixels[x,y]=(int(red*(.78-intensity*.12)),
                             int(green*(.75-intensity*.10)),
                             int(blue*(.79-intensity*.07)),alpha)
    # Deliberate pixel-row shear: progressively uncanny proportions,
    # while preserving the face and outfit rather than replacing the person.
    for y in range(h):
        sway=round(math.sin(y/11+intensity)*intensity*3)
        if y>int(h*.36):
            sway+=round(math.sin(y/7+2*intensity)*intensity*3)
        stretch=round((y/h)**2*intensity*9)
        result.alpha_composite(original.crop((0,y,w,y+1)),(pad+sway,y+stretch))
    draw=ImageDraw.Draw(result)
    cx=pad+w//2
    # Red eyes where the human's face sits; asymmetry is intentional.
    eye_y=round(h*.19)
    size=1+intensity
    draw.rectangle((cx-round(w*.085),eye_y,cx-round(w*.085)+size,eye_y+2),
                   fill=(255,58,68,255))
    draw.rectangle((cx+round(w*.07),eye_y+1,cx+round(w*.07)+size,eye_y+3),
                   fill=(255,43,62,255))
    if intensity>0:
        # A tied-back strand of hair becomes a hooked tendril.
        left=round(w*.14)
        for dx,dy in [
            ((cx-left,round(h*.16)),(cx-left-9,round(h*.34))),
            ((cx-left-9,round(h*.34)),(cx-left-15,round(h*.54))),
            ((cx+round(w*.18),round(h*.2)),(cx+round(w*.20)+8,round(h*.45))),
        ]:
            draw.line((dx,dy),fill=(19,13,28,255),width=2+intensity)
    if intensity>=2:
        # Sleeves stretch into black jointed claws. The burgundy tie
        # stays in the center as the identity cue.
        for side in (-1,1):
            anchor=(cx+side*round(w*.26),round(h*.4))
            joint=(cx+side*round(w*.39),round(h*.63))
            tip=(cx+side*round(w*.29),round(h*.79))
            draw.line((anchor,joint,tip),fill=(18,11,23,245),width=4)
            draw.line((tip,(tip[0]+side*7,tip[1]+12)),fill=(91,21,36,255),width=2)
        draw.polygon([(cx-2,round(h*.32)),(cx+3,round(h*.32)),
                      (cx+1,round(h*.52)),(cx-1,round(h*.47))],
                     fill=(136,24,52,255))
    return result

def preview(humans,monster):
    PREVIEW.mkdir(parents=True,exist_ok=True)
    canvas=Image.new("RGBA",(1400,740),(34,32,39,255))
    draw=ImageDraw.Draw(canvas)
    choices=[("neutral",humans["neutral"]),("present",humans["present"]),
             ("explain",humans["explain"]),("alert",humans["alert"]),
             ("corruption",monster["corrupt"]),("monster 1",monster["monster-1"]),
             ("monster 2",monster["monster-2"])]
    for i,(name,spr) in enumerate(choices):
        tile=spr.resize((spr.width*2,spr.height*2),Image.Resampling.NEAREST)
        x=i*200+(200-tile.width)//2
        y=78+560-tile.height
        canvas.alpha_composite(tile,(x,y))
        draw.text((i*200+8,30),name,fill=(236,229,209,255))
    canvas.convert("RGB").save(PREVIEW/"pixel-curator-lineup.png")
    # Daylight and blackout previews for quick art direction review.
    for label,color in [("day",(227,215,197,255)),("night",(27,21,32,255))]:
        board=Image.new("RGBA",(860,590),color)
        for i,sp in enumerate((humans["neutral"],monster["monster-2"])):
            tall=sp.resize((sp.width*2,sp.height*2),Image.Resampling.NEAREST)
            board.alpha_composite(tall,(i*430+215-tall.width//2,92+490-tall.height))
        board.convert("RGB").save(PREVIEW/f"pixel-{label}.png")

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    humans={}
    for name in NAMES:
        file=SOURCE_DIR/f"{name}.png"
        if not file.is_file():raise SystemExit(f"Missing approved source pose: {file}")
        sprite=small_sprite(file)
        if sprite.getchannel("A").getextrema()[0]>0:raise SystemExit("Opaque sprite: "+name)
        humans[name]=sprite
        sprite.save(OUT/f"curator-{name}.png",optimize=True)
    base=humans["neutral"]
    monsters={
        "corrupt":haunted(base,1),
        "monster-1":haunted(base,2),
        "monster-2":haunted(base,3),
    }
    for name,asset in monsters.items():
        asset.save(OUT/f"curator-{name}.png",optimize=True)
    preview(humans,monsters)
    info={
        "style":"Hybrid B: static Blender museum, crisp HTML, pixel curator and related creature",
        "source":"assets/curator/{neutral,present,explain,alert}.png",
        "logical_height":LOGICAL_HEIGHT,
        "palette_colors":COLORS,
        "assets":{f"curator-{key}.png":dict(size=list(im.size),
           alpha_extrema=list(im.getchannel("A").getextrema()))
           for key,im in {**humans,**monsters}.items()},
        "sha256_original_portrait":hashlib.sha256((SOURCE_DIR/"neutral.png").read_bytes()).hexdigest(),
        "notes":[
          "Source portrait files preserved; no generated replacement character",
          "Monster is pixel deformation of the same original curator, not separate stock art",
          "No Blender backgrounds, game thumbnails, or HTML text pixelated",
          "Not genuine per-bone rigging or frame-by-frame hand-painted pixel animation",
        ],
    }
    Path("docs/PIXEL_HYBRID_ASSET_AUDIT.json").write_text(
        json.dumps(info,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Generated",len(humans)+len(monsters),"pixel PNGs, preview and asset audit")
    print({name:im.size for name,im in monsters.items()})

if __name__=="__main__":
    main()
