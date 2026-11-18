import './genesis.js';
import './society.js';
export function createWorld(initial){
const note=message=>{s.log.unshift(message);s.log.length=Math.min(15,s.log.length)};
const names='농 빵 비서 최규원 박성원 배서준 이권재 별이 단비 솔 달래 보리'.split(' '),traits=['호기심 많은','다정한','신중한'],places=[[48,112],[165,132],[308,96],[233,105]],acts=['채집','나눔','별 관찰','식사'];let s=initial;const fresh=!s;s??={tick:0,apostle:-1,log:[],p:names.map((name,i)=>({name,x:38+i*23,y:108+i%3*8,food:2,hunger:i%4,act:i%4,stars:0,debt:{}}))};if(fresh)MarbleGenesis.start(s,Math.floor(Math.random()*4294967296));s.wood ??= 0;
s.houses ??= 0;
s.progress ??= 0;
for (const person of s.p) person.fatigue ??= 0;
const lots = [[96,145],[202,147],[301,146]];
acts.push('벌목','집 짓기','수면','대화','낚시','씨뿌리기','물주기','수확','탐색','자원 채취','도구 실험','거처 짓기','식량 전달');
function destination(person, index) {
  if(s.genesis){
 if(person.act===16){const q=s.p.find(q=>q.name===person.friend);return q?[q.x,q.y]:[person.x,person.y]}
 if(person.act===6||person.act===3)return person.home||person.camp||[person.x,person.y];
 if(person.act===7){const q=s.p[(index+1)%s.p.length];return [q.x,q.y]}
 if(person.act===14)return person.home||person.camp;
 if(person.act>=12)return person.site||person.camp||[person.x,person.y]
 }
 if(person.act>=9&&person.act<=11)return fieldSites[Math.floor(index/4)];
  if(person.act===7)return [165,124];
  if(person.act===8)return [334,134];
  if (person.act === 4) return [32,88];
  if (person.act === 5) return lots[Math.min(2,s.houses)];
  if (person.act === 6) return s.houses ? lots[index % s.houses] : [66,114];
  return places[person.act];
}
function nextGoal(person,index) {
  if(s.genesis){const action=MarbleGenesis.choose(s,person,index);if(action!==null)return action}
 if(!person.food && civ.stock>0){civ.stock--;person.food++;return 3}
  if(!person.food)return s.berries?0:8;
  if (person.hunger >= 5) return 3;
  if (person.fatigue >= 4) return 6;
  if(index%4===0&&season()!==3){const f=fieldFor(index);if(f.growth<0)return 9;if(f.growth>=6)return 11;if(f.water<=1)return 10}
  if(s.houses===3&&index%4===2&&s.wood<12)return 4;
  if(index%4===1&&person.food<4)return s.berries?0:8;
  if (s.houses < 3 && index % 3 === 2) return s.wood ? 5 : 4;
  const planned=MarbleSociety.select(s,person,index);if(planned!==null)return planned;
  if((s.tick+index)%4===0)return 7;
  return (index+s.tick%2)%3;
}
function finishWork(person) {
  if (person.act === 6) person.fatigue = 0;
  else person.fatigue++;
  if(person.act===4&&s.land.trees){s.land.trees--;s.wood++}
  if (person.act === 5 && s.wood && s.houses < 3) {
    s.wood--;
    if (++s.progress === 6) {
      s.progress = 0;
      s.houses++;
      note(person.name+'의 작업으로 마을의 '+s.houses+'번째 새집이 완성됐다.');
    }
  }
}

const tileX=x=>Math.max(0,Math.min(63,Math.floor(x*64/360)));
const tileY=y=>Math.max(0,Math.min(63,Math.floor((y-72)*64/100)));
const cell=(x,y)=>tileY(y)*64+tileX(x);
const center=n=>[(n%64+.5)*360/64,72+(Math.floor(n/64)+.5)*100/64];
const blocked=new Uint8Array(4096);
for(let n=0;n<4096;n++){const [x,y]=center(n);blocked[n]=!s.genesis&&[[62,97],[133,86],[226,93],[264,112]].some(([a,b])=>x>=a&&x<a+24&&y>=b&&y<b+16)}
const maps=new Map();
function distances(goal){
 if(maps.has(goal))return maps.get(goal);
 const dist=new Int16Array(4096).fill(-1),queue=[goal];dist[goal]=0;
 for(let k=0;k<queue.length;k++){const n=queue[k];for(const m of neighbors(n)){if(!blocked[m]&&dist[m]<0){dist[m]=dist[n]+1;queue.push(m)}}}
 maps.set(goal,dist);return dist
}
function neighbors(n){return [n%64?n-1:-1,n%64<63?n+1:-1,n-64,n+64].filter(m=>m>=0&&m<4096)}
function walk(p,x,y){
 const goal=cell(x,y),dist=distances(goal);
 for(let k=0;k<(s.civil.gravity===2?1:2);k++){
 const n=cell(p.x,p.y);if(n===goal){p.x=x;p.y=y;return}
 const next=neighbors(n).filter(m=>dist[m]>=0).sort((a,b)=>dist[a]-dist[b])[0];
 if(next===undefined){const near=Array.from(dist).findIndex(v=>v>=0);[p.x,p.y]=center(near);continue}
 ;[p.x,p.y]=center(next)
 }}
function target(p,i){const [x,y]=destination(p,i);if(s.genesis)return [x,y];let tx=x+(i%4)*5,ty=y+Math.floor(i/4)*5;while(blocked[cell(tx,ty)])ty+=2;return [tx,ty]}
s.berries??=16;
for(const p of s.p){p.friends??={};p.memory??='아직 기록된 만남이 없다.'}

s.civil ??= {stock:0,leader:null,knowledge:[],observations:0,craft:0,voyages:0,systems:[],boundary:false,contact:false,gravity:1,lawUntil:0,power:45,archives:[],fleet:0};
const civ=s.civil;
function record(message,details={}){
 note(message);
 civ.eventSerial=(civ.eventSerial||0)+1;
 civ.archives.unshift({id:civ.eventSerial,tick:s.tick,message,...details});
 if(civ.archives.length>300)civ.archives.pop();
}

const seasons=['봄','여름','가을','겨울'];
const fieldSites=[[106,150],[135,153],[162,151]];
s.land??={fields:fieldSites.map(()=>({growth:-1,water:2})),fish:12,trees:30,harvest:0};
const season=()=>Math.floor(s.tick/384)%4;
const hour=()=>Math.floor(s.tick%48/2);
function weather(){
 const day=Math.floor(s.tick/48),noise=Math.sin(day*177.3+4)*43758.54;
 return noise-Math.floor(noise)<[.34,.52,.24,.30][season()]?(season()===3?'눈':'비'):'맑음'
}
function fieldFor(index){return s.land.fields[Math.floor(index/4)]}
function landscapeTick(){
 const l=s.land,wet=weather()==='비',cold=season()===3;
 if(s.tick%12===0){
 for(const field of l.fields){
 if(wet)field.water=4;
 if(field.growth>=0&&field.growth<6&&field.water>0&&!cold){field.growth++;field.water--}
 }
 if(!cold&&s.tick%(wet?12:24)===0)s.berries=Math.min(20,s.berries+1);
 if(s.tick%24===0)l.fish=Math.min(16,l.fish+2);
 if(s.tick%36===0)l.trees=Math.min(30,l.trees+2);
 }}
function farm(person,index){
 const f=fieldFor(index);
 if(person.act===9&&f.growth<0){f.growth=0;f.water=3}
 if(person.act===10&&f.growth>=0&&f.growth<6)f.water=4;
 if(person.act===11&&f.growth===6){f.growth=-1;s.land.harvest+=5;civ.stock+=4;person.food++;record(person.name+'의 수확 · 공동 창고에 곡식 4, 개인 식량 1')}
}
civ.charter??='공동 분배';
civ.faith??='';civ.colonies??=[];civ.trades??=0;civ.heritage??=[];
for(const resident of s.p){resident.faith??=0;resident.lore??=[];resident.trust??=2;resident.coins??=2}
function villageCouncil(){
 const voters=s.p.filter(p=>p.food>=3&&p.coins>=2);
 const law=voters.length>s.p.length/2?'자유 교역':'공동 분배';
 if(law!==civ.charter){civ.charter=law;record('마을 회의가 '+law+' 조례 채택 · 교역 찬성 '+voters.length+'표')}
 const sellers=s.p.filter(p=>p.food>=3).sort((a,b)=>b.food-a.food);
 for(const buyer of s.p.filter(p=>p.food<=1&&p.coins>0)){
 const seller=sellers.find(p=>p.food>=3);if(!seller)break;
 seller.food--;buyer.food++;buyer.coins--;seller.coins++;civ.trades++;
 buyer.memory=seller.name+'에게 동전 하나로 식량을 샀다.'
 }
}
function teach(a,b){
 const lesson=a.lore.find(l=>!b.lore.includes(l));
 if(lesson){b.lore.push(lesson);b.memory=a.name+'에게 '+lesson+' 원리를 배웠다.'}
 if(a.faith>=2&&b.faith<a.faith&&b.friends[a.name]>=2)b.faith++;
}
function registerFaith(){
 const believers=s.p.filter(p=>p.faith>=2);
 if(!civ.faith&&believers.length>=3){civ.faith='첫별의 회중';record(believers.map(p=>p.name).join('·')+' 주민들이 '+civ.faith+' 창립')}
 if(civ.faith&&believers.length>=3&&civ.stock>=3){const needy=s.p.filter(p=>p.food<=1).slice(0,3);
 for(const p of needy){civ.stock--;p.food++;p.memory=civ.faith+'의 공동 식사를 기억한다.'}}
}
function frontier(){
 for(const c of civ.colonies){
 const yieldCount=Math.max(0,Math.floor(c.population*(c.greenhouse?1.5:c.fertility)));
 c.food+=yieldCount;
 const need=Math.ceil(c.population*.75);
 if(c.food<need){if(civ.stock>=3){civ.stock-=3;c.food+=3}else if(c.population>1)c.population--}
 c.food=Math.max(0,c.food-need);
 if(c.food>=8&&c.population<30){c.food-=4;c.population++}
 c.ore+=Math.ceil(c.population/(1+c.gravity));
 if(!c.greenhouse&&c.ore>=8){c.ore-=8;c.greenhouse=true;record(c.name+' 정착민이 현지 광물로 온실 완공')}
 if(c.food>=10){c.food-=3;civ.stock+=3}
 }
 const candidates=civ.systems.slice(0,8);
 const dest=candidates.find(sys=>!civ.colonies.some(c=>c.name===sys.star));
 if(dest&&civ.stock>=5&&s.wood>=2){civ.stock-=5;s.wood-=2;
 const colony={name:dest.star,gravity:dest.gravity,food:5,ore:0,population:2,greenhouse:false,fertility:1.55-dest.gravity*.38,marble:1};
 civ.colonies.push(colony);record(dest.star+'에 첫 정착 기지 건설 · 공동 창고 보급품 5개 사용')}
 if(civ.treaty&&!civ.colonies.some(c=>c.marble===2)){
 const origin=civ.colonies.find(c=>c.population>=5&&c.food>=3&&c.ore>=4);
 if(origin){const voyagers=MarbleSociety.residents(s,origin).splice(-2);origin.population-=2;origin.food-=3;origin.ore-=4;civ.colonies.push({name:'거울바다',people:voyagers,marble:2,population:2,food:3,ore:0,gravity:.6,fertility:1.1,greenhouse:false});record(origin.name+' 주민 두 명이 구슬 경계를 넘어 거울바다에 정착했다.')}
 }
}
function advanceWorld(){
 if(s.tick%96===0)villageCouncil();
 if(s.tick%144===0)registerFaith();
 if(s.tick%192===0){frontier();MarbleSociety.govern(s,record)}
 if(s.tick%384===0)MarbleSociety.outsiders(s,record);
 if(s.tick%24===0)civ.power=Math.min(100,civ.power+1);
 if(civ.lawUntil&&s.tick>=civ.lawUntil){civ.gravity=1;civ.lawUntil=0;record('중력 이상이 끝나 이동 속도가 회복됐다.')}
 if(s.tick%144===0){
 const groups=[],seen=new Set();
 for(const founder of s.p){
 if(seen.has(founder.name))continue;
 const members=[founder];seen.add(founder.name);
 for(const member of members)for(const neighbor of s.p){
 if(!seen.has(neighbor.name)&&(member.friends[neighbor.name]||0)>=2&&(neighbor.friends[member.name]||0)>=2){members.push(neighbor);seen.add(neighbor.name)}}
 if(members.length>=3)groups.push(members.map(p=>p.name))
 }
 for(const group of groups){if(!(civ.groups||[]).some(old=>old.some(name=>group.includes(name))))record(group.join('·')+'의 상조회 결성');
 const people=group.map(name=>s.p.find(p=>p.name===name)),donor=people.reduce((a,b)=>a.food>b.food?a:b),recipient=people.find(p=>p.food===0);
 if(donor.food>=2&&recipient){donor.food--;recipient.food++;recipient.memory=donor.name+'에게 상조회 식량을 받았다.'}}
 civ.groups=groups;
 const votes=new Map();
 for(const p of s.p){
 const choice=s.p.filter(q=>q!==p).sort((a,b)=>(p.friends[b.name]||0)+(p.debt[b.name]||0)-(p.friends[a.name]||0)-(p.debt[a.name]||0))[0];
 if((p.friends[choice.name]||p.debt[choice.name]))votes.set(choice.name,(votes.get(choice.name)||0)+1);
 if(p.food>(civ.charter==='공동 분배'?2:4)){p.food--;civ.stock++}
 }
 const winner=[...votes].sort((a,b)=>b[1]-a[1])[0];
 if(winner&&winner[0]!==civ.leader){civ.leader=winner[0];record(winner[0]+' 주민 대표 선출 · '+winner[1]+'표')}
 for(const p of [...s.p].sort((a,b)=>a.food-b.food)){if(p.food===0&&civ.stock){p.food++;civ.stock--}}
 }
 if(s.tick%48===0){
 const discoveries=[['천문력',civ.observations>=8],['정밀 공구',civ.craft>=8&&(!s.genesis||s.genesis.tools.some(tool=>tool.key.endsWith(':1')))],['항법',civ.knowledge.includes('천문력')&&civ.observations>=24],['추진 기관',civ.knowledge.includes('정밀 공구')&&s.houses>=2&&civ.craft>=18&&(!s.genesis||s.genesis.tools.some(tool=>tool.key.endsWith(':2')))]];
 for(const [name,ok] of discoveries)if(ok&&!civ.knowledge.includes(name)){civ.knowledge.push(name);const scholar=[...s.p].sort((a,b)=>b.stars-a.stars)[0];scholar.lore.push(name);record('마을 연구 기록에 '+name+' 원리가 등록됐다.')}
 if(civ.knowledge.length>=4&&s.wood>=4&&civ.stock>=2){s.wood-=4;civ.stock-=2;civ.fleet++;record('목재 4와 보급 식량 2로 탐사선 완성')}
 if(civ.fleet&&civ.stock>=1){civ.fleet--;civ.stock--;civ.voyages++;
 const n=civ.voyages,star=['청람','유리','노을','서리'][(n-1)%4]+' '+n;
 civ.systems.push({star,gravity:0.5+((n*17)%20)/10});record(star+' 항성계 탐사 완료');
 if(n>=4&&!civ.boundary&&civ.observations>=32){civ.boundary=true;record('탐사선들이 같은 경계 신호를 삼각측량해 구슬 표면을 발견했다.')}
 }
 if(civ.boundary&&!civ.contact&&civ.voyages>=5){civ.contact=true;record('구슬 밖 추방자가 귀환 항로를 요청했다.')}
 if(civ.contact&&!civ.treaty&&!civ.lawUntil&&s.tick%384===0){civ.gravity=2;civ.lawUntil=s.tick+96;record('외신의 통로가 열리며 마을의 중력이 증가했다.')}
 }
 const i=s.tick%12,p=s.p[i];p.born??=0;p.generation??=1;
 if(s.tick-p.born>=3600+i*96){
 const old=p.name;record(old+' 생애 종료 · 별 기록 '+p.stars+'건을 후대에 전승');
 if(s.apostle===i){s.apostle=-1;record('사도의 별자리가 비었다. 새 사도를 선택할 수 있다.')}
 p.plan=null;p.completed=0;const lesson=p.lore[0];p.lore=lesson?[lesson]:[];p.trust=2;p.faith=Math.floor(p.faith/2);
 civ.heritage.push({name:old,heir:names[i]+' '+(p.generation+1)+'세',lesson:lesson||'생활 기록'});if(civ.heritage.length>100)civ.heritage.shift();
 p.generation++;p.name=names[i]+' '+p.generation+'세';p.born=s.tick;p.stars=Math.floor(p.stars/2);p.friends={};p.debt={};p.hunger=0;p.fatigue=0;p.memory=old+'의 기록을 물려받았다.';
 }
}
function step(){s.tick++;if(s.genesis)MarbleGenesis.cycle(s);advanceWorld();landscapeTick();s.p.forEach((p,i)=>{let [x,y]=target(p,i);walk(p,x,y);if(s.genesis)MarbleGenesis.survey(s,p);if(p.x!==x||p.y!==y)return;if((p.dwelling??0)<3){p.dwelling=(p.dwelling??0)+1;return}p.dwelling=0;
 const before={wood:s.wood,food:p.food};let conversation=false;
 if(s.genesis)MarbleGenesis.finish(s,p,record);finishWork(p);farm(p,i);let a=p.act;
 if(a===0&&s.berries){s.berries--;p.food++}if(a===8&&s.land.fish){s.land.fish--;p.food++}
 if(a===7){const q=s.p.find(q=>q!==p&&Math.hypot(q.x-p.x,q.y-p.y)<24);if(q){conversation=true;teach(p,q);teach(q,p);for(const [u,v] of [[p,q],[q,p]]){u.friends[v.name]=(u.friends[v.name]??0)+1;u.memory=v.name+'와 마을길에서 이야기했다.'}note(p.name+'와 '+q.name+'의 대화 · 친분 '+p.friends[q.name])}}if(a===3&&p.food){p.food--;p.hunger=0}else p.hunger++;if(a===2){p.stars++;civ.observations++}if(a===4||a===5)civ.craft++;if(a===1&&p.food){let others=s.p.filter(q=>q!==p),q=others.sort((u,v)=>(p.debt[v.name]||0)-(p.debt[u.name]||0)||u.food-v.food)[0];q.food++;p.food--;q.debt[p.name]=(q.debt[p.name]||0)+1;note(p.name+' → '+q.name+'에게 식량을 나눴다. '+q.name+'이 은혜를 기억한다.')}MarbleSociety.progress(s,p,a,a===7?conversation:a===4?s.wood>before.wood:a===1?p.food<before.food:a===2||p.food>before.food,record);p.act=nextGoal(p,i)});}

return {state:s,step,record};
}