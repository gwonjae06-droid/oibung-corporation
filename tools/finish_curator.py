from pathlib import Path

for name in ['neutral','present','explain','alert']:
    if not Path(f'assets/curator/{name}.png').exists():
        raise SystemExit('Curator preparation has not completed. Engine unchanged; inspect Prepare approved curator sprites workflow.')
p = Path('gallery-scenes.js')
s = p.read_text()
if 'let blackoutTimer=null;' in s:
    raise SystemExit(0)
required = ['function start(){', 'function restore(){', 'function travel(target){', "case'talk':{const g=games[S.index];", "const pose=night?'alert':"]
if any(x not in s for x in required):
    raise SystemExit('Engine anchors changed; manual review needed. No engine write.')
s = s.replace('function start(){', 'function enterDark(){', 1)
insert = '''let blackoutTimer=null;
function cancelBlackout(){if(blackoutTimer!==null){clearTimeout(blackoutTimer);blackoutTimer=null;}stage.removeAttribute('data-blackout-pending');}
function start(){
 cancelBlackout();stage.dataset.blackoutPending='true';
 actor.src='assets/curator/alert.png';
 caption.textContent='잠깐만요. 방금 복도 끝에서…';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||root.classList.contains('motion-off');
 blackoutTimer=setTimeout(()=>{blackoutTimer=null;stage.removeAttribute('data-blackout-pending');enterDark();},reduced?0:1400);
}
'''
s = s.replace('function enterDark(){', insert+'function enterDark(){', 1)
s = s.replace('function restore(){','function restore(){cancelBlackout();',1)
s = s.replace('function travel(target){','function travel(target){cancelBlackout();',1)
s = s.replace("const pose=night?'alert':", "const pose=(night||stage.dataset.blackoutPending==='true')?'alert':",1)
s = s.replace("case'talk':{const g=games[S.index];", "case'talk':{actor.src='assets/curator/explain.png';const g=games[S.index];",1)
s = s.replace("case'night':open(notice);", "case'night':cancelBlackout();open(notice);",1)
s = s.replace("case'talk':{actor.src='assets/curator/explain.png';const g=games[S.index];if(g)render(", "case'talk':{const g=games[S.index];if(g)render(",1)
anchor = "break;}}});"
if anchor not in s:
    raise SystemExit('Action switch end changed; no engine write.')
s = s.replace(anchor, "if(g)actor.src='assets/curator/explain.png';break;}}});",1)
s = s.replace("case'exit':restore();", "case'exit':cancelBlackout();restore();",1)
p.write_text(s)
