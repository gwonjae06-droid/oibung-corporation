
/* Corridor model + presenting curator (per-corridor pose / position / composition). */
(function(){
  var css=[
    '#gallery-3d .museum-map-rooms{display:none}',
    '#gallery-3d .museum-view::after{content:"";position:absolute;inset:0;z-index:4;pointer-events:none;mix-blend-mode:soft-light;background:var(--corridor-tint,transparent);transition:background .5s}',
    '#gallery-3d .museum-view[data-corridor="1"]{--corridor-tint:#3a5a9a66}',
    '#gallery-3d .museum-view[data-corridor="2"]{--corridor-tint:#8a3a5a60}',
    '#gallery-3d .museum-view[data-corridor="3"]{--corridor-tint:#3a8a6a60}',
    '#gallery-3d .museum-view[data-corridor="4"]{--corridor-tint:#8a6a2a66}',
    '#gallery-3d .museum-movement{z-index:22}',
    '#gallery-3d .museum-ui .museum-curator{height:calc(var(--ch,150) * 1vh);width:calc(var(--ch,150) * .4444vh);bottom:calc(var(--cb,-20) * 1vh)}',
    '#gallery-3d .museum-ui .museum-curator[data-side="l"]{left:calc(var(--cx,17) * 1vw - var(--ch,150) * .2222vh);right:auto}',
    '#gallery-3d .museum-ui .museum-curator[data-side="r"]{right:calc(var(--cx,17) * 1vw - var(--ch,150) * .2222vh);left:auto}',
    '#gallery-3d .museum-curator>img{display:none}',
    '#gallery-3d .cur-art{position:absolute;inset:0;transform:rotate(var(--rot,0deg));transform-origin:50% 100%;filter:drop-shadow(0 18px 24px #0000008c)}',
    '#gallery-3d .museum-curator[data-side="r"] .cur-art{transform:scaleX(-1) rotate(var(--rot,0deg))}',
    '#gallery-3d .cur-art svg{display:block;width:100%;height:100%}',
    '#gallery-3d [data-gallery-mode="dark"] .cur-art{filter:brightness(.62) contrast(1.08) drop-shadow(0 15px 20px #000e)}',
    '#gallery-3d .museum-ui>.museum-curator-dialogue{display:block;position:absolute;top:auto;right:auto;left:50%;bottom:clamp(14px,4vh,40px);transform:translateX(-50%);width:min(620px,60vw);z-index:23;padding:14px 20px;font-size:clamp(13px,1.15vw,17px);line-height:1.65;pointer-events:none}',
    '#gallery-3d .museum-ui>.museum-curator-dialogue::before{content:"안내 비서";display:block;margin-bottom:4px;font-size:11px;letter-spacing:.2em;color:#e0c8a2}',
    '#gallery-3d .museum-ui>.museum-curator-dialogue[hidden]{display:none}',
    '#gallery-3d .museum-ui>#museum-guide-toggle{position:absolute;top:auto;right:12px;bottom:12px;z-index:23}',
    '#gallery-3d .museum-ui>#museum-guide-toggle[hidden]{display:none}',
    '@media(max-width:700px){#gallery-3d .museum-ui>.museum-curator-dialogue{left:auto;right:56px;transform:none;width:min(64vw,420px);bottom:10px;font-size:12px;padding:10px 12px}}',
    '#gallery-3d .cur .c-lean{transform:rotate(var(--lean,0deg));transform-box:fill-box;transform-origin:50% 100%}',
    '#gallery-3d .cur .c-breath{animation:cur-breath 5s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}',
    '#gallery-3d .cur .c-sway{animation:cur-sway 7s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 0}',
    '#gallery-3d .cur .c-head{animation:cur-head 8s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}',
    '#gallery-3d .cur .c-blink{animation:cur-blink 5s infinite;transform-box:fill-box;transform-origin:50% 35%}',
    '#gallery-3d .cur .c-blink.r{animation-delay:.03s}',
    '#gallery-3d .cur .c-gaze{animation:cur-gaze 9s ease-in-out infinite}',
    '@keyframes cur-breath{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}',
    '@keyframes cur-sway{0%,100%{transform:rotate(0)}50%{transform:rotate(.8deg)}}',
    '@keyframes cur-head{0%,100%{transform:rotate(var(--tilt,0deg))}40%{transform:rotate(calc(var(--tilt,0deg) - 1deg))}70%{transform:rotate(calc(var(--tilt,0deg) + .8deg))}}',
    '@keyframes cur-blink{0%,90%,100%{transform:scaleY(1)}93%{transform:scaleY(.07)}96%{transform:scaleY(1)}}',
    '@keyframes cur-gaze{0%,36%,100%{transform:translateX(2px)}44%,68%{transform:translateX(-2px)}76%,92%{transform:translateX(4px)}}',
    '@media(prefers-reduced-motion:reduce){#gallery-3d .cur *{animation:none!important}}',
    '#gallery-3d .cur .arm{display:none}',
    '#gallery-3d .cur.p0{--tilt:3deg;--lean:1deg}',
    '#gallery-3d .cur.p1{--tilt:-2deg;--lean:-1.5deg}',
    '#gallery-3d .cur.p2{--tilt:4deg;--lean:0deg}',
    '#gallery-3d .cur.p3{--tilt:-3deg;--lean:2deg}',
    '#gallery-3d .cur.p4{--tilt:2deg;--lean:-2deg}',
    '#gallery-3d .cur.p0 .aR-present,#gallery-3d .cur.p0 .aL-clasp{display:inline}',
    '#gallery-3d .cur.p1 .aR-point,#gallery-3d .cur.p1 .aL-hip{display:inline}',
    '#gallery-3d .cur.p2 .aR-wave,#gallery-3d .cur.p2 .aL-down{display:inline}',
    '#gallery-3d .cur.p3 .aR-clasp,#gallery-3d .cur.p3 .aL-clasp{display:inline}',
    '#gallery-3d .cur.p4 .aR-present,#gallery-3d .cur.p4 .aL-hip{display:inline}'
  ].join('');
  var style=document.createElement('style');
  style.setAttribute('data-museum-corridor','');
  style.textContent=css;
  (document.head||document.documentElement).appendChild(style);
})();

