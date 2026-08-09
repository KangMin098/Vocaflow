// apps/web/src/components/game/lexicon-detective/LexiconDetectiveGame.tsx
// Lexicon Detective — 압수된 수첩(영문) ↔ 사건 조서(국문) 대조 추리.
//
// v07.9 전면 재설계. 이전 판의 세 가지 결함을 구조적으로 제거했다.
//   1) 인출 없음 — 칩과 단서 타일에 en+ko 를 함께 인쇄해 한국어끼리 맞추면 끝났다.
//      지금은 **봉투를 열면 영단어만** 나오고, 조서의 진술은 **국문 뜻만** 있다.
//      제출 전 화면 어디에도 (en, ko) 쌍이 함께 인쇄되지 않는다.
//   2) 학습자 단어장과 무관 — 하드코딩 3사건을 돌리면서 FSRS 에는 뱅크 단어를 적재했다.
//      지금은 사건 전체를 wordPool 에서 절차적으로 생성한다. 기록되는 단어는 전부
//      학습자가 실제로 등록한 어휘다.
//   3) 재시작이 같은 판 — 고정 대본이었다. 지금은 매 판 사건 소재·정답·함정·배치가
//      전부 새로 뽑힌다.
//
// 판돈 구조
//   · 심증(lives)  — 어긋난 판단마다 1 감소. 0 이면 그 사건은 미제로 종결(정답 전면 공개).
//   · 보존도       — 봉투를 열 때마다 1 감소. 종결 시 남은 만큼 점수. "정보 vs 점수" 상시 트레이드오프.
//   · 연쇄(combo)  — 확정이 이어질수록 배수 상승. 어긋나면 배수가 통째로 날아간다.
//   · 전면 재구성  — 남은 진술을 한 번에 판정. 전부 맞으면 2배, 하나라도 틀리면
//                    **어디가 틀렸는지 알려주지 않는다**(무위험 탐색 오라클 차단).
//   · 위증(기각)   — 사건이 진행될수록 어느 봉투와도 맞지 않는 진술이 섞인다. 개수는 비공개.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  GameKitStyles,
  AmbientBackground,
  Hud,
  GameDone,
  GameMusic,
  ParticleBurst,
  FeedbackIcon,
  useSfx,
  useCombo,
  usePersonalBest,
  useCountUp,
  shuffle,
  DEFAULT_COMBO_TIERS,
  type Word,
} from '@/components/game/_shared/gamekit';

interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word) => void;
  onWrong?: (w: Word) => void;
}

// ─── 사건 규격 ────────────────────────────────────────────────────────────
// 진술 5줄 고정. 사건이 넘어갈수록 함정 봉투가 늘고 위증 진술이 섞이며 심증이 줄어든다.
// 이것이 이 게임의 긴장 곡선이다(시간 압박 없음 — 추리 게임에서 생각하는 시간은 무료여야 한다).
const ENTRIES_N = 5;
interface CaseSpec {
  lives: number;
  traps: number;
  falses: number;
  note: string;
}
const SPECS: CaseSpec[] = [
  { lives: 3, traps: 3, falses: 0, note: '조서의 다섯 진술 모두 현장의 증거와 맞물린다.' },
  { lives: 3, traps: 4, falses: 1, note: '봉투가 늘었다. 그리고 조서에 위증이 섞여 있다는 제보가 있다.' },
  { lives: 2, traps: 5, falses: 2, note: '심증은 둘뿐이다. 맞지 않는 진술은 망설이지 말고 기각하라.' },
];

const PT_MATCH = 100;
const PT_REJECT = 120;
const PT_PRESERVE = 60;
const PT_LIFE = 100;
const ALL_IN_MULT = 2;
const MIN_UNIQUE_WORDS = 8;
const EMPTY_NOTE = { text: '', ok: false } as const;

// 맛보기 풀 — 내 단어장이 아직 얇으면 useGameWordScope 가 wordPool 을 주지 않는다(demo degrade).
// 그때 놀이를 막지 않되, **이 단어들의 결과는 FSRS 에 절대 적재하지 않는다**(emit* 참조).
// 등록한 적 없는 어휘의 복습 이력이 생기는 것이 이전 판의 결함이었다.
const DEMO_POOL: Word[] = [
  { en: 'trudge', ko: '터벅터벅 걷다', example: 'He had to trudge through the snow for an hour.' },
  { en: 'servant', ko: '하인', example: 'The servant opened the heavy oak door.' },
  { en: 'betray', ko: '배신하다', example: 'She would never betray a friend for money.' },
  { en: 'conceal', ko: '숨기다', example: 'He tried to conceal the letter under the rug.' },
  { en: 'shatter', ko: '산산이 부수다', example: 'The glass shattered on the marble floor.' },
  { en: 'anxious', ko: '불안한', example: 'The witness looked anxious and kept checking the clock.' },
  { en: 'forge', ko: '위조하다', example: 'Someone forged the old man’s signature.' },
  { en: 'greedy', ko: '탐욕스러운', example: 'A greedy heir rarely waits patiently.' },
  { en: 'grieve', ko: '몹시 슬퍼하다', example: 'The family still grieves for him.' },
  { en: 'sabotage', ko: '방해 공작하다', example: 'Someone sabotaged the stage lighting.' },
  { en: 'ignite', ko: '불붙이다', example: 'A single spark ignited the curtain.' },
  { en: 'flee', ko: '달아나다', example: 'The suspect fled through the back alley.' },
  { en: 'rescue', ko: '구조하다', example: 'Two firefighters rescued the actor.' },
  { en: 'jealous', ko: '질투하는', example: 'He was jealous of his rival’s success.' },
  { en: 'lawyer', ko: '변호사', example: 'The lawyer refused to name her client.' },
  { en: 'witness', ko: '목격자', example: 'Only one witness saw the car leave.' },
  { en: 'motive', ko: '동기', example: 'The police still have no motive.' },
  { en: 'confess', ko: '자백하다', example: 'He confessed after three hours.' },
  { en: 'suspect', ko: '용의자', example: 'The suspect had an alibi for that night.' },
  { en: 'vanish', ko: '자취를 감추다', example: 'The manuscript vanished overnight.' },
  { en: 'bribe', ko: '뇌물을 주다', example: 'They tried to bribe the night guard.' },
  { en: 'testimony', ko: '증언', example: 'Her testimony changed the case.' },
  { en: 'reluctant', ko: '주저하는', example: 'The clerk was reluctant to answer.' },
  { en: 'trace', ko: '흔적', example: 'There was no trace of forced entry.' },
  { en: 'deceive', ko: '속이다', example: 'He deceived everyone for years.' },
  { en: 'inherit', ko: '상속받다', example: 'She would inherit the entire estate.' },
];

