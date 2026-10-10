// scripts/csat/map/e2e-lifecycle-open.mts
//
// FIND → 직접 확인 → REPAIR → (TRANSFER) → CHECK → 해소 — **학생 화면 · 실제 기록**으로 끝까지 가는 E2E(2026-10-10).
// 대상: 근거 판단 단계(evidence-locate · 확인 문항 5). 문항 화면에서 과제를 실제로 제출하고(학습 기록 원장에 남는다), 학습 지도 단계 시트의 상태를 읽는다.
//
// 두 모드 — 계정은 늘 스크립트가 만들고 끝에 지운다(원장 행은 user_id cascade 로 정리):
//   기본(합성) — 공유 개발 DB · 새 example.com 계정. 합성 시도는 판정에서 빠지므로 **처방이 잠긴 채인지**(게이트)를 확인한다.
//   --isolated — 열린 경로를 비합성 계정으로 확인한다. **격리 DB 전용**:
//     ① 스크립트의 DB(NEXT_PUBLIC_SUPABASE_URL)가 공유 개발 DB 면 시작하지 않는다
//     ② 그 격리 DB 에 새 비합성 계정(qa-<시각>@vocaflow-qa.test)을 만든다
//     ③ 앱(--base) 로그인이 성공해야 진행한다 — 앱이 공유 DB 를 보고 있으면 그 계정이 없어 로그인이 실패하고 **제출 전에** 멈춘다(Codex P1)
//   E축은 확인 묶음 밖 적용 문항이 없다 — 적용 칸은 「준비 중」 이 정상이다(링크 없음).
// 쓰기(격리): 시도 5(오답 2 → 바로잡기 정답 1 → 미노출 정답 2) · 세션 · 방문 이벤트.
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/csat/map/e2e-lifecycle-open.mts [--base http://localhost:3000] [--isolated]
import crypto from 'node:crypto'
import path from 'node:path'
import { createRequire } from 'node:module'

import { createClient } from '@supabase/supabase-js'

import curated from '../../../apps/web/src/lib/knowledge/annotations/evidence-tasks.v1.json'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const arg = (k: string) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null)
const BASE = arg('--base') ?? 'http://localhost:3000'
const QA = process.argv.includes('--isolated')
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const SHARED_DEV = 'jajenrevcbmrpaliomxv'
if (!QA && !URL_.includes(SHARED_DEV)) throw new Error('합성 모드는 개발 프로젝트에서만')
if (QA && URL_.includes(SHARED_DEV)) throw new Error('--isolated 는 공유 개발 DB 에서 돌리지 않는다 — 격리 DB(Supabase 브랜치 · 로컬)의 URL 로 실행')
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const { chromium } = createRequire(path.join(ROOT, 'apps/web/package.json'))('@playwright/test')
let fail = 0
const rec = (name: string, ok: boolean, detail: unknown = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail === '' ? '' : ' — ' + JSON.stringify(detail).slice(0, 240)}`) }

// 확인 문항 순서 = 지도 A5-4 적용(첫 문항 + 나머지). 오답 = 빈칸 문장 자체(근거가 아니다) · 정답 = 합의 근거 첫 문장
const ITEMS = ['2026#31', '2026#32', '2026#33', '2026#34', '2025#32']
const C = (curated as { items: Record<string, { blank: number | null; evidence: number[] }> }).items
const wrong = (id: string) => C[id].blank as number
const right = (id: string) => C[id].evidence[0]

const email = QA ? `qa-${Date.now()}@vocaflow-qa.test` : `lifecycle-${Date.now()}@example.com`
const password = `Lc-${crypto.randomBytes(9).toString('base64url')}-Aa1`
const created = await db.auth.admin.createUser({ email, password, email_confirm: true })
if (created.error) throw created.error
const uid: string = created.data.user.id
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
  // 로그인 성공 = 앱이 이 계정이 있는 DB 를 본다(격리 모드에서 공유 DB 앱을 여기서 걸러 낸다 — 제출 전)
  await page.waitForURL((u: URL) => !u.pathname.startsWith('/login'), { waitUntil: 'commit', timeout: 60_000 })
    .catch(() => { throw new Error('앱 로그인 실패 — 앱이 이 스크립트의 DB 를 보고 있지 않다(격리 확인 실패) · 제출하지 않고 멈춘다') })

  const solve = async (id: string, pick: number) => {
    await go(`/csat/item/${id.replace('#', '-')}`)
    const panel = page.locator('[data-testid="principle-panel"][data-task="evidence-locate"]')
    await panel.getByRole('button', { name: '직접 확인하기' }).click()
    await panel.locator(`[data-pick="${pick}"]`).click()
    await panel.getByRole('button', { name: '확인하기', exact: true }).click()
    const res = panel.locator('[data-testid="principle-result"]')
    await res.waitFor()
    return (await res.getAttribute('data-correct')) === 'true'
  }
  const sheet = async () => {
    await go('/csat/diagnosis?tab=map')
    await page.locator('button[data-step="evidence"]').first().click()
    const s = page.locator('[data-step-sheet="evidence"]')
    await s.waitFor()
    const status = await s.locator('[data-testid="skill-diagnosis"]').getAttribute('data-status').catch(() => null)
    const open = await s.locator('[data-testid="step-prescription"]').getAttribute('data-open')
    const cycle = await s.locator('[data-testid="step-lifecycle"] li').evaluateAll((els: Element[]) => els.map((e) => `${e.getAttribute('data-stage')}:${e.getAttribute('data-s')}`).join(' '))
    const repair = await s.locator('[data-testid="rx-repair-protocol"] li').count()
    const repairLinks = await s.locator('[data-testid="rx-repair"]').evaluateAll((els: Element[]) => els.map((e) => e.getAttribute('data-item')))
    const transferLinks = await s.locator('[data-testid="rx-transfer"]').count()
    const checks = await s.locator('[data-testid="rx-check"]').evaluateAll((els: Element[]) => els.map((e) => e.getAttribute('data-item')))
    await page.keyboard.press('Escape')
    return { status, open, cycle, repair, repairLinks, transferLinks, checks }
  }

  // ① FIND — 서로 다른 확인 문항 2개를 막힌 채 제출(독립 첫 시도)
  rec('FIND 1 오답 제출', (await solve(ITEMS[0], wrong(ITEMS[0]))) === false)
  rec('FIND 2 오답 제출', (await solve(ITEMS[1], wrong(ITEMS[1]))) === false)
  const afterFind = await sheet()
  if (!QA) {
    // 합성 계정 — 판정에서 빠진다: 직접 확인 · 처방 개방이 없어야 한다
    rec('합성: 직접 확인 없음', afterFind.status === null || afterFind.status === 'unverified', afterFind)
    rec('합성: 처방 잠김', afterFind.open === 'false', afterFind)
  } else {
    rec('격리: 직접 확인(verified) · 처방 열림', afterFind.status === 'verified' && afterFind.open === 'true', afterFind)
    rec('격리: 생애주기 — 바로잡기 지금 · 적용 준비 중', afterFind.cycle === 'FIND:done REPAIR:now TRANSFER:locked CHECK:open', afterFind.cycle)
    rec('격리: 바로잡기 절차(§13 1 · 6 · 7) · 막힌 문항 링크', afterFind.repair === 3 && afterFind.repairLinks.join() === ITEMS.slice(0, 2).join(), afterFind)
    rec('격리: 적용 링크 없음(E축 적용 문항 준비 중)', afterFind.transferLinks === 0, afterFind.transferLinks)
    rec('격리: 다시 확인 링크 = 미노출 문항', afterFind.checks.length > 0 && afterFind.checks.every((c: string | null) => c !== null && !ITEMS.slice(0, 2).includes(c)), afterFind.checks)
    // ② REPAIR — 막혔던 문항을 다시 처리해 맞힌다(첫 시도가 아니므로 진단은 그대로)
    rec('REPAIR 막힌 문항 다시 맞힘', await solve(ITEMS[0], right(ITEMS[0])))
    const afterRepair = await sheet()
    rec('격리: 바로잡기 마침 · 지금 할 일 = 다시 확인', afterRepair.cycle === 'FIND:done REPAIR:done TRANSFER:locked CHECK:now' && afterRepair.status === 'verified', afterRepair)
    // ③ CHECK — 확정에 쓰지 않은 · 처음 보는 문항 2개를 맞힌다 → 해소
    rec('CHECK 1 정답 제출', await solve(ITEMS[2], right(ITEMS[2])))
    rec('CHECK 2 정답 제출', await solve(ITEMS[3], right(ITEMS[3])))
    const end = await sheet()
    rec('격리: 해소(resolved) · 처방 닫힘', end.status === 'resolved' && end.open === 'false', end)
    rec('격리: 확인 · 바로잡기 · 다시 확인 마침 · 적용 준비 중', end.cycle === 'FIND:done REPAIR:done TRANSFER:locked CHECK:done', end.cycle)
    await page.screenshot({ path: path.join(ROOT, 'tmp/lifecycle-open-resolved.png'), fullPage: false })
  }
  // 기록 원장 — 제출이 실제로 남았는가(서버 채점)
  const { count } = await db.from('learning_task_attempts').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('task_key', 'evidence-locate')
  rec(`기록 원장에 시도 ${QA ? 5 : 2}건`, count === (QA ? 5 : 2), count)
} finally {
  await browser?.close()
  await db.auth.admin.deleteUser(uid)
}
console.log(fail ? `FAIL ${fail}` : 'ALL PASS')
process.exitCode = fail ? 1 : 0
