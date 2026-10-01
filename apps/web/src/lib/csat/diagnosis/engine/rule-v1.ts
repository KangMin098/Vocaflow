// apps/web/src/lib/csat/diagnosis/engine/rule-v1.ts
//
// 규칙 기반 진단 엔진 v1. 모든 수치는 settings 에서 읽는다(하드코딩 금지).
// 원칙:
//   · diagnosis_ready 가 아닌 시험은 점수·등급만 — 역량·함정·습관 진단에서 뺀다
//   · 관측이 모자란 역량은 0 이 아니라 「데이터 부족」(value null)
//   · 공식 오답률이 없으면 난이도 보정을 하지 않고 adjusted=false 로 알린다

import { adjustScore, clampScore, expectedScore, gradeOf, round1 } from './scoring'
import {
  ATTRIBUTE_CODES,
  TRAP_FAMILIES,
  type AttributeCode,
  type AttributeMastery,
  type ConfidenceLevel,
  type DiagnosisEngine,
  type DiagnosisResult,
  type EngineInput,
  type ExamMeta,
  type HabitFlag,
  type ItemMeta,
  type RecommendedLine,
  type ResponseIn,
  type ScenarioForecast,
  type SessionIn,
  type TrapFamily,
  type TrapVulnerability,
} from './types'

export const ENGINE_VERSION = 'rule-v1'

const DAY_MS = 86_400_000

function ageDays(now: Date, takenAt: string): number {
  const t = Date.parse(`${takenAt}T00:00:00Z`)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, (now.getTime() - t) / DAY_MS)
}

function decay(now: Date, takenAt: string, halfLife: number): number {
  return halfLife > 0 ? Math.pow(0.5, ageDays(now, takenAt) / halfLife) : 1
}

const isExamSession = (s: SessionIn) => s.examId !== null && (s.mode === 'live' || s.mode === 'retake' || s.mode === 'app')

function byDate(a: SessionIn, b: SessionIn) {
  return a.takenAt < b.takenAt ? -1 : a.takenAt > b.takenAt ? 1 : 0
}

/** 진단(역량·함정)에 쓸 수 있는 응답 — 준비된 시험의 응답 또는 진단 테스트 응답 */
interface DiagnosedResponse {
  session: SessionIn
  response: ResponseIn
  meta: ItemMeta | null
  listening: boolean
}

function diagnosedResponses(input: EngineInput): DiagnosedResponse[] {
  const out: DiagnosedResponse[] = []
  const listenTo = input.settings.habits.listening.to_no
  for (const s of input.sessions) {
    if (s.mode === 'diagnostic') {
      for (const r of s.responses) {
        const meta = r.itemId ? input.items[r.itemId] ?? null : null
        if (meta) out.push({ session: s, response: r, meta, listening: false })
      }
      continue
    }
    const exam = s.examId ? input.exams[s.examId] : undefined
    if (!exam?.ready) continue
    for (const r of s.responses) {
      const meta = exam.items[r.itemNo] ?? null
      out.push({ session: s, response: r, meta, listening: !meta && r.itemNo <= listenTo })
    }
  }
  return out
}

function modeWeight(input: EngineInput, s: SessionIn): number {
  return s.mode === 'retake' ? input.settings.retake_weight : 1
}

function credit(input: EngineInput, r: ResponseIn): number {
  return r.isCorrect ? input.settings.credit[r.confidence] ?? 0 : 0
}

