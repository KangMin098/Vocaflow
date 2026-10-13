// apps/web/tests/e2e/csat-workspace-compact.spec.ts
//
// 기출 탐구 작업공간(컴팩트 프레임) — 실제 제품 화면으로 확인한다(시안 HTML 아님).
//   ⓪ PC 1280/1440 × 메뉴 레일 접힘/펼침: 도크 65 · 요소 48 · 두 판 약 36:64 · 44px 조작 영역 · 가로 넘침 0 · axe · 원문 폭(기본 · 오래된 큰 값 · 레일 전환)
//   ① 자기 설명 저장 실패 → 입력 · 같은 기록 보존 → 다시 저장 → 새로고침 뒤 한 건(저장 결함 재현 · 수정 증거)
//   ② 2026#34: 도크 아이콘/제목 ↔ 장면 ↔ 주소 · 키보드 · 툴팁 · 장면별 근거 기억(해제 포함) · 뒤로가기 · 비교 없음 이유
//   ③ 초안 장면 왕복 보존 · 원리 노트 근거 연결/저장/짚기 · 근거 판 접기 · 강의 도구 · 직접 선택 우선
//   ④ 2026#38: 비교 한 쌍 · 상대 이동 링크가 같은 쌍 · 서가 조건을 잇는다
// 기기 저장 실패는 이 테스트 안에서만 IDBObjectStore.put 을 막아 만든다(공유 DB · 서버 상태를 바꾸지 않는다).

import fs from 'node:fs'
import path from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password:
    process.env.PLAYWRIGHT_RUNTIME_PASSWORD ??
    (() => {
      throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다 — apps/web/.env.local')
    })(),
}

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

async function login(page: Page) {
  await page.route('**/api/analytics/event', (route) => route.fulfill({ json: { ok: true } }))
  // 저장 실패 스위치 — window.__failPut = true 동안 기기 기록 쓰기가 실패한다
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if ((window as unknown as { __failPut?: boolean }).__failPut) throw new DOMException('test: put blocked', 'QuotaExceededError')
      return put.apply(this, args)
    }
  })
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', USER.email)
  await page.fill('input[type="password"]', USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60_000 })
}

test('자기 설명 — 저장 실패면 입력을 지키고 같은 기록으로 다시 저장한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  await page.goto('/csat/item/2026-34?scene=explain', { waitUntil: 'domcontentloaded' })
  const card = page.getByTestId('self-explain')
  await expect(card).toBeVisible({ timeout: 120_000 })
  const before = await page.evaluate(() => document.querySelectorAll('[data-testid="self-explain"]').length)
  expect(before).toBe(1)
  const text = `실패 재현 ${Date.now()}`
  // 하이드레이션 전 클릭은 사라질 수 있다 — 선지가 실제로 눌릴 때까지
  const pickChoice = card.locator('[role="group"] button').first()
  await expect(async () => {
    await pickChoice.click()
    await expect(pickChoice).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 })
  }).toPass({ timeout: 30_000 })
  await card.locator('textarea').first().fill(text)
  await page.evaluate(() => { (window as unknown as { __failPut?: boolean }).__failPut = true })
  await page.getByTestId('self-explain-save').click()
  // 실패했으면 쓴 글이 남고 「다시 저장」 이 열린다 — 저장된 것처럼 비우지 않는다
  await expect(card.locator('textarea').first()).toHaveValue(text, { timeout: 10_000 })
  await expect(page.getByTestId('self-explain-save')).toHaveText(/다시 저장/)
  await expect(page.getByTestId('self-explain-status')).toHaveAttribute('data-status', 'failed')
  // 다시 저장(같은 기록) → 성공 → 비워짐
  await page.evaluate(() => { (window as unknown as { __failPut?: boolean }).__failPut = false })
  await page.getByTestId('self-explain-save').click()
  await expect(page.getByTestId('self-explain-status')).toHaveAttribute('data-status', 'saved', { timeout: 10_000 })
  await expect(card.locator('textarea').first()).toHaveValue('')
  // 새로고침 뒤 그 글은 한 건만 — 재시도가 중복 기록을 만들지 않는다
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('self-explain')).toBeVisible({ timeout: 120_000 })
  const count = await page.evaluate(async (t) => {
    const db: IDBDatabase = await new Promise((ok, no) => { const r = indexedDB.open('vocaflow-csat'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error) })
    const rec = await new Promise<{ explanations?: { tempting: string }[] }>((ok) => { const g = db.transaction('record').objectStore('record').get('dissection-v1'); g.onsuccess = () => ok(g.result) })
    return (rec.explanations ?? []).filter((x) => x.tempting === t).length
  }, text)
  expect(count).toBe(1)
})

