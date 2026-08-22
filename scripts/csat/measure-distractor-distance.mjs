// scripts/csat/measure-distractor-distance.mjs
//
// **가설 3 검증 — 출제자는 난이도를 오답에서 조절하는가.**
//
// 주장: 3점 문항의 오답은 지문 주제 안에서 성립해야 하므로 **지문 어휘를 더 많이 쓴다**.
// 2점 문항의 오답은 지문과 무관한 것이 섞여 읽기만 해도 걸러진다.
//   실례: 2026 #31(2점) 오답에 `morality` — 지문에 도덕 얘기가 없다.
//         2022 #33(3점) 오답은 free access·individual ownership·maximize profits —
//         공유지 맥락에서 전부 논의될 법한 것들이다.
//
// ⚠️ **내 인상으로 "가깝다" 를 판정하면 순환논증이다.** 그래서 셀 수 있는 것으로 바꾼다:
//    선택지의 내용어 중 지문에 실제로 나오는 낱말의 비율.
//    이 지표는 의미적 근접이 아니라 **어휘적 근접**만 잡는다 — 그 한계는 아래 결과와 함께 적는다.
//
// 실행: pnpm dlx tsx scripts/csat/measure-distractor-distance.mjs

import fs from 'node:fs'
import path from 'node:path'

const SRC = 'C:/Users/Administrator/Document' + 's/수능영어기출/최종'
const OUT_DIR = path.resolve('scripts/csat/data')
const HEADER_RE = /저작권은 한국교육과정평가원/

/** 내용어만 — 기능어는 어느 선택지에나 있어 신호가 되지 못한다. */
const STOP = new Set(`a an the of to in on at by for with from into over under and or but if then than that this these those
it its their our your his her they we you he she i as is are was were be been being do does did have has had
can could will would shall should may might must not no nor so such very more most much many few less least
what which who whom whose when where why how all any both each other others same own too only just also`.split(/\s+/))

const words = (s) =>
  (s.toLowerCase().match(/[a-z][a-z'-]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w))

function keepSingleForm(lines) {
  const hol = [], jjak = []
  lines.forEach((l, i) => {
    const t = l.trim()
    if (t === '홀수형') hol.push(i)
    if (t === '짝수형') jjak.push(i)
  })
  if (!hol.length || !jjak.length) return lines
  const b = lines.findIndex((l, i) => i > hol[hol.length - 1] && i < jjak[0] && HEADER_RE.test(l))
  return b < 0 ? lines : lines.slice(0, b)
}

const MARK = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 }

/** 문항 블록에서 선택지 5개와 지문을 가른다. */
function splitItem(block) {
  const choices = new Map()
  const passage = []
  for (const raw of block.split('\n')) {
    const l = raw.trim()
    if (!l || HEADER_RE.test(l) || /^(홀수형|짝수형|\d+)$/.test(l)) continue
    const m = l.match(/^([①②③④⑤])\s*(.+)$/)
    if (m && !choices.has(MARK[m[1]])) {
      choices.set(MARK[m[1]], m[2].trim())
      continue
    }
    if (/^[①②③④⑤]/.test(l)) continue //  표시만 있고 내용이 흩어진 줄
    passage.push(l)
  }
  return { choices, passage: passage.join(' ') }
}

const classified = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'classified.json'), 'utf8'))
const answers = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'answers.json'), 'utf8')).answers
const key = new Map(answers.map((a) => [`${a.exam}#${a.no}`, a]))

const FILE = {
  '2014B': '2014_A.txt', '2014A': '2014_Aform.txt',
}
const results = []
const skipped = []

// 선택지가 **영어 문장**인 유형만 — 기호 선택지(①②③ 밑줄·(A)(B)(C))는 어휘 중첩을 잴 수 없다.
// 듣기는 지문이 음성이라 지면에 없어 제외한다(측정 불가이지 무관심이 아니다).
// 장문(X-)은 지문이 문항 번호보다 앞에 와 블록에 안 잡힌다 — 따로 다뤄야 하므로 이번엔 뺀다.
const TEXT_CHOICE = new Set(['R-BLANK', 'R-IMPLY', 'R-TOPIC', 'R-TITLE', 'R-SUMMARY', 'R-MOOD'])
const targets = classified.rows.filter(
  (r) => r.exam !== '2014A' && TEXT_CHOICE.has(r.type) && key.has(`${r.exam}#${r.no}`),
)

