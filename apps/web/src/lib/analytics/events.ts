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

export type PublicEventName = PublicEvent['name']

/** 허용 이벤트 이름 — 런타임 검사용(타입은 빌드 후 사라진다). */
export const ALLOWED_EVENTS: readonly PublicEventName[] = [
  'fit_viewed',
  'fit_analyzed',
  'fit_shared',
  'fit_share_opened',
  'fit_signup_clicked',
] as const

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
