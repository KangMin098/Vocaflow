// scripts/csat/probe-openstax.mjs
//
// **OpenStax 를 붙일지 정하기 전에 잰다** — 적재하지 않고, 같은 자로.
//
// ── 왜 이 소스인가 ──────────────────────────────────────────────────
// `topic-gap.mjs` 실측(2026-09-03): 적합 원문 14,252편의 **균형 사정권은 4,161편**이고
// 병목은 철학·윤리(219편 · 배율 0.29) · 역사·인류(0.30) · 예술·문화(0.42)다.
// 그리고 지금 배선된 소스 중 **인문 소재를 내는 곳이 하나도 없다**(plos 철학 2% · usgs 0%).
// PLOS 를 아무리 더 긁어도 병목은 안 줄고 균형 사정권도 안 는다.
//
// OpenStax 는 CC BY 4.0 교재 129권이고 그 안에 Introduction to Philosophy · Business Ethics ·
// World History Vol 1·2 · U.S. History · Introduction to Anthropology 가 있다 — 병목 그대로다.
//
// ── 이 탐색기가 답하는 것 ────────────────────────────────────────────
//   ① 본문을 실제로 꺼낼 수 있는가 (REX 가 서버렌더한다)
//   ② 그 본문이 **수능 모양·담화 대역**을 통과하는가 (`lib-fit.mjs` — 재고 채점과 같은 자)
//   ③ 소재가 실제로 병목 칸에 떨어지는가 (`lib-topic.mjs` — 기출 대조와 같은 자)
//   ④ 책 한 권에서 몇 편이 나오는가 (= 5만 목표에 실제로 기여하는 양)
//
// ⚠️ **아무것도 적재하지 않는다.** 붙일지 말지는 이 수치를 보고 사람이 정한다.
//
// 재실행 안전: 읽기 전용. 외부 GET 만 한다(페이지당 0.4초 간격).
//
// 실행:
//   node scripts/csat/probe-openstax.mjs                       # 기본 4권 × 12쪽
//   node scripts/csat/probe-openstax.mjs --pages 25
//   node scripts/csat/probe-openstax.mjs --book introduction-philosophy
//   node scripts/csat/probe-openstax.mjs --out docs/reports/openstax-probe.json

import fs from 'node:fs'
import path from 'node:path'

import { scoreArticle, FLOOR, SHAPE, TYPE } from './lib-fit.mjs'
import { classify } from './lib-topic.mjs'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const PAGES = Number(arg('pages') ?? 12)
const OUT = arg('out')
const ONE = arg('book')

/** 병목 소재를 내는 교재부터 — 과학 교재는 이미 넘치므로 넣지 않는다. */
const BOOKS = [
  { slug: 'introduction-philosophy', label: 'Introduction to Philosophy', want: '철학·윤리' },
  { slug: 'world-history-volume-1', label: 'World History, Volume 1: to 1500', want: '역사·인류' },
  { slug: 'introduction-anthropology', label: 'Introduction to Anthropology', want: '역사·인류' },
  { slug: 'business-ethics', label: 'Business Ethics', want: '철학·윤리' },
]

const UA = 'Vocaflow/1.0 (+https://vocaflow.app; textbook source probe)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function get(url) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), 25000)
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: c.signal, redirect: 'follow' })
    return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : '' }
  } catch (e) {
    return { ok: false, status: 0, text: '', err: String(e.name || e) }
  } finally {
    clearTimeout(t)
  }
}

/**
 * REX 는 목차를 `window.__PRELOADED_STATE__` 에 실어 보낸다 — 아카이브 API 를 따로 치지 않아도
 * 책 한 권의 모든 쪽 슬러그를 여기서 얻는다.
 *
 * ⚠️ 그 JSON 은 통째로 파싱하기엔 크고(수백 KB) 판마다 모양이 바뀐다. 우리에게 필요한 건
 *   슬러그뿐이라 `"slug":"…"` 만 훑는다.
 *
 * ⚠️ **링크(`/books/<책>/pages/<쪽>`)로 뽑으면 안 된다** — REX 는 목차를 자바스크립트로
 *   그리므로 서버 응답의 앵커에는 **지금 보고 있는 쪽 하나만** 있다(실측: 링크 1개 vs
 *   슬러그 140개). 링크로 뽑으면 조용히 "전체 0쪽" 이 되고, 그 0 이 "이 소스는 못 쓴다" 로
 *   읽힌다.
 */
function pageSlugs(html, bookSlug) {
  const seen = []
  for (const m of html.matchAll(/"slug":"([a-z0-9][a-z0-9-]{2,120})"/g)) {
    const s = m[1]
    if (s === bookSlug || seen.includes(s)) continue
    seen.push(s)
  }
  return seen
}

/**
 * REX 본문 HTML → 산문.
 *
 * ⚠️ 교재에는 지문이 아닌 것이 많이 섞인다 — 학습목표 목록 · 연습문제 · 용어집 · 각주 ·
 *   표·그림 캡션. 그것들을 남기면 `looksLikeProse` 가 창을 버리는 데서 끝나지 않고
 *   **문장 길이 평균을 끌어내려 모양 대역까지 흔든다.** 그래서 먼저 잘라 낸다.
 */
