// apps/web/src/components/game/word-customs/WordCustomsGame.tsx
// Word Customs — 국경 심사대 (Papers, Please 계열). 학습자의 단어가 '입국 서류'로 도착하고
// 심사관은 벨이 울리기 전에 줄을 비워야 한다. 서류는 철자·품사·뜻·예문 4축이며 위조는
// **학습자 단어에서 절차적으로 생성**된다(고정 대본 없음 · 매 판 다름).
//
// v07.9 재설계 — 감사 23/50 의 원인 4가지를 구조로 제거했다.
//   ① 압력 0        → 근무일별 벽시계(useCountdown). 정확 +4초 · 오심 -7초 · 오심 3회면 교대 해제.
//   ② 매 판 같은 판 → 내장 뱅크도 '단어 목록'으로 격하하고 생성기 한 경로로 통일 + runSeed.
//   ③ 지식 없이 승리 → 위조 개수 랜덤 · 오표기 품사 랜덤 · 위조 뜻은 그날 화면에 없는 뜻 ·
//                     철자 위조는 실제 철자에서 절차 생성 · 예문 위조(문맥 인출) 신설.
//   ④ 18번 강제 정지 → 정확 판정은 1초 뒤 자동 진행 · 전 조작 키보드(A/D/F/1-4/Space/Esc).
// 트레이드오프: '속결 서약' — 4.5초 안에 끝내면 ×2, 못 끝내면 미결 -8초. 화면에 정보를 더하지
// 않으므로 인출 규칙을 깨지 않으면서 "지금 이 단어를 정말 아는가"에 판돈을 건다.

'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles, AmbientBackground, Hud, GameDone, useSfx, useCountUp, clamp, shuffle,
  GameMusic, ParticleBurst, FeedbackIcon, TimerBar, LifePips, Kbd,
  useCountdown, useCombo, usePersonalBest, DEFAULT_COMBO_TIERS, type Word,
} from '@/components/game/_shared/gamekit';

interface Props { wordPool?: Word[]; onExit?: () => void; onCorrect?: (w: Word) => void; onWrong?: (w: Word) => void; }

type PosKo = '명사' | '동사' | '형용사' | '부사';
type Field = 'spelling' | 'pos' | 'definition' | 'example';
type OutcomeKind = 'correct' | 'near' | 'wrong' | 'lapse';
type StampKind = 'approve' | 'deny' | 'pending';
type Phase = 'shift' | 'inspect' | 'reason' | 'reveal' | 'done';

/** 생성기 입력 — 단어 하나가 가진 사실. ex 는 단어 자리가 `{}` 인 예문 템플릿. */
interface Src { en: string; ko: string; pos?: PosKo; ex?: string }

interface Traveler {
  key: string;
  /** 진실 */
  en: string; ko: string; posTrue?: PosKo; exTrue?: string;
  /** 서류에 인쇄된 값(위조면 진실과 다르다) */
  word: string; pos?: PosKo; def: string; ex?: string;
  forgery: Field | null;
  truth: string;
}
interface Day { rules: string[]; fields: Field[]; travelers: Traveler[]; ms: number }

const FIELD_LABEL: Record<Field, string> = { spelling: '철자', pos: '품사', definition: '뜻', example: '예문' };
const RULE_LINE: Record<Field, string> = {
  definition: '① 신고된 뜻이 그 단어의 뜻이 아니면 거부',
  spelling: '② 철자가 틀렸으면 거부',
  pos: '③ 품사 표기가 틀렸으면 거부',
  example: '④ 예문 속 쓰임이 그 단어의 것이 아니면 거부',
};
const STANDING_RULE = '거부할 때는 위조 항목까지 지목해야 인정 — 항목을 잘못 짚으면 시간이 깎인다';

// ── 근무 규칙 상수 ────────────────────────────────────────────────────────
const CITATIONS = 3;              // 하루 허용 오심(매 근무일 초기화)
const SHIFT_BANNER_MS = 1900;
const PLEDGE_WINDOW_MS = 3000;    // 서류 도착 후 서약 가능 시간
const PLEDGE_LIMIT_MS = 4500;     // 서약 시 판정 제한
const T_CORRECT = 4000;
const T_NEAR = 4000;
const T_WRONG = 7000;
const T_LAPSE = 8000;
const T_TIER = 3000;
const T_PLEDGE = 5000;
const AUTO_ADVANCE_MS = 1050;

// ── 내장 단어 뱅크 (wordPool 이 없을 때만) — 위조는 여기서도 생성기가 만든다 ──
const BANK: Src[] = [
  { en: 'generous', ko: '너그러운, 관대한', pos: '형용사', ex: 'He is very {} with his time.' },
  { en: 'sensible', ko: '분별 있는, 현명한', pos: '형용사', ex: 'She made a {} choice.' },
  { en: 'postpone', ko: '연기하다, 미루다', pos: '동사', ex: 'They had to {} the meeting.' },
  { en: 'library', ko: '도서관', pos: '명사', ex: 'I borrowed a book from the {}.' },
  { en: 'eventually', ko: '결국, 마침내', pos: '부사', ex: 'She {} agreed to help.' },
  { en: 'fabric', ko: '천, 직물', pos: '명사', ex: 'The dress is made of soft {}.' },
  { en: 'receive', ko: '받다', pos: '동사', ex: 'I will {} the package tomorrow.' },
  { en: 'necessary', ko: '필요한', pos: '형용사', ex: 'Clean water is {} for life.' },
  { en: 'separate', ko: '분리하다, 나누다', pos: '동사', ex: 'Please {} the recycling.' },
  { en: 'familiar', ko: '익숙한, 친숙한', pos: '형용사', ex: 'The melody sounds {} to me.' },
  { en: 'achieve', ko: '이루다, 달성하다', pos: '동사', ex: 'She worked hard to {} her goal.' },
  { en: 'definitely', ko: '분명히, 확실히', pos: '부사', ex: 'I will {} be there on time.' },
  { en: 'success', ko: '성공', pos: '명사', ex: 'The concert was a great {}.' },
  { en: 'analyze', ko: '분석하다', pos: '동사', ex: 'We must {} the results carefully.' },
  { en: 'economic', ko: '경제의', pos: '형용사', ex: 'The country faces serious {} problems.' },
  { en: 'reliable', ko: '믿을 만한, 신뢰할 수 있는', pos: '형용사', ex: 'He is a {} and honest partner.' },
  { en: 'complement', ko: '보완(물)', pos: '명사', ex: 'This wine is a perfect {} to the meal.' },
  { en: 'gradually', ko: '점차, 서서히', pos: '부사', ex: 'The evening sky {} grew dark.' },
  { en: 'persuade', ko: '설득하다', pos: '동사', ex: 'They tried to {} him to stay.' },
  { en: 'accurate', ko: '정확한', pos: '형용사', ex: 'The report must be {} and complete.' },
  { en: 'maintain', ko: '유지하다, 관리하다', pos: '동사', ex: 'We must {} the engine regularly.' },
  { en: 'curious', ko: '호기심 많은', pos: '형용사', ex: 'The child was {} about everything.' },
];

