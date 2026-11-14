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
  const cameraToggle = document.getElementById('gallery-3d-camera');
  const jumpButton = document.getElementById('gallery-portal-jump');
  const backButton = document.getElementById('gallery-portal-back');
  const roomCard = document.getElementById('gallery-portal-room-card');
  const roomTitle = document.getElementById('gallery-portal-room-title');
  const roomDescription = document.getElementById('gallery-portal-room-description');
  const portalOverlay = document.getElementById('gallery-portal-transition');
  const portalCaption = document.getElementById('gallery-portal-caption');
  if (!surface || !mount || !grid || !action || !jumpButton || !backButton || !portalOverlay) return;

  let THREE;
  for (const url of [
    'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js',
    'https://unpkg.com/three@0.169.0/build/three.module.js'
  ]) {
    try { THREE = await import(url); break; }
    catch (error) { console.warn('[3D Gallery] Module source unavailable:', url, error); }
  }
  if (!THREE) {
    console.warn('[3D Gallery] Three.js could not load. Using the original exhibition.');
    return;
  }
  // A human-looking sculpt needs authored model/texture assets. The
  // procedural mint character was visibly malformed, so it is no longer
  // imported or shown. Exhibit guides use the existing illustrated artwork
  // until a visually verified 3D asset can replace it.
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: !matchMedia('(pointer:coarse)').matches,
      powerPreference:'high-performance',
      alpha:false,
      stencil:false
    });
  } catch (error) {
    console.warn('[3D Gallery] WebGL not supported; using the existing gallery.', error);
    return;
  }
  const mobile = matchMedia('(pointer:coarse)').matches;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => reduceMotion.matches || document.documentElement.classList.contains('motion-off');
  const deviceResolution=Math.min(devicePixelRatio||1,mobile?1.0:1.30);
  let renderResolution=deviceResolution;
  const minimumResolution=mobile?.78:.90;
  renderer.setPixelRatio(renderResolution);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setClearColor(0x22252a);
  mount.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '오이붕 3인칭 3D 탐험. WASD 이동, Space 점프, V 시점 변경, E 작품 정보.');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8a59d);
  scene.fog = new THREE.FogExp2(0xa8a59d, 0.012);
  const camera = new THREE.PerspectiveCamera(mobile ? 72 : 74, 1, .06, 120);
  camera.rotation.order = 'YXZ';
  camera.position.set(0, 1.68, 5.1);
  scene.add(camera);
  // Keep this camera as an invisible player/aim transform, so existing portal
  // targeting continues to work. Render through a separate trailing camera.
  const followCamera=new THREE.PerspectiveCamera(mobile?68:72,1,.08,140);
  followCamera.position.set(0,4.4,10.0);
  scene.add(followCamera);
  const ambient = new THREE.AmbientLight(0xf5e7d0, .7);
  const hemisphere = new THREE.HemisphereLight(0xeaf3ff, 0x6e543d, 1.45);
  const sun = new THREE.DirectionalLight(0xffebcc, .95);
  sun.position.set(-4, 6, 7);
  scene.add(ambient, hemisphere, sun);
  const torch = new THREE.SpotLight(0xffedd1, 0, 19, Math.PI / 6, .63, 1.5);
  torch.position.set(0, -.10, .05);
  torch.target.position.set(0, -.13, -9);
  camera.add(torch, torch.target);
  // Soft visitor-side fill reveals detailed facial topology/eyes when close.
  // This is a museum bounce light, and turns completely off in blackout mode.
  const portraitFill=new THREE.PointLight(0xffe3ca,2.1,6.5,2);
  portraitFill.position.set(0,.24,-.4);
  camera.add(portraitFill);

  const raycaster = new THREE.Raycaster();
  raycaster.far = 5.4;
  const center = new THREE.Vector2(0, 0);
  const pointerRay = new THREE.Vector2();
  const keys = new Set();
  const paintings = [];
  const exhibitionLights = [];
  const emergencyLights = [];
  const glowingFixtures = [];
  // Portal paintings are the only "characters" the gallery needs.
  const portalSurfaces = [];
  let world = null;
  let pocketWorld = null;
  let pocketResources = [];
  let pocketTextures = [];
  let pocketLights = [];
  let exitPortal = null;
  let exhibits = [];
  let sceneMode = 'hall';
  let activeExhibit = -1;
  let savedHallPose = null;
  let portalTransition = null;
  let jumpHeight = 0, jumpVelocity = 0, queuedJump = null;
  let yaw = 0, pitch = .12, velocity = 0, stride = 0;
  let moveVelX=0,moveVelZ=0,avatarFacing=0;
  let cameraDistance=4.25,cameraSnap=true,cameraShake=0;
  let jumpCombo=0,lastLandingAt=0,longJumpUntil=0,jumpStartedAt=0;
  let groundY=0;
  const walls=[];const cameraWalls=[];const exhibitPlacements=[];
  const playerRadius=.41;
  let focused = -1, nearIndex = -1;
  let lastTime = 0, lastCount = 0, lastMove = 0,lastMapTick=0;
  let lastLightCheck=0,lastResolutionCheck=0,resolutionSamples=0,resolutionTime=0;
  let lastPreviewFrame=0;
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
  // Small original 3D stickman. Intentionally simple and low-poly:
  // one head sphere, a handful of rods, and joint pivots for real motion.
  function createExplorer(){
    const root=new THREE.Group();
    root.name='오이붕 갤러리 · 작은 3D 졸라맨';
    const bodyPivot=new THREE.Group();
    root.add(bodyPivot);
    const ink=new THREE.MeshLambertMaterial({color:0x29333b});
    const joints=new THREE.MeshLambertMaterial({color:0x40545c});
    const face=new THREE.MeshBasicMaterial({color:0xf8f4e9});
    const cheek=new THREE.MeshBasicMaterial({color:0xbce6d7});
    const sphereGeo=new THREE.SphereGeometry(1,12,9);
    const rodGeo=new THREE.CylinderGeometry(1,1,1,9);
    function ball(parent,mat,x,y,z,s){
      const mesh=new THREE.Mesh(sphereGeo,mat);
      mesh.position.set(x,y,z);
      mesh.scale.setScalar(s);
      parent.add(mesh);return mesh;
    }
    function rod(parent,mat,x,y,z,r,h){
      const mesh=new THREE.Mesh(rodGeo,mat);
      mesh.position.set(x,y,z);
      mesh.scale.set(r,h,r);
      parent.add(mesh);return mesh;
    }
    // Height 1.16 world units — much smaller than the previous 1.9m mascot.
    ball(bodyPivot,ink,0,1.00,0,.17);
    // A tiny pale face and two dots, not a realistic humanoid head.
    ball(bodyPivot,face,0,1.006,-.143,.079);
    for(const side of [-1,1])ball(bodyPivot,ink,side*.033,1.02,-.211,.012);
    rod(bodyPivot,joints,0,.58,0,.065,.48);
    ball(bodyPivot,joints,0,.79,0,.08);
    ball(bodyPivot,joints,0,.33,0,.079);
    const arms=[],legs=[];
    for(const side of [-1,1]){
      const shoulder=new THREE.Group();
      shoulder.position.set(side*.095,.77,0);
      bodyPivot.add(shoulder);
      rod(shoulder,ink,side*.065,-.17,0,.038,.35);
      ball(shoulder,ink,side*.065,-.36,0,.049);
      arms.push({pivot:shoulder,side});
      const hip=new THREE.Group();
      hip.position.set(side*.071,.33,0);
      bodyPivot.add(hip);
      rod(hip,ink,side*.016,-.14,0,.045,.29);
      ball(hip,joints,side*.016,-.31,0,.055);
      legs.push({pivot:hip,side});
    }
    // One small accent makes the character readable against a dark museum.
    ball(bodyPivot,cheek,0,.62,-.075,.054);
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(.34,16),
      new THREE.MeshBasicMaterial({color:0x101c20,transparent:true,
        opacity:.18,depthWrite:false}));
    shadow.rotation.x=-Math.PI/2;
    scene.add(shadow);
    const landingRing=new THREE.Mesh(new THREE.RingGeometry(.28,.37,20),
      new THREE.MeshBasicMaterial({color:0xf1dfb3,transparent:true,
        opacity:0,depthWrite:false,side:THREE.DoubleSide}));
    landingRing.rotation.x=-Math.PI/2;
    scene.add(landingRing);
    scene.add(root);
    // No per-character dynamic PointLight — unnecessary GPU work.
    return {root,bodyPivot,arms,legs,shadow,landingRing};
  }
  const explorer=createExplorer();
  function updateExplorer(time,dt){
    const px=camera.position.x,pz=camera.position.z;
    const speed=Math.hypot(moveVelX,moveVelZ);
    const gait=Math.min(1,speed/4.0);
    const air=jumpHeight>.05;
    explorer.root.position.set(px,groundY+jumpHeight,pz);
    if(speed>.24){
      const desired=Math.atan2(-moveVelX,-moveVelZ);
      const diff=Math.atan2(Math.sin(desired-avatarFacing),Math.cos(desired-avatarFacing));
      avatarFacing+=diff*Math.min(1,dt*14);
    }
    explorer.root.rotation.y=avatarFacing;
    explorer.root.visible=hasEntered && !portalTransition;
    const elapsed=Math.max(0,(time-jumpStartedAt)*.001);
    const rising=air && jumpVelocity>0;
    const landing=!air && cameraShake>.10;
    const longJump=air && time<longJumpUntil;
    const spin=air && jumpCombo===3 && !longJump;
    explorer.bodyPivot.rotation.x=longJump?-.55:rising?-.15:air?.19:gait*.05;
    explorer.bodyPivot.rotation.y=spin
      ?Math.min(1,elapsed/1.05)*Math.PI*2:0;
    explorer.bodyPivot.scale.set(
      landing?1+cameraShake*.12:air?.94:1,
      landing?1-cameraShake*.16:rising?1.10:air?.97:1,
      air?.94:1
    );
    explorer.bodyPivot.position.y=landing?-.04:air?.045:
      Math.sin(stride*17)*.026*gait;
    for(const {pivot,side} of explorer.arms){
      pivot.rotation.z=side*(rising?-.73:air?.34:.14);
      pivot.rotation.x=longJump?-.97:rising?-.76:air?.37:
        Math.sin(stride*13+(side>0?0:Math.PI))*.58*gait;
    }
    for(const {pivot,side} of explorer.legs){
      pivot.rotation.x=longJump?(side>0?-.65:.55):rising?-.28:air?.52:
        Math.sin(stride*13+(side>0?Math.PI:0))*.62*gait;
    }
    explorer.shadow.position.set(px,groundY+.025,pz);
    explorer.shadow.material.opacity=Math.max(.035,.18-jumpHeight*.050);
    explorer.shadow.scale.setScalar(1+jumpHeight*.20);
    explorer.shadow.visible=hasEntered;
    explorer.landingRing.position.set(px,groundY+.03,pz);
    explorer.landingRing.material.opacity=Math.max(0,cameraShake*.46);
    explorer.landingRing.scale.setScalar(1+(1-cameraShake)*1.3);
    explorer.landingRing.visible=hasEntered && cameraShake>.01;
    cameraShake=Math.max(0,cameraShake-dt*2.4);
  }
  // Reusable camera mathematics: no accumulated Euler rotations or pitch flips.
  const camTarget=new THREE.Vector3(),camDesired=new THREE.Vector3();
  const camDirection=new THREE.Vector3(),camIntersection=new THREE.Vector3();
  const camRay=new THREE.Ray();
  function followPlayer(dt){
    // Orbit a fixed waist-height pivot instead of the invisible 1P camera.
    // A bounded elevation prevents upside-down views at any mouse position.
    pitch=THREE.MathUtils.clamp(pitch,-.12,.79);
    camTarget.set(camera.position.x,groundY+jumpHeight+.87,camera.position.z);
    const cos=Math.cos(pitch),sin=Math.sin(pitch);
    const horizontal=cameraDistance*cos;
    camDesired.set(
      camTarget.x+Math.sin(yaw)*horizontal,
      camTarget.y+.30+cameraDistance*sin,
      camTarget.z+Math.cos(yaw)*horizontal
    );
    camDesired.y=Math.max(camTarget.y+.38,camDesired.y);
    if(sceneMode==='inside'){
      camDesired.x=THREE.MathUtils.clamp(camDesired.x,-7.2,7.2);
      camDesired.z=THREE.MathUtils.clamp(camDesired.z,-8.2,8.2);
      camDesired.y=Math.min(4.8,camDesired.y);
    }else camDesired.y=Math.min(7.05,camDesired.y);
    // Find the NEAREST obstruction in the entire boom. The old loop
    // overwrote a near hit with farther wall hits, causing camera teleporting.
    camDirection.copy(camDesired).sub(camTarget);
    const length=camDirection.length();
    if(length>.01){
      camDirection.multiplyScalar(1/length);
      camRay.set(camTarget,camDirection);
      let maxDistance=length;
      const obstacles=sceneMode==='hall'?cameraWalls:[];
      for(const box of obstacles){
        if(camRay.intersectBox(box,camIntersection)){
          const hitDistance=camTarget.distanceTo(camIntersection);
          if(hitDistance<maxDistance)maxDistance=hitDistance;
        }
      }
      if(maxDistance<length){
        camDesired.copy(camTarget).addScaledVector(
          camDirection,Math.max(.85,maxDistance-.20)
        );
        // Even in a narrow corner, keep the camera slightly above target.
        camDesired.y=Math.max(camTarget.y+.20,camDesired.y);
      }
    }
    if(cameraSnap){
      followCamera.position.copy(camDesired);
      cameraSnap=false;
    }else{
      const smooth=1-Math.exp(-Math.max(0,dt)*11);
      followCamera.position.lerp(camDesired,smooth);
    }
    followCamera.up.set(0,1,0);
    followCamera.lookAt(camTarget);
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
    // Cleanly dispose the previous hall; no curator assets remain.
    scene.remove(world);
    world.traverse(node=>{
      node.geometry?.dispose?.();
      const disposeMat=m=>{
        if(m && !Object.values(materials).includes(m))m.dispose?.();
      };
      if(Array.isArray(node.material))node.material.forEach(disposeMat);
      else disposeMat(node.material);
    });
    allTextures.forEach(t=>t.dispose());allTextures=[];
    paintings.length=0;portalSurfaces.length=0;exhibitionLights.length=0;
    emergencyLights.length=0;glowingFixtures.length=0;
    world=null;
  }


  // Paintings bend at the edges when a visitor approaches, then ripple like
  // liquid in the short jump transition. 3D vertices move, not just CSS.
  const portalVertex = [
    'uniform float uTime;',
    'uniform float uWarp;',
    'varying vec2 vUv;',
    'void main(){',
    '  vUv=uv;',
    '  vec3 p=position;',
    '  float radius=distance(uv,vec2(.5));',
    '  p.z += uWarp*.14*sin(radius*44.0-uTime*7.0)*exp(-radius*5.0);',
    '  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);',
    '}'
  ].join('\n');
  const portalFragment = [
    'uniform sampler2D uMap;',
    'uniform float uTime;',
    'uniform float uWarp;',
    'uniform float uDim;',
    'varying vec2 vUv;',
    'void main(){',
    '  vec2 toCenter=vUv-vec2(.5);',
    '  float radius=length(toCenter);',
    '  float wave=sin(radius*57.0-uTime*8.0);',
    '  vec2 shift=toCenter/(radius+.001)*wave*uWarp*.013;',
    '  vec2 uv=clamp(vUv+shift,vec2(.001),vec2(.999));',
    '  vec4 pixel=texture2D(uMap,uv);',
    '  float halo=pow(1.0-smoothstep(.10,.62,radius),2.0)*uWarp;',
    '  vec3 color=pixel.rgb*uDim+vec3(.20,.16,.27)*halo;',
    '  gl_FragColor=vec4(color,1.0);',
    '}'
  ].join('\n');
  function portalPainting(texture,index){
    const uniforms={
      uMap:{value:texture},uTime:{value:0},uWarp:{value:0},
      uDim:{value:1}
    };
    const mat=new THREE.ShaderMaterial({
      uniforms,vertexShader:portalVertex,fragmentShader:portalFragment,
      side:THREE.DoubleSide,transparent:false,depthWrite:true
    });
    const art=new THREE.Mesh(
      new THREE.PlaneGeometry(3.74,2.31,mobile?14:24,mobile?8:16),mat);
    art.position.z=.075;
    art.userData.galleryIndex=index;
    portalSurfaces.push({mesh:art,uniforms,index});
    return art;
  }

  const portalThemes = {
    knight:{name:'검은 성채',description:'무너진 왕좌와 검의 기억이 남은 어두운 전시실.',
      wall:0x25212a,floor:0x342f31,accent:0xb88e52,light:0xffc995},
    maid:{name:'달빛 살롱',description:'리본과 부드러운 빛이 비치는 고양이 테마 전시실.',
      wall:0xa98da6,floor:0x8e7e99,accent:0xe5c7db,light:0xffd6f1},
    arena:{name:'별빛 경기장',description:'빛나는 구체와 충돌의 궤적이 남은 전시실.',
      wall:0x1a3b44,floor:0x18343a,accent:0x67d9cd,light:0x8ff9e8},
    duelist:{name:'결투의 회랑',description:'마주 선 두 검과 긴장감이 감도는 무도장.',
      wall:0x2c3048,floor:0x323042,accent:0xb9c5fa,light:0xcbd4ff},
    commander:{name:'전략의 방',description:'고요한 작전실과 전장 지도가 펼쳐진 공간.',
      wall:0x2c403c,floor:0x33443a,accent:0xbed1a2,light:0xd6ecc1},
    egypt:{name:'잊힌 유물실',description:'고대의 기둥과 황금빛 유물이 있는 전시실.',
      wall:0x6e5847,floor:0x675442,accent:0xe0b87a,light:0xffdfab}
  };
  function roomTheme(game){
    return portalThemes[costumeKey(game)]||portalThemes.egypt;
  }
  function disposePocket(){
    if(!pocketWorld)return;
    scene.remove(pocketWorld);
    pocketWorld.traverse(obj=>{
      obj.geometry?.dispose?.();
      const disposeMaterial=mat=>{
        if(mat && !Object.values(materials).includes(mat))mat.dispose?.();
      };
      if(Array.isArray(obj.material))obj.material.forEach(disposeMaterial);
      else disposeMaterial(obj.material);
    });
    for(const tex of pocketTextures){
      tex.dispose();
      const idx=allTextures.indexOf(tex);
      if(idx>=0)allTextures.splice(idx,1);
    }
    pocketWorld=null; pocketTextures=[];pocketResources=[];pocketLights=[];
    exitPortal=null;
  }
  function pocketPalette(color,metalness=.08,roughness=.75){
    const mat=material(color,metalness,roughness);
    pocketResources.push(mat);
    return mat;
  }
  function buildPocket(index){
    disposePocket();
    const game=exhibits[index];
    if(!game)return false;
    const theme=roomTheme(game);
    const textureStart=allTextures.length;
    pocketWorld=new THREE.Group();pocketWorld.name='Painting world: '+game.title;
    scene.add(pocketWorld);
    const G=pocketWorld;
    const wall=pocketPalette(theme.wall),floor=pocketPalette(theme.floor);
    const gold=pocketPalette(theme.accent,.52,.4);
    const dark=pocketPalette(0x161920,.09,.83);
    const panel=pocketPalette(0x22252b,.12,.72);
    const stone=pocketPalette(0xbcb7a8);
    elBox(G,0,-.24,0,16,.48,18,floor);
    elBox(G,0,5.1,0,16,.24,18,wall);
    elBox(G,-8,2.5,0,.34,5.1,18,wall);
    elBox(G,8,2.5,0,.34,5.1,18,wall);
    elBox(G,0,2.5,-8.95,16,5.2,.32,wall);
    elBox(G,0,2.5,8.95,16,5.2,.32,wall);
    // Every destination has a grand central painting, crisp original title
    // plaque and its existing registered thumbnail if available.
    elBox(G,0,2.65,-8.68,7.7,4.28,.20,dark);
    const framedArt=new THREE.Mesh(new THREE.PlaneGeometry(7.1,3.85),
      new THREE.MeshStandardMaterial({
        map:artworkTexture(game,index),roughness:.66,side:THREE.DoubleSide
      }));
    framedArt.position.set(0,2.73,-8.54);
    G.add(framedArt);
    [-1,1].forEach(sign=>{
      elBox(G,sign*3.80,2.72,-8.48,.23,4.53,.24,gold);
      elBox(G,sign*7.73,2.50,0,.21,4.65,16.7,gold);
    });
    elBox(G,0,4.83,-8.48,7.7,.24,.24,gold);
    elBox(G,0,.55,-8.48,7.7,.24,.24,gold);
    const label=new THREE.Mesh(new THREE.PlaneGeometry(4.6,.85),
      new THREE.MeshStandardMaterial({map:plaqueTexture(game.title,game.developer||theme.name),
        emissive:theme.accent,emissiveIntensity:.06,roughness:.65}));
    label.position.set(0,.47,-8.32);G.add(label);
    // Architecture is thematic, but uses cheap batched-ish standard meshes.
    for(const side of [-1,1]){
      for(const z of [-5.9,-2.5,1.0,4.5]){
        elCylinder(G,side*6.5,2.45,z,.32,.43,4.9,gold,mobile?8:13);
        elBox(G,side*6.5,4.80,z,.93,.33,.94,wall);
        elBox(G,side*6.5,.34,z,.87,.68,.87,stone);
      }
    }
    const key=costumeKey(game);
    if(key==='arena'){
      for(const side of [-1,1])for(let i=0;i<3;i++){
        const obj=new THREE.Mesh(new THREE.SphereGeometry(.50+i*.14,16,11),gold);
        obj.position.set(side*(4.8-i*.22),1.12+i*.18,-4.4+i*3.15);
        G.add(obj);
      }
    }else if(key==='knight'||key==='duelist'){
      for(const side of [-1,1]){
        const sword=new THREE.Group();sword.position.set(side*5.2,1.2,-2.5);
        sword.rotation.z=side*.24;G.add(sword);
        elBox(sword,0,1.15,0,.16,2.45,.16,stone);
        elBox(sword,0,-.12,0,.90,.12,.17,gold);
        elBox(sword,0,-.41,0,.13,.50,.15,dark);
        const point=new THREE.Mesh(new THREE.ConeGeometry(.13,.45,4),stone);
        point.position.y=2.58;sword.add(point);
      }
    }else if(key==='maid'){
      for(const side of [-1,1]){
        const decor=new THREE.Mesh(new THREE.TorusGeometry(.94,.085,10,44),gold);
        decor.position.set(side*5.1,3.0,-3.5);
        decor.rotation.y=Math.PI/2;G.add(decor);
        elBox(G,side*5.2,.70,-3.4,1.80,1.4,1.35,panel);
      }
    }else if(key==='commander'){
      elBox(G,0,.96,-2.9,3.6,.2,2.1,stone);
      elBox(G,0,.50,-2.9,2.3,.95,1.4,dark);
      for(const side of [-1,1]){
        elBox(G,side*2.65,.22,-2.2,.17,.44,3.9,gold);
      }
    }else{
      for(const side of [-1,1]){
        elBox(G,side*5.3,1.15,-3.5,.78,2.3,.78,gold);
        const tip=new THREE.Mesh(new THREE.ConeGeometry(.68,1.05,4),gold);
        tip.position.set(side*5.3,2.78,-3.5);tip.rotation.y=Math.PI/4;G.add(tip);
      }
    }
    // Door behind the visitor is a real world object and a real jump portal.
    const exitMat=new THREE.MeshBasicMaterial({color:theme.accent,side:THREE.DoubleSide,
      transparent:true,opacity:.70});
    const exit=new THREE.Mesh(new THREE.PlaneGeometry(2.30,3.42),exitMat);
    exit.position.set(0,2.00,8.73);
    exit.rotation.y=Math.PI;
    exit.userData.exitPortal=true;
    G.add(exit);exitPortal=exit;
    elBox(G,0,4.01,8.68,2.70,.35,.45,gold);
    elBox(G,-1.32,2.0,8.68,.28,3.9,.45,gold);
    elBox(G,1.32,2.0,8.68,.28,3.9,.45,gold);
    const sign=plaqueTexture('복도로 돌아가기','출구 / RETURN TO THE GALLERY');
    const signObj=new THREE.Mesh(new THREE.PlaneGeometry(2.3,.64),
      new THREE.MeshBasicMaterial({map:sign,side:THREE.DoubleSide}));
    signObj.position.set(0,4.49,8.57);signObj.rotation.y=Math.PI;
    G.add(signObj);
    const illumination=new THREE.PointLight(theme.light,8.2,12,1.7);
    illumination.position.set(0,4.3,-4);G.add(illumination);
    const portalGlow=new THREE.PointLight(theme.accent,4.5,7,2);
    portalGlow.position.set(0,2.5,7.15);G.add(portalGlow);
    pocketLights=[{light:illumination,strength:8.2},
      {light:portalGlow,strength:4.5}];
    pocketTextures=allTextures.slice(textureStart);
    batchArchitecture(pocketWorld);
    pocketWorld.visible=false;
    return true;
  }


  function reflectRoomUI(){
    const inRoom=sceneMode==='inside' && exhibits[activeExhibit];
    surface.classList.toggle('gallery-portal-inside',Boolean(inRoom));
    backButton.hidden=!inRoom;
    roomCard.hidden=!inRoom;
    const mapDock=document.querySelector('.gallery-room-map');
    if(mapDock)mapDock.hidden=Boolean(inRoom);
    if(inRoom){
      const game=exhibits[activeExhibit];
      const theme=roomTheme(game);
      roomTitle.textContent=game.title;
      roomDescription.textContent=theme.name+' · '+theme.description;
      focusLabel.textContent=game.title;
      hint.textContent='작품 속 전시실 · E 작품 정보 · R 전시관 귀환';
      action.hidden=false;
      action.dataset.index=String(activeExhibit);
      action.textContent='작품 정보 보기 · E';
    }else{
      action.textContent='작품 정보 보기 · E';
      backButton.hidden=true;
    }
  }
  function performPortalSwap(kind,index){
    jumpHeight=0;jumpVelocity=0;queuedJump=null;
    if(kind==='enter'){
      if(!exhibits[index])return false;
      savedHallPose=portalTransition?.hallPose||{
        x:camera.position.x,z:camera.position.z,yaw,pitch
      };
      if(!buildPocket(index))return false;
      sceneMode='inside';activeExhibit=index;
      world.visible=false;pocketWorld.visible=true;
      camera.position.set(0,1.68,3.2);
      groundY=0;moveVelX=moveVelZ=0;cameraSnap=true;
      yaw=0;pitch=.16;
    }else{
      if(sceneMode!=='inside')return false;
      sceneMode='hall';activeExhibit=-1;
      world.visible=true;disposePocket();
      const restore=savedHallPose||{x:0,z:-.95,yaw:-.55,pitch:0};
      groundY=floorHeightAt(restore.x,restore.z);
      camera.position.set(restore.x,1.68+groundY,restore.z);
      moveVelX=moveVelZ=0;cameraSnap=true;
      yaw=restore.yaw;pitch=restore.pitch;
      savedHallPose=null;
    }
    reflectRoomUI();
    setOrientation();
    applyLighting();
    updateFocus();
    return true;
  }
  function finishPortalTransition(){
    portalTransition=null;
    surface.classList.remove('gallery-portal-busy');
    portalOverlay.classList.remove('portal-return');
    portalOverlay.hidden=true;
    jumpHeight=0;jumpVelocity=0;queuedJump=null;
    groundY=floorHeightAt(camera.position.x,camera.position.z);
    camera.position.y=1.68+groundY;
    cameraSnap=true;
    reflectRoomUI();
    lastTime=performance.now();
  }
  function startPortal(kind,index){
    if(!hasEntered||portalTransition||paused())return false;
    if(kind==='enter' && (sceneMode!=='hall'||!exhibits[index]))return false;
    if(kind==='exit' && sceneMode!=='inside')return false;
    if(document.pointerLockElement===renderer.domElement){
      document.exitPointerLock?.();
    }
    keys.clear();joyX=joyY=0;joystickKnob.style.transform='';
    queuedJump=null;
    const mapDock=document.querySelector('.gallery-room-map');
    if(mapDock)mapDock.hidden=true;
    const startPosition=camera.position.clone();
    let endPosition=startPosition.clone();
    if(kind==='enter'){
      const loc=exhibitPlacements[index]||paintingLocation(index);
      endPosition.set(loc.x+loc.nx*.3,loc.y,loc.z+loc.nz*.3);
    }else{
      endPosition.set(0,2.45,8.75);
    }
    portalTransition={
      kind,index,start:performance.now(),swapped:false,
      startPosition,endPosition,
      hallPose:kind==='enter'?{x:startPosition.x,z:startPosition.z,yaw,pitch}:null
    };
    portalCaption.textContent=kind==='enter'
      ?exhibits[index].title:'오이붕 갤러리로 돌아갑니다';
    portalOverlay.hidden=false;
    portalOverlay.classList.toggle('portal-return',kind==='exit');
    surface.classList.add('gallery-portal-busy');
    if(reduced()){
      performPortalSwap(kind,index);
      finishPortalTransition();
    }
    return true;
  }
  function advancePortalTransition(time){
    if(!portalTransition)return false;
    const tr=portalTransition;
    const elapsed=time-tr.start;
    if(!tr.swapped){
      // A physical camera push into the painting, before the world swap.
      const t=THREE.MathUtils.clamp(elapsed/410,0,1);
      const eased=t*t*(3-2*t);
      camera.position.lerpVectors(tr.startPosition,tr.endPosition,eased);
    }
    if(!tr.swapped && elapsed>=410){
      tr.swapped=true;
      let ok=false;
      try{ok=performPortalSwap(tr.kind,tr.index);}
      catch(error){
        console.error('[3D Gallery] Portal swap failed; restoring the hall:',error);
        if(pocketWorld)disposePocket();
        sceneMode='hall';activeExhibit=-1;
        if(world)world.visible=true;
        savedHallPose=null;
        camera.position.set(0,1.68,5.8);yaw=0;pitch=.12;
        groundY=0;cameraSnap=true;
        setOrientation();applyLighting();
      }
      if(!ok){finishPortalTransition();return false;}
    }
    if(tr.swapped && tr.kind==='enter'){
      // Emerge from the other side into the dedicated exhibit.
      const t=THREE.MathUtils.clamp((elapsed-410)/570,0,1);
      camera.position.z=5.0-1.8*(t*t*(3-2*t));
    }
    if(elapsed>=1070){
      finishPortalTransition();
      return false;
    }
    return true;
  }
  function isNearEntry(index){
    if(!Number.isInteger(index)||index<0||index>=exhibits.length)return false;
    const loc=exhibitPlacements[index];
    if(!loc)return false;
    return Math.hypot(camera.position.x-loc.x,camera.position.z-loc.z)<3.75
      && Math.abs(camera.position.y-loc.y)<2.22;
  }
  function exitInReach(){
    return sceneMode==='inside'
      && Math.abs(camera.position.x)<2.2
      && camera.position.z>5.0;
  }
  function aimedPortalIndex(){
    const direct=targetedArt();
    if(direct>=0)return direct;
    const near=nearestArt();
    if(near<0||!isNearEntry(near))return -1;
    const loc=exhibitPlacements[near];
    if(!loc)return -1;
    const dx=loc.x-camera.position.x;
    const dz=loc.z-camera.position.z;
    const distance=Math.hypot(dx,dz)||1;
    const toward=(-Math.sin(yaw)*dx-Math.cos(yaw)*dz)/distance;
    // Visitors need not line their reticle up with one exact pixel of art.
    return toward>.63?near:-1;
  }
  function doJump(hintIndex=null){
    if(!hasEntered||portalTransition||paused())return;
    if(jumpHeight>.025||jumpVelocity>0)return;
    const time=performance.now();
    const running=keys.has('ShiftLeft')||keys.has('ShiftRight')
      ||(mobile&&Math.hypot(joyX,joyY)>.83);
    const fast=Math.hypot(moveVelX,moveVelZ)>2.0;
    const longJump=running&&fast;
    jumpCombo=time-lastLandingAt<660?(jumpCombo%3)+1:1;
    jumpStartedAt=time;
    jumpVelocity=longJump?5.10:[0,5.65,6.48,7.48][jumpCombo];
    jumpHeight=.025;
    if(longJump){
      longJumpUntil=time+540;
      moveVelX*=1.22;moveVelZ*=1.22;
    }
    const candidate=Number.isInteger(hintIndex)?hintIndex:aimedPortalIndex();
    if(sceneMode==='hall' && candidate>=0 && isNearEntry(candidate)){
      queuedJump={kind:'enter',index:candidate,start:performance.now()};
    }else if(exitInReach()){
      queuedJump={kind:'exit',index:activeExhibit,start:performance.now()};
    }
  }
  function checkAirbornePortal(time){
    if(portalTransition||jumpHeight<.15)return;
    if(queuedJump){
      if(time-queuedJump.start>115){
        const queued=queuedJump;
        queuedJump=null;
        startPortal(queued.kind,queued.index);
      }
      return;
    }
    // Jumping forwards can trigger the frame on contact, not only when
    // already standing still in front of it.
    if(sceneMode==='hall'){
      const idx=aimedPortalIndex();
      if(idx>=0&&isNearEntry(idx))startPortal('enter',idx);
    }else if(exitInReach()){
      startPortal('exit',activeExhibit);
    }
  }

  function paintingLocation(index){
    // Castle paintings are intentionally discoverable from several directions.
    if(index===0)return {x:-5.62,y:2.72,z:-9.34,angle:0,nx:0,nz:1,upper:false};
    if(index===1)return {x:5.62,y:2.72,z:-9.34,angle:0,nx:0,nz:1,upper:false};
    if(index===2)return {x:-9.35,y:2.77,z:-3.50,angle:Math.PI/2,nx:1,nz:0,upper:false};
    if(index===3)return {x:-9.35,y:2.77,z:3.75,angle:Math.PI/2,nx:1,nz:0,upper:false};
    if(index===4)return {x:9.35,y:4.30,z:-3.30,angle:-Math.PI/2,nx:-1,nz:0,upper:true};
    if(index===5)return {x:9.35,y:4.30,z:1.05,angle:-Math.PI/2,nx:-1,nz:0,upper:true};
    const n=index-6,side=n%2===0?-1:1;
    return {x:side*7.52,y:2.85,z:-16.2-Math.floor(n/2)*7.1,
      angle:side<0?Math.PI/2:-Math.PI/2,
      nx:side<0?1:-1,nz:0,upper:false};
  }
  function floorHeightAt(x,z){
    if(sceneMode==='inside')return 0;
    // A short staircase rises to a walkable upper gallery along the east wall.
    if(x>=5.55 && x<=9.30){
      if(z>=-6.65 && z<=1.88)return 1.60;
      if(z>1.88 && z<=6.38){
        const step=Math.floor((6.38-z+.00001)/.45)+1;
        return Math.max(0,Math.min(1.60,step*.16));
      }
    }
    return 0;
  }
  // Merge non-moving opaque architectural meshes by shared material.
  // This cuts hundreds of per-object draw calls without downloading an addon.
  // Portal canvases, plaques, lighting and the animated stickman stay separate.
  function batchArchitecture(root){
    if(!root)return 0;
    root.updateWorldMatrix(true,true);
    const pools=new Map();
    root.traverse(node=>{
      if(!node.isMesh||node.children.length||node.userData.galleryIndex!=null)return;
      const mat=node.material,geo=node.geometry;
      if(!mat?.isMeshStandardMaterial||mat.map||mat.transparent||!geo)return;
      if(!geo.getAttribute('position')||!geo.getAttribute('normal')||
        !geo.getAttribute('uv'))return;
      const list=pools.get(mat)||[];
      list.push(node);pools.set(mat,list);
    });
    let saved=0;
    for(const [mat,items] of pools){
      if(items.length<3)continue;
      const count=items.reduce((n,m)=>n+
        (m.geometry.index?.count||m.geometry.getAttribute('position').count),0);
      const vertices=new Float32Array(count*3);
      const normals=new Float32Array(count*3);
      const uvs=new Float32Array(count*2);
      let offset=0;
      for(const mesh of items){
        const geometry=mesh.geometry.clone();
        geometry.applyMatrix4(mesh.matrixWorld);
        const pos=geometry.getAttribute('position');
        const nor=geometry.getAttribute('normal');
        const uv=geometry.getAttribute('uv');
        const indices=geometry.index;
        const n=indices?.count||pos.count;
        for(let k=0;k<n;k++){
          const i=indices?indices.getX(k):k;
          const v=(offset+k)*3,t=(offset+k)*2;
          vertices[v]=pos.getX(i);
          vertices[v+1]=pos.getY(i);
          vertices[v+2]=pos.getZ(i);
          normals[v]=nor.getX(i);
          normals[v+1]=nor.getY(i);
          normals[v+2]=nor.getZ(i);
          uvs[t]=uv.getX(i);
          uvs[t+1]=uv.getY(i);
        }
        offset+=n;
        geometry.dispose();
      }
      const merged=new THREE.BufferGeometry();
      merged.setAttribute('position',new THREE.BufferAttribute(vertices,3));
      merged.setAttribute('normal',new THREE.BufferAttribute(normals,3));
      merged.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
      merged.computeBoundingBox();merged.computeBoundingSphere();
      const batch=new THREE.Mesh(merged,mat);
      batch.name='museum static architecture · '+items.length+' merged pieces';
      root.add(batch);
      for(const mesh of items){
        mesh.parent.remove(mesh);
        mesh.geometry.dispose();
      }
      saved+=items.length-1;
    }
    return saved;
  }
  function stageWall(parent,x,y,z,w,h,d,mat,collidable=true){
    const block=elBox(parent,x,y,z,w,h,d,mat);
    if(collidable){
      walls.push({
        minX:x-w/2,maxX:x+w/2,
        minZ:z-d/2,maxZ:z+d/2,
        minY:y-h/2,maxY:y+h/2
      });
      cameraWalls.push(new THREE.Box3(
        new THREE.Vector3(x-w/2,y-h/2,z-d/2),
        new THREE.Vector3(x+w/2,y+h/2,z+d/2)));
    }
    return block;
  }
  function stageColumn(parent,x,y,z,radius,height,mat){
    const shape=elCylinder(parent,x,y,z,radius,radius*1.12,height,
      mat,mobile?10:16);
    const r=radius*.92;
    walls.push({minX:x-r,maxX:x+r,minZ:z-r,maxZ:z+r,
      minY:y-height/2,maxY:y+height/2});
    cameraWalls.push(new THREE.Box3(
      new THREE.Vector3(x-r,y-height/2,z-r),
      new THREE.Vector3(x+r,y+height/2,z+r)));
    return shape;
  }
  function blockedAt(x,z){
    const feet=groundY+jumpHeight;
    for(const b of walls){
      if(feet>b.maxY+.05||feet+1.45<b.minY)continue;
      const closestX=THREE.MathUtils.clamp(x,b.minX,b.maxX);
      const closestZ=THREE.MathUtils.clamp(z,b.minZ,b.maxZ);
      if((x-closestX)**2+(z-closestZ)**2<playerRadius*playerRadius)return true;
    }
    return false;
  }
  function moveWithCollision(dx,dz){
    const x=camera.position.x,z=camera.position.z;
    const candidateX=x+dx,candidateZ=z+dz;
    const currentGround=floorHeightAt(x,z);
    // Prevent magically hopping up to the raised gallery from below.
    const canStep=(cx,cz)=>jumpHeight>.3||
      floorHeightAt(cx,cz)<=currentGround+.24;
    const nextX=canStep(candidateX,z)&&!blockedAt(candidateX,z)?candidateX:x;
    const nextZ=canStep(nextX,candidateZ)&&!blockedAt(nextX,candidateZ)
      ?candidateZ:z;
    camera.position.x=nextX;
    camera.position.z=nextZ;
    if(nextX===x)moveVelX=0;
    if(nextZ===z)moveVelZ=0;
  }
  function tiledHubFloor(){
    const canvas=makeCanvas(512,512),ctx=canvas.getContext('2d');
    for(let row=0;row<8;row++)for(let col=0;col<8;col++){
      ctx.fillStyle=(row+col)%2===0?'#d5c7ac':'#46525b';
      ctx.fillRect(col*64,row*64,64,64);
      ctx.fillStyle=(row+col)%2===0?'#ffffff14':'#03080a15';
      ctx.fillRect(col*64+5,row*64+5,54,54);
      ctx.strokeStyle='#977f69b0';ctx.lineWidth=2;
      ctx.strokeRect(col*64+.5,row*64+.5,63,63);
    }
    return canvasTexture(canvas);
  }

  function build(){
    if(rebuilding)return false;
    rebuilding=true;
    try{
    const previous=exhibits[nearIndex]?.id || '';
    const previousRoomId=sceneMode==='inside'?exhibits[activeExhibit]?.id:null;
    const priorRoomPose=previousRoomId
      ?{x:camera.position.x,z:camera.position.z,yaw,pitch}:null;
    const next=fromCatalog();
    if(pocketWorld)disposePocket();
    clearWorld();
    exhibits=next;
    if (!next.length){
      sceneMode='hall';activeExhibit=-1;savedHallPose=null;
      jumpHeight=0;jumpVelocity=0;queuedJump=null;
      surface.classList.add('gallery-3d-empty');
      focusLabel.textContent='전시 중인 작품이 없습니다';
      roomCard.hidden=true;backButton.hidden=true;action.hidden=true;
      const mapDock=document.querySelector('.gallery-room-map');
      if(mapDock)mapDock.hidden=false;
      return true;
    }
    surface.classList.remove('gallery-3d-empty');
    const total=next.length;
    const rows=Math.max(0,Math.ceil((total-6)/2));
    roomEnd=Math.min(-22.5,-16.2-(rows+1)*7.1);
    world=new THREE.Group();world.name='오이붕 갤러리 · 성형 허브';
    scene.add(world);
    walls.length=0;cameraWalls.length=0;exhibitPlacements.length=0;

    // Main atrium: an original low-poly museum castle, not Nintendo geometry.
    const checkered=tiledHubFloor();
    checkered.wrapS=checkered.wrapT=THREE.RepeatWrapping;
    checkered.repeat.set(2.5,2.5);
    const floor=new THREE.MeshStandardMaterial({
      map:checkered,color:0xf3ede2,roughness:.78,metalness:.04
    });
    const carpet=material(0x883d49,.05,.86);
    const velvet=material(0x493f69,.02,.82);
    const column=materials.ivory,stone=materials.plaster,accent=materials.gold;
    const hallLength=19.3;
    elBox(world,0,-.21,0,19.3,.42,19.3,floor);
    elBox(world,0,7.48,0,19.3,.36,19.3,stone);
    stageWall(world,-9.65,3.73,0,.30,7.45,hallLength,column);
    stageWall(world,9.65,3.73,0,.30,7.45,hallLength,column);
    stageWall(world,0,3.73,9.65,hallLength,7.45,.30,column);
    // The back wall has an actual walkable arched opening.
    stageWall(world,-6.55,3.73,-9.65,6.18,7.45,.30,column);
    stageWall(world,6.55,3.73,-9.65,6.18,7.45,.30,column);
    stageWall(world,0,6.69,-9.65,6.95,1.57,.35,column);
    for(const side of [-1,1]){
      elBox(world,side*9.28,.62,0,.19,1.18,19.0,materials.oak);
      elBox(world,side*9.38,6.85,0,.15,.18,19.0,accent);
      for(const z of [-7.85,7.85]){
        stageColumn(world,side*8.38,3.45,z,.40,6.83,column);
        elBox(world,side*8.38,.33,z,1.15,.66,1.15,stone);
        elBox(world,side*8.38,6.95,z,1.23,.48,1.23,accent);
      }
    }
    // Ring relief, warm chandeliers and a carpeted circular museum seal.
    const foyerSeal=new THREE.Mesh(new THREE.CylinderGeometry(2.48,2.48,.05,36),
      material(0x293f46,.26,.65));
    foyerSeal.position.set(0,.042,2.30);world.add(foyerSeal);
    const sealRing=new THREE.Mesh(new THREE.TorusGeometry(2.38,.12,8,50),accent);
    sealRing.rotation.x=Math.PI/2;sealRing.position.set(0,.082,2.30);
    world.add(sealRing);
    elBox(world,0,.043,-4.13,3.0,.045,7.5,carpet);
    for(const z of [4.9,-4.4]){
      const chandelier=new THREE.Group();chandelier.position.set(0,6.60,z);
      world.add(chandelier);
      const hoop=new THREE.Mesh(new THREE.TorusGeometry(1.18,.105,8,24),accent);
      hoop.rotation.x=Math.PI/2;chandelier.add(hoop);
      elCylinder(chandelier,0,.52,0,.045,.055,1.05,accent,8);
      for(let j=0;j<8;j++){
        const a=j*Math.PI/4;
        const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.17,0),
          new THREE.MeshStandardMaterial({color:0xfff1c9,emissive:0xffc481,
            emissiveIntensity:darkness?0:1.25,roughness:.23}));
        crystal.position.set(Math.cos(a)*1.15,-.15,Math.sin(a)*1.15);
        chandelier.add(crystal);glowingFixtures.push(crystal.material);
      }
      const glow=new THREE.PointLight(0xffd8a7,0,15,1.65);
      glow.position.set(0,5.85,z);world.add(glow);exhibitionLights.push(glow);
    }
    // The back arch leads to additional artwork halls when the catalog grows.
    const arch=new THREE.Mesh(new THREE.TorusGeometry(3.03,.22,10,42,Math.PI),accent);
    arch.position.set(0,4.30,-9.36);world.add(arch);
    for(const side of [-1,1]){
      elCylinder(world,side*3.06,2.35,-9.37,.30,.34,4.70,accent,12);
    }
    const titleTex=plaqueTexture('오이붕 갤러리','그림 속으로 뛰어드는 전시관');
    const entranceSign=new THREE.Mesh(new THREE.PlaneGeometry(4.7,1.2),
      new THREE.MeshStandardMaterial({map:titleTex,emissive:0x382719,
        emissiveIntensity:.12,roughness:.70}));
    entranceSign.position.set(0,5.92,9.34);
    entranceSign.rotation.y=Math.PI;
    world.add(entranceSign);

    // The real staircase is walkable. Its upper landing holds artworks 5/6.
    // Each step has a matching collision-support height in floorHeightAt.
    for(let i=0;i<10;i++){
      const top=(i+1)*.16;
      const z=6.38-(i+.5)*.45;
      elBox(world,7.45,top*.5,z,3.83,top,.455,column);
      elBox(world,7.45,top+.025,z,3.74,.05,.43,carpet);
    }
    elBox(world,7.42,1.53,-2.42,3.84,.14,8.88,column);
    elBox(world,7.42,1.625,-2.40,3.42,.05,8.80,velvet);
    // Decorative railing protects the upper edge; ground-floor visitors
    // cannot magically phase upwards through the platform.
    for(const z of [-6.30,-4.7,-3.1,-1.5,.2,1.55]){
      elCylinder(world,5.48,2.25,z,.065,.075,.92,accent,9);
    }
    stageWall(world,5.47,2.64,-2.38,.13,.22,8.58,accent);
    for(const z of [2.0,4.3]){
      elCylinder(world,5.50,.66,z,.17,.19,1.32,accent,9);
    }

    // Longer side galleries unfold from the rear arch, not by teleporting
    // between disconnected art slides.
    const rearLength=-9.44-roomEnd;
    const rearMid=(-9.44+roomEnd)*.5;
    const corridorTiles=stoneFloorTexture();
    corridorTiles.wrapS=corridorTiles.wrapT=THREE.RepeatWrapping;
    corridorTiles.repeat.set(3,Math.max(2,rearLength/6));
    const corridorFloor=new THREE.MeshStandardMaterial({
      map:corridorTiles,color:0xe5d6c2,roughness:.86
    });
    elBox(world,0,-.205,rearMid,15.8,.41,rearLength,corridorFloor);
    elBox(world,0,7.34,rearMid,15.8,.27,rearLength,stone);
    stageWall(world,-7.87,3.6,rearMid,.35,7.2,rearLength,column);
    stageWall(world,7.87,3.6,rearMid,.35,7.2,rearLength,column);
    stageWall(world,0,3.5,roomEnd,15.9,7.1,.34,column);
    const beams=Math.max(1,Math.ceil(rearLength/7));
    for(let j=0;j<beams;j++){
      const z=-12.0-j*7.0;
      if(z<roomEnd+1)break;
      for(const side of [-1,1]){
        stageColumn(world,side*7.25,3.14,z,.25,6.20,column);
        elBox(world,side*7.25,.36,z,.82,.72,.83,accent);
        elBox(world,side*7.25,6.33,z,.87,.27,.9,accent);
      }
      elBox(world,0,7.02,z,15.1,.22,.31,accent);
      const lamp=new THREE.PointLight(0xffd7a1,0,11,1.6);
      lamp.position.set(0,5.85,z);world.add(lamp);exhibitionLights.push(lamp);
      if(j%3===1){
        const emergency=new THREE.PointLight(0xc83f37,0,4.3,2);
        emergency.position.set(0,4.7,z);world.add(emergency);
        emergencyLights.push(emergency);
      }
    }

    next.forEach((game,i)=>{
      const loc=paintingLocation(i);
      exhibitPlacements[i]=loc;
      const group=new THREE.Group();
      group.position.set(loc.x,loc.y,loc.z);
      group.rotation.y=loc.angle;
      world.add(group);
      // A framed painting sits flush against a real wall. No 2D assistant.
      elBox(group,0,0,-.04,4.29,2.77,.14,materials.black);
      const painting=portalPainting(artworkTexture(game,i),i);
      painting.userData.galleryIndex=i;
      paintings.push(painting);group.add(painting);
      for(const side of [-1,1]){
        elBox(group,side*2.06,0,.125,.21,2.73,.22,accent);
      }
      elBox(group,0,1.30,.125,4.31,.20,.22,accent);
      elBox(group,0,-1.30,.125,4.31,.20,.22,accent);
      const plaque=new THREE.Mesh(new THREE.PlaneGeometry(2.64,.67),
        new THREE.MeshStandardMaterial({
          map:plaqueTexture(game.title,game.developer||game.genre||'작품 감상'),
          roughness:.77,metalness:.04,side:THREE.DoubleSide}));
      plaque.position.set(0,-1.80,.125);
      plaque.userData.galleryIndex=i;group.add(plaque);
      // The framed works receive individually focused spotlights.
      const lamp=new THREE.SpotLight(0xffe0ae,0,9.4,Math.PI/5,.68,1.75);
      lamp.position.set(loc.x+loc.nx*1.7,loc.y+2.38,loc.z+loc.nz*1.7);
      lamp.target.position.set(loc.x+loc.nx*.05,loc.y,loc.z+loc.nz*.05);
      world.add(lamp,lamp.target);exhibitionLights.push(lamp);
      const wash=new THREE.PointLight(0xffc68b,0,6,2);
      wash.position.set(loc.x+loc.nx*1.4,loc.y+1.0,loc.z+loc.nz*1.4);
      world.add(wash);exhibitionLights.push(wash);
    });
    batchArchitecture(world);
    document.dispatchEvent(new CustomEvent('oibung-gallery-layout',{
      detail:{placements:exhibitPlacements.map(loc=>({
        x:loc.x,y:loc.y,z:loc.z,upper:loc.upper
      }))}
    }));
    const keep=next.findIndex(g=>g.id===previous);
    const roomIndex=previousRoomId
      ?next.findIndex(g=>g.id===previousRoomId):-1;
    if(roomIndex>=0 && buildPocket(roomIndex)){
      sceneMode='inside';activeExhibit=roomIndex;
      world.visible=false;pocketWorld.visible=true;
      if(priorRoomPose){
        camera.position.set(priorRoomPose.x,1.68,priorRoomPose.z);
        yaw=priorRoomPose.yaw;pitch=priorRoomPose.pitch;
      }
    }else{
      sceneMode='hall';activeExhibit=-1;
      if(keep>=0){
        camera.position.z=Math.min(8.8,Math.max(roomEnd+1.2,camera.position.z));
      }else{
        camera.position.set(0,1.68,5.8);
        yaw=0;pitch=.12;nearIndex=-1;
      }
    }
    groundY=floorHeightAt(camera.position.x,camera.position.z);
    camera.position.y=1.68+groundY;
    moveVelX=moveVelZ=0;cameraSnap=true;
    jumpHeight=0;jumpVelocity=0;queuedJump=null;
    reflectRoomUI();
    setOrientation();
    applyLighting();
    resize();
    return true;
    }catch(error){
      console.error('[3D Gallery] Scene rebuild failed:',error);
      document.body.classList.remove('three-gallery-ready');
      surface.hidden=true; // preserve the accessible original gallery
      return false;
    }finally{
      rebuilding=false;
    }
  }

  function applyLighting(){
    darkness=document.documentElement.dataset.galleryMode==='dark';
    const theme=sceneMode==='inside' && exhibits[activeExhibit]
      ?roomTheme(exhibits[activeExhibit]):null;
    scene.background.set(darkness?0x020305:(theme?.wall??0xa8a59d));
    scene.fog.color.set(darkness?0x020306:(theme?.wall??0xa8a59d));
    scene.fog.density=darkness ? .061 : (theme ? .020 : .012);
    ambient.intensity=darkness?.008:.7;
    hemisphere.intensity=darkness?.018:1.45;
    sun.intensity=darkness?0:.95;
    portraitFill.intensity=darkness?0:2.1;
    torch.intensity=darkness&&flashlightOn?17:0;
    renderer.toneMappingExposure=darkness?.80:1.12;
    exhibitionLights.forEach(light=>{light.intensity=0;light.visible=false});
    emergencyLights.forEach(light=>{light.intensity=0;light.visible=false});
    pocketLights.forEach(({light,strength})=>{
      const near=sceneMode==='inside';
      light.visible=near;
      light.intensity=near?(darkness?strength*.025:strength):0;
    });
    glowingFixtures.forEach(mat=>mat.emissiveIntensity=darkness?0:1.25);
    portalSurfaces.forEach(({uniforms})=>{
      uniforms.uDim.value=darkness?.45:1;
    });
    lightToggle.textContent=darkness?'☀ 불 켜기':'☾ 소등';
    flashlightButton.hidden=!darkness;
    flashlightButton.textContent=flashlightOn?'손전등 끄기 [F]':'손전등 켜기 [F]';
    surface.classList.toggle('gallery-3d-dark',darkness);
  }
  function updateNearbyLights(time){
    if(darkness)torch.intensity=flashlightOn
      ?16.5+.42*Math.sin(time*.0038):0;
    if(time-lastLightCheck<130)return;
    lastLightCheck=time;
    if(sceneMode==='inside'){
      exhibitionLights.forEach(light=>{light.intensity=0;light.visible=false});
      emergencyLights.forEach(light=>{light.intensity=0;light.visible=false});
      pocketLights.forEach(({light,strength})=>{
        light.visible=true;
        light.intensity=darkness?strength*.025:strength;
      });
      if(darkness){
        torch.intensity=flashlightOn
          ?16.5+.45*Math.sin(time*.0038)+.12*Math.sin(time*.041):0;
      }else torch.intensity=0;
      return;
    }
    if(darkness) {
      exhibitionLights.forEach(light=>{light.intensity=0;light.visible=false});
      let emergencyCount=0;
      emergencyLights.forEach(light=>{
        const near=emergencyCount<(mobile?1:2) && Math.hypot(
          light.position.x-camera.position.x,
          light.position.z-camera.position.z)<10;
        light.visible=near;
        light.intensity=near?(.35 + Math.sin(time*.0017+light.position.z)*.05):0;
        if(near)emergencyCount++;
      });
      torch.intensity=flashlightOn?(16.5 + .45*Math.sin(time*.0038) + .12*Math.sin(time*.041)):0;
      portalSurfaces.forEach(({uniforms})=>{
        uniforms.uDim.value=flashlightOn?.48:.13;
      });
    } else {
      const limit=mobile?3:5;
      const lights=exhibitionLights.map(light=>({
        light,distance:Math.hypot(light.position.x-camera.position.x,
          light.position.z-camera.position.z)
      })).filter(item=>item.distance<12.5);
      lights.sort((a,b)=>a.distance-b.distance);
      const selected=new Set(lights.slice(0,limit).map(item=>item.light));
      exhibitionLights.forEach(light=>{
        const visible=selected.has(light);
        light.visible=visible;
        light.intensity=visible?(light.isSpotLight?7.0:
          light.distance<=6?3.5:9.5):0;
      });
      emergencyLights.forEach(light=>{light.intensity=0;light.visible=false});
      portalSurfaces.forEach(({uniforms})=>{uniforms.uDim.value=1;});
    }
  }

  function resize(){
    const w=surface.clientWidth,h=surface.clientHeight;
    if(w<1||h<1)return;
    camera.aspect=w/h;camera.updateProjectionMatrix();
    followCamera.aspect=w/h;followCamera.updateProjectionMatrix();
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
    const inputLen=Math.hypot(forward,sideways);
    velocity=Math.min(1,inputLen);
    const boost=performance.now()<longJumpUntil;
    const running=keys.has('ShiftLeft')||keys.has('ShiftRight')
      ||(mobile&&Math.hypot(joyX,joyY)>.83);
    const speed=boost?7.8:running?5.7:3.7;
    const f=inputLen>.03?forward/inputLen:0;
    const r=inputLen>.03?sideways/inputLen:0;
    // Momentum produces acceleration, drifting and air control rather than
    // first-person free-camera instant displacement.
    const targetVX=(-Math.sin(yaw)*f+Math.cos(yaw)*r)*speed;
    const targetVZ=(-Math.cos(yaw)*f-Math.sin(yaw)*r)*speed;
    const air=jumpHeight>.03;
    const response=air?(boost?2.3:4.6):inputLen>.03?9.5:13.5;
    moveVelX=THREE.MathUtils.damp(moveVelX,targetVX,response,dt);
    moveVelZ=THREE.MathUtils.damp(moveVelZ,targetVZ,response,dt);
    const oldX=camera.position.x,oldZ=camera.position.z;
    moveWithCollision(moveVelX*dt,moveVelZ*dt);
    if(sceneMode==='inside'){
      const withinX=THREE.MathUtils.clamp(camera.position.x,-7.15,7.15);
      const withinZ=THREE.MathUtils.clamp(camera.position.z,-7.3,7.50);
      if(withinX!==camera.position.x)moveVelX=0;
      if(withinZ!==camera.position.z)moveVelZ=0;
      camera.position.x=withinX;camera.position.z=withinZ;
    }
    const travelled=Math.hypot(camera.position.x-oldX,camera.position.z-oldZ);
    stride+=travelled;
    if(travelled>.003)lastMove=performance.now();

    const newGround=floorHeightAt(camera.position.x,camera.position.z);
    if(newGround<groundY-.25 && jumpHeight<.04){
      // Walking off a ledge must initiate a fall, not teleport vertically.
      jumpHeight=groundY-newGround;
      jumpVelocity=-.18;
    } else if(newGround>groundY && jumpHeight>.02){
      jumpHeight=Math.max(0,jumpHeight-(newGround-groundY));
    }
    groundY=newGround;
    if(jumpHeight>0||jumpVelocity>0){
      jumpHeight+=jumpVelocity*dt;
      jumpVelocity-=15.6*dt;
      if(jumpHeight<=0){
        jumpHeight=0;jumpVelocity=0;queuedJump=null;
        lastLandingAt=performance.now();
        cameraShake=.92;
      }
    }
    camera.position.y=1.68+groundY+jumpHeight;
  }
  function targetedArt(){
    if(sceneMode!=='hall')return -1;
    raycaster.setFromCamera(center,camera);
    const hits=raycaster.intersectObjects(paintings,false);
    return hits.length?hits[0].object.userData.galleryIndex:-1;
  }
  function nearestArt(){
    if(sceneMode!=='hall')return -1;
    let closest=-1,dist=Infinity;
    exhibits.forEach((game,i)=>{
      const loc=exhibitPlacements[i];
      if(!loc)return;
      const d=Math.hypot(camera.position.x-loc.x,camera.position.z-loc.z,(camera.position.y-loc.y)*.8);
      if(d<dist){dist=d;closest=i;}
    });
    return dist<9?closest:-1;
  }
  function updateFocus(){
    if(sceneMode==='inside'){
      const game=exhibits[activeExhibit];
      focused=activeExhibit;
      if(!game)return;
      focusLabel.textContent=game.title;
      action.hidden=false;
      action.dataset.index=String(activeExhibit);
      hint.textContent=exitInReach()
        ?'출구 액자 가까이 · 점프 또는 R로 복도 귀환'
        :'작품 속 전시실 · E로 작품 정보 · R로 귀환';
      return;
    }
    const targeted=aimedPortalIndex();
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
      hint.textContent='Space 점프 / 액자 클릭으로 진입 · E 작품 정보';
    } else {
      action.hidden=true;
      const nearest=exhibits[near];
      focusLabel.textContent=nearest ? nearest.title : '오이붕 갤러리';
      hint.textContent=darkness
        ?'손전등 [F] · 액자 앞에서 Space 점프'
        :'액자에 다가가서 Space를 눌러 뛰어드세요';
    }
  }
  function openArtwork(index){
    if(!Number.isInteger(index)||!exhibits[index])return;
    if(document.pointerLockElement)document.exitPointerLock?.();
    window.OIBUNG_CATALOG?.openDetail?.(exhibits[index].id);
  }
  function teleport(index){
    if(!exhibits[index])return;
    if(portalTransition)finishPortalTransition();
    if(sceneMode==='inside'){
      sceneMode='hall';activeExhibit=-1;
      disposePocket();
      world.visible=true;
      savedHallPose=null;
    }
    jumpHeight=0;jumpVelocity=0;queuedJump=null;
    const loc=exhibitPlacements[index]||paintingLocation(index);
    const x=loc.x+loc.nx*2.65,z=loc.z+loc.nz*2.65;
    groundY=floorHeightAt(x,z);
    camera.position.set(x,1.68+groundY,z);
    yaw=Math.atan2(loc.nx,loc.nz);pitch=.12;cameraSnap=true;
    moveVelX=moveVelZ=0;
    reflectRoomUI();
    setOrientation();applyLighting();updateFocus();
  }
  function paused(){
    return document.hidden || window.OIBUNG_CURRENT_VIEW==='reviews' ||
      !!document.querySelector('#gallery-room-map-panel:not([hidden])') ||
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
    // The static welcome screen needs only ~24 fps; the game uses full speed.
    if(!hasEntered && time-lastPreviewFrame<42)return;
    lastPreviewFrame=time;
    const frameTime=Math.max(0,(time-lastTime)/1000||0);
    const dt=Math.min(.05,frameTime);
    lastTime=time;
    const inTransition=advancePortalTransition(time);
    // Adapt the framebuffer, not native HTML text, to GPU performance.
    if(hasEntered && !inTransition && frameTime>.001 && frameTime<.20){
      resolutionSamples++;
      resolutionTime+=frameTime;
      if(time-lastResolutionCheck>4800){
        const average=resolutionTime/Math.max(1,resolutionSamples);
        const candidate=average>.030?renderResolution-.13:
          average<.018?renderResolution+.07:renderResolution;
        const adjusted=THREE.MathUtils.clamp(candidate,minimumResolution,deviceResolution);
        if(Math.abs(adjusted-renderResolution)>.035){
          renderResolution=adjusted;
          renderer.setPixelRatio(renderResolution);
        }
        lastResolutionCheck=time;resolutionTime=0;resolutionSamples=0;
      }
    }
    if(hasEntered && !inTransition){
      movePlayer(dt);
      checkAirbornePortal(time);
    }
    updateNearbyLights(time);
    setOrientation();
    updateExplorer(time,dt);
    followPlayer(dt);
    if(time-lastMapTick>120){
      lastMapTick=time;
      const mapPanel=document.getElementById('gallery-room-map-panel');
      if(mapPanel && !mapPanel.hidden){
        document.dispatchEvent(new CustomEvent('oibung-gallery-player-motion',{
          detail:{x:camera.position.x,z:camera.position.z,yaw,room:sceneMode}
        }));
      }
    }
    if(hasEntered && !inTransition && time-lastCount>90){
      updateFocus();lastCount=time;
    }
    portalSurfaces.forEach(({uniforms,index})=>{
      uniforms.uTime.value=time*.001;
      const highlighted=sceneMode==='hall' && (focused===index);
      const globalWarp=portalTransition?.kind==='enter' && portalTransition.index===index;
      const targetWarp=globalWarp?1.6:highlighted?.26:.015;
      uniforms.uWarp.value+=(targetWarp-uniforms.uWarp.value)*Math.min(1,dt*11);
    });
    renderer.render(scene,followCamera);
  }
  function isUserTyping(event){
    const mapIsOpen=!document.getElementById('gallery-room-map-panel')?.hidden;
    if(mapIsOpen&&event.target.closest?.('.gallery-room-map'))return true;
    return !!event.target.closest?.('input,textarea,select,[contenteditable="true"],dialog,[role="dialog"],#mobile-nav,.gallery-3d-hud,.page-switcher');
  }
  function tryPointerLock(){
    if(mobile || !renderer.domElement.requestPointerLock)return;
    try{Promise.resolve(renderer.domElement.requestPointerLock()).catch(()=>{});}
    catch(error){console.warn('[3D Gallery] Pointer lock unavailable; use drag-look.',error);}
  }
  function start(){
    hasEntered=true;surface.classList.add('gallery-3d-entered');
    cameraSnap=true;
    enter.blur();
    welcome.hidden=true;
    jumpButton.hidden=false;
    hint.textContent='WASD 이동 · Space 점프 · V 카메라 거리 · E 작품 정보';
    // Platform-game controls: the pointer stays usable for clicking artworks.
    // Orbit only while dragging the mouse (no forced pointer-lock).
  }
  enter.addEventListener('click',start);
  action.addEventListener('click',()=>openArtwork(Number(action.dataset.index)));
  function cycleCamera(){
    const distances=[3.20,4.25,5.80];
    const i=distances.reduce((best,d,i)=>Math.abs(d-cameraDistance)<Math.abs(distances[best]-cameraDistance)?i:best,0);
    cameraDistance=distances[(i+1)%distances.length];
    cameraSnap=false;
    if(cameraToggle){
      cameraToggle.textContent=cameraDistance<3.7?'시점: 가까이'
        :cameraDistance<5?'시점: 보통':'시점: 멀리';
      cameraToggle.blur();
    }
  }
  cameraToggle?.addEventListener('click',cycleCamera);
  jumpButton.addEventListener('click',()=>{
    jumpButton.blur();
    doJump();
  });
  backButton.addEventListener('click',()=>{
    backButton.blur();
    startPortal('exit',activeExhibit);
  });
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
    if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown',
      'ArrowRight','ShiftLeft','ShiftRight','KeyE','KeyF','KeyR','KeyV','KeyQ','Space'].includes(event.code)){
      event.preventDefault();event.stopImmediatePropagation();
    }
    keys.add(event.code);
    if(event.repeat)return;
    if(event.code==='Space')doJump();
    if(event.code==='KeyV')cycleCamera();
    if(event.code==='KeyQ'){yaw=avatarFacing;pitch=.20;}
    if(event.code==='KeyR'&&sceneMode==='inside')startPortal('exit',activeExhibit);
    if(event.code==='KeyE'&&focused>=0)openArtwork(focused);
    if(event.code==='KeyF'&&darkness){flashlightOn=!flashlightOn;applyLighting();}
  },true);
  document.addEventListener('keyup',event=>keys.delete(event.code),true);
  window.addEventListener('blur',()=>keys.clear());
  document.addEventListener('pointerlockchange',()=>{
    surface.classList.toggle('gallery-3d-locked',document.pointerLockElement===renderer.domElement);
  });
  // Drag-to-orbit camera. No surprise pointer-lock, duplicated cursor delta,
  // accumulating Euler angles or accidental portal clicks after a drag.
  let mouseDrag=null,mouseDragged=false;
  renderer.domElement.addEventListener('contextmenu',event=>event.preventDefault());
  renderer.domElement.addEventListener('pointerdown',event=>{
    if(mobile||!hasEntered||paused()||portalTransition)return;
    if(event.button!==0&&event.button!==2)return;
    mouseDrag={x:event.clientX,y:event.clientY,moved:false,id:event.pointerId};
    mouseDragged=false;
  });
  document.addEventListener('pointerup',event=>{
    if(mouseDrag&&event.pointerId===mouseDrag.id){
      mouseDragged=mouseDrag.moved;
      mouseDrag=null;
    }
  });
  document.addEventListener('pointercancel',()=>{mouseDrag=null;});
  document.addEventListener('mousemove',event=>{
    if(!hasEntered||paused()||portalTransition)return;
    if(document.pointerLockElement===renderer.domElement){
      yaw-=THREE.MathUtils.clamp(event.movementX,-80,80)*.0024;
      pitch=THREE.MathUtils.clamp(pitch-event.movementY*.0019,-.12,.79);
    }else if(mouseDrag){
      const dx=THREE.MathUtils.clamp(event.clientX-mouseDrag.x,-100,100);
      const dy=THREE.MathUtils.clamp(event.clientY-mouseDrag.y,-100,100);
      if(Math.abs(dx)+Math.abs(dy)>2)mouseDrag.moved=true;
      yaw-=dx*.0030;
      pitch=THREE.MathUtils.clamp(pitch-dy*.0024,-.12,.79);
      mouseDrag.x=event.clientX;mouseDrag.y=event.clientY;
    }
    // Floating-point yaw doesn't need to grow unbounded through long sessions.
    if(Math.abs(yaw)>Math.PI*2)yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));
  });
  renderer.domElement.addEventListener('wheel',event=>{
    if(!hasEntered||paused()||portalTransition)return;
    event.preventDefault();
    cameraDistance=THREE.MathUtils.clamp(cameraDistance+Math.sign(event.deltaY)*.35,3.0,6.3);
    if(cameraToggle){
      cameraToggle.textContent=cameraDistance<3.7?'시점: 가까이'
        :cameraDistance<5?'시점: 보통':'시점: 멀리';
    }
  },{passive:false});
  renderer.domElement.addEventListener('click',event=>{
    if(!hasEntered){start();return;}
    if(mobile||mouseDragged||portalTransition){mouseDragged=false;return;}
    const bounds=renderer.domElement.getBoundingClientRect();
    pointerRay.set(((event.clientX-bounds.left)/bounds.width)*2-1,
      -((event.clientY-bounds.top)/bounds.height)*2+1);
    raycaster.setFromCamera(pointerRay,followCamera);
    if(sceneMode==='inside'&&exitPortal&&exitInReach()){
      if(raycaster.intersectObject(exitPortal,false).length){
        startPortal('exit',activeExhibit);return;
      }
    }else if(sceneMode==='hall'){
      const hit=raycaster.intersectObjects(paintings,false)[0];
      if(hit)doJump(hit.object.userData.galleryIndex);
    }
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
    yaw-=dx*.0032;pitch=THREE.MathUtils.clamp(pitch-dy*.0026,-.12,.79);
    lastLookX=event.clientX;lastLookY=event.clientY;
  });
  function lookRelease(event){
    if(event.pointerId!==lookPointer)return;
    lookPointer=null;
    if(!lookMoved){
      const rect=renderer.domElement.getBoundingClientRect();
      pointerRay.set(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1);
      raycaster.setFromCamera(pointerRay,followCamera);
      if(sceneMode==='inside' && exitInReach() && exitPortal
        && raycaster.intersectObject(exitPortal,false).length){
        startPortal('exit',activeExhibit);
      }else if(sceneMode==='hall'){
        const hit=raycaster.intersectObjects(paintings,false)[0];
        if(hit)doJump(hit.object.userData.galleryIndex);
      }
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
  // Live catalog changes update portal rooms and their linked artwork.
  // Catalog apps often issue several DOM batches in one short interval.
  // Coalesce them to avoid repeatedly building the entire 3D castle.
  let catalogRebuildTimer=0;
  new MutationObserver(()=>{
    clearTimeout(catalogRebuildTimer);
    catalogRebuildTimer=setTimeout(()=>build(),160);
  }).observe(grid,{childList:true});
  // Procedural human models are disabled until a separately-authored,
  // visually reviewed 3D asset is available. No misleading load failure UI.
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
