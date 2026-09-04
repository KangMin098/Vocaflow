// scripts/csat/probe-gutenberg.mjs
//
// **Project Gutenberg 논픽션이 인문 칸 수확원이 될 수 있는가** — 읽기만 하는 프로브.
//
// 2단계(30,000)의 부족분 8,204편은 대부분 인문 칸(예술 2,795 · 교육 1,038 · 철학 1,063 ·
// 역사 750)이다. 작문으로 그만큼은 비현실적이므로 수확할 소스가 있어야 하는데,
// 지금까지 조사한 학술 소스(OpenStax · OLH · DOAJ/OJS · MDPI)는 전부 규모나 수율에서
// 막혔다. Gutenberg 는 아직 안 봤다.
//
// 기대와 우려가 둘 다 분명하다:
//   기대 — PD 라 라이선스가 깨끗하고, 역사·예술·철학 논픽션이 수천 권 있다.
//   우려 — **19세기 산문은 문장이 길다.** 대역 상한은 문장 26.67어인데 그 시대 논픽션은
//          30~50어가 흔하다. 그러면 창이 하나도 안 잡혀 수율이 0에 수렴한다.
//
// 그래서 이 프로브가 재는 것은 하나다: **책을 300~340어 조각으로 잘랐을 때 적합률.**
// 라이선스도 규모도 아니고 대역 적합이 임계 변수다.
//
//   node scripts/csat/probe-gutenberg.mjs                 # 기본 12권
//   node scripts/csat/probe-gutenberg.mjs --books 24 --out docs/reports/gutenberg-probe.json
//
// 쓰기는 안 한다. DB 에 아무것도 안 넣는다.

import fs from 'node:fs'
import { fitRecord, SHAPE } from './lib-fit.mjs'
import { classify } from './lib-topic.mjs'

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const BOOKS = Number(arg('books', 12))
const OUT = arg('out', null)
const UA = 'Vocaflow/1.0 (+https://vocaflow.app; CSAT source probe)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 인문 칸을 노린 주제 질의. Gutendex 의 topic 은 제목·주제어·서가를 함께 본다. */
const TOPICS = [
  { slot: '예술·문화', q: 'art' },
  { slot: '예술·문화', q: 'music' },
  { slot: '역사·인류', q: 'history' },
  { slot: '역사·인류', q: 'archaeology' },
  { slot: '철학·윤리', q: 'philosophy' },
  { slot: '철학·윤리', q: 'ethics' },
  { slot: '교육·언어', q: 'education' },
  { slot: '교육·언어', q: 'language' },
]

async function get(u, attempt = 0) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), 90000)
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: c.signal })
    if (!r.ok) throw new Error(`${r.status}`)
    return await r.text()
  } catch (e) {
    if (attempt >= 5) throw e
    clearTimeout(t)
    await sleep(4000 * 2 ** attempt)
    return get(u, attempt + 1)
  } finally {
    clearTimeout(t)
  }
}

/**
 * Gutenberg 본문에서 앞뒤 머리말·꼬리말을 떼고 산문만 남긴다.
 *
 * ⚠️ 표준 경계 표시(`*** START OF ...`)가 **없는 파일이 있다.** 없으면 통째로 쓴다 —
 *   앞뒤 몇 백 어가 섞여도 조각 단위 채점이 그 조각만 떨어뜨린다.
 */
function stripBoilerplate(t) {
  const s = t.indexOf('*** START OF')
  const e = t.indexOf('*** END OF')
  let body = t
  if (s > 0) body = body.slice(body.indexOf('\n', s) + 1)
  if (e > 0) body = body.slice(0, body.lastIndexOf('*** END OF'))
  return body
}

/**
 * 본문을 지문 크기 조각으로 자른다.
 *
 * 문단 경계에서만 자른다 — 문장 중간에서 끊으면 그 조각의 문장 평균이 망가져서
 * **소스의 성질이 아니라 자르는 방식을 재게 된다.**
 */
function chop(body, lo = 300, hi = 340) {
  const paras = body
    .split(/\n\s*\n/)
    .map((x) => x.replace(/\s+/g, ' ').trim())
    .filter((x) => x.length > 80 && /[.!?]/.test(x))
  const out = []
  let buf = []
  let n = 0
  for (const para of paras) {
    const w = para.split(/\s+/).length
    if (w > hi) continue // 한 문단이 조각보다 크면 버린다 (표·목록·긴 인용일 가능성)
    buf.push(para)
    n += w
    if (n >= lo) {
      if (n <= hi + 60) out.push(buf.join(' '))
      buf = []
      n = 0
    }
  }
  return out
}

