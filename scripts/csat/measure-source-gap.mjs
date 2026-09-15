// scripts/csat/measure-source-gap.mjs
//
// **파이프라인이 얼마나 어려운 소스를 가져와야 하는가 — 숫자로.**
//
// §9.7 에서 지문을 원 소스 길이로 되살리자 절단 요인이 사라지고 **어휘 난도만 남았다**
// (낱말 길이 백분위 중앙값 19% · 어휘 다양도 89%). 그 격차를 정면으로 잰다.
//
// 두 집단을 같은 자로 잰다:
//   **기출** — 14회차 + 모평 3 의 읽기 지문 300편
//   **CC0 소스** — library_articles(source=original) 240편 (파이프라인 자체 산출물)
//
// 지표는 사전 없이 계산되는 것만 쓴다 — **가정이 안 들어간다**:
//   · 평균 낱말 길이
//   · 긴 낱말 비율 (8자 이상 — 라틴계 학술 어휘의 대리 지표)
//   · 어휘 다양도(TTR) — 길이를 맞춰 비교해야 하므로 **첫 120낱말로 잘라서** 잰다
//   · 문장당 낱말
//
// ⚠️ TTR 은 글이 길수록 내려간다. 길이를 안 맞추고 비교하면 **길이 차이를 어휘 차이로 읽는다.**
//    §9.7 에서 내 지문의 TTR 이 높았던 것도 절반은 길이 탓이었다. 여기서는 잘라서 맞춘다.
//
// 실행: pnpm dlx tsx scripts/csat/measure-source-gap.mjs -- <CC0덤프파일>

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, allRows } from './lib-passage.mjs'

const DIR = path.resolve('scripts/csat/data')
const dumpPath = process.argv.find((x) => x.endsWith('.txt'))

