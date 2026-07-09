// apps/web/src/lib/wordblitz/data.ts
// WordBlitz 데이터 — 단어 타입, 샘플 풀, 점수.
// (3D 인형뽑기 시절의 plushie/claw 좌표는 2D 재설계로 제거됨 — v07.)

export interface Word {
  en: string;
  ko: string;
  pron?: string;
}

/** 임시 단어 데이터 (스코프 미지정 시 기본 풀 · 추후 SRS 큐에서 fetch) */
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

/** 세션 점수 적재용 고정 점수(scores 테이블 · page.tsx recordGameScore) */
export const POINTS = {
  CORRECT: 120,
  WRONG: 30,
} as const;
