// apps/web/tests/e2e/60-csat-ec-pilot-flow.spec.ts
//
// 오답 원인 Pilot G6 준비 ⑥ — 참가자 화면 흐름(PILOT_PROTOCOL §5 수집 흐름 · §18 마지막 smoke). PC 데스크톱 뷰포트만.
//   ① 전체: 저장 → 결과 보류(점수 · 정답 · 해설 없음) → held → collecting → 확인 → 막힌 곳 · 이유 → 해석 → 범주 → 서버 감지기
//      → targeted probe → 응답 → 수집 완료 → 결과 공개
//   ② 변형: probe 건너뛰기 · 해석 「잘 모르겠어요」(probe 없음) · 범주 없음(probe 없음)
//   ③ 증거 정정: 미응답 probe 가 정정 뒤 대기에서 사라진다 · 「나중에 하기」는 보류 유지
// 경계 · probe · 범주는 DB 봉인 v0.1 에서 읽는다. 감지기는 서버(DB)가 돌린다 — 테스트는 신호를 넣지 않는다.
// 수집 대상은 저장 때 봉인된 목록(정오 무관)을 학습자 RPC 로 읽어 맞춘다 — 틀린 문항 번호를 가정하지 않는다.
// 실행: scripts/csat/pilot/run-e2e.mjs(계정 생성 · 서버 · 정리 · 기록). 각 테스트는 수집을 닫고(묘비 방지) 계정을 지운다.
import { expect, test, type Page } from '@playwright/test'

import { PROBE_DEFINITIONS } from '../../src/lib/csat/ec-pilot/probes'
import {
  EXAMS, FORBIDDEN, WRONG, account, captureStatus, closeAndDrop, confirmTwo, currentItem, evidenceKinds, fillItem, learner, login,
  nextPhase, pendingProbes, ready, sealedBoundary, sealedTargets, submitAsParticipant, submitRecord,
} from './utils/ec-pilot'

test.skip(!ready('pilot'), '러너(scripts/csat/pilot/run-e2e.mjs)의 pilot 단계에서만 돈다')
test.use({ viewport: { width: 1440, height: 900 } })

const probeOf = (key: string) => PROBE_DEFINITIONS.filter((d) => d.key === key).at(-1)!

async function answerProbe(page: Page, key: string, option: 'A' | 'B' | 'C' | 'D' | null) {
  const d = page.getByRole('dialog')
  const def = probeOf(key)
  await expect(d.getByText(def.question)).toBeVisible()
  expect(await d.innerText()).not.toMatch(FORBIDDEN)
  if (option) {
    await d.getByRole('radiogroup', { name: def.question }).getByRole('radio', { name: def.options[option] }).click()
    await d.getByRole('button', { name: '다음', exact: true }).click()
  } else {
    await d.getByRole('button', { name: '건너뛰기', exact: true }).click()
  }
  await expect(d.getByText(def.question)).toHaveCount(0, { timeout: 30_000 })
}

/** 남은 대상을 모두 「경계 밖 범주 + 해석」으로 채운다. 지나간 문항 번호를 돌려준다 */
async function fillRest(page: Page, outside: string, prev: number): Promise<number[]> {
  const seen: number[] = []
  let last = prev
  for (;;) {
    const ph = await nextPhase(page, last)
    if (ph === 'result') return seen
    expect(ph).toBe('item')
    last = await currentItem(page)
    seen.push(last)
    await fillItem(page, { reason: '보기 중에서 가장 그럴듯해 보여서 골랐어요', interp: '그 문장을 앞 내용의 예시로 읽었어요', group: outside })
  }
}

async function expectRevealed(page: Page, sessionId: string) {
  await expect(page.getByText('이번 시험 결과')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText(`45문항 중 ${45 - WRONG.length}문항 맞음`)).toBeVisible()
  const r = await page.evaluate(async (id) => { const x = await fetch(`/api/csat/diagnosis/sessions/${id}/result`); return { status: x.status, body: await x.text() } }, sessionId)
  expect(r.status).toBe(200)
  expect(r.body).toContain('"raw"')
}

