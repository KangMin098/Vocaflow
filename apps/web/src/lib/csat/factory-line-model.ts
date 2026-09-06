// apps/web/src/lib/csat/factory-line-model.ts
//
// **생산 라인 화면들의 순수 모델** — 타입·상수·판정만. DB 도 파일도 안 읽는다.
//
// 실측 쪽(`factory-line-views.ts`)은 `server-only` 를 import 하므로, 클라이언트 컴포넌트가
// 거기서 **값**을 하나라도 가져오면 라우트가 통째로 500 이 난다(실측 2026-09-05 에 한 번 겪었다).
// 그래서 화면과 서버가 함께 쓰는 것은 전부 여기 둔다.

/**
 * 생성기가 실제로 만드는 문항 유형 25종 — **집필 화면 표의 열**.
 *
 * PostgREST 는 집계 함수가 꺼져 있어(`PGRST123`) `SELECT DISTINCT type` 을 못 한다. 그래서
 * 목록을 상수로 든다. 상수는 낡는 것이 문제인데, 통합 테스트가 **유형별 count 의 합이 표 전체
 * count 와 같은지**를 본다 — 새 유형이 생기면 합이 모자라 즉시 깨진다(빠뜨린 유형이 조용히
 * 표에서 사라지는 사고를 그 검사가 막는다).
 *
 * 실측 2026-09-05: 25종 · 합계 655,092행.
 */
export const GENERATED_TYPES: readonly string[] = [
  'blank',
  'blank_word',
  'claim',
  'content_match',
  'grammar_choice',
  'grammar_fix',
  'implication',
  'insert',
  'irrelevant',
  'long_match',
  'long_order',
  'long_reference',
  'long_title',
  'long_vocab',
  'main_point',
  'mood',
  'order',
  'purpose',
  'summary',
  'title',
  'topic',
  'unit_grammar',
  'unit_vocab',
  'vocab_choice',
  'word_order',
] as const

/** 사다리가 실제로 쓰는 V-Level — 표의 행. 규격 밖 레벨(V8·V9)도 재고가 있으면 보여야 한다. */
export const INVENTORY_LEVELS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

/** 한국어 유형 이름. 사다리가 쓰지 않는 유형도 관리자가 읽을 수 있어야 한다. */
export const TYPE_KO: Record<string, string> = {
  blank: '빈칸 추론',
  blank_word: '빈칸 낱말',
  claim: '주장',
  content_match: '내용 일치',
  grammar_choice: '어법',
  grammar_fix: '어법 고쳐쓰기',
  implication: '함의',
  insert: '삽입',
  irrelevant: '흐름 무관',
  long_match: '장문 내용 일치',
  long_order: '장문 순서',
  long_reference: '장문 지칭',
  long_title: '장문 제목',
  long_vocab: '장문 어휘',
  main_point: '요지',
  mood: '심경',
  order: '순서',
  purpose: '목적',
  summary: '요약',
  title: '제목',
  topic: '주제',
  unit_grammar: '단원 문법',
  unit_vocab: '본문 어휘',
  vocab_choice: '어휘',
  word_order: '영작 배열',
}

/* ───────────────────────── ④ 소재 ───────────────────────── */

export interface SourceBandRow {
  band: string
  vLevel: number | null
  count: number
  /** 화면에만 쓰고 문항으로는 못 쓰는 지문 — 저작권·형식 문제. 재고에서 빼고 세야 한다. */
  displayOnly: number
  licenseClasses: string[]
  cefrLevels: string[]
}

export interface SourceView {
  rows: SourceBandRow[]
  /** 게이트가 정의된 단계 밴드(S1~S5). 여기에 지문이 0편이면 그 단계 책은 못 만든다. */
  gateBands: string[]
  loadError: string | null
}

/** 지문이 하나도 없는 게이트 밴드 — 그 단계는 지금 책을 못 만든다. */
export function emptyGateBands(v: Pick<SourceView, 'rows' | 'gateBands'>): string[] {
  return v.gateBands.filter((b) => !v.rows.some((r) => r.band === b && r.count > 0))
}

