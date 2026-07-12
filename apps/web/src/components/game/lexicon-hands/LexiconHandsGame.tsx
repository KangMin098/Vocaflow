// apps/web/src/components/game/lexicon-hands/LexiconHandsGame.tsx
// Lexicon Hands — 어휘 속성 시너지 엔진 (Balatro 계열). 단어 카드가 공유하는 '속성'
// (어원·품사·도메인·접사·반의어)으로 족보를 만들어 칩×배수를 폭발시키고, 언어 조커로 배수를
// 증폭해 라운드 목표를 격파한다. 뜻 암기 너머 '깊은 어휘 지식'(depth)을 훈련.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles, AmbientBackground, GameMark, Hud, GameDone, ParticleBurst,
  useSfx, useCountUp, shuffle, clamp, type Word,
} from '@/components/game/_shared/gamekit';

interface Props { wordPool?: Word[]; onExit?: () => void; onCorrect?: (w: Word) => void; onWrong?: (w: Word) => void; }

type Pos = 'v' | 'n' | 'adj' | 'adv';
interface Card { id: number; en: string; ko: string; pos: Pos; domain?: string; root?: string; prefix?: string; }
const POS_KO: Record<Pos, string> = { v: '동사', n: '명사', adj: '형용사', adv: '부사' };

// ── 속성 태그 덱 (어원·품사·도메인·접사) ──
const DECK_SRC: Omit<Card, 'id'>[] = [
  { en: 'inspect', ko: '조사하다', pos: 'v', domain: 'academic', root: 'spec', prefix: 'in' },
  { en: 'spectator', ko: '관중', pos: 'n', root: 'spec' },
  { en: 'respect', ko: '존경하다', pos: 'v', domain: 'emotion', root: 'spec', prefix: 're' },
  { en: 'suspect', ko: '의심하다', pos: 'v', root: 'spec' },
  { en: 'export', ko: '수출하다', pos: 'v', domain: 'business', root: 'port', prefix: 'ex' },
  { en: 'import', ko: '수입하다', pos: 'v', domain: 'business', root: 'port' },
  { en: 'portable', ko: '휴대용의', pos: 'adj', root: 'port' },
  { en: 'transport', ko: '수송하다', pos: 'v', domain: 'business', root: 'port' },
  { en: 'predict', ko: '예측하다', pos: 'v', domain: 'academic', root: 'dict', prefix: 'pre' },
  { en: 'dictate', ko: '받아쓰게 하다', pos: 'v', root: 'dict' },
  { en: 'contradict', ko: '반박하다', pos: 'v', root: 'dict' },
  { en: 'construct', ko: '건설하다', pos: 'v', domain: 'business', root: 'struct' },
  { en: 'structure', ko: '구조', pos: 'n', domain: 'academic', root: 'struct' },
  { en: 'instruct', ko: '가르치다', pos: 'v', domain: 'academic', root: 'struct', prefix: 'in' },
  { en: 'reduce', ko: '줄이다', pos: 'v', domain: 'business', prefix: 're' },
  { en: 'reveal', ko: '드러내다', pos: 'v', prefix: 're' },
  { en: 'rebuild', ko: '재건하다', pos: 'v', prefix: 're' },
  { en: 'enormous', ko: '거대한', pos: 'adj', domain: 'nature' },
  { en: 'tiny', ko: '작은', pos: 'adj', domain: 'nature' },
  { en: 'ancient', ko: '고대의', pos: 'adj' },
  { en: 'modern', ko: '현대의', pos: 'adj' },
  { en: 'generous', ko: '관대한', pos: 'adj', domain: 'emotion' },
  { en: 'selfish', ko: '이기적인', pos: 'adj', domain: 'emotion' },
];
const ANT: Record<string, string> = { enormous: 'tiny', tiny: 'enormous', ancient: 'modern', modern: 'ancient', generous: 'selfish', selfish: 'generous' };
const DOMAIN_KO: Record<string, string> = { academic: '학술', business: '비즈니스', nature: '자연', emotion: '감정' };
const DOMAIN_COLOR: Record<string, string> = { academic: '#6E8BE0', business: '#D9A441', nature: '#4FB07A', emotion: '#D26AA0' };

