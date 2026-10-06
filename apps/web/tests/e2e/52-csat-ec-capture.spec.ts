// apps/web/tests/e2e/52-csat-ec-capture.spec.ts
//
// 오답 원인 Pilot 학생 증거 수집 — 실제 브라우저 흐름(개발 Supabase).
//   시험 기록 저장 → 참가자는 결과 없이 수집 화면(뒤에 점수 보드 없음) → 확인 → 문항: 막힌 문장 · 고른 이유 · 해석 · 어려웠던 쪽
//   → (서버가 요구할 때만) 추가 질문 → 건너뛰기 · 잘 모르겠어요 → 결과 공개.
// 실행 조건: 임시 참가자 계정(EC_E2E_EMAIL · EC_E2E_PASSWORD · EC_E2E_USER_ID)과, 그 계정을 CSAT_EC_PILOT_USER_IDS 로 둔 별도 dev 서버
// (PLAYWRIGHT_BASE_URL). 탐지기가 아직 없어 추가 질문을 띄울 경계 관찰은 테스트가 service_role RPC 로 넣는다(화면이 만들지 않는다).
// 계정은 실행 뒤 지운다(기록 · 증거 cascade). 원인 코드 · 경계 · taxonomy 용어가 학생 화면에 보이면 실패다.
import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

const EMAIL = process.env.EC_E2E_EMAIL ?? ''
const PASSWORD = process.env.EC_E2E_PASSWORD ?? ''
const USER_ID = process.env.EC_E2E_USER_ID ?? ''
const EXAM = '2019'
const WRONG = [18, 19, 20]
const FORBIDDEN = /[VSREBX]\.[a-z_]{3,}|taxonomy|provisional|boundary|multiple_plausible|경계|원인 코드/

test.skip(!EMAIL || !PASSWORD || !USER_ID || !process.env.PLAYWRIGHT_BASE_URL, '임시 참가자 계정 · 별도 dev 서버가 없다(설명은 파일 머리)')

const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