export function attributeMastery(input: EngineInput, rows = diagnosedResponses(input)): Record<AttributeCode, AttributeMastery> {
  const num: Record<string, number> = {}
  const den: Record<string, number> = {}
  const n: Record<string, number> = {}
  const { listening } = input.settings
  for (const row of rows) {
    const w0 = decay(input.now, row.session.takenAt, input.settings.half_life_days) * modeWeight(input, row.session)
    if (w0 <= 0) continue // 가중 0(예: retake_weight 0)은 관측으로 세지 않는다 — 기여 없는 응답이 「데이터 충분」을 만들지 않게
    const weights: Partial<Record<AttributeCode, number>> = row.meta
      ? row.meta.attributes
      : row.listening
        ? { [listening.attribute]: listening.weight }
        : {}
    for (const [code, weight] of Object.entries(weights)) {
      if (!weight) continue
      const w = weight * w0
      num[code] = (num[code] ?? 0) + w * credit(input, row.response)
      den[code] = (den[code] ?? 0) + w
      n[code] = (n[code] ?? 0) + 1
    }
  }
  const out = {} as Record<AttributeCode, AttributeMastery>
  for (const code of ATTRIBUTE_CODES) {
    const count = n[code] ?? 0
    const ok = count >= input.settings.min_observations && (den[code] ?? 0) > 0
    out[code] = {
      value: ok ? Math.round((num[code] / den[code]) * 1000) / 1000 : null,
      n: count,
      status: ok ? 'ok' : 'insufficient',
    }
  }
  return out
}

function familyOf(input: EngineInput, trapKey: string | undefined): TrapFamily | null {
  if (!trapKey) return null
  const f = input.trapFamily[trapKey]
  return f && (TRAP_FAMILIES as readonly string[]).includes(f) ? (f as TrapFamily) : null
}

export function trapVulnerability(
  input: EngineInput,
  rows = diagnosedResponses(input),
): Partial<Record<TrapFamily, TrapVulnerability>> {
  const acc: Partial<Record<TrapFamily, { exposure: number; picked: number; items: Set<string> }>> = {}
  for (const { response, meta } of rows) {
    if (!meta) continue
    const families = new Set<TrapFamily>()
    for (const key of Object.values(meta.optionTraps)) {
      const f = familyOf(input, key)
      if (f) families.add(f)
    }
    if (families.size === 0) continue
    const pickedFamily = response.chosen !== null ? familyOf(input, meta.optionTraps[response.chosen]) : null
    for (const f of families) {
      const a = (acc[f] ??= { exposure: 0, picked: 0, items: new Set() })
      a.exposure += 1
      if (pickedFamily === f && !response.isCorrect) {
        a.picked += 1
        a.items.add(meta.itemId)
      }
    }
  }
  const out: Partial<Record<TrapFamily, TrapVulnerability>> = {}
  const { min_exposure, vulnerable_ratio } = input.settings.trap
  for (const f of TRAP_FAMILIES) {
    const a = acc[f]
    if (!a) continue
    const ratio = a.exposure > 0 ? Math.round((a.picked / a.exposure) * 1000) / 1000 : 0
    out[f] = {
      exposure: a.exposure,
      picked: a.picked,
      ratio,
      vulnerable: a.exposure >= min_exposure && ratio >= vulnerable_ratio,
      items: [...a.items],
    }
  }
  return out
}

function wrongRate(rs: ResponseIn[]): number {
  return rs.length ? rs.filter((r) => !r.isCorrect).length / rs.length : 0
}

