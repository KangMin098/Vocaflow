// apps/web/src/components/game/glyph-tongue/GlyphTongueGame.tsx
// The Glyph Tongue — 문맥 해독(Chants of Sennaar 계열). 목표 단어를 '미지의 룬'으로 제시,
// 여러 비문(영어 문맥)에서의 쓰임만으로 뜻을 추론 → 코덱스에 가설 배치 → 봉인(검증) →
// 맞으면 룬이 영어 단어로 풀리며 비문을 '읽을 수 있게' 된다. 뜻을 절대 그냥 주지 않는다.

'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import {
  GameKitStyles, AmbientBackground, Hud, GameDone,
  useSfx, shuffle, clamp, type Word,
  GameMusic,
} from '@/components/game/_shared/gamekit';

interface Props { wordPool?: Word[]; onExit?: () => void; onCorrect?: (w: Word) => void; onWrong?: (w: Word) => void; }

// ── 석실 뱅크: 각 룬(단어)은 뜻 미제공, 2개의 영어 비문 문맥으로만 추론. {}=룬 자리 ──
interface GWord { en: string; ko: string; ins: string[] }
const CHAMBERS: GWord[][] = [
  [
    { en: 'reluctant', ko: '마지못한·꺼리는', ins: ['The boy was {} to leave his warm bed.', 'She gave a {} nod, still unsure of the plan.'] },
    { en: 'exhausted', ko: '기진맥진한', ins: ['After the long march, the soldiers were {}.', 'He was so {} that he fell asleep at the table.'] },
    { en: 'curious', ko: '호기심 많은', ins: ['The {} child opened every box to see inside.', 'Cats are {} and explore every new corner.'] },
    { en: 'furious', ko: '몹시 화난', ins: ['The king was {} when he heard of the theft.', 'She was {} and slammed the heavy door.'] },
    { en: 'content', ko: '만족한', ins: ['With a full meal and warm fire, he felt {}.', 'She was {} with her simple, quiet life.'] },
  ],
  [
    { en: 'whisper', ko: '속삭이다', ins: ['She had to {} so the baby would not wake.', 'They {} secrets in the dark, silent library.'] },
    { en: 'vanish', ko: '사라지다', ins: ['The magician made the coin {} in an instant.', 'The ship began to {} into the thick fog.'] },
    { en: 'gather', ko: '모으다·모이다', ins: ['The farmers {} the wheat before the storm.', 'A crowd began to {} around the street singer.'] },
    { en: 'rescue', ko: '구조하다', ins: ['The firefighters {} the cat from the tall tree.', 'He jumped in to {} the drowning boy.'] },
    { en: 'forbid', ko: '금지하다', ins: ['The teacher will {} phones during the exam.', 'The old law used to {} trade with strangers.'] },
  ],
  [
    { en: 'fragile', ko: '깨지기 쉬운·연약한', ins: ['Handle the glass with care; it is very {}.', 'The old letter was thin, yellow, and {}.'] },
    { en: 'enormous', ko: '거대한', ins: ['The {} whale was larger than the fishing boat.', 'They built an {} tower that touched the clouds.'] },
    { en: 'ancient', ko: '고대의', ins: ['The {} ruins were thousands of years old.', 'Scholars studied the {} language of the tomb.'] },
    { en: 'hollow', ko: '속이 빈', ins: ['The {} log made a deep, drum-like sound.', 'Owls often build a nest inside a {} tree.'] },
    { en: 'genuine', ko: '진짜의·진심의', ins: ['Experts confirmed the painting was {}, not a copy.', 'She gave a {} smile of real, warm joy.'] },
  ],
];

