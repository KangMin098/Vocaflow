// apps/web/tests/f08/f08-candidates.spec.ts
//
// F08 후보 A·B·C 에 **같은 학습 과제**를 같은 순서로 수행시키고 조작 수·화면 지표·누출·접근성 동작을 잰다.
// 자동화가 재는 것은 조작 비용과 화면 성질뿐이다 — 학습 효과나 사용성 판정이 아니다(NOT_EVALUATED).

import fs from 'node:fs'
import path from 'node:path'

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const OUT = path.join(__dirname, '../../test-results/f08')
const ANSWER_DECISIVE = '빼앗기는 선택이 없고' // 3번 선지 판정 문구 — 공개 전에 나오면 누출

type Metrics = Record<string, number | string | boolean>

function counter() {
  let clicks = 0
  return {
    async click(sel: ReturnType<Page['locator']>) { clicks++; await sel.click() },
    get clicks() { return clicks },
  }
}

async function passageMetrics(page: Page): Promise<Metrics> {
  return page.evaluate(() => {
    const main = document.querySelector('main[aria-label="원문"]') as HTMLElement
    const s7 = document.getElementById('f08-s7')!.getBoundingClientRect()
    const fontSize = parseFloat(getComputedStyle(document.getElementById('f08-s1')!).fontSize)
    const isShown = (b: Element) => { const r = (b as HTMLElement).getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight }
    // 원문 문장 버튼을 뺀, 지금 화면(뷰포트) 안에 보이는 조작 버튼 수
    const controls = [...document.querySelectorAll('[data-candidate] button')].filter((b) => !(b as HTMLElement).id.startsWith('f08-s') && isShown(b)).length
    const small = [...document.querySelectorAll('[data-candidate] button')].filter((b) => {
      const r = (b as HTMLElement).getBoundingClientRect()
      return r.width > 0 && r.height > 0 && r.height < 44 && !(b as HTMLElement).id.startsWith('f08-s')
    }).length
    return {
      passageWidth: Math.round(main.getBoundingClientRect().width),
      passageFontPx: fontSize,
      blankSentenceVisible: s7.top >= 0 && s7.bottom <= window.innerHeight,
      visibleControls: controls,
      controlsUnder44: small,
      horizontalScroll: document.documentElement.scrollWidth > window.innerWidth,
    }
  })
}

/** 과제 1~6 — 후보마다 조작 경로가 다르다. */
const TASK: Record<'a' | 'b' | 'c', (page: Page, c: ReturnType<typeof counter>) => Promise<void>> = {
  async a(page, c) {
    await c.click(page.getByRole('tab', { name: '발문 요구·조건' }))
    await c.click(page.getByRole('button', { name: '부정·조건 범위 표시' }))
    await c.click(page.getByRole('tab', { name: '선지 넣어 보기' }))
    await c.click(page.getByRole('button', { name: '1번', exact: true }))
    await c.click(page.getByRole('button', { name: '아닐 것 같다' }))
    await c.click(page.getByRole('button', { name: '3번', exact: true }))
    await c.click(page.getByRole('button', { name: '맞을 것 같다' }))
    await c.click(page.getByRole('button', { name: '3번 선지 근거 문장 고르기' }))
    await c.click(page.locator('#f08-s7'))
    await c.click(page.locator('#f08-s6'))
    await c.click(page.getByRole('button', { name: /근거 연결 중/ }))
  },
  async b(page, c) {
    await c.click(page.getByRole('button', { name: '부정·조건 범위 표시' }))
    await c.click(page.getByTestId('prop-1').getByRole('button', { name: '아닐 것 같다' }))
    await c.click(page.getByTestId('prop-3').getByRole('button', { name: '맞을 것 같다' }))
    await c.click(page.getByTestId('prop-3').getByRole('button', { name: '근거 문장 고르기' }))
    await c.click(page.locator('#f08-s7'))
    await c.click(page.locator('#f08-s6'))
    await c.click(page.getByTestId('prop-3').getByRole('button', { name: '근거 고르기 끝' }))
    await c.click(page.getByTestId('prop-1').getByRole('button', { name: '대조표에 놓기' }))
    await c.click(page.getByTestId('prop-3').getByRole('button', { name: '대조표에 놓기' }))
    await c.click(page.getByRole('group', { name: '3번 · 조건 1' }).getByRole('button', { name: '충족' }))
    await c.click(page.getByRole('group', { name: '1번 · 조건 1' }).getByRole('button', { name: '어긋남' }))
  },
  async c(page, c) {
    await c.click(page.getByRole('button', { name: '다음 큐' }))
    await c.click(page.getByRole('button', { name: '부정·조건 범위 표시' }))
    await c.click(page.getByRole('button', { name: '여기서 멈추고 판단' }))
    await c.click(page.getByRole('button', { name: '1번', exact: true }))
    await c.click(page.getByRole('button', { name: '아닐 것 같다' }))
    await c.click(page.getByRole('button', { name: '3번', exact: true }))
    await c.click(page.getByRole('button', { name: '맞을 것 같다' }))
    await c.click(page.getByRole('button', { name: '3번 근거 문장 고르기' }))
    await c.click(page.locator('#f08-s7'))
    await c.click(page.locator('#f08-s6'))
    await c.click(page.getByRole('button', { name: '근거 연결 끝내기' }))
  },
}

