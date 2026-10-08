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
import { byDate, decay, diagnosedResponses, diagnosticInput, isExamSession, modeWeight } from './rule-v1'

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
  /** 배점 가중 비율 0~1 — **반올림하지 않은 원래 값**(1999/2000 이 100% 로 저장되어 달성으로 판정되면 안 된다. 표시할 때만 반올림). 근거 부족이면 null */
  value: number | null
  status: 'ok' | 'insufficient'
  /** 배점을 못 찾아 빠진 응답 수 */
  unweighted: number
  /** value 의 분모(배점 × 감쇠 가중 합) — 학습 지도 순위의 축소 추정(core RANKING_SHRINK)이 쓴다. 2026-10-08 이전 스냅샷에는 없다 */
  den?: number
}

/** 습관 신호 하나를 지금 근거로 판정할 수 있는가 — 신호가 없을 때 「해소됨」과 「판단 불가」를 가른다 */
export interface HabitEvaluable {
  evaluable: boolean
  /** 판정에 쓴 관측 수 */
  n: number
  /** 판정에 필요한 관측 수 */
  need: number
}

/**
 * 틀린 V(A1) 문항이 다른 축 태그와 함께 붙은 수(2026-10-08 · 축 관측 특성 routing) — V 는 기출에 단독 문항이 없어(평가원 29/29 회)
 * V 가 낮게 보이면 그 근거 문항이 R · E · X 와 얼마나 겹치는지로 「무엇과 가를지」를 고른다. 가중 0 기록 · 메타 없는 응답 제외. 옛 스냅샷에는 없다.
 */
export interface VOverlap { wrongV: number; R: number; E: number; X: number }

export interface MapEvidence {
  lineAccuracy: Record<string, LineStat>
  attributePoints: Record<string, LineStat>
  vOverlap?: VOverlap
  trapAvoidance: Record<string, LineStat>
  habitEvaluable: Record<string, HabitEvaluable>
}

interface Acc {
  num: number
  den: number
  n: number
  unweighted: number
}

const keyOf = (examId: string, no: number) => `${examId}#${no}`

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
    out[code] = { n: a.n, value: ok ? a.num / a.den : null, status: ok ? 'ok' : 'insufficient', unweighted: a.unweighted, den: a.den }
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

export function computeMapEvidence(raw: EngineInput, lines: MapLineInput): MapEvidence {
  // 품질 통과 기록만 — 일괄 입력 기록은 지도 관찰값에 들어가지 않는다(Record Quality Layer)
  const input = diagnosticInput(raw)
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
  const vOverlap: VOverlap = { wrongV: 0, R: 0, E: 0, X: 0 }
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
    if (row.meta && !row.response.isCorrect && (row.meta.attributes.A1 ?? 0) > 0) {
      const at = row.meta.attributes
      vOverlap.wrongV++
      if ((at.A3 ?? 0) > 0 || (at.A6 ?? 0) > 0) vOverlap.R++
      if ((at.A4 ?? 0) > 0 || (at.A5 ?? 0) > 0) vOverlap.E++
      if ((at.A9 ?? 0) > 0) vOverlap.X++
    }

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

  return {
    lineAccuracy: finish(b, minObs),
    attributePoints: finish(a, minObs),
    vOverlap,
    trapAvoidance: finish(c, input.settings.trap.min_exposure),
    habitEvaluable: habitEvaluable(input),
  }
}

/**
 * 습관마다 「지금 근거로 신호 부재를 확정할 수 있나」. 활성 판정(rule-v1 habitFlags)과 같은 입력 집합 · 설정값을 쓴다 —
 * 신호가 여러 분기 중 하나로 켜지는 습관은 **모든 분기의 자료가 갖춰질 때만** evaluable.
 */
export function habitEvaluable(raw: EngineInput): Record<string, HabitEvaluable> {
  const input = diagnosticInput(raw)
  const h = input.settings.habits
  const minObs = input.settings.min_observations
  const minExposure = input.settings.trap.min_exposure
  const exams = input.sessions.filter(isExamSession).sort(byDate)
  const latest = exams[exams.length - 1]
  const rows = diagnosedResponses(input)
  const out: Record<string, HabitEvaluable> = {}

  // 시간 붕괴 — 최근 시험에 구간(from~to) 응답이 있어야 한다
  const tail = latest ? latest.responses.filter((r) => r.itemNo >= h.time_collapse.from_no && r.itemNo <= h.time_collapse.to_no).length : 0
  out.time_collapse = { evaluable: tail > 0, n: tail, need: 1 }

  // 추측 풀이 — 확신 태그 분기(응답이 있으면 충족) + 오답률 분기(공식 오답률이 있는 문항이 있어야 한다). 둘 다 갖춰야 부재를 확정한다
  const exam = latest?.examId ? input.exams[latest.examId] : undefined
  const rated = latest ? latest.responses.filter((r) => typeof exam?.items[r.itemNo]?.errorRate === 'number').length : 0
  out.guessing = { evaluable: Boolean(latest) && latest.responses.length > 0 && rated > 0, n: rated, need: 1 }

  // 단어 재활용 — ⓐ 계열 확인 오답이 표본 기준을 채우면 기존 판정 그대로 ⓑ 모자라면 그 계열 함정 문항에 충분히 응답했고 그 계열을 한 번도 안 골랐을 때만
  {
    const family = h.word_reuse.family
    let wrongWithFamily = 0
    let exposure = 0
    let picks = 0
    for (const { response, meta } of rows) {
      if (!meta) continue
      const famOf = (key: string | undefined) => (key ? (input.trapFamily[key] ?? null) : null)
      const hasFamily = Object.values(meta.optionTraps).some((k) => famOf(k) === family)
      if (hasFamily && response.chosen !== null) exposure += 1
      if (!response.isCorrect && response.chosen !== null && famOf(meta.optionTraps[response.chosen]) !== null) {
        wrongWithFamily += 1
        if (famOf(meta.optionTraps[response.chosen]) === family) picks += 1
      }
    }
    const ok = wrongWithFamily >= minExposure || (exposure >= minExposure && picks === 0)
    out.word_reuse = { evaluable: ok, n: Math.max(wrongWithFamily, exposure), need: minExposure }
  }

  // 90점 커트라인 — 점수가 있는 live 시험이 기준 회수 이상
  const lives = exams.filter((s) => s.mode === 'live' && s.rawScore !== null).length
  out.cutline_90 = { evaluable: lives >= h.cutline_90.sessions, n: lives, need: h.cutline_90.sessions }

  // EBS 의존 — 연계 · 비연계 문항 응답이 각각 관측 기준 이상
  const linked = rows.filter((r) => r.meta?.ebsLinked === true).length
  const unlinked = rows.filter((r) => r.meta?.ebsLinked === false).length
  out.ebs = { evaluable: linked >= minObs && unlinked >= minObs, n: Math.min(linked, unlinked), need: minObs }

  // 듣기 소홀 — 최근 연속 N회 시험이 있어야 한다
  out.listening = { evaluable: exams.length >= h.listening.consecutive, n: Math.min(exams.length, h.listening.consecutive), need: h.listening.consecutive }

  return out
}
