// apps/web/src/lib/csat/diagnosis/engine/settings.ts
//
// 관리자가 저장하는 엔진 설정 검사. 엔진은 설정을 믿고 계산하므로 저장 전에 여기서 모양·범위를 막는다.
// 오류 문자열 배열을 돌려준다(빈 배열 = 통과).

import { ATTRIBUTE_CODES, TRAP_FAMILIES, type EngineSettings } from './types'

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function validateSettings(s: unknown, knownExams: Set<string>): string[] {
  const e: string[] = []
  if (typeof s !== 'object' || s === null) return ['설정이 객체가 아니다']
  const x = s as EngineSettings
  const inRange = (v: unknown, lo: number, hi: number, name: string) => {
    if (!num(v) || v < lo || v > hi) e.push(`${name} 는 ${lo}~${hi}`)
  }
  if (!Array.isArray(x.grade_cuts) || x.grade_cuts.length !== 8 || !x.grade_cuts.every(num)) e.push('grade_cuts 는 숫자 8개')
  else if (x.grade_cuts.some((c, i) => i > 0 && c >= x.grade_cuts[i - 1])) e.push('grade_cuts 는 내림차순')
  inRange(x.half_life_days, 1, 3650, 'half_life_days')
  for (const k of ['sure', 'unsure', 'guess', 'timeout'] as const) inRange(x.credit?.[k], 0, 1, `credit.${k}`)
  inRange(x.retake_weight, 0, 1, 'retake_weight')
  inRange(x.min_observations, 1, 1000, 'min_observations')
  if (!(ATTRIBUTE_CODES as readonly string[]).includes(x.listening?.attribute)) e.push('listening.attribute 는 A1~A9')
  inRange(x.listening?.weight, 0, 2, 'listening.weight')
  inRange(x.trap?.min_exposure, 1, 1000, 'trap.min_exposure')
  inRange(x.trap?.vulnerable_ratio, 0, 1, 'trap.vulnerable_ratio')
  const h = x.habits
  if (!h) e.push('habits 가 없다')
  else {
    inRange(h.time_collapse?.from_no, 1, 45, 'habits.time_collapse.from_no')
    inRange(h.time_collapse?.to_no, 1, 45, 'habits.time_collapse.to_no')
    inRange(h.time_collapse?.ratio, 0, 100, 'habits.time_collapse.ratio')
    inRange(h.time_collapse?.timeout_count, 1, 45, 'habits.time_collapse.timeout_count')
    inRange(h.guessing?.guess_ratio, 0, 1, 'habits.guessing.guess_ratio')
    inRange(h.guessing?.easy_error_rate, 0, 1, 'habits.guessing.easy_error_rate')
    inRange(h.guessing?.easy_wrong_count, 1, 45, 'habits.guessing.easy_wrong_count')
    if (!(TRAP_FAMILIES as readonly string[]).includes(h.word_reuse?.family)) e.push('habits.word_reuse.family 는 C1~C9')
    inRange(h.word_reuse?.ratio, 0, 1, 'habits.word_reuse.ratio')
    inRange(h.cutline_90?.sessions, 1, 20, 'habits.cutline_90.sessions')
    inRange(h.cutline_90?.lo, 0, 100, 'habits.cutline_90.lo')
    inRange(h.cutline_90?.hi, 0, 100, 'habits.cutline_90.hi')
    inRange(h.ebs?.gap, 0, 1, 'habits.ebs.gap')
    inRange(h.listening?.to_no, 1, 45, 'habits.listening.to_no')
    inRange(h.listening?.wrong_count, 1, 45, 'habits.listening.wrong_count')
    inRange(h.listening?.consecutive, 1, 20, 'habits.listening.consecutive')
  }
  const examRef = (v: unknown, name: string) => {
    if (v !== null && (typeof v !== 'string' || !knownExams.has(v))) e.push(`${name} 는 null 또는 정답표가 있는 시험 id`)
  }
  examRef(x.reference_exam, 'reference_exam')
  examRef(x.scenario_exams?.hard ?? null, 'scenario_exams.hard')
  examRef(x.scenario_exams?.normal ?? null, 'scenario_exams.normal')
  examRef(x.scenario_exams?.easy ?? null, 'scenario_exams.easy')
  if (!x.scenario_exams) e.push('scenario_exams 가 없다')
  for (const lvl of ['high', 'medium'] as const) {
    inRange(x.confidence?.[lvl]?.exams, 0, 100, `confidence.${lvl}.exams`)
    inRange(x.confidence?.[lvl]?.responses, 0, 10000, `confidence.${lvl}.responses`)
  }
  inRange(x.recommend?.weak_attributes, 0, 9, 'recommend.weak_attributes')
  inRange(x.recommend?.vulnerable_traps, 0, 9, 'recommend.vulnerable_traps')
  inRange(x.recommend?.max_lines, 1, 10, 'recommend.max_lines')
  inRange(x.diagnostic_test?.size, 5, 45, 'diagnostic_test.size')
  // 개수·번호·회수는 정수여야 한다 — 소수면 slice() 가 잘라 비교가 영영 안 맞아 신호가 죽는다
  const ints: [unknown, string][] = [
    [x.diagnostic_test?.size, 'diagnostic_test.size'],
    [x.min_observations, 'min_observations'],
    [x.trap?.min_exposure, 'trap.min_exposure'],
    [h?.time_collapse?.from_no, 'habits.time_collapse.from_no'],
    [h?.time_collapse?.to_no, 'habits.time_collapse.to_no'],
    [h?.time_collapse?.timeout_count, 'habits.time_collapse.timeout_count'],
    [h?.guessing?.easy_wrong_count, 'habits.guessing.easy_wrong_count'],
    [h?.cutline_90?.sessions, 'habits.cutline_90.sessions'],
    [h?.listening?.to_no, 'habits.listening.to_no'],
    [h?.listening?.wrong_count, 'habits.listening.wrong_count'],
    [h?.listening?.consecutive, 'habits.listening.consecutive'],
    [x.confidence?.high?.exams, 'confidence.high.exams'],
    [x.confidence?.high?.responses, 'confidence.high.responses'],
    [x.confidence?.medium?.exams, 'confidence.medium.exams'],
    [x.confidence?.medium?.responses, 'confidence.medium.responses'],
    [x.recommend?.weak_attributes, 'recommend.weak_attributes'],
    [x.recommend?.vulnerable_traps, 'recommend.vulnerable_traps'],
    [x.recommend?.max_lines, 'recommend.max_lines'],
  ]
  for (const [v, name] of ints) if (num(v) && !Number.isInteger(v)) e.push(`${name} 는 정수`)
  return e
}
