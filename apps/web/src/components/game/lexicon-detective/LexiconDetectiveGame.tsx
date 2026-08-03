// apps/web/src/components/game/lexicon-detective/LexiconDetectiveGame.tsx
// Lexicon Detective — 장면 수확·서사 재구성 (Case of the Golden Idol 계열). 현장의 단서를
// 조사해 '단어를 수확'하고, 그 단어들을 서사의 빈칸(의미역 제약)에 배치해 사건을 재구성한다.
// 함정 단어(distractor) 포함 → 뜻·역할을 알아야 풀리는 연역. 클로즈가 아니라 장면 교차 추리.

'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  GameKitStyles, AmbientBackground, Hud, GameDone, useSfx, type Word,
  GameMusic,
} from '@/components/game/_shared/gamekit';

interface Props { wordPool?: Word[]; onExit?: () => void; onCorrect?: (w: Word) => void; onWrong?: (w: Word) => void; }

interface Clue { icon: string; object: string; en: string; ko: string; }
type Part = string | { hint: string; answer: string };
interface Case { title: string; scene: string; clues: Clue[]; narrative: Part[]; }

const B = (hint: string, answer: string): Part => ({ hint, answer });
const CASES: Case[] = [
  {
    title: '한밤의 서재',
    scene: '주인이 잠든 밤, 서재의 금고가 열렸다. 남은 흔적으로 범행을 재구성하라.',
    clues: [
      { icon: '🥾', object: '흙 묻은 장화', en: 'trudge', ko: '터벅터벅 걷다' },
      { icon: '🧥', object: '하인의 외투', en: 'servant', ko: '하인' },
      { icon: '✉️', object: '찢긴 편지', en: 'betray', ko: '배신하다' },
      { icon: '🔓', object: '빈 금고', en: 'steal', ko: '훔치다' },
      { icon: '🥃', object: '깨진 유리잔', en: 'shatter', ko: '산산이 부수다' },
      { icon: '✋', object: '떨리는 손자국', en: 'anxious', ko: '불안한' },
      { icon: '🎟️', object: '낡은 초대장', en: 'guest', ko: '손님' },
      { icon: '🖼️', object: '웃는 초상화', en: 'joyful', ko: '기쁜' },
    ],
    narrative: ['한밤중, 한 ', B('인물', 'servant'), '이 서재로 몰래 ', B('이동', 'trudge'), ' 들어왔다. 금고에서 보석을 ', B('가져가다', 'steal'), ', 서두르다 유리잔을 ', B('부수다', 'shatter'), '. 오랜 주인을 ', B('등지다', 'betray'), '한 죄책감에 그는 몹시 ', B('감정', 'anxious'), '했다.'],
  },
  {
    title: '사라진 유언장',
    scene: '노인이 남긴 유언장이 사라졌다. 유품 사이의 단서로 진실을 밝혀라.',
    clues: [
      { icon: '💼', object: '변호사 명함', en: 'lawyer', ko: '변호사' },
      { icon: '😠', object: '일그러진 표정', en: 'greedy', ko: '탐욕스러운' },
      { icon: '✍️', object: '덧쓴 서명', en: 'forge', ko: '위조하다' },
      { icon: '🔥', object: '재만 남은 벽난로', en: 'burn', ko: '태우다' },
      { icon: '🗝️', object: '감춰진 열쇠', en: 'conceal', ko: '숨기다' },
      { icon: '💧', object: '마른 눈물자국', en: 'grieve', ko: '몹시 슬퍼하다' },
      { icon: '😇', object: '헌금 영수증', en: 'honest', ko: '정직한' },
      { icon: '🌷', object: '시든 화분', en: 'garden', ko: '정원' },
    ],
    narrative: ['유산을 노린 ', B('인물', 'lawyer'), '는 ', B('감정', 'greedy'), ' 마음에 노인의 서명을 ', B('위조', 'forge'), ' 했다. 진짜 유언장은 벽난로에 ', B('태우다', 'burn'), ', 증거를 ', B('숨기다', 'conceal'), ' 했다. 뒤늦게 진실을 안 가족은 깊이 ', B('슬픔', 'grieve'), '했다.'],
  },
  {
    title: '불타는 극장',
    scene: '공연 도중 극장에 불이 났다. 무대 뒤에 남은 흔적으로 원인을 밝혀라.',
    clues: [
      { icon: '🎭', object: '주연 의상', en: 'actor', ko: '배우' },
      { icon: '😠', object: '라이벌 사진에 X표', en: 'jealous', ko: '질투하는' },
      { icon: '🔧', object: '끊어진 전선', en: 'sabotage', ko: '방해 공작하다' },
      { icon: '🔥', object: '그을린 조명', en: 'ignite', ko: '불붙이다' },
      { icon: '🚪', object: '부서진 비상구', en: 'flee', ko: '달아나다' },
      { icon: '🦺', object: '무대 담당 조끼', en: 'rescue', ko: '구조하다' },
      { icon: '👏', object: '공연 프로그램', en: 'applause', ko: '박수' },
      { icon: '🎪', object: '무대 커튼', en: 'curtain', ko: '커튼' },
    ],
    narrative: ['질투에 사로잡힌 한 ', B('인물', 'actor'), '는 라이벌을 향한 ', B('감정', 'jealous'), ' 마음에 조명 전선을 ', B('방해', 'sabotage'), ' 했다. 합선이 무대를 ', B('불붙이다', 'ignite'), ', 관객들은 비상구로 ', B('달아나다', 'flee'), '. 무대 담당은 쓰러진 배우를 ', B('구하다', 'rescue'), '했다.'],
  },
];

