// packages/library-pipeline/src/compose/gates.ts
//
// ACP §20 재저작(compose) — 판례를 기계 검사로 번역한 게이트.
//
// 이 파일의 목적은 "조심하자"를 "통과/차단"으로 바꾸는 것이다. 각 게이트는 그것이 막는
// 구체적 침해 유형을 하나씩 갖는다:
//
//   I12 출처 독립성  ← Feist(사실은 보호 못 받지만 선택·배열은 보호받는다).
//                      출처가 하나면 우리가 옮기는 것은 사실이 아니라 그 기사의 선택·배열이다.
//   I13 표현 독립성  ← Harper & Row(300단어여도 침해). 분량이 아니라 복제 여부가 기준.
//   I14 구조 독립성  ← Wainwright(요약도 침해) · Comline(번역·문단순서 추종도 침해).
//                      ⚠ 이 둘은 단어를 전부 바꿔도 성립하므로 **I13 으로는 절대 안 잡힌다**.
//                      그래서 사실의 서술 순서를 따로 잰다.
//   I15 발행 지연    ← INS v. AP 계열 hot-news. NBA v. Motorola 5요건 중 ②시간 민감성과
//                      ④직접 경쟁을 동시에 끊는다. 한국에서도 부정경쟁방지법상 성과물
//                      무단사용 논의가 있어 같은 규칙을 유지한다.
//   I16 인용 정책    ← Harper & Row 의 "심장부". 독점 인터뷰 인용은 정의상 단일 출처이므로
//                      I12 가 이미 배제한다 — I16 은 남는 공개 발언의 길이만 제한한다.
//
// ⚠ 게이트는 면책이 아니다. 침해 위험이 큰 알려진 경로를 자동으로 막을 뿐이고,
//   상용화 시점의 전문가 검토를 대체하지 않는다.

import { containment, findVerbatimRuns, type Fingerprint, type VerbatimRun } from './fingerprint'

// ── 입력 도메인 ──────────────────────────────────────────────────────

/** 수집한 소스 1건 — 본문은 보관하지 않는다. 지문과 서지 정보만 남는다. */
export interface SourceRecord {
  id: string
  /** 발행사 식별자 (호스트명 기준 · 독립성 1차 판정) */
  publisher: string
  url: string
  /** 소스 기사 발행 시각 (ISO) */
  published_at: string
  fingerprint: Fingerprint
}

/** 사실 카드 — 원문 표현이 아니라 사실만 담는 방화벽 산출물. */
export interface FactCard {
  id: string
  /** 우리 말로 적은 사실 한 줄 (원문 문장 복사 금지) */
  claim: string
  kind: 'event' | 'figure' | 'utterance' | 'background'
  /** 이 사실이 확인된 출처들. ordinal = 그 소스 안에서 이 사실이 몇 번째로 등장했는지(0-based). */
  attestations: Array<{ source_id: string; ordinal: number }>
  /** kind='utterance' 일 때 발언 원문(공개 발언). 그 외에는 undefined. */
  quote?: string
  /** kind='utterance' 일 때 공개 석상 발언 여부. 독점 인터뷰면 false. */
  quote_is_public?: boolean
}

/** 초안 — 생성된 지문(학습 자료) 과 그 안에서 사용한 사실의 등장 순서. */
export interface ComposeDraft {
  text: string
  /** 초안이 서술한 순서대로 나열한 FactCard.id */
  fact_order: string[]
  /** 사건 발생 시각 (ISO). 사건이 아닌 주제글이면 null. */
  event_occurred_at: string | null
}

// ── 판정 결과 ────────────────────────────────────────────────────────

export type GateVerdict = 'PASS' | 'WARN' | 'FAIL'

export interface GateResult {
  /** DB run_content_quality_gates 와 같은 어휘 (예: 'I13 표현 독립성') */
  invariant: string
  severity: 'critical' | 'warning'
  verdict: GateVerdict
  /** 사람이 읽는 판정 근거 — 무엇을 어떻게 고쳐야 하는지까지 */
  detail: string
}