interface Joker { id: string; icon: string; name: string; desc: string; }
const JOKERS: Joker[] = [
  { id: 'scholar', icon: '🎓', name: '학자', desc: '학술 카드당 +20칩' },
  { id: 'affixer', icon: '🧩', name: '접사 수집가', desc: '접사 런 배수 ×2' },
  { id: 'classicist', icon: '📜', name: '고전어 애호가', desc: '어원 있는 카드당 +8칩' },
];

const ROUNDS = [{ target: 260, plays: 4, discards: 2 }, { target: 620, plays: 4, discards: 2 }, { target: 1300, plays: 5, discards: 3 }];
const HAND_SIZE = 8;

interface HandResult { valid: boolean; label: string; chips: number; mult: number; score: number; key: string }
function analyze(sel: Card[]): HandResult {
  const none: HandResult = { valid: false, label: '', chips: 0, mult: 0, score: 0, key: '' };
  if (sel.length < 2) return none;
  const same = (get: (c: Card) => string | undefined) => { const v0 = get(sel[0]); return !!v0 && sel.every((c) => get(c) === v0); };
  let base = 0, label = '', key = '';
  if (sel.length === 2 && ANT[sel[0].en] === sel[1].en) { base = 5; label = '반의어 페어'; key = 'ant'; }
  else if (same((c) => c.root)) { base = 4; label = `동원어 플러시 · ${sel[0].root}`; key = 'root'; }
  else if (same((c) => c.prefix)) { base = 3.2; label = `접두사 런 · ${sel[0].prefix}-`; key = 'affix'; }
  else if (same((c) => c.domain)) { base = 3; label = `도메인 세트 · ${DOMAIN_KO[sel[0].domain!]}`; key = 'domain'; }
  else if (same((c) => c.pos)) { base = 2; label = `품사 매치 · ${POS_KO[sel[0].pos]}`; key = 'pos'; }
  else return none;
  let mult = base + (sel.length - 2) * 0.5;
  let chips = sel.reduce((s, c) => s + 10 + c.en.length, 0);
  // 조커
  chips += 20 * sel.filter((c) => c.domain === 'academic').length;   // 학자
  chips += 8 * sel.filter((c) => c.root).length;                     // 고전어
  if (key === 'affix') mult *= 2;                                    // 접사 수집가
  const score = Math.round(chips * mult);
  return { valid: true, label, chips, mult: Math.round(mult * 10) / 10, score, key };
}