export function LexiconDetectiveGame({ onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();
  const [caseIdx, setCaseIdx] = useState(0);
  const c = CASES[caseIdx];

  const [examined, setExamined] = useState<Set<string>>(new Set());
  const [placed, setPlaced] = useState<Record<number, string>>({});
  const [solved, setSolved] = useState<Set<number>>(new Set());
  const [held, setHeld] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [phase, setPhase] = useState<'case' | 'done'>('case');
  const [caseSolved, setCaseSolved] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  // 빈칸 목록(id = 순서)
  const blanks = useMemo(() => c.narrative.filter((p): p is { hint: string; answer: string } => typeof p !== 'string'), [c]);
  const total = useMemo(() => CASES.reduce((n, x) => n + x.narrative.filter((p) => typeof p !== 'string').length, 0), []);
  const allFilled = blanks.every((_, i) => solved.has(i) || placed[i]);

  const bank = useMemo(() => {
    const usedByBlank = new Set(Object.entries(placed).filter(([i]) => !solved.has(Number(i))).map(([, en]) => en));
    const lockedEn = new Set(blanks.filter((_, i) => solved.has(i)).map((b) => b.answer));
    return c.clues.filter((cl) => examined.has(cl.en) && !usedByBlank.has(cl.en) && !lockedEn.has(cl.en));
  }, [c.clues, examined, placed, solved, blanks]);

  const examine = useCallback((en: string) => {
    if (examined.has(en)) return;
    setExamined((s) => new Set(s).add(en));
    sfx.click();
  }, [examined, sfx]);

  const tapChip = useCallback((en: string) => { sfx.click(); setHeld((h) => (h === en ? null : en)); }, [sfx]);

  const tapBlank = useCallback((id: number) => {
    if (solved.has(id)) return;
    setMsg('');
    if (held !== null) {
      setPlaced((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) if (next[Number(k)] === held && !solved.has(Number(k))) delete next[Number(k)];
        next[id] = held; return next;
      });
      setHeld(null); sfx.click();
    } else if (placed[id]) {
      setPlaced((prev) => { const next = { ...prev }; delete next[id]; return next; }); sfx.click();
    }
  }, [held, placed, solved, sfx]);

  const submit = useCallback(() => {
    if (caseSolved) {
      if (caseIdx + 1 < CASES.length) {
        setCaseIdx((i) => i + 1);
        setExamined(new Set()); setPlaced({}); setSolved(new Set()); setHeld(null); setMsg(''); setCaseSolved(false);
        sfx.click();
      } else { sfx.fanfare(); setPhase('done'); }
      return;
    }
    let ok = 0, bad = 0;
    const newSolved = new Set(solved);
    const keepPlaced: Record<number, string> = { ...placed };
    blanks.forEach((b, i) => {
      if (solved.has(i)) return;
      const p = placed[i]; if (!p) return;
      const w = c.clues.find((cl) => cl.en === p);
      if (p === b.answer) { newSolved.add(i); ok++; if (w) onCorrect?.({ en: w.en, ko: w.ko }); }
      else { delete keepPlaced[i]; bad++; if (w) onWrong?.({ en: w.en, ko: w.ko }); }
    });
    setSolved(newSolved); setPlaced(keepPlaced);
    setCorrect((n) => n + ok); setWrong((n) => n + bad);
    if (ok > 0) sfx.correct(ok, ok >= 3); else sfx.wrong();
    const done = blanks.every((_, i) => newSolved.has(i));
    if (done) { setCaseSolved(true); setMsg('사건 해결 — 진실이 드러났다.'); sfx.fanfare(); }
    else setMsg(`${ok}개 확정 · ${bad}개 어긋남 — 현장을 다시 보라.`);
  }, [caseSolved, caseIdx, blanks, placed, solved, c.clues, onCorrect, onWrong, sfx]);

  const handleExit = useCallback(() => onExit?.(), [onExit]);

  // 서사 렌더 (빈칸 id 부여, 해결 시 단어 노출)
  let bId = -1;
  const renderNarrative = () => c.narrative.map((p, i) => {
    if (typeof p === 'string') return <span key={i}>{p}</span>;
    bId += 1; const id = bId;
    const val = placed[id]; const isSolved = solved.has(id);
    return (
      <button key={i} type="button" className={`ld-slot ${val ? 'ld-slot--filled' : ''} ${isSolved ? 'ld-slot--solved' : ''}`} onClick={() => tapBlank(id)} disabled={isSolved}>
        {isSolved ? <b>{p.answer}</b> : val ? <b className="ld-slot-word">{val}</b> : <span className="ld-slot-hint">[{p.hint}]</span>}
      </button>
    );
  });

  if (phase === 'done') {
    return (
      <div className="gk-root ld-root">

            <GameMusic gameId="lexicon-detective" />
        <GameKitStyles />
        <AmbientBackground center="#EEE6D2" mid="#CDBE99" edge="#2E2A1C" glow="rgba(200,170,90,.28)" glowAt="50% 30%" watermark="lexicon-detective" />
        <style dangerouslySetInnerHTML={{ __html: LD_CSS }} />
        <Hud muted={sfx.muted} onToggleMute={() => sfx.setMuted((m) => !m)} onExit={handleExit} />
        <GameDone
          mark="lexicon-detective"
          lead="모든 사건이 종결됐다"
          stats={[
            { num: CASES.length, label: '해결한 사건', accent: true },
            { num: `${Math.round((correct / (correct + wrong || 1)) * 100)}%`, label: '첫 재구성 정확도' },
            { num: total, label: '재구성한 단서' },
          ]}
          restartLabel="새 사건철"
          onRestart={() => { setCaseIdx(0); setExamined(new Set()); setPlaced({}); setSolved(new Set()); setHeld(null); setMsg(''); setCaseSolved(false); setCorrect(0); setWrong(0); setPhase('case'); }}
          onExit={handleExit}
        />
      </div>
    );
  }

  return (
    <div className="gk-root ld-root">

          <GameMusic gameId="lexicon-detective" />
      <GameKitStyles />
      <AmbientBackground center="#EEE6D2" mid="#CDBE99" edge="#2E2A1C" glow="rgba(200,170,90,.26)" glowAt="50% 18%" watermark="lexicon-detective" />
      <style dangerouslySetInnerHTML={{ __html: LD_CSS }} />
      <Hud
        progress={(caseIdx + (caseSolved ? 1 : 0)) / CASES.length}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={<div className="ld-hud"><span className="gk-stat-label">사건</span><span className="ld-hud-v">{caseIdx + 1}/{CASES.length} · 확정 {solved.size}/{blanks.length}</span></div>}
      />

      <main className="gk-stage ld-stage">
        <div className="ld-head">
          <h1 className="ld-title">사건 {caseIdx + 1} · {c.title}</h1>
          <p className="ld-scene">{c.scene}</p>
        </div>

        {/* 증거 조사 */}
        <div className="ld-board" role="group" aria-label="증거">
          {c.clues.map((cl) => {
            const seen = examined.has(cl.en);
            return (
              <button key={cl.en} type="button" className={`ld-clue ${seen ? 'ld-clue--seen' : ''}`} onClick={() => examine(cl.en)} aria-label={cl.object}>
                <span className="ld-clue-ic" aria-hidden>{cl.icon}</span>
                <span className="ld-clue-obj">{cl.object}</span>
                {seen && <span className="ld-clue-word"><b>{cl.en}</b> {cl.ko}</span>}
              </button>
            );
          })}
        </div>

        {/* 서사 재구성 */}
        <div className="ld-file">
          <span className="ld-file-h">재구성</span>
          <p className="ld-narr">{renderNarrative()}</p>
        </div>

        {/* 단어 은행 */}
        {!caseSolved && (
          <div className="ld-bank" role="group" aria-label="수확한 단어">
            {bank.map((cl) => (
              <button key={cl.en} type="button" className={`ld-chip ${held === cl.en ? 'ld-chip--held' : ''}`} onClick={() => tapChip(cl.en)}>
                <b>{cl.en}</b><span>{cl.ko}</span>
              </button>
            ))}
            {bank.length === 0 && <span className="ld-bank-empty">{examined.size === 0 ? '증거를 조사해 단어를 수확하라' : '단어를 모두 배치했다'}</span>}
          </div>
        )}

        <div className="ld-actions">
          {msg && <span className={`ld-msg ${caseSolved ? 'ld-msg--ok' : ''}`}>{msg}</span>}
          <button type="button" className="gk-btn gk-btn--primary ld-submit" onClick={submit} disabled={!caseSolved && !allFilled}>
            {caseSolved ? (caseIdx + 1 < CASES.length ? '다음 사건 →' : '사건철 종결') : '재구성 확정'}
          </button>
        </div>
      </main>
    </div>
  );
}

