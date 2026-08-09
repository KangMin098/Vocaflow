// apps/web/src/components/game/_shared/mechanics.tsx
// 아케이드 공용 게임 메커닉 훅 — 시간·콤보·보드 애니메이션·개인 최고 기록.
//
// 왜 생겼나 (v07.8 전수 감사 결과):
//   19게임 루브릭 감사에서 tensionCurve 평균 1.42/5, streakHook 1.79/5 로 바닥이었다.
//   원인은 "만들 줄 몰라서"가 아니라 **공용 수단이 없어서** 게임마다 rAF 루프와
//   combo+setTimeout 을 손으로 재작성하다 결국 생략해버린 것이다. 감사 19건 중
//   13건이 독립적으로 같은 훅(타이머·콤보)을 공용 킷에 요청했다.
//
// 여기 있는 것은 전부 **선택적**이다. 기존 게임은 아무것도 import 하지 않아도 그대로 돈다.

'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

// ─── 카운트다운 ───────────────────────────────────────────────────────────
//
// setInterval 을 쓰지 않는다: 백그라운드 탭에서 스로틀되고 누적 드리프트가 생겨
// "남은 시간"이 실제와 어긋난다. 벽시계(endAt)를 진실로 두고 rAF 는 렌더만 한다.
//
// extend/drain 이 1급 개념인 이유 — 긴장 곡선을 만들려면 시간이 **보상이자 벌**이어야
// 한다. 정답에 +시간, 오답에 -시간을 주는 순간 같은 4지선다도 판돈이 생긴다.

export interface CountdownOptions {
  /** 총 제한 시간(ms). */
  totalMs: number;
  /** false 면 시계가 멈춘다(일시정지·결과 화면). 기본 true. */
  running?: boolean;
  /** 0 에 도달했을 때 한 번 호출. */
  onEnd?: () => void;
  /** 남은 시간이 이 값 아래로 처음 내려갈 때 한 번 호출 — 경고 연출용. */
  warnAtMs?: number;
  onWarn?: () => void;
}

export interface Countdown {
  /** 남은 시간(ms). 0 이하로 내려가지 않는다. */
  remainMs: number;
  /** 남은 초(올림) — 표시용. */
  remainSec: number;
  /** 남은 비율 0..1 — 게이지용. */
  frac: number;
  /** 경고 구간에 들어왔는가. */
  warning: boolean;
  /** 시간을 더한다(정답 보상). 총 가산량은 capMs 로 제한된다. */
  extend: (ms: number) => void;
  /** 시간을 깎는다(오답 벌). */
  drain: (ms: number) => void;
  /** 처음부터 다시. ms 를 주면 총량도 바꾼다. */
  reset: (ms?: number) => void;
  /** 지금까지 흐른 시간(ms) — 기록용. */
  elapsedMs: number;
}

/**
 * 가산 시간 상한. 이게 없으면 잘하는 학습자의 세션이 무한히 길어져
 * "2~4분에 완결"이라는 세션 형태가 무너진다(감사 sessionShape 축).
 */
const DEFAULT_EXTEND_CAP_RATIO = 0.75;

