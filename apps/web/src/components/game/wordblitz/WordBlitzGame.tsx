// apps/web/src/components/game/wordblitz/WordBlitzGame.tsx
// WordBlitz — 속사 인지(Speed Recognition Blitz). v07 재설계.
//
// 이전: Three.js 3D 인형뽑기(~5초/단어 · 무겁고 모바일 부적합 · L4a 자동화와 배치).
// 현재: 2D 탭 인지 — ko 뜻 → 4개 en 타일 중 정답을 빠르게. 콤보·타이머·레벨업 플로우.
//   근거(리서치): 리트리벌+즉시피드백+점진난이도 · Action→Feedback→Reward 루프 ·
//   절제된 게임 주스(Calm UI) · 모던 미니멀 UI + 테마 토큰 + 접근성.
// 계약: page.tsx 의 wordPool/onExit/onCorrect/onWrong 그대로 재사용.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SAMPLE_WORDS, type Word } from '@/lib/wordblitz/data';

interface WordBlitzGameProps {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (word: Word) => void;
  onWrong?: (word: Word) => void;
  enableSpeech?: boolean;
}

interface Question {
  key: number;
  target: Word;
  options: Word[];
  perMs: number;
}

type Phase = 'playing' | 'reveal' | 'done';

const ROUND_MIN = 8;
const ROUND_MAX = 20;
const BASE_MS = 5000;
const MIN_MS = 2600;
const LEVEL_STEP_MS = 350;
const REVEAL_MS = 640;
const COMBO_PER_LEVEL = 5;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const levelFromCombo = (combo: number) => Math.floor(combo / COMBO_PER_LEVEL);
const perMsForLevel = (level: number) =>
  Math.max(MIN_MS, BASE_MS - level * LEVEL_STEP_MS);

