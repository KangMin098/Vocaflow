// apps/web/tests/f08/f08-design.spec.ts
//
// F08 프로토타입 디자인 수용 — 3B 정본(DESIGN.md · skins/csat-app.css)과 제품 정본(44px·초점·색만 금지·break-keep)
// 가운데 독립 프로토타입에 적용되는 기준을 **측정**으로 판정한다. 결과는 test-results/f08/design-*.json 에 남긴다.
// 셸(CsatRail)·제품 라우트 통합은 범위 밖 — 통합 계약에 남긴다. 학습 효과·사용성은 판정하지 않는다.

import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

const OUT = path.join(__dirname, '../../test-results/f08')

/** 3B 스킨 토큰(packages/design-tokens/src/skins/csat-app.css) */
const TOKENS = { canvas: 'rgb(250, 249, 247)', panel: 'rgb(255, 255, 255)', ink: 'rgb(24, 24, 27)', accent: 'rgb(124, 92, 250)' }

async function audit(page: Page) {
  return page.evaluate(() => {
    const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number)
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
    const bgOf = (el: Element | null): number[] => {
      for (let e = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor)
        if (c.length >= 3 && (c[3] === undefined || c[3] > 0.5)) return c.slice(0, 3)
      }
      return [255, 255, 255]
    }
    const root = document.querySelector('[data-candidate]')!
    const shown = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight }
    // 글자 대비 — 글자를 직접 가진 요소만
    const lowContrast: string[] = []
    let textNodes = 0
    for (const el of root.querySelectorAll('*')) {
      if (!shown(el) || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) continue
      const s = getComputedStyle(el)
      if (s.visibility === 'hidden' || +s.opacity === 0) continue
      textNodes++
      const size = parseFloat(s.fontSize), bold = +s.fontWeight >= 700
      const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5
      const r = ratio(parse(s.color).slice(0, 3), bgOf(el))
      if (r < need) lowContrast.push(`${el.tagName.toLowerCase()} "${el.textContent!.trim().slice(0, 24)}" ${r.toFixed(2)}<${need}`)
    }
    const buttons = [...root.querySelectorAll('button')].filter(shown)
    const small = buttons.filter((b) => !b.id.startsWith('f08-s') && b.getBoundingClientRect().height < 44).map((b) => b.textContent!.trim().slice(0, 16))
    const tinyText = [...root.querySelectorAll('*')].filter((el) => shown(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) && parseFloat(getComputedStyle(el).fontSize) < 11)
      .map((el) => `${el.textContent!.trim().slice(0, 16)}(${getComputedStyle(el).fontSize})`)
    const koNoKeep = [...root.querySelectorAll('p, li, td, th, span')].filter((el) => shown(el) && /[가-힣]{6,}/.test(el.textContent ?? '') && getComputedStyle(el).wordBreak !== 'keep-all')
      .map((el) => el.textContent!.trim().slice(0, 16))
    const s1 = document.getElementById('f08-s1')!
    const ps = getComputedStyle(s1)
    const passage = s1.parentElement!
    const cpl = Math.round(passage.getBoundingClientRect().width / (parseFloat(ps.fontSize) * 0.5))
    const body = getComputedStyle(document.querySelector('[data-candidate]')!)
    const page = getComputedStyle(document.body)
    const canvasEl = document.querySelector('[data-f08-canvas]') ?? document.body
    return {
      textNodes, lowContrast, smallButtons: small, tinyText, koNoKeep,
      passage: { fontPx: parseFloat(ps.fontSize), lineHeight: +(parseFloat(ps.lineHeight) / parseFloat(ps.fontSize)).toFixed(2), approxCharsPerLine: cpl, color: ps.color },
      fontFamily: body.fontFamily, pageColor: page.color,
      canvas: getComputedStyle(canvasEl).backgroundColor,
    }
  })
}

for (const cand of ['a', 'b', 'c'] as const) {
  test(`디자인 수용 측정 — 후보 ${cand.toUpperCase()}`, async ({ page }, info) => {
    await page.goto(`/dev/f08/${cand}`)
    await page.evaluate(() => sessionStorage.clear())
    await page.reload()
    await expect(page.locator('#f08-s1')).toBeVisible()
    // 판단 중 상태(범위 표시 + 3번 대입·판단)로 맞춰 측정한다
    await page.getByRole('button', { name: '부정·조건 범위 표시' }).click()
    if (cand === 'a') { await page.getByRole('tab', { name: '선지 넣어 보기' }).click(); await page.getByRole('button', { name: '3번', exact: true }).click() }
    if (cand === 'c') { await page.getByRole('tab', { name: '내 판단' }).click(); await page.getByRole('button', { name: '3번', exact: true }).click() }
    await page.getByRole('group', { name: '3번 선지에 대한 내 판단' }).getByRole('button', { name: /맞을 것 같다/ }).click()

    // 초점 표시 색·두께
    await page.getByRole('button', { name: '부정·조건 범위 표시' }).focus()
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab')
    const focus = await page.evaluate(() => { const s = getComputedStyle(document.activeElement!); return { style: s.outlineStyle, width: s.outlineWidth, color: s.outlineColor } })
    // 눌린/안 눌린 버튼 배경 대비(색만이 아닌 ✓ 표지도 확인)
    const pressed = await page.evaluate(() => {
      const on = document.querySelector('[data-candidate] [aria-pressed="true"]:not([id^="f08-s"])') as HTMLElement
      const off = document.querySelector('[data-candidate] [aria-pressed="false"]:not([id^="f08-s"])') as HTMLElement
      return { onBg: getComputedStyle(on).backgroundColor, offBg: getComputedStyle(off).backgroundColor, onGlyph: getComputedStyle(on, '::before').content, onName: on.textContent }
    })
    const a = await audit(page)
    const result = { candidate: cand, viewport: info.project.name, focus, pressed, ...a, tokens: TOKENS }
    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(path.join(OUT, `design-${cand}-${info.project.name}.json`), JSON.stringify(result, null, 2))

    // ── 판정 기준 ──
    expect.soft(a.lowContrast, 'D7 글자 대비 AA').toEqual([])
    expect.soft(a.smallButtons, 'D5 조작 44px').toEqual([])
    expect.soft(a.tinyText, 'D3·D7 11px 미만 글자').toEqual([])
    expect.soft(a.koNoKeep, 'I7 한글 break-keep').toEqual([])
    expect.soft(a.passage.fontPx, 'D1 원문 글자').toBeGreaterThanOrEqual(17)
    expect.soft(a.passage.lineHeight, 'D1 원문 줄 간격').toBeGreaterThanOrEqual(1.6)
    expect.soft(a.passage.approxCharsPerLine, 'D1 줄당 글자(상한)').toBeLessThanOrEqual(110)
    expect.soft(a.passage.color, 'D7 3B 잉크').toBe(TOKENS.ink)
    expect.soft(a.canvas, 'D7 3B 캔버스').toBe(TOKENS.canvas)
    expect.soft(a.fontFamily, 'D7 3B 서체(Pretendard 포함)').toMatch(/Pretendard/)
    expect.soft(focus.style, 'D6 초점 윤곽').not.toBe('none')
    expect.soft(focus.color, 'D6 3B 초점 색').toBe(TOKENS.accent)
    expect.soft(pressed.onBg, 'D5 눌림 상태 배경 구분').not.toBe(pressed.offBg)
    expect.soft(pressed.onGlyph, 'D5 눌림 상태 글자 표지(색만 금지)').toContain('✓')
  })
}
