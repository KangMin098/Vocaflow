// apps/web/tests/e2e/38-hub-ribbon-truth.spec.ts
//
// **상태 띠가 말하는 수가 DB 와 같은가** — 학습자가 가장 자주 보는 숫자다.
//
// ── 왜 (실측 2026-08-29 ~ 30) ────────────────────────────────────────
// 이 루프에서 지어낸 수치가 **세 번** 나왔다:
//   · `/wordvault?view=review` 의 `오늘 복습할 단어 12개` (하드코딩)
//   · `QuickStartCard` 의 `pendingCount = 12 · todayGoal = 15 · todayDone = 8` (기본값)
//   · 공개 요금제의 지어낸 지표(진단 2회차에서 제거)
// 셋 다 화면은 멀쩡했고 아무 에러도 없었다. 유일하게 그것을 잡을 수 있는 자는
// **DB 와 직접 대조하는 검사**뿐인데, 지금 그 자를 가진 화면은 `/wordvault` 하나였다
// (`24-wordvault-real-stats`).
//
// 상태 띠는 셸 최상단이라 **모든 화면에서 보인다.** 여기가 틀리면 학습자는 어디를 봐도
// 틀린 수를 본다. 그래서 이 자를 여기에도 세운다.
//
// 판정은 앱과 **같은 함수**로 한다 — `getMemoryState`(R(t) 동적 계산). 테스트가 자기
// 나름의 임계값을 다시 쓰면, 앱이 바뀔 때 이 검사는 조용히 다른 것을 재게 된다.
//
// (서비스 키가 없으면 대조를 못 하므로 skip — 조용히 통과시키지 않는다.)

import { expect, test, type Page } from '@playwright/test'

