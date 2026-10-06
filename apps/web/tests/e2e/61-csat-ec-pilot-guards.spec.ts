// apps/web/tests/e2e/61-csat-ec-pilot-guards.spec.ts
//
// 오답 원인 Pilot G6 준비 ⑥ — 우회 · 회귀 가드(REVEAL_GATE_DESIGN G3 · PILOT_PROTOCOL §18). PC 데스크톱 뷰포트만.
//   ④ reveal 우회 차단: 보류 중 참가자 · 다른 계정이 결과 API · 해설 페이지 · 강의(문항 해설) API · reveal API · state API 를
//      직접 열면 423 · 보류 안내, 정답 · 점수 글자 없음(브라우저 컨텍스트 fetch). 참가자 계정이 사라지면 해제.
//   ⑤ TEST taxonomy 차단: 앱 설정 v0.1 · DB 봉인 note 에 TEST 없음(그래서 열린다) · TEST 버전(v99.*)의 신호는 학생 화면 · probe API 에
//      나오지 않는다(설정 · note 관문 자체는 단위 테스트 ec-pilot.test.ts 가 덮는다 — 여기서는 앱 경로 한 번).
//   ⑥ 비참가자 회귀: 같은 화면에서 저장 즉시 결과 · 수집 화면 없음 · 수집 API 404.
import { expect, test, type Page } from '@playwright/test'

import {
  EXAMS, FORBIDDEN, TAXONOMY, WRONG, account, closeAndDrop, completeViaApi, confirmTwo, currentItem, dropAccount, fillItem, learner, login,
  nextPhase, ready,
  sealedBoundary, submitAsParticipant, submitRecord, svc,
} from './utils/ec-pilot'

test.skip(!ready('pilot'), '러너(scripts/csat/pilot/run-e2e.mjs)의 pilot 단계에서만 돈다')
test.use({ viewport: { width: 1440, height: 900 } })

const ANSWER_TEXT = /정답|해설|why_correct|"answer"|"raw"|"wrong"|점수/

