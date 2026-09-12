// scripts/csat/probe-ojs.mjs
//
// **가설 시험: 인문 결손 11,000편을 「추출기 하나」로 덮을 수 있는가.**
//
// ── 어디서 온 가설인가 ──────────────────────────────────────────────
// `docs/reports/csat-source-fit-20260903.md` §9 에서 DOAJ 를 "볼륨은 크나 전문 링크가
// 25편에 약 20호스트로 흩어져 비싸다" 로 접었다. 그런데 그 호스트들을 다시 보면
// `hrcak.srce.hr` · `czasopisma.kul.pl` · `revistas.ups.edu.ec` · `periodicos.unifesp.br` 로
// **전부 OJS(Open Journal Systems)** 다. OJS 는 HTML 구조와 메타 태그가 규격이라,
// **호스트가 20개여도 추출기는 하나면 될 수 있다.**
//
// 맞으면 인문 결손(예술 6,172 · 교육 2,882 · 철학 2,413 · 역사 1,602 = 13,069편 중
// OpenStax·OLH 로 못 메우는 약 11,000편)의 길이 열린다. 틀리면 목표 배합 자체를
// 사용자와 다시 정해야 한다. **그래서 먼저, 싸게 시험한다.**
//
// ── 이 탐색기가 답하는 것 ────────────────────────────────────────────
//   ① DOAJ 인문 기사의 전문 호스트 중 **OJS 비율**은 얼마인가
//   ② OJS 기사에 **HTML 전문(galley)** 이 있는가 — PDF 만 있으면 이 길은 막힌다
//   ③ 규격 추출기 하나로 뽑은 본문이 **수능 대역을 통과**하는가 (`lib-fit.mjs`)
//   ④ 영어 비율은 얼마인가 — DOAJ 인문은 다언어다(실측 EN 38 / ES 20 / PT 12 …)
//
// ⚠️ **아무것도 적재하지 않는다.**
//
// 재실행 안전: 읽기 전용. 외부 GET 만 한다.
//
// 실행:
//   node scripts/csat/probe-ojs.mjs
//   node scripts/csat/probe-ojs.mjs --subject history --n 40
//   node scripts/csat/probe-ojs.mjs --out docs/reports/ojs-probe.json

import fs from 'node:fs'
import path from 'node:path'

import { scoreArticle } from './lib-fit.mjs'
import { classify } from './lib-topic.mjs'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const SUBJECT = arg('subject') ?? 'philosophy'
const N = Number(arg('n') ?? 30)
const OUT = arg('out')

const UA = 'Vocaflow/1.0 (+https://vocaflow.app; CSAT source probe)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function get(u, ms = 25000) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: c.signal, redirect: 'follow' })
    return { status: r.status, url: r.url, txt: await r.text() }
  } catch (e) {
    return { status: 0, url: u, txt: '', err: String(e.name || e) }
  } finally {
    clearTimeout(t)
  }
}

/**
 * OJS 판별 — 세 신호 중 하나면 OJS 로 본다.
 *
 * ⚠️ `generator` 메타만 보면 놓친다 — 테마를 갈아 끼운 저널은 그 태그를 지운다.
 *   URL 규격(`/index.php/<저널>/article/view/…`)과 OJS 가 항상 심는 Scholar 메타를 같이 본다.
 */
function looksLikeOjs(html, url) {
  if (/Open Journal Systems/i.test(html)) return 'generator'
  if (/\/index\.php\/[^/]+\/article\/(view|download)\//.test(url)) return 'url'
  if (/<meta[^>]+name="citation_journal_title"/i.test(html) && /pkp|ojs/i.test(html)) return 'meta'
  return null
}

/** OJS 기사 페이지 → HTML 전문(galley) 주소. 없으면 null (= PDF 뿐). */
function htmlGalley(html, pageUrl) {
  // OJS 는 galley 링크를 `/article/view/<id>/<galleyId>` 로 낸다. HTML galley 는 라벨이 HTML.
  const m = html.match(/href="([^"]*\/article\/view\/[^"]*?)"[^>]*>\s*(?:<[^>]+>\s*)*HTML/i)
  if (m) return new URL(m[1], pageUrl).toString()
  const m2 = html.match(/<meta[^>]+name="citation_fulltext_html_url"[^>]+content="([^"]+)"/i)
  if (m2) return m2[1]
  return null
}

/** 규격 추출기 — OJS/일반 기사 HTML 에서 문단만 뽑는다. */
function prose(html) {
  let s = html
  const i = s.search(/<(article|main|div[^>]+id="(content|articleFullText)")\b/i)
  if (i > 0) s = s.slice(i)
  s = s.replace(/<(figure|table|nav|aside|figcaption|script|style|header|footer)[\s\S]*?<\/\1>/gi, '\n')
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
  return paras.filter((p) => p.length > 80).join('\n\n')
}

const isEnglish = (t) => {
  const s = t.slice(0, 4000)
  const ascii = (s.match(/[A-Za-z]/g) ?? []).length
  const accented = (s.match(/[áéíóúñçàèìòùâêîôûäöüãõłśćżź]/gi) ?? []).length
  const stop = (s.match(/\b(the|and|of|to|in|that|is|was|for|with)\b/gi) ?? []).length
  return ascii > 500 && accented / Math.max(1, ascii) < 0.02 && stop > 25
}

