// apps/web/src/components/game/cascade/CascadeGame.tsx
// Cascade — 단어↔뜻 짝 매칭 낙하 보드(L4a 재인·공간). 짝을 이으면 지워지고 위 타일이 떨어지며 새 타일이 채워진다.
// 90초 타임세션·콤보·연쇄. 게임킷 공용 인프라 사용.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles, Hud, GameDone, ParticleBurst, useSfx, useCountUp, shuffle, clamp, type Word,
} from '@/components/game/_shared/gamekit';

interface Props { wordPool?: Word[]; onExit?: () => void; onCorrect?: (w: Word) => void; onWrong?: (w: Word) => void; }

const DEFAULT_POOL: Word[] = [
  { en: 'advantage', ko: '이점' }, { en: 'reserved', ko: '내성적인' }, { en: 'inclined', ko: '경향' },
  { en: 'consequence', ko: '결과' }, { en: 'judgment', ko: '판단' }, { en: 'mistake', ko: '실수' },
  { en: 'ability', ko: '능력' }, { en: 'balance', ko: '균형' }, { en: 'courage', ko: '용기' },
  { en: 'develop', ko: '발전' }, { en: 'reduce', ko: '줄이다' }, { en: 'sudden', ko: '갑작스러운' },
];

const COLS = 4;
const ROWS = 4;
const SESSION_MS = 90000;

interface Cell { id: number; word: Word; side: 'en' | 'ko'; fresh?: boolean; }
type Board = (Cell | null)[]; // length COLS*ROWS, index = row*COLS+col (row 0 = top)

