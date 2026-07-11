// apps/web/src/components/game/daily-blitz/DailyBlitzGame.tsx
// Daily Blitz — 데일리 의식(Wordle × 스트릭). 날짜 시드로 매일 같은 10단어 ko→en 챌린지.
// 완료 시 이모지 결과 공유 + 스트릭(localStorage, 손실 회피). 리텐션 레이어.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles, AmbientBackground, ParticleBurst, useSfx, shuffle, pickDistinct, type Word,
} from '@/components/game/_shared/gamekit';

interface Props { onExit?: () => void; onCorrect?: (w: Word) => void; onWrong?: (w: Word) => void; }

// 데일리 뱅크(스코프 무관 — 매일 같은 세트 보장). 학습자 빈출 어휘.
const BANK: Word[] = [
  { en: 'advantage', ko: '이점' }, { en: 'reserved', ko: '내성적인' }, { en: 'inclined', ko: '경향이 있는' },
  { en: 'consequence', ko: '결과' }, { en: 'judgment', ko: '판단' }, { en: 'ability', ko: '능력' },
  { en: 'balance', ko: '균형' }, { en: 'courage', ko: '용기' }, { en: 'develop', ko: '발전시키다' },
  { en: 'reduce', ko: '줄이다' }, { en: 'sudden', ko: '갑작스러운' }, { en: 'honest', ko: '정직한' },
  { en: 'generous', ko: '관대한' }, { en: 'stubborn', ko: '고집센' }, { en: 'massive', ko: '거대한' },
  { en: 'budget', ko: '예산' }, { en: 'profit', ko: '이익' }, { en: 'debt', ko: '빚' },
  { en: 'flood', ko: '홍수' }, { en: 'ancient', ko: '고대의' }, { en: 'fragile', ko: '연약한' },
  { en: 'genuine', ko: '진짜의' }, { en: 'hostile', ko: '적대적인' }, { en: 'obvious', ko: '분명한' },
  { en: 'reveal', ko: '드러내다' }, { en: 'seek', ko: '찾다' }, { en: 'vivid', ko: '생생한' },
  { en: 'wander', ko: '거닐다' }, { en: 'yield', ko: '양보하다' }, { en: 'grasp', ko: '움켜쥐다' },
];

const DAILY_N = 10;
const PER_MS = 6000;
const STORE_KEY = 'vf_dailyblitz_v1';

type Phase = 'intro' | 'playing' | 'result';
interface Store { lastDate: string; streak: number; today?: { date: string; grid: string; correct: number }; }

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function dateKey(d: Date) { return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; }
function dayNumber(d: Date) { return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000); }
function isYesterday(prev: string, today: string) {
  const p = new Date(+prev.slice(0, 4), +prev.slice(4, 6) - 1, +prev.slice(6, 8));
  const t = new Date(+today.slice(0, 4), +today.slice(4, 6) - 1, +today.slice(6, 8));
  return Math.round((t.getTime() - p.getTime()) / 86400000) === 1;
}

