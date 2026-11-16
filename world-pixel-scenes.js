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
    ctx.fillStyle='#a9badc';
    ctx.fillRect(0,0,W,H);
    const plaza=load('plaza'),stone=terraceAsset('world-terrace-stone'),
      staircase=terraceAsset('world-stair-flight');
    // A single landscape spans all elevations. Parallax keeps the mountain
    // silhouettes continuous when the camera climbs a flight of stairs.
    if(plaza){
      const cropH=Math.floor(plaza.naturalHeight*.74);
      const height=H+170;
      const width=Math.ceil(height*plaza.naturalWidth/cropH);
      const offset=camera*.22;
      const y=-115+Math.min(115,Math.max(0,-cameraY*.09));
      for(let i=Math.floor(offset/width);i*width<offset+W;i++){
        ctx.save();
        ctx.translate(Math.round(i*width-offset+(i%2?width:0)),0);
        if(i%2)ctx.scale(-1,1);
        ctx.drawImage(plaza,0,0,plaza.naturalWidth,cropH,0,y,width,height);
        ctx.restore();
      }
    }
    ctx.save();
    ctx.translate(0,-cameraY);
    const levels=Array.from({length:floorCount},(_,floor)=>floor)
      .filter(floor=>groundY-floor*rise-cameraY> -60&&groundY-floor*rise-cameraY<H+300);
    const colors=['#edddab','#96bcae','#aabbe8'];
    for(const floor of levels){
      const y=groundY-floor*rise+3;
      ctx.save();
      ctx.beginPath();
      ctx.rect(-camera,y,floorWidth,floor===0?Math.max(78,H-y+cameraY):42);
      ctx.clip();
      if(stone){
        for(let x=0;x<floorWidth;x+=stone.naturalWidth)
          ctx.drawImage(stone,x-camera,y);
      }
      ctx.globalAlpha=.31;
      ctx.fillStyle=colors[floor%colors.length];
      ctx.fillRect(-camera,y,floorWidth,420);
      ctx.restore();
    }
    for(const b of buildings){
      if(!levels.includes(b.floor))continue;
      const center=b.x+b.width/2-camera;
      if(center < -340 || center > W+340)continue;
      const image=load(outside(b.style));
      if(!image)continue;
      const y=groundY-b.floor*rise+4;
      const facadeH=Math.round(Math.min(294,Math.max(190,H*.43)));
      const facadeW=Math.round(facadeH*image.naturalWidth/image.naturalHeight);
      ctx.imageSmoothingEnabled=true;
      ctx.drawImage(image,Math.round(center-facadeW/2),Math.round(y-facadeH),facadeW,facadeH);
      ctx.imageSmoothingEnabled=false;
      const lantern=load('lantern');
      if(lantern){
        const h=58,w=h*lantern.naturalWidth/lantern.naturalHeight;
        ctx.drawImage(lantern,center+Math.min(175,facadeW*.47),y-h,w,h);
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
      const labelX=Math.round((ascendingRight?x-24:x+stairSpan+24)-camera);
      const labelY=Math.round(bottom-11);
      if(labelX>-80&&labelX<W+80){
        ctx.font='700 12px system-ui';
        ctx.textAlign=ascendingRight?'right':'left';
        ctx.lineWidth=4;
        ctx.strokeStyle='#26313a';
        ctx.fillStyle='#fff3cd';
        const label=ascendingRight?(floor+2)+'층 ↗':'↖ '+(floor+2)+'층';
        ctx.strokeText(label,labelX,labelY);
        ctx.fillText(label,labelX,labelY);
      }
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
