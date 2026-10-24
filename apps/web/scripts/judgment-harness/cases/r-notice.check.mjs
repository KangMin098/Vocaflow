// apps/web/scripts/judgment-harness/cases/r-notice.check.mjs
// 정보 일치 도구(R-NOTICE) 격리 브라우저 검사(제품 E2E 아님). r-fact.check.mjs 가 같은 절차를 다른 문항 값으로 쓴다.
const ANSWER_MARKS = ['[data-revealed]', '[data-compare]', '[data-disagree]', '[data-reveal-error]']

/** opts: choice(검사할 선지) · unit(연결할 원문) · second(두 번째 문항 본문 일부) */
export function makeCheck(opts) {
  return async function check(page, t) {
    await t.open('')
    t.check('마운트 직후 공개 호출 0', (await page.evaluate(() => window.__REVEAL_CALLS__)) === 0)
    const leaked = await page.evaluate((sel) => sel.filter((s) => document.querySelector(s)).length + (/해설 판정|정답 [①-⑤]/.test(document.body.innerText) ? 1 : 0), ANSWER_MARKS)
    t.check('초기 DOM 에 정답 표지 없음', leaked === 0, leaked)
    await t.shot('initial')

    const press = async (selector, key = 'Enter') => { await page.focus(selector); await page.keyboard.press(key) }
    // 키보드만: 선지 고르기 → 규칙 성분 고르기 → 원문 문장 연결 → 일치 표시
    await press(`[data-choice="${opts.choice}"]`)
    const ruleSel = await page.getAttribute('[data-comp-select]', 'data-comp-select')
    await press(`[data-comp-select="${ruleSel}"]`)
    // 근거 없이 언급 없음 아닌 일치를 누르면 표시되지 않는다
    await press(`[data-comp-mark="${ruleSel}"][data-mark="match"]`)
    const blocked = (await page.getAttribute(`[data-comp-mark="${ruleSel}"][data-mark="match"]`, 'aria-pressed')) === 'false'
    t.check('근거 연결 전 일치 표시 거부', blocked)
    await press(`[data-unit="${opts.unit}"]`)
    await press(`[data-comp-mark="${ruleSel}"][data-mark="match"]`, ' ')
    // 규칙이 못 잡은 말을 직접 골라 성분으로 묶고 어긋남 표시
    const free = await page.getAttribute('[data-free]', 'data-token')
    await press(`[data-free][data-token="${free}"]`, ' ')
    await press('[data-action="group"]')
    await press(`[data-unit="${opts.unit}"]`)
    await press(`[data-comp-mark="l${free}"][data-mark="conflict"]`)
    const kb = await page.evaluate(({ rule, free, unit }) => ({
      match: document.querySelector(`[data-comp-mark="${rule}"][data-mark="match"]`)?.getAttribute('aria-pressed'),
      conflict: document.querySelector(`[data-comp-mark="l${free}"][data-mark="conflict"]`)?.getAttribute('aria-pressed'),
      pinned: document.querySelector(`[data-unit="${unit}"]`)?.getAttribute('data-state'),
      tally: document.querySelector('[data-tally]')?.textContent,
    }), { rule: ruleSel, free, unit: opts.unit })
    t.check('키보드로 성분별 연결·표시(일치 1 · 어긋남 1)', kb.match === 'true' && kb.conflict === 'true' && kb.pinned === 'pinned' && /어긋남 1/.test(kb.tally ?? '') && /일치 1/.test(kb.tally ?? ''), kb)
    // 연결한 근거가 있는 성분에 언급 없음 거부
    await press(`[data-comp-mark="l${free}"][data-mark="absent"]`)
    t.check('연결 있는 성분에 언급 없음 거부', (await page.getAttribute(`[data-comp-mark="l${free}"][data-mark="absent"]`, 'aria-pressed')) === 'false')
    await t.shot('keyboard')

    // 원문↔판단 왕복: 판단면 스크롤 → 원문 문장 누름(연결 토글 두 번) → scrollTop·선택 보존
    await page.evaluate(() => { document.querySelector('[data-scroll-pane="judgment"]').scrollTop = 160 })
    const before = await page.evaluate(() => document.querySelector('[data-scroll-pane="judgment"]').scrollTop)
    await t.clickUnit('u1')
    await t.clickUnit('u1')
    const after = await page.evaluate(({ free }) => ({
      top: document.querySelector('[data-scroll-pane="judgment"]').scrollTop,
      choice: document.querySelector('[data-choice][aria-pressed="true"]')?.getAttribute('data-choice'),
      conflict: document.querySelector(`[data-comp-mark="l${free}"][data-mark="conflict"]`)?.getAttribute('aria-pressed'),
    }), { free })
    t.check('원문↔판단 왕복 시 선택·scrollTop 보존', after.top === before && after.choice === String(opts.choice) && after.conflict === 'true', { before, after })
    // 다른 선지 갔다가 돌아와도 표시 보존
    await press('[data-choice="1"]')
    await press(`[data-choice="${opts.choice}"]`)
    t.check('선지 전환 뒤 성분 표시 보존', (await page.getAttribute(`[data-comp-mark="l${free}"][data-mark="conflict"]`, 'aria-pressed')) === 'true')

    // 해설 보기 → 근거 링크 → 원문 focus
    await page.click('[data-action="reveal"]')
    await page.waitForSelector('[data-revealed]')
    t.check('해설 요청 1회', (await page.evaluate(() => window.__REVEAL_CALLS__)) === 1)
    const ref = await page.$('[data-compare] [data-ref]')
    const rid = await ref.getAttribute('data-ref')
    await ref.click()
    t.check('근거 링크 → 원문 단위 focus', (await page.getAttribute(`[data-unit="${rid}"]`, 'data-state')) === 'focus', rid)
    const cmpText = await page.innerText('[data-compare]')
    t.check('공개 뒤 해설 근거와 내 연결 대조', /해설 판정/.test(cmpText) && /내가 연결한 문장/.test(cmpText), cmpText.slice(0, 200))
    await t.shot('revealed')

    const small = await page.evaluate(() => [...document.querySelectorAll('[data-scroll-pane="judgment"] button')].map((b) => b.getBoundingClientRect().height).filter((h) => h > 0 && h < 44))
    t.check('주요 버튼 높이 ≥44', small.length === 0, small)
    t.check('가로 스크롤 없음', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))

    for (const [q, code] of [['?reveal=fail', 'fetch'], ['?reveal=version', 'version']]) {
      await t.open(q)
      await page.click('[data-action="reveal"]')
      await page.waitForSelector('[data-reveal-error]')
      const ok = (await page.getAttribute('[data-reveal-error]', 'data-reveal-error')) === code && !(await page.$('[data-revealed]'))
      t.check(`${q} 오류 문구 · 근거 미표시`, ok)
    }
    await t.open('?empty=1')
    t.check('?empty=1 자료 없음', Boolean(await page.$('[data-judgment-empty]')))
    await t.open('?item=1')
    const second = await page.evaluate((s) => ({ choices: document.querySelectorAll('[data-choice]').length, text: document.body.innerText.includes(s), calls: window.__REVEAL_CALLS__ }), opts.second)
    t.check('?item=1 두 번째 문항', second.choices === 5 && second.text && second.calls === 0, second)
    await t.shot('item1')
  }
}

export const check = makeCheck({ choice: 3, unit: 'u7', second: 'Footnote Dance Program' })
