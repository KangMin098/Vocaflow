// apps/web/src/lib/pirate-quest/data.ts
// Pirate's Bounty - 단어 풀 + GLB 매핑 + 게임 설정
//
// 학습 효과:
//   · Visual association — 영어 단어 + 시각 GLB
//   · Active recall — 한국어 뜻 보고 영어 매칭
//   · Auditory — TTS 발음
//   · Endowment effect — 보물상자에 누적

export interface PirateWord {
  /** 영어 단어 */
  en: string;
  /** 한국어 뜻 */
  ko: string;
  /** GLB 모델 경로 */
  modelUrl: string;
  /** 카테고리 (확장용) */
  category: 'weapon' | 'treasure' | 'item' | 'animal' | 'food' | 'environment';
  /** GLB 자동 스케일 보정 (모델마다 사이즈 다름) */
  scale?: number;
  /** 발음 보조 */
  pron?: string;
}

export const PIRATE_WORDS: PirateWord[] = [
  // 무기 (weapons) — 7개
  { en: 'sword',    ko: '검',         modelUrl: '/pirate/Sword.glb',         category: 'weapon',   pron: '/sɔːrd/' },
  { en: 'pistol',   ko: '권총',       modelUrl: '/pirate/Pistol.glb',        category: 'weapon',   pron: '/ˈpɪstəl/' },
  { en: 'cannon',   ko: '대포',       modelUrl: '/pirate/Cannon.glb',        category: 'weapon',   pron: '/ˈkænən/' },
  { en: 'bomb',     ko: '폭탄',       modelUrl: '/pirate/Bomb.glb',          category: 'weapon',   pron: '/bɒm/' },
  { en: 'axe',      ko: '도끼',       modelUrl: '/pirate/Axe.glb',           category: 'weapon',   pron: '/æks/' },
  { en: 'dagger',   ko: '단검',       modelUrl: '/pirate/Dagger.glb',        category: 'weapon',   pron: '/ˈdæɡər/' },
  { en: 'rifle',    ko: '소총',       modelUrl: '/pirate/Rifle.glb',         category: 'weapon',   pron: '/ˈraɪfəl/' },

  // 보물 (treasure) — 5개
  { en: 'chest',    ko: '보물상자',   modelUrl: '/pirate/Chest Gold.glb',    category: 'treasure', pron: '/tʃest/' },
  { en: 'coins',    ko: '동전',       modelUrl: '/pirate/Coins.glb',         category: 'treasure', pron: '/kɔɪnz/' },
  { en: 'gem',      ko: '보석',       modelUrl: '/pirate/Gem Blue.glb',      category: 'treasure', pron: '/dʒem/' },
  { en: 'skull',    ko: '해골',       modelUrl: '/pirate/Skull.glb',         category: 'treasure', pron: '/skʌl/' },
  { en: 'gold',     ko: '금화 가방',  modelUrl: '/pirate/Gold Bag.glb',      category: 'treasure', pron: '/ɡoʊld/' },

  // 아이템 (item) — 6개
  { en: 'anchor',   ko: '닻',         modelUrl: '/pirate/Anchor.glb',        category: 'item',     pron: '/ˈæŋkər/' },
  { en: 'barrel',   ko: '나무통',     modelUrl: '/pirate/Barrel.glb',        category: 'item',     pron: '/ˈbærəl/' },
  { en: 'bucket',   ko: '양동이',     modelUrl: '/pirate/Bucket.glb',        category: 'item',     pron: '/ˈbʌkɪt/' },
  { en: 'ship',     ko: '배',         modelUrl: '/pirate/Ship.glb',          category: 'item',     pron: '/ʃɪp/', scale: 0.5 },
  { en: 'bottle',   ko: '병',         modelUrl: '/pirate/Prop Bottle.glb',   category: 'item',     pron: '/ˈbɒtəl/' },
  { en: 'map',      ko: '지도',       modelUrl: '/pirate/Paper.glb',         category: 'item',     pron: '/mæp/' },

  // 동물 (animal) — 4개
  { en: 'shark',    ko: '상어',       modelUrl: '/pirate/Shark.glb',         category: 'animal',   pron: '/ʃɑːrk/' },
  { en: 'fish',     ko: '물고기',     modelUrl: '/pirate/Fish Mackerel.glb', category: 'animal',   pron: '/fɪʃ/' },
  { en: 'bird',     ko: '새',         modelUrl: '/pirate/Bird.glb',          category: 'animal',   pron: '/bɜːrd/' },
  { en: 'tentacle', ko: '촉수',       modelUrl: '/pirate/Tentacle.glb',      category: 'animal',   pron: '/ˈtentəkl/', scale: 0.5 },

  // 음식 (food) — 1개
  { en: 'chicken',  ko: '닭다리',     modelUrl: '/pirate/Chicken Leg.glb',   category: 'food',     pron: '/ˈtʃɪkɪn/' },

  // 환경 (environment) — 6개
  { en: 'tree',     ko: '나무',       modelUrl: '/pirate/Palm Tree.glb',     category: 'environment', pron: '/triː/', scale: 0.6 },
  { en: 'rock',     ko: '바위',       modelUrl: '/pirate/Rock.glb',          category: 'environment', pron: '/rɒk/' },
  { en: 'bone',     ko: '뼈',         modelUrl: '/pirate/Large Bone.glb',    category: 'environment', pron: '/boʊn/' },
  { en: 'wood',     ko: '목재',       modelUrl: '/pirate/Wood.glb',          category: 'environment', pron: '/wʊd/' },
  { en: 'dock',     ko: '부두',       modelUrl: '/pirate/Dock.glb',          category: 'environment', pron: '/dɒk/', scale: 0.6 },
  { en: 'house',    ko: '집',         modelUrl: '/pirate/House.glb',         category: 'environment', pron: '/haʊs/', scale: 0.7 },
];