export function DailyBlitzGame({ onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();
  const today = useMemo(() => (typeof window === 'undefined' ? new Date(0) : new Date()), []);
  const tKey = dateKey(today);
  const dayNo = dayNumber(today) % 100000;

  const dailySet = useMemo(() => {
    const rnd = mulberry32(dayNumber(today));
    return seededShuffle(BANK, rnd).slice(0, DAILY_N);
  }, [today]);

  const [store, setStore] = useState<Store | null>(null);
  const alreadyDone = store?.today?.date === tKey;

  const [phase, setPhase] = useState<Phase>('intro');
  const [practice, setPractice] = useState(false);
  const [qi, setQi] = useState(0);
  const [options, setOptions] = useState<Word[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [reveal, setReveal] = useState(false);
  const [results, setResults] = useState<('fast' | 'ok' | 'miss')[]>([]);
  const [copied, setCopied] = useState(false);
  const qStart = useRef(0);
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORE_KEY) : null;
      const s: Store = raw ? JSON.parse(raw) : { lastDate: '', streak: 0 };
      // 스트릭 만료 체크(어제도 오늘도 아니면 0)
      if (s.lastDate && s.lastDate !== tKey && !isYesterday(s.lastDate, tKey)) s.streak = 0;
      setStore(s);
    } catch { setStore({ lastDate: '', streak: 0 }); }
    return () => { mounted.current = false; if (qTimer.current) clearTimeout(qTimer.current); };
  }, [tKey]);

  const buildOptions = useCallback((idx: number) => {
    const target = dailySet[idx];
    const distract = pickDistinct(BANK, 3, (w) => w.en === target.en);
    setOptions(shuffle([target, ...distract]));
    setPicked(null); setReveal(false); lock.current = false;
    qStart.current = Date.now();
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => answer(-1), PER_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailySet]);

  const startChallenge = useCallback((prac: boolean) => {
    setPractice(prac); setPhase('playing'); setQi(0); setResults([]);
    buildOptions(0);
  }, [buildOptions]);

  const answer = useCallback((i: number) => {
    if (lock.current) return; lock.current = true;
    if (qTimer.current) { clearTimeout(qTimer.current); qTimer.current = null; }
    const target = dailySet[qi];
    const chosen = i >= 0 ? options[i] : null;
    const ok = !!chosen && chosen.en === target.en;
    const fast = ok && Date.now() - qStart.current < PER_MS * 0.45;
    setPicked(i); setReveal(true);
    setResults((r) => [...r, ok ? (fast ? 'fast' : 'ok') : 'miss']);
    if (ok) { sfx.correct(0, false); onCorrect?.(target); } else { sfx.wrong(); onWrong?.(target); }
    setTimeout(() => {
      if (!mounted.current) return;
      if (qi + 1 >= DAILY_N) finish([...results, ok ? (fast ? 'fast' : 'ok') : 'miss']);
      else { setQi((n) => n + 1); buildOptions(qi + 1); }
    }, ok ? 500 : 850);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qi, options, dailySet, results, sfx, buildOptions, onCorrect, onWrong]);

  const finish = useCallback((res: ('fast' | 'ok' | 'miss')[]) => {
    const correct = res.filter((r) => r !== 'miss').length;
    const grid = res.map((r) => (r === 'fast' ? '🟩' : r === 'ok' ? '🟨' : '⬛')).join('');
    setPhase('result');
    sfx.fanfare();
    if (!practice && store && !alreadyDone) {
      const newStreak = store.lastDate === '' ? 1 : isYesterday(store.lastDate, tKey) ? store.streak + 1 : store.lastDate === tKey ? store.streak : 1;
      const ns: Store = { lastDate: tKey, streak: newStreak, today: { date: tKey, grid, correct } };
      setStore(ns);
      try { window.localStorage.setItem(STORE_KEY, JSON.stringify(ns)); } catch { /* noop */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practice, store, alreadyDone, tKey, sfx]);

  const correct = results.filter((r) => r !== 'miss').length;
  const grid = results.map((r) => (r === 'fast' ? '🟩' : r === 'ok' ? '🟨' : '⬛')).join('');
  const streak = store?.streak ?? 0;

  const share = useCallback(() => {
    const text = `Vocaflow Daily Blitz #${dayNo}\n${grid}  ${correct}/${DAILY_N}\n🔥 ${streak}일 연속`;
    const flash = () => { if (mounted.current) { setCopied(true); setTimeout(() => mounted.current && setCopied(false), 1800); } };
    // execCommand 폴백 — insecure/권한거부 컨텍스트(비 HTTPS 등)에서 clipboard 프로미스 rejection 대비
    const legacyCopy = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) flash();
      } catch { /* noop — 조용히 실패 */ }
    };
    // 프로미스 rejection 을 반드시 처리(미처리 시 unhandledrejection). navigator.clipboard 부재/거부 → 폴백
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(flash).catch(legacyCopy);
    } else {
      legacyCopy();
    }
  }, [dayNo, grid, correct, streak]);

  const target = dailySet[qi];

  return (
    <div className="gk-root db-root">
      <GameKitStyles />
      <AmbientBackground center="#FBEFE8" mid="#F2D2C3" edge="#7A3B54" glow="rgba(255,158,120,.34)" glowAt="50% 34%" />
      <style dangerouslySetInnerHTML={{ __html: DB_CSS }} />

      {/* 상단 미니 바 */}
      <header className="db-bar">
        <div className="db-streak"><span aria-hidden>🔥</span> <b>{streak}</b>일 연속</div>
        <div className="db-title">오늘의 챌린지 <span className="db-num">#{dayNo}</span></div>
        <div className="db-bar-right">
          <button type="button" className="gk-icon-btn" aria-label={sfx.muted ? '소리 켜기' : '소리 끄기'} aria-pressed={sfx.muted} onClick={() => sfx.setMuted((m) => !m)}>{sfx.muted ? '🔇' : '🔊'}</button>
          {onExit && <button type="button" className="gk-exit" onClick={onExit}>나가기</button>}
        </div>
      </header>

      {phase === 'intro' && (
        <main className="gk-stage db-intro">
          <div className="db-cal" aria-hidden="true">📅</div>
          <h1 className="db-h1">Daily Blitz</h1>
          <p className="db-lead">매일 새로운 <b>{DAILY_N}단어</b> 챌린지. 오늘 풀고 스트릭을 이어가세요.</p>
          {store && (
            <div className="db-streak-big"><span aria-hidden>🔥</span> <b>{streak}</b>일 연속</div>
          )}
          {alreadyDone ? (
            <>
              <div className="db-done-badge">오늘 완료 · {store?.today?.correct}/{DAILY_N} {store?.today?.grid}</div>
              <div className="db-actions">
                <button type="button" className="gk-btn gk-btn--primary" onClick={() => startChallenge(true)}>연습 모드</button>
                {onExit && <button type="button" className="gk-btn" onClick={onExit}>내일 또 만나요</button>}
              </div>
            </>
          ) : (
            <button type="button" className="gk-btn gk-btn--primary db-start" onClick={() => startChallenge(false)}>오늘의 챌린지 시작</button>
          )}
        </main>
      )}

      {phase === 'playing' && target && (
        <main className="gk-stage db-play">
          <div className="db-progress-row" aria-hidden="true">
            {dailySet.map((_, i) => (
              <span key={i} className={`db-pip ${i < qi ? `db-pip--${results[i]}` : ''} ${i === qi ? 'db-pip--now' : ''}`} />
            ))}
          </div>
          <span className="db-count">{qi + 1} / {DAILY_N}</span>
          <h1 className="db-meaning" key={qi}>{target.ko}</h1>
          <div className="db-tiles">
            {options.map((o, i) => {
              const isAns = o.en === target.en; const isPick = picked === i;
              let tone = ''; if (reveal) { tone = isAns ? 'gk-tile--correct' : isPick ? 'gk-tile--wrong' : 'gk-tile--dim'; }
              return (
                <button key={`${qi}-${o.en}`} type="button" className={`gk-tile db-tile ${tone}`} disabled={reveal} onClick={() => answer(i)}>
                  {o.en}{reveal && isAns && <ParticleBurst intensity={1} />}
                </button>
              );
            })}
          </div>
        </main>
      )}

      {phase === 'result' && (
        <main className="gk-stage db-result">
          <div className="db-burst" aria-hidden="true"><ParticleBurst intensity={3} /></div>
          <p className="db-res-lead">{practice ? '연습 완료' : correct >= 8 ? '멋져요!' : '오늘도 한 걸음'}</p>
          <div className="db-grid" aria-hidden="true">{grid}</div>
          <div className="db-res-stats">
            <div><b>{correct}/{DAILY_N}</b><span>정답</span></div>
            <div><b>🔥 {streak}</b><span>연속</span></div>
          </div>
          {!practice && (
            <button type="button" className="gk-btn gk-btn--primary" onClick={share}>{copied ? '복사됨! ✓' : '결과 공유'}</button>
          )}
          <div className="db-actions">
            {practice ? <button type="button" className="gk-btn" onClick={() => startChallenge(true)}>한 번 더</button> : null}
            {onExit && <button type="button" className="gk-btn" onClick={onExit}>닫기</button>}
          </div>
        </main>
      )}
    </div>
  );
}

