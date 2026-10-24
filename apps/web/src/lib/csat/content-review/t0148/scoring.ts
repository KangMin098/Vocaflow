// apps/web/src/lib/csat/content-review/t0148/scoring.ts
//
// **F5 — T-0148 사람 블라인드 채점 · 행 모델과 단계 잠금.** (계약 lecture-audit-c-20261024/g/A_T0148_HUMAN_EVAL_CONTRACT.md)
//
// ⚠️ 판정 격리: 이 파일과 화면은 **정답 키를 모른다.** 키(과잉/정상)는 집계 스크립트
//   `scripts/csat/content-review/t0148-aggregate.mjs` 만 연구 경로에서 읽는다. apps/web 에 키를 들이지 않는다.
// 단계: stage1(블라인드 점수) → locked1(1단계 값 고정 · 반례 자료 열림) → stage2(반례 판정) → locked2(제출 가능).
// 순수 함수만 — 저장(localStorage)·내려받기는 화면이 한다.

export type YesNoUnknown = '예' | '아니오' | '모름'
export type Stage = 'stage1' | 'locked1' | 'stage2' | 'locked2'

export const CSV_COLUMNS = [
  'blind',
  'score_A',
  'score_B',
  'teaches_wrong_rule_1',
  'own_counterexample',
  'ce_adjudication',
  'teaches_wrong_rule_2',
  'memo',
] as const

export interface ScoreRow {
  blind: string
  score_A: number | null
  score_B: number | null
  teaches_wrong_rule_1: YesNoUnknown | null
  own_counterexample: string
  /** 2단계 — 반례 후보 판정(자유 기록: 예 「2020#41 성립」) */
  ce_adjudication: string
  teaches_wrong_rule_2: YesNoUnknown | null
  memo: string
}

export interface ScoringSheet {
  scorer: string
  stage: Stage
  rows: ScoreRow[]
}

const STAGE1_FIELDS = ['score_A', 'score_B', 'teaches_wrong_rule_1', 'own_counterexample'] as const
const STAGE2_FIELDS = ['ce_adjudication', 'teaches_wrong_rule_2'] as const

export function emptyRow(blind: string): ScoreRow {
  return {
    blind,
    score_A: null,
    score_B: null,
    teaches_wrong_rule_1: null,
    own_counterexample: '',
    ce_adjudication: '',
    teaches_wrong_rule_2: null,
    memo: '',
  }
}

export function newSheet(scorer: string, blinds: readonly string[]): ScoringSheet {
  return { scorer, stage: 'stage1', rows: blinds.map(emptyRow) }
}

export function isScore(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10
}

export function isYnu(v: unknown): v is YesNoUnknown {
  return v === '예' || v === '아니오' || v === '모름'
}

/** 1단계가 다 찼는가 — 점수 둘 · 「틀린 규칙」 답 */
export function stage1Complete(r: ScoreRow): boolean {
  return isScore(r.score_A) && isScore(r.score_B) && isYnu(r.teaches_wrong_rule_1)
}

/**
 * 2단계가 다 찼는가 — 반례 후보 판정 기록 + 다시 답한 「틀린 규칙」.
 * 계약 §2: 반례 후보마다 성립·불성립을 판정한다. 후보가 없는 대본도 「해당 없음」을 적는다(빈칸 ≠ 판정).
 */
export function stage2Complete(r: ScoreRow): boolean {
  return r.ce_adjudication.trim() !== '' && isYnu(r.teaches_wrong_rule_2)
}

export function rowProblems(r: ScoreRow, stage: Stage): string[] {
  const p: string[] = []
  if (r.score_A !== null && !isScore(r.score_A)) p.push('A 점수는 0~10 정수')
  if (r.score_B !== null && !isScore(r.score_B)) p.push('B 점수는 0~10 정수')
  if (!stage1Complete(r)) p.push('1단계 미완료')
  if ((stage === 'stage2' || stage === 'locked2') && !stage2Complete(r)) p.push('2단계 반례 판정·「틀린 규칙」 미답')
  return p
}

export type EditResult = { ok: true; sheet: ScoringSheet } | { ok: false; message: string }

/** 칸 하나 고치기. 잠긴 단계의 칸은 거부한다 — 1단계 값은 잠근 뒤 지우거나 바꿀 수 없다. */
export function editField<K extends keyof Omit<ScoreRow, 'blind'>>(
  sheet: ScoringSheet,
  blind: string,
  field: K,
  value: ScoreRow[K],
): EditResult {
  const i = sheet.rows.findIndex((r) => r.blind === blind)
  if (i < 0) return { ok: false, message: `${blind} 행이 없다` }
  const s1 = (STAGE1_FIELDS as readonly string[]).includes(field)
  const s2 = (STAGE2_FIELDS as readonly string[]).includes(field)
  if (s1 && sheet.stage !== 'stage1') return { ok: false, message: '1단계는 잠겼다 — 값을 바꿀 수 없다' }
  if (s2 && sheet.stage !== 'stage2') return { ok: false, message: '2단계 칸은 1단계를 잠근 뒤 2단계에서만 쓴다' }
  if (sheet.stage === 'locked2') return { ok: false, message: '제출용으로 잠겼다' }
  if ((field === 'score_A' || field === 'score_B') && value !== null && !isScore(value)) {
    return { ok: false, message: '점수는 0~10 정수' }
  }
  const rows = sheet.rows.slice()
  rows[i] = { ...rows[i]!, [field]: value }
  return { ok: true, sheet: { ...sheet, rows } }
}

