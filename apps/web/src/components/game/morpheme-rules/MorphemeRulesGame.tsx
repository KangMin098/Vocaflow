// apps/web/src/components/game/morpheme-rules/MorphemeRulesGame.tsx
// Morpheme Rules (형태소가 곧 의미) — Baba Is You 계열. 형태소 블록(접두사+어근)을 조립하면
// 그 단어의 '뜻이 세계에 발동'한다: UN+LOCK→잠긴 문이 열리고, RE+BUILD→무너진 다리가 재건.
// 실재 단어인지(형태론) + 그 뜻이 이 장애물에 통하는지(의미) 둘 다 알아야 푸는 연역 퍼즐.

'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles, AmbientBackground, GameMark, Hud, GameDone, ParticleBurst, useSfx, type Word,
} from '@/components/game/_shared/gamekit';

interface Props { wordPool?: Word[]; onExit?: () => void; onCorrect?: (w: Word) => void; onWrong?: (w: Word) => void; }

interface Morph { text: string; ko: string; }
interface Obstacle { id: string; icon: string; need: string; word: string; done: string; effect: string; }
interface Level { title: string; sub: string; prefixes: Morph[]; roots: Morph[]; obstacles: Obstacle[]; }

// 이 형태소들로 만들 수 있는 실재 단어 (형태론 검증)
const VALID: Record<string, string> = {
  unlock: '열다', rebuild: '재건하다', enlarge: '확대하다',
  disappear: '사라지다', uncover: '드러내다', overload: '과부하시키다',
  unload: '짐을 내리다', discover: '발견하다',
};

const LEVELS: Level[] = [
  {
    title: '봉인된 회랑', sub: '형태소를 조립해 장애물의 뜻을 발동시켜라.',
    prefixes: [{ text: 'un', ko: '반대·제거' }, { text: 're', ko: '다시' }, { text: 'en', ko: '~하게 만들다' }],
    roots: [{ text: 'lock', ko: '잠그다' }, { text: 'build', ko: '짓다' }, { text: 'large', ko: '큰' }],
    obstacles: [
      { id: 'o1', icon: '🔒', need: '봉인된 철문 — 잠금을 풀어라', word: 'unlock', done: '🔓', effect: '문이 열렸다' },
      { id: 'o2', icon: '🧱', need: '무너진 다리 — 다시 세워라', word: 'rebuild', done: '🌉', effect: '다리가 재건됐다' },
      { id: 'o3', icon: '🔩', need: '너무 작은 발판 — 크게 만들어라', word: 'enlarge', done: '🟦', effect: '발판이 커졌다' },
    ],
  },
  {
    title: '사라진 방', sub: '올바른 접두사를 붙여 세계를 바꿔라.',
    prefixes: [{ text: 'dis', ko: '반대' }, { text: 'un', ko: '제거' }, { text: 'over', ko: '과도하게' }],
    roots: [{ text: 'appear', ko: '나타나다' }, { text: 'cover', ko: '덮다' }, { text: 'load', ko: '싣다' }],
    obstacles: [
      { id: 'p1', icon: '🧱', need: '단단한 벽 — 없애 버려라', word: 'disappear', done: '💨', effect: '벽이 사라졌다' },
      { id: 'p2', icon: '⚙️', need: '과열된 장치가 길을 막음 — 과부하로 멈춰라', word: 'overload', done: '🛑', effect: '장치가 정지했다' },
      { id: 'p3', icon: '📦', need: '무거운 짐 — 내려놓아라', word: 'unload', done: '🫙', effect: '짐을 내렸다' },
    ],
  },
];

