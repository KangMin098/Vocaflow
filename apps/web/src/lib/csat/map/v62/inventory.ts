// apps/web/src/lib/csat/map/v62/inventory.ts
//
// v6.2 §8.1 ExamInventoryCoverage · §12.3 — 시험 정본 전체 문항 · 배점(분모) 대 실제 카탈로그(분자).
// 체제를 모르면 denominator=null · status unknown(0 % 도 100 % 도 아니다). 누락 · 중복 · 배점 불일치는 완전 지원을 막는다.
// 「현행 수능 독해 28문항 · 63점 카탈로그를 45문항 · 100점 시험의 100 % 로 보이기」는 명시적 실패 테스트다.

export type SupportStatus = 'supported' | 'partial' | 'unsupported' | 'unknown'

export interface ExamBlueprint {
  regime: string
  items: number
  points: number
  /** 영역 구간(번호 범위 · 배점 합) — 독해만 갖춘 카탈로그를 구분해 보고하려고 */
  sections: { id: 'listening' | 'reading'; from: number; to: number; points: number }[]
}

/**
 * 현행 영어 체제(2014 학년도 이후 수능 · 평가원 모평 · 교육청 학평 공통) — 45문항 · 100점 · 듣기 1–17(37점) · 독해 18–45(63점).
 * 2013 학년도 이전 체제(A · B 형 포함)는 여기에 넣지 않는다 — 독립 메타데이터 없이 추정하지 않는다(unknown).
 */
export const CURRENT_ENGLISH_BLUEPRINT: ExamBlueprint = {
  regime: 'english-45-100',
  items: 45,
  points: 100,
  sections: [
    { id: 'listening', from: 1, to: 17, points: 37 },
    { id: 'reading', from: 18, to: 45, points: 63 },
  ],
}

export interface CatalogItem {
  no: number
  points: number
}

export interface InventoryCoverage {
  examId: string
  regime: string | null
  /** 분모 — 체제를 모르면 null */
  denominator: { items: number; points: number } | null
  /** 분자 — 체제 번호 범위 안에서 서로 다른 문항만 */
  covered: { items: number; points: number }
  sections: { id: string; items: number; expectedItems: number; points: number; expectedPoints: number }[]
  issues: { kind: 'missing' | 'duplicate' | 'score_mismatch' | 'out_of_range'; no: number | null; detail: string }[]
  status: SupportStatus
}

/** 시험 하나의 카탈로그를 체제와 대조. blueprint=null(체제 미확인)이면 unknown */
export function examInventoryCoverage(examId: string, blueprint: ExamBlueprint | null, catalog: readonly CatalogItem[]): InventoryCoverage {
  if (!blueprint) {
    return { examId, regime: null, denominator: null, covered: { items: 0, points: 0 }, sections: [], issues: [], status: 'unknown' }
  }
  const issues: InventoryCoverage['issues'] = []
  const byNo = new Map<number, CatalogItem>()
  for (const it of catalog) {
    if (!Number.isInteger(it.no) || it.no < 1 || it.no > blueprint.items) {
      issues.push({ kind: 'out_of_range', no: it.no, detail: `번호 ${it.no} 는 1–${blueprint.items} 밖` })
      continue
    }
    if (byNo.has(it.no)) {
      issues.push({ kind: 'duplicate', no: it.no, detail: `번호 ${it.no} 중복` })
      continue
    }
    byNo.set(it.no, it)
  }
  for (let no = 1; no <= blueprint.items; no++) if (!byNo.has(no)) issues.push({ kind: 'missing', no, detail: `번호 ${no} 없음` })
  const sections = blueprint.sections.map((s) => {
    const inSec = [...byNo.values()].filter((i) => i.no >= s.from && i.no <= s.to)
    const points = inSec.reduce((a, i) => a + i.points, 0)
    return { id: s.id, items: inSec.length, expectedItems: s.to - s.from + 1, points, expectedPoints: s.points }
  })
  const covered = { items: byNo.size, points: [...byNo.values()].reduce((a, i) => a + i.points, 0) }
  const complete = covered.items === blueprint.items && !issues.some((i) => i.kind === 'missing' || i.kind === 'duplicate')
  if (complete && covered.points !== blueprint.points) issues.push({ kind: 'score_mismatch', no: null, detail: `배점 합 ${covered.points} ≠ ${blueprint.points}` })
  const blocking = issues.some((i) => i.kind !== 'missing')
  const status: SupportStatus = complete && !blocking ? 'supported' : covered.items === 0 ? 'unsupported' : 'partial'
  return { examId, regime: blueprint.regime, denominator: { items: blueprint.items, points: blueprint.points }, covered, sections, issues, status }
}

/** 표시 비율 — 분모가 없으면 null(0 % 로 보이지 않는다) */
export function coverageRatio(c: InventoryCoverage): number | null {
  if (!c.denominator || c.denominator.points === 0) return null
  return Math.round((c.covered.points / c.denominator.points) * 1000) / 10
}
