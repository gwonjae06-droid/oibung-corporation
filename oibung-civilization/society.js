// Shared by the browser village and the authoritative Node world.
globalThis.MarbleSociety = (() => {
  const projects = {
    '천문 기록': [2, 2, 7],
    '구호 활동': [0, 1, 7],
    '공방 연구': [4, 7, 2]
  };
  function propose(text) {
    if (/천문|우주|경계|연구.*별/.test(text)) return '천문 기록';
    if (/구호|구제|기근|굶/.test(text)) return '구호 활동';
    if (/공방|기술|발명/.test(text)) return '공방 연구';
    return '';
  }
  function assign(person, title, tick) {
    person.plan = {title, stage:0, attempts:0, since:tick, reason:'준비 중'};
  }
  function select(s,p,i) {
    if (!p.plan && (s.tick+i)%7===0) {
      const title=s.civil.stock<3?'구호 활동':Object.keys(projects)[(i+(p.generation||1))%3];
      assign(p,title,s.tick);
    }
    if (!p.plan) return null;
    const action=projects[p.plan.title][p.plan.stage];
    if(action===0&&!s.berries){p.plan.reason='숲 열매가 없어 낚시터로 이동';return 8}
    if(action===4&&!s.land.trees){p.plan.reason='숲이 회복될 때까지 이웃과 지식 교환';return 7}
    p.plan.reason=['준비','실행','결과 공유'][p.plan.stage];
    return action;
  }
  function progress(s,p,action,success,record) {
    const plan=p.plan;if(!plan)return;
    const goal=projects[plan.title][plan.stage];
    if(success && (action===goal||(goal===0&&action===8))){
      plan.stage++;plan.attempts=0;
      if(plan.stage===projects[plan.title].length){
        const previous=plan.cause;
        p.memory=plan.title+' 완료';p.completed=(p.completed||0)+1;
        record(p.name+' · '+p.memory,{actor:p.name,cause:previous,kind:'목표'});
        p.plan=null;
      }
    } else if(action===goal||s.tick-plan.since>144){
      plan.attempts++;plan.since=s.tick;
      if(plan.attempts>=3){p.memory=plan.title+' 보류 · 여건 재평가';record(p.name+' · '+p.memory,{actor:p.name,kind:'재계획'});p.plan=null}
    }
  }
  function newborn(s,c,parent){
    const id=s.civil.personSerial=(s.civil.personSerial||0)+1;
    return {id,name:['아라','별솔','여울','루미','온유','도담','미르'][id%7]+'·'+id,
      born:s.tick,parent:parent?.id||null,trade:parent?.trade||['농부','광부','학자'][id%3],experience:0};
  }
  function residents(s,c){
    c.people??=[];
    while(c.people.length<c.population)c.people.push(newborn(s,c,c.people[0]));
    if(c.people.length>c.population)c.people.length=c.population;
    return c.people;
  }
  function govern(s,record){
    const cs=s.civil.colonies;const treaties=s.civil.diplomacy??={};
    for(const c of cs){
      const people=residents(s,c);
      for(const p of people)p.experience++;
      const elder=people.find(p=>s.tick-p.born>4800+(p.id%5)*192);
      if(elder){const child=newborn(s,c,elder);people[people.indexOf(elder)]=child;
        record(c.name+' · '+elder.name+'의 '+elder.trade+' 기술을 '+child.name+'이 계승',{actor:child.name,kind:'계승'})}
      if(c.population>=5&&!c.government){
        c.government=c.gravity>1.4?'광산 평의회':'개척민 의회';
        record(c.name+' '+c.government+' 창설',{place:c.name,kind:'건국'});
      }
      c.leader=people.reduce((best,p)=>p.experience>best.experience?p:best,people[0])?.name;
      if(c.greenhouse&&people.some(p=>p.trade==='농부'))c.food++;
      if(people.some(p=>p.trade==='광부'))c.ore++;
    }
    for(let i=1;i<cs.length;i++){
      const a=cs[i-1],b=cs[i];if(!a.government||!b.government)continue;
      const key=a.name+' / '+b.name,deal=treaties[key]??={state:'접촉',trust:0,exchanges:0};
      const donor=a.food>b.food?a:b,receiver=donor===a?b:a;
      if(donor.food>=receiver.food+2&&receiver.ore>0){
        donor.food--;receiver.food++;receiver.ore--;donor.ore++;deal.trust=Math.min(6,deal.trust+1);deal.exchanges++;
      }else if(receiver.food<2&&donor.food<3)deal.trust=Math.max(-4,deal.trust-1);
      const stance=deal.trust>=3?'동맹':deal.trust<=-2?'국경 분쟁':'교섭';
      if(deal.state!==stance){deal.state=stance;record(key+' · '+stance,{kind:'외교',place:key})}
      if(stance==='동맹'&&receiver.food<2&&donor.food>1){donor.food--;receiver.food++}
      if(stance==='국경 분쟁'&&receiver.population>2&&donor.population<30){
        donor.people.push(receiver.people.pop());donor.population++;receiver.population--;
      }
    }
  }
  function outsiders(s,record){
    const c=s.civil;if(!c.boundary)return;
    const actors=c.visitors??=[
      {name:'기록자',motive:'관측',collected:0},
      {name:'별의 포식자',motive:'섭식',collected:0},
      {name:'경계의 파수꾼',motive:'보호',collected:0}];
    const a=actors[Math.floor(s.tick/384)%actors.length];
    if(a.motive==='관측'&&c.observations>a.collected+12){
      a.collected=c.observations;c.proofs=(c.proofs||0)+1;
      record('기록자가 천문 기록과 경계 좌표를 교환했다.',{kind:'외신 교환'});
    }else if(a.motive==='섭식'){
      const target=c.colonies.find(v=>v.ore>=4);
      if(target){const shield=(target.shield||0)>0;
        if(shield)target.shield--;else{target.ore-=4;a.collected+=4}
        record(target.name+(shield?' 보호막이 포식자를 밀어냈다.':' 광물 4가 포식자에게 흡수됐다.'),{place:target.name,kind:'외신 접촉'})}
    }else if(a.motive==='보호'&&c.proofs>0){
      const target=c.colonies.find(v=>!v.shield);
      if(target){c.proofs--;target.shield=1;a.collected++;record(target.name+'에 외신 보호막 생성',{place:target.name,kind:'외신 계약'})}
    }
  }
  return {propose,assign,select,progress,residents,govern,outsiders};
})();