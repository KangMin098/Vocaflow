// scripts/compose/feed-probe.mjs
//
// ACP §20 — 후보 피드 주소를 열어 **학습 적합도**로 순위를 매긴다.
//
// `feed-fitness.mjs` 는 이미 등록된 피드를 재고, 이쪽은 **등록 전 후보**를 잰다.
// 등록 기준을 숫자로 두기 위한 도구다 — 발행사가 알리는 피드를 다 넣으면 탑스토리·월드
// 피드가 섞여 들어와 학습 부적합 비율을 끌어올린다(실측: 활성 19개 평균 적합 14.5%,
// 그중 8개가 10% 미만).
//
// 분류 규칙은 feed-fitness.mjs 와 같은 것을 쓴다 — 두 벌이면 순위가 갈린다.
//
// 실행: pnpm dlx tsx scripts/compose/feed-probe.mjs <url...>
//        pnpm dlx tsx scripts/compose/feed-probe.mjs --file <주소목록파일>

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { COMPOSE_USER_AGENT } = await import('@vocaflow/library-pipeline')

const UNFIT =
  /\b(kill|killed|dead|death|died|deadly|crash|murder|shot|shoot|gun|attack|war|troops|missile|strike|bomb|blast|arrest|court|trial|prison|jail|scandal|protest|riot|coup|sanction|tariff|election|vote|poll|impeach|lawsuit|abuse|assault|rape|suicide)\b|trump|putin|netanyahu|hamas|hezbollah|ukraine|gaza|israel|russia/i
const FIT =
  /\b(animal|bird|whale|dolphin|fish|insect|ant|bee|butterfly|dinosaur|fossil|species|volcano|earthquake|ocean|coral|forest|tree|river|lake|glacier|climate|weather|storm|rain|snow|drought|space|planet|moon|mars|star|galaxy|telescope|orbit|rocket|nasa|scientist|science|research|study|discover|invention|robot|energy|solar|recycle|museum|art|music|film|festival|travel|tourist|recipe|food|sleep|exercise|health|vitamin|brain|memory|school|student|teacher|university|learning|language|sport|olympic|football|soccer|marathon|swim)\b/i

const classify = (t) => (UNFIT.test(t) ? 'unfit' : FIT.test(t) ? 'fit' : 'neutral')

const get = async (url, ms = 15000) => {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try {
    const r = await fetch(url, { headers: { 'User-Agent': COMPOSE_USER_AGENT }, signal: c.signal, redirect: 'follow' })
    return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : '' }
  } catch (e) {
    return { ok: false, status: 0, text: '', err: String(e.name || e) }
  } finally {
    clearTimeout(t)
  }
}

function titles(xml) {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? []
  const out = []
  for (const b of blocks) {
    const m = b.match(/<title(?:\s[^>]*)?>\s*(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))\s*<\/title>/i)
    const t = (m?.[1] ?? m?.[2] ?? '').trim()
    if (t) out.push(t)
  }
  return out
}

const fi = process.argv.indexOf('--file')
const urls =
  fi >= 0
    ? fs
        .readFileSync(path.resolve(process.argv[fi + 1]), 'utf8')
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith('#'))
    : process.argv.slice(2).filter((a) => a.startsWith('http'))

if (urls.length === 0) throw new Error('주소를 하나 이상 주세요 (또는 --file)')

const rows = []
for (const u of urls) {
  const r = await get(u)
  if (!r.ok) {
    rows.push({ u, n: 0, pct: null, upct: null, note: 'HTTP' + (r.err || r.status) })
    continue
  }
  const ts = titles(r.text)
  const fit = ts.filter((t) => classify(t) === 'fit').length
  const unfit = ts.filter((t) => classify(t) === 'unfit').length
  rows.push({
    u,
    n: ts.length,
    pct: ts.length ? (100 * fit) / ts.length : null,
    upct: ts.length ? (100 * unfit) / ts.length : null,
    note: ts.length === 0 ? '항목 0' : '',
  })
}

rows.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1))
console.log('후보 피드 학습 적합도\n')
for (const r of rows) {
  console.log(
    [
      (r.pct === null ? '  -' : r.pct.toFixed(1)).padStart(6),
      (r.upct === null ? '  -' : r.upct.toFixed(1)).padStart(7),
      String(r.n).padStart(4),
      r.u.slice(0, 70),
      r.note,
    ].join('  '),
  )
}
console.log('\n(적합% · 부적합% · 항목수 · 주소)')
