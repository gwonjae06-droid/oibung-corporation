/* Oibung Gallery blackout v2.
 * Pure, deterministic turn-based horror rules. One room per work; there is
 * no constant FPS simulation and no requirement for real-time 3D.
 * Lightweight patrol timer is driven by the UI layer when the player is idle.
 */
(function (global) {
  'use strict';
  const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
  const normalized=(v,n)=>(v%n+n)%n;
  const distance=(a,b,n)=>Math.min(normalized(a-b,n),normalized(b-a,n));

  function begin(count,start=0){
    const n=Math.max(1,Math.floor(Number(count)||1));
    const room=normalized(start,n);
    const powerRoom=normalized(room+Math.max(1,Math.ceil(n/2)),n);
    const maxFuses=n===1?1:Math.min(3,Math.max(1,Math.ceil(n/3)));
    const fuseRooms=[];
    for(let i=1;i<=n&&fuseRooms.length<maxFuses;i++){
      const candidate=normalized(room+i,n);
      if((candidate!==powerRoom||n===1)&&!fuseRooms.includes(candidate))
        fuseRooms.push(candidate);
    }
    // n=2 needs a fuse in the same room as the breaker: it is still a
    // two-step collect + panel process, rather than an impossible mission.
    if(fuseRooms.length<maxFuses&&!fuseRooms.includes(powerRoom))
      fuseRooms.push(powerRoom);
    return {
      count:n,room,powerRoom,
      monster: n===1?room:normalized(room+n-1,n),
      patrolDirection:-1,noise:0,alert:0,
      hidden:false,quiet:false,torch:true,
      phase:'search',timer:0,grace:0,turns:0,
      fuses:fuseRooms,found:[],panel:0,finished:false,
      lastEvent:'어둠 속에서 비상전원을 찾으세요.'
    };
  }

  function updateEncounter(s,origin){
    if(s.finished)return;
    if(s.hidden){s.phase='search';s.grace=0;return;}
    if(s.count===1){s.phase='search';return;}
    const d=distance(s.room,s.monster,s.count);
    if(d===0){
      // Being noticed is an explicit warning. Player ALWAYS receives a turn
      // to hide or leave; a subsequent unsafe action can result in capture.
      if(s.phase==='warning'&&origin==='wait'){
        s.phase='caught';s.finished=true;s.lastEvent='괴물이 당신을 발견했습니다.';
      }else{
        s.phase='warning';s.grace++;
        s.lastEvent='복도 가까이에서 익숙한 발소리가 들립니다. 숨거나 이동하세요.';
      }
    }else{
      s.phase='search';s.grace=0;
      if(d===1&&s.torch&&s.alert>55)
        s.lastEvent='손전등 불빛에 무언가 반응했습니다.';
    }
  }

  function patrol(s){
    if(s.finished||s.count<=1)return s;
    s.monster=normalized(s.monster+s.patrolDirection,s.count);
    // Reverse at high alert so the curator appears to search for the visitor.
    if(s.alert>=70) {
      const cw=normalized(s.room-s.monster,s.count);
      const ccw=normalized(s.monster-s.room,s.count);
      s.patrolDirection=cw<=ccw?1:-1;
    }
    updateEncounter(s,'patrol');
    return s;
  }

  function move(s,target){
    if(s.finished)return {type:'blocked',message:'일반 관람으로 복귀하거나 다시 시도하세요.'};
    if(s.hidden)return {type:'blocked',message:'숨은 상태에서는 이동할 수 없습니다.'};
    if(s.phase==='warning'&&s.count>1&&normalized(target,s.count)===s.monster)
      return {type:'blocked',message:'괴물이 있는 회랑으로는 이동할 수 없습니다.'};
    const dest=normalized(target,s.count);
    if(dest===s.room)return {type:'none'};
    s.room=dest;s.turns++;
    s.noise=clamp(s.noise+(s.quiet?4:17)+(s.torch?8:0)-8,0,100);
    s.alert=clamp(s.alert+(s.torch?14:3)+(s.quiet?-9:6),0,100);
    if(s.phase==='warning')s.phase='search';
    if(s.turns%2===0)patrol(s);
    updateEncounter(s,'move');
    s.lastEvent=s.phase==='warning'?s.lastEvent:
      s.quiet?'발소리를 최대한 죽이며 다음 회랑으로 이동했습니다.':'다음 회랑으로 이동했습니다.';
    return {type:s.phase,message:s.lastEvent};
  }

  function toggleTorch(s){
    if(s.finished)return {type:'blocked'};
    s.torch=!s.torch;
    s.alert=clamp(s.alert+(s.torch?14:-14),0,100);
    return {type:'torch',message:s.torch?
      '손전등을 켰습니다. 시야는 확보했지만 빛이 괴물을 끌어들입니다.':
      '손전등을 껐습니다. 발각 위험이 줄어들었습니다.'};
  }

  function toggleQuiet(s){
    if(s.finished)return {type:'blocked'};
    s.quiet=!s.quiet;
    return {type:'quiet',message:s.quiet?'다음 이동부터 조용히 걷습니다.':'일반 걸음으로 돌아왔습니다.'};
  }

  function hide(s){
    if(s.finished)return {type:'blocked'};
    if(s.hidden)return {type:'blocked',message:'기다리기를 눌러 발소리가 멀어지기를 확인하세요.'};
    s.hidden=true;s.torch=false;s.noise=clamp(s.noise-32,0,100);
    s.alert=clamp(s.alert-20,0,100);
    s.phase='search';
    return {type:'hide',message:'액자 뒤에 몸을 숨겼습니다. 발소리가 멀어질 때까지 기다리세요.'};
  }

  function wait(s){
    if(s.finished)return {type:'blocked'};
    s.turns++;
    s.noise=clamp(s.noise-21,0,100);
    s.alert=clamp(s.alert-(s.hidden?25:9),0,100);
    if(s.hidden){
      patrol(s);
      s.hidden=false;s.phase='search';s.grace=0;
      s.lastEvent='발소리가 멀어졌습니다. 천천히 다시 움직일 수 있습니다.';
      return {type:'safe',message:s.lastEvent};
    }
    if(s.phase==='warning'&&s.count>1&&s.monster===s.room){
      updateEncounter(s,'wait');
    }else{
      patrol(s);
    }
    return {type:s.phase,message:s.lastEvent};
  }

  function tick(s){
    if(s.finished)return {type:'blocked'};
    if(s.hidden)return {type:'hidden'}; // Hidden visitors are safe until they choose to leave.
    s.timer++;
    s.noise=clamp(s.noise-7,0,100);
    s.alert=clamp(s.alert-(s.torch?0:6),0,100);
    if(s.timer%2===0)patrol(s);
    return {type:s.phase,message:s.lastEvent};
  }

  function collect(s){
    if(s.finished||s.hidden)return {type:'blocked',message:'숨은 상태에서는 퓨즈를 회수할 수 없습니다.'};
    if(!s.fuses.includes(s.room)||s.found.includes(s.room))
      return {type:'blocked',message:'여기에는 남아 있는 퓨즈가 없습니다.'};
    if(!s.torch)return {type:'blocked',message:'퓨즈를 찾으려면 손전등을 켜야 합니다.'};
    if(s.phase==='warning')return {type:'blocked',message:'괴물이 너무 가깝습니다. 먼저 몸을 피하세요.'};
    s.found.push(s.room);
    s.alert=clamp(s.alert+12,0,100);
    s.lastEvent='예비 퓨즈를 회수했습니다.';
    return {type:'collected',message:s.lastEvent};
  }

  function power(s){
    if(s.finished)return {type:'blocked'};
    if(s.room!==s.powerRoom)return {type:'blocked',message:'이곳은 전원실이 아닙니다.'};
    if(s.found.length<s.fuses.length)return {type:'blocked',
      message:'예비 퓨즈를 모두 회수해야 분전반을 가동할 수 있습니다.'};
    if(s.phase==='warning')return {type:'blocked',message:'괴물이 근처에 있습니다. 먼저 피하세요.'};
    if(s.panel===0){s.panel=1;return {type:'panel',message:'퓨즈를 설치했습니다. 이제 차단기를 올리세요.'};}
    s.panel=2;s.finished=true;s.phase='restored';
    return {type:'restored',message:'비상전원이 복구되었습니다.'};
  }

  function nearby(s){
    return s.count<=1?false:distance(s.room,s.monster,s.count)<=1;
  }

  global.OIBUNG_BLACKOUT_RULES=Object.freeze({
    begin,move,toggleTorch,toggleQuiet,hide,wait,tick,collect,power,nearby,distance
  });
})(typeof window!=='undefined'?window:globalThis);