// ── 실 어휘 배선: 스코프 단어 → 속성 태그 덱. 품사(실데이터+형태론 휴리스틱)·어원·접두사 감지. ──
const ROOTS = ['struct', 'spect', 'spec', 'port', 'dict', 'ject', 'tract', 'scrib', 'script', 'duct', 'duc', 'vis', 'vid', 'aud', 'graph', 'phon', 'form', 'miss', 'mit', 'vent', 'ven', 'fer', 'cred', 'mort', 'path', 'sens', 'sent', 'cess', 'ceed', 'cede', 'pos', 'pel', 'puls', 'rupt', 'flect', 'flex', 'tain', 'ten', 'fact', 'fect', 'fic'];
const PREFIXES = ['inter', 'trans', 'super', 'under', 'over', 'anti', 'fore', 'counter', 'un', 're', 'dis', 'pre', 'in', 'im', 'ir', 'il', 'ex', 'com', 'con', 'col', 'cor', 'pro', 'de', 'sub', 'mis', 'ab', 'ad'];
const posFromData = (raw?: string): Pos | undefined => {
  const s = (raw || '').toLowerCase();
  if (/adverb|부사/.test(s) || /\badv\b/.test(s)) return 'adv'; // 'adverb'는 'verb'를 포함 → 반드시 먼저
  if (/adjective|형용사|\badj\b/.test(s)) return 'adj';
  if (/verb|동사/.test(s)) return 'v';
  if (/noun|명사/.test(s)) return 'n';
  return undefined;
};
const posHeuristic = (w: string): Pos => {
  if (/ly$/.test(w)) return 'adv';
  if (/(ous|ful|ive|able|ible|al|ic|ish|less|ant|ent)$/.test(w)) return 'adj';
  if (/(tion|sion|ment|ness|ity|ance|ence|ship|hood|ism)$/.test(w)) return 'n';
  if (/(ize|ise|ate|ify|fy|en)$/.test(w)) return 'v';
  return 'n';
};
const detectRoot = (w: string): string | undefined => {
  let best: string | undefined;
  for (const r of ROOTS) if (w.includes(r) && (!best || r.length > best.length)) best = r;
  return best;
};
const detectPrefix = (w: string): string | undefined => {
  let best: string | undefined;
  for (const p of PREFIXES) if (w.startsWith(p) && w.length - p.length >= 3 && (!best || p.length > best.length)) best = p;
  return best;
};
function buildDeckFromPool(pool?: Word[]): Omit<Card, 'id'>[] | null {
  if (!pool || pool.length < 12) return null;
  const seen = new Set<string>();
  const deck: Omit<Card, 'id'>[] = [];
  for (const w of pool) {
    if (!w.en || !w.ko || seen.has(w.en)) continue;
    const en = w.en.trim();
    if (!/^[a-z][a-z-]{2,}$/i.test(en)) continue; // 단일 영단어만
    const lw = en.toLowerCase();
    seen.add(w.en);
    const root = detectRoot(lw);
    const prefix = detectPrefix(lw);
    deck.push({ en, ko: w.ko, pos: posFromData(w.pos) ?? posHeuristic(lw), ...(root ? { root } : {}), ...(prefix ? { prefix } : {}) });
    if (deck.length >= 40) break;
  }
  return deck.length >= 12 ? deck : null;
}

