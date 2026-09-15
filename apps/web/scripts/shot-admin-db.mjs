// apps/web/scripts/shot-admin-db.mjs
//
// /admin/db 레이아웃 실측 — 데스크톱 1280×900 과 모바일 390 에서 가로 넘침을 잰다.
//
// 왜 필요한가: 이 화면은 재설계 전에도 390px 에서 **가로로 34px 밀려** 있었다(헤더의
// shrink-0 이 자기 flex-wrap 을 무력화했다). 그건 렌더 테스트로는 안 잡힌다 —
// renderToString 에는 레이아웃이 없다.
//
// 로그인은 하지 않는다. admin RLS 세션이 없으면 데이터가 비지만 **레이아웃은 그대로**라
// 넘침 여부는 그대로 잰다. 데이터가 있는 상태의 계약은 렌더 테스트가 본다.
//
//   node scripts/shot-admin-db.mjs [baseURL]

import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdirSync } from 'node:fs'

const base = process.argv[2] ?? 'http://localhost:3000'
const OUT = 'test-results-admin-db'
mkdirSync(OUT, { recursive: true })

const VIEWPORTS = [
  { name: 'desktop-1280x900', width: 1280, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
]

const browser = await chromium.launch()
let bad = 0

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  const res = await page.goto(`${base}/admin/db`, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.waitForTimeout(500)

  const overflow = await page.evaluate(() => {
    const de = document.documentElement
    const offenders = []
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const r = el.getBoundingClientRect()
      if (r.width === 0) continue
      if (r.right > de.clientWidth + 1) {
        // 자기 안에서 가로 스크롤하는 상자(overflow-x:auto)는 넘침이 아니다 — 설계다.
        let scrollsItself = false
        for (let p = el; p && p !== document.body; p = p.parentElement) {
          const ov = getComputedStyle(p).overflowX
          if (ov === 'auto' || ov === 'scroll') {
            scrollsItself = true
            break
          }
        }
        if (!scrollsItself) {
          offenders.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || '').toString().slice(0, 70),
            right: Math.round(r.right),
          })
        }
      }
    }
    return {
      docScrollWidth: de.scrollWidth,
      clientWidth: de.clientWidth,
      offenders: offenders.slice(0, 6),
    }
  })

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  if (axe.violations.length) bad += 1
  for (const v of axe.violations) {
    console.log(`   axe ${v.id} (${v.nodes.length}) ${v.help}`)
    for (const n of v.nodes) {
      const why = (n.failureSummary ?? '').split('\n').join(' ').slice(0, 200)
      console.log(`     ${n.target.join(' ')} :: ${why}`)
    }
  }

  await page.screenshot({ path: `${OUT}/${vp.name}.png`, fullPage: true })

  const over = overflow.docScrollWidth > overflow.clientWidth + 1
  if (over || errors.length) bad += 1
  console.log(
    `${vp.name}: http ${res?.status()} · scrollWidth ${overflow.docScrollWidth} / ${overflow.clientWidth}` +
      `${over ? ' ← 가로 넘침' : ''} · 넘친 요소 ${overflow.offenders.length} · 콘솔 오류 ${errors.length} · axe 위반 ${axe.violations.length}`,
  )
  for (const o of overflow.offenders) console.log(`   <${o.tag}> right=${o.right} ${o.cls}`)
  for (const e of errors.slice(0, 5)) console.log(`   err: ${e.slice(0, 160)}`)
  await ctx.close()
}

await browser.close()
process.exit(bad ? 1 : 0)
