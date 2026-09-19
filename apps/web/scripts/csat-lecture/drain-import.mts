// apps/web/scripts/csat-lecture/drain-import.mts
//
// **강의 대본 드레인 — 3단계(import).** 검사하고, 채점을 합산하고, 통과한 것만 적재한다.
//
//   npx tsx scripts/csat-lecture/drain-import.mts --chunk pilot                 (검사만 — 파일을 안 고친다)
//   npx tsx scripts/csat-lecture/drain-import.mts --chunk pilot --commit        (통과분 적재)
//   npx tsx scripts/csat-lecture/drain-import.mts --chunk pilot --report ../../docs/csat-lecture/gate1-report.json
//
// **재실행 안전.** 같은 대본을 다시 적재하면 버전이 오르지 않는다(큐 내용이 같으면 그대로 둔다).
// **빈 값을 넣지 않는다.** 대본이 없거나 · 검사에 걸리거나 · 채점이 없거나 · 80점 미만이면
// 적재하지 않고 실패 목록(`failed.json`)에 사유와 함께 남긴다. 건너뛴 수를 반드시 출력한다.
//
// ── 원고 약식 (대본을 쓰는 쪽의 부담을 줄인다) ─────────────────────────────
//   { "cues": [ { "r": "evidence", "t": "sentence:2", "p": 700,
//                 "s": ["자, 여기 세 번째 문장을 보세요.", { "en": "less is more" }, "이게 핵심이죠."] } ] }
//   · r = 역할 · t = 타깃(`sentence:k` 는 원문 자리, 나머지는 분석 블록) · p = 쉼(ms, 생략 시 역할 기본값)
//   · s = 조각들 — 문자열은 한국어, { en } 은 영어
//   id·order·est_sec·total_sec_est 는 여기서 채운다(쓰는 쪽의 어림을 믿지 않는다).
//
// ⚠️ 리포트·실패 목록에는 **원문을 싣지 않는다.** 검사기 메시지는 위치와 수만 말한다.

import fs from 'node:fs'
import path from 'node:path'

import { rawNumeralIssues, speakSegments } from '../../src/lib/csat/lecture/speakable'
import type { Lecture, LectureCue, LectureExamFile, LectureIndex, LectureRole, LectureSegment } from '../../src/lib/csat/lecture/types'
import { withFocus } from '../../src/lib/csat/lecture/focus'
import { validateLecture, withComputedTimes } from '../../src/lib/csat/lecture/validate'
import { arg, DATA, flag, readJson, REPORTS, WORK, writeJson } from './env.mts'

const CHUNK = arg('chunk')
if (!CHUNK) {
  console.error('--chunk <이름> 이 필요하다')
  process.exit(1)
}
const COMMIT = flag('commit')
const PASS_SCORE = 80
const GENERATED_BY = 'claude-opus-5 · Claude Code 드레인'

const DEFAULT_PAUSE: Record<LectureRole, number> = {
  intro: 500,
  strategy: 500,
  structure: 600,
  evidence: 700,
  eliminate: 400,
  trap: 600,
  vocab: 500,
  wrapup: 900,
}

type Shorthand = { r: LectureRole; t: string; p?: number; s: (string | { en: string })[] }
type Draft = { cues: Shorthand[] | LectureCue[]; attempt?: number }
type Grade = {
  why: number
  eliminate: number
  trap: number
  strategy: number
  formula: number
  /** 심사관이 지문과 어긋나는 말을 찾았는가 — 참이면 점수와 상관없이 떨어뜨린다(결정 L17) */
  factual_error?: boolean
  notes?: string
  fixes?: { cue: string; what: string }[]
}

// 청크의 문항 한 줄 — export 가 쓴 모양
type ChunkItem = {
  id: string
  exam_label: string
  no: number
  type_id: string | null
  answer: number | null
  targets: { analysis: string[]; anchor: string[]; useMap: boolean }
  analysis: {
    measured_ability: string | null
    design_intent: string | null
    evidence_quote: string | null
    evidence_reasoning: string | null
    choices: { n: number; verdict?: string; trap?: string | null; why_tempting?: string | null; how_to_reject?: string | null; why_correct?: string | null }[]
    procedure: { step: string; on_fail?: string }[]
    required_vocab: string[]
  }
  source: { stem: string | null; sentences: { k: number; text: string }[]; choices: unknown }
}

const chunk = readJson<{ items: ChunkItem[] } | null>(path.join(WORK, `chunk-${CHUNK}.json`), null)
if (!chunk) {
  console.error(`청크가 없다: chunk-${CHUNK}.json`)
  process.exit(1)
}
const out = readJson<{ lectures: Record<string, Draft> }>(path.join(WORK, `chunk-${CHUNK}.out.json`), { lectures: {} })
const grades = readJson<{ grades: Record<string, Grade> }>(path.join(WORK, `chunk-${CHUNK}.grade.json`), { grades: {} })
/**
 * **심사가 본 원고** — 채점은 그 원고에만 유효하다. 채점 뒤에 원고를 고치면 점수는 옛 글의 것이다.
 * 심사관은 `chunk-<이름>.out.graded.json`(채점 직전 스냅숏)을 읽고, 적재는 지금 원고와 대조한다.
 * 파일럿에서 세 번 고쳐 쓰면서 이 틈이 실제로 생겼다 — 고친 뒤 옛 점수로 통과할 뻔했다.
 */
