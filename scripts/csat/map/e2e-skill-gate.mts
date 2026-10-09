// scripts/csat/map/e2e-skill-gate.mts
//
// 기능 단위 직접 확인 게이트 E2E(2026-10-10) — 개발 서버 + 개발 DB · 학생 화면 경로만.
// 합성 계정(example.com)이 서로 다른 확인 문항 두 개를 화면에서 틀려도 **직접 확인(verified)으로 승격되지 않고** 처방이 잠긴 채인지 확인한다.
// (열린 경로 — 직접 확인 → 처방 → 다시 확인 → 통과 — 는 합성 데이터로 열 수 없으므로 렌더 테스트 skill-prescription.test.tsx 가 맡는다.)
// 쓰기: 테스트 계정 1(합성 판정) · 시도 2 · 세션 ≤2 · 원장 ≤6 · 방문 이벤트 — 끝에 이 계정 것만 정리.
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/csat/map/e2e-skill-gate.mts [--base http://localhost:3003]
import crypto from 'node:crypto'
import path from 'node:path'
import { createRequire } from 'node:module'

import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3003'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL as string
if (!URL_.includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const { chromium } = createRequire(path.join(ROOT, 'apps/web/package.json'))('@playwright/test')
let fail = 0
const rec = (name: string, ok: boolean, detail: unknown = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail === '' ? '' : ' — ' + JSON.stringify(detail).slice(0, 240)}`) }

const email = `skill-gate-${Date.now()}@example.com`
const password = `Sg-${crypto.randomBytes(9).toString('base64url')}-Aa1`
const { data: created, error: ce } = await db.auth.admin.createUser({ email, password, email_confirm: true })
if (ce) throw ce
const uid = created.user.id
let browser: { close: () => Promise<void>; newContext: (o: object) => Promise<any> } | null = null
try {
  browser = await chromium.launch()
  const page = await (await browser!.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  page.setDefaultTimeout(240_000)
  const go = async (url: string) => { await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}) }
  await go('/login')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u: URL) => !u.pathname.startsWith('/login'), { waitUntil: 'commit' })

  // 지도에서 확인 문항 두 개를 고른다(B6-3 의 서로 다른 확인 문항)
  await go('/csat/diagnosis?tab=map')
  await page.locator('[data-testid="read-path"] [data-step="structure"]').click()
  await page.locator('[data-step-sheet]').waitFor()
  const hrefs: string[] = await page.locator('[data-testid="find-practice-link"][data-task="B6-3"]').evaluateAll((els: Element[]) => els.map((e) => e.getAttribute('href') ?? ''))
  rec('전제 — B6-3 확인 문항 링크 2개 이상', hrefs.length >= 2, hrefs.length)

  // 두 문항에서 일부러 틀린 답(주장 = 마지막 문장 · 근거 1 · 관계 example)
  for (const h of hrefs.slice(0, 2)) {
    await go(h.split('#')[0])
    const panel = page.locator('[data-testid="principle-panel"]')
    await panel.waitFor()
    await panel.getByRole('button', { name: '직접 확인하기' }).click()
    const claims = panel.locator('[data-claim]')
    await claims.nth((await claims.count()) - 1).click()
    await panel.locator('[data-support]').first().click()
    await panel.locator('[data-relation="example"]').check()
    await panel.getByRole('button', { name: '확인하기' }).click()
    await panel.locator('[data-testid="principle-result"]').waitFor()
  }
  const rows = (await db.from('learning_task_attempts').select('item_ref, is_correct, synthetic').eq('user_id', uid)).data ?? []
  rec('두 확인 문항 기록 · 합성(테스트 도메인)', rows.length === 2 && rows.every((r) => r.synthetic === true) && new Set(rows.map((r) => r.item_ref)).size === 2, rows)

  // 지도 — 합성 기록은 직접 확인 근거가 아니다 → 승격 없음 · 처방 잠김
  await go('/csat/diagnosis?tab=map')
  await page.locator('[data-testid="read-path"] [data-step="structure"]').click()
  await page.locator('[data-step-sheet]').waitFor()
  rec('합성 계정 두 오답 → 직접 확인 상태 없음', (await page.locator('[data-testid="skill-diagnosis"]').count()) === 0)
  rec('처방(바로잡기 · 적용 · 다시 확인) 잠김', (await page.locator('[data-testid="step-prescription"]').getAttribute('data-open')) === 'false' && (await page.locator('[data-testid="rx-check"]').count()) === 0)
  const fo = page.locator('[data-testid="find-outcome"]')
  rec('확인 결과도 합성 기록을 세지 않는다(아직 확인 안 함)', (await fo.count()) === 0 || (await fo.getAttribute('data-state')) === 'untried', (await fo.count()) ? await fo.getAttribute('data-state') : 'none')
} finally {
  await browser?.close().catch((e: Error) => console.log(`브라우저 종료 실패: ${e.message}`))
  const { error: fe } = await db.from('funnel_events').delete().eq('user_id', uid)
  rec('정리 — 방문 이벤트', !fe, fe?.message ?? '')
  const { error: de } = await db.auth.admin.deleteUser(uid)
  rec('정리 — 테스트 계정 삭제(cascade)', !de, de?.message ?? '')
  const left = await Promise.all(['learning_task_attempts', 'learning_sessions', 'learning_mutations'].map(async (t) => (await db.from(t).select('user_id', { count: 'exact', head: true }).eq('user_id', uid)).count))
  rec('정리 — 남은 행 0', left.every((n) => n === 0), left)
}
if (fail) { console.log(`실패 ${fail}`); process.exitCode = 1 } else console.log('모든 단언 통과')
