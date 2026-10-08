// apps/web/tests/e2e/40-knowledge-practice.spec.ts
//
// 학습 원리 vNext 통합 — 관리자 고리(원리 → 방법론 → 학습 설계 → 제품 적용)와
// 학습자 과제(/csat/practice/claim-evidence-v1) 흐름을 관리자 **미리보기**로 끝까지 돌린다.
// 정본 docs/methodology/VNEXT.md §6. 전제: 마이그레이션 20261008120000 + 시범 시드 적용.
//
// 쓰는 데이터: 테스트 계정의 이 설계 미리보기 기록(preview=true)만 — 효과 계산에서 빠지는 행.
// 시작·끝에 그 행만 지운다. service-role 키나 시드가 없으면 건너뛴다(조용히 통과시키지 않고 이유를 남긴다).
import { test, expect, type Page } from '@playwright/test'
import { TEST_USER } from './fixtures/test-user'
import { TEST_USER_STATE, ensureAuthState } from './utils/auth'
import { serviceClient, userIdByEmail } from './utils/db'

const SLUG = 'claim-evidence-v1'
const PRACTICE = `/csat/practice/${SLUG}?preview=1`

async function designId(): Promise<string | null> {
  const c = serviceClient()
  if (!c) return null
  const { data } = await c.from('knowledge_designs').select('id').eq('slug', SLUG).maybeSingle()
  return (data?.id as string | undefined) ?? null
}

async function clearPreviewRuns(userId: string, design: string) {
  const c = serviceClient()!
  const { error } = await c.from('knowledge_task_runs').delete().eq('user_id', userId).eq('design_id', design).eq('preview', true)
  if (error) throw new Error(`미리보기 기록 정리 실패: ${error.message}`)
}

async function previewRuns(userId: string, design: string) {
  const c = serviceClient()!
  const { data, error } = await c
    .from('knowledge_task_runs')
    .select('item_id,phase,claim_hit,created_at')
    .eq('user_id', userId)
    .eq('design_id', design)
    .eq('preview', true)
    .order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []) as { item_id: string; phase: string; claim_hit: boolean; created_at: string }[]
}

/** 지금 고른 문항을 한 번 푼다 — 문장 1을 주장으로, 선지 1번, 확신 「아마도」. */
async function solveCurrent(page: Page, opts: { doubleClick?: boolean } = {}) {
  await page.getByRole('button', { name: /^문장 1/ }).click()
  await page.getByRole('button', { name: '1번', exact: true }).click()
  await page.getByRole('button', { name: '아마도' }).click()
  const submit = page.getByRole('button', { name: '맞춰 보기' })
  if (opts.doubleClick) await submit.dblclick()
  else await submit.click()
  await expect(page.getByRole('status').filter({ hasText: /정답 근거/ })).toBeVisible({ timeout: 20_000 })
}

async function selectedLabel(page: Page) {
  return page.locator('select').evaluate((el) => {
    const s = el as HTMLSelectElement
    return { label: s.options[s.selectedIndex]?.textContent ?? '', group: (s.options[s.selectedIndex]?.parentElement as HTMLOptGroupElement | null)?.label ?? '' }
  })
}

