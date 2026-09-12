// apps/web/tests/e2e/99-vault-measure.spec.ts (임시 계측 — FIX-E 전/후 비교용)
import { test, expect, type Page } from '@playwright/test'

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
}
const STATE_PATH = 'playwright-auth/.auth-vault-measure.json'

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await page.waitForTimeout(800)
  await page.fill('input[type="email"]', RUNTIME_USER.email)
  await page.fill('input[type="password"]', RUNTIME_USER.password)
  await page.click('button[type="submit"]', { noWaitAfter: true, timeout: 60_000 })
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120_000 })
}

function isData(url: string, origin: string): boolean {
  if (url.startsWith(origin)) {
    const rest = url.slice(origin.length)
    if (!rest.startsWith('/api/')) return false
    if (rest.startsWith('/api/auth/')) return false
    return true
  }
  if (/supabase\.(co|in)\//.test(url)) {
    return /\/rest\/v1\/|\/rpc\/|\/functions\/v1\/|\/auth\/v1\//.test(url)
  }
  return false
}

test.describe('WordVault 허브 요청 계측', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 })
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000)
    const page = await browser.newPage({ storageState: undefined })
    await login(page)
    await page.context().storageState({ path: STATE_PATH })
    await page.close()
  })
  test.use({ storageState: STATE_PATH, navigationTimeout: 180_000 })

  test('/wordvault 데이터 요청 수', async ({ page, baseURL }) => {
    const origin = (baseURL || 'http://localhost:3000').replace(/\/$/, '')
    let bag: string[] = []
    page.on('request', (req) => {
      const url = req.url()
      if (!isData(url, origin)) return
      bag.push(`${req.method()} ${url.replace(/^https?:\/\/[^/]+/, '')}`)
    })
    // 예열
    await page.goto('/wordvault', { waitUntil: 'domcontentloaded', timeout: 120_000 }).catch(() => {})
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})

    bag = []
    await page.goto('/wordvault', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
    await page.waitForTimeout(2500)

    const counts = new Map<string, number>()
    for (const k of bag) counts.set(k, (counts.get(k) || 0) + 1)
    const table = (re: RegExp) => bag.filter((b) => re.test(b)).length
    console.log('\n=== /wordvault 계측 ===')
    console.log(`데이터 요청 총 ${bag.length}건`)
    console.log(`  auth/v1/user      : ${table(/\/auth\/v1\/user/)}`)
    console.log(`  vocabularies      : ${table(/\/rest\/v1\/vocabularies/)}`)
    console.log(`  user_profiles     : ${table(/\/rest\/v1\/user_profiles/)}`)
    console.log(`  library_books     : ${table(/\/rest\/v1\/library_books/)}`)
    console.log(`  texts             : ${table(/\/rest\/v1\/texts/)}`)
    console.log(`  daily_activity    : ${table(/\/rest\/v1\/daily_activity/)}`)
    console.log(`  shared_dictionary : ${table(/\/rest\/v1\/shared_dictionary/)}`)
    console.log(`  shared_word_sets  : ${table(/\/rest\/v1\/shared_word_sets/)}`)
    console.log(`  shared_words      : ${table(/\/rest\/v1\/shared_words/)}`)
    console.log(`  subscriptions     : ${table(/user_word_set_subscriptions/)}`)
    console.log(`  rpc               : ${table(/\/rest\/v1\/rpc\//)}`)
    console.log(`  our /api          : ${table(/^GET \/api\//)}`)
    for (const [k, c] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`   ${String(c).padStart(2)}x  ${k.slice(0, 150)}`)
    }
    // 서버 렌더 HTML 에 실제 수치가 있는가
    const ssr = await page.request.get('/wordvault')
    const ssrHtml = await ssr.text()
    console.log(`SSR HTML 길이 ${ssrHtml.length} · "단어" 포함 ${ssrHtml.includes('단어')} · 스켈레톤(animate-pulse) ${/animate-pulse/.test(ssrHtml)}`)
    expect(bag.length).toBeGreaterThanOrEqual(0)
  })
})
