/* Side-view companion animation, using the guide atlas as its art source. */
(() => {
  'use strict';
  const atlas = new Image();
  atlas.decoding = 'async';
  atlas.src = 'assets/world-pixel/curator.webp';

  const sole = 340;
  const ankleY = 310;
  const hipY = 176;
  const hip = [128,181], knee = [153,237], ankle = [172,310];
  const thighLength = Math.hypot(knee[0]-hip[0],knee[1]-hip[1]);
  const shinLength = Math.hypot(ankle[0]-knee[0],ankle[1]-knee[1]);
  const clamp = (value, low, high) => Math.max(low,Math.min(high,value));
  const approach = (from,to,rate,dt) => from+(to-from)*(1-Math.exp(-rate*dt));
  const ease = t => t*t*(3-2*t);
  const ready = () => atlas.complete&&atlas.naturalWidth===1024&&atlas.naturalHeight===768;
  let rig;

  function cut(column,points) {
    const layer=document.createElement('canvas');
    const left=Math.min(...points.map(point=>point[0]));
    const top=Math.min(...points.map(point=>point[1]));
    layer.width=Math.max(...points.map(point=>point[0]))-left+1;
    layer.height=Math.max(...points.map(point=>point[1]))-top+1;
    const brush=layer.getContext('2d');
    brush.translate(-left,-top);
    brush.beginPath();
    brush.moveTo(...points[0]);
    for(let i=1;i<points.length;i++)brush.lineTo(...points[i]);
    brush.closePath();
    brush.clip();
    brush.drawImage(atlas,column*256,0,256,350,0,0,256,350);
    return {layer,left,top};
  }
  function shade(part) {
    const layer=document.createElement('canvas');
    layer.width=part.layer.width;layer.height=part.layer.height;
    const brush=layer.getContext('2d');
    brush.filter='brightness(.73) saturate(.77)';
    brush.drawImage(part.layer,0,0);
    return {layer,left:part.left,top:part.top};
  }
  function prepare() {
    if(!rig){
      const body=cut(1,[[61,0],[177,0],[177,175],[146,180],[140,179],[140,195],[122,195],[118,179],[61,175]]);
      const front={
        thigh:cut(2,[[102,173],[150,170],[156,188],[166,226],[165,246],[142,248],[130,226],[118,208],[103,195]]),
        shin:cut(2,[[139,225],[164,222],[167,254],[171,274],[183,308],[178,320],[165,319],[153,290],[140,255]]),
        shoe:cut(1,[[106,300],[142,300],[168,314],[171,340],[104,345]])
      };
      rig={body,front,rear:{thigh:shade(front.thigh),shin:shade(front.shin),shoe:shade(front.shoe)}};
    }
    return rig;
  }

  function reset(guide,x) {
    Object.assign(guide,{x,y:0,speed:0,facing:1,side:-1,phase:0,stride:0,crouch:0,lean:0,tuck:0,
      affection:0,still:0,cooldown:.7,mode:'follow',timer:0,flight:null,followJump:0,
      landed:0,playerGrounded:true});
    return guide;
  }

  function update(guide,{dt,player,limit,gap,height,reduced}) {
    const distance=player.x-guide.x;
    const stopped=player.onGround&&Math.abs(player.vx)<13;
    const close=Math.abs(distance)<gap+44;
    const watching=stopped&&close;
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
      const step=Math.max(0,Math.min(Math.abs(distance)-Math.max(56,gap*.58),gap*.42));
      guide.flight={time:0,duration:.44,height:height*.22,start:guide.x,
        target:clamp(guide.x+guide.facing*step,20,limit-20)};
      guide.mode='hop';
      guide.timer=0;
    }
    if(guide.followJump){
      guide.followJump=Math.max(0,guide.followJump-dt);
      if(!guide.followJump&&!guide.flight&&guide.mode==='follow'){
        guide.flight={time:0,duration:.64,height:height*.32};
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
      guide.tuck=t===1?0:Math.sin(t*Math.PI)**1.1;
      if(flight.target!==undefined)guide.x=flight.start+(flight.target-flight.start)*ease(t);
      if(t===1){
        guide.y=0;
        guide.flight=null;
        guide.landed=.18;
        if(guide.mode==='hop'){guide.mode='admire';guide.timer=0;guide.speed=0;}
      }
    }
    if(guide.mode!=='charge'&&guide.mode!=='hop')guide.x=clamp(guide.x+guide.speed*dt,20,limit-20);
    const travel=guide.x-previousX;
    if(guide.mode==='follow'&&!watching&&Math.abs(guide.speed)>23)guide.facing=Math.sign(guide.speed);
    else if(Math.abs(distance)>12)guide.facing=Math.sign(distance);
    if(!guide.flight)guide.phase=(guide.phase+Math.abs(travel)/Math.max(76,height*.92))%1;
    const gait=guide.flight?0:clamp(Math.abs(guide.speed)/210,0,1);
    guide.stride=approach(guide.stride,reduced?0:gait,13,dt);
    guide.crouch=approach(guide.crouch,
      guide.mode==='charge'?ease(clamp(guide.timer/.29,0,1)):guide.landed/.18*.5,18,dt);
    guide.lean=approach(guide.lean,
      guide.mode==='charge'?.32:guide.mode==='hop'?.24:guide.stride*.07,14,dt);
    const hearts=watching&&guide.still>.36||guide.mode==='hop'||guide.mode==='admire';
    guide.affection=approach(guide.affection,hearts?1:0,12,dt);
  }

  function heart(ctx,x,y,r,color) {
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(r,r);
    ctx.beginPath();
    ctx.moveTo(0,1);
    ctx.bezierCurveTo(-.24,.66,-1,.18,-1,-.34);
    ctx.bezierCurveTo(-1,-1,-.28,-1.11,0,-.52);
    ctx.bezierCurveTo(.28,-1.11,1,-1,1,-.34);
    ctx.bezierCurveTo(1,.18,.24,.66,0,1);
    ctx.fillStyle=color;
    ctx.fill();
    ctx.restore();
  }
  function foot(phase,stride,tuck,rear) {
    const step=(phase+(rear?.5:0))%1;
    const swing=step>=.5;
    const t=swing?(step-.5)*2:step*2;
    const plantedX=(swing?-1+2*ease(t):1-2*t)*52*stride+(rear?-9:1);
    const lift=swing?Math.sin(t*Math.PI)*32*stride:0;
    const turn=swing?Math.sin(t*Math.PI*2)*.22*stride:0;
    return {
      x:plantedX*(1-tuck)+(rear?-24:29)*tuck,
      y:ankleY-lift*(1-tuck)-(rear?31:19)*tuck,
      tilt:turn*(1-tuck)+(rear?.25:-.2)*tuck
    };
  }
  function drawPart(ctx,part,x,y) {
    ctx.drawImage(part.layer,part.left-x,part.top-y);
  }
  function bone(ctx,part,from,to,sourceStart,sourceEnd) {
    const difference=Math.atan2(to[1]-from[1],to[0]-from[0])-
      Math.atan2(sourceEnd[1]-sourceStart[1],sourceEnd[0]-sourceStart[0]);
    ctx.save();
    ctx.translate(...from);
    ctx.rotate(difference);
    drawPart(ctx,part,...sourceStart);
    ctx.restore();
  }
  function leg(ctx,parts,hipPosition,target) {
    const dx=target.x-hipPosition[0],dy=target.y-hipPosition[1];
    const length=Math.max(1,Math.hypot(dx,dy));
    const reach=Math.min(length,thighLength+shinLength-.01);
    const ux=dx/length,uy=dy/length;
    const along=(thighLength*thighLength-shinLength*shinLength+reach*reach)/(2*reach);
    const bend=Math.sqrt(Math.max(0,thighLength*thighLength-along*along));
    const joint=[hipPosition[0]+ux*along+uy*bend,hipPosition[1]+uy*along-ux*bend];
    const end=[hipPosition[0]+ux*reach,hipPosition[1]+uy*reach];
    ctx.save();
    bone(ctx,parts.shin,joint,end,knee,ankle);
    bone(ctx,parts.thigh,hipPosition,joint,hip,knee);
    ctx.translate(...end);
    ctx.rotate(target.tilt);
    drawPart(ctx,parts.shoe,122,ankleY);
    ctx.restore();
  }

  function draw(ctx,guide,{center,groundY,height,elapsed,reduced}) {
    if(!ready())return false;
    const parts=prepare();
    const scale=height/sole;
    const front=foot(guide.phase,guide.stride,guide.tuck,false);
    const rear=foot(guide.phase,guide.stride,guide.tuck,true);
    const maximumReach=thighLength+shinLength-1;
    const minHip=target=>target.y-Math.sqrt(maximumReach*maximumReach-target.x*target.x);
    const bodyY=Math.max(hipY+guide.crouch*30-guide.tuck*2,minHip(front),minHip(rear));
    const top=groundY+guide.y-height;
    ctx.save();
    ctx.translate(center,top);
    ctx.scale(scale*guide.facing,scale);
    leg(ctx,parts.rear,[0,bodyY],rear);
    leg(ctx,parts.front,[0,bodyY],front);
    ctx.translate(0,bodyY);
    ctx.rotate(guide.lean);
    drawPart(ctx,parts.body,132,hipY);
    if(guide.affection>.1){
      ctx.save();
      ctx.globalAlpha=guide.affection;
      heart(ctx,16,43-hipY,6.6,'#671a40');
      heart(ctx,16,43-hipY,5.1,'#fa458c');
      heart(ctx,15,42-hipY,2.1,'#ffd5e8');
      const rise=reduced?0:Math.sin(elapsed*5)*5;
      heart(ctx,42,18-hipY+rise,9,'#f1457f');
      heart(ctx,58,3-hipY-rise,5,'#ff86a8');
      ctx.restore();
    }
    ctx.restore();
    return true;
  }

  window.OIBUNG_CURATOR={ready,reset,update,draw};
})();
