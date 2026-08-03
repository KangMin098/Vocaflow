// apps/web/src/components/game/lexicon-estate/LexiconEstateGame.tsx
// Lexicon Estate — 의미장 인접 배치·드래프트 (Blue Prince 계열). 청사진 저택 3×3에 단어-방을
// 드래프트해 배치. 인접(상하좌우)한 방이 같은 의미장이면 '복도'로 연결(점수·글로우). 같은
// 의미장끼리 뭉치도록 배치 최적화 = 의미 네트워크(어휘의 연상 웹) 감각 훈련.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles, AmbientBackground, Hud, GameDone, ParticleBurst, useSfx, useCountUp, shuffle, type Word,
  GameMusic,
} from '@/components/game/_shared/gamekit';

interface Props { wordPool?: Word[]; onExit?: () => void; onCorrect?: (w: Word) => void; onWrong?: (w: Word) => void; }

interface Room { en: string; ko: string; cat: string; }
const CAT_KO: Record<string, string> = { emotion: '감정', nature: '자연', body: '신체', money: '금융' };
const CAT_COLOR: Record<string, string> = { emotion: '#E06A9C', nature: '#4FB07A', body: '#D2603A', money: '#3FA9B8' };

// 4 의미장 × 6 단어 — 3×3 도면에서 클러스터(복도) 형성이 가능한 밀도.
const BANK: Room[] = [
  { en: 'joy', ko: '기쁨', cat: 'emotion' }, { en: 'anger', ko: '분노', cat: 'emotion' }, { en: 'fear', ko: '두려움', cat: 'emotion' }, { en: 'grief', ko: '슬픔', cat: 'emotion' }, { en: 'hope', ko: '희망', cat: 'emotion' }, { en: 'calm', ko: '평온', cat: 'emotion' },
  { en: 'river', ko: '강', cat: 'nature' }, { en: 'forest', ko: '숲', cat: 'nature' }, { en: 'mountain', ko: '산', cat: 'nature' }, { en: 'desert', ko: '사막', cat: 'nature' }, { en: 'ocean', ko: '바다', cat: 'nature' }, { en: 'valley', ko: '계곡', cat: 'nature' },
  { en: 'heart', ko: '심장', cat: 'body' }, { en: 'bone', ko: '뼈', cat: 'body' }, { en: 'muscle', ko: '근육', cat: 'body' }, { en: 'nerve', ko: '신경', cat: 'body' }, { en: 'lung', ko: '폐', cat: 'body' }, { en: 'spine', ko: '척추', cat: 'body' },
  { en: 'profit', ko: '이익', cat: 'money' }, { en: 'debt', ko: '빚', cat: 'money' }, { en: 'wage', ko: '임금', cat: 'money' }, { en: 'budget', ko: '예산', cat: 'money' }, { en: 'tax', ko: '세금', cat: 'money' }, { en: 'loan', ko: '대출', cat: 'money' },
];

const N = 9; // 3×3
const NEIGH = (i: number): number[] => {
  const r = Math.floor(i / 3), c = i % 3, out: number[] = [];
  if (r > 0) out.push(i - 3); if (r < 2) out.push(i + 3);
  if (c > 0) out.push(i - 1); if (c < 2) out.push(i + 1);
  return out;
};

