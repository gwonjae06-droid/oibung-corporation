import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {randomBytes} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {spawn} from 'node:child_process';
const dir=join(homedir(),'.oibung-village');
mkdirSync(dir,{recursive:true,mode:0o700});
const path=join(dir,'channel.json');
let settings=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{};
if(!existsSync(path)||process.argv.includes('--setup')){
 const input=createInterface({input:process.stdin,output:process.stdout});
 try{
 const url=(await input.question('공개 서버 HTTPS 주소 (로컬 플레이는 Enter): ')).trim();
 const channel=url?(await input.question('카카오 채널 URL (https://pf.kakao.com/...): ')).trim():'';
 if(url&&new URL(url).protocol!=='https:')throw Error('HTTPS 주소가 필요합니다.');
 if(channel&&!/^https:\/\/pf\.kakao\.com\/[\w-]+(?:\/chat)?\/?$/.test(channel))throw Error('카카오 채널 주소를 확인하세요.');
 settings={origin:url?new URL(url).origin:'',channel,secret:settings.secret||randomBytes(24).toString('hex')};
 writeFileSync(path,JSON.stringify(settings),{mode:0o600});
 }finally{input.close()}
}
if(settings.origin&&settings.channel){
 process.env.KAKAO_SECRET??=settings.secret;process.env.KAKAO_CHANNEL_URL??=settings.channel;
 console.log('카카오 관리자 스킬 URL (관리자에게만 표시)\n'+settings.origin+'/kakao/'+process.env.KAKAO_SECRET);
}
process.env.WORLD_FILE??=existsSync('world-save.json')?'world-save.json':join(dir,'world-save.json');
await import('./server.mjs');
const address='http://localhost:'+Number(process.env.PORT||8080);
console.log('마을 열기 '+address);
if(process.platform==='win32')spawn('explorer.exe',[address],{detached:true,stdio:'ignore'}).unref();
