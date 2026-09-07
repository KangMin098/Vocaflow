// apps/web/tests/e2e/25-practice-pool.spec.ts
//
// PRACTICE 게임 허브가 "**내 어떤 단어로 노는지**" 를 말하는지 — 형제 계약 회귀.
//
// 무슨 일이 있었나(2026-08-15 실측): 사이드바 PRACTICE 그룹 5형제가 두 계보로 갈려 있었다.
//   · Flashcard · SpellForge — 실 큐(내 단어 252개 중 20장 · 기억 4버킷 · 단어 예시)
//   · WordBlitz · PairFlip   — 화면의 30~60% 가 "학습 효과 / 게임 규칙" 설명서이고
//                              252단어를 가진 학습자에게 **단어 정보가 0** 이었다
// 어휘 학습 플랫폼의 연습 화면이 무엇으로 연습하는지 말하지 않는 것은 /hub 이 갖고 있던
// 결함과 같다(개수만 있고 단어가 없다).
//
// 이 스펙이 지키는 계약 3가지:
//   ① 풀 패널이 렌더된다 (`[data-game-pool]`)
//   ② 거기 뜨는 단어가 **내 vocabularies 행**이다 — 목업이 새어 들어오면 즉시 실패
//   ③ "내 단어 N개 중 M개" 의 N 이 DB 보유 총수와 같다 —
//      상한으로 잘린 풀 크기를 총수로 쓰면 "내 단어 40개"(실제 252) 가 된다. 실제로 그렇게 냈다가 고쳤다.
//
// 왜 두 게임을 한 스펙에서 보나: 형제 불일치가 문제의 절반이었다. 하나만 보면 "이 화면
// 괜찮네" 로 끝나고 갈라짐은 안 보인다. 새 형제는 `GAME_HUBS` 에 추가하면 같은 계약을 진다.
//
// ⚠️ 알려진 한계: 단어가 최소치 미만인 계정에서는 패널이 "부족" 안내를 띄우므로 ② 의
//    영단어 추출이 0 이 되어 실패한다. 검증 계정(252단어)에서는 해당 없다. 다른 계정으로
//    돌릴 거면 이 분기를 먼저 처리할 것.

import { test, expect, type Page } from '@playwright/test'

import { serviceClient, userIdByEmail } from './utils/db'

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
}
const STATE_PATH = 'playwright-auth/.auth-practice-pool.json'

/** 풀 패널을 가진 게임 허브 — 형제가 늘면 여기에 추가한다. */
const GAME_HUBS = [
  { url: '/wordblitz', label: 'WordBlitz' },
  { url: '/pairflip', label: 'PairFlip' },
]

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800) // hydration
  await page.fill('input[type="email"]', RUNTIME_USER.email)
  await page.fill('input[type="password"]', RUNTIME_USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

test.describe('PRACTICE 게임 허브 — 이번 판 단어', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined })
    await login(page)
    await page.context().storageState({ path: STATE_PATH })
    await page.close()
  })
  test.use({ storageState: STATE_PATH })

  for (const hub of GAME_HUBS) {
    test(`${hub.label} — 내 실제 단어를 말한다 (설명서만 있는 허브로 되돌아가지 않는다)`, async ({
      page,
    }) => {
      const c = serviceClient()
      test.skip(!c, 'SUPABASE_SERVICE_ROLE_KEY 없음 — 단어 대조 불가')

      const userId = await userIdByEmail(RUNTIME_USER.email)
      expect(userId, '계정을 못 찾았다').not.toBeNull()

      const { count: ownedTotal } = await c!
        .from('vocabularies')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId!)
      expect(ownedTotal, 'DB 보유 단어 수를 못 읽었다').not.toBeNull()

      await page.goto(hub.url, { waitUntil: 'domcontentloaded' })

      // ① 패널이 있다
      const panel = page.locator('[data-game-pool]')
      await expect(panel, `${hub.label} 허브에 "이번 판 단어" 패널이 없다`).toBeVisible({
        timeout: 30_000,
      })

      const text = await panel.innerText()

      // ③ 보유 총수가 DB 와 같다 (상한으로 잘린 풀 크기를 총수로 쓰면 여기서 걸린다)
      expect(
        text,
        `보유 총수가 DB(${ownedTotal})와 다르다 — 잘린 풀 크기를 총수로 쓰고 있을 수 있다`,
      ).toContain(String(ownedTotal))

      // ② 뜬 단어가 내 vocabularies 행이다
      //    영문 토큰만 추린다(한글 뜻·라벨 제외). 하나라도 내 것이 아니면 목업 유입이다.
      const enTokens = Array.from(text.matchAll(/\b[a-z]{4,}\b/g)).map((m) => m[0])
      const unique = Array.from(new Set(enTokens))
      expect(unique.length, '패널에 영단어가 하나도 없다').toBeGreaterThan(0)

      const { data: mine } = await c!
        .from('vocabularies')
        .select('word')
        .eq('user_id', userId!)
        .in('word', unique)

      const owned = new Set(((mine ?? []) as { word: string }[]).map((r) => r.word.toLowerCase()))
      const foreign = unique.filter((w) => !owned.has(w))

      expect(
        foreign,
        `${hub.label} 패널에 내 단어가 아닌 영단어가 있다 — 목업이 새어 들어왔을 수 있다`,
      ).toEqual([])
    })
  }
})
