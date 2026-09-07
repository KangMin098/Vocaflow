// apps/web/tests/e2e/24-wordvault-real-stats.spec.ts
//
// WordVault 허브가 **내 수치**를 말하는지 — 목업 폴백 재발 방지.
//
// 무슨 일이 있었나(2026-08-15 실측): `WordVaultHub` 이 `realStats?.total ?? words.length` 였고
// `words` 의 초기값이 `MOCK_WORDS` 였다. 통계 조회가 'ready' 에 닿지 못하면 목업 13개가
// 학습자 본인의 수치처럼 남았다 — 실제 252개인 계정이 "13 단어 · 확실2 익숙1 회복2 신규8" 을
// 보고 있었다. 화면은 멀쩡했고 아무 에러도 없었다.
//
// 이 스펙은 화면의 숫자를 DB 합계와 직접 대조한다. 폴백이 되살아나면 즉시 실패한다.
// (서비스 키가 없으면 대조를 못 하므로 skip — 조용히 통과시키지 않는다.)

import { test, expect, type Page } from '@playwright/test'

import { MEMORY_LABEL } from '../../src/lib/framework/memory-labels'
import { serviceClient, userIdByEmail } from './utils/db'

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
}
const STATE_PATH = 'playwright-auth/.auth-wordvault-stats.json'

/** 목업 단어 수 — 이 숫자가 화면에 뜨면 폴백이 되살아난 것이다. */
const MOCK_WORD_COUNT = 13

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800) // hydration
  await page.fill('input[type="email"]', RUNTIME_USER.email)
  await page.fill('input[type="password"]', RUNTIME_USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

test.describe('WordVault 허브 — 실 수치', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined })
    await login(page)
    await page.context().storageState({ path: STATE_PATH })
    await page.close()
  })
  test.use({ storageState: STATE_PATH })

  test('허브가 말하는 단어 수 = DB 의 내 vocabularies 수', async ({ page }) => {
    const c = serviceClient()
    test.skip(!c, 'SUPABASE_SERVICE_ROLE_KEY 없음 — 대조할 수 없다')

    const userId = await userIdByEmail(RUNTIME_USER.email)
    expect(userId, '계정을 못 찾았다').not.toBeNull()

    const { count } = await c!
      .from('vocabularies')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId!)
    expect(count, 'DB 단어 수를 못 읽었다').not.toBeNull()

    await page.goto('/wordvault', { waitUntil: 'domcontentloaded' })

    // 통계 도착 전에는 스켈레톤(aria-busy)이다 — 그게 사라질 때까지 기다린다.
    await page
      .waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0, null, {
        timeout: 30_000,
      })
      .catch(() => {})

    // `main` 이 중첩돼 두 개다(Screen + 앱 셸) — strict mode 위반을 피해 body 로 읽는다
    const body = await page.locator('body').innerText()

    expect(
      body,
      `허브가 실제 단어 수(${count})를 말하지 않는다 — 목업 폴백이 되살아났을 수 있다`,
    ).toContain(String(count))

    // 목업 수가 총계 자리에 있으면 폴백이다. (실제 수가 우연히 13이면 위 단언이 이미 통과하므로
    // 이 확인은 '실제 수 ≠ 13' 일 때만 의미가 있다.)
    if (count !== MOCK_WORD_COUNT) {
      const total = page.getByText(new RegExp(`^${MOCK_WORD_COUNT}$`))
      expect(
        await total.count(),
        `목업 단어 수(${MOCK_WORD_COUNT})가 화면에 총계로 떠 있다`,
      ).toBe(0)
    }
  })

  test('CTA 가 말하는 개수 = 같은 화면의 4버킷 중 그 상태 개수 (한 화면 안에서 어긋나지 않는다)', async ({
    page,
  }) => {
    // 한 카드 안에 4버킷(확실·익숙·회복·신규)과 CTA 배너가 같이 있다. CTA 는 그중 하나를
    // 가리키는데(`buckets.risk` → '지금 다시 만나기'), 두 수가 다르면 학습자는 **같은 카드
    // 안에서 서로 다른 두 사실**을 읽는다. 화면은 멀쩡히 뜨고 에러도 없다.
    await page.goto('/wordvault', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200) // 통계는 클라이언트 페치
    expect(page.url()).not.toContain('/login')

    const card = page.locator('[aria-label="내 어휘 자산"]')
    await expect(card).toBeVisible()
    const text = (await card.innerText()).replace(/\s+/g, ' ')

    // 4버킷 — 라벨 뒤의 첫 숫자
    const bucket = (label: string): number => {
      // 템플릿 리터럴 안에서 `\s` 는 그냥 `s` 가 된다(알 수 없는 이스케이프) — 문자열 연결로 쓴다
      const m = text.match(new RegExp(label + '\\s+([\\d,]+)'))
      expect(m, `${label} 버킷을 못 읽음: ${text.slice(0, 300)}`).not.toBeNull()
      return Number(m![1].replace(/,/g, ''))
    }

    // CTA 라벨 → 대응하는 버킷. 우선순위는 컴포넌트와 같다(risk > shaky > new).
    // 버킷 이름은 **레지스트리에서 가져온다** — 여기에 문자열을 적어 두면 라벨이 바뀔 때
    // 이 스펙이 조용히 엉뚱한 것을 대조하게 된다(이 화면이 겪은 결함이 정확히 그거다).
    const CTA_BUCKET: Record<string, string> = {
      '지금 다시 만나기': MEMORY_LABEL.risk.label,
      '익숙해지는 단어 다지기': MEMORY_LABEL.shaky.label,
      '새 단어 익히기': MEMORY_LABEL.new.label,
    }
    const ctaLabel = Object.keys(CTA_BUCKET).find((l) => text.includes(l))
    test.skip(!ctaLabel, '해당 상태의 단어가 없어 CTA 가 중립 — 대조 대상 없음')

    const ctaLink = card.locator('a', { hasText: ctaLabel! }).first()
    const ctaText = (await ctaLink.innerText()).replace(/\s+/g, ' ')
    const ctaNum = ctaText.match(/([\d,]+)/)
    expect(ctaNum, `CTA 숫자를 못 읽음: ${ctaText}`).not.toBeNull()

    expect(
      Number(ctaNum![1].replace(/,/g, '')),
      `CTA "${ctaLabel}" 와 ${CTA_BUCKET[ctaLabel!]} 버킷이 어긋남 — 카드 전문: ${text.slice(0, 300)}`,
    ).toBe(bucket(CTA_BUCKET[ctaLabel!]))
  })
})
