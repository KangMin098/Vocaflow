// apps/web/tests/e2e/21-vcb-studio.spec.ts
// 단어장 Studio 상호작용 회귀 — /admin/vocab/studio 에서 유형을 고르고 채점까지 돈다.
//
// 왜 렌더 확인만으로는 부족한가: 이 화면의 값은 **채점이 발행을 막는 것**이다. 서버 액션
// (previewBlueprint) 이 조용히 깨지면 화면은 그대로 뜨고 발행 버튼만 영원히 잠긴 상태가 된다.
// 그래서 "채점 결과가 실제로 돌아오고, 통과하면 발행 버튼이 열린다" 를 자동 회귀로 남긴다.
//
// ⚠️ 발행(쓰기)은 하지 않는다 — e2e 가 공용 카탈로그에 세트를 남기면 다음 실행의 novelty 대조군이
// 오염된다. 쓰기 경로는 통합 테스트/CLI 에서 검증한다.

import { test, expect, type Page } from '@playwright/test'

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200))
  })
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${String(e).slice(0, 200)}`))
  return errors
}

function fatalErrors(errors: string[]): string[] {
  return errors.filter(
    (e) => !/favicon|404 \(Not Found\)|auth-js|auth\/v1\/token|Failed to fetch|ChunkLoadError/.test(e),
  )
}

test.describe('단어장 Studio — 유형 선택 → 채점 → 발행 게이트', () => {
  test('다의어 유형을 골라 채점하면 총점과 면별 준비도가 나오고 발행 버튼이 열린다', async ({ page }) => {
    test.setTimeout(180_000)
    const errors = collectConsoleErrors(page)

    await page.goto('/admin/vocab/studio', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // 카탈로그 — 고유 유형 묶음이 먼저 온다 (지면이 못 만드는 것을 앞에 둔 배치)
    await expect(page.getByRole('heading', { name: '단어장 Studio' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('이 플랫폼만 만들 수 있다')).toBeVisible()

    // 자산 결손 유형을 숨기지 않는다 — 이유를 붙여 보여준다
    await expect(page.getByText(/image_url 0%/).first()).toBeVisible()

    // 사전만 읽는 가벼운 유형으로 채점한다 (코퍼스 유형은 수 초 걸린다)
    await page.getByRole('button').filter({ hasText: '다의어 정복' }).first().click()
    await expect(page.getByRole('heading', { name: /다의어 설정/ })).toBeVisible()

    // 채점 전에는 발행이 잠겨 있다 — 이것이 이 화면의 계약이다.
    // exact: true — 카탈로그 카드 설명에 '발행' 이라는 낱말이 들어 있어 substring 매칭은 2개를 잡는다.
    const publishBtn = page.getByRole('button', { name: '발행', exact: true })
    await expect(publishBtn).toBeDisabled()

    await page.getByRole('button', { name: /미리보기 \+ 채점/ }).click()

    // 채점 결과
    await expect(page.getByText('통과선 0.80')).toBeVisible({ timeout: 120_000 })
    await expect(page.getByText('선언한 면이 실제로 훈련 가능한가')).toBeVisible()
    await expect(page.getByText('어디서 몇 개가 떨어졌나')).toBeVisible()
    await expect(page.getByText(/목차 미리보기/)).toBeVisible()

    // 시중 베스트 대비 비교가 함께 나온다 — 측정만 하고 안 보이면 없는 것과 같다
    await expect(page.getByText(/시중 베스트와 비교 —/)).toBeVisible()
    await expect(page.getByText(/전 요소 우위|전 요소 이상|열위 \d+개/)).toBeVisible()

    // 통과했으면 발행이 열린다 (다의어는 실측 0.92 — 통과선 위)
    await expect(publishBtn).toBeEnabled({ timeout: 10_000 })

    expect(fatalErrors(errors), `콘솔 에러: ${fatalErrors(errors).join(' | ')}`).toHaveLength(0)
  })
})