async function openReveal(page: Page, cand: 'a' | 'b' | 'c', c: ReturnType<typeof counter>) {
  // 도구 탭은 토글이다 — 복원된 상태로 이미 열려 있으면 다시 누르지 않는다(누르면 닫힌다)
  if (cand === 'a' && (await page.getByRole('tab', { name: '정답·해설' }).getAttribute('aria-selected')) !== 'true') await c.click(page.getByRole('tab', { name: '정답·해설' }))
  if (cand === 'c' && !(await page.getByRole('button', { name: '정답·해설 보기' }).isVisible())) await c.click(page.getByRole('tab', { name: '내 판단' }))
  await c.click(page.getByRole('button', { name: '정답·해설 보기' }))
  await c.click(page.getByRole('button', { name: '공개하기' }))
}

for (const cand of ['a', 'b', 'c'] as const) {
  test.describe(`후보 ${cand.toUpperCase()}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/dev/f08/${cand}`)
      await page.evaluate(() => sessionStorage.clear())
      await page.reload()
      await expect(page.locator('#f08-s1')).toBeVisible()
    })

    test('공개 전 정답 누출 없음 — 첫 HTML·화면', async ({ page, request }) => {
      const html = await (await request.get(`/dev/f08/${cand}`)).text()
      expect(html).not.toContain(ANSWER_DECISIVE)
      expect(html).not.toMatch(/정답은\s*삼\s*번|공식 정답 3번|"answer":3/)
      await expect(page.getByTestId('answer-line')).toHaveCount(0)
      await expect(page.locator('[data-testid^="verdict-"]')).toHaveCount(0)
    })

    test('같은 과제 수행 · 조작 수 · 화면 지표 · 캡처', async ({ page }, info) => {
      const c = counter()
      const before = await passageMetrics(page)
      await page.screenshot({ path: path.join(OUT, `${cand}-${info.project.name}-0-start.png`), fullPage: false })
      await TASK[cand](page, c)
      const judging = await passageMetrics(page)
      await page.screenshot({ path: path.join(OUT, `${cand}-${info.project.name}-1-judging.png`), fullPage: false })
      const taskClicks = c.clicks
      await openReveal(page, cand, c)
      await expect(page.getByTestId('answer-line')).toContainText('3번')
      if (cand === 'b') await expect(page.getByTestId('verdict-3')).toContainText('정답')
      // 공개 뒤 판단 수정 — 1번을 「모르겠다」로 고쳐 본다
      if (cand === 'b') await c.click(page.getByTestId('prop-1').getByRole('button', { name: '모르겠다' }))
      else {
        if (cand === 'a') await c.click(page.getByRole('tab', { name: '선지 넣어 보기' }))
        await c.click(page.getByRole('button', { name: '1번', exact: true }))
        await expect(page.getByTestId('verdict-1')).toBeVisible()
        await c.click(page.getByRole('button', { name: '모르겠다' }))
        if (cand === 'a') await c.click(page.getByRole('tab', { name: '정답·해설' }))
      }
      await expect(page.getByTestId('revision-log')).toContainText('1번')
      await expect(page.getByRole('heading', { name: '출제 원리와 그 한계' })).toBeVisible()
      await page.screenshot({ path: path.join(OUT, `${cand}-${info.project.name}-2-revealed.png`), fullPage: true })
      const metrics = { candidate: cand, viewport: info.project.name, taskClicks, totalClicks: c.clicks, ...prefix('start_', before), ...prefix('judging_', judging) }
      fs.mkdirSync(OUT, { recursive: true })
      fs.writeFileSync(path.join(OUT, `metrics-${cand}-${info.project.name}.json`), JSON.stringify(metrics, null, 2))
      expect(judging.horizontalScroll).toBe(false)
      // 눌린 버튼은 글자색과 배경색이 달라야 한다(흰 바탕 흰 글자 회귀)
      const invisible = await page.evaluate(() => [...document.querySelectorAll('[data-candidate] [aria-pressed="true"]:not([id^="f08-s"])')]
        .filter((b) => { const s = getComputedStyle(b); return s.color === s.backgroundColor }).length)
      expect(invisible).toBe(0)
    })

    test('범위 표시 — 7번 문장의 If 조건과 부정이 함께 강조된다', async ({ page }) => {
      await page.getByRole('button', { name: '부정·조건 범위 표시' }).click()
      const marks = page.locator('#f08-s7 mark')
      await expect(marks).toHaveCount(2)
      await expect(marks.nth(0)).toContainText('they would not rationally choose to do anyway')
      await expect(marks.nth(1)).toContainText('then the law cannot be')
      // 강조가 범위 종류를 글자로 말하고(색만이 아님), 학습자가 확인할 발문 조건과 같은 대상을 가리킨다
      await expect(marks.nth(0)).toContainText('[조건·한정]')
      await expect(marks.nth(1)).toContainText('[부정 범위]')
      if (cand === 'a') await page.getByRole('tab', { name: '발문 요구·조건' }).click()
      if (cand === 'c') { await page.getByRole('tab', { name: '내 판단' }).click(); await page.getByText('발문 요구·조건').click() }
      if (cand === 'b') { await page.getByTestId('prop-1').getByRole('button', { name: '대조표에 놓기' }).click(); await page.getByTestId('prop-3').getByRole('button', { name: '대조표에 놓기' }).click() }
      await expect(page.getByText(/7번 문장의 If 조건/).first()).toBeVisible()
      await expect(page.getByText(/cannot be 는 빈칸 표현 전체를 부정/).first()).toBeVisible()
    })

    test('공개 응답 대기 중 학습자가 옮긴 초점은 빼앗지 않고, 공개는 스크롤을 움직이지 않는다', async ({ page }) => {
      await page.route('**/api/dev/f08-reveal', async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.continue() })
      if (cand === 'a') await page.getByRole('tab', { name: '정답·해설' }).click()
      if (cand === 'c') await page.getByRole('tab', { name: '내 판단' }).click()
      await page.getByRole('button', { name: '정답·해설 보기' }).click()
      await page.getByRole('button', { name: '공개하기' }).click()
      // 로딩 상태가 실제로 보인다(지연 1.5초 동안)
      await expect(page.locator('[data-candidate]').getByText('불러오는 중…')).toBeVisible()
      await page.locator('#f08-s2').focus()
      await expect(page.getByTestId('answer-line')).toBeVisible({ timeout: 10_000 })
      await page.waitForTimeout(300)
      await expect(page.locator('#f08-s2')).toBeFocused()

      // 새로 시작해 스크롤 보존 확인 — 공개 확인을 키보드로 누른 뒤 scrollY 가 그대로다
      await page.evaluate(() => sessionStorage.clear())
      await page.reload()
      if (cand === 'a') await page.getByRole('tab', { name: '정답·해설' }).click()
      if (cand === 'c') await page.getByRole('tab', { name: '내 판단' }).click()
      await page.getByRole('button', { name: '정답·해설 보기' }).click()
      await page.mouse.wheel(0, 120)
      await page.waitForTimeout(200)
      const before = await page.evaluate(() => window.scrollY)
      await page.getByRole('button', { name: '공개하기' }).focus({})
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('answer-line')).toBeFocused({ timeout: 10_000 })
      const after = await page.evaluate(() => window.scrollY)
      expect(Math.abs(after - before)).toBeLessThanOrEqual(4)
    })

    test('키보드만으로 공개 — 단계마다 초점이 다음 조작 지점으로 간다', async ({ page }) => {
      if (cand === 'a') { await page.getByRole('tab', { name: '정답·해설' }).focus(); await page.keyboard.press('Enter') }
      if (cand === 'c') { await page.getByRole('tab', { name: '내 판단' }).focus(); await page.keyboard.press('Enter') }
      await page.getByRole('button', { name: '정답·해설 보기' }).focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('button', { name: '공개하기' })).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('answer-line')).toBeFocused()
      await expect(page.getByTestId('answer-line')).toContainText('3번')
    })

    test('키보드 — 문장까지 Tab 으로 닿고 포커스가 보인다', async ({ page }) => {
      let reached = false
      for (let i = 0; i < 40 && !reached; i++) {
        await page.keyboard.press('Tab')
        reached = await page.evaluate(() => document.activeElement?.id === 'f08-s1')
      }
      expect(reached).toBe(true)
      const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)
      expect(outline).not.toBe('none')
    })

    test('근거 문장으로 갔다가 판단 자리로 돌아온다 · 새로고침해도 판단이 남는다', async ({ page }) => {
      const c = counter()
      await TASK[cand](page, c)
      const chip = page.getByRole('button', { name: '7번 문장으로' }).first()
      await chip.click()
      await expect(page.locator('#f08-s7')).toBeFocused()
      await page.getByTestId('return-to-judgment').click()
      await expect(chip).toBeFocused()
      await page.reload()
      await expect(page.getByRole('button', { name: '7번 문장으로' }).first()).toBeVisible()
      // 판단값도 돌아온다 — 3번 「맞을 것 같다」, 1번 「아닐 것 같다」
      await expect(page.getByRole('group', { name: '3번 선지에 대한 내 판단' }).getByRole('button', { name: /맞을 것 같다/ })).toHaveAttribute('aria-pressed', 'true')
      if (cand === 'b') await expect(page.getByRole('group', { name: '1번 선지에 대한 내 판단' }).getByRole('button', { name: /아닐 것 같다/ })).toHaveAttribute('aria-pressed', 'true')
    })

    test('axe — 심각·치명 위반 없음', async ({ page }) => {
      const r = await new AxeBuilder({ page }).include('[data-candidate]').analyze()
      const bad = r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
      expect(bad.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
    })

    test('초점 복귀 분기 — 확인 취소 · 거절 후 닫기 · 실패 후 재시도 (키보드)', async ({ page }) => {
      const openTools = async () => {
        if (cand === 'a' && (await page.getByRole('tab', { name: '정답·해설' }).getAttribute('aria-selected')) !== 'true') await page.getByRole('tab', { name: '정답·해설' }).click()
        if (cand === 'c' && !(await page.getByRole('button', { name: '정답·해설 보기' }).isVisible())) await page.getByRole('tab', { name: '내 판단' }).click()
      }
      const fresh = async (q: string) => {
        await page.goto(`/dev/f08/${cand}${q}`)
        await page.evaluate(() => sessionStorage.clear())
        await page.reload()
        await expect(page.locator('#f08-s1')).toBeVisible()
        await openTools()
        await page.getByRole('button', { name: '정답·해설 보기' }).focus()
        await page.keyboard.press('Enter')
        await expect(page.getByRole('button', { name: '공개하기' })).toBeFocused()
      }
      // 확인 취소 → 「정답·해설 보기」로 복귀
      await fresh('')
      await page.getByRole('button', { name: '아직 안 본다' }).focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('button', { name: '정답·해설 보기' })).toBeFocused()
      await expect(page.getByTestId('answer-line')).toHaveCount(0)
      // 거절 → 알림 → 닫기 → 「정답·해설 보기」로 복귀
      await fresh('?fault=reveal-refused')
      await page.keyboard.press('Enter')
      const alert = page.locator('[data-candidate] [role="alert"]')
      await expect(alert).toBeFocused()
      await alert.getByRole('button', { name: '닫기' }).focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('button', { name: '정답·해설 보기' })).toBeFocused()
      // 실패 → 알림 → 다시 시도(다시 실패) → 알림으로 복귀, 정답 없음
      await fresh('?fault=reveal-error')
      await page.keyboard.press('Enter')
      await expect(alert).toBeFocused()
      await alert.getByRole('button', { name: '다시 시도' }).focus()
      await page.keyboard.press('Enter')
      await expect(alert).toContainText('해설을 불러오지 못했다')
      await expect(alert).toBeFocused()
      await expect(page.getByTestId('answer-line')).toHaveCount(0)
    })

    test('오류 상태 — 원문 없음 · 공개 거절 · 해설 실패', async ({ page }) => {
      await page.goto(`/dev/f08/${cand}?fault=no-source`)
      await expect(page.getByTestId('state-error')).toContainText('검증된 원문이 없다')
      await expect(page.locator('#f08-s1')).toHaveCount(0)
      for (const [fault, text] of [['reveal-refused', '공개가 거절됐다'], ['reveal-error', '해설을 불러오지 못했다']] as const) {
        await page.goto(`/dev/f08/${cand}?fault=${fault}`)
        await page.evaluate(() => sessionStorage.clear())
        await page.reload()
        const c = counter()
        await openReveal(page, cand, c)
        await expect(page.locator('[data-candidate] [role="alert"]')).toContainText(text)
        await expect(page.locator('[data-candidate] [role="alert"]')).toBeFocused()
        await expect(page.getByTestId('answer-line')).toHaveCount(0)
      }
    })
  })
}

