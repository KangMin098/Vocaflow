// apps/web/src/components/game/morphmerge/MorphmergeGame.tsx
// Morphmerge — 어족 합치기(2048 / Merge Dragons). 같은 lemma 의 형태(굴절형)를 알아보고 골라
// 합치면 "어족 보석"으로 수집된다. 미개척 채널 = 형태론/굴절(특히 불규칙 활용)의 인지 훈련.
// 스코프 단어의 inflected 형을 시드(없으면 불규칙 풍부한 기본 어족). 게임킷 공용 인프라.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles,
  AmbientBackground,
  GameDone,
  NotEnoughWords,
  useSfx,
  useCountUp,
  shuffle,
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

interface Family { lemma: string; ko: string; forms: string[] }
interface Tile { id: number; form: string; lemma: string }

const clean = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

// 기본 어족 — 불규칙 활용 위주(학습 가치 높음).
const DEFAULT_FAMILIES: Family[] = [
  { lemma: 'go', ko: '가다', forms: ['go', 'goes', 'going', 'went', 'gone'] },
  { lemma: 'run', ko: '달리다', forms: ['run', 'runs', 'running', 'ran'] },
  { lemma: 'take', ko: '가져가다', forms: ['take', 'takes', 'taking', 'took', 'taken'] },
  { lemma: 'write', ko: '쓰다', forms: ['write', 'writes', 'writing', 'wrote', 'written'] },
  { lemma: 'begin', ko: '시작하다', forms: ['begin', 'begins', 'beginning', 'began', 'begun'] },
  { lemma: 'know', ko: '알다', forms: ['know', 'knows', 'knowing', 'knew', 'known'] },
  { lemma: 'see', ko: '보다', forms: ['see', 'sees', 'seeing', 'saw', 'seen'] },
  { lemma: 'give', ko: '주다', forms: ['give', 'gives', 'giving', 'gave', 'given'] },
  { lemma: 'break', ko: '깨다', forms: ['break', 'breaks', 'breaking', 'broke', 'broken'] },
  { lemma: 'child', ko: '아이', forms: ['child', 'children'] },
  { lemma: 'foot', ko: '발', forms: ['foot', 'feet'] },
  { lemma: 'man', ko: '남자', forms: ['man', 'men'] },
];

const ACTIVE = 4; // 동시 보드 어족 수
const SESSION_MS = 90000;

function buildFamilies(pool?: Word[]): Family[] {
  const scoped: Family[] = [];
  for (const w of pool ?? []) {
    if (!w.en || !w.ko || !w.inflected || w.inflected.length === 0) continue;
    const forms = Array.from(new Set([clean(w.en), ...w.inflected.map(clean)])).filter((f) => f.length >= 2);
    if (forms.length >= 2) scoped.push({ lemma: clean(w.en), ko: w.ko, forms });
  }
  // 스코프 어족이 충분하면 그것으로, 아니면 기본 불규칙 어족.
  return scoped.length >= ACTIVE ? scoped : DEFAULT_FAMILIES;
}

