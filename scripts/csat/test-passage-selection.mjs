// scripts/csat/test-passage-selection.mjs
//
// **설계 결정이 '지문 안 선택' 이 아니라 '지문 선정' 층에 있는가 — 읽기 전용.**
//
// ── 왜 이 실험인가 ──────────────────────────────────────────────────
// 가설 9개(H1~H9)가 전부 "출제자가 지문 **안에서** 어디를 고르는가" 를 물었고
// 하나도 후보를 의미 있게 좁히지 못했다(lift 최대 37%p, 대부분 12%p 안팎, 유의성 없음).
// 외부 자료에 따르면 영어 영역은 **교육부가 후보 문서를 주고 출제위원이 선별**한다.
// 그렇다면 설계 행위는 가공이 아니라 **선정**이고, 지문 자체에 흔적이 남아야 한다.
//
// ── 사전 예측 (돌리기 전에 적는다) ──────────────────────────────────
// 삽입 문항이 성립하려면 뽑아낸 문장이 **한 자리에만** 들어가야 한다.
// 문장들이 느슨하게 나열된 지문이면 아무 데나 들어가 문항이 안 된다.
// → **삽입용으로 선정된 지문은 인접 문장 간 연결이 더 촘촘하다.**
//
// 대조군: 같은 회차·같은 출제진·같은 난도 대역인데 **다른 조작을 위해 선정된** 지문
//        (주제·제목·요지 — 전체 요지만 물으므로 문장 간 결속이 필수가 아니다).
// 원전의 인접 단락이 더 좋은 대조군이지만 출처 확보가 선행이라, 우선 이것으로 잰다.
//
// 측정: 인접 문장쌍의 **결속 밀도** — 공유 내용어 + 뒷 문장의 지시 표현이 앞에서 받아지는가.
//
// ⚠️ 예측이 틀리면 그대로 적는다. 방향을 사후에 바꾸지 않는다.
//
// 실행: pnpm dlx tsx scripts/csat/test-passage-selection.mjs

import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve('scripts/csat/data')
const COL_DIR = path.join(OUT_DIR, 'columns')
const R = (f) => JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'))

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
const clean = (s) => s.replace(/[^\x00-\x7F]+/g, ' ').replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim()
const sentences = (t) =>
  t.split(/(?<=[.!?]["'’”)]?)\s+(?=["'“‘(]?[A-Z])/).map((s) => s.trim()).filter((s) => s.length > 12)

const STOP = new Set(`a an the of to in on at by for with from into over under and or but if then than that this these those
it its their our your his her they we you he she as is are was were be been being do does did have has had
can could will would shall should may might must not no nor so such very more most much many few less least
what which who whom whose when where why how all any both each other others same own too only just also there here`.split(/\s+/))
const content = (s) => (s.toLowerCase().match(/[a-z][a-z'-]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w))
const DEICTIC = /\b(this|these|those|such|they|them|their|it|its|he|him|his|she|her|one|another|others)\b/i

/** 인접 문장쌍의 결속 — 0~2점. 공유 내용어 있으면 +1, 뒷 문장 지시어가 앞에서 받아지면 +1 */
function cohesion(prev, next) {
  const pw = new Set(content(prev))
  const shared = content(next).filter((w) => pw.has(w)).length
  let score = 0
  if (shared > 0) score += 1
  if (DEICTIC.test(next.split(/\s+/).slice(0, 8).join(' ')) && pw.size > 0) score += 1
  return { score, shared }
}

/** 문항의 지문을 문장 배열로 — 삽입은 마커·박스 처리, 나머지는 선택지 앞까지 */
function passageOf(q) {
  const L = itemLines(q.exam, q.no)
  if (!L) return null
  if (q.type === 'R-INSERT') {
    const blocks = []
    let cur = []
    for (const raw of L.slice(1)) {
      if (!raw.trim()) { if (cur.length) { blocks.push(cur); cur = [] } } else cur.push(raw)
    }
    if (cur.length) blocks.push(cur)
    const en = blocks.filter((b) => /[A-Za-z]{3,}/.test(b.join(' ')))
    if (en.length < 2) return null
    const raw = en.slice(1).join(' ').replace(/\s+/g, ' ')
    if (!/\(\s*①\s*\)/.test(raw)) return null
    // 마커를 지우면 원래 지문에서 주어진 문장만 빠진 상태 — 결속 측정엔 그대로 쓴다
    return sentences(clean(raw.replace(/\(\s*[①②③④⑤]\s*\)/g, ' ')))
  }
  const ci = L.findIndex((l) => /^\s*[①②③④⑤]/.test(l.trim()))
  const body = (ci > 0 ? L.slice(1, ci) : L.slice(1)).filter((l) => l.trim())
  return sentences(clean(body.join(' ')))
}

const classified = R('classified.json')
const GROUPS = {
  '삽입용 (38·39)': ['R-INSERT'],
  '순서용 (36·37)': ['R-ORDER'],
  '주제·제목·요지용': ['R-TOPIC', 'R-TITLE', 'R-GIST'],
  '빈칸용 (31~34)': ['R-BLANK'],
}

console.log('지문 선정 실험 — 조작마다 선정된 지문의 결속 밀도가 다른가')
console.log('─'.repeat(76))
console.log('  사전 예측: **삽입용 지문이 가장 촘촘하다** (한 자리에만 들어가야 문항이 성립)')
console.log('')
console.log('  집단                 지문   문장쌍   결속점수   공유어휘 있는 쌍')

const result = {}
for (const [label, types] of Object.entries(GROUPS)) {
  const scores = [], sharedFlags = []
  let n = 0
  for (const q of classified.rows.filter((r) => r.exam !== '2014A' && types.includes(r.type))) {
    const s = passageOf(q)
    if (!s || s.length < 4) continue
    n += 1
    for (let i = 1; i < s.length; i += 1) {
      const c = cohesion(s[i - 1], s[i])
      scores.push(c.score)
      sharedFlags.push(c.shared > 0 ? 1 : 0)
    }
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length
  result[label] = { passages: n, pairs: scores.length, score: mean(scores), sharedRate: mean(sharedFlags) }
  console.log(
    `  ${label.padEnd(20)} ${String(n).padStart(3)}  ${String(scores.length).padStart(5)}` +
      `   ${mean(scores).toFixed(3).padStart(7)}   ${(100 * mean(sharedFlags)).toFixed(1).padStart(6)}%`,
  )
}

const ins = result['삽입용 (38·39)']
const others = Object.entries(result).filter(([k]) => k !== '삽입용 (38·39)')
const maxOther = Math.max(...others.map(([, v]) => v.score))
const winner = Object.entries(result).sort((a, b) => b[1].score - a[1].score)[0][0]
console.log('')
console.log(`  가장 촘촘한 집단: ${winner}`)
console.log(`  → 예측 ${winner === '삽입용 (38·39)' ? '**적중**' : '**빗나감**'}` +
  ` (삽입용 ${ins.score.toFixed(3)} vs 최고 타집단 ${maxOther.toFixed(3)}, 차이 ${(ins.score - maxOther).toFixed(3)})`)
if (Math.abs(ins.score - maxOther) < 0.05) console.log('  차이가 0.05 미만 — 집단 간 구분이 없다고 본다.')

fs.writeFileSync(path.join(OUT_DIR, 'passage-selection.json'), JSON.stringify({ prediction: '삽입용 지문이 가장 촘촘하다', result }, null, 1))
console.log(`\n→ ${path.join(OUT_DIR, 'passage-selection.json')}`)