/** 진행자 캐릭터 (랜덤 선택) */
export const PIRATE_CHARACTERS = [
  { name: 'captain', modelUrl: '/pirate/Pirate Captain.glb' },
  { name: 'anne',    modelUrl: '/pirate/Anne.glb' },
  { name: 'henry',   modelUrl: '/pirate/Henry.glb' },
];

/**
 * 카테고리 색상 — 라벨 컬러 코딩 (학습 시 분류 인지 강화 / Schema theory)
 * weapon=빨강 / treasure=골드 / item=갈색 / animal=시안 / food=주황 / environment=초록
 */
export const CATEGORY_COLORS: Record<
  PirateWord['category'],
  { bg: string; border: string; text: string }
> = {
  weapon:      { bg: 'linear-gradient(180deg, #FFE2DA 0%, #FFB8A0 100%)', border: '#9B2C2C', text: '#5C1A14' },
  treasure:    { bg: 'linear-gradient(180deg, #FFF1B8 0%, #FFD93D 100%)', border: '#92670A', text: '#4A3505' },
  item:        { bg: 'linear-gradient(180deg, #F5E6D3 0%, #DFA76A 100%)', border: '#5C3A1F', text: '#2A1810' },
  animal:      { bg: 'linear-gradient(180deg, #D6F5FA 0%, #67E8F9 100%)', border: '#0E7490', text: '#082F49' },
  food:        { bg: 'linear-gradient(180deg, #FFE4C8 0%, #FF9A4A 100%)', border: '#9A3F0E', text: '#5C2308' },
  environment: { bg: 'linear-gradient(180deg, #D4F5DD 0%, #6FD08C 100%)', border: '#1F6E36', text: '#0F3D1C' },
};

export const POINTS = {
  CORRECT: 100,
  WRONG: -20,
  STREAK_BONUS: 25,         // 2 streak 이상마다 보너스
  TIME_BONUS: 50,            // 5초 이내 정답 (창의적: 빠른 회상 보상)
  TIME_BONUS_THRESHOLD_MS: 5000,
  HINT_PENALTY: -15,         // 힌트 사용 시 차감
  COMBO_5_BONUS: 100,        // 5 streak 도달 시 한 번 보너스
  COMBO_10_BONUS: 250,       // 10 streak 도달 시 한 번 보너스 (전체 정복)
} as const;

export const GAME_CONFIG = {
  TOTAL_ROUNDS: 10,
  CHOICES_PER_ROUND: 4,        // 단어 카드에 4개 영단어 (정답 1 + 오답 3)
  ROUND_TIME_LIMIT_MS: 0,      // 0 = 시간 무제한
} as const;

/**
 * 17개 단어 GLB 슬롯 — 캐릭터들 사이/주변에 분산 (z 범위 -1.5 ~ 2.5)
 * 캐릭터들은 z=3.5~4.0 (전경), 단어 GLB는 그 뒤·옆.
 */
export const ITEM_SLOTS: ReadonlyArray<{ x: number; z: number }> = [
  // 앞줄 (캐릭터 좌·우 옆) - Z = 1.7 ~ 2.0
  { x: -7.0,  z: 1.7 },
  { x: -5.0,  z: 1.9 },
  { x: -3.0,  z: 2.0 },
  { x:  3.0,  z: 2.0 },
  { x:  5.0,  z: 1.9 },
  { x:  7.0,  z: 1.7 },
  // 중간줄 (캐릭터 사이 뒤) - Z = 0.7 ~ 1.0
  { x: -6.0,  z: 0.7 },
  { x: -4.0,  z: 0.9 },
  { x: -1.5,  z: 1.0 },
  { x:  1.5,  z: 1.0 },
  { x:  4.0,  z: 0.9 },
  { x:  6.0,  z: 0.7 },
  // 측면 - Z = -0.3 ~ 0.3
  { x: -7.5,  z: 0.0 },
  { x: -3.0,  z: -0.2 },
  { x:  0,    z: -0.3 },
  { x:  3.0,  z: -0.2 },
  { x:  7.5,  z: 0.0 },
  // 뒷줄 (배 앞) - Z = -1.5 ~ -2.0
  { x: -5.0,  z: -1.3 },
  { x: -2.5,  z: -1.8 },
  { x:  0,    z: -2.0 },
  { x:  2.5,  z: -1.8 },
  { x:  5.0,  z: -1.3 },
  // 더 뒷줄 (배 측면) - Z = -2.5 ~ -3.0
  { x: -3.5,  z: -2.5 },
  { x:  0,    z: -3.0 },
  { x:  3.5,  z: -2.5 },
];