const SHOTS = path.resolve('test-results-csat-learner/workspace')
const near = (v: number | undefined, want: number, tol = 2) => v !== undefined && Math.abs(v - want) <= tol

/** 메뉴 레일을 원하는 상태로 — 하이드레이션 전 클릭이 사라지면 다시 누른다 */
async function setRail(page: Page, open: boolean) {
  const rail = page.getByTestId('csat-rail')
  await expect(async () => {
    if ((await rail.getAttribute('data-collapsed')) === (open ? 'true' : 'false')) await page.getByTestId('rail-toggle').click()
    await expect(rail).toHaveAttribute('data-collapsed', open ? 'false' : 'true', { timeout: 1500 })
  }).toPass({ timeout: 30_000 })
}

/** 하이드레이션 뒤 클릭이 실제로 반영될 때까지 */
async function press(page: Page, sel: string, done: () => Promise<void>) {
  await expect(async () => {
    await page.locator(sel).first().click()
    await done()
  }).toPass({ timeout: 30_000 })
}

for (const width of [1280, 1440]) {
  for (const railOpen of [false, true]) {
    test(`작업공간 기하 · ${width} · 레일 ${railOpen ? 220 : 64}`, async ({ page }) => {
      fs.mkdirSync(SHOTS, { recursive: true })
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.setViewportSize({ width, height: 900 })
      await login(page)
      await page.evaluate(() => { try { localStorage.removeItem('csat-paper-w') } catch {} })
      await page.goto('/csat/item/2026-34', { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('inquiry-dock')).toBeVisible({ timeout: 120_000 })
      await setRail(page, railOpen)
      await page.waitForTimeout(400)
      const m = await page.evaluate(() => {
        const r = (sel: string) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect() : null }
        const rs = (sel: string) => [...document.querySelectorAll(sel)].map((el) => el.getBoundingClientRect())
        const targets = [...document.querySelectorAll('[data-testid="inquiry-dock"] button, [data-testid="lecture-tools"] button, [data-testid="workspace-head"] button, [data-testid="workspace-actions"] :is(a,button)')]
          .map((el) => el.getBoundingClientRect()).filter((b) => b.width > 0)
        const boxes = rs('[data-testid="dock-scene"], [data-testid="dock-title"]')
        let overlap = false
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], b = boxes[j]; if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) overlap = true }
        const cut = [...document.querySelectorAll('[data-testid="dock-title"]')].filter((el) => (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 1).length
        const dock = r('[data-testid="inquiry-dock"]')
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          dock: dock?.height, dockBottom: dock?.bottom, dockRight: dock?.right,
          items: rs('[data-testid="dock-group"]').map((b) => ({ w: b.width, h: b.height, top: b.top })),
          ev: r('[data-testid="pane-evidence"]')?.width, ex: r('[data-testid="pane-explain"]')?.width,
          head: r('[data-testid="workspace-head"]')?.height, paper: r('[data-testid="workspace-paper"]')?.width,
          small: targets.filter((b) => b.width < 43.5 || b.height < 43.5).length, overlap, cut,
          vw: window.innerWidth, vh: window.innerHeight,
        }
      })
      expect(m.overflow, '가로 넘침').toBeLessThanOrEqual(0)
      expect(near(m.dock, 65), `도크 ${m.dock}`).toBe(true)
      expect(m.items).toHaveLength(4)
      for (const it of m.items) expect(near(it.h, 48), `요소 높이 ${it.h}`).toBe(true)
      expect(new Set(m.items.map((x) => Math.round(x.top))).size, '한 줄').toBe(1)
      expect(Math.max(...m.items.map((x) => x.w)) - Math.min(...m.items.map((x) => x.w)), '동일 폭').toBeLessThanOrEqual(2)
      expect(near(m.head, 44), `프레임 머리 ${m.head}`).toBe(true)
      const ratio = m.ev! / (m.ev! + m.ex!)
      expect(ratio, '근거:설명 ≈ 36:64').toBeGreaterThan(0.33)
      expect(ratio).toBeLessThan(0.39)
      expect(m.small, '44px 미만 조작 영역').toBe(0)
      expect(m.overlap, '도크 조작 영역 겹침').toBe(false)
      expect(m.cut, '잘린 도크 제목').toBe(0)
      expect(m.dockBottom!, '도크가 화면 안').toBeLessThanOrEqual(m.vh)
      expect(m.dockRight!, '도크가 화면 안').toBeLessThanOrEqual(m.vw)
      // 원문 기본 폭(저장 없음)
      if (width === 1280) { expect(m.paper!).toBeGreaterThanOrEqual(303); expect(m.paper!).toBeLessThanOrEqual(321) }
      else { expect(m.paper!).toBeGreaterThanOrEqual(343); expect(m.paper!).toBeLessThanOrEqual(361) }
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).include('[data-testid="workspace-frame"]').include('[data-testid="workspace-actions"]').include('[data-testid="lecture-tools"]').analyze()
      expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}:${v.nodes.map((n) => `${n.target.join(" ")} ${(n.failureSummary ?? "").slice(0, 160)}`).join(" | ")}`)).toEqual([])
      await page.screenshot({ path: `${SHOTS}/${width}-rail${railOpen ? 220 : 64}.png` })
      expect(errors).toEqual([])
    })
  }
}

test('원문 폭 — 오래된 큰 저장 값은 줄여 보이고, 레일을 접으면 다시 넓어진다(선호는 그대로)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await login(page)
  await page.evaluate(() => { try { localStorage.setItem('csat-paper-w', '2000'); localStorage.setItem('csat-rail', 'open') } catch {} })
  await page.goto('/csat/item/2026-34', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('inquiry-dock')).toBeVisible({ timeout: 120_000 })
  await setRail(page, true)
  await expect(page.getByTestId('paper-clamped')).toBeVisible()
  await page.waitForTimeout(800) // 레일 전환이 끝난 뒤의 폭
  const wide = async () => page.evaluate(() => ({ paper: document.querySelector('[data-testid="workspace-paper"]')!.getBoundingClientRect().width, dockRight: document.querySelector('[data-testid="inquiry-dock"]')!.getBoundingClientRect().right, vw: window.innerWidth, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }))
  const a = await wide()
  expect(a.dockRight).toBeLessThanOrEqual(a.vw)
  expect(a.overflow).toBeLessThanOrEqual(0)
  await setRail(page, false)
  await expect(async () => expect((await wide()).paper, `펼침 ${a.paper}px → 접힘`).toBeGreaterThan(a.paper + 100)).toPass({ timeout: 5000 })
  expect(await page.evaluate(() => localStorage.getItem('csat-paper-w'))).toBe('2000')
  // 키보드 End = 지금 최대(도크가 잘리지 않는 폭)
  await page.getByTestId('paper-resizer').focus()
  await page.keyboard.press('End')
  const b = await wide()
  expect(b.dockRight).toBeLessThanOrEqual(b.vw)
  expect(b.overflow).toBeLessThanOrEqual(0)
  await page.evaluate(() => { try { localStorage.removeItem('csat-paper-w') } catch {} })
})

test('2026#34 — 도크 ↔ 장면 ↔ 주소 · 키보드 · 장면별 근거 기억 · 뒤로가기', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await login(page)
  await page.goto('/csat/item/2026-34?scene=task', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('inquiry-dock')).toBeVisible({ timeout: 120_000 })
  const frame = page.getByTestId('workspace-frame')
  await expect(frame).toHaveAttribute('data-scene', 'task')
  await expect(page.getByTestId('workspace-head')).toContainText('원문 이해')
  await expect(page.getByTestId('workspace-head')).toContainText('평가 과제')
  // 아이콘 = 정확한 장면
  await press(page, '[data-testid="dock-scene"][data-scene="meaning"]', async () => expect(frame).toHaveAttribute('data-scene', 'meaning', { timeout: 1000 }))
  await expect(page).toHaveURL(/scene=meaning/)
  // 같은 이름은 머리에 한 번만
  expect(await page.getByTestId('workspace-head').locator('b').count()).toBe(0)
  // 제목 = 대표 장면(첫 진입)
  await page.locator('[data-testid="dock-group"][data-group="design"] [data-testid="dock-title"]').click()
  await expect(frame).toHaveAttribute('data-scene', 'judgment')
  await expect(page).toHaveURL(/scene=judgment/)
  await page.locator('[data-testid="dock-scene"][data-scene="design"]').click()
  await expect(frame).toHaveAttribute('data-scene', 'design')
  // 제목 = 그 요소의 마지막 장면
  await page.locator('[data-testid="dock-group"][data-group="understand"] [data-testid="dock-title"]').click()
  await expect(frame).toHaveAttribute('data-scene', 'meaning')
  await page.locator('[data-testid="dock-group"][data-group="design"] [data-testid="dock-title"]').click()
  await expect(frame).toHaveAttribute('data-scene', 'design')
  // 선택 상태 — 요소 · 아이콘 · 머리 · 판 · 주소가 같다
  await expect(page.locator('[data-testid="dock-group"][data-group="design"] [data-testid="dock-title"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-testid="dock-scene"][data-scene="design"]')).toHaveAttribute('aria-current', 'page')
  await expect(page.getByTestId('pane-explain')).toContainText('설계 재구성')
  await expect(page).toHaveURL(/scene=design/)
  // 키보드 — 제목 그룹 안에서만 ←/→ · Home/End
  await page.locator('[data-testid="dock-group"][data-group="understand"] [data-testid="dock-title"]').focus()
  await page.keyboard.press('ArrowRight')
  expect(await page.evaluate(() => document.activeElement?.textContent)).toBe('문항 설계')
  await page.keyboard.press('End')
  expect(await page.evaluate(() => document.activeElement?.textContent)).toBe('내 설명')
  await page.keyboard.press('Home')
  expect(await page.evaluate(() => document.activeElement?.textContent)).toBe('원문 이해')
  await expect(frame).toHaveAttribute('data-scene', 'design') // 포커스 이동은 선택이 아니다
  // 아이콘 이름 툴팁 — 키보드 포커스에서 보인다
  await page.keyboard.press('Tab')
  await expect(async () => {
    const op = await page.evaluate(() => getComputedStyle(document.activeElement!.querySelector('[class*="dockTip"]')!).opacity)
    expect(Number(op)).toBeGreaterThan(0.9)
  }).toPass({ timeout: 3000 })
  // 장면별 근거 기억 — 문항 성립에서 고른 근거가 돌아오면 되살아나고, 해제는 해제로 남는다
  await page.locator('[data-testid="dock-scene"][data-scene="judgment"]').click()
  await page.locator('button[data-choice="3"]').first().click()
  const ev = page.locator('[data-testid="v3-evidence"][data-key="choice-3"]')
  await ev.click()
  await expect(ev).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('map-chosen-evidence')).toBeVisible()
  await page.locator('[data-testid="dock-scene"][data-scene="design"]').click()
  await expect(page.getByTestId('map-chosen-evidence')).toHaveCount(0)
  await page.locator('[data-testid="dock-scene"][data-scene="judgment"]').click()
  await expect(page.getByTestId('map-chosen-evidence')).toBeVisible()
  await page.locator('button[data-choice="3"]').first().click()
  await expect(ev).toHaveAttribute('aria-pressed', 'true')
  await ev.click()
  await expect(ev).toHaveAttribute('aria-pressed', 'false')
  await page.locator('[data-testid="dock-scene"][data-scene="design"]').click()
  await page.locator('[data-testid="dock-scene"][data-scene="judgment"]').click()
  await expect(page.getByTestId('map-chosen-evidence')).toHaveCount(0)
  // 뒤로가기 — 주소가 장면을 정한다
  await page.goBack()
  await expect(frame).toHaveAttribute('data-scene', 'design')
  await page.goForward()
  await expect(frame).toHaveAttribute('data-scene', 'judgment')
  // 비교 없음 — 이유를 말한다(요소를 숨기거나 잠그지 않는다)
  await page.locator('[data-testid="dock-scene"][data-scene="compare"]').click()
  await expect(page.locator('[data-testid="v3-compare-absent"], [data-testid="compare-empty"], [data-testid="v3-pair-list"]').first()).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/34-compare.png` })
  expect(errors).toEqual([])
})

