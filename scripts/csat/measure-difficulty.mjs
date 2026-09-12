// scripts/csat/measure-difficulty.mjs
//
// **난도 축 — 설계도에 통째로 비어 있던 것.**
//
// 지금 설계도는 "무엇을 지키는가"(HARD 11)와 "무엇이 안 되는가"(기각 22)로 채워져 있다.
// 그런데 출제자 업무의 핵심은 **난도를 등급컷에 맞추는 일**이고, 그 축이 하나도 없다.
// (CSAT_BLUEPRINT.md §6-4 가 "난이도 — 실제 정답률 자료가 없다" 로 남겨 둔 자리)
//
// 정답률은 없다. 그러나 **출제자의 난도 의도**는 있다 — **3점 배점**이다.
// 문헌이 검증한 예측 변수를 가져와 3점/2점을 가르는지 본다.
//
//   D1 **C1+ 어휘 비율** — Kim(2025) 은 수능 고난도 문항의 30%+ 가 C1 이상이라 보고했다
//   D2 **문장당 절 수** — Asian-Pacific J. SFL Educ.(2023) 이 유의한 예측 변수로 보고
//   D3 **평균 낱말 길이 · 지문 길이** — 통제 변수
//
// ⚠️ 3점은 **의도**지 결과가 아니다. 정답률과 다를 수 있다. 그 한계를 결론에 적는다.
// ⚠️ CEFR 은 `shared_dictionary.cefr_level` (47,807낱말). 사전에 없는 낱말은 분모에서 뺀다.
//
// 실행: pnpm dlx tsx scripts/csat/measure-difficulty.mjs
import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, sentences, answerOf, allRows } from './lib-passage.mjs'
import { binomUpper, report } from './claim-gate.mjs'

// .env.local 에서 자격증명을 읽는다 (다른 스크립트와 같은 방식)
for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const DIR = path.resolve('scripts/csat/data')
const rows = allRows()

// ── 지문 모으기 ───────────────────────────────────────────────────────
const READ = ['R-PURPOSE', 'R-MOOD', 'R-CLAIM', 'R-GIST', 'R-TOPIC', 'R-TITLE', 'R-IMPLY',
  'R-FACT', 'R-GRAMMAR', 'R-VOCAB', 'R-BLANK', 'R-IRRELEVANT', 'R-ORDER', 'R-INSERT', 'R-SUMMARY']

const items = []
for (const r of rows.filter((x) => READ.includes(x.type))) {
  const b = itemBlocks(r.exam, r.no)[0]
  if (!b) continue
  const p = passageOf(b)
  if (p.length < 200) continue
  const a = answerOf(r.exam, r.no)
  if (!a) continue
  items.push({ exam: r.exam, no: r.no, type: r.type, points: a.points, passage: p })
}

// ── 어휘 프로파일 ─────────────────────────────────────────────────────
const words = (s) => (s.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []).filter((w) => w.length > 2)
const vocab = new Set()
for (const it of items) for (const w of words(it.passage)) vocab.add(w)
console.log(`지문 ${items.length}편 · 서로 다른 낱말 ${vocab.size}`)

// CEFR 을 나눠 받는다 (한 번에 다 받으면 응답이 잘린다)
const cefr = new Map()
const list = [...vocab]
for (let i = 0; i < list.length; i += 800) {
  const chunk = list.slice(i, i + 800)
  const { data, error } = await db
    .from('shared_dictionary')
    .select('word, cefr_level')
    .in('word', chunk)
    .not('cefr_level', 'is', null)
  if (error) { console.error('DB 오류:', error.message); process.exit(1) }
  for (const d of data) if (!cefr.has(d.word.toLowerCase())) cefr.set(d.word.toLowerCase(), d.cefr_level)
}
console.log(`사전에서 찾은 낱말 ${cefr.size}/${vocab.size} = ${(cefr.size / vocab.size * 100).toFixed(1)}%`)
console.log()

// ── 지문별 지표 ───────────────────────────────────────────────────────
// 절 경계 대리 지표 — 정동사·접속사·관계사로 센다(파서가 없으므로)
const CLAUSE = /\b(that|which|who|whom|whose|when|where|while|because|although|though|since|if|unless|as|after|before|until|whether|and|but|or)\b/gi
for (const it of items) {
  const ws = words(it.passage)
  const known = ws.filter((w) => cefr.has(w))
  const c1 = known.filter((w) => ['C1', 'C2'].includes(cefr.get(w)))
  it.nWords = ws.length
  it.covered = known.length / (ws.length || 1)
  it.c1Ratio = known.length ? c1.length / known.length : null
  const sents = sentences(it.passage)
  it.nSent = sents.length
  it.clausesPerSent = sents.length
    ? sents.reduce((s, x) => s + 1 + (x.match(CLAUSE) ?? []).length, 0) / sents.length
    : null
  it.wordsPerSent = sents.length ? ws.length / sents.length : null
  it.avgWordLen = ws.length ? ws.reduce((s, w) => s + w.length, 0) / ws.length : null
}

const good = items.filter((x) => x.c1Ratio != null && x.clausesPerSent != null)
const p3 = good.filter((x) => x.points === 3), p2 = good.filter((x) => x.points === 2)
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0 }

