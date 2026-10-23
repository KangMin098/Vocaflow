// 정답 공개 UX 격리 프로토타입 브라우저 검사 — node run.mjs <playwright-core 경로> <out dir>
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
const check = (w, item, name, pass, detail) => results.push({ width: w, item, name, pass, detail })

const browser = await chromium.launch()
for (const width of [1280, 1440]) {
  // 2026-22: 단서 확인 수준 그대로 · 2026-27: 대본이 규칙보다 먼저 답을 말함 · 2016-27: 3자 판정으로 정리된 강의 · break: 결속을 깬 미검증 경로
  for (const item of ['2026-22', '2026-27', '2016-27', '2026-22&break=1']) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, ignoreHTTPSErrors: true })
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.route('https://proto.local/**', (r) => r.fulfill({ contentType: 'text/html', body: html }))
    await page.goto(`https://proto.local/?item=${item}&lecture-silent=1&lecture-debug=1`)
    await page.waitForSelector('[data-testid="choose"]')
    await page.waitForFunction(() => window.__PROTO__?.boundary != null)
    const b = await page.evaluate(() => window.__PROTO__.boundary)
    const st = () => page.evaluate(() => ({ status: window.__CTX__?.status ?? 'none', index: window.__CTX__?.index ?? -1, cues: window.__CTX__?.cues.length ?? 0 }))
    const until = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await page.waitForTimeout(100) } return false }

    // 공통: 고르기 전에는 아무것도 재생하지 않는다(강의 무대 자체가 없다)
    check(width, item, '선택 전 자동 재생 없음', (await page.locator('[data-lecture-target]').count()) === 0 && (await st()).status === 'none')
    check(width, item, '세 경로 중 원문 · 전체 강의는 늘 있다', (await page.getByTestId('path-self').count()) === 1 && (await page.getByTestId('path-full').count()) === 1)

    if (b.status !== 'VERIFIED') {
      check(width, item, '미검증 경계 → 「정답 직전까지」 경로 없음 · 이유 안내', (await page.getByTestId('path-until').count()) === 0 && /검증되지 않아/.test(await page.getByTestId('until-note').innerText()), b)
      // 원문부터: 재생 없음
      await page.getByTestId('path-self').click()
      check(width, item, '원문부터 → 강의 재생 없음', (await page.getByTestId('self').count()) === 1 && (await st()).status === 'none')
    } else {
      const note = await page.getByTestId('until-note').innerText()
      check(width, item, '검증 경계 → 「정답 직전까지」 경로 · 위험도별 단서 안내(「단서 없음」 이라 하지 않음)', (await page.getByTestId('path-until').count()) === 1 && (b.preStopRisk === 'NONE' || /단서/.test(note)) && !/단서가 없/.test(note), { b, note })
      if (b.preStopRisk === 'DECISIVE_CONFIRMED') check(width, item, '결정적 단서 확인 강의 → 원문부터 보라고 안내', /원문부터/.test(note), note)
      await page.getByTestId('path-until').click()
      await until(async () => (await st()).status === 'playing')
      const s1 = await st()
      check(width, item, '정답 직전 모드 — 받은 cue 수 = 경계', s1.cues === b.stopBefore, { s1, stopBefore: b.stopBefore })
      const scriptText = await page.getByTestId('script').innerText()
      check(width, item, '정답 직전 모드 — 대본에 정답 번호 낭독 없음', !/정답은\s*[^.]{0,12}?(일|이|삼|사|오)\s+번|이것이 답입니다/.test(scriptText))
      // 경계까지 넘긴다
      for (let k = 0; k < b.stopBefore + 2; k++) { await page.evaluate(() => window.__CTX__?.next()); await page.waitForTimeout(120) }
      const ended = await until(async () => (await page.getByTestId('boundary-prompt').count()) === 1, 20000)
      check(width, item, '경계에서 멈추고 계속/멈춤/원문 선택지를 낸다', ended && (await page.getByTestId('bp-continue').count()) === 1 && (await page.getByTestId('bp-stop').count()) === 1)
      check(width, item, '멈춘 뒤 켜진 강조 대상 없음', (await page.locator('[data-lecture-state="active"]').count()) === 0)
      check(width, item, 'ARIA 안내가 멈춤을 알린다', /멈췄어요/.test(await page.getByTestId('live').innerText()))
      await page.getByTestId('bp-continue').click()
      await until(async () => (await st()).status === 'playing')
      const s2 = await st()
      check(width, item, '계속 → 경계 cue 부터 전체 강의', s2.cues > b.stopBefore && s2.index >= b.stopBefore, s2)
    }
    check(width, item, '페이지 오류 없음', errors.length === 0, errors)
    await page.screenshot({ path: path.join(out, `proto-${item.replace('&break=1','-break')}-${width}.png`) })
    await page.close()
  }
}
await browser.close()
fs.writeFileSync(path.join(out, 'proto-results.json'), JSON.stringify({ results }, null, 1))
const failed = results.filter((r) => !r.pass)
console.log(`${results.length - failed.length}/${results.length} pass`)
for (const f of failed) console.log('FAIL', f.width, f.item, f.name, JSON.stringify(f.detail))