test('초안 왕복 · 원리 노트 근거 연결 · 근거 판 접기 · 강의 도구 · 직접 선택 우선', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  await page.goto('/csat/item/2026-34?scene=judgment', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('inquiry-dock')).toBeVisible({ timeout: 120_000 })
  // 근거 하나를 고른 뒤 내 설명으로
  await press(page, 'button[data-choice="3"]', async () => expect(page.locator('[data-testid="v3-evidence"][data-key="choice-3"]')).toBeVisible({ timeout: 1000 }))
  await page.locator('[data-testid="v3-evidence"][data-key="choice-3"]').click()
  await page.locator('[data-testid="dock-scene"][data-scene="explain"]').click()
  const statement = `원리 초안 ${Date.now()}`
  await page.getByTestId('note-statement').fill(statement)
  await page.getByTestId('note-grounds').fill('근거 초안')
  // 장면 왕복 — 초안이 남는다
  await page.locator('[data-testid="dock-scene"][data-scene="meaning"]').click()
  await page.locator('[data-testid="dock-scene"][data-scene="explain"]').click()
  await expect(page.getByTestId('note-statement')).toHaveValue(statement)
  await expect(page.getByTestId('note-grounds')).toHaveValue('근거 초안')
  // 근거 연결(선택) → 해제 → 다시 연결 → 저장 → 다시 열면 그 문장을 짚는다
  await page.getByTestId('note-evidence-link').click()
  await expect(page.getByTestId('note-evidence')).toHaveAttribute('data-linked', 'true')
  await page.getByTestId('note-evidence-unlink').click()
  await expect(page.getByTestId('note-evidence')).toHaveAttribute('data-linked', 'false')
  await page.getByTestId('note-evidence-link').click()
  await page.getByTestId('note-save').click()
  await expect(page.getByTestId('note-status')).toHaveAttribute('data-status', 'saved')
  await expect(page.getByTestId('note-statement')).toHaveValue('')
  await page.getByTestId('note-evidence-show').click()
  await expect(page.getByTestId('map-chosen-evidence')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/34-note-evidence.png` })
  // 근거 판 접기 — 근거 요약과 다시 열기 · 설명 판이 넓어진다
  const exBefore = (await page.getByTestId('pane-explain').boundingBox())!.width
  await page.getByTestId('evidence-toggle').click()
  await expect(page.getByTestId('pane-evidence')).toHaveCount(0)
  await expect(page.getByTestId('evidence-summary')).toContainText('번 문장')
  expect((await page.getByTestId('pane-explain').boundingBox())!.width).toBeGreaterThan(exBefore + 150)
  await page.getByTestId('evidence-toggle').click()
  await expect(page.getByTestId('pane-evidence')).toBeVisible()
  // 강의 도구 — 대본 · 진행 · 같은 유형은 설명 판의 보조 보기, 「탐구로 돌아가기」
  await page.getByTestId('tool-run').click()
  await expect(page.getByTestId('pane-explain')).toContainText('추정 위치')
  await page.getByTestId('tool-close').click()
  await page.getByTestId('tool-siblings').click()
  await expect(page.getByTestId('pane-explain').locator('a').first()).toBeVisible()
  await page.getByTestId('tool-siblings').click()
  await expect(page.getByTestId('scene-question')).toBeVisible()
  // 직접 선택 우선 — 재생 중 도크로 장면을 고르면 강의는 멈춘다(재개는 학습자가)
  const play = page.locator('[data-testid="lecture-tools"] button').last()
  await play.click()
  await expect(play).toContainText(/멈춤|여는 중/, { timeout: 20_000 })
  await expect(play).toContainText('멈춤', { timeout: 20_000 })
  await page.locator('[data-testid="dock-scene"][data-scene="principle"]').click()
  await expect(page.getByTestId('workspace-frame')).toHaveAttribute('data-scene', 'principle')
  await expect(play).toContainText('이어서', { timeout: 10_000 })
  await page.waitForTimeout(2500)
  await expect(page.getByTestId('workspace-frame')).toHaveAttribute('data-scene', 'principle')
})

test('2026#38 — 비교 한 쌍 · 상대 이동 링크가 같은 쌍 · 서가 조건을 잇는다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await login(page)
  const shelf = '/csat/browse?need=killer'
  await page.goto(`/csat/item/2026-38?scene=compare&ret=${encodeURIComponent(shelf)}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('v3-pair-list')).toBeVisible({ timeout: 120_000 })
  await page.getByTestId('v3-pair-option').first().focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('v3-pair')).toBeVisible()
  const other = new URL((await page.getByTestId('v3-pair-go-other').getAttribute('href'))!, 'http://x').searchParams
  expect(other.get('pair')).toBeTruthy()
  expect(other.get('back')).toBe('2026-38')
  expect(other.get('ret')).toBe(shelf)
  await expect(page.getByTestId('workspace-frame')).toHaveAttribute('data-group', 'transfer')
  await page.screenshot({ path: `${SHOTS}/38-compare.png` })
})