test('① 전체 흐름 — 보류 → 수집 → 감지기 probe → 응답 → 완료 → 공개', async ({ page }) => {
  test.setTimeout(300_000)
  const me = account('full')!
  let sid: string | null = null
  try {
    const c = await learner(me)
    const b = await sealedBoundary(c)

    // held 를 눈으로 보려고 수집 화면의 첫 조회(held → collecting 을 일으킨다)를 잠시 붙잡는다
    let release!: () => void
    const hold = new Promise<void>((r) => { release = r })
    await page.route('**/api/csat/ec/capture?session=*', async (route) => { await hold; await route.fallback().catch(() => {}) })
    await login(page, me)
    await submitRecord(page, EXAMS.full)
    await page.waitForURL(/capture=/, { timeout: 60_000 })
    sid = new URL(page.url()).searchParams.get('capture')!
    expect(await captureStatus(c, sid)).toBe('held')
    // 보류 중 — 결과 API 423 · 점수 없음 · 화면에 점수 없음
    const r0 = await page.evaluate(async (id) => { const x = await fetch(`/api/csat/diagnosis/sessions/${id}/result`); return { status: x.status, body: await x.text() } }, sid)
    expect(r0.status).toBe(423)
    expect(JSON.parse(r0.body)).toEqual({ held: 'exam_embargo' })
    await expect(page.getByText(/45문항 중 \d+문항 맞음/)).toHaveCount(0)
    release()
    await expect(page.getByText('풀이를 조금만 더 알려 주세요')).toBeVisible({ timeout: 60_000 })
    await expect.poll(() => captureStatus(c, sid!), { timeout: 30_000 }).toBe('collecting')
    await page.unroute('**/api/csat/ec/capture?session=*')
    const targets = await sealedTargets(c, sid)
    expect(targets.length).toBeGreaterThan(0)

    await confirmTwo(page)

    // 첫 대상 — 막힌 문장 · 이유 · 해석 · 경계 범주 → 서버 감지기 → probe
    expect(await nextPhase(page)).toBe('item')
    const first = await currentItem(page)
    expect(first).toBe(targets[0])
    await fillItem(page, { blockFirst: true, reason: '앞 문장과 같은 방향이라고 생각해서 골랐어요', interp: '그 단어를 원래 뜻 그대로 읽었어요', group: b.groupA })
    expect(await nextPhase(page, first)).toBe('probe')
    expect((await pendingProbes(c, sid)).map((p) => `${p.item_no}:${p.probe_key}`)).toEqual([`${first}:${b.probeKey}`])
    await answerProbe(page, b.probeKey, 'B')
    expect(await pendingProbes(c, sid)).toHaveLength(0)

    // 나머지 대상 — 경계 밖 범주 → probe 없음 → 결과 공개
    const rest = await fillRest(page, b.outside, first)
    expect([first, ...rest]).toEqual(targets)
    await expectRevealed(page, sid)
    expect(await captureStatus(c, sid)).toBe('completed')

    const kinds = await evidenceKinds(c, sid)
    expect(kinds).toEqual(expect.arrayContaining([`${first}:blocked_span:`, `${first}:interpretation:answered`, `${first}:category:${b.groupA}`, `${first}:targeted_probe:B`]))
    expect(kinds.filter((k) => k.includes(':targeted_probe:'))).toHaveLength(1)
  } finally {
    await closeAndDrop(page, me, sid)
  }
})

test('② probe 건너뛰기 · 해석 「잘 모르겠어요」 · 범주 없음', async ({ page }) => {
  test.setTimeout(300_000)
  const me = account('variants')!
  let sid: string | null = null
  try {
    const c = await learner(me)
    const b = await sealedBoundary(c)
    await login(page, me)
    sid = await submitAsParticipant(page, EXAMS.variants)
    const targets = await sealedTargets(c, sid)
    expect(targets.length).toBeGreaterThanOrEqual(3)
    await confirmTwo(page)

    // 경계 범주 + 해석 → probe → 건너뛰기
    expect(await nextPhase(page)).toBe('item')
    const t1 = await currentItem(page)
    await fillItem(page, { reason: '문맥상 이 뜻이 자연스러워 보여서 골랐어요', interp: '그 표현을 비유로 읽었어요', group: b.groupB })
    expect(await nextPhase(page, t1)).toBe('probe')
    await answerProbe(page, b.probeKey, null)

    // 경계 범주여도 해석 「잘 모르겠어요」 → probe 없음
    expect(await nextPhase(page, t1)).toBe('item')
    const t2 = await currentItem(page)
    await fillItem(page, { reason: '확신은 없지만 이게 맞아 보였어요', interp: 'unknown', group: b.groupA })
    expect(await nextPhase(page, t2)).not.toBe('probe')
    expect((await pendingProbes(c, sid)).some((p) => p.item_no === t2)).toBe(false)

    // 범주를 고르지 않음 → probe 없음
    const t3 = await currentItem(page)
    await fillItem(page, { reason: '글의 마지막 문장을 보고 골랐어요', interp: '마지막 문장을 결론으로 읽었어요', group: null })
    expect(await nextPhase(page, t3)).not.toBe('probe')
    expect(await pendingProbes(c, sid)).toHaveLength(0)
    await fillRest(page, b.outside, t3)
    await expectRevealed(page, sid)

    const kinds = await evidenceKinds(c, sid)
    expect(kinds).toEqual(expect.arrayContaining([`${t1}:targeted_probe:skipped`, `${t2}:interpretation:unknown`, `${t3}:interpretation:answered`]))
    expect(kinds.some((k) => k.startsWith(`${t3}:category:`))).toBe(false)
    expect(kinds.some((k) => k.startsWith(`${t2}:targeted_probe:`) || k.startsWith(`${t3}:targeted_probe:`))).toBe(false)
  } finally {
    await closeAndDrop(page, me, sid)
  }
})

