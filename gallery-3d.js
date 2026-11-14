/*
 * OIBUNG GALLERY / First-person 3D museum.
 * Real WebGL architecture (Three.js) with live catalog exhibits.
 * The legacy accessible gallery is retained as a fallback when WebGL/CDN fails.
 */
(async () => {
  'use strict';
  const surface = document.getElementById('gallery-3d');
  const mount = document.getElementById('gallery-3d-canvas');
  const grid = document.getElementById('game-grid');
  const action = document.getElementById('gallery-3d-action');
  const focusLabel = document.getElementById('gallery-3d-focus');
  const hint = document.getElementById('gallery-3d-hint');
  const enter = document.getElementById('gallery-3d-enter');
  const welcome = document.getElementById('gallery-3d-welcome');
  const lightToggle = document.getElementById('gallery-3d-lights');
  const flashlightButton = document.getElementById('gallery-3d-torch');
  const joystick = document.getElementById('gallery-3d-joystick');
  const joystickKnob = document.getElementById('gallery-3d-knob');
  const lookZone = document.getElementById('gallery-3d-lookzone');
  if (!surface || !mount || !grid || !action) return;

  let THREE;
  for (const url of [
    'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js',
    'https://unpkg.com/three@0.180.0/build/three.module.js'
  ]) {
    try { THREE = await import(url); break; }
    catch (error) { console.warn('[3D Gallery] Module source unavailable:', url, error); }
  }
  if (!THREE) {
    console.warn('[3D Gallery] Three.js could not load. Using the original exhibition.');
    return;
  }
  // The old primitive character is retired. Once the CC0 VRoid loads, use
  // the smooth skinned mesh and textured face for every gallery exhibit.
  let createAnimeCurator = null;
  let vrmCuratorModule;
  try {
    vrmCuratorModule = await import('./gallery-vrm-curator.js?v=vrm-sculpt-1');
  } catch (error) {
    console.warn('[3D Gallery] Licensed VRoid loader unavailable; retaining illustrated fallback.',error);
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !matchMedia('(pointer:coarse)').matches, powerPreference:'high-performance' });
  } catch (error) {
    console.warn('[3D Gallery] WebGL not supported; using the existing gallery.', error);
    return;
  }
  const mobile = matchMedia('(pointer:coarse)').matches;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => reduceMotion.matches || document.documentElement.classList.contains('motion-off');
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.35 : 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setClearColor(0x22252a);
  mount.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '3D 전시관 시점. PC는 WASD로 이동, 마우스로 둘러보고 E로 감상합니다.');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8a59d);
  scene.fog = new THREE.FogExp2(0xa8a59d, 0.012);
  const camera = new THREE.PerspectiveCamera(mobile ? 72 : 74, 1, .06, 120);
  camera.rotation.order = 'YXZ';
  camera.position.set(0, 1.68, 5.1);
  scene.add(camera);
  const ambient = new THREE.AmbientLight(0xf5e7d0, .7);
  const hemisphere = new THREE.HemisphereLight(0xeaf3ff, 0x6e543d, 1.45);
  const sun = new THREE.DirectionalLight(0xffebcc, .95);
  sun.position.set(-4, 6, 7);
  scene.add(ambient, hemisphere, sun);
  const torch = new THREE.SpotLight(0xffedd1, 0, 19, Math.PI / 6, .63, 1.5);
  torch.position.set(0, -.10, .05);
  torch.target.position.set(0, -.13, -9);
  camera.add(torch, torch.target);

  const raycaster = new THREE.Raycaster();
  raycaster.far = 4.4;
  const center = new THREE.Vector2(0, 0);
  const pointerRay = new THREE.Vector2();
  const keys = new Set();
  const paintings = [];
  const exhibitionLights = [];
  const emergencyLights = [];
  const glowingFixtures = [];
  const avatarSprites = [];
  let world = null;
  let exhibits = [];
  let yaw = 0, pitch = 0, velocity = 0, stride = 0;
  let focused = -1, nearIndex = -1;
  let lastTime = 0, lastCount = 0, lastMove = 0;
  let hasEntered = false, flashlightOn = true;
  let darkness = false, active = false, rebuilding = false;
  let roomEnd = -20;
  let joyX = 0, joyY = 0, joystickPointer = null, lookPointer = null;
  let lastLookX = 0, lastLookY = 0, lookMoved = false;
  let allTextures = [];
  const material = (color, metalness=0, roughness=.8) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const materials = {
    ivory:material(0xc6bdae,0,.92), plaster:material(0xa9a296,0,.96),
    trim:material(0x9d855c,.6,.34), gold:material(0xc39a58,.74,.27),
    tile:material(0x777067,.07,.86), black:material(0x161b1d,.12,.74),
    oak:material(0x604a35,.12,.78), frame:material(0x5c3c24,.35,.54),
    glass:material(0xece4d4,.1,.48)
  };

  function elBox(parent, x, y, z, w, h, d, mat) {
    const obj = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    obj.position.set(x,y,z);
    parent.add(obj);
    return obj;
  }
  function elCylinder(parent,x,y,z,r1,r2,h,mat,segments=12) {
    const obj = new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),mat);
    obj.position.set(x,y,z);
    parent.add(obj);
    return obj;
  }
  function makeCanvas(w,h) {
    const canvas = document.createElement('canvas');
    canvas.width=w;canvas.height=h;return canvas;
  }
  function canvasTexture(canvas) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4,renderer.capabilities.getMaxAnisotropy());
    allTextures.push(texture);
    return texture;
  }
  function textLines(ctx,text,maxWidth,maxRows) {
    const rows=[];
    let row='';
    for (const letter of String(text || '')) {
      if (ctx.measureText(row + letter).width > maxWidth && row) {
        rows.push(row);
        row = letter;
        if (rows.length >= maxRows) { row = ''; break; }
      } else row += letter;
    }
    if (row && rows.length < maxRows) rows.push(row);
    return rows;
  }
  function plaqueTexture(title,sub) {
    const c=makeCanvas(1100,330),ctx=c.getContext('2d');
    ctx.fillStyle='#24211d';ctx.fillRect(0,0,c.width,c.height);
    ctx.strokeStyle='#ac8a56';ctx.lineWidth=7;ctx.strokeRect(14,14,1072,302);
    ctx.fillStyle='#cdb891';ctx.font='600 29px "Noto Sans KR",sans-serif';
    ctx.textAlign='center';ctx.fillText('O I B U N G   ·   E X H I B I T I O N',550,60);
    ctx.fillStyle='#fff5df';ctx.font='700 62px "Noto Serif KR",serif';
    const lines=textLines(ctx,title,995,2);
    lines.forEach((line,i)=>ctx.fillText(line,550,141+i*67));
    ctx.fillStyle='#dbcaaf';ctx.font='500 32px "Noto Sans KR",sans-serif';
    ctx.fillText(String(sub || '').slice(0,52),550,284);
    return canvasTexture(c);
  }
  function artworkTexture(game,index) {
    const c=makeCanvas(1024,640),ctx=c.getContext('2d');
    const name=String(game.title || '미공개 작품');
    const looks=[
      ['#191f2f','#ad784b','#f2d4a0'],['#073b3a','#6fa19a','#e2e0b7'],
      ['#2f2038','#aa6795','#f1cee4'],['#263247','#5584b6','#d8ebf0'],
      ['#473326','#af9068','#e8d8b9']
    ];
    const palette=looks[index % looks.length];
    const bg=ctx.createLinearGradient(0,0,1024,640);
    bg.addColorStop(0,palette[0]);bg.addColorStop(1,palette[1]);
    ctx.fillStyle=bg;ctx.fillRect(0,0,1024,640);
    // An original, high-resolution exhibit poster for titles without a
    // supplied thumbnail. Distinct motifs evoke each game without fake screenshots.
    const identity=[game.id,name,game.english,game.genre].join(' ').toLowerCase();
    ctx.save();
    ctx.translate(512,224);
    if(/오든|oden|elden|소울/.test(identity)){
      const halo=ctx.createRadialGradient(0,0,25,0,0,230);
      halo.addColorStop(0,'#070b11');halo.addColorStop(.59,'#090f19');
      halo.addColorStop(.64,'#ffe1a0');halo.addColorStop(.73,'#8f4629');
      halo.addColorStop(1,'#00000000');
      ctx.fillStyle=halo;ctx.beginPath();ctx.arc(0,0,230,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#13161e';ctx.beginPath();
      ctx.moveTo(-260,197);ctx.lineTo(-225,-30);ctx.lineTo(-170,-48);ctx.lineTo(-130,185);
      ctx.lineTo(-78,55);ctx.lineTo(-20,195);ctx.lineTo(55,9);ctx.lineTo(100,198);
      ctx.lineTo(160,-45);ctx.lineTo(215,-24);ctx.lineTo(264,197);ctx.closePath();ctx.fill();
      ctx.fillStyle='#ecd7aa';ctx.fillRect(-6,-144,12,296);
      ctx.beginPath();ctx.moveTo(-35,-137);ctx.lineTo(35,-137);ctx.lineTo(0,-201);ctx.closePath();ctx.fill();
      ctx.fillRect(-66,37,132,10);
    }else if(/아레나|arena|ballfight|핀볼/.test(identity)){
      ctx.strokeStyle='#98f3de';ctx.lineWidth=12;
      for(let i=0;i<9;i++){ctx.beginPath();ctx.moveTo(-400,-220+i*46);ctx.quadraticCurveTo(-40,0,400,218-i*47);ctx.stroke();}
      [[-160,-25,116,'#ffbb62'],[160,38,143,'#73e2f0'],[15,-146,49,'#ff71c4']].forEach(entry=>{
        const [x,y,r,color]=entry;
        const shine=ctx.createRadialGradient(x-r*.3,y-r*.4,4,x,y,r);
        shine.addColorStop(0,'#ffffff');shine.addColorStop(.25,color);
        shine.addColorStop(1,'#16252a');
        ctx.fillStyle=shine;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
      });
    }else if(/퍼리|furry|furi|메이드|cat/.test(identity)){
      ctx.fillStyle='#e8c8ed';ctx.beginPath();
      ctx.moveTo(-135,27);ctx.lineTo(-160,-182);ctx.lineTo(-43,-108);
      ctx.quadraticCurveTo(0,-143,43,-108);
      ctx.lineTo(160,-182);ctx.lineTo(135,27);
      ctx.bezierCurveTo(181,193,-180,193,-135,27);ctx.fill();
      ctx.fillStyle='#614061';ctx.beginPath();ctx.ellipse(-51,14,20,36,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(51,14,20,36,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#f7e7f7';ctx.beginPath();ctx.ellipse(0,82,55,34,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#b86789';ctx.beginPath();ctx.moveTo(-13,68);ctx.lineTo(13,68);ctx.lineTo(0,86);ctx.closePath();ctx.fill();
    }else if(/오이챔스|ochams|duel|대전/.test(identity)){
      [-1,1].forEach(side=>{
        ctx.save();ctx.rotate(side*.53);
        ctx.fillStyle=side<0?'#b7d8ef':'#f4b3a2';
        ctx.fillRect(side*72-8,-175,16,310);ctx.fillRect(side*72-87,40,175,17);
        ctx.beginPath();ctx.moveTo(side*72-25,-170);ctx.lineTo(side*72+25,-170);ctx.lineTo(side*72,-236);ctx.closePath();ctx.fill();
        ctx.restore();
      });
      ctx.fillStyle='#e1e7f1';ctx.font='800 106px Georgia,serif';ctx.textAlign='center';ctx.fillText('VS',0,90);
    }else if(/대학전선|campus|frontier|전략|strategy/.test(identity)){
      ctx.strokeStyle='#ddc897';ctx.lineWidth=5;
      for(let k=-6;k<=6;k++){
        ctx.beginPath();ctx.moveTo(k*65,-180);ctx.lineTo(k*65+240,196);ctx.stroke();
        ctx.beginPath();ctx.moveTo(-400,k*47);ctx.lineTo(410,k*47);ctx.stroke();
      }
      ctx.fillStyle='#ead4a6';
      [[-150,-52,98],[22,-92,155],[178,-18,77]].forEach(t=>{
        ctx.fillRect(t[0],75-t[2],t[2]*.7,t[2]);
        ctx.fillRect(t[0]-7,73-t[2],t[2]*.7+14,9);
      });
    }else{
      ctx.globalAlpha=.55;ctx.strokeStyle=palette[2];ctx.lineWidth=5;
      for(let i=0;i<12;i++){
        ctx.beginPath();ctx.ellipse(0,0,90+i*32,45+i*17,i*.14,0,Math.PI*2);ctx.stroke();
      }
    }
    ctx.restore();
    const cardShade=ctx.createLinearGradient(0,428,0,640);
    cardShade.addColorStop(0,'#111417c0');cardShade.addColorStop(1,'#080b0dfb');
    ctx.fillStyle=cardShade;ctx.fillRect(0,428,1024,212);
    ctx.fillStyle='#fdf4e5';ctx.textAlign='center';
    ctx.font='700 68px "Noto Serif KR",serif';
    textLines(ctx,name,920,2).forEach((line,i)=>ctx.fillText(line,512,512+i*70));
    ctx.font='500 22px "Noto Sans KR",sans-serif';
    ctx.fillStyle='#dfc59b';
    ctx.fillText('OIBUNG GALLERY  /  EXHIBIT '+String(index+1).padStart(2,'0'),512,621);
    const tex=canvasTexture(c);
    const src=String(game.thumbnailUrl || '');
    if(/^https:\/\//i.test(src) || /^assets\//.test(src)) {
      const img=new Image();
      img.crossOrigin='anonymous';img.decoding='async';
      img.onload=()=>{
        // Keep native artwork proportions. Background stays visible as a mat.
        ctx.clearRect(0,0,1024,640);
        ctx.fillStyle='#161717';ctx.fillRect(0,0,1024,640);
        const ratio=Math.min(1016/img.width,632/img.height);
        const w=img.width*ratio,h=img.height*ratio;
        try {ctx.drawImage(img,(1024-w)/2,(640-h)/2,w,h);tex.needsUpdate=true;}
        catch(e){console.warn('[3D Gallery] Artwork image could not be drawn',e);}
      };
      img.onerror=()=>{ /* A missing/CORS-blocked thumbnail uses the title canvas. */ };
      img.src=src;
    }
    return tex;
  }
  function stoneFloorTexture(){
    const c=makeCanvas(512,512),ctx=c.getContext('2d');
    ctx.fillStyle='#8f8475';ctx.fillRect(0,0,512,512);
    for(let x=0;x<512;x+=128)for(let y=0;y<512;y+=128){
      const v=((x*13+y*17)%5)*5;
      ctx.fillStyle='rgb('+(137+v)+','+(128+v)+','+(114+v)+')';
      ctx.fillRect(x+4,y+4,120,120);
      ctx.fillStyle='#5c5148';ctx.fillRect(x,y,4,512);ctx.fillRect(x,y,512,4);
      ctx.strokeStyle='#b6a893';ctx.strokeRect(x+9,y+9,110,110);
    }
    return canvasTexture(c);
  }
  function costumeKey(game) {
    const phrase=[game.id,game.title,game.english,game.genre].filter(Boolean).join(' ').toLowerCase();
    if(/퍼리|furry|furi|cat/.test(phrase))return 'maid';
    if(/오든|oden|elden|소울/.test(phrase))return 'knight';
    if(/아레나|arena|ballfight|핀볼/.test(phrase))return 'arena';
    if(/오이챔스|ochams|duel/.test(phrase))return 'duelist';
    if(/대학전선|campus|frontier|전략/.test(phrase))return 'commander';
    return 'egypt';
  }
  const wardrobe={
    maid:'assets/guide-costume-maid.svg',knight:'assets/guide-costume-knight.svg',
    arena:'assets/guide-costume-arena.svg',duelist:'assets/guide-costume-duelist.svg',
    commander:'assets/guide-costume-commander.svg',egypt:'assets/guide-costume-egypt.svg'
  };
  const guideTextures={};
  const loader=new THREE.TextureLoader();
  for(const [key,url] of Object.entries(wardrobe)) {
    loader.load(url,texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;
      guideTextures[key]=texture;
      avatarSprites.forEach(({sprite,costume})=>{
        if(costume===key && sprite.isSprite){
          sprite.material.map=texture;
          sprite.material.opacity=darkness?.8:1;
          sprite.material.needsUpdate=true;
        }
      });
    },undefined,()=>{ /* Costumes are optional; artwork remains interactive. */ });
  }

  function fromCatalog(){
    return [...grid.querySelectorAll(':scope > .game-card')].map(card=>{
      const id=card.dataset.gameId;
      const game=window.OIBUNG_CATALOG?.getGame?.(id) || {};
      const thumbnail=card.querySelector('.artwork-image-window img')?.getAttribute('src');
      return {
        id, title:game.title || card.querySelector('h3')?.textContent || '작품',
        english:game.english || '',genre:game.genre || '',
        developer:game.developer || '',thumbnailUrl:game.thumbnailUrl || thumbnail || ''
      };
    }).filter(game=>game.id);
  }
  function clearWorld(){
    if(!world)return;
    scene.remove(world);
    world.traverse(node=>{
      node.geometry?.dispose?.();
      if(Array.isArray(node.material))node.material.forEach(m=>m?.dispose?.());
      else if(node.material && !Object.values(materials).includes(node.material))node.material.dispose?.();
    });
    allTextures.forEach(t=>t.dispose());allTextures=[];
    paintings.length=0;exhibitionLights.length=0;emergencyLights.length=0;
    glowingFixtures.length=0;avatarSprites.length=0;
    world=null;
  }

  function build(){
    if(rebuilding)return;
    rebuilding=true;
    const previous=exhibits[nearIndex]?.id || '';
    const next=fromCatalog();
    clearWorld();
    exhibits=next;
    if (!next.length){
      surface.classList.add('gallery-3d-empty');
      focusLabel.textContent='전시 중인 작품이 없습니다';
      rebuilding=false;return;
    }
    surface.classList.remove('gallery-3d-empty');
    const total=next.length;
    roomEnd=-9.4*total-12;
    const length=7-roomEnd;
    world=new THREE.Group();scene.add(world);
    const mid=(7+roomEnd)*.5;
    const wallTexture=stoneFloorTexture();
    wallTexture.wrapS=wallTexture.wrapT=THREE.RepeatWrapping;
    wallTexture.repeat.set(5,Math.max(2,total*3));
    const floorMat=new THREE.MeshStandardMaterial({map:wallTexture,roughness:.86,color:0xddd1c1});
    elBox(world,0,-.20,mid,11,.4,length,floorMat);
    elBox(world,0,5.50,mid,11,.25,length,materials.plaster);
    elBox(world,-5.50,2.7,mid,.34,5.4,length,materials.ivory);
    elBox(world,5.50,2.7,mid,.34,5.4,length,materials.ivory);
    elBox(world,0,2.7,roomEnd,.30,5.5,.3,materials.ivory);
    elBox(world,0,2.7,7,.30,5.5,.3,materials.ivory);
    elBox(world,-5.28,.38,mid,.20,.76,length,materials.oak);
    elBox(world,5.28,.38,mid,.20,.76,length,materials.oak);
    elBox(world,-5.35,4.92,mid,.19,.18,length,materials.gold);
    elBox(world,5.35,4.92,mid,.19,.18,length,materials.gold);
    elBox(world,0,5.38,mid,3.5,.08,length,materials.trim);

    const signText=plaqueTexture('오이붕 갤러리','OIBUNG GALLERY');
    const entrance=new THREE.Mesh(new THREE.PlaneGeometry(3.4,1.0),
      new THREE.MeshStandardMaterial({map:signText,roughness:.75,emissive:0x5b4430,emissiveIntensity:.13}));
    entrance.position.set(0,3.45,roomEnd+.22);
    world.add(entrance);

    for(let i=0;i<=total;i++){
      const z=3-i*9.4;
      [-1,1].forEach(side=>{
        elCylinder(world,side*4.95,2.8,z,.24,.27,4.9,materials.ivory,10);
        elBox(world,side*4.95,5.1,z,.85,.43,.85,materials.trim);
        elBox(world,side*4.95,.33,z,.72,.65,.72,materials.plaster);
      });
      elBox(world,0,5.31,z,10.2,.15,.20,materials.trim);
      elBox(world,0,5.25,z,1.5,.16,.64,materials.gold);
      const lamp=elBox(world,0,5.11,z,1.1,.10,.35,
        new THREE.MeshStandardMaterial({color:0xffd9a1,emissive:0xffca7a,emissiveIntensity:1.25}));
      glowingFixtures.push(lamp.material);
      const light=new THREE.PointLight(0xffe0af,0,10,2);
      light.position.set(0,4.55,z);world.add(light);exhibitionLights.push(light);
      if(i%3===0){
        const exitCanvas=makeCanvas(512,170), ctx=exitCanvas.getContext('2d');
        ctx.fillStyle='#150d0c';ctx.fillRect(0,0,512,170);
        ctx.strokeStyle='#8c332d';ctx.lineWidth=10;ctx.strokeRect(8,8,496,154);
        ctx.fillStyle='#f0b8aa';ctx.font='700 84px sans-serif';
        ctx.textAlign='center';ctx.fillText('EXIT',256,119);
        const exit=new THREE.Mesh(new THREE.PlaneGeometry(1.3,.43),
          new THREE.MeshBasicMaterial({map:canvasTexture(exitCanvas),transparent:false,color:0xffffff}));
        exit.position.set(0,4.85,z-.35);world.add(exit);
        const lightR=new THREE.PointLight(0xc9302b,0,4.2,2);
        lightR.position.set(0,4.3,z);world.add(lightR);emergencyLights.push(lightR);
      }
    }
    next.forEach((game,i)=>{
      const side=i%2===0?1:-1;
      const z=-4.3-i*9.4;
      const group=new THREE.Group();
      group.position.set(side*5.28,2.83,z);
      group.rotation.y=side>0 ? -Math.PI/2 : Math.PI/2;
      world.add(group);
      elBox(group,0,0,-.02,4.26,2.77,.13,materials.black);
      const painting=new THREE.Mesh(new THREE.PlaneGeometry(3.74,2.31),
        new THREE.MeshStandardMaterial({map:artworkTexture(game,i),roughness:.82,metalness:0,side:THREE.DoubleSide}));
      painting.position.z=.067;
      painting.userData.galleryIndex=i;
      paintings.push(painting);group.add(painting);
      const frameMat=materials.gold;
      elBox(group,0,1.27,.11,4.32,.20,.22,frameMat);
      elBox(group,0,-1.27,.11,4.32,.20,.22,frameMat);
      elBox(group,-2.02,0,.11,.22,2.72,.22,frameMat);
      elBox(group,2.02,0,.11,.22,2.72,.22,frameMat);
      const plaque=new THREE.Mesh(new THREE.PlaneGeometry(2.42,.72),
        new THREE.MeshStandardMaterial({map:plaqueTexture(game.title,game.developer || game.genre || '작품 감상'),
          roughness:.76,metalness:.04}));
      plaque.position.set(0,-1.89,.09);plaque.userData.galleryIndex=i;
      paintings.push(plaque);group.add(plaque);
      const spot=new THREE.SpotLight(0xffe8b9,0,9,Math.PI/5,.72,1.7);
      spot.position.set(side*4.1,4.9,z);
      spot.target.position.set(side*5.0,2.7,z);
      world.add(spot,spot.target);exhibitionLights.push(spot);
      // A themed curator is physically stationed alongside this artwork.
      const costume=costumeKey(game);
      if(createAnimeCurator){
        // Every exhibit has its own real three-dimensional adult-proportioned
        // anime curator, positioned beside the artwork and facing the aisle.
        const rig=createAnimeCurator(THREE,{costume,mobile});
        const model=rig.group;
        model.position.set(side*3.67,0,z-2.42);
        model.rotation.y=side>0?-Math.PI/2+.17:Math.PI/2-.17;
        model.scale.setScalar(.97);
        world.add(model);
        avatarSprites.push({sprite:model,rig,costume,phase:i*1.17,y:0});
        const characterSpot=new THREE.SpotLight(0xffead0,0,6.7,Math.PI/6.8,.68,1.8);
        characterSpot.position.set(side*2.7,4.55,z-1.45);
        characterSpot.target.position.set(side*3.67,1.43,z-2.42);
        world.add(characterSpot,characterSpot.target);
        exhibitionLights.push(characterSpot);
      }else{
        const sprite=new THREE.Sprite(new THREE.SpriteMaterial({
          map:guideTextures[costume] || null,transparent:true,depthWrite:false,
          color:0xffffff,opacity:guideTextures[costume]?1:0
        }));
        sprite.position.set(side*3.65,1.42,z-2.55);
        sprite.scale.set(costume==='maid'?1.18:1.62,2.60,1);
        world.add(sprite);
        avatarSprites.push({sprite,costume,y:sprite.position.y,phase:i*1.17});
      }
      const ropeZ=z+3.0;
      [-1,1].forEach(offset=>{
        elCylinder(world,side*3.85,.42,ropeZ+offset*1.75,.07,.09,.84,materials.gold);
      });
      const lightArt=new THREE.PointLight(0xffc486,0,6,2);
      lightArt.position.set(side*3.9,3.7,z);
      world.add(lightArt);exhibitionLights.push(lightArt);
    });
    // Obey the existing "hide guide" setting in both 2D and 3D.
    const showGuides=!document.getElementById('gallery-guide')?.hidden;
    avatarSprites.forEach(({sprite})=>{sprite.visible=showGuides;});
    const keep=next.findIndex(g=>g.id===previous);
    if(keep>=0){camera.position.z=Math.min(6,Math.max(roomEnd+1.2,camera.position.z));}
    else {camera.position.set(0,1.68,5.1);yaw=0;pitch=0;nearIndex=-1;}
    applyLighting();
    resize();
    rebuilding=false;
  }

  function applyLighting(){
    darkness=document.documentElement.dataset.galleryMode==='dark';
    scene.background.set(darkness?0x020305:0xa8a59d);
    scene.fog.color.set(darkness?0x020306:0xa8a59d);
    scene.fog.density=darkness?.061:.012;
    ambient.intensity=darkness?.008:.7;
    hemisphere.intensity=darkness?.018:1.45;
    sun.intensity=darkness?0:.95;
    torch.intensity=darkness&&flashlightOn?17:0;
    renderer.toneMappingExposure=darkness?.80:1.12;
    exhibitionLights.forEach(light=>light.intensity=0);
    emergencyLights.forEach(light=>light.intensity=0);
    glowingFixtures.forEach(mat=>mat.emissiveIntensity=darkness?0:1.25);
    avatarSprites.forEach(({sprite})=>{
      // Real sculpted meshes receive the scene's actual lights and flashlight.
      // Only legacy sprite fallback needs artificial darkening.
      if(!sprite.isSprite)return;
      sprite.material.color.set(darkness?0x3b2d2b:0xffffff);
      sprite.material.opacity=sprite.material.map?(darkness?.8:1):0;
    });
    lightToggle.textContent=darkness?'☀ 불 켜기':'☾ 소등';
    flashlightButton.hidden=!darkness;
    flashlightButton.textContent=flashlightOn?'손전등 끄기 [F]':'손전등 켜기 [F]';
    surface.classList.toggle('gallery-3d-dark',darkness);
  }
  function updateNearbyLights(time){
    if(darkness) {
      exhibitionLights.forEach(light=>{light.intensity=0});
      emergencyLights.forEach(light=>{
        const near=Math.abs(light.position.z-camera.position.z)<13;
        light.intensity=near?(.42 + Math.sin(time*.0017+light.position.z)*.06):0;
      });
      torch.intensity=flashlightOn?(16.5 + .45*Math.sin(time*.0038) + .12*Math.sin(time*.041)):0;
    } else {
      exhibitionLights.forEach(light=>{
        const dz=Math.abs(light.position.z-camera.position.z);
        light.intensity=dz<14 ? (light.isSpotLight?8.7:light.distance<=6?4.2:12.5) : 0;
      });
      emergencyLights.forEach(light=>light.intensity=0);
    }
  }

  function resize(){
    const w=surface.clientWidth,h=surface.clientHeight;
    if(w<1||h<1)return;
    camera.aspect=w/h;camera.updateProjectionMatrix();
    renderer.setSize(w,h,false);
  }
  function setOrientation(){
    camera.rotation.y=yaw;camera.rotation.x=pitch;
  }
  function movePlayer(dt){
    const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)
      -(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-joyY;
    const sideways=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)
      -(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+joyX;
    const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight')?5.5:3.25);
    const len=Math.hypot(forward,sideways);
    velocity=Math.min(1,len);
    if(len>.03){
      const f=forward/len,r=sideways/len;
      const dx=(-Math.sin(yaw)*f+Math.cos(yaw)*r)*dt*speed;
      const dz=(-Math.cos(yaw)*f-Math.sin(yaw)*r)*dt*speed;
      // A corridor, not a spectator rail: the visitor can walk in all directions.
      camera.position.x=THREE.MathUtils.clamp(camera.position.x+dx,-4.5,4.5);
      camera.position.z=THREE.MathUtils.clamp(camera.position.z+dz,roomEnd+1.1,6.35);
      stride+=dt*speed;
      lastMove=performance.now();
    }
    camera.position.y=1.68+(reduced()?0:Math.sin(stride*8)*.012*velocity);
  }
  function targetedArt(){
    raycaster.setFromCamera(center,camera);
    const hits=raycaster.intersectObjects(paintings,false);
    return hits.length?hits[0].object.userData.galleryIndex:-1;
  }
  function nearestArt(){
    let closest=-1,dist=Infinity;
    exhibits.forEach((game,i)=>{
      const z=-4.3-i*9.4,side=i%2===0?1:-1;
      const d=Math.hypot(camera.position.x-side*4.8,camera.position.z-z);
      if(d<dist){dist=d;closest=i;}
    });
    return dist<7.5?closest:-1;
  }
  function updateFocus(){
    const targeted=targetedArt();
    focused=targeted;
    const near=nearestArt();
    if(near!==nearIndex){
      nearIndex=near;
      if(near>=0) document.dispatchEvent(new CustomEvent('oibung-gallery-jump',{detail:{index:near,from3d:true}}));
    }
    const idx=targeted;
    const game=exhibits[idx];
    if(game){
      focusLabel.textContent=game.title;
      action.hidden=false;action.dataset.index=String(idx);
      hint.textContent='E 또는 작품 클릭 · 자세히 감상하기';
    } else {
      action.hidden=true;
      const nearest=exhibits[near];
      focusLabel.textContent=nearest ? nearest.title : '오이붕 갤러리';
      hint.textContent=darkness?'손전등 [F] · 작품을 찾아 다가가세요':'주변을 둘러보고 작품에 가까이 다가가세요';
    }
  }
  function openArtwork(index){
    if(!Number.isInteger(index)||!exhibits[index])return;
    if(document.pointerLockElement)document.exitPointerLock?.();
    window.OIBUNG_CATALOG?.openDetail?.(exhibits[index].id);
  }
  function teleport(index){
    if(!exhibits[index])return;
    const side=index%2===0?1:-1;
    camera.position.set(side*2.65,1.68,-4.3-index*9.4+.25);
    yaw=side>0?-Math.PI/2:Math.PI/2;pitch=.30;
    setOrientation();updateFocus();
  }
  function paused(){
    return document.hidden || window.OIBUNG_CURRENT_VIEW==='reviews' ||
      !!document.querySelector('dialog[open]') ||
      !!document.querySelector('#mobile-nav:not([hidden])') ||
      !!document.querySelector('#walk-filter-drawer[open]');
  }
  function update(time){
    requestAnimationFrame(update);
    if(!document.body.classList.contains('three-gallery-ready') || paused()){
      keys.clear(); joyX=0; joyY=0;
      if(document.pointerLockElement===renderer.domElement)document.exitPointerLock?.();
      lastTime=time;
      return;
    }
    const dt=Math.min(.05,Math.max(0,(time-lastTime)/1000||0));
    lastTime=time;
    if(hasEntered)movePlayer(dt);
    updateNearbyLights(time);
    setOrientation();
    if(hasEntered && time-lastCount>90){
      updateFocus();lastCount=time;
    }
    // Nearby guide meshes animate; distant ones are culled on desktop and mobile.
    avatarSprites.forEach(({sprite,y,phase,rig})=>{
      const close = Math.abs(sprite.position.z-camera.position.z)<23;
      const allowGuide = !document.getElementById('gallery-guide')?.hidden;
      sprite.visible=close && allowGuide;
      if(!sprite.visible || reduced())return;
      if(rig)rig.animate(time,phase);
      else sprite.position.y=y+Math.sin(time*.0015+phase)*.028;
    });
    renderer.render(scene,camera);
  }
  function isUserTyping(event){
    return !!event.target.closest?.('input,textarea,select,[contenteditable="true"],dialog,[role="dialog"],.gallery-room-map,#mobile-nav,.gallery-3d-hud,.page-switcher');
  }
  function tryPointerLock(){
    if(mobile || !renderer.domElement.requestPointerLock)return;
    try{Promise.resolve(renderer.domElement.requestPointerLock()).catch(()=>{});}
    catch(error){console.warn('[3D Gallery] Pointer lock unavailable; use drag-look.',error);}
  }
  function start(){
    hasEntered=true;surface.classList.add('gallery-3d-entered');
    enter.blur();
    welcome.hidden=true;
    hint.textContent='WASD 이동 · 마우스로 둘러보기 · E 감상';
    tryPointerLock();
  }
  enter.addEventListener('click',start);
  action.addEventListener('click',()=>openArtwork(Number(action.dataset.index)));
  lightToggle.addEventListener('click',()=>{
    const mode=darkness?'light':'dark';
    document.querySelector('[data-gallery-mode-choice="'+mode+'"]')?.click();
    applyLighting();
  });
  flashlightButton.addEventListener('click',()=>{
    flashlightOn=!flashlightOn;applyLighting();
  });
  document.addEventListener('keydown',event=>{
    if(!document.body.classList.contains('three-gallery-ready')||paused()||isUserTyping(event))return;
    if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','ShiftLeft','ShiftRight','KeyE','KeyF'].includes(event.code)){
      event.preventDefault();event.stopImmediatePropagation();
    }
    keys.add(event.code);
    if(event.repeat)return;
    if(event.code==='KeyE'&&focused>=0)openArtwork(focused);
    if(event.code==='KeyF'&&darkness){flashlightOn=!flashlightOn;applyLighting();}
  },true);
  document.addEventListener('keyup',event=>keys.delete(event.code),true);
  window.addEventListener('blur',()=>keys.clear());
  document.addEventListener('pointerlockchange',()=>{
    surface.classList.toggle('gallery-3d-locked',document.pointerLockElement===renderer.domElement);
  });
  let mouseDrag = null;
  renderer.domElement.addEventListener('pointerdown',event=>{
    if(mobile || event.button!==0 || document.pointerLockElement===renderer.domElement)return;
    mouseDrag={x:event.clientX,y:event.clientY,moved:false};
  });
  document.addEventListener('pointerup',()=>{mouseDrag=null;});
  document.addEventListener('mousemove',event=>{
    if(paused())return;
    if(document.pointerLockElement===renderer.domElement){
      yaw-=event.movementX*.0021;
      pitch=THREE.MathUtils.clamp(pitch-event.movementY*.0018,-1.22,1.22);
      return;
    }
    if(mouseDrag && hasEntered){
      const dx=event.clientX-mouseDrag.x,dy=event.clientY-mouseDrag.y;
      if(Math.abs(dx)+Math.abs(dy)>4)mouseDrag.moved=true;
      yaw-=dx*.003;
      pitch=THREE.MathUtils.clamp(pitch-dy*.0027,-1.22,1.22);
      mouseDrag.x=event.clientX;mouseDrag.y=event.clientY;
    }
  });
  renderer.domElement.addEventListener('click',event=>{
    if(!hasEntered){start();return;}
    if(mobile)return;
    const bounds=renderer.domElement.getBoundingClientRect();
    pointerRay.set(((event.clientX-bounds.left)/bounds.width)*2-1,-((event.clientY-bounds.top)/bounds.height)*2+1);
    raycaster.setFromCamera(document.pointerLockElement===renderer.domElement?center:pointerRay,camera);
    const hits=raycaster.intersectObjects(paintings,false);
    if(hits.length){openArtwork(hits[0].object.userData.galleryIndex);return;}
    if(document.pointerLockElement!==renderer.domElement && !mouseDrag?.moved)
      tryPointerLock();
    mouseDrag=null;
  });

  function joyUpdate(event){
    const r=joystick.getBoundingClientRect();
    const centerX=r.left+r.width/2,centerY=r.top+r.height/2;
    joyX=THREE.MathUtils.clamp((event.clientX-centerX)/(r.width*.38),-1,1);
    joyY=THREE.MathUtils.clamp((event.clientY-centerY)/(r.height*.38),-1,1);
    joystickKnob.style.transform='translate('+(joyX*36).toFixed(1)+'px,'+(joyY*36).toFixed(1)+'px)';
  }
  joystick.addEventListener('pointerdown',event=>{
    if(!hasEntered)return;
    joystickPointer=event.pointerId;joystick.setPointerCapture(event.pointerId);
    joyUpdate(event);
  });
  joystick.addEventListener('pointermove',event=>{
    if(event.pointerId===joystickPointer)joyUpdate(event);
  });
  function joyRelease(event){
    if(event.pointerId!==joystickPointer)return;
    joystickPointer=null;joyX=joyY=0;joystickKnob.style.transform='';
  }
  joystick.addEventListener('pointerup',joyRelease);
  joystick.addEventListener('pointercancel',joyRelease);
  lookZone.addEventListener('pointerdown',event=>{
    if(!hasEntered)return;
    lookPointer=event.pointerId;lastLookX=event.clientX;lastLookY=event.clientY;
    lookMoved=false;lookZone.setPointerCapture(event.pointerId);
  });
  lookZone.addEventListener('pointermove',event=>{
    if(event.pointerId!==lookPointer)return;
    const dx=event.clientX-lastLookX,dy=event.clientY-lastLookY;
    if(Math.abs(dx)+Math.abs(dy)>5)lookMoved=true;
    yaw-=dx*.005;pitch=THREE.MathUtils.clamp(pitch-dy*.004,-1.22,1.22);
    lastLookX=event.clientX;lastLookY=event.clientY;
  });
  function lookRelease(event){
    if(event.pointerId!==lookPointer)return;
    lookPointer=null;
    if(!lookMoved){
      const rect=renderer.domElement.getBoundingClientRect();
      pointerRay.set(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1);
      raycaster.setFromCamera(pointerRay,camera);
      const hit=raycaster.intersectObjects(paintings,false)[0];
      if(hit)openArtwork(hit.object.userData.galleryIndex);
    }
  }
  lookZone.addEventListener('pointerup',lookRelease);
  lookZone.addEventListener('pointercancel',event=>{if(lookPointer===event.pointerId)lookPointer=null;});

  // The existing map continues to work. A visitor can teleport to a painting,
  // while the internal 2D index remains synchronized for curator/review logic.
  document.addEventListener('oibung-gallery-jump',event=>{
    if(event.detail?.from3d)return;
    if(Number.isInteger(event.detail?.index))teleport(event.detail.index);
  });
  const guidePreference=document.getElementById('gallery-guide');
  if(guidePreference){
    new MutationObserver(()=>{
      const visible=!guidePreference.hidden;
      avatarSprites.forEach(({sprite})=>{sprite.visible=visible;});
    }).observe(guidePreference,{attributes:true,attributeFilter:['hidden']});
  }
  new MutationObserver(()=>build()).observe(grid,{childList:true});
  // Load the model once asynchronously, then re-stage the display actors.
  if(vrmCuratorModule?.getVRMCuratorFactory){
    vrmCuratorModule.getVRMCuratorFactory().then(factory=>{
      createAnimeCurator=(_THREE,opts)=>factory(opts);
      build();
    }).catch(error=>{
      console.warn('[3D Gallery] VRoid model unavailable: keeping illustrated curators.',error);
    });
  }
  new MutationObserver(()=>applyLighting()).observe(document.documentElement,{
    attributes:true,attributeFilter:['data-gallery-mode']
  });
  window.addEventListener('resize',resize,{passive:true});
  document.addEventListener('visibilitychange',()=>{lastTime=performance.now()});
  document.addEventListener('oibung-page-changed',()=>{lastTime=performance.now()});
  document.querySelectorAll('dialog').forEach(dialog=>{
    dialog.addEventListener('close',()=>{lastTime=performance.now()});
  });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    if(document.pointerLockElement===renderer.domElement)document.exitPointerLock?.();
    document.body.classList.remove('three-gallery-ready');
    surface.hidden=true;
    console.warn('[3D Gallery] WebGL context lost; showing original exhibition.');
  });
  build();
  if(!exhibits.length) {
    // Live Supabase catalog may arrive later: the mutation observer will rebuild.
    hint.textContent='전시 작품을 불러오는 중입니다';
  }
  surface.hidden=false;
  document.body.classList.add('three-gallery-ready');
  active=true;
  resize();
  requestAnimationFrame(update);
})().catch(error=>{console.error('[3D Gallery] Fallback to 2D exhibition',error);document.body.classList.remove('three-gallery-ready');});
