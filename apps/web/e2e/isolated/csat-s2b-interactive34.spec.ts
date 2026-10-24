// apps/web/e2e/isolated/csat-s2b-interactive34.spec.ts
// 실제 제품 패널·실제 CSS를 쓰는 읽기 전용 격리 검증. DB/인증/PDF/강의 종단은 범위 밖.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { expect, test } from '@playwright/test'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import { lookupInquiry } from '../../src/lib/csat/inquiry/data'
import type { HarnessEsbuildApi } from '../../scripts/harness-esbuild-types'

const ROOT = path.resolve(__dirname, '../..')
const requireFromWeb = createRequire(path.join(ROOT, 'package.json'))
const viteRequire = createRequire(createRequire(requireFromWeb.resolve('vitest/package.json')).resolve('vite/package.json'))
const { build } = viteRequire('esbuild') as HarnessEsbuildApi
const ARTIFACTS = process.env.S2B_ARTIFACTS ?? path.resolve(ROOT, '../../../Vocaflow-AI-Control/runtime/t0145-s2b/ui')
let html: string

function imports(file: string, seen = new Set<string>()): string {
  if (seen.has(file)) return ''
  seen.add(file)
  return fs.readFileSync(file, 'utf8').replace(/^@import\s+['"]([^'"]+)['"];?\s*$/gm, (_m, spec: string) =>
    imports(spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : requireFromWeb.resolve(spec), seen))
}

test.beforeAll(async () => {
  fs.mkdirSync(ARTIFACTS, { recursive: true })
  const lookup = lookupInquiry('2026#34', 5)
  if (lookup.state !== 'ready' || lookup.record.v3?.interaction34?.state !== 'ready') throw new Error('34 서버 결속 실패')
  const result = await build({
    entryPoints: [path.join(ROOT, 'src/components/csat/theater/__tests__/s2b-browser.fixture.tsx')],
    absWorkingDir: ROOT, bundle: true, write: false, outdir: 's2b-output', format: 'iife', platform: 'browser', jsx: 'automatic', target: 'es2020',
    define: { 'process.env.NODE_ENV': '"production"' },
  })
  const cssFile = path.join(ROOT, 'src/app/globals.css')
  const css = (await postcss([tailwindcss({ config: path.join(ROOT, 'tailwind.config.ts') })]).process(imports(cssFile), { from: cssFile })).css
  const js = result.outputFiles.find((f) => f.path.endsWith('.js'))?.text
  const modulesCss = result.outputFiles.filter((f) => f.path.endsWith('.css')).map((f) => f.text).join('\n')
  if (!js || !modulesCss) throw new Error('실제 패널/CSS 번들 부재')
  html = `<!doctype html><html lang="ko" data-skin="tines"><head><meta charset="utf-8"><style>${css}\n${modulesCss}</style></head><body><div id="root"></div><script>window.__s2bV3=${JSON.stringify(lookup.record.v3).replace(/</g, '\\u003c')}</script><script>${js.replace(/<\/script/g, '<\\/script')}</script></body></html>`
})