const graded = readJson<{ lectures: Record<string, Draft> } | null>(path.join(WORK, `chunk-${CHUNK}.out.graded.json`), null)
const sameText = (a: Draft | undefined, b: Draft | undefined) => JSON.stringify(a?.cues ?? null) === JSON.stringify(b?.cues ?? null)

function expand(itemId: string, d: Draft, sentenceCount: number): { lecture: Lecture; rawIssues: { cue: string; msg: string }[] } {
  const rawIssues: { cue: string; msg: string }[] = []
  const cues: LectureCue[] = (d.cues as (Shorthand | LectureCue)[]).map((c, i) => {
    const id = `c${i + 1}`
    if ('segments' in c) return { ...c, id, order: i + 1 }
    const segs: LectureSegment[] = c.s.map((x) =>
      typeof x === 'string' ? { lang: 'ko-KR' as const, text: x } : { lang: 'en-US' as const, text: x.en },
    )
    for (const g of segs) if (g.lang === 'ko-KR') for (const m of rawNumeralIssues(g.text)) rawIssues.push({ cue: id, msg: m })
    return {
      id,
      order: i + 1,
      role: c.r,
      target: c.t.startsWith('sentence:') ? { kind: 'anchor', id: c.t } : { kind: 'analysis', id: c.t },
      segments: speakSegments(segs),
      est_sec: 0,
      pause_after_ms: c.p ?? DEFAULT_PAUSE[c.r] ?? 500,
    }
  })
  const lecture = withComputedTimes({
    item_id: itemId,
    version: 1,
    total_sec_est: 0,
    generated_by: GENERATED_BY,
    rubric_score: 0,
    // 말한 문장 번호를 싣는다 — 지도가 켤 막대를 말과 맞춘다(focus.ts). 지도가 없는 문항은 싣지 않는다.
    cues: withFocus(cues, sentenceCount),
  })
  return { lecture, rawIssues }
}

const clean = (s: string | null | undefined) => (s ?? '').trim()

type Row = {
  id: string
  type_id: string | null
  status: 'pass' | 'fail' | 'missing'
  attempt: number
  score: number | null
  parts: Record<string, number> | null
  totalSec: number | null
  cues: number | null
  maxCueSec: number | null
  quoteHits: number | null
  issues: { code: string; cue?: string; msg: string }[]
  fixes?: Grade['fixes']
}

const rows: Row[] = []
const passed: Lecture[] = []
const typeOf = new Map(chunk.items.map((i) => [i.id, i.type_id]))

for (const it of chunk.items) {
  const d = out.lectures[it.id]
  if (!d) {
    rows.push({ id: it.id, type_id: it.type_id, status: 'missing', attempt: 0, score: null, parts: null, totalSec: null, cues: null, maxCueSec: null, quoteHits: null, issues: [{ code: 'missing', msg: '대본이 없다' }] })
    continue
  }
  const { lecture, rawIssues } = expand(it.id, d, it.targets.useMap ? it.targets.anchor.length : 0)
  const chs = it.analysis.choices ?? []
  const v = validateLecture(lecture, {
    targets: it.targets,
    answer: it.answer,
    wrongChoices: chs.filter((c) => c.verdict === 'distractor').map((c) => c.n),
    hasTrapLabels: chs.some((c) => clean(c.trap)),
    hasVocab: (it.analysis.required_vocab ?? []).length > 0,
    analysisTexts: [
      it.analysis.measured_ability,
      it.analysis.design_intent,
      it.analysis.evidence_reasoning,
      ...chs.flatMap((c) => [c.why_correct, c.why_tempting, c.how_to_reject]),
      ...it.analysis.procedure.flatMap((p) => [p.step, p.on_fail]),
    ].map(clean).filter(Boolean),
    sourceTexts: [
      clean(it.source.stem),
      ...it.source.sentences.map((s) => s.text),
      ...(Array.isArray(it.source.choices) ? (it.source.choices as unknown[]).map((x) => String(x)) : []),
    ].filter(Boolean),
  })
  const issues = [...rawIssues.map((r) => ({ code: 'raw-numeral', cue: r.cue, msg: r.msg })), ...v.issues]
  const g = grades.grades[it.id]
  const parts = g
    ? {
        why: g.why,
        eliminate: g.eliminate,
        trap: g.trap,
        strategy: g.strategy,
        formula: g.formula,
        reading: v.mechanical.reading,
        time: v.mechanical.time,
      }
    : null
  const score = parts ? Object.values(parts).reduce((a, b) => a + b, 0) : null
  if (!g) issues.push({ code: 'ungraded', msg: '심사 점수가 없다' })
  else if (!graded || !sameText(graded.lectures[it.id], d)) issues.push({ code: 'stale-grade', msg: '채점 뒤 원고가 바뀌었다 — 다시 채점해야 한다' })
  else if (g.factual_error) issues.push({ code: 'factual', msg: '심사관이 지문과 어긋나는 말을 찾았다' })
  else if ((score ?? 0) < PASS_SCORE) issues.push({ code: 'score', msg: `루브릭 ${score} < ${PASS_SCORE}` })
  const ok = issues.length === 0
  rows.push({
    id: it.id,
    type_id: it.type_id,
    status: ok ? 'pass' : 'fail',
    attempt: d.attempt ?? 1,
    score,
    parts,
    totalSec: v.stats.totalSec,
    cues: v.stats.cues,
    maxCueSec: v.stats.maxCueSec,
    quoteHits: v.stats.quoteHits,
    issues,
    fixes: g?.fixes,
  })
  if (ok) passed.push({ ...lecture, rubric_score: score! })
}

