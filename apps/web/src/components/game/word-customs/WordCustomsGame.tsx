// apps/web/src/components/game/word-customs/WordCustomsGame.tsx
// Word Customs — 정밀 검증·위조 적발 (Papers Please 계열). 영어 입국심사관이 되어
// 단어의 '여권'(철자·품사·뜻·예문)을 규칙서(일자별 누적)와 대조해 위조(false friend·철자·품사
// 오용)를 적발한다. 승인/거부 스탬프 + 거부 시 위조 항목 지목. 오류탐지 학습.

'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles, AmbientBackground, Hud, GameDone, useSfx, useCountUp, clamp, shuffle, type Word,
  GameMusic,
} from '@/components/game/_shared/gamekit';

interface Props { wordPool?: Word[]; onExit?: () => void; onCorrect?: (w: Word) => void; onWrong?: (w: Word) => void; }

type PosKo = '명사' | '동사' | '형용사' | '부사';
type Field = 'spelling' | 'pos' | 'definition' | 'example';
interface Traveler {
  en: string; ko: string;          // 진짜 철자·뜻 (정답/FSRS)
  word: string; pos: PosKo; posTrue: PosKo; def: string; example: string; // 제시(위조 시 상이)
  forgery: Field | null; truth: string;
}
interface Day { rules: string[]; travelers: Traveler[]; }

const L = (en: string, ko: string, pos: PosKo, example: string): Traveler =>
  ({ en, ko, word: en, pos, posTrue: pos, def: ko, example, forgery: null, truth: '모든 서류가 진본입니다.' });
const F = (en: string, ko: string, posTrue: PosKo, field: Field, shown: { word?: string; pos?: PosKo; def?: string }, truth: string, example: string): Traveler =>
  ({ en, ko, posTrue, word: shown.word ?? en, pos: shown.pos ?? posTrue, def: shown.def ?? ko, example, forgery: field, truth });

const DAYS: Day[] = [
  {
    rules: ['① 위조된 뜻(거짓 정의·false friend)을 거부하라'],
    travelers: [
      L('generous', '너그러운, 관대한', '형용사', 'He is very {} with his time.'),
      F('sensible', '분별 있는, 현명한', '형용사', 'definition', { def: '민감한, 예민한' }, 'sensible = 분별 있는 · "민감한"은 sensitive', 'She made a {} choice.'),
      L('postpone', '연기하다, 미루다', '동사', 'They had to {} the meeting.'),
      F('library', '도서관', '명사', 'definition', { def: '서점' }, 'library = 도서관 · "서점"은 bookstore', 'I borrowed a book from the {}.'),
      L('eventually', '결국, 마침내', '부사', 'She {} agreed to help.'),
      F('fabric', '천, 직물', '명사', 'definition', { def: '공장' }, 'fabric = 천/직물 · "공장"은 factory', 'The dress is made of soft {}.'),
    ],
  },
  {
    rules: ['① 위조된 뜻을 거부하라', '② 철자 오류를 거부하라'],
    travelers: [
      F('receive', '받다', '동사', 'spelling', { word: 'recieve' }, '철자 오류 · receive (i before e, except after c)', 'I will {} the package tomorrow.'),
      L('necessary', '필요한', '형용사', 'Clean water is {} for life.'),
      F('separate', '분리하다, 나누다', '동사', 'spelling', { word: 'seperate' }, '철자 오류 · separate ("there is a rat in sep-A-rate")', 'Please {} the recycling.'),
      F('familiar', '익숙한, 친숙한', '형용사', 'definition', { def: '친척의' }, 'familiar = 익숙한 · "친척의"는 related', 'The melody sounds {} to me.'),
      L('achieve', '이루다, 달성하다', '동사', 'She worked hard to {} her goal.'),
      F('definitely', '분명히, 확실히', '부사', 'spelling', { word: 'definately' }, '철자 오류 · definitely ("finite"가 들어있다)', 'I will {} be there on time.'),
    ],
  },
  {
    rules: ['① 위조된 뜻을 거부하라', '② 철자 오류를 거부하라', '③ 품사 표기 오류를 거부하라'],
    travelers: [
      F('success', '성공', '명사', 'pos', { pos: '형용사' }, 'success는 명사 · 형용사는 successful', 'The concert was a great {}.'),
      L('analyze', '분석하다', '동사', 'We must {} the results carefully.'),
      F('economic', '경제의', '형용사', 'pos', { pos: '명사' }, 'economic은 형용사 · 명사는 economy/economics', 'The country faces serious {} problems.'),
      L('reliable', '믿을 만한, 신뢰할 수 있는', '형용사', 'He is a {} and honest partner.'),
      F('complement', '보완(물)', '명사', 'definition', { def: '칭찬' }, 'complement = 보완(물) · "칭찬"은 compliment', 'This wine is a perfect {} to the meal.'),
      L('gradually', '점차, 서서히', '부사', 'The evening sky {} grew dark.'),
    ],
  },
];

