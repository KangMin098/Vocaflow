// 검증 계정 로그인 1회 → storageState 저장. 사용: node login.mjs <outStatePath>
// 계정은 저장소 픽스처(tests/e2e/fixtures/test-user.ts)를 그대로 쓴다 — 값을 출력하지 않는다.
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
const require = createRequire('D:/workspace/Vocaflow/apps/web/package.json')
const { chromium } = require('@playwright/test')
const { TEST_USER } = await import(pathToFileURL('D:/workspace/Vocaflow/apps/web/tests/e2e/fixtures/test-user.ts').href)
const out = process.argv[2]
const browser = await chromium.launch()
const ctx = await browser.newContext()
const page = await ctx.newPage()
let ok = false
for (const wait of [0, 5000, 15000]) {
  if (wait) await page.waitForTimeout(wait)
  try {
    await page.goto('http://localhost:3000/login', { timeout: 120000 })
    await page.fill('input[type="email"]', TEST_USER.email)
    await page.fill('input[type="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(hub|wordvault|workspace|main|diagnostic|onboarding|plan)/, { timeout: 30000 })
    ok = true
    break
  } catch (e) { console.log('retry:', String(e.message).split('\n')[0]) }
}
if (ok) { await ctx.storageState({ path: out }); console.log('saved; landed on', new URL(page.url()).pathname) }
await browser.close()
process.exit(ok ? 0 : 1)
