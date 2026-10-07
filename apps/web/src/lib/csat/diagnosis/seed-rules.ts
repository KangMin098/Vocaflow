// apps/web/src/lib/csat/diagnosis/seed-rules.ts
//
// 문항 역량 시드 규칙(유형 기본값) — 사람 검수 전 출발점. 검수 완료로 세지 않는다(source=type_default).
//   · seed-v1 = 마이그레이션 20261001150000 의 csat_dx_type_attribute 값 그대로(TYPE_BASE_V1 — 테스트가 SQL 과 대조한다)
//   · seed-v2 = v1 + 일반 규칙 4개(2026-10-08 · M2409 파일럿 근거 — docs/csat-learner/pilot-runs/seed-rules-v2-M2409-20261008.md)
// 규칙은 **유형 ID 와 문항 형태(선지 낱말 수)만** 본다 — 시험 · 문항 번호 · 정답 예외를 두지 않는다.
// 순수 함수 — DB · 시계에 접근하지 않는다.

import { ATTRIBUTE_CODES, type AttributeCode } from './engine/types'

export type Weights = Record<AttributeCode, number>
export type SeedVersion = 'seed-v1' | 'seed-v2'

/** 마이그레이션 20261001150000 §8-3 과 같은 값(0 이 아닌 것만) */
export const TYPE_BASE_V1: Readonly<Record<string, Partial<Record<AttributeCode, number>>>> = {
  'R-PURPOSE': { A1: 1, A3: 1, A4: 1, A5: 1 },
  'R-MOOD': { A1: 2, A5: 1 },
  'R-CLAIM': { A3: 1, A4: 2, A5: 1 },
  'R-IMPLY': { A1: 1, A2: 1, A4: 2, A6: 1 },
  'R-GIST': { A3: 1, A4: 2, A5: 1 },
  'R-TOPIC': { A1: 1, A3: 1, A4: 2 },
  'R-TITLE': { A3: 1, A4: 2, A6: 1 },
  'R-CHART': { A5: 2, A9: 1 },
  'R-FACT': { A2: 1, A5: 2 },
  'R-NOTICE': { A5: 2, A9: 1 },
  'R-GRAMMAR': { A2: 1, A8: 2 },
  'R-VOCAB': { A1: 2, A3: 1 },
  'R-BLANK': { A1: 1, A2: 1, A3: 2, A4: 2, A6: 1 },
  'R-BLANK2': { A3: 2, A4: 1 },
  'R-IRRELEVANT': { A3: 2 },
  'R-ORDER': { A2: 1, A3: 2 },
  'R-INSERT': { A2: 1, A3: 2 },
  'R-SUMMARY': { A1: 1, A4: 2 },
  'R-REFER': { A2: 1, A3: 1 },
  'X-TITLE': { A3: 1, A4: 2, A9: 1 },
  'X-BLANK': { A3: 2, A4: 1, A9: 1 },
  'X-BLANK2': { A3: 2, A4: 1, A9: 1 },
  'X-VOCAB': { A1: 2, A3: 1, A9: 1 },
  'X-ORDER': { A3: 2, A9: 1 },
  'X-REFER': { A2: 1, A3: 1, A9: 1 },
  'X-FACT': { A5: 2, A9: 1 },
}

/** 흐름 유형 — 문장 사이 연결로 답이 정해지는 유형(순서 · 삽입 · 무관 · 지칭 · 빈칸) */
export const FLOW_TYPES: readonly string[] = ['R-ORDER', 'R-INSERT', 'R-IRRELEVANT', 'R-REFER', 'X-ORDER', 'X-REFER', 'R-BLANK', 'R-BLANK2', 'X-BLANK', 'X-BLANK2']
/** 빈칸 · 요약 — 선지가 들어갈 말을 고르는 유형 */
export const FILL_TYPES: readonly string[] = ['R-BLANK', 'R-BLANK2', 'X-BLANK', 'X-BLANK2', 'R-SUMMARY']
/** 문맥 어휘 */
export const CONTEXT_VOCAB_TYPES: readonly string[] = ['R-VOCAB', 'X-VOCAB']
/** 대의 계열 — 글 전체의 중심을 묻는 유형(함축 의미는 표현 해석이라 제외) */
export const GIST_TYPES: readonly string[] = ['R-PURPOSE', 'R-MOOD', 'R-CLAIM', 'R-GIST', 'R-TOPIC', 'R-TITLE', 'X-TITLE']
/** 선지가 「낱말」로 보는 칸당 최대 낱말 수 */
export const WORD_CHOICE_MAX = 2