const words = (s) => (s.match(/[A-Za-z][A-Za-z'-]*/g) ?? [])
const sentences = (s) => s.split(/[.!?]+\s/).filter((x) => x.trim().length > 3)
const HEAD = 120 // TTR 을 잴 낱말 수 — 두 집단을 같은 길이로 맞춘다

function metrics(text) {
  const w = words(text)
  if (w.length < HEAD) return null
  const head = w.slice(0, HEAD).map((x) => x.toLowerCase())
  return {
    wordLen: w.reduce((s, x) => s + x.length, 0) / w.length,
    long8: w.filter((x) => x.length >= 8).length / w.length,
    ttr120: new Set(head).size / HEAD,
    sentLen: w.length / Math.max(1, sentences(text).length),
    n: w.length,
  }
}

// ── 기출 ────────────────────────────────────────────────────────────────────
const past = []
for (const r of allRows()) {
  const b = itemBlocks(r.exam, r.no)[0]
  if (!b) continue
  const p = passageOf(b)
  if (!p) continue
  const m = metrics(p)
  if (m) past.push(m)
}

// ── CC0 소스 ────────────────────────────────────────────────────────────────
const cc0 = []
if (dumpPath && fs.existsSync(dumpPath)) {
  const raw = fs.readFileSync(dumpPath, 'utf8')
  const i = raw.indexOf('[{')
  const j = raw.lastIndexOf('}]')
  if (i >= 0 && j > i) {
    // 파일 안의 배열이 한 번 이스케이프돼 있다 — 풀고 파싱한다
    let body = raw.slice(i, j + 2)
    if (body.includes('\\"')) body = JSON.parse('"' + body.replace(/"/g, '\\"').replace(/\\\\"/g, '\\"') + '"')
    let rows = []
    try { rows = JSON.parse(body) } catch { rows = [] }
    for (const r of rows) {
      const m = metrics(String(r.content ?? ''))
      if (m) cc0.push({ ...m, cefr: r.cefr_level })
    }
  }
}

const mean = (a, k) => a.reduce((s, x) => s + x[k], 0) / a.length
const qs = (a, k, q) => { const s = a.map((x) => x[k]).sort((p, r) => p - r); return s[Math.floor(q * (s.length - 1))] }

console.log('소스 난도 격차 — 파이프라인이 얼마나 어려운 글을 가져와야 하는가')
console.log('='.repeat(78))
console.log(`  기출 지문 ${past.length}편 · CC0 소스 ${cc0.length}편`)
if (!cc0.length) { console.log('  ⚠️ CC0 덤프를 못 읽었다. 인자로 파일 경로를 줄 것.'); process.exit(0) }
console.log('')

const AX = [
  { k: 'wordLen', name: '평균 낱말 길이', unit: '자' },
  { k: 'long8', name: '8자 이상 낱말 비율', unit: '', pct: true },
  { k: 'ttr120', name: '어휘 다양도(첫 120낱말)', unit: '' },
  { k: 'sentLen', name: '문장당 낱말', unit: '' },
]
console.log('  지표                      기출(중앙)  CC0(중앙)     격차    CC0 이 기출 중앙값을 넘는 비율')
console.log('  ' + '-'.repeat(74))
const out = []
for (const a of AX) {
  const pm = qs(past, a.k, 0.5)
  const cm = qs(cc0, a.k, 0.5)
  const above = cc0.filter((x) => x[a.k] >= pm).length / cc0.length
  const f = (v) => (a.pct ? (100 * v).toFixed(1) + '%' : v.toFixed(3))
  out.push({ axis: a.name, past: pm, cc0: cm, gap: cm - pm, aboveShare: above })
  console.log(`  ${a.name.padEnd(24)} ${f(pm).padStart(8)}  ${f(cm).padStart(8)}  ${((cm - pm) >= 0 ? '+' : '') + f(cm - pm).padStart(7)}   ${(100 * above).toFixed(1).padStart(5)}%`)
}

// 기출 중앙값을 넘는 CC0 글이 몇 편인가 — 파이프라인이 뽑아 쓸 수 있는 재고
console.log('')
console.log('  ⭐ 파이프라인이 쓸 수 있는 재고 — 기출 중앙값 이상인 CC0 글')
console.log('  ' + '-'.repeat(74))
const pw = qs(past, 'wordLen', 0.5)
const pl = qs(past, 'long8', 0.5)
const both = cc0.filter((x) => x.wordLen >= pw && x.long8 >= pl)
console.log(`    낱말 길이 ≥ ${pw.toFixed(3)}  AND  8자 이상 비율 ≥ ${(100 * pl).toFixed(1)}%`)
console.log(`    → **${both.length}/${cc0.length} = ${(100 * both.length / cc0.length).toFixed(1)}%**`)
const byCefr = {}
for (const x of both) byCefr[x.cefr ?? '?'] = (byCefr[x.cefr ?? '?'] ?? 0) + 1
console.log(`    그중 CEFR: ${Object.entries(byCefr).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음'}`)

console.log('')
console.log('  판정')
console.log('  ' + '-'.repeat(74))
const gapW = qs(cc0, 'wordLen', 0.5) - pw
const gapL = qs(cc0, 'long8', 0.5) - pl
console.log(`    · 낱말 길이 격차 ${gapW.toFixed(3)}자 · 8자 이상 낱말 비율 격차 ${(100 * gapL).toFixed(1)}%p`)
console.log(`    · **CC0 소스의 ${(100 * both.length / cc0.length).toFixed(0)}% 만이 기출 중앙 난도에 닿는다.**`)
console.log('    · 이것이 "소스 선별은 파이프라인 고도화 전제" 가 필요한 이유의 크기다 —')
console.log(`      지금 재고로 회차당 28지문을 채우려면 상위 ${(100 * both.length / cc0.length).toFixed(0)}% 만 골라야 하고,`)
console.log(`      457편 기준 약 ${Math.round(457 * both.length / cc0.length)}편이 후보다.`)

fs.writeFileSync(path.join(DIR, 'source-gap.json'), JSON.stringify({
  pastN: past.length, cc0N: cc0.length, axes: out,
  eligible: both.length, eligibleShare: both.length / cc0.length, byCefr,
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'source-gap.json')}`)
