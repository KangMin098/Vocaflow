// apps/web/tests/e2e/47-csat-session.spec.ts
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const state = 'playwright-auth/.auth-csat-learner.json'
const directory = 'C:/Users/Administrator/Documents/영어/수능영어기출/수능기출'
function pdf(year: string) {
  const candidates = fs.readdirSync(directory).filter(f => f.includes(year) && f.includes('영어') && f.endsWith('.pdf') && !f.includes('정답'))
  if (!candidates.length) throw new Error(`${year} 영어 문제지 없음`)
  return path.join(directory, candidates[0])
}
async function readyPaper(page: Page, year: string) {
  const input = page.getByTestId('paper-input')
  await expect(input.or(page.getByTestId('item-screen'))).toBeVisible({ timeout: 90000 })
  if (await input.count()) await input.setInputFiles(pdf(year))
  await expect(page.getByTestId('item-screen')).toBeVisible({ timeout: 90000 })
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
}
async function theme(page: Page, value: 'light' | 'dark') {
  await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), value)
  // Audit settled colors rather than a sampled frame of the shared theme transition.
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter(a => a instanceof CSSTransition && a.playState === 'running').length)).toBe(0)
}
async function activate(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).focus()
  await page.keyboard.press('Enter')
}

test.use({ storageState: state })
for (const width of [1280, 1440, 1728]) test(`Learning Home 실제 패턴과 추천 ${width}px`, async ({ page }, info) => {
  test.setTimeout(120000)
  await page.setViewportSize({ width, height: 900 })
  const response = await page.goto('/csat')
  expect((await response!.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')).toContain('두 문항을 잇는 출제 공식')
  await expect(page.getByTestId('recommendation-reason')).toContainText('첫 분석')
  const proof = page.getByTestId('pattern-proof')
  const before = await page.getByTestId('shared-rule').innerText()
  await proof.getByRole('button').nth(1).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('shared-rule')).not.toHaveText(before)
  await expect(proof.getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('살펴볼 원리').selectOption('seen')
  await expect(page.getByText('아직 살펴본 문항이 없어요.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: '전체 문항 보기' }).click()
  await noOverflow(page)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: info.outputPath('learning-home.png'), fullPage: true })
  await page.screenshot({ path: info.outputPath('first-view.png') })
  if (width === 1440) expect((await page.getByTestId('start').boundingBox())!.y).toBeLessThan(800)
  await theme(page, 'dark')
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([])
  await page.screenshot({ path: info.outputPath('learning-home-dark.png'), fullPage: true })
})
for (const width of [1280, 1440, 1728]) test(`통합 분석 탐색과 듣기 ${width}px`, async ({ page }, info) => {
  test.setTimeout(180000)
  await page.setViewportSize({ width, height: 900 })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  // Deterministic browser voice boundary; the real LecturePlayer and adapter still run.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class { constructor(public text: string) {} } })
    const voice = { name: 'Test Korean', lang: 'ko-KR', localService: true, default: true, voiceURI: 'test' }
    let spoken = 0; let cancelled = 0; let current: SpeechSynthesisUtterance | null = null
    Object.defineProperty(window.speechSynthesis, 'getVoices', { value: () => [voice] })
    Object.defineProperty(window.speechSynthesis, 'speak', { value: (u: SpeechSynthesisUtterance) => { current = u; spoken++; u.onstart?.(new Event('start') as SpeechSynthesisEvent) } })
    Object.defineProperty(window.speechSynthesis, 'cancel', { value: () => { cancelled++; const u = current; current = null; u?.onerror?.({ error: 'canceled' } as SpeechSynthesisErrorEvent) } })
    Object.defineProperty(window, '__speechCounts', { get: () => ({ spoken, cancelled }) })
    Object.defineProperty(window, '__finishSpeech', { value: () => { const u = current; current = null; u?.onend?.(new Event('end') as SpeechSynthesisEvent) } })
  })
  await page.goto('/csat')
  await expect(page.getByRole('heading', { name: '궁금한 문항부터' })).toBeVisible({ timeout: 90000 })
  await noOverflow(page)
  await page.screenshot({ path: info.outputPath('integrated-hub.png'), fullPage: true })
  await page.goto('/csat/dissect?set=2026-32,2026-34,2025-31')
  await readyPaper(page, '2026')
  await activate(page, '출제자의 수 예측하기')
  await page.locator('[data-sentence] button').first().click()
  await activate(page, '이 문장')
  await page.getByRole('link', { name: '학습 허브', exact: true }).click()
  await page.getByRole('link', { name: /하던 학습 이어가기/ }).click()
  await expect(page.getByTestId('item-screen')).toHaveAttribute('data-phase', 'compare1')
  await activate(page, '분석 바로 읽고 듣기')
  await expect(page.getByTestId('analysis-reading')).toBeVisible()
  await page.getByRole('button', { name: '근거에서 정답으로부터 듣기' }).click()
  await expect(page.locator('[data-analysis="evidence"]')).toHaveAttribute('data-current', 'true')
  await expect(page.getByTestId('question-architecture')).toHaveAttribute('data-focus', 'evidence')
  await expect(page.locator('[data-testid=visual-source-sentence][aria-pressed=true]').first()).toBeVisible()
  await expect.poll(async () => page.evaluate(() => (window as unknown as { __speechCounts: { spoken: number } }).__speechCounts.spoken)).toBeGreaterThan(0)
  await page.getByRole('button', { name: '일시정지', exact: true }).click()
  await expect(page.getByRole('button', { name: '이어서 듣기', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '이어서 듣기', exact: true }).click()
  await page.getByRole('button', { name: '현재 설명 위치' }).click()
  await page.screenshot({ path: info.outputPath('integrated-analysis.png'), fullPage: true })
  await expect.poll(async () => {
    await page.evaluate(() => (window as unknown as { __finishSpeech: () => void }).__finishSpeech())
    return page.getByTestId('question-architecture').getAttribute('data-focus')
  }, { intervals: [100], timeout: 10000 }).toBe('distractor')
  await expect(page.locator('[data-testid=visual-source-sentence][data-reject=true][aria-pressed=true]').first()).toBeVisible()
  await page.getByRole('button', { name: '오답 변형', exact: true }).click()
  await expect(page.getByRole('button', { name: '분석 듣기', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '그 관계를 비튼 오답부터 듣기' }).click()
  await expect(page.getByTestId('question-architecture')).toHaveAttribute('data-focus', 'distractor')
  await expect(page.getByTestId('question-architecture')).toHaveAttribute('data-speaking', 'true')
  await expect(page.locator('[data-analysis="distractor"]')).toHaveAttribute('data-current', 'true')
  await page.getByRole('button', { name: '출제 의도', exact: true }).click()
  await page.evaluate(() => window.scrollTo(0, 0))
  const scrollBefore = await page.evaluate(() => window.scrollY)
  await page.getByRole('button', { name: '출제자가 확인하려는 읽기부터 듣기' }).evaluate(el => (el as HTMLButtonElement).click())
  await expect(page.locator('[data-analysis="intent"]')).toHaveAttribute('data-current', 'true')
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore)
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(a11y.violations.map(v => v.id)).toEqual([])
  if (width === 1440) {
    await theme(page, 'dark')
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([])
    await page.screenshot({ path: info.outputPath('analysis-dark.png'), fullPage: true })
    await theme(page, 'light')
  }
  await noOverflow(page)
  const before = await page.evaluate(() => (window as unknown as { __speechCounts: { cancelled: number } }).__speechCounts.cancelled)
  await page.getByRole('link', { name: '다음 문항', exact: true }).click()
  await expect(page.getByTestId('analysis-reading').locator('header')).toContainText('34번')
  await expect.poll(async () => page.evaluate(() => (window as unknown as { __speechCounts: { cancelled: number } }).__speechCounts.cancelled)).toBeGreaterThan(before)
  await expect(page.getByRole('button', { name: '분석 듣기', exact: true })).toBeVisible()
  if (width === 1440) {
    await page.goto('/csat/dissect?item=2026-32#analysis-evidence')
    await expect(page.locator('#analysis-evidence')).toBeInViewport()
    expect((await page.locator('#analysis-evidence h2').boundingBox())!.y).toBeGreaterThanOrEqual(56)
    await expect(page.getByRole('button', { name: '분석 듣기', exact: true })).toBeVisible()
  }
  if (width === 1280) {
    await page.getByRole('link', { name: '학습 허브', exact: true }).click()
    await page.getByRole('link', { name: /하던 학습 이어가기/ }).click()
    await expect(page.getByTestId('item-screen')).toHaveAttribute('data-phase', 'compare1')
    await expect(page.getByText('분석을 먼저 읽은 문항이에요.', { exact: false })).toBeVisible()
    await activate(page, '다음 수 예측하기')
    await page.getByRole('radio').first().check()
    await activate(page, '이 예측으로 대조하기')
    await page.getByRole('link', { name: '학습 허브', exact: true }).click()
    const predictions = await page.evaluate(() => new Promise<number>((resolve, reject) => {
      const request = indexedDB.open('vocaflow-csat', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const row = db.transaction('record').objectStore('record').get('dissection-v1')
        row.onsuccess = () => { resolve(row.result.predictions.length); db.close() }
        row.onerror = () => { reject(row.error); db.close() }
      }
    }))
    expect(predictions).toBe(1)
  }
  expect(errors).toEqual([])
})
for (const width of [1280, 1440, 1728]) test(`해부 3수·설계도·공식·전이 ${width}px`, async ({ page }, info) => {
  test.setTimeout(240000)
  await page.setViewportSize({ width, height: 900 })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/csat', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('today-card')).toBeVisible({ timeout: 90000 })
  await noOverflow(page)
  await page.screenshot({ path: info.outputPath('home.png'), fullPage: true })
  await page.goto('/csat/dissect?set=2026-32,2026-34,2025-31', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('paper-input').or(page.getByTestId('item-screen'))).toBeVisible({ timeout: 90000 })
  await readyPaper(page, '2026')
  await expect(page.getByTestId('item-screen')).toHaveAttribute('data-phase', 'scan')
  await expect(page.locator('[data-answer="true"]')).toHaveCount(1)
  await expect(page.getByTestId('evidence-note')).toHaveCount(0)
  await expect(page.getByTestId('trap-note')).toHaveCount(0)
  await expect(page.getByTestId('intent-note')).toHaveCount(0)
  expect(await page.getByTestId('passage').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(18)
  await page.screenshot({ path: info.outputPath('scan.png'), fullPage: true })
  const history: string[] = []
  for (let item = 0; item < 3; item++) {
    if (item === 2) {
      await expect(page.getByTestId('pair-comparison')).toBeVisible()
      await activate(page, '다른 지문에서 확인하기')
      await expect(page.getByTestId('paper-input').or(page.getByTestId('item-screen'))).toBeVisible({ timeout: 30000 })
      await readyPaper(page, '2025')
    }
    if (item < 2) await activate(page, '출제자의 수 예측하기')
    const sentence = page.locator('[data-sentence] button').first()
    expect((await sentence.boundingBox())!.height).toBeGreaterThanOrEqual(48)
    await sentence.focus(); await page.keyboard.press('Enter')
    await activate(page, '이 문장')
    await expect(page.getByTestId('evidence-note')).toBeVisible()
    await expect(page.getByTestId('trap-note')).toHaveCount(0)
    await expect(page.getByTestId('intent-note')).toHaveCount(0)
    if (item === 0) await page.screenshot({ path: info.outputPath('evidence.png'), fullPage: true })
    await activate(page, '다음 수 예측하기')
    await expect(page.getByRole('radio')).toHaveCount(4)
    await page.getByRole('radio').first().focus(); await page.keyboard.press('Space')
    await activate(page, '이 예측으로 대조하기')
    await expect(page.getByTestId('trap-note')).toBeVisible()
    await expect(page.getByTestId('intent-note')).toHaveCount(0)
    await activate(page, '다음 수 예측하기')
    await expect(page.getByRole('radio')).toHaveCount(3)
    await page.getByRole('radio').first().focus(); await page.keyboard.press('Space')
    await activate(page, '이 예측으로 대조하기')
    await expect(page.getByTestId('intent-note')).toBeVisible()
    history.push(await page.getByTestId('item-screen').innerText())
    await activate(page, '설계도 보기')
    await expect(page.getByTestId('blueprint').locator('dd')).toHaveCount(5)
    for (const text of await page.getByTestId('blueprint').locator('dd').allTextContents()) expect(history[item]).toContain(text)
    await noOverflow(page)
    if (item === 0) {
      await page.screenshot({ path: info.outputPath('blueprint.png'), fullPage: true })
      const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      expect(a11y.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([])
    }
    if (item < 2) {
      await activate(page, '공식 한 줄 남기기')
      if (item === 0) await page.screenshot({ path: info.outputPath('formula.png'), fullPage: true })
      await activate(page, item === 0 ? '내 공식에 넣기' : '아직 모르겠음')
    } else await activate(page, '오늘의 해부 마치기')
  }
  await expect(page.getByTestId('finish')).toContainText('/9 적중')
  await page.goto('/csat/formulas')
  await expect(page.getByTestId('formula-metrics').locator('dd')).toHaveCount(3)
  await page.screenshot({ path: info.outputPath('formulas.png'), fullPage: true })
  await noOverflow(page)
  await expect(page.locator('table,[role=tab]')).toHaveCount(0)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 })
  const started = Date.now()
  await page.goto('/csat')
  await expect(page.getByTestId('start')).toBeVisible()
  await activate(page, '시작')
  await expect(page.getByTestId('item-screen')).toBeVisible({ timeout: 10000 })
  const elapsed = Date.now() - started
  await info.attach('cached-home-to-passage-ms', { body: String(elapsed), contentType: 'text/plain' })
  expect(elapsed).toBeLessThan(10000)
  await cdp.detach()
  if (width === 1280) {
    // Simulate an older failed extraction in this isolated browser's cache.
    const year = new URL(page.url()).searchParams.get('set')!.split(',')[0].split('-')[0]
    await page.evaluate(async () => new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('vocaflow-csat')
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const db = open.result
        const tx = db.transaction('papers', 'readwrite')
        const cursor = tx.objectStore('papers').openCursor()
        cursor.onsuccess = () => {
          const row = cursor.result
          if (!row) return
          row.update({ ...row.value, items: row.value.items.map((i: { ok: boolean }) => ({ ...i, ok: false })) })
          row.continue()
        }
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onabort = () => { db.close(); reject(tx.error) }
      }
    }))
    await page.reload()
    await expect(page.getByRole('button', { name: '문제지 다시 놓기' })).toBeVisible()
    await activate(page, '문제지 다시 놓기')
    await expect(page.getByTestId('paper-input')).toHaveCount(1)
    await readyPaper(page, year)
  }
  expect(errors).toEqual([])
})

