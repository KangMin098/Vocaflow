// apps/web/scripts/csat-lecture/final-checks.mts
//
// **완료 조건 F3 · F4 · F5 + Gate 4 리포트** — 커밋된 강의 데이터 전부를 DB 의 지금 값에 대고 다시 잰다.
// 적재 때 통과했어도, 그 뒤에 분석·골격이 바뀌면 타깃이 허공을 가리킬 수 있다. 그래서 적재 기록을
// 믿지 않고 **처음부터** 잰다. 읽기 전용.
//
//   F3 — 모든 큐의 타깃이 지금 해설 화면에 있는 블록인가(구조 검사 전부 포함)
//   F4 — 원문(지문·문두·선지)과 8단어 연속 일치 수 — **수만** 남긴다
//   F5 — 802문항 중 점수 ≥ 80 비율 ≥ 95%, 나머지는 실패 목록에 사유와 함께
//
//   npx tsx scripts/csat-lecture/final-checks.mts   → docs/csat-lecture/gate4-report.json

import path from 'node:path'

import type { LectureExamFile, LectureIndex } from '../../src/lib/csat/lecture/types'
import { lectureTargets } from '../../src/lib/csat/lecture/targets'
import { validateLecture } from '../../src/lib/csat/lecture/validate'
import { splitSentences } from '../../src/lib/csat/passage-skeleton'
import { loadItemSkeleton } from '../../src/lib/csat/skeleton'
import { DATA, readJson, REPORTS, serviceDb, writeJson } from './env.mts'

const TOTAL = 802
const db = await serviceDb()

async function all<T>(table: string, cols: string, f?: (q: any) => any): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select(cols).range(from, from + 999)
    if (f) q = f(q)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < 1000) break
  }
  return out
}

type A = {
  item_id: string
  version: number
  answer_unknown: boolean | null
  measured_ability: string | null
  design_intent: string | null
  answer_locus: { quote?: string; reasoning?: string } | null
  choice_analysis: { n: number; verdict?: string; trap?: string | null; why_tempting?: string | null; how_to_reject?: string | null; why_correct?: string | null }[] | null
  solve_procedure: { step: string; on_fail?: string }[] | null
  required_vocab: string[] | null
}
const [items, analyses] = await Promise.all([
  all<{ id: string; type_id: string | null; stem: string | null; passage: string | null; choices: unknown; answer: number | null }>(
    'csat_items',
    'id, type_id, stem, passage, choices, answer',
    (q) => q.eq('in_scope', true),
  ),
  all<A>(
    'csat_item_analyses',
    'item_id, version, answer_unknown, measured_ability, design_intent, answer_locus, choice_analysis, solve_procedure, required_vocab',
    (q) => q.eq('status', 'published'),
  ),
])
const latest = new Map<string, A>()
for (const a of analyses) if (!latest.get(a.item_id) || a.version > latest.get(a.item_id)!.version) latest.set(a.item_id, a)
const itemOf = new Map(items.map((i) => [i.id, i]))

const index = readJson<LectureIndex>(path.join(DATA, 'index.json'), { built: '', items: {} })
const exams = new Map<string, LectureExamFile>()
const clean = (s: string | null | undefined) => (s ?? '').trim()

const f3: { id: string; codes: string[] }[] = []
let quoteHits = 0
const byType = new Map<string, { n: number; sec: number; score: number }>()
const scores: number[] = []