function extractProse(html) {
  let s = html
  const cut = s.indexOf('id="main-content"')
  if (cut > 0) s = s.slice(cut)
  // 지문이 아닌 블록 제거
  s = s.replace(/<(figure|table|aside|nav|figcaption)[\s\S]*?<\/\1>/gi, '\n')
  s = s.replace(/<div[^>]*class="[^"]*\b(os-eoc|learning-objectives|glossary|references|summary|review-questions|checkpoint)\b[^"]*"[\s\S]*?<\/div>/gi, '\n')
  s = s.replace(/<(ul|ol)[\s\S]*?<\/\1>/gi, '\n')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  // 문단만 남긴다 — 교재 산문은 <p> 안에 있다.
  const paras = [...s.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) =>
    m[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
  return paras.filter((p) => p.length > 60).join('\n\n')
}

const W = (s) => s.match(/[A-Za-z][A-Za-z'-]*/g) ?? []

console.log(
  `OpenStax 소스 탐색 — 붙이기 전에 잰다\n${'='.repeat(78)}\n` +
    `  자: lib-fit.mjs (${TYPE} · 어수 ${SHAPE.words.lo}~${SHAPE.words.hi} · 담화하한 연결사 ` +
    `${FLOOR.conn.toFixed(2)}·지시어 ${FLOOR.ana.toFixed(2)}) · lib-topic.mjs\n` +
    `  책당 ${PAGES}쪽 표본 · 적재하지 않는다\n`,
)

const books = ONE ? BOOKS.filter((b) => b.slug === ONE) : BOOKS
const report = []

for (const book of books) {
  const first = await get(`https://openstax.org/books/${book.slug}/pages/1-introduction`)
  if (!first.ok) {
    console.log(`  ${book.label} — 목차 실패 (${first.status}${first.err ? ' ' + first.err : ''})`)
    report.push({ ...book, error: `toc ${first.status}` })
    continue
  }
  const slugs = pageSlugs(first.text, book.slug)
  // 앞 두 쪽은 서문·머리말이라 지문이 아니다. 균등 간격으로 뽑아 한 장에 몰리지 않게 한다.
  const body = slugs.filter((s) => !/^(1-introduction|preface|index)/.test(s))
  const step = Math.max(1, Math.floor(body.length / PAGES))
  const picked = body.filter((_, i) => i % step === 0).slice(0, PAGES)

  let fit = 0
  let shapeOnly = 0
  let words = 0
  let failed = 0
  const topics = {}
  const samples = []
  for (const s of picked) {
    const r = await get(`https://openstax.org/books/${book.slug}/pages/${s}`)
    await sleep(400)
    if (!r.ok) {
      failed++
      continue
    }
    const prose = extractProse(r.text)
    if (prose.length < 400) {
      failed++
      continue
    }
    const sc = scoreArticle(prose)
    const tp = classify(prose.slice(0, 6000))
    words += W(prose).length
    topics[tp.topic] = (topics[tp.topic] ?? 0) + 1
    if (sc.shape > 0) shapeOnly++
    if (sc.pass > 0) fit++
    samples.push({ slug: s, words: W(prose).length, shape: sc.shape, pass: sc.pass, topic: tp.topic, margin: tp.margin })
  }
  const n = picked.length - failed
  const hitWant = samples.filter((x) => x.topic === book.want).length
  console.log(`  ${book.label}`)
  console.log(`    전체 ${body.length}쪽 · 표본 ${picked.length}(본문 ${n} · 실패 ${failed})`)
  console.log(
    `    모양 통과 ${shapeOnly}/${n} · **적합(pass>0) ${fit}/${n}** ` +
      `(${n ? ((100 * fit) / n).toFixed(0) : 0}%) · 평균 ${n ? Math.round(words / n) : 0}어`,
  )
  console.log(
    `    소재: ` +
      Object.entries(topics)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v}`)
        .join(' · ') +
      `  → 목표칸(${book.want}) ${hitWant}/${n}`,
  )
  const est = n ? Math.round((body.length * fit) / n) : 0
  const estWant = n ? Math.round((body.length * samples.filter((x) => x.pass > 0 && x.topic === book.want).length) / n) : 0
  console.log(`    → 책 한 권 추정 적합 **${est}편** (그중 목표칸 ${estWant}편)\n`)
  report.push({ ...book, totalPages: body.length, sampled: n, failed, shapeOnly, fit, est, estWant, topics, samples })
}

const totalEst = report.reduce((s, r) => s + (r.est ?? 0), 0)
const totalWant = report.reduce((s, r) => s + (r.estWant ?? 0), 0)
console.log('  ' + '-'.repeat(74))
console.log(`  탐색한 ${report.length}권 추정 적합 합계 **${totalEst}편** (병목칸 ${totalWant}편)`)
console.log()
console.log('  ⚠️ 이 수치는 쪽 단위다 — 교재 한 쪽이 원문 한 편이 된다는 가정 위에 있다.')
console.log('     실제 적재에서는 절(section) 경계가 달라 편수가 움직일 수 있다.')

if (OUT) {
  fs.writeFileSync(path.resolve(OUT), JSON.stringify({ measuredAt: new Date().toISOString(), pagesPerBook: PAGES, report }, null, 1))
  console.log(`\n→ ${OUT}`)
}