// ── 임계값 (근거를 주석에 남긴다 — 숫자만 남으면 다음 사람이 못 고친다) ──

export const COMPOSE_THRESHOLDS = {
  /** 독립 출처 최소 개수. 2 = 어느 한 기사의 선택·배열도 따라갈 수 없는 최소치. */
  minIndependentSources: 2,
  /**
   * 통신사 재게재 판정 포함도. 서로 독립적으로 쓴 두 기사는 7-gram 을 사실상 공유하지
   * 않는다(고유명사 조합에서 드물게 1~2개). 0.25 는 그 노이즈보다 두 자릿수 위라
   * "같은 원고에서 왔다" 외의 설명이 어렵다.
   */
  syndicationContainment: 0.25,
  /**
   * 표현 겹침 하드 차단선(어절). 7~9어절 일치는 기관 정식명칭+상투 서술로 우연히
   * 발생할 수 있으나, 10어절 연속 일치는 우연으로 설명되지 않는다.
   */
  verbatimHardRunWords: 10,
  /** 구조 상관 판정에 필요한 최소 공통 사실 수. 그 미만이면 순위상관이 잡음이다. */
  structureMinSharedFacts: 5,
  /** 서술 순서 상관 상한. 0.8 이상이면 그 기사의 전개를 따라간 것으로 본다. */
  structureMaxRho: 0.8,
  /** 공개 발언 직접 인용 상한(어절). 넘으면 간접 서술로 바꾼다. */
  maxQuoteWords: 25,
  /** 사건 발생 후 최소 경과 시간. hot-news 요건 중 시간 민감성을 끊는다. */
  minDelayHours: 48,
} as const

// ── I12 출처 독립성 ──────────────────────────────────────────────────

/**
 * 통신사 재게재를 하나로 접는다.
 *
 * 같은 발행사면 당연히 같은 그룹이고, 발행사가 달라도 지문 포함도가 임계 이상이면
 * 같은 원고(통신사 배급)로 보고 접는다. "출처 3곳" 이 실제로는 AP 한 건인 경우를
 * 자동으로 1로 만드는 것이 이 함수의 존재 이유다.
 *
 * 반환: 독립 그룹별 SourceRecord.id 배열.
 */
export function collapseSyndication(
  sources: SourceRecord[],
  threshold: number = COMPOSE_THRESHOLDS.syndicationContainment,
): string[][] {
  const parent = new Map<string, string>()
  for (const s of sources) parent.set(s.id, s.id)

  const find = (x: string): string => {
    let r = x
    while (parent.get(r) !== r) r = parent.get(r)!
    while (parent.get(x) !== r) {
      const next = parent.get(x)!
      parent.set(x, r)
      x = next
    }
    return r
  }
  const union = (a: string, b: string): void => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const a = sources[i]!
      const b = sources[j]!
      const samePublisher = a.publisher.toLowerCase() === b.publisher.toLowerCase()
      const wire =
        containment(a.fingerprint, b.fingerprint) >= threshold ||
        containment(b.fingerprint, a.fingerprint) >= threshold
      if (samePublisher || wire) union(a.id, b.id)
    }
  }

  const groups = new Map<string, string[]>()
  for (const s of sources) {
    const root = find(s.id)
    const g = groups.get(root)
    if (g) g.push(s.id)
    else groups.set(root, [s.id])
  }
  return [...groups.values()]
}

