// apps/web/src/components/game/wordsmith-vigil/WordsmithVigilGame.tsx
// Wordsmith's Vigil — 타이핑 서바이버(Typing of the Dead × Vampire Survivors). 뜻을 든 안개
// 정령이 촛불로 내려오면 그 영단어를 정확히 "타이핑"해 흩는다. 생성(Generation)·철자 채널 —
// 재인 편중을 보완하는 최고 학습 ROI 루프. 스코프 단어(FSRS due) 시드. 게임킷 공용 인프라.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GameKitStyles,
  AmbientBackground,
  GameDone,
  NotEnoughWords,
  ParticleBurst,
  useSfx,
  useCountUp,
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
  { en: 'advantage', ko: '이점' }, { en: 'reserved', ko: '내성적인' }, { en: 'inclined', ko: '경향이 있는' },
  { en: 'consequence', ko: '결과' }, { en: 'judgment', ko: '판단' }, { en: 'ability', ko: '능력' },
  { en: 'balance', ko: '균형' }, { en: 'courage', ko: '용기' }, { en: 'develop', ko: '발전시키다' },
  { en: 'reduce', ko: '줄이다' }, { en: 'sudden', ko: '갑작스러운' }, { en: 'honest', ko: '정직한' },
  { en: 'generous', ko: '관대한' }, { en: 'vivid', ko: '생생한' }, { en: 'endure', ko: '견디다' },
  { en: 'persuade', ko: '설득하다' }, { en: 'scarce', ko: '부족한' }, { en: 'genuine', ko: '진짜의' },
];

const START_HP = 3;
const BASE_FALL_MS = 10500;
const MIN_FALL_MS = 5200;
const BASE_SPAWN_MS = 2500;
const MIN_SPAWN_MS = 1250;

const cleanWord = (en: string) => en.toLowerCase().replace(/[^a-z]/g, '');

interface Wisp { id: number; w: Word; ce: string; prog: number }

