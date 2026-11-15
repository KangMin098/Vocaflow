// apps/web/scripts/judgment-harness/cases/r-summary.check.mjs
// SummaryTool 격리 브라우저 검사 — 제품 E2E 가 아니다.
export async function check(page, t) {
  await t.open('')
  const calls0 = await page.evaluate(() => window.__REVEAL_CALLS__)
  const leak = await page.evaluate(() => ({ body: Boolean(document.querySelector('[data-reveal-body]')), word: /정답|오답/.test(document.body.innerText) }))
  t.check('마운트 직후 공개 호출 0 · 정답 표지 없음', calls0 === 0 && !leak.body && !leak.word, { calls0, leak })
  t.check('요약문 원문 분리 표시', await page.locator('[data-summary]').count() === 1, null)
  await t.shot('initial')

  // 키보드만: 후보어 선택(Enter) → 원문 문장 지지 잇기(Enter) → 반박 모드(Space) → (B) 선택(Space)
  await page.locator('[data-cand="A:effective"]').focus()
  await page.keyboard.press('Enter')
  await page.locator('[data-unit="u8"]').focus()
  await page.keyboard.press('Enter')
  await page.locator('[data-unit="u9"]').focus()
  await page.keyboard.press(' ')
  await page.locator('[data-rel="refute"]').focus()
  await page.keyboard.press(' ')
  await page.locator('[data-unit="u7"]').focus()
  await page.keyboard.press('Enter')
  await page.locator('[data-pol="pos"]').focus()
  await page.keyboard.press('Enter')
  await page.locator('[data-cand="B:success"]').focus()
  await page.keyboard.press(' ')
  const kb = await page.evaluate(() => ({
    u8: document.querySelector('[data-unit="u8"]')?.getAttribute('aria-pressed'),
    combo: document.querySelector('[data-combo]')?.getAttribute('data-combo'),
    a: document.querySelector('[data-cand="A:effective"]')?.getAttribute('aria-pressed'),
    b: document.querySelector('[data-cand="B:success"]')?.getAttribute('aria-pressed'),
    label: document.querySelector('[data-cand="A:effective"]')?.getAttribute('aria-label'),
  }))
  t.check('키보드만으로 칸 선택·근거 잇기·조합 표시', kb.a === 'true' && kb.b === 'true' && kb.combo === '2' && /지지 2 · 반박 1/.test(kb.label ?? ''), kb)
  await t.shot('judged')

  // 다시 (A) 후보로 돌아가 원문 왕복
  await page.locator('[data-cand="A:discouraging"]').click()
  await page.locator('[data-cand="A:effective"]').click()
  const pane = page.locator('[data-scroll-pane="judgment"]')
  await pane.evaluate((el) => { el.scrollTop = Math.min(120, el.scrollHeight - el.clientHeight) })
  const before = await pane.evaluate((el) => el.scrollTop)
  await page.locator('[data-links="지지"] button').first().click()
  await page.locator('[data-unit="u3"]').click()
  await page.locator('[data-unit="u3"]').click()
  const after = await pane.evaluate((el) => el.scrollTop)
  const kept = await page.evaluate(() => ({
    a: document.querySelector('[data-slot="A"]')?.textContent,
    b: document.querySelector('[data-slot="B"]')?.textContent,
    u8: document.querySelector('[data-unit="u8"]')?.getAttribute('data-state'),
  }))
  t.check('원문↔판단 왕복 시 선택 상태·판단면 scrollTop 보존', after === before && /effective/.test(kept.a ?? '') && /success/.test(kept.b ?? ''), { before, after, kept })

  // 해설 보기 → 근거 링크 → 원문 focus
  await page.locator('[data-reveal]').click()
  await page.waitForSelector('[data-reveal-body]')
  const ref = page.locator('[data-reveal-body] [data-ref]').first()
  const refId = await ref.getAttribute('data-ref')
  await ref.click()
  const st = await page.locator(`[data-scroll-pane="evidence"] [data-unit="${refId}"]`).getAttribute('data-state')
  t.check('해설 근거 링크 → 원문 단위 focus', st === 'focus', { refId, st })
  t.check('공개 뒤 내 선택 대조표', await page.locator('[data-reveal-body] table').count() === 1, null)
  await t.shot('revealed')

  await t.open('?reveal=fail')
  await page.locator('[data-reveal]').click()
  await page.waitForSelector('[data-reveal-status="error"]')
  t.check('?reveal=fail 오류 문구', /불러오지 못했다/.test(await page.locator('[data-reveal-status]').innerText()), null)

  await t.open('?reveal=version')
  await page.locator('[data-reveal]').click()
  await page.waitForSelector('[data-reveal-status="error"]')
  t.check('?reveal=version 판본 오류 · 근거 미표시', /판본/.test(await page.locator('[data-reveal-status]').innerText()) && await page.locator('[data-reveal-body]').count() === 0, null)

  await t.open('?empty=1')
  t.check('?empty=1 빈 상태', await page.locator('[data-judgment-empty]').count() === 1, null)

  await t.open('?item=1')
  const h = await page.locator('[data-scroll-pane="evidence"] h2').innerText()
  t.check('?item=1 — 두 번째 문항이 없어 첫 문항(H1906G1#40)으로 대체', /H1906G1 40번/.test(h), h)

  await t.open('')
  await page.locator('[data-cand="A:effective"]').click()
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('[data-cand],[data-reveal],[data-rel],[data-pol],[data-links] button')]
      .map((b) => ({ k: b.getAttribute('data-cand') ?? b.textContent, h: b.getBoundingClientRect().height }))
      .filter((x) => x.h < 44),
  )
  t.check('주요 버튼 높이 ≥44', small.length === 0, small)
  const sw = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
  t.check('가로 스크롤 없음', sw.sw <= sw.cw, sw)
}