test('검수 회귀 — 뒤로/앞으로 근거 유지 · 해제한 근거는 노트 후보 아님 · 접힌 채 마치기도 완료 안내', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  await page.goto('/csat/item/2026-34?scene=judgment', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('inquiry-dock')).toBeVisible({ timeout: 120_000 })
  const ev = page.locator('[data-testid="v3-evidence"][data-key="choice-3"]')
  await press(page, 'button[data-choice="3"]', async () => expect(ev).toBeVisible({ timeout: 1000 }))
  await ev.click()
  await expect(page.getByTestId('map-chosen-evidence')).toBeVisible()
  // 뒤로가기로 떠나도 그 장면의 선택은 기억된다
  await page.locator('[data-testid="dock-scene"][data-scene="design"]').click()
  await page.goBack()
  await expect(page.getByTestId('workspace-frame')).toHaveAttribute('data-scene', 'judgment')
  await expect(page.getByTestId('map-chosen-evidence')).toBeVisible()
  await page.goForward()
  await page.goBack()
  await expect(page.getByTestId('map-chosen-evidence')).toBeVisible()
  // 해제하면 내 설명의 「지금 고른 근거」 후보도 사라진다
  await page.locator('button[data-choice="3"]').first().click()
  await ev.click()
  await expect(ev).toHaveAttribute('aria-pressed', 'false')
  await page.locator('[data-testid="dock-scene"][data-scene="explain"]').click()
  await expect(page.getByTestId('reasoning-note')).toBeVisible()
  await expect(page.getByTestId('note-evidence-link')).toHaveCount(0)
  // 근거 판을 접은 채 마쳐도 완료 안내가 설명 판에 보인다
  await page.getByTestId('evidence-toggle').click()
  await expect(page.getByTestId('pane-evidence')).toHaveCount(0)
  const finish = page.getByTestId('finish-item')
  if (await finish.count()) {
    await finish.click()
    await expect(page.getByTestId('session-done')).toBeVisible({ timeout: 30_000 })
  }
})
