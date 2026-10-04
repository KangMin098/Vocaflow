// apps/web/src/lib/csat/hakpyeong-review.ts
//
// **학평 독립 검수 모니터 — 판정(순수 함수)과 모양.** DB 읽기는 hakpyeong-review-loader.ts(server-only).
//
// 이 파일은 **새 판정 기준을 만들지 않는다.** 판정의 재료는 전부 DB·CLI 가 이미 낸 값이다:
//   · 유효 승인 페르소나 — DB 함수 csat_valid_review_personas_many(발행 게이트와 같은 함수)
//   · 사전 검사 결과    — CLI precheckAnalysis 가 csat_review_prechecks 에 기록한 것
// 여기서는 그 값들을 **어떤 순서로 읽어 「막힌 이유」 하나로 요약하느냐**만 정한다. 과거 pass 개수를 세지 않는다.

export const PERSONAS = ['setter', 'analyst', 'tutor'] as const
export type Persona = (typeof PERSONAS)[number]

export interface ReviewVerdict {
  persona: Persona
  verdict: 'pass' | 'revise' | 'fail'
  kind: 'blind' | 'rereview'
  findings: string[]
  reviewedAt: string
  /**
   * 이 기록의 «페르소나»에 지금 게이트 기준 유효 승인이 있는가. 기록 단위가 아니다 — 게이트 함수는 페르소나만 돌려주므로
   * 어느 기록이 그 승인인지는 모른다(화면도 「이 페르소나 유효 승인 있음」 으로 말한다)
   */
  counted: boolean
  /**
   * 검수 당시 스냅샷이 지금과 다르다 — 'input': 문항 지문·발문·선지·정답이 바뀜(블라인드 풀이도 무효 → 새 블라인드 검수),
   * 'analysis': 분석·근거 단위만 바뀜(블라인드 풀이는 그대로 → 재검수 rereview 로 이어 갈 수 있다)
   */
  stale?: false | 'input' | 'analysis'
}

/**
 * 지금 사전 검사기 버전 — scripts/csat/lib-evidence-units.mjs 의 PRECHECK_VERSION 과 같아야 한다(회귀가 묶는다).
 * 다른 버전으로 낸 기록은 「오래된 결과」다.
 */
export const PRECHECK_VERSION_CURRENT = 3

export interface PrecheckRecord {
  errors: string[]
  warnings: string[]
  checkedAt: string
  precheckVersion: number
  commit: string | null
  /** 검사 당시 분석·목록 해시가 지금과 같은가 — 다르면 결과를 믿지 않는다 */
  current: boolean
}

export interface HakReviewItem {
  itemId: string
  typeId: string
  analysisId: string | null
  version: number | null
  status: string | null
  analystRun: string | null
  unitsBased: boolean
  /** 게이트와 같은 함수가 준 유효 승인 페르소나 */
  validPersonas: Persona[]
  /** 현재 분석 버전에 대한 독립 검수 판정 */
  verdicts: ReviewVerdict[]
  /** 가장 최근 사전 검사(없으면 null) */
  precheck: PrecheckRecord | null
}

export interface ReviewBatch {
  batch: string
  runDate: string
  kind: 'blind' | 'rereview' | 'correction'
  chunkSize: number | null
  items: number
  agents: number | null
  /** null = 미기록(0 이 아니다) */
  tokens: Record<string, number | number[] | null> | null
  published: number | null
  refused: number | null
  reRejected: number | null
  note: string | null
}

export interface ReviewFollowup {
  itemId: string
  source: string
  finding: string
  severity: 'minor' | 'revise' | 're-reject' | 'reference' | 'rule'
  status: 'open' | 'in_correction' | 'fixed-published' | 'dismissed'
  notedOn: string
}

export interface HakReviewData {
  items: HakReviewItem[]
  batches: ReviewBatch[]
  followups: ReviewFollowup[]
  /** 읽기 실패 — 0건으로 삼키지 않는다 */
  error: string | null
}

export const BLOCK_STATES = {
  published: '발행됨',
  chart: '도표 보류',
  noAnalysis: '분석 없음',
  fixFirst: '교정 먼저',
  precheckStale: '사전 검사 다시',
  rejected: '반려 · 교정 대기',
  waiting: '검수 대기',
} as const
export type BlockState = keyof typeof BLOCK_STATES

export interface ReviewBlock {
  state: BlockState
  /** 막힌 이유 한 줄 */
  reason: string
  /** 다음 조치 — 실제 명령 */
  next: string
}

const cmd = (sub: string) => `node --tls-max-v1.2 scripts/csat/review-drain.mjs ${sub}`

/**
 * 막힌 이유 — **우선순위 순으로 첫 번째 하나**. 순서가 곧 조치 순서다:
 * 발행됨 → 도표(입력 자체가 없다) → 분석 없음 → 사전 검사 실패(기계로 잡히는 결함은 검수 전에 교정)
 * → 사전 검사 결과가 오래됨/없음 → 현재 분석에 반려 판정 → 유효 승인 n/3.
 */
