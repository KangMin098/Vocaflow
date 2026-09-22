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
//
// **`SourceView` · `SourceBandRow` · `emptyGateBands` 는 2026-09-15 에 지웠다.**
//
// 두 가지가 틀려 있었다:
//   · **분모** — 재고를 `csat_stage_catalog`(뷰, 양쪽 다 `status = published`)에서 셌다.
//     562편은 출고분이지 조판이 고르는 풀이 아니다(실측 87,556편).
//   · **판정** — `emptyGateBands` 는 「합격선이 있는데 지문 0편」 하나로 밴드를 판정했다.
//     S5 의 합격선은 `listening` 하나뿐이라 **지문으로는 영영 안 차고**, 화면은 수확을
//     아무리 해도 안 꺼지는 빨간불을 띄웠다.
//
// 대체: `@vocaflow/library-pipeline/source-rollup` 의 `bandStock` · `emptyPassageBands` ·
// `passageGateBands`. 판정 근거를 목록이 아니라 **게이트의 metric** 에 뒀으므로, S5 에
// `coverage` 가 붙는 날 자동으로 지문 밴드가 된다.

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
  /**
   * 그 권에 실린 문항의 **3인 페르소나 검수** — 조판기가 잰 값 그대로.
   *
   * ⚠️ **화면이 다시 세지 않는다.** 어느 문항이 그 권에 실렸는지는 조판기만 안다.
   *   여기서 다시 세려 하면 분모가 달라져 「책은 하나인데 자가 둘」이 된다 —
   *   이 저장소가 유형 배합에서 이미 겪은 사고다.
   *
   * `settled` 는 셋이 **보기는 한** 문항 수다. `passed` 와 갈라 두는 이유는 할 일이
   * 정반대이기 때문이다 — 덜 봤으면 검수를 돌리고, 봤는데 막혔으면 문항을 고친다.
   *
   * 옛 조판 기록에는 없다 → **null**(못 잼). 0 과 다르다.
   */
  personaReview: { quorum: number; items: number; passed: number; settled: number | null } | null
}

export interface ReviewView {
  layers: ReviewLayer[]
  volumes: ReviewVolumeRow[]
  loadError: string | null
}

/* ───────────────────────── ⑧ 조판 ───────────────────────── */

/* ───── ⑧ 조판 — 발행 상태와 학습자 도달 (2026-09-23 · DD-72) ───── */
//
// ⚠️ **「찍혔다」와 「내보내도 된다」가 한 사실로 뭉쳐 있었다.** 실측 2026-09-23:
//   19권 전부 `auto_passed = auto_total` · `failed_checks` 전 행 NULL · 카탈로그 「냈음」인데,
//   그중 한 권(Vocaflow Vocab Advanced)의 3인 검수는 **1 / 60** 이었고 공개 URL 로 열려 있었다.
//   게이트가 없어서가 아니라 **게이트를 지난 흔적을 남길 자리가 없어서**다.
//
// 상태를 담을 곳: `textbook_volume_renders.colophon.publish` — **jsonb 라 마이그레이션이
// 필요 없다**(AGENTS.md §🤖: 「jsonb 에 키를 더하면 마이그레이션 불필요 — 통째로 덮지 말고
// 기존 값을 읽어 키 하나만 더한다」). 컬럼으로 올리는 것은 `20260923060200` 초안이고
// 승인되면 그쪽이 정본이 된다. 그때까지 읽는 쪽은 **둘 다** 본다.

/** 발행 판정. 없으면 `null` — 「찍히기만 했다」이고 「반려됐다」와 다르다. */
export interface VolumePublish {
  status: 'rendered' | 'review' | 'approved' | 'published' | 'withdrawn'
  /** review·withdrawn 인 이유. 없으면 null 이고 화면이 「사유 없음」이라 적는다. */
  reason: string | null
  at: string | null
  by: string | null
}

/** 그 권이 학습자에게 실제로 닿는가 — **세 조건이 다 서야 한다.** */
export interface VolumeReach {
  /** 매대 라우트. 시리즈·단이 있어야 만든다(지어내지 않는다). */
  href: string | null
  /** 그 시리즈의 목차 스냅샷이 구워져 있는가. 없으면 상세면에 목차 절이 안 나간다. */
  hasContents: boolean
}

