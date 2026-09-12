// apps/web/src/lib/game/__tests__/session-pause.test.ts
//
// 「탭을 떠난 시간이 제한 시간에서 차감되지 않는다」를 **재는** 회귀 (v08.8 결함 M3).
//
// 이 저장소의 vitest 는 node 환경이라(jsdom 없음) 훅을 마운트해 잴 수 없다. 그래서
// `useCountdown` 이 쓰는 두 조각을 그대로 조립해서 잰다 —
//   시간 산술: lib/game/countdown-clock.ts (순수)
//   정지 판정: lib/game/session-pause.ts   (모듈 싱글턴 · visibilitychange)
// 훅이 하는 일은 이 둘을 `active = running && !frozen` 으로 잇는 것뿐이고, 그 규칙을
// 아래 마지막 테스트가 같은 식으로 재현한다.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  drainClock,
  extendClock,
  freezeClock,
  remainingMs,
  resumeClock,
  startClock,
  type ClockState,
} from '../countdown-clock';
import {
  MIN_AWAY_MS,
  RESUME_GRACE_MS,
  __resetSessionPause,
  __setSessionPauseClock,
  getSessionPauseSnapshot,
  markClockRunning,
  registerTimedClock,
  setManualPause,
  subscribeSessionPause,
} from '../session-pause';

// ── 가짜 문서 · 가짜 시계 ────────────────────────────────────────────────
let clock = 0;
const advance = (ms: number) => {
  clock += ms;
  vi.advanceTimersByTime(ms);
};

interface FakeDoc {
  visibilityState: 'visible' | 'hidden';
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
}

const handlers = new Set<() => void>();
const fakeDoc: FakeDoc = {
  visibilityState: 'visible',
  addEventListener: (type, fn) => {
    if (type === 'visibilitychange') handlers.add(fn);
  },
  removeEventListener: (type, fn) => {
    if (type === 'visibilitychange') handlers.delete(fn);
  },
};

function leaveTab() {
  fakeDoc.visibilityState = 'hidden';
  for (const fn of [...handlers]) fn();
}
function returnToTab() {
  fakeDoc.visibilityState = 'visible';
  for (const fn of [...handlers]) fn();
}

describe('countdown-clock — 얼린 시계는 시간을 잃지 않는다', () => {
  it('얼려 둔 동안 남은 시간이 그대로다', () => {
    let s = startClock(0, 60_000);
    expect(remainingMs(s, 5_000)).toBe(55_000);

    s = freezeClock(s, 5_000); // 탭 이탈
    expect(remainingMs(s, 5_000)).toBe(55_000);
    expect(remainingMs(s, 305_000)).toBe(55_000); // 5분을 떠나 있어도 그대로

    s = resumeClock(s, 305_000);
    expect(remainingMs(s, 305_000)).toBe(55_000);
    expect(remainingMs(s, 306_000)).toBe(54_000); // 돌아온 뒤에야 다시 흐른다
  });

  it('얼리기/잇기는 멱등 — 두 번 불려도 시간이 늘거나 줄지 않는다', () => {
    let s = freezeClock(startClock(0, 30_000), 10_000);
    s = freezeClock(s, 90_000);
    s = freezeClock(s, 900_000);
    expect(remainingMs(s, 900_000)).toBe(20_000);
    s = resumeClock(s, 900_000);
    s = resumeClock(s, 900_000);
    expect(remainingMs(s, 900_000)).toBe(20_000);
  });

  it('얼어 있는 동안의 가산·차감도 남은 시간에 정확히 반영된다', () => {
    let s = freezeClock(startClock(0, 60_000), 20_000); // 남은 40초
    s = extendClock(s, 20_000, 5_000, 45_000);
    expect(remainingMs(s, 20_000)).toBe(45_000);
    s = drainClock(s, 3_000);
    expect(remainingMs(s, 20_000)).toBe(42_000);
    s = resumeClock(s, 20_000);
    expect(remainingMs(s, 22_000)).toBe(40_000);
  });

  it('가산 상한을 넘겨 주지 않는다', () => {
    let s = startClock(0, 10_000);
    s = extendClock(s, 0, 9_000, 7_500); // 상한 7.5초
    expect(s.granted).toBe(7_500);
    s = extendClock(s, 0, 5_000, 7_500);
    expect(s.granted).toBe(7_500);
  });
});

