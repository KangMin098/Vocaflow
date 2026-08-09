// apps/web/src/components/game/glyph-tongue/GlyphTongueGame.tsx
// The Glyph Tongue — 문맥 해독 탐사(Chants of Sennaar 계열).
//
// v07.9 전면 재설계. 이전 버전은 "무한 재시도가 가능한 5×5 매칭 워크시트"였다:
// 오답 비용 0 · 시계 0 · 점수 0 · 뜻 뱅크가 줄어들어 석실마다 마지막 룬은 공짜 정답.
// 브루트포스가 지배 전략이었고, 영어를 한 줄도 읽지 않아도 이길 수 있었다.
//
// 지금의 뼈대:
//   · 등불(하나의 카운트다운)이 세션 전체를 관통한다. 정답 +4초 · 어긋남 -8초 ·
//     석실 개방 +15초. 시간이 곧 보상이자 벌이다. 석실을 연 직후에는 시계를 멈춰
//     "읽어내는 순간"을 벌 없이 음미하게 한다.
//   · 봉인은 **묶음 도박**이다. 지금 확신하는 1개만 봉인(안전·저배수) vs 5개를 한 번에
//     봉인(전부 맞아야 ×4). 하나라도 어긋나면 묶음 배수는 사라지고 등불이 깎인다.
//   · 뜻 뱅크에 **미끼**가 상주한다(석실별 1~3개). 어떤 룬의 답도 아니고 사라지지도
//     않으므로 마지막 룬조차 공짜가 아니다.
//   · **탁본**은 막혔을 때의 유료 출구다. 등불 12초를 태워 룬의 영어 골격
//     (첫 글자·끝 글자·길이)을 얻는다. 영어를 아는 학습자에게만 값이 있고,
//     탁본으로 산 정답은 점수도 연쇄도 FSRS 기록도 없다(계약: 힌트로 산 정답을
//     onCorrect 로 올리지 않는다).
//   · 마지막 석실을 열면 **최종 봉인** — 이번 판에 스스로 읽어낸 룬들을 26초 안에
//     다시 이어야 한다. 재인이 아니라 인출이고, 세션의 클라이맥스다.
//
// 인출 규칙 준수:
//   · 제출 전 화면에는 영단어도 한국어 정답 대응도 없다. 룬은 미지의 글자이고
//     근거는 비문(영어 문맥)뿐이다.
//   · "N개 맞음" 같은 무위험 탐색 오라클이 없다 — 봉인은 등불·연쇄·기록을 건다.
//   · 정답 공개는 봉인 이후에만. 대신 그때는 룬이 영어로 풀리고 뜻이 함께 남는다.
//   · 등불이 꺼져도 못 읽은 룬은 결과 화면에서 전부 펼쳐 보여준다(오답=학습 기회).

'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles, AmbientBackground, Hud, GameDone, GameMusic,
  TimerBar, FeedbackIcon, ParticleBurst,
  useSfx, useCountdown, useCombo, usePersonalBest, useCountUp,
  shuffle, clamp, pickDistinct, type Word,
} from '@/components/game/_shared/gamekit';

interface Props { wordPool?: Word[]; onExit?: () => void; onCorrect?: (w: Word) => void; onWrong?: (w: Word) => void; }

// ── 튜닝 상수 (한곳에 모아 균형을 눈으로 읽게) ──────────────────────────────
const TOTAL_MS = 150_000;   // 등불 총량
const WARN_MS = 15_000;     // 경고 구간
const RECALL_MS = 26_000;   // 최종 봉인 제한
const RECALL_WARN_MS = 8_000;
const GAIN_MS = 4_000;      // 룬 해독 보상
const LOSS_MS = 8_000;      // 어긋난 룬 1개당 벌
const CLEAR_MS = 15_000;    // 석실 개방 보상
const RUB_MS = 12_000;      // 탁본 비용
const RUB_FLOOR_MS = 15_000; // 이 아래로는 탁본 불가(마지막 숨까지 태우지 않게)
const MISREAD_MS = 700;     // 어긋난 배치를 비우기 전에 보여주는 시간(그동안 입력은 잠근다)
const BASE_SCORE = 100;
const RECALL_SCORE = 240;
const RECALL_PERFECT_BONUS = 600;
const CHAMBER_SIZES = [4, 5, 5];
const CHAMBER_MULT = [1, 1.4, 2];
const CHAMBER_DECOYS = [1, 2, 3];
/** 한 번에 봉인한 룬 수 → 묶음 배수. 전부 맞았을 때만 붙는다. */
const BATCH_MULT = [1, 1, 1.6, 2.2, 3, 4];
const RUNE_NAMES = ['가', '나', '다', '라', '마', '바', '사', '아'];
const BURST_COLORS = ['#C8A44A', '#E7D9AE', 'var(--success)'];

// ── 석실 뱅크: 뜻 미제공. 룬마다 영어 비문 2개로만 삼각측량한다. {}=룬 자리 ──
interface GWord { en: string; ko: string; ins: string[] }
const WORD_BANK: GWord[] = [
  { en: 'reluctant', ko: '마지못한·꺼리는', ins: ['The boy was {} to leave his warm bed.', 'She gave a {} nod, still unsure of the plan.'] },
  { en: 'exhausted', ko: '기진맥진한', ins: ['After the long march, the soldiers were {}.', 'He was so {} that he fell asleep at the table.'] },
  { en: 'curious', ko: '호기심 많은', ins: ['The {} child opened every box to see inside.', 'Cats are {} and explore every new corner.'] },
  { en: 'furious', ko: '몹시 화난', ins: ['The king was {} when he heard of the theft.', 'She was {} and slammed the heavy door.'] },
  { en: 'content', ko: '만족한', ins: ['With a full meal and a warm fire, he felt {}.', 'She was {} with her simple, quiet life.'] },
  { en: 'whisper', ko: '속삭이다', ins: ['She had to {} so the baby would not wake.', 'They {} secrets in the dark, silent library.'] },
  { en: 'vanish', ko: '사라지다', ins: ['The magician made the coin {} in an instant.', 'The ship began to {} into the thick fog.'] },
  { en: 'gather', ko: '모으다·모이다', ins: ['The farmers {} the wheat before the storm.', 'A crowd began to {} around the street singer.'] },
  { en: 'rescue', ko: '구조하다', ins: ['The firefighters {} the cat from the tall tree.', 'He jumped in to {} the drowning boy.'] },
  { en: 'forbid', ko: '금지하다', ins: ['The teacher will {} phones during the exam.', 'The old law used to {} trade with strangers.'] },
  { en: 'fragile', ko: '깨지기 쉬운', ins: ['Handle the glass with care; it is very {}.', 'The old letter was thin, yellow, and {}.'] },
  { en: 'enormous', ko: '거대한', ins: ['The {} whale was larger than the fishing boat.', 'They built an {} tower that touched the clouds.'] },
  { en: 'ancient', ko: '고대의', ins: ['The {} ruins were thousands of years old.', 'Scholars studied the {} language of the tomb.'] },
  { en: 'hollow', ko: '속이 빈', ins: ['The {} log made a deep, drum-like sound.', 'Owls often build a nest inside a {} tree.'] },
  { en: 'genuine', ko: '진짜의·진심의', ins: ['Experts confirmed the painting was {}, not a copy.', 'She gave a {} smile of real, warm joy.'] },
  { en: 'stubborn', ko: '고집 센', ins: ['The {} mule refused to move an inch.', 'He is too {} to admit he took the wrong road.'] },
  { en: 'grateful', ko: '고마워하는', ins: ['She was {} for the help of her neighbours.', 'A {} letter arrived from the family he saved.'] },
  { en: 'scatter', ko: '흩뿌리다·흩어지다', ins: ['The wind will {} the dry leaves across the yard.', 'The birds {} the moment the door opened.'] },
  { en: 'conceal', ko: '숨기다', ins: ['He tried to {} the letter under his coat.', 'Thick ivy came to {} the door of the ruin.'] },
  { en: 'abundant', ko: '풍부한', ins: ['Rain was {} that spring, and the fields grew tall.', 'Fish were once {} in this quiet river.'] },
  { en: 'swift', ko: '재빠른', ins: ['A {} rider carried the news before nightfall.', 'The fox made a {} turn and was gone.'] },
];