/* ───────────────────────── ⑤ 집필 ───────────────────────── */

export interface AuthorCell {
  type: string
  vLevel: number
  count: number | null
}

export interface AuthorView {
  cells: AuthorCell[]
  /** 표 전체 합 — 유형별 합이 이것과 같아야 목록이 안 낡은 것이다. */
  total: number | null
  /** 사다리가 쓰는 (유형, V-Level) 조합. 그 밖의 재고는 **지금 어느 권에도 안 실린다**. */
  ladderCells: { type: string; vLevel: number }[]
  loadError: string | null
  /**
   * 재고를 **언제 센 값**인지 (ISO). 30분마다 갱신되는 집계표에서 읽으므로 지금 값이
   * 아닐 수 있다 — 드레인 직후 "왜 안 늘었지" 로 읽히지 않도록 화면이 이 시각을 적는다.
   * 못 읽었으면 null: 그때는 신선도를 주장하지 않는다.
   */
  inventoryAt: string | null
}

/** 사다리 밖 재고 — 만들어 뒀지만 **어느 권에도 안 실리는** 문항. 창고만 불리는 자리다. */
export function offLadderCount(v: Pick<AuthorView, 'cells' | 'ladderCells'>): number {
  const inLadder = new Set(v.ladderCells.map((c) => `${c.type}|${c.vLevel}`))
  return v.cells
    .filter((c) => !inLadder.has(`${c.type}|${c.vLevel}`))
    .reduce((n, c) => n + (c.count ?? 0), 0)
}

/* ───────────────────────── ⑦ 검수 ───────────────────────── */

export interface ReviewLayer {
  id: 'L1' | 'L2' | 'L3' | 'L4'
  name: string
  /** 이 층이 실제로 보는 것 — 다른 층과 겹치지 않아야 다층이 의미가 있다. */
  looksAt: string
  passed: number | null
  total: number | null
  unmeasuredReason: string | null
  /** 이 층을 돌리는 명령. */
  cmd: string
}

export interface ReviewVolumeRow {
  band: number
  volumeTitle: string | null
  items: number
  autoPassed: number
  autoTotal: number
  failedChecks: string[]
  /** 조판이 실제로 돌린 검수. 옛 행에는 없다 — **null 은 「지적 0건」이 아니다**. */
  answerBias: { chi2: number; cramersV: number; biased: boolean } | null
  proofread: { passages: number; defective: number } | null
  passageSpec: string | null
}

export interface ReviewView {
  layers: ReviewLayer[]
  volumes: ReviewVolumeRow[]
  loadError: string | null
}

/* ───────────────────────── ⑧ 조판 ───────────────────────── */

export interface PressVolumeRow {
  band: number
  volumeTitle: string | null
  step: number | null
  schoolBand: string | null
  units: number
  items: number
  missingExplanations: number
  typeMixFit: number | null
  distinctVolumes: number | null
  articlesWithItems: number | null
  articlesIdle: number | null
  brandCurrent: boolean
  renderCount: number
  renderedAt: string | null
  outPath: string | null
}

export interface PressView {
  volumes: PressVolumeRow[]
  /** 사다리 계단 수 — 분모. 계단마다 권이 하나씩 있어야 브랜드가 학령 전체를 덮는다. */
  rungs: number
  /** 현재 브랜드 지문(fingerprint). 다른 값으로 찍힌 권은 **옛 규격**이다. */
  brandFingerprint: string
  /**
   * 조판기가 쓰는 **브랜드 규격** — 지면에서의 자리마다 라이트/다크 색, 그리고 서체 셋.
   *
   * TBP 콘솔에 있던 것을 여기로 옮겼다(2026-09-06). 규격은 조판기의 **입력**이므로 조판 공정의
   * 것이지 별도 관측 화면에 둘 것이 아니었다. 값은 디자인 토큰 패키지에서 온다 —
   * 조판기가 색을 따로 갖고 있으면 손에 쥔 책이 화면과 달라진다.
   */
  brand: {
    rows: { key: string; label: string; light: string; dark: string }[]
    fonts: { english: string; body: string; mono: string }
  }
  loadError: string | null
}
