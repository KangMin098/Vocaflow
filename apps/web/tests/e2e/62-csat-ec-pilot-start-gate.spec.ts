// apps/web/tests/e2e/62-csat-ec-pilot-start-gate.spec.ts
//
// 오답 원인 Pilot G6 준비 ⑥ — 시작 게이트(미봉인 → 거부) 자리.
// 시작 게이트(run 메타 봉인 · live 해시 일치 때만 실제 v0.1 Pilot 이 열림)는 다른 브랜치(feat/ec-pilot-gate)에서 만든다.
// 이 파일은 게이트 내부 구현에 기대지 않고 **지금의 닫힘 동작**만 본다: 서버의 실제 참가자 설정(CSAT_EC_PILOT_USER_IDS)이 비어 있으면
// 어떤 계정이 기록을 저장해도 수집이 열리지 않는다 — 저장 즉시 결과 · 수집 화면 없음 · 수집 API 전부 404.
// 러너가 참가자 env 를 비운 서버로 따로 띄운 gate 단계에서만 돈다. 게이트가 합쳐지면 「봉인 전 = 같은 404」 단정을 여기에 더한다.
import { expect, test } from '@playwright/test'

import { EXAMS, WRONG, account, dropAccount, login, ready, submitRecord } from './utils/ec-pilot'

test.skip(!ready('gate'), '러너(scripts/csat/pilot/run-e2e.mjs)의 gate 단계(참가자 env 비움)에서만 돈다')
test.use({ viewport: { width: 1440, height: 900 } })

test('참가자 설정이 비어 있으면 수집이 열리지 않는다 — 저장 즉시 결과 · 수집 API 404', async ({ page }) => {
  test.setTimeout(200_000)
  // 러너가 gate 단계마다 다른 계정을 준다(이 spec 은 끝에 계정을 지운다) — gate: 참가자 env 비움 · gate2: env 에 있으나 모드 · 봉인 run 없음
  const me = account(process.env.EC_E2E_GATE_ROLE ?? 'gate')!
  try {
    await login(page, me)
    await submitRecord(page, EXAMS.gate)
    await expect(page.getByText(`45문항 중 ${45 - WRONG.length}문항 맞음`)).toBeVisible({ timeout: 60_000 })
    expect(page.url()).not.toContain('capture=')
    await expect(page.getByText('풀이를 조금만 더 알려 주세요')).toHaveCount(0)
    const statuses = await page.evaluate(async (itemNo) => {
      const id = crypto.randomUUID()
      const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.status)
      return {
        capture: await fetch(`/api/csat/ec/capture?session=${id}`).then((r) => r.status),
        probes: await fetch(`/api/csat/ec/probes?session=${id}`).then((r) => r.status),
        finish: await post('/api/csat/ec/capture', { session: id, action: 'finish' }),
        evidence: await post('/api/csat/ec/evidence', { sessionId: id, itemNo, evidence: { kind: 'interpretation', state: 'unknown' } }),
        confirm: await post('/api/csat/ec/confirm', { sessionId: id, tookExam: true, judgedEach: true }),
      }
    }, WRONG[0])
    expect(statuses).toEqual({ capture: 404, probes: 404, finish: 404, evidence: 404, confirm: 404 })
  } finally {
    await dropAccount(me)
  }
})

