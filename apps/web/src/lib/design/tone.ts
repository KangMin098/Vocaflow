// apps/web/src/lib/design/tone.ts
//
// 면 톤과 범주 색(DD-68 · tines-mapping §13) — 참조 151페이지 실측: 면마다 색상이 다르고, 면 위 글자는
// 그 색상의 짙은 글자(옅은 면) 또는 크림(진한 면)이다. 참조가 팀 · 사례마다 고유 색을 주듯이
// 우리는 **자료 유형 · 학습 모듈**에 색을 고정한다 — 같은 대상은 어느 화면에서나 같은 색이다.
//
// 클래스 이름은 글자 그대로 적는다(Tailwind 는 조립한 이름을 만들지 않는다 — 정의는 globals.css `.tone-*`).

import type { MaterialType } from '@/lib/learner/plan-activities'

export type Tint = 'lavender' | 'green' | 'peach' | 'yellow' | 'pink' | 'teal'
export type Deep = 'purple' | 'green' | 'orange' | 'magenta' | 'ink' | 'charcoal'

export const TINT_CLASS: Record<Tint, string> = {
  lavender: 'tone-lavender',
  green: 'tone-green',
  peach: 'tone-peach',
  yellow: 'tone-yellow',
  pink: 'tone-pink',
  teal: 'tone-teal',
}

export const DEEP_CLASS: Record<Deep, string> = {
  purple: 'tone-deep-purple',
  green: 'tone-deep-green',
  orange: 'tone-deep-orange',
  magenta: 'tone-deep-magenta',
  ink: 'tone-deep-ink',
  charcoal: 'tone-deep-charcoal',
}

/** 격자 칸에 돌려 쓰는 순서 — 이웃 칸이 같은 계열이 되지 않게 따뜻한/찬 색을 번갈아 둔다. */
export const TINT_ROTATION: readonly Tint[] = ['lavender', 'green', 'peach', 'pink', 'teal', 'yellow']

/** 자료 유형 — 옅은 면 · 진한 면 한 쌍. 교재는 DB 유형이 아니라서(`lib/library/tabs.ts`) 따로 둔다. */
export const MATERIAL_TONE: Record<MaterialType | 'textbook' | 'comic', { tint: Tint; deep: Deep }> = {
  book: { tint: 'green', deep: 'green' },
  article: { tint: 'peach', deep: 'orange' },
  word_set: { tint: 'pink', deep: 'magenta' },
  script: { tint: 'teal', deep: 'charcoal' },
  textbook: { tint: 'lavender', deep: 'purple' },
  comic: { tint: 'yellow', deep: 'orange' },
}

/** 학습 모듈 — 계층(읽기 → 단어 → 연습 → 정복 → 완성)마다 계열을 묶고 모듈마다 한 색. */
export type ModuleKey =
  | 'read' | 'echo' | 'wordvault' | 'flashcard' | 'wordblitz' | 'pairflip' | 'spellforge' | 'scriptquiz' | 'dictation' | 'dashboard'

export const MODULE_TONE: Record<ModuleKey, { tint: Tint; deep: Deep }> = {
  read: { tint: 'green', deep: 'green' },
  echo: { tint: 'teal', deep: 'green' },
  wordvault: { tint: 'pink', deep: 'magenta' },
  flashcard: { tint: 'lavender', deep: 'purple' },
  wordblitz: { tint: 'peach', deep: 'orange' },
  pairflip: { tint: 'teal', deep: 'charcoal' },
  spellforge: { tint: 'yellow', deep: 'orange' },
  scriptquiz: { tint: 'peach', deep: 'orange' },
  dictation: { tint: 'teal', deep: 'ink' },
  dashboard: { tint: 'lavender', deep: 'ink' },
}
