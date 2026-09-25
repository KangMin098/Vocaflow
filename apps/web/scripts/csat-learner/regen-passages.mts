// apps/web/scripts/csat-learner/regen-passages.mts
//
// **DB 기출 원문을 reflow(로컬 PDF) 로 다시 만든다.** (2026-09-25 · 원문 품질 병목 조치 2단계)
//
// 근거(DECISIONS 2026-09-25 「빈칸은 그린 선이다」): DB 원문(pdftotext)은 빈칸 표시를 엉뚱한 자리에 끼우거나
// 빈칸이 없어야 할 문항에 끼웠고, 선지 끝에 쪽 번호가 붙었다. reflow 는 빈칸 790/802 · 선지 오류 0 · 자리
// 대조에서 어긋난 곳마다 DB 가 틀렸다(`blank-audit.mts`). 그래서 reflow 를 정본으로 DB 를 고친다.
//
// 안전 조건 — 추출이 망가진 문항으로 DB 를 덮지 않는다:
//   지문  reflow 가 정상 추출(ok · 비지 않음)이고 DB 와 낱말 유사도 ≥ 0.9 일 때만 바꾼다.
//         DB 가 body_ok=false 면 유사도 대신 길이가 DB 의 0.8 배 이상인지만 본다(DB 가 잘린 쪽이다).
//   선지  reflow 선지가 5개 모두 비지 않을 때만 바꾼다(기호 선지 유형은 선지 블록이 없어 건드리지 않는다).
// 재실행 안전: 정규화한 값이 이미 같으면 쓰지 않는다. 기본은 dry-run — `--commit` 이 있어야 쓴다.
// 백업: `--commit` 은 쓰기 전에 옛 값을 `test-results-csat-learner/regen-backup-<시각>.json` 에 남긴다
//   (gitignore — 원문이 들어 있다). 되돌리기: 같은 파일로 `--restore <파일>`.
//
// 원문은 출력하지 않는다 — 수치와 문항 번호만.
//   npx tsx scripts/csat-learner/regen-passages.mts [--exams 2026,M2706] [--commit] [--restore <backup.json>]

import fs from 'node:fs'
import path from 'node:path'

import { splitSentences } from '../../src/lib/csat/passage-skeleton'
import { reflowExam } from '../../src/lib/csat/reflow/reflow'
import type { ReflowAnchors } from '../../src/lib/csat/reflow/types'
import { arg, flag, localPapers, pdfPages, serviceDb } from './env.mts'

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
function wordSim(a: string, b: string): number {
  const x = words(a)
  const y = words(b)
  if (!x.length && !y.length) return 1
  if (!x.length || !y.length) return 0
  let prev = new Uint16Array(y.length + 1)
  let cur = new Uint16Array(y.length + 1)
  for (let i = 1; i <= x.length; i += 1) {
    for (let j = 1; j <= y.length; j += 1) cur[j] = x[i - 1] === y[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1])
    ;[prev, cur] = [cur, prev]
  }
  return prev[y.length] / Math.max(x.length, y.length)
}
const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
const BLANK = /_{3,}|＿{2,}/g
const blanks = (s: string | null | undefined) => ((s ?? '').match(BLANK) ?? []).length

type Row = { id: string; no: number; type_id: string | null; passage: string | null; choices: string[] | null; body_ok: boolean }

const db = await serviceDb()
const COMMIT = flag('commit')
const RESTORE = arg('restore')

if (RESTORE) {
  const backup = JSON.parse(fs.readFileSync(path.resolve(RESTORE), 'utf8')) as { id: string; passage: string | null; choices: string[] | null }[]
  let n = 0
  for (const b of backup) {
    const { error } = await db.from('csat_items').update({ passage: b.passage, choices: b.choices }).eq('id', b.id)
    if (error) throw error
    n++
  }
  console.log(`되돌림 ${n}문항 · ${RESTORE}`)
  process.exit(0)
}

const papers = localPapers()
const index = JSON.parse(fs.readFileSync(path.resolve('src/lib/csat/anchor-data/index.json'), 'utf8')) as { exams: { exam_id: string }[] }
const only = arg('exams')
const exams = only ? only.split(',') : index.exams.map((e) => e.exam_id)

const tally = { items: 0, same: 0, passage: 0, choices: 0, both: 0, skipOk: 0, skipSim: 0, skipShort: 0, noPdf: 0 }
const why = { blankFixed: 0, blankAdded: 0, blankRemoved: 0, textOnly: 0 }
const simHist = { lt90: 0, s90: 0, s95: 0, s99: 0 }
const fromBad: string[] = []
const skipped: string[] = []
const writes: { id: string; passage?: string; choices?: string[] }[] = []
// 하류 영향 — 문장 수가 바뀌면 골격 · 강의 문장 앵커(`sentence:k`) · 설계 주석(roles) 의 번호가 어긋난다
const lectured = new Set<string>()
for (const f of fs.readdirSync(path.resolve('src/lib/csat/lecture-data')).filter((f) => f.endsWith('.json') && f !== 'index.json')) {
  const j = JSON.parse(fs.readFileSync(path.resolve('src/lib/csat/lecture-data', f), 'utf8')) as { lectures?: Record<string, { item_id: string }> }
  for (const l of Object.values(j.lectures ?? {})) lectured.add(l.item_id)
}
const designed = new Set<string>()
const DD = path.resolve('../../scripts/csat/design-drain')
for (const f of fs.existsSync(DD) ? fs.readdirSync(DD).filter((f) => f.endsWith('.out.json')) : [])
  for (const r of (JSON.parse(fs.readFileSync(path.join(DD, f), 'utf8')).items ?? []) as { id: string }[]) designed.add(r.id)