async function probeApis(page: Page, sessionId: string | null, slug: string) {
  return page.evaluate(async ([id, item]) => {
    const get = async (url: string, init?: RequestInit) => { const x = await fetch(url, init); return { url, status: x.status, body: await x.text() } }
    const out = [
      await get(`/api/csat/lecture?item=${item}`),
      await get('/api/csat/session/reveal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ item }) }),
      await get('/api/csat/state'),
    ]
    if (id) out.unshift(await get(`/api/csat/diagnosis/sessions/${id}/result`))
    return out
  }, [sessionId, slug] as const)
}

function expectHeld(rs: { url: string; status: number; body: string }[]) {
  for (const r of rs) {
    if (r.url === '/api/csat/state') {
      // 본인 기기 기록 — 없거나(새 계정) 보류 문항 정오를 뺀 것만. 423 도 허용(fail-closed)
      expect([200, 423], r.url).toContain(r.status)
      expect(r.body, r.url).not.toMatch(/"correct"\s*:\s*(true|false)/)
      continue
    }
    expect(r.status, r.url).toBe(423)
    expect(JSON.parse(r.body), r.url).toEqual({ held: 'exam_embargo' })
  }
}

async function expectItemPageHeld(page: Page, slug: string) {
  await page.goto(`/csat/item/${slug}`)
  await expect(page.getByText('이 회차의 해설은 지금 잠시 닫혀 있어요')).toBeVisible({ timeout: 30_000 })
  const text = await page.locator('body').innerText()
  expect(text).not.toMatch(/정답\s*[①②③④⑤1-5]/)
}

test('④ reveal 우회 차단 — 참가자 · 다른 계정 모두 423 · 보류 안내, 수집 완료 뒤 해제', async ({ page, browser }) => {
  test.setTimeout(300_000)
  const me = account('bypass')!, other = account('other')!
  let sid: string | null = null
  const exam = EXAMS.bypass, slug = `${exam}-${WRONG[0]}`
  const otherCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  try {
    await login(page, me)
    const sessionId = await submitAsParticipant(page, exam)
    sid = sessionId
    // 수집 화면이 열린 상태(collecting) — 보류는 그대로
    await expect(page.getByRole('radiogroup', { name: /시간을 재고 풀었나요/ })).toBeVisible({ timeout: 30_000 })
    expectHeld(await probeApis(page, sessionId, slug))
    // 기록 보드(수집 화면 밖)에도 점수가 없다
    await page.goto('/csat/diagnosis?tab=records')
    await expect(page.getByText(/45문항 중 \d+문항 맞음/)).toHaveCount(0)
    await expectItemPageHeld(page, slug)

    // 다른 로그인 계정 — 전역 보류(요청자 무관)
    const op = await otherCtx.newPage()
    await login(op, other)
    const theirs = await probeApis(op, sessionId, slug)
    // 남의 기록 결과는 404(본인 아님) 또는 423 — 어느 쪽이든 점수는 없다
    expect([404, 423]).toContain(theirs[0].status)
    expect(theirs[0].body).not.toMatch(ANSWER_TEXT)
    expectHeld(theirs.slice(1))
    await expectItemPageHeld(op, slug)

    // 참가자가 수집을 마치면(completed) 보류 해제 — 다른 계정에 해설이 다시 열리고, 참가자 결과도 열린다
    expect(await completeViaApi(page, sessionId)).toBe('completed')
    await op.goto(`/csat/item/${slug}`)
    await expect(op.getByText('이 회차의 해설은 지금 잠시 닫혀 있어요')).toHaveCount(0, { timeout: 30_000 })
    const lec = await op.evaluate(async (item) => (await fetch(`/api/csat/lecture?item=${item}`)).status, slug)
    expect(lec).not.toBe(423)
    const mine = await page.evaluate(async (id) => (await fetch(`/api/csat/diagnosis/sessions/${id}/result`)).status, sessionId)
    expect(mine).toBe(200)
  } finally {
    await otherCtx.close()
    await closeAndDrop(page, me, sid)
    await dropAccount(other)
  }
})

test('⑤ TEST taxonomy — v0.1 만 열리고 v99 신호는 학생 화면에 나오지 않는다', async ({ page }) => {
  test.setTimeout(300_000)
  const me = account('taxonomy')!
  let sid: string | null = null
  try {
    const c = await learner(me)
    const b = await sealedBoundary(c)
    // DB 사실: 설정 버전(v0.1)은 봉인 · note 에 TEST 없음, TEST 버전은 note 에 TEST
    const { data: vs, error } = await c.from('csat_ec_taxonomy_version').select('version, status, note')
    expect(error).toBeNull()
    const v01 = (vs ?? []).find((v) => v.version === TAXONOMY)!
    expect(v01.note ?? '').not.toMatch(/TEST/)
    const tests = (vs ?? []).filter((v) => /^v99\./.test(v.version as string))
    expect(tests.length).toBeGreaterThan(0)
    for (const t of tests) expect(t.note ?? '').toMatch(/TEST/)
    const testVersion = tests[0].version as string
    const { data: tb } = await c.from('csat_ec_boundary').select('boundary_key').eq('version', testVersion).not('probe_key', 'is', null).limit(1)

    await login(page, me)
    const sessionId = await submitAsParticipant(page, EXAMS.taxonomy)
    sid = sessionId
    await confirmTwo(page)
    const t1 = await currentItem(page)

    // service 가 TEST 버전 신호를 넣어 본다 — DB 가 거부하거나, 넣어져도 앱이 거른다
    let inserted = false
    if (tb?.[0]) {
      const sig = await svc().rpc('csat_ec_add_detector_signal', { p_session: sessionId, p_item_no: t1, p_taxonomy: testVersion, p_boundary_key: tb[0].boundary_key,
        p_detector_version: 'e2e-test-taxonomy', p_probe_required: true, p_evidence_ids: [] })
      inserted = !sig.error
    }
    const probes = await page.evaluate(async (id) => (await fetch(`/api/csat/ec/probes?session=${id}`)).json(), sessionId)
    expect((probes as { probes: { itemNo: number }[] }).probes).toHaveLength(0)
    await fillItem(page, { reason: '다른 선지가 너무 강하게 말해서 골랐어요', interp: '그 문장을 일반론으로 읽었어요', group: b.outside })
    expect(await nextPhase(page, t1)).toBe('item')
    expect(await page.getByRole('dialog').innerText()).not.toMatch(FORBIDDEN)
    test.info().annotations.push({ type: 'v99-signal', description: inserted ? 'DB 가 받았고 앱이 걸렀다' : 'DB 가 거부했다' })
  } finally {
    await closeAndDrop(page, me, sid)
  }
})

test('⑥ 비참가자 — 저장 즉시 결과 · 수집 화면 없음 · 수집 API 404', async ({ page }) => {
  test.setTimeout(200_000)
  const me = account('nonparticipant')!
  try {
    await login(page, me)
    await submitRecord(page, EXAMS.nonparticipant)
    await expect(page.getByText(`45문항 중 ${45 - WRONG.length}문항 맞음`)).toBeVisible({ timeout: 60_000 })
    expect(page.url()).not.toContain('capture=')
    await expect(page.getByText('풀이를 조금만 더 알려 주세요')).toHaveCount(0)
    const st = await page.evaluate(async () => (await fetch(`/api/csat/ec/capture?session=${crypto.randomUUID()}`)).status)
    expect(st).toBe(404)
  } finally {
    await dropAccount(me)
  }
})
