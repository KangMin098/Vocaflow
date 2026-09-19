// scripts/csat/probe-olh.mjs
//
// **OLH(Open Library of Humanities) 를 붙일지 정하기 전에 잰다** — 적재하지 않고, 같은 자로.
//
// ── 왜 이 소스인가 ──────────────────────────────────────────────────
// `topic-gap.mjs` 실측(2026-09-03)에서 답이 없던 칸이 **예술·문화(부족 6,172편)** 였다.
// PLOS 에는 그 주제가 없고(`harvest-plos.mjs` 의 매핑표에 빈칸으로 남겨 뒀다), OpenStax 에는
// 미술사 교재가 없고, Smarthistory 는 CC BY-**NC**-SA 이고, MDPI 는 403 으로 막혀 있다.
//
// OLH 는 CC BY 인문 저널 플랫폼이고 **OAI-PMH 가 열려 있다** — 전량 열거가 된다.
//
// ── 이 탐색기가 답하는 것 ────────────────────────────────────────────
//   ① 플랫폼에 저널이 몇 개이고 각각 몇 편인가 (OAI `completeListSize`)
//   ② 그 본문이 수능 모양·담화 대역을 통과하는가 (`lib-fit.mjs` — 재고 채점과 같은 자)
//   ③ 소재가 병목 칸에 떨어지는가 (`lib-topic.mjs` — 기출 대조와 같은 자)
//
// ⚠️ **아무것도 적재하지 않는다.**
//
// ⚠️ OAI 경로는 `/api/oai/` 다. `/oai` 는 404 를 내는데, 그 404 가 HTML 이라 XML 파서를
//   안 태우면 "OAI 가 없다" 로 오독하기 쉽다 — 실측에서 실제로 그렇게 보였다.
//
// 재실행 안전: 읽기 전용. 외부 GET 만 한다(0.3~0.5초 간격).
//
// 실행:
//   node scripts/csat/probe-olh.mjs                    # 저널 볼륨만 (빠르다)
//   node scripts/csat/probe-olh.mjs --sample 12        # 본문까지 재 본다
//   node scripts/csat/probe-olh.mjs --sample 24 --out docs/reports/olh-probe.json

import fs from 'node:fs'
import path from 'node:path'

import { scoreArticle } from './lib-fit.mjs'
import { classify } from './lib-topic.mjs'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const SAMPLE = Number(arg('sample') ?? 0)
const OUT = arg('out')
/**
 * 서평·에디토리얼을 뺀다.
 *
 * ⚠️ 실측 2026-09-03 — 안 빼고 16편을 재면 적합률이 **75%** 인데, 떨어진 4편이 전부
 *   *Book review: …* · *Editorial* 로 **153~887어**짜리다. 그건 소스가 나쁜 게 아니라
 *   **지문이 아닌 글을 표본에 넣은 것**이다. 어수로 가르면 소스의 실제 결이 보인다.
 */
const MIN_WORDS = Number(arg('min-words') ?? 1500)

const UA = 'Vocaflow/1.0 (+https://vocaflow.app; CSAT source probe)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function get(u, ms = 25000) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: c.signal, redirect: 'follow' })
    return { status: r.status, txt: await r.text() }
  } catch (e) {
    return { status: 0, txt: '', err: String(e.name || e) }
  } finally {
    clearTimeout(t)
  }
}

/** 기사 HTML → 산문. 각주·표·그림은 지문이 아니다. */
function prose(html) {
  let s = html
  const i = s.search(/<(article|main)\b/i)
  if (i > 0) s = s.slice(i)
  s = s.replace(/<(figure|table|nav|aside|figcaption|script|style)[\s\S]*?<\/\1>/gi, '\n')
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
  // 80자 미만은 표제·캡션·서지 조각이다.
  return paras.filter((p) => p.length > 80).join('\n\n')
}