// ── 절차적 룬 생성 (단어 해시 → 결정적 SVG. Chants식 미지 문자) ──
function hashStr(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const COLS = [9, 20, 31], ROWS = [10, 22, 34, 46];
interface Glyph { strokes: string[]; dots: [number, number][] }

// salt 는 같은 석실 안에서 두 룬이 거의 같게 그려질 때 형태를 갈라놓는 재추첨 씨앗이다.
// 표현 공간이 좁으면(3열×4행) 충돌이 실제로 일어나고, 그 순간 게임은 읽을 수 없는 함정이 된다.
function buildGlyph(word: string, salt = 0): Glyph {
  const rnd = mulberry32(hashStr(salt ? `${word}#${salt}` : word));
  const node = (c: number, r: number) => `${COLS[c]} ${ROWS[r]}`;
  let c = Math.floor(rnd() * 3), r = Math.floor(rnd() * 4);
  const pts: [number, number][] = [[c, r]];
  const segs = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < segs; i++) {
    const move = rnd();
    if (move < 0.42) c = clamp(c + (rnd() < 0.5 ? -1 : 1), 0, 2);
    else if (move < 0.84) r = clamp(r + (rnd() < 0.5 ? -1 : 1), 0, 3);
    else { // 대각 — 표현 공간을 넓혀 충돌 확률을 떨어뜨린다
      c = clamp(c + (rnd() < 0.5 ? -1 : 1), 0, 2);
      r = clamp(r + (rnd() < 0.5 ? -1 : 1), 0, 3);
    }
    pts.push([c, r]);
  }
  const strokes = ['M' + node(pts[0][0], pts[0][1]) + pts.slice(1).map((p) => 'L' + node(p[0], p[1])).join('')];
  if (rnd() < 0.62) {
    const c2 = Math.floor(rnd() * 3), r2 = Math.floor(rnd() * 4), horiz = rnd() < 0.5;
    const c3 = clamp(c2 + (rnd() < 0.5 ? 1 : -1), 0, 2), r3 = clamp(r2 + (rnd() < 0.5 ? 1 : -1), 0, 3);
    strokes.push('M' + node(c2, r2) + 'L' + node(horiz ? c3 : c2, horiz ? r2 : r3));
  }
  if (rnd() < 0.35) {
    const c4 = Math.floor(rnd() * 3), r4 = Math.floor(rnd() * 4);
    const c5 = clamp(c4 + (rnd() < 0.5 ? 1 : -1), 0, 2), r5 = clamp(r4 + (rnd() < 0.5 ? 1 : -1), 0, 3);
    strokes.push('M' + node(c4, r4) + 'L' + node(c5, r5));
  }
  const dots: [number, number][] = [];
  if (rnd() < 0.5) { const cd = Math.floor(rnd() * 3), rd = Math.floor(rnd() * 4); dots.push([COLS[cd], ROWS[rd]]); }
  if (rnd() < 0.22) { const cd = Math.floor(rnd() * 3), rd = Math.floor(rnd() * 4); dots.push([COLS[cd], ROWS[rd]]); }
  return { strokes, dots };
}
const glyphKey = (g: Glyph) => g.strokes.join('|') + '#' + g.dots.map((d) => d.join(',')).join(';');
/** 스크린리더용 형태 서술 — svg 를 aria-hidden 으로만 두면 이 게임은 성립하지 않는다. */
const glyphDesc = (g: Glyph) => (g.dots.length ? `${g.strokes.length}획과 점 ${g.dots.length}개` : `${g.strokes.length}획`);

const Rune = memo(function Rune({ word, salt = 0, className }: { word: string; salt?: number; className?: string }) {
  const g = useMemo(() => buildGlyph(word, salt), [word, salt]);
  return (
    <svg viewBox="0 0 40 56" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {g.strokes.map((d, i) => <path key={i} d={d} />)}
      {g.dots.map((p, i) => <circle key={`d${i}`} cx={p[0]} cy={p[1]} r="1.9" fill="currentColor" stroke="none" />)}
    </svg>
  );
});

// ── 실 어휘 배선: 학습자 스코프 단어(예문 포함) → 석실 ──────────────────────
// Word 에는 example 이 하나뿐이라 실 어휘 경로에서는 룬당 비문이 1개다.
// 그래서 안내문이 "반복되는 룬"을 약속하지 않는다 — 약속과 화면이 어긋나면
// 실패가 "내가 못 읽었다"가 아니라 "정보가 없었다"로 느껴진다.
const escapeReg = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function poolToWords(pool?: Word[]): GWord[] {
  if (!pool) return [];
  const out: GWord[] = [];
  const seen = new Set<string>();
  const seenKo = new Set<string>(); // 같은 뜻이 두 룬에 걸리면 1:1 매핑이 영영 안 풀린다
  for (const w of pool) {
    if (!w.en || !w.ko || !w.example || seen.has(w.en) || seenKo.has(w.ko)) continue;
    const forms = [w.en, ...(w.inflected ?? [])].filter((f) => f && f.length >= 2);
    let ins: string | null = null;
    for (const f of forms) {
      const re = new RegExp(`\\b${escapeReg(f)}\\b`, 'i');
      if (re.test(w.example)) { ins = w.example.replace(re, '{}'); break; }
    }
    if (!ins) continue; // 예문에 단어가 없으면 블랭크 불가 → 제외
    seen.add(w.en); seenKo.add(w.ko);
    out.push({ en: w.en, ko: w.ko, ins: [ins] });
  }
  return out;
}

/** 미끼가 정답의 동의어면 불공정해진다 — 문자열이 서로를 품으면 후보에서 뺀다. */
const koClashes = (a: string, b: string) => a === b || a.includes(b) || b.includes(a);

interface Run { chambers: GWord[][]; spareKo: string[]; seed: number }
const RUN_CAPACITY = CHAMBER_SIZES.reduce((a, b) => a + b, 0);
/**
 * 판마다 단어 구성·석실 순서가 새로 뽑힌다. 두 번째 판이 '답 외우기'가 되지 않게.
 * seed 는 난수원이 아니라 재추첨 토큰이다 — 값이 바뀌면 새 판을 뽑는다(결과에 함께 실어 보낸다).
 *
 * 학습자 단어를 **전부** 먼저 쓰고, 모자라는 자리만 큐레이션 룬으로 채운다.
 * 이전 구현은 "쓸 만한 단어가 7개 미만이면 통째로 내장 뱅크"라 예문 있는 단어가
 * 5개인 학습자는 자기 단어를 한 개도 만나지 못했다(=FSRS 에도 한 줄 안 남았다).
 */