const FLAVORS: { title: string; scene: string }[] = [
  { title: '한밤의 서재', scene: '금고가 열렸고, 책상 위엔 봉인된 증거 봉투만 남았다.' },
  { title: '부두의 안개', scene: '새벽 세 시, 화물 목록에서 한 줄이 지워졌다.' },
  { title: '수도원의 필사실', scene: '잉크가 마르기도 전에 필사본 한 권이 자취를 감췄다.' },
  { title: '마지막 객실', scene: '종착역에 닿았을 때, 7호실 승객은 어디에도 없었다.' },
  { title: '등대의 침묵', scene: '사흘째 불이 꺼져 있었다. 등대지기의 수첩만 남았다.' },
  { title: '경매장의 위작', scene: '낙찰봉이 내려친 순간, 감정서가 바뀌어 있었다.' },
  { title: '병동의 처방전', scene: '야간 근무 기록과 약품 대장이 서로를 부정한다.' },
  { title: '극장의 마지막 막', scene: '커튼콜 직전, 분장실 조명만 꺼져 있었다.' },
  { title: '눈 덮인 산장', scene: '발자국은 산장으로 들어오기만 하고 나가지 않았다.' },
];

// ─── 사건 생성 ────────────────────────────────────────────────────────────
interface Entry {
  id: number;
  ko: string;
  /** null 이면 위증 — 어느 봉투와도 맞지 않는다. */
  answer: Word | null;
}
interface CaseData {
  title: string;
  scene: string;
  note: string;
  lives: number;
  entries: Entry[];
  envelopes: Word[];
}
type LockKind = 'match' | 'reject';

const normKo = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/** 뜻이 겹치지 않는 단어만 골라 온다 — 같은 뜻이 두 줄이면 정답이 두 개가 되어 불공정해진다. */
function pickUniqueKo(pool: Word[], n: number): Word[] {
  const seen = new Set<string>();
  const out: Word[] = [];
  for (const w of shuffle(pool)) {
    const k = normKo(w.ko);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(w);
    if (out.length >= n) break;
  }
  return out;
}

function buildCase(pool: Word[], spec: CaseSpec, flavor: { title: string; scene: string }): CaseData {
  const want = ENTRIES_N + spec.traps;
  const picked = pickUniqueKo(pool, want);
  // 풀이 얇으면 함정부터 줄인다 — 진술 줄 수는 유지해야 사건의 모양이 무너지지 않는다.
  const entriesN = Math.min(ENTRIES_N, Math.max(3, picked.length - 2));
  const traps = Math.max(1, picked.length - entriesN);
  const falses = Math.min(spec.falses, Math.max(0, entriesN - 3));
  const answersN = entriesN - falses;

  const answers = picked.slice(0, answersN);
  const trapWords = picked.slice(answersN, answersN + traps);
  const falseWords = picked.slice(answersN + traps, answersN + traps + falses);

  const raw: { ko: string; answer: Word | null }[] = [
    ...answers.map((w) => ({ ko: w.ko, answer: w })),
    ...falseWords.map((w) => ({ ko: w.ko, answer: null })),
  ];
  const entries: Entry[] = shuffle(raw).map((e, i) => ({ id: i, ko: e.ko, answer: e.answer }));
  return {
    title: flavor.title,
    scene: flavor.scene,
    note: spec.note,
    lives: spec.lives,
    entries,
    envelopes: shuffle([...answers, ...trapWords]),
  };
}

function buildCases(pool: Word[]): CaseData[] {
  const flavors = shuffle(FLAVORS);
  return SPECS.map((spec, i) => buildCase(pool, spec, flavors[i % flavors.length]));
}

/** 연쇄 수 → 배수. useCombo 의 상태 갱신은 비동기라, 한 번에 여러 줄을 판정할 땐 직접 계산한다. */
function multFor(combo: number): number {
  let m = 1;
  for (const t of DEFAULT_COMBO_TIERS) if (combo >= t.at) m = t.mult;
  return m;
}
const fmtMult = (m: number) => (m % 1 === 0 ? `${m}` : m.toFixed(1));

// ─── 요약(사건 종결 리포트) ────────────────────────────────────────────────
interface SummaryRow {
  ko: string;
  answer: Word | null;
  got: 'match' | 'reject' | 'miss';
}
interface CaseSummary {
  title: string;
  index: number;
  outcome: 'solved' | 'cold';
  rows: SummaryRow[];
  base: number;
  preserveCount: number;
  preserve: number;
  life: number;
}

// ─── 아이콘 ───────────────────────────────────────────────────────────────
function SealIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      {open ? <path d="M3.5 6.5l8.5 5 8.5-5" opacity=".45" /> : <path d="M3.5 6.5L12 13l8.5-6.5" />}
      {open && <path d="M7.5 15.5h9" />}
    </svg>
  );
}