import { MEMORY_ATTENTION_LABEL } from '../../src/lib/framework/memory-labels'
import { getMemoryState } from '../../src/lib/srs/state'
import type { ModuleId, SrsCard } from '../../src/lib/srs/types'
import { serviceClient, userIdByEmail } from './utils/db'

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
}
const STATE_PATH = 'playwright-auth/.auth-hub-ribbon.json'

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800) // hydration — controlled input 리셋 방지
  await page.fill('input[type="email"]', RUNTIME_USER.email)
  await page.fill('input[type="password"]', RUNTIME_USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

interface VocabRow {
  id: string
  difficulty: number | null
  stability: number | null
  last_review_at: string | null
  next_review_at: string | null
  module_history: string[] | null
  review_count: number | null
}

const toCard = (r: VocabRow): SrsCard => ({
  id: r.id,
  difficulty: r.difficulty ?? 6,
  stability: r.stability ?? 0,
  lastReviewAt: r.last_review_at ? new Date(r.last_review_at) : null,
  nextReviewAt: r.next_review_at ? new Date(r.next_review_at) : null,
  moduleHistory: (r.module_history ?? []) as ModuleId[],
  reviewCount: r.review_count ?? 0,
})

test.describe('상태 띠 — DB 와 같은 수를 말한다', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined })
    await login(page)
    await page.context().storageState({ path: STATE_PATH })
    await page.close()
  })
  test.use({ storageState: STATE_PATH })

  test('"새 단어"·"다시 볼" 칩이 DB 실측과 일치한다', async ({ page }) => {
    const svc = serviceClient()
    test.skip(!svc, '서비스 키가 없어 DB 대조를 못 한다 — 통과로 세지 않는다')

    const userId = await userIdByEmail(RUNTIME_USER.email)
    expect(userId, '검증 계정을 찾지 못했다').toBeTruthy()

    const { data, error } = await svc!
      .from('vocabularies')
      .select('id, difficulty, stability, last_review_at, next_review_at, module_history, review_count')
      .eq('user_id', userId!)
    expect(error, `vocabularies 조회 실패: ${error?.message}`).toBeNull()

    const now = new Date()
    let fresh = 0
    let attention = 0
    for (const r of (data ?? []) as VocabRow[]) {
      const s = getMemoryState(toCard(r), now)
      if (s === 'new') fresh += 1
      else if (s === 'risk' || s === 'shaky') attention += 1
    }

    // 분모가 0이면 이 검사는 아무것도 지키지 않는다 — 통과로 세지 않는다.
    expect(
      fresh + attention,
      '이 계정에는 띠에 뜰 낱말이 없다 — 대조할 수가 없다',
    ).toBeGreaterThan(0)

    await page.goto('/hub', { waitUntil: 'networkidle' })

    // ⚠️ 화면의 수는 **aria-label** 에서 읽는다. 시각 숫자만 읽으면 보조기기가 듣는 값과
    //    갈라져도 모른다 — 이 저장소는 그 둘이 어긋난 적이 있다(리본 135 vs Vault 20).
    if (fresh > 0) {
      const chip = page.getByRole('link', { name: /아직 안 배운 단어 \d+개 보기/ })
      await expect(chip, '새 단어가 있는데 칩이 없다').toBeVisible()
      const shown = Number(((await chip.getAttribute('aria-label')) ?? '').match(/(\d+)개/)?.[1])
      expect(shown, `DB 는 새 단어 ${fresh} 인데 띠는 ${shown} 이라고 말한다`).toBe(fresh)
    }

    if (attention > 0) {
      // ⚠️ 이름은 레지스트리에서 가져온다 — 여기서 "다시 볼" 이라고 적으면 라벨이 바뀔 때
      //    이 검사는 **조용히 아무것도 못 찾고** 지나간다(칩이 없으면 실패해야 한다).
      //    ⚠️ `filter({ hasNotText })` 로 새 단어 칩을 빼려 했다가 되돌렸다 — 그건 **본문**을
      //       보는데 구별되는 문구는 **aria-label** 에 있다. 처음엔 통과했지만 그건
      //       두 칩의 렌더 순서 덕이었지 선택자가 맞아서가 아니었다.
      const chip = page.getByRole('link', {
        name: new RegExp(`${MEMORY_ATTENTION_LABEL} 단어 \\d+개 보기`),
      })
      await expect(chip, `${MEMORY_ATTENTION_LABEL} 단어가 있는데 칩이 없다`).toBeVisible()
      const shown = Number(((await chip.getAttribute('aria-label')) ?? '').match(/(\d+)개/)?.[1])
      expect(
        shown,
        `DB 는 ${MEMORY_ATTENTION_LABEL} ${attention} 인데 띠는 ${shown} 이라고 말한다`,
      ).toBe(attention)
    }
  })

  test('띠가 "아직 시작 전" 이라고 말할 때는 정말 0이다', async ({ page }) => {
    // 빈 상태 문장은 **숫자를 하나도 안 그리는** 대신 쓰는 것이다(ADR 0006 D2).
    // 할 일이 있는데 그 문장이 뜨면, 교사가 보낸 낱말이 사라진 것처럼 보인다
    // (2026-08-27 에 실제로 그랬다 — `today-status.ts` 의 `fresh` 가 그때 생겼다).
    const svc = serviceClient()
    test.skip(!svc, '서비스 키가 없어 DB 대조를 못 한다')

    await page.goto('/hub', { waitUntil: 'networkidle' })
    const empty = page.getByText(/아직 시작 전이에요/)
    if ((await empty.count()) === 0) return // 빈 상태가 아니다 — 이 검사의 대상이 아니다

    const userId = await userIdByEmail(RUNTIME_USER.email)
    const { data } = await svc!
      .from('vocabularies')
      .select('id, difficulty, stability, last_review_at, next_review_at, module_history, review_count')
      .eq('user_id', userId!)
    const now = new Date()
    const actionable = ((data ?? []) as VocabRow[]).filter((r) => {
      const s = getMemoryState(toCard(r), now)
      return s === 'new' || s === 'risk' || s === 'shaky'
    }).length
    expect(
      actionable,
      `띠는 "아직 시작 전" 이라는데 실제로는 ${actionable}개가 손이 필요하다`,
    ).toBe(0)
  })
})
