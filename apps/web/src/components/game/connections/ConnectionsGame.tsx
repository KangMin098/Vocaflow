// apps/web/src/components/game/connections/ConnectionsGame.tsx
// Connections — 의미 그룹핑(NYT Connections × 어휘). 16단어를 숨은 4개 카테고리(각 4)로 묶는다.
// 그룹 메타가 필요해 내장 큐레이션 퍼즐 뱅크 사용(학습자가 뜻으로 묶고, 정답 시 카테고리·뜻 공개).
// L5 의미 관계. 게임킷 공용 인프라 사용.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles, AmbientBackground, Hud, GameDone, ParticleBurst, useSfx, shuffle, type Word,
  GameMusic,
} from '@/components/game/_shared/gamekit';

interface Props { onExit?: () => void; onCorrect?: (w: Word) => void; }

interface Group { label: string; color: string; words: Word[]; }
interface Puzzle { groups: Group[]; }

const C = { forest: 'var(--success)', purple: 'var(--combo)', amber: 'var(--active)', pink: 'var(--streak)' };

// 큐레이션 퍼즐 뱅크 — 각 4그룹 × 4단어(카테고리 라벨 + 뜻).
const BANK: Puzzle[] = [
  { groups: [
    { label: '감정', color: C.pink, words: [{ en: 'joy', ko: '기쁨' }, { en: 'anger', ko: '분노' }, { en: 'fear', ko: '두려움' }, { en: 'grief', ko: '슬픔' }] },
    { label: '날씨', color: C.purple, words: [{ en: 'storm', ko: '폭풍' }, { en: 'breeze', ko: '산들바람' }, { en: 'drought', ko: '가뭄' }, { en: 'frost', ko: '서리' }] },
    { label: '직업', color: C.amber, words: [{ en: 'lawyer', ko: '변호사' }, { en: 'surgeon', ko: '외과의사' }, { en: 'architect', ko: '건축가' }, { en: 'pilot', ko: '조종사' }] },
    { label: '움직임', color: C.forest, words: [{ en: 'sprint', ko: '전력질주' }, { en: 'crawl', ko: '기다' }, { en: 'leap', ko: '도약하다' }, { en: 'stroll', ko: '거닐다' }] },
  ] },
  { groups: [
    { label: '성격', color: C.pink, words: [{ en: 'honest', ko: '정직한' }, { en: 'stubborn', ko: '고집센' }, { en: 'generous', ko: '관대한' }, { en: 'timid', ko: '소심한' }] },
    { label: '크기', color: C.purple, words: [{ en: 'tiny', ko: '아주 작은' }, { en: 'massive', ko: '거대한' }, { en: 'slender', ko: '가느다란' }, { en: 'vast', ko: '광대한' }] },
    { label: '학문', color: C.amber, words: [{ en: 'biology', ko: '생물학' }, { en: 'economics', ko: '경제학' }, { en: 'geography', ko: '지리학' }, { en: 'physics', ko: '물리학' }] },
    { label: '요리', color: C.forest, words: [{ en: 'roast', ko: '굽다' }, { en: 'simmer', ko: '끓이다' }, { en: 'chop', ko: '썰다' }, { en: 'season', ko: '간하다' }] },
  ] },
  { groups: [
    { label: '시간', color: C.pink, words: [{ en: 'dawn', ko: '새벽' }, { en: 'dusk', ko: '황혼' }, { en: 'decade', ko: '십 년' }, { en: 'instant', ko: '순간' }] },
    { label: '돈', color: C.purple, words: [{ en: 'budget', ko: '예산' }, { en: 'profit', ko: '이익' }, { en: 'debt', ko: '빚' }, { en: 'wage', ko: '임금' }] },
    { label: '신체', color: C.amber, words: [{ en: 'elbow', ko: '팔꿈치' }, { en: 'ankle', ko: '발목' }, { en: 'spine', ko: '척추' }, { en: 'jaw', ko: '턱' }] },
    { label: '재해', color: C.forest, words: [{ en: 'flood', ko: '홍수' }, { en: 'earthquake', ko: '지진' }, { en: 'wildfire', ko: '산불' }, { en: 'avalanche', ko: '눈사태' }] },
  ] },
  { groups: [
    { label: '악기', color: C.pink, words: [{ en: 'flute', ko: '플루트' }, { en: 'drum', ko: '드럼' }, { en: 'violin', ko: '바이올린' }, { en: 'trumpet', ko: '트럼펫' }] },
    { label: '보석', color: C.purple, words: [{ en: 'diamond', ko: '다이아몬드' }, { en: 'pearl', ko: '진주' }, { en: 'emerald', ko: '에메랄드' }, { en: 'ruby', ko: '루비' }] },
    { label: '응시하다', color: C.amber, words: [{ en: 'observe', ko: '관찰하다' }, { en: 'glance', ko: '힐끗 보다' }, { en: 'gaze', ko: '응시하다' }, { en: 'peek', ko: '엿보다' }] },
    { label: '거래', color: C.forest, words: [{ en: 'trade', ko: '거래하다' }, { en: 'bargain', ko: '흥정하다' }, { en: 'purchase', ko: '구매하다' }, { en: 'refund', ko: '환불하다' }] },
  ] },
  { groups: [
    { label: '곤충', color: C.pink, words: [{ en: 'ant', ko: '개미' }, { en: 'beetle', ko: '딱정벌레' }, { en: 'moth', ko: '나방' }, { en: 'wasp', ko: '말벌' }] },
    { label: '지형', color: C.purple, words: [{ en: 'valley', ko: '계곡' }, { en: 'cliff', ko: '절벽' }, { en: 'plateau', ko: '고원' }, { en: 'canyon', ko: '협곡' }] },
    { label: '성격 결점', color: C.amber, words: [{ en: 'arrogant', ko: '오만한' }, { en: 'greedy', ko: '탐욕스러운' }, { en: 'reckless', ko: '무모한' }, { en: 'lazy', ko: '게으른' }] },
    { label: '말하기', color: C.forest, words: [{ en: 'mumble', ko: '웅얼거리다' }, { en: 'declare', ko: '선언하다' }, { en: 'whisper', ko: '속삭이다' }, { en: 'shout', ko: '외치다' }] },
  ] },
];

