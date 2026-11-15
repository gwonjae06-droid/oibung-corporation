/* Layered pixel-art guide, with independent head, hair, arms and legs. */
(() => {
  'use strict';
  const art = new Image();
  art.decoding = 'async';
  art.src = 'assets/world-pixel/curator-rig.png';

  const sole = 352;
  const ankleY = 321;
  const hipY = 151;
  const hip = [62,hipY], knee = [65,246], ankle = [69,ankleY];
  const shoulder = [46,76], elbow = [36,114], neck = [57,62];
  const thighLength = Math.hypot(knee[0]-hip[0],knee[1]-hip[1]);
  const shinLength = Math.hypot(ankle[0]-knee[0],ankle[1]-knee[1]);
  const clamp = (value, low, high) => Math.max(low,Math.min(high,value));
  const approach = (from,to,rate,dt) => from+(to-from)*(1-Math.exp(-rate*dt));
  const ease = t => t*t*(3-2*t);
  const ready = () => art.complete&&art.naturalWidth===103&&art.naturalHeight===356;
  let rig;

  function cut(points,paint=brush=>brush.drawImage(art,0,0)) {
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
    paint(brush);
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
  function paintIris() {
    const layer=document.createElement('canvas');
    layer.width=13;layer.height=10;
    const brush=layer.getContext('2d');
    const colors={s:'#361831',p:'#ef5aab',v:'#7d56ed',c:'#56def6',g:'#ffce70',w:'#fff7dc'};
    const rows=['....sssss....','..sspvvpss...','.spvgggggvps.','spvgwwgwwgvps',
      'spvgwwwwwgvps','spvgcwwwcgvps','.spvgcwcgvps.','..spvgcgvps..','...sspvpss...','.....sss.....'];
    rows.forEach((row,y)=>[...row].forEach((color,x)=>{
      if(!colors[color])return;
      brush.fillStyle=colors[color];
      brush.fillRect(x,y,1,1);
    }));
    return layer;
  }
  function prepare() {
    if(!rig){
      const legs={
        thigh:cut([[55,151],[72,151],[80,173],[80,239],[75,258],[55,259],[53,218],[53,170]],brush=>{
          brush.drawImage(art,60,234,14,13,53,151,27,96);
          brush.drawImage(art,55,232,25,27,55,232,25,27);
        }),
        shin:cut([[58,240],[78,241],[76,266],[75,302],[79,321],[61,325],[62,303],[55,278],[55,257]]),
        shoe:cut([[59,311],[79,311],[83,330],[102,337],[101,353],[57,353],[58,325]])
      };
      const arms={
        upper:cut([[31,63],[46,64],[54,72],[59,84],[53,96],[47,113],[37,125],[27,121],[31,106],[33,85]]),
        lower:cut([[31,105],[47,108],[44,123],[35,146],[28,159],[25,174],[16,194],[6,193],
          [5,172],[14,154],[21,136],[26,119]])
      };
      rig={
        hair:cut([[13,14],[48,12],[57,21],[51,43],[51,59],[41,67],[35,75],[34,96],
          [31,115],[27,137],[8,141],[0,134],[0,35]]),
        head:cut([[31,0],[96,0],[96,47],[78,61],[67,65],[53,65],[49,57],[41,51],[37,40],[30,22]]),
        torso:cut([[48,55],[65,58],[97,73],[103,102],[95,123],[94,151],[53,158],[45,147],
          [52,128],[55,112],[50,104],[53,94],[56,84],[48,74],[42,69]]),
        skirt:cut([[44,135],[63,140],[90,134],[95,150],[94,179],[90,196],[85,221],[83,233],
          [68,234],[44,233],[42,204],[36,185],[34,166],[36,153]]),
        iris:paintIris(),arms,rearArms:{upper:shade(arms.upper),lower:shade(arms.lower)},
        legs,rearLegs:{thigh:shade(legs.thigh),shin:shade(legs.shin),shoe:shade(legs.shoe)}
      };
    }
    return rig;
  }

  function reset(guide,x) {
    Object.assign(guide,{x,y:0,speed:0,facing:1,side:-1,phase:0,stride:0,crouch:0,lean:0,tuck:0,
      affection:0,prep:0,reach:0,still:0,cooldown:.7,mode:'follow',timer:0,flight:null,followJump:0,
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
      guide.mode==='charge'?.26:guide.mode==='hop'?.21:guide.stride*.09,14,dt);
    guide.prep=approach(guide.prep,!reduced&&guide.mode==='charge'?1:0,16,dt);
    guide.reach=approach(guide.reach,!reduced&&guide.mode==='hop'?1:0,12,dt);
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
    const plantedX=(swing?-1+2*ease(t):1-2*t)*44*stride+(rear?-7:2);
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
    drawPart(ctx,parts.shoe,...ankle);
    ctx.restore();
  }
  function arm(ctx,parts,swing,flex) {
    ctx.save();
    ctx.translate(...shoulder);
    ctx.rotate(swing);
    drawPart(ctx,parts.upper,...shoulder);
    ctx.translate(elbow[0]-shoulder[0],elbow[1]-shoulder[1]);
    ctx.rotate(flex);
    drawPart(ctx,parts.lower,...elbow);
    ctx.restore();
  }
  function expression(ctx,iris,{affection,prep,reach},elapsed,reduced) {
    if(affection<.06)return;
    ctx.save();
    ctx.globalAlpha=affection;
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(iris,60,32,13,10);
    ctx.drawImage(iris,74,32,8,8);
    ctx.fillStyle='#f6a0b5';
    ctx.fillRect(60,43,10,2);
    ctx.fillRect(74,42,5,1);
    const emphasis=Math.max(prep,reach);
    if(emphasis>.25){
      const rise=reduced?0:Math.sin(elapsed*7)*3;
      ctx.globalAlpha=affection*emphasis;
      heart(ctx,96,24+rise,8,'#f64da7');
      heart(ctx,106,5-rise,4,'#b4ebfb');
      ctx.fillStyle='#fdf6c9';
      ctx.fillRect(87,9,2,10);
      ctx.fillRect(83,13,10,2);
    }
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
    const cycle=guide.phase*Math.PI*2;
    const gait=Math.cos(cycle)*guide.stride;
    const bob=(1-Math.cos(cycle*2))*guide.stride*2;
    const bodyY=Math.max(hipY+guide.crouch*23-guide.tuck*3-bob,minHip(front),minHip(rear));
    const breath=reduced?0:Math.sin(elapsed*2.9)*.018;
    const sway=guide.lean+gait*.076+guide.tuck*.10+breath;
    const lift=guide.tuck*.46;
    const nearSwing=-gait*.55-guide.prep*.34-guide.reach*.77-lift;
    const farSwing=gait*.50-guide.prep*.29-guide.reach*.86-lift*.75;
    const nearFlex=-.06-Math.max(0,gait)*.25-guide.prep*.91-guide.reach*.22-lift*.9;
    const farFlex=-.06-Math.max(0,-gait)*.23-guide.prep*.8-guide.reach*.17-lift;
    const top=groundY+guide.y-height;
    ctx.save();
    ctx.translate(center,top);
    ctx.scale(scale*guide.facing,scale);
    ctx.imageSmoothingEnabled=true;
    leg(ctx,parts.rearLegs,[0,bodyY],rear);
    leg(ctx,parts.legs,[0,bodyY],front);
    ctx.translate(0,bodyY);
    ctx.save();
    ctx.rotate(gait*.046-guide.crouch*.08);
    drawPart(ctx,parts.skirt,...hip);
    ctx.restore();
    ctx.rotate(sway);
    ctx.translate(-hip[0],-hip[1]);
    ctx.save();
    ctx.translate(10,-2);
    arm(ctx,parts.rearArms,farSwing,farFlex);
    ctx.restore();
    const hairSway=-gait*.14-guide.tuck*.28+breath*2;
    ctx.save();
    ctx.translate(43,32);
    ctx.rotate(hairSway);
    drawPart(ctx,parts.hair,43,32);
    ctx.restore();
    drawPart(ctx,parts.torso,0,0);
    arm(ctx,parts.arms,nearSwing,nearFlex);
    ctx.translate(...neck);
    const nod=reduced?0:Math.sin(elapsed*4)*guide.affection*.028;
    ctx.rotate(-sway*.44+breath+guide.affection*.07+nod-guide.tuck*.12);
    ctx.translate(-neck[0],-neck[1]);
    drawPart(ctx,parts.head,0,0);
    expression(ctx,parts.iris,guide,elapsed,reduced);
    ctx.restore();
    return true;
  }

  window.OIBUNG_CURATOR={ready,reset,update,draw};
})();
