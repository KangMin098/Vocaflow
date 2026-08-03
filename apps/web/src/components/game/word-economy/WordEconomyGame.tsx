// apps/web/src/components/game/word-economy/WordEconomyGame.tsx
// Word Economy — 경제·전략(Gimkit × 어휘). ko→en 정답으로 코인 획득, 파워업에 전략 재투자.
// 75초 세션, 수익배율·콤보보너스·시간연장·50:50. 최종 잔고 = 점수(투자 타이밍이 실력).

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles, AmbientBackground, Hud, GameDone, ParticleBurst, useSfx, useCountUp, shuffle, pickDistinct, clamp, type Word,
  GameMusic,
} from '@/components/game/_shared/gamekit';

interface Props { wordPool?: Word[]; onExit?: () => void; onCorrect?: (w: Word) => void; onWrong?: (w: Word) => void; }

const DEFAULT_POOL: Word[] = [
  { en: 'advantage', ko: '이점' }, { en: 'reserved', ko: '내성적인' }, { en: 'inclined', ko: '경향이 있는' },
  { en: 'consequence', ko: '결과, 영향' }, { en: 'judgment', ko: '판단' }, { en: 'mistake', ko: '실수' },
  { en: 'ability', ko: '능력' }, { en: 'balance', ko: '균형' }, { en: 'courage', ko: '용기' },
  { en: 'develop', ko: '발전시키다' }, { en: 'reduce', ko: '줄이다' }, { en: 'sudden', ko: '갑작스러운' },
];

const SESSION_MS = 75000;

interface Q { key: number; target: Word; options: Word[]; }
interface Upgrade { id: string; label: string; icon: string; desc: (lvl: number) => string; baseCost: number; growth: number; max: number; }

const UPGRADES: Upgrade[] = [
  { id: 'mult', label: '수익 배율', icon: '💰', desc: (l) => `정답당 ×${(1 + l * 0.5).toFixed(1)}`, baseCost: 100, growth: 1.75, max: 6 },
  { id: 'streak', label: '콤보 보너스', icon: '🔥', desc: (l) => `콤보당 +${l * 8}%`, baseCost: 80, growth: 1.7, max: 6 },
  { id: 'time', label: '시간 +8초', icon: '⏱', desc: () => '세션 연장', baseCost: 130, growth: 1.5, max: 99 },
];

