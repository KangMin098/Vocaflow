// scripts/csat/map/e2e-evidence-live.mts
//
// E축 확인 과제 활성화 뒤 화면 확인(2026-10-10) — 개발 서버 + 개발 DB · 학생 화면 경로만. 과제는 풀지 않는다(기록 0).
// ① 문항 화면에 E축 패널이 뜨는가(켠 문항) · 안 뜨는가(뺀 문항 2025#31) ② 학습 지도 단계 시트에 확인 문항 링크 · 생애주기 4칸 · 준비 상태가 보이는가
// 쓰기: 테스트 계정 1(합성) · 방문 이벤트 — 끝에 이 계정만 지운다.
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/csat/map/e2e-evidence-live.mts [--base http://localhost:3000]
import crypto from 'node:crypto'
import path from 'node:path'
import { createRequire } from 'node:module'

import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3000'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL as string
if (!URL_.includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const { chromium } = createRequire(path.join(ROOT, 'apps/web/package.json'))('@playwright/test')
let fail = 0
const rec = (name: string, ok: boolean, detail: unknown = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail === '' ? '' : ' — ' + JSON.stringify(detail).slice(0, 240)}`) }

const email = `evidence-live-${Date.now()}@example.com`
const password = `Ev-${crypto.randomBytes(9).toString('base64url')}-Aa1`
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

  for (const [slug, task] of [['2026-31', 'evidence-locate'], ['2025-32', 'evidence-locate'], ['2026-23', 'option-restate'], ['2025-22', 'option-restate']] as const) {
    await go(`/csat/item/${slug}`)
    const got = await page.locator('[data-testid="principle-panel"]').first().getAttribute('data-task').catch(() => null)
    rec(`문항 ${slug} 패널 = ${task}`, got === task, got)
  }
  await go('/csat/item/2025-31')
  rec('뺀 문항 2025-31 은 E축 패널 없음', (await page.locator('[data-testid="principle-panel"][data-task="evidence-locate"]').count()) === 0)
  await page.screenshot({ path: path.join(ROOT, 'tmp/evidence-live-item.png'), fullPage: false })

  await go('/csat/diagnosis?tab=map')
  for (const [step, n] of [['evidence', 5], ['option', 6]] as const) {
    await page.locator(`button[data-step="${step}"]`).first().click()
    const sheet = page.locator(`[data-step-sheet="${step}"]`)
    await sheet.waitFor()
    const links = await sheet.locator('[data-testid="find-practice-link"]').count()
    rec(`지도 ${step} 확인 문항 링크 ${n}`, links === n, links)
    rec(`지도 ${step} 생애주기 4칸`, (await sheet.locator('[data-testid="step-lifecycle"] li').count()) === 4)
    rec(`지도 ${step} 확인 전 처방 잠김`, (await sheet.locator('[data-testid="step-prescription"]').getAttribute('data-open')) === 'false')
    await page.screenshot({ path: path.join(ROOT, `tmp/evidence-live-map-${step}.png`), fullPage: false })
    await page.keyboard.press('Escape')
  }
  await page.locator('button[data-step="vocab"]').first().click()
  rec('지도 vocab 준비 상태 표시', (await page.locator('[data-step-sheet="vocab"] [data-testid="step-readiness"]').getAttribute('data-readiness')) === 'content_needed')
  await page.keyboard.press('Escape')
  await page.locator('[data-testid="school-band"] [data-band="high"]').click()
  rec('학교급(고등) 선택 → 단계별 권장 표시', (await page.locator('[data-testid="step-exposure"]').count()) === 7)
  await page.screenshot({ path: path.join(ROOT, 'tmp/evidence-live-band.png'), fullPage: false })
} finally {
  await browser?.close()
  await db.auth.admin.deleteUser(uid)
}
console.log(fail ? `FAIL ${fail}` : 'ALL PASS')
process.exitCode = fail ? 1 : 0
