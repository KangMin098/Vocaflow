// apps/web/src/components/game/ghost-race/GhostRaceGame.tsx
// Ghost Race — 비동기 속도 레이스 + 리그(Kahoot 경쟁 × Duolingo 리그 · Calm 비동기 버전).
// ko→en 정답으로 내 러너(🏃)를 전진, 유령(👻=이전 최고기록/봇)과 트랙 경주. 리그 티어(localStorage).

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles, AmbientBackground, Hud, GameDone, ParticleBurst, useSfx, shuffle, pickDistinct, clamp, type Word,
  GameMusic,
} from '@/components/game/_shared/gamekit';

interface Props { wordPool?: Word[]; onExit?: () => void; onCorrect?: (w: Word) => void; onWrong?: (w: Word) => void; }

const DEFAULT_POOL: Word[] = [
  { en: 'advantage', ko: '이점' }, { en: 'reserved', ko: '내성적인' }, { en: 'inclined', ko: '경향이 있는' },
  { en: 'consequence', ko: '결과' }, { en: 'judgment', ko: '판단' }, { en: 'ability', ko: '능력' },
  { en: 'balance', ko: '균형' }, { en: 'courage', ko: '용기' }, { en: 'develop', ko: '발전시키다' },
  { en: 'reduce', ko: '줄이다' }, { en: 'sudden', ko: '갑작스러운' }, { en: 'honest', ko: '정직한' },
];

const N = 12;
const DEFAULT_GHOST_MS = 27000;
// 유령 = 자기 최고기록. 하한이 없으면 승급할수록 유령이 무한히 빨라져 리그가 막힘 → 하한.
const GHOST_FLOOR_MS = 12000;
const STORE_KEY = 'vf_ghostrace_v1';

interface Store { wins: number; bestMs: number | null; }
type Phase = 'racing' | 'result';

const TIERS = [
  { min: 0, name: '브론즈', color: '#B06C3A' },
  { min: 3, name: '실버', color: '#8A94A6' },
  { min: 7, name: '골드', color: '#C79A2E' },
  { min: 15, name: '플래티넘', color: '#3FA9B8' },
];
const tierOf = (wins: number) => TIERS.slice().reverse().find((t) => wins >= t.min)!;