export function WordBlitzGame({
  wordPool,
  onExit,
  onCorrect,
  onWrong,
  enableSpeech = true,
}: WordBlitzGameProps) {
  const pool = useMemo(() => {
    const p = wordPool && wordPool.length > 0 ? wordPool : SAMPLE_WORDS;
    const seen = new Set<string>();
    return p.filter((w) => (seen.has(w.en) ? false : (seen.add(w.en), true)));
  }, [wordPool]);

  const tileCount = Math.min(4, Math.max(2, pool.length));
  const roundLength = Math.min(ROUND_MAX, Math.max(ROUND_MIN, pool.length * 2));

  const [phase, setPhase] = useState<Phase>('playing');
  const [question, setQuestion] = useState<Question | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [gainedPoints, setGainedPoints] = useState(0);
  const [leveledUp, setLeveledUp] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const comboRef = useRef(0);
  const answeredRef = useRef(false);
  const questionRef = useRef<Question | null>(null);
  const qTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef(0);
  const keyRef = useRef(0);
  const qIndexRef = useRef(0);
  const mountedRef = useRef(true);

  const speak = useCallback(
    (text: string) => {
      if (!enableSpeech || typeof window === 'undefined') return;
      if (!('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        u.rate = 1.0;
        window.speechSynthesis.speak(u);
      } catch {
        /* noop */
      }
    },
    [enableSpeech],
  );

  const answerRef = useRef<(t: number | null) => void>(() => {});
  const startQuestionRef = useRef<(i: number) => void>(() => {});

  const startQuestion = useCallback(
    (index: number) => {
      if (!mountedRef.current) return;
      if (index >= roundLength) {
        setPhase('done');
        setQuestion(null);
        questionRef.current = null;
        return;
      }
      const level = levelFromCombo(comboRef.current);
      const target = pool[Math.floor(Math.random() * pool.length)];
      const distractors = shuffle(pool.filter((w) => w.en !== target.en)).slice(
        0,
        tileCount - 1,
      );
      const options = shuffle([target, ...distractors]);
      keyRef.current += 1;
      const q: Question = {
        key: keyRef.current,
        target,
        options,
        perMs: perMsForLevel(level),
      };
      questionRef.current = q;
      setQuestion(q);
      setQIndex(index);
      qIndexRef.current = index;
      setPicked(null);
      setPhase('playing');
      answeredRef.current = false;
      startTimeRef.current = Date.now();
      if (qTimerRef.current) clearTimeout(qTimerRef.current);
      qTimerRef.current = setTimeout(() => answerRef.current(null), q.perMs);
    },
    [pool, tileCount, roundLength],
  );
  startQuestionRef.current = startQuestion;

  const answer = useCallback(
    (tileIndex: number | null) => {
      if (answeredRef.current) return;
      const q = questionRef.current;
      if (!q) return;
      answeredRef.current = true;
      if (qTimerRef.current) {
        clearTimeout(qTimerRef.current);
        qTimerRef.current = null;
      }

      const chosen = tileIndex === null ? null : q.options[tileIndex];
      const isCorrect = !!chosen && chosen.en === q.target.en;
      const elapsed = Date.now() - startTimeRef.current;
      const remainRatio = Math.max(0, 1 - elapsed / q.perMs);

      setPicked(tileIndex);
      setLastCorrect(isCorrect);

      if (isCorrect) {
        const newCombo = comboRef.current + 1;
        comboRef.current = newCombo;
        const mult = 1 + levelFromCombo(newCombo) * 0.5;
        const gained = Math.round((100 + Math.round(remainRatio * 60)) * mult);
        setGainedPoints(gained);
        setScore((s) => s + gained);
        setCombo(newCombo);
        setBestCombo((b) => Math.max(b, newCombo));
        setCorrectCount((c) => c + 1);
        setLeveledUp(newCombo % COMBO_PER_LEVEL === 0);
        setFeedbackMsg(`정답 ${q.target.en}. 콤보 ${newCombo}.`);
        speak(q.target.en);
        onCorrect?.(q.target);
      } else {
        comboRef.current = 0;
        setGainedPoints(0);
        setCombo(0);
        setLeveledUp(false);
        setFeedbackMsg(
          tileIndex === null
            ? `시간 초과. 정답은 ${q.target.en} — ${q.target.ko}.`
            : `오답. 정답은 ${q.target.en} — ${q.target.ko}.`,
        );
        onWrong?.(q.target);
      }

      setPhase('reveal');
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      revealTimerRef.current = setTimeout(() => {
        startQuestionRef.current(qIndexRef.current + 1);
      }, REVEAL_MS);
    },
    [speak, onCorrect, onWrong],
  );
  answerRef.current = answer;

  // 최초 시작 + 언마운트 정리
  useEffect(() => {
    mountedRef.current = true;
    startQuestionRef.current(0);
    return () => {
      mountedRef.current = false;
      if (qTimerRef.current) clearTimeout(qTimerRef.current);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, []);

  // 키보드 1–4 선택
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== 'playing' || !question) return;
      const n = parseInt(e.key, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= question.options.length) {
        e.preventDefault();
        answerRef.current(n - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, question]);

  const restart = useCallback(() => {
    comboRef.current = 0;
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setCorrectCount(0);
    setLeveledUp(false);
    startQuestionRef.current(0);
  }, []);

  const handleExit = useCallback(() => {
    if (qTimerRef.current) clearTimeout(qTimerRef.current);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    onExit?.();
  }, [onExit]);

  const level = levelFromCombo(combo);

  return (
    <div className="wbz-root">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {/* ── HUD ── */}
      <header className="wbz-hud">
        <div className="wbz-stat">
          <span className="wbz-stat-label">SCORE</span>
          <span className="wbz-stat-value wbz-score">{score.toLocaleString()}</span>
        </div>

        <div className="wbz-progress" aria-hidden="true">
          <div
            className="wbz-progress-fill"
            style={{ width: `${Math.min(100, (qIndex / roundLength) * 100)}%` }}
          />
        </div>

        <div className="wbz-stat wbz-stat--right">
          <span className="wbz-stat-label">LV {level + 1}</span>
          <span
            key={combo}
            className={`wbz-combo ${combo > 0 ? 'wbz-combo--on wbz-bump' : ''}`}
          >
            {combo > 0 ? `🔥 ${combo}` : '콤보'}
          </span>
        </div>

        {onExit && (
          <button
            type="button"
            onClick={handleExit}
            className="wbz-exit"
            aria-label="게임 종료"
          >
            나가기
          </button>
        )}
      </header>

      <div className="wbz-sr" aria-live="assertive" role="status">
        {feedbackMsg}
      </div>

      {phase === 'done' ? (
        <DoneScreen
          score={score}
          bestCombo={bestCombo}
          correctCount={correctCount}
          total={roundLength}
          onRestart={restart}
          onExit={handleExit}
        />
      ) : question ? (
        <main className="wbz-stage">
          <section className="wbz-prompt">
            <span className="wbz-prompt-label">이 뜻의 단어는?</span>
            <h1 className="wbz-meaning">{question.target.ko}</h1>
            <div className="wbz-timer" aria-hidden="true">
              <div
                key={question.key}
                className={`wbz-timer-bar ${phase === 'reveal' ? 'wbz-timer-bar--paused' : ''}`}
                style={{ animationDuration: `${question.perMs}ms` }}
              />
            </div>
            {leveledUp && phase === 'reveal' && (
              <div className="wbz-levelup" aria-hidden="true">
                레벨 업 · 속도 상승
              </div>
            )}
          </section>

          <section
            className={`wbz-tiles ${tileCount <= 2 ? 'wbz-tiles--two' : ''}`}
            role="group"
            aria-label="단어 선택"
          >
            {question.options.map((opt, i) => {
              const isPicked = picked === i;
              const isAnswer = opt.en === question.target.en;
              let tone = '';
              if (phase === 'reveal') {
                if (isAnswer) tone = 'wbz-tile--correct';
                else if (isPicked) tone = 'wbz-tile--wrong';
                else tone = 'wbz-tile--dim';
              }
              return (
                <button
                  key={`${question.key}-${opt.en}`}
                  type="button"
                  disabled={phase === 'reveal'}
                  onClick={() => answerRef.current(i)}
                  className={`wbz-tile ${tone}`}
                >
                  <span className="wbz-tile-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="wbz-tile-word">{opt.en}</span>
                  {phase === 'reveal' && isAnswer && (
                    <span className="wbz-tile-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                  {phase === 'reveal' && isPicked && lastCorrect && gainedPoints > 0 && (
                    <span className="wbz-gain" aria-hidden="true">
                      +{gainedPoints}
                    </span>
                  )}
                </button>
              );
            })}
          </section>

          <p className="wbz-hint" aria-hidden="true">
            탭 또는 <kbd>1</kbd>–<kbd>{tileCount}</kbd> · 빠를수록 콤보·점수 ↑
          </p>
        </main>
      ) : null}
    </div>
  );
}

function DoneScreen({
  score,
  bestCombo,
  correctCount,
  total,
  onRestart,
  onExit,
}: {
  score: number;
  bestCombo: number;
  correctCount: number;
  total: number;
  onRestart: () => void;
  onExit: () => void;
}) {
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  return (
    <main className="wbz-done" role="status">
      <p className="wbz-done-lead">오늘 잘 마쳤어요</p>
      <div className="wbz-done-stats">
        <div className="wbz-done-stat">
          <span className="wbz-done-num wbz-score">{score.toLocaleString()}</span>
          <span className="wbz-done-lbl">점수</span>
        </div>
        <div className="wbz-done-stat">
          <span className="wbz-done-num">
            {correctCount}
            <span className="wbz-done-slash">/{total}</span>
          </span>
          <span className="wbz-done-lbl">정답 · {accuracy}%</span>
        </div>
        <div className="wbz-done-stat">
          <span className="wbz-done-num">🔥 {bestCombo}</span>
          <span className="wbz-done-lbl">최고 콤보</span>
        </div>
      </div>
      <div className="wbz-done-actions">
        <button type="button" onClick={onRestart} className="wbz-btn wbz-btn--primary">
          다시 하기
        </button>
        <button type="button" onClick={onExit} className="wbz-btn">
          나가기
        </button>
      </div>
    </main>
  );
}

// 테마 토큰 기반(라이트/다크 자동). 게임 예외로 --combo/--streak 사용.
const STYLES = `
  .wbz-root {
    width: 100vw; height: 100vh; overflow: hidden;
    display: flex; flex-direction: column;
    background: var(--bg2); color: var(--t1);
    font-family: var(--font-display, system-ui, sans-serif);
    user-select: none;
  }
  .wbz-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

  .wbz-hud {
    display: grid; grid-template-columns: auto 1fr auto auto;
    align-items: center; gap: 12px; padding: 14px 16px;
    border-bottom: 1px solid var(--bd);
  }
  .wbz-stat { display: flex; flex-direction: column; line-height: 1.05; }
  .wbz-stat--right { align-items: flex-end; }
  .wbz-stat-label { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; color: var(--t3); text-transform: uppercase; }
  .wbz-stat-value { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .wbz-score { color: var(--combo); }
  .wbz-combo { font-size: 15px; font-weight: 800; color: var(--t4); font-variant-numeric: tabular-nums; }
  .wbz-combo--on { color: var(--streak); }
  .wbz-progress { height: 6px; border-radius: 999px; background: var(--bg3); overflow: hidden; }
  .wbz-progress-fill { height: 100%; border-radius: 999px; background: var(--combo); transition: width 0.4s var(--ease, cubic-bezier(0.4,0,0.2,1)); }
  .wbz-exit {
    padding: 8px 12px; border-radius: var(--r-md, 8px); border: 1px solid var(--bd);
    background: var(--bg); color: var(--t2); font-size: 12px; font-weight: 700; cursor: pointer;
    min-height: 36px; transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .wbz-exit:hover { color: var(--t1); border-color: var(--t3); }

  .wbz-stage { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(24px, 5vh, 48px); padding: 20px 16px; }

  .wbz-prompt { width: 100%; max-width: 640px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .wbz-prompt-label { font-size: 12px; font-weight: 700; letter-spacing: 0.1em; color: var(--t3); text-transform: uppercase; }
  .wbz-meaning { margin: 0; font-size: clamp(28px, 6vw, 44px); font-weight: 800; color: var(--t1); line-height: 1.15; word-break: keep-all; }
  .wbz-timer { width: min(320px, 80%); height: 6px; border-radius: 999px; background: var(--bg3); overflow: hidden; }
  .wbz-timer-bar {
    height: 100%; width: 100%; border-radius: 999px;
    background: linear-gradient(90deg, var(--combo), var(--streak));
    transform-origin: left center; animation: wbz-deplete linear forwards;
  }
  .wbz-timer-bar--paused { animation-play-state: paused; }
  @keyframes wbz-deplete { from { transform: scaleX(1); } to { transform: scaleX(0); } }
  .wbz-levelup { font-size: 13px; font-weight: 800; color: var(--streak); animation: wbz-pop 0.4s var(--ease, ease-out); }

  .wbz-tiles { width: 100%; max-width: 640px; display: grid; grid-template-columns: 1fr 1fr; gap: clamp(12px, 2.5vw, 18px); }
  .wbz-tiles--two { grid-template-columns: 1fr; max-width: 420px; }
  .wbz-tile {
    position: relative; display: flex; align-items: center; gap: 12px;
    min-height: 84px; padding: 18px 20px; border-radius: var(--r-lg, 14px);
    border: 1.5px solid var(--bd); background: var(--bg); color: var(--t1);
    font-family: var(--font-english, var(--font-display, system-ui));
    font-size: clamp(18px, 3.5vw, 24px); font-weight: 700; cursor: pointer; text-align: left;
    transition: transform 0.12s var(--ease, ease-out), border-color 0.15s, background 0.15s, box-shadow 0.15s;
  }
  .wbz-tile:hover:not(:disabled) { border-color: var(--combo); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.06); }
  .wbz-tile:active:not(:disabled) { transform: translateY(0) scale(0.97); }
  .wbz-tile:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  .wbz-tile:disabled { cursor: default; }
  .wbz-tile-num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; flex-shrink: 0; border-radius: 8px;
    background: var(--bg3); color: var(--t3);
    font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 800;
  }
  .wbz-tile-word { flex: 1; }
  .wbz-tile--correct { border-color: var(--success); background: var(--success-light); color: var(--success); animation: wbz-pop 0.34s var(--ease, ease-out); }
  .wbz-tile--correct .wbz-tile-num { background: var(--success); color: var(--ti); }
  .wbz-tile--wrong { border-color: var(--error); background: var(--error-light); color: var(--error); animation: wbz-shake 0.34s ease-in-out; }
  .wbz-tile--dim { opacity: 0.4; }
  .wbz-tile-check { font-size: 22px; font-weight: 900; color: var(--success); }
  .wbz-gain { position: absolute; top: 6px; right: 12px; font-family: var(--font-display, system-ui); font-size: 14px; font-weight: 900; color: var(--success); animation: wbz-gain 0.6s var(--ease, ease-out) forwards; }

  .wbz-hint { font-size: 12px; color: var(--t3); text-align: center; margin: 0; }
  .wbz-hint kbd { font-family: var(--font-display, monospace); font-size: 11px; padding: 1px 5px; border-radius: 5px; border: 1px solid var(--bd); background: var(--bg); }

  .wbz-done { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 32px; padding: 24px; }
  .wbz-done-lead { margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: clamp(22px, 5vw, 32px); font-weight: 500; color: var(--t1); }
  .wbz-done-stats { display: flex; gap: clamp(20px, 6vw, 56px); }
  .wbz-done-stat { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .wbz-done-num { font-size: clamp(26px, 6vw, 40px); font-weight: 800; font-variant-numeric: tabular-nums; color: var(--t1); }
  .wbz-done-slash { font-size: 0.6em; color: var(--t3); font-weight: 700; }
  .wbz-done-lbl { font-size: 12px; font-weight: 700; color: var(--t3); }
  .wbz-done-actions { display: flex; gap: 12px; }
  .wbz-btn {
    min-height: 48px; padding: 0 24px; border-radius: var(--r-md, 10px);
    border: 1px solid var(--bd); background: var(--bg); color: var(--t1);
    font-family: var(--font-display, system-ui); font-size: 15px; font-weight: 700; cursor: pointer;
    transition: transform 0.12s, background 0.15s, border-color 0.15s;
  }
  .wbz-btn:hover { border-color: var(--t3); }
  .wbz-btn:active { transform: scale(0.97); }
  .wbz-btn--primary { background: var(--combo); border-color: var(--combo); color: var(--ti); }
  .wbz-btn--primary:hover { filter: brightness(1.05); border-color: var(--combo); }

  @keyframes wbz-pop { 0% { transform: scale(0.9); } 50% { transform: scale(1.06); } 100% { transform: scale(1); } }
  .wbz-bump { animation: wbz-pop 0.3s var(--ease, ease-out); }
  @keyframes wbz-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
  @keyframes wbz-gain { 0% { opacity: 0; transform: translateY(6px); } 30% { opacity: 1; transform: translateY(-2px); } 100% { opacity: 0; transform: translateY(-16px); } }

  @media (prefers-reduced-motion: reduce) {
    .wbz-tile, .wbz-btn, .wbz-progress-fill { transition: none; }
    .wbz-tile--correct, .wbz-tile--wrong, .wbz-bump, .wbz-levelup, .wbz-gain { animation: none; }
  }
`;