export function WordsmithVigilGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();

  const pool = useRef<Word[]>([]);
  if (pool.current.length === 0) {
    const seen = new Set<string>();
    pool.current = (wordPool && wordPool.length > 0 ? wordPool : DEFAULT_POOL)
      .filter((w) => w.en && w.ko && cleanWord(w.en).length >= 2)
      .filter((w) => (seen.has(w.en) ? false : (seen.add(w.en), true)));
  }
  const enough = pool.current.length >= 5;

  const [phase, setPhase] = useState<'playing' | 'done'>('playing');
  const [wisps, setWisps] = useState<Wisp[]>([]);
  const [input, setInput] = useState('');
  const [hp, setHp] = useState(START_HP);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [dispelled, setDispelled] = useState(0);
  const [reject, setReject] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [burst, setBurst] = useState<{ id: number; key: number } | null>(null);

  const shownScore = useCountUp(score);

  const wispsRef = useRef<Wisp[]>([]);
  wispsRef.current = wisps;
  const inputRef = useRef('');
  inputRef.current = input;
  const comboRef = useRef(0);
  const hpRef = useRef(START_HP);
  const idRef = useRef(0);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const spawnAccRef = useRef(0);
  const startRef = useRef(0);
  const endedRef = useRef(false);
  const mounted = useRef(true);
  const fieldRef = useRef<HTMLInputElement | null>(null);

  const endRun = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    cancelAnimationFrame(rafRef.current);
    sfx.fanfare();
    setPhase('done');
  }, [sfx]);

  // 마운트/언마운트 — mounted 플래그 + 최초 포커스. 루프는 아래 phase 이펙트가 단독 구동.
  useEffect(() => {
    mounted.current = true;
    fieldRef.current?.focus();
    return () => {
      mounted.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const dispel = useCallback(
    (wp: Wisp) => {
      const nc = comboRef.current + 1;
      comboRef.current = nc;
      setCombo(nc);
      setBestCombo((b) => Math.max(b, nc));
      const gain = Math.round((100 + Math.round((1 - wp.prog) * 40)) * (1 + Math.min(nc, 20) * 0.1));
      setScore((s) => s + gain);
      setDispelled((d) => d + 1);
      setBurst({ id: wp.id, key: Date.now() });
      sfx.correct(nc, nc % 5 === 0);
      onCorrect?.(wp.w);
      setAnnounce(`격파 · ${wp.w.en}`);
      // wispsRef 를 즉시 갱신(루프의 setWisps 와 레이스로 격파된 정령이 되살아나는 것 방지).
      wispsRef.current = wispsRef.current.filter((x) => x.id !== wp.id);
      setWisps(wispsRef.current);
      setInput('');
    },
    [sfx, onCorrect],
  );

  // 타이핑 입력 (모바일 키보드 위해 실제 input) — prefix 매칭 정령을 조준, 완성 시 격파.
  const onType = useCallback(
    (raw: string) => {
      if (phase !== 'playing') return;
      const v = cleanWord(raw);
      if (v === '') { setInput(''); return; }
      const cands = wispsRef.current.filter((x) => x.ce.startsWith(v));
      if (cands.length === 0) {
        // 어떤 정령과도 안 맞음 — 부드러운 거절(글자 무시 + 흔들림)
        setReject(true);
        window.setTimeout(() => mounted.current && setReject(false), 240);
        return;
      }
      const exact = cands.filter((x) => x.ce === v);
      if (exact.length > 0) {
        // 가장 아래(급한) 정령 격파
        exact.sort((a, b) => b.prog - a.prog);
        dispel(exact[0]);
        return;
      }
      setInput(v);
    },
    [phase, dispel],
  );

  const restart = useCallback(() => {
    endedRef.current = false;
    hpRef.current = START_HP;
    comboRef.current = 0;
    idRef.current = 0;
    spawnAccRef.current = 0;
    wispsRef.current = [];
    setWisps([]); setInput(''); setHp(START_HP); setScore(0); setCombo(0);
    setBestCombo(0); setDispelled(0); setAnnounce('');
    setPhase('playing');
    startRef.current = performance.now();
    lastRef.current = performance.now();
    // 루프는 phase→playing 재마운트가 아니라 아래 effect 로 재가동
    setTimeout(() => fieldRef.current?.focus(), 30);
  }, []);

  // playing 진입 시 루프 재가동(restart 포함) — enough effect 는 최초 1회라 별도 트리거.
  useEffect(() => {
    if (phase !== 'playing' || !enough || endedRef.current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRef.current = performance.now();
    lastRef.current = performance.now();
    spawnAccRef.current = 0;
    const loop = (now: number) => {
      if (!mounted.current || endedRef.current || phase !== 'playing') return;
      const dt = Math.min(64, now - lastRef.current);
      lastRef.current = now;
      const elapsed = now - startRef.current;
      const fallMs = Math.max(MIN_FALL_MS, BASE_FALL_MS - elapsed / 26);
      const spawnMs = Math.max(MIN_SPAWN_MS, BASE_SPAWN_MS - elapsed / 90);
      let escapedEn: string | null = null;
      const next: Wisp[] = [];
      for (const wp of wispsRef.current) {
        const prog = wp.prog + dt / fallMs;
        if (prog >= 1) { escapedEn = wp.w.en; hpRef.current -= 1; comboRef.current = 0; onWrong?.(wp.w); }
        else next.push({ ...wp, prog });
      }
      if (escapedEn) {
        sfx.wrong(); setCombo(0); setHp(hpRef.current); setAnnounce(`놓쳤어요 · ${escapedEn}`);
        if (inputRef.current && !next.some((x) => x.ce.startsWith(inputRef.current))) setInput('');
      }
      spawnAccRef.current += dt;
      if (spawnAccRef.current >= spawnMs) {
        spawnAccRef.current = 0;
        const onScreen = new Set(next.map((x) => x.w.en));
        const cands = pool.current.filter((w) => !onScreen.has(w.en));
        const srcArr = cands.length > 0 ? cands : pool.current;
        const w = srcArr[Math.floor(Math.random() * srcArr.length)];
        idRef.current += 1;
        next.push({ id: idRef.current, w, ce: cleanWord(w.en), prog: 0 });
      }
      wispsRef.current = next;
      setWisps(next);
      if (hpRef.current <= 0) { endRun(); return; }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (!enough) return <NotEnoughWords need={5} onExit={onExit} />;

  if (phase === 'done') {
    return (
      <div className="gk-root wv-root">
        <GameKitStyles />
        <AmbientBackground center="#F7ECD8" mid="#D8B888" edge="#3A2A1C" glow="rgba(255,196,120,.34)" glowAt="50% 30%" watermark="wordsmith-vigil" />
        <style dangerouslySetInnerHTML={{ __html: WV_CSS }} />
        <GameMusic gameId="wordsmith-vigil" />
        <GameDone
          lead={dispelled >= 15 ? '필경사의 밤을 지켰어요' : '오늘 잘 마쳤어요'}
          stats={[
            { num: score.toLocaleString(), label: '점수', accent: true },
            { num: dispelled, label: '흩은 정령' },
            { num: `🔥 ${bestCombo}`, label: '최고 콤보' },
          ]}
          onRestart={restart}
          onExit={() => onExit?.()}
          mark="wordsmith-vigil"
        />
      </div>
    );
  }

  return (
    <div className={`gk-root wv-root ${reject ? 'wv-reject' : ''}`}>
      <GameKitStyles />
      <AmbientBackground center="#F7ECD8" mid="#D8B888" edge="#3A2A1C" glow="rgba(255,196,120,.3)" glowAt="50% 26%" watermark="wordsmith-vigil" />
      <style dangerouslySetInnerHTML={{ __html: WV_CSS }} />
      <GameMusic gameId="wordsmith-vigil" />
      <div className="gk-sr" aria-live="assertive">{announce}</div>

      <header className="wv-hud">
        <div className="wv-stat">
          <span className="wv-lbl">SCORE</span>
          <span key={score} className="wv-score gk-bump">{shownScore.toLocaleString()}</span>
        </div>
        <div className="wv-candles" aria-label={`남은 촛불 ${hp}개`}>
          {Array.from({ length: START_HP }).map((_, i) => (
            <span key={i} className={`wv-candle ${i < hp ? 'wv-candle--lit' : 'wv-candle--out'}`} aria-hidden="true">
              <svg viewBox="0 0 16 24" width="15" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 11h6v10H5z" /><path d="M8 11V7" />
                {i < hp && <path className="wv-flame" d="M8 2c2 2 2.4 3.8 0 5-2.4-1.2-2-3-0-5Z" fill="currentColor" stroke="none" />}
              </svg>
            </span>
          ))}
        </div>
        <div className="wv-stat wv-stat--r">
          <span className="wv-lbl">콤보</span>
          <span key={combo} data-tier={clamp(Math.floor(combo / 5), 0, 3)} className={`wv-combo ${combo > 0 ? 'wv-combo--on gk-bump' : ''}`}>
            {combo > 0 ? `🔥 ${combo}` : '—'}
          </span>
        </div>
        {onExit && <button type="button" className="gk-exit" onClick={onExit}>나가기</button>}
      </header>

      <div className="wv-field" aria-hidden="true">
        {wisps.map((wp) => {
          const targeted = input.length > 0 && wp.ce.startsWith(input);
          const urgent = wp.prog > 0.72;
          return (
            <div
              key={wp.id}
              className={`wv-wisp ${targeted ? 'wv-wisp--on' : ''} ${urgent ? 'wv-wisp--urgent' : ''}`}
              style={{ top: `${6 + wp.prog * 70}%`, left: `${wispX(wp.id)}%` }}
            >
              <span className="wv-wisp-ko">{wp.w.ko}</span>
              {targeted && (
                <span className="wv-wisp-en">
                  <b>{wp.w.en.slice(0, input.length)}</b>{wp.w.en.slice(input.length)}
                </span>
              )}
              {burst && burst.id === wp.id && <ParticleBurst intensity={2} />}
            </div>
          );
        })}
        <div className="wv-hearth" />
      </div>

      <div className="wv-quillbar">
        <span className="wv-quill-ic" aria-hidden="true">✒</span>
        <input
          ref={fieldRef}
          className="wv-quill"
          value={input}
          onChange={(e) => onType(e.target.value)}
          placeholder="뜻을 보고 영단어를 타이핑…"
          aria-label="영단어 입력"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="go"
          inputMode="text"
        />
      </div>
    </div>
  );
}

// 정령의 가로 위치 — id 기반 결정적 분산(겹침 완화, 매 프레임 안정).
function wispX(id: number): number {
  const slots = [12, 32, 52, 72, 40, 20, 62, 80, 8];
  return slots[id % slots.length];
}

const WV_CSS = `
  .wv-root { display: flex; flex-direction: column; }
  .wv-hud { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--bd); z-index: 2; }
  .wv-stat { display: flex; flex-direction: column; line-height: 1.05; }
  .wv-stat--r { align-items: flex-end; }
  .wv-lbl { font-size: 10px; font-weight: 700; letter-spacing: .12em; color: var(--t3); text-transform: uppercase; }
  .wv-score { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--combo); }
  .wv-candles { display: flex; gap: 6px; justify-self: center; }
  .wv-candle--lit { color: #E8862F; }
  .wv-candle--out { color: var(--t4); opacity: .5; }
  .wv-flame { animation: wv-flicker 1.6s ease-in-out infinite; transform-origin: 8px 4px; }
  .wv-combo { font-size: 15px; font-weight: 800; color: var(--t4); font-variant-numeric: tabular-nums; transition: font-size .2s ease; }
  .wv-combo--on { color: var(--streak); }
  .wv-combo--on[data-tier="2"] { font-size: 19px; color: #E8622F; }
  .wv-combo--on[data-tier="3"] { font-size: 22px; color: #E0322F; text-shadow: 0 0 14px color-mix(in srgb, var(--error) 60%, transparent); }

  .wv-field { position: relative; flex: 1; min-height: 0; overflow: hidden; }
  .wv-hearth { position: absolute; left: 0; right: 0; bottom: 0; height: 12%; background: linear-gradient(0deg, color-mix(in srgb, #E8862F 30%, transparent), transparent); border-top: 1px dashed color-mix(in srgb, #E8862F 55%, transparent); }
  .wv-wisp { position: absolute; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 9px 14px; border-radius: 14px; background: color-mix(in srgb, var(--bg) 78%, transparent); border: 1.5px solid var(--bd); box-shadow: 0 6px 20px -8px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.4); backdrop-filter: blur(4px); white-space: nowrap; transition: border-color .12s, box-shadow .12s; }
  .wv-wisp-ko { font-family: var(--font-display, system-ui); font-size: clamp(15px, 3.4vw, 19px); font-weight: 800; color: var(--t1); }
  .wv-wisp-en { font-family: var(--font-english, ui-monospace, monospace); font-size: 13px; letter-spacing: .04em; color: var(--t3); }
  .wv-wisp-en b { color: var(--combo); }
  .wv-wisp--on { border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 26%, transparent), 0 8px 24px -8px rgba(0,0,0,.4); }
  .wv-wisp--urgent { border-color: var(--error); }
  .wv-wisp--urgent .wv-wisp-ko { color: var(--error); }

  .wv-quillbar { display: flex; align-items: center; gap: 10px; padding: 12px 16px calc(14px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 60%, transparent); z-index: 2; }
  .wv-quill-ic { font-size: 18px; color: var(--t3); }
  .wv-quill { flex: 1; min-height: 48px; padding: 0 16px; border-radius: var(--r-md, 10px); border: 1.5px solid var(--bd); background: var(--bg); color: var(--t1); font-family: var(--font-english, ui-monospace, monospace); font-size: clamp(17px, 4vw, 22px); font-weight: 700; letter-spacing: .06em; outline: none; transition: border-color .15s, box-shadow .15s; }
  .wv-quill:focus { border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 26%, transparent); }
  .wv-quill::placeholder { color: var(--t4); font-weight: 500; letter-spacing: 0; font-size: 14px; }
  .wv-reject .wv-quill { animation: gk-shake .24s ease-in-out; border-color: var(--error); }

  @keyframes wv-flicker { 0%,100% { opacity: 1; transform: scale(1); } 45% { opacity: .78; transform: scale(.9) translateY(.5px); } }
  @media (prefers-reduced-motion: reduce) {
    .wv-flame { animation: none; }
    .wv-reject .wv-quill { animation: none; }
    .wv-wisp { transition: none; }
  }
`;
