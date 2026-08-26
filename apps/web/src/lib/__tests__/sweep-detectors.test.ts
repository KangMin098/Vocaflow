// apps/web/src/lib/__tests__/sweep-detectors.test.ts
//
// **전수 훑기의 판정기 자체를 잰다.**
//
// ── 왜 이 테스트가 있어야 하는가 (실측 2026-08-26) ──────────────────────
// `30-admin-sweep` 의 에러 화면 판정이 **죽어 있었다**:
//
//     /문제가 발생했어요|다시 시도/.test(t) === false && false
//
// `X === false && false` 는 **항상 false** 다. 관리자 33화면은 우리 에러 경계로
// 떨어져도 영영 초록이었다 — `app/error.tsx` 는 HTTP 200 에 본문도 충분해서
// 나머지 축(열림·조용함·연결·복귀)이 전부 통과하기 때문이다.
//
// 그 버그가 살아남은 이유는 단순하다: **판정기를 재는 것이 아무것도 없었다.**
// 훑기가 초록이면 판정기도 맞다고 여겼는데, 판정기가 죽으면 훑기는 **더 초록**이 된다.
// 그래서 판정기는 훑기와 별개로 여기서 잰다 — 이건 브라우저가 필요 없는 순수 함수다.

import { describe, expect, it } from 'vitest'

import { crashKindOf, isCrashScreen } from '../../../tests/e2e/utils/crash-screen'

/** `app/error.tsx` 가 실제로 그리는 문장 (2026-08-26 소스 기준). */
const ERROR_BOUNDARY_BODY = [
  'Error',
  '문제가 발생했어요',
  '페이지를 표시하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  '다시 시도',
  '홈으로',
].join('\n')

/** `app/not-found.tsx` 가 실제로 그리는 문장. */
const NOT_FOUND_BODY = [
  '404',
  '페이지를 찾을 수 없어요',
  '주소를 확인해 주시거나 홈으로 돌아가 다시 시도해 주세요.',
  '홈으로 돌아가기',
].join('\n')

describe('에러 화면 판정 — crashKindOf', () => {
  it('app/error.tsx 본문을 에러 경계로 잡는다', () => {
    expect(crashKindOf(ERROR_BOUNDARY_BODY)).toBe('에러 경계')
  })

  it('app/not-found.tsx 본문을 404 화면으로 잡는다', () => {
    expect(crashKindOf(NOT_FOUND_BODY)).toBe('404 화면')
  })

  it('Next 프레임워크 오류도 잡는다', () => {
    expect(crashKindOf('Application error: a client-side exception has occurred')).toBe(
      '프레임워크 오류',
    )
  })

  /**
   * **이 케이스가 이 파일이 존재하는 이유다.**
   *
   * 죽은 조건의 원래 의도는 버튼 라벨 `다시 시도` 로도 잡는 것이었는데,
   * 그 문구는 **정상 관리자 화면의 재시도 버튼**에도 흔하다.
   * 넣으면 멀쩡한 화면이 무더기로 "에러" 가 되고, 그러면 사람은 판정을 끄게 된다.
   * (실제로 끈 결과가 `=== false && false` 였다.)
   */
  it('정상 화면의 "다시 시도" 버튼을 에러로 오해하지 않는다', () => {
    const healthyAdminScreen = [
      '큐레이션 큐',
      '대기 12 · 처리 중 3',
      '불러오지 못했습니다. 다시 시도',
      '소스 GET (대량)',
    ].join('\n')
    expect(crashKindOf(healthyAdminScreen)).toBeNull()
    expect(isCrashScreen(healthyAdminScreen)).toBe(false)
  })

  it('평범한 학습자 화면은 통과시킨다', () => {
    expect(crashKindOf('오늘의 학습\n단어 12개가 기다리고 있어요')).toBeNull()
  })

  it('빈 본문은 에러 화면이 아니다 — 그건 "본문이 비었다" 축이 따로 본다', () => {
    expect(crashKindOf('')).toBeNull()
  })
})