/** 초안이 쓴 모든 사실이 독립 출처 2곳 이상에서 확인됐는지. */
export function checkSourceIndependence(
  draft: ComposeDraft,
  facts: FactCard[],
  sources: SourceRecord[],
): GateResult {
  const invariant = 'I12 출처 독립성'
  const byId = new Map(facts.map((f) => [f.id, f]));
  const groups = collapseSyndication(sources)
  const groupOf = new Map<string, number>()
  groups.forEach((ids, gi) => ids.forEach((id) => groupOf.set(id, gi)))

  const used = draft.fact_order.map((id) => byId.get(id)).filter((f): f is FactCard => !!f)
  const missing = draft.fact_order.filter((id) => !byId.has(id))
  if (missing.length > 0) {
    return {
      invariant,
      severity: 'critical',
      verdict: 'FAIL',
      detail: `초안이 원장에 없는 사실을 참조한다 (${missing.length}건: ${missing.slice(0, 3).join(', ')}). 사실 원장을 거치지 않은 서술은 출처를 증명할 수 없다.`,
    }
  }

  const weak: string[] = []
  for (const f of used) {
    const distinct = new Set<number>()
    for (const a of f.attestations) {
      const g = groupOf.get(a.source_id)
      if (g !== undefined) distinct.add(g)
    }
    if (distinct.size < COMPOSE_THRESHOLDS.minIndependentSources) {
      weak.push(`${f.id}(독립 ${distinct.size})`)
    }
  }

  if (weak.length > 0) {
    return {
      invariant,
      severity: 'critical',
      verdict: 'FAIL',
      detail:
        `독립 출처 ${COMPOSE_THRESHOLDS.minIndependentSources}곳 미만인 사실 ${weak.length}건: ${weak.slice(0, 5).join(', ')}. ` +
        `해당 사실을 다른 발행사에서 확인하거나 초안에서 뺀다. ` +
        `(전체 소스 ${sources.length}건 → 독립 ${groups.length}그룹 — 같은 통신사 배급은 하나로 접힌다.)`,
    }
  }

  return {
    invariant,
    severity: 'critical',
    verdict: 'PASS',
    detail: `사실 ${used.length}건 전부 독립 ${groups.length}그룹 중 2곳 이상에서 확인.`,
  }
}

// ── I13 표현 독립성 ──────────────────────────────────────────────────

/** 초안이 어느 소스와도 연속 표현을 공유하지 않는지. */
export function checkExpressionIndependence(
  draft: ComposeDraft,
  sources: SourceRecord[],
): GateResult {
  const invariant = 'I13 표현 독립성'
  const hard = COMPOSE_THRESHOLDS.verbatimHardRunWords

  let worst: { run: VerbatimRun; source: SourceRecord } | null = null
  let total = 0
  for (const s of sources) {
    for (const run of findVerbatimRuns(draft.text, s.fingerprint)) {
      total++
      if (!worst || run.wordCount > worst.run.wordCount) worst = { run, source: s }
    }
  }

  if (!worst) {
    return {
      invariant,
      severity: 'critical',
      verdict: 'PASS',
      detail: `소스 ${sources.length}건과 ${sources[0]?.fingerprint.n ?? 7}어절 이상 겹치는 구간 없음.`,
    }
  }

  const where = `${worst.source.publisher} · "${worst.run.text}"`
  if (worst.run.wordCount >= hard) {
    return {
      invariant,
      severity: 'critical',
      verdict: 'FAIL',
      detail: `${worst.run.wordCount}어절 연속 일치 — ${where}. 우연으로 설명되지 않는 길이다. 해당 문장을 사실 카드만 보고 다시 쓴다. (겹침 총 ${total}건)`,
    }
  }

  return {
    invariant,
    severity: 'critical',
    verdict: 'WARN',
    detail: `${worst.run.wordCount}어절 일치 ${total}건 — ${where}. 기관 정식명칭·상투 서술이면 통과, 서술 표현이면 재작성. 검수자 판단 필요.`,
  }
}

// ── I17 서가 중복 ────────────────────────────────────────────────────

