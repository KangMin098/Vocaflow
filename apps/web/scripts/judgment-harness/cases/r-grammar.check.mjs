// apps/web/scripts/judgment-harness/cases/r-grammar.check.mjs
// GrammarTool 격리 브라우저 검사 — 제품 E2E 가 아니다.
const LEAK = /data-revealed|data-compare|틀린 곳|어법상 맞다/

export async function check(page, t) {
  await t.open('')
  t.check('마운트 직후 공개 호출 0', (await page.evaluate(() => window.__REVEAL_CALLS__)) === 0)
  t.check('초기 DOM 에 정답 표지 없음', !LEAK.test(await page.$eval('#root', (e) => e.innerHTML)))
  await t.shot('initial')

  // 키보드만: ⑤ 지점 선택 → S 붓 → 낱말 표시 → V 붓 → 낱말 → 자리 판단 → 대안 판정
  const kb = async (sel) => { await page.focus(sel); await page.keyboard.press('Enter') }
  await kb('[data-mark="5"]')
  t.check('키보드로 ⑤ 선택', (await page.getAttribute('[data-mark="5"]', 'aria-pressed')) === 'true')
  const idx = await page.evaluate(() => {
    const toks = [...document.querySelectorAll('[data-tok]')]
    const f = (w) => toks.find((b) => b.textContent.replace(/[A-Z( )]+$/, '').startsWith(w))?.getAttribute('data-tok')
    return { things: f('things'), seized: f('seized') }
  })
  await kb('[data-brush="S"]')
  await kb(`[data-tok="${idx.things}"]`)
  await kb('[data-brush="V"]')
  await page.focus(`[data-tok="${idx.seized}"]`); await page.keyboard.press('Space')
  await kb('[data-need="rel-complete"]')
  await kb('[data-alt="rel:where"] [data-judg="holds"]')
  const roleS = await page.getAttribute(`[data-tok="${idx.things}"]`, 'data-role')
  const roleV = await page.getAttribute(`[data-tok="${idx.seized}"]`, 'data-role')
  t.check('키보드만으로 구조 표시·자리 판단·대안 판정', roleS === 'S' && roleV === 'V'
    && (await page.getAttribute('[data-need="rel-complete"]', 'aria-pressed')) === 'true'
    && (await page.getAttribute('[data-alt="rel:where"] [data-judg="holds"]', 'aria-pressed')) === 'true', { roleS, roleV })
  t.check('뒤 절 성분을 표시하면 「표지어 하나」 경고가 사라진다', (await page.$('[data-warn="no-structure"]')) === null)
  await kb('[data-span-inc]')
  t.check('밑줄 후보 범위 조정', (await page.textContent('[data-sentence]')) !== null && (await page.$$('[data-span]')).length === 2)

  // 반례: ④(G2) 이동 후 ⑤ 복귀 — 상태 보존
  await page.click('[data-mark="4"]')
  await page.click('[data-mark="5"]')
  t.check('지점 왕복 뒤 표시 상태 보존', (await page.getAttribute(`[data-tok="${idx.things}"]`, 'data-role')) === 'S')

  // 원문↔판단 왕복: 판단면 스크롤 뒤 원문 같은 문장 클릭
  const pane = '[data-scroll-pane="judgment"]'
  await page.$eval(pane, (el) => { el.scrollTop = 200 })
  const before = await page.$eval(pane, (el) => el.scrollTop)
  await page.click('[data-unit="u7"]')
  const after = await page.$eval(pane, (el) => el.scrollTop)
  t.check('원문 클릭 뒤 판단면 scrollTop 보존', before === after, { before, after })
  t.check('원문 클릭 뒤 선택 보존', (await page.getAttribute('[data-mark="5"]', 'aria-pressed')) === 'true'
    && (await page.getAttribute(`[data-tok="${idx.things}"]`, 'data-role')) === 'S')
  await page.click('[data-unit="u6"]')
  t.check('원문 문장 고르면 그 문장 지점(④)으로', (await page.getAttribute('[data-mark="4"]', 'aria-pressed')) === 'true')
  await page.click('[data-mark="5"]')

  // 해설
  await page.click('[data-reveal]')
  await page.waitForSelector('[data-revealed]')
  t.check('해설 보기 뒤 공개 호출 1', (await page.evaluate(() => window.__REVEAL_CALLS__)) === 1)
  t.check('공개 뒤 학습자 구조와 해설 나란히', (await page.textContent('[data-compare="5"]')).includes('things'))
  await page.click('[data-compare="5"] [data-ref="u7"], [data-revealed] [data-ref="u7"]')
  t.check('근거 링크 → 원문 u7 focus', (await page.getAttribute('[data-unit="u7"]', 'data-state')) === 'focus')
  await page.click('[data-mark="1"]')
  await page.click('[data-compare="1"] [data-ref="u1"]')
  t.check('오답 지점 how_to_reject 링크 → u1 focus', (await page.getAttribute('[data-unit="u1"]', 'data-state')) === 'focus')
  await t.shot('revealed')

  const heights = await page.$$eval('[data-mark],[data-brush],[data-need],[data-judg],[data-reveal],[data-tok],[data-span-inc]', (els) => els.map((e) => e.getBoundingClientRect().height))
  t.check('주요 버튼 높이 ≥44', heights.every((h) => h >= 44), Math.min(...heights))
  t.check('가로 스크롤 없음', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))

  await t.open('?reveal=fail')
  await page.click('[data-reveal]')
  await page.waitForSelector('[data-reveal-error="fetch"]')
  t.check('?reveal=fail 오류 문구', (await page.textContent('[data-reveal-error]')).includes('불러오지 못했다'))
  await t.open('?reveal=version')
  await page.click('[data-reveal]')
  await page.waitForSelector('[data-reveal-error="version"]')
  t.check('?reveal=version 오류 문구', (await page.textContent('[data-reveal-error]')).includes('판본'))
  t.check('판본 오류 시 근거 미노출', (await page.$('[data-revealed]')) === null)

  await t.open('?empty=1')
  t.check('?empty=1 자료 없음', (await page.$('[data-judgment-empty]')) !== null)

  await t.open('?item=1')
  t.check('?item=1 두 번째 문항(G1) — ④ is', (await page.textContent('[data-mark="4"]')).includes('is'))
  t.check('?item=1 공개 호출 0', (await page.evaluate(() => window.__REVEAL_CALLS__)) === 0)
  await page.click('[data-mark="4"]')
  const w = await page.evaluate(() => [...document.querySelectorAll('[data-tok]')].find((b) => b.textContent.startsWith('workout'))?.getAttribute('data-tok'))
  await page.click('[data-brush="S"]')
  await page.click(`[data-tok="${w}"]`)
  t.check('가까운 명사 반례 표시', (await page.$('[data-warn="near-noun"]')) !== null)
  await t.shot('item1')
}
