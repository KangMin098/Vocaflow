// apps/web/scripts/judgment-harness/cases/r-irrelevant.check.mjs
// 무관한 문장 도구 격리 브라우저 검사(제품 E2E 아님)
const ANSWER_MARKS = ['[data-revealed]', '[data-reveal-error]']

export async function check(page, t) {
  await t.open('')
  t.check('마운트 직후 공개 호출 0', (await page.evaluate(() => window.__REVEAL_CALLS__)) === 0)
  const leaked = await page.evaluate((sel) => sel.filter((s) => document.querySelector(s)).length + (document.body.innerText.includes('해설 정답') ? 1 : 0), ANSWER_MARKS)
  t.check('초기 DOM 에 정답 표지 없음', leaked === 0, leaked)
  await t.shot('initial')

  // 키보드만: 탭 목록에서 화살표로 ④ 로 이동 → 앞 이음매 끊긴다 · 논지 방향 · 빼고 읽기 · 후보
  await page.focus('[role="tab"][aria-selected="true"]')
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
  const sel = await page.evaluate(() => [document.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute('data-slot'), document.activeElement?.getAttribute('data-slot')])
  t.check('화살표로 선지 탭 이동', sel[0] === '4' && sel[1] === '4', sel)
  const pressKey = async (selector, key = 'Enter') => { await page.focus(selector); await page.keyboard.press(key) }
  await pressKey('[data-seam="back"] [data-verdict="breaks"]')
  await pressKey('[data-seam="back"] [data-cue="connective"]', ' ')
  const warnConn = await page.$('[data-warn="connective-only"]')
  await pressKey('[data-seam="back"] [data-cue="direction"]')
  const warnGone = !(await page.$('[data-warn="connective-only"]'))
  t.check('연결사만 근거 경고 → 논지 방향 추가 시 해제', Boolean(warnConn) && warnGone)
  await pressKey('[data-seam="forward"] [data-verdict="breaks"]')
  await pressKey('[data-seam="forward"] [data-cue="topic"]')
  const removeBtn = await page.$('[data-remove]')
  await removeBtn.focus(); await page.keyboard.press('Enter')
  await pressKey('[data-seam="bridge"] [data-verdict="holds"]')
  await pressKey('[data-seam="bridge"] [data-cue="direction"]')
  const kb = await page.evaluate(() => ({
    dim: document.querySelector('[data-unit="u6"]')?.getAttribute('data-state'),
    focus: [...document.querySelectorAll('[data-unit][data-state="focus"]')].map((e) => e.getAttribute('data-unit')),
    prof: document.body.innerText.includes('끼어든 문장의 모양'),
  }))
  t.check('키보드로 이음매·빼고 읽기 판단 → 끼어든 모양', kb.prof && kb.focus.join() === 'u5,u7', kb)
  await t.shot('keyboard')

  // 원문↔판단 왕복: 판단면 스크롤 → 원문 문장 고정(화제) → 판단면 scrollTop·선택 보존
  await page.evaluate(() => { document.querySelector('[data-scroll-pane="judgment"]').scrollTop = 120 })
  // 위쪽 화제 목록이 늘면 브라우저 스크롤 앵커링이 scrollTop 을 바꿔 보던 내용을 제자리에 둔다 — 그래서 scrollTop 이 아니라 보던 요소의 화면 위치를 비교한다
  const seamY = () => page.evaluate(() => Math.round(document.querySelector('[data-seam="back"]').getBoundingClientRect().top))
  const before = await seamY()
  await page.focus('[data-unit="u1"]'); await page.keyboard.press('Enter')
  await page.click('[data-unit="u2"]')
  const after = await page.evaluate(() => ({
    top: Math.round(document.querySelector('[data-seam="back"]').getBoundingClientRect().top),
    tab: document.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute('data-slot'),
    pinned: document.querySelector('[data-unit="u1"]')?.getAttribute('aria-pressed'),
    back: document.querySelector('[data-seam="back"] [data-verdict="breaks"]')?.getAttribute('aria-pressed'),
  }))
  t.check('원문↔판단 왕복 시 선택·보던 위치 보존', Math.abs(after.top - before) <= 2 && after.tab === '4' && after.pinned === 'true' && after.back === 'true', { before, after })

  // 해설 보기 → 근거 링크 → 원문 focus
  await page.click('[data-reveal-btn]')
  await page.waitForSelector('[data-revealed]')
  t.check('해설 요청 1회', (await page.evaluate(() => window.__REVEAL_CALLS__)) === 1)
  const ref = await page.$('[data-revealed] [data-ref]')
  const rid = await ref.getAttribute('data-ref')
  await ref.click()
  t.check('근거 링크 → 원문 단위 focus', (await page.getAttribute(`[data-unit="${rid}"]`, 'data-state')) === 'focus', rid)
  t.check('공개 뒤 내 후보와 정답 대조 표시', (await page.innerText('[data-revealed]')).includes('해설 정답'))
  await t.shot('revealed')

  // 버튼 높이 · 가로 스크롤
  const small = await page.evaluate(() => [...document.querySelectorAll('[data-scroll-pane="judgment"] button')].filter((b) => !b.hasAttribute('data-ref')).map((b) => b.getBoundingClientRect().height).filter((h) => h > 0 && h < 44))
  t.check('주요 버튼 높이 ≥44', small.length === 0, small)
  t.check('가로 스크롤 없음', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))

  for (const [q, code] of [['?reveal=fail', 'fetch'], ['?reveal=version', 'version']]) {
    await t.open(q)
    await page.click('[data-reveal-btn]')
    await page.waitForSelector('[data-reveal-error]')
    const ok = (await page.getAttribute('[data-reveal-error]', 'data-reveal-error')) === code && !(await page.$('[data-revealed]'))
    t.check(`${q} 오류 문구 · 근거 미표시`, ok)
  }
  await t.open('?empty=1')
  t.check('?empty=1 자료 없음', Boolean(await page.$('[data-judgment-empty]')))
  await t.open('?item=1')
  const second = await page.evaluate(() => ({ tabs: document.querySelectorAll('[role="tab"]').length, text: document.body.innerText.includes('Regular pet checkups'), calls: window.__REVEAL_CALLS__ }))
  t.check('?item=1 두 번째 문항', second.tabs === 5 && second.text && second.calls === 0, second)
  await t.shot('item1')
}