export function WordEconomyGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const pool = useMemo(() => {
    const p = wordPool && wordPool.length > 0 ? wordPool : DEFAULT_POOL;
    const seen = new Set<string>();
    return p.filter((w) => (seen.has(w.en) ? false : (seen.add(w.en), true)));
  }, [wordPool]);
  const tileCount = Math.min(4, Math.max(2, pool.length));
  const sfx = useSfx();

  const [coins, setCoins] = useState(0);
  const [earned, setEarned] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [levels, setLevels] = useState<Record<string, number>>({ mult: 0, streak: 0, time: 0 });
  const [fiftyUsed, setFiftyUsed] = useState(false);
  const [hidden, setHidden] = useState<number[]>([]);
  const [q, setQ] = useState<Q | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [reveal, setReveal] = useState(false);
  const [lastGain, setLastGain] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SESSION_MS);
  const [phase, setPhase] = useState<'playing' | 'done'>('playing');
  const [flash, setFlash] = useState('');

  const shownCoins = useCountUp(coins);
  const comboRef = useRef(0);
  const levelsRef = useRef(levels); levelsRef.current = levels;
  const endRef = useRef(0);
  const rafRef = useRef(0);
  const keyRef = useRef(0);
  const qStart = useRef(0);
  const mounted = useRef(true);
  const answerLock = useRef(false);

  const nextQ = useCallback(() => {
    const target = pool[Math.floor(Math.random() * pool.length)];
    // 같은 뜻(ko)의 동의어를 distractor 로 쓰면 정답인데 오답 처리되므로 제외.
    const distract = pickDistinct(pool, tileCount - 1, (w) => w.en === target.en || w.ko === target.ko);
    keyRef.current += 1;
    setQ({ key: keyRef.current, target, options: shuffle([target, ...distract]) });
    setPicked(null); setReveal(false); setHidden([]); setFiftyUsed(false);
    answerLock.current = false;
    qStart.current = Date.now();
  }, [pool, tileCount]);

  const start = useCallback(() => {
    setCoins(0); setEarned(0); setCombo(0); setBestCombo(0); setAnswered(0);
    setLevels({ mult: 0, streak: 0, time: 0 }); comboRef.current = 0;
    setPhase('playing'); setTimeLeft(SESSION_MS);
    endRef.current = Date.now() + SESSION_MS;
    nextQ();
  }, [nextQ]);

  useEffect(() => { mounted.current = true; start(); return () => { mounted.current = false; cancelAnimationFrame(rafRef.current); }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const answer = useCallback((i: number) => {
    if (phase !== 'playing' || !q || answerLock.current) return;
    answerLock.current = true;
    const chosen = q.options[i];
    const ok = chosen.en === q.target.en;
    setPicked(i); setReveal(true);
    if (ok) {
      const nc = comboRef.current + 1; comboRef.current = nc;
      const lv = levelsRef.current;
      const mult = 1 + lv.mult * 0.5;
      const streakBonus = 1 + nc * (lv.streak * 0.08);
      const speed = Math.max(0, 1 - (Date.now() - qStart.current) / 5000);
      const gain = Math.round((10 + Math.round(speed * 8)) * mult * streakBonus);
      setLastGain(gain);
      setCoins((c) => c + gain); setEarned((e) => e + gain);
      setCombo(nc); setBestCombo((b) => Math.max(b, nc)); setAnswered((a) => a + 1);
      sfx.coin();
      onCorrect?.(q.target);
    } else {
      comboRef.current = 0; setCombo(0); setLastGain(0);
      sfx.wrong();
      onWrong?.(q.target);
    }
    setTimeout(() => { if (mounted.current && phase === 'playing') nextQ(); }, ok ? 450 : 750);
  }, [phase, q, sfx, nextQ, onCorrect, onWrong]);

  const cost = useCallback((u: Upgrade, lvl: number) => Math.round(u.baseCost * Math.pow(u.growth, lvl)), []);

  const buy = useCallback((u: Upgrade) => {
    const lvl = levelsRef.current[u.id];
    if (lvl >= u.max) return;
    const c = cost(u, lvl);
    if (coins < c) { setFlash('코인이 부족해요'); setTimeout(() => mounted.current && setFlash(''), 900); return; }
    setCoins((x) => x - c);
    setLevels((L) => ({ ...L, [u.id]: L[u.id] + 1 }));
    if (u.id === 'time') { endRef.current += 8000; }
    sfx.click();
    setFlash(`${u.label} 강화!`); setTimeout(() => mounted.current && setFlash(''), 900);
  }, [coins, cost, sfx]);

  const buyFifty = useCallback(() => {
    if (!q || fiftyUsed || reveal) return;
    if (coins < 40) { setFlash('코인이 부족해요'); setTimeout(() => mounted.current && setFlash(''), 900); return; }
    const wrongIdx = q.options.map((o, i) => (o.en === q.target.en ? -1 : i)).filter((i) => i >= 0);
    const toHide = shuffle(wrongIdx).slice(0, Math.max(1, q.options.length - 2));
    setHidden(toHide); setFiftyUsed(true); setCoins((c) => c - 40); sfx.click();
  }, [q, fiftyUsed, reveal, coins, sfx]);

  const handleExit = useCallback(() => { cancelAnimationFrame(rafRef.current); onExit?.(); }, [onExit]);
  const secs = Math.ceil(timeLeft / 1000);
  const comboTier = clamp(Math.floor(combo / 5), 0, 3);

  return (
    <div className="gk-root we-root">

          <GameMusic gameId="word-economy" />
      <GameKitStyles />
      <AmbientBackground center="#FBF2DE" mid="#EAD39F" edge="#6C481D" glow="rgba(255,206,112,.34)" glowAt="50% 24%" watermark="word-economy" />
      <style dangerouslySetInnerHTML={{ __html: WE_CSS }} />
      <Hud
        combo={combo}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={
          <div className="we-hud-extra">
            <div className="we-coins"><span className="we-coin-icon" aria-hidden>🪙</span><span key={coins} className="we-coin-val gk-bump">{shownCoins.toLocaleString()}</span></div>
            <div className={`we-timer ${secs <= 10 ? 'we-timer--low' : ''}`}><span className="gk-stat-label">시간</span><span className="we-timer-val">{secs}s</span></div>
          </div>
        }
      />
      <div className="gk-sr" aria-live="polite">{flash}</div>

      {phase === 'done' ? (
        <GameDone
          mark="word-economy"
          lead="장사 잘했어요"
          stats={[
            { num: `🪙 ${coins.toLocaleString()}`, label: '최종 잔고', accent: true },
            { num: earned.toLocaleString(), label: '총 획득' },
            { num: answered, label: '정답' },
            { num: `🔥 ${bestCombo}`, label: '최고 콤보' },
          ]}
          onRestart={start}
          onExit={handleExit}
        />
      ) : q ? (
        <main className="gk-stage we-stage">
          {flash && <div className="we-flash" aria-hidden="true">{flash}</div>}
          <div className="we-prompt">
            <span className="we-label">이 뜻의 단어를 골라 코인 획득</span>
            <h1 className="we-meaning" key={q.key}>{q.target.ko}</h1>
          </div>
          <div className={`we-tiles ${q.options.length <= 2 ? 'we-tiles--two' : ''}`}>
            {q.options.map((o, i) => {
              const isAns = o.en === q.target.en;
              const isPick = picked === i;
              const isHidden = hidden.includes(i);
              let tone = '';
              if (reveal) { if (isAns) tone = 'gk-tile--correct'; else if (isPick) tone = 'gk-tile--wrong'; else tone = 'gk-tile--dim'; }
              return (
                <button key={`${q.key}-${o.en}`} type="button" className={`gk-tile we-tile ${tone} ${isHidden ? 'we-tile--hidden' : ''}`} disabled={reveal || isHidden} onClick={() => answer(i)}>
                  <span>{o.en}</span>
                  {reveal && isAns && lastGain > 0 && <span className="we-gain" aria-hidden>+{lastGain}🪙<ParticleBurst intensity={1 + comboTier} /></span>}
                </button>
              );
            })}
          </div>

          {/* 상점 */}
          <div className="we-shop" role="group" aria-label="파워업 상점">
            {UPGRADES.map((u) => {
              const lvl = levels[u.id]; const c = cost(u, lvl); const maxed = lvl >= u.max; const afford = coins >= c;
              return (
                <button key={u.id} type="button" className={`we-item ${afford && !maxed ? '' : 'we-item--dim'}`} onClick={() => buy(u)} disabled={maxed || !afford}>
                  <span className="we-item-top"><span className="we-item-icon">{u.icon}</span><span className="we-item-lvl">Lv.{lvl}</span></span>
                  <span className="we-item-label">{u.label}</span>
                  <span className="we-item-desc">{u.desc(lvl)}</span>
                  <span className="we-item-cost">{maxed ? 'MAX' : `🪙 ${c}`}</span>
                </button>
              );
            })}
            <button type="button" className={`we-item we-fifty ${!fiftyUsed && coins >= 40 && !reveal ? '' : 'we-item--dim'}`} onClick={buyFifty} disabled={fiftyUsed || reveal || coins < 40}>
              <span className="we-item-top"><span className="we-item-icon">✂️</span></span>
              <span className="we-item-label">50 : 50</span>
              <span className="we-item-desc">오답 2개 제거</span>
              <span className="we-item-cost">{fiftyUsed ? '사용함' : '🪙 40'}</span>
            </button>
          </div>
        </main>
      ) : null}
    </div>
  );
}

const WE_CSS = `
  .we-hud-extra { display: flex; align-items: center; gap: 14px; }
  .we-coins { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.05; }
  .we-coin-val { font-size: 20px; font-weight: 800; color: var(--active); font-variant-numeric: tabular-nums; }
  .we-coin-icon { font-size: 10px; }
  .we-timer { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.05; }
  .we-timer-val { font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .we-timer--low .we-timer-val { color: var(--error); }
  .we-stage { gap: clamp(14px, 3vh, 28px); justify-content: center; position: relative; }
  .we-flash { position: absolute; top: 4px; left: 50%; transform: translateX(-50%); background: var(--t1); color: var(--bg); font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 999px; animation: gk-pop .3s ease-out; z-index: 5; }
  .we-prompt { text-align: center; display: flex; flex-direction: column; gap: 10px; align-items: center; }
  .we-label { font-size: 12px; font-weight: 700; letter-spacing: .1em; color: var(--t3); text-transform: uppercase; }
  .we-meaning { margin: 0; font-family: var(--font-display, system-ui); font-size: clamp(26px, 5.4vw, 42px); font-weight: 800; word-break: keep-all; animation: gk-pop .3s ease-out; }
  .we-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: min(560px, 92vw); }
  .we-tiles--two { grid-template-columns: 1fr; max-width: 400px; }
  .we-tile { justify-content: center; min-height: 66px; font-size: clamp(16px, 3.4vw, 22px); }
  .we-tile--hidden { opacity: .15; pointer-events: none; }
  .we-gain { position: absolute; top: 4px; right: 10px; font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 900; color: var(--active); }
  .we-shop { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; width: min(620px, 94vw); margin-top: 4px; }
  .we-item { display: flex; flex-direction: column; gap: 2px; padding: 10px; border-radius: var(--r-md, 10px); border: 1.5px solid var(--bd); background: var(--bg); color: var(--t1); cursor: pointer; text-align: left; transition: transform .1s, border-color .15s, box-shadow .15s; }
  .we-item:hover:not(:disabled) { border-color: var(--active); transform: translateY(-2px); box-shadow: 0 6px 16px color-mix(in srgb, var(--active) 18%, transparent); }
  .we-item:active:not(:disabled) { transform: scale(.96); }
  .we-item--dim { opacity: .5; cursor: default; }
  .we-item-top { display: flex; align-items: center; justify-content: space-between; }
  .we-item-icon { font-size: 18px; }
  .we-item-lvl { font-family: var(--font-display, system-ui); font-size: 10px; font-weight: 800; color: var(--t3); }
  .we-item-label { font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 800; }
  .we-item-desc { font-size: 11px; color: var(--t3); }
  .we-item-cost { font-family: var(--font-display, system-ui); font-size: 12px; font-weight: 800; color: var(--active); margin-top: 2px; }
  @media (max-width: 560px) { .we-shop { grid-template-columns: repeat(2, 1fr); } }
  @media (prefers-reduced-motion: reduce) { .we-meaning, .we-flash { animation: none; } }
`;
