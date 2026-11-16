/* Full-body pixel animation for the winter village guide. */
(() => {
  'use strict';
  const art=new Image();
  art.decoding='async';
  art.src='assets/world-pixel/curator-winter-frames.png';
  const devilArt=new Image();
  devilArt.decoding='async';
  devilArt.src='assets/world-pixel/curator-devil-ponytail.png';

  // Eight manually arranged/retouched original-art cels for each action.
  // Loaded separately; missing art falls back to the original idle PNG,
  // never to an automatically warped body or a corrupt empty sprite.
  const celSheets={angel:new Image(),devil:new Image()};
  celSheets.angel.decoding='async';
  celSheets.angel.src='assets/world-pixel/curator-nong-cels.png?v=art-cels-v1';
  celSheets.devil.decoding='async';
  celSheets.devil.src='assets/world-pixel/curator-bbang-cels.png?v=art-cels-v1';
  const CEL_COLUMNS=8,CEL_ROWS=9;
  const celRow={
    angel:{wink:0,hair:1,kiss:2,shy:3,cheer:4,pout:5,surprise:6,stretch:7,wave:8,
      pairWave:8,pairShy:3,pairCheer:4},
    devil:{beckon:0,hair:1,kiss:2,shy:3,cheer:4,pout:5,surprise:6,stretch:7,wave:8,
      pairWave:8,pairShy:3,pairCheer:4}
  };

  const frameWidth=188,frameHeight=194,ground=175,origin=91,standingHeight=161;
  // Distinct non-fading, joint-driven charm actions. No sprite opacity blends.
  // Every action selects actual original pixel-art poses from the 4x4 atlas.
  // The sprite's face, clothes, palette and proportions are never replaced.
  const gestures=[
    {name:'wink',duration:1.45},{name:'hair',duration:1.9},
    {name:'kiss',duration:2.05},{name:'shy',duration:1.9},
    {name:'cheer',duration:1.72},{name:'pout',duration:1.8},
    {name:'surprise',duration:1.45},{name:'stretch',duration:2.2},
    {name:'wave',duration:1.85}
  ];
  const devilGestures=[
    {name:'beckon',duration:2.1},{name:'hair',duration:1.9},
    {name:'kiss',duration:2.05},{name:'shy',duration:1.85},
    {name:'cheer',duration:1.85},{name:'pout',duration:1.8},
    {name:'surprise',duration:1.55},{name:'stretch',duration:2.1},
    {name:'wave',duration:1.95}
  ];
  const pairGestures=[
    {name:'pairWave',duration:2.25},
    {name:'pairShy',duration:2.45},
    {name:'pairCheer',duration:2.35}
  ];
  function poseFrame(guide) {
    if(guide.gesture){
      // The sixteen approved poses can have different necklines and hair.
      // Swapping 0 -> 13 -> 0 causes a visible full-body pop. Instead use
      // the *same* approved source pixels and draw 24 intermediate frames
      // of the actual moving arms/cloth in drawBody.
      return 0;
    }
    // Movement is a genuine eight-pose walk cycle, not idle art shaken by CSS.
    if(!guide.flight&&guide.stride>.22&&Math.abs(guide.speed)>24)
      return 1+Math.min(6,Math.floor(guide.phase*7));
    return 0;
  }
  const forms={
    angel:{name:'농',scale:.85,edge:'#66508b',wing:'#eeeaff',shade:'#b6a0dc',frames:[],art},
    devil:{name:'빵',scale:.98,edge:'#391925',wing:'#8e3959',shade:'#542544',art:devilArt}
  };
  const hdFrames=new WeakMap();
  const formFor=id=>id==='devil'?forms.devil:forms.angel;
  const eyeAnchors={
    0:[[95,56,2.4],[112,55,1.4]],8:[[95,71,2.4],[112,70,1.4]],
    9:[[96,59,2.4],[112,57,1.4]],10:[[99,76,2.4],[116,75,1.4]],
    11:[[95,67,2.4],[111,67,1.4]],12:[[95,56,2.4],[112,55,1.4]],
    13:[[92,58,2.2],[108,61,1.45]],14:[[96,74,2.4],[113,73,1.4]],
    15:[[95,56,2.4],[111,55,1.4]]
  };
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const ease=t=>t*t*(3-2*t);
  const smooth=(t,a,b)=>ease(clamp((t-a)/(b-a),0,1));
  const hold=(t,a,b,c,d)=>smooth(t,a,b)*(1-smooth(t,c,d));
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
  ].map(([top,neck,pivot])=>{
    // Keep the devil's head separate from her torso. Previously output[2]
    // was 194, so the entire sprite was treated as the HEAD: arms, legs
    // and gestures could not animate at all.
    const hip=neck+(ground-neck)*.57;
    const rows=[0,top,neck,hip,ground,frameHeight];
    return {neck,pivot,headScale:1,source:rows,output:rows};
  });
  const devilEyes={
    0:[[91,33,1.7],[99,33,1.12]],
    12:[[91,26.5,1.7],[99,25.5,1.12]],
    13:[[90,33,1.7],[98,33,1.12]],
    14:[[88.5,26.5,1.7],[97,26.5,1.12]],
    15:[[89,32,1.7],[97,32,1.12]]
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

  // Three real texture samples per source pixel. Scale3x resolves diagonal
  // clusters without blurring the pixel-art palette. Bounded LRU avoids
  // allocating all sixteen large frames for both guides on mobile.
  function detailedFrame(form,frame,shape) {
    if(!hdFrames.has(form))hdFrames.set(form,new Map());
    const cache=hdFrames.get(form);
    if(cache.has(frame)){
      const cached=cache.get(frame);
      cache.delete(frame);cache.set(frame,cached);
      return cached;
    }
    const source=document.createElement('canvas');
    source.width=frameWidth;source.height=frameHeight;
    const src=source.getContext('2d',{willReadFrequently:true});
    src.imageSmoothingEnabled=false;
    if(form===forms.devil){
      src.drawImage(form.art,(frame%4)*frameWidth,Math.floor(frame/4)*frameHeight,
        frameWidth,frameHeight,0,0,frameWidth,frameHeight);
    }else src.drawImage(fitFrame(frame,shape,form),0,0);
    const input=new Uint32Array(src.getImageData(0,0,frameWidth,frameHeight).data.buffer);
    const layer=document.createElement('canvas');
    layer.width=frameWidth*3;layer.height=frameHeight*3;
    const pixels=layer.getContext('2d');
    const output=pixels.createImageData(layer.width,layer.height);
    const result=new Uint32Array(output.data.buffer);
    for(let y=0;y<frameHeight;y++){
      for(let x=0;x<frameWidth;x++){
        const i=y*frameWidth+x,E=input[i];
        const top=y>0,low=y<frameHeight-1,left=x>0,right=x<frameWidth-1;
        const A=input[top&&left?i-frameWidth-1:i],B=input[top?i-frameWidth:i],
          C=input[top&&right?i-frameWidth+1:i],D=input[left?i-1:i],
          F=input[right?i+1:i],G=input[low&&left?i+frameWidth-1:i],
          H=input[low?i+frameWidth:i],I=input[low&&right?i+frameWidth+1:i];
        const j=(y*3)*layer.width+x*3;
        if(B!==H&&D!==F){
          result[j]=D===B?D:E;
          result[j+1]=((D===B&&E!==C)||(B===F&&E!==A))?B:E;
          result[j+2]=B===F?F:E;
          result[j+layer.width]=((D===B&&E!==G)||(D===H&&E!==A))?D:E;
          result[j+layer.width+1]=E;
          result[j+layer.width+2]=((B===F&&E!==I)||(H===F&&E!==C))?F:E;
          result[j+layer.width*2]=D===H?D:E;
          result[j+layer.width*2+1]=((D===H&&E!==I)||(H===F&&E!==G))?H:E;
          result[j+layer.width*2+2]=H===F?F:E;
        }else{
          for(let row=0;row<3;row++)result.fill(E,j+row*layer.width,j+row*layer.width+3);
        }
      }
    }
    pixels.putImageData(output,0,0);
    cache.set(frame,layer);
    if(cache.size>10)cache.delete(cache.keys().next().value);
    return layer;
  }

  function reset(guide,x) {
    delete guide.pose;
    Object.assign(guide,{x,y:0,speed:0,facing:1,turn:1,side:-1,phase:0,stride:0,
      affection:0,still:0,cooldown:.7,mode:'follow',timer:0,flight:null,followJump:0,
      landed:0,playerGrounded:true,gesture:null,gestureTime:0,gestureWait:2.8,nextGesture:0,
      headAngle:0,headAngleVelocity:0,headBob:0,headBobVelocity:0,
      look:0,lookVelocity:0,wingAngle:0,wingAngleVelocity:0,
      crouch:0,crouchVelocity:0});
    return guide;
  }
  function spring(guide,key,target,stiffness,damping,dt) {
    const velocityKey=key+'Velocity';
    let velocity=guide[velocityKey]+((target-guide[key])*stiffness-guide[velocityKey]*damping)*dt;
    guide[key]+=velocity*dt;
    guide[velocityKey]=velocity;
  }
  // Continuous phases: prepare -> deliberate pose -> release. Each hand has
  // its own displacement, so these gestures remain recognizably different.
  function flirtPose(gesture,t) {
    const still={leftX:0,leftY:0,rightX:0,rightY:0,tilt:0,lean:0};
    if(!gesture)return still;
    if(gesture.name==='wink'){
      const p=hold(t,.05,.28,.63,.90);
      return {...still,rightX:-7*p,rightY:-22*p,tilt:.085*p,lean:.025*p};
    }
    if(gesture.name==='hair'){
      const sweep=hold(t,.06,.36,.64,.95);
      const flick=Math.sin(t*Math.PI*4)*hold(t,.36,.46,.66,.80);
      return {...still,leftX:(11+flick*4)*sweep,leftY:-37*sweep,
        tilt:-.12*sweep,lean:-.035*sweep};
    }
    if(gesture.name==='kiss'){
      const mouth=hold(t,.02,.28,.43,.68);
      const release=hold(t,.47,.66,.83,.99);
      return {...still,rightX:-10*mouth+24*release,
        rightY:-30*mouth-13*release,tilt:.095*(mouth+release),
        lean:.06*release};
    }
    if(gesture.name==='beckon'){
      const reach=hold(t,.05,.33,.76,.98);
      const tease=Math.sin((t-.38)*Math.PI*7)*hold(t,.38,.46,.77,.90);
      return {...still,rightX:(19+tease*6)*reach,
        rightY:-37*reach+tease*4, leftX:-5*reach,
        tilt:-.12*reach,lean:.095*reach};
    }
    const p=hold(t,.05,.26,.75,.98);
    switch(gesture.name){
      case 'shy': case 'pairShy':
        return {...still,leftX:8*p,leftY:-17*p,rightX:-9*p,
          rightY:-20*p,tilt:-.12*p,lean:-.075*p};
      case 'cheer': case 'pairCheer':
        return {...still,leftX:-12*p,leftY:-29*p,rightX:13*p,
          rightY:-31*p,tilt:.065*p,lean:.08*p};
      case 'pout':
        return {...still,leftX:5*p,leftY:-14*p,rightX:-5*p,
          rightY:-14*p,tilt:-.075*p,lean:-.035*p};
      case 'surprise':
        return {...still,leftX:-13*p,leftY:-20*p,rightX:14*p,
          rightY:-20*p,tilt:.085*p,lean:-.065*p};
      case 'stretch':
        return {...still,leftX:-13*p,leftY:-35*p,rightX:12*p,
          rightY:-34*p,tilt:.04*p,lean:.05*p};
      case 'wave': case 'pairWave': {
        const wave=Math.sin(t*Math.PI*11)*hold(t,.28,.34,.72,.86);
        return {...still,rightX:(13+wave*6)*p,rightY:-33*p,
          leftX:-3*p,tilt:.055*p,lean:.03*p};
      }
    }
    return still;
  }

  function play(guide,name) {
    const catalog=[...(guide.formId==='devil'?devilGestures:gestures),...pairGestures];
    const action=catalog.find(item=>item.name===name);
    if(!action||guide.gesture||guide.flight||guide.mode!=='follow')return false;
    guide.gesture=action;
    guide.gestureTime=0;
    guide.gestureWait=2.5;
    return true;
  }
  function updateGesture(guide,watching,dt,reduced) {
    if(reduced||guide.flight||guide.followJump||guide.mode!=='follow'){
      guide.gesture=null;
      guide.gestureTime=0;
      guide.gestureWait=Math.max(.55,guide.gestureWait);
      return;
    }
    // Finish a charm pose even if the visitor moves briefly; the old
    // implementation cancelled it on the first moving frame.
    if(guide.gesture){
      guide.gestureTime+=dt;
      if(guide.gestureTime>=guide.gesture.duration){
        guide.gesture=null;
        guide.gestureTime=0;
        guide.gestureWait=2.35;
      }
      return;
    }
    if(!watching)return;
    guide.gestureWait=Math.max(0,guide.gestureWait-dt);
    if(guide.gestureWait===0&&Math.abs(guide.speed)<48){
      const catalog=guide.formId==='devil'?devilGestures:gestures;
      guide.gesture=catalog[guide.nextGesture%catalog.length];
      guide.gestureTime=0;
      guide.gestureWait=2.35;
      guide.nextGesture=(guide.nextGesture+1)%catalog.length;
    }
  }

  function update(guide,{dt,player,limit,gap,height,reduced,targetX,allowHop=true,jumpDelay=.11,formId='angel'}) {
    guide.formId=formId;
    const groundedGuide=formId==='devil';
    const distance=player.x-guide.x;
    const close=Math.abs(distance)<gap+44;
    const watching=player.onGround&&Math.abs(player.vx)<42&&close;
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
    if(!groundedGuide&&allowHop&&guide.mode==='follow'&&guide.still>1.25&&guide.cooldown===0&&guide.nextGesture===0&&!guide.flight&&!guide.followJump&&!guide.gesture){
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
    // An explicit follower slot must remain stable. The old rest-gap scaling
    // silently pulled characters toward the player during hop cooldown.
    const restingGap=watching&&guide.cooldown>9.8?gap*.65:gap;
    const target=targetX===undefined
      ?clamp(player.x+guide.side*restingGap,20,limit-20)
      :clamp(targetX,20,limit-20);
    // Do not finish a two-second charm action while the visitor runs away:
    // cancel it only if the gap is already large, then catch up normally.
    if(guide.gesture&&Math.abs(player.vx)>45&&
       Math.abs(guide.x-target)>Math.max(132,gap*1.7)){
      guide.gesture=null;
      guide.gestureTime=0;
      guide.gestureWait=2.3;
    }
    const walkTarget=guide.mode==='charge'||guide.mode==='hop'||guide.gesture?guide.x:target;
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
    // Continuous secondary rig follows velocity, gaze and breathing,
    // rather than snapping every time the sprite-sheet frame changes.
    const motionDt=Math.min(dt,1/30);
    const action=flirtPose(guide.gesture,guide.gesture?
      clamp(guide.gestureTime/guide.gesture.duration,0,1):0);
    const tilt=reduced?0:clamp(-guide.speed*.00011,-.05,.05)
      +Math.sin(guide.timer*(groundedGuide?1.55:1.28))*.014+action.tilt;
    const bounce=reduced?0:-Math.abs(Math.sin(guide.phase*Math.PI*2))*guide.stride*1.7
      +Math.sin(guide.timer*2.25)*.7;
    const gaze=reduced?0:clamp(distance/Math.max(gap*3,100),-1,1)*1.6;
    const wing=reduced?0:Math.sin(guide.timer*(groundedGuide?4.1:3.4))*.12
      +guide.stride*.04;
    spring(guide,'headAngle',tilt,105,20,motionDt);
    spring(guide,'headBob',bounce,80,17,motionDt);
    spring(guide,'look',gaze,75,17,motionDt);
    spring(guide,'wingAngle',wing,74,16,motionDt);
    spring(guide,'crouch',!reduced&&guide.mode==='charge'?1:0,95,19,motionDt);
    updateGesture(guide,watching,dt,reduced);
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
    if(gesture.name==='wink'&&t>.28&&t<.68){
      ctx.save();
      ctx.globalAlpha=Math.sin((t-.28)/.40*Math.PI);
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
    // Character-specific seduction accents accompany the actual arm motion,
    // never replace it with a crossfade.
    if(gesture.name==='hair'){
      const flick=hold(t,.27,.46,.70,.91);
      if(flick>.02){
        ctx.save();
        const [x,y]=featurePoint(shape,73,34);
        ctx.translate(x,y);
        ctx.rotate((t-.4)*.7);
        ctx.globalAlpha=flick;
        ctx.fillStyle='#ffe8ba';
        ctx.fillRect(-4,-6,3,8);ctx.fillRect(-7,-3,9,3);
        ctx.fillStyle='#f8a9c0';ctx.fillRect(9,0,3,3);
        ctx.restore();
      }
    }
    if(gesture.name==='beckon'){
      const wave=hold(t,.37,.47,.80,.94);
      if(wave>.02){
        ctx.save();
        const [x,y]=featurePoint(shape,119,67);
        ctx.globalAlpha=wave;
        ctx.translate(x+14+Math.sin(t*Math.PI*7)*3,y-18);
        ctx.fillStyle='#ffd4df';
        heart(ctx,0,0,4.5,'#ff83ae');
        ctx.fillStyle='#fee5bb';ctx.fillRect(-13,-8,3,8);
        ctx.restore();
      }
    }
    const p=hold(t,.12,.29,.73,.94);
    if(p<.02)return;
    const name=gesture.name;
    if(['cheer','pairCheer','surprise','pairWave','wave','stretch'].includes(name)){
      ctx.save();ctx.globalAlpha=p;ctx.fillStyle='#fff4c1';
      for(const [x,y,s] of [[58,30,3],[135,45,2],[121,15,2]]){
        const rise=name==='cheer'||name==='pairCheer'?t*20:0;
        ctx.fillRect(x-s/2,y-rise,s,s*3);
        ctx.fillRect(x-s,y+1-rise,s*2+s,1);
      }
      ctx.restore();
    }
    if(name==='pairShy'||name==='shy'){
      ctx.save();ctx.globalAlpha=.9*p;
      const [x,y]=featurePoint(shape,114,69);
      heart(ctx,x+11,y-13,5,'#f69dba');
      ctx.restore();
    }
    if(name==='wave'||name==='pairWave'){
      ctx.save();ctx.globalAlpha=p;
      const [x,y]=featurePoint(shape,127,77);
      ctx.strokeStyle='#ffe5ae';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(x+13,y-32);ctx.lineTo(x+19,y-40);
      ctx.moveTo(x+18,y-17);ctx.lineTo(x+25,y-17);ctx.stroke();
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
  // Never deform a garment, shift strips of pixels or interpolate texture.
  // Walking uses the existing approved source atlas with no resampling per tick.
  // All expressive actions use complete pre-painted PNG cels below.
  function drawBody(ctx,form,frame) {
    const shape=(form===forms.devil?devilShapes:winterShapes)[frame];
    const from=clamp(Math.floor(shape.output[2]-4),0,frameHeight-1);
    const layer=detailedFrame(form,frame,shape);
    ctx.drawImage(layer,0,from*3,layer.width,(frameHeight-from)*3,
      0,from,frameWidth,frameHeight-from);
  }

  function drawEmotion(ctx,guide,shape,frame,eyes,gesture,progress) {
    if(!gesture)return;
    const strength=hold(progress,.13,.3,.74,.97);
    if(strength<.02)return;
    const points=eyes[frame]||eyes[0];
    if(!points)return;
    const left=featurePoint(shape,points[0][0],points[0][1]);
    const right=featurePoint(shape,points[1][0],points[1][1]);
    const name=gesture.name;
    ctx.save();ctx.globalAlpha=strength;
    if(name==='shy'||name==='pairShy'||name==='kiss'){
      ctx.fillStyle='#e87393';
      for(const [x,y] of [left,right]){
        ctx.fillRect(x-7,y+7,5,2);ctx.fillRect(x-5,y+10,3,1);
      }
    }else if(name==='pout'){
      ctx.fillStyle='#c27679';
      ctx.fillRect(left[0]-7,left[1]-3,6,2);
      ctx.fillRect(right[0]-5,right[1]-3,6,2);
      const mouth=featurePoint(shape,
        guide.formId==='devil'?95:102,guide.formId==='devil'?40:68);
      ctx.fillStyle='#7e3c49';ctx.fillRect(mouth[0],mouth[1],3,2);
    }else if(name==='surprise'){
      const mouth=featurePoint(shape,
        guide.formId==='devil'?95:102,guide.formId==='devil'?40:68);
      ctx.fillStyle='#653b49';ctx.fillRect(mouth[0],mouth[1]-2,4,5);
      ctx.fillStyle='#f2b49e';ctx.fillRect(mouth[0]+1,mouth[1]+2,2,1);
    }
    if(name==='cheer'||name==='pairCheer'){
      // New hand-plotted happy eyelids and mouth, independent of body shape.
      const skin=guide.formId==='devil'?'#d8a5a2':'#f4c4b5';
      const ink=guide.formId==='devil'?'#59343a':'#68434c';
      for(const [x,y] of [left,right]){
        ctx.fillStyle=skin;ctx.fillRect(Math.round(x-3),Math.round(y-2),7,5);
        ctx.fillStyle=ink;
        ctx.fillRect(Math.round(x-3),Math.round(y+1),3,1);
        ctx.fillRect(Math.round(x),Math.round(y+2),3,1);
      }
      const [mx,my]=featurePoint(shape,guide.formId==='devil'?95:102,
        guide.formId==='devil'?39:68);
      ctx.fillStyle=ink;ctx.fillRect(Math.round(mx-2),Math.round(my),6,2);
      ctx.fillStyle='#f8d4c4';ctx.fillRect(Math.round(mx),Math.round(my+2),3,1);
    }
    if(name==='stretch'||name==='hair'){
      const [x,y]=featurePoint(shape,guide.formId==='devil'?102:120,
        guide.formId==='devil'?25:40);
      ctx.fillStyle='#fff1cb';ctx.fillRect(Math.round(x),Math.round(y),2,6);
      ctx.fillRect(Math.round(x-3),Math.round(y+2),8,2);
    }
    ctx.restore();
  }
  // Independent neck-pivot sprite rig: the face stays stable during walking
  // while the torso, wings, expressions and head retain separate motion.
  function drawHead(ctx,form,frame,guide,elapsed,reduced,winking) {
    const isDevil=form===forms.devil;
    const shape=(isDevil?devilShapes:winterShapes)[frame];
    const eyes=isDevil?devilEyes:eyeAnchors;
    const layer=detailedFrame(form,frame,shape);
    const cut=clamp(Math.ceil(shape.output[2]+7),1,frameHeight);
    const pivotX=shape.pivot,pivotY=shape.output[2]+4;
    ctx.save();
    ctx.translate(pivotX+(reduced?0:guide.look),pivotY+(reduced?0:guide.headBob));
    ctx.rotate(reduced?0:guide.headAngle);
    ctx.translate(-pivotX,-pivotY);
    ctx.drawImage(layer,0,0,layer.width,cut*3,0,0,frameWidth,cut);
    drawCrown(ctx,form,shape);
    express(ctx,guide,frame,elapsed,reduced,shape,eyes,winking);
    if(!reduced)drawEmotion(ctx,guide,shape,frame,eyes,guide.gesture,
      guide.gesture?clamp(guide.gestureTime/guide.gesture.duration,0,1):0);
    // Subtle asynchronous blink on both guides, including the otherwise
    // static devil idle pose. Eye highlights are drawn at native sub-pixels.
    if(!reduced&&eyes[frame]){
      const eyeList=eyes[frame];
      const phase=(elapsed+(isDevil?1.65:.35))%(isDevil?4.3:3.85);
      const blink=clamp(1-Math.abs(phase-.15)/.15,0,1);
      for(const [x,y,size] of eyeList){
        const [eyeX,eyeY]=featurePoint(shape,x,y);
        if(blink>.1){
          ctx.globalAlpha=blink;
          ctx.fillStyle=isDevil?'#bd8eaa':'#ead4dc';
          ctx.fillRect(eyeX-size-1,eyeY-size*.5,size*2+2,size*1.5);
          ctx.fillStyle=isDevil?'#542c41':'#70516b';
          ctx.fillRect(eyeX-size,eyeY+.5,size*2,1);
          ctx.globalAlpha=1;
        }else if(guide.affection<.5){
          ctx.fillStyle='rgba(255,249,247,.7)';
          ctx.fillRect(eyeX+.2,eyeY-1,.8,.8);
        }
      }
    }
    ctx.restore();
  }

  function draw(ctx,guide,{center,groundY,height,elapsed,reduced,formId}) {
    if(!ready(formId))return false;
    const form=formFor(formId);
    const gesture=!reduced?guide.gesture:null;
    const progress=gesture?clamp(guide.gestureTime/gesture.duration,0,1):0;
    const frame=reduced?0:poseFrame(guide);
    const shape=(form===forms.devil?devilShapes:winterShapes)[frame];
    const scale=height/standingHeight;
    const cel=celSheets[formId];
    const row=gesture?celRow[formId][gesture.name]:undefined;
    const useCel=gesture&&row!==undefined&&cel.complete&&
      cel.naturalWidth===frameWidth*CEL_COLUMNS&&cel.naturalHeight===frameHeight*CEL_ROWS;
    ctx.save();
    ctx.imageSmoothingEnabled=false;
    ctx.translate(center,groundY+guide.y);
    // Integer facing flip: do not squeeze the complete sprite through width 0.
    ctx.scale(scale*(guide.facing<0?-1:1),scale);
    ctx.translate(-origin,-ground);
    drawWings(ctx,form,shape,reduced?0:guide.wingAngle);
    if(useCel){
      // Full illustrated, opaque pose: no sliding, folding, shearing, or
      // automated replacement of pixels around Nong's skirt/Bbang's dress.
      const column=Math.min(CEL_COLUMNS-1,Math.floor(progress*CEL_COLUMNS));
      ctx.drawImage(cel,column*frameWidth,row*frameHeight,frameWidth,frameHeight,
        0,0,frameWidth,frameHeight);
      drawCrown(ctx,form,(form===forms.devil?devilShapes:winterShapes)[0]);
    }else{
      // Still show an intact original sprite during asset loading/offline.
      drawBody(ctx,form,frame);
      drawHead(ctx,form,frame,guide,elapsed,reduced,false);
    }
    ctx.restore();
    return true;
  }

  window.OIBUNG_CURATOR={ready,reset,update,draw,play,formFor,
    celsReady:id=>{const image=celSheets[id];return !!image&&image.complete&&
      image.naturalWidth===frameWidth*CEL_COLUMNS&&image.naturalHeight===frameHeight*CEL_ROWS;}};
})();
