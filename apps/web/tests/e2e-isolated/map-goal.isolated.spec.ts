// apps/web/tests/e2e-isolated/map-goal.isolated.spec.ts
//
// PR 필수 e2e(격리) — 러너 안의 로컬 Supabase(저장소 마이그레이션 실제 적용 · 빈 데이터)에 실제 Next.js 서버를 띄우고
// 실제 브라우저로 학습 지도를 돈 뒤 DB 를 단언한다. 공유 개발 DB · 운영 데이터 · 저장소 시크릿에 닿지 않는다(정책 v1.1 · 2026-10-11).
//   ① 회원 계정 생성(로컬 service_role — 로컬 데모 키) → 로그인 화면으로 로그인
//   ② /csat/diagnosis?tab=map — 학습 지도가 그려지고 목표 「아직 정하지 않았어요」
//   ③ 화면에서 목표 80 → DB `csat_map_goal` 에 그 학습자 80 · 새로고침 뒤 유지
//   ④ 다른 학습자(anon 키 + 그 사람 세션)로 남의 목표 0행(RLS)
// 시각은 서버가 정한다 — 테스트는 값만 본다.
import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

test.beforeAll(() => {
  // 격리 실행 전용 — 로컬 Supabase 가 아니면 멈춘다(공유 DB 에 계정을 만들지 않게)
  expect(URL, '격리 e2e 는 로컬 Supabase(127.0.0.1)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(SERVICE.length).toBeGreaterThan(20)
})

const admin = () => createClient(URL, SERVICE, { auth: { persistSession: false } })
async function makeUser(tag: string) {
  const email = `iso-${tag}-${Date.now()}@example.com`
  const password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  return { id: data.user.id, email, password }
}

test('학습 지도 — 로그인 · 목표 저장 · DB 단언 · RLS(격리 DB)', async ({ page }) => {
  const a = await makeUser('a')
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', a.email)
  await page.fill('input[type="password"]', a.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))

  await page.goto('/csat/diagnosis?tab=map', { waitUntil: 'domcontentloaded' })
  const map = page.locator('[data-testid="learner-map"]')
  await expect(map).toBeVisible({ timeout: 60_000 })
  await expect(map).toHaveAttribute('data-goal-set', 'false')
  await expect(page.locator('[data-testid="goal-header"]')).toContainText('아직 정하지 않았어요')

  // 목표가 없을 때의 할 일 = 「목표 정하기」 CTA 가 목표 고르기를 연다(scripts/csat/map/e2e-map-goal.mjs A 와 같은 경로)
  await expect(page.locator('[data-testid="focus-card"]')).toHaveAttribute('data-focus', 'goal')
  await page.locator('[data-testid="focus-cta"]').click()
  const group = page.getByRole('group', { name: '목표 점수 정하기' })
  await expect(group).toBeVisible()
  await group.getByRole('button', { name: /^80/ }).first().click()
  await expect(map).toHaveAttribute('data-goal-set', 'true', { timeout: 30_000 })

  // DB 단언 — 화면 저장이 실제 행으로 남았다
  await expect.poll(async () => (await admin().from('csat_map_goal').select('target_score').eq('user_id', a.id)).data?.[0]?.target_score ?? null, { timeout: 15_000 }).toBe(80)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="learner-map"]')).toHaveAttribute('data-goal-set', 'true', { timeout: 60_000 })

  // RLS — 다른 학습자는 a 의 목표를 못 본다
  const b = await makeUser('b')
  const asB = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error: signErr } = await asB.auth.signInWithPassword({ email: b.email, password: b.password })
  expect(signErr).toBeNull()
  const peek = await asB.from('csat_map_goal').select('user_id').eq('user_id', a.id)
  expect(peek.error).toBeNull()
  expect(peek.data ?? []).toHaveLength(0)
  const own = await asB.from('csat_map_goal').select('user_id').eq('user_id', b.id)
  expect(own.error).toBeNull()
})
