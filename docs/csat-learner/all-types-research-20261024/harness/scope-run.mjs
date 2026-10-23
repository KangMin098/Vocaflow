// LectureStage 공개 범위 전환 검사(격리) — node scope-run.mjs <playwright-core 경로> <out dir>
// 같은 bundle.js(build.mjs) 를 쓴다. 실계정 · 실제 해설 화면 검증이 아니다.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const [pwPath, out] = process.argv.slice(2)
const { chromium } = createRequire(import.meta.url)(pwPath)
const here = path.dirname(fileURLToPath(import.meta.url))
const bundle = fs.readFileSync(path.join(here, 'bundle.js'), 'utf8')
const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"><div id="root"></div><script type="module">${bundle.replace(/<\/script/g, '<\\/script')}</script></body></html>`
fs.mkdirSync(out, { recursive: true })
const results = []
const check = (w, name, pass, detail) => results.push({ width: w, name, pass, detail })
const browser = await chromium.launch()
for (const width of [1280, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.route('http://harness.local/**', (r) => r.fulfill({ contentType: 'text/html', body: html }))
  await page.goto('http://harness.local/?lecture-silent=1&lecture-debug=1')
  await page.waitForSelector('#play')
  const ctx = () => page.evaluate(() => { const c = window.__CTX__; return { status: c.status, index: c.index, scope: c.scope, stopBefore: c.stopBefore, cues: c.cues.length } })
  const until = async (fn, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await page.waitForTimeout(100) } return false }
  const stop = await page.evaluate(() => window.__STOP__)

  check(width, '고르기 전 요청 0', (await page.evaluate(() => window.__REQ__.length)) === 0)
  await page.evaluate(() => window.__CTX__.start(0, 'start', 'until'))
  await until(async () => (await ctx()).status === 'playing')
  const a = await ctx()
  check(width, 'until — scope=until 로 받고 cue 수 = 경계', a.scope === 'until' && a.cues === stop && a.stopBefore === stop, { a, stop })
  check(width, 'until 요청에 scope=until', (await page.evaluate(() => window.__REQ__.at(-1))).includes('scope=until'))
  for (let k = 0; k < stop + 1; k++) { await page.evaluate(() => window.__CTX__.next()); await page.waitForTimeout(120) }
  // 마지막 cue 에서 next() 는 멈추지 않는다 — 그 cue 가 다 흘러야 ended(무음 추정 초를 기다린다)
  const ended = await until(async () => (await ctx()).status === 'ended', 40000)
  check(width, 'until — 경계 앞 마지막 cue 뒤 ended(경계 뒤로 넘어가지 않음)', ended && (await ctx()).cues === stop, await ctx())
  await page.evaluate((s) => window.__CTX__.start(s, 'start', 'full'), stop)
  await until(async () => (await ctx()).scope === 'full' && (await ctx()).status === 'playing')
  const b = await ctx()
  check(width, '계속 — full 로 다시 받아 경계 cue 부터', b.scope === 'full' && b.cues > stop && b.index >= stop, b)
  check(width, '범위 전환마다 새로 받는다(요청 2회)', (await page.evaluate(() => window.__REQ__.length)) === 2)
  check(width, '페이지 오류 없음', errors.length === 0, errors)
  await page.close()
}
await browser.close()
fs.writeFileSync(path.join(out, 'scope-results.json'), JSON.stringify({ results }, null, 1))
const failed = results.filter((r) => !r.pass)
console.log(`${results.length - failed.length}/${results.length} pass`)
for (const f of failed) console.log('FAIL', f.width, f.name, JSON.stringify(f.detail))