export function LexiconDetectiveGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();

  // 사건은 학습자 단어장에서 만든다. 단어장이 얇으면 맛보기 풀로 놀되 기록은 남기지 않는다.
  const mine = useMemo(() => {
    const seen = new Set<string>();
    const out: Word[] = [];
    for (const w of wordPool ?? []) {
      const en = w.en?.trim();
      const ko = w.ko?.trim();
      if (!en || !ko) continue;
      const k = en.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ ...w, en, ko });
    }
    return out;
  }, [wordPool]);

  const demoMode = useMemo(() => new Set(mine.map((w) => normKo(w.ko))).size < MIN_UNIQUE_WORDS, [mine]);
  const pool = demoMode ? DEMO_POOL : mine;

  // FSRS 적재는 학습자가 실제로 등록한 어휘에 한한다 — 맛보기 단어로 복습 이력을 만들지 않는다.
  const emitCorrect = useCallback((w: Word) => { if (!demoMode) onCorrect?.(w); }, [demoMode, onCorrect]);
  const emitWrong = useCallback((w: Word) => { if (!demoMode) onWrong?.(w); }, [demoMode, onWrong]);

  const [cases, setCases] = useState<CaseData[]>(() => buildCases(demoMode ? DEMO_POOL : mine));
  const [caseIdx, setCaseIdx] = useState(0);
  const cur: CaseData | undefined = cases[caseIdx];

  const [phase, setPhase] = useState<'brief' | 'case' | 'summary' | 'done'>('brief');
  const [showRules, setShowRules] = useState(false);

  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const [placed, setPlaced] = useState<Record<number, string>>({});
  const [rejected, setRejected] = useState<Set<number>>(() => new Set());
  const [locked, setLocked] = useState<Record<number, LockKind>>({});
  const [held, setHeld] = useState<string | null>(null);
  const [lives, setLives] = useState(SPECS[0].lives);
  const [caseBase, setCaseBase] = useState(0);

  const [score, setScore] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);
  const [note, setNote] = useState<{ text: string; ok: boolean }>({ text: '', ok: false });
  const [tierMsg, setTierMsg] = useState('');
  const [flash, setFlash] = useState<{ id: number; kind: 'correct' | 'wrong' } | null>(null);
  const [burstId, setBurstId] = useState<number | null>(null);
  const [summary, setSummary] = useState<CaseSummary | null>(null);
  const [missed, setMissed] = useState<Word[]>([]);
  const [bestInfo, setBestInfo] = useState<{ prev: number | null; improved: boolean } | null>(null);
  const [allInWins, setAllInWins] = useState(0);

  const pb = usePersonalBest('lexicon-detective');
  const shownScore = useCountUp(score);

  const flashTimer = useRef(0);
  const burstTimer = useRef(0);
  const tierTimer = useRef(0);
  useEffect(
    () => () => {
      window.clearTimeout(flashTimer.current);
      window.clearTimeout(burstTimer.current);
      window.clearTimeout(tierTimer.current);
    },
    [],
  );

  const combo = useCombo({
    onTierUp: (tier) => {
      if (!tier.label) return;
      setTierMsg(`${tier.label} ×${fmtMult(tier.mult)}`);
      window.clearTimeout(tierTimer.current);
      tierTimer.current = window.setTimeout(() => setTierMsg(''), 1600);
    },
  });

  const noteMissed = useCallback((w: Word) => {
    setMissed((prev) => (prev.some((x) => x.en === w.en) ? prev : [...prev, w]));
  }, []);

  const showFlash = useCallback((id: number, kind: 'correct' | 'wrong') => {
    setFlash({ id, kind });
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), kind === 'correct' ? 620 : 820);
  }, []);

  const showBurst = useCallback((id: number) => {
    setBurstId(id);
    window.clearTimeout(burstTimer.current);
    burstTimer.current = window.setTimeout(() => setBurstId(null), 720);
  }, []);

  const preserved = cur ? cur.envelopes.length - opened.size : 0;
  const usedEn = useMemo(() => new Set(Object.values(placed)), [placed]);
  const pending = useMemo(() => (cur ? cur.entries.filter((e) => !locked[e.id]) : []), [cur, locked]);
  const allDecided = pending.length > 0 && pending.every((e) => placed[e.id] || rejected.has(e.id));
  const canAllIn = pending.length >= 2 && allDecided;

  const resetCaseState = useCallback((c: CaseData) => {
    setOpened(new Set());
    setPlaced({});
    setRejected(new Set());
    setLocked({});
    setHeld(null);
    setLives(c.lives);
    setCaseBase(0);
    setNote(EMPTY_NOTE);
    setFlash(null);
    setBurstId(null);
  }, []);

  const buildRows = useCallback(
    (lockedMap: Record<number, LockKind>): SummaryRow[] =>
      (cur?.entries ?? []).map((e) => ({
        ko: e.ko,
        answer: e.answer,
        got: lockedMap[e.id] ?? 'miss',
      })),
    [cur],
  );

  // ─── 봉투 조사 ───
  const openEnvelope = useCallback(
    (en: string) => {
      if (opened.has(en)) return;
      setOpened((s) => new Set(s).add(en));
      setHeld(en);
      setNote(EMPTY_NOTE);
      sfx.click();
    },
    [opened, sfx],
  );

  const toggleHold = useCallback(
    (en: string) => {
      sfx.click();
      setHeld((h) => (h === en ? null : en));
    },
    [sfx],
  );

  // ─── 진술 줄 조작 ───
  const tapSlot = useCallback(
    (id: number) => {
      if (locked[id]) return;
      setNote(EMPTY_NOTE);
      if (held) {
        setPlaced((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(next)) {
            const kid = Number(k);
            if (next[kid] === held && !locked[kid]) delete next[kid];
          }
          next[id] = held;
          return next;
        });
        setRejected((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setHeld(null);
        sfx.click();
      } else if (placed[id]) {
        setPlaced((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        sfx.click();
      }
    },
    [held, placed, locked, sfx],
  );

  const toggleReject = useCallback(
    (id: number) => {
      if (locked[id]) return;
      setNote(EMPTY_NOTE);
      sfx.click();
      const on = rejected.has(id);
      const next = new Set(rejected);
      if (on) next.delete(id);
      else next.add(id);
      setRejected(next);
      // 기각과 배치는 양립하지 않는다 — 기각을 켜면 그 줄에 놓인 단어는 수첩으로 돌아간다.
      if (!on && placed[id]) {
        setPlaced((p) => {
          const np = { ...p };
          delete np[id];
          return np;
        });
      }
    },
    [locked, rejected, placed, sfx],
  );

  // ─── 사건 종결 ───
  const closeCase = useCallback(
    (outcome: 'solved' | 'cold', lockedMap: Record<number, LockKind>, base: number, livesLeft: number) => {
      if (!cur) return;
      const pCount = cur.envelopes.length - opened.size;
      const pBonus = outcome === 'solved' ? pCount * PT_PRESERVE : 0;
      const lBonus = outcome === 'solved' ? livesLeft * PT_LIFE : 0;
      if (pBonus + lBonus > 0) setScore((s) => s + pBonus + lBonus);
      if (outcome === 'solved') setSolvedCount((n) => n + 1);
      setSummary({
        title: cur.title,
        index: caseIdx,
        outcome,
        rows: buildRows(lockedMap),
        base,
        preserveCount: pCount,
        preserve: pBonus,
        life: lBonus,
      });
      setPhase('summary');
      if (outcome === 'solved') sfx.fanfare();
    },
    [cur, caseIdx, opened, buildRows, sfx],
  );

  /** 어긋난 판단 — 심증 1 소모. 0 이 되면 미제로 종결하고 정답을 전부 공개한다. */
  const spendCertainty = useCallback(
    (text: string, nextPlaced: Record<number, string>, nextRejected: Set<number>, alreadyLoggedId?: number) => {
      if (!cur) return;
      const left = lives - 1;
      setLives(left);
      combo.miss();
      setPlaced(nextPlaced);
      setRejected(nextRejected);
      if (left <= 0) {
        cur.entries.forEach((e) => {
          if (e.id === alreadyLoggedId) return; // 같은 순간에 같은 단어를 두 번 적재하지 않는다
          if (!locked[e.id] && e.answer) {
            emitWrong(e.answer);
            noteMissed(e.answer);
          }
        });
        setNote(EMPTY_NOTE);
        closeCase('cold', locked, caseBase, 0);
      } else {
        setNote({ text, ok: false });
      }
    },
    [cur, lives, locked, caseBase, combo, emitWrong, noteMissed, closeCase],
  );

  // ─── 단독 확정(안전) ───
  const confirmRow = useCallback(
    (id: number) => {
      if (!cur || locked[id]) return;
      const entry = cur.entries.find((e) => e.id === id);
      if (!entry) return;
      const isReject = rejected.has(id);
      const chip = placed[id];
      if (!isReject && !chip) return;

      const right = isReject ? entry.answer === null : chip === entry.answer?.en;

      if (right) {
        const m = multFor(combo.combo);
        const gained = Math.round((isReject ? PT_REJECT : PT_MATCH) * m);
        const nextLocked: Record<number, LockKind> = { ...locked, [id]: isReject ? 'reject' : 'match' };
        const nextBase = caseBase + gained;
        setLocked(nextLocked);
        setCaseBase(nextBase);
        setScore((s) => s + gained);
        combo.hit();
        if (!isReject && entry.answer) emitCorrect(entry.answer);
        sfx.correct(combo.combo, m > 1);
        showFlash(id, 'correct');
        showBurst(id);
        setNote({
          ok: true,
          text: isReject
            ? `위증을 걸러냈다 — 이 진술과 맞물리는 증거는 없었다. +${gained}`
            : `확정 — 「${entry.answer?.en}」 · ${entry.answer?.ko}. +${gained}`,
        });
        if (cur.entries.every((e) => nextLocked[e.id])) {
          closeCase('solved', nextLocked, nextBase, lives);
        }
        return;
      }

      // 어긋남 — 무엇이 어긋났는지는 지목하되(학습), 정답은 알려주지 않는다.
      sfx.wrong();
      showFlash(id, 'wrong');
      const nextPlaced = { ...placed };
      const nextRejected = new Set(rejected);
      let text: string;
      if (isReject) {
        nextRejected.delete(id);
        text = '이 진술과 맞물리는 증거가 현장에 있다. 봉투를 다시 훑어보자.';
        if (entry.answer) {
          emitWrong(entry.answer);
          noteMissed(entry.answer);
        }
      } else {
        delete nextPlaced[id];
        const w = cur.envelopes.find((x) => x.en === chip);
        text = `「${chip}」는 이 진술의 자리가 아니다. 수첩으로 되돌린다.`;
        if (w) {
          emitWrong(w);
          noteMissed(w);
        }
      }
      spendCertainty(text, nextPlaced, nextRejected, isReject ? id : undefined);
    },
    [cur, locked, rejected, placed, combo, caseBase, lives, emitCorrect, emitWrong, noteMissed, sfx, showFlash, showBurst, closeCase, spendCertainty],
  );

  // ─── 전면 재구성(승부수) ───
  // 성공하면 남은 줄 전부가 2배로 굳고 연쇄가 한 번에 치솟는다.
  // 실패하면 심증 1 소모 + 연쇄 소멸, 그리고 **어느 줄이 틀렸는지 알려주지 않는다** —
  // 부분 정답 개수를 흘리면 브루트포스가 최적 전략이 되어 추리가 사라진다.
  const allIn = useCallback(() => {
    if (!cur || !canAllIn) return;
    const rows = pending;
    const allRight = rows.every((e) => (rejected.has(e.id) ? e.answer === null : placed[e.id] === e.answer?.en));

    if (!allRight) {
      sfx.nearMiss();
      spendCertainty('조서가 반려됐다 — 적어도 한 줄이 어긋난다. 어느 줄인지는 조서에 적혀 있지 않다.', placed, rejected);
      return;
    }

    const nextLocked: Record<number, LockKind> = { ...locked };
    let c = combo.combo;
    let gained = 0;
    rows.forEach((e) => {
      const isReject = rejected.has(e.id);
      nextLocked[e.id] = isReject ? 'reject' : 'match';
      gained += Math.round((isReject ? PT_REJECT : PT_MATCH) * multFor(c) * ALL_IN_MULT);
      c += 1;
      combo.hit();
      if (!isReject && e.answer) emitCorrect(e.answer);
    });
    const nextBase = caseBase + gained;
    setLocked(nextLocked);
    setCaseBase(nextBase);
    setScore((s) => s + gained);
    setAllInWins((n) => n + 1);
    setNote({ text: `전면 재구성 성립 — ${rows.length}줄 동시 확정. +${gained}`, ok: true });
    sfx.correct(c, true);
    showFlash(rows[0].id, 'correct');
    showBurst(rows[0].id);
    closeCase('solved', nextLocked, nextBase, lives);
  }, [cur, canAllIn, pending, rejected, placed, locked, combo, caseBase, lives, emitCorrect, sfx, showFlash, showBurst, closeCase, spendCertainty]);

  // ─── 진행 ───
  const goNext = useCallback(() => {
    sfx.click();
    setSummary(null);
    if (caseIdx + 1 < cases.length) {
      const nc = cases[caseIdx + 1];
      setCaseIdx(caseIdx + 1);
      resetCaseState(nc);
      setPhase('case');
    } else {
      const r = pb.submit(score);
      setBestInfo({ prev: r.prev, improved: r.improved });
      setPhase('done');
    }
  }, [caseIdx, cases, resetCaseState, pb, score, sfx]);

  const startRun = useCallback(() => {
    const fresh = buildCases(pool);
    setCases(fresh);
    setCaseIdx(0);
    resetCaseState(fresh[0]);
    setScore(0);
    setSolvedCount(0);
    setSummary(null);
    setMissed([]);
    setBestInfo(null);
    setAllInWins(0);
    setTierMsg('');
    combo.reset();
    setPhase('case');
    sfx.click();
  }, [pool, resetCaseState, combo, sfx]);

  const handleExit = useCallback(() => onExit?.(), [onExit]);

  const shell = (body: ReactNode, glowAt: string) => (
    <div className="gk-root ld-root">
      <GameMusic gameId="lexicon-detective" />
      <div className="gk-sr" aria-live="polite">{note.text || tierMsg}</div>
      <GameKitStyles />
      <AmbientBackground center="#EEE6D2" mid="#CDBE99" edge="#2E2A1C" glow="rgba(200,170,90,.26)" glowAt={glowAt} watermark="lexicon-detective" />
      <style dangerouslySetInnerHTML={{ __html: LD_CSS }} />
      {body}
    </div>
  );

  // ─── 브리핑 ───
  if (phase === 'brief') {
    return shell(
      <>
        <Hud muted={sfx.muted} onToggleMute={() => sfx.setMuted((m) => !m)} onExit={handleExit} />
        <main className="gk-stage ld-stage">
          <div className="ld-head">
            <h1 className="ld-title">사건철 — 압수된 수첩</h1>
            <p className="ld-scene">범인의 수첩은 영문, 경찰 조서는 국문이다. 둘을 대조해 사건을 재구성하라.</p>
          </div>
          <ol className="ld-brief">
            <li><b>조사</b> — 봉인된 증거 봉투를 열면 수첩의 단어가 나온다. 열 때마다 <b>현장 보존도</b>가 1 줄어든다(종결 시 남은 보존도 ×{PT_PRESERVE}점).</li>
            <li><b>확정</b> — 조서의 진술에 맞는 단어를 끼우고 확정한다. 이어질수록 연쇄 배수가 오른다.</li>
            <li><b>기각</b> — 어느 봉투와도 맞지 않는 진술은 기각한다. 조서에 위증이 몇 줄 섞였는지는 알려주지 않는다.</li>
            <li><b>심증</b> — 어긋난 판단마다 1 소모. 0 이 되면 그 사건은 미제로 종결되고 진상이 공개된다.</li>
            <li><b>전면 재구성</b> — 남은 진술을 한 번에 판정한다. 전부 맞으면 <b>점수 ×{ALL_IN_MULT}</b>, 하나라도 틀리면 어디가 틀렸는지 알려주지 않는다.</li>
          </ol>
          <div className="ld-actions">
            <button type="button" className="gk-btn gk-btn--primary ld-submit" onClick={startRun}>사건철 열기</button>
            <span className="ld-foot">
              {demoMode
                ? `사건 ${SPECS.length}건 · 맛보기 어휘로 진행합니다 — 복습 기록은 남지 않아요`
                : `사건 ${SPECS.length}건 · 내 단어장에서 매 판 새로 구성됩니다`}
            </span>
          </div>
        </main>
      </>,
      '50% 24%',
    );
  }

  // ─── 사건 종결 리포트 ───
  if (phase === 'summary' && summary) {
    const solvedAll = summary.outcome === 'solved';
    const totalCase = summary.base + summary.preserve + summary.life;
    return shell(
      <>
        <Hud
          score={shownScore}
          progress={(summary.index + 1) / cases.length}
          combo={combo.combo}
          comboMult={multFor(combo.combo)}
          muted={sfx.muted}
          onToggleMute={() => sfx.setMuted((m) => !m)}
          onExit={handleExit}
        />
        <main className="gk-stage ld-stage">
          <div className="ld-head">
            <h1 className="ld-title">
              사건 {summary.index + 1} · {summary.title} — {solvedAll ? '종결' : '미제'}
            </h1>
            <p className="ld-scene">
              {solvedAll
                ? '조서와 수첩이 한 줄도 어긋나지 않는다.'
                : '심증이 바닥났다. 사건은 미제로 넘긴다 — 대신 진상은 여기 남겨 둔다.'}
            </p>
          </div>

          <ul className="ld-report">
            {summary.rows.map((r, i) => {
              const good = r.got !== 'miss';
              return (
                <li key={i} className={`ld-rep-row ${good ? 'ld-rep-row--ok' : ''}`}>
                  <span className="ld-rep-mark" aria-hidden="true">
                    <FeedbackIcon kind={good ? 'correct' : 'wrong'} size={13} />
                  </span>
                  <span className="ld-rep-ko">{r.ko}</span>
                  {r.answer ? (
                    <span className="ld-rep-ans">
                      <b>{r.answer.en}</b>
                      {r.answer.pron ? <i className="ld-rep-pron">{r.answer.pron}</i> : null}
                      {r.answer.example ? <span className="ld-rep-ex">{r.answer.example}</span> : null}
                    </span>
                  ) : (
                    <span className="ld-rep-ans ld-rep-ans--false">위증 — 현장의 어느 봉투와도 맞물리지 않는다</span>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="ld-tally">
            <span>재구성 {summary.base.toLocaleString()}</span>
            <span aria-hidden="true">·</span>
            <span>보존 {summary.preserveCount}봉투 {summary.preserve > 0 ? `+${summary.preserve}` : '+0'}</span>
            <span aria-hidden="true">·</span>
            <span>심증 {summary.life > 0 ? `+${summary.life}` : '+0'}</span>
            <span aria-hidden="true">·</span>
            <b>합계 {totalCase.toLocaleString()}</b>
          </div>

          <div className="ld-actions">
            <button type="button" className="gk-btn gk-btn--primary ld-submit" onClick={goNext}>
              {summary.index + 1 < cases.length ? `다음 사건 → ${cases[summary.index + 1].title}` : '사건철 종결'}
            </button>
            {summary.index + 1 < cases.length && (
              <span className="ld-foot">{cases[summary.index + 1].note}</span>
            )}
          </div>
        </main>
      </>,
      '50% 26%',
    );
  }

  // ─── 완료 ───
  if (phase === 'done') {
    const perfect = solvedCount === cases.length;
    const hint = perfect
      ? allInWins > 0
        ? `전면 재구성 ${allInWins}회 성립. 다음 판은 봉투를 두 개 덜 열고 같은 점수를 노려보자 (+${2 * PT_PRESERVE}).`
        : '전부 종결했다. 다음 판엔 「전면 재구성」으로 배수를 걸어보자 — 점수가 두 배가 된다.'
      : `미제 ${cases.length - solvedCount}건. 맞물리는 증거가 없다고 느껴지면 「기각」이 정답인 경우가 있다.`;
    return shell(
      <>
        <Hud muted={sfx.muted} onToggleMute={() => sfx.setMuted((m) => !m)} onExit={handleExit} />
        <GameDone
          mark="lexicon-detective"
          lead={perfect ? '사건철을 전부 닫았어요' : '오늘 조사는 여기까지'}
          celebrate={perfect}
          stats={[
            { num: score.toLocaleString(), label: '수사 점수', accent: true },
            { num: `${solvedCount}/${cases.length}`, label: '종결한 사건' },
            { num: combo.best, label: '최장 연쇄' },
          ]}
          best={bestInfo ? { prev: bestInfo.prev, now: score, label: '점수', improved: bestInfo.improved } : undefined}
          badge={
            perfect ? (
              <>전 사건 종결{allInWins > 0 ? ` · 전면 재구성 ${allInWins}회` : ''}</>
            ) : combo.best >= 6 ? (
              <>최장 연쇄 {combo.best}</>
            ) : undefined
          }
          reveal={
            missed.length > 0 ? (
              <>
                <b className="ld-reveal-h">다시 볼 단어 {missed.length}개</b>
                <ul className="ld-reveal-list">
                  {missed.map((w) => (
                    <li key={w.en}>
                      <b>{w.en}</b> — {w.ko}
                    </li>
                  ))}
                </ul>
              </>
            ) : undefined
          }
          restartLabel="새 사건철"
          restartHint={hint}
          onRestart={startRun}
          onExit={handleExit}
        />
      </>,
      '50% 30%',
    );
  }

  if (!cur) return null;

  // ─── 수사 화면 ───
  const entriesTotal = cases.reduce((n, c) => n + c.entries.length, 0);
  const resolvedTotal =
    cases.slice(0, caseIdx).reduce((n, c) => n + c.entries.length, 0) + Object.keys(locked).length;
  const mult = multFor(combo.combo);

  return shell(
    <>
      <Hud
        score={shownScore}
        progress={entriesTotal > 0 ? resolvedTotal / entriesTotal : 0}
        combo={combo.combo}
        comboMult={mult}
        lives={{ total: cur.lives, left: lives, label: '심증' }}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={
          <div className="ld-hud">
            <span className="gk-stat-label">사건 {caseIdx + 1}/{cases.length}</span>
            <span className="ld-hud-v" data-low={preserved <= 2 ? '1' : '0'}>
              <SealIcon open={preserved <= 2} />
              보존 {preserved}/{cur.envelopes.length}
              {preserved <= 2 && <em className="ld-hud-tag">낮음</em>}
            </span>
          </div>
        }
      />

      <main className="gk-stage ld-stage">
        <div className="ld-head">
          <h1 className="ld-title">사건 {caseIdx + 1} · {cur.title}</h1>
          <p className="ld-scene">{cur.scene}</p>
          <button type="button" className="ld-rules-btn" onClick={() => setShowRules((v) => !v)} aria-expanded={showRules}>
            {showRules ? '규칙 접기' : '규칙 보기'}
          </button>
          {showRules && (
            <ul className="ld-rules">
              <li>봉투를 열면 단어가 나온다 — 열 때마다 보존도 1 감소(종결 시 ×{PT_PRESERVE}점).</li>
              <li>진술에 단어를 끼우고 확정. 맞물리는 증거가 없으면 기각.</li>
              <li>어긋나면 심증 1 감소 · 연쇄 소멸. 심증 0 이면 미제.</li>
              <li>전면 재구성: 남은 줄 일괄 판정, 전부 맞으면 ×{ALL_IN_MULT}.</li>
            </ul>
          )}
        </div>

        {/* 증거 봉투 */}
        <div className="ld-board" role="group" aria-label="증거 봉투">
          {cur.envelopes.map((w, i) => {
            const isOpen = opened.has(w.en);
            const isUsed = usedEn.has(w.en);
            const isHeld = held === w.en;
            return (
              <button
                key={w.en}
                type="button"
                className={`ld-env ${isOpen ? 'ld-env--open' : ''} ${isHeld ? 'ld-env--held' : ''} ${isUsed ? 'ld-env--used' : ''}`}
                onClick={() => (isOpen ? (isUsed ? undefined : toggleHold(w.en)) : openEnvelope(w.en))}
                aria-pressed={isOpen ? isHeld : undefined}
                aria-disabled={isUsed ? 'true' : undefined}
                aria-label={
                  isOpen
                    ? `증거 ${i + 1} — ${w.en}${isUsed ? ' · 조서에 배치됨' : isHeld ? ' · 손에 들고 있음' : ''}`
                    : `증거 ${i + 1} — 미개봉. 열면 보존도가 1 줄어든다`
                }
              >
                <span className="ld-env-ic" aria-hidden="true"><SealIcon open={isOpen} /></span>
                {isOpen ? (
                  <b className="ld-env-word">{w.en}</b>
                ) : (
                  <span className="ld-env-no">증거 {i + 1}</span>
                )}
                {isUsed && <span className="ld-env-tag" aria-hidden="true">배치됨</span>}
              </button>
            );
          })}
        </div>

        {/* 사건 조서 */}
        <div className="ld-file">
          <span className="ld-file-h">사건 조서 · 진술 {cur.entries.length}줄</span>
          <ul className="ld-rows">
            {cur.entries.map((e, i) => {
              const lock = locked[e.id];
              const chip = placed[e.id];
              const rej = rejected.has(e.id);
              const fl = flash?.id === e.id ? flash.kind : null;
              return (
                <li
                  key={e.id}
                  className={`ld-row ${lock ? 'ld-row--locked' : ''} ${fl === 'correct' ? 'ld-row--ok' : ''} ${fl === 'wrong' ? 'ld-row--bad' : ''}`}
                >
                  <span className="ld-row-no" aria-hidden="true">{i + 1}</span>
                  <span className="ld-row-ko">{e.ko}</span>
                  <div className="ld-row-act">
                    {lock ? (
                      <span className={`ld-locked ${lock === 'reject' ? 'ld-locked--rej' : ''}`}>
                        <FeedbackIcon kind="correct" size={13} />
                        {lock === 'reject' ? '기각 확정' : chip}
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={`ld-slot ${chip ? 'ld-slot--filled' : ''} ${rej ? 'ld-slot--rej' : ''}`}
                          onClick={() => tapSlot(e.id)}
                          aria-label={
                            chip
                              ? `진술 ${i + 1} — ${chip} 배치됨. 누르면 되돌린다`
                              : rej
                                ? `진술 ${i + 1} — 기각 표시됨`
                                : `진술 ${i + 1} — 비어 있음. 손에 든 단어를 놓는다`
                          }
                        >
                          {chip ? <b>{chip}</b> : rej ? <span className="ld-slot-hint">기각 표시</span> : <span className="ld-slot-hint">단어 놓기</span>}
                        </button>
                        <button
                          type="button"
                          className={`ld-mini ld-mini--rej ${rej ? 'ld-mini--on' : ''}`}
                          onClick={() => toggleReject(e.id)}
                          aria-pressed={rej}
                          aria-label={`진술 ${i + 1} 위증으로 기각`}
                        >
                          기각
                        </button>
                        <button
                          type="button"
                          className="ld-mini ld-mini--ok"
                          onClick={() => confirmRow(e.id)}
                          disabled={!chip && !rej}
                          aria-label={`진술 ${i + 1} 확정`}
                        >
                          확정
                        </button>
                      </>
                    )}
                    {fl === 'wrong' && (
                      <span className="ld-row-fb ld-row-fb--bad" aria-hidden="true"><FeedbackIcon kind="wrong" size={14} /></span>
                    )}
                  </div>
                  {burstId === e.id && (
                    <span className="ld-burst" aria-hidden="true">
                      <ParticleBurst intensity={1} colors={['var(--success)', 'var(--combo)']} />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="ld-actions">
          {tierMsg && <span className="ld-tier">{tierMsg}</span>}
          {note.text && (
            <span className={`ld-msg ${note.ok ? 'ld-msg--ok' : ''}`}>
              <FeedbackIcon kind={note.ok ? 'correct' : 'near'} size={13} />
              {note.text}
            </span>
          )}
          {!note.text && !tierMsg && (
            <span className="ld-foot">
              {opened.size === 0
                ? '봉투를 열어 수첩의 단어를 확보하라 — 다만 연 만큼 현장은 흐트러진다.'
                : held
                  ? `「${held}」를 들었다 — 맞물릴 진술을 짚어라.`
                  : '단어를 골라 진술에 끼우거나, 맞물리는 증거가 없으면 기각하라.'}
            </span>
          )}
          <button
            type="button"
            className="gk-btn gk-btn--primary ld-submit"
            onClick={allIn}
            disabled={!canAllIn}
            title={canAllIn ? undefined : '남은 진술 전부에 판단을 내려야 승부수를 던질 수 있다'}
          >
            전면 재구성 ×{ALL_IN_MULT} · {pending.length}줄
          </button>
        </div>
      </main>
    </>,
    '50% 18%',
  );
}

const LD_CSS = `
  .ld-hud { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.1; gap: 2px; }
  .ld-hud-v { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 800; color: var(--t1); font-variant-numeric: tabular-nums; }
  .ld-hud-v[data-low="1"] { color: var(--warning); }
  .ld-hud-tag { font-style: normal; font-size: 10px; font-weight: 800; letter-spacing: .04em; padding: 1px 5px; border-radius: 999px; border: 1px solid currentColor; }
  .ld-stage { gap: clamp(10px, 2vh, 18px); justify-content: flex-start; padding-top: clamp(8px, 1.6vh, 16px); overflow-y: auto; }

  .ld-head { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .ld-title { margin: 0; font-family: var(--font-display, system-ui); font-size: clamp(18px, 3vw, 24px); font-weight: 800; color: var(--t1); }
  .ld-scene { margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13.5px; color: var(--t2); max-width: 56ch; }

  .ld-rules-btn { min-height: 32px; padding: 4px 12px; border-radius: 999px; border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 60%, transparent); color: var(--t3); font-family: var(--font-display, system-ui); font-size: 11.5px; font-weight: 700; cursor: pointer; transition: color .15s, border-color .15s, background .15s; }
  .ld-rules-btn:hover { color: var(--t1); border-color: var(--t3); }
  .ld-rules-btn:active { background: color-mix(in srgb, var(--t1) 8%, transparent); }
  .ld-rules-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--active) 30%, transparent); }
  .ld-rules { margin: 4px 0 0; padding: 10px 16px 10px 30px; list-style: disc; text-align: left; max-width: min(560px, 94vw); border-radius: 10px; border: 1px dashed var(--bd); background: color-mix(in srgb, var(--bg) 55%, transparent); font-size: 12.5px; line-height: 1.75; color: var(--t2); }

  .ld-brief { margin: 0; padding: 16px 20px 16px 38px; list-style: decimal; width: min(600px, 94vw); border-radius: 14px; border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 76%, #fff); box-shadow: 0 16px 40px -22px rgba(30,26,14,.6); font-family: var(--font-body, Georgia, serif); font-size: 14px; line-height: 1.85; color: var(--t2); }
  .ld-brief b { font-family: var(--font-display, system-ui); font-weight: 800; color: var(--t1); }

  .ld-board { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; width: min(660px, 96vw); }
  @media (max-width: 420px) { .ld-board { grid-template-columns: repeat(auto-fill, minmax(74px, 1fr)); gap: 6px; } }
  .ld-env { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; min-height: 58px; padding: 8px 5px; border-radius: 10px; border: 1.5px solid var(--bd); background: color-mix(in srgb, var(--bg) 62%, transparent); color: var(--t2); cursor: pointer; transition: transform .12s var(--ease-spring), border-color .15s, background .15s, box-shadow .15s, opacity .2s; text-align: center; }
  .ld-env:hover:not([aria-disabled="true"]) { transform: translateY(-2px); border-color: var(--active); color: var(--t1); }
  .ld-env:active:not([aria-disabled="true"]) { transform: translateY(0) scale(.96); }
  .ld-env:focus-visible { outline: none; border-color: var(--active); box-shadow: 0 0 0 3px color-mix(in srgb, var(--active) 28%, transparent); }
  .ld-env-ic { display: inline-flex; color: var(--t3); transition: color .15s; }
  .ld-env--open .ld-env-ic { color: var(--active); }
  .ld-env-no { font-size: 10.5px; color: var(--t3); letter-spacing: .02em; }
  .ld-env-word { font-family: var(--font-english, system-ui); font-size: 13.5px; font-weight: 800; color: var(--t1); line-height: 1.15; overflow-wrap: anywhere; }
  .ld-env--open { border-color: color-mix(in srgb, var(--active) 48%, var(--bd)); background: color-mix(in srgb, var(--active) 9%, var(--bg)); }
  .ld-env--held { border-color: var(--combo); background: var(--combo); box-shadow: 0 6px 18px color-mix(in srgb, var(--combo) 32%, transparent); }
  .ld-env--held .ld-env-word, .ld-env--held .ld-env-ic { color: var(--ti); }
  .ld-env--used { opacity: .42; cursor: default; }
  .ld-env--used .ld-env-word { text-decoration: line-through; text-decoration-thickness: 1.5px; }
  .ld-env-tag { position: absolute; top: 3px; right: 4px; font-size: 8.5px; font-weight: 800; letter-spacing: .02em; color: var(--t3); }
  .ld-env[aria-disabled="true"] { pointer-events: none; }

  .ld-file { width: min(620px, 96vw); padding: 12px 14px 14px; border-radius: 12px; background: color-mix(in srgb, var(--bg) 80%, #fff); border: 1px solid var(--bd); box-shadow: 0 16px 40px -22px rgba(30,26,14,.6); }
  .ld-file-h { font-family: var(--font-english, monospace); font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--t3); font-weight: 700; }
  .ld-rows { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .ld-row { position: relative; display: grid; grid-template-columns: 22px 1fr; align-items: center; gap: 4px 8px; padding: 7px 9px; border-radius: 10px; border: 1.5px solid transparent; background: color-mix(in srgb, var(--t1) 4%, transparent); transition: border-color .18s, background .18s; }
  .ld-row-no { grid-row: 1; font-family: var(--font-english, monospace); font-size: 11px; font-weight: 800; color: var(--t3); text-align: center; }
  .ld-row-ko { grid-row: 1; font-family: var(--font-body, Georgia, serif); font-size: clamp(14px, 2.2vw, 16px); font-weight: 600; color: var(--t1); line-height: 1.35; overflow-wrap: anywhere; }
  .ld-row-act { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  @media (min-width: 560px) {
    .ld-row { grid-template-columns: 22px minmax(0, 1fr) auto; }
    .ld-row-act { grid-column: 3; grid-row: 1; flex-wrap: nowrap; }
  }

  .ld-slot { flex: 1 1 132px; min-width: 132px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 8px 12px; border-radius: 8px; border: 1.5px dashed color-mix(in srgb, var(--active) 62%, transparent); background: color-mix(in srgb, var(--active) 6%, transparent); color: var(--t1); font-family: inherit; cursor: pointer; transition: border-color .15s, background .15s, transform .12s var(--ease-spring); }
  .ld-slot b { font-family: var(--font-english, system-ui); font-size: 14px; font-weight: 800; color: var(--combo); overflow-wrap: anywhere; }
  .ld-slot-hint { font-size: 12px; font-style: italic; color: var(--t3); }
  .ld-slot:hover { background: color-mix(in srgb, var(--active) 14%, transparent); border-color: var(--active); }
  .ld-slot:active { transform: scale(.98); }
  .ld-slot:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--active) 30%, transparent); }
  .ld-slot--filled { border-style: solid; border-color: color-mix(in srgb, var(--combo) 55%, transparent); }
  .ld-slot--rej { border-style: dotted; border-color: color-mix(in srgb, var(--warning) 65%, transparent); background: color-mix(in srgb, var(--warning) 9%, transparent); }
  .ld-slot--rej .ld-slot-hint { color: var(--warning); font-style: normal; font-weight: 700; }

  .ld-mini { min-height: 44px; min-width: 56px; padding: 0 12px; border-radius: 8px; border: 1.5px solid var(--bd); background: var(--bg); color: var(--t2); font-family: var(--font-display, system-ui); font-size: 12.5px; font-weight: 800; cursor: pointer; transition: border-color .15s, color .15s, background .15s, transform .12s var(--ease-spring); }
  .ld-mini:hover:not(:disabled) { color: var(--t1); border-color: var(--t3); }
  .ld-mini:active:not(:disabled) { transform: scale(.96); }
  .ld-mini:disabled { opacity: .42; cursor: default; }
  .ld-mini--rej:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--warning) 32%, transparent); }
  .ld-mini--rej.ld-mini--on { color: var(--ti); background: var(--warning); border-color: var(--warning); }
  .ld-mini--ok { color: var(--t1); border-color: color-mix(in srgb, var(--success) 45%, var(--bd)); }
  .ld-mini--ok:hover:not(:disabled) { background: color-mix(in srgb, var(--success) 12%, transparent); border-color: var(--success); }
  .ld-mini--ok:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 32%, transparent); }

  .ld-locked { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 12px; border-radius: 8px; border: 1.5px solid var(--success); background: color-mix(in srgb, var(--success) 12%, transparent); color: var(--success); font-family: var(--font-english, system-ui); font-size: 14px; font-weight: 800; overflow-wrap: anywhere; }
  .ld-locked--rej { border-color: var(--warning); background: color-mix(in srgb, var(--warning) 12%, transparent); color: var(--warning); font-family: var(--font-display, system-ui); font-size: 12.5px; }
  .ld-row--locked { background: color-mix(in srgb, var(--success) 7%, transparent); }
  .ld-row--locked .ld-row-ko { color: var(--t2); }
  .ld-row--ok { border-color: var(--success); animation: gk-correct .42s var(--ease, ease-out); }
  .ld-row--bad { border-color: var(--error); background: color-mix(in srgb, var(--error) 9%, transparent); animation: gk-shake .36s ease-in-out; }
  .ld-row-fb { display: inline-flex; align-items: center; }
  .ld-row-fb--bad { color: var(--error); }
  .ld-burst { position: absolute; right: 28px; top: 50%; width: 0; height: 0; pointer-events: none; }

  .ld-report { list-style: none; margin: 0; padding: 12px 14px; width: min(620px, 96vw); display: flex; flex-direction: column; gap: 7px; border-radius: 12px; border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 80%, #fff); box-shadow: 0 16px 40px -22px rgba(30,26,14,.6); }
  .ld-rep-row { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 3px 8px; align-items: start; padding-bottom: 6px; border-bottom: 1px dashed color-mix(in srgb, var(--t1) 12%, transparent); color: var(--t3); }
  .ld-rep-row:last-child { border-bottom: none; padding-bottom: 0; }
  .ld-rep-mark { grid-row: 1; padding-top: 2px; color: var(--error); }
  .ld-rep-row--ok .ld-rep-mark { color: var(--success); }
  .ld-rep-ko { grid-row: 1; font-family: var(--font-body, Georgia, serif); font-size: 14px; font-weight: 700; color: var(--t1); }
  .ld-rep-ans { grid-column: 2; display: flex; flex-direction: column; gap: 1px; font-size: 12.5px; color: var(--t2); }
  .ld-rep-ans b { font-family: var(--font-english, system-ui); font-size: 14px; font-weight: 800; color: var(--active); }
  .ld-rep-pron { font-style: normal; font-family: var(--font-english, system-ui); font-size: 11.5px; color: var(--t3); }
  .ld-rep-ex { font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 12px; color: var(--t3); line-height: 1.5; }
  .ld-rep-ans--false { font-family: var(--font-display, system-ui); font-size: 12.5px; font-weight: 700; color: var(--warning); }

  .ld-tally { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; font-family: var(--font-display, system-ui); font-size: 12.5px; font-weight: 700; color: var(--t3); font-variant-numeric: tabular-nums; }
  .ld-tally b { color: var(--t1); }

  .ld-reveal-h { display: block; font-family: var(--font-display, system-ui); font-size: 12.5px; font-weight: 800; color: var(--t1); margin-bottom: 6px; }
  .ld-reveal-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; font-size: 13px; }
  .ld-reveal-list b { font-family: var(--font-english, system-ui); font-weight: 800; color: var(--active); }

  .ld-actions { display: flex; flex-direction: column; align-items: center; gap: 8px; padding-bottom: 10px; text-align: center; }
  .ld-msg { display: inline-flex; align-items: baseline; gap: 6px; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13.5px; font-weight: 700; color: var(--warning); max-width: 52ch; text-align: left; }
  .ld-msg--ok { color: var(--success); }
  .ld-tier { font-family: var(--font-display, system-ui); font-size: 12px; font-weight: 800; letter-spacing: .08em; color: var(--streak); }
  .ld-foot { font-size: 12px; color: var(--t3); font-style: italic; max-width: 52ch; }
  .ld-submit { min-width: 190px; }

  @media (prefers-reduced-motion: reduce) {
    .ld-env, .ld-slot, .ld-mini, .ld-row, .ld-rules-btn { transition: opacity .15s, background .15s, border-color .15s, color .15s; }
    .ld-env:hover:not([aria-disabled="true"]), .ld-env:active:not([aria-disabled="true"]),
    .ld-slot:active, .ld-mini:active:not(:disabled) { transform: none; }
    .ld-row--ok, .ld-row--bad { animation: none; }
  }
`;