const FIELD_CHIPS: { field: Field; label: string }[] = [
  { field: 'spelling', label: '철자' }, { field: 'pos', label: '품사' }, { field: 'definition', label: '뜻' }, { field: 'example', label: '예문' },
];

// ── 실 어휘 배선: 스코프 단어 → 여권. 진본 + 결정적 위조(뜻 swap·품사 오표기) 생성. ──
const escapeRegWC = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const posKoFromData = (raw?: string): PosKo | undefined => {
  const s = (raw || '').toLowerCase();
  if (/adverb|부사/.test(s)) return '부사'; // 'adverb'⊃'verb' → 먼저
  if (/adjective|형용사/.test(s)) return '형용사';
  if (/verb|동사/.test(s)) return '동사';
  if (/noun|명사/.test(s)) return '명사';
  return undefined;
};
const POS_ALL: PosKo[] = ['명사', '동사', '형용사', '부사'];
function buildDaysFromPool(pool?: Word[]): Day[] | null {
  if (!pool || pool.length < 9) return null;
  const seen = new Set<string>();
  const usable: { en: string; ko: string; posTrue: PosKo; example: string }[] = [];
  for (const w of pool) {
    if (!w.en || !w.ko || !w.example || seen.has(w.en)) continue;
    if (!/^[a-z][a-z-]{2,}$/i.test(w.en.trim())) continue;
    const posTrue = posKoFromData(w.pos);
    if (!posTrue) continue;
    const forms = [w.en, ...(w.inflected ?? [])].filter((f) => f && f.length >= 2);
    let ex: string | null = null;
    for (const f of forms) { const re = new RegExp(`\\b${escapeRegWC(f)}\\b`, 'i'); if (re.test(w.example)) { ex = w.example.replace(re, '{}'); break; } }
    if (!ex) continue; // 예문에 단어 없으면 여권 예문 불가 → 제외
    seen.add(w.en);
    usable.push({ en: w.en.trim(), ko: w.ko, posTrue, example: ex });
    if (usable.length >= 18) break;
  }
  if (usable.length < 9) return null;
  const u = shuffle(usable);
  const PER = 6;
  const dayRules = [
    ['① 위조된 뜻(false friend)을 거부하라'],
    ['① 위조된 뜻을 거부하라', '② 품사 표기 오류를 거부하라'],
    ['① 위조된 뜻을 거부하라', '② 품사 표기 오류를 거부하라'],
  ];
  const days: Day[] = [];
  for (let d = 0; d * PER < u.length && d < 3; d++) {
    const slice = u.slice(d * PER, d * PER + PER);
    if (slice.length < 3) break;
    const allowPos = d >= 1;
    // 위조 위치를 매 판 랜덤화(항상 2·5번이면 "2·5는 가짜"로 학습돼 판정이 무의미) — 최소 1명은 진짜.
    const forgeCount = Math.min(2, Math.max(1, slice.length - 1));
    const forgeSet = new Set(shuffle(slice.map((_, i) => i)).slice(0, forgeCount));
    const travelers: Traveler[] = slice.map((item, i) => {
      const forge: Field | null = forgeSet.has(i) ? (allowPos && Math.random() < 0.5 ? 'pos' : 'definition') : null;
      if (!forge) return L(item.en, item.ko, item.posTrue, item.example);
      if (forge === 'definition') {
        const other = slice.find((x, j) => j !== i && x.ko !== item.ko) ?? u.find((x) => x.ko !== item.ko)!;
        return F(item.en, item.ko, item.posTrue, 'definition', { def: other.ko }, `실제 뜻: ${item.ko}`, item.example);
      }
      const wrongPos = POS_ALL.find((pp) => pp !== item.posTrue)!;
      return F(item.en, item.ko, item.posTrue, 'pos', { pos: wrongPos }, `실제 품사: ${item.posTrue} (표기는 ${wrongPos})`, item.example);
    });
    days.push({ rules: dayRules[d], travelers });
  }
  return days.length ? days : null;
}

