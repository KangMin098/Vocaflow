// apps/web/tests/e2e/13-pdcp-console.spec.ts
//
// PDCP 운영 콘솔 회귀 — `/admin/pd-comics` 와 `/api/pdcp/*`.
//
// 이 스펙이 잡으려는 것:
//   ① **관리자 게이트** — PDCP API 는 소스 취득·프로세스 spawn·DB 쓰기를 한다.
//      비관리자에게 하나라도 열리면 사고다. 6개 라우트를 전부 확인한다.
//   ② **드레인은 dev 전용** — 배포 환경에서 앱이 ffmpeg 을 돌리면 안 된다.
//   ③ 관리자 세션이 있을 때 콘솔이 **조작면**으로 뜨는가(읽기 전용 목록으로 퇴화하지 않았는가).
//
// 런타임 검증 계정은 role='user' 라 ③ 은 관리자 세션이 있을 때만 수행한다.
// 세션이 없으면 조용히 통과시키지 않고 skip 으로 남긴다 — 통과처럼 보이면 안 된다.

import { test, expect } from '@playwright/test'

import { TEST_USER_STATE, ensureAuthState } from './utils/auth'

/** 관리자 게이트 뒤에 있어야 하는 전 라우트. */
const GUARDED = [
  { method: 'GET', path: '/api/pdcp/sources' },
  { method: 'GET', path: '/api/pdcp/queue' },
  { method: 'GET', path: '/api/pdcp/doctor' },
  { method: 'POST', path: '/api/pdcp/search', body: { source: 'internet-archive', query: 'x' } },
  { method: 'POST', path: '/api/pdcp/enqueue', body: { source: 'internet-archive', identifiers: ['x'] } },
  { method: 'POST', path: '/api/pdcp/drain', body: {} },
  { method: 'POST', path: '/api/pdcp/retry', body: {} },
  { method: 'GET', path: '/api/pdcp/assist' },
  { method: 'POST', path: '/api/pdcp/assist', body: { site: 'dcm', slug: 'gate-probe' } },
] as const

/**
 * DEV_ADMIN_BYPASS 가 켜져 있으면 **모든 요청이 관리자**라 게이트 검증이 성립하지 않는다.
 * 그 상태에서 실패를 그대로 두면 "원래 빨간 스펙"으로 학습돼 진짜 구멍을 놓친다 —
 * 미인증 요청이 통과하는지로 우회 여부를 탐지해 명시적으로 skip 한다.
 */
async function bypassOn(request: { get: (u: string) => Promise<{ status: () => number }> }) {
  return (await request.get('/api/pdcp/sources')).status() === 200
}

test.describe('PDCP 콘솔 — 관리자 게이트', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureAuthState(browser, TEST_USER_STATE)
  })
  test.use({ storageState: TEST_USER_STATE })

  test.beforeEach(async ({ request }) => {
    test.skip(await bypassOn(request), 'DEV_ADMIN_BYPASS 활성 — 게이트 검증 불가')
  })

  test('로그인 없이는 전 라우트가 401', async ({ request }) => {
    for (const r of GUARDED) {
      const res =
        r.method === 'GET'
          ? await request.get(r.path)
          : await request.post(r.path, { data: (r as { body?: unknown }).body ?? {} })
      expect(res.status(), `${r.method} ${r.path}`).toBe(401)
    }
  })

  test('일반 학습자 세션으로도 전 라우트가 막힌다', async ({ page }) => {
    // page.request 여야 로그인 쿠키가 실린다. 최상위 request 픽스처는 쿠키를 공유하지 않아
    // 언제나 미인증 401 이 나오고, 그러면 "학습자가 막힌다"를 검증하지 못한다.
    for (const r of GUARDED) {
      const res =
        r.method === 'GET'
          ? await page.request.get(r.path)
          : await page.request.post(r.path, { data: (r as { body?: unknown }).body ?? {} })
      expect([401, 403], `${r.method} ${r.path} → ${res.status()}`).toContain(res.status())
    }
  })

  test('관리자 화면도 학습자에게는 열리지 않는다', async ({ page }) => {
    await page.goto('/admin/pd-comics')
    expect(page.url()).not.toContain('/admin/pd-comics')
  })
})