/** 다음 단계로. 1단계 잠금은 26행이 모두 찼을 때만, 2단계 시작은 locked1 에서만. */
export function advance(sheet: ScoringSheet): EditResult {
  if (sheet.stage === 'stage1') {
    const left = sheet.rows.filter((r) => !stage1Complete(r)).map((r) => r.blind)
    if (left.length) return { ok: false, message: `1단계 미완료: ${left.join(', ')}` }
    return { ok: true, sheet: { ...sheet, stage: 'locked1' } }
  }
  if (sheet.stage === 'locked1') return { ok: true, sheet: { ...sheet, stage: 'stage2' } }
  if (sheet.stage === 'stage2') {
    const left = sheet.rows.filter((r) => !stage2Complete(r)).map((r) => r.blind)
    if (left.length) return { ok: false, message: `2단계 미완료: ${left.join(', ')}` }
    return { ok: true, sheet: { ...sheet, stage: 'locked2' } }
  }
  return { ok: false, message: '이미 제출용으로 잠겼다' }
}

/** 반례 자료(2단계)를 보여도 되는가 */
export function counterexamplesVisible(stage: Stage): boolean {
  return stage !== 'stage1'
}

// ── CSV ────────────────────────────────────────────────────

function cell(v: string | number | null): string {
  const s = v === null ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** 계약 열 순서 그대로. 첫 줄 앞 주석 줄로 채점자·단계를 남긴다(집계기가 읽는다). */
export function toCsv(sheet: ScoringSheet): string {
  const lines = [`# scorer=${sheet.scorer.replace(/[\r\n]/g, ' ')};stage=${sheet.stage}`, CSV_COLUMNS.join(',')]
  for (const r of sheet.rows) lines.push(CSV_COLUMNS.map((c) => cell(r[c])).join(','))
  return lines.join('\r\n') + '\r\n'
}

/** RFC 4180 식 파서 — 따옴표 안 쉼표·줄바꿈·"" 이스케이프 · CRLF/LF 모두 */
export function parseCsvRecords(text: string): string[][] {
  const out: string[][] = []
  let row: string[] = []
  let cur = ''
  let q = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!
    if (q) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cur += '"'; i++ } else q = false
      } else if (!(ch === '\r' && s[i + 1] === '\n')) cur += ch
      continue
    }
    if (ch === '"') q = true
    else if (ch === ',') { row.push(cur); cur = '' }
    else if (ch === '\r') { /* CRLF — \n 에서 끊는다 */ }
    else if (ch === '\n') { row.push(cur); out.push(row); row = []; cur = '' }
    else cur += ch
  }
  // 닫히지 않은 따옴표 — 뒤 행을 한 칸으로 삼켜 「문제 없음」이 되던 구멍(T-0158 Codex P2)
  if (q) throw new Error('닫히지 않은 따옴표가 있다')
  if (cur !== '' || row.length) { row.push(cur); out.push(row) }
  return out
}

function toScore(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return isScore(n) ? n : NaN
}

export type ParseResult = { ok: true; sheet: ScoringSheet } | { ok: false; message: string }

export function parseCsv(text: string): ParseResult {
  let recs: string[][]
  try {
    recs = parseCsvRecords(text)
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'CSV 구문 오류' }
  }
  let scorer = ''
  let stage: Stage = 'stage1'
  const head = recs[0]?.join(',') ?? ''
  if (head.startsWith('#')) {
    const m = /scorer=([^;]*);stage=(stage1|locked1|stage2|locked2)/.exec(head)
    if (m) { scorer = m[1]!; stage = m[2] as Stage }
    recs.shift()
  }
  const cols = recs.shift()
  if (!cols || cols.join(',') !== CSV_COLUMNS.join(',')) return { ok: false, message: `열이 계약과 다르다: ${CSV_COLUMNS.join(',')}` }
  const rows: ScoreRow[] = []
  for (const r of recs) {
    if (r.length === 1 && r[0] === '') continue
    if (r.length !== CSV_COLUMNS.length) return { ok: false, message: `열 수가 ${r.length}인 행이 있다` }
    const [blind, a, b, w1, own, ce, w2, memo] = r as [string, string, string, string, string, string, string, string]
    const sa = toScore(a)
    const sb = toScore(b)
    if (Number.isNaN(sa) || Number.isNaN(sb)) return { ok: false, message: `${blind}: 점수는 0~10 정수` }
    if (w1 && !isYnu(w1)) return { ok: false, message: `${blind}: teaches_wrong_rule_1 은 예/아니오/모름` }
    if (w2 && !isYnu(w2)) return { ok: false, message: `${blind}: teaches_wrong_rule_2 는 예/아니오/모름` }
    rows.push({
      blind, score_A: sa, score_B: sb,
      teaches_wrong_rule_1: (w1 || null) as YesNoUnknown | null,
      own_counterexample: own, ce_adjudication: ce,
      teaches_wrong_rule_2: (w2 || null) as YesNoUnknown | null,
      memo,
    })
  }
  return { ok: true, sheet: { scorer, stage, rows } }
}
