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
      image.src='assets/world-pixel/'+name+'.png?v=mountain-terraces-v1';
      terraceImages.set(name,image);
    }
    const image=terraceImages.get(name);
    return image.complete&&image.naturalWidth?image:null;
  }

  function drawStone(ctx,stone,x,y,width,height){
    ctx.save();
    ctx.beginPath();
    ctx.rect(x,y,width,height);
    ctx.clip();
    ctx.fillStyle='#71686a';
    ctx.fillRect(x,y,width,height);
    if(stone){
      for(let dy=0;dy<height;dy+=stone.naturalHeight){
        for(let dx=0;dx<width;dx+=stone.naturalWidth)
          ctx.drawImage(stone,x+dx,y+dy);
      }
    }
    ctx.restore();
  }

  function drawStair(ctx,stone,span,rise){
    const count=26,stepX=span/count,stepY=rise/count;
    // Stone stair flight with an open space beneath the stone stringer.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0,3);
    for(let i=0;i<count;i++){
      ctx.lineTo((i+1)*stepX,3-i*stepY);
      ctx.lineTo((i+1)*stepX,3-(i+1)*stepY);
    }
    ctx.lineTo(span,-rise+53);
    ctx.lineTo(0,53);
    ctx.closePath();
    ctx.clip();
    drawStone(ctx,stone,0,-rise,span,rise+54);
    ctx.restore();
    for(let i=0;i<count;i++){
      const x=Math.round(i*stepX),y=Math.round(-i*stepY+3);
      ctx.fillStyle='#d6e3e5';
      ctx.fillRect(x,y,Math.ceil(stepX),3);
      ctx.fillStyle='#97a8b4';
      ctx.fillRect(x,y+3,Math.ceil(stepX),2);
    }
    const post=(x,y)=>{
      ctx.fillStyle='#49373d';ctx.fillRect(x-2,y-36,6,38);
      ctx.fillStyle='#a48061';ctx.fillRect(x-1,y-34,2,34);
      ctx.fillStyle='#e5e9ec';ctx.fillRect(x-3,y-37,8,3);
    };
    for(let n=0;n<count;n+=4)post(Math.round(n*stepX),Math.round(-n*stepY));
    post(span,-rise);
    ctx.beginPath();
    ctx.moveTo(0,-35);ctx.lineTo(span,-rise-35);
    ctx.strokeStyle='#49373d';ctx.lineWidth=6;ctx.stroke();
    ctx.strokeStyle='#c2a186';ctx.lineWidth=2;ctx.stroke();
  }

  // A narrow zig-zag village stacked upwards. Existing high-quality
  // facade paintings are reused: they are NOT replaced by box buildings.
  function drawTerraces(ctx,{W,H,groundY,camera,cameraY,buildings,
      floorCount,floorWidth,rise,stairSpan,elevation,summitEnd}) {
    ctx.fillStyle='#a9badc';
    ctx.fillRect(0,0,W,H);
    const plaza=load('plaza'),stone=terraceAsset('world-terrace-stone'),
      bank=terraceAsset('world-snow-bank');
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
    const bankTop=groundY-(floorCount-1)*rise-240;
    const bankHeight=Math.max(650,groundY+175-bankTop);
    // One continuous cliff on each flank. Each side samples a different
    // part of the painting and spans the whole elevation range.
    for(const side of [1,-1]){
      const edge=side===1?0:floorWidth;
      const extra=Math.max(92,W-floorWidth);
      ctx.save();
      ctx.translate(edge-camera,bankTop);
      ctx.scale(side,1);
      if(bank){
        const iw=bank.naturalWidth,ih=bank.naturalHeight;
        const crop=side===1?0:Math.round(ih*.14);
        const width=side===1?264:244;
        ctx.drawImage(bank,4,Math.round(ih*.26),Math.round(iw*.18),Math.round(ih*.60),
          -extra-3,0,extra+41,bankHeight);
        ctx.drawImage(bank,0,crop,iw,ih-crop,
          -Math.round(width*(side===1?.38:.47)),0,width,bankHeight);
      }else drawStone(ctx,stone,-extra,0,extra+50,bankHeight);
      ctx.restore();
    }
    const topFloor=floorCount-1;
    const summitPlaza=floorCount>1&&buildings.filter(b=>b.floor===topFloor).length===1;
    for(const floor of levels){
      const y=groundY-floor*rise+2;
      let left=Math.min(-camera,0),width=Math.max(W-left,floorWidth);
      const isSummit=summitPlaza&&floor===topFloor;
      const rightward=floor%2===0;
      if(isSummit){
        const end=summitEnd+(rightward?66:-66)-camera;
        if(rightward)width=end-left;
        else {width+=left-end;left=end;}
      }
      const depth=floor===0?Math.max(90,H-y+cameraY):48;
      drawStone(ctx,stone,left,y,width,depth);
      ctx.save();
      ctx.globalAlpha=.24;
      ctx.fillStyle=colors[floor%colors.length];
      ctx.fillRect(left,y,width,depth);
      ctx.restore();
      ctx.fillStyle='#dfeaf1';
      ctx.fillRect(left,y,width,3);
      if(isSummit){
        const lookout=terraceAsset('world-summit-overlook');
        if(lookout){
          const artW=444,artH=Math.round(artW*lookout.naturalHeight/lookout.naturalWidth);
          ctx.save();
          ctx.translate(summitEnd-camera+(rightward?66:-66),y+10);
          if(!rightward)ctx.scale(-1,1);
          ctx.drawImage(lookout,-artW,-artH,artW,artH);
          ctx.restore();
        }
      }
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
      const distanceAbove=b.floor*rise-elevation;
      ctx.save();
      ctx.globalAlpha=1-Math.min(.66,Math.max(0,(distanceAbove-35)/430));
      ctx.imageSmoothingEnabled=true;
      ctx.drawImage(image,Math.round(center-facadeW/2),Math.round(y-facadeH),facadeW,facadeH);
      ctx.imageSmoothingEnabled=false;
      const lantern=load('lantern');
      if(lantern){
        const h=58,w=h*lantern.naturalWidth/lantern.naturalHeight;
        ctx.drawImage(lantern,center+Math.min(175,facadeW*.47),y-h,w,h);
      }
      ctx.restore();
    }
    // Mirror the same grade on alternate floors to match the route.
    for(let floor=0;floor<floorCount-1;floor++){
      const bottom=groundY-floor*rise;
      if(bottom-cameraY< -110||bottom-cameraY>H+rise+125)continue;
      const ascendingRight=floor%2===0;
      const x=ascendingRight?floorWidth-80-stairSpan:80;
      ctx.save();
      ctx.translate(Math.round(x-camera+(ascendingRight?0:stairSpan)),Math.round(bottom));
      if(!ascendingRight)ctx.scale(-1,1);
      drawStair(ctx,stone,stairSpan,rise);
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