export function habitFlags(input: EngineInput, rows = diagnosedResponses(input)): HabitFlag[] {
  const h = input.settings.habits
  const flags: HabitFlag[] = []
  const examSessions = input.sessions.filter(isExamSession).sort(byDate)
  const latest = examSessions[examSessions.length - 1]

  // 시간 붕괴 — 최근 시험 한 회. 점수 범위 습관이라 미태깅 시험도 본다(문항 번호만 쓴다)
  if (latest) {
    const tail = latest.responses.filter((r) => r.itemNo >= h.time_collapse.from_no && r.itemNo <= h.time_collapse.to_no)
    const overall = wrongRate(latest.responses)
    const tailRate = wrongRate(tail)
    const timeouts = latest.responses.filter((r) => r.confidence === 'timeout').length
    if ((overall > 0 && tail.length > 0 && tailRate >= overall * h.time_collapse.ratio) || timeouts >= h.time_collapse.timeout_count) {
      flags.push({ code: 'time_collapse', evidence: { tailWrongRate: round3(tailRate), wrongRate: round3(overall), timeouts } })
    }
  }

  // 추측 풀이 — 최근 시험 한 회
  if (latest) {
    const guessRatio = latest.responses.length
      ? latest.responses.filter((r) => r.confidence === 'guess').length / latest.responses.length
      : 0
    const exam = input.exams[latest.examId as string]
    const easyWrong = latest.responses.filter((r) => {
      const rate = exam?.items[r.itemNo]?.errorRate
      return !r.isCorrect && typeof rate === 'number' && rate < h.guessing.easy_error_rate
    }).length
    if (guessRatio >= h.guessing.guess_ratio || easyWrong >= h.guessing.easy_wrong_count) {
      flags.push({ code: 'guessing', evidence: { guessRatio: round3(guessRatio), easyWrong } })
    }
  }

  // 단어 재활용 편중 — 진단 가능한 오답 중 그 계열을 고른 비율
  {
    const wrongWithFamily = rows.filter((r) => r.meta && !r.response.isCorrect && r.response.chosen !== null)
      .map((r) => familyOf(input, r.meta!.optionTraps[r.response.chosen as number]))
      .filter((f): f is TrapFamily => f !== null)
    const target = wrongWithFamily.filter((f) => f === h.word_reuse.family).length
    if (wrongWithFamily.length >= input.settings.trap.min_exposure && target / wrongWithFamily.length >= h.word_reuse.ratio) {
      flags.push({ code: 'word_reuse', evidence: { ratio: round3(target / wrongWithFamily.length), wrong: wrongWithFamily.length } })
    }
  }

  // 90점 커트라인 — 최근 live N회 원점수가 모두 구간 안
  {
    const lives = examSessions.filter((s) => s.mode === 'live' && s.rawScore !== null).slice(-h.cutline_90.sessions)
    if (lives.length === h.cutline_90.sessions && lives.every((s) => (s.rawScore as number) >= h.cutline_90.lo && (s.rawScore as number) <= h.cutline_90.hi)) {
      flags.push({ code: 'cutline_90', evidence: { sessions: lives.length } })
    }
  }

  // EBS 의존 — 연계 여부가 확인된 문항만
  {
    const linked = rows.filter((r) => r.meta?.ebsLinked === true)
    const unlinked = rows.filter((r) => r.meta?.ebsLinked === false)
    const min = input.settings.min_observations
    if (linked.length >= min && unlinked.length >= min) {
      const gap = (1 - wrongRate(linked.map((r) => r.response))) - (1 - wrongRate(unlinked.map((r) => r.response)))
      if (gap >= h.ebs.gap) flags.push({ code: 'ebs', evidence: { gap: round3(gap), linked: linked.length, unlinked: unlinked.length } })
    }
  }

  // 듣기 소홀 — 최근 연속 N회 모두 듣기 오답이 기준 이상
  {
    const recent = examSessions.slice(-h.listening.consecutive)
    const counts = recent.map((s) => s.responses.filter((r) => r.itemNo <= h.listening.to_no && !r.isCorrect).length)
    if (recent.length === h.listening.consecutive && counts.every((c) => c >= h.listening.wrong_count)) {
      flags.push({ code: 'listening', evidence: { minWrong: Math.min(...counts), sessions: recent.length } })
    }
  }

  return flags
}

function round3(v: number) {
  return Math.round(v * 1000) / 1000
}

