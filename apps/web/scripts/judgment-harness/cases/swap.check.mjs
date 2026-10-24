// apps/web/scripts/judgment-harness/cases/swap.check.mjs
// T-0151 재검증: P1-01 같은 인스턴스 문항 교체 · P1-03 원문 버튼 접근성 이름 · P2-01 근거 링크 44px — 5개 도구 모두.
const REVEAL_BTN = '[data-reveal-btn], [data-reveal], [data-action="reveal"], [data-act="reveal"], button[data-reveal]'
const revealBtn = async (page) => {
  for (const b of await page.$$('[data-scroll-pane="judgment"] button')) {
    const t = (await b.innerText()).trim()
    if (/^해설 (보기|다시 불러오기)$/.test(t) || /^해설 보기/.test(t)) return b
  }
  return page.$(REVEAL_BTN)
}
const revealedText = (page) => page.evaluate(() => document.querySelector('[data-scroll-pane="judgment"]')?.innerText ?? '')

export async function check(page, t) {
  for (const tool of ['info', 'irrelevant', 'order', 'grammar', 'mood']) {
    // ① 공개 뒤 교체
    await t.open(`?tool=${tool}`)
    const first = await page.getAttribute('[data-swap-root]', 'data-current')
    const before = await revealedText(page)
    await (await revealBtn(page)).click()
    await page.waitForFunction((b) => (document.querySelector('[data-scroll-pane="judgment"]')?.innerText ?? '') !== b && !/불러오는 중/.test(document.querySelector('[data-scroll-pane="judgment"]').innerText), before, { timeout: 8000 })
    const shownA = await revealedText(page)
    await page.evaluate(() => window.__SWAP__())
    await page.waitForFunction((id) => document.querySelector('[data-swap-root]').getAttribute('data-current') !== id, first)
    await page.waitForTimeout(300)
    const afterSwap = await revealedText(page)
    const btnBack = Boolean(await revealBtn(page))
    t.check(`${tool}: 공개 뒤 문항 교체 → 이전 해설 사라지고 해설 버튼 복귀 · 추가 호출 0`, btnBack && afterSwap !== shownA && (await page.evaluate(() => window.__REVEAL_CALLS__)) === 1, { first, btnBack, calls: await page.evaluate(() => window.__REVEAL_CALLS__) })

    // ② 요청 중 교체 — 늦게 온 이전 문항 응답을 받지 않는다
    await t.open(`?tool=${tool}&delay=1500`)
    await (await revealBtn(page)).click()
    await page.waitForTimeout(150)
    await page.evaluate(() => window.__SWAP__())
    await page.waitForTimeout(2000)
    const late = await page.evaluate(() => ({ calls: window.__REVEAL_CALLS__, loading: /불러오는 중/.test(document.querySelector('[data-scroll-pane="judgment"]').innerText) }))
    t.check(`${tool}: 요청 중 교체 → 늦은 응답 버림(해설 버튼 그대로 · 로딩 아님)`, Boolean(await revealBtn(page)) && !late.loading && late.calls === 1, late)
  }

  // ③ 원문 버튼 접근성 이름에 실제 문장이 들어간다(P1-03) — Chromium 접근성 트리
  await t.open('?tool=irrelevant')
  const names = await page.evaluate(() => [...document.querySelectorAll('[data-unit][role="button"]')].slice(0, 3).map((el) => ({ id: el.getAttribute('data-unit'), aria: el.getAttribute('aria-label'), text: el.textContent ?? '' })))
  // Chromium 접근성 트리(CDP) — 계산된 접근성 이름을 읽는다(음성 스크린리더 청취는 아니다)
  const cdp = await page.context().newCDPSession(page)
  const { nodes } = await cdp.send('Accessibility.getFullAXTree')
  const unitButtons = nodes.filter((n) => n.role?.value === 'button').map((n) => String(n.name?.value ?? '')).filter((n) => /^\d+번 문장/.test(n))
  t.check('원문 버튼: aria-label 로 덮어쓰지 않음', names.every((n) => n.aria === null), names.map((n) => n.aria))
  t.check('원문 버튼: 접근성 이름 = 번호 + 실제 영어 문장', unitButtons.length > 0 && unitButtons.every((n) => /[A-Za-z]{4,}/.test(n)), unitButtons.slice(0, 3))

  // ④ 공개 뒤 근거 링크 44px(P2-01)
  for (const tool of ['irrelevant', 'mood', 'info', 'grammar', 'order']) {
    await t.open(`?tool=${tool}`)
    await (await revealBtn(page)).click()
    await page.waitForSelector('[data-ref]', { timeout: 8000 }).catch(() => null)
    const sizes = await page.evaluate(() => [...document.querySelectorAll('[data-ref]')].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] }).filter(([w, h]) => w > 0 && h > 0))
    t.check(`${tool}: 공개 뒤 근거 링크 ≥44×44`, sizes.length > 0 && sizes.every(([w, h]) => w >= 44 && h >= 44), { n: sizes.length, small: sizes.filter(([w, h]) => w < 44 || h < 44).slice(0, 5) })
    if (tool === 'irrelevant') await t.shot('refs-44')
  }

  // ⑤ 키보드로 해설을 열거나 실패해도 포커스가 body 로 떨어지지 않는다(T-0151 디자인 수용 측정에서 발견) — 5개 도구
  for (const tool of ['info', 'irrelevant', 'order', 'grammar', 'mood']) {
    for (const q of ['', '&fail=1']) {
      await t.open(`?tool=${tool}${q}`)
      await (await revealBtn(page)).focus()
      await page.keyboard.press('Enter')
      await page.waitForFunction(() => !/불러오는 중/.test(document.querySelector('[data-scroll-pane="judgment"]').innerText), null, { timeout: 8000 })
      await page.waitForTimeout(250)
      const f = await page.evaluate(() => { const a = document.activeElement; return { body: !a || a === document.body, inShell: Boolean(a?.closest('[data-judgment-shell]')), mark: a ? [...a.attributes].map((x) => x.name).filter((n) => n.startsWith('data-')).join(',') : null } })
      t.check(`${tool}${q ? ' 실패' : ' 공개'}: 키보드 상태 변경 뒤 포커스가 판단 도구 안에 남는다`, !f.body && f.inShell, f)
    }
  }

  // ⑥ 로딩 중 포커스 · 공개 전후 판단면 스크롤 · 중복 요청 차단 · 문항 재마운트(사용자 T-0151 마무리 지시 2항)
  const paneTop = () => page.evaluate(() => document.querySelector('[data-scroll-pane="judgment"]').scrollTop)
  for (const tool of ['info', 'irrelevant', 'order', 'grammar', 'mood']) {
    await t.open(`?tool=${tool}&delay=1500`)
    const btn = await revealBtn(page)
    await btn.scrollIntoViewIfNeeded()
    const before = await paneTop()
    await btn.focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    const during = await page.evaluate(() => { const a = document.activeElement; return { body: !a || a === document.body, inShell: Boolean(a?.closest('[data-judgment-shell]')) } })
    t.check(`${tool}: 로딩 중에도 포커스가 판단 도구 안에 남는다`, !during.body && during.inShell, during)
    await page.keyboard.press('Enter') // 로딩 중 재요청
    await page.waitForFunction(() => !/불러오는 중/.test(document.querySelector('[data-scroll-pane="judgment"]').innerText), null, { timeout: 8000 })
    await page.waitForTimeout(250)
    t.check(`${tool}: 로딩 중 재요청은 provider 를 다시 부르지 않는다`, (await page.evaluate(() => window.__REVEAL_CALLS__)) === 1, await page.evaluate(() => window.__REVEAL_CALLS__))
    const after = await paneTop()
    t.check(`${tool}: 공개로 포커스를 옮겨도 판단면 스크롤은 그대로(preventScroll)`, Math.abs(after - before) <= 2, { before, after })
    // 문항 재마운트 — 이전 문항의 포커스 대상이 분리된 노드로 남지 않고, 이전 해설이 없다
    await page.evaluate(() => window.__SWAP__())
    await page.waitForTimeout(300)
    const re = await page.evaluate(() => { const a = document.activeElement; return { detached: Boolean(a && !a.isConnected), revealed: Boolean(document.querySelector('[data-revealed]')), top: document.querySelector('[data-scroll-pane="judgment"]').scrollTop } })
    t.check(`${tool}: 문항 재마운트 뒤 분리된 포커스 없음 · 이전 해설 없음`, !re.detached && !re.revealed, re)
  }
}