/**
 * 우리가 이미 발행한 글과 겹치는지.
 *
 * 왜 별도 게이트인가: Compose 의 사실 출처 14곳 중 **9곳이 ACP(본문 수집) 소스와 같다**
 * (usgs·noaa·nasa·nih·elife·owid·voa·wikinews·wikipedia). 그래서 ACP 가 NOAA explainer 를
 * 본문 그대로 발행해 둔 사건을 Compose 가 다시 재저작하면, **우리 서가 안에 같은 내용이
 * 두 편** 생긴다. I13 은 외부 소스와만 대조하므로 이 경우를 보지 못한다.
 *
 * ⚠ **우리 아티클을 `sources` 배열에 넣어 I13 으로 대신 잡으려 하면 안 된다.**
 *   그러면 I12(출처 독립성)가 우리 글을 독립 출처로 세어, 한 곳에서만 나온 사실이
 *   "확인됨" 으로 통과한다. 측정은 같아도 **넣는 자리가 다르면 결과가 위험해진다.**
 *
 * 위반의 성격도 다르다 — 외부 겹침은 저작권 위험이고, 서가 겹침은 학습자가 같은 글을
 * 두 번 읽는 문제다. 그래서 판정문과 처방을 따로 쓴다.
 */
export function checkShelfDuplication(
  draft: ComposeDraft,
  shelf: ReadonlyArray<SourceRecord>,
): GateResult {
  const invariant = 'I17 서가 중복'
  if (shelf.length === 0) {
    return {
      invariant,
      severity: 'critical',
      verdict: 'PASS',
      detail: '대조할 기존 발행 글이 없다.',
    }
  }

  let worst: { run: VerbatimRun; source: SourceRecord } | null = null
  for (const s of shelf) {
    for (const run of findVerbatimRuns(draft.text, s.fingerprint)) {
      if (!worst || run.wordCount > worst.run.wordCount) worst = { run, source: s }
    }
  }

  if (!worst) {
    return {
      invariant,
      severity: 'critical',
      verdict: 'PASS',
      detail: `기존 발행 글 ${shelf.length}편과 겹치는 구간 없음.`,
    }
  }

  const where = `${worst.source.publisher} · "${worst.run.text}"`
  if (worst.run.wordCount >= COMPOSE_THRESHOLDS.verbatimHardRunWords) {
    return {
      invariant,
      severity: 'critical',
      verdict: 'FAIL',
      detail: `이미 발행한 글과 ${worst.run.wordCount}어절 겹친다 — ${where}. 같은 사건이 이미 서가에 있다면 재저작하지 말고 그 글을 쓰거나, 다른 각도의 사실로 새로 쓴다.`,
    }
  }
  return {
    invariant,
    severity: 'critical',
    verdict: 'WARN',
    detail: `기존 발행 글과 ${worst.run.wordCount}어절 겹친다 — ${where}. 같은 사건을 다루고 있는지 확인한다.`,
  }
}

// ── I14 구조 독립성 ──────────────────────────────────────────────────

/** 순위 상관계수(Spearman ρ). 동순위는 평균 순위로 처리. */
export function spearman(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length < 2) return 0
  const rank = (xs: number[]): number[] => {
    const idx = xs.map((v, i) => [v, i] as const).sort((p, q) => p[0] - q[0])
    const r = new Array<number>(xs.length)
    let i = 0
    while (i < idx.length) {
      let j = i
      while (j + 1 < idx.length && idx[j + 1]![0] === idx[i]![0]) j++
      const avg = (i + j) / 2 + 1
      for (let k = i; k <= j; k++) r[idx[k]![1]] = avg
      i = j + 1
    }
    return r
  }
  const ra = rank(a)
  const rb = rank(b)
  const n = a.length
  const mean = (n + 1) / 2
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < n; i++) {
    const xa = ra[i]! - mean
    const xb = rb[i]! - mean
    num += xa * xb
    da += xa * xa
    db += xb * xb
  }
  if (da === 0 || db === 0) return 0
  return num / Math.sqrt(da * db)
}