export interface SeedItem {
  type: string
  /** 선지 칸마다 낱말 수의 최댓값(요약 「A …… B」 는 칸별로 센다). 모르면 null → 규칙 2 를 적용하지 않는다 */
  choiceWords: number | null
}

export interface SeedRule {
  id: 'R1-flow-no-secondary-A2' | 'R2-fill-word-choice-A1' | 'R3-context-vocab-A3' | 'R4-gist-A3-min'
  label: string
  why: string
  applies: (it: SeedItem) => boolean
  apply: (w: Weights) => void
}

export const SEED_RULES_V2: readonly SeedRule[] = [
  {
    id: 'R1-flow-no-secondary-A2',
    label: '흐름 유형은 보조 구문(A2=1)을 달지 않는다',
    why: '흐름 문항의 긴 문장은 흐름 판단의 재료일 뿐이다 — 보조 A2 가 흐름 오답을 「문장 이해」 추천으로 끌었다(M2409 v1 파일럿). 핵심 A2(2)는 건드리지 않는다',
    applies: (it) => FLOW_TYPES.includes(it.type),
    apply: (w) => { if (w.A2 === 1) w.A2 = 0 },
  },
  {
    id: 'R2-fill-word-choice-A1',
    label: '빈칸 · 요약에서 선지가 낱말이면 어휘(A1)를 핵심(2)으로',
    why: '선지가 추상 낱말 하나(또는 낱말 쌍)면 그 낱말의 뜻을 아는지가 정답을 가른다. 구 · 절 선지는 문장 의미 판단이라 A1 을 올리지 않는다',
    applies: (it) => FILL_TYPES.includes(it.type) && it.choiceWords !== null && it.choiceWords <= WORD_CHOICE_MAX,
    apply: (w) => { w.A1 = 2 },
  },
  {
    id: 'R3-context-vocab-A3',
    label: '문맥 어휘는 흐름(A3)을 핵심(2)으로',
    why: '밑줄 낱말이 문맥에 맞는지(극성 · 방향)는 앞뒤 문장의 흐름으로 판단한다 — 낱말 뜻만으로 풀리지 않는다',
    applies: (it) => CONTEXT_VOCAB_TYPES.includes(it.type),
    apply: (w) => { w.A3 = 2 },
  },
  {
    id: 'R4-gist-A3-min',
    label: '대의 계열은 흐름(A3)을 최소 보조(1)로',
    why: '중심 내용은 대조 · 전환 · 인과 표지를 따라 드러난다. 핵심(2)까지 올릴지는 문항마다 달라(M2409: 주장 · 주제는 2, 요지 · 제목은 1) 유형 규칙으로 올리지 않는다',
    applies: (it) => GIST_TYPES.includes(it.type),
    apply: (w) => { if (w.A3 < 1) w.A3 = 1 },
  },
]

const zero = (): Weights => Object.fromEntries(ATTRIBUTE_CODES.map((c) => [c, 0])) as Weights

/** 유형 기본값 시드(9개 모두, 0 포함). 모르는 유형이면 전부 0 */
export function seedWeights(it: SeedItem, version: SeedVersion = 'seed-v2'): { weights: Weights; rules: SeedRule['id'][] } {
  const w = zero()
  for (const [c, v] of Object.entries(TYPE_BASE_V1[it.type] ?? {})) w[c as AttributeCode] = v as number
  const rules: SeedRule['id'][] = []
  if (version === 'seed-v2') {
    for (const r of SEED_RULES_V2) {
      if (!r.applies(it)) continue
      const before = JSON.stringify(w)
      r.apply(w)
      if (JSON.stringify(w) !== before) rules.push(r.id)
    }
  }
  return { weights: w, rules }
}

