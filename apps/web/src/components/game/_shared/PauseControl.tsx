// apps/web/src/components/game/_shared/PauseControl.tsx
//
// 일시정지 — **19종 공용 한 벌**. 게임마다 만들지 않는다.
//
// 왜 생겼나 (v08.8 결함 M3):
//   19종 중 학습자가 손댈 수 있는 일시정지가 하나도 없었다. 그런데 정지의 진짜 어려운
//   부분(누가 시계를 멈추는가)은 이미 `lib/game/session-pause.ts` 한 곳으로 모여 있으므로,
//   화면에서 필요한 것은 **버튼 하나와 커튼 하나**뿐이다. 그래서 게임 파일을 19개 고치는
//   대신 스캐폴드가 이 한 컴포넌트를 그린다.
//
// 커튼이 판을 가리는 것이 핵심이다 — 시계만 멈추고 보드가 보이면 일시정지가 곧 정답
// 열람 시간이 된다. 돌아올 때 복귀 유예(1.2초)를 한 번 더 주는 이유도 같다.
//
// 「학습 중 모달 오버레이 금지」와 충돌하지 않는다: 이 커튼은 학습을 끊는 것이 아니라
// **학습자가 이미 끊은 상태**를 화면에 정직하게 표시한다(자리를 비웠거나 스스로 멈췄다).

'use client';

import { useEffect, useRef } from 'react';

import { registerSessionEscape } from '@/components/layout/session-escape';
import { setManualPause } from '@/lib/game/session-pause';

import { useSessionPause } from './mechanics';

export function GamePauseControl() {
  const pause = useSessionPause();
  const pauseBtnRef = useRef<HTMLButtonElement>(null);
  const resumeBtnRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef(false);

  const manual = pause.reason === 'manual';

  // 포커스가 사라지지 않게 — 정지 버튼이 커튼으로 바뀌면 포커스도 함께 옮긴다.
  // (버튼이 언마운트되면 브라우저가 포커스를 <body> 로 되돌려, 키보드 학습자는
  //  방금 누른 자리를 잃는다. gamekit 이 gk-tile 에서 고친 것과 같은 종류의 결함이다.)
  useEffect(() => {
    if (manual) {
      returnFocusRef.current = true;
      resumeBtnRef.current?.focus();
      return;
    }
    if (returnFocusRef.current) {
      returnFocusRef.current = false;
      pauseBtnRef.current?.focus();
    }
  }, [manual]);

  // Esc 는 셸이 소유한다(session-escape.ts). 멈춰 있는 동안의 Esc 는 "나가기" 가 아니라
  // "이어서 하기" 다 — 실수로 세션을 끝내지 않게 그때만 소비한다.
  //
  // ⚠️ 멈춰 있을 때**만** 등록한다. 항상 등록하면 useSessionEscapeClaimed() 가 늘 true 가 되어
  // 셸 닫기 버튼에서 "(Esc)" 라벨이 19종 내내 사라진다 — Esc 는 여전히 나가는데 라벨만
  // 거짓이 되는, B1 과 같은 종류의 결함이다.
  useEffect(() => {
    if (!manual) return;
    return registerSessionEscape(() => {
      setManualPause(false);
      return true;
    });
  }, [manual]);

  if (pause.clocks === 0) return null;

  const showButton = pause.live > 0 && !pause.frozen;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PAUSE_CSS }} />
      {showButton && (
        <button
          ref={pauseBtnRef}
          type="button"
          className="gk-pause-btn"
          onClick={() => setManualPause(true)}
          aria-label="일시정지"
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
            <path d="M9 5v14M15 5v14" />
          </svg>
        </button>
      )}
      {pause.frozen && (
        <div className="gk-pause-veil" role="status" aria-live="polite">
          <div className="gk-pause-card">
            <p className="gk-pause-title">{manual ? '잠깐 멈췄어요' : '다시 시작합니다'}</p>
            <p className="gk-pause-body">
              {manual
                ? '시계도 함께 멈춰 있어요. 준비되면 이어서 해요.'
                : '자리를 비운 동안 시계를 멈춰 뒀어요. 곧 이어서 시작해요.'}
            </p>
            {manual && (
              <button
                ref={resumeBtnRef}
                type="button"
                className="gk-pause-resume"
                onClick={() => setManualPause(false)}
              >
                계속하기
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// 음악 버튼(.gk-music-btn · 좌하단 16px)과 같은 줄에 나란히 선다 — 16 + 44 + 10 = 70px.
// 게임 보드 위에 뜨는 유일한 두 컨트롤이라 한 자리에 모아 둔다.
const PAUSE_CSS = `
  .gk-pause-btn { position: fixed; left: 70px; bottom: calc(14px + env(safe-area-inset-bottom, 0px)); z-index: 41; width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 80%, transparent); color: var(--t3); backdrop-filter: blur(6px); cursor: pointer; transition: color var(--dur-fast, 150ms) var(--ease, ease), border-color var(--dur-fast, 150ms) var(--ease, ease), transform 120ms var(--ease, ease); }
  .gk-pause-btn:hover { color: var(--t1); border-color: var(--t3); }
  .gk-pause-btn:active { transform: scale(.94); }
  .gk-pause-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  .gk-pause-btn:disabled { opacity: .5; cursor: default; }

  .gk-pause-veil { position: absolute; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 24px; background: color-mix(in srgb, var(--bg2) 84%, transparent); backdrop-filter: blur(7px); animation: gk-pause-in var(--dur-normal, 200ms) var(--ease, ease); }
  .gk-pause-card { max-width: 320px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .gk-pause-title { margin: 0; font-family: var(--font-display, system-ui, sans-serif); font-size: 17px; font-weight: 800; color: var(--t1); word-break: keep-all; }
  .gk-pause-body { margin: 0; font-family: var(--font-body, system-ui, sans-serif); font-size: 13px; line-height: 1.65; color: var(--t2); word-break: keep-all; }
  .gk-pause-resume { margin-top: 6px; min-height: 44px; padding: 0 22px; border-radius: var(--r-md, 8px); border: 1px solid transparent; background: var(--combo); color: var(--ti, #fff); font-family: var(--font-display, system-ui, sans-serif); font-size: 13px; font-weight: 800; cursor: pointer; transition: filter var(--dur-fast, 150ms) var(--ease, ease), transform 120ms var(--ease, ease); }
  .gk-pause-resume:hover { filter: brightness(1.1); }
  .gk-pause-resume:active { transform: scale(.97); }
  .gk-pause-resume:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 35%, transparent); }
  .gk-pause-resume:disabled { opacity: .55; cursor: default; }

  @keyframes gk-pause-in { from { opacity: 0 } to { opacity: 1 } }
  /* 낮추기이지 끄기가 아니다 — 이동은 없애되 페이드는 남긴다(CLAUDE.md 모션 예산). */
  @media (prefers-reduced-motion: reduce) {
    .gk-pause-veil { animation: gk-pause-in 160ms ease both; }
    .gk-pause-btn:active, .gk-pause-resume:active { transform: none; }
  }
`;