/**
 * 초안의 사실 서술 순서가 특정 소스의 전개를 따라갔는지.
 *
 * Wainwright/Comline 이 잡아낸 것은 단어가 아니라 이 순서다. 원문을 안 보고 썼다면
 * 우리 순서는 학습 목적(쉬운 사실 먼저, 배경 나중)에 따라 정해지지 어느 기자의 리드 구성과
 * 일치할 이유가 없다.
 */
export function checkStructureIndependence(
  draft: ComposeDraft,
  facts: FactCard[],
  sources: SourceRecord[],
): GateResult {
  const invariant = 'I14 구조 독립성'
  const byId = new Map(facts.map((f) => [f.id, f]))
  const draftPos = new Map<string, number>()
  draft.fact_order.forEach((id, i) => draftPos.set(id, i))

  let worst: { rho: number; source: SourceRecord; shared: number } | null = null

  for (const s of sources) {
    const mine: number[] = []
    const theirs: number[] = []
    for (const [factId, pos] of draftPos) {
      const f = byId.get(factId)
      if (!f) continue
      const att = f.attestations.find((a) => a.source_id === s.id)
      if (!att) continue
      mine.push(pos)
      theirs.push(att.ordinal)
    }
    if (mine.length < COMPOSE_THRESHOLDS.structureMinSharedFacts) continue
    const rho = spearman(mine, theirs)
    if (!worst || Math.abs(rho) > Math.abs(worst.rho)) {
      worst = { rho, source: s, shared: mine.length }
    }
  }

  if (!worst) {
    return {
      invariant,
      severity: 'critical',
      verdict: 'PASS',
      detail: `공통 사실 ${COMPOSE_THRESHOLDS.structureMinSharedFacts}건 이상인 소스가 없어 순서 상관을 재지 않았다 (판정 불가 아님 — 따라갈 전개 자체가 없음).`,
    }
  }

  const r = worst.rho.toFixed(2)
  if (Math.abs(worst.rho) >= COMPOSE_THRESHOLDS.structureMaxRho) {
    return {
      invariant,
      severity: 'critical',
      verdict: 'FAIL',
      detail: `서술 순서가 ${worst.source.publisher} 기사와 ρ=${r} (공통 사실 ${worst.shared}건)로 일치한다. 단어를 다 바꿔도 전개를 따라가면 2차 저작물이다. 사실을 학습 순서(쉬운 사실 → 배경 → 함의)로 재배열한다.`,
    }
  }

  return {
    invariant,
    severity: 'critical',
    verdict: 'PASS',
    detail: `최대 순서 상관 ρ=${r} (${worst.source.publisher} · 공통 ${worst.shared}건) — 임계 ${COMPOSE_THRESHOLDS.structureMaxRho} 미만.`,
  }
}

// ── I15 발행 지연 ────────────────────────────────────────────────────

/** 사건 발생 후 최소 경과 시간을 지켰는지. 주제글(사건 없음)은 면제. */
export function checkPublicationDelay(draft: ComposeDraft, now: Date = new Date()): GateResult {
  const invariant = 'I15 발행 지연'
  if (!draft.event_occurred_at) {
    return {
      invariant,
      severity: 'critical',
      verdict: 'PASS',
      detail: '사건 시각 없음 — 시의성 없는 주제글로 hot-news 요건(시간 민감성) 자체가 성립하지 않는다.',
    }
  }
  const t = new Date(draft.event_occurred_at).getTime()
  if (Number.isNaN(t)) {
    return {
      invariant,
      severity: 'critical',
      verdict: 'FAIL',
      detail: `사건 시각을 읽을 수 없다 (${draft.event_occurred_at}). 지연 규칙을 검증할 수 없으므로 차단한다.`,
    }
  }
  const hours = (now.getTime() - t) / 3_600_000
  const min = COMPOSE_THRESHOLDS.minDelayHours
  if (hours < min) {
    return {
      invariant,
      severity: 'critical',
      verdict: 'FAIL',
      detail: `사건 후 ${hours.toFixed(1)}시간 — ${min}시간 미만. ${(min - hours).toFixed(1)}시간 뒤 재시도한다. 학습 지문의 가치는 속보성에서 나오지 않는다.`,
    }
  }
  return {
    invariant,
    severity: 'critical',
    verdict: 'PASS',
    detail: `사건 후 ${hours.toFixed(1)}시간 경과 (기준 ${min}시간).`,
  }
}

