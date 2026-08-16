// apps/web/src/lib/learner/gateway-state.ts
//
// 관문(/hub) 상태 판정의 **순수 계산부**. 조회는 `gateway.ts` 가 맡는다.
//
// ⚠️ `server-only`/`react.cache` 금지 — 클라이언트 컴포넌트와 vitest 가 함께 쓴다
//    (`today-status.ts` · `growth-math.ts` 와 같은 이유. 합쳐 두면 전 라우트 500 또는
//     `cache is not a function` 으로 스위트째 죽는다).
//
// ─────────────────────────────────────────────────────────────
// 왜 만들었나
//
// `/hub` 은 이 제품의 유일한 관문인데, **돌아온 사람을 알아보지 못했다.**
// 처음 온 사람·오늘 이미 한 사람·사흘 만에 온 사람에게 전부 같은 화면을 보여줬다.
//
// 근거 셋:
//   ① 자체 진단(docs/PLATFORM_AUDIT.md F2) — 모바일이 없어 푸시·위젯이 없다.
//      즉 **웹 홈이 이 제품의 유일한 리텐션 장치**다. 그런데 그 자리가 복귀를 다루지 않았다.
//   ② 업계 리텐션 — 교육 앱은 D30 이 2~3%로 전 카테고리 최저다(교차업종 중앙값 D1 26 / D7 13).
//      끊기는 것이 기본값인 카테고리라, 관문이 복귀를 설계하지 않으면 복귀는 일어나지 않는다.
//   ③ 2026 UX 합의 — "돌아왔을 때 하던 자리를 되찾아 주는가" 가 개별 화면 완성도보다
//      리텐션에 더 크게 작용한다. 중단된 흐름을 이어 주지 못한 것이 낮은 D7 로 잡히곤 한다.
//
// 실제로 `components/home/ContinueCard.tsx` 가 만들어져 있었지만 **어디에도 붙어 있지 않았다**
// (전 리포 grep 사용처 0 — 고아 컴포넌트). 이어하기는 코드가 없어서가 아니라 **연결되지 않아서**
// 없었다.
//
// ─────────────────────────────────────────────────────────────
// 말투 규칙 (철학 ③ Empathetic Feedback) — 이 파일에서 가장 중요한 부분
//
// 복귀 문구는 **비난이 되기 가장 쉬운 자리**다. "3일 쉬었어요" · "연속이 끊겼어요" ·
// "오랜만이네요(=그동안 안 했네요)" 는 전부 손실 프레이밍이고, 스트릭 불안과 같은 기전으로
// 작동한다. 그래서:
//   · **공백 일수를 크게 말하지 않는다.** 오래 비었을수록 오히려 숫자를 **지운다**.
//   · 마지막에 한 것을 **사실로만** 되짚는다("마지막엔 …을 받아썼어요").
//   · 오래 비었으면 분량을 **줄여서** 다시 여는 것이 격려다("짧게 하나만").

/** 활동 모듈 id + 그때 다룬 자료 제목(있으면). */
export interface LastTouch {
  /** `learning_records.module` / `scores.module` 실측 id */
  module: string
  /** 그때 다룬 자료 제목. 게임·단어 전용 활동은 null */
  title: string | null
  /** 그 자료로 돌아갈 경로. 못 만들면 null */
  href: string | null
  /** ISO — 마지막 활동 시각 */
  at: string
}

export type GatewayPhase =
  /** 학습 기록이 하나도 없다 */
  | 'first'
  /** 오늘(KST) 이미 활동했다 */
  | 'today'
  /** 1~6일 만이다 */
  | 'returning'
  /** 7일 이상 비었다 */
  | 'away'

export interface GatewayState {
  phase: GatewayPhase
  /** 마지막 활동 이후 지난 일수(KST 날짜 기준). 기록이 없으면 null */
  daysSince: number | null
  last: LastTouch | null
}

const KST_MS = 9 * 3_600_000

/** ISO → KST 날짜 문자열 'YYYY-MM-DD' */
export function kstDay(iso: string): string {
  return new Date(new Date(iso).getTime() + KST_MS).toISOString().slice(0, 10)
}

/** KST 기준 오늘로부터 며칠 전인가 (같은 날 = 0). */
export function daysSinceKst(iso: string, now: number = Date.now()): number {
  const a = Math.floor((new Date(iso).getTime() + KST_MS) / 86_400_000)
  const b = Math.floor((now + KST_MS) / 86_400_000)
  return Math.max(0, b - a)
}