test.describe('후보 C 강의 연동', () => {
  test('공개 전 강의는 정답을 말하지 않고, 강의↔판단 전환에 위치가 남는다', async ({ page }) => {
    await page.goto('/dev/f08/c')
    await page.evaluate(() => sessionStorage.clear())
    await page.reload()
    await expect(page.getByText(/강의 1\/3/)).toBeVisible()
    for (let i = 0; i < 2; i++) {
      await expect(page.getByTestId('cue-text')).not.toContainText('정답')
      await page.getByRole('button', { name: '다음 큐' }).click()
    }
    await expect(page.getByTestId('cue-text')).not.toContainText('정답')
    await expect(page.getByRole('button', { name: '다음 큐' })).toBeDisabled()
    await page.getByRole('tab', { name: '내 판단' }).click()
    await expect(page.getByText('강의는 3번째 큐에 멈춰 있다.')).toBeVisible()
    await page.getByRole('tab', { name: '강의' }).click()
    await expect(page.getByText(/강의 3\/3/)).toBeVisible()
    await page.getByRole('tab', { name: '내 판단' }).click()
    await page.getByRole('button', { name: '정답·해설 보기' }).click()
    await page.getByRole('button', { name: '공개하기' }).click()
    await page.getByRole('tab', { name: '강의' }).click()
    await expect(page.getByText(/강의 3\/12/)).toBeVisible()
  })

  test('강의 실패에도 판단 도구는 동작한다', async ({ page }) => {
    await page.goto('/dev/f08/c?fault=lecture-fail')
    await expect(page.getByTestId('lecture-failed')).toBeVisible()
    await page.getByRole('button', { name: '판단으로 가기' }).click()
    await page.getByRole('button', { name: '3번', exact: true }).click()
    await expect(page.locator('#f08-s7')).toContainText('understood as a restraint')
    await expect(page.getByRole('group', { name: '3번 선지에 대한 내 판단' })).toBeVisible()
  })
})

function prefix(p: string, m: Metrics): Metrics {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [p + k, v]))
}
