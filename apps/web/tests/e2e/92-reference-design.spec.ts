// apps/web/tests/e2e/92-reference-design.spec.ts
// 실제 라우트·테마·기존 저장값·body 포털·클라이언트 이동에서 두 디자인을 검증한다.

import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Locator, type Page } from '@playwright/test'

const state = 'playwright-auth/.auth-reference-design.json'
const shots = path.resolve(__dirname, '../../../../docs/design/shots/reference-contract')

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync(path.dirname(state), { recursive: true })
  fs.mkdirSync(shots, { recursive: true })
  const page = await browser.newPage({ storageState: { cookies: [], origins: [] } })
  await page.goto('/login')
  await page.getByLabel(/이메일/).fill(process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev')
  const password = process.env.PLAYWRIGHT_RUNTIME_PASSWORD
  if (!password) throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD가 필요하다')
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: /^로그인/ }).click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 90000 })
  await page.context().storageState({ path: state })
  await page.close()
})

test.use({ storageState: state })

async function expectPalette(page: Page, csat: boolean, dark: boolean) {
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--p').trim()))
    .toBe(csat ? (dark ? '#fcf9f5' : '#0d0d17') : (dark ? '#aa94ff' : '#542f9c'))
  await expect(page.locator('[data-design-scope="csat"]')).toHaveCount(csat ? 1 : 0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
}

function contrast(foreground: string, background: string) {
  const luminance = (rgb: string) => {
    const channels = rgb.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number)
    if (!channels || channels.length !== 3) throw new Error(`RGB 색상이 필요하다: ${rgb}`)
    const linear = channels.map(value => {
      const channel = value / 255
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
  }
  const a = luminance(foreground)
  const b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

async function expectTextContrast(locator: Locator) {
  // 선택·호버 전환 중간 프레임이 아니라 최종 렌더 대비를 검증한다.
  await expect.poll(async () => {
    const colors = await locator.evaluate(el => {
      const style = getComputedStyle(el)
      return [style.color, style.backgroundColor]
    })
    return contrast(colors[0], colors[1])
  }, { message: `글자 대비: ${locator.toString()}` }).toBeGreaterThanOrEqual(4.5)
}

for (const width of [1440, 390]) {
  for (const dark of [false, true]) {
    test(`두 디자인과 팝업 ${width}px ${dark ? 'dark' : 'light'}`, async ({ page }) => {
      test.setTimeout(180000)
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
      await page.addInitScript(({ dark }) => {
        localStorage.setItem('vocaflow-skin', 'off')
        localStorage.setItem('vocaflow-theme', dark ? 'dark' : 'light')
      }, { dark })
      for (const route of ['/pricing', '/fit', '/hub', '/admin/csat', '/csat', '/csat/diagnosis?tab=map', '/csat/formulas', '/csat/item/M2706-31']) {
        const response = await page.goto(`${route}${route.includes('?') ? '&' : '?'}skin=off`)
        expect(response?.status(), route).toBe(200)
        expect(new URL(page.url()).pathname).toBe(route.split('?')[0])
        const csat = route.startsWith('/csat')
        await expectPalette(page, csat, dark)
        if (route.startsWith('/csat/item/')) {
          const theater = page.getByTestId('analysis-theater')
          await expect(theater).toBeVisible({ timeout: 30000 })
          const inherited = await theater.evaluate(el => {
            const local = getComputedStyle(el)
            const body = getComputedStyle(document.body)
            return ['--p', '--bg', '--bg2', '--font-body'].map(token => [local.getPropertyValue(token), body.getPropertyValue(token)])
          })
          for (const [local, body] of inherited) expect(local).toBe(body)
          const play = theater.getByRole('button', { name: /예측 후 상영|처음부터 상영|상영 시작|다시 상영/ }).first()
          if (await play.count()) await expectTextContrast(play)
        }
        if (route === '/csat') {
          await expect(page.getByTestId('continue-card')).not.toHaveAttribute('data-state', 'loading', { timeout: 30000 })
          await expect(page.getByTestId('ws-table').locator('[aria-busy="true"]')).toHaveCount(0)
          await expect(page.getByTestId('ws-new')).toHaveCSS('color', dark ? 'rgb(13, 13, 23)' : 'rgb(252, 249, 245)')
          if (width === 390) {
            const card = page.getByTestId('continue-card')
            await expect(card).toHaveCSS('position', 'relative')
            const box = await card.boundingBox()
            expect(box).not.toBeNull()
            expect(box!.x).toBeGreaterThanOrEqual(0)
            expect(box!.x + box!.width).toBeLessThanOrEqual(width)
          }
        }
        await page.evaluate(() => document.fonts.ready)
        if (route.includes('tab=map')) {
          await expect(page.locator('[data-map-cols]')).toBeVisible()
          const selected = page.locator('button[aria-pressed="true"]').first()
          await expect(selected).toHaveCSS('color', dark ? 'rgb(13, 13, 23)' : 'rgb(252, 249, 245)')
          const statusColors = await page.locator('[data-map-cols]').evaluate(el => {
            const probe = document.createElement('span')
            el.append(probe)
            const resolve = (token: string) => {
              probe.style.color = `var(${token})`
              return getComputedStyle(probe).color
            }
            const colors = ['met', 'near', 'short'].map(status => ({
              ink: resolve(`--m-${status}-ink`),
              chip: resolve(`--m-${status}-bg`),
              canvas: resolve('--m-bg'),
            }))
            probe.remove()
            return colors
          })
          for (const color of statusColors) {
            expect(contrast(color.ink, color.chip)).toBeGreaterThanOrEqual(4.5)
            expect(contrast(color.ink, color.canvas)).toBeGreaterThanOrEqual(4.5)
          }
          for (const code of ['GOAL', 'A1']) {
            await page.locator(`[data-map-node="${code}"]`).click()
            const popup = page.locator('[data-map-modal]')
            await expect(popup).toBeVisible()
            await expect(popup.getByRole('heading')).toBeVisible()
            expect((await popup.getByRole('button', { name: '팝업 닫기', exact: true }).boundingBox())?.width).toBeGreaterThanOrEqual(44)
            await expectTextContrast(popup.locator('[class*="headTile"]'))
            for (const label of ['목표', '달성', '현 상태', '근거']) {
              const tab = popup.getByRole('tab', { name: label, exact: true })
              await tab.click()
              await expect(tab).toHaveAttribute('aria-selected', 'true')
              await expectTextContrast(tab.locator('span').first())
              for (const tile of await popup.locator('[class*="rowTile"]').all()) {
                await expectTextContrast(tile)
              }
            }
            await page.screenshot({ path: path.join(shots, `map-popup-${code}-${width}-${dark ? 'dark' : 'light'}.png`) })
            await popup.getByRole('button', { name: '팝업 닫기', exact: true }).click()
            await expect(popup).not.toBeVisible()
          }
        }
        await page.screenshot({ path: path.join(shots, `${route.split('?')[0].replace(/\//g, '-') || 'home'}-${width}-${dark ? 'dark' : 'light'}.png`) })
        if (route === '/csat') {
          await page.getByTestId('ws-new').click()
          const dialog = page.getByRole('dialog')
          await expect(dialog).toBeVisible()
          expect(await dialog.evaluate(el => getComputedStyle(el).getPropertyValue('--p').trim())).toBe(dark ? '#fcf9f5' : '#0d0d17')
          // body 포털이며 레이아웃 표식의 자손이 아니어도 같은 토큰이어야 한다.
          expect(await dialog.evaluate(el => el.closest('[data-design-scope="csat"]') === null)).toBe(true)
          await page.screenshot({ path: path.join(shots, `csat-dialog-${width}-${dark ? 'dark' : 'light'}.png`) })
          await page.keyboard.press('Escape')
          await expect(dialog).not.toBeVisible()
          await page.waitForLoadState('networkidle')
        }
      }
      // 정식 모달 주소에서 선택·답안 대비까지만 확인한다. 저장하거나 기존 기록을 바꾸지 않는다.
      await page.goto('/csat/diagnosis?tab=records&modal=new')
      await expectPalette(page, true, dark)
      const record = page.getByRole('dialog')
      await expect(record).toBeVisible()
      await expect(record).toHaveAccessibleName('새 시험 기록')
      await expectTextContrast(record.getByLabel('응시일'))
      await expect(record.getByLabel('응시일')).toHaveCSS('color-scheme', dark ? 'dark' : 'light')
      await expectTextContrast(record.getByLabel('회차'))
      const next = record.getByRole('button', { name: '다음', exact: true })
      // SSR 폼의 hydration 후에도 선택이 반영되었는지 확인한다. 선택하면 모달 제목이 회차명으로 바뀐다.
      await expect(async () => {
        await record.getByLabel('회차').selectOption({ index: 1 })
        await expect(next).toBeEnabled({ timeout: 1000 })
      }).toPass({ timeout: 15000 })
      await expectTextContrast(next)
      for (const control of [record.getByLabel('응시일'), record.getByLabel('회차'), next]) {
        expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44)
      }
      await page.screenshot({ path: path.join(shots, `csat-record-${width}-${dark ? 'dark' : 'light'}.png`) })
      await next.click()
      for (const no of [1, 18, 41]) {
        const answer = record.getByRole('radio', { name: `${no}번 1`, exact: true })
        await answer.hover()
        await expectTextContrast(answer.locator('span'))
        await answer.click()
        await expectTextContrast(answer.locator('span'))
      }
      await expectTextContrast(record.getByRole('button', { name: '채점하고 저장', exact: true }))
      await page.screenshot({ path: path.join(shots, `csat-answers-${width}-${dark ? 'dark' : 'light'}.png`) })
      await record.getByRole('link', { name: '닫기', exact: true }).click()
      await expect(record).not.toBeVisible()
      // 동일 (main) 그룹의 Next Link 이동에서도 CSAT 표식이 사라져야 한다.
      await page.goto('/csat/formulas')
      await expectPalette(page, true, dark)
      await page.locator('a[href="/hub"]:visible').first().click()
      await page.waitForURL('**/hub')
      await expectPalette(page, false, dark)
    })
  }
}

test('익명 랜딩도 저장값과 URL에 관계없이 Tines', async ({ browser }) => {
  test.setTimeout(120000)
  for (const width of [1440, 390]) {
    for (const dark of [false, true]) {
      // 테마마다 새 컨텍스트: 여러 addInitScript의 실행 순서에 기대지 않는다.
      const page = await browser.newPage({ storageState: { cookies: [], origins: [] } })
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
      await page.addInitScript(({ dark }) => {
        localStorage.setItem('vocaflow-skin', 'off')
        localStorage.setItem('vocaflow-theme', dark ? 'dark' : 'light')
      }, { dark })
      await page.goto('/?skin=off')
      expect(new URL(page.url()).pathname).toBe('/')
      await expectPalette(page, false, dark)
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: path.join(shots, `home-${width}-${dark ? 'dark' : 'light'}.png`) })
      await page.close()
    }
  }
})
