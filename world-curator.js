/* Full-body pixel animation for the winter village guide. */
(() => {
  'use strict';
  const art=new Image();
  art.decoding='async';
  art.src='assets/world-pixel/curator-winter-frames.png';

  const frameWidth=188,frameHeight=194,ground=175,origin=91,standingHeight=161;
  const walkFrames=[1,2,3,4,5,6,7];
  const eyeAnchors={
    0:[[95,55],[112,53]],12:[[95,55],[112,53]],
    13:[[90,58],[109,62]],15:[[94,55],[111,53]]
  };
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const ease=t=>t*t*(3-2*t);
  const approach=(from,to,rate,dt)=>from+(to-from)*(1-Math.exp(-rate*dt));
  const ready=()=>art.complete&&art.naturalWidth===frameWidth*4&&art.naturalHeight===frameHeight*4;

  function reset(guide,x) {
    Object.assign(guide,{x,y:0,speed:0,facing:1,turn:1,side:-1,phase:0,stride:0,
      affection:0,still:0,cooldown:.7,mode:'follow',timer:0,flight:null,followJump:0,
      landed:0,playerGrounded:true});
    return guide;
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
    if(guide.mode==='follow'&&guide.still>1.25&&guide.cooldown===0&&!guide.flight&&!guide.followJump){
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

  function express(ctx,guide,frame,elapsed,reduced) {
    if(guide.affection<.12)return;
    ctx.save();
    ctx.globalAlpha=guide.affection;
    const points=eyeAnchors[frame];
    if(points){
      for(const [i,[x,y]] of points.entries()){
        const size=i?2.8:4;
        heart(ctx,x,y,size+1,'#842654');
        heart(ctx,x,y,size,'#f64f90');
        heart(ctx,x,y,size*.56,'#ffe3b3');
      }
    }
    if(!reduced&&(frame===14||guide.mode==='hop')){
      const lift=Math.sin(elapsed*6)*3;
      heart(ctx,134,48+lift,7,'#f55499');
      heart(ctx,145,33-lift,4,'#ff9eba');
    }
    ctx.restore();
  }

  function draw(ctx,guide,{center,groundY,height,elapsed,reduced}) {
    if(!ready())return false;
    const frame=frameFor(guide,elapsed,reduced);
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
    ctx.drawImage(art,(frame%4)*frameWidth,Math.floor(frame/4)*frameHeight,
      frameWidth,frameHeight,0,0,frameWidth,frameHeight);
    express(ctx,guide,frame,elapsed,reduced);
    ctx.restore();
    return true;
  }

  window.OIBUNG_CURATOR={ready,reset,update,draw};
})();