export function MorphemeRulesGame({ onExit, onCorrect }: Props) {
  const sfx = useSfx();
  const [levelIdx, setLevelIdx] = useState(0);
  const lv = LEVELS[levelIdx];
  const [pre, setPre] = useState<Morph | null>(null);
  const [root, setRoot] = useState<Morph | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [just, setJust] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [phase, setPhase] = useState<'play' | 'done'>('play');
  const [built, setBuilt] = useState(0);
  const [miss, setMiss] = useState(0);
  const mounted = useRef(true);

  const assembled = (pre?.text ?? '') + (root?.text ?? '');
  const validWord = pre && root ? VALID[assembled] : undefined;
  const total = useMemo(() => LEVELS.reduce((n, l) => n + l.obstacles.length, 0), []);
  const cleared = lv.obstacles.every((o) => done.has(o.id));

  const clearBench = () => { setPre(null); setRoot(null); };

  const build = useCallback(() => {
    if (cleared) {
      if (levelIdx + 1 < LEVELS.length) { setLevelIdx((i) => i + 1); setDone(new Set()); clearBench(); setMsg(''); setJust(null); sfx.click(); }
      else { sfx.fanfare(); setPhase('done'); }
      return;
    }
    if (!pre || !root) { setMsg('접두사와 어근을 모두 놓아라'); return; }
    const word = assembled;
    if (!VALID[word]) { setMsg(`'${word}' — 그런 단어는 없다`); setMiss((m) => m + 1); sfx.wrong(); return; }
    const target = lv.obstacles.find((o) => !done.has(o.id) && o.word === word);
    if (target) {
      setDone((s) => new Set(s).add(target.id));
      setJust(target.id); setTimeout(() => mounted.current && setJust(null), 700);
      setBuilt((b) => b + 1);
      onCorrect?.({ en: word, ko: VALID[word] });
      sfx.correct(built + 1, true);
      const allDone = lv.obstacles.every((o) => done.has(o.id) || o.id === target.id);
      setMsg(allDone ? '통로가 열렸다.' : `${word} — ${target.effect}!`);
      clearBench();
    } else {
      setMsg(`'${word}'(${VALID[word]})는 실재하지만, 이 장애물엔 통하지 않는다`);
      setMiss((m) => m + 1); sfx.wrong();
    }
  }, [cleared, levelIdx, pre, root, assembled, lv.obstacles, done, built, onCorrect, sfx]);

  const handleExit = useCallback(() => onExit?.(), [onExit]);

  if (phase === 'done') {
    return (
      <div className="gk-root mr-root">
        <GameKitStyles />
        <AmbientBackground center="#EAEEF3" mid="#B9C4D2" edge="#1A2330" glow="rgba(120,200,255,.26)" glowAt="50% 30%" watermark="morpheme-rules" />
        <style dangerouslySetInnerHTML={{ __html: MR_CSS }} />
        <Hud muted={sfx.muted} onToggleMute={() => sfx.setMuted((m) => !m)} onExit={handleExit} />
        <GameDone
          mark="morpheme-rules"
          lead="말이 세계를 바꿨다"
          stats={[
            { num: built, label: '발동한 단어', accent: true },
            { num: `${Math.round((built / (built + miss || 1)) * 100)}%`, label: '조립 효율' },
            { num: LEVELS.length, label: '통과한 회랑' },
          ]}
          restartLabel="다시 조립"
          onRestart={() => { setLevelIdx(0); setDone(new Set()); clearBench(); setMsg(''); setBuilt(0); setMiss(0); setPhase('play'); }}
          onExit={handleExit}
        />
      </div>
    );
  }

  return (
    <div className="gk-root mr-root">
      <GameKitStyles />
      <AmbientBackground center="#EAEEF3" mid="#B9C4D2" edge="#1A2330" glow="rgba(120,200,255,.24)" glowAt="50% 24%" watermark="morpheme-rules" />
      <style dangerouslySetInnerHTML={{ __html: MR_CSS }} />
      <Hud
        progress={(levelIdx + (cleared ? 1 : 0)) / LEVELS.length}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={<div className="mr-hud"><span className="gk-stat-label">회랑</span><span className="mr-hud-v">{levelIdx + 1}/{LEVELS.length} · 해결 {done.size}/{lv.obstacles.length}</span></div>}
      />

      <main className="gk-stage mr-stage">
        <div className="mr-head"><h1 className="mr-title">회랑 {levelIdx + 1} · {lv.title}</h1><p className="mr-sub">{lv.sub}</p></div>

        {/* 장애물 */}
        <div className="mr-obs" role="group" aria-label="장애물">
          {lv.obstacles.map((o) => {
            const ok = done.has(o.id);
            return (
              <div key={o.id} className={`mr-ob ${ok ? 'mr-ob--done' : ''} ${just === o.id ? 'mr-ob--just' : ''}`}>
                <span className="mr-ob-ic">{ok ? o.done : o.icon}{just === o.id && <ParticleBurst intensity={3} />}</span>
                {ok ? <span className="mr-ob-word"><b>{o.word}</b> {VALID[o.word]}</span> : <span className="mr-ob-need">{o.need}</span>}
              </div>
            );
          })}
        </div>

        {/* 조립대 */}
        <div className="mr-bench">
          <button type="button" className={`mr-slot ${pre ? 'mr-slot--on mr-slot--pre' : ''}`} onClick={() => pre && setPre(null)}>{pre ? pre.text : '접두사'}</button>
          <span className="mr-op">+</span>
          <button type="button" className={`mr-slot ${root ? 'mr-slot--on mr-slot--root' : ''}`} onClick={() => root && setRoot(null)}>{root ? root.text : '어근'}</button>
          <span className="mr-op">=</span>
          <span className={`mr-result ${validWord ? 'mr-result--ok' : pre && root ? 'mr-result--no' : ''}`}>
            {pre && root ? <>{assembled} {validWord ? <em className="mr-chk">✓ {validWord}</em> : <em className="mr-x">✗ 없는 단어</em>}</> : '···'}
          </span>
        </div>

        {/* 형태소 블록 */}
        <div className="mr-morphs">
          <div className="mr-morph-row">
            {lv.prefixes.map((m) => (
              <button key={m.text} type="button" className={`mr-block mr-block--pre ${pre?.text === m.text ? 'mr-block--sel' : ''}`} onClick={() => { sfx.click(); setPre((p) => (p?.text === m.text ? null : m)); setMsg(''); }}>
                <b>{m.text}-</b><span>{m.ko}</span>
              </button>
            ))}
          </div>
          <div className="mr-morph-row">
            {lv.roots.map((m) => (
              <button key={m.text} type="button" className={`mr-block mr-block--root ${root?.text === m.text ? 'mr-block--sel' : ''}`} onClick={() => { sfx.click(); setRoot((r) => (r?.text === m.text ? null : m)); setMsg(''); }}>
                <b>{m.text}</b><span>{m.ko}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mr-actions">
          {msg && <span className={`mr-msg ${cleared ? 'mr-msg--ok' : ''}`}>{msg}</span>}
          <button type="button" className="gk-btn gk-btn--primary mr-build" onClick={build} disabled={!cleared && (!pre || !root)}>
            {cleared ? (levelIdx + 1 < LEVELS.length ? '다음 회랑 →' : '세계를 되돌리다') : '조립 발동!'}
          </button>
        </div>
      </main>
    </div>
  );
}

const MR_CSS = `
  .mr-hud { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.05; }
  .mr-hud-v { font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 800; color: var(--t1); }
  .mr-stage { gap: clamp(12px, 2.4vh, 22px); justify-content: flex-start; padding-top: clamp(10px, 2vh, 20px); }
  .mr-head { text-align: center; }
  .mr-title { margin: 0; font-family: var(--font-display, system-ui); font-size: clamp(19px, 3vw, 24px); font-weight: 800; }
  .mr-sub { margin: 3px 0 0; font-size: 13px; color: var(--t3); }

  .mr-obs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; width: min(620px, 96vw); }
  .mr-ob { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 8px; border-radius: 12px; border: 1.5px solid var(--bd); background: color-mix(in srgb, var(--bg) 64%, transparent); text-align: center; transition: border-color .25s, background .25s; }
  .mr-ob-ic { position: relative; font-size: 32px; line-height: 1; }
  .mr-ob-need { font-size: 11px; color: var(--t2); line-height: 1.3; }
  .mr-ob--done { border-color: var(--success); background: color-mix(in srgb, var(--success) 10%, var(--bg)); }
  .mr-ob-word { font-size: 11px; color: var(--t3); }
  .mr-ob-word b { font-family: var(--font-english, system-ui); font-size: 13px; color: var(--success); display: block; }
  .mr-ob--just { animation: gk-pop .5s ease-out; }

  .mr-bench { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; padding: 12px 16px; border-radius: 12px; background: color-mix(in srgb, var(--bg) 55%, transparent); border: 1px solid var(--bd); backdrop-filter: blur(3px); }
  .mr-slot { min-width: 78px; min-height: 46px; padding: 8px 14px; border-radius: 10px; border: 2px dashed var(--bd); background: transparent; color: var(--t3); font-family: var(--font-english, monospace); font-size: 16px; font-weight: 800; cursor: pointer; }
  .mr-slot--on { border-style: solid; color: var(--ti); }
  .mr-slot--pre { background: var(--combo); border-color: var(--combo); }
  .mr-slot--root { background: var(--active); border-color: var(--active); }
  .mr-op { font-family: var(--font-english, monospace); font-size: 18px; font-weight: 800; color: var(--t3); }
  .mr-result { font-family: var(--font-english, system-ui); font-size: 18px; font-weight: 800; color: var(--t3); min-width: 120px; }
  .mr-result--ok { color: var(--success); }
  .mr-result--no { color: var(--error); }
  .mr-chk { font-style: normal; font-size: 12px; font-weight: 700; }
  .mr-x { font-style: normal; font-size: 12px; font-weight: 700; color: var(--error); }

  .mr-morphs { display: flex; flex-direction: column; gap: 10px; }
  .mr-morph-row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
  .mr-block { display: flex; flex-direction: column; align-items: center; gap: 1px; min-width: 92px; padding: 10px 14px; border-radius: 12px; border: 2px solid; cursor: pointer; transition: transform .1s, box-shadow .15s, filter .15s; }
  .mr-block b { font-family: var(--font-english, monospace); font-size: 18px; font-weight: 800; letter-spacing: .02em; }
  .mr-block span { font-size: 10px; opacity: .82; }
  .mr-block--pre { border-color: var(--combo); color: var(--combo); background: color-mix(in srgb, var(--combo) 8%, var(--bg)); }
  .mr-block--root { border-color: var(--active); color: color-mix(in srgb, var(--active) 84%, #000); background: color-mix(in srgb, var(--active) 10%, var(--bg)); }
  .mr-block:hover { transform: translateY(-3px); box-shadow: 0 8px 18px -8px rgba(20,26,40,.5); }
  .mr-block:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 30%, transparent); }
  .mr-block--sel { transform: translateY(-3px); box-shadow: 0 0 0 2px currentColor, 0 10px 20px -8px color-mix(in srgb, currentColor 40%, transparent); filter: brightness(1.04); }

  .mr-actions { display: flex; flex-direction: column; align-items: center; gap: 8px; padding-bottom: 8px; min-height: 40px; }
  .mr-msg { font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13.5px; font-weight: 700; color: var(--warning); text-align: center; max-width: 52ch; }
  .mr-msg--ok { color: var(--success); }
  .mr-build { min-width: 160px; }

  @media (prefers-reduced-motion: reduce) { .mr-ob--just, .mr-block { animation: none; transition: none; } }
`;