export function WordCustomsGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();
  const [dayIdx, setDayIdx] = useState(0);
  const [tIdx, setTIdx] = useState(0);
  const [phase, setPhase] = useState<'inspect' | 'reason' | 'reveal' | 'done'>('inspect');
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [caught, setCaught] = useState(0);   // 위조 적발
  const [missed, setMissed] = useState(0);   // 위조 통과(놓침)
  const [total, setTotal] = useState(0);
  const shownScore = useCountUp(score);
  const comboRef = useRef(0);
  const lock = useRef(false);

  const days = useMemo(() => buildDaysFromPool(wordPool) ?? DAYS, [wordPool]);
  const day = days[dayIdx];
  const t = day.travelers[tIdx];
  const totalTravelers = useMemo(() => days.reduce((n, d) => n + d.travelers.length, 0), [days]);

  const resolve = useCallback((ok: boolean, text: string, isForgeryCaught: boolean, isMiss: boolean) => {
    setTotal((n) => n + 1);
    if (ok) {
      const nc = comboRef.current + 1; comboRef.current = nc; setCombo(nc);
      const g = Math.round((80 + (isForgeryCaught ? 50 : 0)) * (1 + Math.floor(nc / 4) * 0.5));
      setScore((s) => s + g); setCorrect((c) => c + 1);
      if (isForgeryCaught) setCaught((c) => c + 1);
      sfx.correct(nc, nc % 4 === 0);
      onCorrect?.({ en: t.en, ko: t.ko });
    } else {
      comboRef.current = 0; setCombo(0);
      if (isMiss) setMissed((m) => m + 1);
      sfx.wrong();
      onWrong?.({ en: t.en, ko: t.ko });
    }
    setVerdict({ ok, text }); setPhase('reveal');
  }, [t, sfx, onCorrect, onWrong]);

  const stampApprove = useCallback(() => {
    if (lock.current) return; lock.current = true;
    if (t.forgery === null) resolve(true, '진본 통과 — 정확한 판단.', false, false);
    else resolve(false, `위조 통과! ${t.truth}`, false, true);
  }, [t, resolve]);

  const stampDeny = useCallback(() => {
    if (phase !== 'inspect') return;
    sfx.click(); setPhase('reason');
  }, [phase, sfx]);

  const pickField = useCallback((field: Field) => {
    if (lock.current) return; lock.current = true;
    if (t.forgery === null) resolve(false, '진본을 거부 — 오심(誤審).', false, false);
    else if (field === t.forgery) resolve(true, `적발! ${t.truth}`, true, false);
    else resolve(false, `위조는 맞으나 항목 오인 — ${t.truth}`, false, false);
  }, [t, resolve]);

  const advance = useCallback(() => {
    lock.current = false; setVerdict(null);
    if (tIdx + 1 < day.travelers.length) { setTIdx((i) => i + 1); setPhase('inspect'); }
    else if (dayIdx + 1 < days.length) { setDayIdx((d) => d + 1); setTIdx(0); setPhase('inspect'); }
    // days/day 는 wordPool 고정 후 불변
    else { sfx.fanfare(); setPhase('done'); }
  }, [tIdx, day, days, dayIdx, sfx]);

  const handleExit = useCallback(() => onExit?.(), [onExit]);
  const comboTier = clamp(Math.floor(combo / 4), 0, 3);

  const exParts = t.example.split('{}');
  const rowClass = (f: Field) => `wc-row ${phase === 'reveal' && t.forgery === f ? 'wc-row--forged' : ''}`;

  if (phase === 'done') {
    return (
      <div className="gk-root wc-root">

            <GameMusic gameId="word-customs" />
      <div className="gk-sr" aria-live="assertive">{verdict?.text ?? ''}</div>
        <GameKitStyles />
        <AmbientBackground center="#F2E9D6" mid="#D6C4A0" edge="#3C2E22" glow="rgba(214,160,90,.32)" glowAt="50% 30%" watermark="word-customs" />
        <style dangerouslySetInnerHTML={{ __html: WC_CSS }} />
        <Hud muted={sfx.muted} onToggleMute={() => sfx.setMuted((m) => !m)} onExit={handleExit} />
        <GameDone
          mark="word-customs"
          lead="근무 교대 — 국경이 정직해졌다"
          stats={[
            { num: score.toLocaleString(), label: '점수', accent: true },
            { num: `${total ? Math.round((correct / total) * 100) : 0}%`, label: `판정 정확도 · ${correct}/${total}` },
            { num: `🛡 ${caught}`, label: '위조 적발' },
            { num: missed, label: '통과 실패' },
          ]}
          restartLabel="다시 근무"
          onRestart={() => { setDayIdx(0); setTIdx(0); setPhase('inspect'); setVerdict(null); setScore(0); setCombo(0); comboRef.current = 0; setCorrect(0); setCaught(0); setMissed(0); setTotal(0); lock.current = false; }}
          onExit={handleExit}
        />
      </div>
    );
  }

  return (
    <div className="gk-root wc-root">

          <GameMusic gameId="word-customs" />
      <div className="gk-sr" aria-live="assertive">{verdict?.text ?? ''}</div>
      <GameKitStyles />
      <AmbientBackground center="#F2E9D6" mid="#D6C4A0" edge="#3C2E22" glow="rgba(214,160,90,.3)" glowAt="50% 20%" watermark="word-customs" />
      <style dangerouslySetInnerHTML={{ __html: WC_CSS }} />
      <Hud
        score={shownScore}
        progress={total / totalTravelers}
        combo={combo}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={<div className="wc-day"><span className="gk-stat-label">근무일</span><span className="wc-day-v">제 {dayIdx + 1} 일 · 적발 {caught}</span></div>}
      />

      <main className="gk-stage wc-stage">
        {/* 규칙서 */}
        <div className="wc-rules" aria-label="규칙서">
          <span className="wc-rules-h">오늘의 규칙</span>
          {day.rules.map((r, i) => <span key={i} className="wc-rule">{r}</span>)}
        </div>

        {/* 여권 서류 */}
        <div className={`wc-doc ${phase === 'reveal' ? (verdict?.ok ? 'wc-doc--ok' : 'wc-doc--no') : ''}`}>
          <div className="wc-doc-top"><span className="wc-doc-title">ENTRY PERMIT · 입국 심사</span><span className="wc-doc-serial">№ {String(total + 1).padStart(3, '0')}</span></div>
          <div className="wc-headword" data-forged={phase === 'reveal' && t.forgery === 'spelling'}>{t.word}</div>
          <div className="wc-fields">
            <div className={rowClass('pos')}><span className="wc-k">품사</span><span className="wc-v">{t.pos}{phase === 'reveal' && t.forgery === 'pos' && <em className="wc-fix"> → {t.posTrue}</em>}</span></div>
            <div className={rowClass('definition')}><span className="wc-k">뜻(신고)</span><span className="wc-v">{t.def}{phase === 'reveal' && t.forgery === 'definition' && <em className="wc-fix"> → {t.ko}</em>}</span></div>
            <div className={rowClass('example')}><span className="wc-k">예문</span><span className="wc-v wc-ex">{exParts[0]}<b>{t.word}</b>{exParts[1]}</span></div>
            {phase === 'reveal' && t.forgery === 'spelling' && <div className="wc-row wc-row--forged"><span className="wc-k">철자</span><span className="wc-v"><em className="wc-fix">정정 → {t.en}</em></span></div>}
          </div>
        </div>

        {/* 판정 */}
        {phase === 'reveal' ? (
          <div className="wc-verdict-box">
            <span className={`wc-verdict ${verdict?.ok ? 'wc-verdict--ok' : 'wc-verdict--no'}`}>{verdict?.ok ? '✓ 정확' : '✗ 오류'}</span>
            <span className="wc-truth">{verdict?.text}</span>
            <button type="button" className="gk-btn gk-btn--primary wc-next" onClick={advance}>다음 여행자 →</button>
          </div>
        ) : phase === 'reason' ? (
          <div className="wc-reason">
            <span className="wc-reason-h">어느 서류가 위조인가?</span>
            <div className="wc-chips">
              {FIELD_CHIPS.map((c) => <button key={c.field} type="button" className="wc-chip" onClick={() => pickField(c.field)}>{c.label}</button>)}
            </div>
            <button type="button" className="wc-back" onClick={() => setPhase('inspect')}>← 다시 보기</button>
          </div>
        ) : (
          <div className="wc-stamps">
            <button type="button" className="wc-stamp wc-stamp--approve" onClick={stampApprove}>승인<span>APPROVE</span></button>
            <button type="button" className="wc-stamp wc-stamp--deny" onClick={stampDeny}>거부<span>DENY</span></button>
          </div>
        )}
        <div className="gk-energy" aria-hidden="true" style={{ opacity: Math.min(0.4, combo * 0.03), transform: `scale(${1 + comboTier * 0.12})` }} />
      </main>
    </div>
  );
}

