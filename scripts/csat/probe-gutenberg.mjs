// scripts/csat/probe-gutenberg.mjs
//
// **Project Gutenberg 논픽션이 인문 칸 수확원이 될 수 있는가** — 읽기만 하는 프로브.
//
// 2단계(30,000)의 부족분은 대부분 인문 칸(예술 2,736 · 철학 · 역사 · 교육)이다.
// 작문으로 그만큼은 비현실적이므로 수확할 소스가 있어야 하는데, 지금까지 조사한
// 학술 소스(OpenStax · OLH · DOAJ/OJS · MDPI)는 전부 규모나 수율에서 막혔다.
//
// 기대와 우려가 둘 다 분명하다:
//   기대 — PD 라 라이선스가 깨끗하고, 역사·예술·철학 논픽션이 수천 권 있다.
//   우려 — **19세기 산문은 문장이 길다.** 대역 상한은 문장 26.67어인데 그 시대 논픽션은
//          30~50어가 흔하다. 그러면 창이 하나도 안 잡혀 수율이 0에 수렴한다.
//
// 이 프로브가 재는 것은 하나다: **책을 300~340어 조각으로 잘랐을 때 적합률.**
//
// ⚠️ **gutendex.com 은 쓰지 않는다.** 2026-09-04 에 두 번 시도했고 두 번 다 503 과
//   타임아웃으로 죽었다(두 번째는 출력 한 줄 없이 멈춰 있었다). 남의 래퍼 API 는
//   이런 조사의 단일 실패점이 된다. 대신 Gutenberg 가 직접 내는 **카탈로그 CSV** 를
//   받아 LoC 분류로 거른다 — 한 번 받아 캐시하면 이후 조회가 전부 로컬이다.
//
//   node scripts/csat/probe-gutenberg.mjs --books 24 --out docs/reports/gutenberg-probe.json

import fs from 'node:fs'
import path from 'node:path'
import { fitRecord, SHAPE } from './lib-fit.mjs'
import { classify } from './lib-topic.mjs'

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const BOOKS = Number(arg('books', 24))
const OUT = arg('out', null)
const UA = 'Vocaflow/1.0 (+https://vocaflow.app; CSAT source probe)'
const CACHE = path.resolve('scripts/csat/data/pg_catalog.csv')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** LoC 분류 앞글자 → 노리는 칸. 인문만 남긴다. */
const LOC_SLOT = {
  N: '예술·문화', // Fine Arts
  D: '역사·인류', // World History
  E: '역사·인류', // History of the Americas
  F: '역사·인류', // Local history of the Americas
  G: '역사·인류', // Geography, Anthropology
  B: '철학·윤리', // Philosophy, Psychology, Religion
  L: '교육·언어', // Education
  P: '교육·언어', // Language and Literature
}

/**
 * ⚠️ **node 의 fetch 로는 gutenberg.org 에 못 붙는다.**
 *
 *   2026-09-04 실측: 같은 URL 을 curl 은 200 으로 받고 node 는 매번 `ECONNRESET`
 *   (Client network socket disconnected before secure TLS connection was established)
 *   으로 죽는다. undici 의 TLS 협상이 이 호스트와 맞지 않는 것으로 보인다.
 *
 *   원인을 더 파는 것보다 **되는 도구를 쓰는 편이 싸다.** curl 로 넘긴다.
 *   (PLOS 는 fetch 로 잘 된다 — 호스트마다 다르므로 일반화하지 않는다.)
 */
async function get(u, attempt = 0) {
  try {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const run = promisify(execFile)
    const { stdout } = await run(
      'curl',
      ['-sSL', '--max-time', '90', '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '--fail', u],
      { maxBuffer: 64 * 1024 * 1024 },
    )
    if (!stdout || stdout.length < 200) throw new Error('본문이 너무 짧다')
    return stdout
  } catch (e) {
    if (attempt >= 2) throw new Error(String(e.message).slice(0, 60))
    await sleep(2000 * 2 ** attempt)
    return get(u, attempt + 1)
  }
}

/** 따옴표를 존중하는 최소 CSV 파서. 카탈로그의 Subjects 열에 쉼표가 잔뜩 들어 있다. */
function parseCsvLine(line) {
  const out = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1 } else if (ch === '"') q = false
      else cur += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { out.push(cur); cur = '' } else cur += ch
  }
  out.push(cur)
  return out
}

function stripBoilerplate(t) {
  const s = t.indexOf('*** START OF')
  const e = t.indexOf('*** END OF')
  let body = t
  if (s > 0) body = body.slice(body.indexOf('\n', s) + 1)
  if (e > 0) body = body.slice(0, body.lastIndexOf('*** END OF'))
  return body
}

