// apps/web/src/components/game/wordfall-cadence/WordfallCadenceGame.tsx
// Wordfall Cadence — 듣기 케이던스(리듬 게임 계열). 영단어 발음(TTS)을 듣고, 내려오는 뜻 후보 중
// 맞는 것을 제한 시간(케이던스) 안에 고른다. 아케이드에 없던 "청각/듣기" 채널을 메움(EchoMatch 보완).
// 스코프 단어 시드. 브라우저 음성(SpeechSynthesis) 필요 — 부재 시 안내. 게임킷 공용 인프라.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles,
  AmbientBackground,
  GameDone,
  NotEnoughWords,
  ParticleBurst,
  useSfx,
  useCountUp,
  shuffle,
  pickDistinct,
  clamp,
  type Word,
  GameMusic,
} from '@/components/game/_shared/gamekit';

interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word) => void;
  onWrong?: (w: Word) => void;
}

const DEFAULT_POOL: Word[] = [
  { en: 'advantage', ko: '이점' }, { en: 'reserved', ko: '내성적인' }, { en: 'consequence', ko: '결과' },
  { en: 'judgment', ko: '판단' }, { en: 'ability', ko: '능력' }, { en: 'courage', ko: '용기' },
  { en: 'develop', ko: '발전시키다' }, { en: 'reduce', ko: '줄이다' }, { en: 'sudden', ko: '갑작스러운' },
  { en: 'honest', ko: '정직한' }, { en: 'generous', ko: '관대한' }, { en: 'vivid', ko: '생생한' },
  { en: 'endure', ko: '견디다' }, { en: 'persuade', ko: '설득하다' }, { en: 'genuine', ko: '진짜의' },
  { en: 'scarce', ko: '부족한' },
];

const START_HP = 3;
const BASE_MS = 7000;
const MIN_MS = 4200;

const clean = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

interface Q { key: number; target: Word; options: Word[]; perMs: number }

