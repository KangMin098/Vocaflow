// apps/web/src/lib/csat/diagnosis/engine/map-evidence.ts
//
// 학습 지도용 성취율 — 기존 진단 지표(attribute_mastery · trap_vulnerability)는 그대로 두고, 지도의 목표율과
// **같은 기준(연결 문항의 배점 가중)** 으로 비교할 값을 가산한다. 스냅샷 `evidence` 에 새 키로 저장된다.
//   · lineAccuracy   — B 라인(유형): 응답이 속한 B 라인별 배점 가중 정답률
//   · attributePoints — A 라인(역량): 그 역량에 연결(weight>0)된 문항의 배점 가중 정답률
//   · trapAvoidance  — C 라인(함정): 그 계열 함정 선지가 있는 문항에서 그 함정을 고르지 않은 배점 가중 비율
// 순수 함수 — DB · 시계에 접근하지 않는다(now 는 엔진 입력에서). 정답률은 확신 태그로 깎지 않는 단순 정답(1/0)이다 —
// 목표율이 「반드시 맞혀야 하는 문항」의 배점 비율이라 같은 단위(맞혔나)로 비교해야 한다.

import { TRAP_FAMILIES, type AttributeCode, type EngineInput, type ResponseIn, type SessionIn, type TrapFamily } from './types'
import { decay, diagnosedResponses, modeWeight } from './rule-v1'

export interface MapLineInput {
  /** 문항 유형 → B 라인(B6–B13 등, 승인된 표) */
  byType: Record<string, string>
  /** 시험 → 문항 번호 → B 라인(듣기 등 유형 메타가 없는 번호, 회차별로 승인된 표만) */
  byNo: Record<string, Record<number, string>>
  /** `${examId}#${no}` → 문항 유형(csat_items.type_id). 없으면 null */
  typeOf: Record<string, string | null>
  /** `${examId}#${no}` → 배점(csat_dx_answer_key.points). 진단 테스트 문항의 원시험 배점도 여기 들어 있어야 한다 */
  pointsOf: Record<string, number>
}

export interface LineStat {
  /** 이 지표에 실제 기여한 응답 수(가중 0 · 배점 결측 · 무응답(함정) 제외) */
  n: number
  /** 배점 가중 비율 0~1. 근거 부족이면 null */
  value: number | null
  status: 'ok' | 'insufficient'
  /** 배점을 못 찾아 빠진 응답 수 */
  unweighted: number
}

export interface MapEvidence {
  lineAccuracy: Record<string, LineStat>
  attributePoints: Record<string, LineStat>
  trapAvoidance: Record<string, LineStat>
}

interface Acc {
  num: number
  den: number
  n: number
  unweighted: number
}

const keyOf = (examId: string, no: number) => `${examId}#${no}`
const round3 = (v: number) => Math.round(v * 1000) / 1000

function add(map: Record<string, Acc>, code: string, weight: number, points: number | undefined, hit: boolean) {
  const a = (map[code] ??= { num: 0, den: 0, n: 0, unweighted: 0 })
  if (points === undefined) {
    a.unweighted += 1
    return
  }
  a.num += weight * points * (hit ? 1 : 0)
  a.den += weight * points
  a.n += 1
}

function finish(map: Record<string, Acc>, minObservations: number): Record<string, LineStat> {
  const out: Record<string, LineStat> = {}
  for (const [code, a] of Object.entries(map)) {
    const ok = a.n >= minObservations && a.den > 0
    out[code] = { n: a.n, value: ok ? round3(a.num / a.den) : null, status: ok ? 'ok' : 'insufficient', unweighted: a.unweighted }
  }
  return out
}

/** 응답의 (시험, 번호). 진단 테스트 응답은 itemNo 가 원시험 번호와 다를 수 있어 문항 메타의 번호를 쓴다. */
function locate(input: EngineInput, s: SessionIn, r: ResponseIn): { examId: string; no: number; hasMeta: boolean } | null {
  if (s.mode === 'diagnostic') {
    const meta = r.itemId ? input.items[r.itemId] : undefined
    return meta ? { examId: meta.examId, no: meta.no, hasMeta: true } : null
  }
  return s.examId ? { examId: s.examId, no: r.itemNo, hasMeta: false } : null
}

export function computeMapEvidence(input: EngineInput, lines: MapLineInput): MapEvidence {
  const minObs = input.settings.min_observations
  const weightOf = (s: SessionIn) => decay(input.now, s.takenAt, input.settings.half_life_days) * modeWeight(input, s)

  // B — 정답표가 있는 모든 시험 기록(diagnosis_ready 와 무관) + 진단 테스트
  const b: Record<string, Acc> = {}
  for (const s of input.sessions) {
    const w = weightOf(s)
    if (w <= 0) continue
    for (const r of s.responses) {
      const at = locate(input, s, r)
      if (!at) continue
      const k = keyOf(at.examId, at.no)
      const type = lines.typeOf[k] ?? null
      const line = type ? lines.byType[type] : lines.byNo[at.examId]?.[at.no]
      if (line) add(b, line, w, lines.pointsOf[k], r.isCorrect)
    }
  }

  // A · C — 기존 진단과 같은 응답 범위(준비된 시험 + 진단 테스트)
  const a: Record<string, Acc> = {}
  const c: Record<string, Acc> = {}
  const { listening } = input.settings
  for (const row of diagnosedResponses(input)) {
    const w = weightOf(row.session)
    if (w <= 0) continue
    const at = locate(input, row.session, row.response) ?? (row.session.examId ? { examId: row.session.examId, no: row.response.itemNo, hasMeta: false } : null)
    if (!at) continue
    const points = lines.pointsOf[keyOf(at.examId, at.no)]
    const codes: AttributeCode[] = row.meta
      ? (Object.entries(row.meta.attributes).filter(([, wt]) => (wt ?? 0) > 0).map(([code]) => code) as AttributeCode[])
      : row.listening && listening.weight > 0
        ? [listening.attribute]
        : []
    for (const code of codes) add(a, code, w, points, row.response.isCorrect)

    // 무응답 · 시간 초과로 비운 답은 함정을 「피했다」로 세지 않는다 — 관측에서 뺀다
    if (row.meta && row.response.chosen !== null && row.response.confidence !== 'timeout') {
      const families = new Set<TrapFamily>()
      for (const key of Object.values(row.meta.optionTraps)) {
        const f = key ? input.trapFamily[key] : null
        if (f && (TRAP_FAMILIES as readonly string[]).includes(f)) families.add(f as TrapFamily)
      }
      const pickedKey = row.meta.optionTraps[row.response.chosen]
      const pickedFamily = pickedKey ? (input.trapFamily[pickedKey] ?? null) : null
      for (const f of families) add(c, f, w, points, !(pickedFamily === f && !row.response.isCorrect))
    }
  }

  return { lineAccuracy: finish(b, minObs), attributePoints: finish(a, minObs), trapAvoidance: finish(c, input.settings.trap.min_exposure) }
}
