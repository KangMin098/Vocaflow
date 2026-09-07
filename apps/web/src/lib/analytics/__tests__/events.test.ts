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
import { SCREEN_IDS, UNKNOWN_SCREEN } from '@/lib/framework/learner-routes'

import {
  ALLOWED_EVENTS,
  isSafeProps,
  resolvedDecile,
  sizeBucket,
  type PublicEventName,
} from '../events'

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

  it('선택 퍼널의 분모 둘이 빠지지 않는다', () => {
    /*
      서가에 온 사람 → 한 권을 열어 본 사람. 이 둘은 **어떤 테이블에도 흔적이 없어**
      빠지면 전환율의 분모가 영원히 없다(구독은 `user_word_set_subscriptions` 에서 파생한다 —
      그래서 구독 완료 이벤트는 일부러 없다).

      2026-08-31 — 서가를 브랜딩해 놓고도 "그것이 선택을 바꿨는가" 를 물을 수단이 없었다.
    */
    expect([...ALLOWED_EVENTS]).toEqual(
      expect.arrayContaining(['catalog_viewed', 'volume_previewed']),
    )
  })

  /**
   * 유니온 `PublicEvent` 에 정의된 이름 전부.
   * `PublicEventName` 으로 타입돼 있어 **오타는 타입 검사가** 잡고, **빠짐은 아래 테스트가** 잡는다.
   */
  const DEFINED: PublicEventName[] = [
    'fit_viewed',
    'fit_analyzed',
    'fit_shared',
    'fit_share_opened',
    'fit_signup_clicked',
    'fit_worksheet_printed',
    'landing_viewed',
    'landing_cta_clicked',
    'catalog_viewed',
    'volume_previewed',
    // 2026-09-04 — 랜딩 **내부** 관측 2종. 그전까지 랜딩은 들어옴/나감 두 끝점만 셌고,
    // 그 사이 이탈은 셀 수 없었다. 둘 다 속성이 숫자·닫힌 열거형이라 지문이 샐 자리가 없다.
    'landing_demo_moved',
    'landing_section_reached',
    // 2026-09-05 — 셸 나침반 띠 2종. 학습자 화면이라 공개 퍼널은 아니지만 같은 계약을 쓴다:
    // 속성은 국면(닫힌 열거형)과 개수뿐이라 지문이 샐 자리가 없다. 상단 6%가 실제로
    // 행동으로 이어지는지 재는 유일한 관측이다 — 이전 띠에는 이 관측이 아예 없었다.
    'wayfinder_opened',
    'wayfinder_cta_clicked',
    'screen_viewed',
  ]

  it('정의된 이벤트가 모두 허용 목록에 있다 — 빠지면 조용히 버려진다', () => {
    // ⚠️ 이 검사가 없어서 실제로 물렸다(2026-08-30). `fit_worksheet_printed` 가 유니온에만
    //    있고 허용 목록에 없어 **한 건도 전송되지 않았다** — track() 은 목록에 없으면 조용히
    //    반환하고 운영 빌드에서는 console.error 도 안 나온다.
    //    그리고 아래 "늘어남" 테스트가 그 불완전한 목록을 **고정하고 있어서**, 고치려 하면
    //    테스트가 막았다. 빠짐 검사와 늘어남 검사는 **둘 다** 있어야 한다.
    const missing = DEFINED.filter((n) => !ALLOWED_EVENTS.includes(n))
    expect(missing, `허용 목록에서 빠졌다 — track() 이 조용히 버린다: ${missing.join(', ')}`).toEqual(
      [],
    )
  })

  it('목록 전체가 의도된 것이다 — 이벤트는 조용히 늘어나면 안 된다', () => {
    // 위 테스트는 **빠짐**을 막고, 이 테스트는 **늘어남**을 막는다.
    // 늘리는 것 자체가 나쁘진 않지만, 늘릴 때는 여기를 고치며 한 번 더 생각하게 한다
    // (`/fit` 은 "붙여넣은 지문을 저장하지 않는다" 를 화면에서 약속하고 있다).
    expect([...ALLOWED_EVENTS].sort()).toEqual([...DEFINED].sort())
  })

  it('교사 채널 신호가 살아 있다 — 인쇄는 파생으로 대체할 수 없다', () => {
    // 인쇄는 브라우저에서 끝나 어떤 표에도 행이 남지 않는다.
    // 빠지면 "교사가 실제로 수업에 썼는가" 를 영영 알 수 없다(10만 산술이 걸린 CAC 0 채널).
    expect(ALLOWED_EVENTS).toContain('fit_worksheet_printed')
  })

  it('학습자 화면 id 전부가 속성 규칙을 넘는다 — 화면이 늘어도 screen_viewed 가 조용히 버려지지 않는다', () => {
    // `screen_viewed.screen` 은 `SCREEN_IDS` 값이다. id 가 24자를 넘거나 공백을 품는 순간
    // `isSafeProps` 가 막고 track() 은 **조용히** 반환한다 — 그 화면만 분모에서 사라진다.
    // 화면을 더할 때 여기서 잡히게 한다(레지스트리는 손으로 자란다).
    const bad = [...SCREEN_IDS, UNKNOWN_SCREEN].filter(
      (id) => !isSafeProps({ screen: id, group: 'main', known: true }),
    )
    expect(bad, `24자 초과·공백 포함 화면 id: ${bad.join(', ')}`).toEqual([])
    expect(new Set(SCREEN_IDS).size, '화면 id 가 겹치면 두 화면이 한 칸으로 세어진다').toBe(
      SCREEN_IDS.length,
    )
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
