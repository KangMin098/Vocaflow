// apps/web/tests/e2e/46-csat-lecture.spec.ts
//
// **해설 강의 — 목소리 없이도 서는가.**
//
// 소리가 걸린 검사(Gate 0 · Gate 2)는 진짜 Chrome·Edge 를 띄우는 하네스가 한다
// (`scripts/csat-lecture/` — Playwright 가 띄운 브라우저는 음성이 0개다). 이 스펙은 그 반대편,
// **목소리가 없는 기기**를 잰다. Playwright 브라우저가 바로 그런 기기라 여기서 재기에 맞다.
//
// 지키는 계약:
//   ① F6 — 무음 모드: 버튼이 「하이라이트만 보기」가 되고, 큐마다 추정 시간만큼 넘어가 끝까지 간다
//   ② F7 — 375px 에서 가로 밀림 없음 · 키보드만으로 재생(Space)·이동(→)
//   ③ 매 큐 켜진 블록 = 그 큐의 타깃(무대가 남긴 대조 기록으로 잰다)
//   ④ F2 — 파일럿 여섯 화면의 **서버 HTML** 에 한국어 대본이 한 줄도 없다
//   ⑤ 설명 블록을 누르면 그 블록을 설명하는 큐로 간다
//
// ⚠️ 세션은 이 스펙 전용 파일을 쓴다 — Gate 2 하네스가 같은 파일로 붙으면 토큰이 회전되어
//    서로 로그인 화면으로 튕긴다(2026-09-16 에 겪었다).

import fs from 'node:fs'
import path from 'node:path'

import { test, expect, type Page } from '@playwright/test'

const STATE_PATH = 'playwright-auth/.auth-csat-lecture.json'
const DATA = path.join('src/lib/csat/lecture-data')
const PILOT = ['M2706#31', 'M2706#32', 'M2706#34', 'M2706#36', 'M2706#37', '2026#36']

type Debug = {
  mode: string
  ended: boolean
  checks: { i: number; want: string; got: string | null }[]
  player: { getState(): { index: number; status: string } } | null
}

const debugOf = (page: Page) =>
  page.evaluate(() => {
    const d = (window as unknown as { __LECTURE__?: Debug }).__LECTURE__
    if (!d) return null
    return {
      mode: d.mode,
      ended: d.ended,
      checks: d.checks,
      index: d.player?.getState().index ?? -1,
      status: d.player?.getState().status ?? 'none',
    }
  })

function narration(itemId: string): string[] {
  const exam = itemId.split('#')[0]
  const file = JSON.parse(fs.readFileSync(path.join(DATA, `${exam}.json`), 'utf8'))
  const lec = file.lectures[itemId]
  // 한국어 해설만 센다 — 영어 조각은 화면이 원래 보여 주는 지문 낱말·인용(≤7단어)이다
  return lec.cues.flatMap((c: { segments: { lang: string; text: string }[] }) =>
    c.segments.filter((g) => g.lang === 'ko-KR' && g.text.length >= 12).map((g) => g.text),
  )
}

test.describe('해설 강의', () => {
  test.use({ storageState: STATE_PATH })

  test.beforeAll(() => {
    if (!fs.existsSync(STATE_PATH)) {
      throw new Error(`세션 파일이 없다 — npx tsx scripts/e2e-session.mts ${path.basename(STATE_PATH)}`)
    }
  })

  test('① ② ③ 목소리 없는 기기 · 375px · 키보드만으로 끝까지', async ({ page }) => {
    test.setTimeout(300_000)
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/csat/item/M2706-34?lecture-debug=1&lecture-silent=1', { waitUntil: 'domcontentloaded' })

    const bar = page.locator('[data-lecture-bar]')
    await expect(bar).toBeVisible({ timeout: 60_000 })
    await expect(bar.getByRole('button', { name: /하이라이트만 보기/ })).toBeVisible()

    const overflow = () =>
      page.evaluate(() => document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth)
    expect(await overflow(), '375px 에서 문서가 가로로 밀린다').toBeLessThanOrEqual(1)

    // 키보드만 — 포커스를 문서로 돌리고 Space
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.keyboard.press('Space')
    await expect.poll(async () => (await debugOf(page))?.status, { timeout: 30_000 }).toBe('playing')
    expect((await debugOf(page))?.mode).toBe('silent')

    // 재생 중(바가 위에 붙은 상태)에도 밀리지 않는다
    expect(await overflow(), '재생 중 375px 에서 문서가 가로로 밀린다').toBeLessThanOrEqual(1)

    // → 로 여덟 칸 — 키보드로 큐를 옮긴다
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(150)
    }
    await expect.poll(async () => (await debugOf(page))?.index, { timeout: 10_000 }).toBe(8)

    // 나머지는 흘려서 끝까지
    await expect.poll(async () => (await debugOf(page))?.ended, { timeout: 200_000, intervals: [1000] }).toBe(true)

    const d = await debugOf(page)
    const mismatches = d!.checks.filter((c) => c.got !== c.want)
    expect(mismatches, `켜진 블록이 큐의 타깃과 다르다: ${JSON.stringify(mismatches.slice(0, 3))}`).toEqual([])
    expect(d!.checks.length).toBeGreaterThanOrEqual(5)

    // 끝나면 하이라이트를 거둔다 — 화면이 옅어진 채로 남으면 해설을 못 읽는다
    expect(await page.locator('[data-lecture-state]').count()).toBe(0)

    fs.mkdirSync('playwright-report/lecture', { recursive: true })
    await page.screenshot({ path: 'playwright-report/lecture/375-silent-ended.png' })
    expect(errors, `콘솔 에러: ${errors.slice(0, 3).join(' | ')}`).toHaveLength(0)
  })

  test('④ 서버 HTML 에 대본이 없다 (파일럿 여섯)', async ({ request }) => {
    test.setTimeout(240_000)
    for (const id of PILOT) {
      const res = await request.get(`/csat/item/${id.replace('#', '-')}`)
      expect(res.status()).toBe(200)
      const html = await res.text()
      expect(html, `${id}: 재생 바가 없다`).toContain('data-lecture-bar')
      const leaked = narration(id).filter((t) => html.includes(t))
      expect(leaked, `${id}: 대본이 HTML 에 샜다 — ${leaked.length}줄`).toEqual([])
    }
  })

  test('⑤ 설명 블록을 누르면 그 블록을 설명하는 큐로 간다', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/csat/item/M2706-31?lecture-debug=1&lecture-silent=1', { waitUntil: 'domcontentloaded' })
    const bar = page.locator('[data-lecture-bar]')
    await expect(bar).toBeVisible({ timeout: 60_000 })
    await bar.getByRole('button', { name: /하이라이트만 보기/ }).click()
    await expect.poll(async () => (await debugOf(page))?.status, { timeout: 30_000 }).toBe('playing')

    // 어휘 블록의 빈 곳(제목)을 누른다 — 블록 안의 단추·링크는 제 일을 한다
    await page.locator('[data-lecture-target="analysis:vocab"] h2').click()
    await expect
      .poll(async () => page.locator('[data-lecture-state="active"]').getAttribute('data-lecture-target'), { timeout: 10_000 })
      .toBe('analysis:vocab')
  })
})
