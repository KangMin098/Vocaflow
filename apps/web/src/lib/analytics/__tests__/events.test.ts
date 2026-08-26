// apps/web/src/lib/analytics/__tests__/events.test.ts
//
// 계측 안전장치 회귀. 이 파일이 지키는 계약은 하나다:
//
//   **붙여넣은 지문이 분석 도구로 새지 않는다.**
//
// `/fit` 은 "저장하지 않습니다" 를 화면에 약속한다. 그 약속은 우리 DB 뿐 아니라 제3자
// 분석 도구에도 적용된다. 타입은 빌드 후 사라지므로, 런타임 검사(`isSafeProps`)가
// 마지막 방어선이다 — 그게 실제로 지문을 막는지 여기서 확인한다.

import { describe, expect, it } from 'vitest'

import { ALLOWED_EVENTS, isSafeProps, resolvedDecile, sizeBucket } from '../events'

describe('isSafeProps — 지문이 새지 않는다', () => {
  it('숫자·불리언·null 은 통과한다', () => {
    expect(isSafeProps({ fitLevel: 7, shared: true, missing: null })).toBe(true)
    expect(isSafeProps({})).toBe(true)
  })

  it('짧고 공백 없는 열거형 문자열은 통과한다', () => {
    expect(isSafeProps({ sizeBucket: 'm' })).toBe(true)
    expect(isSafeProps({ band: 'growth' })).toBe(true)
  })

  // ── 핵심: 지문 조각은 반드시 막힌다 ──
  it.each([
    ['문장', 'Scientists have long assumed that memory decays.'],
    ['짧은 구절', 'memory decays'],
    ['두 단어', 'the retrieval'],
    ['공백 하나짜리', 'a b'],
    ['긴 단어 나열', 'disproportionatelyreinforcedpathway'],
  ])('지문 조각을 막는다 — %s', (_label, text) => {
    expect(isSafeProps({ anything: text })).toBe(false)
  })

  it('객체·배열·함수는 막는다 — 중첩으로 우회할 수 없다', () => {
    expect(isSafeProps({ nested: { text: 'hello world' } })).toBe(false)
    expect(isSafeProps({ list: ['a', 'b'] })).toBe(false)
    expect(isSafeProps({ fn: () => 'x' })).toBe(false)
  })

  it('props 자체가 객체가 아니면 막는다', () => {
    expect(isSafeProps(null)).toBe(false)
    expect(isSafeProps('text')).toBe(false)
    expect(isSafeProps(['a'])).toBe(false)
    expect(isSafeProps(undefined)).toBe(false)
  })

  it('24자 경계 — 그 이하만 통과한다', () => {
    expect(isSafeProps({ v: 'a'.repeat(24) })).toBe(true)
    expect(isSafeProps({ v: 'a'.repeat(25) })).toBe(false)
  })
})

describe('허용 이벤트 목록', () => {
  it('교사 퍼널 5단계가 빠지지 않는다', () => {
    // 진입 → 사용 → 공유 → 그 링크로 유입 → 가입 클릭.
    // 하나라도 빠지면 "교사 채널이 작동하는가" 에 답할 수 없다.
    expect([...ALLOWED_EVENTS]).toEqual(
      expect.arrayContaining([
        'fit_viewed',
        'fit_analyzed',
        'fit_shared',
        'fit_share_opened',
        'fit_signup_clicked',
      ]),
    )
  })

  it('목록 전체가 의도된 것이다 — 이벤트는 조용히 늘어나면 안 된다', () => {
    // 위 테스트는 **빠짐**을 막고, 이 테스트는 **늘어남**을 막는다.
    // 늘리는 것 자체가 나쁘진 않지만, 늘릴 때는 여기를 고치며 한 번 더 생각하게 한다
    // (`/fit` 은 "붙여넣은 지문을 저장하지 않는다" 를 화면에서 약속하고 있다).
    expect([...ALLOWED_EVENTS]).toEqual([
      'fit_viewed',
      'fit_analyzed',
      'fit_shared',
      'fit_share_opened',
      'fit_signup_clicked',
      'landing_viewed',
      'landing_cta_clicked',
    ])
  })

  it('이름이 중복되지 않는다', () => {
    expect(new Set(ALLOWED_EVENTS).size).toBe(ALLOWED_EVENTS.length)
  })
})

describe('버킷 — 원본 수치를 그대로 보내지 않는다', () => {
  it.each([
    [50, 'xs'],
    [149, 'xs'],
    [150, 's'],
    [399, 's'],
    [400, 'm'],
    [899, 'm'],
    [900, 'l'],
    [1999, 'l'],
    [2000, 'xl'],
    [999999, 'xl'],
  ])('러닝 워드 %i → %s', (n, expected) => {
    expect(sizeBucket(n)).toBe(expected)
  })

  it.each([
    [0, 0],
    [0.04, 0],
    [0.05, 1],
    [0.5, 5],
    [0.915, 9],
    [1, 10],
  ])('해석률 %f → decile %i', (share, expected) => {
    expect(resolvedDecile(share)).toBe(expected)
  })

  it('비정상 입력에도 범위를 벗어나지 않는다', () => {
    expect(resolvedDecile(NaN)).toBe(0)
    expect(resolvedDecile(-1)).toBe(0)
    expect(resolvedDecile(99)).toBe(10)
  })
})