const shifted: { id: string; from: number; to: number; lecture: boolean; design: boolean }[] = []
const backup: { id: string; passage: string | null; choices: string[] | null }[] = []

for (const exam of exams) {
  const anchors = JSON.parse(fs.readFileSync(path.resolve(`src/lib/csat/anchor-data/${exam}.json`), 'utf8')) as ReflowAnchors & { sha256: string }
  const file = papers.get(anchors.sha256)
  if (!file) {
    tally.noPdf++
    console.log(`${exam} — 로컬 PDF 없음, 건너뜀`)
    continue
  }
  const { data, error } = await db.from('csat_items').select('id, no, type_id, passage, choices, body_ok').eq('exam_id', exam).eq('in_scope', true)
  if (error) throw error
  const rows = (data ?? []) as Row[]
  const typeOf = new Map(rows.map((r) => [r.no, r.type_id]))
  const got = reflowExam(await pdfPages(file), anchors, (no) => typeOf.get(no) ?? null, rows.map((r) => r.no))
  for (const r of rows) {
    tally.items++
    const rf = got.get(r.no)
    if (!rf?.ok || !rf.passage) {
      tally.skipOk++
      skipped.push(`${r.id}(추출 실패)`)
      continue
    }
    const sim = r.passage ? wordSim(rf.passage, r.passage) : 0
    if (sim < 0.9) simHist.lt90++
    else if (sim < 0.95) simHist.s90++
    else if (sim < 0.99) simHist.s95++
    else simHist.s99++
    const passageOk = r.body_ok ? sim >= 0.9 : rf.passage.length >= 0.8 * (r.passage?.length ?? 0)
    if (!passageOk) {
      if (r.body_ok) tally.skipSim++
      else tally.skipShort++
      skipped.push(`${r.id}(${r.body_ok ? `유사도 ${sim.toFixed(2)}` : '재추출이 더 짧음'})`)
      continue
    }
    const newPassage = norm(rf.passage) !== norm(r.passage) ? rf.passage : undefined
    const choicesOk = rf.choices.length === 5 && rf.choices.every((c) => c.trim())
    const newChoices =
      choicesOk && JSON.stringify(rf.choices.map(norm)) !== JSON.stringify((r.choices ?? []).map(norm)) ? rf.choices : undefined
    if (!newPassage && !newChoices) {
      tally.same++
      continue
    }
    if (newPassage && newChoices) tally.both++
    else if (newPassage) tally.passage++
    else tally.choices++
    if (newPassage) {
      const a = blanks(r.passage)
      const b = blanks(rf.passage)
      if (a === b && a > 0) why.blankFixed++
      else if (b > a) why.blankAdded++
      else if (b < a) why.blankRemoved++
      else why.textOnly++
      if (!r.body_ok) fromBad.push(r.id)
      const from = r.passage ? splitSentences(r.passage).length : 0
      const to = splitSentences(rf.passage).length
      if (from !== to) shifted.push({ id: r.id, from, to, lecture: lectured.has(r.id), design: designed.has(r.id) })
    }
    writes.push({ id: r.id, ...(newPassage ? { passage: newPassage } : {}), ...(newChoices ? { choices: newChoices } : {}) })
    backup.push({ id: r.id, passage: r.passage, choices: r.choices })
  }
}

console.log(`\n=== DB 원문 재생성 ${COMMIT ? '적재' : 'dry-run'} · ${tally.items}문항 ===`)
console.log(`바뀜: 지문만 ${tally.passage} · 선지만 ${tally.choices} · 둘 다 ${tally.both} · 합 ${writes.length} · 이미 같음 ${tally.same}`)
console.log(`지문 변화 종류: 빈칸 자리·잡음 정리(개수 같음) ${why.blankFixed} · 빈칸 생김 ${why.blankAdded} · 잘못된 빈칸 표시 제거 ${why.blankRemoved} · 글자만 ${why.textOnly}`)
console.log(`DB 가 body_ok=false 였다가 고쳐지는 문항 ${fromBad.length}`)
console.log(
  `문장 수가 바뀌는 문항 ${shifted.length} — 그중 강의 있음 ${shifted.filter((s) => s.lecture).length} · 설계 주석 있음 ${shifted.filter((s) => s.design).length} · body_ok=false 였던 것 ${shifted.filter((s) => fromBad.includes(s.id)).length}`,
)
const good = shifted.filter((s) => !fromBad.includes(s.id))
if (good.length) console.log(`  body_ok=true 인데 문장 수 바뀜: ${good.map((s) => `${s.id}(${s.from}→${s.to}${s.lecture ? '·강의' : ''}${s.design ? '·주석' : ''})`).join(' ')}`)
console.log(`DB 와 낱말 유사도 분포: <0.90 ${simHist.lt90} · 0.90~0.95 ${simHist.s90} · 0.95~0.99 ${simHist.s95} · ≥0.99 ${simHist.s99}`)
console.log(`건너뜀: 추출 실패 ${tally.skipOk} · 유사도 < 0.9 ${tally.skipSim} · 재추출이 더 짧음 ${tally.skipShort} · 로컬 PDF 없음(회차) ${tally.noPdf}`)
if (skipped.length) console.log(`  ${skipped.join(' ')}`)

if (COMMIT && writes.length) {
  const out = path.resolve(`test-results-csat-learner/regen-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, JSON.stringify(backup))
  console.log(`백업 ${backup.length}문항 → ${path.relative(process.cwd(), out)}`)
  let n = 0
  for (const w of writes) {
    const { error } = await db.from('csat_items').update({ ...(w.passage ? { passage: w.passage } : {}), ...(w.choices ? { choices: w.choices } : {}) }).eq('id', w.id)
    if (error) throw new Error(`${w.id}: ${error.message}`)
    n++
  }
  console.log(`썼음 ${n}문항`)
}
