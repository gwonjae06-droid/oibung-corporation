let pending=false;
async function shared(path='/world',body={}){
 if(pending)return;pending=true;
 try{const res=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!res.ok)throw Error();const data=await res.json();
 s.p.forEach((p,i)=>tracks.set(i,[p.x,p.y]));lastMove=performance.now();
 Object.assign(civ,data.state.civil);Object.assign(s,data.state);s.civil=civ;
 s.p.forEach((p,i)=>pick.options[i].text=p.name);if(data.message)reply.textContent=data.message;ui()
 }catch{reply.textContent='공유 세계 연결을 확인해 주세요.'}finally{pending=false}}
function submit(type,value){shared('/command',{id:crypto.randomUUID(),type,value})}
choose.onclick=()=>submit('choose',sel());send.onclick=()=>submit('oracle',msg.value);invoke=type=>submit(type);pact=()=>submit('pact');
const link=document.createElement('button');link.textContent='카카오 채널 연결 코드';link.onclick=()=>shared('/link');oracle.append(link);
shared();setInterval(()=>shared(),1200);