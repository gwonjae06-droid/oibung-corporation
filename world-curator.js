/* Full-body pixel animation for the winter village guide. */
(() => {
  'use strict';
  const art=new Image();
  art.decoding='async';
  art.src='assets/world-pixel/curator-winter-frames.png';
  const devilArt=new Image();
  devilArt.decoding='async';
  devilArt.src='assets/world-pixel/curator-devil-ponytail.png';

  const frameWidth=188,frameHeight=194,ground=175,origin=91,standingHeight=161;
  const walkFrames=[1,2,3,4,5,6,7];
  const gestures=[
    {name:'wink',duration:1.08,frames:[[0,12],[.17,13],[.78,15]]},
    {name:'hair',duration:1.28,frames:[[0,13],[.47,14],[.78,15]]},
    {name:'kiss',duration:1.24,frames:[[0,12],[.19,13],[.74,15]]}
  ];
  const devilGesture={name:'beckon',duration:2.85,frames:[
    [0,12],[.24,13],[.40,14],[.78,15]
  ]};
  const forms={
    angel:{name:'농',scale:.85,edge:'#66508b',wing:'#eeeaff',shade:'#b6a0dc',frames:[],art},
    devil:{name:'빵',scale:.98,edge:'#391925',wing:'#8e3959',shade:'#542544',art:devilArt}
  };
  const hdFrames=new WeakMap();
  const formFor=id=>id==='devil'?forms.devil:forms.angel;
  const eyeAnchors={
    0:[[95,56,2.4],[112,55,1.4]],12:[[95,56,2.4],[112,55,1.4]],
    13:[[92,58,2.2],[108,61,1.45]],15:[[95,56,2.4],[111,55,1.4]]
  };
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const ease=t=>t*t*(3-2*t);
  const approach=(from,to,rate,dt)=>from+(to-from)*(1-Math.exp(-rate*dt));
  const ready=formId=>{
    const image=formFor(formId).art;
    return image.complete&&image.naturalWidth===frameWidth*4&&image.naturalHeight===frameHeight*4;
  };

  // Each cell records its crown, neck and head width in atlas pixels.
  // Airborne poses can also set a horizontal pivot and raised sole.
  const headByFrame=[
    [14,74,81],[15,75,84],[15,75,84],[16,75,85],
    [17,77,84],[16,75,83],[17,75,83],[16,75,82],
    [37,94,86,106],[16,79,88,112],[39,95,90,104,164],[30,88,87,105],
    [14,74,81],[15,80,83],[28,88,86,110],[14,74,81]
  ];
  const fittedHeadWidth=64,fittedHeadHeight=46;

  function proportions([top,neck,width,pivot=98,sole=ground]) {
    const hip=neck+(sole-neck)*.57;
    const saved=neck-top-fittedHeadHeight;
    return {
      neck,pivot,headScale:fittedHeadWidth/width,source:[0,top,neck,hip,sole,frameHeight],
      output:[0,top,neck-saved,hip-saved*.67,sole,frameHeight]
    };
  }
  const winterShapes=headByFrame.map(proportions);
  const devilShapes=[
    [14,45,87],[17,47,89],[16,46,88],[16,46,93],
    [18,48,93],[18,48,99],[18,48,95],[18,48,99],
    [15,45,87],[14,45,90],[14,45,89],[16,47,89],
    [10,39,86],[16,46,106],[9,39,85],[10,40,90]
  ].map(([top,neck,pivot])=>({
    neck,pivot,headScale:1,source:[0,top,frameHeight],output:[0,top,frameHeight]
  }));
  const devilEyes={
    0:[[91,33,1.7],[99,33,1.12]],
    12:[[91,26.5,1.7],[99,25.5,1.12]],
    14:[[88.5,26.5,1.7],[97,26.5,1.12]]
  };

  function mapRow(y,from,to) {
    let segment=1;
    while(segment<from.length-1&&y>from[segment])segment++;
    const t=(y-from[segment-1])/(from[segment]-from[segment-1]);
    return to[segment-1]+t*(to[segment]-to[segment-1]);
  }
  function rowScale(y,{neck,headScale}) {
    return headScale+(1-headScale)*ease(clamp((y-neck+4)/22,0,1));
  }
  function featurePoint(shape,x,y) {
    return [shape.pivot+(x-shape.pivot)*rowScale(y,shape),mapRow(y,shape.source,shape.output)];
  }
  function fitFrame(frame,shape,form) {
    if(form.frames[frame])return form.frames[frame];
    const layer=document.createElement('canvas');
    layer.width=frameWidth;layer.height=frameHeight;
    const pixels=layer.getContext('2d');
    pixels.imageSmoothingEnabled=false;
    const sourceX=(frame%4)*frameWidth;
    const sourceY=Math.floor(frame/4)*frameHeight;
    for(let y=0;y<frameHeight;y++){
      const sourceRow=Math.min(frameHeight-1,Math.floor(mapRow(y+.5,shape.output,shape.source)));
      const scale=rowScale(sourceRow,shape);
      const left=Math.round(shape.pivot*(1-scale));
      pixels.drawImage(form.art,sourceX,sourceY+sourceRow,frameWidth,1,
        left,y,Math.round(frameWidth*scale),1);
    }
    const garmentTop=Math.round(shape.output[2]+7);
    const outfit=pixels.getImageData(0,garmentTop,frameWidth,frameHeight-garmentTop);
    const data=outfit.data;
    for(let i=0;i<data.length;i+=4){
      const r=data[i],g=data[i+1],b=data[i+2];
      if(!data[i+3]||r-g<15||r-b<10||g>111)continue;
      data[i]=clamp(r*.65+46,0,255);data[i+1]=clamp(g*.85+49,0,255);data[i+2]=clamp(b*.86+83,0,255);
    }
    pixels.putImageData(outfit,0,garmentTop);
    form.frames[frame]=layer;
    return layer;
  }

  // Scale2x keeps diagonal pixel clusters defined on high-density displays.
  function detailedFrame(form,frame,shape) {
    if(!hdFrames.has(form))hdFrames.set(form,[]);
    const cache=hdFrames.get(form);
    if(cache[frame])return cache[frame];
    const layer=document.createElement('canvas');
    layer.width=frameWidth*2;layer.height=frameHeight*2;
    const pixels=layer.getContext('2d');
    if(form===forms.devil){
      pixels.drawImage(form.art,(frame%4)*frameWidth,Math.floor(frame/4)*frameHeight,
        frameWidth,frameHeight,0,0,frameWidth,frameHeight);
    }else pixels.drawImage(fitFrame(frame,shape,form),0,0);
    const input=new Uint32Array(pixels.getImageData(0,0,frameWidth,frameHeight).data.buffer);
    const output=pixels.createImageData(layer.width,layer.height);
    const result=new Uint32Array(output.data.buffer);
    for(let y=0;y<frameHeight;y++){
      for(let x=0;x<frameWidth;x++){
        const i=y*frameWidth+x,e=input[i];
        const b=input[y?i-frameWidth:i],h=input[y<frameHeight-1?i+frameWidth:i];
        const d=input[x?i-1:i],f=input[x<frameWidth-1?i+1:i];
        const j=y*2*layer.width+x*2;
        const edge=b!==h&&d!==f;
        result[j]=edge&&d===b?d:e;
        result[j+1]=edge&&b===f?f:e;
        result[j+layer.width]=edge&&d===h?d:e;
        result[j+layer.width+1]=edge&&h===f?f:e;
      }
    }
    pixels.putImageData(output,0,0);
    cache[frame]=layer;
    return layer;
  }

  function reset(guide,x) {
    delete guide.pose;
    Object.assign(guide,{x,y:0,speed:0,facing:1,turn:1,side:-1,phase:0,stride:0,
      affection:0,still:0,cooldown:.7,mode:'follow',timer:0,flight:null,followJump:0,
      landed:0,playerGrounded:true,gesture:null,gestureTime:0,gestureWait:.68,nextGesture:0});
    return guide;
  }
  function updateGesture(guide,watching,dt,reduced) {
    if(reduced||!watching||guide.mode!=='follow'||guide.flight||guide.followJump){
      guide.gesture=null;
      guide.gestureTime=0;
      guide.gestureWait=Math.max(.65,guide.gestureWait);
      return;
    }
    if(guide.gesture){
      guide.gestureTime+=dt;
      if(guide.gestureTime>=guide.gesture.duration){
        guide.gesture=null;
        guide.gestureWait=1.65;
      }
      return;
    }
    guide.gestureWait-=dt;
    if(guide.gestureWait<=0&&Math.abs(guide.speed)<28){
      guide.gesture=guide.formId==='devil'?devilGesture:gestures[guide.nextGesture];
      guide.gestureTime=0;
      guide.nextGesture=(guide.nextGesture+1)%gestures.length;
    }
  }

  function update(guide,{dt,player,limit,gap,height,reduced,targetX,allowHop=true,jumpDelay=.11,formId='angel'}) {
    guide.formId=formId;
    const groundedGuide=formId==='devil';
    const distance=player.x-guide.x;
    const close=Math.abs(distance)<gap+44;
    const watching=player.onGround&&Math.abs(player.vx)<13&&close;
    const previousX=guide.x;
    guide.cooldown=Math.max(0,guide.cooldown-dt);
    guide.landed=Math.max(0,guide.landed-dt);
    guide.still=watching?guide.still+dt:0;
    guide.timer+=dt;
    if(player.onGround!==guide.playerGrounded){
      if(!groundedGuide&&!player.onGround&&!reduced&&guide.mode!=='hop'&&(close||targetX!==undefined))guide.followJump=jumpDelay;
      guide.playerGrounded=player.onGround;
    }
    if(guide.mode==='charge'&&!watching){
      guide.mode='follow';
      guide.cooldown=2;
    }
    if(guide.mode==='admire'&&(!watching||guide.timer>.85))guide.mode='follow';
    if(!groundedGuide&&allowHop&&guide.mode==='follow'&&guide.still>1.25&&guide.cooldown===0&&!guide.flight&&!guide.followJump&&!guide.gesture){
      guide.mode=reduced?'admire':'charge';
      guide.timer=0;
      guide.cooldown=11;
    }
    if(guide.mode==='charge'&&guide.timer>=.38){
      const step=clamp(Math.abs(distance)-Math.max(56,gap*.58),0,gap*.42);
      guide.flight={time:0,duration:.47,height:height*.23,start:guide.x,
        target:clamp(guide.x+guide.facing*step,20,limit-20)};
      guide.mode='hop';
      guide.timer=0;
    }
    if(guide.followJump){
      guide.followJump=Math.max(0,guide.followJump-dt);
      if(!guide.followJump&&!guide.flight&&guide.mode==='follow'){
        guide.flight={time:0,duration:.64,height:height*.34};
      }
    }

    if(Math.abs(distance)>20)guide.side=distance>0?-1:1;
    const restingGap=watching&&guide.cooldown>9.8?gap*.65:gap;
    const slot=targetX===undefined?guide.side*gap:targetX-player.x;
    const target=clamp(player.x+slot*restingGap/gap,20,limit-20);
    const walkTarget=guide.mode==='charge'||guide.mode==='hop'?guide.x:target;
    guide.speed=approach(guide.speed,clamp((walkTarget-guide.x)*8,-415,415),11,dt);
    if(guide.flight){
      const flight=guide.flight;
      flight.time+=dt;
      const t=Math.min(1,flight.time/flight.duration);
      guide.y=-4*flight.height*t*(1-t);
      if(flight.target!==undefined)guide.x=flight.start+(flight.target-flight.start)*ease(t);
      if(t===1){
        guide.y=0;
        guide.flight=null;
        guide.landed=.19;
        if(guide.mode==='hop'){guide.mode='admire';guide.timer=0;guide.speed=0;}
      }
    }
    if(guide.mode!=='charge'&&guide.mode!=='hop')guide.x=clamp(guide.x+guide.speed*dt,20,limit-20);
    if(guide.mode==='follow'&&!watching&&Math.abs(guide.speed)>23)guide.facing=Math.sign(guide.speed);
    else if(Math.abs(distance)>12)guide.facing=Math.sign(distance);
    guide.turn=reduced?guide.facing:approach(guide.turn,guide.facing,23,dt);

    if(!guide.flight)guide.phase=(guide.phase+Math.abs(guide.x-previousX)/Math.max(76,height*.92))%1;
    const gait=guide.flight?0:clamp(Math.abs(guide.speed)/210,0,1);
    guide.stride=approach(guide.stride,reduced?0:gait,13,dt);
    const hearts=watching&&guide.still>.36||guide.mode==='hop'||guide.mode==='admire';
    guide.affection=approach(guide.affection,hearts?1:0,12,dt);
    updateGesture(guide,watching,dt,reduced);
  }

  function frameFor({mode,timer,flight,followJump,landed,phase,stride,affection,formId},elapsed,reduced) {
    if(reduced)return affection>.55&&formId!=='devil'?13:0;
    if(flight){
      const progress=flight.time/flight.duration;
      if(progress<.22)return 9;
      if(progress<.83)return 10;
      return 11;
    }
    if(landed>.045)return 11;
    if(followJump>0)return 8;
    if(mode==='charge')return timer<.15?13:14;
    if(mode==='admire')return 13;
    if(stride>.27)return walkFrames[Math.floor(phase*walkFrames.length)];
    if(stride>.10)return 7;
    if(formId==='devil')return 0;
    if(affection>.60)return 13;
    const idle=elapsed%3.4;
    return idle>2.95?15:idle>1.65?12:0;
  }

  function heart(ctx,x,y,size,fill) {
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(size,size);
    ctx.beginPath();
    ctx.moveTo(0,1);
    ctx.bezierCurveTo(-.24,.66,-1,.18,-1,-.34);
    ctx.bezierCurveTo(-1,-1,-.28,-1.11,0,-.52);
    ctx.bezierCurveTo(.28,-1.11,1,-1,1,-.34);
    ctx.bezierCurveTo(1,.18,.24,.66,0,1);
    ctx.fillStyle=fill;
    ctx.fill();
    ctx.restore();
  }

  function express(ctx,guide,frame,elapsed,reduced,shape,eyes,winking) {
    if(guide.affection<.12)return;
    ctx.save();
    ctx.globalAlpha*=guide.affection;
    const points=eyes[frame];
    if(points){
      for(const [i,[eyeX,eyeY,size]] of points.entries()){
        if(winking&&i===0)continue;
        const [x,y]=featurePoint(shape,eyeX,eyeY);
        heart(ctx,x,y,size,'#ff81b4');
      }
    }
    if(!reduced&&guide.formId!=='devil'&&(frame===14||guide.mode==='hop')){
      const lift=Math.sin(elapsed*6)*3;
      const [x,y]=featurePoint(shape,134,48);
      heart(ctx,x,y+lift,7,'#f55499');
      heart(ctx,x+11,y-15-lift,4,'#ff9eba');
    }
    ctx.restore();
  }

  function drawGestureEffect(ctx,gesture,t,shape,eyes,frame) {
    if(gesture.name==='kiss'&&t>.49){
      const progress=(t-.49)/.51;
      const drift=ease(progress);
      ctx.save();
      ctx.globalAlpha=Math.sin(progress*Math.PI);
      const [x,y]=featurePoint(shape,118,61);
      heart(ctx,x+drift*57,y-drift*40,5+3*drift,'#f55a94');
      heart(ctx,x-5+drift*39,y-12-drift*30,3.4,'#ffd3a4');
      ctx.restore();
    }
    if(gesture.name==='wink'&&t>.31&&t<.57){
      ctx.save();
      ctx.globalAlpha=Math.sin((t-.31)/.26*Math.PI);
      ctx.fillStyle='#fff0b8';
      const [x,y]=featurePoint(shape,128,41);
      ctx.fillRect(x,y,2,9);
      ctx.fillRect(x-3,y+3,8,2);
      const [sourceX,sourceY]=eyes[frame]?.[0]||[90,58];
      const [eyeX,eyeY]=featurePoint(shape,sourceX,sourceY);
      ctx.globalAlpha=1;
      ctx.fillStyle='#f3b59d';
      ctx.fillRect(eyeX-4,eyeY-3,7,6);
      ctx.fillStyle='#3c242e';
      ctx.fillRect(eyeX-4,eyeY,3,1);
      ctx.fillRect(eyeX-1,eyeY+1,4,1);
      ctx.restore();
    }
  }

  function pixelShape(ctx,form,points,color) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for(const point of points.slice(1))ctx.lineTo(...point);
    ctx.closePath();
    ctx.fillStyle=color;
    ctx.fill();
    ctx.strokeStyle=form.edge;
    ctx.lineWidth=2;
    ctx.stroke();
  }
  function drawWings(ctx,form,shape,flap) {
    const [x,y]=featurePoint(shape,form===forms.devil?shape.pivot-16:76,shape.neck+(form===forms.devil?24:28));
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(flap);
    if(form===forms.angel){
      pixelShape(ctx,form,[[7,8],[-6,-11],[-21,-21],[-54,-29],[-48,-17],[-53,-12],[-43,-4],[-46,1],[-34,8],[-34,14],[-16,19],[-7,20],[4,15]],form.wing);
      pixelShape(ctx,form,[[2,10],[-8,0],[-29,-10],[-42,-14],[-33,-4],[-38,0],[-24,10],[-17,15],[-7,15]],form.shade);
    }else{
      pixelShape(ctx,form,[[8,10],[-8,-10],[-53,-27],[-43,-11],[-46,3],[-30,-2],[-27,13],[-15,8],[1,18]],form.wing);
      ctx.strokeStyle=form.shade;ctx.beginPath();ctx.moveTo(-46,-20);ctx.lineTo(-22,1);ctx.lineTo(2,13);ctx.stroke();
      ctx.beginPath();ctx.moveTo(2,46);ctx.quadraticCurveTo(-27,69,-38,53);ctx.strokeStyle=form.edge;ctx.lineWidth=3;ctx.stroke();
      pixelShape(ctx,form,[[-43,49],[-31,50],[-38,59]],form.wing);
    }
    ctx.restore();
  }
  function drawCrown(ctx,form,shape) {
    const [x,y]=featurePoint(shape,form===forms.devil?shape.pivot:100,shape.source[1]+4);
    ctx.save();
    ctx.translate(x,y);
    if(form===forms.angel){
      ctx.beginPath();ctx.ellipse(-4,-13,15,4,0,0,Math.PI*2);
      ctx.strokeStyle='#7f5b45';ctx.lineWidth=5;ctx.stroke();
      ctx.strokeStyle='#ffe5a0';ctx.lineWidth=3;ctx.stroke();
      ctx.fillStyle='#fff8d6';ctx.fillRect(-13,-17,7,2);
    }else{
      pixelShape(ctx,form,[[-12,4],[-17,-2],[-17,-11],[-8,-4],[-6,4]],'#ac4769');
      pixelShape(ctx,form,[[7,4],[9,-5],[15,-12],[15,-2],[12,5]],'#d06483');
    }
    ctx.restore();
  }
  function drawPose(ctx,form,frame,guide,elapsed,reduced,winking) {
    const isDevil=form===forms.devil;
    const shape=(isDevil?devilShapes:winterShapes)[frame];
    const eyes=isDevil?devilEyes:eyeAnchors;
    drawWings(ctx,form,shape,reduced?0:Math.sin(elapsed*(isDevil?4.6:3.7))*.15);
    ctx.drawImage(detailedFrame(form,frame,shape),0,0,frameWidth,frameHeight);
    drawCrown(ctx,form,shape);
    express(ctx,guide,frame,elapsed,reduced,shape,eyes,winking);
  }

  function draw(ctx,guide,{center,groundY,height,elapsed,reduced,formId}) {
    if(!ready(formId))return false;
    const form=formFor(formId);
    const gesture=!reduced?guide.gesture:null;
    const progress=gesture?Math.min(1,guide.gestureTime/gesture.duration):0;
    const frame=gesture?gesture.frames.findLast(([start])=>progress>=start)[1]:frameFor(guide,elapsed,reduced);
    if(!guide.pose||reduced)guide.pose={frame,previous:frame,since:elapsed};
    const pose=guide.pose;
    if(frame!==pose.frame){
      pose.previous=pose.frame;
      pose.frame=frame;
      pose.since=elapsed;
    }
    const transition=guide.stride>.20?clamp(8/Math.max(1,Math.abs(guide.speed)),.016,.055):.105;
    const blend=ease(clamp((elapsed-pose.since)/transition,0,1));
    const isDevil=form===forms.devil;
    const shape=(isDevil?devilShapes:winterShapes)[frame];
    const eyes=isDevil?devilEyes:eyeAnchors;
    const scale=height/standingHeight;
    const direction=Math.sign(guide.turn)||guide.facing;
    const turnWidth=.34+.66*Math.abs(guide.turn);
    const cycle=guide.phase*Math.PI*2;
    const time=elapsed+(isDevil?.8:0);
    const breathing=reduced?0:Math.sin(time*2.8)*.013;
    const step=reduced?0:Math.sin(cycle*2)*guide.stride*.009;
    const lean=gesture?.name==='beckon'?Math.sin(progress*Math.PI)**2*.025:0;
    ctx.save();
    ctx.imageSmoothingEnabled=true;
    ctx.translate(center,groundY+guide.y);
    ctx.scale(scale*direction*turnWidth,scale);
    ctx.rotate(reduced?0:Math.sin(cycle)*guide.stride*.012+lean);
    ctx.scale(1-(breathing+step)*.32,1+breathing+step);
    const sway=reduced?0:Math.sin(time*1.9)*.012+
      Math.sin(cycle)*guide.stride*.010;
    ctx.transform(1,0,sway,1,0,0);
    ctx.translate(-origin,-ground);
    const winking=gesture?.name==='wink'&&progress>.31&&progress<.57;
    if(!reduced&&blend<1&&pose.previous!==frame){
      ctx.globalAlpha=1-blend;
      drawPose(ctx,form,pose.previous,guide,elapsed,reduced,winking);
      ctx.globalAlpha=blend;
    }
    drawPose(ctx,form,frame,guide,elapsed,reduced,winking);
    ctx.globalAlpha=1;
    if(gesture)drawGestureEffect(ctx,gesture,progress,shape,eyes,frame);
    ctx.restore();
    return true;
  }

  window.OIBUNG_CURATOR={ready,reset,update,draw,formFor};
})();