export function useCountdown({
  totalMs,
  running = true,
  onEnd,
  warnAtMs = 5000,
  onWarn,
}: CountdownOptions): Countdown {
  const [totals, setTotals] = useState(totalMs);
  const endAtRef = useRef(0);
  const pausedLeftRef = useRef<number | null>(null);
  const grantedRef = useRef(0);
  const endedRef = useRef(false);
  const warnedRef = useRef(false);
  const [remainMs, setRemainMs] = useState(totalMs);

  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const onWarnRef = useRef(onWarn);
  onWarnRef.current = onWarn;

  // 마운트 / reset 시 종료 시각 확정
  useEffect(() => {
    endAtRef.current = performance.now() + totals;
    pausedLeftRef.current = null;
    grantedRef.current = 0;
    endedRef.current = false;
    warnedRef.current = false;
    setRemainMs(totals);
  }, [totals]);

  // 일시정지: 남은 시간을 붙잡아 두었다가 재개 때 종료 시각을 다시 민다.
  useEffect(() => {
    if (running) {
      if (pausedLeftRef.current != null) {
        endAtRef.current = performance.now() + pausedLeftRef.current;
        pausedLeftRef.current = null;
      }
      return;
    }
    pausedLeftRef.current = Math.max(0, endAtRef.current - performance.now());
  }, [running]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const tick = () => {
      const left = Math.max(0, endAtRef.current - performance.now());
      setRemainMs(left);
      if (!warnedRef.current && left <= warnAtMs && left > 0) {
        warnedRef.current = true;
        onWarnRef.current?.();
      }
      if (left <= 0) {
        if (!endedRef.current) {
          endedRef.current = true;
          onEndRef.current?.();
        }
        return; // 루프 종료 — 0 에서 rAF 를 계속 돌릴 이유가 없다
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, warnAtMs]);

  const extend = useCallback(
    (ms: number) => {
      if (endedRef.current || ms <= 0) return;
      const cap = totals * DEFAULT_EXTEND_CAP_RATIO;
      const allowed = Math.max(0, Math.min(ms, cap - grantedRef.current));
      if (allowed <= 0) return;
      grantedRef.current += allowed;
      const base = pausedLeftRef.current != null ? null : endAtRef.current;
      if (base == null) pausedLeftRef.current = (pausedLeftRef.current ?? 0) + allowed;
      else endAtRef.current = base + allowed;
      // 경고 구간을 벗어났으면 다시 경고할 수 있게 되돌린다.
      const left = pausedLeftRef.current ?? Math.max(0, endAtRef.current - performance.now());
      if (left > warnAtMs) warnedRef.current = false;
      setRemainMs(left);
    },
    [totals, warnAtMs],
  );

  const drain = useCallback((ms: number) => {
    if (endedRef.current || ms <= 0) return;
    if (pausedLeftRef.current != null) {
      pausedLeftRef.current = Math.max(0, pausedLeftRef.current - ms);
      setRemainMs(pausedLeftRef.current);
      return;
    }
    endAtRef.current -= ms;
    setRemainMs(Math.max(0, endAtRef.current - performance.now()));
  }, []);

  const reset = useCallback(
    (ms?: number) => {
      if (ms != null && ms !== totals) {
        setTotals(ms); // 위 effect 가 나머지를 처리
        return;
      }
      endAtRef.current = performance.now() + totals;
      pausedLeftRef.current = running ? null : totals;
      grantedRef.current = 0;
      endedRef.current = false;
      warnedRef.current = false;
      setRemainMs(totals);
    },
    [totals, running],
  );

  const frac = totals > 0 ? Math.max(0, Math.min(1, remainMs / totals)) : 0;
  return {
    remainMs,
    remainSec: Math.ceil(remainMs / 1000),
    frac,
    warning: remainMs > 0 && remainMs <= warnAtMs,
    extend,
    drain,
    reset,
    elapsedMs: Math.max(0, totals + grantedRef.current - remainMs),
  };
}

// ─── 콤보 / 연속 ──────────────────────────────────────────────────────────
//
// 감사에서 반복해서 나온 지적: 콤보가 "있긴 한데 파티클 밀도만 바꾼다".
// 콤보가 몰입을 만들려면 **잃을 것**이 있어야 하고(끊기면 배수 소멸),
// **넘는 순간**이 보여야 한다(티어 마일스톤). 그 두 가지를 표준화한다.

export interface ComboTier {
  /** 이 연속 수 이상에서 발동. */
  at: number;
  /** 점수 배수. */
  mult: number;
  /** 티어 이름 — HUD·토스트 표기용. */
  label?: string;
}

export const DEFAULT_COMBO_TIERS: ComboTier[] = [
  { at: 0, mult: 1 },
  { at: 3, mult: 1.5, label: 'GOOD' },
  { at: 6, mult: 2, label: 'GREAT' },
  { at: 10, mult: 3, label: 'BLAZING' },
  { at: 16, mult: 4, label: 'UNREAL' },
];

export interface ComboState {
  combo: number;
  /** 이번 세션 최장 연속. */
  best: number;
  /** 현재 티어 인덱스(0 = 배수 없음). */
  tierIndex: number;
  tier: ComboTier;
  mult: number;
  /** 정답 — 새 콤보 수를 돌려준다. */
  hit: () => number;
  /** 오답 — 콤보가 끊긴다. 끊기기 직전 값을 돌려준다. */
  miss: () => number;
  reset: () => void;
}

export function useCombo({
  tiers = DEFAULT_COMBO_TIERS,
  onTierUp,
  onBreak,
}: {
  tiers?: ComboTier[];
  /** 티어가 올라간 순간 — 마일스톤 연출·사운드용. */
  onTierUp?: (tier: ComboTier, combo: number) => void;
  /** 콤보가 끊긴 순간(직전 콤보가 2 이상일 때만). */
  onBreak?: (lostCombo: number) => void;
} = {}): ComboState {
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const comboRef = useRef(0);
  const tierRef = useRef(0);
  const onTierUpRef = useRef(onTierUp);
  onTierUpRef.current = onTierUp;
  const onBreakRef = useRef(onBreak);
  onBreakRef.current = onBreak;

  const sorted = useMemo(() => [...tiers].sort((a, b) => a.at - b.at), [tiers]);
  const tierIndexFor = useCallback(
    (c: number) => {
      let idx = 0;
      for (let i = 0; i < sorted.length; i++) if (c >= sorted[i].at) idx = i;
      return idx;
    },
    [sorted],
  );

  const hit = useCallback(() => {
    const next = comboRef.current + 1;
    comboRef.current = next;
    setCombo(next);
    setBest((b) => (next > b ? next : b));
    const ti = tierIndexFor(next);
    if (ti > tierRef.current) {
      tierRef.current = ti;
      onTierUpRef.current?.(sorted[ti], next);
    }
    return next;
  }, [sorted, tierIndexFor]);

  const miss = useCallback(() => {
    const lost = comboRef.current;
    comboRef.current = 0;
    tierRef.current = 0;
    setCombo(0);
    if (lost >= 2) onBreakRef.current?.(lost);
    return lost;
  }, []);

  const reset = useCallback(() => {
    comboRef.current = 0;
    tierRef.current = 0;
    setCombo(0);
    setBest(0);
  }, []);

  const tierIndex = tierIndexFor(combo);
  return { combo, best, tierIndex, tier: sorted[tierIndex], mult: sorted[tierIndex].mult, hit, miss, reset };
}

// ─── FLIP 보드 애니메이션 ─────────────────────────────────────────────────
//
// 감사 지적: "cascade 의 '낙하'가 순간이동으로 렌더된다", "connections 섞기 버튼은
// 타일이 순간이동해 주스가 0". 보드가 재배치될 때 위치 변화를 눈이 따라가지 못하면
// 인과가 끊기고 조작감이 사라진다.
//
// 사용법:
//   const flip = useFlipGrid(orderedIds)
//   <div key={id} ref={flip.ref(id)}>…</div>
// orderedIds 가 바뀌면 이전 위치에서 새 위치로 이동하는 트랜지션이 자동으로 걸린다.

export function useFlipGrid(keys: readonly string[], durMs = 320) {
  const nodes = useRef(new Map<string, HTMLElement>());
  const prevRects = useRef(new Map<string, DOMRect>());

  const ref = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) nodes.current.set(key, el);
      else nodes.current.delete(key);
    },
    [],
  );

  useLayoutEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const next = new Map<string, DOMRect>();
    nodes.current.forEach((el, key) => next.set(key, el.getBoundingClientRect()));

    if (!reduce) {
      next.forEach((rect, key) => {
        const prev = prevRects.current.get(key);
        const el = nodes.current.get(key);
        if (!prev || !el) return;
        const dx = prev.left - rect.left;
        const dy = prev.top - rect.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
          { duration: durMs, easing: 'cubic-bezier(.22,.61,.36,1)' },
        );
      });
    }
    prevRects.current = next;
  }, [keys, durMs]);

  return { ref };
}

