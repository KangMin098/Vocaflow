// scripts/csat/map/e2e-map-practice-feedback.mts
//
// 학습 지도 결과 환류 E2E(2026-10-08) — 개발 서버 + 개발 DB.
//   합성 학습자 1명의 수행 기록(2022#20 claim-support · synthetic=true)을 서버 키로 넣고, 학습 지도 「글 구조·핵심」 단계 시트의
//   FIND B6-3 아래 「내가 한 확인」이 기록대로 보이는지 확인한다.
//   A 기록 없음 → 결과 줄 없음 · B 오답 → 다시 해 보기 · C 오답 뒤 정답 → 넘어가기 · 실력 판정 문구 없음
// 쓰기: 테스트 계정 1 · 수행 기록 최대 2행(synthetic=true · 끝에 계정 삭제 → cascade). 지식 행 · 적용 상태는 읽기만 한다.
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/csat/map/e2e-map-practice-feedback.mts [--base http://localhost:3003]
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3003'
const OUT = path.join(ROOT, 'tmp/csat/map-practice-feedback')
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL as string
if (!URL_.includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const { chromium } = createRequire(path.join(ROOT, 'apps/web/package.json'))('@playwright/test')
fs.mkdirSync(OUT, { recursive: true })
let fail = 0
const rec = (name: string, ok: boolean, detail: unknown = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail === '' ? '' : ' — ' + JSON.stringify(detail).slice(0, 240)}`) }

const email = `map-feedback-${Date.now()}@example.com`
const password = `Mf-${crypto.randomBytes(9).toString('base64url')}-Aa1`
const { data: created, error: ce } = await db.auth.admin.createUser({ email, password, email_confirm: true })
if (ce) throw ce
const uid = created.user.id
const insertAttempt = async (isCorrect: boolean, at: string) => {
  const { error } = await db.from('learning_task_attempts').insert({ user_id: uid, task_key: 'claim-support', item_ref: '2022#20', phase: 'practice', response: { e2e: 'map-feedback' }, is_correct: isCorrect, synthetic: true, answered_at: at })
  if (error) throw new Error(`기록 넣기 실패: ${error.message}`)
}
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

  const openSheet = async () => {
    await go('/csat/diagnosis?tab=map')
    await page.locator('[data-testid="read-path"] [data-step="structure"]').click()
    await page.locator('[data-step-sheet]').waitFor()
  }
  // A 기록 없음
  await openSheet()
  const link = page.locator('[data-testid="find-practice-link"][data-task="B6-3"]')
  rec('전제 — B6-3 에 실행 과제 링크가 있다(2022-20 적용 켜짐)', (await link.count()) === 1)
  rec('A 기록 없음 → 결과 줄 없음', (await page.locator('[data-testid="find-practice-result"]').count()) === 0)

  // B 오답 한 번
  await insertAttempt(false, '2026-10-08T01:00:00Z')
  await openSheet()
  const res = page.locator('[data-testid="find-practice-result"]')
  await res.waitFor()
  const tb = await res.innerText()
  rec('B 오답 1번 → 「내가 한 확인 1번 · 처음 다시 볼 곳」 · 다음 = 다시 해 보기', (await res.getAttribute('data-next')) === 'retry' && (await res.getAttribute('data-attempts')) === '1' && /1번/.test(tb) && /다시 볼 곳/.test(tb) && /한 번 더/.test(tb), tb)
  rec('B 날짜는 한국 날짜(10월 8일)', /10월 8일/.test(tb), tb)
  rec('B 세션 없는 기록 — 도움 여부를 단정하지 않는다(「본 뒤였어요」 없음)', !/본 뒤였어요/.test(tb), tb)
  await page.locator('li', { has: page.locator('[data-testid="find-practice-result"]') }).screenshot({ path: path.join(OUT, 'B-retry.png') })

  // C 오답 뒤 정답
  await insertAttempt(true, '2026-10-08T01:05:00Z')
  await openSheet()
  await res.waitFor()
  const tc = await res.innerText()
  rec('C 오답 뒤 정답 → 2번 · 처음 다시 볼 곳 · 최근 맞음 · 다음 = 넘어가기', (await res.getAttribute('data-next')) === 'move_on' && (await res.getAttribute('data-attempts')) === '2' && /최근.*맞았어요/.test(tc) && /다음 확인으로/.test(tc), tc)
  rec('C 실력 판정이 아니라는 문구 · 효과 약속 없음', /판정은 아니에요/.test(tc) && !/실력이 (올랐|생겼)|점수가 오른다/.test(tc), tc)
  await page.locator('li', { has: page.locator('[data-testid="find-practice-result"]') }).screenshot({ path: path.join(OUT, 'C-move-on.png') })
} finally {
  await browser?.close().catch((e: Error) => console.log(`브라우저 종료 실패: ${e.message}`))
  const { error: de } = await db.auth.admin.deleteUser(uid)
  rec('정리 — 테스트 계정 삭제(수행 기록 cascade)', !de, de?.message ?? '')
  const { count } = await db.from('learning_task_attempts').select('id', { count: 'exact', head: true }).eq('user_id', uid)
  rec('정리 — 남은 수행 기록 0', count === 0, count)
}
if (fail) { console.log(`실패 ${fail}`); process.exitCode = 1 } else console.log('모든 단언 통과')
