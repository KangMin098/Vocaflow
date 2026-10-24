// apps/web/scripts/judgment-harness/cases/r-mood.check.mjs
// 심경·분위기 도구 격리 브라우저 검사(제품 E2E 아님)
export async function check(page, t) {
  await t.open('')
  t.check('마운트 직후 공개 호출 0', (await page.evaluate(() => window.__REVEAL_CALLS__)) === 0)
  const leaked = await page.evaluate(() => (document.querySelector('[data-revealed], [data-reveal-choice]') ? 1 : 0) + (/정답|오답/.test(document.body.innerText) ? 1 : 0))
  t.check('초기 DOM 에 정답 표지 없음', leaked === 0, leaked)
  await t.shot('initial')

  const key = async (sel, k = 'Enter') => { await page.focus(sel); await page.keyboard.press(k) }
  const signal = async (unit, kind, pol, strong) => {
    await key(`[data-unit="${unit}"]`)
    await key(`[data-kind="${kind}"]`, ' ')
    await key(`[data-pol="${pol}"]`)
    if (strong) await key('[aria-label="강도"] button:nth-of-type(2)')
  }
  // 키보드만: 9번 전환점 · 6·7번 부정 신체 · 13번 긍정 감정어 → 감정어 하나 경고 → 15번 신체 추가로 해제
  await key('[data-unit="u9"]'); await key('[data-act="turn"]')
  await signal('u6', 'body', '-', true)
  await signal('u7', 'body', '-', true)
  await signal('u13', 'word', '+', false)
  const warnOne = Boolean(await page.$('[data-warn="single-word"]'))
  await signal('u15', 'body', '+', true)
  const warnGone = !(await page.$('[data-warn="single-word"]'))
  t.check('감정어 하나만 경고 → 신체 신호 추가 시 해제', warnOne && warnGone, { warnOne, warnGone })
  // 선지 ④ bored(+) → thrilled(+) : 앞 칸만 어긋남
  await key('[data-choice="4"] [aria-label="bored 을(를) 긍정으로"]')
  await key('[data-choice="4"] [aria-label="thrilled 을(를) 긍정으로"]', ' ')
  const v4 = await page.evaluate(() => [...document.querySelectorAll('[data-choice="4"] [data-v]')].map((e) => e.getAttribute('data-v')))
  t.check('키보드로 전환점·신호·선지 극성 → ④ 앞 칸만 어긋남', v4.join() === 'conflict,consistent', v4)
  const marks = await page.innerText('[data-unit="u9"]')
  t.check('원문에 전환점 표지(글자)', marks.includes('◆ 전환점'), marks)
  await t.shot('keyboard')

  // 원문↔판단 왕복
  await page.evaluate(() => { document.querySelector('[data-scroll-pane="judgment"]').scrollTop = 200 })
  const before = await page.evaluate(() => document.querySelector('[data-scroll-pane="judgment"]').scrollTop)
  await page.click('[data-unit="u3"]')
  await page.click('[data-unit="u7"]')
  const after = await page.evaluate(() => ({
    top: document.querySelector('[data-scroll-pane="judgment"]').scrollTop,
    turn: document.querySelector('[data-unit="u9"]')?.innerText.includes('전환점'),
    v4: [...document.querySelectorAll('[data-choice="4"] [data-v]')].map((e) => e.getAttribute('data-v')).join(),
    pinned: document.querySelector('[data-unit="u6"]')?.getAttribute('aria-pressed'),
  }))
  t.check('원문↔판단 왕복 시 선택·scrollTop 보존', after.top === before && after.turn && after.v4 === 'conflict,consistent' && after.pinned === 'true', { before, after })

  // 해설 보기 → 전환점 대조 → 근거 링크 → 원문 focus
  await key('[data-act="reveal"]')
  await page.waitForSelector('[data-revealed]')
  t.check('해설 요청 1회', (await page.evaluate(() => window.__REVEAL_CALLS__)) === 1)
  const rtext = await page.innerText('[data-revealed]')
  t.check('공개 뒤 내 전환점 ↔ 해설 전환 표지 대조', rtext.includes('내 전환점: 9번') && rtext.includes('겹친다'), rtext.slice(0, 200))
  const ref = await page.$('[data-reveal-choice="4"] [data-ref]')
  const rid = await ref.getAttribute('data-ref')
  await ref.click()
  t.check('근거 링크 → 원문 단위 focus', (await page.getAttribute(`[data-unit="${rid}"]`, 'data-state')) === 'focus', rid)
  await t.shot('revealed')

  const small = await page.evaluate(() => [...document.querySelectorAll('[data-scroll-pane="judgment"] button')].filter((b) => !b.hasAttribute('data-ref')).map((b) => b.getBoundingClientRect().height).filter((h) => h > 0 && h < 44))
  t.check('주요 버튼 높이 ≥44', small.length === 0, small)
  t.check('가로 스크롤 없음', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))

  for (const [q, code] of [['?reveal=fail', 'fetch'], ['?reveal=version', 'version']]) {
    await t.open(q)
    await page.click('[data-act="reveal"]')
    await page.waitForSelector('[data-reveal-error]')
    const ok = (await page.getAttribute('[data-reveal-error]', 'data-reveal-error')) === code && !(await page.$('[data-revealed]'))
    t.check(`${q} 오류 문구 · 근거 미표시`, ok)
  }
  await t.open('?empty=1')
  t.check('?empty=1 자료 없음', Boolean(await page.$('[data-judgment-empty]')))
  await t.open('?item=1')
  const second = await page.evaluate(() => ({ choices: document.querySelectorAll('[data-choice]').length, text: document.body.innerText.includes('Maggie stood up'), calls: window.__REVEAL_CALLS__ }))
  t.check('?item=1 두 번째 문항', second.choices === 5 && second.text && second.calls === 0, second)
  await t.shot('item1')
}