const MAX_MISTAKES = 4;

export function ConnectionsGame({ onExit, onCorrect }: Props) {
  const sfx = useSfx();
  const [puzzleIdx, setPuzzleIdx] = useState(() => Math.floor(Math.random() * BANK.length));
  const puzzle = BANK[puzzleIdx];

  const allWords = useMemo(() => puzzle.groups.flatMap((g) => g.words.map((w) => ({ ...w, label: g.label, color: g.color }))), [puzzle]);
  const groupByEn = useMemo(() => new Map(allWords.map((w) => [w.en, w.label])), [allWords]);

  const [tiles, setTiles] = useState(() => shuffle(allWords));
  const [selected, setSelected] = useState<string[]>([]);
  const [solved, setSolved] = useState<Group[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [phase, setPhase] = useState<'playing' | 'won' | 'lost'>('playing');
  const [shakeSel, setShakeSel] = useState(false);
  const [oneAway, setOneAway] = useState(false);
  const [justSolvedLabel, setJustSolvedLabel] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const mounted = useRef(true);

  const reset = useCallback((nextPuzzle?: number) => {
    const pi = nextPuzzle !== undefined ? nextPuzzle : (puzzleIdx + 1) % BANK.length;
    const p = BANK[pi];
    const words = p.groups.flatMap((g) => g.words.map((w) => ({ ...w, label: g.label, color: g.color })));
    setPuzzleIdx(pi);
    setTiles(shuffle(words));
    setSelected([]); setSolved([]); setMistakes(0); setPhase('playing');
    setShakeSel(false); setOneAway(false); setJustSolvedLabel(null);
  }, [puzzleIdx]);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const toggle = useCallback((en: string) => {
    if (phase !== 'playing') return;
    setOneAway(false);
    setSelected((s) => {
      if (s.includes(en)) return s.filter((x) => x !== en);
      if (s.length >= 4) return s;
      sfx.click();
      return [...s, en];
    });
  }, [phase, sfx]);

  const submit = useCallback(() => {
    if (phase !== 'playing' || selected.length !== 4) return;
    const labels = selected.map((en) => groupByEn.get(en));
    const allSame = labels.every((l) => l === labels[0]);
    if (allSame) {
      const g = puzzle.groups.find((x) => x.label === labels[0])!;
      setSolved((prev) => [...prev, g]);
      setTiles((prev) => prev.filter((t) => !selected.includes(t.en)));
      setSelected([]);
      setJustSolvedLabel(g.label);
      setMsg(`정답 그룹: ${g.label}`);
      sfx.correct(solved.length + 1, true);
      g.words.forEach((w) => onCorrect?.(w));
      setTimeout(() => mounted.current && setJustSolvedLabel(null), 800);
      if (solved.length + 1 === 4) { setTimeout(() => mounted.current && (sfx.fanfare(), setPhase('won')), 400); }
    } else {
      // 3/4 = 하나 아쉬움
      const counts = new Map<string, number>();
      labels.forEach((l) => counts.set(l!, (counts.get(l!) ?? 0) + 1));
      const max = Math.max(...counts.values());
      setShakeSel(true); sfx.wrong();
      setMsg('틀렸어요');
      const m = mistakes + 1; setMistakes(m);
      if (max === 3) setOneAway(true);
      setTimeout(() => { if (!mounted.current) return; setShakeSel(false); if (m >= MAX_MISTAKES) { revealAll(); } }, 420);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selected, groupByEn, puzzle, solved.length, mistakes, sfx, onCorrect]);

  const revealAll = useCallback(() => {
    const remaining = puzzle.groups.filter((g) => !solved.some((s) => s.label === g.label));
    setSolved((prev) => [...prev, ...remaining]);
    setTiles([]); setSelected([]); setPhase('lost');
  }, [puzzle, solved]);

  const handleExit = useCallback(() => onExit?.(), [onExit]);
  const livesLeft = MAX_MISTAKES - mistakes;

  return (
    <div className="gk-root cn-root">

          <GameMusic gameId="connections" />
      <GameKitStyles />
      <AmbientBackground center="#F2ECFA" mid="#DACAEF" edge="#2C2156" glow="rgba(192,162,255,.30)" glowAt="50% 22%" watermark="connections" />
      <style dangerouslySetInnerHTML={{ __html: CN_CSS }} />
      <Hud
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={
          <div className="cn-lives" aria-label={`남은 기회 ${livesLeft}`}>
            <span className="gk-stat-label">기회</span>
            <span className="cn-dots">{Array.from({ length: MAX_MISTAKES }).map((_, i) => (
              <span key={i} className={`cn-dot ${i < livesLeft ? '' : 'cn-dot--off'}`} />
            ))}</span>
          </div>
        }
      />
      <div className="gk-sr" aria-live="assertive">{msg}</div>

      {phase !== 'playing' ? (
        <GameDone
          mark="connections"
          lead={phase === 'won' ? '완벽해요!' : '오늘도 한 걸음'}
          stats={[
            { num: `${solved.length}/4`, label: '찾은 그룹', accent: true },
            { num: `${MAX_MISTAKES - mistakes}/${MAX_MISTAKES}`, label: '남은 기회' },
          ]}
          restartLabel="다른 퍼즐"
          onRestart={() => reset()}
          onExit={handleExit}
        />
      ) : (
        <main className="gk-stage cn-stage">
          <p className="cn-help" aria-hidden="true">같은 카테고리 단어 <b>4개</b>를 골라 그룹을 만드세요</p>

          {/* 해결된 그룹 */}
          <div className="cn-solved">
            {solved.map((g) => (
              <div key={g.label} className={`cn-bar ${justSolvedLabel === g.label ? 'cn-bar--pop' : ''}`} style={{ background: g.color }}>
                <span className="cn-bar-label">{g.label}</span>
                <span className="cn-bar-words">{g.words.map((w) => `${w.en}(${w.ko})`).join(' · ')}</span>
                {justSolvedLabel === g.label && <ParticleBurst intensity={3} />}
              </div>
            ))}
          </div>

          {/* 남은 타일 */}
          {tiles.length > 0 && (
            <div className="cn-grid">
              {tiles.map((t) => {
                const isSel = selected.includes(t.en);
                return (
                  <button
                    key={t.en}
                    type="button"
                    className={`cn-tile ${isSel ? 'cn-tile--sel' : ''} ${isSel && shakeSel ? 'cn-tile--shake' : ''}`}
                    onClick={() => toggle(t.en)}
                    aria-pressed={isSel}
                  >
                    <span className="cn-en">{t.en}</span>
                    <span className="cn-ko">{t.ko}</span>
                  </button>
                );
              })}
            </div>
          )}

          {oneAway && <div className="cn-oneaway" aria-hidden="true">하나 아쉬워요!</div>}

          <div className="cn-actions">
            <button type="button" className="gk-btn cn-ctrl" onClick={() => setSelected([])} disabled={selected.length === 0}>선택 해제</button>
            <button type="button" className="gk-btn cn-ctrl" onClick={() => setTiles((t) => shuffle(t))}>섞기</button>
            <button type="button" className="gk-btn gk-btn--primary cn-submit" onClick={submit} disabled={selected.length !== 4}>확인 ({selected.length}/4)</button>
          </div>
        </main>
      )}
    </div>
  );
}

const CN_CSS = `
  .cn-lives { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
  .cn-dots { display: flex; gap: 4px; }
  .cn-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--streak); }
  .cn-dot--off { background: transparent; box-shadow: inset 0 0 0 1.6px var(--bd); }
  .cn-stage { gap: 14px; justify-content: flex-start; padding-top: clamp(12px, 4vh, 40px); }
  .cn-help { font-size: 13px; color: var(--t3); margin: 0; text-align: center; }
  .cn-help b { color: var(--t1); }
  .cn-solved { display: flex; flex-direction: column; gap: 8px; width: min(560px, 94vw); }
  .cn-bar { position: relative; overflow: visible; display: flex; flex-direction: column; gap: 2px; padding: 10px 16px; border-radius: var(--r-md, 10px); color: #fff; text-align: center; }
  .cn-bar-label { font-family: var(--font-display, system-ui); font-size: 14px; font-weight: 800; letter-spacing: .02em; }
  .cn-bar-words { font-size: 12px; font-weight: 600; opacity: .92; word-break: keep-all; }
  .cn-bar--pop { animation: gk-pop .5s ease-out; }
  .cn-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: clamp(7px, 1.5vw, 11px); width: min(560px, 94vw); }
  .cn-tile { aspect-ratio: 3 / 2.4; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 6px; border-radius: var(--r-md, 10px); border: 1.5px solid var(--bd); background: var(--bg); color: var(--t1); cursor: pointer; transition: transform .1s var(--ease, ease-out), border-color .15s, background .15s, box-shadow .15s; }
  .cn-en { font-family: var(--font-english, system-ui); font-size: clamp(13px, 2.7vw, 17px); font-weight: 800; }
  .cn-ko { font-size: clamp(10px, 2vw, 12px); color: var(--t3); }
  .cn-tile:hover { border-color: var(--combo); transform: translateY(-2px); }
  .cn-tile:active { transform: scale(.95); }
  .cn-tile:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  .cn-tile--sel { border-color: var(--combo); background: var(--combo); color: var(--ti); box-shadow: 0 4px 14px color-mix(in srgb, var(--combo) 30%, transparent); }
  .cn-tile--sel .cn-ko { color: rgba(255,255,255,.8); }
  .cn-tile--shake { animation: gk-shake .4s ease-in-out; }
  .cn-oneaway { font-size: 13px; font-weight: 800; color: var(--warning); animation: gk-pop .4s ease-out; }
  .cn-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .cn-ctrl { min-height: 44px; padding: 0 16px; font-size: 13px; }
  .cn-submit { min-width: 130px; }
  @media (prefers-reduced-motion: reduce) { .cn-tile--shake, .cn-bar--pop, .cn-oneaway { animation: none; } }
`;
