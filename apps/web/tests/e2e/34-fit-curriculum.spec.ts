// apps/web/tests/e2e/34-fit-curriculum.spec.ts
//
// **교육과정 칸이 조용히 사라지는 것**을 잡는다.
//
// 이 칸은 `profile.curriculum` 이 있을 때만 그려진다. 그리고 그 값은
// `curriculum_bands` RPC 가 채운다 — **익명 실행 권한**이 필요하고(`/fit` 은 로그인 없이
// 쓰는 화면이다), `shared_dictionary` 를 읽는 SECURITY DEFINER 여야 한다.
// 둘 중 하나만 어긋나도 조회가 실패하고, 화면은 **아무 오류 없이 칸만 없어진다.**
// 페이지는 200 이고 커버리지 사다리도 멀쩡하다 — 눈으로는 못 잡는다.
//
// 그래서 익명으로 실제 지문을 넣고, 칸이 나오는지와 숫자가 맞는지를 본다.

import { test, expect } from '@playwright/test'

/** 비로그인 — 교사가 처음 오는 상태 그대로. */
test.use({ storageState: { cookies: [], origins: [] } })

/**
 * 표본 지문 — 교육과정 안과 밖이 **둘 다** 들어가도록 고른다.
 *
 *   안: the · have · other · convert · apparent (실측 밴드 1·1·2·3·3)
 *   밖: photosynthesis · intricate · cascade · nuance (그중 nuance 는 수능 기출)
 *
 * 한쪽만 있으면 "0" 이 정상인지 고장인지 구별할 수 없다.
 */
const SAMPLE = [
  'Photosynthesis is the process by which plants convert sunlight into chemical energy.',
  'This apparent simplicity conceals an intricate cascade of reactions,',
  'and the nuance of each step still puzzles researchers.',
  'Other organisms have evolved different strategies.',
].join(' ')

test.describe('/fit — 교육과정 기본 어휘', () => {
  test('익명 방문자에게 교육과정 칸이 보이고 숫자가 맞는다', async ({ page }) => {
    await page.goto('/fit', { waitUntil: 'domcontentloaded' })

    await page.locator('textarea').first().fill(SAMPLE)

    const panel = page.locator('section[aria-label="교육과정 기본 어휘"]')
    await expect(
      panel,
      '교육과정 칸이 안 나온다 — curriculum_bands 익명 실행 권한(GRANT ... TO anon)부터 확인할 것',
    ).toBeVisible({ timeout: 60_000 })

    const text = await panel.innerText()

    // 출처 — 이 숫자의 값어치는 어디서 왔는지 말할 수 있다는 것이다.
    expect(text).toContain('교육부 고시 제2022-33호')
    expect(text).toContain('3,000')

    // 밖이 0 이면 조회가 반쯤 죽은 것이다(표본에 밖 낱말을 일부러 넣었다).
    const outside = Number(text.match(/(\d+)\s*\n?개 낱말이/)?.[1] ?? '0')
    expect(outside, `목록 밖이 0이다 — 표본에는 밖 낱말이 있어야 한다:\n${text}`).toBeGreaterThan(0)

    // 안에 있는 낱말도 잡혀야 한다 — 전부 "밖" 으로 세는 실패 모드가 실제로 가능하다
    // (조회가 실패했는데 빈 Map 을 돌려주면 그렇게 된다. 그래서 null 로 구분한다.)
    await expect(panel.getByText('초등 권장')).toBeVisible()
    await expect(panel.getByText('중·고 공통')).toBeVisible()

    // 목록 밖 낱말이 실제로 나열돼야 교사가 가져다 쓸 수 있다.
    await expect(panel.getByText('목록 밖 낱말', { exact: false })).toBeVisible()
  })
})
