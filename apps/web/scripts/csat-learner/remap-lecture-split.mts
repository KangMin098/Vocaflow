// apps/web/scripts/csat-learner/remap-lecture-split.mts
//
// **분할기가 바뀐 뒤 강의 큐의 문장 번호(`sentence:k`)를 옮긴다.** (2026-09-28 · 원 숫자 분할)
//
// `splitSentences` 가 ①–⑤ 앞에서도 자르게 바뀌면(2026-09-28) 옛 문장 하나가 새 문장 여럿으로 갈린다.
// 지문 글자는 그대로라 **글자 위치로** 옮긴다 — 옛 k번 문장의 시작 오프셋을 담은 새 문장 번호.
// 옛 분할 규칙은 아래 `oldSplit` 에 그대로 옮겨 두었다(바뀐 곳은 다음 글자 문자 집합 하나).
//
// 기본은 dry-run. `--write` 가 있어야 `src/lib/csat/lecture-data/*.json` 을 고친다(저장소 파일 · DB 무관).
//   NODE_OPTIONS=--tls-max-v1.2 npx tsx scripts/csat-learner/remap-lecture-split.mts [--write]

import fs from 'node:fs'
import path from 'node:path'

import { splitSentences } from '../../src/lib/csat/passage-skeleton'
import { flag, serviceDb } from './env.mts'

const WRITE = flag('write')
const LEC = path.resolve('src/lib/csat/lecture-data')
const db = await serviceDb()

const ABBREV = /(?:\b(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|e\.g|i\.e|U\.S|U\.K|No|Fig|approx)\.)$/i
/** 2026-09-28 이전 분할 — 원 숫자 앞에서 자르지 않았다 */
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

type Cue = { target: { kind: string; id: string } }
type File = { lectures: Record<string, { item_id: string; cues: Cue[] }> }

const tally = { files: 0, items: 0, cues: 0, moved: 0 }
for (const f of fs.readdirSync(LEC).filter((f) => f.endsWith('.json'))) {
  const file = JSON.parse(fs.readFileSync(path.join(LEC, f), 'utf8')) as File
  const ids = Object.keys(file.lectures ?? {})
  if (!ids.length) continue
  const { data, error } = await db.from('csat_items').select('id, passage').in('id', ids)
  if (error) throw new Error(error.message)
  let changed = false
  for (const it of data ?? []) {
    if (!it.passage) continue
    const olds = oldSplit(it.passage)
    const news = splitSentences(it.passage)
    if (olds.length === news.length) continue
    tally.items++
    const map = olds.map((o) => news.findIndex((n) => n.start <= o.start && o.start < Math.max(n.end, n.start + 1)))
    for (const c of file.lectures[it.id].cues) {
      const m = c.target?.kind === 'anchor' && /^sentence:(\d+)$/.exec(c.target.id)
      if (!m) continue
      tally.cues++
      const to = map[Number(m[1])]
      if (to == null || to < 0) throw new Error(`${it.id} sentence:${m[1]} 옮길 자리 없음`)
      if (to !== Number(m[1])) {
        tally.moved++
        c.target.id = `sentence:${to}`
        changed = true
      }
    }
  }
  if (changed) {
    tally.files++
    if (WRITE) fs.writeFileSync(path.join(LEC, f), JSON.stringify(file, null, 2) + '\n')
  }
}
console.log(`${WRITE ? '고침' : 'dry-run — --write 를 붙이면 고친다'} · 분할 달라진 문항 ${tally.items} · 문장 큐 ${tally.cues} · 옮김 ${tally.moved} · 파일 ${tally.files}`)
