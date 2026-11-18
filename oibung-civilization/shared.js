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
panel.innerHTML='<button disabled>카카오톡 연결</button><p role="status"></p>';
document.querySelector('header').after(panel);
const connect=panel.querySelector('button'),linkStatus=panel.querySelector('p');
const errors={expired:'연결 시간이 지났어요. 다시 눌러 주세요.',cancelled:'연결이 취소됐어요.',failed:'카카오 인증을 완료하지 못했어요.',conflict:'이 카카오 계정은 다른 성좌에 연결돼 있어요.',unavailable:'서버 연결 설정을 확인해 주세요.'};
let notice=errors[new URLSearchParams(location.search).get('link')]||'';
function connectionView({connection}){
 if(!connection)return;
 connect.disabled=!connection.oneTap&&!(connection.linked&&connection.channel);
 connect.textContent=connection.linked?'카카오톡 채팅 열기':'카카오톡 연결';
 linkStatus.textContent=notice||(connection.linked?'성좌 계정 연결됨':connection.oneTap?'':'운영자의 카카오 앱 연결 설정을 기다리고 있어요.');
 connect.onclick=()=>{notice='';location.assign(connection.linked?connection.channel:'/connect/kakao')}
}
shared();setInterval(()=>shared(),1200);