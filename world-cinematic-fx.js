/*
 * OIBUNG WORLD · Cinematic pixel environment
 *
 * A completely self-contained procedural art direction layer: no new network
 * calls, external image dependencies, new DOM panels or database changes.
 * Expensive mountains, botanical sprites, masonry and sky decor are rasterized
 * once, and the existing Canvas 2D scene only draws visible cached art.
 */
(() => {
  'use strict';
  const TWO_PI=Math.PI*2;
  const cache=new Map();
  const seedRandom=(seed)=>{
    let v=seed>>>0;
    return ()=>{v^=v<<13;v^=v>>>17;v^=v<<5;return (v>>>0)/4294967296;};
  };
  const box=(c,x,y,w,h,fill)=>{
    if(w<=0||h<=0)return;
    c.fillStyle=fill;c.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));
  };
  const poly=(c,points,fill)=>{
    c.fillStyle=fill;c.beginPath();c.moveTo(points[0][0],points[0][1]);
    for(let i=1;i<points.length;i++)c.lineTo(points[i][0],points[i][1]);
    c.closePath();c.fill();
  };
  const orb=(c,x,y,rx,ry,fill)=>{
    c.fillStyle=fill;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TWO_PI);c.fill();
  };
  const tile=(key,builder)=>{
    if(cache.has(key))return cache.get(key);
    const image=builder();cache.set(key,image);return image;
  };
  function surface(w,h,draw){
    const image=document.createElement('canvas');image.width=w;image.height=h;
    const c=image.getContext('2d',{alpha:true});c.imageSmoothingEnabled=false;
    draw(c,w,h);return image;
  }
  function palette(hex,delta){
    const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
    return '#'+channels.map(n=>Math.max(0,Math.min(255,n+delta)).toString(16).padStart(2,'0')).join('');
  }
  function skyCloud(){
    return tile('sky-cloud-v2',()=>surface(286,83,(c)=>{
      // Restrained banks of peach-gray cloud shadows instead of noisy
      // uniform blobs. All geometry stays pixel-sharp at game resolution.
      const r=seedRandom(231);
      for(let layer=0;layer<3;layer++){
        const yy=28+layer*10;
        const col=['#776e92','#b7a3b5','#e0c7c3'][layer];
        for(let i=0;i<17;i++){
          const x=9+i*16+(r()-.5)*8;
          const y=yy+Math.sin(i*.86+layer)*9+(r()-.5)*7;
          const h=12+r()*14,w=16+r()*26;
          orb(c,x,y,w*.55,h*.55,col);
          box(c,x-w*.38,y+h*.20,w*.83,h*.18,col);
        }
      }
      for(let i=0;i<68;i++){
        const x=r()*277,y=25+r()*42;
        box(c,x,y,2+r()*5,1,i%3?'#ceb4c0':'#f5d5c5');
      }
    }));
  }
  function artPlate(name){
    const art=window.OIBUNG_CINEMATIC_ART;
    if(!art?.ready(name))return null;
    return tile('scenic-'+name,()=>{
      const source=art.images[name];
      return surface(source.naturalWidth,source.naturalHeight,(c,w,h)=>{
        c.drawImage(source,0,0);
        c.globalCompositeOperation='destination-in';
        const g=c.createRadialGradient(w*.52,h*.52,w*.18,w*.52,h*.52,w*.69);
        g.addColorStop(0,'rgba(0,0,0,1)');
        g.addColorStop(.59,'rgba(0,0,0,.96)');
        g.addColorStop(.82,'rgba(0,0,0,.53)');
        g.addColorStop(1,'rgba(0,0,0,0)');
        c.fillStyle=g;c.fillRect(0,0,w,h);
        c.globalCompositeOperation='source-over';
      });
    });
  }
  function tallPine(seed=27){
    const key='pine'+seed;
    return tile(key,()=>surface(92,182,(c)=>{
      const r=seedRandom(seed);
      box(c,42,60,10,120,'#342f38');
      box(c,44,74,2,101,'#856c64');
      for(let level=0;level<10;level++){
        const top=8+level*12;
        const spread=10+level*3.6;
        poly(c,[[46,top-12],[46-spread,top+34],[46+spread,top+34]],level%2?'#364c51':'#41615d');
        box(c,46-spread*.6,top+22,spread*1.15,4,'#264242');
        for(let k=0;k<13;k++){
          const x=46+(r()-.5)*spread*1.7,y=top+10+r()*21;
          box(c,x,y,2+r()*3,1+r()*2,k%3?'#678778':'#a8a68b');
        }
      }
    }));
  }
  function gardenTree(seed=21){
    const key='tree'+seed;
    return tile(key,()=>surface(158,196,(c)=>{
      const r=seedRandom(seed);
      box(c,72,62,15,134,'#433845');
      box(c,77,64,4,123,'#806775');
      poly(c,[[80,125],[39,81],[42,77],[76,106]],'#665261');
      poly(c,[[83,116],[124,66],[126,72],[91,123]],'#6b5366');
      for(let layer=0;layer<3;layer++){
        for(let i=0;i<80;i++){
          const angle=r()*TWO_PI;
          const rad=Math.sqrt(r())*69;
          const x=79+Math.cos(angle)*rad,y=66+Math.sin(angle)*rad*.69;
          const size=5+r()*13;
          const leaves=layer===0?'#465c5b':layer===1?'#b66f94':'#eaaac0';
          orb(c,x,y,size,size*.7,leaves);
        }
      }
      for(let i=0;i<175;i++){
        const angle=r()*TWO_PI,rad=Math.sqrt(r())*72;
        box(c,79+Math.cos(angle)*rad,60+Math.sin(angle)*rad*.7,
          1+r()*3,1+r()*3,i%5?'#f6c8ce':'#ffe8d3');
      }
    }));
  }
  function lantern(){
    return tile('lantern',()=>surface(54,160,(c)=>{
      // Ornate lantern, iron filigree and individual illuminated glass panes.
      box(c,24,60,5,99,'#2b343e');
      box(c,25,61,1,97,'#bca582');
      box(c,15,152,24,6,'#33303a');
      box(c,20,147,14,7,'#bba07e');
      box(c,21,52,12,9,'#383844');
      box(c,11,43,33,6,'#383841');
      box(c,14,47,27,34,'#695c57');
      box(c,18,48,18,29,'#ffd9a1');
      box(c,20,51,13,25,'#fff1c5');
      box(c,22,54,6,20,'#fffce2');
      box(c,18,49,3,30,'#5e4c48');
      box(c,31,49,3,30,'#634a48');
      box(c,14,78,27,4,'#343444');
      poly(c,[[10,45],[26,27],[44,45]],'#4c4149');
      poly(c,[[16,43],[26,32],[37,43]],'#b9a181');
      box(c,24,22,4,10,'#d3ad77');
      orb(c,26,19,5,6,'#e9ca97');
      for(let i=0;i<5;i++)box(c,15+i*6,83,3,2,'#d4ae78');
      box(c,24,93,1,59,'#d8b88a');
    }));
  }
  function nearGarden(){
    return tile('garden',()=>surface(260,86,(c)=>{
      const r=seedRandom(38813);
      // Ground-cover leaves and tiny blooming clusters.
      for(let i=0;i<160;i++){
        const x=r()*260,y=33+r()*51;
        const h=5+r()*24;
        poly(c,[[x,y+h*.27],[x-3-r()*7,y-h*.45],[x+3,y-h*.3]],i%2?'#47726b':'#739684');
        box(c,x,y,2,h*.65,i%3?'#557c65':'#2e615e');
      }
      for(let i=0;i<54;i++){
        const x=r()*260,y=31+r()*39,rad=2+r()*4;
        orb(c,x,y,rad,rad*.77,i%3===0?'#ffcbb9':'#e59eb5');
        orb(c,x+rad,y+1,rad*.8,rad*.8,i%3===1?'#ffcbb9':'#cf789d');
        box(c,x,y,2,2,'#fce5a8');
      }
      for(let i=0;i<30;i++)box(c,r()*260,44+r()*34,2,1,'#b8b48b');
    }));
  }
  function distantMountains(){
    return tile('mountains',()=>surface(1400,290,(c,W,H)=>{
      const r=seedRandom(9942);
      const layers=[
        {base:227,top:'#6d607e',shade:'#74657e',light:'#ad9ab3',snow:'#e5c9d6',opacity:.83},
        {base:271,top:'#434960',shade:'#414b60',light:'#74869a',snow:'#b5b3bd',opacity:1}
      ];
      for(let layer=0;layer<layers.length;layer++){
        const p=layers[layer],startX=-90;
        for(let i=0;i<11;i++){
          const width=180+r()*180,x=startX+i*140+(r()-.5)*54;
          const peak=p.base-42-r()*127;
          poly(c,[[x-80,p.base],[x+width*.42,peak],[x+width+80,p.base]],p.top);
          poly(c,[[x+width*.42,peak],[x+width+80,p.base],[x+width*.52,p.base]],p.shade);
          poly(c,[[x+width*.42,peak],[x+width*.42-27,peak+39],
                 [x+width*.42+9,peak+32],[x+width*.42+32,peak+53]],p.snow);
          for(let j=0;j<120;j++){
            const xx=x+r()*width,yyy=peak+25+r()*(p.base-peak-25);
            const lineY=peak+(Math.abs(xx-(x+width*.42))/width)*(p.base-peak)*1.75;
            if(yyy<lineY||yyy>p.base-5)continue;
            box(c,xx,yyy,1+r()*4,1+r()*3,j%6===0?p.light:p.shade);
          }
        }
        box(c,0,p.base,W,H-p.base,p.top);
      }
      // Recessed aqueducts and distant lit castle windows.
      for(let i=0;i<17;i++){
        const x=i*87+22;
        box(c,x,181,10,88,'#47465d');
        box(c,x+7,184,2,76,'#8c8391');
        poly(c,[[x-13,188],[x+5,169],[x+23,188]],'#363d56');
        box(c,x+1,195,3,7,i%2?'#e2c4a9':'#dac8b0');
      }
    }));
  }
  function floatingPalace(){
    return tile('floating-palace',()=>surface(260,170,(c)=>{
      const r=seedRandom(802);
      // Island fragment, waterfalls and a distant fairytale cathedral.
      poly(c,[[23,116],[218,116],[173,148],[116,165],[60,151]],'#4c4863');
      poly(c,[[35,119],[213,119],[176,137],[97,153]],'#79708a');
      for(let i=0;i<12;i++){
        const x=40+i*15;
        box(c,x,122,2,12+r()*25,i%2?'#c6d3d8':'#92b6cc');
        box(c,x+2,122,1,16+r()*38,'#ecf0e5');
      }
      box(c,69,67,145,48,'#bca5a2');
      for(let i=0;i<7;i++){
        const x=74+i*20,h=25+(i%3)*15;
        box(c,x,78-h,13,h+37,'#b9a9b5');
        poly(c,[[x-5,78-h],[x+6,57-h],[x+20,78-h]],'#7c7293');
        box(c,x+5,83-h,4,5,'#ffe6b5');
        box(c,x+5,96-h,3,6,'#ffe6b5');
      }
      poly(c,[[61,73],[136,31],[221,73]],'#82768e');
      box(c,109,14,8,35,'#b6a4b4');
      poly(c,[[104,15],[113,0],[124,15]],'#f2d7b0');
      for(let i=0;i<18;i++){
        const x=65+r()*142,y=32+r()*70;
        box(c,x,y,2,2,'#eedbb9');
      }
    }));
  }
  function sky(ctx,{W,groundY,camera,elapsed,castleStrength=0,reducedMotion=false}){
    const scenic=artPlate('night_skyline');
    if(castleStrength>.03&&scenic){
      // Original painted skyline fades into the rest of the procedurally
      // generated world. Soft alpha is confined to the DISTANT sky only.
      ctx.save();
      ctx.globalAlpha=.83*castleStrength;
      const w=Math.min(590,Math.max(370,W*.49)),h=w*.88;
      const x=Math.round(W*.045-camera*.047),y=Math.round(Math.max(-35,groundY*.055));
      ctx.imageSmoothingEnabled=true;
      ctx.drawImage(scenic,x,y,Math.round(w),Math.round(h));
      ctx.restore();
    }
    const cloud=skyCloud();
    for(let layer=0;layer<2;layer++){
      const interval=500+layer*155;
      const scroll=camera*(.043+layer*.038)+(reducedMotion?0:elapsed*(.69+layer*.47));
      const drift=Math.floor(((scroll%interval)+interval)%interval);
      ctx.save();ctx.globalAlpha=[.12,.16][layer];
      for(let x=-interval;x<W+interval;x+=interval){
        const destX=x-drift;
        const y=26+layer*55+(Math.floor(x/interval)*23+layer*11)%31;
        const scale=[.7,.95][layer];
        ctx.drawImage(cloud,Math.round(destX),Math.round(y),
          Math.floor(cloud.width*scale),Math.floor(cloud.height*scale));
      }
      ctx.restore();
    }
    if(castleStrength>.08&&!scenic){
      ctx.save();ctx.globalAlpha=Math.min(.45,castleStrength*.45);
      const castle=floatingPalace();
      ctx.drawImage(castle,Math.round(W*.26-camera*.048),
        Math.round(Math.max(48,groundY*.19)),260,170);
      ctx.restore();
    }
  }
  function far(ctx,{W,groundY,camera,castleStrength=0}){
    // A painterly town beneath the fantasy island adds small windows,
    // actual terraces and waterfalls to the parallax silhouette.
    const city=artPlate('distant_city');
    if(city){
      const width=Math.min(480,Math.max(300,W*.37)),height=Math.min(420,groundY*.62);
      ctx.save();ctx.globalAlpha=.34;
      ctx.imageSmoothingEnabled=true;
      const offset=((camera*.09)%780+780)%780;
      for(let x=-780;x<W+780;x+=780){
        ctx.drawImage(city,Math.round(x-offset+120),
          Math.round(groundY-height+10),Math.round(width),Math.round(height));
      }
      ctx.restore();
    }
    const mountains=distantMountains();
    const h=Math.min(240,Math.max(146,groundY*.30));
    const base=groundY-45;
    ctx.save();
    ctx.globalAlpha=.43;
    const span=1400,offset=((Math.round(camera*.10)%span)+span)%span;
    for(let x=-span;x<W+span;x+=span){
      ctx.drawImage(mountains,x-offset,Math.round(base-h),span,h);
    }
    ctx.restore();
    if(castleStrength>.03){
      ctx.save();ctx.globalAlpha=.25*castleStrength;
      const horizon=groundY-94;
      for(let i=-1;i<Math.ceil(W/190)+1;i++){
        const x=i*190-Math.floor(camera*.155)%190;
        const height=30+((i*i*13+17)%61);
        box(ctx,x,horizon-height,25,height+45,'#484151');
        poly(ctx,[[x-8,horizon-height],[x+12,horizon-height-26],[x+33,horizon-height]],'#62516a');
        box(ctx,x+10,horizon-height+11,3,9,'#ffd3a3');
      }
      ctx.restore();
    }
  }
  function ground(ctx,{W,groundY,camera}){
    // A polished hand-drawn stone promenade replaces the flat gray strips.
    const shift=((Math.floor(camera*.94)%84)+84)%84;
    for(let row=0;row<Math.ceil((ctx.canvas.height-groundY)/21)+1;row++){
      const y=groundY+row*21;
      for(let col=-2;col<Math.ceil(W/84)+3;col++){
        const x=col*84-shift+(row&1?42:0);
        box(ctx,x,y,81,19,row&1?'#505665':'#565762');
        box(ctx,x,y,81,2,'#a49ba0');
        box(ctx,x+2,y+2,77,1,'#837d84');
        box(ctx,x+2,y+16,77,2,'#343941');
        box(ctx,x+4,y+3,1,11,'#9e8e8f');
        for(let i=0;i<17;i++){
          const xx=x+((i*23+col*11+row*3)%72+72)%72;
          const yy=y+3+((i*9+col*7+row*8)%13+13)%13;
          box(ctx,xx,yy,1+(i%4===0?2:0),1,i%3===0?'#aaa3a3':'#3e4650');
        }
      }
    }
    box(ctx,0,groundY-2,W,3,'#d8bfaa');
    box(ctx,0,groundY+2,W,3,'#77717b');
    box(ctx,0,groundY+26,W,2,'#afa19a');
    box(ctx,0,groundY+28,W,3,'#333c45');
  }
  function facadeProps(ctx,{W,groundY,camera,elapsed,buildings=[],reducedMotion=false}){
    // Repeated 3D-feeling lamppost/planter rhythm between giant landmarks.
    const spacing=360,offset=((camera%spacing)+spacing)%spacing;
    const lamp=lantern(),garden=nearGarden();
    const pine=tallPine(27),pink=gardenTree(21);
    for(let n=-2;n<Math.ceil(W/spacing)+2;n++){
      const x=n*spacing-offset;
      let nearDoor=false,flavor='studio';
      for(const b of buildings){
        const bx=b.x+b.width*.5-camera;
        const distance=Math.abs(x-bx);
        if(distance<180){nearDoor=true;flavor=b.style;break;}
        if(distance<460)flavor=b.style;
      }
      if(nearDoor)continue;
      const seed=Math.floor((n*spacing+camera-offset)/spacing);
      if(flavor==='cat'||flavor==='studio'){
        ctx.globalAlpha=.9;
        ctx.drawImage(pink,Math.round(x-92),Math.round(groundY-196),158,196);
      }else{
        ctx.globalAlpha=.8;
        ctx.drawImage(pine,Math.round(x-50),Math.round(groundY-182),92,182);
      }
      ctx.globalAlpha=1;
      ctx.drawImage(garden,Math.round(x-128),Math.round(groundY-61),260,86);
      const glimmer=1+(reducedMotion?0:Math.sin(elapsed*1.9+n)*.2);
      const lx=Math.round(x+89),ly=Math.round(groundY-160);
      ctx.save();
      // Glow is behind the crisp lantern pixels.
      const radial=ctx.createRadialGradient(lx+26,ly+64,2,lx+26,ly+64,51);
      radial.addColorStop(0,'rgba(255,203,128,'+(.28*glimmer)+')');
      radial.addColorStop(1,'rgba(255,203,128,0)');
      ctx.fillStyle=radial;ctx.fillRect(lx-28,ly+13,112,106);
      ctx.drawImage(lamp,lx,ly,54,160);
      ctx.restore();
      for(let k=0;k<7;k++){
        const xx=x+(k*49)%150-58;
        const yy=groundY-80-(k*23)%63;
        const sway=reducedMotion?0:Math.sin(elapsed*1.7+k*2+n)*5;
        box(ctx,xx+sway,yy,1+(k%3===0?1:0),2,k%2?'#ffdfaa':'#f5bbce');
      }
    }
  }
  function archGlow(ctx,{groundY,camera,elapsed,buildings,reducedMotion=false}){
    // A readable, animated portal at every game's true hitbox center.
    for(const b of buildings){
      const x=b.x+b.width*.5-camera;
      if(x<-160||x>ctx.canvas.width+160)continue;
      const s=Math.min(1,Math.max(.24,(groundY-39)/(b.height+126)));
      const w=156*s;
      const h=176*s;
      ctx.save();
      const glow=ctx.createRadialGradient(x,groundY-h*.55,5,x,groundY-h*.48,125*s);
      const hue=b.style==='castle'?'255,181,101':b.style==='arena'?'91,223,218':b.style==='cat'?'255,190,216':'235,206,153';
      glow.addColorStop(0,'rgba('+hue+',.19)');
      glow.addColorStop(.6,'rgba('+hue+',.07)');
      glow.addColorStop(1,'rgba('+hue+',0)');
      ctx.fillStyle=glow;ctx.fillRect(x-w*1.15,groundY-h*1.1,w*2.3,h*1.1);
      const t=reducedMotion?.5:(.55+.45*Math.sin(elapsed*1.45+b.index*3));
      ctx.globalAlpha=.32+t*.33;
      box(ctx,x-w*.46,groundY-12,w*.92,3,b.style==='castle'?'#ffd295':'#fcddbb');
      for(let i=0;i<10;i++){
        const a=i*TWO_PI/10;
        const px=x+Math.cos(a)*(w*.50+7),
          py=groundY-h*.60+Math.sin(a)*h*.45;
        box(ctx,px,py,1+(i%4===0?2:0),2,i%2?'#f9e8c5':'#ffe2a3');
      }
      ctx.restore();
    }
  }
  function foregroundDust(ctx,{W,groundY,elapsed,reducedMotion=false}){
    const count=Math.min(24,Math.ceil(W/52));
    for(let i=0;i<count;i++){
      const x=((i*179+37)%(W+30)+W+30)%(W+30);
      const mod=i*41%97;
      const sway=reducedMotion?0:Math.sin(elapsed*.95+i*8)*18;
      const y=groundY-40-(mod*7)%220+(reducedMotion?0:Math.sin(elapsed*.7+i*3)*8);
      ctx.fillStyle=i%3?'rgba(255,223,165,.46)':'rgba(242,174,207,.44)';
      ctx.fillRect(Math.round(x+sway),Math.round(y),i%5?1:2,i%5?2:1);
    }
  }
  window.OIBUNG_CINEMATIC={
    sky,far,ground,facadeProps,archGlow,foregroundDust,
    stats:()=>({cachedSprites:cache.size,types:[...cache.keys()]})
  };
})();
