// apps/web/src/lib/analytics/events.ts
//
// 공개 퍼널 이벤트 정의 — **무엇을 보낼 수 있는지 타입이 강제한다.**
//
// 왜 이 파일이 따로 있나:
//   `/fit` 은 "붙여넣은 지문은 저장하지 않습니다" 를 화면에 약속한다. 그 약속은 우리 DB 뿐
//   아니라 **분석 도구에도** 적용된다. 그런데 분석 코드는 보통 `capture('x', {...아무거나})`
//   형태라, 나중에 누군가 편한 마음으로 지문 일부를 넣어도 아무도 못 막는다.
//   → 이벤트와 속성을 **닫힌 목록**으로 못 박고, 값은 숫자·불리언·짧은 열거형만 허용한다.
//     문자열 자유 입력을 아예 타입에서 없앴다. 회귀가 이 계약을 검사한다.
//
// 무엇을 재려는가 (2026-08-16 진단 §6):
//   10만 경로는 교사 3,500명 × 학급 30명(CAC 0)이다. 그 경로가 작동하는지 보려면
//   **교사 한 명이 들어와서 → 써 보고 → 공유하고 → 그 링크로 다음 사람이 오는지**를 세야 한다.
//   지금은 그 다섯 단계 중 **아무것도 셀 수 없다**(PostHog 키만 있고 코드가 없었다).

/** 학습자 레벨 축 — 프로파일과 같은 값만 허용한다. */
type LevelValue = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | null

/**
 * 공개 퍼널 이벤트. **이 목록에 없는 이벤트는 보낼 수 없다.**
 *
 * 속성은 전부 숫자·불리언·닫힌 열거형이다 — 자유 문자열이 하나도 없다는 것이
 * "지문이 샐 수 없다" 의 구조적 근거다.
 */