/** 현재 능력 — 최근 live 보정 점수의 시간 가중 평균. live 가 없으면 진단 테스트로 추정 */
export function currentAbility(input: EngineInput): { ability: number | null; adjusted: boolean; fromDiagnostic: boolean } {
  const ref = input.settings.reference_exam ? input.exams[input.settings.reference_exam] : undefined
  const lives = input.sessions.filter((s) => s.mode === 'live' && s.examId && s.rawScore !== null)
  if (lives.length > 0) {
    // 보정 점수와 원점수를 섞어 평균하지 않는다 — 한 회라도 보정이 안 되면 전부 원점수로 센다
    const scored = lives.map((s) => ({ s, a: adjustScore(s.rawScore as number, input.exams[s.examId as string], ref) }))
    const adjusted = scored.every((x) => x.a.adjusted)
    let num = 0
    let den = 0
    for (const { s, a } of scored) {
      const w = decay(input.now, s.takenAt, input.settings.half_life_days)
      num += w * (adjusted ? a.value : (s.rawScore as number))
      den += w
    }
    // 자르지 않은 값 — 시나리오 역변환에 쓴다. 표시할 때 diagnose() 가 자른다
    return { ability: den > 0 ? round1(num / den) : null, adjusted, fromDiagnostic: false }
  }
  const diag = input.sessions.filter((s) => s.mode === 'diagnostic')
  const rs = diag.flatMap((s) => s.responses).filter((r) => r.itemId && input.items[r.itemId])
  if (rs.length === 0) return { ability: null, adjusted: false, fromDiagnostic: false }
  const actual = rs.filter((r) => r.isCorrect).length / rs.length
  const rates = rs.map((r) => input.items[r.itemId as string].errorRate).filter((x): x is number => typeof x === 'number')
  const eRef = expectedScore(ref)
  if (rates.length === rs.length && eRef !== null) {
    const expected = rates.reduce((s, x) => s + (1 - x), 0) / rates.length
    return { ability: round1(eRef + (actual - expected) * 100), adjusted: true, fromDiagnostic: true }
  }
  return { ability: clampScore(actual * 100), adjusted: false, fromDiagnostic: true }
}

function scenario(input: EngineInput, ability: number | null, abilityAdjusted: boolean, examId: string | null): ScenarioForecast {
  // 능력이 기준 시험으로 보정되지 않았으면 시나리오 간 차이를 계산할 수 없다
  if (ability === null || !abilityAdjusted) return { examId, expected: null, grade: null, meetsTarget: null, adjusted: false }
  const ref = input.settings.reference_exam ? input.exams[input.settings.reference_exam] : undefined
  const scn: ExamMeta | undefined = examId ? input.exams[examId] : undefined
  const eRef = expectedScore(ref)
  const eScn = expectedScore(scn)
  // 기준·시나리오 시험의 기대점수가 없으면 난이도별 예측을 하지 않는다 — 능력을 그대로 베끼면
  // 「어려운 해에도 목표 충족」 같은 근거 없는 말이 된다(CONVENTIONS 폴백 공개 원칙)
  if (eRef === null || eScn === null) return { examId, expected: null, grade: null, meetsTarget: null, adjusted: false }
  const adjusted = true
  const expected = clampScore(ability - eRef + eScn)
  const grade = gradeOf(expected, input.settings.grade_cuts)
  return {
    examId,
    expected,
    grade,
    meetsTarget: input.target && grade !== null ? grade <= input.target.grade : null,
    adjusted,
  }
}

export function recommend(
  input: EngineInput,
  mastery: Record<AttributeCode, AttributeMastery>,
  traps: Partial<Record<TrapFamily, TrapVulnerability>>,
  habits: HabitFlag[],
): RecommendedLine[] {
  const r = input.settings.recommend
  const weak = ATTRIBUTE_CODES.filter((c) => mastery[c].status === 'ok')
    .sort((a, b) => (mastery[a].value as number) - (mastery[b].value as number))
    .slice(0, r.weak_attributes)
    .map<RecommendedLine>((c) => ({ code: `ATTR:${c}`, reason: { kind: 'attribute', ref: c, value: mastery[c].value } }))
  const trapLines = TRAP_FAMILIES.filter((f) => traps[f]?.vulnerable)
    .sort((a, b) => (traps[b]?.ratio ?? 0) - (traps[a]?.ratio ?? 0))
    .slice(0, r.vulnerable_traps)
    .map<RecommendedLine>((f) => ({ code: `TRAP:${f}`, reason: { kind: 'trap', ref: f, value: traps[f]?.ratio ?? null } }))
  const habitLines = habits.map<RecommendedLine>((h) => ({ code: `HABIT:${h.code}`, reason: { kind: 'habit', ref: h.code, value: null } }))
  // 가장 약한 역량 → 가장 취약한 함정 → 습관 → 두 번째 역량 순으로 섞는다
  const ordered = [weak[0], trapLines[0], habitLines[0], ...weak.slice(1), ...trapLines.slice(1), ...habitLines.slice(1)]
  return ordered.filter((x): x is RecommendedLine => Boolean(x)).slice(0, r.max_lines)
}

