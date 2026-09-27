// packages/library-pipeline/src/textbook/series-lifecycle.ts
//
// **시리즈의 생애 — 한 권을 냈다고 그 유형이 끝나는 것이 아니다.**
//
// ── 왜 이 파일이 생겼나 (실측 2026-09-23 · DD-76) ─────────────────────
// `SeriesDef.status` 는 `'shipping' | 'draft'` **두 글자 상수**였다. 그런데 시리즈가
// 팔리는지는 사실이지 선언이 아니다. 상수로 두자 세 소비처 중 **둘이 조용히 틀렸다**:
//
//   · `SeriesTabs`(학습자 공개 화면) — 어휘·구문 서가에 「인쇄본 준비 중」을 찍고 있었다.
//     그 시각 DB 에는 `textbook_volume_renders` 에 어휘 6권 · 구문 6권이 `status='published'`
//     로 있었고(조판 2026-09-06), DD-73 이 그 목차까지 구워 둔 뒤였다.
//   · `video-source.mts:265` — 광고 영상 번들이 같은 상수를 복사해 그 12권을
//     `published` 가 아닌 `ready` 로 실었다. 그 스크립트는 다른 수치를 전부 DB 에서 센다.
//
//   유일하게 맞았던 곳은 관리자 카탈로그였는데, 그것은 **상수를 안 믿고 조판 기록에서
//   다시 세고 있었기 때문**이다(`series-view.ts` 가 같은 사고를 2026-09-06 에 겪고 남긴 주석).
//
// ── 그래서 축을 둘로 가른다 ──────────────────────────────────────────
//   · **의도**(`SeriesIntent`) — 사람이 정한다. 「낼 생각인가 · 접었는가」. 코드가 소유한다.
//   · **생애**(`SeriesLifecycle`) — **실측에서 파생한다.** 조판 기록 · 재고 · 규격 지문.
//
//   의도를 실측처럼 쓰면 위 사고가 반복된다. 여기서는 `judgeLifecycle()` 을 거치지 않고는
//   「팔린다」를 말할 수 없고, 못 쟀으면 `null` 을 돌려 화면이 **「못 잼」**이라고 적게 한다.
//
// ── 그리고 생애에는 **끝이 없다** ────────────────────────────────────
//   시중 출판사의 상품 라인은 발행에서 멈추지 않는다 — 제도가 바뀌면 개정판을 내고,
//   안 팔리면 절판하고, 그 자리에 다른 라인을 세운다. 그 순환을 표현하려면 상태가
//   `shipping` 에서 멈추면 안 된다. `revising`(개정 사유가 떴다)과 `retired`(접었다)가
//   있어야 **다음 유형의 발의**가 어디서 오는지 화면이 말할 수 있다.

import { MARKET_SERIES_TOTAL, type SeriesDef } from './series-catalog'

/* ───────────────────────── 의도 ───────────────────────── */

/**
 * 사람이 정한 것 — **사실이 아니라 뜻**이다.
 *
 *   · `planned` — 내기로 했다. 아직 못 냈을 수도, 계단조차 없을 수도 있다.
 *   · `active`  — 계속 낸다. 개정도 여기 있다.
 *   · `retired` — 접었다. 이유가 반드시 붙는다(`SeriesDef.retiredWhy`).
 *
 * ⚠️ 여기에 `shipping` 을 두지 않는다. 그것은 **조판 기록이 답하는 물음**이고,
 *   의도 칸에 적어 두면 찍은 뒤에도 안 바뀐다 — 이 파일 머리말의 사고가 정확히 그것이다.
 */
export type SeriesIntent = 'planned' | 'active' | 'retired'

/* ───────────────────────── 생애 ───────────────────────── */

/**
 * 실측에서 파생하는 여섯 자리. 순서가 곧 진행이고, **마지막 둘이 다시 처음으로 돌아간다.**
 */
export type SeriesLifecycle =
  /** 발의됐다 — 근거는 있고 계단(rungs)이 아직 없다. */
  | 'proposed'
  /** 계단이 정의됐다 — 아직 한 권도 못 찍는다. */
  | 'planned'
  /** 찍을 수 있는 권이 생겼다 — 아직 안 찍었다. */
  | 'producing'
  /** 나간 권이 있다. */
  | 'shipping'
  /** 나갔는데 **개정 사유가 떴다** — 옛 규격으로 찍힌 권이 있다. */
  | 'revising'
  /** 접었다. */
  | 'retired'

