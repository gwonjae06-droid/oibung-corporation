globalThis.MarbleGenesis=(()=>{
 const materials=['나무','돌','덩굴','갈대'];
 const properties=[[2,1,0],[0,3,0],[1,0,3],[3,0,1]];
 const uses=['운반','절삭','결속'];
 function roll(w){w.seed=(Math.imul(w.seed,1664525)+1013904223)>>>0;return w.seed/4294967296}
 function start(s,seed){
   const w=s.genesis={seed,patches:[],paths:{},homes:[],tools:[],discoveries:[],visits:0};
   for(let i=0;i<40;i++)w.patches.push({x:12+Math.floor(roll(w)*315),y:84+Math.floor(roll(w)*72),kind:i%5,amount:4+Math.floor(roll(w)*8)});
   for(const p of s.p){p.food=0;p.act=12;p.camp=[p.x,p.y]}
 }
 function prepare(p){p.bag??=[0,0,0,0];p.seen??=[];p.skills??=[];p.need??=0}
 function survey(s,p){
   prepare(p);const w=s.genesis;
   w.patches.forEach((v,i)=>{if(!p.seen.includes(i)&&Math.hypot(v.x-p.x,v.y-p.y)<25)p.seen.push(i)});
   const k=Math.floor(p.x/6)+','+Math.floor(p.y/5);w.paths[k]=Math.min(60,(w.paths[k]||0)+1);
 }
 function choose(s,p,i){
   prepare(p);const w=s.genesis;
   if(p.food&&p.hunger>=4)return 3;
   if(p.fatigue>=5)return 6;
   const known=p.seen.map(id=>w.patches[id]).filter(v=>v.amount);
   const edible=known.filter(v=>v.kind===4);
   if(p.food<2&&edible.length){p.site=nearest(p,edible);return 13}
   const neighbours=s.p.filter(q=>q!==p&&Math.hypot(q.x-p.x,q.y-p.y)<35);
   if(neighbours.length&&p.food>=2&&neighbours.some(q=>q.food===0)){p.friend=neighbours.find(q=>q.food===0).name;return 16}
   if(!p.home){
     const host=w.homes.find(h=>Math.hypot(h.at[0]-p.x,h.at[1]-p.y)<32&&(p.debt[h.owner]||p.friends[h.owner])&&s.p.filter(q=>q.home&&q.home[0]===h.at[0]&&q.home[1]===h.at[1]).length<3);
     if(host){p.home=host.at.slice();p.memory=host.owner+'의 집에서 함께 살기로 했다.'}
   }
   if(!p.home&&p.bag[0]>=2&&p.bag[2]>=1){const near=known.filter(v=>v.kind===4);const anchor=near.length?nearest(p,near):[p.x,p.y];p.site=[Math.max(12,Math.min(329,(p.x+anchor[0])/2)),Math.max(86,Math.min(154,(p.y+anchor[1])/2))];return 15}
   if(p.bag.filter(Boolean).length>=2&&(!p.home?roll(w)<.35:true))return 14;
   if(p.home&&p.food&&roll(w)<.25)return i%2?2:7;
   const wanted=known.filter(v=>v.kind<4&&p.bag[v.kind]<3);
   if(wanted.length&&p.food&&roll(w)<.8){p.site=nearest(p,wanted);return 13}
   p.site=[12+Math.floor(roll(w)*318),83+Math.floor(roll(w)*72)];return 12
 }
 function nearest(p,list){const v=list.reduce((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)<Math.hypot(b.x-p.x,b.y-p.y)?a:b);return [v.x,v.y]}
 function finish(s,p,record){
   const w=s.genesis;prepare(p);
   if(p.act===13){const v=w.patches.find(v=>v.x===p.site?.[0]&&v.y===p.site?.[1]);if(v?.amount){const n=Math.min(v.amount,p.skills.includes(v.kind===0?'절삭':'운반')?2:1);v.amount-=n;if(v.kind===4)p.food+=n;else {p.bag[v.kind]+=n;if(p.home&&v.kind===0&&p.bag[0]>2){p.bag[0]--;s.wood++;s.civil.craft++}}}}
   if(p.act===16){const q=s.p.find(q=>q.name===p.friend);if(q&&p.food>=2&&Math.hypot(q.x-p.x,q.y-p.y)<28){p.food--;q.food++;q.debt[p.name]=(q.debt[p.name]||0)+1;prepare(q);q.seen=[...new Set([...q.seen,...p.seen])];if(p.skills.length&&!q.skills.includes(p.skills[0]))q.skills.push(p.skills[0]);q.memory=p.name+'에게 식량과 채집 위치를 배웠다.'}}
   if(p.act===15&&!p.home&&p.bag[0]>=2&&p.bag[2]){p.bag[0]-=2;if(!p.skills.includes('결속'))p.bag[2]--;p.home=p.site.slice();w.homes.push({at:p.home,owner:p.name});s.houses=w.homes.length;record(p.name+'이 나무와 덩굴로 생활권에 첫 거처를 세웠다.',{actor:p.name,kind:'정착'})}
   if(p.act===14){const parts=p.bag.map((v,i)=>v?i:-1).filter(v=>v>=0);if(parts.length<2)return;
     const a=parts.splice(Math.floor(roll(w)*parts.length),1)[0],b=parts[Math.floor(roll(w)*parts.length)];p.bag[a]--;p.bag[b]--;
     p.trials??={};
     const pair=[a,b].sort().join('-');
     const options=[0,1,2].filter(u=>p.trials[pair+':'+u]!==false);
     if(!options.length){p.bag[a]++;p.bag[b]++;return}
     const use=p.hunger>2&&options.includes(0)?0:options[Math.floor(roll(w)*options.length)],rating=properties[a][use]+properties[b][use];
     p.trials[pair+':'+use]=rating>=3;
     if(rating<3){p.memory=materials[a]+'와 '+materials[b]+' 조합은 '+uses[use]+'에 약했다.';return}
     const key=[a,b].sort().join('-')+':'+use;
     if(!p.skills.includes(uses[use]))p.skills.push(uses[use]);
     if(!w.tools.some(v=>v.key===key)){const name=materials[a]+'·'+materials[b]+' '+uses[use]+'구';w.tools.push({key,name,author:p.name});record(p.name+'이 '+name+'를 제작했다.',{actor:p.name,kind:'발명'})}
   }
 }
 function cycle(s){if(s.tick%12===0){const w=s.genesis;for(const v of w.patches)if(v.kind!==1&&v.amount<9&&roll(w)<.28)v.amount++}}
 return {start,choose,finish,survey,cycle}
})();