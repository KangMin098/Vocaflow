// apps/web/src/lib/wordblitz/data.ts
// WordBlitz 게임 데이터 - 단어, 인형 타입, 점수
//
// v4 변경:
//   - PLUSHIE_TYPES 9개 → 8개 (지그재그 두 줄 7개 + 예비 1개)
//   - 사용자 다운로드 파일명 정확 매칭

export interface Word {
  en: string;
  ko: string;
  pron?: string;
}

export interface PlushieType {
  name: string;
  /** Hex color for THREE.js (폴백용) */
  color: number;
  label: string;
  /**
   * GLB 모델 경로.
   * 사용자 다운로드 파일명 그대로 (Next.js public 절대 경로).
   * Next.js가 자동 URL encoding 처리.
   */
  modelUrl?: string;
}

/** 임시 단어 데이터 (추후 SRS 큐에서 fetch) */
export const SAMPLE_WORDS: Word[] = [
  { en: 'advantages',    ko: '유리한 점, 이점',  pron: '/ədˈvæntɪdʒɪz/' },
  { en: 'criticizing',   ko: '비판하는',         pron: '/ˈkrɪtɪˌsaɪzɪŋ/' },
  { en: 'reserved',      ko: '내성적인',         pron: '/rɪˈzɜːrvd/' },
  { en: 'communicative', ko: '의사 소통의',      pron: '/kəˈmjuːnɪkətɪv/' },
  { en: 'inclined',      ko: '경향이 있는',      pron: '/ɪnˈklaɪnd/' },
  { en: 'consequence',   ko: '결과, 영향',       pron: '/ˈkɑːnsɪkwens/' },
  { en: 'judgments',     ko: '판단, 평가',       pron: '/ˈdʒʌdʒmənts/' },
  { en: 'unmistakable',  ko: '틀림없는',         pron: '/ˌʌnmɪˈsteɪkəbəl/' },
];

/**
 * 인형 타입 - 사용자 다운로드 파일명 매핑.
 *
 * 캡처된 파일명:
 *   Bear · Carrot Character · Cool Bannana Guy · Dog · Easter rabbit ·
 *   Frog Hat · Kitten · Panda · Unicorn
 */
export const PLUSHIE_TYPES: PlushieType[] = [
  {
    name: 'bear',
    color: 0xD4A574,
    label: '곰',
    modelUrl: '/wordblitz/plushies/Bear.glb',
  },
  {
    name: 'kitten',
    color: 0xFFB6C1,
    label: '고양이',
    modelUrl: '/wordblitz/plushies/Kitten.glb',
  },
  {
    name: 'rabbit',
    color: 0xFFE4E1,
    label: '토끼',
    modelUrl: '/wordblitz/plushies/Easter rabbit.glb',
  },
  {
    name: 'dog',
    color: 0xF4A460,
    label: '강아지',
    modelUrl: '/wordblitz/plushies/Dog.glb',
  },
  {
    name: 'panda',
    color: 0xFFFFFF,
    label: '판다',
    modelUrl: '/wordblitz/plushies/Panda.glb',
  },
  {
    name: 'frog',
    color: 0x90EE90,
    label: '개구리',
    modelUrl: '/wordblitz/plushies/Frog Hat.glb',
  },
  {
    name: 'unicorn',
    color: 0xDDA0DD,
    label: '유니콘',
    modelUrl: '/wordblitz/plushies/Unicorn.glb',
  },
  {
    name: 'carrot',
    color: 0xFF8C42,
    label: '당근',
    modelUrl: '/wordblitz/plushies/Carrot Character.glb',
  },
  {
    name: 'banana',
    color: 0xFFD93D,
    label: '바나나',
    modelUrl: '/wordblitz/plushies/Cool Bannana Guy.glb',
  },
];

/** 정답 인형 발광 색상 (황금) */
export const TARGET_GLOW_COLOR = 0xFFD93D;

/** 게임 전용 점수 */
export const POINTS = {
  CORRECT: 120,
  WRONG: 30,
} as const;

/** 집게 GLB */
export const CLAW_MODEL_URL = '/wordblitz/FBX_Claw_Rigged_Type-2_new-21.glb';

/**
 * 인형 배치 좌표 (지그재그 무더기).
 * 7개 슬롯 - 앞줄 4개, 뒷줄 3개.
 * 인형뽑기 기계 안쪽 영역 기준.
 */
export const PLUSHIE_POSITIONS: ReadonlyArray<{ x: number; z: number }> = [
  // 앞줄 (Z = 0.7) - 카메라 가까이
  { x: -2.4, z: 0.7 },
  { x: -0.8, z: 0.7 },
  { x: 0.8,  z: 0.7 },
  { x: 2.4,  z: 0.7 },
  // 뒷줄 (Z = -0.5) - 지그재그
  { x: -1.6, z: -0.5 },
  { x: 0,    z: -0.5 },
  { x: 1.6,  z: -0.5 },
];
