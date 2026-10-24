// apps/web/scripts/judgment-harness/cases/r-order.check.mjs
// OrderTool 격리 브라우저 검사 — 공개 전 무호출 · 키보드 배열/연결 · 왕복 시 상태 보존 · 공개 뒤 근거 링크 · 오류/빈 상태.
const J = '[data-scroll-pane="judgment"]'

export async function check(page, t) {
  await t.open('')
  t.check('마운트 직후 공개 호출 0', (await page.evaluate(() => window.__REVEAL_CALLS__)) === 0)
  const html0 = await page.$eval('#root', (el) => el.innerHTML)
  t.check('초기 DOM 에 정답 표지 없음', !/data-revealed|해설의 정답|함정:|해설의 순서/.test(html0))
  await t.shot('initial')

  // 키보드만으로 배열: (C) 를 Enter 두 번 앞으로 → (C)-(A)-(B)
  await page.focus('[data-move="C-up"]')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  // Alt+↓ 로 (B) 를 더 뒤로 보내려 해도 끝에서 멈춘다
  await page.focus('[data-move="B-up"]')
  await page.keyboard.press('Alt+ArrowDown')
  t.check('키보드 배열 → (C)-(A)-(B)', (await page.getAttribute('[data-order]', 'data-order')) === 'GCAB')

  // 키보드로 단서 → 전제 대상 연결
  const link = async (para, kind, unit) => {
    await page.focus(`[data-cue-para="${para}"] [data-kind="${kind}"]`)
    await page.keyboard.press('Space')
    await page.focus(`[data-unit="${unit}"]`)
    await page.keyboard.press('Enter')
  }
  await link('A', 'example', 'u5')
  await link('B', 'time', 'u2')
  t.check('연결 2개 생성', (await page.locator('[data-link]').count()) === 2)
  t.check('이음매 (C)→(A) 닫힘', (await page.locator('[data-junction="C>A"] [data-status="closed"]').count()) === 1)
  const broken = await page.$$eval('[data-choice]', (rs) => rs.map((r) => Number(r.getAttribute('data-broken'))))
  t.check('선지 대조: 내 연결 기준 끊김 0 은 한 선지뿐', broken.filter((b) => b === 0).length === 1 && broken[3] === 0, broken)
  t.check('aria-live 안내', /연결/.test((await page.textContent('[data-live]')) ?? ''))

  // 같은 낱말 반복만으로 잇기 → 실패 조건 표시
  await link('B', 'repeat', 'u2')
  t.check('반복 낱말 연결 → 실패 조건 표시', (await page.locator('[data-caution="failure"]').count()) >= 1)
  t.check('공개 전 판단 뒤에도 공개 호출 0', (await page.evaluate(() => window.__REVEAL_CALLS__)) === 0)
  await t.shot('linked')

  // 원문↔판단 왕복: 판단면 스크롤 · 선택 상태 보존
  await page.$eval(J, (el) => { el.scrollTop = 260 })
  const before = await page.$eval(J, (el) => el.scrollTop)
  await page.click('[data-unit="u4"]')
  // 판단면 조작은 자동 스크롤 없이(프로그램 클릭) — 도구 자체가 위치를 바꾸는지만 본다
  await page.$eval('[data-link] button', (b) => { b.focus({ preventScroll: true }); b.click() })
  const after = await page.$eval(J, (el) => el.scrollTop)
  t.check('왕복 뒤 판단면 scrollTop 보존', Math.abs(after - before) <= 2, { before, after })
  t.check('왕복 뒤 배열·연결 보존', (await page.getAttribute('[data-order]', 'data-order')) === 'GCAB' && (await page.locator('[data-link]').count()) === 3)

  // 해설 보기 → 근거 링크 → 원문 focus
  await page.click('[data-reveal]')
  await page.waitForSelector('[data-revealed]')
  t.check('해설 요청 뒤 공개 호출 1', (await page.evaluate(() => window.__REVEAL_CALLS__)) === 1)
  const ref = page.locator('[data-reveal-choice="1"] [data-ref]').first()
  const rid = await ref.getAttribute('data-ref')
  await ref.click()
  t.check('근거 링크 → 원문 단위 focus', (await page.getAttribute(`[data-unit="${rid}"]`, 'data-state')) === 'focus', rid)
  t.check('공개 뒤 선지별 함정 이음매 표시', (await page.locator('[data-reveal-choice]').count()) === 5 && /이 선지에만 있는 이음매/.test(await page.textContent('[data-revealed]')))
  await t.shot('revealed')

  const heights = await page.$$eval('[data-move], [data-cue], [data-reveal], [data-link] button', (bs) => bs.map((b) => b.getBoundingClientRect().height))
  t.check('주요 버튼 높이 ≥44', heights.length > 0 && heights.every((h) => h >= 44), Math.min(...heights))
  t.check('가로 스크롤 없음', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))

  for (const mode of ['fail', 'version']) {
    await t.open(`?reveal=${mode}`)
    await page.click('[data-reveal]')
    await page.waitForSelector('[data-reveal-error]')
    const txt = await page.textContent('[data-reveal-error]')
    t.check(`?reveal=${mode} 오류 문구`, mode === 'fail' ? /불러오지 못했다/.test(txt) : /판본/.test(txt), txt)
    t.check(`?reveal=${mode} 근거 미표시`, (await page.locator('[data-revealed]').count()) === 0)
  }

  await t.open('?empty=1')
  t.check('?empty=1 빈 상태', (await page.locator('[data-judgment-empty]').count()) === 1)

  await t.open('?item=1')
  t.check('?item=1 두 번째 문항', /Language is a manifestation of culture/.test(await page.textContent('[data-scroll-pane="evidence"]')))
  t.check('?item=1 지시어 단서 This phenomenon', (await page.locator('[data-cue-para="A"] [data-kind="demonstrative"]').count()) === 1)
  await page.focus('[data-move="C-up"]')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.focus('[data-move="B-up"]')
  await page.keyboard.press('Enter')
  t.check('?item=1 배열 (C)-(B)-(A)', (await page.getAttribute('[data-order]', 'data-order')) === 'GCBA')
  t.check('?item=1 가로 스크롤 없음', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
  await t.shot('item1')
}