export function classifyGateway(
  last: LastTouch | null,
  now: number = Date.now(),
): GatewayState {
  if (!last) return { phase: 'first', daysSince: null, last: null }
  const daysSince = daysSinceKst(last.at, now)
  const phase: GatewayPhase = daysSince === 0 ? 'today' : daysSince <= 6 ? 'returning' : 'away'
  return { phase, daysSince, last }
}

/**
 * 관문 한 줄 문구.
 *
 * `null` 이면 **줄 자체를 그리지 않는다** — 할 말이 없을 때 자리를 채우려고 문장을 만들지 않는다
 * (이전 허브가 히어로 140px 를 매일 같은 인사말에 쓰던 결함과 같은 계열).
 *
 * @param activityName 모듈의 학습자용 이름 — 레지스트리에서 온다(화면·이 파일에서 짓지 않는다)
 */
export function gatewayLine(
  state: GatewayState,
  activityName: string | null,
): { lead: string; detail: string | null } | null {
  const { phase, daysSince, last } = state

  // 처음 — 이 줄이 할 일은 없다. 진단 유도는 TodayFocus 가 이미 단독으로 맡는다.
  if (phase === 'first') return null

  // 오늘 이미 왔다 — "돌아왔네요" 는 거짓이고, 진행은 흐름이 이미 말한다. 그리지 않는다.
  if (phase === 'today') return null

  // ⚠️ **조사를 고정하지 않는다.**
  //    처음에는 `《${title}》 을 ${activity} 으로 했어요` 였는데, 한국어 조사는 앞 명사의
  //    받침에 따라 을/를 · 으로/로 가 바뀐다. 여기 들어오는 값은 도서 제목과 활동명이라
  //    둘 다 **영문이고 임의**다 — 《Alice》 는 "를", 《Carol》 은 "을" 이고,
  //    `Echo` 는 "로", `Dictation` 은 "으로" 다. 영문 철자로 받침을 추정하는 것은
  //    묵음 e(Alice→앨리스=받침 있음) 같은 예외 때문에 신뢰할 수 없다.
  //    그래서 **조사가 필요 없는 형태**로 문장을 바꿨다. 이 규칙을 어기면 한국어 사용자에게
  //    즉시 어색하게 읽힌다(라운드 1 실측에서 "《…Ghost》 을" 로 노출됐다).
  //    부수 효과로 줄이 짧아져 모바일에서 접히지 않는다.
  const what = activityName
    ? last?.title
      ? `마지막엔 ${activityName} · 《${last.title}》`
      : `마지막엔 ${activityName}`
    : null

  if (phase === 'returning') {
    // 1~6일 — 숫자를 말해도 압박이 되지 않는 구간. 사실만 짚는다.
    const lead = daysSince === 1 ? '어제 이어서' : `${daysSince}일 만이에요`
    return { lead, detail: what }
  }

  // 7일 이상 — **일수를 말하지 않는다.** 오래 비었을수록 숫자는 지우고 문턱을 낮춘다.
  return { lead: '다시 오셨어요', detail: what }
}

// ─────────────────────────────────────────────────────────────
// 일부러 만들지 않은 것 — `shouldSoftenToday()`
//
// "7일 넘게 비운 사람에게는 오늘 분량을 하나로 줄인다" 는 함수를 한 번 만들었다가 **지웠다.**
// 아이디어 자체는 타당하다(복귀자에게 5블록은 벽이다). 지우 이유는 **쓰는 곳이 없었기**
// 때문이다 — 처방이 낸 오늘 분량을 관문이 임의로 깎는 것은 처방의 계약을 바꾸는 일이라
// 제품 결정이 필요하고, 그 결정 없이 export 만 남기면 테스트가 붙은 채로 아무도 안 부르는
// API 가 된다. 그건 이 재설계가 고친 결함(`ContinueCard` — 만들어 놓고 어디에도 안 붙인
// 고아 컴포넌트)과 정확히 같은 것이다.
//
// 되살릴 때 필요한 것: 처방 쪽에 "복귀자 축소" 규칙을 두고 `buildTodayBlocks` 가 그걸
// 반영할지 결정 → 그때 관문은 상태만 넘긴다.
// ─────────────────────────────────────────────────────────────
