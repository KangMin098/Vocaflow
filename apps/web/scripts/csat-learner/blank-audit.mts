// apps/web/scripts/csat-learner/blank-audit.mts
//
// **빈칸 표시 감사 — DB 원문과 reflow(학습자 PDF 추출) 중 누가 빈칸을 제자리에 두나.** (2026-09-25)
//
// 출제 설계 주석 드레인에서 body_ok=true 인데 빈칸 표시가 엉뚱한 문장에 붙은 문항이 22개 나왔다
// (docs/csat-learner/design-drain-defects.md). 원문을 다시 뽑기 전에, reflow 가 그 결함을 갖고 있지
// 않은지 전량으로 잰다. 빈칸이 있어야 하는 유형(R-BLANK)은 빈칸 표시가 **정확히 1개**여야 하고,
// 그 밖의 유형은 **0개**여야 한다(요약문 · 장문 빈칸 등 복수 빈칸 유형은 따로 센다).
//
// ⚠️ 수치와 문항 번호만 출력한다. 원문을 찍지 않는다.
//   npx tsx scripts/csat-learner/blank-audit.mts [--exams 2026,M2706]

import fs from 'node:fs'
import path from 'node:path'

import { reflowExam } from '../../src/lib/csat/reflow/reflow'
import type { ReflowAnchors } from '../../src/lib/csat/reflow/types'
import { arg, localPapers, pdfPages, serviceDb } from './env.mts'

const BLANK = /_{3,}|＿{2,}/g
const count = (s: string | null | undefined) => (s ? (s.match(BLANK) ?? []).length : 0)
/** 빈칸이 둘인 유형(요약문 (A)(B) · 2개 빈칸) — 기대 개수가 2 */
const TWO = new Set(['R-SUMMARY', 'R-BLANK2', 'X-BLANK2'])
const ONE = new Set(['R-BLANK', 'X-BLANK'])
const expected = (type: string | null) => (type && TWO.has(type) ? 2 : type && ONE.has(type) ? 1 : 0)

const db = await serviceDb()
const papers = localPapers()
const index = JSON.parse(fs.readFileSync(path.resolve('src/lib/csat/anchor-data/index.json'), 'utf8')) as {
  exams: { exam_id: string }[]
}
const only = arg('exams')
const exams = only ? only.split(',') : index.exams.map((e) => e.exam_id)

const tally = { items: 0, dbOk: 0, reflowOk: 0, both: 0, dbOnly: 0, reflowOnly: 0, neither: 0, noReflow: 0 }
const byType = new Map<string, { n: number; db: number; rf: number }>()
const reflowBad: string[] = []
const dbBadReflowOk: string[] = []
const place = { n: 0, same: 0, diff: [] as string[] }

for (const exam of exams) {
  const anchors = JSON.parse(fs.readFileSync(path.resolve(`src/lib/csat/anchor-data/${exam}.json`), 'utf8')) as ReflowAnchors & {
    sha256: string
  }
  const file = papers.get(anchors.sha256)
  if (!file) {
    console.log(`${exam} — 로컬 PDF 없음(해시 불일치), 건너뜀`)
    continue
  }
  const { data, error } = await db.from('csat_items').select('id, no, type_id, passage, in_scope').eq('exam_id', exam).eq('in_scope', true)
  if (error) throw error
  const rows = (data ?? []) as { id: string; no: number; type_id: string | null; passage: string | null }[]
  const typeOf = new Map(rows.map((r) => [r.no, r.type_id]))
  const got = reflowExam(await pdfPages(file), anchors, (no) => typeOf.get(no) ?? null, rows.map((r) => r.no))
  for (const r of rows) {
    const rf = got.get(r.no)
    tally.items++
    if (!rf?.passage) {
      tally.noReflow++
      continue
    }
    const want = expected(r.type_id)
    const dbOk = count(r.passage) === want
    const rfOk = count(rf.passage) === want
    if (dbOk) tally.dbOk++
    if (rfOk) tally.reflowOk++
    if (dbOk && rfOk) tally.both++
    else if (dbOk) tally.dbOnly++
    else if (rfOk) tally.reflowOnly++
    else tally.neither++
    // 자리 대조 — 둘 다 빈칸이 1개면(서로 독립인 두 추출) 빈칸 바로 앞 세 낱말이 같아야 한다
    if (want === 1 && dbOk && rfOk) {
      const before = (s: string) =>
        s.split(/_{3,}|＿{2,}/)[0].toLowerCase().replace(/[^a-z\s]/g, ' ').trim().split(/\s+/).slice(-3).join(' ')
      place.n++
      if (before(r.passage!) === before(rf.passage)) place.same++
      else place.diff.push(r.id)
    }
    if (!rfOk) reflowBad.push(`${r.id}(${r.type_id} 기대 ${want} · reflow ${count(rf.passage)})`)
    if (!dbOk && rfOk) dbBadReflowOk.push(r.id)
    const t = byType.get(r.type_id ?? '?') ?? { n: 0, db: 0, rf: 0 }
    t.n++
    if (dbOk) t.db++
    if (rfOk) t.rf++
    byType.set(r.type_id ?? '?', t)
  }
}

console.log(`\n=== 빈칸 표시 개수 감사 · ${tally.items}문항 ===`)
console.log(`DB 맞음 ${tally.dbOk} · reflow 맞음 ${tally.reflowOk} · 둘 다 ${tally.both} · DB만 ${tally.dbOnly} · reflow만 ${tally.reflowOnly} · 둘 다 틀림 ${tally.neither} · reflow 없음 ${tally.noReflow}`)
console.log('\n유형별 (문항 · DB 맞음 · reflow 맞음) — 한쪽이라도 틀린 유형만:')
for (const [t, v] of [...byType].sort()) if (v.db < v.n || v.rf < v.n) console.log(`  ${t} ${v.n} · ${v.db} · ${v.rf}`)
console.log(`\n빈칸 자리 대조(둘 다 1개인 문항 · 앞 세 낱말): ${place.same}/${place.n} 일치${place.diff.length ? ' · 어긋남 ' + place.diff.join(' ') : ''}`)
console.log(`\nDB 는 틀리고 reflow 는 맞은 문항 ${dbBadReflowOk.length}개`)
console.log(`reflow 가 틀린 문항 ${reflowBad.length}개${reflowBad.length ? ':\n  ' + reflowBad.join('\n  ') : ''}`)