// ── 시드 ↔ 검수 비교 ──────────────────────────────────────────────────────────

export type DiffKind = 'add' | 'remove' | 'reweight'
export interface ItemDiff {
  no: number
  type: string
  seed: Weights
  review: Weights
  diffs: { code: AttributeCode; seed: number; review: number; kind: DiffKind }[]
  /** 1 = 완전 일치 · 2 = 가중치만 다름 · 3 = 역량 추가/삭제가 다름 */
  tier: 1 | 2 | 3
  rules: SeedRule['id'][]
}

export function diffItem(no: number, type: string, seed: Weights, review: Weights, rules: SeedRule['id'][] = []): ItemDiff {
  const diffs: ItemDiff['diffs'] = []
  for (const code of ATTRIBUTE_CODES) {
    const a = seed[code] ?? 0
    const b = review[code] ?? 0
    if (a === b) continue
    diffs.push({ code, seed: a, review: b, kind: a === 0 ? 'add' : b === 0 ? 'remove' : 'reweight' })
  }
  const tier = diffs.length === 0 ? 1 : diffs.every((d) => d.kind === 'reweight') ? 2 : 3
  return { no, type, seed, review, diffs, tier, rules }
}

export interface DiffSummary {
  items: number
  unchanged: number
  changedItems: number
  addedItems: number
  removedItems: number
  reweightedItems: number
  changes: number
  byCode: Record<AttributeCode, number>
  byType: Record<string, { items: number; unchanged: number; changes: number }>
  tiers: Record<1 | 2 | 3, number>
}

export function summarize(diffs: ItemDiff[]): DiffSummary {
  const s: DiffSummary = {
    items: diffs.length, unchanged: 0, changedItems: 0, addedItems: 0, removedItems: 0, reweightedItems: 0, changes: 0,
    byCode: Object.fromEntries(ATTRIBUTE_CODES.map((c) => [c, 0])) as Record<AttributeCode, number>,
    byType: {}, tiers: { 1: 0, 2: 0, 3: 0 },
  }
  for (const d of diffs) {
    const t = (s.byType[d.type] ??= { items: 0, unchanged: 0, changes: 0 })
    t.items++
    t.changes += d.diffs.length
    s.tiers[d.tier]++
    s.changes += d.diffs.length
    if (d.diffs.length === 0) { s.unchanged++; t.unchanged++; continue }
    s.changedItems++
    if (d.diffs.some((x) => x.kind === 'add')) s.addedItems++
    if (d.diffs.some((x) => x.kind === 'remove')) s.removedItems++
    if (d.diffs.some((x) => x.kind === 'reweight')) s.reweightedItems++
    for (const x of d.diffs) s.byCode[x.code]++
  }
  return s
}

// ── 추천 민감도(오프라인 근사) ──────────────────────────────────────────────────
// 엔진과 같은 단위: 역량값 = 그 역량에 **연결(가중치 > 0)**된 문항의 Σ(배점 × 정답) / Σ배점 (map-evidence attributePoints —
// 역량 가중치는 연결 여부로만 쓰이고 곱해지지 않는다. 그래서 핵심(2) ↔ 보조(1) 변경은 학습 지도 추천을 바꾸지 않는다),
// 핵심 축 관찰값 = 축 역량들의 값을 그 역량에 연결된 문항 배점 합으로 가중 평균(map/core coreSummary),
// 후보 = 관찰값 < weak 인 축을 낮은 순으로 최대 2(같은 함수 규칙). 듣기(A7)는 데이터 없음이라 뺀다.
// 시험 한 회 · 같은 날 기록 하나만 가정한다(감쇠 · 확신 태그 없음) — 실제 엔진 결과와의 일치는 pilot-run 로그로 검산한다.

export const AXIS_LINES: Readonly<Record<string, AttributeCode[]>> = { V: ['A1'], S: ['A2', 'A8'], R: ['A3', 'A6'], E: ['A4', 'A5'], X: ['A9'] }

