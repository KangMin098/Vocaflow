// apps/web/tests/e2e/36-student-arrival.spec.ts
//
// **QR 로 들어온 학생이 반에 도착하는가** — 폰에서, 끝까지.
//
// 산술이 성립하는 유일한 경로가 교사 3,500명 × **학급 30명**이고, 그 30배가 실제로
// 일어나는 자리는 교실에서 나눠 주는 종이다. 학생은 그 종이의 QR 을 **폰으로** 찍는다.
// 그 경로를 이 저장소는 한 번도 밟아 본 적이 없었다(2026-08-27 기준 `class_members` 0행).
//
// 처음 밟았을 때 나온 것:
//   · `/teacher` 의 개설·참여 입력과 버튼이 **높이 40px** 이었다(저장소 규칙은 44px).
//     학생이 참여 직후 처음 보는 화면이고 교사의 주 동작이다.
//   · 그 밖에는 가로 넘침 0 · 콘솔 에러 0 — 경로 자체는 이어져 있었다.
//
// ⚠️ 학급·과제를 **스스로 만들고 지운다.** 공유 개발 DB 라 흔적을 남기지 않는다.
//    service role 키가 없으면 통째로 skip 한다(CI 정상).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { test, expect, type Page } from '@playwright/test'

import { TEST_USER } from './fixtures/test-user'

const URL_BASE = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const CODE = 'E2EJN1'

/** 폰 — 학생이 QR 을 찍는 기기. 이 경로에 데스크톱은 없다. */
const MOBILE = { width: 390, height: 844 }
test.use({ viewport: MOBILE, storageState: { cookies: [], origins: [] } })

function admin(): SupabaseClient {
  return createClient(URL_BASE as string, SERVICE_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** 가로로 넘치는 요소 — 폰에서 옆으로 스크롤되면 그 화면은 못 쓴다. */
async function overflowing(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const w = document.documentElement.clientWidth
    const bad: string[] = []
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && (r.right > w + 1 || r.left < -1)) {
        bad.push(`${el.tagName}.${String((el as HTMLElement).className).slice(0, 40)}`)
      }
    }
    return bad
  })
}

/**
 * 44px 미만 조작 요소.
 *
 * 화면에 안 보이는 것(건너뛰기 링크처럼 포커스 때만 나타나는 것)은 뺀다 —
 * 그것까지 세면 매 화면이 1개씩 걸려 **진짜 위반이 묻힌다.**
 */
async function tinyTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const bad: string[] = []
    const sel = 'a[href], button, [role="radio"], input, select, textarea'
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const r = el.getBoundingClientRect()
      if (r.width < 8 || r.height < 8) continue // 시각적으로 숨긴 것
      // 텍스트 내비 링크는 높이만 본다(WCAG 2.5.8 의 간격 예외 — 이 저장소도 그렇게 뒀다).
      const isNavText = el.tagName === 'A' && r.height >= 44
      if (isNavText) continue
      if (r.height < 44) bad.push(`${el.tagName}[${(el.textContent ?? '').trim().slice(0, 16)}] ${Math.round(r.width)}x${Math.round(r.height)}`)
    }
    return bad
  })
}

test.describe('QR → 학생 도착 (폰)', () => {
  // service role 키가 없으면 학급을 만들 수 없다 — 통째로 건너뛴다(CI 정상).
  test.skip(!URL_BASE || !SERVICE_KEY, 'SUPABASE_SERVICE_ROLE_KEY 없음 — 학급 픽스처 생성 불가')

  let classId: string | null = null

  test.beforeAll(async () => {
    const db = admin()
    const { data: teacher } = await db.auth.admin.listUsers()
    const teacherId = teacher?.users?.[0]?.id
    if (!teacherId) return

    await db.from('classes').delete().eq('invite_code', CODE)
    const { data } = await db
      .from('classes')
      .insert({ teacher_id: teacherId, name: '[e2e] 도착 검증반', invite_code: CODE })
      .select('id')
      .single()
    classId = (data as { id: string } | null)?.id ?? null

    if (classId) {
      await db.from('class_assignments').insert({
        class_id: classId,
        created_by: teacherId,
        title: '[e2e] 광합성 지문',
        words: [{ w: 'photosynthesis', m: '광합성', v: 9 }],
      })
    }
  })

  test.afterAll(async () => {
    // 흔적을 남기지 않는다 — 공유 DB 다.
    const db = admin()
    if (classId) await db.from('class_members').delete().eq('class_id', classId)
    await db.from('classes').delete().eq('invite_code', CODE)
  })

  test('익명이 초대를 열면 학급이 보이고, CTA 가 복귀 경로를 들고 간다', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })

    await page.goto(`/join/${CODE}`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1')).toContainText('[e2e] 도착 검증반')

    expect(await overflowing(page), '폰에서 가로로 넘친다').toEqual([])
    expect(await tinyTargets(page), '44px 미만 조작 요소').toEqual([])
    expect(errors.filter((e) => !/favicon|DevTools|Failed to load resource/.test(e))).toEqual([])

    // **초대받은 학생은 전원 신규 가입자다** — 가입이 복귀 경로를 잃으면 학급 연결이 끊긴다.
    const hrefs = await page
      .locator('a[href*="next="]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''))
    expect(hrefs.some((h) => h.startsWith('/signup') && h.includes(`%2Fjoin%2F${CODE}`))).toBe(true)
    expect(hrefs.some((h) => h.startsWith('/login') && h.includes(`%2Fjoin%2F${CODE}`))).toBe(true)
  })

  test('로그인 학생이 참여하면 학급과 받은 단어가 도착한다', async ({ page }) => {
    // 하이드레이션 전에 누르면 폼이 네이티브로 제출돼 조용히 되돌아온다(개발 모드 실측).
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', TEST_USER.email)
    await page.fill('input[type="password"]', TEST_USER.password)
    await Promise.all([
      page.waitForURL(/\/(hub|wordvault|workspace|main)/, { timeout: 40_000 }),
      page.click('button[type="submit"]'),
    ])

    await page.goto(`/join/${CODE}`, { waitUntil: 'domcontentloaded' })
    await Promise.all([
      page.waitForURL(/\/teacher/, { timeout: 40_000 }),
      page.getByRole('button', { name: '이 클래스에 참여하기' }).click(),
    ])

    const body = page.locator('body')
    await expect(body, '참여했는데 학급이 안 보인다').toContainText('[e2e] 도착 검증반')
    await expect(body, '교사가 보낸 과제가 학생에게 도착하지 않았다').toContainText('[e2e] 광합성 지문')
    await expect(body, '낱말이 보이지 않는다').toContainText('photosynthesis')

    expect(await overflowing(page), '폰에서 가로로 넘친다').toEqual([])
    expect(await tinyTargets(page), '44px 미만 조작 요소').toEqual([])
  })
})
