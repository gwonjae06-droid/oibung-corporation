/* Full-body pixel animation for the winter village guide. */
(() => {
  'use strict';
  const art=new Image();
  art.decoding='async';
  art.src='assets/world-pixel/curator-winter-frames.png';
  const gestureArt=new Image();
  gestureArt.decoding='async';
  gestureArt.src='assets/world-pixel/curator-gestures.png';

  const frameWidth=188,frameHeight=194,ground=175,origin=91,standingHeight=161;
  const walkFrames=[1,2,3,4,5,6,7];
  const gestures=[
    {name:'wink',duration:1.08,frames:[[0,0],[.17,1],[.36,2],[.65,1],[.82,3]]},
    {name:'hair',duration:1.28,frames:[[0,8],[.2,9],[.47,10],[.78,11]]},
    {name:'kiss',duration:1.24,frames:[[0,4],[.19,5],[.49,6],[.74,7],[.92,4]]}
  ];
  const eyeAnchors={
    0:[[95,55],[112,53]],12:[[95,55],[112,53]],
    13:[[90,58],[109,62]],15:[[94,55],[111,53]]
  };
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const ease=t=>t*t*(3-2*t);
  const approach=(from,to,rate,dt)=>from+(to-from)*(1-Math.exp(-rate*dt));
  const ready=()=>art.complete&&art.naturalWidth===frameWidth*4&&art.naturalHeight===frameHeight*4;
  const gesturesReady=()=>gestureArt.complete&&gestureArt.naturalWidth===frameWidth*4&&gestureArt.naturalHeight===frameHeight*3;
  const winterFrames=[];
  const gestureFrames=[];

  // Each cell records its crown, neck and head width in atlas pixels.
  // Airborne poses can also set a horizontal pivot and raised sole.
  const headByFrame=[
    [14,74,81],[15,75,84],[15,75,84],[16,75,85],
    [17,77,84],[16,75,83],[17,75,83],[16,75,82],
    [37,94,86,106],[16,79,88,112],[39,95,90,104,164],[30,88,87,105],
    [14,74,81],[15,80,83],[28,88,86,110],[14,74,81]
  ];
  const gestureHeads=[
    [13,77,87],[13,79,87],[13,79,87],[13,77,87],
    [13,77,87],[13,78,87],[13,79,87],[13,77,87],
    [14,80,85],[13,78,87],[14,79,85],[13,76,87]
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
  const gestureShapes=gestureHeads.map(head=>proportions([...head,108]));

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
  function fitFrame(image,frame,shape,cache) {
    if(cache[frame])return cache[frame];
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
      pixels.drawImage(image,sourceX,sourceY+sourceRow,frameWidth,1,
        left,y,Math.round(frameWidth*scale),1);
    }
    cache[frame]=layer;
    return layer;
  }

  function reset(guide,x) {
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
    if(guide.gestureWait<=0&&gesturesReady()&&Math.abs(guide.speed)<28){
      guide.gesture=gestures[guide.nextGesture];
      guide.gestureTime=0;
      guide.nextGesture=(guide.nextGesture+1)%gestures.length;
    }
  }

  function update(guide,{dt,player,limit,gap,height,reduced}) {
    const distance=player.x-guide.x;
    const close=Math.abs(distance)<gap+44;
    const watching=player.onGround&&Math.abs(player.vx)<13&&close;
    const previousX=guide.x;
    guide.cooldown=Math.max(0,guide.cooldown-dt);
    guide.landed=Math.max(0,guide.landed-dt);
    guide.still=watching?guide.still+dt:0;
    guide.timer+=dt;
    if(player.onGround!==guide.playerGrounded){
      if(!player.onGround&&close&&!reduced&&guide.mode!=='hop')guide.followJump=.11;
      guide.playerGrounded=player.onGround;
    }
    if(guide.mode==='charge'&&!watching){
      guide.mode='follow';
      guide.cooldown=2;
    }
    if(guide.mode==='admire'&&(!watching||guide.timer>.85))guide.mode='follow';
    if(guide.mode==='follow'&&guide.still>1.25&&guide.cooldown===0&&!guide.flight&&!guide.followJump&&!guide.gesture){
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
    const target=clamp(player.x+guide.side*restingGap,20,limit-20);
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

  function frameFor({mode,timer,flight,followJump,landed,phase,stride,affection},elapsed,reduced) {
    if(reduced)return affection>.55?13:0;
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

  function express(ctx,guide,frame,elapsed,reduced,shape) {
    if(guide.affection<.12)return;
    ctx.save();
    ctx.globalAlpha=guide.affection;
    const points=eyeAnchors[frame];
    if(points){
      for(const [i,point] of points.entries()){
        const [x,y]=featurePoint(shape,...point);
        const size=i?2.35:3.4;
        heart(ctx,x,y,size+1,'#842654');
        heart(ctx,x,y,size,'#f64f90');
        heart(ctx,x,y,size*.56,'#ffe3b3');
      }
    }
    if(!reduced&&(frame===14||guide.mode==='hop')){
      const lift=Math.sin(elapsed*6)*3;
      const [x,y]=featurePoint(shape,134,48);
      heart(ctx,x,y+lift,7,'#f55499');
      heart(ctx,x+11,y-15-lift,4,'#ff9eba');
    }
    ctx.restore();
  }

  function drawGestureEffect(ctx,gesture,t,shape) {
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
      ctx.restore();
    }
  }

  function draw(ctx,guide,{center,groundY,height,elapsed,reduced}) {
    if(!ready())return false;
    const gesture=!reduced&&gesturesReady()?guide.gesture:null;
    const progress=gesture?Math.min(1,guide.gestureTime/gesture.duration):0;
    const frame=gesture?gesture.frames.findLast(([start])=>progress>=start)[1]:frameFor(guide,elapsed,reduced);
    const shape=gesture?gestureShapes[frame]:winterShapes[frame];
    const sprite=gesture?fitFrame(gestureArt,frame,shape,gestureFrames):fitFrame(art,frame,shape,winterFrames);
    const scale=height/standingHeight;
    const direction=Math.sign(guide.turn)||guide.facing;
    const turnWidth=.78+.22*Math.abs(guide.turn);
    const cycle=guide.phase*Math.PI*2;
    const breathing=reduced?0:Math.sin(elapsed*2.8)*.009;
    const step=reduced?0:Math.sin(cycle*2)*guide.stride*.009;
    ctx.save();
    ctx.imageSmoothingEnabled=false;
    ctx.translate(center,groundY+guide.y);
    ctx.scale(scale*direction*turnWidth,scale);
    ctx.rotate(reduced?0:Math.sin(cycle)*guide.stride*.012);
    ctx.scale(1-(breathing+step)*.32,1+breathing+step);
    ctx.translate(-origin,-ground);
    ctx.drawImage(sprite,0,0);
    if(gesture)drawGestureEffect(ctx,gesture,progress,shape);
    else express(ctx,guide,frame,elapsed,reduced,shape);
    ctx.restore();
    return true;
  }

  window.OIBUNG_CURATOR={ready,reset,update,draw};
})();