// ── 출력 ────────────────────────────────────────────────────────────────
const n = (s: Row['status']) => rows.filter((r) => r.status === s).length
for (const r of rows) {
  const head = `${r.status === 'pass' ? 'PASS' : r.status === 'missing' ? '----' : 'FAIL'} ${r.id.padEnd(10)} 점수 ${String(r.score ?? '-').padStart(3)} · ${r.totalSec ?? '-'}초 · 큐 ${r.cues ?? '-'} · 최장 ${r.maxCueSec ?? '-'}초 · 인용 ${r.quoteHits ?? '-'}`
  console.log(head)
  for (const i of r.issues) console.log(`      ${i.code}${i.cue ? ` [${i.cue}]` : ''} ${i.msg}`)
}
console.log(`통과 ${n('pass')} · 실패 ${n('fail')} · 대본 없음(건너뜀) ${n('missing')} / ${rows.length}`)

const report = {
  chunk: CHUNK,
  checkedAt: new Date().toISOString(),
  passScore: PASS_SCORE,
  pass: n('pass') === rows.length,
  counts: { pass: n('pass'), fail: n('fail'), missing: n('missing'), total: rows.length },
  items: rows,
}
writeJson(path.join(WORK, `chunk-${CHUNK}.report.json`), report)
const reportPath = arg('report')
if (reportPath) writeJson(path.resolve(reportPath), report)

// 실패 목록 — 사유만(원문 없음). 통과하면 목록에서 지운다.
const failedPath = path.join(REPORTS, CHUNK === 'pilot' ? 'pilot_failed.json' : 'failed.json')
if (COMMIT || CHUNK === 'pilot') {
  const failed = readJson<{ items: Record<string, unknown> }>(failedPath, { items: {} })
  for (const r of rows) {
    if (r.status === 'pass') delete failed.items[r.id]
    else if (r.status === 'fail')
      failed.items[r.id] = { chunk: CHUNK, attempt: r.attempt, score: r.score, reasons: r.issues.map((i) => `${i.code}${i.cue ? `[${i.cue}]` : ''}: ${i.msg}`) }
  }
  writeJson(failedPath, { updated: new Date().toISOString(), count: Object.keys(failed.items).length, items: failed.items })
}

if (!COMMIT) {
  console.log('(검사만 — 적재하지 않았다. --commit 으로 적재)')
  process.exit(0)
}

// ── 적재 ────────────────────────────────────────────────────────────────
const indexPath = path.join(DATA, 'index.json')
const index = readJson<LectureIndex>(indexPath, { built: '', items: {} })
const byExam = new Map<string, Lecture[]>()
for (const l of passed) byExam.set(l.item_id.split('#')[0], [...(byExam.get(l.item_id.split('#')[0]) ?? []), l])

let added = 0
let unchanged = 0
for (const [exam, list] of byExam) {
  if (!/^[A-Za-z0-9_-]{1,16}$/.test(exam)) throw new Error(`회차 id 가 이상하다: ${exam}`)
  const p = path.join(DATA, `${exam}.json`)
  const file = readJson<LectureExamFile>(p, { exam_id: exam, built: '', lectures: {} })
  for (const l of list) {
    const prev = file.lectures[l.item_id]
    const same = prev && JSON.stringify(prev.cues) === JSON.stringify(l.cues)
    if (same) {
      unchanged += 1
      continue
    }
    file.lectures[l.item_id] = { ...l, version: prev ? prev.version + 1 : 1 }
    index.items[l.item_id] = { sec: l.total_sec_est, cues: l.cues.length, score: l.rubric_score, type: typeOf.get(l.item_id) ?? null }
    added += 1
  }
  file.built = new Date().toISOString().slice(0, 10)
  // 문항 순서를 고정한다 — 적재 순서에 따라 파일이 흔들리면 diff 가 읽히지 않는다
  file.lectures = Object.fromEntries(Object.entries(file.lectures).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })))
  writeJson(p, file)
}
index.built = new Date().toISOString().slice(0, 10)
index.items = Object.fromEntries(Object.entries(index.items).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })))
writeJson(indexPath, index)
console.log(`적재 ${added} · 그대로 ${unchanged} · 색인 ${Object.keys(index.items).length}문항`)
fs.mkdirSync(DATA, { recursive: true })