console.log(`OLH 소스 탐색 — 붙이기 전에 잰다\n${'='.repeat(78)}\n`)

// ── ① 저널 볼륨 ──────────────────────────────────────────────────────
const dir = await get('https://www.openlibhums.org/journals/')
const hosts = [...new Set(dir.txt.match(/https?:\/\/([a-z0-9-]+)\.openlibhums\.org/g) ?? [])]
  .map((u) => u.replace(/^https?:\/\//, ''))
  .filter((h) => !/^www\./.test(h))
  .sort()

console.log(`  ① 저널 볼륨 (OAI \`completeListSize\`) — 목록 ${dir.status} · 저널 ${hosts.length}개`)
console.log('  ' + '-'.repeat(74))
let total = 0
let oaiOk = 0
const journals = []
for (const h of hosts) {
  const r = await get(`https://${h}/api/oai/?verb=ListIdentifiers&metadataPrefix=oai_dc`, 20000)
  await sleep(250)
  const size = Number((r.txt.match(/completeListSize="(\d+)"/) ?? [])[1] ?? 0)
  if (r.status === 200 && size) {
    total += size
    oaiOk++
    journals.push({ host: h, size })
    console.log(`    ${String(size).padStart(6)}  ${h}`)
  } else {
    journals.push({ host: h, size: 0, error: `oai ${r.status}` })
    console.log(`    ${String(r.status).padStart(6)}  ${h}  (OAI 없음)`)
  }
}
console.log('  ' + '-'.repeat(74))
console.log(`    OAI 열린 저널 ${oaiOk}/${hosts.length} · 합계 **${total.toLocaleString()}편**\n`)

if (!SAMPLE) {
  console.log('  본문까지 재려면: --sample 12')
  if (OUT) fs.writeFileSync(path.resolve(OUT), JSON.stringify({ measuredAt: new Date().toISOString(), journals, total }, null, 1))
  process.exit(0)
}

// ── ② 본문 적합률·소재 ───────────────────────────────────────────────
// 한 저널만 보면 그 저널의 결이 전체로 읽힌다 — 편수 상위 저널을 돌아가며 뽑는다.
const picked = []
for (const j of [...journals].filter((x) => x.size).sort((a, b) => b.size - a.size)) {
  const list = await get(`https://${j.host}/articles/`)
  await sleep(300)
  const links = [...new Set(list.txt.match(/\/article\/id\/\d+\//g) ?? [])]
  for (const l of links.slice(0, Math.ceil(SAMPLE / 4))) picked.push({ host: j.host, url: `https://${j.host}${l}` })
  if (picked.length >= SAMPLE) break
}

console.log(`  ② 본문 적합률 — ${Math.min(SAMPLE, picked.length)}편 측정 (편수 상위 저널에서 고루)`)
console.log('  ' + '-'.repeat(74))
let n = 0
let fit = 0
let short = 0
let nonCommercial = 0
const topics = {}
const licenses = {}
const rows = []
for (const p of picked.slice(0, SAMPLE)) {
  const a = await get(p.url)
  await sleep(400)
  if (a.status !== 200) continue
  const text = prose(a.txt)
  if (text.length < 600) continue
  const words = text.split(/\s+/).length
  const cc = (a.txt.match(/creativecommons\.org\/licenses\/([a-z-]+)\//i) ?? [])[1] ?? '?'
  const title = ((a.txt.match(/<title>([^<]{5,110})/) ?? [])[1] ?? p.url).replace(/\s+/g, ' ').split('|')[0].trim()
  licenses[cc] = (licenses[cc] ?? 0) + 1
  if (words < MIN_WORDS) {
    short++
    console.log(`    ${String(words).padStart(6)}어 ── 서평·짧은 글로 제외        ${title.slice(0, 36)}`)
    continue
  }
  // ⚠️ NC 는 우리 쓰임에 못 쓴다 — The Conversation 과 같은 자리다(`display_only`).
  //   OLH 가 **전부 CC BY 는 아니다**(실측에서 cc-by-nc 1편). 소스 단위로 "CC BY 다" 라고
  //   적어 두면 나중에 NC 가 섞여 들어온다.
  if (/nc/.test(cc)) {
    nonCommercial++
    console.log(`    ${String(words).padStart(6)}어 ── cc-${cc} 라 제외           ${title.slice(0, 36)}`)
    continue
  }
  n++
  const sc = scoreArticle(text)
  const tp = classify(text.slice(0, 6000))
  topics[tp.topic] = (topics[tp.topic] ?? 0) + 1
  if (sc.pass > 0) fit++
  rows.push({ host: p.host, url: p.url, words, shape: sc.shape, pass: sc.pass, topic: tp.topic, cc })
  console.log(
    `    ${String(words).padStart(6)}어 창 ${String(sc.pass).padStart(2)} ${tp.topic.padEnd(11)} cc-${cc.padEnd(6)} ${title.slice(0, 36)}`,
  )
}
console.log('  ' + '-'.repeat(74))
console.log(`    측정 ${n}편 · **적합 ${fit} (${n ? ((100 * fit) / n).toFixed(0) : 0}%)** · 제외: 짧은 글 ${short} · NC ${nonCommercial}`)
console.log(`    소재: ${Object.entries(topics).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
console.log(`    라이선스: ${Object.entries(licenses).sort((a, b) => b[1] - a[1]).map(([k, v]) => `cc-${k} ${v}`).join(' · ')}`)

// ── ③ 이 소스가 실제로 기여하는 몫 ───────────────────────────────────
const gapFile = path.resolve('docs/reports/topic-gap.json')
if (fs.existsSync(gapFile) && n) {
  const gap = JSON.parse(fs.readFileSync(gapFile, 'utf8'))
  const need = Object.fromEntries(gap.rows.map((r) => [r.topic, Math.max(0, Math.round(50000 * (r.examPct / 100)) - r.estStock)]))
  // ⚠️ 전량 3,309편을 그대로 곱하면 안 된다 — 그 안에 서평·에디토리얼과 NC 가 섞여 있고
  //   그것들은 못 쓴다. 표본에서 잰 **쓸 수 있는 비율**을 먼저 곱한다.
  const usableRate = n / Math.max(1, n + short + nonCommercial)
  const pool = Math.round(total * usableRate)
  console.log(`\n  ③ 3단계 5만 기준 기여 추정`)
  console.log('  ' + '-'.repeat(74))
  console.log(
    `    전량 ${total.toLocaleString()} × 쓸 수 있는 비율 ${(100 * usableRate).toFixed(0)}%` +
      `(짧은 글·NC 제외) = 후보 ${pool.toLocaleString()}편 · 그중 적합 ${((100 * fit) / n).toFixed(0)}%`,
  )
  let contrib = 0
  for (const [k, v] of Object.entries(topics).sort((a, b) => b[1] - a[1])) {
    const est = Math.round((pool * fit * v) / (n * n))
    const capped = Math.min(est, need[k] ?? 0)
    contrib += capped
    console.log(`    ${k.padEnd(11)} 추정 ${String(est).padStart(5)}편 · 그 칸 부족 ${String(need[k] ?? 0).padStart(6)} → 기여 ${String(capped).padStart(5)}`)
  }
  console.log(`    합계 기여 **${contrib.toLocaleString()}편**`)
  console.log(`    ⚠️ 표본 ${n}편으로 소재 비율을 추정했다 — 저널마다 결이 달라 오차가 크다. 순서만 믿을 것.`)
}

if (OUT) {
  fs.writeFileSync(path.resolve(OUT), JSON.stringify({ measuredAt: new Date().toISOString(), journals, total, sampled: n, fit, topics, rows }, null, 1))
  console.log(`\n→ ${OUT}`)
}
