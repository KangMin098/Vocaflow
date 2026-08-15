// apps/web/src/lib/dictation/hint.ts
// 단계적 힌트 시스템 (Scaffolding)
// 점수 차감으로 남용 방지 (Token economy)
//
// **레벨 = 도움의 세기**이고 반드시 단조 증가한다: 길이(-3) → 첫 글자(-5) → 뜻(-10) → 정답(-25).
// 2026-08-15 이전에는 1·2 가 뒤집혀 있었다 — 학습자가 순서대로 누르면 **더 많이 알려주는
// 힌트(첫 글자)를 먼저** 받았고 벌점도 -5 → -3 으로 되레 내려갔다. 그러면
//   · Desirable Difficulty 가 무너진다(필요보다 많은 도움을 먼저 받는다)
//   · "아껴 쓰면 이득" 이라는 토큰 경제가 성립하지 않는다
// 이 단조성은 `__tests__/hint.test.ts` 가 지킨다. 단계를 더할 때도 그 순서를 유지할 것.

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
    level: 2,
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
