let pending=false;
async function shared(path='/world',body={}){
 if(pending){if(path!=='/world')setTimeout(()=>shared(path,body),100);return}pending=true;
 try{const res=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!res.ok)throw Error();const data=await res.json();
 s.p.forEach((p,i)=>tracks.set(i,[p.x,p.y]));lastMove=performance.now();
 Object.assign(civ,data.state.civil);Object.assign(s,data.state);s.civil=civ;
 s.p.forEach((p,i)=>pick.options[i].text=p.name);if(data.message&&!data.code)reply.textContent=data.message;connectionView(data);ui()
 }catch{reply.textContent='공유 세계 연결을 확인해 주세요.'}finally{pending=false}}
function submit(type,value){shared('/command',{id:crypto.randomUUID(),type,value})}
choose.onclick=()=>submit('choose',sel());send.onclick=()=>submit('oracle',msg.value);invoke=type=>submit(type);pact=()=>submit('pact');

const panel=document.createElement('article');
panel.innerHTML='<h2>공유 세계 · 카카오톡</h2><p role="status"></p><button>연결 코드 받기</button><input readonly aria-label="5분 연결 코드" hidden><button hidden>코드 복사</button> <a hidden target="_blank" rel="noopener" style="color:#ffe194">채널 채팅 열기 ↗</a>';
document.querySelector('header').after(panel);
const [status,issue,field,copy,chat]=Array.from(panel.children).slice(1);
let expires=0;
issue.onclick=()=>shared('/link');
copy.onclick=async()=>{field.select();try{await navigator.clipboard.writeText(field.value);copy.textContent='복사 완료'}catch{status.textContent='선택한 코드를 직접 복사해 주세요.'}};
function connectionView({connection,code}){
 if(!connection)return;
 if(code){expires=Date.now()+300000;field.value=code;copy.textContent='코드 복사'}
 const active=Date.now()<expires&&!connection.linked;
 field.hidden=copy.hidden=!active;issue.hidden=connection.linked||!connection.enabled;
 issue.textContent=active?'새 코드 받기':'연결 코드 받기';
 chat.hidden=!connection.channel;if(connection.channel)chat.href=connection.channel;
 status.textContent=connection.linked?'카카오톡 연결 완료 · /역사 또는 /사도':active?'코드를 채널 채팅에 붙여넣으세요 · 남은 시간 '+Math.ceil((expires-Date.now())/1000)+'초':connection.enabled?'공유 서버 연결됨 · 카카오톡 계정을 연결할 수 있어요.':'공유 서버 연결됨 · 운영자가 채널을 설정하면 사용할 수 있어요.'
}
shared();setInterval(()=>shared(),1200);