// apps/web/src/lib/csat/steps.ts
//
// **기출 분석 7단계 — 순서가 곧 학습자의 동선이다.**
//
// ── 왜 단계를 코드로 두나 ────────────────────────────────────────────
// `/csat` 밑에는 화면이 흩어져 있었다(허브 · 유형 · 문항 · 계획 · 오버레이). 각자 쓸모가
// 있지만 **어느 것을 먼저 해야 하는지**는 어디에도 안 적혀 있었다. 그래서 학습자는
// 「읽을거리 목록」을 받고 무엇부터인지는 스스로 정해야 했다.
//
// 분석 방법론은 이미 7단계로 서 있다(전수 스캔 → 심층분석 → 패턴 종합 → 변형 예측 →
// 단권화 → 실전 → 검증). 화면을 그 순서에 **그대로 걸면** 목록이 동선이 된다.
//
// ⚠️ **순서를 강제하지 않는다.** 스텝 인디케이터는 순서를 *보여 줄* 뿐이고, 어느 단계로든
//   바로 들어갈 수 있다. 수험생은 매번 1단계부터 시작하지 않는다 — 오늘 할 일만 하러 온다.
//
// ⚠️ **없는 화면을 「준비 중」으로 채우지 않는다**(브리프 A4). 아직 안 지은 단계는
//   `state: 'later'` 로 두고, 화면은 그 사실을 **다음에 열릴 것**으로 말한다. 링크를 걸어
//   빈 화면으로 보내면 그게 막다른 길이다.

/** 그 단계를 지금 쓸 수 있는가. */
export type StepState =
  /** 화면이 있고 들어갈 수 있다. */
  | 'ready'
  /** 아직 안 지었다 — 링크를 걸지 않는다. */
  | 'later'

export interface CsatStep {
  /** 1~7. 방법론 단계 번호와 같다. */
  no: number
  /** 화면 이름 — 짧게. */
  label: string
  /**
   * **학습자가 여기서 하는 동사.** 이것이 없으면 그 화면은 화면이 아니라 문서다.
   * (브리프 §2.3 원칙 1 — 행동 단위로 화면을 자른다.)
   */
  verb: string
  /** 라벨이 말하지 않는 것 — 무엇을 얻어 가는가. */
  says: string
  href: string | null
  state: StepState
}

/**
 * 7단계 — **순서가 정본이다.**
 *
 * ⚠️ ⑤ 단권화는 **독립 화면이 아니다.** ③④ 안의 사이드 패널로 산다 — 모으는 행위는
 *   고르는 화면 안에서 일어나야 하고, 따로 떼면 "저장한 것을 보러 가는 곳" 이 하나 더
 *   생길 뿐이다. 그래서 `href` 가 ③ 을 가리킨다.
 *
 * ⚠️ ⑥⑦ 은 지금 `later` 다. 근거: `csat_item_attempts` **14행** · 가입자 3명(실측
 *   2026-09-15). 훈련·검증 루프를 풀스크린으로 지으면 사용자 0명을 위한 화면 둘이 된다.
 *   대신 ⑦ 이 답할 질문(「내가 어디서 틀리나」)의 **빈 상태를 ③ 안에 얹는다** — 기록이
 *   없을 때는 전체 분포를 보여 주는 것이 최선의 전시장이다(vocaflow-design §C 렌즈 4).
 */
export const CSAT_STEPS: readonly CsatStep[] = [
  {
    no: 1,
    label: '지형',
    verb: '훑는다',
    says: '어느 유형이 어느 해에 몇 번 나왔는지 한 판에서 본다',
    href: '/csat/map',
    state: 'ready',
  },
  {
    no: 2,
    label: '해부',
    verb: '뜯는다',
    says: '한 문항이 무엇을 재고, 오답이 어떻게 만들어졌는지 층층이 연다',
    href: '/csat/item',
    state: 'ready',
  },
  {
    no: 3,
    label: '패턴',
    verb: '묶는다',
    says: '같은 함정끼리 모아 내 약한 묶음을 만든다',
    href: '/csat/patterns',
    state: 'ready',
  },
  {
    no: 4,
    label: '예측',
    verb: '판단한다',
    says: '아직 안 풀린 질문이 무엇인지 보고 다음 시험의 사정권을 좁힌다',
    href: '/csat/predict',
    state: 'ready',
  },
  {
    no: 5,
    label: '단권화',
    verb: '모은다',
    says: '고른 것을 내 묶음으로 저장한다 — 패턴 화면 안에서 일어난다',
    href: '/csat/patterns',
    state: 'ready',
  },
  {
    no: 6,
    label: '훈련',
    verb: '푼다',
    says: '형식·시간을 골라 한 세션을 만들고 원문은 평가원에서 푼다',
    href: null,
    state: 'later',
  },
  {
    no: 7,
    label: '검증',
    verb: '대조한다',
    says: '틀린 문항을 함정 패턴에 맞대어 다음 세션을 다시 고른다',
    href: null,
    state: 'later',
  },
]

/** 지금 들어갈 수 있는 단계만. */
export const readySteps = (): CsatStep[] => CSAT_STEPS.filter((s) => s.state === 'ready')

/**
 * 이 경로가 어느 단계인가. 못 찾으면 `null`(허브 등).
 *
 * ⚠️ **`/csat/item/abc` 처럼 하위 경로도 그 단계로 센다.** 정확히 같은 문자열만 보면
 *   문항 상세로 들어간 순간 인디케이터가 꺼져 학습자가 "어디에 있는지" 를 잃는다.
 *   ⑤ 는 ③ 과 `href` 가 같으므로 **먼저 선언된 ③ 이 이긴다** — 같은 화면에서 두 칸이
 *   동시에 켜지면 현재 위치가 둘이 된다.
 */
export function stepFor(pathname: string): CsatStep | null {
  const hit = CSAT_STEPS.filter(
    (s) => s.href && (pathname === s.href || pathname.startsWith(`${s.href}/`)),
  )
  // 가장 긴 `href` 가 가장 구체적이다(`/csat/patterns` vs `/csat`).
  return hit.sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))[0] ?? null
}
