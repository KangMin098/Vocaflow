// scripts/csat/content-review/screen-check.mjs
//
// 콘텐츠 검수 화면 확인 — 1280/1440 캡처 · 키보드 초점 · 발행 차단 문구 · T-0148 반례 자료 격리.
// 실행: node scripts/csat/content-review/screen-check.mjs <baseUrl> <outDir>
// (dev 서버는 DEV_ADMIN_BYPASS=1 로 띄운다. DB 에 쓰지 않는다.)

import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(new URL('../../../apps/web/package.json', import.meta.url))
const { chromium } = require('@playwright/test')

const [base = 'http://localhost:3417', out = 'screen-check-out'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const snapshot = require('./src/lib/csat/content-review/data/snapshot.json')
const multi = snapshot.candidates.find((c) => c.itemId === '2015#25').id

const results = []
const check = (name, ok, detail = '') => results.push({ name, ok, detail })

const browser = await chromium.launch()
for (const width of [1280, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  const ceRequests = []
  page.on('request', (r) => { if (r.url().includes('t0148-counterexamples')) ceRequests.push(r.url()) })

  await page.goto(`${base}/admin/csat/content-review?id=${multi}`, { waitUntil: 'networkidle', timeout: 180000 })
  const body = await page.locator('#admin-content').innerText()
  await page.screenshot({ path: join(out, `content-review-${width}-full.png`), fullPage: true })
  check(`${width} 실제 승인 0건 표시`, body.includes('실제 사람 내용 승인 0건'))
  check(`${width} 2015#25 공식 정답 집합`, body.includes('④ · ⑤') && body.includes('복수정답'))
  check(`${width} 발행 전 검증 차단`, /현재 판본:\s*차단/.test(body))
  check(`${width} 분석 ⑤ 공식 정답 충돌 표시`, body.includes('공식 정답과 충돌'))
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check(`${width} 가로 넘침 없음`, overflow <= 0, `overflow=${overflow}`)

  // 키보드 — Tab 으로 대기열 링크와 상태 버튼에 초점이 가고, 초점 표시가 보인다
  let focusedLink = false
  for (let i = 0; i < 40 && !focusedLink; i++) {
    await page.keyboard.press('Tab')
    focusedLink = await page.evaluate(() => document.activeElement?.closest('nav[aria-label="검수 대기열"]') != null)
  }
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle)
  check(`${width} 키보드로 대기열 도달 · 초점 표시`, focusedLink && outline !== 'none', `outline=${outline}`)

  // AI 확인자는 승인 못 한다 — 시연 원장 거부 문구
  await page.selectOption('#cr-who', 'demo-ai-checker')
  await page.fill('#cr-reason', '시연 검토 시작')
  await page.getByRole('button', { name: '→ 검토 중' }).click()
  await page.fill('#cr-reason', '시연 승인 시도')
  await page.getByRole('button', { name: '→ 내용 승인' }).click()
  const status = await page.locator('section[aria-labelledby="cr-state"] [role="status"]').innerText()
  check(`${width} AI 승인 거부`, status.includes('AI 판정은 증거로만'), status)
  await page.screenshot({ path: join(out, `content-review-${width}.png`), fullPage: false })
  await page.evaluate(() => localStorage.clear())

  await page.goto(`${base}/admin/csat/content-review/t0148`, { waitUntil: 'networkidle', timeout: 180000 })
  const t = await page.locator('#admin-content').innerText()
  check(`${width} T-0148 26 대본`, (t.match(/W\d\d/g) ?? []).length >= 26)
  check(`${width} T-0148 키 없음 배너`, t.includes('판정 키는 이 화면에 없다'))
  check(`${width} T-0148 1단계에서 반례 요청 0`, ceRequests.length === 0, `${ceRequests.length}`)
  const html = await page.content()
  check(`${width} T-0148 페이지에 반례 본문 없음`, !html.includes('COUNTEREXAMPLE') && !html.includes('HAS_COUNTEREXAMPLE'))
  const lockMsg = await (async () => {
    await page.getByRole('button', { name: '1단계 잠금' }).click()
    return page.locator('section[aria-label="진행"] [role="status"]').innerText()
  })()
  check(`${width} T-0148 미완료 잠금 거부`, /채점자|미완료/.test(lockMsg), lockMsg)
  await page.screenshot({ path: join(out, `t0148-${width}.png`), fullPage: false })

  // 서버 오류 상태 — 없는 후보 id
  await page.goto(`${base}/admin/csat/content-review?id=cr_does_not_exist`, { waitUntil: 'networkidle', timeout: 180000 })
  check(`${width} 없는 후보 id 경고`, (await page.locator('[role="alert"]').first().innerText()).includes('스냅샷에 없다'))
  await page.close()
}
await browser.close()

writeFileSync(join(out, 'results.json'), JSON.stringify(results, null, 2))
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`)
process.exit(results.every((r) => r.ok) ? 0 : 1)
