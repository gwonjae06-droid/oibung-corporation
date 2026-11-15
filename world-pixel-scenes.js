/* Authored pixel-art backgrounds and character frames for the world canvas. */
(() => {
  'use strict';
  const directory = 'assets/world-pixel/';
  const themes = ['castle', 'arena', 'duel', 'tactics', 'cat', 'studio', 'tower'];
  const images = new Map();
  const faded = new WeakMap();
  const load = key => {
    if (!images.has(key)) {
      const image = new Image();
      image.decoding = 'async';
      image.src = directory + key + '.webp';
      images.set(key, image);
    }
    const image = images.get(key);
    return image.complete && image.naturalWidth ? image : null;
  };
  const theme = style => themes.includes(style) ? style : 'studio';
  const outside = style => 'outside-' + theme(style);
  const inside = style => 'inside-' + theme(style);

  function blend(image, left, right) {
    let versions = faded.get(image);
    if (!versions) faded.set(image, versions = new Map());
    const key = `${left}:${right}`;
    if (!versions.has(key)) {
      const layer = document.createElement('canvas');
      layer.width = image.naturalWidth;
      layer.height = image.naturalHeight;
      const ctx = layer.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const mask = ctx.createLinearGradient(0, 0, layer.width, 0);
      mask.addColorStop(0, left ? 'transparent' : '#fff');
      mask.addColorStop(.15, '#fff');
      mask.addColorStop(.85, '#fff');
      mask.addColorStop(1, right ? 'transparent' : '#fff');
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = mask;
      ctx.fillRect(0, 0, layer.width, layer.height);
      versions.set(key, layer);
    }
    return versions.get(key);
  }

  function sceneY(key, groundY, H) {
    const floor = key.startsWith('inside-') ? .897 : .906;
    const height = Math.ceil(Math.max(groundY / floor, (H - groundY) / (1 - floor)));
    return [Math.round(groundY - height * floor), height];
  }

  function drawOutdoor(ctx, {W, H, groundY, camera, buildings, districts}) {
    const base = load('plaza');
    ctx.fillStyle = '#273d4c';
    ctx.fillRect(0, 0, W, H);
    if (base) {
      const width = Math.max(980, Math.ceil(H * 1.9));
      const [y, height] = sceneY('plaza', groundY, H);
      for (let i = Math.floor(camera / width); i * width < camera + W; i++) {
        const x = Math.round(i * width - camera);
        ctx.save();
        ctx.translate(x + (i % 2 ? width : 0), 0);
        if (i % 2) ctx.scale(-1, 1);
        ctx.drawImage(base, 0, y, width, height);
        ctx.restore();
      }
    }
    for (const district of districts.slice(1)) {
      const width = 950;
      const x = Math.round(district.start - width / 2 - camera);
      if (x > W || x + width < 0) continue;
      const garden = load('garden');
      if (!garden) continue;
      const [y, height] = sceneY('garden', groundY, H);
      ctx.drawImage(blend(garden, true, true), x, y, width, height);
    }
    for (const b of buildings) {
      const width = Math.min(b.width, Math.max(760, Math.round(H * 1.95)));
      const x = Math.round(b.x + (b.width - width) / 2 - camera);
      if (x > W || x + width < 0) continue;
      const key = outside(b.style);
      const image = load(key);
      if (!image) continue;
      const [y, height] = sceneY(key, groundY, H);
      ctx.drawImage(blend(image, true, true), x, y, width, height);
    }
  }

  function drawIndoor(ctx, {W, H, groundY, camera}, style, roomWidth) {
    const key = inside(style);
    const image = load(key);
    ctx.fillStyle = '#263036';
    ctx.fillRect(0, 0, W, H);
    if (!image) return;
    const [y, height] = sceneY(key, groundY, H);
    const extent = Math.max(W, roomWidth);
    const width = Math.min(extent, Math.max(1050, Math.round(height * 2.05)));
    for (let i = Math.floor(camera / width); i * width < camera + W; i++) {
      const x = Math.round(i * width - camera);
      ctx.save();
      ctx.translate(x + (i % 2 ? width : 0), 0);
      if (i % 2) ctx.scale(-1, 1);
      ctx.drawImage(image, 0, y, width, height);
      ctx.restore();
    }
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
    roomArt: style => directory + inside(style) + '.webp',
    ready: style => !!(load('plaza') && load('player-0') && load(outside(style)))
  };
})();
