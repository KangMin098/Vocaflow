// apps/web/scripts/csat-lecture/drain-export.mts
//
// **강의 대본 드레인 — 1단계(export).** 대본을 쓸 몫을 청크로 뽑는다.
//
//   ① 이 스크립트          → scripts/csat/lecture-drain/chunk-<이름>.json
//   ② Claude Code          → chunk-<이름>.out.json    (문항마다 강의 대본)
//      심사관(별도 호출)    → chunk-<이름>.grade.json  (루브릭 80점 몫)
//   ③ drain-import         → 검사 · 채점 합산 · lecture-data 적재
//
// **재실행 안전.** 이미 적재된 문항(lecture-data 색인에 있는 것)은 건너뛴다. 건너뛴 수를 출력한다.
// **읽기 전용** — DB 에 쓰지 않는다.
//
// ⚠️ 청크에는 **기출 원문(지문·문두·선지)** 이 실린다 — 대본을 쓰는 쪽이 읽어야 「세 번째 문장」을
//    바르게 가리킬 수 있다. 그래서 작업 폴더는 커밋하지 않는다(.gitignore). 커밋되는 것은
//    검사를 통과한 대본(lecture-data)뿐이고, 그 검사가 8단어 연속 인용을 막는다.
//
// 실행 (apps/web 에서):
//   npx tsx scripts/csat-lecture/drain-export.mts --pilot                 (R-BLANK 3 + R-ORDER 3)
//   npx tsx scripts/csat-lecture/drain-export.mts --type R-NOTICE --size 8
//   npx tsx scripts/csat-lecture/drain-export.mts --all --size 8          (남은 전부, 유형별)
//   npx tsx scripts/csat-lecture/drain-export.mts --redo 2026#30,M2509#33 --name redo-0917

import fs from 'node:fs'
import path from 'node:path'

import { lectureTargets } from '../../src/lib/csat/lecture/targets'
import type { LectureIndex } from '../../src/lib/csat/lecture/types'
import { splitSentences } from '../../src/lib/csat/passage-skeleton'
import { loadItemSkeleton } from '../../src/lib/csat/skeleton'
import { arg, DATA, flag, readJson, serviceDb, WORK, writeJson } from './env.mts'

const PILOT_TYPES = ['R-BLANK', 'R-ORDER']
const SIZE = Number(arg('size', '8'))
const LIMIT = arg('limit') ? Number(arg('limit')) : Infinity
const REDO = new Set((arg('redo', '') ?? '').split(',').map((s) => s.trim()).filter(Boolean))

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

type ItemRow = {
  id: string
  exam_id: string
  no: number
  type_id: string | null
  stem: string | null
  passage: string | null
  choices: unknown
  answer: number | null
  points: number | null
  in_scope: boolean
}
type AnalysisRow = {
  item_id: string
  version: number
  answer_unknown: boolean | null
  measured_ability: string | null
  design_intent: string | null
  answer_locus: { quote?: string; reasoning?: string } | null
  choice_analysis: { n: number; verdict?: string; trap?: string | null; why_tempting?: string | null; how_to_reject?: string | null; why_correct?: string | null }[] | null
  solve_procedure: { step: string; on_fail?: string }[] | null
  required_vocab: string[] | null
  time_budget_sec: number | null
}

const [items, analyses, exams, types] = await Promise.all([
  all<ItemRow>('csat_items', 'id, exam_id, no, type_id, stem, passage, choices, answer, points, in_scope', (q) =>
    q.eq('in_scope', true),
  ),
  all<AnalysisRow>(
    'csat_item_analyses',
    'item_id, version, answer_unknown, measured_ability, design_intent, answer_locus, choice_analysis, solve_procedure, required_vocab, time_budget_sec',
    (q) => q.eq('status', 'published'),
  ),
  all<{ id: string; label: string; year: number; month: number }>('csat_exams', 'id, label, year, month'),
  all<{ id: string; name: string }>('csat_types', 'id, name'),
])

const latest = new Map<string, AnalysisRow>()
for (const a of analyses) {
  const cur = latest.get(a.item_id)
  if (!cur || a.version > cur.version) latest.set(a.item_id, a)
}
const examOf = new Map(exams.map((e) => [e.id, e]))
const typeName = new Map(types.map((t) => [t.id, t.name]))
const index = readJson<LectureIndex>(path.join(DATA, 'index.json'), { built: '', items: {} })