/* Clicking an artwork opens its detail directly (no walk-forward / close-up step). */
(function(){
  function blocked(e){
    return window.OIBUNG_CURRENT_VIEW==='reviews'||document.querySelector('dialog[open]')||e.ctrlKey||e.altKey||e.metaKey;
  }
  function areaNow(){var s=document.getElementById('museum-stage');return s?s.dataset.area:'';}
  window.addEventListener('click',function(e){
    var p=e.target.closest&&e.target.closest('#gallery-3d .museum-painting');
    if(!p)return;
    if(areaNow()==='lobby')return;
    var id=p.dataset.gameId;
    if(!id||!window.OIBUNG_CATALOG||!window.OIBUNG_CATALOG.openDetail)return;
    e.stopImmediatePropagation();e.preventDefault();
    window.OIBUNG_CATALOG.openDetail(id);
  },true);
  window.addEventListener('keydown',function(e){
    if(['Enter','ArrowUp','e','E'].indexOf(e.key)<0||blocked(e))return;
    var t=e.target;
    if(t.closest&&t.closest('input,textarea,select,[contenteditable="true"]'))return;
    var stage=document.getElementById('museum-stage'),surface=document.getElementById('gallery-3d');
    if(!stage||!surface||surface.hidden||!surface.offsetParent||stage.dataset.area==='entrance')return;
    if(t.closest&&t.closest('button,a')&&!surface.contains(t))return;
    var d=document.getElementById('museum-details');
    if(!d||d.hidden)return;
    e.stopImmediatePropagation();e.preventDefault();d.click();
  },true);
})();