test('공유 주요 라우트와 어두운 테마 회귀', async ({ page }, info) => {
  test.setTimeout(180000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  for (const route of ['/library/books', '/wordvault/browse', '/dashboard', '/text']) {
    const response = await page.goto(route)
    expect(response?.status()).toBeLessThan(400)
    await expect(page.locator('main').first()).toBeVisible()
    expect(new URL(page.url()).pathname).not.toBe('/login')
  }
  await page.goto('/csat/formulas')
  await expect(page.getByTestId('formula-metrics')).toBeVisible()
  await theme(page, 'dark')
  await page.screenshot({ path: info.outputPath('formulas-dark.png'), fullPage: true })
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([])
  expect(errors).toEqual([])
})

test('Gate 0 채움률과 관리자 접근 경계', async ({ page }, info) => {
  test.setTimeout(120000)
  await page.goto('/admin/csat/evidence')
  if (process.env.CSAT_EXPECT_ADMIN_DENIED === '1') {
    // requireAdmin redirects to /, whose signed-in landing redirects to /hub.
    await expect(page).toHaveURL(/\/hub$/)
    await expect(page.getByTestId('dissection-readiness')).toHaveCount(0)
    return
  }
  const panel = page.getByTestId('dissection-readiness')
  await expect(panel).toBeVisible({ timeout: 90000 })
  const report = await panel.evaluate(el => ({ total: Number(el.getAttribute('data-total')), ready: Number(el.getAttribute('data-ready')), fields: Object.fromEntries([...el.querySelectorAll('[data-field]')].map(n => [n.getAttribute('data-field'), Number(n.getAttribute('data-count'))])), excluded: [...el.querySelectorAll('li')].map(n => n.textContent) }))
  fs.writeFileSync(info.outputPath('gate0-data.json'), JSON.stringify(report, null, 2))
  expect(report.total).toBeGreaterThan(0)
  expect(report.ready).toBeGreaterThanOrEqual(3)
})
