// apps/web/src/components/pirate-quest/PirateQuestUI.tsx
// HUD + 단어 카드 + 힌트 버튼 + 시간 바 + 콤보 시각화 + 결과

'use client';

import { useEffect, useState } from 'react';
import { X, Anchor, Award, RotateCw, Home, Lightbulb, Zap } from 'lucide-react';
import type { GameState } from '@/lib/pirate-quest/types';
import { GAME_CONFIG, POINTS } from '@/lib/pirate-quest/data';
import './PirateQuestUI.css';

interface UIProps {
  state: GameState;
  onExit?: () => void;
  onHint: () => void;
  onRestart: () => void;
}

export function PirateQuestUI({ state, onExit, onHint, onRestart }: UIProps) {
  return (
    <>
      <Header onExit={onExit} score={state.score} streak={state.streak} />

      {state.phase === 'intro' && <IntroOverlay />}

      {(state.phase === 'playing' || state.phase === 'feedback') && state.targetWord && (
        <WordCard
          ko={state.targetWord.ko}
          onHint={onHint}
          hintUsed={state.hintUsed}
          round={state.currentRound}
          phase={state.phase}
          roundStartedAt={state.roundStartedAt}
        />
      )}

      {state.phase === 'feedback' && state.lastResult && (
        <FeedbackToast
          word={state.lastResult.word.en}
          ko={state.lastResult.word.ko}
          isCorrect={state.lastResult.isCorrect}
          points={state.lastResult.points}
          timeBonus={state.lastResult.timeBonus}
        />
      )}

      {/* 콤보 마일스톤 (5, 10 streak 도달 시 fade-in) */}
      {state.phase === 'feedback' && state.lastResult?.isCorrect && state.streak === 5 && (
        <ComboCelebration tier="gold" label="🔥 GOLD COMBO!" bonus={POINTS.COMBO_5_BONUS} />
      )}
      {state.phase === 'feedback' && state.lastResult?.isCorrect && state.streak === 10 && (
        <ComboCelebration tier="diamond" label="💎 DIAMOND COMBO!" bonus={POINTS.COMBO_10_BONUS} />
      )}

      {state.phase === 'complete' && (
        <CompleteOverlay state={state} onRestart={onRestart} onExit={onExit} />
      )}
    </>
  );
}

// ─── Header ───
function Header({
  onExit,
  score,
  streak,
}: {
  onExit?: () => void;
  score: number;
  streak: number;
}) {
  return (
    <header className="pq-header">
      <div className="pq-brand">
        <Anchor size={18} strokeWidth={2.5} aria-hidden />
        <span>
          Pirate&apos;s <strong>Bounty</strong>
        </span>
      </div>
      <div className="pq-stats">
        <div className="pq-stat">
          <span className="pq-stat-label">SCORE</span>
          <span className="pq-stat-value">{score}</span>
        </div>
        {streak >= 2 && (
          <div className={`pq-stat pq-stat--streak ${streak >= 5 ? 'pq-stat--gold' : ''}`}>
            <span className="pq-stat-label">COMBO</span>
            <span className="pq-stat-value">🔥 {streak}</span>
          </div>
        )}
      </div>
      {onExit && (
        <button onClick={onExit} className="pq-exit" aria-label="나가기">
          <X size={16} />
          나가기
        </button>
      )}
    </header>
  );
}

// ─── 단어 카드 (한국어 뜻 + 힌트 + 시간 바) ───
function WordCard({
  ko,
  round,
  phase,
  roundStartedAt,
  hintUsed,
  onHint,
}: {
  ko: string;
  round: number;
  phase: 'playing' | 'feedback';
  roundStartedAt: number;
  hintUsed: boolean;
  onHint: () => void;
}) {
  // 시간 보너스 progress (5초 카운트다운)
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [phase]);

  const elapsed = phase === 'playing' ? now - roundStartedAt : POINTS.TIME_BONUS_THRESHOLD_MS;
  const remaining = Math.max(0, POINTS.TIME_BONUS_THRESHOLD_MS - elapsed);
  const progress = remaining / POINTS.TIME_BONUS_THRESHOLD_MS;
  const showTimer = phase === 'playing' && remaining > 0;

  return (
    <div className="pq-card">
      <div className="pq-card-row">
        <span className="pq-card-round">
          {round} / {GAME_CONFIG.TOTAL_ROUNDS}
        </span>
        <span className="pq-card-label">한국어 뜻에 맞는 GLB 클릭!</span>
      </div>
      <div className="pq-card-meaning">{ko}</div>

      {/* 시간 보너스 progress bar */}
      {showTimer && (
        <div className="pq-time-bar" aria-label="시간 보너스 (5초 이내 +50점)">
          <div
            className="pq-time-bar-fill"
            style={{ width: `${progress * 100}%` }}
            data-low={progress < 0.4 ? 'true' : undefined}
          />
          <span className="pq-time-bar-label">
            <Zap size={11} strokeWidth={2.5} />
            {(remaining / 1000).toFixed(1)}s · +{POINTS.TIME_BONUS}
          </span>
        </div>
      )}

      {/* 힌트 버튼 */}
      <button
        onClick={onHint}
        disabled={hintUsed || phase !== 'playing'}
        className="pq-hint"
        aria-label="힌트"
      >
        <Lightbulb size={14} strokeWidth={2.5} />
        {hintUsed ? '힌트 사용됨' : `힌트 (${POINTS.HINT_PENALTY}점)`}
      </button>
    </div>
  );
}

