// apps/web/src/components/game/wordblitz/WordBlitzGame.tsx
// WordBlitz — 속사 인지(Speed Recognition Blitz). v07.2 (익사이트 강화).
//
// ko 뜻 → 4개 en 타일 중 정답을 빠르게. 콤보·타이머·레벨업 플로우.
// v07.2 juice: 파티클 버스트 · Web Audio SFX · 속도등급(PERFECT/GREAT/GOOD) ·
//   콤보 불꽃 성장 · 마일스톤 배너 · 점수 카운트업 · 에너지 백드롭 · 문항 등장 애니 · 타이머 긴박.
//   근거(리서치): "숙련될수록 더 극적인 피드백" · Action→Feedback→Reward 루프.
// 계약: page.tsx 의 wordPool/onExit/onCorrect/onWrong 그대로 재사용.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameKitStyles, GameMusic } from '@/components/game/_shared/gamekit';
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
type Rating = 'perfect' | 'great' | 'good' | null;

const ROUND_MIN = 8;
const ROUND_MAX = 20;
const BASE_MS = 5000;
const MIN_MS = 2600;
const LEVEL_STEP_MS = 350;
const REVEAL_MS = 680;
const COMBO_PER_LEVEL = 5;

const PARTICLE_COLORS = ['var(--streak)', 'var(--combo)', 'var(--success)', 'var(--active)'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const levelFromCombo = (combo: number) => Math.floor(combo / COMBO_PER_LEVEL);
const perMsForLevel = (level: number) => Math.max(MIN_MS, BASE_MS - level * LEVEL_STEP_MS);
const ratingOf = (remainRatio: number): Rating =>
  remainRatio > 0.66 ? 'perfect' : remainRatio > 0.38 ? 'great' : 'good';
const RATING_LABEL: Record<'perfect' | 'great' | 'good', string> = {
  perfect: '⚡ PERFECT',
  great: 'GREAT',
  good: 'GOOD',
};

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
  const [displayScore, setDisplayScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [gainedPoints, setGainedPoints] = useState(0);
  const [rating, setRating] = useState<Rating>(null);
  const [milestone, setMilestone] = useState(0); // >0 = 마일스톤 콤보 값
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [muted, setMuted] = useState(false);

  const comboRef = useRef(0);
  const answeredRef = useRef(false);
  const questionRef = useRef<Question | null>(null);
  const qTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef(0);
  const keyRef = useRef(0);
  const qIndexRef = useRef(0);
  const mountedRef = useRef(true);
  const mutedRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const displayScoreRef = useRef(0);
  const scoreRafRef = useRef(0);

  mutedRef.current = muted;

  // ── Web Audio SFX ──
  const tone = useCallback(
    (freq: number, dur = 0.09, type: OscillatorType = 'sine', gain = 0.05, at = 0) => {
      if (mutedRef.current || typeof window === 'undefined') return;
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      if (!audioRef.current) audioRef.current = new AC();
      const ctx = audioRef.current;
      if (ctx.state === 'suspended') void ctx.resume();
      const t0 = ctx.currentTime + at;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur);
    },
    [],
  );
  const sfxCorrect = useCallback(
    (comboVal: number, isMilestone: boolean) => {
      const base = 520 + Math.min(comboVal, 12) * 26; // 콤보 높을수록 높은 음
      tone(base, 0.1, 'triangle', 0.06);
      tone(base * 1.5, 0.12, 'sine', 0.045, 0.05);
      if (isMilestone) {
        tone(base * 2, 0.14, 'sine', 0.05, 0.1);
        tone(base * 2.5, 0.16, 'sine', 0.045, 0.17);
      }
    },
    [tone],
  );
  const sfxWrong = useCallback(() => {
    tone(150, 0.16, 'sawtooth', 0.05);
    tone(110, 0.18, 'sawtooth', 0.04, 0.04);
  }, [tone]);

  const speak = useCallback(
    (text: string) => {
      if (!enableSpeech || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        u.rate = 1.05;
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
      const distractors = shuffle(pool.filter((w) => w.en !== target.en)).slice(0, tileCount - 1);
      const options = shuffle([target, ...distractors]);
      keyRef.current += 1;
      const q: Question = { key: keyRef.current, target, options, perMs: perMsForLevel(level) };
      questionRef.current = q;
      setQuestion(q);
      setQIndex(index);
      qIndexRef.current = index;
      setPicked(null);
      setRating(null);
      setMilestone(0);
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
        const rt = ratingOf(remainRatio);
        const mult = 1 + levelFromCombo(newCombo) * 0.5;
        const ratingBonus = rt === 'perfect' ? 40 : rt === 'great' ? 20 : 0;
        const gained = Math.round((100 + Math.round(remainRatio * 60) + ratingBonus) * mult);
        const isMilestone = newCombo % COMBO_PER_LEVEL === 0;
        setGainedPoints(gained);
        setScore((s) => s + gained);
        setCombo(newCombo);
        setBestCombo((b) => Math.max(b, newCombo));
        setCorrectCount((c) => c + 1);
        setRating(rt);
        setMilestone(isMilestone ? newCombo : 0);
        setFeedbackMsg(`정답 ${q.target.en}. 콤보 ${newCombo}.`);
        speak(q.target.en);
        sfxCorrect(newCombo, isMilestone);
        onCorrect?.(q.target);
      } else {
        comboRef.current = 0;
        setGainedPoints(0);
        setCombo(0);
        setRating(null);
        setMilestone(0);
        setFeedbackMsg(
          tileIndex === null
            ? `시간 초과. 정답은 ${q.target.en} — ${q.target.ko}.`
            : `오답. 정답은 ${q.target.en} — ${q.target.ko}.`,
        );
        sfxWrong();
        onWrong?.(q.target);
      }

      setPhase('reveal');
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      revealTimerRef.current = setTimeout(() => {
        startQuestionRef.current(qIndexRef.current + 1);
      }, REVEAL_MS);
    },
    [speak, sfxCorrect, sfxWrong, onCorrect, onWrong],
  );
  answerRef.current = answer;

  // 점수 카운트업 (rAF tween)
  useEffect(() => {
    const from = displayScoreRef.current;
    const to = score;
    if (from === to) return;
    const startT = performance.now();
    const dur = 450;
    const step = (now: number) => {
      const t = Math.min(1, (now - startT) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = Math.round(from + (to - from) * eased);
      displayScoreRef.current = val;
      setDisplayScore(val);
      if (t < 1) scoreRafRef.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(scoreRafRef.current);
    scoreRafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(scoreRafRef.current);
  }, [score]);

  // 시작 + 언마운트 정리
  useEffect(() => {
    mountedRef.current = true;
    startQuestionRef.current(0);
    return () => {
      mountedRef.current = false;
      if (qTimerRef.current) clearTimeout(qTimerRef.current);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      cancelAnimationFrame(scoreRafRef.current);
      if (audioRef.current) void audioRef.current.close().catch(() => {});
    };
  }, []);

  // 키보드 1–4
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
    displayScoreRef.current = 0;
    setScore(0);
    setDisplayScore(0);
    setCombo(0);
    setBestCombo(0);
    setCorrectCount(0);
    startQuestionRef.current(0);
  }, []);

  const handleExit = useCallback(() => {
    if (qTimerRef.current) clearTimeout(qTimerRef.current);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    onExit?.();
  }, [onExit]);

  const level = levelFromCombo(combo);
  const comboTier = Math.min(3, Math.max(0, level)); // 0..3 에너지 강도
  const burstIntensity = milestone > 0 ? 3 : Math.min(3, 1 + comboTier);

  return (
    <div className="wbz-root" data-tier={comboTier}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {/* 에너지 백드롭 — 콤보로 발광 증가 */}
      <div
        className="wbz-energy"
        aria-hidden="true"
        style={{ opacity: Math.min(0.5, combo * 0.03), transform: `scale(${1 + comboTier * 0.15})` }}
      />

      {/* ── HUD ── */}
      <header className="wbz-hud">
        <div className="wbz-stat">
          <span className="wbz-stat-label">SCORE</span>
          <span key={score} className="wbz-stat-value wbz-score wbz-score-bump">
            {displayScore.toLocaleString()}
          </span>
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
            data-tier={comboTier}
            className={`wbz-combo ${combo > 0 ? 'wbz-combo--on wbz-bump' : ''}`}
          >
            {combo > 0 ? `🔥 ${combo}` : '콤보'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="wbz-icon-btn"
          aria-label={muted ? '소리 켜기' : '소리 끄기'}
          aria-pressed={muted}
        >
          {muted ? '🔇' : '🔊'}
        </button>

        {onExit && (
          <button type="button" onClick={handleExit} className="wbz-exit" aria-label="게임 종료">
            나가기
          </button>
        )}
      </header>

      {/* 배경음악 — 아케이드 17종과 같은 선호(localStorage)를 공유. 이전엔 트랙 매핑에서
          빠져 있어 WordBlitz 만 영영 무음이었다.
          WordBlitz 는 gamekit 을 쓰지 않으므로 .gk-music-btn 스타일을 함께 주입해야 한다
          (GK_CSS 는 전부 .gk-* 프리픽스라 이 게임 스타일과 충돌하지 않고, 중복 주입도 무해). */}
      <GameKitStyles />
      <GameMusic gameId="wordblitz" />

      <div className="wbz-sr" aria-live="assertive" role="status">
        {feedbackMsg}
      </div>

      {/* 마일스톤 배너 */}
      {milestone > 0 && phase === 'reveal' && (
        <div className="wbz-milestone" aria-hidden="true">
          <span className="wbz-milestone-flame">🔥</span> COMBO {milestone}!
        </div>
      )}

      {phase === 'done' ? (
        <DoneScreen
          score={score}
          bestCombo={bestCombo}
          correctCount={correctCount}
          total={roundLength}
          muted={muted}
          onRestart={restart}
          onExit={handleExit}
        />
      ) : question ? (
        <main className="wbz-stage" key={question.key}>
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
            {/* 속도 등급 */}
            {rating && phase === 'reveal' && lastCorrect && (
              <div className={`wbz-rating wbz-rating--${rating}`} aria-hidden="true">
                {RATING_LABEL[rating]}
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
                  style={{ animationDelay: phase === 'playing' ? `${i * 0.04}s` : undefined }}
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
                  {/* 정답 파티클 버스트 */}
                  {phase === 'reveal' && isAnswer && lastCorrect && (
                    <ParticleBurst intensity={burstIntensity} />
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

function ParticleBurst({ intensity }: { intensity: number }) {
  const parts = useMemo(() => {
    const count = 8 + intensity * 6;
    return Array.from({ length: count }, (_, i) => {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
      const dist = 44 + Math.random() * 46 + intensity * 14;
      return {
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist,
        size: 5 + Math.random() * 6,
        delay: Math.random() * 0.04,
        color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      };
    });
  }, [intensity]);
  return (
    <span className="wbz-burst" aria-hidden="true">
      {parts.map((p, i) => (
        <span
          key={i}
          className="wbz-particle"
          style={
            {
              '--tx': `${p.tx}px`,
              '--ty': `${p.ty}px`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: p.color,
              animationDelay: `${p.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

function DoneScreen({
  score,
  bestCombo,
  correctCount,
  total,
  muted,
  onRestart,
  onExit,
}: {
  score: number;
  bestCombo: number;
  correctCount: number;
  total: number;
  muted: boolean;
  onRestart: () => void;
  onExit: () => void;
}) {
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const [shown, setShown] = useState(0);

  // 최종 점수 카운트업 + 완료 팡파르
  useEffect(() => {
    const startT = performance.now();
    const dur = 900;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - startT) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(score * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // 완료 팡파르 (뮤트 아니면)
    if (!muted && typeof window !== 'undefined') {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        try {
          const ctx = new AC();
          [523, 659, 784, 1047].forEach((f, i) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = f;
            const t0 = ctx.currentTime + i * 0.11;
            g.gain.setValueAtTime(0.05, t0);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
            osc.connect(g);
            g.connect(ctx.destination);
            osc.start(t0);
            osc.stop(t0 + 0.22);
          });
          setTimeout(() => void ctx.close().catch(() => {}), 900);
        } catch {
          /* noop */
        }
      }
    }
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="wbz-done" role="status">
      <div className="wbz-done-burst" aria-hidden="true">
        <ParticleBurst intensity={3} />
      </div>
      <p className="wbz-done-lead">오늘 잘 마쳤어요</p>
      <div className="wbz-done-stats">
        <div className="wbz-done-stat">
          <span className="wbz-done-num wbz-score">{shown.toLocaleString()}</span>
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
    position: relative; width: 100vw; height: 100vh; overflow: hidden;
    display: flex; flex-direction: column;
    background: var(--bg2); color: var(--t1);
    font-family: var(--font-display, system-ui, sans-serif); user-select: none;
  }
  .wbz-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

  .wbz-energy {
    position: absolute; inset: 0; pointer-events: none; z-index: 0;
    background: radial-gradient(circle at 50% 42%,
      color-mix(in srgb, var(--streak) 55%, transparent), transparent 60%);
    transition: opacity 0.5s ease, transform 0.6s ease;
  }
  /* gamekit 과 동일 이슈 — 이 규칙(0,2,0)이 .gk-music-btn(0,1,0)의 position:fixed 를 이겨서
     음악 버튼이 좌하단 고정이 아니라 흐름에 박힌다. 배경 레이어처럼 제외한다. */
  .wbz-root > :not(.wbz-energy):not(.gk-music-btn) { position: relative; z-index: 1; }

  .wbz-hud {
    display: grid; grid-template-columns: auto 1fr auto auto auto;
    align-items: center; gap: 10px; padding: 14px 16px;
    border-bottom: 1px solid var(--bd);
  }
  .wbz-stat { display: flex; flex-direction: column; line-height: 1.05; }
  .wbz-stat--right { align-items: flex-end; }
  .wbz-stat-label { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; color: var(--t3); text-transform: uppercase; }
  .wbz-stat-value { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .wbz-score { color: var(--combo); }
  .wbz-score-bump { animation: wbz-pop 0.3s var(--ease, ease-out); }
  .wbz-combo { font-size: 15px; font-weight: 800; color: var(--t4); font-variant-numeric: tabular-nums; transition: font-size 0.2s ease; }
  .wbz-combo--on { color: var(--streak); }
  .wbz-combo--on[data-tier="1"] { font-size: 17px; }
  .wbz-combo--on[data-tier="2"] { font-size: 19px; color: #E8622F; text-shadow: 0 0 12px color-mix(in srgb, var(--streak) 60%, transparent); }
  .wbz-combo--on[data-tier="3"] { font-size: 22px; color: #E0322F; text-shadow: 0 0 16px color-mix(in srgb, var(--error) 70%, transparent); }
  .wbz-progress { height: 6px; border-radius: 999px; background: var(--bg3); overflow: hidden; }
  .wbz-progress-fill { height: 100%; border-radius: 999px; background: var(--combo); transition: width 0.4s var(--ease, cubic-bezier(0.4,0,0.2,1)); }
  .wbz-icon-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 36px; height: 36px; border-radius: var(--r-md, 8px); border: 1px solid var(--bd);
    background: var(--bg); font-size: 15px; cursor: pointer; transition: border-color 0.15s;
  }
  .wbz-icon-btn:hover { border-color: var(--t3); }
  .wbz-exit {
    padding: 8px 12px; border-radius: var(--r-md, 8px); border: 1px solid var(--bd);
    background: var(--bg); color: var(--t2); font-size: 12px; font-weight: 700; cursor: pointer;
    min-height: 36px; transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .wbz-exit:hover { color: var(--t1); border-color: var(--t3); }

  .wbz-milestone {
    position: absolute; top: 22%; left: 50%; transform: translateX(-50%);
    font-size: clamp(24px, 6vw, 40px); font-weight: 900; letter-spacing: 0.02em;
    color: var(--streak); text-shadow: 0 4px 24px color-mix(in srgb, var(--streak) 60%, transparent);
    z-index: 3; pointer-events: none; animation: wbz-milestone 0.68s var(--ease, ease-out);
  }
  .wbz-milestone-flame { display: inline-block; animation: wbz-flame 0.5s ease-in-out infinite alternate; }

  .wbz-stage {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: clamp(24px, 5vh, 48px); padding: 20px 16px; animation: wbz-stage-in 0.28s var(--ease, ease-out);
  }
  .wbz-prompt { width: 100%; max-width: 640px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; position: relative; }
  .wbz-prompt-label { font-size: 12px; font-weight: 700; letter-spacing: 0.1em; color: var(--t3); text-transform: uppercase; }
  .wbz-meaning { margin: 0; font-size: clamp(28px, 6vw, 44px); font-weight: 800; color: var(--t1); line-height: 1.15; word-break: keep-all; }
  .wbz-timer { width: min(320px, 80%); height: 6px; border-radius: 999px; background: var(--bg3); overflow: hidden; }
  .wbz-timer-bar {
    height: 100%; width: 100%; border-radius: 999px; transform-origin: left center;
    animation: wbz-deplete linear forwards;
  }
  .wbz-timer-bar--paused { animation-play-state: paused; }
  @keyframes wbz-deplete {
    0% { transform: scaleX(1); background: linear-gradient(90deg, var(--combo), var(--streak)); }
    55% { background: linear-gradient(90deg, var(--combo), var(--streak)); }
    80% { background: var(--warning); }
    100% { transform: scaleX(0); background: var(--error); }
  }
  .wbz-rating {
    position: absolute; bottom: -32px; font-weight: 900; font-size: 15px; letter-spacing: 0.05em;
    animation: wbz-rating 0.6s var(--ease, ease-out);
  }
  .wbz-rating--perfect { color: var(--streak); font-size: 18px; }
  .wbz-rating--great { color: var(--combo); }
  .wbz-rating--good { color: var(--success); }

  .wbz-tiles { width: 100%; max-width: 640px; display: grid; grid-template-columns: 1fr 1fr; gap: clamp(12px, 2.5vw, 18px); }
  .wbz-tiles--two { grid-template-columns: 1fr; max-width: 420px; }
  .wbz-tile {
    position: relative; overflow: visible; display: flex; align-items: center; gap: 12px;
    min-height: 84px; padding: 18px 20px; border-radius: var(--r-lg, 14px);
    border: 1.5px solid var(--bd); background: var(--bg); color: var(--t1);
    font-family: var(--font-english, var(--font-display, system-ui));
    font-size: clamp(18px, 3.5vw, 24px); font-weight: 700; cursor: pointer; text-align: left;
    transition: transform 0.12s var(--ease, ease-out), border-color 0.15s, background 0.15s, box-shadow 0.15s;
    animation: wbz-tile-in 0.3s var(--ease, ease-out) both;
  }
  .wbz-tile:hover:not(:disabled) { border-color: var(--combo); transform: translateY(-3px); box-shadow: 0 8px 24px color-mix(in srgb, var(--combo) 18%, transparent); }
  .wbz-tile:active:not(:disabled) { transform: translateY(0) scale(0.96); }
  .wbz-tile:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  .wbz-tile:disabled { cursor: default; animation: none; }
  .wbz-tile-num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; flex-shrink: 0; border-radius: 8px; background: var(--bg3); color: var(--t3);
    font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 800;
  }
  .wbz-tile-word { flex: 1; }
  .wbz-tile--correct {
    border-color: var(--success); background: var(--success-light); color: var(--success);
    animation: wbz-correct 0.42s var(--ease, ease-out);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 35%, transparent), 0 8px 30px color-mix(in srgb, var(--success) 30%, transparent);
  }
  .wbz-tile--correct .wbz-tile-num { background: var(--success); color: var(--ti); }
  .wbz-tile--wrong { border-color: var(--error); background: var(--error-light); color: var(--error); animation: wbz-shake 0.36s ease-in-out; }
  .wbz-tile--dim { opacity: 0.38; }
  .wbz-tile-check { font-size: 22px; font-weight: 900; color: var(--success); animation: wbz-pop 0.4s var(--ease, ease-out) 0.06s both; }
  .wbz-gain {
    position: absolute; top: 4px; right: 12px; font-family: var(--font-display, system-ui);
    font-size: 15px; font-weight: 900; color: var(--success); animation: wbz-gain 0.7s var(--ease, ease-out) forwards;
  }

  .wbz-burst { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; overflow: visible; }
  .wbz-particle { position: absolute; border-radius: 50%; animation: wbz-particle 0.66s var(--ease, cubic-bezier(0.2,0.7,0.3,1)) forwards; }

  .wbz-hint { font-size: 12px; color: var(--t3); text-align: center; margin: 0; }
  .wbz-hint kbd { font-family: var(--font-display, monospace); font-size: 11px; padding: 1px 5px; border-radius: 5px; border: 1px solid var(--bd); background: var(--bg); }

  .wbz-done { position: relative; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 32px; padding: 24px; }
  .wbz-done-burst { position: absolute; top: 32%; left: 50%; width: 0; height: 0; }
  .wbz-done-lead { margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: clamp(22px, 5vw, 32px); font-weight: 500; color: var(--t1); animation: wbz-pop 0.5s var(--ease, ease-out); }
  .wbz-done-stats { display: flex; gap: clamp(20px, 6vw, 56px); }
  .wbz-done-stat { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .wbz-done-num { font-size: clamp(26px, 6vw, 40px); font-weight: 800; font-variant-numeric: tabular-nums; color: var(--t1); }
  .wbz-done-slash { font-size: 0.6em; color: var(--t3); font-weight: 700; }
  .wbz-done-lbl { font-size: 12px; font-weight: 700; color: var(--t3); }
  .wbz-done-actions { display: flex; gap: 12px; }
  .wbz-btn {
    min-height: 48px; padding: 0 24px; border-radius: var(--r-md, 10px); border: 1px solid var(--bd);
    background: var(--bg); color: var(--t1); font-family: var(--font-display, system-ui);
    font-size: 15px; font-weight: 700; cursor: pointer; transition: transform 0.12s, background 0.15s, border-color 0.15s;
  }
  .wbz-btn:hover { border-color: var(--t3); }
  .wbz-btn:active { transform: scale(0.97); }
  .wbz-btn--primary { background: var(--combo); border-color: var(--combo); color: var(--ti); }
  .wbz-btn--primary:hover { filter: brightness(1.08); border-color: var(--combo); }

  @keyframes wbz-pop { 0% { transform: scale(0.9); } 50% { transform: scale(1.06); } 100% { transform: scale(1); } }
  .wbz-bump { animation: wbz-pop 0.3s var(--ease, ease-out); }
  @keyframes wbz-correct { 0% { transform: scale(1); } 35% { transform: scale(1.05); } 100% { transform: scale(1); } }
  @keyframes wbz-shake { 0%,100% { transform: translateX(0); } 18% { transform: translateX(-7px); } 38% { transform: translateX(7px); } 58% { transform: translateX(-5px); } 78% { transform: translateX(4px); } }
  @keyframes wbz-gain { 0% { opacity: 0; transform: translateY(8px) scale(0.8); } 25% { opacity: 1; transform: translateY(-2px) scale(1.1); } 100% { opacity: 0; transform: translateY(-22px) scale(1); } }
  @keyframes wbz-particle { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(var(--tx), var(--ty)) scale(0.2); opacity: 0; } }
  @keyframes wbz-milestone { 0% { transform: translateX(-50%) scale(0.6); opacity: 0; } 30% { transform: translateX(-50%) scale(1.12); opacity: 1; } 80% { transform: translateX(-50%) scale(1); opacity: 1; } 100% { transform: translateX(-50%) scale(1); opacity: 0; } }
  @keyframes wbz-flame { from { transform: scale(1) rotate(-4deg); } to { transform: scale(1.18) rotate(4deg); } }
  @keyframes wbz-rating { 0% { transform: translateY(6px) scale(0.7); opacity: 0; } 35% { transform: translateY(0) scale(1.1); opacity: 1; } 100% { transform: translateY(-4px) scale(1); opacity: 1; } }
  @keyframes wbz-stage-in { from { opacity: 0.4; } to { opacity: 1; } }
  @keyframes wbz-tile-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

  @media (prefers-reduced-motion: reduce) {
    .wbz-tile, .wbz-btn, .wbz-progress-fill, .wbz-combo, .wbz-energy { transition: none; }
    .wbz-tile, .wbz-stage, .wbz-tile--correct, .wbz-tile--wrong, .wbz-bump, .wbz-score-bump,
    .wbz-rating, .wbz-milestone, .wbz-gain, .wbz-tile-check, .wbz-done-lead { animation: none !important; }
    .wbz-milestone-flame { animation: none; }
    .wbz-particle { display: none; }
  }
`;