function buildRun(pool: Word[] | undefined, seed: number): Run {
  const own = shuffle(poolToWords(pool));
  let source = own;
  if (own.length < RUN_CAPACITY) {
    const ownEn = new Set(own.map((w) => w.en.toLowerCase()));
    const ownKo = own.map((w) => w.ko);
    const filler = shuffle(WORD_BANK).filter(
      (w) => !ownEn.has(w.en.toLowerCase()) && !ownKo.some((k) => koClashes(k, w.ko)),
    );
    source = shuffle([...own, ...filler.slice(0, RUN_CAPACITY - own.length)]);
  }
  const chambers: GWord[][] = [];
  let i = 0;
  for (const size of CHAMBER_SIZES) {
    const chunk = source.slice(i, i + size);
    if (chunk.length < 3) break;
    chambers.push(chunk);
    i += chunk.length;
  }
  if (!chambers.length) {
    const fallback = shuffle(WORD_BANK);
    return {
      chambers: [fallback.slice(0, 4), fallback.slice(4, 9), fallback.slice(9, 14)],
      spareKo: fallback.slice(14).map((w) => w.ko),
      seed,
    };
  }
  return { chambers, spareKo: source.slice(i).map((w) => w.ko), seed };
}

interface LogEntry { en: string; ko: string; salt: number; rubbed: boolean }

