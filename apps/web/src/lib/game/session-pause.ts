// apps/web/src/lib/game/session-pause.ts
//
// 「지금 시계를 돌려도 되는가」 — **여기 한 곳**에서 정한다.
//
// 왜 생겼나 (v08.8 결함 M3):
//   시간제한 게임 17종에서 탭을 떠난 시간이 제한 시간에서 그대로 차감됐다. 전화 한 통이
//   판을 끝냈다. 규칙 자체를 아는 게임은 둘뿐이었고(ghost-race · wordsmith-vigil), 둘 다
//   자기 파일 안에 `visibilitychange` 리스너를 따로 달고 있었다 — 같은 규칙의 복제다.
//   그래서 감지·판정을 모듈 싱글턴으로 올리고, 게임은 **결과만** 읽는다.
//
// 규칙 (이 네 줄이 전부다):
//   1. 탭이 숨으면 시계는 얼어붙는다. 돌아온 시각과 떠난 시각의 차이는 버린다.
//   2. 돌아오면 곧바로 다시 달리게 하지 않는다 — RESUME_GRACE_MS 동안 더 얼려 두고
//      화면이 "다시 시작합니다"를 말한다(ghost-race 가 쓰던 재출발 유예를 전 게임으로).
//   3. 학습자가 직접 멈출 수도 있다(수동 일시정지). 푸는 것도 학습자만 한다.
//   4. **돌아가는 시계가 하나도 없으면** 이 모듈은 아무 일도 하지 않는다 — 결과 화면·
//      브리핑에서 탭을 바꿨다고 커튼이 뜨면 그게 새로운 방해다.
//
// 모듈 싱글턴인 이유는 `components/layout/session-escape.ts` 와 같다: 풀스크린 세션은
// 한 번에 하나뿐이고, 컨텍스트로 만들면 프로바이더가 없는 곳에서 조용히 깨진다.

/** 복귀 유예 — ghost-race 가 실측으로 정착시킨 값(1.2초). */
export const RESUME_GRACE_MS = 1200;

/**
 * 이보다 짧게 다녀온 것은 없던 일로 한다. 알림 배너·권한 팝업처럼 학습자가
 * 인지하지도 못한 전환마다 커튼을 씌우면 그 커튼이 방해가 된다.
 */
export const MIN_AWAY_MS = 400;

export interface SessionPauseSnapshot {
  /** 시계를 멈춰야 하는가 — 게임이 볼 값은 사실상 이것 하나다. */
  frozen: boolean;
  /** 무엇 때문에 멈췄나. 화면 문구가 갈린다. */
  reason: 'away' | 'manual' | null;
  /** 복귀 유예 중(=곧 다시 시작한다). */
  resuming: boolean;
  /** 학습자가 직접 멈춰 둔 상태. */
  manual: boolean;
  /** 화면에 올라와 있는 제한시간 시계의 수. 0 이면 이 모듈은 아무 일도 하지 않는다. */
  clocks: number;
  /** 그중 지금 실제로 달리고 있는 수 — 일시정지 버튼이 보이는 조건이다. */
  live: number;
  /** 가장 최근에 자리를 비웠던 시간(ms). 한 번도 없었으면 0. */
  awayMs: number;
  /** 그 복귀가 일어난 시각 — 게임이 "돌아왔다" 를 한 번만 처리하는 열쇠. */
  awayAt: number;
}

type Listener = () => void;

const IDLE: SessionPauseSnapshot = {
  frozen: false,
  reason: null,
  resuming: false,
  manual: false,
  clocks: 0,
  live: 0,
  awayMs: 0,
  awayAt: 0,
};

const listeners = new Set<Listener>();

let hidden = false;
let manual = false;
let resuming = false;
let clocks = 0;
let live = 0;
let awayMs = 0;
let awayAt = 0;
let hiddenAt = 0;
let resumeTimer: ReturnType<typeof setTimeout> | null = null;
let bound = false;
let snapshot: SessionPauseSnapshot = IDLE;

/** 테스트 seam — 실제 코드는 부르지 않는다(가짜 시계 주입). */
let clockNow: () => number = () =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

function compute(): SessionPauseSnapshot {
  const frozen = clocks > 0 && (hidden || manual || resuming);
  return {
    frozen,
    reason: frozen ? (manual ? 'manual' : 'away') : null,
    resuming: frozen && resuming && !manual,
    manual,
    clocks,
    live,
    awayMs,
    awayAt,
  };
}

