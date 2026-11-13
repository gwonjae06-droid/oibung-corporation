/*
 * OIBUNG GALLERY — one permanent museum, individual artwork worlds.
 * No site-wide timer, random rotation, or visitor theme selection.
 */
(() => {
  'use strict';
  const rooms = Object.freeze({
    stone: { label: '미술관', color: '#c6c0b8' },
    wood: { label: '나무 전시관', color: '#4a3527' },
    space: { label: '우주 전시관', color: '#090f23' },
    temple: { label: '신전 전시관', color: '#bca982' },
    deepsea: { label: '심해 전시관', color: '#041c28' }
  });
  const has = key => Object.prototype.hasOwnProperty.call(rooms, key);
  const namedRooms = Object.freeze({
    odenring: 'temple',
    'oibung-arena': 'space',
    ochams: 'space',
    'campus-frontier': 'wood'
  });
  const rules = [
    ['deepsea', /심해|바다|해양|해저|잠수|수중|해일|ocean|underwater|submarine|deep.?sea|aquatic|abyss/],
    ['space', /우주|행성|은하|별자리|천체|미래|로봇|외계|sf|sci.?fi|space|galaxy|cosmos|planet|robot|laser|핀볼|아레나/],
    ['temple', /신전|유적|고대|신화|기사|검술|소울|마법|마왕|용사|던전|판타지|보스|temple|myth|knight|fantasy|dungeon|soul|boss/],
    ['wood', /나무|숲|자연|초원|농장|캠퍼스|학교|대학|정원|목재|생존|forest|wood|nature|farm|campus|garden|survival/]
  ];
  function themeFor(game) {
    if (!game) return 'stone';
    if (has(game.exhibitTheme)) return game.exhibitTheme;
    if (Object.prototype.hasOwnProperty.call(namedRooms, game.id)) return namedRooms[game.id];
    const description = [game.title, game.english, game.genre, game.tagline,
      ...(Array.isArray(game.tags) ? game.tags : []), game.description]
      .filter(Boolean).join(' ').toLocaleLowerCase('ko-KR');
    for (const [name, match] of rules) if (match.test(description)) return name;
    const tone = { navy: 'space', forest: 'wood', umber: 'wood', burgundy: 'temple', plum: 'temple' };
    return tone[game.introTone] || 'stone';
  }
  window.OIBUNG_EXHIBITION = Object.freeze({
    themeFor,
    labelFor: theme => has(theme) ? rooms[theme].label : rooms.stone.label,
    colorFor: theme => has(theme) ? rooms[theme].color : rooms.stone.color
  });
  document.documentElement.dataset.galleryTheme = 'stone';
})();
