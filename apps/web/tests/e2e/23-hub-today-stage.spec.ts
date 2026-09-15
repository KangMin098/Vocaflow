// apps/web/tests/e2e/23-hub-today-stage.spec.ts
//
// Today(/hub) 무대 회귀 — v06.200 재설계가 지켜야 하는 계약 3가지.
//
// 이 스펙이 없으면 다음 사람이 반드시 되돌린다:
//   ① 단어 지면이 **실제 내 단어**를 말한다 — 개수만 말하던 이전 허브로 돌아가지 않게.
//      (WordVault 허브가 `MOCK_WORDS` 를 실수치처럼 보여주던 것이 같은 계열의 사고였다.)
//   ② **오늘 할 일 표면은 하나뿐** — 수동계획이 있는 날에는 처방 흐름을 렌더하지 않는다.
//      v06.108 META 확정(Opt A)이고, 표면을 하나 더 얹는 것은 코드상 한 줄이라 쉽게 깨진다.
//   ③ **시작 버튼은 하나** — 단어 CTA 와 흐름 CTA 를 둘 다 두면 "지금 뭘" 이 다시 흐려진다.
//
// 화면 산문이 아니라 `data-today-*` 선언을 읽는다 — 18-hub-real-queue 가 라벨 영문화 때
// 조용히 깨졌던 것과 같은 실수를 반복하지 않기 위해서다.
//
// ⚠️ 계획 행을 넣고 지운다. 반드시 finally 에서 원복할 것 — 남기면 이 계정의 다음 실행이
//    영원히 "수동계획 있는 날" 이 되어 ①③ 이 엉뚱하게 실패한다.

import { test, expect, type Page } from '@playwright/test'

import { serviceClient, userIdByEmail } from './utils/db'

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
}
const STATE_PATH = 'playwright-auth/.auth-hub-today.json'

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800) // hydration — 클릭이 빠르면 네이티브 폼 전송이 된다
  await page.fill('input[type="email"]', RUNTIME_USER.email)
  await page.fill('input[type="password"]', RUNTIME_USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

/** KST 오늘 ISO 요일 1=월..7=일. */
function kstIsoWeekday(): number {
  const d = new Date(Date.now() + 9 * 3_600_000).getUTCDay()
  return d === 0 ? 7 : d
}

test.describe('Today 무대 — /hub', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined })
    await login(page)
    await page.context().storageState({ path: STATE_PATH })
    await page.close()
  })
  test.use({ storageState: STATE_PATH })

  test('① 단어 지면이 실제 내 단어를 말한다 (개수만 말하지 않는다)', async ({ page }) => {
    await page.goto('/hub', { waitUntil: 'domcontentloaded' })

    const stage = page.locator('[data-today-stage]')
    await expect(stage).toBeVisible({ timeout: 30_000 })

    const word = page.locator('[data-today-word]')
    await expect(word).toBeVisible()

    const shown = (await word.getAttribute('data-today-word'))?.trim() ?? ''
    expect(shown.length, '지면에 단어가 비어 있다').toBeGreaterThan(0)

    // 화면이 지어낸 단어가 아니라 이 학습자의 vocabularies 행이어야 한다.
    const c = serviceClient()
    if (c) {
      const userId = await userIdByEmail(RUNTIME_USER.email)
      expect(userId, 'service-role 키는 있는데 계정을 못 찾았다').not.toBeNull()
      const { data } = await c
        .from('vocabularies')
        .select('word')
        .eq('user_id', userId!)
        .eq('word', shown)
        .limit(1)
      expect(
        (data ?? []).length,
        `화면의 "${shown}" 가 내 단어장에 없다 — 목업이 새어 들어왔을 수 있다`,
      ).toBe(1)
    }

    // 뜻이 함께 조판된다(단어만 크게 띄우는 것은 학습 재료가 아니다)
    await expect(stage).toContainText(/[가-힣]/)
  })

  test('② 시작 버튼은 하나 (단일 CTA)', async ({ page }) => {
    await page.goto('/hub', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-today-stage]')).toBeVisible({ timeout: 30_000 })

    const starts = page.locator('[data-today-stage]').getByRole('link', { name: /시작/ })
    const buttons = page.locator('[data-today-stage]').getByRole('button', { name: /시작/ })
    expect(
      (await starts.count()) + (await buttons.count()),
      '무대에 시작 버튼이 둘 이상이다 — "지금 뭘" 이 흐려진다',
    ).toBe(1)
  })

  test('③ 수동계획이 있는 날에는 처방 흐름을 렌더하지 않는다 (표면 이중화 금지)', async ({
    page,
  }) => {
    const c = serviceClient()
    test.skip(!c, 'SUPABASE_SERVICE_ROLE_KEY 없음 — 계획 상태를 만들 수 없다')

    const userId = await userIdByEmail(RUNTIME_USER.email)
    expect(userId).not.toBeNull()

    // 대조군: 계획이 없는 상태에서는 흐름이 보인다
    await page.goto('/hub', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-today-flow]')).toBeVisible({ timeout: 30_000 })

    // 이 테스트가 만든 행만 지우기 위해 id 를 들고 있는다
    let insertedId: string | null = null
    try {
      const { data: book } = await c!.from('library_books').select('id').limit(1)
      test.skip(!book || book.length === 0, '계획에 걸 자료가 없다')

      const { data: inserted, error } = await c!
        .from('study_plan_items')
        .insert({
          user_id: userId!,
          material_type: 'book',
          material_id: (book![0] as { id: string }).id,
          modules: ['read'],
          chapters: [],
          weekdays: [kstIsoWeekday()],
        })
        .select('id')
        .single()
      expect(error, `계획 행 삽입 실패: ${error?.message}`).toBeNull()
      insertedId = (inserted as { id: string }).id

      await page.goto('/hub', { waitUntil: 'domcontentloaded' })

      // 계획 카드가 오늘의 정본이 된다
      await expect(page.getByRole('region', { name: '오늘의 학습 계획' })).toBeVisible({
        timeout: 30_000,
      })
      // 그리고 처방 흐름은 **없다** — 여기가 이 스펙의 핵심이다
      await expect(page.locator('[data-today-flow]')).toHaveCount(0)
      // 단어 지면은 남는다 (할 일 표면이 아니라 학습 재료라서)
      await expect(page.locator('[data-today-stage]')).toBeVisible()
    } finally {
      if (insertedId) {
        await c!.from('study_plan_items').delete().eq('id', insertedId)
      }
    }
  })
})
