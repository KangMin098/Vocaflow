// 격리 하네스 브라우저 검사 — node run.mjs <playwright-core 경로> <out dir>
// 실계정 · 제품 라우트가 아니라 LectureStage 단독. 결과는 out/harness-results.json · 스크린샷.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const [pwPath, out] = process.argv.slice(2)
const require = createRequire(import.meta.url)
const { chromium } = require(pwPath)
const here = path.dirname(fileURLToPath(import.meta.url))
const bundle = fs.readFileSync(path.join(here, 'bundle.js'), 'utf8')
const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"><div id="root"></div><script type="module">${bundle.replace(/<\/script/g, '<\\/script')}</script></body></html>`
fs.mkdirSync(out, { recursive: true })

const results = []
const check = (width, name, pass, detail) => results.push({ width, name, pass, detail })

const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] })
for (const width of [1280, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.route('http://harness.local/**', (r) => r.fulfill({ contentType: 'text/html', body: html }))
  await page.goto('http://harness.local/?lecture-silent=1&lecture-debug=1')
  await page.waitForSelector('#play')

  const ctx = () => page.evaluate(() => { const c = window.__CTX__; return { status: c.status, index: c.index, following: c.following } })
  const y = () => page.evaluate(() => Math.round(window.scrollY))
  const until = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await page.waitForTimeout(100) } return false }
  const next = () => page.evaluate(() => window.__CTX__.next())
  const settle = () => page.waitForTimeout(900)

  // 학습자 선택 — 강의 전에 고른 근거
  await page.click('#pick')
  await page.click('#play')
  check(width, '재생 시작 = 따라가기 켜짐', await until(async () => (await ctx()).status === 'playing' && (await ctx()).following), await ctx())
  await next(); await next(); await settle()
  const y1 = await y()
  check(width, '따라가기 중에는 설명 위치로 스크롤', y1 > 0, { scrollY: y1 })

  // 휠
  await page.mouse.move(width / 2, 500)
  await page.mouse.wheel(0, 250)
  await settle()
  check(width, '휠 → 따라가기 꺼짐', (await ctx()).following === false, await ctx())
  const y2 = await y()
  const openBefore = await page.evaluate(() => [...document.querySelectorAll('details')].filter((d) => d.open).length)
  // 접힌 층 안 대상을 실제로 지나가야 이 검사가 뜻이 있다 — 지나간 큐 대상이 접힌 층 안이었는지 센다
  const inClosedLayer = () => page.evaluate(() => { const c = window.__CTX__; const k = c.cues[c.index]?.key; const el = k && document.querySelector(`[data-lecture-target="${CSS.escape(k)}"]`); return Boolean(el && el.closest('details')) })
  let visitedClosed = 0
  for (let k = 0; k < 4; k++) { await next(); await page.waitForTimeout(150); if (await inClosedLayer()) visitedClosed++ }
  await settle()
  check(width, '꺼진 뒤 큐 4개 진행에도 스크롤 유지', (await y()) === y2, { before: y2, after: await y() })
  const openAfter = await page.evaluate(() => [...document.querySelectorAll('details')].filter((d) => d.open).length)
  check(width, '꺼진 뒤 접힌 층 안 대상을 지나가도 강의가 열지 않음', visitedClosed > 0 && openAfter === openBefore, { visitedClosed, openBefore, openAfter })
  check(width, '학습자 선택(aria-pressed) 유지', (await page.getAttribute('#pick', 'aria-pressed')) === 'true')

  // 지금 설명 위치로
  await page.evaluate(() => window.__CTX__.follow())
  await settle()
  check(width, 'follow() → 따라가기 켜짐 · 설명 위치로 이동', (await ctx()).following === true && (await y()) !== y2, { y: await y(), following: (await ctx()).following })

  // 학습자가 닫은 층 — 따라가기를 끈 뒤 같은 큐로 되돌아와도 다시 열지 않는다
  // 전제: 따라가기 중에 접힌 층 안 대상으로 가서 그 층이 열린 상태(강의가 연 것 — 따라가기 중이라 허용)
  for (let k = 0; k < 6 && !(await inClosedLayer()); k++) { await next(); await page.waitForTimeout(250) }
  await settle()
  const opened = await page.evaluate(() => { const c = window.__CTX__; const k = c.cues[c.index]?.key; const el = k && document.querySelector(`[data-lecture-target="${CSS.escape(k)}"]`); const d = el && el.closest('details'); return d && d.open ? [...document.querySelectorAll('details')].indexOf(d) : -1 })
  if (opened >= 0) {
    await page.mouse.wheel(0, 120)
    await settle()
    await page.evaluate((i) => { document.querySelectorAll('details')[i].open = false }, opened)
    await page.evaluate(() => window.__CTX__.prev())
    await page.waitForTimeout(300)
    await page.evaluate(() => window.__CTX__.next())
    await settle()
    const reopened = await page.evaluate((i) => document.querySelectorAll('details')[i].open, opened)
    check(width, '학습자가 닫은 층을 강의가 다시 열지 않음(같은 큐 재방문)', reopened === false && (await ctx()).following === false, { reopened })
    await page.evaluate(() => window.__CTX__.follow())
    await settle()
  } else {
    check(width, '학습자가 닫은 층을 강의가 다시 열지 않음(같은 큐 재방문)', false, '전제 실패: follow() 가 연 층이 없음')
  }

  // Space — 아무 처리기도 가져가지 않으면 학습자 스크롤
  await page.evaluate(() => document.activeElement && document.activeElement.blur())
  await page.keyboard.press('Space')
  await settle()
  check(width, 'Space(본문) → 따라가기 꺼짐', (await ctx()).following === false, await ctx())

  // Space — 다른 처리기(재생 토글)가 가져가면 유지
  await page.evaluate(() => { window.__CTX__.follow(); window.addEventListener('keydown', (e) => { if (e.key === ' ') e.preventDefault() }, { once: true }) })
  await settle()
  await page.keyboard.press('Space')
  await settle()
  check(width, 'Space(처리기가 가져감) → 따라가기 유지', (await ctx()).following === true, await ctx())

  // Space — 단추 위는 단추의 일
  await page.focus('#play')
  await page.evaluate(() => window.__CTX__.follow())
  await page.keyboard.press('Space')
  await settle()
  check(width, 'Space(단추 위) → 따라가기 유지', (await ctx()).following === true, await ctx())
  // 단추 Space 가 재생을 다시 시작했으므로 재생 상태로 맞춘다
  await until(async () => (await ctx()).status === 'playing')

  // Tab
  await page.evaluate(() => window.__CTX__.follow())
  await page.keyboard.press('Tab')
  await settle()
  check(width, 'Tab → 따라가기 꺼짐', (await ctx()).following === false, await ctx())
  const focused = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName)
  await next(); await next(); await settle()
  const focusedAfter = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName)
  check(width, '큐 진행이 포커스를 옮기지 않음', focused === focusedAfter, { focused, focusedAfter })

  check(width, '스크롤바가 실제로 보임(검사 전제)', await page.evaluate(() => window.innerWidth - document.documentElement.clientWidth > 0), await page.evaluate(() => window.innerWidth - document.documentElement.clientWidth))
  // 스크롤바 끌기
  await page.evaluate(() => window.__CTX__.follow())
  await settle()
  await page.mouse.move(width - 4, 450)
  await page.mouse.down()
  await page.mouse.move(width - 4, 520)
  await page.mouse.up()
  await settle()
  check(width, '스크롤바 끌기 → 따라가기 꺼짐', (await ctx()).following === false, await ctx())

  check(width, '페이지 오류 없음', errors.length === 0, errors)
  await page.screenshot({ path: path.join(out, `harness-${width}.png`) })
  await page.close()
}
await browser.close()
fs.writeFileSync(path.join(out, 'harness-results.json'), JSON.stringify({ harness: 'LectureStage isolated (2026#34 committed lecture data, silent adapter)', results }, null, 1))
const failed = results.filter((r) => !r.pass)
console.log(`${results.length - failed.length}/${results.length} pass`)
for (const f of failed) console.log('FAIL', f.width, f.name, JSON.stringify(f.detail))
