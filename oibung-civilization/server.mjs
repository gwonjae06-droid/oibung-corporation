import http from 'node:http';
import {readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
import {createWorld} from './world.mjs';
const file=process.env.WORLD_FILE||'world-save.json';
const data=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{people:{},links:{}};
const world=createWorld(data.world), state=world.state;
function save(){writeFileSync(file+'.tmp',JSON.stringify({...data,world:state}),{mode:0o600});renameSync(file+'.tmp',file)}

const env=process.env;
const oauthReady=Boolean(env.KAKAO_REST_KEY&&env.KAKAO_REDIRECT_URI?.startsWith('https://')&&env.KAKAO_SECRET&&/^https:\/\/pf\.kakao\.com\/[\w-]+(?:\/chat)?\/?$/.test(env.KAKAO_CHANNEL_URL||''));
const channelChat=(env.KAKAO_CHANNEL_URL||'').replace(/(?:\/chat)?\/?$/,'/chat');
data.kakaoAccounts??={};
const authorizations=new Map();
function redirect(res,to){res.writeHead(303,{Location:to,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end()}
async function kakaoLogin(req,res,path){
 const session=(req.headers.cookie||'').match(/(?:^|; )star=([a-f0-9-]+)/)?.[1];
 if(!oauthReady||!session||!data.people[session])return redirect(res,'/?link=unavailable');
 if(path==='/connect/kakao'){
 for(const [key,v] of authorizations)if(v.expires<Date.now()||v.session===session)authorizations.delete(key);
 const state=randomUUID();authorizations.set(state,{session,expires:Date.now()+300000});
 const query=new URLSearchParams({response_type:'code',client_id:env.KAKAO_REST_KEY,redirect_uri:env.KAKAO_REDIRECT_URI,state});
 return redirect(res,'https://kauth.kakao.com/oauth/authorize?'+query)
 }
 const query=new URL(req.url,'http://localhost').searchParams,key=query.get('state'),request=authorizations.get(key);
 if(!request||request.session!==session||request.expires<Date.now())return redirect(res,'/?link=expired');
 authorizations.delete(key);
 if(!query.get('code'))return redirect(res,'/?link=cancelled');
 try{
 const body=new URLSearchParams({grant_type:'authorization_code',client_id:env.KAKAO_REST_KEY,redirect_uri:env.KAKAO_REDIRECT_URI,code:query.get('code')});
 if(env.KAKAO_CLIENT_SECRET)body.set('client_secret',env.KAKAO_CLIENT_SECRET);
 const exchange=await fetch('https://kauth.kakao.com/oauth/token',{method:'POST',body,signal:AbortSignal.timeout(10000)});
 if(!exchange.ok)throw Error();const token=await exchange.json();
 const user=await fetch('https://kapi.kakao.com/v2/user/me',{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(10000)});
 if(!user.ok)throw Error();const id=String((await user.json()).id);if(!/^\d+$/.test(id))throw Error();
 if(data.kakaoAccounts[id]&&data.kakaoAccounts[id]!==session)return redirect(res,'/?link=conflict');
 for(const [old,value] of Object.entries(data.kakaoAccounts))if(value===session)delete data.kakaoAccounts[old];
 data.kakaoAccounts[id]=session;save();return redirect(res,channelChat)
 }catch{return redirect(res,'/?link=failed')}
}

const codes=new Map();
function snapshot(player){return {...state,apostle:player.apostle,civil:{...state.civil,power:player.power}}}
function command(player,type,value){
 const p=state.p[player.apostle];
 if(type==='choose'){
 const i=Number(value);if(!Number.isInteger(i)||!state.p[i])return '주민을 선택해 주세요.';
 if(Object.values(data.people).some(v=>v!==player&&v.apostle===i))return '이미 다른 성좌의 사도입니다.';
 player.apostle=i;player.name=state.p[i].name;return player.name+'에게 별빛이 닿았다.'
 }
 if(!p)return '사도를 먼저 선택해 주세요.';
 if(type==='pact'){const c=state.civil;if(!c.contact||c.treaty||c.stock<3)return '계약 조건이 부족합니다.';c.stock-=3;c.treaty=true;c.gravity=1;c.lawUntil=0;return '외신과 계약했다.'}
 if(type==='oracle'){
 const act=/별|우주|관찰/.test(value)?2:/이웃|도와|나눔/.test(value)?1:/식량|채집|모아/.test(value)?0:-1;
 if(act<0)return '별 관찰, 채집, 이웃 돕기를 제안해 주세요.';
 if(p.hunger>=6||(act===1&&p.food<2)){if(--p.trust<=-3)player.apostle=-1;return p.name+'이 생존을 우선해 계시를 거절했다.'}
 p.act=act;p.dwelling=0;return p.name+'이 계시를 받아들였다.'
 }
 const cost=new Map([['신탁',10],['축복',15],['기적',40],['강림',100]]).get(type);
 if(!cost||player.power<cost)return '권능이나 성력을 확인해 주세요.';
 player.power-=cost;p.trust=Math.min(8,p.trust+1);
 for(const q of state.p)if(Math.hypot(q.x-p.x,q.y-p.y)<38)q.faith=Math.min(8,q.faith+1);
 if(type==='신탁'){p.act=2;p.dwelling=0}if(type==='축복'){p.fatigue=0;p.hunger=Math.max(0,p.hunger-2)}
 if(type==='기적')state.berries=Math.min(30,state.berries+10);
 if(type==='강림'){state.civil.gravity=1;state.civil.lawUntil=0;for(const q of state.p)q.fatigue=0}
 return type+' 발현 · '+p.name
}
setInterval(()=>{world.step();for(const player of Object.values(data.people)){if(player.apostle>=0&&state.p[player.apostle].name!==player.name)player.apostle=-1;if(state.tick%24===0)player.power=Math.min(100,player.power+1)}if(state.tick%12===0)save()},600);
const page=readFileSync(new URL('./index.html',import.meta.url),'utf8').replace('<script>','<script>globalThis.SERVER_WORLD=true;</script><script>').replace('</html>','<script src="/shared.js"></script></html>');
const client=readFileSync(new URL('./shared.js',import.meta.url),'utf8');
http.createServer(async(req,res)=>{
 const path=req.url.split('?')[0];function respond(code,body,mime='application/json'){res.writeHead(code,{'content-type':mime+'; charset=utf-8','cache-control':'no-store'});res.end(mime==='application/json'?JSON.stringify(body):body)}
 try{
 if(req.method==='GET'&&['/connect/kakao','/connect/kakao/callback'].includes(path))return await kakaoLogin(req,res,path);
 if(req.method==='GET'&&path==='/health')return respond(200,{service:'oibung-civilization',tick:state.tick});
 if(req.method==='GET'&&path==='/')return respond(200,page,'text/html');
 if(req.method==='GET'&&path==='/shared.js')return respond(200,client,'text/javascript');
 if(req.method!=='POST'||req.headers['content-type']?.split(';')[0]!=='application/json')return respond(404,{});
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>16000)return respond(413,{})}
 const b=JSON.parse(raw||'{}');
 if(path==='/kakao/'+process.env.KAKAO_SECRET&&process.env.KAKAO_SECRET){
 const uid=b.userRequest?.user?.id,phrase=String(b.userRequest?.utterance||'').trim();if(typeof uid!=='string')return respond(400,{});
 const key=phrase.replace(/^연결\s*/, '').replace(/[-\s]/g,'').toLowerCase();
 const code=codes.get(key);
 if(code&&code.until>Date.now()){for(const [old,t] of Object.entries(data.links))if(t===code.token)delete data.links[old];data.links[uid]=code.token;codes.delete(key);save()}
 const appId=String(b.userRequest.user.properties?.appUserId||'');
 const player=data.people[data.kakaoAccounts[appId]||data.links[uid]];
 let msg='게임에서 카카오톡 연결을 눌러 주세요. 계정 연결 후에도 이 메시지가 보이면 채널의 사용자 식별 동의를 확인해 주세요.';
 if(player){const p=state.p[player.apostle];msg=phrase.startsWith('/계시 ')?command(player,'oracle',phrase.slice(4)):phrase==='/역사'?state.log.slice(0,3).join('\n'):p?p.name+' · 식량 '+p.food+' · 별 기록 '+p.stars:'사도를 선택해 주세요.';save()}
 if(code&&code.until>Date.now())msg='성좌 연결 완료! /사도 또는 /역사를 입력해 보세요.';
 return respond(200,{version:'2.0',template:{outputs:[{simpleText:{text:msg}}]}})
 }
 if(!['/world','/command','/link'].includes(path))return respond(404,{});
 let token=(req.headers.cookie||'').match(/(?:^|; )star=([a-f0-9-]+)/)?.[1],player=data.people[token];
 if(!player){if(path!=='/world')return respond(401,{});token=randomUUID();player=data.people[token]={apostle:-1,power:45};res.setHeader('Set-Cookie','star='+token+'; Path=/; HttpOnly; SameSite=Lax');save()}
 if(path==='/world')res.setHeader('Set-Cookie','star='+token+'; Path=/; HttpOnly; SameSite=Lax');
 let message='';
 if(path==='/command'){if(!b.id||typeof b.id!=='string')return respond(400,{});player.recent??=[];const prev=player.recent.find(v=>v.id===b.id);if(prev)message=prev.message;else{message=command(player,b.type,String(b.value??''));world.record(message);player.recent.unshift({id:b.id,message});player.recent.length=Math.min(32,player.recent.length);save()}}
 if(path==='/link'){if(!process.env.KAKAO_SECRET)message='채널 스킬 서버 설정이 필요합니다.';else{for(const [key,c] of codes)if(c.token===token||c.until<=Date.now())codes.delete(key);message=randomBytes(8).toString('hex');codes.set(message,{token,until:Date.now()+300000})}}
 respond(200,{state:snapshot(player),message,connection:{oneTap:oauthReady,enabled:Boolean(process.env.KAKAO_SECRET),linked:Object.values(data.kakaoAccounts).includes(token)||Object.values(data.links).includes(token),channel:/^https:\/\/pf\.kakao\.com\/[A-Za-z0-9_-]+(?:\/chat)?\/?$/.test(process.env.KAKAO_CHANNEL_URL||'')?process.env.KAKAO_CHANNEL_URL.replace(/(?:\/chat)?\/?$/,'/chat'):null},code:path==='/link'&&codes.has(message)?message:null})
 }catch{respond(400,{error:'요청 처리 실패'})}
}).listen(Number(process.env.PORT||8080));
process.on('SIGTERM',()=>{save();process.exit()});