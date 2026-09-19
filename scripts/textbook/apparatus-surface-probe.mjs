// scripts/textbook/apparatus-surface-probe.mjs
//
// **학습자 화면이 교재의 구성요소를 몇 축이나 실제로 내보이는가.**
//
// ── 왜 이 자인가 (2026-09-06) ───────────────────────────────────────
// 시중 기준선은 `scripts/textbook-corpus/apparatus-probe.mjs` 가 코퍼스에서 쟀다
// (20종 · 중앙값 5축 · 최다 8축). 이 자는 **같은 14축을 우리 화면에서** 센다.
//
// ⚠️ 우리 쪽은 **정규식으로 세지 않는다.** 화면에 "목차" 라는 낱말이 도움말에 한 번
//   나오면 목차가 생겨 버린다. 대신 구성요소를 실제로 렌더하는 자리가
//   `data-apparatus="<key>"` 를 **선언**하게 하고 그것만 센다 —
//   붙이려면 그 자리에 내용이 있어야 하므로 선언은 거짓말하기 어렵다.
//
// 열쇠 정본은 `@vocaflow/library-pipeline` 의 `APPARATUS_KEYS` 다. 여기서 목록을 다시
// 적지 않는다 — 두 곳에 적으면 한쪽만 늘어난다.
//
// 재실행 안전: HTTP GET 만 한다. 저장소 파일을 쓰지 않는다(--out 을 준 경우만 쓴다).
//
// 실행:
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/apparatus-surface-probe.mjs
//   ... --step 4 --base http://localhost:3000 --json

import fs from 'node:fs'

import {
  APPARATUS_BY_KEY,
  APPARATUS_KEYS,
  MARKET_APPARATUS_COUNT,
  MARKET_APPARATUS_MEASURED_AT,
  apparatusIndex,
  apparatusTarget,
} from '@vocaflow/library-pipeline'

const argOf = (flag, fallback = null) => {
  const i = process.argv.indexOf(flag)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const BASE = argOf('--base', 'http://localhost:3000')
const STEP = Number(argOf('--step', '4'))
const OUT = argOf('--out')
const AS_JSON = process.argv.includes('--json')

/**
 * 잴 화면.
 *
 * 상세면이 본체다. 매대는 표지·난이도 두 축만 걸리는 것이 정상이라(고르는 자리이지
 * 펼치는 자리가 아니다) **분모에 넣지 않고 참고로만** 낸다.
 */
const SURFACES = [
  { id: 'detail', label: `교재 상세면 /library/textbooks/${STEP}`, url: `${BASE}/library/textbooks/${STEP}`, counts: true },
  { id: 'shelf', label: '교재 서가 /library/textbooks', url: `${BASE}/library/textbooks`, counts: false },
]

/** `data-apparatus="key"` 를 전부 뽑는다. 따옴표 두 종류를 다 받는다. */
function declaredKeys(html) {
  const found = new Set()
  const re = /data-apparatus\s*=\s*["']([a-z-]+)["']/g
  let m
  while ((m = re.exec(html))) found.add(m[1])
  return found
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'vocaflow-apparatus-probe' } })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return res.text()
}

async function main() {
  const results = []
  for (const s of SURFACES) {
    try {
      const html = await fetchText(s.url)
      const keys = declaredKeys(html)
      // 정본에 없는 열쇠는 **조용히 세지 않는다** — 오타가 점수를 올리면 자가 무너진다.
      const known = [...keys].filter((k) => APPARATUS_KEYS.includes(k))
      const unknown = [...keys].filter((k) => !APPARATUS_KEYS.includes(k))
      results.push({ ...s, ok: true, bytes: html.length, keys: known.sort(), unknown })
    } catch (e) {
      results.push({ ...s, ok: false, error: String(e.message ?? e) })
    }
  }

  const counted = results.find((r) => r.counts && r.ok)
  const ours = counted ? counted.keys.length : 0
  const index = apparatusIndex(ours)
  const target = apparatusTarget()

  const out = {
    measuredAt: new Date().toISOString(),
    base: BASE,
    step: STEP,
    market: { ...MARKET_APPARATUS_COUNT, measuredAt: MARKET_APPARATUS_MEASURED_AT },
    ours,
    total: APPARATUS_KEYS.length,
    index: Number(index.toFixed(3)),
    target,
    pass: ours >= target,
    missing: APPARATUS_KEYS.filter((k) => !(counted?.keys ?? []).includes(k)),
    surfaces: results,
  }

  if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  if (AS_JSON) {
    process.stdout.write(JSON.stringify(out, null, 2))
    return
  }

  console.log('\n교재 구성요소 — 학습자 화면 실측\n')
  for (const r of results) {
    if (!r.ok) {
      console.log(`  ✗ ${r.label} — ${r.error}`)
      continue
    }
    console.log(`  ${r.counts ? '▸' : '·'} ${r.label}`)
    console.log(
      `      선언 ${r.keys.length}축${r.keys.length ? ` — ${r.keys.map((k) => APPARATUS_BY_KEY[k].label).join(' · ')}` : ''}`,
    )
    if (r.unknown.length) console.log(`      ⚠ 정본에 없는 열쇠 ${r.unknown.join(', ')} — 세지 않았다`)
  }

  console.log(`\n  시중 (${MARKET_APPARATUS_MEASURED_AT} · ${MARKET_APPARATUS_COUNT.series}종) 중앙값 ${MARKET_APPARATUS_COUNT.median}축 · 최다 ${MARKET_APPARATUS_COUNT.max}축`)
  console.log(`  우리 상세면 ${ours}축 → 지수 ${index.toFixed(3)} (최다 대비)`)
  console.log(`  목표 1.200 → ${target}축 필요 · ${out.pass ? '통과 ✅' : `부족 ${target - ours}축`}`)
  if (out.missing.length) {
    console.log(`\n  아직 없는 축 (${out.missing.length})`)
    for (const k of out.missing) {
      const a = APPARATUS_BY_KEY[k]
      const rate = a.marketRate === null ? '못 잼' : `${Math.round(a.marketRate * 100)}%`
      console.log(`    ${a.label.padEnd(20, ' ')} 시중 ${rate.padStart(5)} — ${a.says}`)
    }
  }
  console.log()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