function publish(): void {
  const next = compute();
  const prev = snapshot;
  if (
    next.frozen === prev.frozen &&
    next.reason === prev.reason &&
    next.resuming === prev.resuming &&
    next.manual === prev.manual &&
    next.clocks === prev.clocks &&
    next.live === prev.live &&
    next.awayMs === prev.awayMs &&
    next.awayAt === prev.awayAt
  ) {
    return; // 같은 값이면 새 객체를 만들지 않는다 — useSyncExternalStore 가 무한 렌더한다
  }
  snapshot = next;
  for (const fn of listeners) fn();
}

function clearGrace(): void {
  if (resumeTimer != null) {
    clearTimeout(resumeTimer);
    resumeTimer = null;
  }
  resuming = false;
}

function startGrace(): void {
  clearGrace();
  if (live === 0) return; // 달리는 시계가 없으면 유예도 없다 — 결과 화면에 커튼이 뜨지 않게
  resuming = true;
  resumeTimer = setTimeout(() => {
    resumeTimer = null;
    resuming = false;
    publish();
  }, RESUME_GRACE_MS);
}

function onVisibility(): void {
  const doc = typeof document === 'undefined' ? null : document;
  if (!doc) return;
  if (doc.visibilityState === 'hidden') {
    if (hidden) return;
    hidden = true;
    hiddenAt = clockNow();
    clearGrace(); // 유예 중에 또 나가면 유예는 무효 — 돌아와서 다시 센다
    publish();
    return;
  }
  if (!hidden) return;
  hidden = false;
  const away = Math.max(0, clockNow() - hiddenAt);
  hiddenAt = 0;
  if (away >= MIN_AWAY_MS) {
    awayMs = away;
    awayAt = clockNow();
    // 수동 정지 중이었다면 학습자가 직접 풀 때까지 그대로 둔다(유예를 겹치지 않는다).
    if (!manual) startGrace();
  }
  publish();
}

function bind(): void {
  if (bound || typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', onVisibility);
  bound = true;
  // 숨은 채로 마운트되는 경우(백그라운드 탭에서 라우팅)를 초기 상태에 반영한다.
  if (document.visibilityState === 'hidden') {
    hidden = true;
    hiddenAt = clockNow();
    publish();
  }
}

function unbind(): void {
  if (!bound || typeof document === 'undefined') return;
  document.removeEventListener('visibilitychange', onVisibility);
  bound = false;
}

export function subscribeSessionPause(fn: Listener): () => void {
  listeners.add(fn);
  bind();
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) {
      unbind();
      clearGrace();
      hidden = false;
      manual = false;
      hiddenAt = 0;
      snapshot = compute();
    }
  };
}

export function getSessionPauseSnapshot(): SessionPauseSnapshot {
  return snapshot;
}

/** 서버 렌더에는 정지가 없다 — 항상 같은 객체여야 한다(hydration 경고 방지). */
export function getServerSessionPauseSnapshot(): SessionPauseSnapshot {
  return IDLE;
}

/**
 * 제한시간 시계 하나가 화면에 올라왔다고 알린다(해제 함수 반환).
 * '올라와 있음' 과 '달리고 있음' 을 나누는 이유: 리빌·전환처럼 시계가 잠깐 서는 구간에
 * 정지 상태가 풀려 버리면, 학습자가 세워 둔 커튼이 저 혼자 걷힌다.
 */
export function registerTimedClock(): () => void {
  clocks += 1;
  publish();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    clocks = Math.max(0, clocks - 1);
    if (clocks === 0) {
      manual = false;
      clearGrace();
    }
    publish();
  };
}

/** 그 시계가 지금 달리고 있다고 알린다(해제 함수 반환). */
export function markClockRunning(): () => void {
  live += 1;
  publish();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    live = Math.max(0, live - 1);
    // 달리는 시계가 하나도 안 남으면 복귀 유예도 끝난다 — 판이 끝났는데 결과 화면 위에
    // '다시 시작합니다' 커튼이 남아 있으면 그게 거짓이다.
    if (live === 0) clearGrace();
    publish();
  };
}

/** 수동 일시정지. 풀 때는 복귀 유예를 한 번 준다(커튼이 걷히자마자 오답이 되지 않게). */
export function setManualPause(on: boolean): void {
  if (manual === on) return;
  manual = on;
  if (on) clearGrace();
  else startGrace();
  publish();
}

export function toggleManualPause(): void {
  setManualPause(!manual);
}

/** 테스트 전용 — 싱글턴을 처음 상태로 되돌린다. */
export function __resetSessionPause(): void {
  clearGrace();
  unbind();
  listeners.clear();
  hidden = false;
  manual = false;
  clocks = 0;
  live = 0;
  awayMs = 0;
  awayAt = 0;
  hiddenAt = 0;
  snapshot = IDLE;
}

/** 테스트 전용 — 가짜 시계 주입. null 이면 실제 시계로 되돌린다. */
export function __setSessionPauseClock(fn: (() => number) | null): void {
  clockNow = fn ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
}