export function GlyphTongueGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();
  const [runSeed, setRunSeed] = useState(0);
  // runSeed 는 난수 씨앗이 아니라 memo 무효화 토큰이다 — 재시작마다 새 판을 뽑는다.
  const run = useMemo(() => buildRun(wordPool, runSeed), [wordPool, runSeed]);
  const { chambers, spareKo } = run;
  const totalRunes = useMemo(() => chambers.reduce((n, c) => n + c.length, 0), [chambers]);

  const [chamberIdx, setChamberIdx] = useState(0);
  const words = chambers[Math.min(chamberIdx, chambers.length - 1)];

  const [assign, setAssign] = useState<Record<string, string>>({});
  const [held, setHeld] = useState<string | null>(null);
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [rubbed, setRubbed] = useState<Set<string>>(new Set());
  const [misread, setMisread] = useState<string[]>([]);
  const [focusEn, setFocusEn] = useState<string | null>(null);
  const [sealMsg, setSealMsg] = useState('');
  const [sealTone, setSealTone] = useState<'ok' | 'warn' | 'info'>('info');
  const [phase, setPhase] = useState<'decode' | 'recall' | 'done'>('decode');
  const [outcome, setOutcome] = useState<'clear' | 'timeout'>('clear');
  const [score, setScore] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [burst, setBurst] = useState(0);
  const [gain, setGain] = useState<{ id: number; v: number } | null>(null);

  // 최종 봉인
  const [recallWords, setRecallWords] = useState<LogEntry[]>([]);
  const [recallBank, setRecallBank] = useState<string[]>([]);
  const [recallAssign, setRecallAssign] = useState<Record<string, string>>({});
  const [recallHeld, setRecallHeld] = useState<string | null>(null);
  const [recallResult, setRecallResult] = useState<Record<string, boolean> | null>(null);

  const lapsedRef = useRef<Set<string>>(new Set()); // onWrong 은 룬당 한 번만 — 난사가 FSRS 를 오염시키지 않게
  const timersRef = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);
  useEffect(() => () => { timersRef.current.forEach((t) => window.clearTimeout(t)); timersRef.current = []; }, []);

  const cleared = words.every((w) => solved.has(w.en));
  const running = (phase === 'decode' && !cleared) || phase === 'recall';

  // onEnd 는 아래에서 정의되는 함수들을 참조해야 하므로 ref 로 늦게 묶는다.
  const endRef = useRef<() => void>(() => {});
  const cd = useCountdown({
    totalMs: TOTAL_MS,
    running,
    warnAtMs: phase === 'recall' ? RECALL_WARN_MS : WARN_MS,
    onEnd: () => endRef.current(),
    onWarn: () => sfx.nearMiss(),
  });

  const combo = useCombo({
    onBreak: () => { setSealTone('warn'); },
  });

  const pb = usePersonalBest('glyph-tongue');
  const [bestInfo, setBestInfo] = useState<{ improved: boolean; prev: number | null } | null>(null);
  const bestDoneRef = useRef(false);

  // ── 석실 파생값 ───────────────────────────────────────────────────────────
  const glyphs = useMemo(() => {
    // 같은 석실에서 두 룬이 같은 형태로 그려지면 읽을 수 없다 — 충돌 시 재솔트.
    const used = new Set<string>();
    const map: Record<string, { salt: number; desc: string; name: string }> = {};
    words.forEach((w, i) => {
      let salt = 0, g = buildGlyph(w.en, 0);
      while (used.has(glyphKey(g)) && salt < 8) { salt += 1; g = buildGlyph(w.en, salt); }
      used.add(glyphKey(g));
      map[w.en] = { salt, desc: glyphDesc(g), name: RUNE_NAMES[i] ?? `${i + 1}` };
    });
    return map;
  }, [words]);

  const decoys = useMemo(() => {
    const chamberKo = words.map((w) => w.ko);
    const n = CHAMBER_DECOYS[Math.min(chamberIdx, CHAMBER_DECOYS.length - 1)];
    const candidates = Array.from(new Set([...chambers.flat().map((w) => w.ko), ...spareKo]));
    return pickDistinct(candidates, n, (ko) => chamberKo.some((c) => koClashes(c, ko)));
  }, [words, chamberIdx, chambers, spareKo]);
  const decoySet = useMemo(() => new Set(decoys), [decoys]);

  const inscriptions = useMemo(() => {
    const list: { en: string; text: string }[] = [];
    words.forEach((w) => w.ins.forEach((text) => list.push({ en: w.en, text })));
    return shuffle(list);
  }, [words]);

  // 뜻 뱅크는 카드 순서와 무관하게 셔플 — 위치 정렬로 문맥 없이 맞히는 우회를 막는다.
  // 미끼는 어떤 룬의 답도 아니므로 해독이 진행돼도 사라지지 않는다 → 마지막 룬도 공짜가 아니다.
  const meaningOrder = useMemo(() => shuffle([...words.map((w) => w.ko), ...decoys]), [words, decoys]);
  const bank = useMemo(() => {
    const bound = new Set(Object.entries(assign).filter(([en]) => !solved.has(en)).map(([, ko]) => ko));
    const lockedKo = new Set(words.filter((w) => solved.has(w.en)).map((w) => w.ko));
    return meaningOrder.filter((ko) => !bound.has(ko) && !lockedKo.has(ko));
  }, [assign, solved, words, meaningOrder]);

  const boundCount = words.filter((w) => !solved.has(w.en) && assign[w.en]).length;
  const nextBatchMult = BATCH_MULT[clamp(boundCount, 0, 5)];

  // ── 조작 ──────────────────────────────────────────────────────────────────
  // 어긋난 배치를 보여주는 700ms 동안은 입력을 잠근다. 안 잠그면 같은 오답 배치를
  // 그대로 다시 봉인해 등불이 이중으로 깎이고, 정리 타이머가 새 배치를 지워버린다.
  const locked = misread.length > 0;

  const tapMeaning = useCallback((ko: string) => {
    if (locked) return;
    sfx.click();
    setSealMsg('');
    setHeld((h) => (h === ko ? null : ko));
  }, [locked, sfx]);

  // 규칙 하나로 통일: 룬을 누르면 항상 그 룬이 선택된다(비문 하이라이트).
  // 손에 뜻이 있으면 잇고, 없는데 이미 이어둔 뜻이 있으면 다시 손에 든다(되돌리기).
  const tapRune = useCallback((en: string) => {
    if (locked || solved.has(en)) return;
    setSealMsg('');
    setFocusEn(en);
    if (held !== null) {
      setAssign((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) if (next[k] === held && !solved.has(k)) delete next[k];
        next[en] = held;
        return next;
      });
      setHeld(null);
      sfx.click();
      return;
    }
    if (assign[en]) {
      const back = assign[en];
      setAssign((prev) => { const next = { ...prev }; delete next[en]; return next; });
      setHeld(back);
      sfx.click();
    }
  }, [locked, held, assign, solved, sfx]);

  const canRub = !locked && focusEn !== null && !solved.has(focusEn) && !rubbed.has(focusEn) && cd.remainMs > RUB_FLOOR_MS && phase === 'decode' && !cleared;
  const rub = useCallback(() => {
    if (!focusEn || !canRub) return;
    cd.drain(RUB_MS);
    setRubbed((prev) => new Set(prev).add(focusEn));
    setSealTone('info');
    setSealMsg('탁본을 떴다 — 이 룬은 점수와 연쇄에서 빠져요.');
    sfx.coin();
  }, [focusEn, canRub, cd, sfx]);

  // ── 봉인 ──────────────────────────────────────────────────────────────────
  const advance = useCallback(() => {
    if (chamberIdx + 1 < chambers.length) {
      setChamberIdx((i) => i + 1);
      setAssign({}); setHeld(null); setSolved(new Set()); setRubbed(new Set());
      setFocusEn(null); setSealMsg(''); setMisread([]);
      sfx.click();
      return;
    }
    // 최종 봉인 — 스스로 읽어낸 룬만(탁본은 제외) 다시 인출한다.
    const own = log.filter((e) => !e.rubbed);
    if (own.length < 3) { setOutcome('clear'); setPhase('done'); sfx.fanfare(); return; }
    const picked = shuffle(own).slice(0, 6);
    const pickedKo = picked.map((e) => e.ko);
    const spare = Array.from(new Set([...chambers.flat().map((w) => w.ko), ...spareKo]));
    const extra = pickDistinct(spare, 2, (ko) => pickedKo.some((c) => koClashes(c, ko)));
    setRecallWords(picked);
    setRecallBank(shuffle([...pickedKo, ...extra]));
    setRecallAssign({}); setRecallHeld(null); setRecallResult(null);
    setSealTone('info');
    setSealMsg('');
    setPhase('recall');
    cd.reset(RECALL_MS);
    sfx.coin();
  }, [chamberIdx, chambers, log, spareKo, sfx, cd]);

  const seal = useCallback(() => {
    if (cleared) { advance(); return; }
    if (locked) return;
    const bound = words.filter((w) => !solved.has(w.en) && assign[w.en]);
    if (bound.length === 0) return;

    const multAtSeal = combo.mult;
    const chMult = CHAMBER_MULT[Math.min(chamberIdx, CHAMBER_MULT.length - 1)];
    const batch = BATCH_MULT[clamp(bound.length, 0, 5)];
    const wrongEns: string[] = [];
    let usedDecoy = false, ok = 0, scored = 0, gained = 0;

    bound.forEach((w) => {
      if (assign[w.en] === w.ko) ok += 1;
      else { wrongEns.push(w.en); if (decoySet.has(assign[w.en])) usedDecoy = true; }
    });
    const allRight = wrongEns.length === 0;

    const nextSolved = new Set(solved);
    const newLog: LogEntry[] = [];
    bound.forEach((w) => {
      if (assign[w.en] !== w.ko) return;
      nextSolved.add(w.en);
      const wasRubbed = rubbed.has(w.en);
      newLog.push({ en: w.en, ko: w.ko, salt: glyphs[w.en]?.salt ?? 0, rubbed: wasRubbed });
      if (wasRubbed) return; // 탁본으로 산 정답 — 점수·연쇄·FSRS 전부 없음
      scored += 1;
      gained += Math.round(BASE_SCORE * chMult * multAtSeal * (allRight ? batch : 1));
      onCorrect?.({ en: w.en, ko: w.ko });
    });
    wrongEns.forEach((en) => {
      const w = words.find((x) => x.en === en);
      if (!w || lapsedRef.current.has(en)) return;
      lapsedRef.current.add(en);
      onWrong?.({ en: w.en, ko: w.ko });
    });

    for (let i = 0; i < scored; i++) combo.hit();
    if (wrongEns.length > 0) combo.miss();

    if (gained > 0) {
      setScore((s) => s + gained);
      const id = Date.now();
      setGain({ id, v: gained });
      later(() => setGain((g) => (g && g.id === id ? null : g)), 1000);
    }
    if (ok > 0) cd.extend(ok * GAIN_MS);
    if (wrongEns.length > 0) cd.drain(wrongEns.length * LOSS_MS);

    setSolved(nextSolved);
    setLog((prev) => [...prev, ...newLog]);
    setAssign((prev) => {
      const next = { ...prev };
      nextSolved.forEach((en) => { delete next[en]; });
      return next;
    });
    setFocusEn(null);

    if (wrongEns.length > 0) {
      // 비우기 전에 무엇이 어긋났는지 보여준다 — 오답 순간을 정보로 되돌려주는 자리.
      setMisread(wrongEns);
      later(() => {
        setMisread([]);
        setAssign((prev) => { const next = { ...prev }; wrongEns.forEach((en) => { delete next[en]; }); return next; });
      }, MISREAD_MS);
    }

    const done = words.every((w) => nextSolved.has(w.en));
    if (allRight) {
      sfx.correct(ok, ok >= 3);
      if (bound.length >= 3) { const id = Date.now(); setBurst(id); later(() => setBurst((b) => (b === id ? 0 : b)), 800); }
    } else if (ok > 0) sfx.nearMiss();
    else sfx.wrong();

    if (done) {
      cd.extend(CLEAR_MS);
      setSealTone('ok');
      setSealMsg(`석실이 열렸다 · 비문을 읽어보세요 · 등불 +${CLEAR_MS / 1000}초`);
      return;
    }
    setSealTone(allRight ? 'ok' : 'warn');
    const parts: string[] = [];
    if (ok > 0) parts.push(`${ok}개가 문맥과 맞았어요`);
    if (wrongEns.length > 0) parts.push(`${wrongEns.length}개는 아직 어긋나요 · 등불 −${(wrongEns.length * LOSS_MS) / 1000}초`);
    if (usedDecoy) parts.push('그중 하나는 이 석실의 뜻이 아니에요');
    setSealMsg(parts.join(' · '));
  }, [cleared, advance, locked, words, solved, assign, combo, chamberIdx, decoySet, rubbed, glyphs, onCorrect, onWrong, cd, sfx, later]);

  // ── 최종 봉인 ─────────────────────────────────────────────────────────────
  const gradeRecall = useCallback(() => {
    const result: Record<string, boolean> = {};
    let right = 0;
    recallWords.forEach((e) => {
      const hit = recallAssign[e.en] === e.ko;
      result[e.en] = hit;
      if (hit) right += 1;
    });
    // FSRS 는 여기서 건드리지 않는다 — 같은 단어를 한 세션에 두 번 적재하지 않기 위해.
    // 이 라운드의 역할은 기록이 아니라 인출 강화와 클라이맥스다.
    const perfect = right === recallWords.length && recallWords.length > 0;
    setScore((s) => s + right * RECALL_SCORE + (perfect ? RECALL_PERFECT_BONUS : 0));
    setRecallResult(result);
    setOutcome('clear');
    setPhase('done');
    if (perfect) sfx.fanfare(); else if (right > 0) sfx.correct(right, false); else sfx.wrong();
  }, [recallWords, recallAssign, sfx]);

  endRef.current = () => {
    if (phase === 'recall') { gradeRecall(); return; }
    setOutcome('timeout');
    setPhase('done');
    sfx.wrong();
  };

  const tapRecallMeaning = useCallback((ko: string) => {
    sfx.click();
    setRecallHeld((h) => (h === ko ? null : ko));
  }, [sfx]);
  const tapRecallCard = useCallback((en: string) => {
    if (recallHeld !== null) {
      setRecallAssign((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) if (next[k] === recallHeld) delete next[k];
        next[en] = recallHeld;
        return next;
      });
      setRecallHeld(null);
      sfx.click();
      return;
    }
    if (recallAssign[en]) {
      const back = recallAssign[en];
      setRecallAssign((prev) => { const next = { ...prev }; delete next[en]; return next; });
      setRecallHeld(back);
      sfx.click();
    }
  }, [recallHeld, recallAssign, sfx]);
  const recallBankLeft = useMemo(() => {
    const used = new Set(Object.values(recallAssign));
    return recallBank.filter((ko) => !used.has(ko));
  }, [recallBank, recallAssign]);
  const recallAllBound = recallWords.length > 0 && recallWords.every((e) => recallAssign[e.en]);

  // ── 개인 기록 ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'done' || bestDoneRef.current) return;
    bestDoneRef.current = true;
    setBestInfo(pb.submit(score));
  }, [phase, score, pb]);

  const handleExit = useCallback(() => onExit?.(), [onExit]);
  const restart = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    lapsedRef.current = new Set();
    bestDoneRef.current = false;
    setBestInfo(null);
    setRunSeed((s) => s + 1);
    setChamberIdx(0);
    setAssign({}); setHeld(null); setSolved(new Set()); setRubbed(new Set());
    setMisread([]); setFocusEn(null); setSealMsg(''); setSealTone('info');
    setScore(0); setLog([]); setBurst(0); setGain(null);
    setRecallWords([]); setRecallBank([]); setRecallAssign({}); setRecallHeld(null); setRecallResult(null);
    setOutcome('clear');
    combo.reset();
    setPhase('decode');
    cd.reset(TOTAL_MS);
  }, [combo, cd]);

  // 비문 렌더: 해독된 룬은 영어 단어로, 아니면 룬으로.
  const renderInscription = useCallback((en: string, text: string) => {
    const parts = text.split('{}');
    const isSolved = solved.has(en);
    const focused = focusEn === en;
    const meta = glyphs[en];
    return parts.map((seg, i) => (
      <span key={i}>
        {seg}
        {i < parts.length - 1 && (
          isSolved
            ? <b className="gt-word">{en}</b>
            : (
              <span
                className={`gt-rune-slot ${focused ? 'gt-rune-slot--focus' : ''}`}
                role="img"
                aria-label={`룬 ${meta?.name ?? ''}`}
              >
                <Rune word={en} salt={meta?.salt ?? 0} className="gt-rune-inline" />
              </span>
            )
        )}
      </span>
    ));
  }, [solved, focusEn, glyphs]);

  const shownScore = useCountUp(score);
  const solvedTotal = log.length;

  // ── 결과 ──────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const missedNow = words.filter((w) => !solved.has(w.en));
    const recallMissed = recallResult ? recallWords.filter((e) => !recallResult[e.en]) : [];
    const recallRight = recallResult ? recallWords.length - recallMissed.length : 0;
    const perfectRecall = recallResult !== null && recallWords.length > 0 && recallMissed.length === 0;
    const win = outcome === 'clear';

    const reveal = (missedNow.length > 0 || recallMissed.length > 0) ? (
      <div className="gt-reveal">
        {missedNow.length > 0 && (
          <>
            <p className="gt-reveal-h">못 읽고 남은 룬</p>
            <ul className="gt-reveal-list">
              {missedNow.map((w) => (
                <li key={w.en}><b>{w.en}</b><span>{w.ko}</span></li>
              ))}
            </ul>
          </>
        )}
        {recallMissed.length > 0 && (
          <>
            <p className="gt-reveal-h">최종 봉인에서 놓친 룬</p>
            <ul className="gt-reveal-list">
              {recallMissed.map((e) => (
                <li key={e.en}><b>{e.en}</b><span>{e.ko}</span></li>
              ))}
            </ul>
          </>
        )}
      </div>
    ) : undefined;

    const glossary = log.length > 0 ? (
      <div className="gt-glossary">
        <p className="gt-glossary-h">이번 판에 읽어낸 말</p>
        <div className="gt-glossary-row">
          {log.map((e) => (
            <span key={e.en} className={`gt-gloss ${e.rubbed ? 'gt-gloss--rub' : ''}`}>
              <b>{e.en}</b> {e.ko}{e.rubbed && <span className="gt-gloss-tag">탁본</span>}
            </span>
          ))}
        </div>
      </div>
    ) : undefined;

    const badge = perfectRecall
      ? <><FeedbackIcon kind="correct" /> 완전 봉인 · 최종 {recallRight}/{recallWords.length}</>
      : combo.best >= 6
        ? <><FeedbackIcon kind="correct" /> 최장 연쇄 {combo.best}</>
        : undefined;

    const hint = outcome === 'timeout'
      ? `${solvedTotal}개 룬에서 등불이 꺼졌어요 · 확신하는 룬을 묶어 봉인하면 등불이 더 오래 갑니다.`
      : bestInfo?.improved
        ? '다음 판은 탁본 없이 한 석실 더 노려보세요.'
        : pb.best !== null && score < pb.best
          ? `개인 최고까지 ${(pb.best - score).toLocaleString()}점.`
          : '한 번에 더 많은 룬을 묶어 봉인할수록 배수가 커져요.';

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
          lead={win ? '사라진 언어를 되살렸다' : '등불이 꺼졌다 — 여기까지 읽었어요'}
          celebrate={win && perfectRecall}
          badge={badge}
          reveal={reveal}
          stats={[
            { num: score.toLocaleString(), label: '점수', accent: true },
            { num: `${solvedTotal}/${totalRunes}`, label: '읽어낸 룬' },
            { num: combo.best, label: '최장 연쇄' },
          ]}
          best={bestInfo ? { prev: bestInfo.prev, now: score, label: '점수', improved: bestInfo.improved } : undefined}
          restartLabel="새 석실로"
          restartHint={hint}
          footer={glossary}
          onRestart={restart}
          onExit={handleExit}
        />
      </div>
    );
  }

  // ── 최종 봉인 ─────────────────────────────────────────────────────────────
  if (phase === 'recall') {
    return (
      <div className="gk-root gt-root">
        <GameMusic gameId="glyph-tongue" />
        <div className="gk-sr" aria-live="polite">{sealMsg}</div>
        <GameKitStyles />
        <AmbientBackground center="#F3EEE1" mid="#D8CFBE" edge="#3E4A63" glow="rgba(215,180,120,.34)" glowAt="50% 22%" watermark="glyph-tongue" />
        <style dangerouslySetInnerHTML={{ __html: GT_CSS }} />
        <Hud
          score={shownScore}
          progress={1}
          combo={combo.combo}
          comboMult={combo.mult}
          muted={sfx.muted}
          onToggleMute={() => sfx.setMuted((m) => !m)}
          onExit={handleExit}
          extra={
            <div className="gt-hudx">
              <div className="gt-chapter"><span className="gk-stat-label">석실</span><span className="gt-chapter-v">최종</span></div>
              <div className="gt-lamp"><TimerBar frac={cd.frac} warning={cd.warning} seconds={cd.remainSec} label="등불" /></div>
            </div>
          }
        />
        <main className="gk-stage gt-stage">
          <p className="gt-help gt-help--final">최종 봉인 — 오늘 읽어낸 말들을 <b>기억으로</b> 다시 이어라. 뜻 하나는 여기 것이 아니다.</p>
          <div className="gt-codex-wrap">
            <div className="gt-codex gt-codex--recall" role="group" aria-label="최종 봉인 석판">
              {recallWords.map((e) => {
                const guess = recallAssign[e.en];
                return (
                  <button
                    key={e.en}
                    type="button"
                    className={`gt-card ${guess ? 'gt-card--bound' : ''} ${recallHeld ? 'gt-card--target' : ''}`}
                    onClick={() => tapRecallCard(e.en)}
                    aria-label={guess ? `${e.en} · 가설 ${guess}` : `${e.en} · 뜻 미지정`}
                  >
                    <span className="gt-card-glyph">
                      <Rune word={e.en} salt={e.salt} className="gt-rune-card gt-rune-card--faint" />
                    </span>
                    <span className="gt-card-en">{e.en}</span>
                    <span className={`gt-slot ${guess ? 'gt-slot--filled' : ''}`}>{guess || '뜻?'}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="gt-bank" role="group" aria-label="뜻 후보">
            {recallBankLeft.map((ko) => (
              <button
                key={ko}
                type="button"
                className={`gt-chip ${recallHeld === ko ? 'gt-chip--held' : ''}`}
                onClick={() => tapRecallMeaning(ko)}
                aria-pressed={recallHeld === ko}
              >
                {ko}
              </button>
            ))}
            {recallBankLeft.length === 0 && <span className="gt-bank-empty">모두 배치했어요 — 봉인하세요</span>}
          </div>
          <div className="gt-actions">
            <span className="gt-sealmsg gt-sealmsg--info">전부 맞히면 +{RECALL_PERFECT_BONUS}점 · 룬 하나당 {RECALL_SCORE}점</span>
            <button type="button" className="gk-btn gk-btn--primary gt-seal" onClick={gradeRecall} disabled={!recallAllBound}>
              최종 봉인
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── 해독 ──────────────────────────────────────────────────────────────────
  const focusMeta = focusEn ? glyphs[focusEn] : null;
  const rubOf = (en: string) => {
    const n = en.length;
    if (n <= 2) return en.split('').join(' ');
    return [en[0], ...Array.from({ length: n - 2 }, () => '·'), en[n - 1]].join(' ');
  };

  return (
    <div className="gk-root gt-root" data-streak={combo.combo >= 10 ? '2' : combo.combo >= 6 ? '1' : '0'}>
      <GameMusic gameId="glyph-tongue" />
      <div className="gk-sr" aria-live="polite">{sealMsg}</div>
      <GameKitStyles />
      <AmbientBackground
        center="#F3EEE1"
        mid="#D8CFBE"
        edge="#3E4A63"
        glow={combo.combo >= 6 ? 'rgba(255,205,140,.34)' : 'rgba(150,190,215,.30)'}
        glowAt="50% 22%"
        watermark="glyph-tongue"
      />
      <style dangerouslySetInnerHTML={{ __html: GT_CSS }} />
      <Hud
        score={shownScore}
        progress={totalRunes ? solvedTotal / totalRunes : 0}
        combo={combo.combo}
        comboMult={combo.mult}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={
          <div className="gt-hudx">
            <div className="gt-chapter">
              <span className="gk-stat-label">석실</span>
              <span className="gt-chapter-v">{chamberIdx + 1}/{chambers.length}</span>
            </div>
            <div className="gt-lamp"><TimerBar frac={cd.frac} warning={cd.warning} seconds={cd.remainSec} label="등불" /></div>
          </div>
        }
      />

      <main className="gk-stage gt-stage">
        <p className="gt-help">
          뜻은 주어지지 않는다. 비문 속 <b>쓰임</b>으로 룬의 뜻을 추론해 잇고 <b>봉인</b>하라.
          <span className="gt-help-sub">
            <span className="gt-chapter-m">석실 {chamberIdx + 1}/{chambers.length} · </span>
            한 번에 묶어 봉인할수록 배수 ↑ · 어긋나면 등불 −{LOSS_MS / 1000}초 · 뱅크에는 이 석실의 것이 아닌 뜻도 섞여 있다
          </span>
        </p>

        {/* 비문 벽 */}
        <div className="gt-tablets">
          {inscriptions.map((ins, i) => (
            <p key={`${ins.en}-${i}`} className={`gt-tablet ${focusEn === ins.en ? 'gt-tablet--focus' : ''} ${solved.has(ins.en) ? 'gt-tablet--read' : ''}`}>
              {renderInscription(ins.en, ins.text)}
            </p>
          ))}
        </div>

        {/* 코덱스 */}
        <div className="gt-codex-wrap">
          {burst > 0 && (
            <span className="gt-burst-at" aria-hidden="true">
              <ParticleBurst intensity={2} colors={BURST_COLORS} />
            </span>
          )}
          <div className="gt-codex" role="group" aria-label="코덱스">
            {words.map((w) => {
              const isSolved = solved.has(w.en);
              const guess = assign[w.en];
              const bad = misread.includes(w.en);
              const meta = glyphs[w.en];
              const isRubbed = rubbed.has(w.en);
              return (
                <button
                  key={w.en}
                  type="button"
                  className={[
                    'gt-card',
                    isSolved ? 'gt-card--solved' : '',
                    focusEn === w.en ? 'gt-card--focus' : '',
                    held && !isSolved ? 'gt-card--target' : '',
                    guess && !isSolved && !bad ? 'gt-card--bound' : '',
                    bad ? 'gt-card--misread' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => tapRune(w.en)}
                  disabled={isSolved || locked}
                  aria-label={
                    isSolved
                      ? `해독됨 · ${w.en} · ${w.ko}`
                      : `룬 ${meta?.name ?? ''} (${meta?.desc ?? ''})${guess ? ` · 가설 ${guess}` : ' · 뜻 미지정'}`
                  }
                >
                  <span className="gt-card-glyph">
                    {isSolved ? <b className="gt-card-word">{w.en}</b> : <Rune word={w.en} salt={meta?.salt ?? 0} className="gt-rune-card" />}
                  </span>
                  {!isSolved && <span className="gt-card-name" aria-hidden="true">룬 {meta?.name}</span>}
                  {!isSolved && isRubbed && <span className="gt-rub-out" aria-hidden="true">{rubOf(w.en)}</span>}
                  <span className={`gt-slot ${guess ? 'gt-slot--filled' : ''} ${isSolved ? 'gt-slot--locked' : ''} ${bad ? 'gt-slot--misread' : ''}`}>
                    {isSolved && <FeedbackIcon kind="correct" size={12} />}
                    {bad && <FeedbackIcon kind="wrong" size={12} />}
                    <span className="gt-slot-t">{isSolved ? w.ko : guess || '뜻?'}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 뜻 뱅크 */}
        {!cleared && (
          <div className="gt-bank" role="group" aria-label="뜻 후보">
            {bank.map((ko) => (
              <button
                key={ko}
                type="button"
                className={`gt-chip ${held === ko ? 'gt-chip--held' : ''}`}
                onClick={() => tapMeaning(ko)}
                disabled={locked}
                aria-pressed={held === ko}
              >
                {ko}
              </button>
            ))}
            {bank.length === 0 && <span className="gt-bank-empty">모든 뜻을 배치했어요 — 봉인하세요</span>}
          </div>
        )}

        <div className="gt-actions">
          {gain && <span key={gain.id} className="gt-gain" aria-hidden="true">+{gain.v.toLocaleString()}</span>}
          {sealMsg && (
            <span className={`gt-sealmsg gt-sealmsg--${sealTone}`}>
              {sealTone === 'ok' && <FeedbackIcon kind="correct" size={13} />}
              {sealTone === 'warn' && <FeedbackIcon kind="near" size={13} />}
              {sealMsg}
            </span>
          )}
          <div className="gt-actions-row">
            {!cleared && (
              <button
                type="button"
                className="gk-btn gt-rub"
                onClick={rub}
                disabled={!canRub}
                aria-label={focusEn ? `룬 ${focusMeta?.name ?? ''} 탁본 · 등불 ${RUB_MS / 1000}초 소모` : '탁본 · 먼저 룬을 고르세요'}
              >
                탁본 −{RUB_MS / 1000}초
              </button>
            )}
            <button type="button" className="gk-btn gk-btn--primary gt-seal" onClick={seal} disabled={!cleared && (locked || boundCount === 0)}>
              {cleared
                ? (chamberIdx + 1 < chambers.length ? '다음 석실 →' : '최종 봉인 →')
                : boundCount > 1 ? `${boundCount}개 묶어 봉인 ×${nextBatchMult}` : '봉인'}
            </button>
          </div>
          {!cleared && (
            <span className="gt-tip">
              {boundCount === 0
                ? focusEn
                  ? `룬 ${focusMeta?.name} 을(를) 보는 중 — 뜻을 고르면 이어집니다`
                  : '뜻을 고르고 룬에 이으세요'
                : boundCount === 1
                  ? '한 개만 봉인하면 안전하지만 배수는 없어요'
                  : `전부 맞으면 ×${nextBatchMult} · 하나라도 어긋나면 배수는 사라져요`}
            </span>
          )}
        </div>
      </main>
    </div>
  );
}

const GT_CSS = `
  .gt-hudx { display: flex; align-items: center; gap: 12px; }
  .gt-chapter { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.05; }
  .gt-chapter-v { font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 800; color: var(--t1); }
  .gt-lamp { display: flex; align-items: center; min-width: 108px; }
  /* 390px HUD 는 6칸(점수·진행·석실·등불·콤보·버튼2)이라 그대로 두면 '나가기'가 잘린다.
     석실 표시는 본문 안내줄로 옮기고 등불 게이지만 남긴다. */
  .gt-chapter-m { display: none; }
  @media (max-width: 520px) {
    .gt-hudx { gap: 8px; }
    .gt-hudx .gt-chapter { display: none; }
    .gt-lamp { min-width: 64px; }
    .gt-chapter-m { display: inline; }
  }
  @media (max-width: 420px) { .gt-lamp { min-width: 52px; } }

  .gt-stage { gap: clamp(10px, 2vh, 18px); justify-content: flex-start; padding-top: clamp(8px, 1.6vh, 18px); overflow-y: auto; }
  .gt-help { margin: 0; font-size: 12.5px; color: var(--t2); text-align: center; max-width: 62ch; display: flex; flex-direction: column; gap: 3px; }
  .gt-help b { color: var(--t1); }
  .gt-help-sub { font-size: 11.5px; color: var(--t3); }
  .gt-help--final { font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 14px; color: var(--t1); }

  .gt-tablets { display: flex; flex-direction: column; gap: 6px; width: min(680px, 94vw); }
  .gt-tablet { margin: 0; padding: 8px 15px; border-radius: 8px; background: color-mix(in srgb, var(--bg) 64%, transparent); border: 1px solid var(--bd); border-left: 3px solid color-mix(in srgb, var(--t1) 14%, transparent);
    font-family: var(--font-body, Georgia, serif); font-size: clamp(13.5px, 2.1vw, 16.5px); line-height: 1.5; color: var(--t1); backdrop-filter: blur(3px); transition: border-color .2s, background .2s, opacity .2s; }
  /* 석실 3 은 비문이 10줄이다 — 390px 에서 시계가 도는 동안 스크롤하게 두지 않도록 압축. */
  @media (max-width: 520px) { .gt-tablets { gap: 5px; } .gt-tablet { padding: 6px 11px; line-height: 1.42; } }
  .gt-tablet--focus { border-left-color: var(--combo); background: color-mix(in srgb, var(--combo) 8%, var(--bg)); }
  .gt-tablet--read { border-left-color: color-mix(in srgb, var(--success) 60%, transparent); }
  .gt-root[data-streak="1"] .gt-tablet, .gt-root[data-streak="2"] .gt-tablet { border-left-color: color-mix(in srgb, var(--streak) 55%, transparent); }
  .gt-root[data-streak="2"] .gt-tablet { background: color-mix(in srgb, var(--streak) 6%, var(--bg)); }

  .gt-rune-slot { display: inline-flex; align-items: center; justify-content: center; vertical-align: -0.32em; width: 1.5em; height: 1.5em; margin: 0 2px; color: var(--t1); border-radius: 5px; transition: color .2s, background .2s; }
  .gt-rune-slot--focus { color: var(--combo); background: color-mix(in srgb, var(--combo) 16%, transparent); }
  .gt-rune-inline { width: 1em; height: 1.4em; }
  .gt-word { color: var(--success); font-family: var(--font-english, system-ui); font-weight: 800; font-style: normal; animation: gt-decipher .5s ease-out; }
  @keyframes gt-decipher { 0% { opacity: 0; transform: scale(.6); letter-spacing: .3em; } 100% { opacity: 1; transform: scale(1); letter-spacing: 0; } }

  .gt-codex-wrap { position: relative; width: min(680px, 94vw); }
  .gt-burst-at { position: absolute; left: 50%; top: 40%; width: 0; height: 0; pointer-events: none; }
  .gt-codex { display: grid; grid-template-columns: repeat(5, 1fr); gap: 9px; }
  .gt-codex--recall { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 620px) { .gt-codex, .gt-codex--recall { grid-template-columns: repeat(3, 1fr); gap: 7px; } }

  .gt-card { display: flex; flex-direction: column; align-items: center; gap: 5px; min-height: 96px; padding: 9px 6px; border-radius: 12px; border: 1.5px solid var(--bd); background: color-mix(in srgb, var(--bg) 72%, transparent); cursor: pointer; transition: transform .12s var(--ease-spring), border-color .18s, box-shadow .18s, background .18s; }
  .gt-card:hover:not(:disabled) { transform: translateY(-2px); border-color: var(--combo); }
  .gt-card:active:not(:disabled) { transform: translateY(0) scale(.96); }
  .gt-card:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 28%, transparent); }
  .gt-card:disabled { cursor: default; }
  /* 오독 표시 중 잠금 — 해독된 카드와 방금 어긋난 카드는 흐려지면 안 된다(둘 다 읽을 것이 있다). */
  .gt-card:disabled:not(.gt-card--solved):not(.gt-card--misread) { opacity: .5; }
  .gt-card--target { border-color: color-mix(in srgb, var(--combo) 55%, var(--bd)); border-style: dashed; }
  .gt-card--bound { border-color: color-mix(in srgb, var(--combo) 45%, var(--bd)); }
  .gt-card--focus { border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 22%, transparent); }
  .gt-card--solved { border-color: var(--success); background: color-mix(in srgb, var(--success) 10%, var(--bg)); }
  .gt-card--misread { border-color: var(--warning); animation: gt-shake .34s ease-in-out 2; }
  .gt-card-glyph { height: 42px; display: grid; place-items: center; color: var(--t1); }
  .gt-rune-card { width: 28px; height: 40px; }
  .gt-rune-card--faint { opacity: .42; }
  .gt-card-name { font-size: 9.5px; font-weight: 800; letter-spacing: .06em; color: var(--t3); }
  .gt-card-en { font-family: var(--font-english, system-ui); font-size: clamp(11px, 2.1vw, 14px); font-weight: 800; color: var(--t1); word-break: break-all; line-height: 1.15; text-align: center; }
  .gt-card-word { color: var(--success); font-family: var(--font-english, system-ui); font-weight: 800; font-size: clamp(11px, 2.1vw, 14px); word-break: break-all; line-height: 1.1; text-align: center; animation: gt-decipher .5s ease-out; }
  .gt-rub-out { font-family: var(--font-english, monospace); font-size: 10.5px; font-weight: 700; letter-spacing: .04em; color: var(--warning); }

  .gt-slot { display: flex; align-items: center; justify-content: center; gap: 3px; width: 100%; min-height: 30px; padding: 4px; border-radius: 6px; font-size: 11px; font-weight: 700; line-height: 1.2; text-align: center; word-break: keep-all;
    color: var(--t3); background: color-mix(in srgb, var(--t1) 5%, transparent); border: 1px dashed var(--bd); transition: color .18s, border-color .18s, background .18s; }
  .gt-slot-t { min-width: 0; }
  .gt-slot--filled { color: var(--combo); border-style: solid; border-color: color-mix(in srgb, var(--combo) 40%, var(--bd)); background: color-mix(in srgb, var(--combo) 8%, transparent); }
  .gt-slot--locked { color: var(--success); border-style: solid; border-color: color-mix(in srgb, var(--success) 40%, var(--bd)); background: color-mix(in srgb, var(--success) 10%, transparent); }
  .gt-slot--misread { color: var(--warning); border-style: solid; border-color: var(--warning); background: color-mix(in srgb, var(--warning) 10%, transparent); }

  .gt-bank { display: flex; flex-wrap: wrap; gap: 7px; justify-content: center; width: min(680px, 94vw); min-height: 44px; }
  .gt-chip { display: inline-flex; align-items: center; min-height: 44px; padding: 9px 15px; border-radius: 999px; border: 1.5px solid var(--bd); background: var(--bg); color: var(--t1); font-size: 13px; font-weight: 700; cursor: pointer; transition: transform .12s var(--ease-spring), border-color .15s, background .15s, box-shadow .15s; }
  .gt-chip:hover:not(:disabled) { border-color: var(--combo); transform: translateY(-2px); }
  .gt-chip:active:not(:disabled) { transform: translateY(0) scale(.96); }
  .gt-chip:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 28%, transparent); }
  .gt-chip:disabled { opacity: .45; cursor: default; }
  .gt-chip--held { background: var(--combo); border-color: var(--combo); color: var(--ti); box-shadow: 0 4px 14px color-mix(in srgb, var(--combo) 30%, transparent); transform: translateY(-2px); }
  .gt-bank-empty { font-size: 12px; color: var(--t3); align-self: center; }

  .gt-actions { position: relative; display: flex; flex-direction: column; align-items: center; gap: 7px; padding-bottom: 10px; }
  .gt-actions-row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .gt-sealmsg { display: inline-flex; align-items: center; gap: 6px; max-width: 60ch; text-align: center; font-size: 12.5px; font-weight: 700; font-family: var(--font-body, Georgia, serif); font-style: italic; color: var(--t2); }
  .gt-sealmsg--ok { color: var(--success); }
  .gt-sealmsg--warn { color: var(--warning); }
  .gt-sealmsg--info { color: var(--t3); }
  .gt-seal { min-width: 172px; }
  .gt-rub { min-width: 120px; }
  .gt-tip { font-size: 11.5px; color: var(--t3); text-align: center; max-width: 46ch; }
  .gt-gain { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); font-size: 17px; font-weight: 800; color: var(--streak, var(--combo)); font-variant-numeric: tabular-nums; pointer-events: none; animation: gk-gain .95s ease-out forwards; }

  .gt-reveal { text-align: left; }
  .gt-reveal-h { margin: 0 0 6px; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--t3); }
  .gt-reveal-list { list-style: none; margin: 0 0 10px; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .gt-reveal-list li { display: flex; gap: 10px; align-items: baseline; font-size: 13.5px; }
  .gt-reveal-list b { font-family: var(--font-english, system-ui); color: var(--t1); min-width: 8.5ch; }
  .gt-reveal-list span { color: var(--t2); }

  .gt-glossary { display: flex; flex-direction: column; align-items: center; gap: 7px; }
  .gt-glossary-h { margin: 0; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--t3); }
  .gt-glossary-row { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
  .gt-gloss { display: inline-flex; align-items: baseline; gap: 5px; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 70%, transparent); font-size: 12px; color: var(--t2); }
  .gt-gloss b { font-family: var(--font-english, system-ui); font-weight: 800; color: var(--t1); }
  .gt-gloss--rub { border-style: dashed; }
  .gt-gloss-tag { font-size: 10px; font-weight: 800; color: var(--t4, var(--t3)); }

  @keyframes gt-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }

  @media (prefers-reduced-motion: reduce) {
    .gt-word, .gt-card-word { animation: none; }
    .gt-card--misread { animation: none; opacity: .62; }
    .gt-card, .gt-chip { transition: border-color .18s, background .18s; }
    .gt-card:hover:not(:disabled), .gt-chip:hover, .gt-chip--held { transform: none; }
    .gt-gain { animation: none; opacity: 1; }
  }
`;