const WC_CSS = `
  .wc-day { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.05; }
  .wc-day-v { font-family: var(--font-english, monospace); font-size: 13px; font-weight: 800; color: var(--t1); }
  .wc-stage { gap: clamp(12px, 2.4vh, 22px); justify-content: flex-start; padding-top: clamp(12px, 2.4vh, 24px); }

  .wc-rules { display: flex; flex-direction: column; gap: 4px; width: min(560px, 94vw); padding: 12px 16px; border-radius: 10px; background: color-mix(in srgb, var(--bg) 55%, transparent); border: 1px solid var(--bd); border-left: 3px solid var(--error); backdrop-filter: blur(3px); }
  .wc-rules-h { font-family: var(--font-english, monospace); font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--error); font-weight: 800; }
  .wc-rule { font-size: 12.5px; color: var(--t2); font-weight: 600; }

  .wc-doc { width: min(560px, 94vw); border-radius: 14px; background: color-mix(in srgb, var(--bg) 82%, #fff); border: 1px solid var(--bd); box-shadow: 0 20px 44px -22px rgba(40,26,14,.6); overflow: hidden; transition: box-shadow .2s; }
  .wc-doc--ok { box-shadow: 0 0 0 2px var(--success), 0 20px 44px -22px rgba(40,26,14,.6); }
  .wc-doc--no { box-shadow: 0 0 0 2px var(--error), 0 20px 44px -22px rgba(40,26,14,.6); }
  .wc-doc-top { display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; background: color-mix(in srgb, var(--t1) 8%, transparent); border-bottom: 1px solid var(--bd); }
  .wc-doc-title { font-family: var(--font-english, monospace); font-size: 10.5px; letter-spacing: .12em; color: var(--t2); font-weight: 700; }
  .wc-doc-serial { font-family: var(--font-english, monospace); font-size: 11px; color: var(--t3); }
  .wc-headword { font-family: var(--font-english, monospace); font-size: clamp(26px, 5vw, 38px); font-weight: 800; text-align: center; padding: 14px 10px 8px; color: var(--t1); letter-spacing: .01em; }
  .wc-headword[data-forged="true"] { color: var(--error); text-decoration: underline wavy var(--error); }
  .wc-fields { display: flex; flex-direction: column; padding: 4px 16px 16px; }
  .wc-row { display: grid; grid-template-columns: 74px 1fr; gap: 10px; padding: 8px 8px; border-radius: 8px; border-bottom: 1px solid var(--bd); align-items: baseline; }
  .wc-row:last-child { border-bottom: none; }
  .wc-row--forged { background: var(--error-light); box-shadow: inset 3px 0 0 var(--error); }
  .wc-k { font-family: var(--font-english, monospace); font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--t3); font-weight: 700; }
  .wc-v { font-size: 14.5px; color: var(--t1); font-weight: 600; }
  .wc-ex { font-family: var(--font-body, Georgia, serif); font-weight: 400; font-size: 14px; line-height: 1.45; }
  .wc-ex b { font-family: var(--font-english, system-ui); font-weight: 800; color: var(--combo); }
  .wc-fix { color: var(--success); font-style: normal; font-weight: 800; font-size: 13px; }

  .wc-stamps { display: flex; gap: 16px; }
  .wc-stamp { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 132px; padding: 14px 20px; border-radius: 12px; border: 2px solid; background: var(--bg); cursor: pointer; font-family: var(--font-display, system-ui); font-size: 19px; font-weight: 800; transition: transform .1s, box-shadow .15s, background .15s; }
  .wc-stamp span { font-family: var(--font-english, monospace); font-size: 10px; letter-spacing: .2em; opacity: .7; }
  .wc-stamp:active { transform: scale(.95) rotate(-2deg); }
  .wc-stamp--approve { color: var(--success); border-color: var(--success); }
  .wc-stamp--approve:hover { background: var(--success-light); box-shadow: 0 8px 22px color-mix(in srgb, var(--success) 26%, transparent); }
  .wc-stamp--deny { color: var(--error); border-color: var(--error); }
  .wc-stamp--deny:hover { background: var(--error-light); box-shadow: 0 8px 22px color-mix(in srgb, var(--error) 26%, transparent); }
  .wc-stamp:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 30%, transparent); }

  .wc-reason { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .wc-reason-h { font-size: 14px; font-weight: 800; color: var(--t1); }
  .wc-chips { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .wc-chip { padding: 11px 20px; border-radius: 999px; border: 1.5px solid var(--error); background: var(--bg); color: var(--t1); font-size: 14px; font-weight: 700; cursor: pointer; transition: transform .1s, background .15s, box-shadow .15s; }
  .wc-chip:hover { background: var(--error-light); transform: translateY(-2px); box-shadow: 0 6px 16px color-mix(in srgb, var(--error) 22%, transparent); }
  .wc-chip:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--error) 30%, transparent); }
  .wc-back { background: none; border: none; color: var(--t3); font-size: 12px; cursor: pointer; padding: 4px; }
  .wc-back:hover { color: var(--t1); }

  .wc-verdict-box { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
  .wc-verdict { font-family: var(--font-display, system-ui); font-size: 22px; font-weight: 900; animation: gk-pop .4s ease-out; }
  .wc-verdict--ok { color: var(--success); }
  .wc-verdict--no { color: var(--error); }
  .wc-truth { font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 14px; color: var(--t2); max-width: 48ch; line-height: 1.5; }
  .wc-next { margin-top: 6px; min-width: 160px; }

  @media (prefers-reduced-motion: reduce) { .wc-verdict { animation: none; } }
`;
