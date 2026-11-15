/* Authored pixel-art backgrounds and character frames for the world canvas. */
(() => {
  'use strict';
  const pixelDirectory = 'assets/world-pixel/';
  const snowDirectory = 'assets/world-snow/';
  const themes = ['castle', 'arena', 'duel', 'tactics', 'cat', 'studio', 'tower', 'corp'];
  const roomFloor = {castle:.885,arena:.885,duel:.858,tactics:.858,cat:.854,studio:.855,tower:.828,corp:.892};
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
  const outside = style => 'outside-' + theme(style);
  const inside = style => 'inside-' + theme(style);

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
    drawOutdoor, drawIndoor, drawPlayer,
    preload: style => { load(outside(style)); load(inside(style)); },
    roomArt: style => artPath(inside(style)),
    ready: style => !!(load('plaza') && load('player-0') && load(outside(style)))
  };
})();
