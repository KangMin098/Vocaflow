// scripts/design/reader-controls-check.mjs — PC reader failure/retry regression on real rendered UI.
// Fault injection is explicit: no successful dictionary content or normal network acceptance is claimed.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { blockLearningWrites } from './lib/read-only-context.mjs'

const require = createRequire(new URL('../../apps/web/package.json', import.meta.url))
const { chromium } = require('@playwright/test')
const base = process.env.READER_BASE_URL || 'http://localhost:3000'
const out = process.env.READER_OUT || 'tmp/learner-residual/reader-regression'
const auth = process.env.READER_AUTH_STATE || 'apps/web/playwright-auth/.auth-design-capture.json'
const route = '/library/books/42f3bce4-5cae-4cda-ae40-f1da16d8ad99?preview=1'
const results = [], blocked = []
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
try {
  for (const width of process.env.READER_WIDTH ? [Number(process.env.READER_WIDTH)] : [1440, 1280]) for (const theme of process.env.READER_THEME ? [process.env.READER_THEME] : ['light', 'dark']) {
    assert.ok([1440, 1280].includes(width) && ['light', 'dark'].includes(theme))
    const row = { width, theme, ok: false, mode: 'dictionary-network-fault', normalMeaningVerified: false }
    const context = await browser.newContext({
      viewport: { width, height: 900 }, storageState: auth,
      colorScheme: theme, reducedMotion: 'reduce',
    })
    await blockLearningWrites(context, blocked)
    await context.addInitScript(value => localStorage.setItem('vocaflow-theme', value), theme)
    let requests = 0
    await context.route('**/rest/v1/rpc/lookup_word_meaning*', async intercepted => {
      requests++
      await intercepted.abort('failed')
    })
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    try {
      await page.goto(base + route, { waitUntil: 'networkidle', timeout: 120000 })
      assert.equal(new URL(page.url()).pathname, new URL(route, base).pathname)
      await page.evaluate(() => document.fonts.ready)
      const word = page.locator('[data-word="answer"]').first()
      await word.scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)
      row.stage = 'open'
      await word.click()
      const dialog = page.getByRole('dialog', { name: 'answer 뜻' })
      await dialog.getByText('뜻을 불러오지 못했어요', { exact: true }).waitFor()
      assert.equal(await dialog.getByText('사전에 없는 단어예요', { exact: true }).isVisible(), false)
      const before = requests
      assert.ok(before > 0)
      row.stage = 'retry'
      await dialog.getByRole('button', { name: '뜻 다시 불러오기', exact: true }).click()
      await page.waitForFunction(() => !document.querySelector('[role="dialog"]')?.textContent.includes('찾는 중…'))
      await dialog.getByText('뜻을 불러오지 못했어요', { exact: true }).waitFor()
      assert.ok(requests > before, 'Retry must issue another dictionary request')
      const targets = await dialog.getByRole('button').filter({ visible: true }).evaluateAll(nodes =>
        nodes.map(node => ({ label: node.getAttribute('aria-label') || node.innerText,
          width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })))
      assert.ok(targets.length === 3 && targets.every(target => target.width >= 44 && target.height >= 44))
      const box = await dialog.boundingBox()
      assert.ok(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= 900)
      await page.screenshot({ path: `${out}/word-failure@${width}-${theme}.png` })
      row.stage = 'close methods'
      await dialog.getByRole('button', { name: '닫기', exact: true }).focus()
      await page.keyboard.press('Escape')
      await dialog.waitFor({ state: 'detached' })
      await word.click()
      await dialog.getByRole('button', { name: '닫기', exact: true }).click()
      await dialog.waitFor({ state: 'detached' })
      await word.click()
      await dialog.waitFor()
      await page.locator('h1').first().click()
      await dialog.waitFor({ state: 'detached' })
      Object.assign(row, { ok: true, targets, requests })
      delete row.stage
      console.log(`PASS reader failure/retry/targets/close ${width} ${theme}`)
    } catch (error) {
      row.error = error.message.slice(0, 600)
      await page.screenshot({ path: `${out}/failed@${width}-${theme}.png` }).catch(() => {})
      console.log(`FAIL reader ${width} ${theme}: ${row.error}`)
    } finally { results.push(row); await context.close() }
  }
} finally {
  await browser.close()
  fs.writeFileSync(`${out}/report.json`, JSON.stringify({ base, route, results, blockedWrites: blocked.length }, null, 2))
}
if (results.some(row => !row.ok)) process.exitCode = 1