export function LexiconHandsGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();
  const deckSrc = useMemo(() => buildDeckFromPool(wordPool) ?? DECK_SRC, [wordPool]);
  const idRef = useRef(0);
  const drawPile = useRef<Card[]>([]);
  const [hand, setHand] = useState<Card[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [roundIdx, setRoundIdx] = useState(0);
  const [roundScore, setRoundScore] = useState(0);
  const [plays, setPlays] = useState(ROUNDS[0].plays);
  const [discards, setDiscards] = useState(ROUNDS[0].discards);
  const [total, setTotal] = useState(0);
  const [best, setBest] = useState(0);
  const [phase, setPhase] = useState<'play' | 'done'>('play');
  const [won, setWon] = useState(false);
  const [pop, setPop] = useState<{ label: string; chips: number; mult: number; score: number; key: number } | null>(null);
  const [flash, setFlash] = useState('');
  const shownRound = useCountUp(roundScore);
  const mounted = useRef(true);

  const refill = useCallback(() => {
    if (drawPile.current.length < HAND_SIZE) drawPile.current = shuffle(deckSrc.map((c) => ({ ...c, id: ++idRef.current })));
  }, [deckSrc]);
  const draw = useCallback((n: number): Card[] => {
    const out: Card[] = [];
    for (let i = 0; i < n; i++) { refill(); const c = drawPile.current.pop(); if (c) out.push(c); }
    return out;
  }, [refill]);

  const startRound = useCallback((ri: number) => {
    drawPile.current = shuffle(deckSrc.map((c) => ({ ...c, id: ++idRef.current })));
    setHand(draw(HAND_SIZE)); setSel([]);
    setRoundScore(0); setPlays(ROUNDS[ri].plays); setDiscards(ROUNDS[ri].discards);
  }, [draw, deckSrc]);

  useEffect(() => { mounted.current = true; startRound(0); return () => { mounted.current = false; }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selCards = useMemo(() => sel.map((id) => hand.find((c) => c.id === id)).filter(Boolean) as Card[], [sel, hand]);
  const preview = useMemo(() => analyze(selCards), [selCards]);

  const toggle = useCallback((id: number) => {
    setFlash('');
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 5 ? s : (sfx.click(), [...s, id])));
  }, [sfx]);

  const nextRoundOrDone = useCallback((newRoundScore: number, playsLeft: number) => {
    const tgt = ROUNDS[roundIdx].target;
    if (newRoundScore >= tgt) {
      if (roundIdx + 1 < ROUNDS.length) { sfx.fanfare(); const nr = roundIdx + 1; setRoundIdx(nr); setTimeout(() => mounted.current && startRound(nr), 60); }
      else { sfx.fanfare(); setWon(true); setPhase('done'); }
    } else if (playsLeft <= 0) { setWon(false); setPhase('done'); sfx.wrong(); }
  }, [roundIdx, sfx, startRound]);

  const play = useCallback(() => {
    const r = analyze(selCards);
    if (!r.valid) { setFlash('속성을 공유하는 카드 2장 이상을 골라라'); sfx.wrong(); return; }
    selCards.forEach((c) => onCorrect?.({ en: c.en, ko: c.ko }));
    sfx.correct(sel.length, r.key === 'root' || r.key === 'ant');
    setPop({ label: r.label, chips: r.chips, mult: r.mult, score: r.score, key: Date.now() });
    setBest((b) => Math.max(b, r.score));
    setTotal((t) => t + r.score);
    const ns = roundScore + r.score; setRoundScore(ns);
    const pl = plays - 1; setPlays(pl);
    // 낸 카드 교체
    setHand((h) => { const kept = h.filter((c) => !sel.includes(c.id)); return [...kept, ...draw(sel.length)]; });
    setSel([]);
    setTimeout(() => mounted.current && nextRoundOrDone(ns, pl), 550);
  }, [selCards, sel, roundScore, plays, draw, onCorrect, sfx, nextRoundOrDone]);

  const discard = useCallback(() => {
    if (discards <= 0 || sel.length === 0) return;
    selCards.forEach((c) => onWrong?.({ en: c.en, ko: c.ko }));
    setHand((h) => { const kept = h.filter((c) => !sel.includes(c.id)); return [...kept, ...draw(sel.length)]; });
    setDiscards((d) => d - 1); setSel([]); sfx.click();
  }, [discards, sel, selCards, draw, onWrong, sfx]);

  const handleExit = useCallback(() => onExit?.(), [onExit]);
  const round = ROUNDS[roundIdx];
  const pct = clamp(roundScore / round.target, 0, 1);

  if (phase === 'done') {
    return (
      <div className="gk-root lh-root">
        <GameKitStyles />
        <AmbientBackground center="#ECE4F0" mid="#C6B2D4" edge="#231732" glow="rgba(130,240,200,.26)" glowAt="50% 40%" watermark="lexicon-hands" />
        <style dangerouslySetInnerHTML={{ __html: LH_CSS }} />
        <Hud muted={sfx.muted} onToggleMute={() => sfx.setMuted((m) => !m)} onExit={handleExit} />
        <GameDone
          mark="lexicon-hands"
          lead={won ? '엔진이 폭발했다' : `${roundIdx + 1}라운드에서 멈췄다`}
          stats={[
            { num: total.toLocaleString(), label: '총점', accent: true },
            { num: `R${roundIdx + (won ? 1 : 0)}/3`, label: won ? '전 라운드 격파' : '도달 라운드' },
            { num: best.toLocaleString(), label: '최고 족보' },
          ]}
          restartLabel="새 런"
          onRestart={() => { setRoundIdx(0); setTotal(0); setBest(0); setWon(false); setPhase('play'); startRound(0); }}
          onExit={handleExit}
        />
      </div>
    );
  }

  return (
    <div className="gk-root lh-root">
      <GameKitStyles />
      <AmbientBackground center="#ECE4F0" mid="#C6B2D4" edge="#231732" glow="rgba(130,240,200,.24)" glowAt="50% 52%" watermark="lexicon-hands" />
      <style dangerouslySetInnerHTML={{ __html: LH_CSS }} />
      <Hud
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={<div className="lh-hud"><span className="gk-stat-label">라운드</span><span className="lh-hud-v">{roundIdx + 1}/3 · 플레이 {plays} · 버림 {discards}</span></div>}
      />

      <main className="gk-stage lh-stage">
        {/* 조커 */}
        <div className="lh-jokers" aria-label="조커">
          {JOKERS.map((j) => (
            <div key={j.id} className="lh-joker" title={j.desc}><span className="lh-joker-ic" aria-hidden>{j.icon}</span><span className="lh-joker-tx"><b>{j.name}</b>{j.desc}</span></div>
          ))}
        </div>

        {/* 목표·점수 */}
        <div className="lh-goal">
          <div className="lh-goal-row"><span className="lh-goal-label">목표</span><span className="lh-goal-target">{round.target.toLocaleString()}</span></div>
          <div className="lh-bar"><div className="lh-bar-fill" style={{ width: `${pct * 100}%` }} /></div>
          <div className="lh-score">{shownRound.toLocaleString()}</div>
        </div>

        {/* 프리뷰 / 팝 */}
        <div className="lh-preview">
          {pop ? (
            <span key={pop.key} className="lh-pop"><b>{pop.label}</b> · {pop.chips} × {pop.mult} = <span className="lh-pop-score">{pop.score.toLocaleString()}</span><ParticleBurst intensity={3} /></span>
          ) : preview.valid ? (
            <span className="lh-prev"><b>{preview.label}</b> · <span className="lh-chips">{preview.chips}</span> × <span className="lh-mult">{preview.mult}</span> = <span className="lh-eq">{preview.score.toLocaleString()}</span></span>
          ) : (
            <span className="lh-prev lh-prev--dim">{flash || '카드를 골라 족보를 만들어라'}</span>
          )}
        </div>

        {/* 손패 */}
        <div className="lh-hand">
          {hand.map((c) => {
            const on = sel.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                className={`lh-card ${on ? 'lh-card--on' : ''}`}
                style={{ ['--dc' as string]: c.domain ? DOMAIN_COLOR[c.domain] : 'var(--bd)' }}
                onClick={() => toggle(c.id)}
                data-en={c.en} data-pos={c.pos} data-root={c.root || ''} data-prefix={c.prefix || ''} data-domain={c.domain || ''}
              >
                <span className="lh-card-en">{c.en}</span>
                <span className="lh-card-ko">{c.ko}</span>
                <span className="lh-card-tags">
                  <span className="lh-tag lh-tag--pos">{POS_KO[c.pos]}</span>
                  {c.root && <span className="lh-tag lh-tag--root">√{c.root}</span>}
                  {c.prefix && <span className="lh-tag lh-tag--pre">{c.prefix}-</span>}
                  {c.domain && <span className="lh-tag lh-tag--dom" style={{ color: DOMAIN_COLOR[c.domain] }}>{DOMAIN_KO[c.domain]}</span>}
                </span>
              </button>
            );
          })}
        </div>

        {/* 액션 */}
        <div className="lh-actions">
          <button type="button" className="gk-btn lh-discard" onClick={discard} disabled={discards <= 0 || sel.length === 0}>버리기 ({discards})</button>
          <button type="button" className="gk-btn gk-btn--primary lh-play" onClick={play} disabled={sel.length < 2}>플레이 ({sel.length})</button>
        </div>
      </main>
    </div>
  );
}