/**
 * 본문을 지문 크기 조각으로 자른다. **문단 경계에서만** 자른다 — 문장 중간에서 끊으면
 * 그 조각의 문장 평균이 망가져서 소스의 성질이 아니라 자르는 방식을 재게 된다.
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
    if (w > hi) continue
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

// ① 목록 — **검색 페이지 HTML 에서 뽑는다.**
//
//   ⚠️ 카탈로그 CSV(수십 MB)는 이 네트워크에서 매번 ECONNRESET 으로 끊겼고,
//     gutendex.com 은 503 과 무응답이었다. 개별 텍스트 파일은 200 으로 잘 받아진다.
//     그래서 큰 파일 하나 대신 작은 요청 여럿으로 바꾼다 — 느리지만 끊기지 않는다.
const QUERIES = [
  { slot: '예술·문화', q: 'art history' },
  { slot: '예술·문화', q: 'music history' },
  { slot: '역사·인류', q: 'ancient history' },
  { slot: '역사·인류', q: 'anthropology' },
  { slot: '철학·윤리', q: 'philosophy' },
  { slot: '철학·윤리', q: 'ethics' },
  { slot: '교육·언어', q: 'language essays' },
  { slot: '교육·언어', q: 'education' },
]

const picked = []
const seen = new Set()
const per = Math.max(1, Math.round(BOOKS / QUERIES.length))
for (const { slot, q } of QUERIES) {
  let html
  try {
    html = await get(`https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(q)}&submit_search=Go`)
  } catch (e) {
    console.log(`  ❌ 목록 ${q} — ${e.message}`)
    continue
  }
  const ids = [...html.matchAll(/href="\/ebooks\/(\d+)"/g)].map((m) => m[1])
  let taken = 0
  for (const id of ids) {
    if (seen.has(id) || taken >= per) continue
    seen.add(id)
    picked.push({ id, slot, title: `#${id}`, loc: q })
    taken += 1
  }
  await sleep(600)
}
console.log(`  검색 8질의에서 ${picked.length}권 골랐다\n`)

const rows = []
let totalChunks = 0
let totalFit = 0
const byTopic = {}

for (const b of picked) {
  let raw
  try {
    raw = await get(`https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.txt`)
  } catch (e) {
    console.log(`  ❌ ${String(b.title).slice(0, 40)} — ${e.message}`)
    continue
  }
  const chunks = chop(stripBoilerplate(raw))
  let fit = 0
  for (const c of chunks) {
    if (fitRecord(c).pass > 0) {
      fit += 1
      const tp = classify(c)
      byTopic[tp.topic] = (byTopic[tp.topic] ?? 0) + 1
    }
  }
  totalChunks += chunks.length
  totalFit += fit
  rows.push({ slot: b.slot, loc: b.loc, id: b.id, title: String(b.title).slice(0, 46), chunks: chunks.length, fit })
  console.log(
    `  ${b.slot.padEnd(8)} ${String(fit).padStart(4)}/${String(chunks.length).padEnd(5)} ` +
      `${chunks.length ? String(Math.round((fit / chunks.length) * 100)).padStart(3) : '  -'}%  ${String(b.title).slice(0, 42)}`,
  )
  await sleep(500)
}

console.log(`\n${'-'.repeat(78)}`)
console.log(`  조각 ${totalChunks.toLocaleString()} 중 **적합 ${totalFit.toLocaleString()} (${totalChunks ? ((totalFit / totalChunks) * 100).toFixed(1) : 0}%)**`)
console.log(`  적합분 소재: ${Object.entries(byTopic).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음'}`)

const human = ['예술·문화', '역사·인류', '철학·윤리', '교육·언어'].reduce((s, k) => s + (byTopic[k] ?? 0), 0)
const netHuman = totalChunks ? (human / totalChunks) * 100 : 0
console.log(`  그중 **인문 4칸 ${human.toLocaleString()}편** (${totalFit ? ((human / totalFit) * 100).toFixed(0) : 0}%)`)
console.log(`\n  판정: 인문 순 수율(조각 대비) 5% 이상이면 파이프라인을 지을 값이 있다.`)
console.log(`  → 인문 순 수율 **${netHuman.toFixed(1)}%**  ${netHuman >= 5 ? '✅ 지을 값이 있다' : '❌ 기준 미달'}`)

if (OUT) {
  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), totalChunks, totalFit, byTopic, human, netHuman, rows }, null, 2))
  console.log(`\n→ ${OUT}`)
}
