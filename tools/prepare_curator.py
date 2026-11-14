"""Split approved four-pose curator PNG using alpha-based transparent gutters.
The presenting arm crosses the old naive width/4 cut. Never color-key clothing.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib

SOURCE=Path("assets/curator-poses.png")
NAMES=("neutral","present","explain","alert")
OUT=Path("assets/curator")
ARTIFACTS=Path("artifacts")
AUDIT=Path("docs/CURATOR_ASSET_AUDIT.md")
THRESHOLD=16

def contiguous(xs):
    runs=[]
    start=last=None
    for x in xs:
        if start is None: start=last=x
        elif x==last+1: last=x
        else:
            runs.append((start,last))
            start=last=x
    if start is not None: runs.append((start,last))
    return runs

def locate_gutters(sheet):
    w,h=sheet.size
    significant=sheet.getchannel("A").point(lambda a:255 if a>THRESHOLD else 0)
    zeroes=[x for x in range(w) if significant.crop((x,0,x+1,h)).getbbox() is None]
    runs=contiguous(zeroes)
    seams=[]
    report=[]
    for i in range(1,4):
        target=w*i/4
        candidates=[(left,right) for left,right in runs
                    if right-left+1>=8 and abs((left+right)/2-target)<w*.15]
        if not candidates:
            raise SystemExit(f"No transparent gutter near pose boundary {i}; manual review required")
        left,right=max(candidates,key=lambda p:(p[1]-p[0]+1,-abs((p[0]+p[1])/2-target)))
        seam=(left+right)//2
        seams.append(seam)
        report.append(f"{i}: x={seam}, transparent run {left}..{right}")
    if not all(x<y for x,y in zip((0,*seams),(*seams,w))):
        raise SystemExit("Gutter order invalid")
    return seams,report

def split(sheet):
    w,h=sheet.size
    low,high=sheet.getchannel("A").getextrema()
    if low>=240 or high<220: raise SystemExit("Source is not reliably transparent")
    seams,report=locate_gutters(sheet)
    edges=[0,*seams,w]
    results=[]
    for i,name in enumerate(NAMES):
        left,right=edges[i],edges[i+1]
        source=sheet.crop((left,0,right,h))
        visible=source.getchannel("A").point(lambda a:255 if a>THRESHOLD else 0)
        box=visible.getbbox()
        if not box: raise SystemExit(f"No visible character: {name}")
        x0,y0,x1,y1=box
        if x1-x0<150 or y1-y0<int(h*.65): raise SystemExit(f"Suspiciously truncated {name}: {box}")
        if x0<=1 or x1>=source.width-1: raise SystemExit(f"Pose touches crop seam: {name}")
        image=source.crop(box)
        margin=12
        canvas=Image.new("RGBA",(image.width+2*margin,image.height+2*margin))
        canvas.paste(image,(margin,margin))
        alpha=canvas.getchannel("A")
        strips=[alpha.crop((0,0,canvas.width,1)),
                alpha.crop((0,canvas.height-1,canvas.width,canvas.height)),
                alpha.crop((0,0,1,canvas.height)),
                alpha.crop((canvas.width-1,0,canvas.width,canvas.height))]
        if any(edge.getextrema()[1] for edge in strips): raise SystemExit(f"Opaque export edge: {name}")
        results.append((name,canvas,(left+x0,y0,left+x1,y1)))
    return report,results

def make_previews(results):
    ARTIFACTS.mkdir(parents=True,exist_ok=True)
    for mode,background in (("ivory",(235,231,222,255)),("charcoal",(29,28,35,255))):
        board=Image.new("RGBA",(1320,900),background)
        draw=ImageDraw.Draw(board)
        for i,(name,portrait,_) in enumerate(results):
            sample=portrait.copy()
            sample.thumbnail((302,832),Image.Resampling.LANCZOS)
            x=i*330+(330-sample.width)//2
            board.alpha_composite(sample,(x,36+832-sample.height))
            draw.text((i*330+12,12),name,fill=(255,255,255) if mode=="charcoal" else (50,45,44))
        board.convert("RGB").save(ARTIFACTS/f"curator-check-{mode}.png")

def main():
    if not SOURCE.exists(): raise SystemExit("Missing approved curator-poses.png")
    with Image.open(SOURCE) as source: sheet=source.convert("RGBA")
    report,results=split(sheet)
    # Validate all four before replacing any exported assets.
    OUT.mkdir(parents=True,exist_ok=True)
    for name,portrait,_ in results: portrait.save(OUT/f"{name}.png",optimize=True)
    make_previews(results)
    AUDIT.parent.mkdir(parents=True,exist_ok=True)
    digest=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    lines=[
        "# Curator pose and alpha audit","",
        "Approved original: assets/curator-poses.png (preserved).",
        f"SHA-256: {digest}",
        f"Size: {sheet.width} x {sheet.height}; alpha extrema: {sheet.getchannel('A').getextrema()}",
        "","## Transparent split gutters",
        *["- "+s for s in report],"","## Generated assets",
        *[f"- assets/curator/{name}.png: {image.width}x{image.height}; source bbox {bounds}"
          for name,image,bounds in results],
        "","## Safeguards",
        "- No color thresholding, black-hair erasure, or AI re-drawing used.",
        "- Original image and source transparency pixels are preserved.",
        "- Source image and old legacy assets are not deleted.",
        "- Outer alpha edges and full character extents validated in code.",
        "- Ivory/charcoal previews exported for manual halo and matte inspection.",
        "- Visual identity, fringe and any residual matte still require image review.",""
    ]
    AUDIT.write_text("\n".join(lines),encoding="utf-8")
    print("\n".join(report))
    print("Exported poses:",[(n,p.size) for n,p,_ in results])
    print("Audit written:",AUDIT)

if __name__=="__main__": main()