for (const id of Object.keys(index.items)) {
  const exam = id.split('#')[0]
  if (!exams.has(exam)) exams.set(exam, readJson<LectureExamFile>(path.join(DATA, `${exam}.json`), { exam_id: exam, built: '', lectures: {} }))
  const lec = exams.get(exam)!.lectures[id]
  const it = itemOf.get(id)
  const a = latest.get(id)
  if (!lec || !it || !a) {
    f3.push({ id, codes: [!lec ? 'no-lecture' : !it ? 'no-item' : 'no-analysis'] })
    continue
  }
  const chs = a.choice_analysis ?? []
  const unknown = a.answer_unknown === true
  const sk = loadItemSkeleton(id)
  const spans = it.passage ? splitSentences(it.passage) : []
  const targets = lectureTargets({
    answer: it.answer,
    answer_unknown: unknown,
    has_ability: Boolean(clean(a.measured_ability)),
    has_intent: Boolean(clean(a.design_intent)),
    distractors: chs.filter((c) => c.verdict === 'distractor').map((c) => c.n).sort((x, y) => x - y),
    procedure_len: (a.solve_procedure ?? []).length,
    vocab_len: (a.required_vocab ?? []).length,
    skeleton: sk ? { sentences: sk.sentences.length, placedAnchorIds: sk.anchors.filter((x) => x.sentences.length).map((x) => x.id) } : null,
  })
  if (!(sk && sk.sentences.length === spans.length)) targets.anchor = []
  const v = validateLecture(lec, {
    targets,
    answer: unknown ? null : it.answer,
    wrongChoices: chs.filter((c) => c.verdict === 'distractor').map((c) => c.n),
    hasTrapLabels: chs.some((c) => clean(c.trap)),
    hasVocab: (a.required_vocab ?? []).length > 0,
    analysisTexts: [a.measured_ability, a.design_intent, a.answer_locus?.reasoning, ...chs.flatMap((c) => [c.why_correct, c.why_tempting, c.how_to_reject]), ...(a.solve_procedure ?? []).flatMap((p) => [p.step, p.on_fail])]
      .map(clean)
      .filter(Boolean),
    sourceTexts: [clean(it.stem), clean(it.passage), ...(Array.isArray(it.choices) ? (it.choices as unknown[]).map(String) : [])].filter(Boolean),
  })
  quoteHits += v.stats.quoteHits
  if (!v.ok) f3.push({ id, codes: [...new Set(v.issues.map((i) => i.code))] })
  const e = index.items[id]
  scores.push(e.score)
  const t = it.type_id ?? '?'
  const b = byType.get(t) ?? { n: 0, sec: 0, score: 0 }
  byType.set(t, { n: b.n + 1, sec: b.sec + e.sec, score: b.score + e.score })
}

const failed = readJson<{ items: Record<string, { reasons: string[]; score: number | null }> }>(path.join(REPORTS, 'failed.json'), { items: {} })
const loaded = Object.keys(index.items).length
const ge80 = scores.filter((s) => s >= 80).length
const report = {
  gate: 4,
  measuredAt: new Date().toISOString(),
  generated: `${loaded}/${TOTAL}`,
  meanScore: scores.length ? Math.round((scores.reduce((x, y) => x + y, 0) / scores.length) * 10) / 10 : null,
  F3: { pass: f3.length === 0, invalid: f3 },
  F4: { pass: quoteHits === 0, eightWordHits: quoteHits, note: '원문 대조는 이 실행 안에서만 — 겹친 구절은 남기지 않는다' },
  F5: {
    pass: ge80 / TOTAL >= 0.95 && Object.keys(failed.items).length + loaded >= TOTAL,
    ge80,
    ratio: Math.round((ge80 / TOTAL) * 1000) / 10,
    failedCount: Object.keys(failed.items).length,
    note: '비율의 분모는 802 — 적재 못 한 문항은 ≥ 80 에 들지 않는다',
  },
  failed: failed.items,
  byType: Object.fromEntries(
    [...byType.entries()]
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([t, b]) => [t, { n: b.n, meanSec: Math.round(b.sec / b.n), meanScore: Math.round((b.score / b.n) * 10) / 10 }]),
  ),
}
writeJson(path.join(REPORTS, 'gate4-report.json'), report)
console.log(`생성 ${report.generated} · 평균 ${report.meanScore} · F3 ${report.F3.pass ? 'PASS' : `FAIL ${f3.length}`} · F4 ${report.F4.pass ? 'PASS' : `FAIL ${quoteHits}`} · F5 ${report.F5.pass ? 'PASS' : 'FAIL'} (${ge80}/${TOTAL} = ${report.F5.ratio}%) · 실패 ${report.F5.failedCount}`)