export function LexiconEstateGame({ wordPool, onExit, onCorrect }: Props) {
  void wordPool;
  const sfx = useSfx();
  const deck = useRef<Room[]>([]);
  const [grid, setGrid] = useState<(Room | null)[]>(Array(N).fill(null));
  const [draft, setDraft] = useState<Room[]>([]);
  const [held, setHeld] = useState<number | null>(null);
  const [placed, setPlaced] = useState(0);
  const [conns, setConns] = useState(0);
  const [phase, setPhase] = useState<'build' | 'done'>('build');
  const [flash, setFlash] = useState('');
  const [justLinked, setJustLinked] = useState<number | null>(null);
  const shownConns = useCountUp(conns);
  const mounted = useRef(true);

  const start = useCallback(() => {
    deck.current = shuffle(BANK);
    setGrid(Array(N).fill(null)); setDraft(deck.current.splice(0, 3)); setHeld(null);
    setPlaced(0); setConns(0); setPhase('build'); setFlash(''); setJustLinked(null);
  }, []);
  useEffect(() => { mounted.current = true; start(); return () => { mounted.current = false; }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 연결(복도) 계산 — 같은 cat 인접 쌍 수 + 연결된 칸
  const compute = useCallback((g: (Room | null)[]) => {
    let pairs = 0; const linked = new Set<number>();
    for (let i = 0; i < N; i++) {
      const a = g[i]; if (!a) continue;
      for (const j of NEIGH(i)) {
        if (j > i) { const bb = g[j]; if (bb && bb.cat === a.cat) { pairs++; linked.add(i); linked.add(j); } }
        else { const bb = g[j]; if (bb && bb.cat === a.cat) linked.add(i); }
      }
    }
    return { pairs, linked };
  }, []);
  const linkedSet = useMemo(() => compute(grid).linked, [grid, compute]);

  const place = useCallback((cell: number) => {
    if (phase !== 'build' || held === null || grid[cell]) return;
    const room = draft[held];
    const g = grid.slice(); g[cell] = room;
    const before = compute(grid).pairs;
    const after = compute(g).pairs;
    const gained = after - before;
    setGrid(g); setConns(after);
    onCorrect?.({ en: room.en, ko: room.ko });
    if (gained > 0) { sfx.correct(after, true); setJustLinked(cell); setTimeout(() => mounted.current && setJustLinked(null), 700); setFlash(`복도 연결 +${gained}`); }
    else { sfx.click(); setFlash(''); }
    // 드래프트 보충(사용한 슬롯만)
    setDraft((d) => { const nd = d.slice(); const next = deck.current.shift(); nd[held] = next ?? nd[held]; return nd; });
    setHeld(null);
    const np = placed + 1; setPlaced(np);
    if (np >= N) { setTimeout(() => mounted.current && (sfx.fanfare(), setPhase('done')), 500); }
  }, [phase, held, grid, draft, placed, compute, onCorrect, sfx]);

  const handleExit = useCallback(() => onExit?.(), [onExit]);
  const maxPairs = 12;

  if (phase === 'done') {
    const grade = conns >= 8 ? '완벽한 설계' : conns >= 5 ? '훌륭한 저택' : '저택 완성';
    return (
      <div className="gk-root le-root">

            <GameMusic gameId="lexicon-estate" />
      <div className="gk-sr" aria-live="polite">{flash}</div>
        <GameKitStyles />
        <AmbientBackground center="#E4ECF5" mid="#A9BFD8" edge="#152238" glow="rgba(120,180,255,.3)" glowAt="50% 30%" watermark="lexicon-estate" />
        <style dangerouslySetInnerHTML={{ __html: LE_CSS }} />
        <Hud muted={sfx.muted} onToggleMute={() => sfx.setMuted((m) => !m)} onExit={handleExit} />
        <GameDone
          mark="lexicon-estate"
          lead={grade}
          stats={[
            { num: `${conns}`, label: `복도 연결 · 최대 ${maxPairs}`, accent: true },
            { num: `${Math.round((conns / maxPairs) * 100)}%`, label: '의미장 응집도' },
            { num: N, label: '배치한 방' },
          ]}
          restartLabel="새 저택"
          onRestart={start}
          onExit={handleExit}
        />
      </div>
    );
  }

  return (
    <div className="gk-root le-root">

          <GameMusic gameId="lexicon-estate" />
      <div className="gk-sr" aria-live="polite">{flash}</div>
      <GameKitStyles />
      <AmbientBackground center="#E4ECF5" mid="#A9BFD8" edge="#152238" glow="rgba(120,180,255,.28)" glowAt="50% 20%" watermark="lexicon-estate" />
      <style dangerouslySetInnerHTML={{ __html: LE_CSS }} />
      <Hud
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={<div className="le-hud"><span className="gk-stat-label">복도 연결</span><span className="le-hud-v">{shownConns} · 방 {placed}/{N}</span></div>}
      />

      <main className="gk-stage le-stage">
        <p className="le-help" aria-hidden="true">방을 배치해 <b>같은 의미장</b>끼리 상하좌우로 이어 복도를 만들어라. {flash && <span className="le-flash">{flash}</span>}</p>

        {/* 청사진 저택 3×3 */}
        <div className="le-estate" role="grid" aria-label="저택 도면">
          {grid.map((room, i) => {
            const linked = linkedSet.has(i);
            return (
              <button
                key={i}
                type="button"
                className={`le-cell ${room ? 'le-cell--room' : 'le-cell--empty'} ${linked ? 'le-cell--linked' : ''} ${justLinked === i ? 'le-cell--just' : ''} ${held !== null && !room ? 'le-cell--target' : ''}`}
                style={room ? { ['--rc' as string]: CAT_COLOR[room.cat] } : undefined}
                onClick={() => place(i)}
                disabled={!!room || held === null}
                data-idx={i} data-cat={room ? room.cat : ''}
                aria-label={room ? `${room.en} (${CAT_KO[room.cat]})` : '빈 방'}
              >
                {room ? (
                  <>
                    <span className="le-cell-cat" style={{ background: CAT_COLOR[room.cat] }}>{CAT_KO[room.cat]}</span>
                    <span className="le-cell-en">{room.en}</span>
                    <span className="le-cell-ko">{room.ko}</span>
                    {justLinked === i && <ParticleBurst intensity={2} />}
                  </>
                ) : <span className="le-cell-plus" aria-hidden="true">＋</span>}
              </button>
            );
          })}
        </div>

        {/* 드래프트 */}
        <div className="le-draft" role="group" aria-label="드래프트 방 카드">
          <span className="le-draft-label">드래프트 — 놓을 방을 고르시오</span>
          <div className="le-cards">
            {draft.map((r, i) => (
              <button
                key={`${r.en}-${i}`}
                type="button"
                className={`le-card ${held === i ? 'le-card--on' : ''}`}
                style={{ ['--rc' as string]: CAT_COLOR[r.cat] }}
                data-cat={r.cat} data-en={r.en}
                onClick={() => { sfx.click(); setHeld((h) => (h === i ? null : i)); setFlash(''); }}
              >
                <span className="le-card-cat" style={{ background: CAT_COLOR[r.cat] }}>{CAT_KO[r.cat]}</span>
                <span className="le-card-en">{r.en}</span>
                <span className="le-card-ko">{r.ko}</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

const LE_CSS = `
  .le-hud { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.05; }
  .le-hud-v { font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 800; color: var(--t1); }
  .le-stage { gap: clamp(14px, 3vh, 26px); }
  .le-help { margin: 0; font-size: 13px; color: var(--t2); text-align: center; }
  .le-help b { color: var(--t1); }
  .le-flash { margin-left: 8px; font-weight: 800; color: var(--success); animation: gk-pop .4s ease-out; }

  .le-estate { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; width: min(420px, 90vw); aspect-ratio: 1; padding: 10px; border-radius: 14px;
    background: color-mix(in srgb, #1a3a6e 12%, var(--bg)); border: 1px solid color-mix(in srgb, #3a6ea8 40%, var(--bd));
    background-image: linear-gradient(color-mix(in srgb, #3a6ea8 14%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, #3a6ea8 14%, transparent) 1px, transparent 1px);
    background-size: 24px 24px; }
  .le-cell { position: relative; overflow: visible; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border-radius: 10px; cursor: pointer; transition: transform .12s var(--ease, ease-out), box-shadow .18s, border-color .18s, background .2s; }
  .le-cell--empty { border: 1.5px dashed color-mix(in srgb, #3a6ea8 45%, var(--bd)); background: color-mix(in srgb, var(--bg) 40%, transparent); color: color-mix(in srgb, #3a6ea8 70%, var(--t3)); }
  .le-cell--empty[disabled] { cursor: default; opacity: .8; }
  .le-cell--target:not([disabled]) { border-style: solid; border-color: var(--combo); background: color-mix(in srgb, var(--combo) 10%, var(--bg)); }
  .le-cell--target:not([disabled]):hover { transform: scale(1.03); box-shadow: 0 0 0 2px var(--combo); }
  .le-cell-plus { font-size: 22px; font-weight: 300; }
  .le-cell--room { border: 1.5px solid color-mix(in srgb, var(--rc) 50%, var(--bd)); background: color-mix(in srgb, var(--rc) 8%, var(--bg)); cursor: default; }
  .le-cell--linked { border-color: var(--rc); box-shadow: 0 0 0 2px color-mix(in srgb, var(--rc) 55%, transparent), 0 0 18px -4px color-mix(in srgb, var(--rc) 55%, transparent); }
  .le-cell--just { animation: gk-pop .5s ease-out; }
  .le-cell-cat { font-size: 8.5px; font-weight: 800; color: #fff; padding: 1px 6px; border-radius: 999px; }
  .le-cell-en { font-family: var(--font-english, system-ui); font-size: clamp(12px, 2.6vw, 15px); font-weight: 800; color: var(--t1); line-height: 1.05; text-align: center; word-break: break-all; }
  .le-cell-ko { font-size: 10px; color: var(--t3); }

  .le-draft { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .le-draft-label { font-family: var(--font-english, monospace); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--t3); }
  .le-cards { display: flex; gap: 10px; }
  .le-card { display: flex; flex-direction: column; align-items: center; gap: 3px; width: clamp(84px, 13vw, 104px); padding: 11px 8px; border-radius: 12px; border: 1.5px solid var(--bd); border-top: 3px solid var(--rc); background: var(--bg); cursor: pointer; transition: transform .12s, box-shadow .18s, border-color .18s; }
  .le-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px -8px rgba(20,34,56,.4); }
  .le-card:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--rc) 32%, transparent); }
  .le-card--on { transform: translateY(-6px); border-color: var(--rc); box-shadow: 0 0 0 2px var(--rc), 0 12px 24px -8px color-mix(in srgb, var(--rc) 45%, transparent); }
  .le-card-cat { font-size: 9px; font-weight: 800; color: #fff; padding: 1px 7px; border-radius: 999px; }
  .le-card-en { font-family: var(--font-english, system-ui); font-size: 14px; font-weight: 800; color: var(--t1); }
  .le-card-ko { font-size: 10.5px; color: var(--t3); }

  @media (prefers-reduced-motion: reduce) { .le-cell, .le-card, .le-cell--just, .le-flash { animation: none; transition: none; } }
`;