console.log(`OJS 단일 추출기 가설 시험 — 인문 결손 11,000편의 유일한 후보\n${'='.repeat(78)}`)
console.log(`  DOAJ 주제 "${SUBJECT}" · 표본 ${N}편 · 적재하지 않는다\n`)

// ── DOAJ 에서 후보 모으기 ────────────────────────────────────────────
const q = `bibjson.subject.term:${SUBJECT}`
const r = await get(`https://doaj.org/api/search/articles/${encodeURIComponent(q)}?pageSize=${Math.min(100, N * 3)}`)
if (r.status !== 200) {
  console.error(`DOAJ 질의 실패 ${r.status}`)
  process.exit(1)
}
const doaj = JSON.parse(r.txt)
console.log(`  DOAJ 총량 ${Number(doaj.total).toLocaleString()}편 · 이 쪽 ${doaj.results.length}건\n`)

const cands = []
for (const a of doaj.results) {
  const link = (a.bibjson.link ?? []).find((l) => l.type === 'fulltext')
  if (!link?.url) continue
  let host = ''
  try {
    host = new URL(link.url).host
  } catch {
    continue
  }
  cands.push({ host, url: link.url, title: (a.bibjson.title ?? '').slice(0, 50) })
}

// ── 한 편씩 열어 본다 ────────────────────────────────────────────────
const hosts = {}
const stat = { ojs: 0, nonOjs: 0, htmlGalley: 0, pdfOnly: 0, english: 0, scored: 0, fit: 0, dead: 0 }
const rows = []
const topics = {}
console.log(`  ${'호스트'.padEnd(30)}${'OJS'.padStart(6)}${'HTML전문'.padStart(9)}${'영어'.padStart(6)}${'어수'.padStart(7)}${'창'.padStart(4)}`)
console.log('  ' + '-'.repeat(74))
for (const c of cands.slice(0, N)) {
  const page = await get(c.url)
  await sleep(400)
  hosts[c.host] = (hosts[c.host] ?? 0) + 1
  if (page.status !== 200 || page.txt.length < 500) {
    stat.dead++
    console.log(`  ${c.host.slice(0, 30).padEnd(30)}${String(page.status || page.err).padStart(6)}`)
    continue
  }
  const ojs = looksLikeOjs(page.txt, page.url)
  if (ojs) stat.ojs++
  else stat.nonOjs++

  let text = prose(page.txt)
  let via = '본문'
  if (text.split(/\s+/).length < 400) {
    const g = htmlGalley(page.txt, page.url)
    if (g) {
      const gp = await get(g)
      await sleep(400)
      if (gp.status === 200) {
        const t2 = prose(gp.txt)
        if (t2.length > text.length) {
          text = t2
          via = 'galley'
        }
      }
    }
  }
  const words = text.split(/\s+/).filter(Boolean).length
  if (words >= 400) stat.htmlGalley++
  else stat.pdfOnly++

  const en = isEnglish(text)
  if (en) stat.english++
  let pass = 0
  let topic = '—'
  if (en && words >= 400) {
    const sc = scoreArticle(text)
    pass = sc.pass
    topic = classify(text.slice(0, 6000)).topic
    topics[topic] = (topics[topic] ?? 0) + 1
    stat.scored++
    if (pass > 0) stat.fit++
  }
  rows.push({ host: c.host, ojs, via, words, english: en, pass, topic, title: c.title })
  console.log(
    `  ${c.host.slice(0, 30).padEnd(30)}${(ojs ?? '—').padStart(6)}${(words >= 400 ? via : '없음').padStart(9)}` +
      `${(en ? 'EN' : '—').padStart(6)}${String(words).padStart(7)}${String(pass || '').padStart(4)}`,
  )
}

const n = rows.length
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(0) : '0')
console.log('  ' + '-'.repeat(74))
console.log(`  열어 본 ${n}편 (실패 ${stat.dead}) · 호스트 ${Object.keys(hosts).length}개`)
console.log(`  ① OJS ${stat.ojs}/${n} (${pct(stat.ojs, n)}%) — 규격이 같으면 추출기 하나로 덮인다`)
console.log(`  ② HTML 전문 확보 ${stat.htmlGalley}/${n} (${pct(stat.htmlGalley, n)}%) · PDF 뿐 ${stat.pdfOnly}`)
console.log(`  ③ 영어 ${stat.english}/${n} (${pct(stat.english, n)}%)`)
console.log(`  ④ 채점한 ${stat.scored}편 중 **적합 ${stat.fit} (${pct(stat.fit, stat.scored)}%)**`)
if (Object.keys(topics).length) {
  console.log(`     소재: ${Object.entries(topics).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
}
const netRate = stat.fit / Math.max(1, n)
console.log(
  `\n  **순 수율 ${stat.fit}/${n} = ${pct(stat.fit, n)}%** — DOAJ "${SUBJECT}" ` +
    `${Number(doaj.total).toLocaleString()}편에 곱하면 약 ${Math.round(doaj.total * netRate).toLocaleString()}편`,
)
console.log(`  ⚠️ 표본 ${n}편이다. 순서와 자릿수만 믿을 것 — 정밀한 추정이 아니다.`)

if (OUT) {
  fs.writeFileSync(
    path.resolve(OUT),
    JSON.stringify({ measuredAt: new Date().toISOString(), subject: SUBJECT, doajTotal: doaj.total, stat, hosts, topics, rows }, null, 1),
  )
  console.log(`\n→ ${OUT}`)
}
