// apps/web/src/lib/dictation/hint.ts
// 단계적 힌트 시스템 (Scaffolding)
// 점수 차감으로 남용 방지 (Token economy)

export type HintLevel = 1 | 2 | 3 | 4;

export interface HintStage {
  level: HintLevel;
  name: string;
  description: string;
  penalty: number;
  show: (sentence: string, translation?: string) => string;
}

export const HINT_STAGES: HintStage[] = [
  {
    level: 1,
    name: '첫 글자 보기',
    description: '각 단어의 첫 글자만 노출',
    penalty: -5,
    show: (sentence) =>
      sentence
        .split(/\s+/)
        .map((w) => {
          const cleaned = w.replace(/[^a-zA-Z']/g, '');
          if (cleaned.length === 0) return w;
          if (cleaned.length === 1) return cleaned;
          return cleaned[0] + '_'.repeat(cleaned.length - 1);
        })
        .join(' '),
  },
  {
    level: 2,
    name: '단어 길이 표시',
    description: '단어 갯수와 글자 수만 노출',
    penalty: -3,
    show: (sentence) =>
      sentence
        .split(/\s+/)
        .map((w) => {
          const cleaned = w.replace(/[^a-zA-Z']/g, '');
          return '_'.repeat(Math.max(cleaned.length, 1));
        })
        .join(' '),
  },
  {
    level: 3,
    name: '한국어 뜻',
    description: '한국어 번역 표시 (있을 때)',
    penalty: -10,
    show: (_sentence, translation) =>
      translation ?? '(한국어 번역이 등록되어 있지 않습니다)',
  },
  {
    level: 4,
    name: '정답 보기',
    description: '정답 직접 공개',
    penalty: -25,
    show: (sentence) => sentence,
  },
];
