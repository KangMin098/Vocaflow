// scripts/csat/export-restored.mjs
//
// **삽입 문항의 원래 지문을 복원해 문장 번호를 붙여 내보낸다 — 읽기 전용.**
//
// 왜. 지금까지의 제약은 전부 "정답이 이런 성질을 갖는가" 였고 base rate 앞에서 무너졌다
// (H6 96% vs 기저 71%). 성질은 **선택자가 아니다.**
//
// 삽입의 진짜 설계 제약 후보는 **재삽입의 유일성** 이다 —
// 문장 S 를 빼냈을 때 되돌릴 자리가 **딱 하나** 여야 문항이 성립한다.
// 두 자리가 다 말이 되면 복수정답이고, 아무 데나 넣어도 되면 문항이 아니다.
// 이건 정규식으로 못 재고 **의미 판단** 이 필요하다 → Claude Code 배치로 직접 읽는다
// (CLAUDE.md §🤖 — LLM 판단이 필요한 일은 내가 그 LLM이다).
//
// 이 스크립트는 판단용 자료만 만든다. 판단은 사람(나)이 하고 결과는
// `data/uniqueness-<exam>-<no>.json` 으로 손으로 적는다.
//
// 실행: pnpm dlx tsx scripts/csat/export-restored.mjs [건수]

import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve('scripts/csat/data')
const COL_DIR = path.join(OUT_DIR, 'columns')
const R = (f) => JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'))
const LIMIT = Number(process.argv[2] ?? 4)

const cache = new Map()
function examLines(exam) {
  if (!cache.has(exam)) {
    const p = path.join(COL_DIR, `${exam}.txt`)
    cache.set(exam, fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r/g, '').split('\n') : null)
  }
  return cache.get(exam)
}
function itemLines(exam, no) {
  const lines = examLines(exam)
  if (!lines) return null
  const i = lines.findIndex((l) => new RegExp(`^\\s*${no}\\s*\\.`).test(l))
  if (i < 0) return null
  let j = lines.findIndex((l, k) => k > i && new RegExp(`^\\s*${no + 1}\\s*\\.`).test(l))
  if (j < 0 || j - i > 220) j = Math.min(i + 160, lines.length)
  return lines.slice(i, j)
}
const sentences = (t) =>
  t.replace(/\s+/g, ' ')
    .split(/(?<=[.!?]["'’”)]?)\s+(?=["'“‘(]?[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12)

const classified = R('classified.json')
const answers = R('answers.json').answers
const key = new Map(answers.map((a) => [`${a.exam}#${a.no}`, a]))

const out = []
for (const q of classified.rows.filter((r) => r.exam !== '2014A' && r.type === 'R-INSERT')) {
  if (out.length >= LIMIT) break
  const L = itemLines(q.exam, q.no)
  if (!L) continue
  const clean = (s) => s.replace(/[^\x00-\x7F]+/g, ' ').replace(/\s+/g, ' ').trim()

  // ⚠️ 박스 문장과 지문을 **빈 줄**로 가른다.
  //   38.
  //   (빈 줄)
  //       The researchers had made this happen ...      ← 박스(주어진 문장)
  //   (빈 줄)
  //     Exactly how cicadas keep track of time ...      ← 지문 시작. ( ① ) 보다 앞이다.
  //
  // 1판은 `( ① )` 앞을 통째로 주어진 문장으로 잡아, **지문 첫 두 문장이 박스에 딸려 들어가고**
  // 그 덩어리가 정답 자리에 통째로 꽂혀 복원 지문의 순서가 엉켰다.
  // (앞선 base rate 71% 는 문장 **집합**만 세므로 이 버그의 영향을 받지 않는다.
  //  영향을 받는 것은 정답 문장 지목과 순서를 쓰는 계산이다.)
  const blocks = []
  let cur = []
  for (const raw of L.slice(1)) {
    if (!raw.trim()) { if (cur.length) { blocks.push(cur); cur = [] } } else cur.push(raw)
  }
  if (cur.length) blocks.push(cur)
  const en = (b) => /[A-Za-z]{3,}/.test(b.join(' ')) && !/^[^A-Za-z]*$/.test(b.join(' '))
  const enBlocks = blocks.filter(en)
  if (enBlocks.length < 2) continue
  const given = clean(enBlocks[0].join(' '))
  // ⚠️ clean() 은 비-ASCII 를 지운다 — 마커 ①~⑤ 도 같이 사라진다.
  //    마커로 자른 **뒤에** 조각별로 clean() 해야 한다. (여기서 한 번 통째로 걸렸다)
  const passageRaw = enBlocks.slice(1).join(' ').replace(/\s+/g, ' ')
  if (given.split(/\s+/).length < 6 || !/\(\s*①\s*\)/.test(passageRaw)) continue

  const at1 = passageRaw.search(/\(\s*①\s*\)/)
  const lead = clean(passageRaw.slice(0, at1)) // ( ① ) 앞의 지문 도입부
  let rest = passageRaw.slice(at1)
  const ci = rest.search(/①\s*$|①\s+②/)
  if (ci > 0) rest = rest.slice(0, ci)
  rest = rest.replace(/\*.*$/, '')
  const marked = rest.split(/\(\s*[①②③④⑤]\s*\)/)
  if (marked.length !== 6) continue
  // marked[0] 은 ( ① ) 바로 앞이라 비어 있다. 도입부(lead)를 그 자리에 넣어야 지문이 온전해진다.
  const parts = [lead, ...marked.slice(1)]
  if (parts.length !== 6) continue
  const ans = key.get(`${q.exam}#${q.no}`)?.answer
  if (!ans) continue
  const restored = parts.map((p, i) => (i === ans ? given + ' ' + clean(p) : clean(p))).join(' ').replace(/\s+/g, ' ').trim()
  const sents = sentences(restored)
  if (sents.length < 5) continue
  const head = given.split(/\s+/).slice(0, 6).join(' ').toLowerCase()
  const ansIdx = sents.findIndex((s) => s.toLowerCase().startsWith(head.slice(0, Math.min(36, head.length))))
  if (ansIdx <= 0) continue
  out.push({ id: `${q.exam}#${q.no}`, points: key.get(`${q.exam}#${q.no}`).points, ansIdx, sents })
}

for (const it of out) {
  console.log('═'.repeat(78))
  console.log(`${it.id}  (${it.points}점) · 문장 ${it.sents.length}개 · 실제로 뽑아낸 문장 S${it.ansIdx}`)
  console.log('═'.repeat(78))
  it.sents.forEach((s, i) => {
    const mark = i === it.ansIdx ? ' ◀ 정답' : ''
    console.log(`  S${String(i).padStart(2)}${mark}  ${s}`)
  })
  console.log('')
}
fs.writeFileSync(path.join(OUT_DIR, 'restored-insert.json'), JSON.stringify(out, null, 1))
console.log(`→ ${out.length}건 · ${path.join(OUT_DIR, 'restored-insert.json')}`)
