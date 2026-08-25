// scripts/csat/test-p31-blank-general.mjs
//
// **P3.1 — "빈칸은 일반진술 자리에 뚫린다(구체 사례 자리가 아니다)" 를 전수로 건다.**
//
// 지금까지 이 명제의 표본은 **손으로 읽은 5문항**이었다(기저 33%, p=0.0039).
// 빈칸 자리를 조판에서 찾을 수 있으므로 기계로 전수를 걸 수 있다.
//
// 문장을 둘로 가른다:
//   **구체진술** — 예시 표지(For example …) · 숫자·연도 · 문중 고유명사 · 인용 · 연구 보고
//   **일반진술** — 그 밖
//
// 기저는 가정이 아니라 **지문마다 실측**한다 — 그 지문의 일반진술 비율.
// 빈칸이 아무 문장에나 뚫린다면 일반진술에 뚫릴 확률이 곧 그 비율이다.
//
// ⚠️ 분류기는 대리 지표다. 그러나 **한쪽으로 치우친 오류가 아니다** —
//    빈칸 문장이든 아니든 같은 자로 잰다(문항 내 짝지음).
//
// 실행: pnpm dlx tsx scripts/csat/test-p31-blank-general.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, sentences, answerOf, allRows } from './lib-passage.mjs'
import { binomUpper, report } from './claim-gate.mjs'

const DIR = path.resolve('scripts/csat/data')
const rows = allRows()   // 수능 14 + 모평 3

const SENT = 'ZQBLANKQZ'

/** 본문 줄에서 빈칸 자리를 찾아 표시한다. 못 찾으면 null */
function passageWithBlank(block) {
  const body = []
  for (const l of block) { if (/^\s*①/.test(l)) break; body.push(l) }
  const live = body.filter((l) => l.trim())
  if (live.length < 3) return null
  const inds = live.map((l) => l.match(/^ */)[0].length).sort((a, b) => a - b)
  const base = inds[Math.floor(inds.length / 2)]
  let hit = -1
  for (let i = 1; i < body.length; i += 1) {
    if (!body[i].trim()) continue
    if (/^\s*\d+\s*[.．]/.test(body[i])) continue
    if (body[i].match(/^ */)[0].length >= base + 12) { hit = i; break }
  }
  if (hit < 0) return null
  const out = []
  for (let i = 0; i < body.length; i += 1) {
    const l = body[i].trim()
    if (!l) continue
    if (/^\s*\d+\s*[.．]/.test(body[i])) continue
    out.push(i === hit ? SENT + ' ' + l : l)
  }
  return out.join(' ').replace(/\s+/g, ' ').trim()
}