function record(it: ItemRow, a: AnalysisRow) {
  const sk = loadItemSkeleton(it.id)
  const chs = a.choice_analysis ?? []
  const answerUnknown = a.answer_unknown === true
  const distractors = chs.filter((c) => c.verdict === 'distractor').map((c) => c.n).sort((x, y) => x - y)
  const spans = it.passage ? splitSentences(it.passage) : []
  // 골격과 우리가 센 문장 수가 다르면 골격이 낡은 것이다 — 그때는 문장 자리를 못 가리키게 한다
  const skeletonOk = sk != null && sk.sentences.length === spans.length
  const targets = lectureTargets({
    answer: it.answer,
    answer_unknown: answerUnknown,
    has_ability: Boolean(a.measured_ability?.trim()),
    has_intent: Boolean(a.design_intent?.trim()),
    distractors,
    procedure_len: (a.solve_procedure ?? []).length,
    vocab_len: (a.required_vocab ?? []).length,
    skeleton: sk ? { sentences: sk.sentences.length, placedAnchorIds: sk.anchors.filter((x) => x.sentences.length).map((x) => x.id) } : null,
  })
  if (!skeletonOk && targets.anchor.length) targets.anchor = []
  return {
    id: it.id,
    exam_label: examOf.get(it.exam_id)?.label ?? it.exam_id,
    no: it.no,
    type_id: it.type_id,
    type_name: it.type_id ? (typeName.get(it.type_id) ?? null) : null,
    points: it.points,
    answer: answerUnknown ? null : it.answer,
    answer_unknown: answerUnknown,
    targets,
    /** 지도에서 각 앵커가 몇 번째 문장(0부터)에 붙었나 */
    map: sk ? sk.anchors.map((x) => ({ id: x.id, sentences: x.sentences, from: x.from ?? null })) : null,
    analysis: {
      measured_ability: a.measured_ability,
      design_intent: a.design_intent,
      evidence_quote: a.answer_locus?.quote ?? null,
      evidence_reasoning: a.answer_locus?.reasoning ?? null,
      choices: chs,
      procedure: a.solve_procedure ?? [],
      required_vocab: a.required_vocab ?? [],
      time_budget_sec: a.time_budget_sec,
    },
    /** 대본을 쓰는 쪽만 읽는다 — 커밋되지 않는다 */
    source: {
      stem: it.stem,
      sentences: spans.map((s, k) => ({ k, text: it.passage!.slice(s.start, s.end) })),
      choices: it.choices,
    },
  }
}

const pool = items
  .filter((it) => latest.has(it.id))
  .filter((it) => (REDO.size ? REDO.has(it.id) : !index.items[it.id]))
  .sort((a, b) => {
    const ea = examOf.get(a.exam_id)
    const eb = examOf.get(b.exam_id)
    return (eb?.year ?? 0) - (ea?.year ?? 0) || (eb?.month ?? 0) - (ea?.month ?? 0) || a.no - b.no
  })
const skipped = items.filter((it) => latest.has(it.id) && index.items[it.id] && !REDO.has(it.id)).length

const chunks: { name: string; items: ReturnType<typeof record>[] }[] = []
if (flag('pilot')) {
  // 파일럿은 **지도가 있는** 최신 문항만 — Gate 2 가 문장 자리 하이라이트까지 재야 한다
  const picked: ReturnType<typeof record>[] = []
  for (const t of PILOT_TYPES) {
    const rows = pool
      .filter((it) => it.type_id === t)
      .map((it) => record(it, latest.get(it.id)!))
      .filter((r) => r.targets.anchor.length > 0 && r.answer != null)
      .slice(0, 3)
    picked.push(...rows)
  }
  chunks.push({ name: 'pilot', items: picked })
} else if (REDO.size) {
  chunks.push({ name: arg('name', 'redo')!, items: pool.map((it) => record(it, latest.get(it.id)!)) })
} else {
  const only = arg('type')
  const byType = new Map<string, ItemRow[]>()
  for (const it of pool) {
    if (!it.type_id || (only && it.type_id !== only)) continue
    if (!flag('all') && !only) continue
    byType.set(it.type_id, [...(byType.get(it.type_id) ?? []), it])
  }
  for (const [t, rows] of byType)
    for (let i = 0; i < rows.length; i += SIZE)
      chunks.push({
        name: `${t}-${String(i / SIZE + 1).padStart(2, '0')}`,
        items: rows.slice(i, i + SIZE).map((it) => record(it, latest.get(it.id)!)),
      })
}

let written = 0
for (const c of chunks.slice(0, LIMIT)) {
  const p = path.join(WORK, `chunk-${c.name}.json`)
  if (fs.existsSync(p) && !flag('force')) {
    console.log(`  ${c.name}: 이미 있다 — 건너뜀 (--force 로 덮기)`)
    continue
  }
  writeJson(p, { name: c.name, created: new Date().toISOString(), items: c.items })
  written += 1
  console.log(`  ${c.name}: ${c.items.length}문항 → ${path.relative(process.cwd(), p)}`)
}
console.log(`청크 ${written}개 · 대상 ${pool.length} · 이미 적재돼 건너뜀 ${skipped}`)
