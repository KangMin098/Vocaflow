// apps/web/src/components/game/lexicon-detective/LexiconDetectiveGame.tsx
// Lexicon Detective — 압수된 수첩(영문) ↔ 사건 조서(국문) 대조 추리.
//
// v07.9 재설계에서 인출 누수(칩에 en+ko 동시 인쇄)·하드코딩 대본은 제거됐다.
// v07.10 은 적대적 반증이 실제로 코드에서 찾아낸 "싸게 이기는 절차" 5건을 막는다.
//
//   1) [치명] 위증 개수가 상수(0/1/2)라 두 판만 돌면 종반이 '세는 게임'이 됐다.
//      → 위증 수·진술 수를 매 판 추첨한다. 그리고 **봉투 총수를 사건별로 고정**해
//        화면에 보이는 두 수(봉투 N개 · 진술 M줄)로 위증 수를 역산하지 못하게 했다.
//        함정 봉투 수 traps = envelopes - (entries - falses) 는 관측 불가능한 양이다.
//   2) [높음] 봉투를 하나도 안 열고 전부 기각 → 30초 만에 미제 3연타 + Rating.Again 12건.
//      → 미제 시 오답 적재는 **봉투를 열어 영단어가 제시된 단어**로 한정한다.
//        영문을 보여준 적 없는 항목의 '인출 실패'는 존재하지 않는 사건이다.
//        동시에 미제는 점수를 회수당하므로 태우는 것이 이득이던 구조도 사라졌다.
//   3) [높음] 보존도가 콤보 배수를 안 타서 '전부 개봉'이 지배 전략이었다.
//      → 보존 보너스에 연쇄 배수를 태우고, 미개봉 봉투에 약한 단서(품사·글자 수)를
//        인쇄해 '무엇을 열지'가 정보 기반 선택이 되게 했다. 뜻은 새지 않는다.
//   4) [보통] 기각 오판이 '이 줄은 매치 줄'이라는 깨끗한 1비트를 1라이프에 팔았다.
//      → 어긋남 문구를 매치/기각 대칭으로 바꾸고(연역을 대신 해 주지 않는다),
//        전면 재구성을 사건당 1회로 제한해 무료 탐색 3회를 없앴다.
//   5) [보통] 확정 점수는 회수되지 않아 '막힌 사건은 빨리 태우고 리포트로 정답 읽기'가
//      시간당 이득이었다. → 미제 종결 시 그 사건의 확정 점수 절반을 회수한다.
//
// 판돈 구조
//   · 심증(lives)  — 어긋난 판단마다 1 감소. 0 이면 그 사건은 미제로 종결(정답 전면 공개).
//   · 보존도       — 봉투를 열 때마다 1 감소. 종결 시 남은 만큼 ×연쇄배수 점수.
//   · 연쇄(combo)  — 확정이 이어질수록 배수 상승. 어긋나면 배수가 통째로 날아간다.
//   · 전면 재구성  — 남은 진술을 한 번에 판정. 사건당 1회. 전부 맞으면 2배,
//                    하나라도 틀리면 **어디가 틀렸는지 알려주지 않는다**.
//   · 위증(기각)   — 어느 봉투와도 맞지 않는 진술. 개수는 매 판 다르고 공개되지 않는다.

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

/** 스캐폴드 계약(v07.8) — 정답을 이미 보여준 뒤의 입력은 assisted 로 올린다. */
interface ResultOpts {
  assisted?: boolean;
}

interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word, opts?: ResultOpts) => void;
  onWrong?: (w: Word, opts?: ResultOpts) => void;
}