function perm(a, b, iters = 20000) {
  const obs = mean(a) - mean(b)
  const pool = [...a, ...b], na = a.length
  let seed = 20260825
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  let ge = 0
  for (let k = 0; k < iters; k += 1) {
    const q = [...pool]
    for (let i = q.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1));[q[i], q[j]] = [q[j], q[i]] }
    if (Math.abs(mean(q.slice(0, na)) - mean(q.slice(na))) >= Math.abs(obs)) ge += 1
  }
  return { obs, p: (ge + 1) / (iters + 1) }
}

console.log('난도 축 — 문헌이 검증한 예측 변수가 3점/2점을 가르는가')
console.log('='.repeat(76))
console.log(`  지문 ${good.length}편 (3점 ${p3.length} · 2점 ${p2.length}) · 수능 14 + 모평 3`)
console.log(`  ⚠️ 3점은 출제자의 **의도**지 실제 정답률이 아니다.`)
console.log()
console.log('  지표                       3점      2점       차     순열 p')
console.log('  ' + '-'.repeat(70))
const METRICS = [
  ['D1 C1+ 어휘 비율', 'c1Ratio'],
  ['D2 문장당 절 수', 'clausesPerSent'],
  ['   문장당 낱말 수', 'wordsPerSent'],
  ['   평균 낱말 길이', 'avgWordLen'],
  ['   지문 낱말 수', 'nWords'],
]
const out = {}
for (const [name, key] of METRICS) {
  const a = p3.map((x) => x[key]), b = p2.map((x) => x[key])
  const r = perm(a, b)
  out[key] = { p3: mean(a), p2: mean(b), ...r }
  console.log(`  ${name.padEnd(24)} ${mean(a).toFixed(3).padStart(7)} ${mean(b).toFixed(3).padStart(8)} ${r.obs.toFixed(3).padStart(8)} ${r.p.toFixed(4).padStart(9)}`)
}
console.log()

// ── 문헌 대조 — Kim(2025) 의 "고난도 30%+ C1 이상" ────────────────────
const c1all = med(good.map((x) => x.c1Ratio))
console.log('  문헌 대조')
console.log('  ' + '-'.repeat(70))
console.log(`    Kim(2025): 수능 고난도 문항의 C1+ 어휘가 **30% 이상**`)
console.log(`    이 코퍼스: 전체 중앙값 ${(c1all * 100).toFixed(1)}% · 3점 ${(mean(p3.map((x) => x.c1Ratio)) * 100).toFixed(1)}% · 2점 ${(mean(p2.map((x) => x.c1Ratio)) * 100).toFixed(1)}%`)
console.log(`    → ${c1all >= 0.3 ? '**전체가 이미 30% 를 넘는다** — 고난도만의 성질이 아니다' : '30% 미만'}`)
console.log()

// ── 시기 추세 (EBS 연계정책 연구 대조) ────────────────────────────────
console.log('  회차별 C1+ 어휘 비율 (EBS 연계정책 연구: 어휘 난도 상승 보고)')
console.log('  ' + '-'.repeat(70))
const byExam = {}
for (const it of good) (byExam[it.exam] ??= []).push(it.c1Ratio)
const order = Object.keys(byExam).sort()
for (const e of order) console.log(`    ${e.padEnd(8)} ${(mean(byExam[e]) * 100).toFixed(1)}%  (n=${byExam[e].length})`)
console.log()

report({
  name: 'D1 — 3점 지문은 C1+ 어휘 비율이 높다  [문헌 근거 검사]',
  hit: p3.filter((x) => x.c1Ratio > med(good.map((y) => y.c1Ratio))).length,
  n: p3.length, baseRate: 0.5, shape: 'count-vs-baserate',
  falsifier: '3점 지문의 C1+ 비율이 전체 중앙값 위로 가는 비율이 절반이면 깨진다 — 어휘 난도가 배점을 안 가른다',
  subgroups: [
    { label: '빈칸', hit: p3.filter((x) => x.type === 'R-BLANK' && x.c1Ratio > med(good.map((y) => y.c1Ratio))).length, n: p3.filter((x) => x.type === 'R-BLANK').length },
    { label: '그 밖', hit: p3.filter((x) => x.type !== 'R-BLANK' && x.c1Ratio > med(good.map((y) => y.c1Ratio))).length, n: p3.filter((x) => x.type !== 'R-BLANK').length },
  ],
  perExam: order.map((e) => ({
    exam: e,
    hit: good.filter((x) => x.exam === e && x.points === 3 && x.c1Ratio > med(good.map((y) => y.c1Ratio))).length,
    n: good.filter((x) => x.exam === e && x.points === 3).length,
  })).filter((x) => x.n > 0),
})

fs.writeFileSync(path.join(DIR, 'difficulty-axis.json'), JSON.stringify({
  n: good.length, n3: p3.length, n2: p2.length, coverage: cefr.size / vocab.size, metrics: out,
  byExam: Object.fromEntries(order.map((e) => [e, mean(byExam[e])])),
  rows: good.map((x) => ({ exam: x.exam, no: x.no, type: x.type, points: x.points, c1Ratio: x.c1Ratio, clausesPerSent: x.clausesPerSent, nWords: x.nWords })),
}, null, 1))
console.log(`→ ${path.join(DIR, 'difficulty-axis.json')}`)