describe('session-pause — 정지 판정은 여기 한 곳', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clock = 0;
    handlers.clear();
    fakeDoc.visibilityState = 'visible';
    (globalThis as unknown as { document: FakeDoc }).document = fakeDoc;
    __resetSessionPause();
    __setSessionPauseClock(() => clock);
  });

  afterEach(() => {
    __resetSessionPause();
    __setSessionPauseClock(null);
    delete (globalThis as unknown as { document?: FakeDoc }).document;
    vi.useRealTimers();
  });

  function mountTimedGame() {
    const stopSub = subscribeSessionPause(() => {});
    const stopClock = registerTimedClock();
    const stopRun = markClockRunning();
    return () => {
      stopRun();
      stopClock();
      stopSub();
    };
  }

  it('탭을 떠나면 얼고, 돌아오면 복귀 유예 뒤에 풀린다', () => {
    const unmount = mountTimedGame();
    expect(getSessionPauseSnapshot().frozen).toBe(false);

    leaveTab();
    expect(getSessionPauseSnapshot().frozen).toBe(true);
    expect(getSessionPauseSnapshot().reason).toBe('away');

    advance(30_000);
    returnToTab();
    // 돌아오자마자 달리지 않는다 — 재출발 유예
    expect(getSessionPauseSnapshot().frozen).toBe(true);
    expect(getSessionPauseSnapshot().resuming).toBe(true);
    expect(getSessionPauseSnapshot().awayMs).toBe(30_000);

    advance(RESUME_GRACE_MS);
    expect(getSessionPauseSnapshot().frozen).toBe(false);
    unmount();
  });

  it('스치듯 다녀온 전환은 커튼을 만들지 않는다', () => {
    const unmount = mountTimedGame();
    leaveTab();
    advance(MIN_AWAY_MS - 100);
    returnToTab();
    expect(getSessionPauseSnapshot().frozen).toBe(false);
    expect(getSessionPauseSnapshot().resuming).toBe(false);
    unmount();
  });

  it('멈출 시계가 없으면(결과 화면·시간 없는 게임) 아무 일도 하지 않는다', () => {
    const stopSub = subscribeSessionPause(() => {});
    leaveTab();
    expect(getSessionPauseSnapshot().frozen).toBe(false);
    advance(10_000);
    returnToTab();
    expect(getSessionPauseSnapshot().frozen).toBe(false);
    stopSub();
  });

  it('수동 일시정지는 학습자가 풀 때까지 유지되고, 풀면 유예를 한 번 준다', () => {
    const unmount = mountTimedGame();
    setManualPause(true);
    expect(getSessionPauseSnapshot().frozen).toBe(true);
    expect(getSessionPauseSnapshot().reason).toBe('manual');

    // 정지 중에 탭을 다녀와도 저절로 풀리지 않는다
    leaveTab();
    advance(5_000);
    returnToTab();
    expect(getSessionPauseSnapshot().reason).toBe('manual');

    setManualPause(false);
    expect(getSessionPauseSnapshot().frozen).toBe(true); // 재출발 유예
    advance(RESUME_GRACE_MS);
    expect(getSessionPauseSnapshot().frozen).toBe(false);
    unmount();
  });

  it('구독자가 모두 사라지면 리스너도 정지 상태도 남지 않는다', () => {
    const unmount = mountTimedGame();
    setManualPause(true);
    unmount();
    expect(handlers.size).toBe(0);
    expect(getSessionPauseSnapshot().frozen).toBe(false);
    expect(getSessionPauseSnapshot().manual).toBe(false);
  });

  it('같은 값이면 스냅샷 객체가 바뀌지 않는다(useSyncExternalStore 무한 렌더 방지)', () => {
    const unmount = mountTimedGame();
    const a = getSessionPauseSnapshot();
    setManualPause(false); // 이미 false — 아무 변화 없음
    expect(getSessionPauseSnapshot()).toBe(a);
    unmount();
  });
});

describe('useCountdown 규칙 재현 — 탭을 떠난 30초는 제한 시간에서 빠지지 않는다', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clock = 0;
    handlers.clear();
    fakeDoc.visibilityState = 'visible';
    (globalThis as unknown as { document: FakeDoc }).document = fakeDoc;
    __resetSessionPause();
    __setSessionPauseClock(() => clock);
  });
  afterEach(() => {
    __resetSessionPause();
    __setSessionPauseClock(null);
    delete (globalThis as unknown as { document?: FakeDoc }).document;
    vi.useRealTimers();
  });

  it('60초 판에서 5초 놀고 30초 자리를 비워도 남은 시간은 55초다', () => {
    // 훅이 하는 일과 같은 배선: active = running && !frozen
    let state: ClockState = startClock(clock, 60_000);
    const sync = () => {
      const frozen = getSessionPauseSnapshot().frozen;
      state = frozen ? freezeClock(state, clock) : resumeClock(state, clock);
    };
    const stopSub = subscribeSessionPause(sync);
    const stopClock = registerTimedClock();
    const stopRun = markClockRunning();

    advance(5_000);
    expect(remainingMs(state, clock)).toBe(55_000);

    leaveTab(); // 전화가 왔다
    advance(30_000);
    returnToTab();
    expect(remainingMs(state, clock)).toBe(55_000); // 고치기 전: 25,000

    advance(RESUME_GRACE_MS); // 재출발 유예 — 이 동안에도 줄지 않는다
    expect(remainingMs(state, clock)).toBe(55_000);

    advance(1_000); // 유예가 끝나야 다시 흐른다
    expect(remainingMs(state, clock)).toBe(54_000);

    stopRun();
    stopClock();
    stopSub();
  });
});