export function MorphmergeGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();
  const families = useMemo(() => buildFamilies(wordPool), [wordPool]);
  const enough = families.length >= 2;

  const [tiles, setTiles] = useState<Tile[]>([]);
  const [active, setActive] = useState<Family[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [reject, setReject] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [collected, setCollected] = useState(0);
  const [last, setLast] = useState<Family | null>(null);
  const [timeLeft, setTimeLeft] = useState(SESSION_MS);
  const [phase, setPhase] = useState<'playing' | 'done'>('playing');
  const [announce, setAnnounce] = useState('');

  const shownScore = useCountUp(score);
  const idRef = useRef(0);
  const comboRef = useRef(0);
  const endRef = useRef(0);
  const rafRef = useRef(0);
  const bagRef = useRef<Family[]>([]);
  const mounted = useRef(true);

  const drawFamily = useCallback((): Family => {
    if (bagRef.current.length === 0) bagRef.current = shuffle(families);
    return bagRef.current.shift()!;
  }, [families]);

  const tilesOf = useCallback((f: Family): Tile[] => f.forms.map((form) => {
    idRef.current += 1;
    return { id: idRef.current, form, lemma: f.lemma };
  }), []);

  const newGame = useCallback(() => {
    if (!enough) return;
    idRef.current = 0;
    bagRef.current = shuffle(families);
    const act: Family[] = [];
    for (let i = 0; i < Math.min(ACTIVE, families.length); i++) act.push(drawFamily());
    setActive(act);
    setTiles(shuffle(act.flatMap(tilesOf)));
    setSel([]); setScore(0); setCombo(0); setBestCombo(0); setCollected(0); setLast(null);
    comboRef.current = 0;
    setTimeLeft(SESSION_MS); setPhase('playing');
    endRef.current = Date.now() + SESSION_MS;
  }, [enough, families, drawFamily, tilesOf]);

  useEffect(() => { mounted.current = true; newGame(); return () => { mounted.current = false; cancelAnimationFrame(rafRef.current); }; }, [newGame]);

  // 타이머 (rAF)
  useEffect(() => {
    if (phase !== 'playing') return;
    const tick = () => {
      if (!mounted.current) return;
      const left = Math.max(0, endRef.current - Date.now());
      setTimeLeft(left);
      if (left <= 0) { sfx.fanfare(); setPhase('done'); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, sfx]);

  const toggle = useCallback((id: number) => {
    if (phase !== 'playing') return;
    setSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    sfx.click();
  }, [phase, sfx]);

  const merge = useCallback(() => {
    if (phase !== 'playing' || sel.length < 2) return;
    const chosen = tiles.filter((t) => sel.includes(t.id));
    const lemma = chosen[0].lemma;
    const allSame = chosen.every((t) => t.lemma === lemma);
    const fam = active.find((f) => f.lemma === lemma);
    if (!allSame) {
      // 다른 어족이 섞임 — 오답(부드러운 거절 + 콤보 리셋)
      setReject(sel);
      comboRef.current = 0; setCombo(0);
      sfx.wrong();
      setAnnounce('같은 어족이 아니에요');
      onWrong?.({ en: chosen[0].lemma, ko: fam?.ko ?? '' });
      window.setTimeout(() => { if (mounted.current) { setReject([]); setSel([]); } }, 320);
      return;
    }
    const boardOfLemma = tiles.filter((t) => t.lemma === lemma);
    if (!fam || chosen.length < boardOfLemma.length) {
      // 같은 어족이지만 아직 다 못 모음 — 감점 없이 안내(형태를 전부 골라야 완성)
      sfx.click();
      setAnnounce(`이 어족의 형태를 모두 고르세요 (${chosen.length}/${boardOfLemma.length})`);
      return;
    }
    // 성공 — 어족의 모든 형태를 골라 완성
    const nc = comboRef.current + 1; comboRef.current = nc;
    setCombo(nc); setBestCombo((b) => Math.max(b, nc));
    const gain = Math.round((60 + fam.forms.length * 20) * (1 + Math.min(nc, 12) * 0.12));
    setScore((s) => s + gain);
    setCollected((c) => c + 1);
    setLast(fam);
    sfx.correct(nc, nc % 3 === 0);
    onCorrect?.({ en: fam.lemma, ko: fam.ko });
    setAnnounce(`${fam.lemma} 어족 완성 · ${fam.ko}`);
    // 이 어족 제거 + 새 어족 보충
    const nf = drawFamily();
    setActive((prev) => prev.map((f) => (f.lemma === lemma ? nf : f)));
    setTiles((prev) => {
      const kept = prev.filter((t) => t.lemma !== lemma);
      return shuffle([...kept, ...tilesOf(nf)]);
    });
    setSel([]);
  }, [phase, sel, tiles, active, drawFamily, tilesOf, sfx, onCorrect, onWrong]);

  const secs = Math.ceil(timeLeft / 1000);
  const comboTier = clamp(Math.floor(combo / 3), 0, 3);

  if (!enough) return <NotEnoughWords need={5} onExit={onExit} />;

  if (phase === 'done') {
    return (
      <div className="gk-root mm-root">
        <GameKitStyles />
        <AmbientBackground center="#EAF3EC" mid="#BEDFC6" edge="#1E3A2C" glow="rgba(130,224,168,.3)" glowAt="50% 30%" watermark="morphmerge" />
        <style dangerouslySetInnerHTML={{ __html: MM_CSS }} />
        <GameMusic gameId="morphmerge" />
        <GameDone
          lead={collected >= 8 ? '어족을 훌륭히 엮었어요' : '오늘 잘 마쳤어요'}
          stats={[
            { num: score.toLocaleString(), label: '점수', accent: true },
            { num: collected, label: '엮은 어족' },
            { num: `🔥 ${bestCombo}`, label: '최고 콤보' },
          ]}
          onRestart={newGame}
          onExit={() => onExit?.()}
          mark="morphmerge"
        />
      </div>
    );
  }

  return (
    <div className="gk-root mm-root">
      <GameKitStyles />
      <AmbientBackground center="#EAF3EC" mid="#BEDFC6" edge="#1E3A2C" glow="rgba(130,224,168,.28)" glowAt="50% 26%" watermark="morphmerge" />
      <style dangerouslySetInnerHTML={{ __html: MM_CSS }} />
      <GameMusic gameId="morphmerge" />
      <div className="gk-sr" aria-live="polite">{announce}</div>

      <header className="mm-hud">
        <div className="mm-stat"><span className="mm-lbl">SCORE</span><span key={score} className="mm-score gk-bump">{shownScore.toLocaleString()}</span></div>
        <div className={`mm-time ${secs <= 10 ? 'mm-time--low' : ''}`}>{secs}s</div>
        <div className="mm-stat mm-stat--r"><span className="mm-lbl">콤보</span>
          <span key={combo} data-tier={comboTier} className={`mm-combo ${combo > 0 ? 'mm-combo--on gk-bump' : ''}`}>{combo > 0 ? `🔥 ${combo}` : '—'}</span>
        </div>
        {onExit && <button type="button" className="gk-exit" onClick={onExit}>나가기</button>}
      </header>

      <p className="mm-hint">같은 <b>어족(같은 단어의 형태들)</b>을 골라 <b>합치기</b>. 예: go · goes · went · gone</p>

      <div className="mm-board">
        {tiles.map((t) => {
          const on = sel.includes(t.id);
          const bad = reject.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              className={`mm-tile ${on ? 'mm-tile--on' : ''} ${bad ? 'mm-tile--bad' : ''}`}
              onClick={() => toggle(t.id)}
              aria-pressed={on}
            >
              {t.form}
            </button>
          );
        })}
      </div>

      <div className="mm-actions">
        <button type="button" className="gk-btn gk-btn--primary mm-merge" onClick={merge} disabled={sel.length < 2}>
          합치기 {sel.length >= 2 ? `(${sel.length})` : ''}
        </button>
        <button type="button" className="gk-btn" onClick={() => setSel([])} disabled={sel.length === 0}>선택 해제</button>
      </div>
      {last && <div className="mm-last" aria-hidden="true"><b>{last.lemma}</b> 어족 · {last.ko} <span>{last.forms.join(' · ')}</span></div>}
    </div>
  );
}

const MM_CSS = `
  .mm-root { display: flex; flex-direction: column; }
  .mm-hud { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--bd); }
  .mm-stat { display: flex; flex-direction: column; line-height: 1.05; }
  .mm-stat--r { align-items: flex-end; }
  .mm-lbl { font-size: 10px; font-weight: 700; letter-spacing: .12em; color: var(--t3); text-transform: uppercase; }
  .mm-score { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--combo); }
  .mm-time { justify-self: center; font-family: var(--font-english, ui-monospace, monospace); font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--t2); }
  .mm-time--low { color: var(--error); }
  .mm-combo { font-size: 15px; font-weight: 800; color: var(--t4); font-variant-numeric: tabular-nums; }
  .mm-combo--on { color: var(--streak); }
  .mm-combo--on[data-tier="2"] { color: #E8622F; } .mm-combo--on[data-tier="3"] { color: #E0322F; }

  .mm-hint { margin: 12px 16px 0; text-align: center; font-size: 13px; color: var(--t3); }
  .mm-hint b { color: var(--t2); }
  .mm-board { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-wrap: wrap; align-content: flex-start; justify-content: center; gap: 10px; padding: 16px; }
  .mm-tile { position: relative; overflow: visible; min-height: 52px; padding: 12px 18px; border-radius: var(--r-lg, 14px); border: 1.5px solid var(--bd); background: var(--bg); color: var(--t1); font-family: var(--font-english, ui-monospace, monospace); font-size: clamp(16px, 3.6vw, 21px); font-weight: 700; cursor: pointer; transition: transform .2s var(--ease-spring), border-color .15s, background .15s, box-shadow .15s; }
  .mm-tile:hover:not(.mm-tile--on) { border-color: var(--t3); transform: translateY(-2px); }
  .mm-tile:active { transform: scale(.95); }
  .mm-tile--on { border-color: var(--combo); background: color-mix(in srgb, var(--combo) 12%, var(--bg)); color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 24%, transparent); }
  .mm-tile--bad { border-color: var(--error); background: var(--error-light); color: var(--error); animation: gk-shake .3s ease-in-out; }
  .mm-tile:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }

  .mm-actions { display: flex; gap: 10px; justify-content: center; padding: 8px 16px; }
  .mm-merge { min-width: 160px; }
  .mm-last { text-align: center; font-size: 12.5px; color: var(--t3); padding: 4px 16px calc(12px + env(safe-area-inset-bottom, 0px)); }
  .mm-last b { color: var(--success); font-family: var(--font-english, ui-monospace, monospace); }
  .mm-last span { color: var(--t4); }

  @media (prefers-reduced-motion: reduce) { .mm-tile { transition: none; } .mm-tile--bad { animation: none; } }
`;