export function confidenceLevel(
  input: EngineInput,
  examSessions: number,
  responses: number,
  mastery: Record<AttributeCode, AttributeMastery>,
  onlyDiagnostic: boolean,
): ConfidenceLevel {
  if (onlyDiagnostic || examSessions === 0) return 'low'
  const c = input.settings.confidence
  let level: ConfidenceLevel =
    examSessions >= c.high.exams && responses >= c.high.responses
      ? 'high'
      : examSessions >= c.medium.exams && responses >= c.medium.responses
        ? 'medium'
        : 'low'
  const insufficient = ATTRIBUTE_CODES.filter((a) => mastery[a].status === 'insufficient').length
  if (level === 'high' && insufficient > ATTRIBUTE_CODES.length / 2) level = 'medium'
  return level
}

export function diagnose(input: EngineInput): DiagnosisResult {
  const rows = diagnosedResponses(input)
  const mastery = attributeMastery(input, rows)
  const traps = trapVulnerability(input, rows)
  const habits = habitFlags(input, rows)
  const { ability: abilityRaw, adjusted, fromDiagnostic } = currentAbility(input)
  const ability = abilityRaw === null ? null : clampScore(abilityRaw)
  const ref = input.settings.reference_exam ? input.exams[input.settings.reference_exam] : undefined

  const examSessions = input.sessions.filter(isExamSession).sort(byDate)
  const lives = examSessions.filter((s) => s.mode === 'live')
  const latestLive = lives[lives.length - 1]
  const scoreOnly = examSessions.filter((s) => !input.exams[s.examId as string]?.ready).length
  const totalResponses = input.sessions.reduce((n, s) => n + s.responses.length, 0)
  const sc = input.settings.scenario_exams

  return {
    engineVersion: ENGINE_VERSION,
    rawScore: latestLive?.rawScore ?? null,
    ability,
    adjusted,
    gradeEst: gradeOf(ability, input.settings.grade_cuts),
    attributeMastery: mastery,
    trapVulnerability: traps,
    habitFlags: habits,
    forecast: {
      hard: scenario(input, abilityRaw, adjusted, sc.hard),
      normal: scenario(input, abilityRaw, adjusted, sc.normal),
      easy: scenario(input, abilityRaw, adjusted, sc.easy),
    },
    confidence: confidenceLevel(input, examSessions.length, totalResponses, mastery, fromDiagnostic),
    recommendedLines: recommend(input, mastery, traps, habits),
    evidence: {
      examSessions: examSessions.length,
      diagnosticSessions: input.sessions.filter((s) => s.mode === 'diagnostic').length,
      responses: totalResponses,
      diagnosedResponses: rows.length,
      scoreOnlySessions: scoreOnly,
    },
    trend: examSessions.map((s) => ({
      sessionId: s.id,
      takenAt: s.takenAt,
      mode: s.mode,
      raw: s.rawScore,
      // 보정이 안 된 회차는 보정 점수를 비운다(원점수를 보정 점수인 척 그리지 않는다)
      adjusted: (() => {
        if (s.rawScore === null) return null
        const a = adjustScore(s.rawScore, input.exams[s.examId as string], ref)
        return a.adjusted ? clampScore(a.value) : null
      })(),
    })),
  }
}

export const ruleEngineV1: DiagnosisEngine = { version: ENGINE_VERSION, diagnose }