export function reviewBlock(it: HakReviewItem): ReviewBlock {
  const n = it.validPersonas.length
  if (it.status === 'published' && n >= 3) {
    return { state: 'published', reason: `발행됨 · 유효 승인 ${n}/3`, next: '없음' }
  }
  if (it.typeId === 'R-CHART') {
    return {
      state: 'chart',
      reason: '도표 이미지가 검수 입력에 없어 도표 수치를 대조할 수 없다 — 발행 보류(완료로 세지 않는다)',
      next: '도표 이미지를 검수 입력에 붙이는 작업이 먼저다(현재 없음)',
    }
  }
  if (!it.analysisId || !it.analystRun) {
    return {
      state: 'noAnalysis',
      reason: it.analysisId ? '분석 실행 주체(analyst_run)가 없다 — 게이트가 발행을 막는다' : '분석이 없다',
      next: 'node scripts/csat/analysis-drain-export.mjs --set hakpyeong --exam <회차>',
    }
  }
  if (it.precheck?.current && it.precheck.errors.length) {
    return {
      state: 'fixFirst',
      reason: `사전 검사 실패 ${it.precheck.errors.length}건 — ${it.precheck.errors[0]}`,
      next: `교정 청크에 넣는다(근거 단위 목록 첨부) → ${cmd(`precheck --items ${it.itemId}`)}`,
    }
  }
  if (!it.precheck || !it.precheck.current) {
    return {
      state: 'precheckStale',
      reason: it.precheck ? '사전 검사 결과가 지금 분석·근거 단위와 맞지 않는다(오래된 결과)' : '사전 검사 기록이 없다',
      next: cmd(`precheck --items ${it.itemId} --commit`),
    }
  }
  // 페르소나마다 «가장 최근» 판정만 본다 — 반려 뒤 재검수에서 통과한 옛 반려는 막지 않는다.
  // 게이트가 이미 유효 승인으로 센 페르소나의 옛 반려도 막지 않는다(Codex 리뷰).
  const latestByPersona = new Map<string, (typeof it.verdicts)[number]>()
  for (const v of [...it.verdicts].sort((x, y) => x.reviewedAt.localeCompare(y.reviewedAt))) latestByPersona.set(v.persona, v)
  // 검수 뒤 문항 입력·정답·분석·근거 단위가 바뀐 반려(stale)는 지금 문항을 본 것이 아니다 — 교정·재검수가 아니라
  // 새 블라인드 검수로 보낸다(rereview 는 바뀌기 전 블라인드 풀이를 다시 쓸 수 없다)
  const open = [...latestByPersona.values()].filter((v) => v.verdict !== 'pass' && !it.validPersonas.includes(v.persona))
  const rejected = open.filter((v) => !v.stale)
  const staleRejected = open.filter((v) => v.stale)
  if (rejected.length) {
    const who = rejected.map((v) => v.persona).join('·')
    return {
      state: 'rejected',
      reason: `현재 분석에 반려 ${rejected.length}건(${who}) — ${rejected[0].findings[0] ?? '소견 없음'}`,
      next: '교정 → 적재(in_review) → 같은 문항·페르소나의 블라인드 풀이에 이은 재검수(rereview)',
    }
  }
  const missing = PERSONAS.filter((p) => !it.validPersonas.includes(p))
  if (staleRejected.length && n < 3) {
    const inputChanged = staleRejected.some((v) => v.stale === 'input')
    return {
      state: 'waiting',
      reason: inputChanged
        ? `유효 승인 ${n}/3 — ${staleRejected.map((v) => v.persona).join('·')} 의 반려는 검수 뒤 문항(지문·선지·정답)이 바뀌어 낡았다(블라인드 풀이도 무효 — 새 블라인드 검수)`
        : `유효 승인 ${n}/3 — ${staleRejected.map((v) => v.persona).join('·')} 의 반려는 검수 뒤 분석이 바뀌어 낡았다(블라인드 풀이는 유효 — 재검수)`,
      next: inputChanged ? cmd(`export --items ${it.itemId}`) : '같은 문항·페르소나의 블라인드 풀이에 이은 재검수(rereview)',
    }
  }
  if (n >= 3) {
    return { state: 'waiting', reason: '유효 승인 3/3 — 발행 대기', next: cmd(`publish --items ${it.itemId}`) }
  }
  return {
    state: 'waiting',
    reason: `유효 승인 ${n}/3 — ${missing.join('·')} 검수가 필요하다`,
    next: cmd(`export --items ${it.itemId}`),
  }
}

export function reviewCounts(items: HakReviewItem[]): Record<BlockState, number> {
  const out = Object.fromEntries(Object.keys(BLOCK_STATES).map((k) => [k, 0])) as Record<BlockState, number>
  for (const it of items) out[reviewBlock(it).state] += 1
  return out
}

/** 토큰 합계 — 하나라도 모르면 null(「미기록」). 0 으로 채우지 않는다 */
export function batchTokens(b: ReviewBatch): number | null {
  if (!b.tokens) return null
  let sum = 0
  for (const v of Object.values(b.tokens)) {
    if (v == null) return null
    sum += Array.isArray(v) ? v.reduce((a, x) => a + x, 0) : v
  }
  return sum
}
