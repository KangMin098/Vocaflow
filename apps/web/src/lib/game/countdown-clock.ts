// apps/web/src/lib/game/countdown-clock.ts
//
// 카운트다운 시계의 **순수 산술**. React 도 DOM 도 모른다.
//
// 왜 분리했나 (v08.8 결함 M3):
//   `useCountdown` 이 벽시계(performance.now)를 진실로 두고 rAF 로 렌더만 하는 구조라,
//   탭을 떠나 있는 동안에도 제한 시간이 그대로 흘렀다(19종 중 17종). 고치는 규칙 자체는
//   한 줄이지만 — "안 보이는 동안에는 시계를 얼린다" — 그것이 맞게 도는지 **재려면**
//   시간 계산이 렌더에서 떨어져 있어야 한다. 이 저장소의 vitest 는 node 환경이라
//   훅을 마운트해서 잴 방법이 없다(jsdom 없음). 그래서 산술만 여기로 내린다.
//
// 상태는 두 모양뿐이다:
//   도는 중  — endAt 이 진실. 남은 시간 = endAt - now
//   얼린 중  — frozenLeft 가 진실. now 가 아무리 흘러도 남은 시간은 그대로

/** 시계의 전부. 불변으로 다룬다(모든 함수가 새 객체를 돌려준다). */
export interface ClockState {
  /** 도는 중일 때의 종료 시각. 얼린 동안에는 의미 없다. */
  endAt: number;
  /** 얼린 동안 붙잡아 둔 남은 시간(ms). null 이면 도는 중. */
  frozenLeft: number | null;
  /** 지금까지 실제로 시계에 더해진 시간의 총량 — 가산 상한 계산의 근거. */
  granted: number;
}

/** 총량 totalMs 로 시계를 시작한다. */
export function startClock(now: number, totalMs: number): ClockState {
  return { endAt: now + Math.max(0, totalMs), frozenLeft: null, granted: 0 };
}

/** 남은 시간(ms). 0 아래로 내려가지 않는다. */
export function remainingMs(s: ClockState, now: number): number {
  if (s.frozenLeft != null) return Math.max(0, s.frozenLeft);
  return Math.max(0, s.endAt - now);
}

/** 시계를 얼린다. 이미 얼어 있으면 그대로(멱등) — 두 번 불려도 시간이 더 늘지 않는다. */
export function freezeClock(s: ClockState, now: number): ClockState {
  if (s.frozenLeft != null) return s;
  return { ...s, frozenLeft: Math.max(0, s.endAt - now) };
}

/** 얼린 시계를 잇는다. 떠나 있던 시간은 버린다(=차감하지 않는다). 멱등. */
export function resumeClock(s: ClockState, now: number): ClockState {
  if (s.frozenLeft == null) return s;
  return { ...s, endAt: now + s.frozenLeft, frozenLeft: null };
}

/**
 * 시간을 더한다(정답 보상). `capMs` 는 **누적** 상한이라, 잘하는 학습자의 판이
 * 무한히 길어지는 것을 막는다. 실제로 더해진 양은 `granted` 차이로 알 수 있다.
 */
export function extendClock(s: ClockState, now: number, ms: number, capMs: number): ClockState {
  if (ms <= 0) return s;
  const allowed = Math.max(0, Math.min(ms, capMs - s.granted));
  if (allowed <= 0) return s;
  const granted = s.granted + allowed;
  if (s.frozenLeft != null) return { ...s, frozenLeft: s.frozenLeft + allowed, granted };
  return { ...s, endAt: s.endAt + allowed, granted };
}

/** 시간을 깎는다(오답 벌). */
export function drainClock(s: ClockState, ms: number): ClockState {
  if (ms <= 0) return s;
  if (s.frozenLeft != null) return { ...s, frozenLeft: Math.max(0, s.frozenLeft - ms) };
  return { ...s, endAt: s.endAt - ms };
}
