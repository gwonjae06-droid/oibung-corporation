/**
 * 오이붕 코퍼레이션 게임 데이터 — 새 게임은 아래 배열에 객체를 복사해서 추가하면 됩니다.
 * id: 중복되지 않는 영문 ID
 * category: action | strategy | other (장르 필터)
 * visual: eclipse | arena | duel | tactics | custom (카드 그래픽 스타일)
 * playUrl: 실제 브라우저 플레이 링크 (https://)
 * sourceUrl: GitHub 저장소 링크 (선택)
 */
window.OIBUNG_GAMES = [
  {
    id: 'odenring',
    exhibitTheme: 'temple',
    title: '오든링',
    english: 'ODEN RING',
    tagline: '끝까지 살아남을 수 있겠어?',
    description: '개성 강한 보스와 맞서는 3D 소울라이크 보스 러시. 회피하고, 공략하고, 너만의 여정을 완성해 봐.',
    category: 'action',
    genre: '3D 액션 · 보스 러시',
    tags: ['3D', '보스전', '어려움'],
    visual: 'eclipse',
    badge: 'FEATURED',
    playUrl: 'https://gwonjae06-droid.github.io/oibung-elden-ring/',
    sourceUrl: 'https://github.com/gwonjae06-droid/oibung-elden-ring'
  },
  {
    id: 'oibung-arena',
    exhibitTheme: 'space',
    title: '오이붕 아레나',
    english: 'OIBUNG ARENA',
    tagline: '공 하나로 시작되는 난장판.',
    description: '튕기고 부딪히는 핀볼 물리 기반 자동 배틀. 독특한 스킬과 예측 불가능한 충돌이 만들어 내는 한 판!',
    category: 'action',
    genre: '핀볼 · 자동 전투',
    tags: ['핀볼', '자동 전투', '스킬'],
    visual: 'arena',
    badge: 'CHAOS MODE',
    playUrl: 'https://gwonjae06-droid.github.io/oibung-ballfight-base/',
    sourceUrl: 'https://github.com/gwonjae06-droid/oibung-ballfight-base'
  },
  {
    id: 'ochams',
    exhibitTheme: 'space',
    title: '오이챔스 3D 배틀',
    english: 'OCHAMS 3D',
    tagline: '한 턴에 승부가 갈린다.',
    description: '풀스크린 3D 턴제 대전. 화려한 전투 연출과 캐릭터 애니메이션을 즐기는 배틀 프로토타입.',
    category: 'strategy',
    genre: '3D · 턴제 배틀',
    tags: ['3D', '턴제', '대전'],
    visual: 'duel',
    badge: 'BATTLE LAB',
    playUrl: 'https://gwonjae06-droid.github.io/ochams-3d-battle/',
    sourceUrl: 'https://github.com/gwonjae06-droid/ochams-3d-battle'
  },
  {
    id: 'campus-frontier',
    exhibitTheme: 'wood',
    title: '대학전선',
    english: 'CAMPUS FRONTIER',
    tagline: '캠퍼스를 지배할 시간.',
    description: '대학을 선택하고 부대를 지휘하는 3D 순차 턴 전략게임. 거점을 차지하고, 자원을 모으고, 전장을 지배하라.',
    category: 'strategy',
    genre: '3D · 전략 시뮬레이션',
    tags: ['전략', '턴제', '캠퍼스'],
    visual: 'tactics',
    badge: 'STRATEGY',
    playUrl: 'https://gwonjae06-droid.github.io/campus-frontier/',
    sourceUrl: 'https://github.com/gwonjae06-droid/campus-frontier'
  }
];