const LD_CSS = `
  .ld-hud { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.05; }
  .ld-hud-v { font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 800; color: var(--t1); }
  .ld-stage { gap: clamp(10px, 2vh, 18px); justify-content: flex-start; padding-top: clamp(8px, 1.6vh, 16px); overflow-y: auto; }

  .ld-head { text-align: center; }
  .ld-title { margin: 0; font-family: var(--font-display, system-ui); font-size: clamp(19px, 3vw, 24px); font-weight: 800; color: var(--t1); }
  .ld-scene { margin: 4px 0 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13.5px; color: var(--t2); max-width: 56ch; }

  .ld-board { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; width: min(660px, 96vw); }
  @media (max-width: 560px) { .ld-board { grid-template-columns: repeat(4, 1fr); gap: 6px; } }
  .ld-clue { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 9px 5px; border-radius: 10px; border: 1.5px solid var(--bd); background: color-mix(in srgb, var(--bg) 62%, transparent); cursor: pointer; transition: transform .1s, border-color .15s, background .15s; text-align: center; }
  .ld-clue:hover { transform: translateY(-2px); border-color: var(--active); }
  .ld-clue:focus-visible { outline: none; border-color: var(--active); box-shadow: 0 0 0 3px color-mix(in srgb, var(--active) 28%, transparent); }
  .ld-clue-ic { font-size: 20px; }
  .ld-clue-obj { font-size: 10px; color: var(--t3); line-height: 1.15; }
  .ld-clue--seen { border-color: color-mix(in srgb, var(--active) 45%, var(--bd)); background: color-mix(in srgb, var(--active) 8%, var(--bg)); }
  .ld-clue-word { font-size: 10px; color: var(--t2); line-height: 1.15; margin-top: 1px; }
  .ld-clue-word b { font-family: var(--font-english, system-ui); color: var(--active); font-size: 11.5px; display: block; }

  .ld-file { width: min(620px, 94vw); padding: 14px 18px; border-radius: 12px; background: color-mix(in srgb, var(--bg) 78%, #fff); border: 1px solid var(--bd); box-shadow: 0 16px 40px -22px rgba(30,26,14,.6); }
  .ld-file-h { font-family: var(--font-english, monospace); font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--t3); font-weight: 700; }
  .ld-narr { margin: 8px 0 0; font-family: var(--font-body, Georgia, serif); font-size: clamp(15px, 2.3vw, 18px); line-height: 2; color: var(--t1); }
  .ld-slot { display: inline-flex; align-items: center; min-width: 74px; padding: 6px 10px; margin: 0 2px; border-radius: 7px; border: 1.5px dashed var(--active); background: color-mix(in srgb, var(--active) 6%, transparent); color: var(--t1); font-family: inherit; font-size: .92em; cursor: pointer; vertical-align: baseline; transition: border-color .15s, background .15s; }
  .ld-slot:hover:not(:disabled) { background: color-mix(in srgb, var(--active) 14%, transparent); }
  .ld-slot:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--active) 30%, transparent); }
  .ld-slot-hint { color: var(--active); font-size: .82em; font-style: italic; }
  .ld-slot-word { font-family: var(--font-english, system-ui); font-weight: 800; color: var(--combo); font-style: normal; }
  .ld-slot--filled { border-style: solid; }
  .ld-slot--solved { border-color: var(--success); background: color-mix(in srgb, var(--success) 12%, transparent); }
  .ld-slot--solved b { font-family: var(--font-english, system-ui); color: var(--success); font-weight: 800; }

  .ld-bank { display: flex; flex-wrap: wrap; gap: 7px; justify-content: center; width: min(660px, 96vw); min-height: 40px; }
  .ld-chip { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 44px; line-height: 1.05; padding: 7px 13px; border-radius: 10px; border: 1.5px solid var(--bd); background: var(--bg); cursor: pointer; transition: transform .1s, border-color .15s, box-shadow .15s; }
  .ld-chip b { font-family: var(--font-english, system-ui); font-size: 14px; font-weight: 800; color: var(--t1); }
  .ld-chip span { font-size: 9.5px; color: var(--t3); }
  .ld-chip:hover { border-color: var(--combo); transform: translateY(-2px); }
  .ld-chip:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 28%, transparent); }
  .ld-chip--held { border-color: var(--combo); background: var(--combo); box-shadow: 0 4px 14px color-mix(in srgb, var(--combo) 30%, transparent); transform: translateY(-2px); }
  .ld-chip--held b, .ld-chip--held span { color: var(--ti); }
  .ld-bank-empty { font-size: 12px; color: var(--t3); align-self: center; font-style: italic; }

  .ld-actions { display: flex; flex-direction: column; align-items: center; gap: 8px; padding-bottom: 8px; }
  .ld-msg { font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13.5px; font-weight: 700; color: var(--warning); }
  .ld-msg--ok { color: var(--success); }
  .ld-submit { min-width: 170px; }
`;