export interface TaggedItem { no: number; points: number; weights: Weights }
export interface Ranking {
  attr: Partial<Record<AttributeCode, number>>
  /** 역량별 연결 문항 수(근거 부족 역량 포함) */
  attrN: Partial<Record<AttributeCode, number>>
  /** n =축에 연결된 문항 수(역량별 합 — 한 문항이 두 역량이면 둘로 센다) */
  axes: { axis: string; observed: number; n: number }[]
  candidates: string[]
  /** 1위와 2위 축 관찰값 차(2위 축이 없으면 null) */
  gap: number | null
}

/**
 * weighted = 비교 실험용(제품 경로 아님): 역량값 = Σ(가중치 × 배점 × 정답) / Σ(가중치 × 배점), 축 가중도 Σ(가중치 × 배점).
 * 기본(binary)은 지금 엔진과 같다.
 */
export function rank(items: TaggedItem[], wrong: ReadonlySet<number>, weak = 0.6, minObs = 5, weighted = false): Ranking {
  const num: Record<string, number> = {}
  const den: Record<string, number> = {}
  const n: Record<string, number> = {}
  const pts: Record<string, number> = {}
  for (const it of items) {
    for (const c of ATTRIBUTE_CODES) {
      const w = it.weights[c]
      if (!w || c === 'A7') continue
      const k = weighted ? w : 1
      num[c] = (num[c] ?? 0) + k * it.points * (wrong.has(it.no) ? 0 : 1)
      den[c] = (den[c] ?? 0) + k * it.points
      n[c] = (n[c] ?? 0) + 1
      pts[c] = (pts[c] ?? 0) + k * it.points
    }
  }
  const attr: Ranking['attr'] = {}
  for (const c of ATTRIBUTE_CODES) if ((n[c] ?? 0) >= minObs && den[c] > 0) attr[c] = num[c] / den[c]
  const axes: Ranking['axes'] = []
  for (const [axis, lines] of Object.entries(AXIS_LINES)) {
    let wsum = 0, esum = 0, cnt = 0
    for (const c of lines) {
      const v = attr[c]
      if (v === undefined) continue
      wsum += pts[c]
      esum += pts[c] * v
      cnt += n[c]
    }
    if (wsum > 0) axes.push({ axis, observed: esum / wsum, n: cnt })
  }
  axes.sort((a, b) => a.observed - b.observed)
  const candidates = axes.filter((a) => a.observed < weak).slice(0, 2).map((a) => a.axis)
  return { attr, attrN: n as Ranking['attrN'], axes, candidates, gap: axes.length >= 2 ? axes[1].observed - axes[0].observed : null }
}

export interface Perturbation { no: number; code: AttributeCode; from: number; to: number; kind: 'secondary_add' | 'secondary_remove' | 'core_change' }

/** 태그 하나만 바꾼 모든 경우 — 보조 추가(0→1) · 보조 제거(1→0) · 핵심 변경(2↔1). A7 은 제외 */
export function singlePerturbations(items: TaggedItem[]): Perturbation[] {
  const out: Perturbation[] = []
  for (const it of items) {
    for (const code of ATTRIBUTE_CODES) {
      if (code === 'A7') continue
      const w = it.weights[code]
      if (w === 0) out.push({ no: it.no, code, from: 0, to: 1, kind: 'secondary_add' })
      else if (w === 1) out.push({ no: it.no, code, from: 1, to: 0, kind: 'secondary_remove' }, { no: it.no, code, from: 1, to: 2, kind: 'core_change' })
      else out.push({ no: it.no, code, from: 2, to: 1, kind: 'core_change' })
    }
  }
  return out
}

export function applyPerturbation(items: TaggedItem[], p: Perturbation): TaggedItem[] {
  return items.map((it) => (it.no === p.no ? { ...it, weights: { ...it.weights, [p.code]: p.to } } : it))
}

/** 결정적 의사난수(시드 고정) — 합성 학습자 표본용 */
export function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
