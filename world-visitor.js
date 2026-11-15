/*
 * OIBUNG WORLD visitor: coherent, hand-shaded HD pixel sprite.
 *
 * The previous player was a collection of large monochrome rectangles with
 * an oversized head. This sprite uses human proportions and animation poses,
 * baked once to 5 small transparent canvases.
 */
(() => {
  'use strict';
  const frames=[];
  const W=84,H=167,mid=42;
  const p={
    outline:'#242730',hair:'#242630',hairLow:'#3a3343',hairLight:'#65545d',
    face:'#e4af95',faceLight:'#fad0b0',faceShade:'#bb8271',
    jacket:'#36485a',jacketDark:'#283544',jacketLight:'#6b8690',
    shirt:'#eee5d6',shirtShade:'#bfc8bf',scarf:'#946b67',
    gold:'#e5bd80',pants:'#384956',pantsLight:'#667984',
    boots:'#26282e',bootsLight:'#5b5962'
  };
  function rect(c,x,y,w,h,color) {
    c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
  }
  function poly(c,pts,color){
    c.fillStyle=color;c.beginPath();c.moveTo(pts[0][0],pts[0][1]);
    for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);
    c.closePath();c.fill();
  }
  function ell(c,x,y,rx,ry,color) {
    c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();
  }
  function eye(c,x,y,blink){
    if(blink){rect(c,x,y,5,1,p.hair);return;}
    rect(c,x,y,5,3,p.outline);
    rect(c,x+1,y,3,2,'#4d4c55');
    rect(c,x+2,y,1,1,'#f9e9d8');
    rect(c,x-1,y-1,5,1,p.hairLow);
  }
  function make(index){
    const canvas=document.createElement('canvas');
    canvas.width=W;canvas.height=H;
    const c=canvas.getContext('2d',{alpha:true});
    c.imageSmoothingEnabled=false;
    const moving=index>0&&index<5, stride=moving?Math.sin((index-1)*Math.PI/2):0;
    const left=Math.round(stride*7),right=-left;
    const armL=-Math.round(stride*5),armR=-armL;
    const bob=moving?(index===2||index===4?2:0):0;
    c.save();c.translate(0,bob);
    // Thin, independent fabric folds and soles replace square-block legs.
    function leg(offset,side){
      const x=mid+side*5.6+offset;
      poly(c,[[x-5,106],[x+6,106],[x+7,147],[x+5,151],[x-5,151],[x-7,145]],p.outline);
      rect(c,x-4,108,9,34,p.pants);
      rect(c,x-3,110,2,25,p.pantsLight);
      rect(c,x+3,112,1,22,p.jacketDark);
      rect(c,x-3,145,9,7,p.pants);
      rect(c,x-5,150,11,8,p.boots);
      rect(c,x-6,155,14,4,p.outline);
      rect(c,x-4,153,10,2,p.bootsLight);
      rect(c,x-5,159,14,1,p.gold);
    }
    leg(left,-1);leg(right,1);
    // Tailored coat hem in layers, buttons, shoulder stitching and pocket.
    poly(c,[[29,59],[54,59],[59,109],[47,113],[42,106],[37,113],[25,109]],p.outline);
    poly(c,[[30,60],[53,60],[55,105],[48,108],[43,101],[36,108],[27,105]],p.jacket);
    poly(c,[[30,61],[34,61],[31,99],[27,104]],p.jacketLight);
    poly(c,[[51,61],[54,61],[58,103],[54,106]],p.jacketDark);
    for(let i=0;i<11;i++){
      const yy=65+i*3.8;
      rect(c,30+(i%3),yy,1,2,i%3?p.jacketLight:p.jacketDark);
      rect(c,52-(i%2),yy,1,2,i%3?p.jacketDark:'#8a8f91');
    }
    // Clean waist, dress shirt, lapels.
    rect(c,35,62,15,36,p.shirt);
    poly(c,[[30,61],[39,59],[40,67],[35,85],[31,81]],p.jacketDark);
    poly(c,[[53,61],[45,58],[43,67],[49,85],[53,81]],p.jacketDark);
    poly(c,[[36,62],[41,66],[44,69],[38,76]],p.shirtShade);
    poly(c,[[49,62],[44,66],[41,69],[46,76]],p.shirtShade);
    rect(c,42,68,2,31,p.scarf);
    rect(c,41,68,1,17,p.gold);
    rect(c,31,93,23,5,p.jacketDark);
    rect(c,32,96,21,1,p.gold);
    for(let i=0;i<4;i++)rect(c,47,78+i*7,2,2,p.gold);
    rect(c,29,89,7,5,p.jacketDark);
    rect(c,30,90,5,1,p.gold);
    // Natural opposite arm swing and narrower hand silhouettes.
    function arm(off,side){
      const shoulder=mid+side*15;
      poly(c,[[shoulder-4,62],[shoulder+4,63],[shoulder+side*8+off,96],[shoulder+side*4+off,98],[shoulder-3,78]],p.outline);
      poly(c,[[shoulder-3,64],[shoulder+3,65],[shoulder+side*7+off,94],[shoulder+side*4+off,95],[shoulder-2,79]],p.jacket);
      rect(c,shoulder+side*4+off,91,5,4,p.shirt);
      rect(c,shoulder+side*4+off,95,5,7,p.face);
      rect(c,shoulder+side*4+off+1,96,1,5,p.faceLight);
      for(let i=0;i<7;i++)rect(c,shoulder-side+(i%3),69+i*3,1,1,i%2?p.jacketLight:p.jacketDark);
    }
    arm(armL,-1);arm(armR,1);
    // Neck, ears and finely shaded face.
    rect(c,38,51,9,13,p.faceShade);
    rect(c,38,52,8,9,p.face);
    ell(c,42,38,16,20,p.outline);
    ell(c,42,41,13,17,p.faceShade);
    poly(c,[[31,31],[36,23],[49,24],[54,32],[52,49],[48,52],[37,54],[32,48]],p.face);
    rect(c,35,32,11,8,p.faceLight);
    rect(c,46,37,4,7,p.faceLight);
    rect(c,34,47,13,3,'#d49482');
    rect(c,41,42,2,4,'#d3947b');
    rect(c,40,47,4,1,'#915e5b');
    eye(c,34,37,index===5);eye(c,46,37,index===5);
    rect(c,35,44,3,1,'#e89c92');
    rect(c,49,44,3,1,'#e89c92');
    // Slightly asymmetrical hairstyle: 65+ tiny painted highlights, no giant block fringe.
    poly(c,[[27,35],[26,27],[29,17],[38,13],[49,14],[57,21],[59,30],[58,39],[54,36],[50,29],[46,31],[40,29],[35,34],[31,43],[29,49]],p.hair);
    poly(c,[[29,28],[31,19],[38,17],[46,17],[50,20],[41,19]],p.hairLow);
    poly(c,[[51,19],[57,26],[55,37],[51,31],[48,29]],p.hairLow);
    for(let i=0;i<70;i++){
      const x=30+(i*13)%28,y=15+(i*17)%20;
      if((x-43)*(x-43)/280+(y-24)*(y-24)/160>1.5)continue;
      rect(c,x,y,1+(i%11===0?1:0),i%7===0?4:2,i%3?p.hairLow:p.hairLight);
    }
    for(let i=0;i<18;i++){
      const x=29+i*1.5,y=22+Math.floor((i*7)%6);
      rect(c,x,y,1,2,i%3?p.hair:p.hairLight);
    }
    rect(c,30,29,2,14,p.hairLow);
    rect(c,55,32,3,15,p.hair);
    rect(c,54,43,2,7,p.hairLight);
    c.restore();
    return canvas;
  }
  for(let i=0;i<6;i++)frames.push(make(i));
  function render(c,{x,ground,camera,direction=1,moving=false,elapsed=0,yOffset=0,scale=1}){
    const frame=moving?1+Math.floor(elapsed*9)%4:(Math.floor(elapsed*1.3)%11===0?5:0);
    const sprite=frames[frame];
    const s=Math.max(.58,Math.min(1.15,scale*.92));
    const width=Math.round(W*s),height=Math.round(H*s);
    const bx=Math.round(x-camera-width/2);
    const by=Math.round(ground+yOffset-height+3*s);
    if(bx<-width||bx>c.canvas.width+width)return;
    c.save();
    c.imageSmoothingEnabled=false;
    // An anchored soft contact shadow prevents the character from floating.
    c.fillStyle='rgba(15,21,24,.25)';
    c.beginPath();c.ellipse(Math.round(x-camera),Math.round(ground+4),15*s,3*s,0,0,Math.PI*2);c.fill();
    if(direction<0) {
      c.translate(Math.round(x-camera),0);c.scale(-1,1);
      c.drawImage(sprite,Math.round(-width/2),by,width,height);
    }else c.drawImage(sprite,bx,by,width,height);
    c.restore();
  }
  window.OIBUNG_WORLD_VISITOR={render,frameCount:frames.length};
})();
