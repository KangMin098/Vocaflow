// apps/web/src/components/game/letter-forge/LetterForgeGame.tsx
// Letter Forge — 철자 조립(L4b 시각 생성). ko 뜻 + 흩어진 글자 → en 단어 조립.
// 탭/타이핑, 콤보·문항 타이머·속도등급·힌트. 게임킷 공용 인프라 사용.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles,
  Hud,
  GameDone,
  ParticleBurst,
  useSfx,
  useCountUp,
  shuffle,
  clamp,
  Kbd,
  type Word,
} from '@/components/game/_shared/gamekit';

interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word) => void;
  onWrong?: (w: Word) => void;
}

const DEFAULT_POOL: Word[] = [
  { en: 'advantage', ko: '이점, 유리함' },
  { en: 'reserved', ko: '내성적인' },
  { en: 'inclined', ko: '경향이 있는' },
  { en: 'consequence', ko: '결과, 영향' },
  { en: 'judgment', ko: '판단, 평가' },
  { en: 'mistake', ko: '실수' },
  { en: 'ability', ko: '능력' },
  { en: 'balance', ko: '균형' },
  { en: 'courage', ko: '용기' },
  { en: 'develop', ko: '발전시키다' },
];

type Phase = 'playing' | 'reveal' | 'done';
type Rating = 'perfect' | 'great' | 'good' | null;

interface Tile { id: number; ch: string; }
interface Q { key: number; target: Word; tray: Tile[]; perMs: number; }

const ROUND = 12;
const BASE_MS = 14000;
const MIN_MS = 8000;
const REVEAL_MS = 900;

const cleanWord = (en: string) => en.toLowerCase().replace(/[^a-z]/g, '');