/* Corridors, map jumps, presenting curator. */
(function(){
  var CUR_SVG=[
    '<svg viewBox="0 0 400 900" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">',
    '<defs><clipPath id="cur-ec"><path d="M136 157C152 159 172 166 188 178C172 192 148 190 136 157Z"/></clipPath>',
    '<g id="cur-eye"><path d="M136 157C152 159 172 166 188 178C172 192 148 190 136 157Z" fill="#fff"/>',
    '<g clip-path="url(#cur-ec)"><g class="c-gaze"><ellipse cx="163" cy="175" rx="15" ry="14" fill="#8fb7da"/><ellipse cx="163" cy="182" rx="12" ry="8" fill="#c8e2f5" opacity=".7"/>',
    '<ellipse cx="163" cy="175" rx="15" ry="14" fill="none" stroke="#4a6d93" stroke-width="2"/><ellipse cx="163" cy="175" rx="3.5" ry="11" fill="#10121a"/>',
    '<circle cx="156" cy="168" r="5" fill="#fff"/><circle cx="170" cy="184" r="2.4" fill="#fff"/></g>',
    '<path d="M130 150L196 150L196 170C172 166 150 162 130 160Z" fill="#14141c" opacity=".28"/></g>',
    '<path d="M132 154C152 157 176 166 192 180" fill="none" stroke="#14141c" stroke-width="5.5" stroke-linecap="round"/>',
    '<path d="M136 157L125 146" fill="none" stroke="#14141c" stroke-width="3.5" stroke-linecap="round"/></g></defs>',
    '<g class="cur-body" transform="translate(0,260)" stroke="#1d1417" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">',
    '<ellipse cx="200" cy="626" rx="88" ry="9" fill="#000" opacity=".22" stroke="none"/>',
    '<g class="c-lean"><g class="c-breath">',
    '<path d="M164 488L192 488L190 598L162 598Z" fill="#22242e"/><path d="M208 488L236 488L238 598L210 598Z" fill="#22242e"/>',
    '<path d="M156 596L192 596L196 618Q176 627 152 621Z" fill="#3b2a2e"/><path d="M244 596L208 596L204 618Q224 627 248 621Z" fill="#3b2a2e"/>',
    '<path d="M134 408L266 408L292 492L108 492Z" fill="#2c3a57"/>',
    '<path d="M160 410L150 490M185 410L180 490M215 410L220 490M240 410L250 490" fill="none" stroke-width="1.6" opacity=".5"/>',
    '<path d="M108 492L292 492" fill="none" stroke="#d9b86a" stroke-width="4"/>',
    '<path d="M146 290Q200 276 254 290L266 412L134 412Z" fill="#27324a"/><path d="M180 285L200 332L220 285Z" fill="#f6f6f8"/>',
    '<path d="M200 334L178 322L180 346Z" fill="#6f8fb5"/><path d="M200 334L222 322L220 346Z" fill="#6f8fb5"/><circle cx="200" cy="334" r="6" fill="#5a7aa0"/>',
    '<circle cx="176" cy="366" r="4.5" fill="#d9b86a" stroke-width="2"/><circle cx="224" cy="366" r="4.5" fill="#d9b86a" stroke-width="2"/>',
    '<path d="M134 410L266 410" fill="none" stroke="#d9b86a" stroke-width="4"/>',
    '<g class="arm aL-clasp"><path d="M150 302Q130 352 190 394" fill="none" stroke="#1d1417" stroke-width="31"/><path d="M150 302Q130 352 190 394" fill="none" stroke="#34456a" stroke-width="24"/><circle cx="193" cy="398" r="13" fill="#f6f6f8"/></g>',
    '<g class="arm aL-hip"><path d="M150 302Q104 350 148 398" fill="none" stroke="#1d1417" stroke-width="31"/><path d="M150 302Q104 350 148 398" fill="none" stroke="#34456a" stroke-width="24"/><circle cx="151" cy="404" r="13" fill="#f6f6f8"/></g>',
    '<g class="arm aL-down"><path d="M150 302Q124 362 128 420" fill="none" stroke="#1d1417" stroke-width="31"/><path d="M150 302Q124 362 128 420" fill="none" stroke="#34456a" stroke-width="24"/><circle cx="128" cy="432" r="13" fill="#f6f6f8"/></g>',
    '<g class="arm aR-clasp"><path d="M250 302Q270 352 210 394" fill="none" stroke="#1d1417" stroke-width="31"/><path d="M250 302Q270 352 210 394" fill="none" stroke="#34456a" stroke-width="24"/><circle cx="207" cy="398" r="13" fill="#f6f6f8"/></g>',
    '<g class="arm aR-present"><path d="M250 302Q286 346 334 336" fill="none" stroke="#1d1417" stroke-width="31"/><path d="M250 302Q286 346 334 336" fill="none" stroke="#34456a" stroke-width="24"/><ellipse cx="348" cy="334" rx="17" ry="12" fill="#f6f6f8" transform="rotate(-15 348 334)"/><ellipse cx="344" cy="322" rx="7" ry="5" fill="#f6f6f8" transform="rotate(-40 344 322)"/></g>',
    '<g class="arm aR-point"><path d="M250 302Q300 292 344 254" fill="none" stroke="#1d1417" stroke-width="31"/><path d="M250 302Q300 292 344 254" fill="none" stroke="#34456a" stroke-width="24"/><path d="M356 244L380 224" fill="none" stroke="#1d1417" stroke-width="12"/><path d="M356 244L380 224" fill="none" stroke="#f6f6f8" stroke-width="6"/><circle cx="352" cy="248" r="13" fill="#f6f6f8"/></g>',
    '<g class="arm aR-wave"><path d="M250 302Q300 332 306 266" fill="none" stroke="#1d1417" stroke-width="31"/><path d="M250 302Q300 332 306 266" fill="none" stroke="#34456a" stroke-width="24"/><circle cx="306" cy="250" r="15" fill="#f6f6f8"/><path d="M298 238L296 228M306 236L306 225M314 238L316 228" fill="none" stroke-width="3"/></g>',
    '</g>',
    '<path d="M186 228L214 228L216 288Q200 298 184 288Z" fill="#f3c6b8"/>',
    '<g class="c-head">',
    '<g class="c-sway"><path d="M116 150C108 70 156 26 200 26C250 26 296 70 286 150C292 200 290 250 274 280L240 252L160 252L126 280C110 250 108 200 116 150Z" fill="#14141c"/></g>',
    '<ellipse cx="200" cy="160" rx="74" ry="76" fill="#fde3d6"/>',
    '<ellipse cx="140" cy="204" rx="14" ry="8" fill="#f5a9a0" opacity=".22" stroke="none"/><ellipse cx="260" cy="204" rx="14" ry="8" fill="#f5a9a0" opacity=".22" stroke="none"/>',
    '<g class="c-blink"><use href="#cur-eye"/></g><g class="c-blink r"><use href="#cur-eye" transform="matrix(-1 0 0 1 400 0)"/></g>',
    '<path d="M130 139L184 149M270 139L216 149" fill="none" stroke="#14141c" stroke-width="4"/>',
    '<path d="M200 190Q197 196 201 198" fill="none" stroke="#d29a8c" stroke-width="2"/>',
    '<path d="M189 216Q200 214 211 216" fill="none" stroke="#a05a62" stroke-width="3"/>',
    '<path d="M124 152C126 84 166 54 200 54C238 54 276 84 278 152C264 122 238 112 200 114C162 114 138 122 124 152Z" fill="#14141c"/>',
    '<path d="M118 150C112 192 116 240 130 272L152 262C146 222 150 182 150 150Z" fill="#14141c"/><path d="M282 150C288 192 284 240 270 272L248 262C254 222 250 182 250 150Z" fill="#14141c"/>',
    '<path d="M142 84C172 64 226 62 258 88" fill="none" stroke="#5a6b92" stroke-width="7" opacity=".75"/>',
    '<path d="M150 130C168 122 190 120 204 124" fill="none" stroke="#5a6b92" stroke-width="4" opacity=".55"/>',
    '<path d="M130 200L134 246M270 200L266 246" fill="none" stroke="#5a6b92" stroke-width="3.5" opacity=".5"/>',
    '<path d="M252 96L256 104L265 105L258 111L260 120L252 115L244 120L246 111L239 105L248 104Z" fill="#d9b86a" stroke-width="2"/>',
    '</g></g></g></svg>'
  ].join('');
  var DESK=[{h:150,b:-20,cx:17,rot:0},{h:125,b:-5,cx:15,rot:-2},{h:175,b:-35,cx:20,rot:1.5},{h:140,b:-14,cx:13,rot:-1},{h:160,b:-27,cx:18,rot:2}];
  var MOB=[{h:78,b:-14,cx:16,rot:0},{h:70,b:-8,cx:17,rot:-2},{h:90,b:-22,cx:18,rot:1.5},{h:74,b:-10,cx:15,rot:-1},{h:84,b:-18,cx:17,rot:2}];
  var lobbyBusy=false;
  function info(){
    var stage=document.getElementById('museum-stage');
    if(!stage)return null;
    var plaque=document.querySelector('#gallery-3d .museum-works .museum-plaque small');
    var n=plaque?parseInt((plaque.textContent.match(/\d+/)||[0])[0],10):0;
    var total=document.querySelectorAll('#gallery-3d .museum-map-list button').length;
    return {area:stage.dataset.area,n:n,total:total};
  }
  function go(target,tries){
    var c=info();
    if(!c)return;
    if(c.area==='entrance'){var enter=document.getElementById('museum-enter');if(enter)enter.click();}
    if(c.area!=='focus'||!c.n){
      if(tries>0)setTimeout(function(){go(target,tries-1);},40);
      return;
    }
    var total=c.total,cur=c.n-1;
    if(!total||target<0||target>=total)return;
    var fwd=(target-cur+total)%total,back=(cur-target+total)%total;
    var btn=document.getElementById(fwd<=back?'museum-right':'museum-left');
    var steps=Math.min(fwd,back);
    for(var i=0;i<steps&&btn;i++)btn.click();
  }
  window.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('#gallery-3d .museum-map-list button');
    if(!b)return;
    var list=[].slice.call(document.querySelectorAll('#gallery-3d .museum-map-list button'));
    var target=list.indexOf(b);
    e.stopImmediatePropagation();e.preventDefault();
    var dlg=document.getElementById('museum-map-dialog');
    if(dlg&&dlg.close)dlg.close();
    go(target,6);
  },true);
  function placeCurator(idx){
    var box=document.getElementById('museum-curator');
    if(!box)return;
    var art=box.querySelector('.cur-art');
    if(!art){
      art=document.createElement('div');
      art.className='cur-art cur p0';
      art.innerHTML=CUR_SVG;
      box.insertBefore(art,box.firstChild);
    }
    var mobile=window.matchMedia('(max-width:700px)').matches;
    var cfg=(mobile?MOB:DESK)[idx%5];
    var key=(mobile?'m':'d')+idx;
    if(box.dataset.cfg===key)return;
    box.dataset.cfg=key;
    box.dataset.side=idx%2?'r':'l';
    box.style.setProperty('--ch',cfg.h);
    box.style.setProperty('--cb',cfg.b);
    box.style.setProperty('--cx',cfg.cx);
    art.style.setProperty('--rot',cfg.rot+'deg');
    art.className='cur-art cur p'+(idx%5);
  }
  function apply(){
    var ps=document.querySelectorAll('#gallery-3d .museum-painting');
    for(var j=0;j<ps.length;j++){
      var a=ps[j].getAttribute('aria-label')||'';
      if(/작품 정면으로 이동$/.test(a))ps[j].setAttribute('aria-label',a.replace(/작품 정면으로 이동$/,'작품 상세 보기'));
    }
    var mb=document.querySelectorAll('#gallery-3d .museum-map-list button');
    for(var k=0;k<mb.length;k++){
      var t=mb[k].textContent,nt=t.replace(/ — (좌측|우측) 회랑$/,' — '+(k+1)+'번 회랑');
      if(nt!==t)mb[k].textContent=nt;
    }
    var c=info();
    if(!c)return;
    var ui=document.querySelector('#gallery-3d .museum-ui');
    var box=document.getElementById('museum-curator');
    var dlg=document.getElementById('museum-curator-dialogue');
    var tg=document.getElementById('museum-guide-toggle');
    if(ui&&dlg&&dlg.parentNode!==ui)ui.appendChild(dlg);
    if(ui&&tg&&tg.parentNode!==ui)ui.appendChild(tg);
    if(box){
      if(dlg&&dlg.hidden!==box.hidden)dlg.hidden=box.hidden;
      if(tg&&tg.hidden!==box.hidden)tg.hidden=box.hidden;
    }
    var idx=(c.area==='focus'&&c.n)?c.n-1:0;
    placeCurator(idx);
    if(c.area==='focus'&&c.n){
      var label=document.getElementById('museum-area-name');
      var text='제 '+c.n+' 회랑'+(c.total?' · 총 '+c.total+'개':'');
      if(label&&label.textContent!==text)label.textContent=text;
      var view=document.getElementById('museum-view'),tone=String((c.n-1)%5);
      if(view&&view.dataset.corridor!==tone)view.dataset.corridor=tone;
      if(dlg&&document.documentElement.dataset.galleryMode!=='dark'){
        var p=document.querySelector('#gallery-3d .museum-painting');
        var strong=document.querySelector('#gallery-3d .museum-works .museum-plaque strong');
        var game={};
        try{game=(p&&window.OIBUNG_CATALOG&&window.OIBUNG_CATALOG.getGame&&window.OIBUNG_CATALOG.getGame(p.dataset.gameId))||{};}catch(err){game={};}
        var name=strong?strong.textContent:'';
        var msg='제 '+c.n+' 회랑입니다. 「'+name+'」'+(game.developer?', '+game.developer+'님이 만든 세계예요.':'이에요.')+' 작품을 눌러서 자세히 보세요.';
        if(name&&dlg.textContent!==msg)dlg.textContent=msg;
      }
    }
    if(c.area==='lobby'&&!lobbyBusy&&document.querySelector('#gallery-3d .museum-painting')){
      lobbyBusy=true;
      setTimeout(function(){
        lobbyBusy=false;
        var s=document.getElementById('museum-stage'),q=document.querySelector('#gallery-3d .museum-painting');
        if(s&&s.dataset.area==='lobby'&&q)q.click();
      },0);
    }
  }
  function start(){
    apply();
    new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-area','hidden']});
    window.addEventListener('resize',function(){var b=document.getElementById('museum-curator');if(b)b.dataset.cfg='';apply();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
