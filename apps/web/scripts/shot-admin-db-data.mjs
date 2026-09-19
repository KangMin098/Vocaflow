// apps/web/scripts/shot-admin-db-data.mjs
//
// 데이터가 **있는** 상태의 /admin/db 를 눈으로 본다.
//
// admin RLS 세션이 없는 기계에서는 실제 화면이 늘 비어 있어서, 「경보 열여섯 건이 실제로
// 어떻게 보이는가」를 확인하지 못한 채 설계하게 된다. 그래서 픽스처로 그린 HTML
// (snapshot-html.test.tsx 산출)에 **앱의 진짜 CSS** 를 입혀 찍는다.
//
//   npx vitest run src/app/admin/db/__tests__/snapshot-html.test.tsx
//   node scripts/shot-admin-db-data.mjs
//
// ⚠️ 이건 렌더 계약 검증이 아니다(그건 렌더 테스트가 한다). 레이아웃과 밀도를 **보기 위한** 도구다.

import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

const base = process.argv[2] ?? 'http://localhost:3000'
const OUT = 'test-results-admin-db'

// 앱이 지금 쓰는 CSS 번들 경로를 실화면에서 그대로 가져온다 — 손으로 적으면 곧 낡는다.
const shell = await fetch(`${base}/admin/db`).then((r) => r.text())
const cssHref = /href="(\/_next\/static\/css\/[^"]+)"/.exec(shell)?.[1]
if (!cssHref) {
  console.error('앱 CSS 링크를 찾지 못했다 — dev 서버가 떠 있는지 확인할 것')
  process.exit(1)
}

const wrap = (body) =>
  `<!doctype html><html lang="ko"><head><meta charset="utf-8">` +
  `<link rel="stylesheet" href="${base}${cssHref}"></head>` +
  `<body style="margin:0;background:var(--bg2)">${body}</body></html>`

// 두 상태를 다 잰다 — 장애 때와 평상시에 접힌 위가 답하는 질문이 다르다.
const STATES = [
  { file: 'data-state.html', tag: 'incident' },
  { file: 'calm-state.html', tag: 'calm' },
]

const browser = await chromium.launch()
for (const st of STATES)
for (const vp of [
  { name: `${st.tag}-desktop-1280x900`, width: 1280, height: 900 },
  { name: `${st.tag}-mobile-390`, width: 390, height: 844 },
]) {
  const page = wrap(readFileSync(`${OUT}/${st.file}`, 'utf8'))
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
  const p = await ctx.newPage()
  await p.setContent(page, { waitUntil: 'networkidle' })
  await p.waitForTimeout(300)

  // 접힌 위(1280×900)에서 몇 건까지 보이는가 — 이 화면의 핵심 질문이다.
  const fold = await p.evaluate((h) => {
    const all = Array.from(document.querySelectorAll('tbody tr'))
    const above = all.filter((r) => r.getBoundingClientRect().top < h).length
    // 경보 표만 따로 — 이 화면이 답해야 하는 질문은 「무엇이 급한가」다.
    const alertBody = document.querySelector('table th ~ th')
      ? Array.from(document.querySelectorAll('table')).find((t) =>
          (t.querySelector('thead')?.textContent ?? '').includes('열린 지'),
        )
      : null
    const alertRows = alertBody ? Array.from(alertBody.querySelectorAll('tbody tr')) : []
    const alertsAbove = alertRows.filter((r) => r.getBoundingClientRect().top < h).length
    const de = document.documentElement
    return {
      rowsAboveFold: above,
      totalRows: all.length,
      alertsAboveFold: alertsAbove,
      alertRows: alertRows.length,
      scrollWidth: de.scrollWidth,
      clientWidth: de.clientWidth,
    }
  }, vp.height)

  await p.screenshot({ path: `${OUT}/${vp.name}.png`, fullPage: true })
  console.log(
    `${vp.name}: 접힌 위 경보 ${fold.alertsAboveFold}/${fold.alertRows} · ` +
      `모든 표 행 ${fold.rowsAboveFold}/${fold.totalRows} · scrollWidth ${fold.scrollWidth}/${fold.clientWidth}`,
  )
  await ctx.close()
}
await browser.close()