console.log(`Gutenberg 논픽션 프로브 — 인문 칸 수확 가능성\n${'='.repeat(78)}`)
console.log(`  대역 어수 ${SHAPE.words.lo}~${SHAPE.words.hi} · 문장 ${SHAPE.sentLen.lo.toFixed(1)}~${SHAPE.sentLen.hi.toFixed(1)}어 · 낱말 ${SHAPE.wordLen.lo.toFixed(2)}~${SHAPE.wordLen.hi.toFixed(2)}자`)
console.log(`  ⚠️ 19세기 산문은 문장이 길다. 이 프로브가 재는 것은 그 한 가지다.\n`)

const perBook = Math.max(1, Math.round(BOOKS / TOPICS.length))
const rows = []
let totalChunks = 0
let totalFit = 0
const byTopic = {}

for (const { slot, q } of TOPICS) {
  let list
  try {
    const j = JSON.parse(await get(`https://gutendex.com/books?topic=${encodeURIComponent(q)}&languages=en&mime_type=text%2Fplain&sort=popular`))
    list = (j.results ?? []).slice(0, perBook)
  } catch (e) {
    console.log(`  ❌ ${q} 목록 실패 — ${e.message}`)
    continue
  }
  for (const b of list) {
    const url = Object.entries(b.formats ?? {}).find(([k]) => k.startsWith('text/plain'))?.[1]
    if (!url) continue
    let raw
    try {
      raw = await get(url)
    } catch (e) {
      console.log(`  ❌ ${String(b.title).slice(0, 40)} 본문 실패 — ${e.message}`)
      continue
    }
    const chunks = chop(stripBoilerplate(raw))
    let fit = 0
    const reasons = { 어수: 0, 문장: 0, 낱말: 0, 담화: 0 }
    const topics = {}
    for (const c of chunks) {
      const f = fitRecord(c)
      if (f.pass > 0) {
        fit += 1
        const tp = classify(c)
        topics[tp.topic] = (topics[tp.topic] ?? 0) + 1
        byTopic[tp.topic] = (byTopic[tp.topic] ?? 0) + 1
      }
    }
    totalChunks += chunks.length
    totalFit += fit
    rows.push({ slot, title: String(b.title).slice(0, 46), id: b.id, chunks: chunks.length, fit, topics })
    console.log(
      `  ${slot.padEnd(8)} ${String(fit).padStart(4)}/${String(chunks.length).padEnd(5)} ` +
        `${chunks.length ? String(Math.round((fit / chunks.length) * 100)).padStart(3) : '  -'}%  ${String(b.title).slice(0, 44)}`,
    )
    await sleep(400)
  }
}

console.log(`\n${'-'.repeat(78)}`)
console.log(`  조각 ${totalChunks.toLocaleString()} 중 **적합 ${totalFit.toLocaleString()} (${totalChunks ? ((totalFit / totalChunks) * 100).toFixed(1) : 0}%)**`)
console.log(`  적합분 소재: ${Object.entries(byTopic).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음'}`)

const human = ['예술·문화', '역사·인류', '철학·윤리', '교육·언어'].reduce((s, k) => s + (byTopic[k] ?? 0), 0)
console.log(`  그중 **인문 4칸 ${human.toLocaleString()}편** (${totalFit ? ((human / totalFit) * 100).toFixed(0) : 0}%)`)
console.log(`\n  판정 기준: 인문 칸 순 수율(조각 대비)이 5% 를 넘으면 파이프라인을 지을 값이 있다.`)
console.log(`            그 아래면 §20~26 의 다른 소스들과 같은 결론이다.`)
const netHuman = totalChunks ? (human / totalChunks) * 100 : 0
console.log(`  → 인문 순 수율 **${netHuman.toFixed(1)}%**  ${netHuman >= 5 ? '✅ 지을 값이 있다' : '❌ 기준 미달'}`)

if (OUT) {
  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), totalChunks, totalFit, byTopic, human, netHuman, rows }, null, 2))
  console.log(`\n→ ${OUT}`)
}