export const LIFECYCLE_KO: Record<
  SeriesLifecycle,
  { label: string; what: string; color: string }
> = {
  proposed: {
    label: '발의',
    what: '근거는 섰고 계단이 아직 없다 — 설계(③)가 다음 차례다',
    color: '#8A8278',
  },
  planned: {
    label: '기획',
    what: '계단은 정의됐는데 한 권도 못 찍는다 — 재고가 한 권(60문항)을 못 넘었다',
    color: '#8A8278',
  },
  producing: {
    label: '생산',
    what: '찍을 수 있는 권이 있다 — 아직 조판을 안 돌렸다',
    color: '#B5803A',
  },
  shipping: { label: '출고', what: '나간 권이 있다', color: '#2E7D5A' },
  revising: {
    label: '개정',
    what: '나갔지만 옛 규격으로 찍힌 권이 있다 — 다시 찍어야 한다',
    color: '#B5803A',
  },
  retired: { label: '절판', what: '접었다 — 사유가 기록돼 있다', color: '#9C3A30' },
}

/* ───────────────────── 왜 이 시리즈가 생겼는가 ───────────────────── */

/**
 * **새 유형을 낳는 여섯 가지 계기.**
 *
 * 시중 출판사가 라인을 늘리는 이유를 축으로 옮긴 것이다. 이 축이 없으면 시리즈는
 * 「어쩌다 생긴 것」이 되고, 다음 시리즈를 **무엇을 보고 발의해야 하는지**가 화면에서 사라진다.
 *
 *   · `institution` 제도 — 교육과정·시험 체제가 바뀐다
 *   · `season`      시기 — 학평·방학·수능 D-n 처럼 달력이 부르는 것
 *   · `segment`     대상 — 내신·편입·성인처럼 다른 학습자
 *   · `competition` 경쟁 — 시중이 차지한 자리
 *   · `supply`      공급 — 재고·소재가 열려서 **가능해진** 것
 *   · `demand`      수요 — 학습자가 실제로 무엇을 고르는가
 */
export type SeriesTrigger =
  | 'institution'
  | 'season'
  | 'segment'
  | 'competition'
  | 'supply'
  | 'demand'

export const TRIGGER_KO: Record<SeriesTrigger, { label: string; asks: string }> = {
  institution: { label: '제도', asks: '교육과정·시험 체제가 바뀌었는가' },
  season: { label: '시기', asks: '달력이 지금 이 책을 부르는가' },
  segment: { label: '대상', asks: '다른 학습자에게 팔 것인가' },
  competition: { label: '경쟁', asks: '시중이 차지한 자리가 어디인가' },
  supply: { label: '공급', asks: '담을 책이 없는 재고가 쌓였는가' },
  demand: { label: '수요', asks: '학습자가 실제로 무엇을 고르는가' },
}

/** 한 시리즈가 **왜 생겼는지** — 계기 + 그때의 근거 + 날짜. 셋 다 없으면 적지 않는다. */
export interface SeriesOrigin {
  trigger: SeriesTrigger
  /** 그때 무엇을 보고 결정했나 — **측정값이나 저장소 안의 파일**. 인상은 못 적는다. */
  evidence: string
  /** 그 근거를 잰 날 (ISO `YYYY-MM-DD`). */
  since: string
}

/* ───────────────────────── 판정 ───────────────────────── */

export interface LifecycleInput {
  intent: SeriesIntent
  /** 이 시리즈에서 정의된 계단 수. 0 이면 아직 발의 단계다. */
  rungs: number
  /** 조판돼 나간 권 수. **못 쟀으면 null** — 0 과 다르다. */
  publishedVolumes: number | null
  /** 지금 찍으면 되는 권 수(재고·해설이 찬 단). 못 쟀으면 null. */
  readyVolumes: number | null
  /**
   * 나갔지만 **옛 규격으로 찍힌** 권 수 — `brand_fingerprint` 가 지금 값과 다른 권.
   * 못 쟀으면 null. 이 수가 0 보다 크면 그 시리즈는 출고가 아니라 **개정**이다.
   */
  staleVolumes: number | null
}

/**
 * 생애 한 자리를 **실측에서** 고른다.
 *
 * ⚠️ 못 쟀으면 `null` 을 돌린다. 여기서 `'planned'` 같은 그럴듯한 값을 돌리면 화면이
 *   「아직 안 찍었네」로 읽고, 그것이 이 파일 머리말의 사고와 똑같은 거짓 안심이 된다.
 */