// ── I16 인용 정책 ────────────────────────────────────────────────────

/** 직접 인용이 공개 발언인지 · 길이 상한을 지켰는지. */
export function checkQuotePolicy(draft: ComposeDraft, facts: FactCard[]): GateResult {
  const invariant = 'I16 인용 정책'
  const byId = new Map(facts.map((f) => [f.id, f]))
  const used = draft.fact_order.map((id) => byId.get(id)).filter((f): f is FactCard => !!f)
  const quotes = used.filter((f) => f.kind === 'utterance')

  const exclusive = quotes.filter((f) => f.quote_is_public === false)
  if (exclusive.length > 0) {
    return {
      invariant,
      severity: 'critical',
      verdict: 'FAIL',
      detail: `독점 인터뷰 인용 ${exclusive.length}건(${exclusive.map((f) => f.id).join(', ')}). 기자가 발굴한 인용은 그 기사의 심장부다 — 간접 서술로 바꾸거나 뺀다.`,
    }
  }

  const max = COMPOSE_THRESHOLDS.maxQuoteWords
  const tooLong = quotes.filter((f) => (f.quote ?? '').trim().split(/\s+/).filter(Boolean).length > max)
  if (tooLong.length > 0) {
    return {
      invariant,
      severity: 'critical',
      verdict: 'FAIL',
      detail: `${max}어절을 넘는 직접 인용 ${tooLong.length}건(${tooLong.map((f) => f.id).join(', ')}). 발언의 요지만 우리 문장으로 옮긴다.`,
    }
  }

  return {
    invariant,
    severity: 'critical',
    verdict: 'PASS',
    detail: quotes.length === 0 ? '직접 인용 없음.' : `공개 발언 인용 ${quotes.length}건 · 전부 ${max}어절 이하.`,
  }
}

// ── 통합 실행 ────────────────────────────────────────────────────────

export interface ComposeGateInput {
  draft: ComposeDraft
  facts: FactCard[]
  /** 외부 취재 소스. **여기에 우리 글을 넣지 않는다** (I12 가 독립 출처로 세어 버린다). */
  sources: SourceRecord[]
  /**
   * 우리가 이미 발행한 글의 지문 — I17 전용.
   * ACP 와 소스가 9곳 겹치므로 같은 사건이 서가에 이미 있을 수 있다.
   */
  shelf?: SourceRecord[]
  /** 지연 판정 기준 시각 (테스트 주입용) */
  now?: Date
}

/**
 * 재저작 6게이트 일괄 실행. 순서는 비용순 — 싼 검사(지연·인용)가 먼저 떨어지게 한다.
 * critical FAIL 이 하나라도 있으면 발행 불가이며, DB 게이트가 최종 권위다.
 */
export function runComposeGates(input: ComposeGateInput): GateResult[] {
  const { draft, facts, sources, shelf, now } = input
  return [
    checkPublicationDelay(draft, now ?? new Date()),
    checkQuotePolicy(draft, facts),
    checkSourceIndependence(draft, facts, sources),
    checkStructureIndependence(draft, facts, sources),
    checkExpressionIndependence(draft, sources),
    checkShelfDuplication(draft, shelf ?? []),
  ]
}

/** 게이트 결과 → 발행 가능 여부. WARN 은 통과시키되 검수자에게 남긴다. */
export function isComposePublishable(results: GateResult[]): boolean {
  return !results.some((r) => r.severity === 'critical' && r.verdict === 'FAIL')
}