// ── 스코프 단어 → 생성기 입력 ─────────────────────────────────────────────
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

function normalizeSources(pool: Word[]): Src[] {
  const seen = new Set<string>();
  const out: Src[] = [];
  for (const w of pool) {
    const en = (w.en ?? '').trim();
    const ko = (w.ko ?? '').trim();
    if (!en || !ko) continue;
    if (!/^[a-zA-Z][a-zA-Z'-]{2,}$/.test(en)) continue;
    const lower = en.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    let ex: string | undefined;
    if (w.example) {
      const forms = [en, ...(w.inflected ?? [])].filter((f) => f && f.length >= 2);
      for (const f of forms) {
        const re = new RegExp(`\\b${escapeRegWC(f)}\\b`, 'i');
        if (re.test(w.example)) { ex = w.example.replace(re, '{}'); break; }
      }
    }
    out.push({ en, ko, pos: posKoFromData(w.pos), ex });
  }
  return out;
}

/** 학습자 단어를 최우선. 너무 적을 때만 뱅크로 채우되 학습자 단어는 반드시 남긴다(FSRS 적재). */
function resolveSources(pool: Word[] | undefined): Src[] {
  const mine = normalizeSources(pool ?? []);
  if (mine.length >= 6) return mine.slice(0, 18);
  if (mine.length >= 2) {
    const have = new Set(mine.map((m) => m.en.toLowerCase()));
    const fill = shuffle(BANK.filter((b) => !have.has(b.en.toLowerCase()))).slice(0, Math.max(0, 8 - mine.length));
    return [...mine, ...fill];
  }
  return BANK;
}

// ── 철자 위조 — 실제 철자에서 절차 생성(고정 목록 아님) ────────────────────
function misspell(word: string, taken: Set<string>): string | null {
  const w = word.toLowerCase();
  if (word !== w || !/^[a-z-]{5,}$/.test(w)) return null;
  const cands: string[] = [];
  const push = (s: string) => { if (s && s !== w && s.length >= 4 && !taken.has(s)) cands.push(s); };

  if (w.includes('ie')) push(w.replace('ie', 'ei'));
  if (w.includes('ei')) push(w.replace('ei', 'ie'));
  const dbl = w.match(/([bcdfglmnprstz])\1/);
  if (dbl) push(w.replace(dbl[0], dbl[1]));
  const single = w.match(/[aeiou]([bcdfglmnprt])[aeiou]/);
  if (single) { const i = w.indexOf(single[0]) + 1; push(w.slice(0, i) + single[1] + w.slice(i)); }
  if (/able$/.test(w)) push(w.replace(/able$/, 'ible'));
  if (/ible$/.test(w)) push(w.replace(/ible$/, 'able'));
  if (/ance$/.test(w)) push(w.replace(/ance$/, 'ence'));
  if (/ence$/.test(w)) push(w.replace(/ence$/, 'ance'));
  if (/ent$/.test(w)) push(w.replace(/ent$/, 'ant'));
  if (/ant$/.test(w)) push(w.replace(/ant$/, 'ent'));
  if (/ary$/.test(w)) push(w.replace(/ary$/, 'ery'));
  if (/ely$/.test(w)) push(w.replace(/ely$/, 'ley'));
  if (/tion$/.test(w)) push(w.replace(/tion$/, 'sion'));
  if (/sion$/.test(w)) push(w.replace(/sion$/, 'tion'));
  if (/ous$/.test(w)) push(w.replace(/ous$/, 'ious'));
  const vi = w.slice(1).search(/[ae]/);
  if (vi >= 0) { const i = vi + 1; push(w.slice(0, i) + (w[i] === 'a' ? 'e' : 'a') + w.slice(i + 1)); }

  return cands.length ? shuffle(cands)[0] : null;
}

// ── 하루 편성 ──────────────────────────────────────────────────────────────
function buildRun(srcs: Src[]): Day[] {
  const u = shuffle(srcs).slice(0, 18);
  const n = u.length;
  if (n < 4) return [];
  const dayCount = n >= 12 ? 3 : 2;
  const base = Math.floor(n / dayCount);
  const rem = n % dayCount;
  const sizes = Array.from({ length: dayCount }, (_, i) => base + (i >= dayCount - rem ? 1 : 0));
  const perMs = dayCount === 3 ? [10500, 9000, 7600] : [10200, 8200];
  const fieldPlan: Field[][] = dayCount === 3
    ? [['definition'], ['definition', 'spelling'], ['definition', 'spelling', 'pos', 'example']]
    : [['definition'], ['definition', 'spelling', 'pos', 'example']];
  const ratio = dayCount === 3 ? [0.3, 0.42, 0.54] : [0.32, 0.5];

  const known = new Set(u.map((x) => x.en.toLowerCase()));
  const days: Day[] = [];
  let cursor = 0;

  for (let d = 0; d < dayCount; d++) {
    const size = sizes[d];
    const slice = u.slice(cursor, cursor + size);
    cursor += size;
    const allowed = fieldPlan[d];
    const isLastDay = d === dayCount - 1;

    // 위조 수는 매 판·매 날 달라진다 — "n명 잡으면 나머지는 안전" 카운팅 봉쇄.
    let fc = Math.round(size * ratio[d]);
    if (Math.random() < 0.4) fc += 1;
    if (Math.random() < 0.25) fc -= 1;
    fc = clamp(fc, 1, Math.max(1, size - 1));
    const forgeIdx = new Set(shuffle(slice.map((_, i) => i)).slice(0, fc));

    // 위조 뜻 도너는 '오늘 화면에 한 번도 안 나오는 뜻'에서만 — 같은 날 진본과 겹치면
    // 대조만으로 적발이 가능해져 어휘 지식이 필요 없어진다.
    const dayKo = new Set(slice.map((x) => x.ko));
    let exampleUsed = 0;

    const travelers: Traveler[] = slice.map((item, i) => {
      const plain = (): Traveler => ({
        key: `${d}-${i}-${item.en}`,
        en: item.en, ko: item.ko, posTrue: item.pos, exTrue: item.ex,
        word: item.en, pos: item.pos, def: item.ko, ex: item.ex,
        forgery: null, truth: `진본 — ${item.en} 의 뜻은 “${item.ko}”.`,
      });
      if (!forgeIdx.has(i)) return plain();

      // 이 서류에 실제로 만들 수 있는 위조 종류만 후보로.
      const cands: Field[] = [];
      if (allowed.includes('definition')) cands.push('definition');
      if (allowed.includes('pos') && item.pos) cands.push('pos');
      if (allowed.includes('spelling') && misspell(item.en, known)) cands.push('spelling');
      if (allowed.includes('example') && isLastDay && exampleUsed < 1 && item.ex
        && u.some((x) => x.ex && x.en !== item.en)) cands.push('example');
      if (!cands.length) return plain();
      const field = shuffle(cands)[0];

      if (field === 'definition') {
        const pool = u.filter((x) => x.en !== item.en && !dayKo.has(x.ko));
        const samePos = pool.filter((x) => x.pos && item.pos && x.pos === item.pos);
        const donor = shuffle(samePos.length ? samePos : pool)[0]
          ?? shuffle(BANK.filter((b) => !dayKo.has(b.ko)))[0];
        if (!donor) return plain();
        return {
          ...plain(), def: donor.ko, forgery: 'definition',
          truth: `뜻 위조 — ${item.en} 의 뜻은 “${item.ko}”. 신고된 “${donor.ko}” 는 다른 단어의 뜻입니다.`,
        };
      }
      if (field === 'pos') {
        const wrong = shuffle(POS_ALL.filter((p) => p !== item.pos))[0];
        return {
          ...plain(), pos: wrong, forgery: 'pos',
          truth: `품사 위조 — ${item.en} 의 품사는 ${item.pos}. 서류에는 ${wrong} 로 적혀 있었습니다.`,
        };
      }
      if (field === 'spelling') {
        const bad = misspell(item.en, known);
        if (!bad) return plain();
        return {
          ...plain(), word: bad, forgery: 'spelling',
          truth: `철자 위조 — 올바른 철자는 ${item.en} (서류: ${bad}).`,
        };
      }
      // example — 같은 품사의 다른 단어 예문에 이 단어를 끼워 넣어 공선택을 붕괴시킨다.
      const donors = u.filter((x) => x.ex && x.en !== item.en);
      const samePosD = donors.filter((x) => x.pos && item.pos && x.pos === item.pos);
      const donor = shuffle(samePosD.length ? samePosD : donors)[0];
      if (!donor?.ex) return plain();
      exampleUsed += 1;
      return {
        ...plain(), ex: donor.ex, forgery: 'example',
        truth: `예문 위조 — ${item.en} 은 이 문맥에 쓰이지 않습니다. 실제 쓰임: “${(item.ex ?? '').replace('{}', item.en)}”`,
      };
    });

    days.push({
      rules: allowed.map((f) => RULE_LINE[f]),
      fields: allowed,
      travelers,
      ms: size * perMs[d],
    });
  }
  return days;
}

/** 이 서류에서 실제로 지목 가능한 항목 — 없는 칸은 칩도 없다(영구 오답 칩 제거). */
function chipsFor(t: Traveler, day: Day): Field[] {
  return day.fields.filter((f) =>
    f === 'definition' || f === 'spelling' || (f === 'pos' && !!t.pos) || (f === 'example' && !!t.ex));
}

const multFor = (c: number) => {
  let m = 1;
  for (const tier of DEFAULT_COMBO_TIERS) if (c >= tier.at) m = tier.mult;
  return m;
};

// ── 서류 (memo — useCountdown 이 매 프레임 부모를 리렌더한다) ───────────────
const Permit = memo(function Permit({
  t, tone, serial, revealed,
}: { t: Traveler; tone: OutcomeKind | null; serial: number; revealed: boolean }) {
  const exParts = (t.ex ?? '').split('{}');
  const trueEx = t.forgery === 'example' && t.exTrue ? t.exTrue.replace('{}', t.en) : null;
  const toneCls = tone === 'correct' ? 'wc-doc--ok' : tone === 'near' ? 'wc-doc--near' : tone ? 'wc-doc--no' : '';
  return (
    <div className={`wc-doc ${toneCls}`}>
      <div className="wc-doc-top">
        <span className="wc-doc-title">ENTRY PERMIT · 입국 서류</span>
        <span className="wc-doc-serial">№ {String(serial).padStart(3, '0')}</span>
      </div>
      <div className="wc-headword" data-forged={revealed && t.forgery === 'spelling'}>{t.word}</div>
      <div className="wc-fields">
        {revealed && t.forgery === 'spelling' && (
          <div className="wc-row wc-row--forged">
            <span className="wc-k">철자</span>
            <span className="wc-v"><em className="wc-fix">정정 → {t.en}</em></span>
          </div>
        )}
        {t.pos && (
          <div className={`wc-row ${revealed && t.forgery === 'pos' ? 'wc-row--forged' : ''}`}>
            <span className="wc-k">품사</span>
            <span className="wc-v">{t.pos}{revealed && t.forgery === 'pos' && <em className="wc-fix"> → {t.posTrue}</em>}</span>
          </div>
        )}
        <div className={`wc-row ${revealed && t.forgery === 'definition' ? 'wc-row--forged' : ''}`}>
          <span className="wc-k">뜻(신고)</span>
          <span className="wc-v">{t.def}{revealed && t.forgery === 'definition' && <em className="wc-fix"> → {t.ko}</em>}</span>
        </div>
        {t.ex && (
          <div className={`wc-row ${revealed && t.forgery === 'example' ? 'wc-row--forged' : ''}`}>
            <span className="wc-k">예문</span>
            <span className="wc-v wc-ex">{exParts[0]}<b>{t.word}</b>{exParts[1] ?? ''}</span>
          </div>
        )}
        {revealed && trueEx && (
          <div className="wc-row wc-row--fixed">
            <span className="wc-k">실제 쓰임</span>
            <span className="wc-v wc-ex"><em className="wc-fix">{trueEx}</em></span>
          </div>
        )}
      </div>
    </div>
  );
});

const RuleCard = memo(function RuleCard({ rules, dayNo }: { rules: string[]; dayNo: number }) {
  return (
    <div className="wc-rules" aria-label={`제 ${dayNo} 일 규칙서`}>
      <span className="wc-rules-h">규칙서 · 제 {dayNo} 일</span>
      {rules.map((r) => <span key={r} className="wc-rule">{r}</span>)}
      <span className="wc-rule wc-rule--std">{STANDING_RULE}</span>
    </div>
  );
});

export function WordCustomsGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();
  const [runSeed, setRunSeed] = useState(0);
  // runSeed 는 "값"이 아니라 **재편성 신호**다 — 이게 없으면 '다시 근무'가 인덱스만 되감아
  // 토씨 하나 같은 판을 다시 내보낸다(감사 지적 #2). 의도적 의존.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const days = useMemo(() => buildRun(resolveSources(wordPool)), [wordPool, runSeed]);
  const daysRef = useRef(days);
  daysRef.current = days;
  const totalTravelers = useMemo(() => days.reduce((n, d) => n + d.travelers.length, 0), [days]);

  const [phase, setPhase] = useState<Phase>('shift');
  const [dayIdx, setDayIdx] = useState(0);
  const [tIdx, setTIdx] = useState(0);
  const [bannerDay, setBannerDay] = useState(0);
  const [daySummary, setDaySummary] = useState<{ day: number; correct: number; caught: number; bonus: number } | null>(null);

  const [score, setScore] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [correctN, setCorrectN] = useState(0);
  const [caughtN, setCaughtN] = useState(0);
  const [pledgeWin, setPledgeWin] = useState(0);
  const [lives, setLives] = useState(CITATIONS);
  const [outcome, setOutcome] = useState<{ kind: OutcomeKind; text: string } | null>(null);
  const [stamp, setStamp] = useState<{ kind: StampKind; n: number } | null>(null);
  const [burst, setBurst] = useState<{ n: number; power: number } | null>(null);
  const [gain, setGain] = useState<{ v: number; mult: number; pledged: boolean; n: number } | null>(null);
  const [pledged, setPledged] = useState(false);
  const [pledgeOpen, setPledgeOpen] = useState(false);
  const [endReason, setEndReason] = useState<'clear' | 'time' | 'citations'>('clear');
  const [log, setLog] = useState<{ en: string; truth: string; kind: OutcomeKind }[]>([]);
  const [record, setRecord] = useState<{ prev: number | null; improved: boolean } | null>(null);

  const day: Day | undefined = days[dayIdx];
  const traveler: Traveler | undefined = day?.travelers[tIdx];

  // ── 최신값 ref (타이머/키보드 핸들러가 stale closure 를 보지 않게) ──────
  const travelerRef = useRef(traveler);
  travelerRef.current = traveler;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const pledgedRef = useRef(pledged);
  pledgedRef.current = pledged;
  const scoreRef = useRef(score);
  scoreRef.current = score;
  const dayIdxRef = useRef(dayIdx);
  dayIdxRef.current = dayIdx;
  const livesRef = useRef(lives);
  livesRef.current = lives;
  const lockRef = useRef(false);
  const stampSeq = useRef(0);
  const dayCorrect = useRef(0);
  const dayCaught = useRef(0);
  const dayCitations = useRef(0);
  const cleanDays = useRef(0);

  const winTimer = useRef(0);
  const deadTimer = useRef(0);
  const advTimer = useRef(0);
  const shiftTimer = useRef(0);
  const gainTimer = useRef(0);
  const clearT = (r: { current: number }) => { if (r.current) { window.clearTimeout(r.current); r.current = 0; } };
  const clearAll = useCallback(() => {
    [winTimer, deadTimer, advTimer, shiftTimer, gainTimer].forEach(clearT);
  }, []);

  // ── 근무 시계 ───────────────────────────────────────────────────────────
  const running = phase === 'inspect' || phase === 'reason';
  const finishRef = useRef<(r: 'clear' | 'time' | 'citations') => void>(() => {});
  const clock = useCountdown({
    totalMs: days[0]?.ms ?? 60000,
    running,
    warnAtMs: 9000,
    onWarn: () => sfx.click(),
    onEnd: () => finishRef.current('time'),
  });
  const clockRef = useRef(clock);
  clockRef.current = clock;

  const combo = useCombo({ onTierUp: () => { sfx.coin(); clockRef.current.extend(T_TIER); } });
  const shownScore = useCountUp(score);
  const pb = usePersonalBest('word-customs');

  // ── 진행 ────────────────────────────────────────────────────────────────
  const openPledgeWindow = useCallback(() => {
    setPledged(false);
    setPledgeOpen(true);
    clearT(winTimer);
    winTimer.current = window.setTimeout(() => setPledgeOpen(false), PLEDGE_WINDOW_MS);
  }, []);

  const finish = useCallback((reason: 'clear' | 'time' | 'citations') => {
    clearAll();
    lockRef.current = true;
    setEndReason(reason);
    setPhase('done');
    if (reason === 'clear') sfx.fanfare();
  }, [clearAll, sfx]);
  finishRef.current = finish;

  const beginShift = useCallback((idx: number) => {
    clearAll();
    setBannerDay(idx);
    setPhase('shift');
    lockRef.current = true;
    shiftTimer.current = window.setTimeout(() => {
      const d = daysRef.current[idx];
      if (!d) return;
      dayCorrect.current = 0; dayCaught.current = 0; dayCitations.current = 0;
      lockRef.current = false;
      setDayIdx(idx); setTIdx(0); setLives(CITATIONS);
      setOutcome(null); setStamp(null); setBurst(null);
      clockRef.current.reset(d.ms);
      setPhase('inspect');
      openPledgeWindow();
    }, SHIFT_BANNER_MS);
  }, [clearAll, openPledgeWindow]);
  const beginRef = useRef(beginShift);
  beginRef.current = beginShift;

  useEffect(() => {
    beginRef.current(0);
    return () => { clearAll(); };
  }, [clearAll]);

  // 개인 최고 기록은 렌더가 아니라 효과에서 제출한다(렌더 중 setState 금지).
  useEffect(() => {
    if (phase !== 'done' || record) return;
    setRecord(pb.submit(scoreRef.current));
  }, [phase, record, pb]);

  const advance = useCallback(() => {
    if (phaseRef.current !== 'reveal') return;
    // 오심 예산이 바닥나면 이 서류가 마지막 — 여기서 나아가면 해제 통보 타이머를 지워버린다.
    if (livesRef.current === 0) return;
    clearT(advTimer);
    const d = daysRef.current[dayIdxRef.current];
    if (!d) return;
    lockRef.current = false;
    if (tIdx + 1 < d.travelers.length) {
      setTIdx((i) => i + 1);
      setOutcome(null); setStamp(null); setBurst(null);
      setPhase('inspect');
      openPledgeWindow();
      return;
    }
    // 근무일 종료 — 남은 시간을 점수로 환산(빨리 비운 줄이 보상된다)
    const bonus = Math.max(0, Math.floor(clockRef.current.remainMs / 1000)) * 8;
    if (bonus > 0) { setScore((s) => s + bonus); sfx.coin(); }
    if (dayCitations.current === 0) cleanDays.current += 1;
    setDaySummary({ day: dayIdxRef.current + 1, correct: dayCorrect.current, caught: dayCaught.current, bonus });
    if (dayIdxRef.current + 1 < daysRef.current.length) beginRef.current(dayIdxRef.current + 1);
    else finish('clear');
  }, [tIdx, openPledgeWindow, finish, sfx]);
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  // ── 판정 ────────────────────────────────────────────────────────────────
  const finalize = useCallback((kind: OutcomeKind, stampKind: StampKind, text: string, caught: boolean) => {
    const t = travelerRef.current;
    if (!t) return;
    clearT(winTimer); clearT(deadTimer);
    setPledgeOpen(false);
    setProcessed((n) => n + 1);
    stampSeq.current += 1;
    const seq = stampSeq.current;
    setStamp({ kind: stampKind, n: seq });

    if (kind === 'correct') {
      const c = combo.hit();
      const mult = multFor(c);
      const wasPledged = pledgedRef.current;
      const g = Math.round((100 + (caught ? 60 : 0)) * mult * (wasPledged ? 2 : 1));
      setScore((s) => s + g);
      setGain({ v: g, mult, pledged: wasPledged, n: seq });
      clearT(gainTimer);
      gainTimer.current = window.setTimeout(() => setGain(null), 980);
      setCorrectN((n) => n + 1);
      dayCorrect.current += 1;
      if (caught) {
        setCaughtN((n) => n + 1);
        dayCaught.current += 1;
        setBurst({ n: seq, power: 1 + Math.floor(c / 4) });
      }
      if (wasPledged) setPledgeWin((n) => n + 1);
      clockRef.current.extend(T_CORRECT + (wasPledged ? T_PLEDGE : 0));
      sfx.correct(c, c % 3 === 0);
      onCorrect?.({ en: t.en, ko: t.ko });
    } else if (kind === 'near') {
      combo.miss();
      clockRef.current.drain(T_NEAR);
      sfx.nearMiss();
      onWrong?.({ en: t.en, ko: t.ko });
      setLog((l) => [...l, { en: t.en, truth: t.truth, kind }]);
    } else if (kind === 'wrong') {
      combo.miss();
      clockRef.current.drain(T_WRONG);
      sfx.wrong();
      dayCitations.current += 1;
      setLives((v) => Math.max(0, v - 1));
      onWrong?.({ en: t.en, ko: t.ko });
      setLog((l) => [...l, { en: t.en, truth: t.truth, kind }]);
    } else {
      // 미결 — 답하지 않았으므로 FSRS 에 적재하지 않는다(비난도 하지 않는다).
      combo.miss();
      clockRef.current.drain(T_LAPSE);
      sfx.nearMiss();
      setLog((l) => [...l, { en: t.en, truth: t.truth, kind }]);
    }

    setOutcome({ kind, text });
    setPhase('reveal');

    if (kind === 'wrong' && dayCitations.current >= CITATIONS) {
      advTimer.current = window.setTimeout(() => finishRef.current('citations'), 1700);
      return;
    }
    if (kind === 'correct') {
      advTimer.current = window.setTimeout(() => advanceRef.current(), AUTO_ADVANCE_MS);
    }
  }, [combo, sfx, onCorrect, onWrong]);

  const judge = useCallback((field: Field | null) => {
    if (lockRef.current) return;
    const t = travelerRef.current;
    if (!t) return;
    lockRef.current = true;
    if (field === null) {
      if (t.forgery === null) finalize('correct', 'approve', `진본 통과 — 정확한 판단입니다. ${t.truth}`, false);
      else finalize('wrong', 'approve', `위조를 통과시켰습니다. ${t.truth}`, false);
      return;
    }
    if (t.forgery === null) finalize('wrong', 'deny', `진본을 반송했습니다. ${t.truth}`, false);
    else if (field === t.forgery) finalize('correct', 'deny', `적발. ${t.truth}`, true);
    else finalize('near', 'deny', `위조는 맞았지만 항목이 달랐습니다 — 실제는 ${FIELD_LABEL[t.forgery]} 위조. ${t.truth}`, false);
  }, [finalize]);

  const lapse = useCallback(() => {
    if (lockRef.current) return;
    const t = travelerRef.current;
    if (!t) return;
    lockRef.current = true;
    finalize('lapse', 'pending', `속결 시간 초과 — 미결로 인계했습니다. ${t.truth}`, false);
  }, [finalize]);
  const lapseRef = useRef(lapse);
  lapseRef.current = lapse;

  const doPledge = useCallback(() => {
    if (pledgedRef.current || !pledgeOpen || lockRef.current) return;
    setPledged(true);
    setPledgeOpen(false);
    clearT(winTimer);
    sfx.click();
    clearT(deadTimer);
    deadTimer.current = window.setTimeout(() => lapseRef.current(), PLEDGE_LIMIT_MS);
  }, [pledgeOpen, sfx]);

  const onDeny = useCallback(() => {
    if (lockRef.current) return;
    const t = travelerRef.current;
    const d = daysRef.current[dayIdxRef.current];
    if (!t || !d) return;
    const c = chipsFor(t, d);
    if (c.length <= 1) { judge(c[0] ?? 'definition'); return; }
    sfx.click();
    setPhase('reason');
  }, [judge, sfx]);

  const chips = traveler && day ? chipsFor(traveler, day) : [];

  // 핸들러 최신본 — 키보드 리스너가 매 프레임 재구독되지 않게 ref 로 고정한다.
  const actRef = useRef({ judge, onDeny, doPledge, chips });
  actRef.current = { judge, onDeny, doPledge, chips };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const a = actRef.current;
      const p = phaseRef.current;
      if (p === 'inspect') {
        if (e.code === 'KeyA') { e.preventDefault(); a.judge(null); }
        else if (e.code === 'KeyD') { e.preventDefault(); a.onDeny(); }
        else if (e.code === 'KeyF') { e.preventDefault(); a.doPledge(); }
      } else if (p === 'reason') {
        const m = /^Digit([1-9])$/.exec(e.code);
        if (m) {
          const f = a.chips[Number(m[1]) - 1];
          if (f) { e.preventDefault(); a.judge(f); }
        } else if (e.code === 'Escape') { e.preventDefault(); setPhase('inspect'); }
      } else if (p === 'reveal') {
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
          e.preventDefault();
          advanceRef.current();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleExit = useCallback(() => { clearAll(); onExit?.(); }, [clearAll, onExit]);
  const restart = useCallback(() => {
    clearAll();
    lockRef.current = true;
    combo.reset();
    stampSeq.current = 0;
    dayCorrect.current = 0; dayCaught.current = 0; dayCitations.current = 0; cleanDays.current = 0;
    setRunSeed((s) => s + 1);
    setScore(0); setProcessed(0); setCorrectN(0); setCaughtN(0);
    setPledgeWin(0); setLives(CITATIONS); setOutcome(null); setStamp(null); setBurst(null);
    setGain(null); setDaySummary(null); setLog([]); setEndReason('clear'); setRecord(null);
    setDayIdx(0); setTIdx(0);
    beginRef.current(0);
  }, [clearAll, combo]);

  const night = dayIdx >= days.length - 1 && days.length > 1;
  const atmos = night
    ? { center: '#E4CFAE', mid: '#A9865A', edge: '#241811', glow: 'rgba(230,150,90,.42)' }
    : { center: '#F2E9D6', mid: '#D6C4A0', edge: '#3C2E22', glow: 'rgba(214,160,90,.3)' };

  // ── 결과 ────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const accuracy = processed ? Math.round((correctN / processed) * 100) : 0;
    const lead = endReason === 'clear'
      ? '근무 종료 — 오늘 국경은 정직했어요'
      : endReason === 'time'
        ? '벨이 울렸어요 — 줄이 아직 남았습니다'
        : '감독관이 교대를 요청했어요';
    const perfect = endReason === 'clear' && log.length === 0;
    const badge = perfect
      ? <>무결 근무 · 오심 0</>
      : combo.best >= 5
        ? <>최장 연속 {combo.best}건</>
        : cleanDays.current > 0
          ? <>무결 근무일 {cleanDays.current}일</>
          : null;
    const hint = endReason === 'time'
      ? '정확한 판정마다 4초가 돌아와요. 확실한 단어는 속결 서약(F)으로 시간을 벌어 보세요.'
      : endReason === 'citations'
        ? '거부는 항목까지 맞아야 인정돼요. 확신이 없으면 규칙서를 한 줄 더 읽는 편이 빠릅니다.'
        : `다음 근무는 ${(score + 400).toLocaleString()}점을 목표로.`;
    return (
      <div className="gk-root wc-root">
        <GameMusic gameId="word-customs" />
        <div className="gk-sr" aria-live="assertive">{outcome?.text ?? ''}</div>
        <GameKitStyles />
        <AmbientBackground center={atmos.center} mid={atmos.mid} edge={atmos.edge} glow={atmos.glow} glowAt="50% 30%" watermark="word-customs" />
        <style dangerouslySetInnerHTML={{ __html: WC_CSS }} />
        <Hud muted={sfx.muted} onToggleMute={() => sfx.setMuted((m) => !m)} onExit={handleExit} />
        <GameDone
          mark="word-customs"
          lead={lead}
          celebrate={perfect}
          badge={badge}
          best={record ? { prev: record.prev, now: score, label: '점수', improved: record.improved } : undefined}
          stats={[
            { num: score.toLocaleString(), label: '점수', accent: true },
            { num: `${accuracy}%`, label: `판정 정확도 · ${correctN}/${processed}` },
            { num: caughtN, label: '위조 적발' },
            { num: pledgeWin, label: '속결 성공' },
          ]}
          reveal={log.length > 0 ? (
            <div className="wc-recap">
              <span className="wc-recap-h">놓친 서류 — 다음 근무 전에 한 번만 더</span>
              {log.slice(-6).map((r, i) => (
                <span key={`${r.en}-${i}`} className="wc-recap-row">
                  <FeedbackIcon kind={r.kind === 'near' ? 'near' : 'wrong'} size={13} />
                  <span><b>{r.en}</b> — {r.truth}</span>
                </span>
              ))}
            </div>
          ) : undefined}
          restartHint={hint}
          restartLabel="다음 근무"
          onRestart={restart}
          onExit={handleExit}
        />
      </div>
    );
  }

  const bannerDayData = days[bannerDay];
  const newRule = bannerDay > 0 && bannerDayData
    ? bannerDayData.rules.filter((r) => !days[bannerDay - 1].rules.includes(r))
    : [];

  return (
    <div className="gk-root wc-root">
      <GameMusic gameId="word-customs" />
      <div className="gk-sr" aria-live="assertive">{outcome?.text ?? ''}</div>
      <GameKitStyles />
      <AmbientBackground center={atmos.center} mid={atmos.mid} edge={atmos.edge} glow={atmos.glow} glowAt="50% 20%" watermark="word-customs" />
      <style dangerouslySetInnerHTML={{ __html: WC_CSS }} />
      <Hud
        score={shownScore}
        progress={totalTravelers ? processed / totalTravelers : 0}
        combo={combo.combo}
        comboMult={combo.mult}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={
          <div className="wc-clock">
            <div className="wc-clock-top">
              <span className="gk-stat-label">제 {dayIdx + 1} 일 근무</span>
              <LifePips total={CITATIONS} left={lives} label="남은 오심 여유" />
            </div>
            <TimerBar frac={clock.frac} warning={clock.warning} seconds={clock.remainSec} label="근무 종료까지" />
          </div>
        }
      />

      <main className="gk-stage wc-stage">
        {phase === 'shift' ? (
          <div className="wc-banner" role="status">
            <span className="wc-banner-day">제 {bannerDay + 1} 일 근무</span>
            <span className="wc-banner-sub">
              서류 {bannerDayData?.travelers.length ?? 0}건 · 제한 {Math.round((bannerDayData?.ms ?? 0) / 1000)}초
            </span>
            {newRule.length > 0 && (
              <div className="wc-banner-rules">
                <span className="wc-banner-newh">추가된 규칙</span>
                {newRule.map((r) => <span key={r} className="wc-banner-rule">{r}</span>)}
              </div>
            )}
            {daySummary && (
              <span className="wc-banner-prev">
                제 {daySummary.day} 일 결산 — 정확 {daySummary.correct} · 적발 {daySummary.caught} · 시간 보너스 +{daySummary.bonus}
              </span>
            )}
          </div>
        ) : traveler && day ? (
          <>
            <RuleCard rules={day.rules} dayNo={dayIdx + 1} />

            <div className="wc-doc-wrap">
              <Permit
                t={traveler}
                tone={phase === 'reveal' ? (outcome?.kind ?? null) : null}
                serial={phase === 'reveal' ? processed : processed + 1}
                revealed={phase === 'reveal'}
              />
              {stamp && (
                <div key={stamp.n} className={`wc-stampmark wc-stampmark--${stamp.kind}`} aria-hidden="true">
                  <span className="wc-stampmark-ko">{stamp.kind === 'approve' ? '통과' : stamp.kind === 'deny' ? '반송' : '미결'}</span>
                  <span className="wc-stampmark-en">{stamp.kind === 'approve' ? 'APPROVED' : stamp.kind === 'deny' ? 'DENIED' : 'PENDING'}</span>
                </div>
              )}
              {burst && (
                <span key={burst.n} className="wc-burst-at" aria-hidden="true">
                  <ParticleBurst intensity={burst.power} colors={['var(--success)', 'var(--streak)', 'var(--combo)']} />
                </span>
              )}
              {gain && (
                <span key={gain.n} className="wc-gain" aria-hidden="true">
                  +{gain.v}{gain.mult > 1 && <em>×{gain.mult}</em>}{gain.pledged && <em>속결×2</em>}
                </span>
              )}
              {pledged && phase !== 'reveal' && (
                <div className="wc-pledge-bar" aria-hidden="true"><span key={traveler.key} /></div>
              )}
            </div>

            {phase === 'reveal' ? (
              <div className="wc-verdict-box">
                <span className={`wc-verdict wc-verdict--${outcome?.kind ?? 'wrong'}`}>
                  <FeedbackIcon kind={outcome?.kind === 'correct' ? 'correct' : outcome?.kind === 'near' ? 'near' : 'wrong'} size={18} />
                  {outcome?.kind === 'correct' ? '정확' : outcome?.kind === 'near' ? '항목 오인' : outcome?.kind === 'lapse' ? '미결' : '오심'}
                </span>
                <span className="wc-truth">{outcome?.text}</span>
                {outcome?.kind === 'correct' ? (
                  <span className="wc-autoline" aria-hidden="true"><i /></span>
                ) : lives === 0 ? (
                  <span className="wc-relieved">오심 여유를 다 썼어요 — 교대 인계 중…</span>
                ) : (
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  <button type="button" className="gk-btn gk-btn--primary wc-next" onClick={advance} autoFocus>
                    다음 서류 <Kbd>Space</Kbd>
                  </button>
                )}
              </div>
            ) : phase === 'reason' ? (
              <div className="wc-reason">
                <span className="wc-reason-h">어느 항목이 위조입니까?</span>
                <div className="wc-chips">
                  {chips.map((f, i) => (
                    <button key={f} type="button" className="wc-chip" onClick={() => judge(f)}>
                      {FIELD_LABEL[f]} <Kbd>{i + 1}</Kbd>
                    </button>
                  ))}
                </div>
                <button type="button" className="wc-back" onClick={() => setPhase('inspect')}>
                  ← 서류 다시 보기 <Kbd>Esc</Kbd>
                </button>
              </div>
            ) : (
              <div className="wc-actions">
                <div className="wc-stamps">
                  <button type="button" className="wc-stamp wc-stamp--approve" onClick={() => judge(null)}>
                    승인<span>APPROVE <Kbd>A</Kbd></span>
                  </button>
                  <button type="button" className="wc-stamp wc-stamp--deny" onClick={onDeny}>
                    거부<span>DENY <Kbd>D</Kbd></span>
                  </button>
                </div>
                <button
                  type="button"
                  className="wc-pledge"
                  onClick={doPledge}
                  aria-disabled={!pledgeOpen || pledged}
                  data-armed={pledged ? '1' : '0'}
                >
                  {pledged
                    ? `속결 서약 중 — ${PLEDGE_LIMIT_MS / 1000}초 안에 판정`
                    : pledgeOpen
                      ? <>속결 서약 · 점수 ×2 <Kbd>F</Kbd></>
                      : '속결 창 종료 — 천천히 봐도 됩니다'}
                </button>
              </div>
            )}
          </>
        ) : null}
        <div className="gk-energy" aria-hidden="true" style={{ opacity: Math.min(0.4, combo.combo * 0.03), transform: `scale(${1 + combo.tierIndex * 0.1})` }} />
      </main>
    </div>
  );
}

const WC_CSS = `
  .wc-clock { display: flex; flex-direction: column; gap: 5px; align-items: stretch; min-width: 136px; }
  .wc-clock-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .wc-root .wc-stage { gap: clamp(10px, 2.2vh, 20px); justify-content: flex-start; padding-top: clamp(12px, 2.4vh, 24px); overflow-y: auto; overscroll-behavior: contain; }

  .wc-rules { display: flex; flex-direction: column; gap: 4px; width: min(560px, 94vw); padding: 11px 16px; border-radius: 10px; background: color-mix(in srgb, var(--bg) 55%, transparent); border: 1px solid var(--bd); border-left: 3px solid var(--error); backdrop-filter: blur(3px); }
  .wc-rules-h { font-family: var(--font-english, monospace); font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--error); font-weight: 800; }
  .wc-rule { font-size: 12.5px; color: var(--t2); font-weight: 600; }
  .wc-rule--std { color: var(--t3); font-weight: 500; font-size: 11.5px; margin-top: 2px; }

  .wc-doc-wrap { position: relative; width: min(560px, 94vw); }
  .wc-doc { border-radius: 14px; background: color-mix(in srgb, var(--bg) 82%, #fff); border: 1px solid var(--bd); box-shadow: 0 20px 44px -22px rgba(40,26,14,.6); overflow: hidden; transition: box-shadow .2s, transform .13s var(--ease-settle, ease-out); }
  .wc-doc--ok { box-shadow: 0 0 0 2px var(--success), 0 20px 44px -22px rgba(40,26,14,.6); transform: translateY(3px); }
  .wc-doc--near { box-shadow: 0 0 0 2px var(--streak, var(--combo)), 0 20px 44px -22px rgba(40,26,14,.6); transform: translateY(3px); }
  .wc-doc--no { box-shadow: 0 0 0 2px var(--error), 0 20px 44px -22px rgba(40,26,14,.6); transform: translateY(3px); }
  .wc-doc-top { display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; background: color-mix(in srgb, var(--t1) 8%, transparent); border-bottom: 1px solid var(--bd); }
  .wc-doc-title { font-family: var(--font-english, monospace); font-size: 10.5px; letter-spacing: .12em; color: var(--t2); font-weight: 700; }
  .wc-doc-serial { font-family: var(--font-english, monospace); font-size: 11px; color: var(--t3); }
  .wc-headword { font-family: var(--font-english, monospace); font-size: clamp(26px, 5vw, 38px); font-weight: 800; text-align: center; padding: 14px 10px 8px; color: var(--t1); letter-spacing: .01em; overflow-wrap: anywhere; }
  .wc-headword[data-forged="true"] { color: var(--error); text-decoration: underline wavy var(--error); }
  .wc-fields { display: flex; flex-direction: column; padding: 4px 16px 16px; }
  .wc-row { display: grid; grid-template-columns: 74px 1fr; gap: 10px; padding: 8px; border-radius: 8px; border-bottom: 1px solid var(--bd); align-items: baseline; }
  .wc-row:last-child { border-bottom: none; }
  .wc-row--forged { background: var(--error-light); box-shadow: inset 3px 0 0 var(--error); }
  .wc-row--fixed { background: var(--success-light); box-shadow: inset 3px 0 0 var(--success); }
  .wc-k { font-family: var(--font-english, monospace); font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--t3); font-weight: 700; }
  .wc-v { font-size: 14.5px; color: var(--t1); font-weight: 600; }
  .wc-ex { font-family: var(--font-body, Georgia, serif); font-weight: 400; font-size: 14px; line-height: 1.45; }
  .wc-ex b { font-family: var(--font-english, system-ui); font-weight: 800; color: var(--combo); }
  .wc-fix { color: var(--success); font-style: normal; font-weight: 800; font-size: 13px; }

  /* 각인 — 이 게임의 시그니처 순간. 종이에 스며들도록 합성 모드로 눌러 찍는다. */
  .wc-stampmark { position: absolute; top: 44%; left: 50%; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 10px 20px; border: 3px double currentColor; border-radius: 8px; transform: translate(-50%, -50%) rotate(-13deg); opacity: .84; mix-blend-mode: multiply; pointer-events: none; animation: wc-stamp .14s cubic-bezier(.34,1.56,.64,1); }
  .wc-stampmark-ko { font-family: var(--font-display, system-ui); font-size: 21px; font-weight: 900; letter-spacing: .1em; line-height: 1; }
  .wc-stampmark-en { font-family: var(--font-english, monospace); font-size: 10px; font-weight: 800; letter-spacing: .22em; opacity: .8; }
  .wc-stampmark--approve { color: var(--success); }
  .wc-stampmark--deny { color: var(--error); }
  .wc-stampmark--pending { color: var(--t3); }
  [data-theme="dark"] .wc-stampmark { mix-blend-mode: screen; opacity: .96; }
  @keyframes wc-stamp { from { transform: translate(-50%, -50%) rotate(-13deg) scale(2.6); opacity: 0; } to { transform: translate(-50%, -50%) rotate(-13deg) scale(1); opacity: .84; } }

  .wc-burst-at { position: absolute; top: 44%; left: 50%; width: 0; height: 0; pointer-events: none; }
  .wc-gain { position: absolute; top: 10%; left: 50%; transform: translateX(-50%); display: inline-flex; align-items: baseline; gap: 5px; font-family: var(--font-english, monospace); font-size: 19px; font-weight: 900; color: var(--combo); pointer-events: none; animation: gk-gain .95s ease-out forwards; white-space: nowrap; }
  .wc-gain em { font-style: normal; font-size: 12.5px; color: var(--streak, var(--combo)); }

  .wc-pledge-bar { position: absolute; left: 0; right: 0; top: -7px; height: 4px; border-radius: 999px; background: color-mix(in srgb, var(--t1) 12%, transparent); overflow: hidden; }
  .wc-pledge-bar span { display: block; height: 100%; border-radius: 999px; background: var(--streak, var(--combo)); transform-origin: left center; animation: wc-drain ${PLEDGE_LIMIT_MS}ms linear forwards; }
  @keyframes wc-drain { from { transform: scaleX(1); } to { transform: scaleX(0); } }

  .wc-actions { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .wc-stamps { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
  .wc-stamp { display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 132px; min-height: 60px; padding: 12px 20px; border-radius: 12px; border: 2px solid; background: var(--bg); cursor: pointer; font-family: var(--font-display, system-ui); font-size: 19px; font-weight: 800; transition: transform .1s, box-shadow .15s, background .15s; }
  .wc-stamp span { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-english, monospace); font-size: 10px; letter-spacing: .2em; opacity: .78; }
  .wc-stamp:active { transform: scale(.95) rotate(-2deg); }
  .wc-stamp--approve { color: var(--success); border-color: var(--success); }
  .wc-stamp--approve:hover { background: var(--success-light); box-shadow: 0 8px 22px color-mix(in srgb, var(--success) 26%, transparent); }
  .wc-stamp--deny { color: var(--error); border-color: var(--error); }
  .wc-stamp--deny:hover { background: var(--error-light); box-shadow: 0 8px 22px color-mix(in srgb, var(--error) 26%, transparent); }
  .wc-stamp:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 34%, transparent); }

  .wc-pledge { display: inline-flex; align-items: center; gap: 7px; min-height: 44px; padding: 0 18px; border-radius: 999px; border: 1.5px dashed color-mix(in srgb, var(--streak, var(--combo)) 60%, var(--bd)); background: color-mix(in srgb, var(--bg) 70%, transparent); color: var(--t2); font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 800; cursor: pointer; transition: transform .12s, background .15s, color .15s, border-color .15s, opacity .2s; }
  .wc-pledge:hover { color: var(--t1); background: color-mix(in srgb, var(--streak, var(--combo)) 14%, transparent); }
  .wc-pledge:active { transform: scale(.97); }
  .wc-pledge:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--streak, var(--combo)) 32%, transparent); }
  .wc-pledge[aria-disabled="true"] { pointer-events: none; opacity: .45; border-style: solid; }
  .wc-pledge[data-armed="1"] { opacity: 1; border-style: solid; border-color: var(--streak, var(--combo)); color: var(--streak, var(--combo)); background: color-mix(in srgb, var(--streak, var(--combo)) 16%, transparent); }

  .wc-reason { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .wc-reason-h { font-size: 14px; font-weight: 800; color: var(--t1); }
  .wc-chips { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .wc-chip { display: inline-flex; align-items: center; gap: 7px; min-height: 48px; padding: 0 20px; border-radius: 999px; border: 1.5px solid var(--error); background: var(--bg); color: var(--t1); font-size: 14px; font-weight: 700; cursor: pointer; transition: transform .1s, background .15s, box-shadow .15s; }
  .wc-chip:hover { background: var(--error-light); transform: translateY(-2px); box-shadow: 0 6px 16px color-mix(in srgb, var(--error) 22%, transparent); }
  .wc-chip:active { transform: scale(.96); }
  .wc-chip:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--error) 30%, transparent); }
  .wc-back { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 12px; border-radius: 8px; background: none; border: 1px solid transparent; color: var(--t3); font-size: 12.5px; font-weight: 700; cursor: pointer; transition: color .15s, border-color .15s, transform .1s; }
  .wc-back:hover { color: var(--t1); border-color: var(--bd); }
  .wc-back:active { transform: scale(.97); }
  .wc-back:focus-visible { outline: none; border-color: var(--bd); box-shadow: 0 0 0 3px color-mix(in srgb, var(--t3) 28%, transparent); }

  .wc-verdict-box { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding-bottom: 10px; }
  .wc-verdict { display: inline-flex; align-items: center; gap: 7px; font-family: var(--font-display, system-ui); font-size: 20px; font-weight: 900; animation: gk-pop .4s ease-out; }
  .wc-verdict--correct { color: var(--success); }
  .wc-verdict--near { color: var(--streak, var(--combo)); }
  .wc-verdict--wrong { color: var(--error); }
  .wc-verdict--lapse { color: var(--t3); }
  .wc-truth { font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 14px; color: var(--t2); max-width: 48ch; line-height: 1.55; }
  .wc-next { margin-top: 6px; min-width: 170px; display: inline-flex; align-items: center; gap: 8px; justify-content: center; }
  .wc-autoline { display: block; width: 170px; height: 3px; border-radius: 999px; background: color-mix(in srgb, var(--t1) 12%, transparent); overflow: hidden; margin-top: 6px; }
  .wc-autoline i { display: block; height: 100%; background: var(--success); transform-origin: left center; animation: wc-drain ${AUTO_ADVANCE_MS}ms linear forwards; }
  .wc-relieved { display: inline-flex; align-items: center; min-height: 44px; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13.5px; color: var(--t3); }

  .wc-banner { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; margin: auto 0; animation: wc-rise .4s var(--ease-settle, ease-out); }
  .wc-banner-day { font-family: var(--font-display, system-ui); font-size: clamp(30px, 8vw, 48px); font-weight: 900; letter-spacing: -.02em; color: var(--t1); }
  .wc-banner-sub { font-family: var(--font-english, monospace); font-size: 12px; letter-spacing: .14em; color: var(--t3); font-weight: 700; }
  .wc-banner-rules { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; padding: 10px 18px; border-radius: 10px; border: 1px solid var(--error); background: color-mix(in srgb, var(--error) 9%, transparent); animation: wc-pulse 1.2s ease-out 1; }
  .wc-banner-newh { font-family: var(--font-english, monospace); font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--error); font-weight: 800; }
  .wc-banner-rule { font-size: 13px; font-weight: 700; color: var(--t1); }
  .wc-banner-prev { font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13px; color: var(--t3); margin-top: 4px; }
  @keyframes wc-rise { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes wc-pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--error) 45%, transparent); } 100% { box-shadow: 0 0 0 14px transparent; } }

  .wc-recap { display: flex; flex-direction: column; gap: 8px; text-align: left; }
  .wc-recap-h { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--t3); }
  .wc-recap-row { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; line-height: 1.55; color: var(--t2); }
  .wc-recap-row b { font-family: var(--font-english, monospace); color: var(--t1); }

  @media (max-width: 420px) {
    .wc-stamp { min-width: 118px; }
    .wc-clock { min-width: 96px; }
    /* 근무일은 바로 아래 규칙서 머리글에도 있다 — 좁은 화면에서는 시계·핍만 남긴다. */
    .wc-clock-top .gk-stat-label { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .wc-verdict, .wc-banner, .wc-banner-rules { animation: none; }
    .wc-stampmark { animation: wc-stamp-rm .22s ease-out; }
    .wc-gain { animation: wc-fade-out .9s ease-out forwards; }
    .wc-chip:hover { transform: none; }
    .wc-chip:active, .wc-stamp:active, .wc-pledge:active, .wc-back:active { transform: none; }
    .wc-doc--ok, .wc-doc--near, .wc-doc--no { transform: none; }
  }
  @keyframes wc-stamp-rm { from { opacity: 0; } to { opacity: .84; } }
  @keyframes wc-fade-out { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
`;