// ─── 개인 최고 기록 ───────────────────────────────────────────────────────
//
// 감사 지적: "GameDone 이 죽은 끝". 재시작 버튼이 사다리가 되려면 **비교 대상**이
// 있어야 한다. 서버 왕복 없이 즉시 보이는 개인 기록을 localStorage 로 둔다.
// (리더보드가 아니다 — Calm UI. 남과 겨루지 않고 어제의 나와만 겨룬다.)

export function usePersonalBest(key: string, higherIsBetter = true) {
  const storeKey = `vocaflow-best-${key}`;
  const [best, setBest] = useState<number | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(storeKey);
      setBest(v == null ? null : Number(v));
    } catch {
      setBest(null); // private mode
    }
  }, [storeKey]);

  /** 기록을 제출한다. 갱신됐으면 이전 기록을, 아니면 null 을 돌려준다. */
  const submit = useCallback(
    (value: number): { improved: boolean; prev: number | null } => {
      const prev = best;
      const better = prev == null || (higherIsBetter ? value > prev : value < prev);
      if (better) {
        setBest(value);
        try {
          localStorage.setItem(storeKey, String(value));
        } catch {
          /* private mode — 세션 한정 */
        }
      }
      return { improved: better && prev != null, prev };
    },
    [best, higherIsBetter, storeKey],
  );

  return { best, submit };
}
