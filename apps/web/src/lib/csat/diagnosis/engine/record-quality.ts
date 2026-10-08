// apps/web/src/lib/csat/diagnosis/engine/record-quality.ts
//
// Record Quality Layer — 시험 기록 한 회의 **입력 신뢰도**를 응답 패턴만으로 판정한다(순수 함수 · DB 없음 · 저장 없음).
// 원칙(2026-10-03 사용자 결정):
//   · 기록 · 원 응답 · 점수는 지우지도 바꾸지도 않는다 — 진단 집계(역량 proxy · 함정 · 습관 · 추천 · 지도 · 원인 Pilot)에서만 뺀다.
//   · 「같은 번호 90%」 하나가 의미론이 아니다 — 여러 신호를 남기고, 규칙은 그 조합이다(QUALITY_RULES_VERSION 으로 버전 관리).
//   · 학생의 「실제로 풀었다」 확인은 이 품질 상태와 **다른 개념**이다(확인해도 신호는 지워지지 않는다 — 저장 구조는 Phase 2 승인 뒤).

export const QUALITY_RULES_VERSION = 'rq-1'

/**
 * trusted                — 진단 집계에 쓴다
 * suspicious             — 의심 신호가 있다. 확인 전까지 진단 집계에서 뺀다(보수적)
 * excluded_pending_review — 문항별 선택으로 볼 수 없는 일괄 입력(전 문항 같은 번호 등). 검토 전까지 진단 집계에서 뺀다
 */
export type RecordQualityStatus = 'trusted' | 'suspicious' | 'excluded_pending_review'

export interface RecordQualitySignals {
  /** 선지를 고른 문항 수(무응답 제외) */
  answered: number
  /** 가장 많이 고른 번호(동률이면 작은 번호) */
  dominantOption: number | null
  /** 그 번호의 비율 — answered 기준 */
  dominantRatio: number
  /** 문항 번호 순으로 같은 번호가 이어진 최대 길이 */
  longestStreak: number
  /** 고른 번호의 종류 수 */
  distinctOptions: number
}

export interface RecordQuality {
  status: RecordQualityStatus
  signals: RecordQualitySignals
  /** 판정 근거(사람이 읽는 문장) — 비어 있으면 trusted */
  reasons: string[]
  rulesVersion: string
}

/** 규칙 임계값 — rq-1. 정상 풀이가 확인된 기록이 쌓이면 분포를 보고 고친다(잠정값) */
export const RQ1 = {
  /** 이보다 적게 답한 기록은 패턴을 판정하지 않는다(우연히 몰릴 수 있다) */
  minAnswered: 20,
  /** 한 번호 비율이 이 이상이면 의심 */
  dominantRatio: 0.9,
  /** 같은 번호가 이만큼 연속이면 의심 */
  streak: 15,
} as const

export function recordQuality(answers: { no: number; chosen: number | null }[]): RecordQuality {
  const picked = [...answers].sort((a, b) => a.no - b.no).filter((a) => a.chosen !== null) as { no: number; chosen: number }[]
  const counts = new Map<number, number>()
  let longest = 0
  let run = 0
  let prev: number | null = null
  for (const a of picked) {
    counts.set(a.chosen, (counts.get(a.chosen) ?? 0) + 1)
    run = a.chosen === prev ? run + 1 : 1
    prev = a.chosen
    if (run > longest) longest = run
  }
  let dominantOption: number | null = null
  let top = 0
  for (const [opt, n] of [...counts.entries()].sort((x, y) => x[0] - y[0])) {
    if (n > top) {
      top = n
      dominantOption = opt
    }
  }
  const answered = picked.length
  const signals: RecordQualitySignals = {
    answered,
    dominantOption,
    dominantRatio: answered > 0 ? top / answered : 0,
    longestStreak: longest,
    distinctOptions: counts.size,
  }

  const reasons: string[] = []
  if (answered < RQ1.minAnswered) return { status: 'trusted', signals, reasons, rulesVersion: QUALITY_RULES_VERSION }

  if (signals.distinctOptions === 1) {
    reasons.push(`답한 ${answered}문항이 모두 ${dominantOption}번`)
    return { status: 'excluded_pending_review', signals, reasons, rulesVersion: QUALITY_RULES_VERSION }
  }
  if (signals.dominantRatio >= RQ1.dominantRatio) reasons.push(`${dominantOption}번이 ${Math.round(signals.dominantRatio * 100)}%`)
  if (signals.longestStreak >= RQ1.streak) reasons.push(`같은 번호 ${signals.longestStreak}문항 연속`)
  return { status: reasons.length > 0 ? 'suspicious' : 'trusted', signals, reasons, rulesVersion: QUALITY_RULES_VERSION }
}

/** 진단 집계에 쓸 수 있는가 — trusted 만 */
export const isDiagnosable = (q: RecordQuality) => q.status === 'trusted'

export const QUALITY_LABEL: Record<RecordQualityStatus, string> = {
  trusted: '진단에 사용',
  suspicious: '입력 확인 필요 — 진단에서 제외',
  excluded_pending_review: '한 번호로 입력된 기록 — 진단에서 제외',
}