// ─── 사건 규격 ────────────────────────────────────────────────────────────
// 위증 수(falses)와 진술 수(entries)는 **범위**다. 매 판 균등 추첨한다.
// 봉투 총수(envelopes)만 사건별 상수 — 이래야 화면의 두 수로 위증 수가 역산되지 않는다.
//   보이는 것: 봉투 8개 · 진술 M줄
//   숨는 것 : 위증 F줄, 정답 M−F줄, 함정 8−(M−F)개
// 정답 줄은 항상 2줄 이상으로 강제한다 — '전부 위증' 배치는 영단어 지식 0으로
// 이기는 판이 되므로 원천 차단한다(반증 지적: 올인 원샷).
interface CaseSpec {
  lives: number;
  envelopes: number;
  entriesMin: number;
  entriesMax: number;
  falsesMin: number;
  falsesMax: number;
  note: string;
}
const SPECS: CaseSpec[] = [
  {
    lives: 3,
    envelopes: 8,
    entriesMin: 4,
    entriesMax: 5,
    falsesMin: 0,
    falsesMax: 1,
    note: '조서와 현장이 처음 맞대어진다. 맞물리지 않는 진술이 섞였을 수도, 없을 수도 있다.',
  },
  {
    lives: 3,
    envelopes: 8,
    entriesMin: 5,
    entriesMax: 6,
    falsesMin: 0,
    falsesMax: 2,
    note: '봉투가 다시 봉인됐다. 위증이 몇 줄인지 세어 주는 사람은 없다.',
  },
  {
    // 진술 줄 변주는 심증 3인 사건 1·2 에 몰아 두었다 — 심증 2 인 마지막 사건까지
    // 6줄이 나오면 정답률 0.5~0.7 학습자에게 최악 조합이 겹친다(시뮬 20,000런).
    //
    // falsesMin 은 반드시 0 이어야 한다. 1 로 두면 진술 5줄 중 4줄을 매치로 확정한
    // 순간 falses ≤ 1 과 falsesMin = 1 이 만나 **마지막 한 줄이 공짜 기각으로 확정**된다
    // (시뮬 400,000판 실측: 그 관측 조합에서 성공률 100.0%). 하한을 0 으로 내리면 50.1%.
    lives: 2,
    envelopes: 8,
    entriesMin: 5,
    entriesMax: 5,
    falsesMin: 0,
    falsesMax: 3,
    note: '심증은 둘뿐이다. 위증이 몇 줄인지는 이번에도 조서 어디에도 없다.',
  },
];

const PT_MATCH = 100;
const PT_REJECT = 120;
const PT_PRESERVE = 60;
const PT_LIFE = 100;
const ALL_IN_MULT = 2;
/**
 * 미제 종결 시 그 사건에서 확정한 점수를 이 비율만큼 회수한다.
 *
 * 이전 판은 확정 점수가 즉시 확정 가산되고 미제여도 회수되지 않아서,
 * '모르는 사건은 아무 줄이나 확정해 심증을 빨리 태우고 종결 리포트로 정답을 읽는 것'이
 * 점수·학습 양쪽에서 이득이었다(반증 익스플로짓 5). 전액 몰수는 정답률 0.5~0.7
 * 학습자에게 과하므로 절반 — 신중함이 보상받되 실패가 런을 끝내지는 않는 선.
 */
const COLD_FORFEIT = 0.5;
const MIN_UNIQUE_WORDS = 8;
const EMPTY_NOTE = { text: '', ok: false } as const;