const DB_CSS = `
  .db-bar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--bd); }
  .db-streak { font-size: 13px; color: var(--t2); font-weight: 600; }
  .db-streak b { color: var(--streak); font-size: 15px; }
  .db-title { font-family: var(--font-display, system-ui); font-weight: 800; font-size: 14px; }
  .db-num { color: var(--t3); font-weight: 700; }
  .db-bar-right { display: flex; gap: 8px; justify-content: flex-end; align-items: center; }
  .db-intro { gap: 14px; text-align: center; }
  .db-cal { font-size: 46px; }
  .db-h1 { margin: 0; font-family: var(--font-display, system-ui); font-size: clamp(30px, 6vw, 46px); font-weight: 800; }
  .db-lead { margin: 0; color: var(--t2); font-size: 15px; max-width: 34ch; }
  .db-lead b { color: var(--t1); }
  .db-streak-big { font-size: 18px; color: var(--t2); font-weight: 700; margin-top: 4px; }
  .db-streak-big b { color: var(--streak); font-size: 24px; }
  .db-done-badge { font-size: 14px; font-weight: 700; color: var(--success); background: var(--success-light); padding: 8px 16px; border-radius: 999px; }
  .db-start { min-width: 220px; font-size: 16px; min-height: 54px; }
  .db-actions { display: flex; gap: 10px; }

  .db-play { gap: clamp(16px, 3.4vh, 32px); }
  .db-progress-row { display: flex; gap: 6px; }
  .db-pip { width: 22px; height: 8px; border-radius: 999px; background: var(--bg3); }
  .db-pip--now { background: var(--combo); animation: gk-pop 1s ease-in-out infinite; }
  .db-pip--fast { background: var(--success); }
  .db-pip--ok { background: var(--active); }
  .db-pip--miss { background: var(--error); }
  .db-count { font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 800; color: var(--t3); }
  .db-meaning { margin: 0; font-family: var(--font-display, system-ui); font-size: clamp(30px, 6.4vw, 50px); font-weight: 800; word-break: keep-all; animation: gk-pop .3s ease-out; }
  .db-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: min(520px, 92vw); }
  .db-tile { justify-content: center; min-height: 70px; font-size: clamp(17px, 3.6vw, 23px); }

  .db-result { gap: 16px; text-align: center; position: relative; }
  .db-burst { position: absolute; top: 26%; left: 50%; }
  .db-res-lead { margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: clamp(22px, 5vw, 30px); font-weight: 500; }
  .db-grid { font-size: clamp(22px, 5vw, 30px); letter-spacing: 3px; line-height: 1; }
  .db-res-stats { display: flex; gap: 40px; }
  .db-res-stats div { display: flex; flex-direction: column; gap: 4px; }
  .db-res-stats b { font-size: 26px; font-weight: 800; }
  .db-res-stats span { font-size: 12px; color: var(--t3); font-weight: 700; }

  @media (prefers-reduced-motion: reduce) { .db-meaning, .db-pip--now { animation: none; } }
`;