export function CascadeGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const pool = useMemo(() => {
    const p = (wordPool && wordPool.length > 0 ? wordPool : DEFAULT_POOL);
    const seen = new Set<string>();
    return p.filter((w) => w.ko && (seen.has(w.en) ? false : (seen.add(w.en), true)));
  }, [wordPool]);
  const sfx = useSfx();

  const [board, setBoard] = useState<Board>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [badPair, setBadPair] = useState<[number, number] | null>(null);
  const [clearing, setClearing] = useState<Set<number>>(new Set());
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SESSION_MS);
  const [phase, setPhase] = useState<'playing' | 'done'>('playing');
  const [floatGain, setFloatGain] = useState<{ idx: number; val: number; key: number } | null>(null);

  const shownScore = useCountUp(score);
  const idRef = useRef(0);
  const queueRef = useRef<Cell[]>([]);
  const comboRef = useRef(0);
  const comboTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endRef = useRef(0);
  const rafRef = useRef(0);
  const mounted = useRef(true);

  const mkCell = useCallback((word: Word, side: 'en' | 'ko', fresh = false): Cell => {
    idRef.current += 1; return { id: idRef.current, word, side, fresh };
  }, []);

  const refillQueue = useCallback(() => {
    // 짝(en+ko) 단위로 큐에 보충 → 항상 매칭 가능
    const batch: Cell[] = [];
    const picks = shuffle(pool).slice(0, Math.max(6, COLS * ROWS));
    for (const w of picks) { batch.push(mkCell(w, 'en', true)); batch.push(mkCell(w, 'ko', true)); }
    queueRef.current.push(...shuffle(batch));
  }, [pool, mkCell]);

  const drawCell = useCallback((): Cell => {
    if (queueRef.current.length === 0) refillQueue();
    return queueRef.current.shift()!;
  }, [refillQueue]);

  // 중력: 각 열의 non-null 을 아래로 모으고 위를 새 타일로 채움
  const settle = useCallback((b: Board): Board => {
    const next: Board = new Array(COLS * ROWS).fill(null);
    for (let c = 0; c < COLS; c++) {
      const colCells: Cell[] = [];
      for (let r = ROWS - 1; r >= 0; r--) { const cell = b[r * COLS + c]; if (cell) colCells.push({ ...cell, fresh: false }); }
      // 부족분 새 타일
      while (colCells.length < ROWS) colCells.push({ ...drawCell(), fresh: true });
      // 아래(r=ROWS-1)부터 채움
      for (let i = 0; i < ROWS; i++) { next[(ROWS - 1 - i) * COLS + c] = colCells[i]; }
    }
    return next;
  }, [drawCell]);

  const newGame = useCallback(() => {
    queueRef.current = [];
    idRef.current = 0;
    refillQueue();
    let b: Board = new Array(COLS * ROWS).fill(null);
    b = settle(b);
    setBoard(b); setSelected(null); setBadPair(null); setClearing(new Set());
    setScore(0); setCombo(0); setBestCombo(0); setCleared(0);
    comboRef.current = 0;
    setTimeLeft(SESSION_MS); setPhase('playing');
    endRef.current = Date.now() + SESSION_MS;
  }, [refillQueue, settle]);

  // 타이머
  useEffect(() => {
    if (phase !== 'playing') return;
    const tick = () => {
      const left = Math.max(0, endRef.current - Date.now());
      setTimeLeft(left);
      if (left <= 0) { setPhase('done'); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]);

  useEffect(() => {
    mounted.current = true;
    newGame();
    return () => {
      mounted.current = false;
      cancelAnimationFrame(rafRef.current);
      if (comboTimer.current) clearTimeout(comboTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bumpCombo = useCallback(() => {
    const nc = comboRef.current + 1; comboRef.current = nc;
    setCombo(nc); setBestCombo((b) => Math.max(b, nc));
    if (comboTimer.current) clearTimeout(comboTimer.current);
    comboTimer.current = setTimeout(() => { comboRef.current = 0; setCombo(0); }, 4200);
    return nc;
  }, []);

  const tap = useCallback((idx: number) => {
    if (phase !== 'playing') return;
    const cell = board[idx];
    if (!cell || clearing.has(idx)) return;
    if (selected === null) { setSelected(idx); sfx.click(); return; }
    if (selected === idx) { setSelected(null); return; }
    const a = board[selected];
    const b = cell;
    if (!a) { setSelected(idx); return; }
    const isMatch = a.word.en === b.word.en && a.side !== b.side;
    if (isMatch) {
      const nc = bumpCombo();
      const g = Math.round(50 * (1 + Math.floor(nc / 3) * 0.5) + (nc >= 2 ? nc * 5 : 0));
      setScore((s) => s + g);
      setCleared((c) => c + 1);
      setFloatGain({ idx, val: g, key: Date.now() });
      sfx.correct(nc, nc % 5 === 0);
      onCorrect?.(a.word);
      const pair = new Set([selected, idx]);
      setClearing((prev) => new Set([...prev, ...pair]));
      setSelected(null);
      // 지움 애니 후 중력+리필
      setTimeout(() => {
        if (!mounted.current) return;
        setBoard((cur) => {
          const nb = cur.slice();
          pair.forEach((p) => { nb[p] = null; });
          return settle(nb);
        });
        setClearing((prev) => { const n = new Set(prev); pair.forEach((p) => n.delete(p)); return n; });
      }, 260);
    } else {
      comboRef.current = 0; setCombo(0);
      setBadPair([selected, idx]);
      sfx.wrong();
      onWrong?.(a.word);
      setSelected(null);
      setTimeout(() => mounted.current && setBadPair(null), 360);
    }
  }, [phase, board, selected, clearing, sfx, bumpCombo, settle, onCorrect, onWrong]);

  const handleExit = useCallback(() => { cancelAnimationFrame(rafRef.current); onExit?.(); }, [onExit]);

  const secs = Math.ceil(timeLeft / 1000);
  const lowTime = secs <= 10;

  return (
    <div className="gk-root cs-root">
      <GameKitStyles />
      <style dangerouslySetInnerHTML={{ __html: CS_CSS }} />
      <Hud
        score={shownScore}
        combo={combo}
        extra={<div className={`cs-timer ${lowTime ? 'cs-timer--low' : ''}`}><span className="gk-stat-label">시간</span><span className="cs-timer-val">{secs}s</span></div>}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
      />

      {phase === 'done' ? (
        <GameDone
          stats={[
            { num: score.toLocaleString(), label: '점수', accent: true },
            { num: cleared, label: '지운 짝' },
            { num: `🔥 ${bestCombo}`, label: '최고 콤보' },
          ]}
          onRestart={newGame}
          onExit={handleExit}
        />
      ) : (
        <main className="gk-stage cs-stage">
          <p className="cs-help" aria-hidden="true">단어와 뜻을 이어 짝을 지우세요 · 빠른 연속 = 콤보</p>
          <div className="cs-board" role="grid" aria-label="매칭 보드">
            {board.map((cell, i) => {
              if (!cell) return <div key={`e${i}`} className="cs-cell cs-cell--empty" />;
              const isSel = selected === i;
              const isBad = badPair?.includes(i);
              const isClearing = clearing.has(i);
              return (
                <button
                  key={cell.id}
                  type="button"
                  role="gridcell"
                  className={`cs-cell cs-tile cs-tile--${cell.side} ${isSel ? 'cs-tile--sel' : ''} ${isBad ? 'cs-tile--bad' : ''} ${isClearing ? 'cs-tile--clear' : ''} ${cell.fresh ? 'cs-tile--fresh' : ''}`}
                  onClick={() => tap(i)}
                  disabled={isClearing}
                  aria-label={`${cell.side === 'en' ? '단어' : '뜻'} ${cell.side === 'en' ? cell.word.en : cell.word.ko}`}
                >
                  <span className="cs-tile-text">{cell.side === 'en' ? cell.word.en : cell.word.ko}</span>
                  {isClearing && <ParticleBurst intensity={1 + clamp(Math.floor(combo / 5), 0, 2)} />}
                  {floatGain && floatGain.idx === i && (
                    <span key={floatGain.key} className="cs-gain" aria-hidden="true">+{floatGain.val}</span>
                  )}
                </button>
              );
            })}
          </div>
        </main>
      )}
    </div>
  );
}

const CS_CSS = `
  .cs-timer { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.05; }
  .cs-timer-val { font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--t1); }
  .cs-timer--low .cs-timer-val { color: var(--error); animation: gk-pop .5s ease-in-out infinite; }
  .cs-stage { gap: 16px; }
  .cs-help { font-size: 13px; color: var(--t3); margin: 0; text-align: center; }
  .cs-board { display: grid; grid-template-columns: repeat(4, 1fr); gap: clamp(8px, 1.6vw, 12px); width: min(540px, 92vw, calc(100vh - 168px)); }
  .cs-cell { aspect-ratio: 1 / 1; border-radius: var(--r-md, 10px); }
  .cs-cell--empty { background: transparent; }
  .cs-tile { position: relative; overflow: visible; display: grid; place-items: center; padding: 6px; border: 1.5px solid var(--bd); background: var(--bg); color: var(--t1); font-weight: 700; cursor: pointer; text-align: center; transition: transform .12s var(--ease, ease-out), border-color .15s, background .15s, box-shadow .15s, opacity .2s; }
  .cs-tile-text { font-size: clamp(11px, 2.4vw, 15px); line-height: 1.15; word-break: keep-all; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
  .cs-tile--en { font-family: var(--font-english, system-ui); color: var(--combo); }
  .cs-tile--ko { color: var(--t1); }
  .cs-tile:hover:not(:disabled) { transform: translateY(-2px); border-color: var(--combo); box-shadow: 0 6px 16px color-mix(in srgb, var(--combo) 16%, transparent); }
  .cs-tile:active:not(:disabled) { transform: scale(.95); }
  .cs-tile:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  .cs-tile--sel { border-color: var(--combo); border-width: 2.5px; background: color-mix(in srgb, var(--combo) 12%, var(--bg)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 25%, transparent); transform: scale(1.03); }
  .cs-tile--bad { border-color: var(--error); background: var(--error-light); animation: gk-shake .34s ease-in-out; }
  .cs-tile--clear { border-color: var(--success); background: var(--success-light); animation: cs-clear .26s ease-out forwards; z-index: 2; }
  .cs-tile--fresh { animation: cs-drop .3s var(--ease, cubic-bezier(.2,.8,.3,1)); }
  @keyframes cs-clear { 0% { transform: scale(1); } 40% { transform: scale(1.12); } 100% { transform: scale(0); opacity: 0; } }
  @keyframes cs-drop { 0% { transform: translateY(-30%); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
  .cs-gain { position: absolute; top: -4px; right: 2px; font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 900; color: var(--success); animation: gk-gain .7s ease-out forwards; z-index: 3; }
  @media (prefers-reduced-motion: reduce) { .cs-tile--fresh, .cs-tile--clear, .cs-tile--bad, .cs-timer--low .cs-timer-val { animation: none; } }
`;