export type PublicEvent =
  /** `/fit` 진입 — 퍼널의 분모 */
  | { name: 'fit_viewed'; props: { shared: boolean } }
  /** 분석 1회 완료 — "실제로 써 봤다" */
  | {
      name: 'fit_analyzed'
      props: {
        /** 적정 레벨 (없으면 null) */
        fitLevel: LevelValue
        /** 러닝 워드 수 — 자릿수만 의미 있으므로 버킷으로 접는다 */
        sizeBucket: 'xs' | 's' | 'm' | 'l' | 'xl'
        /** 레벨 해석률 10% 단위 (0~10) — 사각지대가 실사용에서 얼마나 큰지 */
        resolvedDecile: number
      }
    }
  /** 결과 링크 복사 — 확산의 시작점 */
  | { name: 'fit_shared'; props: { fitLevel: LevelValue } }
  /** 공유 링크로 진입 — **확산 계수의 분자**. 이 수가 0 이면 교사 채널은 작동하지 않는 것이다 */
  | { name: 'fit_share_opened'; props: { valid: boolean } }
  /** 가입 유도 클릭 — 공개 화면에서 제품으로 넘어가는 유일한 문 */
  | { name: 'fit_signup_clicked'; props: Record<string, never> }
  /**
   * 학습지 인쇄 — **가입보다 강한 의도 신호**.
   *
   * 링크 복사는 "괜찮네" 지만 인쇄는 **오늘 수업에 쓰겠다**는 뜻이다. 그리고 그 종이는
   * 교무실에 남아 다음 교사에게 간다 — CAC 0 채널에서 브랜드가 옮겨 다니는 실물 경로다.
   * 어떤 표에도 흔적이 남지 않는다(인쇄는 브라우저에서 끝난다). 파생으로 대체할 수 없다.
   */
  | { name: 'fit_worksheet_printed'; props: { mode: 'list' | 'quiz' | 'both'; words: number } }
  /**
   * 랜딩 진입 — 검색·공유가 도착하는 지점의 분모.
   *
   * 2026-08-26 이전 이 자리는 개발용 화면 인덱스였고 랜딩 자체가 없었다. 이제 sitemap 의
   * 132개 URL 이 여기로 오므로, 여기를 못 세면 **검색이 실제로 사람을 데려오는지** 알 수 없다.
   */
  | { name: 'landing_viewed'; props: Record<string, never> }
  /**
   * 랜딩에서 다음으로 넘어간 클릭.
   *
   * `fit` 은 `fit_viewed` 와 대조해 **랜딩→진단 이탈**을 본다(두 수가 벌어지면 그 사이가 샌다).
   * `signup` 은 가치를 보기 전에 바로 가입한 사람이라 `fit_signup_clicked` 와 다른 사람이다.
   */
  | { name: 'landing_cta_clicked'; props: { target: 'fit' | 'signup' } }
  /**
   * 공용 단어장 서가 진입 — **선택 퍼널의 분모**.
   *
   * 2026-08-31 실측: 이 서가를 브랜딩(표지·판권면·목차·사다리)했지만 **그것이 선택을
   * 바꿨는지 알 방법이 없었다.** 구독은 `user_word_set_subscriptions` 에서 파생되지만
   * "서가에 왔다" 와 "한 권을 열어 봤다" 는 **어떤 테이블에도 흔적이 남지 않는다.**
   * 분모가 없으면 전환율이 없고, 전환율이 없으면 브랜딩의 효과는 영원히 의견이다.
   *
   * ⚠️ 파생 가능한 것은 수집하지 않는다(`lib/admin/retention-math.ts` 의 결정).
   *   그래서 구독 완료 이벤트는 **일부러 없다** — 그 행은 DB 에 남는다.
   */
  | { name: 'catalog_viewed'; props: { volumes: number } }
  /**
   * 한 권을 열어 봤다 — 표지·제목이 **고르게 만들었는가**의 직접 신호.
   *
   * `step` 은 그 권의 사다리 계단(학령 밖이면 null)이고, `hasCover` 는 도판 유무다.
   * 둘을 함께 보면 "표지가 있는 권이 더 열리는가" 를 **관측으로** 답할 수 있다 —
   * 지금은 그 질문에 아무도 답할 수 없다.
   */
  | { name: 'volume_previewed'; props: { step: number | null; hasCover: boolean } }
  /**
   * 히어로 데모의 레벨 슬라이더를 움직였다 — **랜딩 안에서 처음으로 셀 수 있는 행동.**
   *
   * 지금까지 랜딩은 `landing_viewed`(들어옴)와 `landing_cta_clicked`(나감) 두 끝점만 셌다.
   * 그 사이가 비어 있으면 이탈이 **어디서** 나는지 영원히 모른다 — "왔다 갔다" 만 안다.
   * 이 이벤트가 있으면 세 부류가 갈린다: 만져 보지도 않고 나간 사람 / 만져 보고 나간 사람 /
   * 만져 보고 다음으로 간 사람. 증명(§🎯 I3)이 실제로 작동하는지의 유일한 관측이다.
   *
   * ⚠️ 드래그마다 보내지 않는다 — 화면이 600ms 디바운스한다.
   */
  | { name: 'landing_demo_moved'; props: { level: LevelValue } }
  /**
   * 랜딩의 한 구획까지 스크롤이 닿았다 — **이탈 깊이**.
   *
   * 구획 이름은 닫힌 열거형이다(자유 문자열 금지 — 이 파일의 계약). 구획을 늘리거나
   * 이름을 바꾸면 여기도 같은 커밋에서 바꾼다. 안 그러면 `track()` 이 조용히 버린다.
   */
  | { name: 'landing_section_reached'; props: { section: 'demo' | 'differentiators' | 'doors' } }
  /**
   * 셸의 「나의 자리」 패널을 폈다 — **셸 두 번째 층이 실제로 쓰이는가.**
   *
   * 이 파일은 원래 공개 퍼널용이지만, 이 둘은 같은 계약(숫자·불리언·닫힌 열거형)을 지키고
   * 같은 이유로 필요하다: **안 재면 새로 만든 층이 쓰이는지 영원히 모른다**(§E).
   * 학습자 화면이라 지문이 섞일 여지가 없다 — 속성은 국면과 개수뿐이다.
   */
  | {
      name: 'wayfinder_opened'
      props: { phase: 'undiagnosed' | 'ready' | 'moving' | 'complete'; steps: number }
    }
  /**
   * 셸의 단 하나뿐인 CTA 를 눌렀다 — 띠가 **행동으로 이어지는가**.
   *
   * 이전 띠에는 이 관측이 없었다. 그래서 "상단 6%가 무엇을 하고 있는가" 라는 질문에
   * 아무도 답할 수 없었고, 실제로 아무것도 하고 있지 않았다(2026-09-05 실측).
   */
  | {
      name: 'wayfinder_cta_clicked'
      props: { phase: 'undiagnosed' | 'ready' | 'moving' | 'complete'; done: number }
    }