for (const width of [1280, 1440]) test.describe(`S2-b PC ${width}`, () => {
  test.use({ viewport: { width, height: 1000 } })
  test.beforeEach(async ({ page }) => {
    await page.route('https://s2b.test/**', (route) => route.fulfill({ contentType: 'text/html', body: html }))
    await page.goto('https://s2b.test/34')
  })
  test('AT03·04·07·09: 범위·조건·명제·관계를 키보드로 비교하고 강제 평가가 없다', async ({ page }) => {
    const ifButton = page.getByRole('button', { name: 'If', exact: true })
    await ifButton.focus(); await page.keyboard.press('Enter')
    await expect(page.getByTestId('s2b-scope')).toContainText('모든 법에 대한 주장이 아님')
    expect(await ifButton.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none')
    const ideally = page.getByRole('button', { name: 'Ideally', exact: true })
    await ideally.focus(); await page.keyboard.press('Space')
    await expect(page.getByTestId('s2b-scope')).toContainText('현실의 모든 법이 그렇다는 주장이 아니다')
    await page.getByRole('button', { name: 'cannot be', exact: true }).click()
    await expect(page.getByTestId('s2b-scope')).toContainText('표현 전체')
    await expect(page.getByTestId('s2b-proposition')).toHaveCount(2)
    const condition = page.getByRole('button', { name: '조건 2', exact: true })
    await condition.focus(); await page.keyboard.press('Enter')
    await expect(page.getByTestId('s2b-relation')).toContainText('they would not rationally choose')
    await expect(page.getByTestId('s2b-condition')).toContainText('If 조건')
    await page.getByRole('button', { name: '선택한 관계로 돌아가기' }).click()
    await expect(condition).toBeFocused()
    const left = page.getByRole('region', { name: '왼쪽 비교 명제' })
    await left.getByRole('button', { name: '②', exact: true }).click()
    await expect(left).toContainText('원문만으로 확정 불가')
    await expect(left).toContainText('발문 요구를 충족하지 못함')
    const relation = left.getByRole('button', { name: 'then the law cannot be', exact: true })
    await relation.focus(); await page.keyboard.press('Enter')
    await expect(page.getByTestId('s2b-relation')).toContainText('등록 선지')
    await page.getByRole('button', { name: '선택한 관계로 돌아가기' }).click()
    await expect(relation).toBeFocused()
    await expect(page.locator('textarea,input[type="text"],button[type="submit"]')).toHaveCount(0)
    expect(await page.evaluate(() => window.__s2bEvidence)).toEqual([])
    await page.screenshot({ path: path.join(ARTIFACTS, `compare-${width}.png`), fullPage: true })
  })
  test('AT13·14·21: 실제 조작 영역·비색상 상태·자료 부재 보존', async ({ page }) => {
    for (const button of await page.locator('button:visible').all()) {
      const box = await button.boundingBox()
      expect(box?.height).toBeGreaterThanOrEqual(44)
      expect(box?.width).toBeGreaterThanOrEqual(44)
    }
    expect(await page.getByTestId('s2b-compare').evaluate((el) => getComputedStyle(el).wordBreak)).toBe('keep-all')
    expect(await page.locator('main').evaluate((el) => getComputedStyle(el).getPropertyValue('--csat-canvas').trim())).toBe('#faf9f7')
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    await expect(page.getByTestId('s2b-source-binding')).toContainText('외부')
    await expect(page.getByTestId('s2b-compare')).toContainText('전이 완료나 숙달을 판정하지 않아요')
    await page.screenshot({ path: path.join(ARTIFACTS, `initial-${width}.png`), fullPage: true })
    for (const state of ['NO_DATA', 'STALE', 'HELD_CONTENT_APPROVAL', 'VERIFICATION_FAILED', 'NO_PERMISSION', 'UNREGISTERED']) {
      await page.goto(`https://s2b.test/34#${state}`)
      await page.reload()
      await expect(page.locator(`[data-resource-state="${state}"]`)).toBeVisible()
      await expect(page.getByTestId('s2b-compare')).toHaveCount(0)
    }
  })
  test('AT15·22: 공개 전 차단과 결속된 본문 근거 왕복은 기록을 만들지 않는다', async ({ page }) => {
    await page.goto('https://s2b.test/34#CLOSED')
    await page.reload()
    await expect(page.getByTestId('s2b-compare')).toHaveCount(0)
    await expect(page.getByTestId('s2b-undisclosed')).toHaveCount(2)
    await expect(page.locator('body')).not.toContainText('공식 정답')
    await page.goto('https://s2b.test/34#BOUND')
    await page.reload()
    const requests: string[] = []
    page.on('request', (request) => requests.push(request.url()))
    const left = page.getByRole('region', { name: '왼쪽 비교 명제' })
    const relation = left.getByRole('button', { name: 'then the law cannot be', exact: true })
    await relation.focus(); await page.keyboard.press('Enter')
    await expect(page.getByRole('region', { name: '본문 근거 연결' })).toContainText('등록 근거')
    await page.getByRole('button', { name: '이 관계의 본문 근거 보기' }).click()
    expect(await page.evaluate(() => window.__s2bEvidence)).toEqual([{ sentences: [7], key: 'then the law cannot be' }])
    await page.getByRole('button', { name: '선택한 관계로 돌아가기' }).click()
    await expect(relation).toBeFocused()
    expect(requests).toEqual([])
    expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 })
    await page.screenshot({ path: path.join(ARTIFACTS, `bound-${width}.png`), fullPage: true })
  })
})
