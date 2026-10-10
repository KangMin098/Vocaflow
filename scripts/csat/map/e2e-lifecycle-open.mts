// scripts/csat/map/e2e-lifecycle-open.mts
//
// FIND → 직접 확인 → REPAIR → TRANSFER → CHECK → 해소 — **학생 화면 · 실제 기록**으로 끝까지 가는 E2E(2026-10-10 준비).
// 대상: 근거 판단 단계(evidence-locate · 확인 문항 5). 문항 화면에서 과제를 실제로 제출하고(학습 기록 원장에 남는다), 학습 지도 단계 시트의 상태를 읽는다.
//
// ⚠️ 두 모드:
//   기본(--synthetic) — 새 합성 계정(example.com). 합성 시도는 판정에서 빠지므로 **처방이 잠긴 채인지**(게이트)를 확인한다. 끝에 계정을 지운다.
//   --qa-account <email> — 사용자가 지정한 비합성 QA 계정(비밀번호는 환경변수 QA_PASSWORD). 열린 경로(확정 → 처방 개방 → 다시 확인 → 해소)를 확인한다.
//     이 기록은 추가 전용 원장이라 지우지 않는다 — 그 계정은 실제 학습자 수에 섞이므로 **사용자가 계정을 정하고 승인한 뒤에만** 돌린다.
//     같은 계정으로 두 번 돌리면 첫 시도 기준이라 결과가 달라진다(이미 해소) — 계정당 한 번.
// 쓰기: 과제 시도 4(오답 2 → 미노출 정답 2) · 세션 · 방문 이벤트.
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/csat/map/e2e-lifecycle-open.mts [--base http://localhost:3000] [--qa-account qa@… ]
import crypto from 'node:crypto'
import path from 'node:path'
import { createRequire } from 'node:module'

import { createClient } from '@supabase/supabase-js'

import curated from '../../../apps/web/src/lib/knowledge/annotations/evidence-tasks.v1.json'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const arg = (k: string) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null)
const BASE = arg('--base') ?? 'http://localhost:3000'
const QA = arg('--qa-account')
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL as string
if (!URL_.includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
if (QA && (QA.endsWith('@example.com') || !process.env.QA_PASSWORD)) throw new Error('--qa-account 는 비합성 계정 + QA_PASSWORD 가 필요하다')
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const { chromium } = createRequire(path.join(ROOT, 'apps/web/package.json'))('@playwright/test')
let fail = 0
const rec = (name: string, ok: boolean, detail: unknown = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail === '' ? '' : ' — ' + JSON.stringify(detail).slice(0, 240)}`) }

// 확인 문항 순서 = 지도 A5-4 적용(첫 문항 + 나머지). 오답 = 빈칸 문장 자체(근거가 아니다) · 정답 = 합의 근거 첫 문장
const ITEMS = ['2026#31', '2026#32', '2026#33', '2026#34', '2025#32']
const C = (curated as { items: Record<string, { blank: number | null; evidence: number[] }> }).items
const wrong = (id: string) => C[id].blank as number
const right = (id: string) => C[id].evidence[0]

let uid: string | null = null
let email = QA
let password = process.env.QA_PASSWORD ?? ''
if (!QA) {
  email = `lifecycle-${Date.now()}@example.com`
  password = `Lc-${crypto.randomBytes(9).toString('base64url')}-Aa1`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  uid = data.user.id
}
let browser: { close: () => Promise<void>; newContext: (o: object) => Promise<any> } | null = null
try {
  browser = await chromium.launch()
  const page = await (await browser!.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  page.setDefaultTimeout(240_000)
  const go = async (url: string) => { await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}) }
  await go('/login')
  await page.fill('input[type="email"]', email!)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u: URL) => !u.pathname.startsWith('/login'), { waitUntil: 'commit' })

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
    const checks = await s.locator('[data-testid="rx-check"]').evaluateAll((els: Element[]) => els.map((e) => e.getAttribute('data-item')))
    await page.keyboard.press('Escape')
    return { status, open, cycle, repair, checks }
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
    rec('QA: 직접 확인(verified)', afterFind.status === 'verified', afterFind)
    rec('QA: 처방 열림', afterFind.open === 'true', afterFind)
    rec('QA: 생애주기 확인 ✓ · 바로잡기 지금', afterFind.cycle.startsWith('FIND:done REPAIR:now'), afterFind.cycle)
    rec('QA: 바로잡기 절차(§13 1 · 6 · 7) 표시', afterFind.repair === 3, afterFind.repair)
    rec('QA: 다시 확인 링크 = 미노출 문항', afterFind.checks.length > 0 && afterFind.checks.every((c: string | null) => c !== null && !ITEMS.slice(0, 2).includes(c)), afterFind.checks)
    // ② REPAIR(절차 질문은 화면 안내 · 기록 없음) → TRANSFER 링크 존재 확인
    await go('/csat/diagnosis?tab=map')
    await page.locator('button[data-step="evidence"]').first().click()
    rec('QA: 다른 글에 적용 링크', (await page.locator('[data-step-sheet="evidence"] [data-testid="rx-transfer"]').count()) === 1)
    await page.keyboard.press('Escape')
    // ③ CHECK — 확정에 쓰지 않은 · 처음 보는 문항 2개를 맞힌다 → 해소
    rec('CHECK 1 정답 제출', await solve(ITEMS[2], right(ITEMS[2])))
    rec('CHECK 2 정답 제출', await solve(ITEMS[3], right(ITEMS[3])))
    const end = await sheet()
    rec('QA: 해소(resolved)', end.status === 'resolved', end)
    rec('QA: 생애주기 확인 · 다시 확인 마침(바로잡기 · 적용은 기록 없음)', end.cycle === 'FIND:done REPAIR:open TRANSFER:open CHECK:done', end.cycle)
    await page.screenshot({ path: path.join(ROOT, 'tmp/lifecycle-open-resolved.png'), fullPage: false })
  }
  // 기록 원장 — 제출이 실제로 남았는가(서버 채점 · 첫 시도)
  const who = uid ?? (await db.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === email)?.id
  const { count } = await db.from('learning_task_attempts').select('id', { count: 'exact', head: true }).eq('user_id', who!).eq('task_key', 'evidence-locate')
  rec(`기록 원장에 시도 ${QA ? 4 : 2}건`, count === (QA ? 4 : 2), count)
} finally {
  await browser?.close()
  if (uid) await db.auth.admin.deleteUser(uid)
}
console.log(fail ? `FAIL ${fail}` : 'ALL PASS')
process.exitCode = fail ? 1 : 0