// ── 절차적 룬 생성 (단어 해시 → 결정적 SVG. Chants식 미지 문자) ──
function hashStr(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const COLS = [9, 20, 31], ROWS = [10, 22, 34, 46];
function buildGlyph(word: string) {
  const rnd = mulberry32(hashStr(word));
  const node = (c: number, r: number) => `${COLS[c]} ${ROWS[r]}`;
  let c = Math.floor(rnd() * 3), r = Math.floor(rnd() * 4);
  const pts: [number, number][] = [[c, r]];
  const segs = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < segs; i++) {
    if (rnd() < 0.5) c = clamp(c + (rnd() < 0.5 ? -1 : 1), 0, 2);
    else r = clamp(r + (rnd() < 0.5 ? -1 : 1), 0, 3);
    pts.push([c, r]);
  }
  const strokes = ['M' + node(pts[0][0], pts[0][1]) + pts.slice(1).map((p) => 'L' + node(p[0], p[1])).join('')];
  if (rnd() < 0.62) {
    const c2 = Math.floor(rnd() * 3), r2 = Math.floor(rnd() * 4), horiz = rnd() < 0.5;
    const c3 = clamp(c2 + (rnd() < 0.5 ? 1 : -1), 0, 2), r3 = clamp(r2 + (rnd() < 0.5 ? 1 : -1), 0, 3);
    strokes.push('M' + node(c2, r2) + 'L' + node(horiz ? c3 : c2, horiz ? r2 : r3));
  }
  const dots: [number, number][] = [];
  if (rnd() < 0.5) { const cd = Math.floor(rnd() * 3), rd = Math.floor(rnd() * 4); dots.push([COLS[cd], ROWS[rd]]); }
  return { strokes, dots };
}
const Rune = memo(function Rune({ word, className }: { word: string; className?: string }) {
  const g = useMemo(() => buildGlyph(word), [word]);
  return (
    <svg viewBox="0 0 40 56" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {g.strokes.map((d, i) => <path key={i} d={d} />)}
      {g.dots.map((p, i) => <circle key={`d${i}`} cx={p[0]} cy={p[1]} r="1.9" fill="currentColor" stroke="none" />)}
    </svg>
  );
});

// ── 실 어휘 배선: 학습자 스코프 단어(예문 포함) → 석실. 예문에서 단어/굴절형을 찾아 룬으로 블랭크.
const escapeReg = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function buildChambersFromPool(pool?: Word[]): GWord[][] | null {
  if (!pool || pool.length < 4) return null;
  const usable: GWord[] = [];
  const seen = new Set<string>();
  const seenKo = new Set<string>(); // 같은 뜻이 두 룬에 걸리면 1:1 매핑상 석실이 영영 안 풀림 → ko 도 중복 제거
  for (const w of pool) {
    if (!w.en || !w.ko || !w.example || seen.has(w.en) || seenKo.has(w.ko)) continue;
    const forms = [w.en, ...(w.inflected ?? [])].filter((f) => f && f.length >= 2);
    let ins: string | null = null;
    for (const f of forms) {
      const re = new RegExp(`\\b${escapeReg(f)}\\b`, 'i');
      if (re.test(w.example)) { ins = w.example.replace(re, '{}'); break; }
    }
    if (!ins) continue; // 예문에 단어가 없으면(블랭크 불가) 제외
    seen.add(w.en);
    seenKo.add(w.ko);
    usable.push({ en: w.en, ko: w.ko, ins: [ins] });
  }
  if (usable.length < 4) return null;
  const shuffled = shuffle(usable).slice(0, 20); // 세션당 상한(최대 4석실) — 큰 세트도 한 세션 분량만
  const chambers: GWord[][] = [];
  for (let i = 0; i < shuffled.length; i += 5) {
    const chunk = shuffled.slice(i, i + 5);
    if (chunk.length >= 3) chambers.push(chunk); // 마지막 석실은 최소 3
  }
  return chambers.length ? chambers : null;
}