export function WordfallCadenceGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();

  const pool = useMemo(() => {
    const seen = new Set<string>();
    return (wordPool && wordPool.length > 0 ? wordPool : DEFAULT_POOL)
      .filter((w) => w.en && w.ko && clean(w.en).length >= 2)
      .filter((w) => (seen.has(w.en) ? false : (seen.add(w.en), true)));
  }, [wordPool]);

  const hasTTS = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const enough = pool.length >= 4;
  const tileCount = Math.min(4, pool.length);

  const [phase, setPhase] = useState<'playing' | 'done'>('playing');
  const [q, setQ] = useState<Q | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [reveal, setReveal] = useState(false);
  const [hp, setHp] = useState(START_HP);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [announce, setAnnounce] = useState('');

  const shownScore = useCountUp(score);
  const keyRef = useRef(0);
  const comboRef = useRef(0);
  const hpRef = useRef(START_HP);
  const qStartRef = useRef(0);
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lock = useRef(false);
  const answerRef = useRef<(i: number) => void>(() => {});
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const mounted = useRef(true);

  const speak = useCallback((text: string) => {
    if (!hasTTS) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.92;
      if (voiceRef.current) u.voice = voiceRef.current;
      window.speechSynthesis.speak(u);
    } catch {
      /* noop */
    }
  }, [hasTTS]);

  const nextQ = useCallback(() => {
    if (!mounted.current) return;
    const target = pool[Math.floor(Math.random() * pool.length)];
    const distract = pickDistinct(pool, tileCount - 1, (w) => w.en === target.en || w.ko === target.ko);
    keyRef.current += 1;
    const perMs = Math.max(MIN_MS, BASE_MS - cleared * 120);
    setQ({ key: keyRef.current, target, options: shuffle([target, ...distract]), perMs });
    setPicked(null); setReveal(false); lock.current = false;
    qStartRef.current = Date.now();
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => answerRef.current(-1), perMs);
    speak(target.en);
  }, [pool, tileCount, cleared, speak]);

  const answer = useCallback((i: number) => {
    if (lock.current || !q) return;
    lock.current = true;
    if (qTimer.current) { clearTimeout(qTimer.current); qTimer.current = null; }
    const chosen = i >= 0 ? q.options[i] : null;
    const ok = !!chosen && chosen.en === q.target.en;
    setPicked(i); setReveal(true);
    if (ok) {
      const nc = comboRef.current + 1; comboRef.current = nc;
      setCombo(nc); setBestCombo((b) => Math.max(b, nc));
      const fast = Date.now() - qStartRef.current < q.perMs * 0.5;
      const gain = Math.round((100 + (fast ? 40 : 0)) * (1 + Math.min(nc, 15) * 0.1));
      setScore((s) => s + gain);
      setCleared((c) => c + 1);
      sfx.correct(nc, nc % 5 === 0);
      onCorrect?.(q.target);
      setAnnounce(`정답 · ${q.target.en} = ${q.target.ko}`);
    } else {
      comboRef.current = 0; setCombo(0);
      hpRef.current -= 1; setHp(hpRef.current);
      sfx.wrong();
      onWrong?.(q.target);
      setAnnounce(i < 0 ? `시간 초과 · ${q.target.en} = ${q.target.ko}` : `틀렸어요 · ${q.target.en} = ${q.target.ko}`);
    }
    window.setTimeout(() => {
      if (!mounted.current) return;
      if (hpRef.current <= 0) { sfx.fanfare(); setPhase('done'); return; }
      nextQ();
    }, ok ? 620 : 950);
  }, [q, sfx, onCorrect, onWrong, nextQ]);
  answerRef.current = answer;

  const restart = useCallback(() => {
    hpRef.current = START_HP; comboRef.current = 0;
    setHp(START_HP); setScore(0); setCombo(0); setBestCombo(0); setCleared(0);
    setAnnounce(''); setPicked(null); setReveal(false); lock.current = false;
    setPhase('playing');
    keyRef.current = 0;
  }, []);

  // 음성 목록 로드(en 보이스 선택) + 언마운트 정리.
  useEffect(() => {
    mounted.current = true;
    if (hasTTS) {
      const pick = () => {
        const vs = window.speechSynthesis.getVoices();
        voiceRef.current = vs.find((v) => /en[-_]/i.test(v.lang)) ?? vs[0] ?? null;
      };
      pick();
      window.speechSynthesis.onvoiceschanged = pick;
    }
    return () => {
      mounted.current = false;
      if (qTimer.current) clearTimeout(qTimer.current);
      if (hasTTS) { try { window.speechSynthesis.cancel(); } catch { /* noop */ } }
    };
  }, [hasTTS]);

  // playing 진입/재시작 시 첫 문제 시작(q 없을 때).
  useEffect(() => {
    if (phase === 'playing' && enough && hasTTS && q === null) nextQ();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, q]);

  if (!hasTTS) {
    return (
      <div className="gk-empty" role="alert">
        <GameKitStyles />
        <div className="gk-empty-emoji" aria-hidden="true">🔊</div>
        <h1 className="gk-empty-title">브라우저 음성이 필요해요</h1>
        <p className="gk-empty-sub">이 게임은 단어 발음을 듣고 뜻을 고릅니다. 음성(TTS)을 지원하는 브라우저에서 열어 주세요.</p>
        {onExit && <button type="button" className="gk-btn gk-btn--primary" onClick={onExit}>돌아가기</button>}
      </div>
    );
  }
  if (!enough) return <NotEnoughWords need={4} onExit={onExit} />;

  if (phase === 'done') {
    return (
      <div className="gk-root wf-root">
        <GameKitStyles />
        <AmbientBackground center="#E7ECF7" mid="#B6C4E4" edge="#1C2440" glow="rgba(140,176,255,.3)" glowAt="50% 30%" watermark="wordfall-cadence" />
        <style dangerouslySetInnerHTML={{ __html: WF_CSS }} />
        <GameMusic gameId="wordfall-cadence" />
        <GameDone
          lead={cleared >= 15 ? '귀가 밝아졌어요' : '오늘 잘 마쳤어요'}
          stats={[
            { num: score.toLocaleString(), label: '점수', accent: true },
            { num: cleared, label: '들은 단어' },
            { num: `🔥 ${bestCombo}`, label: '최고 콤보' },
          ]}
          onRestart={restart}
          onExit={() => onExit?.()}
          mark="wordfall-cadence"
        />
      </div>
    );
  }

  return (
    <div className="gk-root wf-root">
      <GameKitStyles />
      <AmbientBackground center="#E7ECF7" mid="#B6C4E4" edge="#1C2440" glow="rgba(140,176,255,.28)" glowAt="50% 24%" watermark="wordfall-cadence" />
      <style dangerouslySetInnerHTML={{ __html: WF_CSS }} />
      <GameMusic gameId="wordfall-cadence" />
      <div className="gk-sr" aria-live="assertive">{announce}</div>

      <header className="wf-hud">
        <div className="wf-stat"><span className="wf-lbl">SCORE</span><span key={score} className="wf-score gk-bump">{shownScore.toLocaleString()}</span></div>
        <div className="wf-candles" aria-label={`남은 기회 ${hp}개`}>
          {Array.from({ length: START_HP }).map((_, i) => (
            <span key={i} className={`wf-heart ${i < hp ? 'wf-heart--on' : 'wf-heart--off'}`} aria-hidden="true">♪</span>
          ))}
        </div>
        <div className="wf-stat wf-stat--r"><span className="wf-lbl">콤보</span>
          <span key={combo} data-tier={clamp(Math.floor(combo / 5), 0, 3)} className={`wf-combo ${combo > 0 ? 'wf-combo--on gk-bump' : ''}`}>{combo > 0 ? `🔥 ${combo}` : '—'}</span>
        </div>
        {onExit && <button type="button" className="gk-exit" onClick={onExit}>나가기</button>}
      </header>

      <main className="gk-stage wf-stage">
        <button type="button" className="wf-listen" onClick={() => q && speak(q.target.en)} aria-label="다시 듣기">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9v6h3.5L12 19V5L7.5 9H4Z" /><path d="M15.5 9a4 4 0 0 1 0 6" /><path d="M18 6.6a7.5 7.5 0 0 1 0 10.8" opacity=".55" />
          </svg>
          <span>다시 듣기</span>
        </button>

        {q && (
          <div className="wf-bar" aria-hidden="true">
            <div key={q.key} className="wf-bar-fill" style={{ animationDuration: `${q.perMs}ms` }} />
          </div>
        )}

        <div className="wf-tiles">
          {q?.options.map((o, i) => {
            const isAns = o.en === q.target.en; const isPick = picked === i;
            let tone = ''; if (reveal) tone = isAns ? 'gk-tile--correct' : isPick ? 'gk-tile--wrong' : 'gk-tile--dim';
            return (
              <button key={`${q.key}-${o.en}`} type="button" className={`gk-tile wf-tile ${tone}`} disabled={reveal} onClick={() => answer(i)}>
                {o.ko}
                {reveal && isAns && <ParticleBurst intensity={1} />}
              </button>
            );
          })}
        </div>
        <p className="wf-hint">발음을 듣고 <b>뜻</b>을 고르세요 · 케이던스가 다하기 전에</p>
      </main>
    </div>
  );
}

