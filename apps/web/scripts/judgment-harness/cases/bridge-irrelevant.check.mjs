// apps/web/scripts/judgment-harness/cases/bridge-irrelevant.check.mjs
// 제품 연결부(TypeJudgment + judgmentRouteProvider) 격리 검사 — 라우트는 가짜, 서버 공개 제어 · 노출 원장 · 인증은 검증하지 않는다.
export async function check(page, t) {
  await t.open('')
  t.check('연결부: 마운트 직후 라우트 호출 0', (await page.evaluate(() => window.__REVEAL_CALLS__)) === 0)
  t.check('연결부: 초기 DOM 에 공개 자료 없음', !(await page.$('[data-revealed]')))
  await t.shot('initial')

  // 키보드로 해설 요청
  await page.focus('[data-reveal-btn]')
  await page.keyboard.press('Enter')
  await page.waitForSelector('[data-revealed]')
  const req = await page.evaluate(() => ({ calls: window.__REVEAL_CALLS__, first: window.__ROUTE_BODIES__[0] }))
  t.check('연결부: 학습자 요청 1회 = 라우트 POST 1회', req.calls === 1, req.calls)
  t.check('연결부: 라우트 본문 = 판본 · uuid · judgment_scene', /\/api\/csat\/item\/[^/]+\/judgment$/.test(req.first.url) && Number.isInteger(req.first.body.analysisVersion) && /^[0-9a-f-]{36}$/.test(req.first.body.clientExposureId) && req.first.body.source === 'judgment_scene', req.first)
  const ref = await page.$('[data-revealed] [data-ref]')
  if (ref) {
    const id = await ref.getAttribute('data-ref')
    await ref.click()
    t.check('연결부: 공개 뒤 근거 링크 → 원문 focus', (await page.getAttribute(`[data-unit="${id}"]`, 'data-state')) === 'focus', id)
  } else t.check('연결부: 공개 뒤 근거 링크 존재', false)
  await t.shot('revealed')

  for (const [code, reason] of [['401', 'auth'], ['409', 'version'], ['423', 'held'], ['503', 'fetch']]) {
    await t.open(`?route=${code}`)
    await page.click('[data-reveal-btn]')
    await page.waitForSelector('[data-reveal-error]')
    const got = await page.getAttribute('[data-reveal-error]', 'data-reveal-error')
    const text = await page.innerText('[data-reveal-error]')
    t.check(`연결부: 라우트 ${code} → ${reason} 문구 · 공개 자료 없음`, got === reason && text.length > 5 && !(await page.$('[data-revealed]')), { got, text })
  }

  // 같은 문항 재시도 = 같은 노출 id
  await t.open('?route=503')
  await page.click('[data-reveal-btn]'); await page.waitForSelector('[data-reveal-error]')
  await page.click('[data-reveal-btn]'); await page.waitForFunction(() => window.__REVEAL_CALLS__ === 2)
  const ids = await page.evaluate(() => window.__ROUTE_BODIES__.map((b) => b.body.clientExposureId))
  t.check('연결부: 재시도는 같은 노출 id(원장 멱등)', ids.length === 2 && ids[0] === ids[1], ids)

  // 도구 없는 유형은 아무것도 그리지 않는다
  await t.open('?type=R-CHART')
  t.check('연결부: 도구 없는 유형(R-CHART) → 렌더 없음', (await page.evaluate(() => document.querySelector('[data-judgment-empty] [data-slot]')?.childElementCount)) === 0)
}
