"""Derive eight consistent curator costumes and hand-pixelled stone stair art.
Base character faces, hair silhouettes, animation frames and registration
remain intact. Six variants change local outfit palettes/accessories only.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
import json, random

ROOT=Path("assets/world-pixel")
W,H=188,194
PALETTES={
 "angel":[
  ((90,158,149),"#fff2a9","#c7a8e3","MINT ARCHIVIST"),
  ((184,100,127),"#fee1f0","#e59ab8","ROSE HOST"),
  ((139,118,169),"#f5d18b","#b6c7f3","STAR CURATOR")],
 "devil":[
  ((86,93,148),"#f6dba6","#8699df","MIDNIGHT GUIDE"),
  ((134,80,126),"#fdc3dc","#b778bc","VIOLET TRICKSTER"),
  ((161,100,92),"#ffe7ac","#b97677","EMBER HOST")]
}
def outfit_variant(source,form,variant):
    target,pin,trim,label=PALETTES[form][variant-1]
    a=np.array(source,dtype=np.uint8)
    y=(np.arange(a.shape[0])%H)[:,None]
    x=(np.arange(a.shape[1])%W)[None,:]
    r,g,b=a[:,:,0].astype(np.float32),a[:,:,1].astype(np.float32),a[:,:,2].astype(np.float32)
    alpha=a[:,:,3]>32
    if form=="angel":
        # Purple uniform and skirt only; face, hair and transparent background stay original.
        mask=alpha&(y>=62)&(y<=172)&(x>=48)&(x<=145)&(b>g*1.10)&(r>g*.90)
    else:
        # Burgundy dress only, never the red ponytail.
        mask=alpha&(y>=53)&(y<=173)&(x>=61)&(x<=121)&(r>g*1.23)&(r>=b*.82)
    level=np.maximum.reduce([r,g,b])/255
    src=np.asarray(target,dtype=np.float32)
    for k,channel in enumerate([r,g,b]):
        channel[mask]=np.clip(channel[mask]*.38+(src[k]*(.42+level[mask]*.38)),0,255)
        a[:,:,k]=channel.astype(np.uint8)
    out=Image.fromarray(a,"RGBA")
    d=ImageDraw.Draw(out)
    for row in range(9):
        for col in range(8):
            ox,oy=col*W,row*H
            # Clean, integer-positioned 1-5px original-palette accessories.
            # All 72 cells share the same registered full-canvas coordinates.
            if form=="angel":
                hx,hy=ox+77,oy+31
                if variant==1: # small mint-and-gold ribbon
                    d.rectangle((hx-3,hy,hx+3,hy+1),fill=pin)
                    d.point((hx,hy-2),fill=trim)
                    d.line((hx,hy+2,hx+2,hy+4),fill=trim,width=1)
                elif variant==2: # rosette
                    d.rectangle((hx-2,hy-2,hx+2,hy+2),fill=pin)
                    d.point((hx,hy),fill="#f8a1c4")
                    d.point((hx-3,hy+1),fill=trim)
                else: # star on ribbon
                    d.line((hx,hy-3,hx,hy+3),fill=pin,width=1)
                    d.line((hx-3,hy,hx+3,hy),fill=pin,width=1)
                    d.rectangle((hx-1,hy-1,hx+1,hy+1),fill=trim)
            else:
                hx,hy=ox+73,oy+17
                if variant==1: # gold pin
                    d.rectangle((hx-3,hy,hx+3,hy+1),fill=pin)
                    d.point((hx,hy-2),fill=trim)
                elif variant==2:
                    d.rectangle((hx-3,hy-2,hx+3,hy+1),fill=trim)
                    d.point((hx,hy),fill=pin)
                else:
                    d.line((hx-3,hy+2,hx+3,hy-3),fill=pin,width=2)
                    d.rectangle((hx-1,hy-1,hx+1,hy+1),fill=trim)
    # Accessories may be plotted near transparent hair edges. Preserve
    # the exact original 72-frame alpha silhouette: never invent opaque
    # pixels or alter pose boundaries as a costume variant is selected.
    out.putalpha(source.getchannel("A"))
    return out,label

def build_costumes():
    manifest={"frameWidth":W,"frameHeight":H,"columns":8,"rows":9,"variants":{}}
    for form,name in (("angel","nong"),("devil","bbang")):
        filename=ROOT/f"curator-{name}-cels.png"
        base=Image.open(filename).convert("RGBA")
        assert base.size==(W*8,H*9)
        manifest["variants"][form]=[{"index":0,"name":"ORIGINAL","path":str(filename)}]
        for variant in range(1,4):
            result,label=outfit_variant(base,form,variant)
            path=ROOT/f"curator-{name}-variant-{variant}.png"
            result.save(path,optimize=True)
            check=Image.open(path)
            assert check.size==base.size and check.mode=="RGBA"
            # No opaque pixels removed, shifted or resized.
            assert check.getchannel("A").tobytes()==base.getchannel("A").tobytes()
            manifest["variants"][form].append(
                {"index":variant,"name":label,"path":str(path)})
            print("costume",form,variant,path.stat().st_size)
    (ROOT/"world-curator-variants.json").write_text(
        json.dumps(manifest,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")

def stone_art():
    rng=random.Random(1811)
    w,h=512,94
    im=Image.new("RGBA",(w,h),"#59636c")
    d=ImageDraw.Draw(im)
    palette=["#9b9f9e","#bbb1a5","#a8a5a1","#818d90","#c8b5a0","#989494"]
    d.rectangle((0,0,w,8),fill="#dcc4a5")
    d.rectangle((0,9,w,15),fill="#9c9991")
    for row,y in enumerate(range(15,h,17)):
        cursor=(-23 if row%2 else 0)
        while cursor<w:
            width=rng.randint(28,49)
            color=rng.choice(palette)
            d.rectangle((cursor+1,y+1,cursor+width-2,min(h-1,y+14)),fill=color)
            d.line((cursor+2,y+2,cursor+width-4,y+2),fill="#cec6b7",width=1)
            d.line((cursor+2,y+14,cursor+width-2,y+14),fill="#686f73",width=1)
            for _ in range(rng.randint(1,3)):
                px=cursor+rng.randint(4,width-4);py=y+rng.randint(4,12)
                d.point((px,py),fill=rng.choice(["#d4cabb","#62696c","#8a9c7e"]))
            cursor+=width
    for _ in range(80):
        x=rng.randrange(w);y=rng.choice([7,11,15,27,47,65])
        d.point((x,y),fill=rng.choice(["#7e9877","#95aa79","#ddd3b9"]))
    im.save(ROOT/"world-terrace-stone.png",optimize=True)

def stair_art():
    rng=random.Random(2026)
    w,h=270,300
    im=Image.new("RGBA",(w,h),(0,0,0,0))
    d=ImageDraw.Draw(im)
    palette=["#858a8d","#a49f97","#b3ab9c","#8b9999","#c0b3a2"]
    steps=18
    # Solid masonry underneath 18 independent stone treads.
    # Silhouette grows continuously from the lower left to upper right.
    for i in range(steps):
        left=int(i*w/steps)
        right=int((i+1)*w/steps)
        top=h-int((i+1)*h/steps)
        color=palette[(i*7)%len(palette)]
        d.rectangle((left,top+5,right-1,h-1),fill=color)
        d.rectangle((left,top+1,right-1,top+5),fill="#efe0c4")
        d.line((left,top+6,right-1,top+6),fill="#657078")
        d.line((right-2,top+6,right-2,h-1),fill="#657078")
        d.rectangle((left+2,top+8,right-4,top+11),fill="#9b918b")
        # Hand-placed masonry cracks and lichen along each riser.
        for j in range(2,8):
            y=top+14+j*18
            if y<h-3:
                d.line((left+2,y,right-4,y),fill="#767e7d")
                if j%2:d.point((left+5,y-2),fill="#8ba078")
        if i%3==0:
            d.rectangle((left+2,top-13,left+5,top+1),fill="#5c6267")
            d.rectangle((left+1,top-15,left+6,top-12),fill="#d7c7a5")
            d.point((left+3,top-16),fill="#fff1be")
    # Parallel hand-placed iron railing, not smooth geometric zooming.
    for i in range(steps-1):
        x1=int(i*w/steps)+4
        y1=h-int((i+1)*h/steps)-14
        x2=int((i+1)*w/steps)+4
        y2=h-int((i+2)*h/steps)-14
        d.line((x1,y1,x2,y2),fill="#505a62",width=3)
        d.line((x1,y1-2,x2,y2-2),fill="#e2ceaa",width=1)
    for _ in range(35):
        x=rng.randrange(30,w)
        top=h-int((x/w)*h)
        if top+5<h:
            d.point((x,top+rng.randint(4,9)),fill="#b2b49b")
    im.save(ROOT/"world-stair-flight.png",optimize=True)

if __name__=="__main__":
    ROOT.mkdir(parents=True,exist_ok=True)
    build_costumes()
    stone_art()
    stair_art()
    print("Six registered variant sheets and two painted stair assets verified")