export function judgeLifecycle(f: LifecycleInput): SeriesLifecycle | null {
  // 접은 것은 아무것도 다시 안 잰다 — 접힌 시리즈에도 기록은 남아 있다.
  if (f.intent === 'retired') return 'retired'
  // 계단이 없으면 잴 것이 없다. 발의는 **근거만 있는 상태**이고 그것은 실측이 아니다.
  if (f.rungs === 0) return 'proposed'
  if (f.publishedVolumes == null) return null
  if (f.publishedVolumes > 0) {
    if (f.staleVolumes == null) return null
    return f.staleVolumes > 0 ? 'revising' : 'shipping'
  }
  if (f.readyVolumes == null) return null
  return f.readyVolumes > 0 ? 'producing' : 'planned'
}

/**
 * **다음 한 걸음** — 생애 자리마다 하나.
 *
 * 화면이 「지금 뭘 해야 하나」에 답하지 못하면 그 화면은 조회표다. 이 저장소가
 * `/admin/csat` 전체에서 고친 것이 바로 그것이라(DD-69), 품목 층도 같은 계약을 진다.
 */
export function nextActionOf(
  lifecycle: SeriesLifecycle | null,
  f: { readyVolumes: number | null; staleVolumes: number | null; seriesId: string },
): string {
  if (lifecycle == null) return '못 쟀다 — 조판 기록이나 재고를 읽지 못했다'
  switch (lifecycle) {
    case 'proposed':
      return '계단을 정의한다 — series-catalog.ts 에 rungs 를 넣는다(설계 ③)'
    case 'planned':
      return '재고를 채운다 — 한 권은 60문항이다(집필 ⑤)'
    case 'producing':
      return `조판을 돌린다 — node scripts/textbook/build-volume.mjs --series ${f.seriesId}`
    case 'shipping':
      return '개정 사유를 지켜본다 — 규격이 바뀌면 이 자리가 개정으로 바뀐다'
    case 'revising':
      return `옛 규격 ${f.staleVolumes ?? '?'}권을 다시 찍는다 — 같은 조판 명령에 --series ${f.seriesId}`
    case 'retired':
      return '접었다 — 되살리려면 사유를 뒤집는 근거가 먼저다'
  }
}

/* ─────────────────── 다음 유형은 어디서 오는가 ─────────────────── */

/**
 * **시장 시리즈의 유형별 분포** — 코퍼스 실측(`scripts/textbook-corpus/market-series.mjs`,
 * 출판사 6곳 · 시리즈 22종 · 기출 제외).
 *
 * 합이 `MARKET_SERIES_TOTAL` 과 같아야 한다 — 회귀가 그것을 잠근다. 둘이 갈리면
 * 「우리 3 / 시장 22」의 분모가 조용히 거짓이 된다.
 */
export const MARKET_SERIES_BY_KIND: Readonly<Record<string, number>> = {
  reading: 16,
  vocab: 3,
  syntax: 2,
  school: 1,
}

/** 시장에 있는데 우리에게 없는(또는 모자란) 자리 하나. */
export interface SeriesGap {
  kind: string
  /** 시장 시리즈 수 — 분모. */
  market: number
  /** 우리 시리즈 수 — 분자. 접은 것은 안 센다. */
  ours: number
  /** 못 만드는 자리면 그 이유. 만들 수 있으면 null. */
  blockedWhy: string | null
}

/**
 * 시장 대비 빈 자리를 센다 — **경쟁(`competition`) 계기의 상시 계산.**
 *
 * 이 함수가 0 을 돌려주는 날은 오지 않는다(시장은 계속 늘어난다). 그래서 품목 화면에는
 * 늘 다음 후보가 있고, 공장이 「완료」로 초록이 되는 자리가 구조적으로 없다.
 */
export function seriesGaps(
  catalog: readonly SeriesDef[],
  blocked: Readonly<Record<string, string>> = {},
): SeriesGap[] {
  return Object.entries(MARKET_SERIES_BY_KIND).map(([kind, market]) => ({
    kind,
    market,
    ours: catalog.filter((s) => s.kind === kind && s.intent !== 'retired').length,
    blockedWhy: blocked[kind] ?? null,
  }))
}

/** 시장 22 대비 우리 몇 — 화면 머리에 쓰는 한 줄. 접은 시리즈는 분자에서 뺀다. */
export function portfolioCoverage(catalog: readonly SeriesDef[]): {
  ours: number
  market: number
} {
  return {
    ours: catalog.filter((s) => s.intent !== 'retired').length,
    market: MARKET_SERIES_TOTAL,
  }
}