export function GhostRaceGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const pool = useMemo(() => {
    const p = wordPool && wordPool.length > 0 ? wordPool : DEFAULT_POOL;
    const seen = new Set<string>();
    return p.filter((w) => (seen.has(w.en) ? false : (seen.add(w.en), true)));
  }, [wordPool]);
  const tileCount = Math.min(4, Math.max(2, pool.length));
  const sfx = useSfx();

  const [store, setStore] = useState<Store>({ wins: 0, bestMs: null });
  const ghostMs = store.bestMs ?? DEFAULT_GHOST_MS;

  const [phase, setPhase] = useState<Phase>('racing');
  const [qi, setQi] = useState(0);
  const [youPos, setYouPos] = useState(0);
  const [ghostPos, setGhostPos] = useState(0);
  const [options, setOptions] = useState<Word[]>([]);
  const [target, setTarget] = useState<Word | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [announce, setAnnounce] = useState('');
  const [reveal, setReveal] = useState(false);
  const [combo, setCombo] = useState(0);
  const [won, setWon] = useState(false);
  const [raceMs, setRaceMs] = useState(0);
  const [stumble, setStumble] = useState(false);

  const comboRef = useRef(0);
  const youRef = useRef(0);
  const ghostRef = useRef(0);
  const startRef = useRef(0);
  const ghostTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  const endedRef = useRef(false);

  useEffect(() => {
    mounted.current = true;
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORE_KEY) : null;
      if (raw) setStore(JSON.parse(raw));
    } catch { /* noop */ }
    return () => { mounted.current = false; if (ghostTimer.current) clearInterval(ghostTimer.current); };
  }, []);

  const nextQ = useCallback((idx: number) => {
    const t = pool[(idx + Math.floor(Math.random() * pool.length)) % pool.length];
    const distract = pickDistinct(pool, tileCount - 1, (w) => w.en === t.en);
    setTarget(t); setOptions(shuffle([t, ...distract]));
    setPicked(null); setReveal(false); lock.current = false;
  }, [pool, tileCount]);

  const endRace = useCallback((youWon: boolean) => {
    if (endedRef.current) return; endedRef.current = true;
    if (ghostTimer.current) { clearInterval(ghostTimer.current); ghostTimer.current = null; }
    const ms = Date.now() - startRef.current;
    setRaceMs(ms); setWon(youWon); setPhase('result');
    if (youWon) sfx.fanfare(); else sfx.wrong();
    setStore((prev) => {
      const wins = prev.wins + (youWon ? 1 : 0);
      const bestMs = youWon ? Math.max(GHOST_FLOOR_MS, Math.min(prev.bestMs ?? Infinity, ms)) : prev.bestMs;
      const ns = { wins, bestMs: bestMs === Infinity ? ms : bestMs };
      try { window.localStorage.setItem(STORE_KEY, JSON.stringify(ns)); } catch { /* noop */ }
      return ns;
    });
  }, [sfx]);

  const startRace = useCallback(() => {
    endedRef.current = false;
    youRef.current = 0; ghostRef.current = 0; comboRef.current = 0;
    setYouPos(0); setGhostPos(0); setCombo(0); setQi(0); setWon(false); setRaceMs(0);
    setPhase('racing');
    startRef.current = Date.now();
    nextQ(0);
    const step = ghostMs / N;
    if (ghostTimer.current) clearInterval(ghostTimer.current);
    ghostTimer.current = setInterval(() => {
      if (!mounted.current) return;
      ghostRef.current += 1; setGhostPos(ghostRef.current);
      if (ghostRef.current >= N) endRace(youRef.current >= N);
    }, step);
  }, [ghostMs, nextQ, endRace]);

  useEffect(() => { startRace(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answer = useCallback((i: number) => {
    if (phase !== 'racing' || !target || lock.current) return;
    lock.current = true;
    const ok = options[i].en === target.en;
    setPicked(i); setReveal(true);
    if (ok) {
      const nc = comboRef.current + 1; comboRef.current = nc; setCombo(nc);
      youRef.current += 1; setYouPos(youRef.current);
      sfx.correct(nc, nc % 5 === 0);
      onCorrect?.(target);
      setAnnounce(`정답 ${target.en}`);
      if (youRef.current >= N) { endRace(true); return; }
      setTimeout(() => { if (mounted.current && !endedRef.current) { setQi((n) => n + 1); nextQ(youRef.current); } }, 260);
    } else {
      comboRef.current = 0; setCombo(0);
      setStumble(true); sfx.wrong(); onWrong?.(target);
      setAnnounce(`틀렸어요, 정답은 ${target.en}`);
      setTimeout(() => mounted.current && setStumble(false), 500);
      setTimeout(() => { if (mounted.current && !endedRef.current) { setQi((n) => n + 1); nextQ(youRef.current); } }, 650);
    }
  }, [phase, target, options, sfx, nextQ, endRace, onCorrect, onWrong]);

  const handleExit = useCallback(() => { if (ghostTimer.current) clearInterval(ghostTimer.current); onExit?.(); }, [onExit]);

  const tier = tierOf(store.wins);
  const comboTier = clamp(Math.floor(combo / 5), 0, 3);
  const youPct = (youPos / N) * 100;
  const ghostPct = (ghostPos / N) * 100;

  return (
    <div className="gk-root gr-root">

          <GameMusic gameId="ghost-race" />
      <div className="gk-sr" aria-live="assertive">{announce}</div>
      <GameKitStyles />
      <AmbientBackground center="#F4EBF6" mid="#DEC8E7" edge="#4E3277" glow="rgba(255,120,205,.36)" glowAt="50% 15%" watermark="ghost-race" />
      <style dangerouslySetInnerHTML={{ __html: GR_CSS }} />
      <Hud
        combo={combo}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={<div className="gr-league" style={{ color: tier.color }}><span className="gk-stat-label">리그</span><span className="gr-tier">{tier.name} · {store.wins}승</span></div>}
      />

      {/* 트랙 */}
      <div className="gr-track" aria-hidden="true">
        <div className="gr-lane">
          <span className="gr-runner gr-you" style={{ left: `calc(${youPct}% - 14px)` }} data-stumble={stumble}>🏃</span>
          <span className="gr-flag" style={{ left: '100%' }}>🏁</span>
          <div className="gr-line" style={{ width: `${youPct}%`, background: 'var(--combo)' }} />
        </div>
        <div className="gr-lane gr-lane--ghost">
          <span className="gr-runner gr-ghost" style={{ left: `calc(${ghostPct}% - 14px)` }}>👻</span>
          <div className="gr-line" style={{ width: `${ghostPct}%`, background: 'var(--t4)' }} />
        </div>
      </div>

      {phase === 'result' ? (
        <GameDone
          mark="ghost-race"
          lead={won ? '유령을 이겼어요!' : '아쉽게 졌어요'}
          stats={[
            { num: `${youPos}/${N}`, label: '내 진행', accent: true },
            { num: `${(raceMs / 1000).toFixed(1)}s`, label: won ? '기록(신기록 반영)' : '기록' },
            { num: `${tier.name}`, label: `${store.wins}승` },
          ]}
          restartLabel="다시 레이스"
          onRestart={startRace}
          onExit={handleExit}
        />
      ) : target ? (
        <main className="gk-stage gr-stage">
          <span className="gr-vs">🏃 {youPos} <span className="gr-vs-mid">vs</span> {ghostPos} 👻</span>
          <h1 className="gr-meaning" key={qi}>{target.ko}</h1>
          <div className={`gr-tiles ${options.length <= 2 ? 'gr-tiles--two' : ''}`}>
            {options.map((o, i) => {
              const isAns = o.en === target.en; const isPick = picked === i;
              let tone = ''; if (reveal) tone = isAns ? 'gk-tile--correct' : isPick ? 'gk-tile--wrong' : 'gk-tile--dim';
              return (
                <button key={`${qi}-${o.en}`} type="button" className={`gk-tile gr-tile ${tone}`} disabled={reveal} onClick={() => answer(i)}>
                  {o.en}{reveal && isAns && <ParticleBurst intensity={1 + comboTier} />}
                </button>
              );
            })}
          </div>
          <p className="gr-hint" aria-hidden="true">빠르게 맞혀 유령보다 먼저 결승선에!</p>
        </main>
      ) : null}
    </div>
  );
}

const GR_CSS = `
  .gr-league { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.05; }
  .gr-tier { font-family: var(--font-display, system-ui); font-size: 14px; font-weight: 800; }
  .gr-track { padding: 12px 20px 10px; display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid rgba(255,255,255,.35); }
  .gr-lane { position: relative; height: 30px; border-radius: 999px; background: rgba(255,255,255,.55); box-shadow: inset 0 2px 6px rgba(60,26,86,.22), 0 1px 0 rgba(255,255,255,.5); backdrop-filter: blur(2px); }
  .gr-lane--ghost { height: 24px; opacity: .85; }
  .gr-line { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; transition: width .35s var(--ease, cubic-bezier(.3,.7,.3,1)); }
  .gr-runner { position: absolute; top: 50%; transform: translateY(-50%); font-size: 20px; transition: left .35s var(--ease, cubic-bezier(.3,.7,.3,1)); z-index: 2; }
  .gr-you[data-stumble="true"] { animation: gk-shake .4s ease-in-out; }
  .gr-flag { position: absolute; top: 50%; transform: translate(-100%,-50%); font-size: 18px; }
  .gr-stage { gap: clamp(14px, 3vh, 30px); }
  .gr-vs { font-family: var(--font-display, system-ui); font-size: 15px; font-weight: 800; color: var(--t2); }
  .gr-vs-mid { color: var(--t4); font-size: 12px; margin: 0 4px; }
  .gr-meaning { margin: 0; font-family: var(--font-display, system-ui); font-size: clamp(28px, 6vw, 46px); font-weight: 800; word-break: keep-all; animation: gk-pop .3s ease-out; }
  .gr-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: min(520px, 92vw); }
  .gr-tiles--two { grid-template-columns: 1fr; max-width: 400px; }
  .gr-tile { justify-content: center; min-height: 66px; font-size: clamp(16px, 3.4vw, 22px); }
  .gr-hint { font-size: 12px; color: var(--t3); margin: 0; text-align: center; }
  @media (prefers-reduced-motion: reduce) { .gr-meaning, .gr-you[data-stumble="true"] { animation: none; } .gr-line, .gr-runner { transition: none; } }
`;