export interface PressVolumeRow {
  band: number
  /** 어느 시리즈의 권인가. 계단이 겹치므로(독해 5단 · 어휘 5단 · 구문 5단이 전부 V5) 밴드만으로는 권이 안 정해진다. */
  series: string
  /** 발행 판정 — `colophon.publish`. 없으면 null(「찍히기만 했다」 · 「반려됐다」와 다르다). */
  publish: VolumePublish | null
  /** 3인 검수에서 막힌 문항 수. 조판기가 잰 값에서 파생한다. 못 쟀으면 null. */
  personaBlocked: number | null
  /** 자동 검사 통과 / 전체. 전체가 0 이면 **검사가 안 돈 것**이고 「통과」가 아니다. */
  autoPassed: number
  autoTotal: number
  /** 학습자 도달 경로. */
  reach: VolumeReach
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

/* ───────────────────────── ⑥ 해설 ───────────────────────── */
//
// **이 화면은 2026-09-23 까지 없었다** (DD-69: ⑥ 해설 9/22 — 파이프라인 최저).
// 메뉴에는 칸이 있었는데 `href` 가 부모를 가리키고 「준비 중」 배지가 붙어 있었다.
//
// 없던 이유로 적혀 있던 것은 「유형별 해설 보유율은 `answer_key->>explanation_ko` 를 유형마다
// 훑어야 하고 그 컬럼에 인덱스가 없어 5~8초씩 걸린다 → 집계 RPC 가 필요한데 마이그레이션이라
// 승인 대기」였다. **그 판단이 낡았다** — 필요한 집계는 이미 `textbook_shelf_inventory_mv`
// (20260831090000)에 (유형 × 수준 × 문항 수 × 해설 수)로 들어 있고, `loadDcpInventory` 가
// 그것을 1.2초에 읽는다. 마이그레이션 없이 만들 수 있었던 화면이 그 문장 하나 때문에
// 한 달 넘게 안 만들어졌다.

/** 해설 한 칸 — (유형 × 수준). `items` 가 0 이면 그 칸은 애초에 없는 것이다. */
export interface ExplainCell {
  type: string
  vLevel: number
  items: number
  explained: number
  /** 사다리가 실제로 쓰는 칸인가 — 밖의 구멍은 급하지 않다(어느 권에도 안 실린다). */
  inLadder: boolean
}

export interface ExplainView {
  cells: ExplainCell[]
  items: number | null
  explained: number | null
  /** 집계표를 마지막으로 갱신한 시각(ISO). 못 읽었으면 null — 신선도를 주장하지 않는다. */
  inventoryAt: string | null
  /**
   * 그 시각을 사람 말로 — **서버에서 계산해 넘긴다.**
   *
   * ⚠️ 화면에서 계산하지 않는다. 시계를 클라이언트가 읽으면 서버 렌더와 값이 갈려
   *   하이드레이션이 어긋나고, 이 저장소는 「로직 안에서 시계를 읽지 않는다」를 규칙으로 둔다
   *   (고정 날짜 픽스처가 시간이 지나며 저절로 떨어진다 — AGENTS.md 「하지 말 것」).
   */
  inventoryNote: string | null
  loadError: string | null
}

/** 해설이 모자란 칸 — 많은 순서로. 사다리 안을 먼저 세운다(그쪽이 곧 학습자에게 간다). */
export function explainGaps(v: Pick<ExplainView, 'cells'>): ExplainCell[] {
  return v.cells
    .filter((c) => c.items > c.explained)
    .sort((a, b) => {
      if (a.inLadder !== b.inLadder) return a.inLadder ? -1 : 1
      return b.items - b.explained - (a.items - a.explained)
    })
}

/** 「몇 문항에 해설이 없나」 — 못 쟀으면 null 이고 0 이 아니다. */
export function explainMissing(v: Pick<ExplainView, 'items' | 'explained'>): number | null {
  return v.items == null || v.explained == null ? null : v.items - v.explained
}
