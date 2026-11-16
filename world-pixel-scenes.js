/* Authored pixel-art backgrounds and character frames for the world canvas. */
(() => {
  'use strict';
  const pixelDirectory = 'assets/world-pixel/';
  const snowDirectory = 'assets/world-snow/';
  const themes = ['castle', 'arena', 'duel', 'tactics', 'cat', 'studio', 'tower', 'corp'];
  const roomFloor = {castle:.826,arena:.885,duel:.858,tactics:.858,cat:.854,studio:.855,tower:.828,corp:.892};
  const images = new Map();
  const artPath = key => (key.startsWith('player-') ? pixelDirectory : snowDirectory) + key + '.webp';
  const load = key => {
    if (!images.has(key)) {
      const image = new Image();
      image.decoding = 'async';
      image.src = artPath(key);
      images.set(key, image);
    }
    const image = images.get(key);
    return image.complete && image.naturalWidth ? image : null;
  };
  const theme = style => themes.includes(style) ? style : 'studio';
  const sceneName = style => style === 'castle' ? 'dungeon' : theme(style);
  const outside = style => 'outside-' + sceneName(style);
  const inside = style => 'inside-' + sceneName(style);

  function sceneY(floor, groundY, H) {
    const height = Math.ceil(Math.max(groundY / floor, (H - groundY) / (1 - floor)));
    return [Math.round(groundY - height * floor), height];
  }

  function drawStrip(ctx, image, W, camera, width, height, y) {
    for (let i = Math.floor(camera / width); i * width < camera + W; i++) {
      const x = Math.round(i * width - camera);
      ctx.save();
      ctx.translate(x + (i % 2 ? width : 0), 0);
      if (i % 2) ctx.scale(-1, 1);
      ctx.drawImage(image, 0, y, width, height);
      ctx.restore();
    }
  }

  function drawOutdoor(ctx, {W, H, groundY, camera, buildings, districts}) {
    const base = load('plaza');
    ctx.fillStyle = '#b9b9f0';
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    if (base) {
      const [y, height] = sceneY(.858, groundY, H);
      const width = Math.round(height * base.naturalWidth / base.naturalHeight);
      drawStrip(ctx, base, W, camera, width, height, y);
    }
    const drawProp = (key, center, height) => {
      const x = Math.round(center - camera);
      if (x < -height || x > W + height) return 0;
      const image = load(key);
      if (!image) return 0;
      const width = Math.round(height * image.naturalWidth / image.naturalHeight);
      ctx.drawImage(image, x - Math.round(width / 2), groundY + 4 - height, width, height);
      return width;
    };
    const buildingHeight = Math.round(Math.min(570, Math.max(172, H * .52)));
    for (const building of buildings) {
      const center = building.x + building.width / 2;
      const height = building.style === 'corp' ? Math.round(groundY * .94) : buildingHeight;
      const facadeWidth = drawProp(outside(building.style), center, height);
      drawProp('lantern', center + Math.max(280, facadeWidth / 2 + 88), Math.round(buildingHeight * .34));
    }
    for (const district of districts.slice(1)) {
      drawProp('lantern', district.start, Math.round(buildingHeight * .43));
    }
    ctx.imageSmoothingEnabled = false;
  }

  const terraceImages = new Map();
  function terraceAsset(name){
    if(!terraceImages.has(name)){
      const image=new Image();
      image.decoding='async';
      image.src='assets/world-pixel/'+name+'.png?v=terraced-town-v1';
      terraceImages.set(name,image);
    }
    const image=terraceImages.get(name);
    return image.complete&&image.naturalWidth?image:null;
  }

  // A narrow zig-zag village stacked upwards. Existing high-quality
  // facade paintings are reused: they are NOT replaced by box buildings.
  function drawTerraces(ctx,{W,H,groundY,camera,cameraY,buildings,
      floorCount,floorWidth,rise,stairSpan}) {
    const sky=ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#7b9db7');
    sky.addColorStop(.55,'#b3c9cf');
    sky.addColorStop(1,'#e7d7b9');
    ctx.fillStyle=sky;
    ctx.fillRect(0,0,W,H);
    const plaza=load('plaza'),stone=terraceAsset('world-terrace-stone'),
      staircase=terraceAsset('world-stair-flight');
    ctx.save();
    ctx.translate(0,-Math.round(cameraY));
    for(let floor=0;floor<floorCount;floor++){
      const y=groundY-floor*rise;
      if(y-cameraY< -370 || y-cameraY>H+340)continue;
      // The already painted plaza provides detailed masonry and lighting
      // around each terrace; only its lower environment region is sampled.
      if(plaza){
        const cropTop=Math.floor(plaza.naturalHeight*.41);
        const cropH=plaza.naturalHeight-cropTop;
        const tileWidth=650;
        for(let x=-Math.ceil(650+camera%650);x<W+650;x+=tileWidth){
          ctx.drawImage(plaza,0,cropTop,plaza.naturalWidth,cropH,
            Math.round(x),y-215,tileWidth,248);
        }
      }
      // Animated characters stand on the floor's paved pixel-art terrace.
      const pathY=Math.round(y+4);
      if(stone){
        const tileW=stone.naturalWidth,tileH=stone.naturalHeight;
        for(let x=0;x<floorWidth;x+=tileW){
          const w=Math.min(tileW,floorWidth-x);
          ctx.drawImage(stone,0,0,w,tileH,
            Math.round(x-camera),pathY,w,tileH);
        }
      }else{
        ctx.fillStyle='#7a7779';
        ctx.fillRect(-camera,pathY,floorWidth,76);
      }
      // Preserving each building's original artwork, scale and pixel detail.
      for(const b of buildings){
        if(b.floor!==floor)continue;
        const center=b.x-camera;
        if(center < -400 || center > W+400)continue;
        const image=load(outside(b.style));
        if(!image)continue;
        const facadeH=Math.round(Math.min(264,Math.max(182,H*.46)));
        const facadeW=Math.round(facadeH*image.naturalWidth/image.naturalHeight);
        ctx.imageSmoothingEnabled=true;
        ctx.drawImage(image,Math.round(center-facadeW/2),
          Math.round(y+4-facadeH),facadeW,facadeH);
        ctx.imageSmoothingEnabled=false;
      }
    }
    // Each ascent is a painted pixel-art stairway aligned to the actual
    // continuous movement path. Mirror the same sheet on alternate floors.
    for(let floor=0;floor<floorCount-1;floor++){
      const bottom=groundY-floor*rise;
      if(bottom-cameraY< -110||bottom-cameraY>H+rise+125)continue;
      const ascendingRight=floor%2===0;
      const x=ascendingRight?floorWidth-80-stairSpan:80;
      ctx.save();
      if(!ascendingRight){
        ctx.translate(Math.round(x-camera+stairSpan),0);
        ctx.scale(-1,1);
        if(staircase)ctx.drawImage(staircase,0,Math.round(bottom-rise),
          stairSpan,rise);
      }else if(staircase)ctx.drawImage(staircase,Math.round(x-camera),
          Math.round(bottom-rise),stairSpan,rise);
      ctx.restore();
    }
    ctx.restore();
    ctx.imageSmoothingEnabled=false;
  }

  function drawIndoor(ctx, {W, H, groundY, camera}, style, roomWidth) {
    const image = load(inside(style));
    ctx.fillStyle = '#376067';
    ctx.fillRect(0, 0, W, H);
    if (!image) return;
    const [y, height] = sceneY(roomFloor[style] || .88, groundY, H);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(image, -Math.round(camera), y, Math.max(W, roomWidth), height);
    ctx.imageSmoothingEnabled = false;
  }

  function drawPlayer(ctx, {x, groundY, camera, direction, moving, airborne, yOffset, elapsed, height}) {
    const frame = airborne ? 6 : moving ? 1 + Math.floor(elapsed * 9) % 5 : 0;
    const image = load('player-' + frame);
    if (!image) return;
    const width = Math.round(height * image.naturalWidth / image.naturalHeight);
    ctx.save();
    ctx.translate(Math.round(x - camera), Math.round(groundY + yOffset));
    ctx.scale(direction, 1);
    ctx.drawImage(image, -Math.round(width / 2), 1 - height, width, height);
    ctx.restore();
  }

  load('plaza');
  for (let i = 0; i <= 6; i++) load('player-' + i);
  window.OIBUNG_PIXEL_SCENES = {
    drawOutdoor, drawTerraces, drawIndoor, drawPlayer,
    preload: style => { load(outside(style)); load(inside(style)); },
    roomArt: style => artPath(inside(style)),
    ready: style => !!(load('plaza') && load('player-0') && load(outside(style)))
  };
})();