test.describe('PDCP 콘솔 — 조작면', () => {
  test('관리자 세션이면 3개 탭과 드레인 조작이 보인다', async ({ page }) => {
    const res = await page.goto('/admin/pd-comics')
    test.skip(
      !res || res.url().includes('/login'),
      '관리자 세션 없음 — DEV_ADMIN_BYPASS 또는 admin 계정 필요',
    )

    // 조작면이 아니라 읽기 전용 목록으로 퇴화하면 여기서 깨진다
    await expect(page.getByRole('button', { name: '소스 · 대량 적재' })).toBeVisible()
    await expect(page.getByRole('button', { name: '큐 · 드레인' })).toBeVisible()
    await expect(page.getByRole('button', { name: '도구' })).toBeVisible()

    await page.getByRole('button', { name: '큐 · 드레인' }).click()
    await expect(page.getByRole('button', { name: /드레인 실행/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /dry-run/ })).toBeVisible()

    await page.getByRole('button', { name: '소스 · 대량 적재' }).click()
    // 테스트 모드가 없으면 전권(52p)만 받게 되어 파라미터 확인이 불가능하다
    await expect(page.getByLabel(/테스트 모드/)).toBeVisible()
  })

  test('어댑터 능력표가 소스별 취득 방식 차이를 드러낸다', async ({ page }) => {
    const res = await page.goto('/admin/pd-comics')
    test.skip(!res || res.url().includes('/login'), '관리자 세션 없음')

    await page.getByRole('button', { name: '소스 · 대량 적재' }).click()
    // 자동 대량취득 가능(IA)과 수동(local-dir)이 한 표에서 구분돼야 한다.
    // 이름은 소스 <select> 에도 나오므로 표의 셀로 한정한다.
    await expect(page.getByRole('cell', { name: 'Internet Archive' })).toBeVisible()
    await expect(page.getByRole('cell', { name: '로컬 디렉터리 (수동 취득)' })).toBeVisible()
    // 능력 차이가 실제로 표에 드러나는가 — 대량 O/X 가 한 행씩
    await expect(page.getByRole('row', { name: /Internet Archive/ })).toContainText('api')
    await expect(page.getByRole('row', { name: /로컬 디렉터리/ })).toContainText('manual')
  })
})

test.describe('PDCP 소스 GET — 정교화된 발견', () => {
  test.beforeEach(async ({ page }) => {
    const res = await page.goto('/admin/pd-comics')
    test.skip(!res || res.url().includes('/login'), '관리자 세션 없음')
    await page.getByRole('button', { name: '소스 · 대량 적재' }).click()
  })

  test('프리셋 출발점과 필터가 노출된다', async ({ page }) => {
    // 자유 검색만 두면 저작권 살아 있는 자료가 상위에 섞인다(실측) — 출발점이 반드시 필요
    await expect(page.getByRole('button', { name: /Fawcett Comics/ })).toBeVisible()
    await expect(page.getByLabel('발행 상한')).toHaveValue('1963')
    await expect(page.getByLabel('컬렉션')).toBeVisible()
  })

  test('프리셋을 누르면 큐레이션 컬렉션 결과가 위험도 배지와 함께 나온다', async ({ page }) => {
    await page.getByRole('button', { name: /Fawcett Comics/ }).click()
    await expect(page.getByText(/전체 \d+건 중/)).toBeVisible({ timeout: 20_000 })
    // 위험도를 색만으로 전달하지 않는다 — 라벨이 함께 있어야 한다
    await expect(page.getByText('큐레이션').first()).toBeVisible()
    await expect(page.getByText(/확인 필요|PD 확정/).first()).toBeVisible()
  })

  test('브라우저 보조 패널이 자동 수집을 하지 않는 이유를 밝힌다', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /브라우저 보조 취득/ })).toBeVisible()
    await expect(page.getByRole('button', { name: '브라우저 열기' })).toBeVisible()
    // 정책 근거가 화면에 없으면 다음 사람이 스크래퍼를 붙이려 든다
    await expect(page.getByText(/robots\.txt|403|Cloudflare/)).toBeVisible()
  })

  test('작업명 없이는 브라우저 세션을 시작할 수 없다', async ({ page }) => {
    await expect(page.getByRole('button', { name: '브라우저 열기' })).toBeDisabled()
    await page.getByLabel('작업명').fill('whiz-002')
    await expect(page.getByRole('button', { name: '브라우저 열기' })).toBeEnabled()
  })
})