// 맛보기 풀 — 내 단어장이 아직 얇으면 useGameWordScope 가 wordPool 을 주지 않는다(demo degrade).
// 그때 놀이를 막지 않되, **이 단어들의 결과는 FSRS 에 절대 적재하지 않는다**(emit* 참조).
const DEMO_POOL: Word[] = [
  { en: 'trudge', ko: '터벅터벅 걷다', pos: 'verb', example: 'He had to trudge through the snow for an hour.' },
  { en: 'servant', ko: '하인', pos: 'noun', example: 'The servant opened the heavy oak door.' },
  { en: 'betray', ko: '배신하다', pos: 'verb', example: 'She would never betray a friend for money.' },
  { en: 'conceal', ko: '숨기다', pos: 'verb', example: 'He tried to conceal the letter under the rug.' },
  { en: 'shatter', ko: '산산이 부수다', pos: 'verb', example: 'The glass shattered on the marble floor.' },
  { en: 'anxious', ko: '불안한', pos: 'adjective', example: 'The witness looked anxious and kept checking the clock.' },
  { en: 'forge', ko: '위조하다', pos: 'verb', example: 'Someone forged the old man’s signature.' },
  { en: 'greedy', ko: '탐욕스러운', pos: 'adjective', example: 'A greedy heir rarely waits patiently.' },
  { en: 'grieve', ko: '몹시 슬퍼하다', pos: 'verb', example: 'The family still grieves for him.' },
  { en: 'sabotage', ko: '방해 공작하다', pos: 'verb', example: 'Someone sabotaged the stage lighting.' },
  { en: 'ignite', ko: '불붙이다', pos: 'verb', example: 'A single spark ignited the curtain.' },
  { en: 'flee', ko: '달아나다', pos: 'verb', example: 'The suspect fled through the back alley.' },
  { en: 'rescue', ko: '구조하다', pos: 'verb', example: 'Two firefighters rescued the actor.' },
  { en: 'jealous', ko: '질투하는', pos: 'adjective', example: 'He was jealous of his rival’s success.' },
  { en: 'lawyer', ko: '변호사', pos: 'noun', example: 'The lawyer refused to name her client.' },
  { en: 'witness', ko: '목격자', pos: 'noun', example: 'Only one witness saw the car leave.' },
  { en: 'motive', ko: '동기', pos: 'noun', example: 'The police still have no motive.' },
  { en: 'confess', ko: '자백하다', pos: 'verb', example: 'He confessed after three hours.' },
  { en: 'suspect', ko: '용의자', pos: 'noun', example: 'The suspect had an alibi for that night.' },
  { en: 'vanish', ko: '자취를 감추다', pos: 'verb', example: 'The manuscript vanished overnight.' },
  { en: 'bribe', ko: '뇌물을 주다', pos: 'verb', example: 'They tried to bribe the night guard.' },
  { en: 'testimony', ko: '증언', pos: 'noun', example: 'Her testimony changed the case.' },
  { en: 'reluctant', ko: '주저하는', pos: 'adjective', example: 'The clerk was reluctant to answer.' },
  { en: 'trace', ko: '흔적', pos: 'noun', example: 'There was no trace of forced entry.' },
  { en: 'deceive', ko: '속이다', pos: 'verb', example: 'He deceived everyone for years.' },
  { en: 'inherit', ko: '상속받다', pos: 'verb', example: 'She would inherit the entire estate.' },
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

/**
 * 뜻 중복 판정 키 — **첫 번째 뜻**만 본다.
 *
 * 전체 문자열 비교는 shared_words 실측에서 챕터의 10.6% 가 '첫 뜻은 같은데 전체가 다른'
 * 쌍(masterpiece '걸작' / masterwork '걸작, 대표작')을 통과시켰다. 그 쌍이 한 사건에
 * 들어오면 정답이 둘이 되고, 한쪽이 위증이면 **읽을 수 없는 함정**이 된다.
 */
const glossKey = (s: string) =>
  s
    .split(/[,;/·]/)[0]
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const enKey = (s: string) => s.trim().toLowerCase();
const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

/**
 * 뜻이 겹치지 않는 단어를 n 개 고른다.
 * `avoid` 에 든 en(이번 런에서 이미 쓴 단어)은 뒤로 미룬다 — 한 런에서 같은 단어가
 * 사건마다 되풀이되면 인출 기회가 줄고, 앞 사건에서 확정한 뜻이 뒤 사건에서
 * '어느 봉투와도 맞물리지 않는다'로 뒤집히는 모순도 생긴다.
 */
function pickUniqueKo(pool: Word[], n: number, avoid: Set<string>): Word[] {
  const shuffled = shuffle(pool);
  const fresh = shuffled.filter((w) => !avoid.has(enKey(w.en)));
  const stale = shuffled.filter((w) => avoid.has(enKey(w.en)));

  const seenKo = new Set<string>();
  const seenEn = new Set<string>();
  const out: Word[] = [];
  // keyOf 는 뜻 문자열을 정규화한다(glossKey/normKo) — Word 가 아니라 string 을 받는다.
  const take = (list: Word[], keyOf: (s: string) => string) => {
    for (const w of list) {
      if (out.length >= n) return;
      const ko = keyOf(w.ko);
      const en = enKey(w.en);
      if (!ko || seenKo.has(ko) || seenEn.has(en)) continue;
      seenKo.add(ko);
      seenEn.add(en);
      out.push(w);
    }
  };

  take(fresh, glossKey);
  take(stale, glossKey);
  if (out.length >= n) return out;
  // 첫 뜻 기준으로 못 채운 경우에만 전체 문자열로 완화한다(얇은 단어장 구제).
  take(fresh, normKo);
  take(stale, normKo);
  return out;
}

interface CasePlan {
  entries: number;
  falses: number;
  answers: number;
  traps: number;
  envelopes: number;
}

/**
 * 스펙 범위에서 이번 판의 사건 형태를 뽑는다.
 * 필요한 서로 다른 단어 수 = 봉투 수 + 위증 수(위증 진술은 봉투에 없는 단어의 뜻을 빌린다).
 * 풀이 얇으면 함정 봉투 → 위증 → 진술 줄 순으로 줄인다 — 사건의 모양을 마지막까지 지킨다.
 */
function planCase(spec: CaseSpec, avail: number): CasePlan {
  let entries = randInt(spec.entriesMin, spec.entriesMax);
  let falses = Math.min(randInt(spec.falsesMin, spec.falsesMax), entries - 2);
  let envelopes = spec.envelopes;

  for (let guard = 0; guard < 32 && envelopes + falses > avail; guard += 1) {
    const answers = entries - falses;
    if (envelopes > answers + 2) envelopes -= 1;
    else if (falses > 0) falses -= 1;
    else if (entries > 3) entries -= 1;
    else break;
  }

  const answers = Math.max(2, entries - falses);
  falses = entries - answers;
  envelopes = Math.max(answers + 1, Math.min(envelopes, Math.max(answers + 1, avail - falses)));
  return { entries, falses, answers, traps: envelopes - answers, envelopes };
}

function buildCase(
  pool: Word[],
  spec: CaseSpec,
  flavor: { title: string; scene: string },
  used: Set<string>,
): CaseData {
  const picked = pickUniqueKo(pool, spec.envelopes + spec.falsesMax, used);
  const plan = planCase(spec, picked.length);

  // 위증 진술의 뜻은 **이번 런에서 아직 안 쓴 단어**에서 빌린다.
  // 앞 사건에서 정답으로 확정한 뜻이 뒤 사건에서 위증으로 뒤집히면 학습자가 방금 세운
  // 지식과 정면으로 충돌한다 → 재사용 단어를 봉투(정답·함정) 쪽으로 몰아준다.
  const stale = picked.filter((w) => used.has(enKey(w.en)));
  const fresh = picked.filter((w) => !used.has(enKey(w.en)));
  const ordered = [...stale, ...fresh];

  const answers = ordered.slice(0, plan.answers);
  const trapWords = ordered.slice(plan.answers, plan.answers + plan.traps);
  const falseWords = ordered.slice(plan.answers + plan.traps, plan.answers + plan.traps + plan.falses);
  for (const w of [...answers, ...trapWords, ...falseWords]) used.add(enKey(w.en));

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
  const used = new Set<string>();
  return SPECS.map((spec, i) => buildCase(pool, spec, flavors[i % flavors.length], used));
}

/** 연쇄 수 → 배수. useCombo 의 상태 갱신은 비동기라, 한 번에 여러 줄을 판정할 땐 직접 계산한다. */
function multFor(combo: number): number {
  let m = 1;
  for (const t of DEFAULT_COMBO_TIERS) if (combo >= t.at) m = t.mult;
  return m;
}
const fmtMult = (m: number) => (m % 1 === 0 ? `${m}` : m.toFixed(1));
const fmtSec = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`);

/** 품사 → 한국 학습자 약어. 미지 품사는 표시하지 않는다(빈 문자열). */
function posMark(pos?: string): string {
  if (!pos) return '';
  const p = pos.trim().toLowerCase();
  if (p.startsWith('noun') || p === 'n' || p === 'n.') return '명';
  if (p.startsWith('verb') || p === 'v' || p === 'v.') return '동';
  if (p.startsWith('adject') || p.startsWith('adj')) return '형';
  if (p.startsWith('adverb') || p.startsWith('adv')) return '부';
  if (p.startsWith('prep')) return '전';
  if (p.startsWith('conj')) return '접';
  if (p.startsWith('pron')) return '대';
  return '';
}

/**
 * 미개봉 봉투에 인쇄되는 약한 단서 — 품사 + 알파벳 글자 수.
 * 뜻은 새지 않는다. 그런데도 '어떤 봉투를 먼저 열지'가 정보 기반 선택이 되고,
 * 조서에 형용사 진술이 두 줄뿐이면 형용사 봉투부터 여는 계획이 생긴다.
 * (이전 판은 전부 '증거 N' 이라 열기 순서에 사고가 0 이었고, 보존도는 셔플 운이었다.)
 */
function envHint(w: Word): string {
  const letters = w.en.replace(/[^A-Za-z]/g, '').length || w.en.length;
  const p = posMark(w.pos);
  return p ? `${p} · ${letters}글자` : `${letters}글자`;
}

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
  forfeit: number;
  seconds: number;
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
      const k = enKey(en);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ ...w, en, ko });
    }
    return out;
  }, [wordPool]);

  // demo 판정도 사건 생성과 **같은 키**(첫 뜻)로 센다 — 두 기준이 어긋나면
  // "8개는 있는데 사건이 안 만들어지는" 구간이 생긴다.
  const demoMode = useMemo(
    () => new Set(mine.map((w) => glossKey(w.ko))).size < MIN_UNIQUE_WORDS,
    [mine],
  );
  const pool = demoMode ? DEMO_POOL : mine;

  // ── FSRS 무결성 ────────────────────────────────────────────────────────
  // emittedRef  — 한 en 은 **런당 1회**만 채점한다(첫 판정이 이긴다).
  //               중앙 recordGameResult 의 10분 재채점 차단과 같은 방향이고, 서버 왕복도 아낀다.
  //               반증 실측: 40단어 풀·3사건 독립 추첨에서 런당 약 6단어가 중복 적재됐다.
  // revealedRef — (en, ko) 쌍을 화면에 이미 인쇄한 단어. 그 뒤의 **정답**은 인출이 아니라
  //               재인이므로 assisted 로 올려 카드 갱신에서 제외한다.
  //               오답은 그대로 올린다 — 보여줬는데도 못 맞춘 것은 정직한 실패다.
  const emittedRef = useRef<Set<string>>(new Set());
  const revealedRef = useRef<Set<string>>(new Set());

  const emitCorrect = useCallback(
    (w: Word) => {
      if (demoMode) return;
      const k = enKey(w.en);
      if (emittedRef.current.has(k)) return;
      emittedRef.current.add(k);
      onCorrect?.(w, revealedRef.current.has(k) ? { assisted: true } : undefined);
    },
    [demoMode, onCorrect],
  );
  const emitWrong = useCallback(
    (w: Word) => {
      if (demoMode) return;
      const k = enKey(w.en);
      if (emittedRef.current.has(k)) return;
      emittedRef.current.add(k);
      onWrong?.(w);
    },
    [demoMode, onWrong],
  );
  const markRevealed = useCallback((w: Word) => {
    revealedRef.current.add(enKey(w.en));
  }, []);

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
  const [allInUsed, setAllInUsed] = useState(false);

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
  const [caseTimes, setCaseTimes] = useState<number[]>([]);

  const pb = usePersonalBest('lexicon-detective');
  const shownScore = useCountUp(score);

  const flashTimer = useRef(0);
  const burstTimer = useRef(0);
  const tierTimer = useRef(0);
  // 조사 시간은 압박용 타이머가 아니다 — 사건 종결 리포트에만 경과로 적는다(Calm UI).
  const caseStart = useRef(0);
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
  // 전면 재구성은 사건당 1회 — 이전 판은 실패해도 심증 1만 내면 다시 던질 수 있어서
  // '무료 탐색 3회'가 됐다(반증 익스플로짓 4).
  const canAllIn = pending.length >= 2 && allDecided && !allInUsed;

  const resetCaseState = useCallback((c: CaseData) => {
    setOpened(new Set());
    setPlaced({});
    setRejected(new Set());
    setLocked({});
    setHeld(null);
    setLives(c.lives);
    setCaseBase(0);
    setAllInUsed(false);
    setNote(EMPTY_NOTE);
    setFlash(null);
    setBurstId(null);
    caseStart.current = Date.now();
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
    (
      outcome: 'solved' | 'cold',
      lockedMap: Record<number, LockKind>,
      base: number,
      livesLeft: number,
      closeMult: number,
    ) => {
      if (!cur) return;
      const pCount = cur.envelopes.length - opened.size;
      // 보존 보너스에 연쇄 배수를 태운다. 이전 판은 봉투당 60 고정이라
      // '오판 1회 기대손실(심증 100 + 연쇄 전소 수백~수천)' 앞에서 항상 무시됐고,
      // 최적 플레이가 '무조건 전부 개봉'으로 고정됐다(반증 익스플로짓 3).
      const pBonus = outcome === 'solved' ? Math.round(pCount * PT_PRESERVE * closeMult) : 0;
      const lBonus = outcome === 'solved' ? livesLeft * PT_LIFE : 0;
      const forfeit = outcome === 'cold' ? Math.round(base * COLD_FORFEIT) : 0;
      const delta = pBonus + lBonus - forfeit;
      if (delta !== 0) setScore((s) => Math.max(0, s + delta));
      if (outcome === 'solved') setSolvedCount((n) => n + 1);

      const seconds = caseStart.current > 0 ? Math.round((Date.now() - caseStart.current) / 1000) : 0;
      setCaseTimes((t) => [...t, seconds]);

      // 종결 리포트는 모든 줄의 정답을 인쇄한다 → 이 단어들은 이후 '이미 본 것'이다.
      cur.entries.forEach((e) => {
        if (e.answer) markRevealed(e.answer);
      });

      setSummary({
        title: cur.title,
        index: caseIdx,
        outcome,
        rows: buildRows(lockedMap),
        base,
        preserveCount: pCount,
        preserve: pBonus,
        life: lBonus,
        forfeit,
        seconds,
      });
      setPhase('summary');
      if (outcome === 'solved') sfx.fanfare();
    },
    [cur, caseIdx, opened, buildRows, markRevealed, sfx],
  );

  /** 어긋난 판단 — 심증 1 소모. 0 이 되면 미제로 종결하고 정답을 전부 공개한다. */
  const spendCertainty = useCallback(
    (text: string, nextPlaced: Record<number, string>, nextRejected: Set<number>) => {
      if (!cur) return;
      const left = lives - 1;
      setLives(left);
      combo.miss();
      setPlaced(nextPlaced);
      setRejected(nextRejected);
      if (left <= 0) {
        cur.entries.forEach((e) => {
          if (locked[e.id] || !e.answer) return;
          // **봉투를 연 단어만** 오답으로 올린다.
          // 봉투를 열지 않았다면 그 영단어는 학습자에게 제시된 적이 없다 —
          // 제시되지 않은 항목의 '인출 실패'는 존재하지 않는 사건이고, 그걸 Rating.Again 으로
          // 적재하면 봉투 0개짜리 30초 런이 복습 스케줄 12건을 망가뜨린다(반증 익스플로짓 2).
          // 반대로 영단어를 보고도 맞물리지 못했다면 그건 정직한 실패다 → 그대로 올린다.
          if (opened.has(e.answer.en)) emitWrong(e.answer);
          noteMissed(e.answer);
        });
        setNote(EMPTY_NOTE);
        closeCase('cold', locked, caseBase, 0, 1);
      } else {
        setNote({ text, ok: false });
      }
    },
    [cur, lives, locked, opened, caseBase, combo, emitWrong, noteMissed, closeCase],
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
        if (!isReject && entry.answer) {
          emitCorrect(entry.answer);
          markRevealed(entry.answer); // 아래 문구가 (en, ko) 쌍을 인쇄한다
        }
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
          closeCase('solved', nextLocked, nextBase, lives, multFor(combo.combo + 1));
        }
        return;
      }

      // 어긋남 — 매치 오판과 기각 오판의 **정보량을 대칭으로** 맞춘다.
      // 이전 판은 기각 오판에만 '이 진술과 맞물리는 증거가 현장에 있다'고 적어,
      // 심증 1로 '이 줄은 위증이 아니다'라는 깨끗한 1비트를 살 수 있었다(반증 익스플로짓 4).
      // 연역은 학습자가 한다 — 조서는 결과만 반려한다.
      sfx.wrong();
      showFlash(id, 'wrong');
      const nextPlaced = { ...placed };
      const nextRejected = new Set(rejected);
      let text: string;
      // 오답 귀속 — 원칙은 한 줄이다: **봉투를 열어 학습자에게 영단어가 제시된 것만** 채점한다.
      // 미개봉 단어는 인출 기회 자체가 없었으므로 Rating.Again 의 근거가 되지 못한다.
      let subject: Word | null = null;
      if (isReject) {
        nextRejected.delete(id);
        text = '이 기각은 성립하지 않는다. 조서에 반려 도장이 찍혔다.';
        if (entry.answer) {
          noteMissed(entry.answer);
          if (opened.has(entry.answer.en)) subject = entry.answer;
        }
      } else {
        delete nextPlaced[id];
        text = `「${chip}」로는 이 진술이 서지 않는다. 수첩으로 되돌린다.`;
        // 귀속 교정(반증 지적) — 시험받은 것은 '이 줄의 정답 단어'이지 내가 집은 칩이 아니다.
        // 예외 둘: 위증 줄이라 정답 단어가 없거나, 정답 봉투가 아직 미개봉일 때.
        // 그때 남는 유일한 실측 증거는 '이 칩의 뜻을 이 진술로 잘못 알았다' 뿐이다
        // (칩은 정의상 이미 개봉된 단어다).
        if (entry.answer) noteMissed(entry.answer);
        subject =
          entry.answer && opened.has(entry.answer.en)
            ? entry.answer
            : (cur.envelopes.find((x) => x.en === chip) ?? null);
        if (subject) noteMissed(subject);
      }
      if (subject) emitWrong(subject);
      spendCertainty(text, nextPlaced, nextRejected);
    },
    [cur, locked, rejected, placed, opened, combo, caseBase, lives, emitCorrect, emitWrong, markRevealed, noteMissed, sfx, showFlash, showBurst, closeCase, spendCertainty],
  );

  // ─── 전면 재구성(승부수) ───
  // 사건당 1회. 성공하면 남은 줄 전부가 2배로 굳고 연쇄가 한 번에 치솟는다.
  // 실패하면 심증 1 소모 + 연쇄 소멸, 그리고 어느 줄이 틀렸는지 알려주지 않는다.
  const allIn = useCallback(() => {
    if (!cur || !canAllIn) return;
    const rows = pending;
    const allRight = rows.every((e) => (rejected.has(e.id) ? e.answer === null : placed[e.id] === e.answer?.en));
    setAllInUsed(true);

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
    closeCase('solved', nextLocked, nextBase, lives, multFor(c));
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
    setCaseTimes([]);
    setTierMsg('');
    emittedRef.current = new Set();
    revealedRef.current = new Set();
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
            <li><b>조사</b> — 봉인된 봉투에는 품사와 글자 수만 적혀 있다. 열면 단어가 나오고 <b>현장 보존도</b>가 1 줄어든다(종결 시 남은 보존도 ×{PT_PRESERVE}점 ×연쇄 배수).</li>
            <li><b>확정</b> — 조서의 진술에 맞는 단어를 끼우고 확정한다. 이어질수록 연쇄 배수가 오른다.</li>
            <li><b>기각</b> — 어느 봉투와도 맞지 않는 진술은 기각한다. 위증이 몇 줄인지는 <b>사건마다 다르고</b> 알려주지 않는다.</li>
            <li><b>심증</b> — 어긋난 판단마다 1 소모. 0 이 되면 미제로 종결되고 진상이 공개되지만, 그 사건의 확정 점수는 <b>절반만</b> 정산된다.</li>
            <li><b>전면 재구성</b> — 남은 진술을 한 번에 판정한다. <b>사건당 한 번뿐</b>. 전부 맞으면 점수 ×{ALL_IN_MULT}, 하나라도 틀리면 어디가 틀렸는지 알려주지 않는다.</li>
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
    const totalCase = summary.base + summary.preserve + summary.life - summary.forfeit;
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
            <span>보존 {summary.preserveCount}봉투 {summary.preserve > 0 ? `+${summary.preserve.toLocaleString()}` : '+0'}</span>
            <span aria-hidden="true">·</span>
            <span>심증 {summary.life > 0 ? `+${summary.life}` : '+0'}</span>
            {summary.forfeit > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="ld-tally-neg">미제 정산 −{summary.forfeit.toLocaleString()}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <b>합계 {totalCase.toLocaleString()}</b>
            <span aria-hidden="true">·</span>
            <span>조사 {fmtSec(summary.seconds)}</span>
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
    // 시간 축은 압박이 아니라 '다음 판 목표' 로만 쓴다 — 카운트다운 없음, 사후 표기만.
    const totalSec = caseTimes.reduce((a, b) => a + b, 0);
    const hint = perfect
      ? allInWins > 0
        ? `전면 재구성 ${allInWins}회 성립 · 조사 ${fmtSec(totalSec)}. 다음 판은 봉투를 두 개 덜 열고 같은 점수를 노려보자.`
        : `조사 ${fmtSec(totalSec)}. 다음 판엔 「전면 재구성」으로 배수를 걸어보자 — 사건당 한 번뿐이고, 성립하면 점수가 두 배다.`
      : `미제 ${cases.length - solvedCount}건 · 조사 ${fmtSec(totalSec)}. 맞물리는 증거가 없다고 느껴지면 「기각」이 정답인 경우가 있다.`;
    return shell(
      <>
        <Hud muted={sfx.muted} onToggleMute={() => sfx.setMuted((m) => !m)} onExit={handleExit} />
        <GameDone
          mark="lexicon-detective"
          lead={perfect ? '사건철을 전부 닫았어요' : '오늘 조사는 여기까지'}
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
          footer={
            caseTimes.length > 0 ? (
              <span className="ld-foot">
                사건별 조사 시간 {caseTimes.map((s, i) => `${i + 1}—${fmtSec(s)}`).join(' · ')}
              </span>
            ) : undefined
          }
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
  const preservePreview = Math.round(preserved * PT_PRESERVE * mult);

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
            <span className="ld-hud-sub">종결 시 +{preservePreview.toLocaleString()}</span>
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
              <li>봉인된 봉투엔 품사·글자 수만 있다. 열면 단어가 나오고 보존도 1 감소(종결 시 ×{PT_PRESERVE} ×연쇄 배수).</li>
              <li>진술에 단어를 끼우고 확정. 맞물리는 증거가 없으면 기각 — 위증 줄 수는 사건마다 다르다.</li>
              <li>어긋나면 심증 1 감소 · 연쇄 소멸. 심증 0 이면 미제이고 확정 점수의 절반을 잃는다.</li>
              <li>전면 재구성: 남은 줄 일괄 판정, 사건당 1회, 전부 맞으면 ×{ALL_IN_MULT}.</li>
            </ul>
          )}
        </div>

        {/* 증거 봉투 */}
        <div className="ld-board" role="group" aria-label="증거 봉투">
          {cur.envelopes.map((w, i) => {
            const isOpen = opened.has(w.en);
            const isUsed = usedEn.has(w.en);
            const isHeld = held === w.en;
            const hint = envHint(w);
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
                    : `증거 ${i + 1} — 미개봉 · ${hint}. 열면 보존도가 1 줄어든다`
                }
              >
                <span className="ld-env-ic" aria-hidden="true"><SealIcon open={isOpen} /></span>
                {isOpen ? (
                  <b className="ld-env-word">{w.en}</b>
                ) : (
                  <span className="ld-env-no">{hint}</span>
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
                ? '봉인에 적힌 품사와 글자 수만 보고 어떤 봉투를 열지 고르라 — 연 만큼 현장은 흐트러진다.'
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
            title={
              allInUsed
                ? '이 사건의 전면 재구성은 이미 썼다 — 남은 줄은 하나씩 확정해야 한다'
                : canAllIn
                  ? undefined
                  : '남은 진술 전부에 판단을 내려야 승부수를 던질 수 있다'
            }
          >
            {allInUsed ? '전면 재구성 소진 — 한 줄씩 확정' : `전면 재구성 ×${ALL_IN_MULT} · ${pending.length}줄`}
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
  .ld-hud-sub { font-family: var(--font-display, system-ui); font-size: 10.5px; font-weight: 700; color: var(--t3); font-variant-numeric: tabular-nums; }
  .ld-hud-tag { font-style: normal; font-size: 10px; font-weight: 800; letter-spacing: .04em; padding: 1px 5px; border-radius: 999px; border: 1px solid currentColor; }
  .ld-stage { gap: clamp(10px, 2vh, 18px); justify-content: flex-start; padding-top: clamp(8px, 1.6vh, 16px); overflow-y: auto; }

  .ld-head { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .ld-title { margin: 0; font-family: var(--font-display, system-ui); font-size: clamp(18px, 3vw, 24px); font-weight: 800; color: var(--t1); }
  .ld-scene { margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13.5px; color: var(--t2); max-width: 56ch; }

  .ld-rules-btn { min-height: 44px; padding: 4px 16px; border-radius: 999px; border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 60%, transparent); color: var(--t3); font-family: var(--font-display, system-ui); font-size: 11.5px; font-weight: 700; cursor: pointer; transition: color .15s, border-color .15s, background .15s; }
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
  .ld-env-no { font-size: 10.5px; font-weight: 700; color: var(--t3); letter-spacing: .01em; font-variant-numeric: tabular-nums; }
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
  .ld-tally-neg { color: var(--warning); }

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
