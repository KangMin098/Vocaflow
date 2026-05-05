// apps/web/src/components/game/wordblitz/WordBlitzUI.tsx
// UI 오버레이 - HUD, MeaningBanner, ResultToast, Header, Loading

'use client';

import type { GameState } from '@/lib/wordblitz/types';

export function WordBlitzHUD({ score, captured }: { score: number; captured: number }) {
  return (
    <div className="wb-hud">
      <div className="wb-hud-stat">
        <span className="wb-hud-icon">⭐</span>
        <div>
          <div className="wb-hud-label">Score</div>
          <div className="wb-hud-value wb-hud-value--gold">{score.toLocaleString()}</div>
        </div>
      </div>
      <div className="wb-hud-stat">
        <span className="wb-hud-icon">🧸</span>
        <div>
          <div className="wb-hud-label">Captured</div>
          <div className="wb-hud-value">{captured}</div>
        </div>
      </div>
    </div>
  );
}

export function MeaningBanner({ targetWord }: { targetWord: GameState['targetWord'] }) {
  if (!targetWord) return null;

  return (
    <div className="wb-meaning">
      <div className="wb-meaning-label">Find the Word</div>
      <div className="wb-meaning-text">{targetWord.ko}</div>
    </div>
  );
}

export function WordBlitzResultToast({ result }: { result: GameState['lastResult'] }) {
  if (!result) return null;

  return (
    <div
      className={`wb-toast wb-toast--show ${result.isCorrect ? '' : 'wb-toast--wrong'}`}
      role="alert"
      aria-live="polite"
    >
      <div className="wb-toast-word">{result.word.en}</div>
      <div className="wb-toast-meaning">{result.word.ko}</div>
      <div className="wb-toast-points">
        +<span>{result.points}</span> POINTS
      </div>
    </div>
  );
}

export function KbdHints() {
  return (
    <div className="wb-kbd-hints">
      <span>
        <kbd>←</kbd>
        <kbd>→</kbd> 이동
      </span>
      <span className="wb-kbd-divider">·</span>
      <span>
        <kbd>Space</kbd> 또는 <kbd>Enter</kbd> 집기
      </span>
    </div>
  );
}

export function WordBlitzHeader({ onExit }: { onExit?: () => void }) {
  return (
    <header className="wb-header">
      <div className="wb-brand">
        <div className="wb-brand-mark">V</div>
        <span className="wb-brand-name">
          Voca<span>flow</span>
        </span>
      </div>
      {onExit && (
        <button onClick={onExit} className="wb-exit-btn" aria-label="게임 종료">
          나가기
        </button>
      )}
    </header>
  );
}

export function WordBlitzLoading({ message }: { message?: string }) {
  return (
    <div className="wb-loading" role="status" aria-live="polite">
      <div className="wb-loading-spinner" aria-hidden="true" />
      <div className="wb-loading-text">LOADING ARCADE...</div>
      {message && <div className="wb-loading-progress">{message}</div>}
    </div>
  );
}