export function GlyphTongueGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();
  const chambers = useMemo(() => buildChambersFromPool(wordPool) ?? CHAMBERS, [wordPool]);
  const [chamberIdx, setChamberIdx] = useState(0);
  const words = chambers[chamberIdx];

  const [assign, setAssign] = useState<Record<string, string>>({}); // en -> ko(가설)
  const [held, setHeld] = useState<string | null>(null);            // 손에 든 뜻(ko)
  const [solved, setSolved] = useState<Set<string>>(new Set());     // 해독된 en
  const [focusEn, setFocusEn] = useState<string | null>(null);      // 하이라이트 룬
  const [sealMsg, setSealMsg] = useState('');
  const [phase, setPhase] = useState<'decode' | 'done'>('decode');
  const [insight, setInsight] = useState(0);     // 총 해독
  const [misread, setMisread] = useState(0);     // 총 오독(봉인 시 어긋남)

  // 비문 벽: 챔버당 한 번 셔플(같은 룬 2회 등장 → 삼각측량)
  const inscriptions = useMemo(() => {
    const list: { en: string; text: string }[] = [];
    words.forEach((w) => w.ins.forEach((text) => list.push({ en: w.en, text })));
    return shuffle(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chamberIdx]);

  // 뜻 뱅크는 카드(룬) 순서와 무관하게 셔플 — 위치 정렬로 문맥 없이 순서 매칭하는 우회 차단.
  const meaningOrder = useMemo(() => shuffle(words.map((w) => w.ko)), [chamberIdx, words]);
  const bank = useMemo(() => {
    const used = new Set(Object.entries(assign).filter(([en]) => !solved.has(en)).map(([, ko]) => ko));
    const lockedKo = new Set(words.filter((w) => solved.has(w.en)).map((w) => w.ko));
    return meaningOrder.filter((ko) => !used.has(ko) && !lockedKo.has(ko));
  }, [assign, solved, words, meaningOrder]);

  const allAssigned = words.every((w) => solved.has(w.en) || assign[w.en]);
  const cleared = words.every((w) => solved.has(w.en));

  const tapMeaning = useCallback((ko: string) => {
    sfx.click();
    setHeld((h) => (h === ko ? null : ko));
  }, [sfx]);

  const tapRune = useCallback((en: string) => {
    if (solved.has(en)) return;
    setSealMsg('');
    if (held !== null) {
      setAssign((prev) => {
        const next = { ...prev };
        // 이 뜻이 다른 룬에 있으면 제거(1:1)
        for (const k of Object.keys(next)) if (next[k] === held && !solved.has(k)) delete next[k];
        next[en] = held;
        return next;
      });
      setHeld(null);
      sfx.click();
    } else if (assign[en]) {
      setAssign((prev) => { const next = { ...prev }; delete next[en]; return next; }); // 슬롯 비우기
      sfx.click();
    } else {
      setFocusEn((f) => (f === en ? null : en)); // 문맥 하이라이트 토글
    }
  }, [held, assign, solved, sfx]);

  const seal = useCallback(() => {
    if (cleared) { // 다음 석실 / 완성
      if (chamberIdx + 1 < chambers.length) {
        setChamberIdx((i) => i + 1);
        setAssign({}); setHeld(null); setSolved(new Set()); setFocusEn(null); setSealMsg('');
        sfx.click();
      } else { sfx.fanfare(); setPhase('done'); }
      return;
    }
    let ok = 0, bad = 0;
    const newSolved = new Set(solved);
    const clearWrong: Record<string, string> = { ...assign };
    words.forEach((w) => {
      if (solved.has(w.en)) return;
      const guess = assign[w.en];
      if (!guess) return;
      if (guess === w.ko) { newSolved.add(w.en); ok++; onCorrect?.({ en: w.en, ko: w.ko }); }
      else { delete clearWrong[w.en]; bad++; onWrong?.({ en: w.en, ko: w.ko }); }
    });
    setSolved(newSolved); setAssign(clearWrong);
    setInsight((n) => n + ok); setMisread((n) => n + bad);
    if (ok > 0) sfx.correct(ok, ok >= 3); else sfx.wrong();
    const done = words.every((w) => newSolved.has(w.en));
    setSealMsg(done ? '비문을 읽어냈다.' : `${ok}개 해독 · ${bad}개 어긋남 — 다시 보라.`);
  }, [cleared, chamberIdx, words, assign, solved, onCorrect, onWrong, sfx]);

  const handleExit = useCallback(() => onExit?.(), [onExit]);

  // 비문 렌더: 해독된 룬은 영어 단어로, 아니면 룬으로
  const renderInscription = useCallback((en: string, text: string) => {
    const parts = text.split('{}');
    const isSolved = solved.has(en);
    const focused = focusEn === en;
    return parts.map((seg, i) => (
      <span key={i}>
        {seg}
        {i < parts.length - 1 && (
          isSolved
            ? <b className="gt-word">{en}</b>
            : <span className={`gt-rune-slot ${focused ? 'gt-rune-slot--focus' : ''}`}><Rune word={en} className="gt-rune-inline" /></span>
        )}
      </span>
    ));
  }, [solved, focusEn]);

  if (phase === 'done') {
    const total = chambers.reduce((n, c) => n + c.length, 0);
    return (
      <div className="gk-root gt-root">

            <GameMusic gameId="glyph-tongue" />
      <div className="gk-sr" aria-live="polite">{sealMsg}</div>
        <GameKitStyles />
        <AmbientBackground center="#F3EEE1" mid="#D8CFBE" edge="#3E4A63" glow="rgba(150,190,215,.30)" glowAt="50% 30%" watermark="glyph-tongue" />
        <style dangerouslySetInnerHTML={{ __html: GT_CSS }} />
        <Hud muted={sfx.muted} onToggleMute={() => sfx.setMuted((m) => !m)} onExit={handleExit} />
        <GameDone
          mark="glyph-tongue"
          lead="사라진 언어를 되살렸다"
          stats={[
            { num: insight, label: '해독한 룬', accent: true },
            { num: `${total ? Math.round((insight / (insight + misread || 1)) * 100) : 0}%`, label: '첫 봉인 정확도' },
            { num: chambers.length, label: '석실' },
          ]}
          restartLabel="다시 해독"
          onRestart={() => { setChamberIdx(0); setAssign({}); setHeld(null); setSolved(new Set()); setFocusEn(null); setSealMsg(''); setInsight(0); setMisread(0); setPhase('decode'); }}
          onExit={handleExit}
        />
      </div>
    );
  }

  return (
    <div className="gk-root gt-root">

          <GameMusic gameId="glyph-tongue" />
      <div className="gk-sr" aria-live="polite">{sealMsg}</div>
      <GameKitStyles />
      <AmbientBackground center="#F3EEE1" mid="#D8CFBE" edge="#3E4A63" glow="rgba(150,190,215,.30)" glowAt="50% 22%" watermark="glyph-tongue" />
      <style dangerouslySetInnerHTML={{ __html: GT_CSS }} />
      <Hud
        progress={(chamberIdx + (cleared ? 1 : 0)) / chambers.length}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={<div className="gt-chapter"><span className="gk-stat-label">석실</span><span className="gt-chapter-v">{chamberIdx + 1}/{chambers.length} · 해독 {solved.size}/{words.length}</span></div>}
      />

      <main className="gk-stage gt-stage">
        <p className="gt-help">뜻은 주어지지 않는다. 비문에 <b>반복되는 룬</b>을 문맥으로 추론해 뜻을 잇고, <b>코덱스를 봉인</b>하라.</p>

        {/* 비문 벽 */}
        <div className="gt-tablets">
          {inscriptions.map((ins, i) => (
            <p key={i} className={`gt-tablet ${focusEn === ins.en ? 'gt-tablet--focus' : ''}`}>{renderInscription(ins.en, ins.text)}</p>
          ))}
        </div>

        {/* 코덱스 */}
        <div className="gt-codex" role="group" aria-label="코덱스">
          {words.map((w, i) => {
            const isSolved = solved.has(w.en);
            const guess = assign[w.en];
            return (
              <button
                key={w.en}
                type="button"
                className={`gt-card ${isSolved ? 'gt-card--solved' : ''} ${focusEn === w.en ? 'gt-card--focus' : ''} ${held && !isSolved ? 'gt-card--target' : ''}`}
                onClick={() => tapRune(w.en)}
                aria-label={isSolved ? `해독됨 ${w.en}` : guess ? `룬 ${i + 1} · 가설 ${guess}` : `룬 ${i + 1}`}
              >
                <span className="gt-card-glyph">
                  {isSolved ? <b className="gt-card-word">{w.en}</b> : <Rune word={w.en} className="gt-rune-card" />}
                </span>
                <span className={`gt-slot ${guess ? 'gt-slot--filled' : ''} ${isSolved ? 'gt-slot--locked' : ''}`}>
                  {isSolved ? w.ko : guess || '뜻?'}
                </span>
              </button>
            );
          })}
        </div>

        {/* 뜻 뱅크 */}
        {!cleared && (
          <div className="gt-bank" role="group" aria-label="뜻 후보">
            {bank.map((ko) => (
              <button key={ko} type="button" className={`gt-chip ${held === ko ? 'gt-chip--held' : ''}`} onClick={() => tapMeaning(ko)}>{ko}</button>
            ))}
            {bank.length === 0 && <span className="gt-bank-empty">모든 뜻을 배치했다 — 봉인하라</span>}
          </div>
        )}

        <div className="gt-actions">
          {sealMsg && <span className={`gt-sealmsg ${cleared ? 'gt-sealmsg--ok' : ''}`}>{sealMsg}</span>}
          <button type="button" className="gk-btn gk-btn--primary gt-seal" onClick={seal} disabled={!cleared && !allAssigned}>
            {cleared ? (chamberIdx + 1 < chambers.length ? '다음 석실 →' : '언어를 되살리다') : '코덱스 봉인'}
          </button>
        </div>
      </main>
    </div>
  );
}

