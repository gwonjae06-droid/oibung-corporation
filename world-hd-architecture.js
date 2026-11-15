/*
 * OIBUNG WORLD — Monumental high-density pixel architecture.
 *
 * Each building is drawn once to a cached transparent canvas. Thousands of
 * individually seeded stone, glass, roof, foliage and metal pixels are baked
 * into that sprite; the 60fps world only blits visible structures.
 *
 * This renderer never changes catalog IDs, entries, doors or review storage.
 */
(() => {
  'use strict';
  const cache=new Map();
  const palette={
    castle:{stone:'#5d5865',light:'#9f8999',dark:'#302b3b',roof:'#363047',gold:'#d8ba92',glass:'#ad596e',accent:'#d25872'},
    arena:{stone:'#a18a70',light:'#e9cfab',dark:'#5d4a42',roof:'#735b57',gold:'#f9d9a2',glass:'#5fd5d3',accent:'#47cfdb'},
    duel:{stone:'#7885a1',light:'#c1c6db',dark:'#343958',roof:'#333b60',gold:'#dfc4a4',glass:'#e8afaf',accent:'#dd8c91'},
    tactics:{stone:'#718577',light:'#c5caae',dark:'#394a43',roof:'#4f6153',gold:'#eed9a4',glass:'#a4d6b0',accent:'#9eddb9'},
    cat:{stone:'#c59bb2',light:'#f7d7e0',dark:'#77546d',roof:'#aa708b',gold:'#ffdeb3',glass:'#ffe6bc',accent:'#f8aaca'},
    studio:{stone:'#6c8490',light:'#c2d1ce',dark:'#344955',roof:'#345968',gold:'#eac8a5',glass:'#bde6dc',accent:'#f5b77f'},
    tower:{stone:'#8b8295',light:'#d4c5cb',dark:'#4c445e',roof:'#584c69',gold:'#f1d4ae',glass:'#e9d2a7',accent:'#eccb92'}
  };
  function hex(hex){
    const t=hex.replace('#','');
    return [0,2,4].map(i=>parseInt(t.slice(i,i+2),16));
  }
  function tone(base,shift){
    const a=hex(base);
    return '#'+a.map(x=>Math.max(0,Math.min(255,Math.round(x+shift))).toString(16).padStart(2,'0')).join('');
  }
  function rng(seed){
    let s=seed>>>0;
    return ()=>{s=Math.imul(s^s>>>15,1|s);s^=s+Math.imul(s^s>>>7,61|s);return((s^s>>>14)>>>0)/4294967296;};
  }
  function box(c,x,y,w,h,color){
    if(w<=0||h<=0)return;
    c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));
  }
  function path(c,points,color){
    if(points.length<3)return;
    c.fillStyle=color;c.beginPath();
    c.moveTo(Math.round(points[0][0]),Math.round(points[0][1]));
    for(let i=1;i<points.length;i++)c.lineTo(Math.round(points[i][0]),Math.round(points[i][1]));
    c.closePath();c.fill();
  }
  function stroke(c,x1,y1,x2,y2,color,size=1){
    c.strokeStyle=color;c.lineWidth=size;c.beginPath();
    c.moveTo(Math.round(x1)+.5,Math.round(y1)+.5);
    c.lineTo(Math.round(x2)+.5,Math.round(y2)+.5);c.stroke();
  }
  function ellipse(c,x,y,rx,ry,color){
    c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();
  }
  function grain(c,x,y,w,h,p,rand,amount=0.2){
    const count=Math.floor(w*h*amount);
    const shades=[tone(p.stone,-28),tone(p.stone,17),tone(p.stone,30),tone(p.stone,-12),p.light];
    for(let i=0;i<count;i++){
      const xx=Math.floor(x+rand()*w),yy=Math.floor(y+rand()*h);
      if(i%5===0)box(c,xx,yy,rand()*3+1,1,shades[i%shades.length]);
      else box(c,xx,yy,1,rand()*2+1,shades[i%shades.length]);
    }
  }
  function stone(c,x,y,w,h,p,rand,brickW=38,brickH=18){
    box(c,x,y,w,h,p.dark);
    for(let row=0;row<Math.ceil(h/brickH);row++){
      const yy=y+row*brickH;
      const start=((row&1)?-brickW*.5:0);
      for(let xx=x+start;xx<x+w;xx+=brickW){
        const x1=Math.max(x,xx),x2=Math.min(x+w,xx+brickW-1.5);
        if(x2<=x1)continue;
        const shade=(rand()-.5)*38;
        box(c,x1,yy,x2-x1,Math.min(brickH-2,y+h-yy),tone(p.stone,shade));
        box(c,x1,yy,x2-x1,1,tone(p.light,-12));
        box(c,x1,yy+brickH-3,x2-x1,1,tone(p.dark,20));
        box(c,x1+1,yy+1,1,Math.min(brickH-5,h),tone(p.light,-21));
        for(let j=0;j<12;j++){
          const sx=x1+1+rand()*(x2-x1-2),sy=yy+2+rand()*(brickH-5);
          if(sy<y+h)box(c,sx,sy,rand()<.7?1:2,1,j%3? tone(p.stone,shade-31):tone(p.stone,shade+39));
        }
        if(rand()<.13){
          const bx=x1+rand()*Math.max(2,x2-x1);
          stroke(c,bx,yy+3,bx-3,yy+brickH*.57,tone(p.dark,-5),1);
        }
      }
    }
    // Tiny irregular etched wear, added at a much finer pixel pitch.
    grain(c,x,y,w,h,p,rand,.035);
  }
  function stoneColumns(c,x,y,w,h,p,rand,count=5){
    for(let i=0;i<count;i++){
      const cx=x+(i+.5)*w/count;
      const cw=Math.max(9,w/count*.23);
      box(c,cx-cw/2,y+7,cw,h-12,p.stone);
      box(c,cx-cw/2,y+7,cw*.19,h-12,p.light);
      box(c,cx+cw*.34,y+7,cw*.14,h-12,p.dark);
      box(c,cx-cw*.78,y+1,cw*1.6,9,p.gold);
      box(c,cx-cw*.8,y+h-12,cw*1.65,10,p.light);
      for(let n=0;n<Math.min(60,h/3);n++){
        const xx=cx-cw*.32+rand()*cw*.55;
        box(c,xx,y+10+rand()*(h-22),1,2,n%3?p.dark:p.gold);
      }
    }
  }
  function cornice(c,x,y,w,p,step=1){
    box(c,x-6*step,y-2*step,w+12*step,5*step,p.dark);
    box(c,x-10*step,y+3*step,w+20*step,4*step,p.gold);
    box(c,x-3*step,y+7*step,w+6*step,3*step,p.light);
    for(let i=0;i<w;i+=14*step){
      box(c,x+i,y+10*step,9*step,6*step,p.stone);
      box(c,x+i+2*step,y+10*step,2*step,6*step,p.light);
    }
  }
  function windowArt(c,x,y,w,h,p,rand,kind='arch'){
    const e=3;
    // Cutout with stepped masonry voussoirs and a colored stained-glass core.
    box(c,x-8,y+10,w+16,h-8,p.dark);
    if(kind==='arch'){
      path(c,[[x-8,y+12],[x,y],[x+w*.5,y-15],[x+w,y],[x+w+8,y+12]],p.light);
      path(c,[[x-4,y+14],[x+w*.5,y-8],[x+w+4,y+14]],p.dark);
    }else{
      box(c,x-9,y-9,w+18,9,p.gold);
    }
    box(c,x,y+9,w,h-12,p.glass);
    for(let gx=1;gx<w-1;gx+=4){
      const reflection=rand()<.5?p.light:p.glass;
      if(rand()<.8)box(c,x+gx,y+10,1,Math.max(1,h-17),reflection);
    }
    for(let gy=19;gy<h-7;gy+=17){
      box(c,x+1,y+gy,w-2,2,p.dark);
      for(let gx=3;gx<w;gx+=12)box(c,x+gx,y+gy-12,3,3,p.gold);
    }
    box(c,x+w*.47,y+8,Math.max(2,w*.07),h-10,p.dark);
    box(c,x+w*.47+2,y+8,1,h-10,p.gold);
    box(c,x-10,y+h,w+20,4,p.light);
    box(c,x-12,y+h+4,w+24,4,p.dark);
  }
  function banner(c,x,y,height,p,rand){
    box(c,x,y,3,height,p.gold);
    box(c,x+4,y+13,30,height*.58,p.accent);
    path(c,[[x+4,y+13+height*.58],[x+19,y+height*.47],[x+34,y+13+height*.58]],p.accent);
    box(c,x+6,y+14,4,height*.5,p.light);
    box(c,x+10,y+20,22,2,p.gold);
    box(c,x+11,y+26,20,2,p.dark);
    box(c,x+17,y+36,9,19,p.gold);
    box(c,x+9,y+45,25,2,p.gold);
    for(let i=0;i<7;i++)box(c,x+12+rand()*19,y+50+rand()*height*.35,1,1,p.light);
  }
  function roof(c,x,y,w,h,p,rand,kind='slate'){
    const top=kind==='dome'?y+h*.18:y;
    if(kind==='dome'){
      ellipse(c,x+w/2,y+h*.8,w*.52,h*.77,p.roof);
      box(c,x,y+h*.65,w,h*.35,p.roof);
    }else{
      path(c,[[x-16,y+h],[x+w/2,top-12],[x+w+16,y+h]],p.roof);
      path(c,[[x+w/2,top-12],[x+w+16,y+h],[x+w-6,y+h]],tone(p.roof,-19));
      path(c,[[x-16,y+h],[x+w/2,top-12],[x+w*.52,top-7],[x+7,y+h]],tone(p.roof,19));
    }
    for(let row=0;row<Math.ceil(h/7);row++){
      const yy=top+row*7;
      for(let col=0;col<Math.ceil(w/13);col++){
        const xx=x+col*13+(row%2)*7;
        if(rand()<.58){
          box(c,xx,yy,7,1,rand()>.5?tone(p.roof,35):tone(p.roof,-24));
          if(rand()>.8)box(c,xx+2,yy+2,2,2,p.light);
        }
      }
    }
    box(c,x-18,y+h-1,w+36,5,p.gold);
    box(c,x-15,y+h+4,w+30,4,p.dark);
  }
  function stair(c,x,y,w,p){
    for(let s=0;s<4;s++){
      box(c,x-s*13,y+s*6,w+s*26,7,tone(p.stone,s*8-5));
      box(c,x-s*13,y+s*6,w+s*26,1,p.light);
    }
  }
  function portal(c,mid,base,p,rand){
    const w=99,h=139,x=mid-w/2,y=base-h;
    box(c,x-12,y+10,w+24,h-5,p.dark);
    for(let i=0;i<9;i++){
      const a=x-16+i*(w+32)/8;
      box(c,a,y+6,4,8,p.gold);
      box(c,a,y+15,2,9,p.light);
    }
    path(c,[[x-15,y+22],[mid,y-34],[x+w+15,y+22]],p.gold);
    path(c,[[x-4,y+17],[mid,y-21],[x+w+4,y+17]],p.dark);
    box(c,x+3,y+19,w-6,h-19,'#151923');
    box(c,x+10,y+22,w/2-13,h-23,tone(p.roof,-21));
    box(c,mid+3,y+22,w/2-13,h-23,tone(p.roof,-34));
    box(c,mid-3,y+30,4,h-31,p.gold);
    box(c,x+18,y+47,5,59,tone(p.gold,-16));
    box(c,x+w-23,y+47,5,59,tone(p.gold,-16));
    box(c,x-9,y+20,8,h-20,p.stone);
    box(c,x+w,y+20,8,h-20,p.stone);
    box(c,x+6,y+h-15,w-12,15,p.dark);
    box(c,mid+28,y+h-70,6,7,p.gold);
    // Intricate entry lintel, step corners, reflective pixels.
    for(let i=0;i<21;i++){
      const xx=x+rand()*w;
      box(c,xx,y+29+rand()*68,1,rand()*4+1,rand()>.5?p.gold:p.light);
    }
    stair(c,x-34,base-11,w+68,p);
  }
  function castle(c,W,H,b,p,rand,base){
    const mid=W/2,w=b.width,top=base-b.height;
    // Far towers give the silhouette scale beyond the main facade.
    for(const [xx,ht,tw] of [[mid-w*.53,b.height*.83,w*.19],[mid+w*.35,b.height*.91,w*.21],[mid-w*.16,b.height*.98,w*.25]]){
      stone(c,xx,base-ht,tw,ht,p,rand,27,16);
      for(let n=0;n<6;n++)box(c,xx+n*tw/6,base-ht-10,tw/9,11,p.dark);
      roof(c,xx-12,base-ht-84,tw+24,88,p,rand);
      for(let n=0;n<3;n++)windowArt(c,xx+tw*.34,base-ht+60+n*100,tw*.3,37,p,rand);
    }
    // Monumental central keep with deeply recessed stone and ornamented arches.
    stone(c,mid-w*.43,base-b.height*.79,w*.86,b.height*.78,p,rand,46,23);
    box(c,mid-w*.43,base-b.height*.79,w*.09,b.height*.78,tone(p.stone,-30));
    box(c,mid+w*.34,base-b.height*.79,w*.09,b.height*.78,tone(p.stone,-25));
    for(let y=base-b.height*.74;y<base-170;y+=122){
      for(let i=0;i<4;i++)windowArt(c,mid-w*.32+i*w*.215,y,w*.13,65,p,rand);
    }
    roof(c,mid-w*.45,base-b.height*.84,w*.9,89,p,rand);
    cornice(c,mid-w*.45,base-b.height*.61,w*.9,p,1.3);
    for(let i=0;i<6;i++)banner(c,mid-w*.42+i*(w*.84)/5,base-b.height*.58,69,p,rand);
    // Gothic flying buttresses, fractured statues and metallic relief.
    for(const sign of [-1,1]){
      const bx=mid+sign*w*.47;
      stone(c,bx-27,base-b.height*.53,54,b.height*.52,p,rand,28,16);
      roof(c,bx-30,base-b.height*.62,60,59,p,rand);
      box(c,bx-sign*3,base-b.height*.59,5,b.height*.25,p.light);
      for(let n=0;n<4;n++)windowArt(c,bx-13,base-b.height*.46+n*73,26,35,p,rand);
    }
  }
  function arena(c,W,H,b,p,rand,base){
    const mid=W/2,w=b.width,ht=b.height,top=base-ht;
    // Roman scale stadium: three tiered galleries with full colonnades.
    for(let tier=0;tier<3;tier++){
      const inset=tier*35,y=top+105+tier*145;
      stone(c,mid-w*.49+inset,y,w*.98-inset*2,base-y,p,rand,40,18);
      cornice(c,mid-w*.49+inset,y+3,w*.98-inset*2,p,1.1);
      const cells=9-tier;
      const w1=w*.92-inset*2;
      for(let i=0;i<cells;i++){
        const x=mid-w1/2+i*w1/cells;
        windowArt(c,x+6,y+33,w1/cells-18,65,p,rand);
      }
      stoneColumns(c,mid-w*.45+inset,y+9,w*.90-inset*2,139,p,rand,10-tier);
    }
    roof(c,mid-w*.35,top+10,w*.7,106,p,rand,'dome');
    stone(c,mid-w*.12,top-33,w*.24,86,p,rand,25,17);
    roof(c,mid-w*.14,top-82,w*.28,60,p,rand,'dome');
    cornice(c,mid-w*.52,base-81,w*1.04,p,1.4);
    for(let i=0;i<5;i++)banner(c,mid-w*.4+i*w*.2,base-198,73,p,rand);
    for(let i=0;i<16;i++){
      const a=i*Math.PI*2/16,rad=w*.39;
      const x=mid+Math.cos(a)*rad,y=top+99+Math.sin(a)*9;
      ellipse(c,x,y,rand()*4+2,rand()*3+2,i%2?p.gold:p.accent);
    }
  }
  function duel(c,W,H,b,p,rand,base){
    const mid=W/2,w=b.width,ht=b.height,top=base-ht;
    stone(c,mid-w*.45,top+114,w*.9,ht-110,p,rand,34,16);
    for(let tier=0;tier<4;tier++){
      const inset=tier*38,yy=base-ht*.26-tier*ht*.21;
      const ww=w-inset*2;
      roof(c,mid-ww*.5,yy-84,ww,92,p,rand);
      cornice(c,mid-ww*.5,yy+8,ww,p,.9);
      stoneColumns(c,mid-ww*.41,yy+25,ww*.82,Math.min(95,base-yy-29),p,rand,Math.max(4,10-tier*2));
      for(let n=0;n<5-tier;n++)windowArt(c,mid-ww*.37+n*ww*.17,yy+23,ww*.1,39,p,rand,'square');
    }
    // Crossed steel blades at the highest hall.
    for(const sign of [-1,1]){
      const x=mid+sign*45;
      stroke(c,x,top+72,mid-sign*80,top-27,p.light,9);
      stroke(c,x-2,top+73,mid-sign*83,top-26,p.gold,2);
      stroke(c,mid+sign*20,top+35,mid+sign*79,top+35,p.gold,8);
    }
    banner(c,mid-w*.44,top+67,122,p,rand);
    banner(c,mid+w*.42,top+67,122,p,rand);
  }
  function tactics(c,W,H,b,p,rand,base){
    const mid=W/2,w=b.width,ht=b.height,top=base-ht;
    stone(c,mid-w*.44,top+185,w*.88,ht-185,p,rand,35,16);
    for(const sign of [-1,1]){
      const tx=mid+sign*w*.31;
      stone(c,tx-w*.14,top+80,w*.28,ht-82,p,rand,37,18);
      roof(c,tx-w*.16,top+5,w*.32,88,p,rand);
      banner(c,tx,top-61,71,p,rand);
      for(let i=0;i<3;i++)windowArt(c,tx-24,top+148+i*111,48,51,p,rand);
    }
    stone(c,mid-w*.17,top+29,w*.34,ht-30,p,rand,32,16);
    roof(c,mid-w*.19,top-48,w*.38,90,p,rand,'dome');
    for(let i=0;i<5;i++){
      windowArt(c,mid-w*.35+i*w*.14,base-230,w*.09,79,p,rand);
    }
    cornice(c,mid-w*.43,base-270,w*.86,p,1.3);
    // Headquarters map/flag insignia and observatory aerials.
    box(c,mid-34,top+101,68,50,p.dark);
    box(c,mid-25,top+110,50,32,p.glass);
    for(let i=0;i<7;i++){
      stroke(c,mid-20+i*6,top+113,mid-27+i*10,top+136,p.gold,1);
    }
  }
  function cat(c,W,H,b,p,rand,base){
    const mid=W/2,w=b.width,ht=b.height,top=base-ht;
    stone(c,mid-w*.44,top+116,w*.88,ht-114,p,rand,33,18);
    // Two expressive cat-ear roof turrets with plush detail and shadow.
    path(c,[[mid-w*.45,top+130],[mid-w*.46,top-45],[mid-w*.10,top+107]],p.roof);
    path(c,[[mid+w*.46,top+130],[mid+w*.46,top-45],[mid+w*.10,top+107]],p.roof);
    path(c,[[mid-w*.40,top+105],[mid-w*.41,top-17],[mid-w*.18,top+87]],p.accent);
    path(c,[[mid+w*.40,top+105],[mid+w*.41,top-17],[mid+w*.18,top+87]],p.accent);
    roof(c,mid-w*.48,top+103,w*.96,85,p,rand);
    for(let row=0;row<3;row++)
      for(let i=0;i<6;i++)windowArt(c,mid-w*.38+i*w*.135,top+204+row*111,w*.08,58,p,rand);
    for(let i=0;i<7;i++){
      const x=mid-w*.37+i*w*.123;
      ellipse(c,x,top+168,4,6,i%2?p.gold:p.accent);
      box(c,x-2,top+168,2,9,p.light);
    }
    // Cat medallion in the second floor tympanum.
    ellipse(c,mid,top+165,35,31,p.gold);
    ellipse(c,mid,top+167,25,23,p.light);
    path(c,[[mid-23,top+150],[mid-25,top+130],[mid-7,top+149]],p.light);
    path(c,[[mid+23,top+150],[mid+25,top+130],[mid+7,top+149]],p.light);
    box(c,mid-12,top+163,7,4,p.dark);box(c,mid+6,top+163,7,4,p.dark);
    box(c,mid-2,top+171,4,4,p.accent);
  }
  function generic(c,W,H,b,p,rand,base){
    const mid=W/2,w=b.width,ht=b.height,top=base-ht;
    stone(c,mid-w*.44,top+138,w*.88,ht-132,p,rand,41,19);
    roof(c,mid-w*.50,top+41,w,103,p,rand,b.style==='tower'?'dome':'slate');
    stone(c,mid-w*.17,top+11,w*.34,156,p,rand,27,16);
    roof(c,mid-w*.20,top-90,w*.4,105,p,rand,b.style==='tower'?'dome':'slate');
    cornice(c,mid-w*.46,top+248,w*.92,p,1.3);
    for(let row=0;row<3;row++)
      for(let i=0;i<5;i++)windowArt(c,mid-w*.36+i*w*.17,top+192+row*137,w*.09,60,p,rand);
    for(let side of [-1,1])banner(c,mid+side*w*.40,top+260,90,p,rand);
    stoneColumns(c,mid-w*.40,base-235,w*.80,195,p,rand,8);
  }
  function makeBuilding(b){
    const p=palette[b.style]||palette.studio;
    const w=Math.round(b.width+170),h=Math.round(b.height+126);
    const surface=document.createElement('canvas');
    surface.width=w;surface.height=h;
    const c=surface.getContext('2d',{alpha:true});
    const random=rng((b.seed>>>0)||71);
    const base=h-24;
    // Distant buttress, side walls and roof foundations.
    box(c,28,base-21,w-56,22,p.dark);
    box(c,24,base-18,w-48,7,p.light);
    const fn={castle,arena,duel,tactics,cat,studio:generic,tower:generic}[b.style]||generic;
    fn(c,w,h,b,p,random,base);
    portal(c,w/2,base,p,random);
    for(let i=0;i<8;i++){
      const x=55+(i+.5)*(w-110)/8;
      box(c,x,base-13,9,12,p.stone);
      box(c,x,base-13,7,1,p.light);
    }
    // Ornate wrought-iron fence and foreground planter.
    for(const side of [-1,1]){
      const x=w/2+side*(b.width*.40);
      for(let i=0;i<9;i++){
        const dx=x+side*i*8;
        box(c,dx,base-42,2,36,p.dark);
        box(c,dx-1,base-44,4,4,p.gold);
      }
      for(let i=0;i<16;i++){
        const xx=x+side*12+side*random()*70,yy=base-15-random()*33;
        box(c,xx,yy,random()*4+1,random()*5+2,i%4?p.light:p.accent);
      }
    }
    // Store footprint and roof height to keep the game's real entrance centered.
    surface.buildingInfo={base,width:w,height:h};
    return surface;
  }
  function get(b){
    const key=b.style+':'+b.width+':'+b.height+':'+b.seed;
    if(cache.has(key))return cache.get(key);
    const sprite=makeBuilding(b);
    // Bound cache when a lot of externally registered games appear.
    if(cache.size>25)cache.delete(cache.keys().next().value);
    cache.set(key,sprite);
    return sprite;
  }
  function render(c,b,camera,groundY,scale,elapsed){
    const sprite=get(b);
    const mx=b.x+b.width*.5-camera;
    const bx=Math.round(mx-sprite.width*scale/2);
    const by=Math.round(groundY-sprite.buildingInfo.base*scale);
    c.save();
    c.imageSmoothingEnabled=false;
    c.drawImage(sprite,bx,by,Math.ceil(sprite.width*scale),Math.ceil(sprite.height*scale));
    c.restore();
    // Animated window glow/dust motes in just the visible area.
    const y=groundY-b.height*.55*scale;
    for(let i=0;i<8;i++){
      const t=elapsed*(.21+i*.06),h=b.seed%(i+51);
      const xx=mx+Math.sin(t*2+i*5+h)*b.width*.24*scale;
      const yy=y+Math.cos(t*1.3+i+h)*b.height*.17*scale;
      const alpha=Math.max(.1,Math.min(.55,(Math.sin(t*3+i*3)+1)*.24));
      c.fillStyle=b.style==='castle'? 'rgba(253,158,123,'+alpha+')':'rgba(255,224,165,'+alpha+')';
      c.fillRect(Math.round(xx),Math.round(yy),i%3===0?2:1,i%4===0?2:1);
    }
  }
  // Export as a pure world renderer; existing catalog / movement remain in
  // the original oibung-world.js engine.
  window.OIBUNG_HD_ARCHITECTURE={render,get,palette,cacheSize:()=>cache.size};
})();