// ─── 피드백 토스트 ───
function FeedbackToast({
  word,
  ko,
  isCorrect,
  points,
  timeBonus,
}: {
  word: string;
  ko: string;
  isCorrect: boolean;
  points: number;
  timeBonus: number;
}) {
  return (
    <div className={`pq-toast ${isCorrect ? 'pq-toast--correct' : 'pq-toast--wrong'}`}>
      <div className="pq-toast-icon">{isCorrect ? '✨' : '⚓'}</div>
      <div className="pq-toast-word">{word}</div>
      <div className="pq-toast-meaning">{ko}</div>
      <div className="pq-toast-points">
        {points >= 0 ? '+' : ''}
        {points} POINTS
      </div>
      {timeBonus > 0 && (
        <div className="pq-toast-time-bonus">
          ⚡ Quick! +{timeBonus} time bonus
        </div>
      )}
    </div>
  );
}

// ─── 콤보 마일스톤 (5/10 streak) ───
function ComboCelebration({
  tier,
  label,
  bonus,
}: {
  tier: 'gold' | 'diamond';
  label: string;
  bonus: number;
}) {
  return (
    <div className={`pq-combo pq-combo--${tier}`}>
      <div className="pq-combo-label">{label}</div>
      <div className="pq-combo-bonus">+{bonus} BONUS</div>
    </div>
  );
}

// ─── 인트로 ───
function IntroOverlay() {
  return (
    <div className="pq-intro">
      <div className="pq-intro-card">
        <div className="pq-intro-emoji">🏴‍☠️</div>
        <h1 className="pq-intro-title">
          Pirate&apos;s <span>Bounty</span>
        </h1>
        <p className="pq-intro-sub">한국어 뜻을 보고 영단어 GLB를 클릭하세요</p>
        <p className="pq-intro-loading">불러오는 중...</p>
      </div>
    </div>
  );
}

// ─── 결과 화면 ───
function CompleteOverlay({
  state,
  onRestart,
  onExit,
}: {
  state: GameState;
  onRestart: () => void;
  onExit?: () => void;
}) {
  const accuracy = Math.round((state.correct / GAME_CONFIG.TOTAL_ROUNDS) * 100);
  const grade =
    accuracy >= 90 ? 'LEGEND' : accuracy >= 70 ? 'PIRATE KING' : accuracy >= 50 ? 'SAILOR' : 'CABIN BOY';
  const gradeEmoji =
    accuracy >= 90 ? '👑' : accuracy >= 70 ? '🏴‍☠️' : accuracy >= 50 ? '⚓' : '🦜';

  return (
    <div className="pq-complete">
      <div className="pq-complete-card">
        <div className="pq-complete-emoji">{gradeEmoji}</div>
        <h2 className="pq-complete-title">{grade}</h2>
        <div className="pq-complete-stats">
          <div className="pq-complete-stat">
            <span className="pq-stat-label">정답</span>
            <span className="pq-stat-big">
              {state.correct} / {GAME_CONFIG.TOTAL_ROUNDS}
            </span>
          </div>
          <div className="pq-complete-stat">
            <span className="pq-stat-label">점수</span>
            <span className="pq-stat-big">{state.score}</span>
          </div>
          <div className="pq-complete-stat">
            <span className="pq-stat-label">정확도</span>
            <span className="pq-stat-big">{accuracy}%</span>
          </div>
          <div className="pq-complete-stat">
            <span className="pq-stat-label">최고 콤보</span>
            <span className="pq-stat-big">🔥 {state.maxStreak}</span>
          </div>
        </div>

        {state.collected.length > 0 && (
          <div className="pq-collected">
            <Award size={16} strokeWidth={2.5} />
            <span className="pq-collected-label">획득한 보물</span>
            <div className="pq-collected-list">
              {state.collected.map((w) => (
                <span key={w.en} className="pq-collected-chip">
                  {w.en} <em>· {w.ko}</em>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="pq-complete-actions">
          <button onClick={onRestart} className="pq-btn pq-btn--primary">
            <RotateCw size={14} />
            다시 도전
          </button>
          {onExit && (
            <button onClick={onExit} className="pq-btn pq-btn--secondary">
              <Home size={14} />
              나가기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