const LH_CSS = `
  .lh-root .gk-stat-label, .lh-hud .gk-stat-label { color: color-mix(in srgb, var(--t2) 80%, #fff); }
  .lh-hud { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.05; }
  .lh-hud-v { font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 800; color: var(--t1); }
  .lh-stage { gap: clamp(8px, 1.8vh, 16px); justify-content: flex-start; padding-top: clamp(10px, 2vh, 18px); }

  .lh-jokers { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; width: min(680px, 96vw); }
  .lh-joker { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-radius: 10px; background: color-mix(in srgb, var(--bg) 60%, transparent); border: 1px solid var(--bd); backdrop-filter: blur(3px); }
  .lh-joker-ic { font-size: 18px; }
  .lh-joker-tx { display: flex; flex-direction: column; line-height: 1.15; font-size: 10.5px; color: var(--t3); }
  .lh-joker-tx b { font-size: 12px; color: var(--t1); font-family: var(--font-display, system-ui); }

  .lh-goal { display: flex; flex-direction: column; align-items: center; gap: 4px; width: min(420px, 90vw); }
  .lh-goal-row { display: flex; align-items: baseline; gap: 8px; }
  .lh-goal-label { font-family: var(--font-english, monospace); font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--t3); }
  .lh-goal-target { font-family: var(--font-display, system-ui); font-size: 15px; font-weight: 800; color: var(--error); }
  .lh-bar { width: 100%; height: 8px; border-radius: 999px; background: color-mix(in srgb, var(--t1) 12%, transparent); overflow: hidden; }
  .lh-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--combo), var(--success)); transition: width .5s var(--ease, cubic-bezier(.3,.7,.3,1)); }
  .lh-score { font-family: var(--font-display, system-ui); font-size: clamp(28px, 6vw, 42px); font-weight: 900; color: var(--t1); font-variant-numeric: tabular-nums; line-height: 1; }

  .lh-preview { min-height: 30px; display: grid; place-items: center; text-align: center; }
  .lh-prev { font-size: 14px; color: var(--t2); font-weight: 600; }
  .lh-prev b { color: var(--t1); }
  .lh-prev--dim { color: var(--t3); font-style: italic; }
  .lh-chips { color: var(--combo); font-weight: 800; }
  .lh-mult { color: var(--streak); font-weight: 800; }
  .lh-eq { color: var(--success); font-weight: 900; font-size: 16px; }
  .lh-pop { position: relative; font-size: 15px; font-weight: 700; color: var(--t1); animation: gk-pop .4s ease-out; }
  .lh-pop b { color: var(--combo); }
  .lh-pop-score { color: var(--success); font-weight: 900; font-size: 20px; }

  .lh-hand { display: flex; gap: clamp(5px, 1vw, 9px); justify-content: center; flex-wrap: wrap; width: min(760px, 98vw); }
  .lh-card { position: relative; display: flex; flex-direction: column; align-items: center; gap: 3px; width: clamp(78px, 11.5vw, 92px); padding: 10px 6px 8px; border-radius: 11px; border: 1.5px solid var(--bd); border-top: 3px solid var(--dc); background: color-mix(in srgb, var(--bg) 86%, #fff); cursor: pointer; transition: transform .12s var(--ease, ease-out), box-shadow .15s, border-color .15s; }
  .lh-card:hover { transform: translateY(-4px); box-shadow: 0 10px 22px -8px rgba(30,16,40,.5); }
  .lh-card:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 28%, transparent); }
  .lh-card--on { transform: translateY(-10px); border-color: var(--combo); box-shadow: 0 0 0 2px var(--combo), 0 14px 26px -8px color-mix(in srgb, var(--combo) 40%, transparent); }
  .lh-card-en { font-family: var(--font-english, system-ui); font-size: clamp(12px, 2.2vw, 14px); font-weight: 800; color: var(--t1); line-height: 1.05; text-align: center; word-break: break-all; }
  .lh-card-ko { font-size: 10.5px; color: var(--t3); text-align: center; line-height: 1.1; }
  .lh-card-tags { display: flex; flex-wrap: wrap; gap: 2px; justify-content: center; margin-top: 2px; }
  .lh-tag { font-family: var(--font-english, monospace); font-size: 8.5px; font-weight: 700; padding: 1px 4px; border-radius: 4px; background: color-mix(in srgb, var(--t1) 8%, transparent); color: var(--t2); }
  .lh-tag--root { color: var(--combo); }
  .lh-tag--pre { color: var(--active); }

  .lh-actions { display: flex; gap: 12px; margin-top: 2px; }
  .lh-discard { min-height: 44px; }
  .lh-play { min-width: 150px; }

  @media (prefers-reduced-motion: reduce) { .lh-card, .lh-bar-fill, .lh-pop { transition: none; animation: none; } }
`;
