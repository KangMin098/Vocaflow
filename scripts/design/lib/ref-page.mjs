// scripts/design/lib/ref-page.mjs
//
// 참조 페이지를 **같은 조건**으로 여는 한 곳 (DD-62 Stage 1·2 공용).
// 추출(extract-computed)과 캡처(replica-diff)가 다른 조건으로 열면 픽셀 diff 가 조건 차이를 잰다.

import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

// playwright 는 apps/web 의 devDependency 다(pnpm 이라 루트에 호이스트되지 않는다).
export const { chromium } = require(require.resolve('@playwright/test', { paths: [path.join(ROOT, 'apps/web')] }))

export const VIEWPORTS = [
  { key: '1440', width: 1440, height: 900 },
  { key: '375', width: 375, height: 812 },
]

// 동의 배너·오버레이는 판면을 밀거나 화면을 덮는다. 버튼을 먼저 누르고, 그래도 남으면 노드를 지운다.
export async function dismissOverlays(page) {
  const names = [/^accept all/i, /^accept/i, /allow all/i, /^i agree/i, /동의/]
  for (const name of names) {
    const b = page.getByRole('button', { name }).first()
    if (await b.count().catch(() => 0)) {
      await b.click({ timeout: 2500 }).catch(() => {})
      await page.waitForTimeout(400)
      break
    }
  }
  return page.evaluate(() => {
    const killed = []
    const sel = [
      '.tines-cookie-overlay', '#onetrust-consent-sdk', '#onetrust-banner-sdk',
      '[id*="cookie" i][class*="overlay" i]', '[class*="cookie" i][class*="banner" i]',
    ]
    for (const s of sel) {
      for (const el of Array.from(document.querySelectorAll(s))) {
        killed.push(s)
        el.remove()
      }
    }
    document.documentElement.style.removeProperty('overflow')
    document.body.style.removeProperty('overflow')
    return killed
  })
}

// 지연 로드 섹션을 펼치고 모션을 멈춘 뒤 안정될 때까지 기다린다.
export async function settle(page) {
  await page.addStyleTag({
    content: `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;
      transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important}`,
  }).catch(() => {})
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 70))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(900)
}

export async function openRef(browser, url, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  })
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 })
  await dismissOverlays(page)
  await settle(page)
  return { ctx, page }
}