for (const q of targets) {
  const file = FILE[q.exam] ?? `${q.exam}.txt`
  const lines = keepSingleForm(fs.readFileSync(path.join(SRC, file), 'utf8').replace(/\r/g, '').split('\n'))
  const i = lines.findIndex((l) => new RegExp(`^\\s*${q.no}\\s*\\.`).test(l))
  if (i < 0) { skipped.push({ ...q, why: '문항 시작 못 찾음' }); continue }
  let j = lines.findIndex((l, k) => k > i && new RegExp(`^\\s*${q.no + 1}\\s*\\.`).test(l))
  if (j < 0) j = Math.min(i + 60, lines.length)

  const { choices, passage } = splitItem(lines.slice(i, j).join('\n'))
  // 선택지 5개가 온전히 잡힌 문항만 쓴다 — 조판이 흩어 놓은 것은 지표를 왜곡한다
  if (choices.size !== 5) { skipped.push({ ...q, why: `선택지 ${choices.size}개만 회수` }); continue }

  const pw = new Set(words(passage))
  const overlap = (text) => {
    const w = words(text)
    if (!w.length) return null
    return w.filter((x) => pw.has(x)).length / w.length
  }

  const ans = key.get(`${q.exam}#${q.no}`)
  const correct = overlap(choices.get(ans.answer))
  const wrong = [...choices.entries()].filter(([n]) => n !== ans.answer).map(([, t]) => overlap(t)).filter((x) => x != null)
  if (correct == null || wrong.length !== 4) { skipped.push({ ...q, why: '중첩 계산 실패' }); continue }

  results.push({
    exam: q.exam, no: q.no, type: q.type, points: ans.points,
    correct_overlap: correct,
    wrong_overlap_mean: wrong.reduce((a, b) => a + b, 0) / wrong.length,
  })
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
const hi = results.filter((r) => r.points === 3)
const lo = results.filter((r) => r.points === 2)

console.log(`빈칸추론 ${targets.length}문항 중 계측 성공 ${results.length} · 제외 ${skipped.length}`)
if (skipped.length) {
  const why = {}
  for (const s of skipped) why[s.why] = (why[s.why] ?? 0) + 1
  console.log('  제외 사유:', Object.entries(why).map(([k, v]) => `${k} ${v}`).join(' · '))
}
console.log('')
console.log('선택지 내용어 중 지문에 나오는 비율 — 유형별')
console.log('─'.repeat(72))
console.log('유형          3점  오답중앙   2점  오답중앙   차이     판정')
const med = (a) => { if (!a.length) return null; const s2 = [...a].sort((x, y) => x - y); return s2[Math.floor(s2.length / 2)] }
const byType = {}
for (const r of results) (byType[r.type] ??= []).push(r)
for (const [t, rows] of Object.entries(byType)) {
  const h = rows.filter((r) => r.points === 3), l = rows.filter((r) => r.points === 2)
  if (!h.length || !l.length) {
    console.log(`${t.padEnd(12)} ${String(h.length).padStart(3)}   ―      ${String(l.length).padStart(3)}   ―        ―     대조 불가(한쪽이 0)`)
    continue
  }
  const mh = med(h.map((r) => r.wrong_overlap_mean)), ml = med(l.map((r) => r.wrong_overlap_mean))
  const diff = 100 * (mh - ml)
  console.log(
    `${t.padEnd(12)} ${String(h.length).padStart(3)}  ${(100 * mh).toFixed(1).padStart(5)}%  ${String(l.length).padStart(3)}  ${(100 * ml).toFixed(1).padStart(5)}%  ${diff.toFixed(1).padStart(6)}%p  ${diff > 0 ? '방향 일치' : '방향 반대'}`,
  )
}

fs.writeFileSync(path.join(OUT_DIR, 'distractor-distance.json'), JSON.stringify({ results, skipped }, null, 1))
console.log(`\n→ ${path.join(OUT_DIR, 'distractor-distance.json')}`)