const WF_CSS = `
  .wf-root { display: flex; flex-direction: column; }
  .wf-hud { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--bd); }
  .wf-stat { display: flex; flex-direction: column; line-height: 1.05; }
  .wf-stat--r { align-items: flex-end; }
  .wf-lbl { font-size: 10px; font-weight: 700; letter-spacing: .12em; color: var(--t3); text-transform: uppercase; }
  .wf-score { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--combo); }
  .wf-candles { display: flex; gap: 6px; justify-self: center; }
  .wf-heart { font-size: 18px; }
  .wf-heart--on { color: var(--streak); } .wf-heart--off { color: var(--t4); opacity: .45; }
  .wf-combo { font-size: 15px; font-weight: 800; color: var(--t4); font-variant-numeric: tabular-nums; }
  .wf-combo--on { color: var(--streak); }
  .wf-combo--on[data-tier="2"] { color: #E8622F; } .wf-combo--on[data-tier="3"] { color: #E0322F; }

  .wf-stage { gap: clamp(18px, 3.6vh, 32px); }
  .wf-listen { display: inline-flex; flex-direction: column; align-items: center; gap: 6px; padding: 18px 26px; border-radius: 22px; border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 70%, transparent); color: var(--combo); font-size: 12px; font-weight: 800; cursor: pointer; box-shadow: 0 14px 38px -12px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.5); backdrop-filter: blur(6px); transition: transform .2s var(--ease-spring), border-color .15s; }
  .wf-listen:hover { border-color: var(--combo); }
  .wf-listen:active { transform: scale(.95); }
  .wf-listen span { color: var(--t2); letter-spacing: .04em; }
  .wf-bar { width: min(520px, 88vw); height: 7px; border-radius: 999px; background: var(--bg3); overflow: hidden; }
  .wf-bar-fill { height: 100%; width: 100%; border-radius: 999px; background: var(--combo); transform-origin: left; animation: wf-deplete linear forwards; }
  .wf-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: min(520px, 92vw); }
  .wf-tile { justify-content: center; min-height: 68px; font-size: clamp(16px, 3.6vw, 22px); font-family: var(--font-display, system-ui); }
  .wf-hint { margin: 0; font-size: 12.5px; color: var(--t3); text-align: center; }
  .wf-hint b { color: var(--t2); }

  @keyframes wf-deplete { from { transform: scaleX(1); } to { transform: scaleX(0); } }
  @media (prefers-reduced-motion: reduce) { .wf-bar-fill { animation-duration: inherit; } .wf-listen { transition: none; } }
`;
