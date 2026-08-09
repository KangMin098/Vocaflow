// scripts/comic/pd/render-check.cjs
//
// 모던 리더 렌더 검증 — page-html.mjs 가 만든 reader.html 을 Playwright(chromium) 로 실제 렌더해
// 페이지별 스크린샷을 남긴다. Claude Code 오퍼레이터가 스크린샷을 보고 말풍선 좌표/이미지 색감을
// 판정 → letter.spec.json 좌표를 고쳐 재검증(test→fix→verify 루프). 산출물은 모니터/타임라인에서 관측.
//
//   node scripts/comic/pd/render-check.cjs --workdir work/<slug> [--page 3]   (page=0-based figure index)
//
// CommonJS(.cjs) — @playwright/test 가 CJS 이기 때문. chromium 은 apps/web 에 설치돼 있음(e2e 용).

const path = require('path')
const fs = require('fs')
const { chromium } = require(path.resolve(__dirname, '..', '..', '..', 'apps', 'web', 'node_modules', '@playwright', 'test'))

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1] }
const WD = arg('workdir')
if (!WD) { console.error('--workdir 필요'); process.exit(2) }
const abs = path.resolve(WD)
const reader = path.join(abs, 'page-html', 'reader.html')
if (!fs.existsSync(reader)) { console.error(`reader.html 없음 — 먼저 page-html.mjs 실행: ${reader}`); process.exit(2) }
const only = arg('page', null)
const outDir = path.join(abs, 'page-html', 'renders')
fs.mkdirSync(outDir, { recursive: true })
const fileUrl = 'file:///' + reader.replace(/\\/g, '/')

;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 900, height: 1600 }, deviceScaleFactor: 1 })
  await p.goto(fileUrl, { waitUntil: 'load' })
  await p.waitForTimeout(400)
  const figs = await p.$$('figure.pg')
  console.log(`figures: ${figs.length}`)
  for (let i = 0; i < figs.length; i++) {
    if (only !== null && String(i) !== String(only)) continue
    const out = path.join(outDir, `p${String(i).padStart(2, '0')}.png`)
    await figs[i].screenshot({ path: out })
    console.log(`  ✓ p${i} → ${path.relative(abs, out)}`)
  }
  await b.close()
  console.log('done — Claude Code 가 스크린샷 판정 → letter.spec.json 좌표 수정 → 재실행(자기발전)')
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
