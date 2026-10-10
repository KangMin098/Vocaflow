// apps/web/scripts/csat-learner/remap-lecture-circled-split.mts
//
// **분할기 수정(동그라미 번호 문장 · F08 · 2026-10-11) 뒤 강의 문장 번호를 옮긴다.**
//
// `splitSentences` 가 「… . ① As …」 를 앞 문장에 붙이던 결함을 고쳤더니, 무관 문장 · 도표 · 어법 지문의 옛 문장 하나가
// 새 문장 여럿으로 갈렸다. 강의 큐의 `sentence:k` 는 옛 번호다. 옛 문장 k 의 범위 안에 든 새 조각 가운데:
//   · 큐 대본이 「N번째 문장」 을 말하고 그 새 번호(N-1)가 그 범위 안이면 → N-1 (말과 막대를 맞춘다)
//   · 아니면 → 첫 조각
// 그 뒤 `focus` 를 새 문장 수로 다시 계산한다(`withFocus` — 대본이 말한 번호). 대본 글자는 바꾸지 않는다.
//
// 옛 분할 = 이 파일 안의 `oldSplit`(고치기 전 규칙 그대로) · 새 분할 = 지금 `splitSentences`. 원문은 DB(읽기 전용).
// 기본은 dry-run. `--write` 가 있어야 `src/lib/csat/lecture-data/*.json` 을 고친다(저장소 파일 · DB 쓰기 없음).
//   npx tsx scripts/csat-learner/remap-lecture-circled-split.mts [--write]

import fs from 'node:fs'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { splitSentences } from '../../src/lib/csat/passage-skeleton'
import { withFocus } from '../../src/lib/csat/lecture/focus'
import type { Lecture, LectureExamFile, LectureIndex } from '../../src/lib/csat/lecture/types'

for (const f of ['.env.local', '../../.env.local']) {
  try {
    for (const line of fs.readFileSync(path.resolve(f), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* 없으면 다음 후보 */
  }
}

const WRITE = process.argv.includes('--write')
const DATA = path.resolve('src/lib/csat/lecture-data')
// passage-skeleton.ts 와 같은 약어 목록(옛 번호를 정확히 재현하려고 그대로 옮긴다)
const ABBREV = /(?:\b(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|e\.g|i\.e|U\.S|U\.K|No|Fig|approx)\.)$/i

/** 고치기 전 규칙(동그라미 번호를 새 문장 머리로 안 봄) — 옛 번호를 재현하는 데만 쓴다 */
function oldSplit(passage: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = []
  let start = 0
  for (let i = 0; i < passage.length; i += 1) {
    const ch = passage[i]
    if (ch !== '.' && ch !== '!' && ch !== '?') continue
    let j = i + 1
    while (j < passage.length && /["'’”)\]]/.test(passage[j])) j += 1
    if (j < passage.length && !/\s/.test(passage[j])) continue
    if (ABBREV.test(passage.slice(start, j))) continue
    let k = j
    while (k < passage.length && /\s/.test(passage[k])) k += 1
    if (k < passage.length && !/[A-Z“"('‘[]/.test(passage[k])) continue
    out.push({ start, end: j })
    start = k
    i = k - 1
  }
  if (start < passage.length) out.push({ start, end: passage.length })
  return out.filter((s) => passage.slice(s.start, s.end).trim().length > 0)
}

const ORD: Record<string, number> = { 첫: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10, 열한: 11, 열두: 12, 열세: 13 }
const ORD_RE = new RegExp(`(${Object.keys(ORD).sort((a, b) => b.length - a.length).join('|')})\\s*번째\\s*문장|첫\\s*문장`)

const files = fs.readdirSync(DATA).filter((f) => f.endsWith('.json') && f !== 'index.json')
const byExam = new Map<string, LectureExamFile>()
for (const f of files) byExam.set(f.replace(/\.json$/, ''), JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')))
const lectured = [...byExam.values()].flatMap((d) => Object.keys(d.lectures))

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const passages = new Map<string, string>()
for (let i = 0; i < lectured.length; i += 200) {
  const { data, error } = await db.from('csat_items').select('id, passage').in('id', lectured.slice(i, i + 200))
  if (error) throw new Error(error.message)
  for (const r of data ?? []) if (r.passage) passages.set(r.id, r.passage)
}

let items = 0
let cuesMoved = 0
let byOrdinal = 0
const changedExams = new Set<string>()
for (const [exam, d] of byExam) {
  for (const [id, lec] of Object.entries(d.lectures) as [string, Lecture][]) {
    const p = passages.get(id)
    if (!p) continue
    const olds = oldSplit(p)
    const news = splitSentences(p)
    if (olds.length === news.length) continue
    items += 1
    const piecesOf = (k: number) => news.map((r, i) => ({ r, i })).filter(({ r }) => r.start >= olds[k].start && r.start < olds[k].end).map(({ i }) => i)
    for (const c of lec.cues) {
      if (c.target.kind !== 'anchor') continue
      const m = /^sentence:(\d+)$/.exec(c.target.id)
      if (!m) continue
      const k = Number(m[1])
      if (k >= olds.length) continue
      const pieces = piecesOf(k)
      if (!pieces.length) continue
      const ko = c.segments.filter((s) => s.lang.startsWith('ko')).map((s) => s.text).join(' ')
      const om = ORD_RE.exec(ko)
      const spoken = om ? (om[1] ? ORD[om[1]] : 1) - 1 : null
      const to = spoken != null && pieces.includes(spoken) ? spoken : pieces[0]
      if (spoken != null && to === spoken) byOrdinal += 1
      if (to !== k) {
        c.target = { ...c.target, id: `sentence:${to}` }
        cuesMoved += 1
      }
    }
    for (const c of lec.cues) delete (c as { focus?: number[] }).focus
    lec.cues = withFocus(lec.cues, news.length)
    lec.version += 1
    changedExams.add(exam)
  }
}

console.log(`${WRITE ? '적재' : 'dry-run — --write 를 붙이면 lecture-data 를 고친다'} · 문장 수가 바뀐 강의 ${items} · 옮긴 큐 ${cuesMoved}(대본 서수로 ${byOrdinal}) · 회차 ${changedExams.size}`)
if (WRITE) {
  for (const exam of changedExams) {
    const file = path.join(DATA, `${exam}.json`)
    const raw = fs.readFileSync(file, 'utf8')
    const out = JSON.stringify(byExam.get(exam), null, 2) + (raw.endsWith('\n') ? '\n' : '')
    fs.writeFileSync(file, raw.includes('\r\n') ? out.replace(/\n/g, '\r\n') : out)
  }
  // 색인은 길이 · 큐 수만 — 대본 글자 · 시간은 그대로라 바꿀 것이 없다
  void (null as unknown as LectureIndex)
}
