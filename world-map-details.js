/*
 * OIBUNG WORLD — layered, walkable museum boulevard enhancement.
 * Decorative paths and bridges have no collision: visitors never get stuck
 * on scenery while moving between game exhibits.
 */
(() => {
  'use strict';
  const palette={
    castle:{hedge:'#48505a',leaf:'#777084',light:'#c2a28e',accent:'#c86b77',stem:'#373940'},
    arena:{hedge:'#4b877c',leaf:'#7fbbb0',light:'#ead3a4',accent:'#60ded1',stem:'#5a6c66'},
    duel:{hedge:'#586b98',leaf:'#9ba5bf',light:'#d9cbb8',accent:'#e4a4b3',stem:'#404c73'},
    tactics:{hedge:'#547965',leaf:'#9ac09d',light:'#d9d8ad',accent:'#9de2b7',stem:'#45665c'},
    cat:{hedge:'#9b7a9b',leaf:'#dbadca',light:'#f6dfc2',accent:'#f3accf',stem:'#6e5974'},
    studio:{hedge:'#648996',leaf:'#aac7be',light:'#e5d4b9',accent:'#f5be83',stem:'#53616b'},
    tower:{hedge:'#777092',leaf:'#afa2c9',light:'#e7d8bc',accent:'#dfbee9',stem:'#595374'}
  };
  const box=(c,x,y,w,h,color)=>{if(w<=0||h<=0)return;c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));};
  const dot=(c,x,y,rx,ry,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();};
  function arch(c,x,y,w,h,p){
    box(c,x-w/2,y-h,w,h,p.stem);
    box(c,x-w/2+8,y-h+12,w-16,h-17,p.light);
    box(c,x-w/2+21,y-h+27,w-42,h-30,p.hedge);
    // A broad arch, not a collision obstacle.
    dot(c,x,y-h+15,w*.36,23,p.light);
    dot(c,x,y-h+22,w*.28,18,p.hedge);
    for(let i=0;i<7;i++){
      const px=x-w*.35+i*w*.115;
      box(c,px,y-h-3,5,9,p.accent);
    }
  }
  function tree(c,x,y,p,i){
    const h=78+(i*19)%38;
    box(c,x-7,y-h,14,h,p.stem);
    box(c,x-3,y-h+7,4,h-12,p.light);
    dot(c,x-30,y-h,35,31,p.hedge);
    dot(c,x+27,y-h+8,29,31,p.hedge);
    dot(c,x,y-h-30,43,35,p.leaf);
    dot(c,x-13,y-h-36,22,19,p.light);
    for(let j=0;j<34;j++){
      const dx=((j*47+i*21)%76)-38;
      const dy=((j*19+i*39)%52)-56;
      if((dx*dx)/1700+((dy+31)*(dy+31))/1250>1.5)continue;
      box(c,x+dx,y-h+dy,j%5===0?3:2,j%7===0?3:2,j%6?p.light:p.accent);
    }
  }
  function bench(c,x,y,p){
    box(c,x-55,y-42,110,9,p.stem);
    box(c,x-52,y-40,104,4,p.light);
    box(c,x-58,y-28,116,8,p.light);
    box(c,x-46,y-20,10,22,p.stem);
    box(c,x+36,y-20,10,22,p.stem);
    for(let i=0;i<6;i++)box(c,x-47+i*17,y-40,2,18,p.accent);
  }
  function fountain(c,x,y,p,t,reduced){
    // Decorative garden plaza between buildings.
    box(c,x-103,y-9,206,9,p.stem);
    box(c,x-95,y-16,190,8,p.light);
    dot(c,x,y-16,86,22,p.hedge);
    dot(c,x,y-21,72,17,p.accent);
    box(c,x-8,y-93,16,73,p.stem);
    box(c,x-30,y-85,60,6,p.light);
    box(c,x-18,y-64,36,10,p.light);
    dot(c,x,y-107,13,16,p.light);
    for(let i=0;i<16;i++){
      const phase=(reduced?0:t*.9)+(i*.7);
      const px=x+Math.sin(phase)*Math.min(62,15+i*3.1);
      const py=y-42-((i*17)%43)-Math.abs(Math.cos(phase))*(reduced?0:8);
      box(c,px,py,i%3?2:3,i%4?4:2,i%3?p.light:p.accent);
    }
  }
  function drawMid(ctx,v){
    const {camera,W,groundY,buildings,elapsed,reducedMotion}=v;
    const left=camera-270,right=camera+W+270;
    // District-specific collonades and gardens. Render only visible zones.
    for(let i=0;i<buildings.length;i++){
      const b=buildings[i],center=b.x+b.width*.5,p=palette[b.style]||palette.studio;
      if(center<left-490||center>right+490)continue;
      // Low garden terrace behind entrances.
      box(ctx,center-camera-320,groundY-54,640,35,p.hedge);
      box(ctx,center-camera-310,groundY-61,620,11,p.light);
      box(ctx,center-camera-310,groundY-64,620,3,p.accent);
      for(let j=-3;j<=3;j++){
        const x=center-camera+j*86;
        box(ctx,x-13,groundY-85,26,32,p.stem);
        box(ctx,x-18,groundY-86,36,7,p.light);
        dot(ctx,x,groundY-88,16,7,p.leaf);
      }
      for(const side of [-1,1]){
        const x=center+side*330-camera;
        tree(ctx,x,groundY-27,p,i*7+(side+1));
        // Pennants and lamp strands dress the arrival path.
        box(ctx,x+22,groundY-195,2,112,p.stem);
        box(ctx,x+24,groundY-191,36,3,p.light);
        box(ctx,x+38,groundY-185,26,39,p.accent);
        box(ctx,x+42,groundY-179,18,2,p.light);
      }
      // A discreet low path makes game entrances obvious at a glance.
      box(ctx,center-camera-79,groundY-31,158,28,p.stone||p.light);
      box(ctx,center-camera-79,groundY-31,158,3,p.light);
    }
    // The empty stretches between buildings become destination plazas.
    for(let i=1;i<buildings.length;i++){
      const prev=buildings[i-1],b=buildings[i];
      const center=(prev.x+prev.width*.5+b.x+b.width*.5)/2;
      if(center<left-175||center>right+175)continue;
      const p=palette[b.style]||palette.studio,x=center-camera;
      arch(ctx,x,groundY-14,240,170,p);
      fountain(ctx,x,groundY-6,p,elapsed,reducedMotion);
    }
  }
  function drawFore(ctx,v){
    const {camera,W,groundY,buildings,elapsed,reducedMotion}=v;
    const left=camera-200,right=camera+W+200;
    for(let i=0;i<buildings.length;i++){
      const b=buildings[i],center=b.x+b.width*.5;
      if(center<left-440||center>right+440)continue;
      const p=palette[b.style]||palette.studio;
      for(const side of [-1,1]){
        const x=center+side*235-camera;
        // Lit foreground bollard, gold leaf trim, flower mounds.
        box(ctx,x-6,groundY-65,12,67,p.stem);
        box(ctx,x-10,groundY-70,20,8,p.light);
        box(ctx,x-5,groundY-83,10,14,p.accent);
        box(ctx,x-2,groundY-84,4,9,p.light);
        dot(ctx,x+side*40,groundY-7,33,12,p.leaf);
        for(let f=0;f<16;f++){
          const px=x+side*40+(f*13)%58-29;
          const py=groundY-8-(f*19)%14;
          box(ctx,px,py,2+(f%3),2+(f%2),f%4?p.accent:p.light);
        }
      }
    }
    for(let i=1;i<buildings.length;i++){
      const prev=buildings[i-1],b=buildings[i];
      const center=(prev.x+prev.width*.5+b.x+b.width*.5)/2;
      if(center<left-150||center>right+150)continue;
      const p=palette[b.style]||palette.studio;
      bench(ctx,center-camera-180,groundY,p);
      bench(ctx,center-camera+180,groundY,p);
      // A few translucent floating lights; stable positions in reduced motion.
      for(let k=0;k<8;k++){
        const sx=center-camera-87+k*22;
        const phase=reducedMotion?0:elapsed*.45+k;
        box(ctx,sx,groundY-83-(k%3)*11+Math.sin(phase)*4,2,2,k%2?p.light:p.accent);
      }
    }
  }
  window.OIBUNG_WORLD_MAP_DETAILS={drawMid,drawFore};
})();