// ── 구체진술 표지 ─────────────────────────────────────────────────────
const EG = /\b(for example|for instance|such as|e\.g\.|to illustrate|consider the case|in one study|researchers? (?:found|reported|showed)|a study (?:found|showed)|according to)\b/i
const YEAR = /\b(1[89]\d{2}|20[0-2]\d)\b/
const NUM = /\b\d+(?:\.\d+)?\s*(?:percent|%|times|years?|people|participants|subjects|dollars?)\b/i
const QUOTE = /[“"][^”"]{10,}[”"]/

/** 문중 고유명사 — 문장 첫 낱말과 흔한 낱말은 뺀다 */
const COMMON_CAP = new Set(['I', 'The', 'A', 'An', 'This', 'That', 'These', 'Those', 'It', 'We', 'They', 'But', 'And', 'However', 'Yet', 'In', 'On', 'For', 'When', 'While', 'If', 'As', 'So', 'Thus', 'One', 'Some', 'Most', 'Many', 'Their', 'His', 'Her', 'Our', 'Its'])
function hasProperNoun(s) {
  const body = s.replace(SENT, '').trim()
  const toks = body.split(/\s+/).slice(1)     // 첫 낱말 제외
  return toks.some((t) => {
    const w = t.replace(/[^A-Za-z]/g, '')
    return w.length > 2 && /^[A-Z][a-z]+$/.test(w) && !COMMON_CAP.has(w)
  })
}

function isConcrete(s) {
  return EG.test(s) || YEAR.test(s) || NUM.test(s) || QUOTE.test(s) || hasProperNoun(s)
}

// ── 측정 ──────────────────────────────────────────────────────────────
const res = []
for (const r of rows.filter((x) => x.type === 'R-BLANK')) {
  const b = itemBlocks(r.exam, r.no)[0]
  if (!b) { res.push({ exam: r.exam, no: r.no, ok: false, why: '블록 없음' }); continue }
  const p = passageWithBlank(b)
  if (!p) { res.push({ exam: r.exam, no: r.no, ok: false, why: '빈칸 자리 못 찾음' }); continue }
  const marked = sentences(p)
  const bi = marked.findIndex((s) => s.includes(SENT))
  if (bi < 0 || marked.length < 5) { res.push({ exam: r.exam, no: r.no, ok: false, why: `문장 ${marked.length}` }); continue }
  const clean = marked.map((s) => s.replace(SENT, '').trim())
  const flags = clean.map(isConcrete)
  const general = flags.filter((x) => !x).length
  res.push({
    exam: r.exam, no: r.no, ok: true,
    nSent: clean.length, bi,
    blankGeneral: !flags[bi],
    baseGeneral: general / clean.length,
    points: answerOf(r.exam, r.no)?.points ?? null,
  })
}

const good = res.filter((r) => r.ok)
const hit = good.filter((r) => r.blankGeneral).length
const baseMean = good.reduce((s, r) => s + r.baseGeneral, 0) / good.length
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)

console.log('P3.1 — 빈칸은 일반진술 자리에 뚫리는가 (전수)')
console.log('='.repeat(72))
console.log(`  R-BLANK ${res.length}문항 · 판정 가능 ${good.length} · 제외 ${res.length - good.length}`)
const why = {}
for (const r of res.filter((x) => !x.ok)) why[r.why] = (why[r.why] ?? 0) + 1
if (Object.keys(why).length) console.log(`    제외 사유 — ${Object.entries(why).map(([k, v]) => `${k}: ${v}`).join(' · ')}`)
console.log()
console.log(`  빈칸 문장이 **일반진술**: ${hit}/${good.length} = ${pct(hit, good.length)}%`)
console.log(`  기저 — 지문 안 일반진술 비율의 평균: ${(baseMean * 100).toFixed(1)}%`)
console.log(`  이항 p (기저 ${baseMean.toFixed(3)}) = ${binomUpper(good.length, hit, baseMean).toExponential(2)}`)
console.log()

// 기저를 후하게 올려도 견디는가
for (const b of [0.6, 0.7, 0.8]) {
  console.log(`    기저를 ${b} 로 후하게 잡아도 p = ${binomUpper(good.length, hit, b).toFixed(4)}`)
}
console.log()

const p3 = good.filter((r) => r.points === 3), p2 = good.filter((r) => r.points === 2)
report({
  name: 'P3.1 — 빈칸은 일반진술 자리에 뚫린다  [전수 검사]',
  hit, n: good.length, baseRate: baseMean, shape: 'count-vs-baserate',
  falsifier: '빈칸이 예시·숫자·고유명사가 든 구체진술 문장에 뚫리는 비율이 기저만큼이면 깨진다',
  subgroups: [
    { label: '3점', hit: p3.filter((r) => r.blankGeneral).length, n: p3.length },
    { label: '2점', hit: p2.filter((r) => r.blankGeneral).length, n: p2.length },
  ],
  perExam: [...new Set(good.map((r) => r.exam))].map((e) => ({
    exam: e,
    hit: good.filter((r) => r.exam === e && r.blankGeneral).length,
    n: good.filter((r) => r.exam === e).length,
  })),
})

fs.writeFileSync(path.join(DIR, 'p31-blank-general.json'), JSON.stringify({ n: good.length, hit, baseMean, rows: res }, null, 1))
console.log(`→ ${path.join(DIR, 'p31-blank-general.json')}`)