export function LetterForgeGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const pool = useMemo(() => {
    const p = (wordPool && wordPool.length > 0 ? wordPool : DEFAULT_POOL)
      .filter((w) => cleanWord(w.en).length >= 3 && cleanWord(w.en).length <= 12);
    const seen = new Set<string>();
    return p.filter((w) => (seen.has(w.en) ? false : (seen.add(w.en), true)));
  }, [wordPool]);

  const roundLen = Math.min(ROUND, Math.max(5, pool.length));
  const sfx = useSfx();

  const [phase, setPhase] = useState<Phase>('playing');
  const [q, setQ] = useState<Q | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [filled, setFilled] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [rating, setRating] = useState<Rating>(null);
  const [gained, setGained] = useState(0);
  const [hintIdx, setHintIdx] = useState(-1); // 힌트로 고정된 슬롯 수
  const [msg, setMsg] = useState('');

  const shownScore = useCountUp(score);
  const comboRef = useRef(0);
  const answeredRef = useRef(false);
  const qRef = useRef<Q | null>(null);
  const filledRef = useRef<number[]>([]);
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startAt = useRef(0);
  const keyRef = useRef(0);
  const qIndexRef = useRef(0);
  const mounted = useRef(true);

  filledRef.current = filled;

  const answerRef = useRef<() => void>(() => {});
  const nextRef = useRef<(i: number) => void>(() => {});

  const buildQ = useCallback((): Q => {
    const target = pool[Math.floor(Math.random() * pool.length)];
    const chars = cleanWord(target.en).split('');
    const tray = shuffle(chars.map((ch, i) => ({ id: i, ch })));
    // 이미 정렬돼 버리는 사고 방지: 섞였는데 원본과 같으면 한번 더
    if (tray.map((t) => t.ch).join('') === chars.join('') && chars.length > 1) {
      tray.reverse();
    }
    keyRef.current += 1;
    const level = Math.floor(comboRef.current / 5);
    return { key: keyRef.current, target, tray, perMs: Math.max(MIN_MS, BASE_MS - level * 800) };
  }, [pool]);

  const startQ = useCallback(
    (index: number) => {
      if (!mounted.current) return;
      if (index >= roundLen) { setPhase('done'); setQ(null); qRef.current = null; return; }
      const nq = buildQ();
      qRef.current = nq;
      setQ(nq);
      setQIndex(index); qIndexRef.current = index;
      setFilled([]); filledRef.current = [];
      setHintIdx(-1);
      setPhase('playing');
      answeredRef.current = false;
      startAt.current = Date.now();
      if (qTimer.current) clearTimeout(qTimer.current);
      qTimer.current = setTimeout(() => answerRef.current(), nq.perMs);
    },
    [roundLen, buildQ],
  );
  nextRef.current = startQ;

  const finish = useCallback(() => {
    if (answeredRef.current) return;
    const nq = qRef.current;
    if (!nq) return;
    answeredRef.current = true;
    if (qTimer.current) { clearTimeout(qTimer.current); qTimer.current = null; }

    const target = cleanWord(nq.target.en);
    const assembled = filledRef.current.map((id) => nq.tray.find((t) => t.id === id)?.ch ?? '').join('');
    const isCorrect = assembled === target;
    const elapsed = Date.now() - startAt.current;
    const remain = Math.max(0, 1 - elapsed / nq.perMs);
    setLastCorrect(isCorrect);

    if (isCorrect) {
      const nc = comboRef.current + 1; comboRef.current = nc;
      const rt: Rating = remain > 0.6 ? 'perfect' : remain > 0.3 ? 'great' : 'good';
      const mult = 1 + Math.floor(nc / 5) * 0.5;
      const rb = rt === 'perfect' ? 50 : rt === 'great' ? 25 : 0;
      const lenBonus = target.length * 8;
      const g = Math.round((80 + lenBonus + Math.round(remain * 50) + rb) * mult);
      setGained(g); setScore((s) => s + g); setCombo(nc); setBestCombo((b) => Math.max(b, nc));
      setCorrectCount((c) => c + 1); setRating(rt);
      setMsg(`정답 ${nq.target.en}`);
      sfx.correct(nc, nc % 5 === 0);
      onCorrect?.(nq.target);
    } else {
      comboRef.current = 0; setGained(0); setCombo(0); setRating(null);
      setMsg(`정답은 ${nq.target.en}`);
      sfx.wrong();
      onWrong?.(nq.target);
    }
    setPhase('reveal');
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => nextRef.current(qIndexRef.current + 1), REVEAL_MS);
  }, [sfx, onCorrect, onWrong]);
  answerRef.current = finish;

  // 슬롯이 다 차면 자동 검사
  useEffect(() => {
    if (phase !== 'playing' || !q) return;
    if (filled.length === cleanWord(q.target.en).length) {
      const t = setTimeout(() => answerRef.current(), 120);
      return () => clearTimeout(t);
    }
  }, [filled, phase, q]);

  const fill = useCallback((tileId: number) => {
    if (phase !== 'playing') return;
    const nq = qRef.current; if (!nq) return;
    if (filledRef.current.includes(tileId)) return;
    if (filledRef.current.length >= cleanWord(nq.target.en).length) return;
    sfx.click();
    setFilled((f) => [...f, tileId]);
  }, [phase, sfx]);

  const removeLast = useCallback(() => {
    if (phase !== 'playing') return;
    setFilled((f) => (f.length > hintIdx + 1 ? f.slice(0, -1) : f));
  }, [phase, hintIdx]);

  const useHint = useCallback(() => {
    if (phase !== 'playing') return;
    const nq = qRef.current; if (!nq) return;
    const target = cleanWord(nq.target.en);
    const pos = hintIdx + 1;
    if (pos >= target.length) return;
    // pos 위치의 정답 글자를 가진, 아직 안 쓴 tray tile 찾기
    const needCh = target[pos];
    const used = new Set(filledRef.current);
    const tile = nq.tray.find((t) => t.ch === needCh && !used.has(t.id));
    if (!tile) return;
    // 현재 filled 를 pos 까지 정답으로 맞춤(앞부분 재구성)
    const fixed: number[] = [];
    const avail = [...nq.tray];
    for (let i = 0; i <= pos; i++) {
      const ch = target[i];
      const idx = avail.findIndex((t) => t.ch === ch);
      if (idx >= 0) { fixed.push(avail[idx].id); avail.splice(idx, 1); }
    }
    setFilled(fixed); setHintIdx(pos);
    sfx.click();
    setScore((s) => Math.max(0, s - 20)); // 힌트 비용
  }, [phase, hintIdx, sfx]);

  // 키보드
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== 'playing' || !q) return;
      if (e.key === 'Backspace') { e.preventDefault(); removeLast(); return; }
      const ch = e.key.toLowerCase();
      if (!/^[a-z]$/.test(ch)) return;
      const used = new Set(filledRef.current);
      const tile = q.tray.find((t) => t.ch === ch && !used.has(t.id));
      if (tile) { e.preventDefault(); fill(tile.id); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, q, fill, removeLast]);

  useEffect(() => {
    mounted.current = true;
    startQ(0);
    return () => {
      mounted.current = false;
      if (qTimer.current) clearTimeout(qTimer.current);
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restart = useCallback(() => {
    comboRef.current = 0;
    setScore(0); setCombo(0); setBestCombo(0); setCorrectCount(0);
    startQ(0);
  }, [startQ]);

  const handleExit = useCallback(() => {
    if (qTimer.current) clearTimeout(qTimer.current);
    if (revealTimer.current) clearTimeout(revealTimer.current);
    onExit?.();
  }, [onExit]);

  const target = q ? cleanWord(q.target.en) : '';
  const len = target.length;
  const usedIds = new Set(filled);
  const comboTier = clamp(Math.floor(combo / 5), 0, 3);

  return (
    <div className="gk-root lf-root">
      <GameKitStyles />
      <style dangerouslySetInnerHTML={{ __html: LF_CSS }} />
      <div className="gk-energy" aria-hidden="true" style={{ opacity: Math.min(0.5, combo * 0.03), transform: `scale(${1 + comboTier * 0.15})` }} />

      <Hud
        score={shownScore}
        progress={qIndex / roundLen}
        combo={combo}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
      />
      <div className="gk-sr" aria-live="assertive">{msg}</div>

      {phase === 'done' ? (
        <GameDone
          stats={[
            { num: score.toLocaleString(), label: '점수', accent: true },
            { num: `${correctCount}/${roundLen}`, label: `정답 · ${Math.round((correctCount / roundLen) * 100)}%` },
            { num: `🔥 ${bestCombo}`, label: '최고 콤보' },
          ]}
          onRestart={restart}
          onExit={handleExit}
        />
      ) : q ? (
        <main className="gk-stage lf-stage" key={q.key}>
          <div className="lf-prompt">
            <span className="lf-label">이 뜻의 철자를 만드세요</span>
            <h1 className="lf-meaning">{q.target.ko}</h1>
            <div className="lf-timer" aria-hidden="true">
              <div key={q.key} className={`lf-timer-bar ${phase === 'reveal' ? 'lf-timer-bar--paused' : ''}`} style={{ animationDuration: `${q.perMs}ms` }} />
            </div>
          </div>

          {/* 슬롯 */}
          <div className={`lf-slots ${phase === 'reveal' && lastCorrect ? 'lf-slots--ok' : ''} ${phase === 'reveal' && lastCorrect === false ? 'lf-slots--no' : ''}`}>
            {Array.from({ length: len }).map((_, i) => {
              const id = filled[i];
              const ch = id !== undefined ? q.tray.find((t) => t.id === id)?.ch : '';
              const revealCh = phase === 'reveal' && !lastCorrect ? target[i] : ch;
              return (
                <button
                  key={i}
                  type="button"
                  className={`lf-slot ${i <= hintIdx ? 'lf-slot--hint' : ''} ${revealCh ? 'lf-slot--filled' : ''}`}
                  onClick={() => { if (i === filled.length - 1) removeLast(); }}
                  disabled={phase !== 'playing' || i > filled.length - 1 || i <= hintIdx}
                  aria-label={`${i + 1}번째 글자${ch ? ` ${ch}` : ' 빈칸'}`}
                >
                  {(revealCh ?? '').toUpperCase()}
                  {phase === 'reveal' && lastCorrect && i === len - 1 && <ParticleBurst intensity={1 + comboTier} />}
                </button>
              );
            })}
          </div>

          {rating && phase === 'reveal' && lastCorrect && (
            <div className={`lf-rating lf-rating--${rating}`} aria-hidden="true">
              {rating === 'perfect' ? '⚡ PERFECT' : rating === 'great' ? 'GREAT' : 'GOOD'}
              {gained > 0 && <span className="lf-gain"> +{gained}</span>}
            </div>
          )}

          {/* 글자 트레이 */}
          <div className="lf-tray">
            {q.tray.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`lf-key ${usedIds.has(t.id) ? 'lf-key--used' : ''}`}
                onClick={() => fill(t.id)}
                disabled={phase !== 'playing' || usedIds.has(t.id)}
                aria-label={`글자 ${t.ch}`}
              >
                {t.ch.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="lf-controls">
            <button type="button" className="gk-btn lf-ctrl" onClick={removeLast} disabled={phase !== 'playing' || filled.length <= hintIdx + 1}>← 지우기</button>
            <button type="button" className="gk-btn lf-ctrl" onClick={useHint} disabled={phase !== 'playing' || hintIdx + 1 >= len}>💡 힌트 (−20)</button>
          </div>
          <p className="lf-hint" aria-hidden="true">글자를 탭하거나 <Kbd>키보드</Kbd> 로 입력 · <Kbd>⌫</Kbd> 지우기</p>
        </main>
      ) : null}
    </div>
  );
}

const LF_CSS = `
  .lf-stage { gap: clamp(18px, 3.4vh, 34px); }
  .lf-prompt { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .lf-label { font-size: 12px; font-weight: 700; letter-spacing: .1em; color: var(--t3); text-transform: uppercase; }
  .lf-meaning { margin: 0; font-family: var(--font-display, system-ui); font-size: clamp(26px, 5.4vw, 40px); font-weight: 800; color: var(--t1); word-break: keep-all; }
  .lf-timer { width: min(300px, 76vw); height: 5px; border-radius: 999px; background: var(--bg3); overflow: hidden; }
  .lf-timer-bar { height: 100%; width: 100%; transform-origin: left; animation: lf-deplete linear forwards; }
  .lf-timer-bar--paused { animation-play-state: paused; }
  @keyframes lf-deplete { 0% { transform: scaleX(1); background: linear-gradient(90deg,var(--combo),var(--streak)); } 55% { background: linear-gradient(90deg,var(--combo),var(--streak)); } 80% { background: var(--warning); } 100% { transform: scaleX(0); background: var(--error); } }

  .lf-slots { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 640px; }
  .lf-slot { position: relative; overflow: visible; width: clamp(38px, 8.2vw, 54px); height: clamp(48px, 10vw, 62px); border-radius: var(--r-md, 10px); border: 2px solid var(--bd); background: var(--bg); color: var(--t1); font-family: var(--font-english, system-ui); font-size: clamp(20px, 4.4vw, 28px); font-weight: 800; display: grid; place-items: center; cursor: pointer; transition: border-color .15s, background .15s, transform .1s; }
  .lf-slot--filled { border-color: var(--combo); border-style: solid; background: color-mix(in srgb, var(--combo) 8%, var(--bg)); }
  .lf-slot--filled:not([disabled]):active { transform: scale(.94); }
  .lf-slot--hint { border-color: var(--active); background: color-mix(in srgb, var(--active) 12%, var(--bg)); color: var(--active); }
  .lf-slot:not(.lf-slot--filled) { border-style: dashed; }
  .lf-slots--ok .lf-slot { border-color: var(--success) !important; background: var(--success-light); color: var(--success); animation: gk-correct .4s ease-out; }
  .lf-slots--no .lf-slot { border-color: var(--error) !important; background: var(--error-light); color: var(--error); animation: gk-shake .36s ease-in-out; }

  .lf-rating { font-weight: 900; font-size: 15px; letter-spacing: .04em; color: var(--success); animation: gk-pop .4s ease-out; }
  .lf-rating--perfect { color: var(--streak); font-size: 18px; }
  .lf-rating--great { color: var(--combo); }
  .lf-gain { color: var(--success); font-family: var(--font-display, system-ui); }

  .lf-tray { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 620px; }
  .lf-key { width: clamp(42px, 9vw, 56px); height: clamp(48px, 10vw, 60px); border-radius: var(--r-md, 10px); border: 1.5px solid var(--bd); background: var(--bg); color: var(--t1); font-family: var(--font-english, system-ui); font-size: clamp(18px, 4vw, 24px); font-weight: 800; cursor: pointer; transition: transform .1s, border-color .15s, box-shadow .15s, opacity .15s; }
  .lf-key:hover:not(:disabled) { border-color: var(--combo); transform: translateY(-2px); box-shadow: 0 6px 18px color-mix(in srgb, var(--combo) 18%, transparent); }
  .lf-key:active:not(:disabled) { transform: translateY(0) scale(.92); }
  .lf-key:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  .lf-key--used { opacity: .25; pointer-events: none; }

  .lf-controls { display: flex; gap: 10px; }
  .lf-ctrl { min-height: 42px; padding: 0 16px; font-size: 13px; }
  .lf-hint { font-size: 12px; color: var(--t3); margin: 0; text-align: center; }

  @media (prefers-reduced-motion: reduce) {
    .lf-slots--ok .lf-slot, .lf-slots--no .lf-slot, .lf-rating, .lf-key { animation: none; }
  }
`;