test.describe('학습 원리 vNext — 관리자 고리 + 학습자 과제', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: TEST_USER_STATE })

  let userId: string | null = null
  let design: string | null = null

  test.beforeAll(async ({ browser }) => {
    await ensureAuthState(browser, TEST_USER_STATE)
    userId = await userIdByEmail(TEST_USER.email)
    design = await designId()
    if (userId && design) await clearPreviewRuns(userId, design)
  })

  test.afterAll(async () => {
    if (userId && design) await clearPreviewRuns(userId, design)
  })

  test('관리자: 운영실 → 지도(역량 노드) → 탐구 질문 → 설계 → 품질이 이어진다', async ({ page }) => {
    test.skip(!design, '시범 시드(claim-evidence-v1)가 없다 — scripts/knowledge/vnext-pilot-seed.sql 적용 전')
    await page.goto('/admin/knowledge')
    await expect(page.getByRole('heading', { level: 1, name: '원리 운영실' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /우선 처리/ })).toBeVisible()

    await page.goto('/admin/knowledge/map?node=cap-claim-evidence')
    await expect(page.getByRole('heading', { level: 1, name: '역량·원리 지도' })).toBeVisible()
    const panel = page.locator('#node-panel')
    await expect(panel.getByRole('heading', { name: '주장과 근거의 관계를 복원한다' })).toBeVisible()
    await expect(panel).toContainText('메타분석')
    await expect(panel.getByRole('link', { name: /설계 「주장 문장 먼저 찾기」/ })).toBeVisible()

    await page.goto('/admin/knowledge/lab/claim-first-reading')
    await expect(page.getByRole('heading', { name: '입장 비교' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /조건부 1/ })).toBeVisible()

    await page.goto(`/admin/knowledge/design/${SLUG}`)
    await expect(page.getByRole('heading', { level: 1, name: '주장 문장 먼저 찾기' })).toBeVisible()
    // 원리(기제) → 방법론 → 공부법이 역할별로 연결돼 있고, 채택 전이라 배포 문턱이 막는다
    await expect(page.getByRole('heading', { name: '언어 처리 기제' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '방법론' })).toBeVisible()
    await expect(page.getByText(/채택되지 않은 항목 8개/)).toBeVisible()
    await expect(page.getByRole('button', { name: '배포 중(으)로' })).toBeDisabled()

    await page.goto('/admin/knowledge/quality')
    await expect(page.getByRole('heading', { level: 1, name: '제품 적용·품질' })).toBeVisible()
    await expect(page.getByText('주장 문장 먼저 찾기')).toBeVisible()
  })

  test('학습자: 배포 전 설계는 미리보기가 아니면 열리지 않는다', async ({ page }) => {
    test.skip(!design, '시범 시드 없음')
    const res = await page.goto(`/csat/practice/${SLUG}`)
    expect(res?.status()).toBe(404)
  })

  test('학습자: 풀이 → 판정 → 다음 문항 · 훈련 수는 문항마다 한 번 · 5회째 뒤 전이 · 새로고침·중복 클릭 안정', async ({ page }) => {
    test.skip(!design || !userId, 'service-role 키 또는 시범 시드 없음')
    await page.goto(PRACTICE)
    await expect(page.getByRole('heading', { level: 1, name: '주장 문장 먼저 찾기' })).toBeVisible()
    await expect(page.getByText(/아직 0번 해 봤어요/)).toBeVisible()

    const solved: string[] = []
    for (let i = 1; i <= 5; i++) {
      const before = await selectedLabel(page)
      // 훈련 문항부터 추천된다
      expect(before.group, `${i}번째 문항의 그룹`).toContain('연습')
      solved.push(before.label)
      await solveCurrent(page, { doubleClick: i === 2 }) // 2번째는 「맞춰 보기」 두 번 누르기
      if (i < 5) {
        await page.getByRole('button', { name: '다음 문항' }).click()
        await expect(page.getByRole('button', { name: /^문장 1/ })).toBeEnabled()
      }
    }

    // DB: 서로 다른 훈련 문항 5개, 문항마다 1행(중복 클릭이 두 행을 만들지 않았다)
    const rows = await previewRuns(userId!, design!)
    expect(rows.length, '미리보기 기록 수').toBe(5)
    expect(new Set(rows.map((r) => r.item_id)).size).toBe(5)
    expect(rows.every((r) => r.phase === 'train')).toBe(true)

    // 5회째 뒤 「다음 문항」은 전이(다른 유형) 문항
    await page.getByRole('button', { name: '다음 문항' }).click()
    const sixth = await selectedLabel(page)
    expect(sixth.group, '5회 뒤 다음 문항 그룹').toContain('다른 유형')
    expect(sixth.label).toMatch(/주제|제목/)

    // 새로고침: 서버 집계도 5회 — 판정이 「최근 5번 중」으로 바뀌고, 추천도 전이 문항
    await page.reload()
    await expect(page.getByText(/최근 5번 중 \d+번/)).toBeVisible()
    const afterReload = await selectedLabel(page)
    expect(afterReload.group).toContain('다른 유형')
    await expect(page.locator('ol[aria-label="최근 기록"] li')).toHaveCount(5)

    // 전이 문항을 풀어 기록이 transfer 로 남는지
    await solveCurrent(page)
    const rows2 = await previewRuns(userId!, design!)
    expect(rows2.filter((r) => r.phase === 'transfer').length).toBe(1)
  })

  test('학습자: 다른 세션에서 같은 문항을 다시 내도 훈련 수는 늘지 않는다(학습자·문항마다 첫 시도)', async ({ browser }) => {
    test.skip(!design || !userId, 'service-role 키 또는 시범 시드 없음')
    const first = (await previewRuns(userId!, design!)).find((r) => r.phase === 'train')
    test.skip(!first, '앞 시험의 기록이 없다')
    const ctx = await browser.newContext({ storageState: TEST_USER_STATE })
    const page = await ctx.newPage()
    await page.goto(`${PRACTICE}&item=${encodeURIComponent(first!.item_id)}`)
    await solveCurrent(page)
    // 행은 늘지만(기록은 지우지 않는다) 판정·완료는 첫 시도만 센다
    const rows = await previewRuns(userId!, design!)
    expect(rows.filter((r) => r.item_id === first!.item_id).length).toBe(2)
    await page.goto(PRACTICE)
    await expect(page.getByText(/최근 5번 중 \d+번/)).toBeVisible()
    await expect(page.locator('ol[aria-label="최근 기록"] li')).toHaveCount(6) // 훈련 5 + 전이 1, 재제출은 빠짐
    await ctx.close()
  })
})
