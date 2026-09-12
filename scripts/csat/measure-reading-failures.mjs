// scripts/csat/measure-reading-failures.mjs
//
// **읽기 실패를 검증 가능한 형태로 검사한다.**
//
// 앞선 세 가설은 통일 축을 **출제자의 조작 수단**에서 찾다가 전부 실패했다
// (명시여부·근거위치·오답위장 — 수단은 유형마다 다르다).
// 이제 자리를 옮긴다: 수단은 달라도 **겨냥하는 읽기 실패는 같을 수 있다**.
//
// 검증 형태: 읽기 실패가 실재한다면, 그 실패를 지문에 **기계적으로 적용**했을 때
// 실제 오답 중 하나가 나와야 한다. 못 나오면 그 실패는 내 상상이다.
//
// 여기서 재는 실패 둘:
//   A. 표면 어휘 좇기 — 지문 낱말이 많이 든 선택지를 고른다
//      무작위라면 정답이 최고 중첩일 확률 20%. 그보다 **낮으면** 어휘가 오답으로 이끈다.
//   B. 앞부분만 읽기 — 지문 앞 1/3 과 겹치는 선택지를 고른다
//      정답이 앞부분 최고 중첩일 확률이 20%보다 낮으면 앞부분 읽기가 오답으로 이끈다.
//
// ⚠️ 이 지표는 **어휘 수준**만 본다. 의미적 오독은 못 잡는다.
// ⚠️ 실제 학생이 그 오답을 고르는지는 선택 비율 자료가 있어야 안다. 없으면 여기까지가 한계다.
//
// 실행: pnpm dlx tsx scripts/csat/measure-reading-failures.mjs

import fs from 'node:fs'
import path from 'node:path'

const SRC = 'C:/Users/Administrator/Document' + 's/수능영어기출/최종'
const OUT_DIR = path.resolve('scripts/csat/data')
const HEADER_RE = /저작권은 한국교육과정평가원/

const STOP = new Set(`a an the of to in on at by for with from into over under and or but if then than that this these those
it its their our your his her they we you he she i as is are was were be been being do does did have has had
can could will would shall should may might must not no nor so such very more most much many few less least
what which who whom whose when where why how all any both each other others same own too only just also`.split(/\s+/))
const words = (s) => (s.toLowerCase().match(/[a-z][a-z'-]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w))

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
function splitItem(block) {
  const choices = new Map()
  const passage = []
  for (const raw of block.split('\n')) {
    const l = raw.trim()
    if (!l || HEADER_RE.test(l) || /^(홀수형|짝수형|\d+)$/.test(l)) continue
    const m = l.match(/^([①②③④⑤])\s*(.+)$/)
    if (m && !choices.has(MARK[m[1]])) { choices.set(MARK[m[1]], m[2].trim()); continue }
    if (/^[①②③④⑤]/.test(l)) continue
    passage.push(l)
  }
  return { choices, passage: passage.join(' ') }
}

const classified = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'classified.json'), 'utf8'))
const answers = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'answers.json'), 'utf8')).answers
const key = new Map(answers.map((a) => [`${a.exam}#${a.no}`, a]))
const FILE = { '2014B': '2014_A.txt', '2014A': '2014_Aform.txt' }

// 선택지가 영어 문장인 유형만. 기호 선택지는 어휘로 잴 수 없고, 듣기는 지문이 지면에 없다.
const TEXT_CHOICE = new Set(['R-BLANK', 'R-IMPLY', 'R-TOPIC', 'R-TITLE', 'R-SUMMARY', 'R-MOOD'])
const targets = classified.rows.filter(
  (r) => r.exam !== '2014A' && TEXT_CHOICE.has(r.type) && key.has(`${r.exam}#${r.no}`),
)

const rows = []
let skipped = 0
for (const q of targets) {
  const file = FILE[q.exam] ?? `${q.exam}.txt`
  const lines = keepSingleForm(fs.readFileSync(path.join(SRC, file), 'utf8').replace(/\r/g, '').split('\n'))
  const i = lines.findIndex((l) => new RegExp(`^\\s*${q.no}\\s*\\.`).test(l))
  if (i < 0) { skipped += 1; continue }
  let j = lines.findIndex((l, k) => k > i && new RegExp(`^\\s*${q.no + 1}\\s*\\.`).test(l))
  if (j < 0) j = Math.min(i + 60, lines.length)
  const { choices, passage } = splitItem(lines.slice(i, j).join('\n'))
  if (choices.size !== 5) { skipped += 1; continue }

  const pw = words(passage)
  if (pw.length < 30) { skipped += 1; continue }
  const whole = new Set(pw)
  const front = new Set(pw.slice(0, Math.ceil(pw.length / 3)))

  const score = (set) => (text) => {
    const w = words(text)
    return w.length ? w.filter((x) => set.has(x)).length / w.length : 0
  }
  const sWhole = score(whole), sFront = score(front)

  const ans = key.get(`${q.exam}#${q.no}`).answer
  const entries = [...choices.entries()]
  const topBy = (fn) => {
    let best = null, bv = -1
    for (const [n, t] of entries) { const v = fn(t); if (v > bv) { bv = v; best = n } }
    return best
  }
  rows.push({
    exam: q.exam, no: q.no, type: q.type, points: key.get(`${q.exam}#${q.no}`).points,
    answer: ans,
    top_whole: topBy(sWhole),
    top_front: topBy(sFront),
  })
}

const pct = (n, d) => (d ? (100 * n / d).toFixed(1) + '%' : '-')
const report = (label, field) => {
  const hit = rows.filter((r) => r[field] === r.answer).length
  console.log(`${label.padEnd(22)} 정답이 최고인 문항 ${String(hit).padStart(3)}/${rows.length}  = ${pct(hit, rows.length).padStart(6)}  (무작위 기대 20.0%)`)
  return hit / rows.length
}

console.log(`대상 ${targets.length} · 계측 ${rows.length} · 제외 ${skipped}`)
console.log('')
console.log('실패 A — 표면 어휘 좇기 (지문 전체와 겹치는 선택지 고르기)')
const a = report('  전체 지문 기준', 'top_whole')
console.log('')
console.log('실패 B — 앞부분만 읽기 (지문 앞 1/3 과 겹치는 선택지 고르기)')
const b = report('  앞 1/3 기준', 'top_front')
console.log('')
console.log('해석: 20% 보다 **낮으면** 그 전략이 오답으로 이끈다는 뜻이다.')
console.log(`  A ${a < 0.2 ? '→ 어휘 좇기는 오답으로 이끈다' : '→ 어휘 좇기가 오히려 도움이 된다'}`)
console.log(`  B ${b < 0.2 ? '→ 앞부분 읽기는 오답으로 이끈다' : '→ 앞부분 읽기가 오히려 도움이 된다'}`)

// 배점별로도 갈리는가 — 3점에서 더 강하게 배신하는지
for (const p of [2, 3]) {
  const sub = rows.filter((r) => r.points === p)
  if (!sub.length) continue
  const ha = sub.filter((r) => r.top_whole === r.answer).length
  const hb = sub.filter((r) => r.top_front === r.answer).length
  console.log(`  ${p}점 ${String(sub.length).padStart(3)}문항 — A ${pct(ha, sub.length).padStart(6)} · B ${pct(hb, sub.length).padStart(6)}`)
}

fs.writeFileSync(path.join(OUT_DIR, 'reading-failures.json'), JSON.stringify({ rows }, null, 1))
console.log(`\n→ ${path.join(OUT_DIR, 'reading-failures.json')}`)