export type PublicEventName = PublicEvent['name']

/**
 * 허용 이벤트 이름 — 런타임 검사용(타입은 빌드 후 사라진다).
 *
 * ⚠️ **`Record<PublicEventName, true>` 로 적는다. 배열 리터럴로 적지 않는다.**
 *    `readonly PublicEventName[]` 는 **빠진 이름을 잡아 주지 않는다** — 배열은 전수를
 *    요구하지 않기 때문이다. 그래서 유니온에는 있는데 이 목록에는 없는 이벤트가 생기고,
 *    `track()` 은 목록에 없으면 **조용히 버린다**(운영 빌드에서는 console.error 도 안 나온다).
 *
 *    2026-08-30 실측으로 실제로 그 일이 있었다 — `fit_worksheet_printed` 가 유니온에만 있고
 *    이 목록에 없어 **한 건도 전송되지 않고 있었다.** 하필 이 파일이 스스로 그 이벤트를
 *    "가입보다 강한 의도 신호" 라고 적어 둔, 교사 채널(CAC 0)의 핵심 신호다.
 *
 *    Record 로 적으면 이름을 하나라도 빠뜨렸을 때 **타입 검사가 막는다.**
 */
const EVENT_REGISTRY: Record<PublicEventName, true> = {
  fit_viewed: true,
  fit_analyzed: true,
  fit_shared: true,
  fit_share_opened: true,
  fit_signup_clicked: true,
  fit_worksheet_printed: true,
  landing_viewed: true,
  landing_cta_clicked: true,
  catalog_viewed: true,
  volume_previewed: true,
  landing_demo_moved: true,
  landing_section_reached: true,
  wayfinder_opened: true,
  wayfinder_cta_clicked: true,
}

export const ALLOWED_EVENTS: readonly PublicEventName[] = Object.keys(
  EVENT_REGISTRY,
) as PublicEventName[]

/** 러닝 워드 수 → 버킷. 원본 숫자를 그대로 보내지 않는 이유는 필요하지 않기 때문이다. */
export function sizeBucket(totalTokens: number): 'xs' | 's' | 'm' | 'l' | 'xl' {
  if (totalTokens < 150) return 'xs'
  if (totalTokens < 400) return 's'
  if (totalTokens < 900) return 'm'
  if (totalTokens < 2000) return 'l'
  return 'xl'
}

/** 해석률 → 10% 단위 정수(0~10). */
export function resolvedDecile(resolvedShare: number): number {
  if (!Number.isFinite(resolvedShare)) return 0
  return Math.max(0, Math.min(10, Math.round(resolvedShare * 10)))
}

/**
 * 속성이 전송해도 되는 형태인지 확인한다 — **마지막 방어선**.
 *
 * 타입은 빌드 후 사라지므로, 실수로 문자열이 섞여 들어오면 런타임에는 아무도 안 막는다.
 * 여기서 값의 **종류**를 검사한다: 숫자·불리언·null 은 통과, 문자열은 **짧은 열거형만** 통과.
 * 지문 조각은 반드시 길거나 공백을 포함하므로 이 검사에 걸린다.
 */
export function isSafeProps(props: unknown): boolean {
  if (props === null || typeof props !== 'object' || Array.isArray(props)) return false

  for (const value of Object.values(props as Record<string, unknown>)) {
    if (value === null || typeof value === 'number' || typeof value === 'boolean') continue
    if (typeof value === 'string') {
      // 열거형 값만 허용 — 24자 이내 · 공백 없음. 지문 조각은 둘 중 하나에 반드시 걸린다.
      if (value.length <= 24 && !/\s/.test(value)) continue
      return false
    }
    return false
  }
  return true
}
