// 표본 추출 — 유형별 강의 수 비례(최소 3) · id 정렬 균등 간격 · 4청크 라운드로빈. 읽기 전용.
// 사용: node sample.mjs <lecture-data dir>   (deterministic.json 이 같은 폴더에 있어야 한다)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const D = process.argv[2]
const det = JSON.parse(fs.readFileSync(path.join(here, 'deterministic.json'), 'utf8'))
const idx = JSON.parse(fs.readFileSync(path.join(D, 'index.json'), 'utf8')).items
const byType = {}
for (const l of det.lectures) (byType[idx[l.id]?.type || 'UNK'] ??= []).push(l)
const pick = []
for (const [t, ls] of Object.entries(byType).sort()) {
  ls.sort((a, b) => a.id.localeCompare(b.id))
  const n = Math.min(ls.length, Math.max(3, Math.round((120 * ls.length) / det.lectures.length)))
  for (let k = 0; k < n; k++) pick.push({ ...ls[Math.floor((k * ls.length) / n)], type: t })
}
const files = {}
const chunks = [[], [], [], []]
pick.forEach((l, i) => {
  const exam = l.id.split('#')[0]
  files[exam] ??= JSON.parse(fs.readFileSync(path.join(D, exam + '.json'), 'utf8'))
  const lec = files[exam].lectures[l.id]
  const stop = l.first_disclosure_at
  const dcue = lec.cues[l.direct_at ?? stop]
  chunks[i % 4].push({
    id: l.id,
    type: l.type,
    official_answer_cue: dcue.segments.map((s) => s.text).join(' '),
    pre_disclosure_cues: lec.cues.slice(0, stop).map((c, j) => ({ i: j, id: c.id, role: c.role, target: c.target.kind + ':' + c.target.id, text: c.segments.map((s) => s.text).join(' ') })),
  })
})
fs.mkdirSync(path.join(here, 'chunks'), { recursive: true })
chunks.forEach((c, i) => fs.writeFileSync(path.join(here, 'chunks', `chunk-0${i + 1}.json`), JSON.stringify(c, null, 1)))
console.log('sample', pick.length)