const GT_CSS = `
  .gt-chapter { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.05; }
  .gt-chapter-v { font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 800; color: var(--t1); }
  .gt-stage { gap: clamp(12px, 2.2vh, 20px); justify-content: flex-start; padding-top: clamp(10px, 2vh, 20px); overflow-y: auto; }
  .gt-help { margin: 0; font-size: 12.5px; color: var(--t2); text-align: center; max-width: 60ch; }
  .gt-help b { color: var(--t1); }

  .gt-tablets { display: flex; flex-direction: column; gap: 7px; width: min(680px, 94vw); }
  .gt-tablet { margin: 0; padding: 9px 16px; border-radius: 8px; background: color-mix(in srgb, var(--bg) 64%, transparent); border: 1px solid var(--bd); border-left: 3px solid color-mix(in srgb, var(--t1) 14%, transparent);
    font-family: var(--font-body, Georgia, serif); font-size: clamp(14px, 2.2vw, 17px); line-height: 1.5; color: var(--t1); backdrop-filter: blur(3px); transition: border-color .2s, background .2s; }
  .gt-tablet--focus { border-left-color: var(--combo); background: color-mix(in srgb, var(--combo) 8%, var(--bg)); }
  .gt-rune-slot { display: inline-flex; align-items: center; justify-content: center; vertical-align: -0.32em; width: 1.5em; height: 1.5em; margin: 0 2px; color: var(--t1); border-radius: 5px; transition: color .2s, background .2s; }
  .gt-rune-slot--focus { color: var(--combo); background: color-mix(in srgb, var(--combo) 16%, transparent); }
  .gt-rune-inline { width: 1em; height: 1.4em; }
  .gt-word { color: var(--success); font-family: var(--font-english, system-ui); font-weight: 800; font-style: normal; animation: gt-decipher .5s ease-out; }
  @keyframes gt-decipher { 0% { opacity: 0; transform: scale(.6); letter-spacing: .3em; } 100% { opacity: 1; transform: scale(1); letter-spacing: 0; } }

  .gt-codex { display: grid; grid-template-columns: repeat(5, 1fr); gap: 9px; width: min(680px, 94vw); }
  @media (max-width: 620px) { .gt-codex { grid-template-columns: repeat(5, 1fr); gap: 6px; } }
  .gt-card { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 6px; border-radius: 12px; border: 1.5px solid var(--bd); background: color-mix(in srgb, var(--bg) 72%, transparent); cursor: pointer; transition: transform .12s, border-color .18s, box-shadow .18s, background .18s; }
  .gt-card:hover { transform: translateY(-2px); border-color: var(--combo); }
  .gt-card:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 28%, transparent); }
  .gt-card--target { border-color: color-mix(in srgb, var(--combo) 55%, var(--bd)); border-style: dashed; }
  .gt-card--focus { border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 22%, transparent); }
  .gt-card--solved { border-color: var(--success); background: color-mix(in srgb, var(--success) 10%, var(--bg)); cursor: default; }
  .gt-card-glyph { height: 46px; display: grid; place-items: center; color: var(--t1); }
  .gt-rune-card { width: 30px; height: 44px; }
  .gt-card-word { color: var(--success); font-family: var(--font-english, system-ui); font-weight: 800; font-size: clamp(12px, 2.2vw, 15px); animation: gt-decipher .5s ease-out; }
  .gt-slot { font-size: 11px; font-weight: 700; text-align: center; line-height: 1.2; padding: 4px 4px; border-radius: 6px; min-height: 30px; display: grid; place-items: center; width: 100%;
    color: var(--t3); background: color-mix(in srgb, var(--t1) 5%, transparent); border: 1px dashed var(--bd); word-break: keep-all; }
  .gt-slot--filled { color: var(--combo); border-style: solid; border-color: color-mix(in srgb, var(--combo) 40%, var(--bd)); background: color-mix(in srgb, var(--combo) 8%, transparent); }
  .gt-slot--locked { color: var(--success); border-color: color-mix(in srgb, var(--success) 40%, var(--bd)); background: color-mix(in srgb, var(--success) 10%, transparent); }

  .gt-bank { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; width: min(680px, 94vw); min-height: 40px; }
  .gt-chip { display: inline-flex; align-items: center; min-height: 44px; padding: 9px 16px; border-radius: 999px; border: 1.5px solid var(--bd); background: var(--bg); color: var(--t1); font-size: 13px; font-weight: 700; cursor: pointer; transition: transform .1s, border-color .15s, background .15s, box-shadow .15s; }
  .gt-chip:hover { border-color: var(--combo); transform: translateY(-2px); }
  .gt-chip:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 28%, transparent); }
  .gt-chip--held { background: var(--combo); border-color: var(--combo); color: var(--ti); box-shadow: 0 4px 14px color-mix(in srgb, var(--combo) 30%, transparent); transform: translateY(-2px); }
  .gt-bank-empty { font-size: 12px; color: var(--t3); align-self: center; }

  .gt-actions { display: flex; flex-direction: column; align-items: center; gap: 8px; padding-bottom: 8px; }
  .gt-sealmsg { font-size: 13px; font-weight: 700; color: var(--warning); font-family: var(--font-body, Georgia, serif); font-style: italic; }
  .gt-sealmsg--ok { color: var(--success); }
  .gt-seal { min-width: 180px; }

  @media (prefers-reduced-motion: reduce) { .gt-word, .gt-card-word { animation: none; } }
`;