test('③ 증거 정정 — 미응답 probe 가 사라진다 · 「나중에 하기」는 보류 유지', async ({ page }) => {
  test.setTimeout(300_000)
  const me = account('correction')!
  let sid: string | null = null
  try {
    const c = await learner(me)
    const b = await sealedBoundary(c)
    await login(page, me)
    sid = await submitAsParticipant(page, EXAMS.correction)
    await confirmTwo(page)

    expect(await nextPhase(page)).toBe('item')
    const t1 = await currentItem(page)
    await fillItem(page, { reason: '단어 뜻을 그대로 적용해서 골랐어요', interp: '그 단어를 사전 뜻으로 읽었어요', group: b.groupB })
    expect(await nextPhase(page, t1)).toBe('probe')
    expect((await pendingProbes(c, sid)).some((p) => p.item_no === t1)).toBe(true)

    // 답하지 않고 창을 닫는다(수집 화면의 닫기) — 수집은 열린 채, 결과는 보류
    await page.getByRole('dialog').getByRole('link', { name: '닫기' }).click()
    await expect(page.getByText('풀이를 조금만 더 알려 주세요')).toHaveCount(0, { timeout: 30_000 })
    expect(await captureStatus(c, sid)).toBe('collecting')

    // 같은 문항의 범주를 경계 밖으로 정정(앱 API · 본인 브라우저) → 미응답 probe 취소
    const fix = await page.evaluate(async ([id, no, group]) => {
      const x = await fetch('/api/csat/ec/evidence', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: id, itemNo: no, evidence: { kind: 'category', group } }) })
      return x.status
    }, [sid, t1, b.outside] as const)
    expect(fix).toBe(200)
    await expect.poll(async () => (await pendingProbes(c, sid!)).some((p) => p.item_no === t1), { timeout: 15_000 }).toBe(false)
    const probes = await page.evaluate(async (id) => (await fetch(`/api/csat/ec/probes?session=${id}`)).json(), sid)
    expect((probes as { probes: { itemNo: number }[] }).probes.some((p) => p.itemNo === t1)).toBe(false)

    // 다시 열면 그 probe 없이 다음 문항부터
    await page.goto(`/csat/diagnosis?tab=records&capture=${sid}`)
    expect(await nextPhase(page)).toBe('item')
    const t2 = await currentItem(page)
    expect(t2).not.toBe(t1)

    // 「나중에 하기」 — 결과는 계속 보류(안내만 · 점수 없음)
    await page.getByRole('dialog').getByRole('button', { name: '나중에 하기' }).click()
    await expect(page.getByText('이 회차의 결과는 풀이 기록을 다 남긴 뒤에 열려요', { exact: false })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/45문항 중 \d+문항 맞음/)).toHaveCount(0)
    expect(await captureStatus(c, sid)).toBe('collecting')

    // 이어서 끝내기
    await page.goto(`/csat/diagnosis?tab=records&capture=${sid}`)
    await fillRest(page, b.outside, -1)
    await expectRevealed(page, sid)
    const kinds = await evidenceKinds(c, sid)
    expect(kinds).toContain(`${t1}:category:${b.outside}`)
    expect(kinds.some((k) => k.startsWith(`${t1}:targeted_probe:`))).toBe(false)
  } finally {
    await closeAndDrop(page, me, sid)
  }
})
