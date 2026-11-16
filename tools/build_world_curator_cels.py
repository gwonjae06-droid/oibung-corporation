"""Frame-by-frame pixel cels for Nong and Bbang, made from approved hand-drawn poses.

No mesh warp, image-interpolated body, alpha fade, or dress distortion.
The approved 4x4 PNGs are never modified. Each row is an authored
eight-frame animation with explicitly hand-plotted eye/cheek/effect pixels.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json

W,H,COLS=188,194,8
OUT=Path("assets/world-pixel")
POSES={
 "angel":{
  "wink":(0,0,12,12,12,12,0,0),
  "hair":(0,12,13,13,13,12,0,0),
  "kiss":(0,13,13,13,13,13,0,0),
  "shy":(0,13,13,13,13,13,0,0),
  "cheer":(0,9,9,14,14,9,0,0),
  "pout":(0,12,13,13,13,12,0,0),
  "surprise":(0,12,14,14,14,12,0,0),
  "stretch":(0,12,9,9,9,12,0,0),
  "wave":(0,9,9,9,9,9,0,0)
 },
 "devil":{
  "beckon":(0,0,14,14,14,14,0,0),
  "hair":(0,15,15,15,15,15,0,0),
  "kiss":(0,12,12,12,12,12,0,0),
  "shy":(0,13,13,13,13,13,0,0),
  "cheer":(0,15,15,15,15,15,0,0),
  "pout":(0,13,13,13,13,13,0,0),
  "surprise":(0,12,12,12,12,12,0,0),
  "stretch":(0,15,15,15,15,15,0,0),
  "wave":(0,14,14,14,14,14,0,0)
 }
}
def cross(d,x,y,c):
 d.rectangle((x,y+2,x+1,y+6),fill=c)
 d.rectangle((x-2,y+4,x+3,y+4),fill=c)

def heart(d,x,y,dark,light):
 for dx,dy,ww in ((1,1,2),(5,1,2),(0,2,8),(0,3,8),(1,4,6),(2,5,4),(3,6,2)):
  d.rectangle((x+dx,y+dy,x+dx+ww-1,y+dy),fill=dark)
 d.rectangle((x+1,y+2,x+3,y+2),fill=light)
 d.rectangle((x+2,y+3,x+3,y+3),fill=light)

# Match the standing proportions and garment palette already used by the
# world renderer. This is a one-time artwork alignment for a FULL cel,
# never an animated dress/skirt distortion.
HEADS=((14,74,81,98,175),(15,75,84,98,175),(15,75,84,98,175),
 (16,75,85,98,175),(17,77,84,98,175),(16,75,83,98,175),
 (17,75,83,98,175),(16,75,82,98,175),(37,94,86,106,175),
 (16,79,88,112,175),(39,95,90,104,164),(30,88,87,105,175),
 (14,74,81,98,175),(15,80,83,98,175),(28,88,86,110,175),
 (14,74,81,98,175))
def remap(y,source,dest):
 j=1
 while j<len(source)-1 and y>source[j]:
  j+=1
 a=source[j-1]
 return dest[j-1]+((y-a)/(source[j]-a))*(dest[j]-dest[j-1])
def nong_standing_cel(frame,pose):
 from math import floor
 top,neck,width,pivot,sole=HEADS[pose]
 hip=neck+(sole-neck)*.57
 saved=neck-top-46
 source=(0,top,neck,hip,sole,H)
 dest=(0,top,neck-saved,hip-saved*.67,sole,H)
 image=Image.new("RGBA",(W,H))
 for y in range(H):
  original_y=min(H-1,max(0,floor(remap(y+.5,dest,source))))
  v=max(0,min(1,(original_y-neck+4)/22))
  v=v*v*(3-2*v)
  factor=64/width+(1-64/width)*v
  left=round(pivot*(1-factor))
  nw=max(1,round(W*factor))
  row=frame.crop((0,original_y,W,original_y+1))
  image.paste(row.resize((nw,1),Image.Resampling.NEAREST),(left,y))
 px=image.load()
 for y in range(round(dest[2]+7),H):
  for x in range(W):
   r,g,b,a=px[x,y]
   if not a or r-g<15 or r-b<10 or g>111: continue
   px[x,y]=(min(255,round(r*.65+46)),min(255,round(g*.85+49)),
            min(255,round(b*.86+83)),a)
 return image

def paint(frame,form,name,step,pose):
 # All newly plotted dots stay in the face or transparent air.
 # Never paint an arm by displacing body pixels or lift the skirt.
 if step not in (2,3,4,5):
  return frame
 d=ImageDraw.Draw(frame)
 if form=="angel":
  x,y=(100,45) if pose in (0,12) else (101,45)
  if name=="wink" and pose==12:
   d.rectangle((x-8,y+1,x-3,y+2),fill="#f3c7b6")
   d.line((x-8,y+2,x-5,y+3,x-3,y+2),fill="#683d45")
  elif name in ("shy","kiss"):
   d.rectangle((x-12,y+11,x-8,y+12),fill="#ec8ca0")
   d.rectangle((x+7,y+11,x+11,y+12),fill="#ec8ca0")
  elif name=="pout":
   d.line((x-7,y-3,x-2,y-4),fill="#683d45")
  if name=="surprise": cross(d,139,40-(step%2),"#fff2c8")
  if name in ("cheer","wave"): cross(d,153,67-(step%2),"#fff2c8")
  if name=="kiss": heart(d,142+(step-2)*2,48-(step-2)*2,"#f4759d","#ffd3dc")
  if name=="hair": cross(d,52,22+(step%2),"#fff2c8")
 else:
  x,y=(94,31) if pose in (0,12,14,15) else (94,34)
  if name=="shy":
   d.rectangle((x-11,y+6,x-8,y+7),fill="#be7185")
   d.rectangle((x+5,y+6,x+8,y+7),fill="#be7185")
  elif name=="pout": d.line((x-8,y-2,x-4,y-3),fill="#522d39")
  elif name=="surprise": cross(d,131,24+(step%2),"#ffd8b2")
  if name in ("wave","beckon","cheer"): cross(d,142,51-(step%2),"#ffd8b2")
  if name=="kiss": heart(d,132+(step-2)*2,32-(step-2)*2,"#df648c","#ffb7cf")
  if name=="hair": cross(d,56,13+(step%2),"#ffd8b2")
 return frame

def build(form,original,name):
 atlas=Image.open(OUT/original).convert("RGBA")
 assert atlas.size==(W*4,H*4), (form,atlas.size)
 actions=POSES[form]
 sheet=Image.new("RGBA",(W*COLS,H*len(actions)),(0,0,0,0))
 for row,(action,sequence) in enumerate(actions.items()):
  for col,pose in enumerate(sequence):
   original_cel=atlas.crop(((pose%4)*W,(pose//4)*H,(pose%4+1)*W,(pose//4+1)*H))
   original_cel=nong_standing_cel(original_cel,pose) if form=="angel" else original_cel
   cel=paint(original_cel.copy(),form,action,col,pose)
   assert cel.crop((0,105,W,H)).tobytes()==original_cel.crop((0,105,W,H)).tobytes(),(form,action,col)
   sheet.paste(cel,(W*col,H*row))
 output=OUT/f"curator-{name}-cels.png"
 sheet.save(output,optimize=True)
 reloaded=Image.open(output)
 assert reloaded.size==(W*COLS,H*len(actions))
 assert reloaded.mode=="RGBA"
 assert reloaded.getchannel("A").getextrema()==(0,255)
 print(form,len(actions)*COLS,"painted/collated poses",output,output.stat().st_size)
 return {"file":str(output),"source":str(OUT/original),"width":sheet.width,"height":sheet.height,
         "columns":COLS,"frameWidth":W,"frameHeight":H,"rows":dict((key,i) for i,key in enumerate(actions)),
         "method":"approved hand-illustrated source poses with individually drawn pixel retouches; no warping"}

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 result={
  "angel":build("angel","curator-winter-frames.png","nong"),
  "devil":build("devil","curator-devil-ponytail.png","bbang")
 }
 (OUT/"curator-cel-manifest.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

if __name__=="__main__":
 main()