test('참가자 — 저장 → 수집(정오 · 점수 비노출) → 추가 질문 → 결과', async ({ page }) => {
  test.setTimeout(240_000)
  const db = svc()
  const { data: keyRows, error: ke } = await db.from('csat_dx_answer_key').select('no, answers').eq('exam_id', EXAM).order('no')
  expect(ke).toBeNull()
  const key = Object.fromEntries((keyRows ?? []).map((r) => [r.no as number, (r.answers as number[])[0]]))

  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })

  // 새 기록 — 수능 2019, 18–20번만 틀리게
  await page.goto('/csat/diagnosis?tab=records&modal=new')
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('종류').selectOption('suneung')
  await dialog.getByLabel('회차').selectOption(EXAM)
  await dialog.getByRole('button', { name: '다음' }).click()
  for (let no = 1; no <= 45; no++) {
    const k = key[no]
    const pick = WRONG.includes(no) ? (k % 5) + 1 : k
    await dialog.getByRole('radio', { name: `${no}번 ${pick}`, exact: true }).click()
  }
  await dialog.getByRole('button', { name: '채점하고 저장' }).click()

  // 참가자 — 결과 대신 수집 화면. 뒤에 점수 보드가 없다
  await page.waitForURL(/capture=/, { timeout: 60_000 })
  const sessionId = new URL(page.url()).searchParams.get('capture')!
  await expect(page.getByText('풀이를 조금만 더 알려 주세요')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText(/45문항 중 \d+문항 맞음/)).toHaveCount(0)
  await expect(page.getByText('진단에 반영했어요')).toHaveCount(0)

  // 확인 2문항
  await page.getByRole('radiogroup', { name: /시간을 재고 풀었나요/ }).getByRole('radio', { name: '네' }).click()
  await page.getByRole('radiogroup', { name: /선지를 하나씩 따져/ }).getByRole('radio', { name: '네' }).click()
  await page.getByRole('button', { name: '다음' }).click()

  // 첫 대상 문항 — 정오 표시 없이 번호 · 내가 고른 답
  const first = page.getByText(/^\d+번$/).first()
  await expect(first).toBeVisible({ timeout: 30_000 })
  const firstNo = Number((await first.textContent())!.replace('번', ''))
  expect(WRONG).toContain(firstNo)
  await expect(page.getByText('내가 고른 답').first()).toBeVisible()
  const body = (await page.getByRole('dialog').innerText())
  expect(body).not.toMatch(FORBIDDEN)
  expect(body).not.toMatch(/정답|오답|틀린|맞은/)

  // 탐지기 대신 service_role 이 이 문항에 경계 관찰을 넣는다 — 저장 뒤 서버 대기 목록에 추가 질문이 생긴다
  const sig = await db.rpc('csat_ec_add_detector_signal', { p_session: sessionId, p_item_no: firstNo, p_taxonomy: 'v0.1', p_boundary_key: 'r.inference__v.wrong_sense',
    p_detector_version: 'e2e-capture', p_probe_required: true, p_evidence_ids: [] })
  expect(sig.error).toBeNull()

  // 막힌 문장(키보드) · 고른 이유 · 해석 · 어려웠던 쪽
  const sentence = page.locator('[lang="en"] button').first()
  await sentence.focus()
  await page.keyboard.press('Enter')
  await expect(sentence).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('이 답을 고른 이유').fill('앞 문장과 같은 방향이라고 생각해서 골랐어요')
  await page.getByRole('radio', { name: '내가 이해한 뜻 적기' }).click()
  await page.getByRole('button', { name: /저장하고/ }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('이해한 뜻을 적거나')   // 빈 해석은 저장 전에 막는다
  await page.getByLabel('내가 이해한 뜻').fill('그 단어를 원래 뜻 그대로 읽었어요')
  await page.getByRole('radio', { name: '근거 찾기' }).click()
  await page.getByRole('button', { name: /저장하고/ }).click()

  // 서버가 요구한 추가 질문
  await expect(page.getByText('한 가지만 더 확인할게요')).toBeVisible({ timeout: 30_000 })
  expect(await page.getByRole('dialog').innerText()).not.toMatch(FORBIDDEN)
  await page.getByRole('radio', { name: /기본 뜻에서 문맥이나 비유/ }).click()
  await page.getByRole('button', { name: '다음' }).click()

  // 다음 문항 건너뛰기 → 그다음 「잘 모르겠어요」
  await expect(page.getByText(/^\d+번$/).first()).not.toHaveText(`${firstNo}번`, { timeout: 30_000 })
  await page.getByRole('button', { name: '이 문항 건너뛰기' }).click()
  await expect(page.getByText(/^\d+번$/).first()).toBeVisible()
  await page.getByLabel('이 답을 고른 이유').fill('보기 중에 가장 그럴듯해 보였어요')
  await page.getByRole('radio', { name: '잘 모르겠어요' }).first().click()
  await page.getByRole('button', { name: /저장하고/ }).click()

  // 결과 공개
  await expect(page.getByText('이번 시험 결과')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText(/45문항 중 42문항 맞음/)).toBeVisible()

  // DB — 학생 응답은 과정 증거로만, 원인 claim 0, probe 는 글자만. service_role 은 이 표 권한이 없다(RPC 전용) → 학습자 로그인으로 본인 유효 증거를 읽는다
  const me = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  expect((await me.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })).error).toBeNull()
  const { data: ev, error: ee } = await me.rpc('csat_ec_my_process_evidence', { p_session: sessionId })
  expect(ee).toBeNull()
  type EvidenceRow = { item_no: number; kind: string; value: unknown }
  const kinds: string[] = ((ev ?? []) as EvidenceRow[]).map((r) => `${r.item_no}:${r.kind}:${(r.value as { state?: string; option?: string; group?: string }).state ?? (r.value as { option?: string }).option ?? (r.value as { group?: string }).group ?? ''}`)
  expect(kinds).toEqual(expect.arrayContaining([`${firstNo}:interpretation:answered`, `${firstNo}:category:evidence`, `${firstNo}:targeted_probe:B`, `${firstNo}:blocked_span:`]))
  expect(kinds.some((k) => k.endsWith(':interpretation:unknown'))).toBe(true)
  const { data: claims, error: ce } = await me.from('csat_ec_claim').select('id').eq('session_id', sessionId)
  expect(ce).toBeNull()
  expect(claims).toHaveLength(0)
})

test('비참가자 — 기존 흐름 그대로(저장 즉시 결과 · 수집 화면 없음)', async ({ page }) => {
  test.setTimeout(180_000)
  const db = svc()
  const email = `ec-e2e-np-${Date.now()}@example.com`, password = `np-${crypto.randomUUID()}`
  const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { test: 'csat_ec capture e2e — 비참가자' } })
  expect(error).toBeNull()
  try {
    const { data: keyRows } = await db.from('csat_dx_answer_key').select('no, answers').eq('exam_id', EXAM).order('no')
    const key = Object.fromEntries((keyRows ?? []).map((r) => [r.no as number, (r.answers as number[])[0]]))
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')
    await page.waitForURL((x) => !x.pathname.startsWith('/login'), { timeout: 30_000 })
    await page.goto('/csat/diagnosis?tab=records&modal=new')
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('종류').selectOption('suneung')
    await dialog.getByLabel('회차').selectOption(EXAM)
    await dialog.getByRole('button', { name: '다음' }).click()
    for (let no = 1; no <= 45; no++) await dialog.getByRole('radio', { name: `${no}번 ${WRONG.includes(no) ? (key[no] % 5) + 1 : key[no]}`, exact: true }).click()
    await dialog.getByRole('button', { name: '채점하고 저장' }).click()
    await expect(page.getByText(/45문항 중 42문항 맞음/)).toBeVisible({ timeout: 60_000 })
    expect(page.url()).not.toContain('capture=')
    await expect(page.getByText('풀이를 조금만 더 알려 주세요')).toHaveCount(0)
  } finally {
    await db.auth.admin.deleteUser(u!.user!.id)
  }
})
