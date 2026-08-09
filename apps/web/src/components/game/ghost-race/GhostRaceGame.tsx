// apps/web/src/components/game/ghost-race/GhostRaceGame.tsx
// Ghost Race — "3랩 추격전"(v07.10). v07.9 재설계 위에 적대적 반증 5건을 코드로 막았다.
//
// v07.9 가 세운 축 (그대로 유지 — 긴장·판돈·콤보를 죽이지 않는다):
//  · 화폐는 시간이 아니라 **거리**다. 매 구간 라인을 건다.
//    인코스 4~5지선다(안전) / 아웃코스 선택지 없는 철자 입력(생성 인출, 고보상·고위험).
//  · 라인 전환은 **다음 구간부터** — 선택지를 본 뒤 타이핑으로 갈아타 정답을 1/4 로 좁히는
//    새치기가 구조적으로 불가능하다.
//  · 콤보가 유령을 묶는다(3/6/10연속 → 0.4/0.7/1.1초 정지). 끊기면 즉시 사라진다 = 판돈.
//  · 유령은 rAF + 벽시계 델타 + 네거티브 스플릿(p^1.28), 랩마다 페이스가 조인다(1.00→0.93→0.87).
//  · 포토피니시 유예 · 랩별 격차 · 놓친 단어 리빌 · 다음 판 목표를 담은 재시작 라벨.
//
// v07.10 — 반증자가 file:line 과 시뮬 수치로 제시한 구멍 5건 (심각도 순):
//  1) [치명] 즉시클릭 브루트포스 + 리빌 과외 — 영어 0으로 유령을 2배 앞섰다.
//     오답 비용이 리빌 1250ms 뿐이었고(인코스는 후퇴가 없었다), 리빌이 정답을 가르친 뒤
//     requeue 가 그 단어를 **3칸 뒤**(작업기억 4항목 안 = 사실상 에코)에 되돌려줬다.
//     게다가 티어 하한 28500ms 가 하드값이라 게임이 그 격차를 영원히 좁힐 수 없었다.
//     → ① 재삽입을 **문항 8개 뒤**(작업기억 밖)로 ② **앞선 상태의 인코스 오답에 위치 비용**
//       ③ 유령 하한을 하드값이 아니라 **측정된 내 페이스의 중앙값**으로.
//     시뮬(500레이스): 무지 즉시클릭 레이스승 34% → 3%.
//  2) [높음] FSRS 위조 — 5초 전에 읽은 정답이 onCorrect 로, 같은 단어에 onWrong 난사.
//     레이스당 36회 채점, 풀 6개면 단어당 6회가 학습 스케줄에 올라갔다.
//     → 레이스당 단어별 **첫 채점 1회만** 정직하게 올리고 나머지는 `{ assisted: true }`.
//       호출을 빼지 않는다 — **모르는 단어는 오답으로 정직하게 올라가야 복습이 잡힌다.**
//     시뮬: 레이스당 채점 36회 중 FSRS 반영 6회(정답 1.5 / 오답 4.5), 30회는 assisted 차단.
//  3) [보통] 슬립스트림 역인센티브 — 2구간 뒤처지면 정답당 +2칸이라 리드 구축이 순수 손해였다.
//     → 보상을 칸이 아니라 **유령 0.5초 정지**로 바꾸고 발동선을 -2 → -3 구간으로 늦췄다.
//     시뮬: 고의 후퇴(샌드배깅) 전략의 랩승 손실 -3.5pp → -10.9pp = 더 이상 최적이 아니다.
//  4) [보통] 탭 전환 = 경고 없는 즉시 랩 패배 — rAF 가 멈춘 사이의 시간이 복귀 첫 프레임에
//     통째로 유령 클록에 더해졌다. → visibilitychange 일시정지 + 1.2초 인라인 '재출발' 배지
//     (모달 아님 — 학습 중단 금지).
//  5) [보통] 안드로이드 IME 제안 스트립이 아웃코스 생성 인출을 재인으로 강등시켰다.
//     → 한 번에 2글자 이상 채워진 입력은 자동완성으로 보고 인코스와 같은 +1 만 주고
//       FSRS 에는 assisted 로 올린다(벌하지 않는다 — 다만 생성 인출로 세지 않는다).
//
// 인출 규칙(비타협):
//  · 제출 전 화면에는 한국어 뜻만 있다. 아웃코스는 선택지조차 없다.
//  · 부분 정답 오라클 없음. 힌트 없음. 정답 공개는 제출 후에만 — 대신 그때 발음·예문까지.
//
// 자료 연계: wordPool 이 오면 **반드시** 그 단어로 돈다(도서/스크립트/단어장 스코프).
// 내장 뱅크는 wordPool 이 없을 때만 쓰는 폴백 — 그래야 recordGameResult 가 silent skip 되지 않는다.

'use client';

import {
  useCallback, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import {
  GameKitStyles, AmbientBackground, Hud, GameDone, ParticleBurst, useSfx, shuffle, clamp, type Word,
  GameMusic, FeedbackIcon, Kbd, NotEnoughWords, useCombo, usePersonalBest, type ComboTier,
} from '@/components/game/_shared/gamekit';

/**
 * 정답을 이미 보여준 뒤의 입력인가(리빌 직후 재출제 · 레이스 내 2회차 채점 · IME 자동완성).
 * 게임 점수·콤보·칸은 그대로 주되 **FSRS 에는 올리지 않는다**(판정은 record-result 가 중앙에서).
 */
interface ResultOpts { assisted?: boolean }

interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word, opts?: ResultOpts) => void;
  onWrong?: (w: Word, opts?: ResultOpts) => void;
}

// ─── 폴백 뱅크 (wordPool 이 없을 때만) ────────────────────────────────────
const BANK: Word[] = [
  { en: 'advantage', ko: '이점', pos: 'n', example: 'Speed was his only advantage in the race.' },
  { en: 'reserved', ko: '내성적인', pos: 'adj', example: 'She is reserved with strangers.' },
  { en: 'inclined', ko: '경향이 있는', pos: 'adj', example: 'He is inclined to answer too quickly.' },
  { en: 'consequence', ko: '결과', pos: 'n', example: 'Every choice has a consequence.' },
  { en: 'judgment', ko: '판단', pos: 'n', example: 'Trust your own judgment here.' },
  { en: 'ability', ko: '능력', pos: 'n', example: 'Reading ability grows with practice.' },
  { en: 'balance', ko: '균형', pos: 'n', example: 'The runner lost her balance at the corner.' },
  { en: 'courage', ko: '용기', pos: 'n', example: 'It takes courage to try again.' },
  { en: 'develop', ko: '발전시키다', pos: 'v', example: 'They develop new habits slowly.' },
  { en: 'reduce', ko: '줄이다', pos: 'v', example: 'Reduce the gap before the last lap.' },
  { en: 'sudden', ko: '갑작스러운', pos: 'adj', example: 'A sudden burst took the lead.' },
  { en: 'honest', ko: '정직한', pos: 'adj', example: 'An honest mistake is still a lesson.' },
  { en: 'generous', ko: '관대한', pos: 'adj', example: 'He was generous with his time.' },
  { en: 'stubborn', ko: '고집스러운', pos: 'adj', example: 'The stubborn rival never slowed down.' },
  { en: 'massive', ko: '거대한', pos: 'adj', example: 'A massive crowd lined the track.' },
  { en: 'budget', ko: '예산', pos: 'n', example: 'The team kept a tight budget.' },
  { en: 'profit', ko: '이익', pos: 'n', example: 'Small gains add up to profit.' },
  { en: 'flood', ko: '홍수', pos: 'n', example: 'The flood washed out the road.' },
  { en: 'ancient', ko: '고대의', pos: 'adj', example: 'An ancient path crossed the hill.' },
  { en: 'fragile', ko: '연약한', pos: 'adj', example: 'His lead was fragile.' },
  { en: 'genuine', ko: '진짜의', pos: 'adj', example: 'That was a genuine effort.' },
  { en: 'hostile', ko: '적대적인', pos: 'adj', example: 'The weather turned hostile.' },
  { en: 'obvious', ko: '분명한', pos: 'adj', example: 'The answer became obvious later.' },
  { en: 'reveal', ko: '드러내다', pos: 'v', example: 'The last lap reveals who trained.' },
  { en: 'seek', ko: '찾다', pos: 'v', example: 'Seek the shortest line.' },
  { en: 'vivid', ko: '생생한', pos: 'adj', example: 'She kept a vivid memory of the finish.' },
  { en: 'wander', ko: '거닐다', pos: 'v', example: 'Do not let your eyes wander.' },
  { en: 'endure', ko: '견디다', pos: 'v', example: 'Endure the climb and the rest is easy.' },
  { en: 'persuade', ko: '설득하다', pos: 'v', example: 'Nothing could persuade him to stop.' },
  { en: 'hesitate', ko: '망설이다', pos: 'v', example: 'Do not hesitate at the corner.' },
];

// ─── 레이스 규격 ──────────────────────────────────────────────────────────
const SEG = 12;               // 랩당 구간 수
const LAPS = 3;
const LAP_PACE = [1, 0.93, 0.87]; // 랩이 갈수록 유령이 조인다 = 긴장 곡선
const PACE_EXP = 1.28;        // 네거티브 스플릿 — 유령이 후반에 몰아친다
const DEFAULT_LAP_MS = 40000;
/**
 * 유령 랩 상한. 46s 였을 때 적응형 유령이 그 아래로 느려질 수 없어 정답률 0.5~0.6 학습자가
 * 구조적으로 졌다(시뮬 500레이스: a=0.50 레이스승 1%). 58s 로 열어 30% 로 회복.
 * 가장 느린 대역에서도 레이스 총길이 ≈ 2.7분으로 세션 형태를 깨지 않는다.
 */
const CEIL_LAP_MS = 58000;
/**
 * 유령 랩 하한(안전장치). 12구간 × 1.0초 = '한국어를 읽고 → 보기에서 찾아 → 누르고 →
 * 480ms 리빌' 을 반복하는 사람의 실질 한계. 티어별 하드 하한(28.5s)을 대체한다 —
 * 하드 하한은 게임이 브루트포서를 영원히 못 잡게 만드는 원인이었다.
 */
const MIN_LAP_MS = 12000;
/** 유령 페이스 표본 수 — 최근 N랩의 **중앙값**을 쓴다(최고 기록이 아니라 = 래칫 차단). */
const PACE_SAMPLES = 5;
/**
 * 표본 대비 유령 여유. 1.06 = 내 중앙값보다 6% 느리게 출발 → 랩1 승률 ~65%,
 * LAP_PACE 로 조여 레이스(3판 2선승) 승률이 실력에 따라 30~96% 단조 증가한다.
 */
const PACE_MARGIN = 1.06;
const OUT_STALL_MS = 900;     // 아웃코스 성공 시 유령 정지
const OUT_LOCK_Q = 2;         // 아웃코스 실패 후 인코스 강제 복귀 구간 수
const PHOTO_FINISH_MS = 400;  // 결착 중인 답을 살려주는 유예 (무승부는 도전자 승)
const REVEAL_OK_MS = 480;
const REVEAL_OK_OUT_MS = 640;
const REVEAL_NG_MS = 1250;
const GRID_TICK_MS = 480;     // 3 · 2 · 1
const LAPEND_MS = 1500;
/**
 * 슬립스트림 — 예전엔 '-2구간에서 정답당 +2칸' 이라 뒤처져 있는 편이 기대값에서 순수 이득이었다
 * (= 리드 구축이 손해, 실력 차가 트랙에서 지워짐). 칸 보상을 없애고 유령을 잠깐 묶는 것으로
 * 바꾸고 발동선을 한 칸 늦췄다. 유령 속도 ≈ 0.4구간/초이므로 0.5초 정지 ≈ 0.2구간 —
 * 따라잡기는 남기되 2배 증폭은 사라진다. 시뮬: 고의 후퇴 전략 랩승 -3.5pp → -10.9pp.
 */
const SLIPSTREAM_AT = -3;
const SLIPSTREAM_STALL_MS = 500;
/**
 * 인코스 오답의 위치 비용 — **이만큼 앞서 있을 때만** 1칸을 잃는다.
 * '인코스는 후퇴가 없다' 가 즉시클릭을 공짜로 만들었지만, 무조건 -1 은 정답률 0.5 학습자를
 * 파산시킨다(시뮬: 레이스승 30% → 1%). 리드 중일 때만 물리면 둘 다 잡힌다 —
 * 무지 즉시클릭 34% → 3%, a=0.50 은 30% 유지. 뒤처지거나 나란하면 여전히 후퇴 없음.
 */
const IN_WRONG_LEAD_MIN = 2;
/**
 * 오답 단어를 되돌리기까지의 **문항 수** 간격. 3(큐 배열 인덱스)이었을 때는 리빌 4~5초 뒤
 * 같은 문항이 같은 타일 세트로 돌아와 작업기억(~4항목) 안의 에코였다 = 리빌이 곧 과외.
 * 배열 인덱스가 아니라 문항 카운터로 미뤄야 풀이 6개여도 간격이 보장된다.
 */
const REQUEUE_GAP = 8;
/** 탭 복귀 후 유령이 다시 달리기까지의 유예. */
const RESUME_GRACE_MS = 1200;

const STORE_KEY = 'vf_ghostrace_v3';

interface Store {
  /** 누적 랩 승 — 리그 티어의 기준(표시 + 정지 상한). */
  lapWins: number;
  races: number;
  raceWins: number;
  /**
   * 최근 랩 페이스 표본(ms, 최대 PACE_SAMPLES). 승리 랩은 실측, **패배 랩도 도달 구간으로
   * 환산해 넣는다** — 표본이 승리만 모이면 중앙값이 한쪽으로만 내려가 예전 bestLapMs 와
   * 같은 일방향 래칫이 된다. 못한 날은 유령도 느려져야 한다.
   */
  recentLapMs: number[];
  /** 연속 레이스 패배 수. */
  lossStreak: number;
}

const EMPTY_STORE: Store = { lapWins: 0, races: 0, raceWins: 0, recentLapMs: [], lossStreak: 0 };

/**
 * 티어는 이제 **하한이 아니라 표시 + 정지 상한**이다.
 * 하한(floor)은 잘하는 플레이어를 유령이 영원히 못 잡게 만드는 원인이었으므로 제거했다.
 * 대신 리그가 올라갈수록 콤보·아웃코스로 살 수 있는 '유령 정지' 총량이 조금씩 줄어든다.
 */
interface Tier { min: number; name: string; color: string; stallCap: number }
const TIERS: Tier[] = [
  { min: 0, name: '브론즈', color: '#B06C3A', stallCap: 0.25 },
  { min: 4, name: '실버', color: '#7C8598', stallCap: 0.22 },
  { min: 9, name: '골드', color: '#B98C22', stallCap: 0.19 },
  { min: 18, name: '플래티넘', color: '#2F8B99', stallCap: 0.16 },
];
const tierOf = (lapWins: number) => TIERS.slice().reverse().find((t) => lapWins >= t.min)!;
const nextTierOf = (lapWins: number) => TIERS.find((t) => t.min > lapWins) ?? null;

const COMBO_TIERS: ComboTier[] = [
  { at: 0, mult: 1 },
  { at: 3, mult: 1.5, label: '슬립스트림' },
  { at: 6, mult: 2, label: '드래프트' },
  { at: 10, mult: 3, label: '토우' },
];
const stallForCombo = (c: number) => (c >= 10 ? 1100 : c >= 6 ? 700 : c >= 3 ? 400 : 0);

type Phase = 'grid' | 'racing' | 'lapend' | 'result';
type Line = 'in' | 'out';
type Verdict = 'correct' | 'wrong' | 'near' | null;

// ─── 유틸 ────────────────────────────────────────────────────────────────
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** 철자 1개 차이(치환·삽입·삭제·인접 전치) — "틀렸다"가 아니라 "아까웠다"를 가르는 기준. */
function isOneEdit(a: string, b: string): boolean {
  if (a === b || a.length === 0) return false;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la === lb) {
    const diff: number[] = [];
    for (let i = 0; i < la; i++) {
      if (a[i] !== b[i]) {
        diff.push(i);
        if (diff.length > 2) return false;
      }
    }
    if (diff.length === 1) return true;
    if (diff.length === 2) {
      const [i, j] = diff;
      return j === i + 1 && a[i] === b[j] && a[j] === b[i]; // 인접 전치
    }
    return false;
  }
  const short = la < lb ? a : b;
  const long = la < lb ? b : a;
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) { i++; j++; continue; }
    if (skipped) return false;
    skipped = true;
    j++;
  }
  return true;
}

/** 오답 후보 — 후반 랩에서는 품사·길이가 닮은 단어로 좁혀 변별을 요구한다. */
function pickDistractors(pool: Word[], target: Word, n: number, tighten: boolean): Word[] {
  const rest = pool.filter((w) => w.en !== target.en);
  if (rest.length <= n) return shuffle(rest);
  if (!tighten) return shuffle(rest).slice(0, n);
  const samePos = target.pos ? rest.filter((w) => w.pos === target.pos) : [];
  const base = samePos.length >= n ? samePos : rest;
  const byLen = [...base].sort(
    (x, y) => Math.abs(x.en.length - target.en.length) - Math.abs(y.en.length - target.en.length),
  );
  return shuffle(byLen.slice(0, Math.min(byLen.length, n + 3))).slice(0, n);
}

/** 예문에서 해당 단어를 굵게 — 제출 뒤에만 보여주므로 문맥 학습(Context-Dependent)에 쓴다. */
function highlight(example: string, en: string): ReactNode {
  const esc = en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 캡처 그룹으로 split 하면 홀수 인덱스가 곧 매치 조각이다(정규식 lastIndex 상태에 의존하지 않는다).
  const parts = example.split(new RegExp(`(${esc}\\w*)`, 'i'));
  if (parts.length === 1) return example;
  return parts.map((p, i) =>
    i % 2 === 1 ? <b key={i} className="gr-ex-hit">{p}</b> : <span key={i}>{p}</span>,
  );
}

function readStore(): Store {
  if (typeof window === 'undefined') return EMPTY_STORE;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return EMPTY_STORE;
    const p = JSON.parse(raw) as Partial<Store>;
    const samples = Array.isArray(p.recentLapMs)
      ? p.recentLapMs.filter((n) => typeof n === 'number' && n > 0).slice(-PACE_SAMPLES)
      : [];
    return {
      lapWins: Number(p.lapWins) || 0,
      races: Number(p.races) || 0,
      raceWins: Number(p.raceWins) || 0,
      recentLapMs: samples,
      lossStreak: Number(p.lossStreak) || 0,
    };
  } catch {
    return EMPTY_STORE;
  }
}

/** 표본 중앙값 — 한 번의 대박/폭망 랩이 유령 페이스를 끌고 가지 않게 평균 대신 중앙값. */
function medianOf(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 === 1 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/**
 * 유령 랩 목표 시간 — **측정된 내 페이스**를 따라오는 적응형 라이벌.
 * 기준은 최근 랩 표본의 중앙값(승리는 실측, 패배는 도달 구간 환산)이라 양방향으로 움직인다.
 * 하한 MIN_LAP_MS 는 데이터가 망가졌을 때의 안전장치일 뿐, 티어와 무관하다.
 */
function computeLapMs(lapIdx: number, s: Store, lapWinsThisRace: number): number {
  const med = medianOf(s.recentLapMs);
  let base = clamp((med ?? DEFAULT_LAP_MS) * PACE_MARGIN, MIN_LAP_MS, CEIL_LAP_MS);
  if (s.lossStreak >= 2) base = Math.min(CEIL_LAP_MS, base * 1.1);
  let ms = base * LAP_PACE[lapIdx];
  if (lapIdx === LAPS - 1 && lapWinsThisRace === 0) ms *= 1.08; // 마지막 기회 — 조용히 완화
  return Math.round(ms);
}

/** 랩 페이스 표본 1개 — 이겼으면 실측, 졌으면 '도달 구간 기준 환산 완주 시간'. */
function paceSample(elapsedMs: number, segReached: number, won: boolean): number {
  if (won) return Math.round(elapsedMs);
  return Math.min(150000, Math.round((elapsedMs * SEG) / Math.max(1, segReached)));
}

// ─── 게임 ────────────────────────────────────────────────────────────────
export function GhostRaceGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const pool = useMemo(() => {
    const p = wordPool && wordPool.length > 0 ? wordPool : BANK;
    const seen = new Set<string>();
    return p.filter((w) => (seen.has(w.en) ? false : (seen.add(w.en), true)));
  }, [wordPool]);
  const enough = pool.length >= 4;

  const sfx = useSfx();
  const pb = usePersonalBest('ghost-race-lap', false);

  const [store, setStore] = useState<Store>(() => readStore());
  const storeRef = useRef(store);
  storeRef.current = store;

  const [phase, setPhase] = useState<Phase>('grid');
  const [lapIdx, setLapIdx] = useState(0);
  const [lapRes, setLapRes] = useState<boolean[]>([]);
  const [gridCount, setGridCount] = useState(3);
  const [lapMs, setLapMs] = useState(() => computeLapMs(0, readStore(), 0));

  const [youSeg, setYouSeg] = useState(0);
  const [ghostSeg, setGhostSeg] = useState(0);
  const [finalStretch, setFinalStretch] = useState(false);

  const [qKey, setQKey] = useState(0);
  const [target, setTarget] = useState<Word | null>(null);
  const [options, setOptions] = useState<Word[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [reveal, setReveal] = useState(false);
  const [typed, setTyped] = useState('');

  const [line, setLine] = useState<Line>('in');
  const [nextLine, setNextLine] = useState<Line>('in');
  const [outLock, setOutLock] = useState(0);

  const [toast, setToast] = useState('');
  const [srMsg, setSrMsg] = useState('');
  const [lapEndMsg, setLapEndMsg] = useState('');
  /** 탭에서 돌아온 직후의 재출발 유예 — 트랙 위 인라인 배지(모달 아님). */
  const [resuming, setResuming] = useState(false);
  /** 이번 아웃코스 정답이 IME 자동완성으로 채워졌는가(리빌에 조용히 알린다). */
  const [autoFilledShown, setAutoFilledShown] = useState(false);

  const [result, setResult] = useState<{
    lapWins: number;
    bestLap: number | null;
    improved: boolean;
    prevBest: number | null;
    promoted: string | null;
    missed: Word[];
  } | null>(null);

  // refs — rAF 루프와 답 처리는 상태 지연 없이 최신값을 봐야 한다.
  const mountedRef = useRef(true);
  const timersRef = useRef<number[]>([]);
  const queueRef = useRef<Word[]>([]);
  /** 오답 재삽입 대기열 — { 단어, 이 문항 번호 이후에 다시 낸다 }. */
  const pendingRef = useRef<{ w: Word; at: number }[]>([]);
  /** 이번 레이스에서 출제한 문항 수 — 재삽입 간격의 단위(배열 인덱스가 아니라). */
  const drawNoRef = useRef(0);
  /** 직전에 출제한 단어 — 셔플 경계에서 같은 단어가 연달아 나오는 것을 막는다. */
  const lastDrawnRef = useRef<string>('');
  /**
   * 레이스당 단어별 채점 원장 — { 채점 횟수, 정답을 화면에서 본 적 있는가 }.
   * FSRS 에 정직하게 올릴 자격은 단어당 레이스 1회뿐이다.
   */
  const gradedRef = useRef(new Map<string, { n: number; revealed: boolean }>());
  /** 이번 레이스의 랩 페이스 표본(패배 랩 포함). */
  const paceRef = useRef<number[]>([]);
  /** 탭 복귀 유예 종료 시각(performance.now 기준). 0 이면 유예 없음. */
  const resumeAtRef = useRef(0);
  /** 이번 문항의 입력이 IME 제안/붙여넣기로 한 번에 채워졌는가. */
  const autoFillRef = useRef(false);
  const typedRef = useRef('');
  /**
   * 이번 문항 도중 탭이 숨겨졌다 돌아왔는가.
   * 일시정지는 사람의 사정(전화·알림)을 위한 것이라 게임에서는 벌하지 않지만,
   * 화면 밖에서 얼마든지 찾아볼 수 있었으므로 **정답**은 독립 인출로 세지 않는다.
   * (오답은 그대로 정직하게 올린다 — 모르는 단어를 FSRS 에서 지우면 안 된다.)
   */
  const pausedQRef = useRef(false);
  /** 마지막 '제출 결과' 낭독 시각 — 리드 밴드 변화가 이를 덮어쓰지 않게 한다. */
  const srAtRef = useRef(0);
  const youRef = useRef(0);
  const ghostSegRef = useRef(0);
  const ghostClockRef = useRef(0);
  const lapStartRef = useRef(0);
  const lapMsRef = useRef(lapMs);
  const stallCreditRef = useRef(0);
  const stallGrantedRef = useRef(0);
  const stallUsedRef = useRef(0);
  const graceRef = useRef(0);
  const lapEndedRef = useRef(false);
  const lockRef = useRef(false);
  const lineRef = useRef<Line>('in');
  const nextLineRef = useRef<Line>('in');
  const outLockRef = useRef(0);
  const lapIdxRef = useRef(0);
  const lapResRef = useRef<boolean[]>([]);
  const lapTimesRef = useRef<number[]>([]);
  const missedRef = useRef<Word[]>([]);
  const prevBandRef = useRef(99);
  const focusIdxRef = useRef<number | null>(null);
  const ghostElRef = useRef<HTMLSpanElement | null>(null);
  const ghostLineElRef = useRef<HTMLDivElement | null>(null);
  const tilesWrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const after = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      if (mountedRef.current) fn();
    }, ms);
    timersRef.current.push(id);
    return id;
  }, []);
  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, []);

  /**
   * 라이브 리전 단일 창구 — prio 2(제출 결과)가 prio 1(리드 밴드 변화·레인 토스트)을 이긴다.
   * 예전엔 정답 낭독 직후 밴드 이펙트가 같은 배치에서 '앞섬 1구간' 으로 덮어써,
   * 스크린리더 사용자가 **정확히 성공한 순간에** 정답 낭독을 잃었다.
   */
  const say = useCallback((text: string, prio: 1 | 2) => {
    const now = performance.now();
    if (prio < 2 && now - srAtRef.current < 900) return;
    if (prio >= 2) srAtRef.current = now;
    setSrMsg(text);
  }, []);

  const laneToast = useCallback((msg: string) => {
    setToast(msg);
    say(msg, 1); // 토스트 자체는 aria-hidden — 낭독은 여기 한 곳에서만
    after(1400, () => setToast(''));
  }, [after, say]);

  const combo = useCombo({
    tiers: COMBO_TIERS,
    onTierUp: (t, c) => {
      if (!t.label) return;
      laneToast(`${t.label} · 정답마다 유령 ${(stallForCombo(c) / 1000).toFixed(1)}초 정지`);
    },
  });
  const comboHit = combo.hit;
  const comboMiss = combo.miss;
  const comboReset = combo.reset;

  // ─── 단어 큐 — 같은 랩에서 같은 단어가 3~4번 나오던 순수 랜덤을 버린다 ───
  const drawWord = useCallback((): Word => {
    const n = drawNoRef.current;
    drawNoRef.current = n + 1;
    const pend = pendingRef.current;

    // ① 재삽입 예정 시점이 된 단어가 있으면 그것부터.
    const due = pend.findIndex((p) => p.at <= n);
    if (due >= 0) {
      const w = pend.splice(due, 1)[0].w;
      lastDrawnRef.current = w.en;
      return w;
    }

    // ② 대기 중인 단어와 직전 문항은 자연 큐에서도 건너뛴다.
    //    (예전엔 재삽입 대기 중인 단어를 셔플 큐가 그대로 다시 뽑아, 8문항 간격 약속이 새어
    //     6개 풀에서 최소 1문항 만에 같은 문항이 돌아왔다. 셔플 경계 충돌도 여기서 함께 막힌다.)
    const held = new Set(pend.map((p) => p.w.en));
    if (queueRef.current.length === 0) queueRef.current = shuffle(pool);
    const idx = queueRef.current.findIndex((w) => !held.has(w.en) && w.en !== lastDrawnRef.current);
    if (idx >= 0) {
      const w = queueRef.current.splice(idx, 1)[0];
      lastDrawnRef.current = w.en;
      return w;
    }

    // ③ 풀이 작아 남은 후보가 전부 대기 중이면, 가장 오래 기다린 단어를 앞당긴다.
    //    (간격 약속은 풀 크기를 넘을 수 없다 — 6개 풀에서는 6문항이 물리적 상한이다.)
    if (pend.length > 0) {
      let oldest = 0;
      for (let i = 1; i < pend.length; i++) if (pend[i].at < pend[oldest].at) oldest = i;
      const w = pend.splice(oldest, 1)[0].w;
      lastDrawnRef.current = w.en;
      return w;
    }
    const w = queueRef.current.shift() ?? shuffle(pool)[0];
    lastDrawnRef.current = w.en;
    return w;
  }, [pool]);

  /**
   * 오답 단어 재삽입 — **문항 번호 기준**으로 REQUEUE_GAP 개 뒤에 되돌린다.
   * 예전엔 큐 배열의 3번 인덱스에 splice 했는데, 풀이 6개면 3~4문항 뒤에 같은 한국어가
   * 같은 타일 세트로 돌아왔다(작업기억 4항목 안 = 리빌이 곧 정답 과외).
   * 큐가 비어 재셔플되면 배열 인덱스는 의미를 잃으므로 카운터로 미룬다.
   */
  const requeue = useCallback((w: Word) => {
    pendingRef.current = pendingRef.current.filter((p) => p.w.en !== w.en);
    pendingRef.current.push({ w, at: drawNoRef.current + REQUEUE_GAP });
  }, []);

  /**
   * FSRS 채점 — 레이스당 단어별 **첫 1회만** 정직하게 올린다.
   * 두 번째부터, 그리고 이미 정답을 화면에서 본 뒤의 입력(리빌 후 재출제 · IME 자동완성)은
   * `{ assisted: true }` 로 올려 카드 갱신에서 빠진다(판정은 record-result 중앙에서).
   *
   * **호출 자체를 빼지 않는다.** 못 쓴 단어를 아무것도 안 올리면 합리적인 플레이어일수록
   * 자기가 모르는 단어를 FSRS 에서 지워버리는 결과가 된다 — 모르는 단어일수록
   * 오답으로 정직하게 올라가야 복습이 잡힌다.
   */
  const grade = useCallback((w: Word, isCorrect: boolean, forcedAssist: boolean) => {
    const key = w.en.toLowerCase();
    const rec = gradedRef.current.get(key) ?? { n: 0, revealed: false };
    const assisted = forcedAssist || rec.n > 0 || rec.revealed;
    gradedRef.current.set(key, { n: rec.n + 1, revealed: rec.revealed || !isCorrect });
    if (isCorrect) onCorrect?.(w, { assisted });
    else onWrong?.(w, { assisted });
  }, [onCorrect, onWrong]);

  const nextQuestion = useCallback(() => {
    if (outLockRef.current > 0) {
      outLockRef.current -= 1;
      setOutLock(outLockRef.current);
      if (outLockRef.current > 0) { nextLineRef.current = 'in'; setNextLine('in'); }
    }
    const use = outLockRef.current > 0 ? 'in' : nextLineRef.current;
    lineRef.current = use;
    setLine(use);

    const t = drawWord();
    const lapNo = lapIdxRef.current;
    const tiles = Math.min(pool.length, lapNo >= 2 ? 5 : 4);
    setTarget(t);
    setOptions(use === 'in' ? shuffle([t, ...pickDistractors(pool, t, tiles - 1, lapNo >= 1)]) : []);
    setPicked(null);
    setVerdict(null);
    setReveal(false);
    setTyped('');
    typedRef.current = '';
    autoFillRef.current = false;
    pausedQRef.current = false;
    setAutoFilledShown(false);
    setQKey((n) => n + 1);
    lockRef.current = false;
  }, [drawWord, pool]);

  // ─── 유령 정지(콤보·아웃코스·슬립스트림 보상) — 랩당 상한이 있다(티어가 올라갈수록 조인다) ───
  const stallGhost = useCallback((ms: number) => {
    if (ms <= 0) return 0;
    const cap = lapMsRef.current * tierOf(storeRef.current.lapWins).stallCap;
    const allowed = Math.max(0, Math.min(ms, cap - stallGrantedRef.current));
    if (allowed <= 0) return 0;
    stallGrantedRef.current += allowed;
    stallCreditRef.current += allowed;
    return allowed;
  }, []);

  // ─── 레이스 종료 ───
  const endRace = useCallback((results: boolean[]) => {
    const wins = results.filter(Boolean).length;
    const bestLap = lapTimesRef.current.length ? Math.min(...lapTimesRef.current) : null;
    const prev = storeRef.current;
    const raceWon = wins >= 2;
    const lossStreak = raceWon ? 0 : prev.lossStreak + 1;
    // 승리 랩은 실측, 패배 랩은 도달 구간 환산 — 둘 다 표본에 들어가야 유령이 양방향으로 움직인다.
    const next: Store = {
      lapWins: prev.lapWins + wins,
      races: prev.races + 1,
      raceWins: prev.raceWins + (raceWon ? 1 : 0),
      recentLapMs: [...prev.recentLapMs, ...paceRef.current].slice(-PACE_SAMPLES),
      lossStreak,
    };
    setStore(next);
    storeRef.current = next;
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* private mode */ }

    const promotedTo = tierOf(prev.lapWins).name !== tierOf(next.lapWins).name ? tierOf(next.lapWins).name : null;
    const pbRes = bestLap != null ? pb.submit(Math.round(bestLap / 100) / 10) : { improved: false, prev: pb.best };

    const seenM = new Set<string>();
    const missed = missedRef.current.filter((w) => (seenM.has(w.en) ? false : (seenM.add(w.en), true))).slice(0, 8);

    setResult({
      lapWins: wins,
      bestLap,
      improved: pbRes.improved,
      prevBest: pbRes.prev,
      promoted: promotedTo,
      missed,
    });
    setPhase('result');
    if (raceWon) sfx.fanfare(); else sfx.click(); // 패배를 오답 버저로 닫지 않는다
  }, [pb, sfx]);

  // ─── 랩 종료 ───
  const endLap = useCallback((youWon: boolean) => {
    if (lapEndedRef.current) return;
    lapEndedRef.current = true;
    lockRef.current = true;
    resumeAtRef.current = 0;
    setResuming(false);
    clearTimers();
    const ms = Math.round(performance.now() - lapStartRef.current);
    const results = [...lapResRef.current, youWon];
    lapResRef.current = results;
    if (youWon) lapTimesRef.current.push(ms);
    // 유령 페이스 표본 — 패배 랩도 '도달 구간 환산 완주 시간' 으로 남긴다.
    // 승리만 모으면 중앙값이 내려가기만 해서 예전 bestLapMs 와 같은 일방향 래칫이 된다.
    paceRef.current.push(paceSample(ms, youRef.current, youWon));
    setLapRes(results);

    if (youWon) {
      const ghostFinish = lapMsRef.current + stallUsedRef.current;
      const diff = Math.max(0, ghostFinish - ms);
      setLapEndMsg(`유령보다 ${(diff / 1000).toFixed(1)}초 앞서 통과했어요`);
    } else {
      const left = Math.max(1, SEG - youRef.current);
      setLapEndMsg(`${left}구간 남기고 따라잡혔어요`);
    }
    setPhase('lapend');

    const last = lapIdxRef.current >= LAPS - 1;
    after(LAPEND_MS, () => {
      if (last) endRace(results);
      else {
        const ni = lapIdxRef.current + 1;
        lapIdxRef.current = ni;
        setLapIdx(ni);
        setPhase('grid');
      }
    });
  }, [after, clearTimers, endRace]);

  // rAF 루프가 매 렌더마다 재시작되지 않도록 종료 콜백은 ref 로 고정한다
  // (useSfx·usePersonalBest 가 매 렌더 새 객체를 돌려주므로 콜백 아이덴티티가 계속 바뀐다).
  const endLapRef = useRef(endLap);
  endLapRef.current = endLap;

  // ─── 랩 시작 (grid → racing) ───
  const beginLap = useCallback(() => {
    youRef.current = 0;
    ghostSegRef.current = 0;
    ghostClockRef.current = 0;
    stallCreditRef.current = 0;
    stallGrantedRef.current = 0;
    stallUsedRef.current = 0;
    graceRef.current = 0;
    lapEndedRef.current = false;
    outLockRef.current = 0;
    prevBandRef.current = 99;
    resumeAtRef.current = 0;
    comboReset();
    setResuming(false);
    setYouSeg(0);
    setGhostSeg(0);
    setOutLock(0);
    setFinalStretch(false);
    setToast('');
    if (ghostElRef.current) ghostElRef.current.style.left = 'calc(0% - 15px)';
    if (ghostLineElRef.current) ghostLineElRef.current.style.width = '0%';
    lapStartRef.current = performance.now();
    nextQuestion();
    setPhase('racing');
  }, [comboReset, nextQuestion]);

  // grid — 이 랩의 유령 목표를 먼저 확정하고(화면에 그 숫자를 약속한다) 3·2·1 카운트다운.
  useEffect(() => {
    if (phase !== 'grid') return;
    const wins = lapResRef.current.filter(Boolean).length;
    const ms = computeLapMs(lapIdxRef.current, storeRef.current, wins);
    lapMsRef.current = ms;
    setLapMs(ms);
    // 출발선 화면에서는 트랙도 0-0 으로 되돌린다(랩 결과는 직전 lapend 화면이 이미 보여줬다).
    setYouSeg(0);
    setGhostSeg(0);
    setVerdict(null);
    setFinalStretch(false);
    if (ghostElRef.current) ghostElRef.current.style.left = 'calc(0% - 15px)';
    if (ghostLineElRef.current) ghostLineElRef.current.style.width = '0%';
    setGridCount(3);
    const ids = [
      window.setTimeout(() => mountedRef.current && setGridCount(2), GRID_TICK_MS),
      window.setTimeout(() => mountedRef.current && setGridCount(1), GRID_TICK_MS * 2),
      window.setTimeout(() => mountedRef.current && beginLap(), GRID_TICK_MS * 3),
    ];
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [phase, lapIdx, beginLap]);

  // ─── 유령 페이스 클록 (rAF · 벽시계 델타 · 네거티브 스플릿 · 탭 비가시 일시정지) ───
  useEffect(() => {
    if (phase !== 'racing') return;
    let raf = 0;
    let last = performance.now();
    let wasHidden = false;
    const loop = () => {
      if (!mountedRef.current || lapEndedRef.current) return;
      const now = performance.now();
      // 탭 복귀 유예 — 숨어 있던 시간이 통째로 유령 클록에 더해지지 않게 last 를 끌고 가면서
      // 1.2초 동안 유령을 세워 둔다. 전화 한 통이 랩 즉사가 되던 경로를 끊는다.
      if (resumeAtRef.current > now) {
        last = now;
        raf = requestAnimationFrame(loop);
        return;
      }
      if (resumeAtRef.current !== 0) {
        resumeAtRef.current = 0;
        setResuming(false);
      }
      let dt = now - last;
      last = now;
      if (dt < 0) dt = 0;
      if (stallCreditRef.current > 0) {
        const c = Math.min(dt, stallCreditRef.current);
        stallCreditRef.current -= c;
        stallUsedRef.current += c;
        dt -= c;
      }
      ghostClockRef.current += dt;
      const p = clamp(ghostClockRef.current / lapMsRef.current, 0, 1);
      const segF = SEG * Math.pow(p, PACE_EXP);
      const pct = clamp((segF / SEG) * 100, 0, 100);
      const gEl = ghostElRef.current;
      if (gEl) {
        gEl.style.left = `calc(${pct}% - 15px)`;
        const st = stallCreditRef.current > 0 ? '1' : '0';
        if (gEl.dataset.stalled !== st) gEl.dataset.stalled = st;
      }
      if (ghostLineElRef.current) ghostLineElRef.current.style.width = `${pct}%`;
      const gi = Math.min(SEG, Math.floor(segF));
      if (gi !== ghostSegRef.current) {
        ghostSegRef.current = gi;
        setGhostSeg(gi);
      }
      if (segF >= SEG) {
        // 포토피니시 — 마지막 한 구간을 남긴 도전자에게 400ms 를 준다(무승부는 도전자 승).
        // 예전엔 `lockRef`(= 이미 제출해 리빌 중) 까지 요구해서, 리빌 1250ms 안에 다음 문항이
        // 뜨지 않으니 사실상 발동하지 않았다. 조건을 '11구간 도달' 하나로 줄인다.
        if (graceRef.current === 0 && youRef.current >= SEG - 1) {
          graceRef.current = now + PHOTO_FINISH_MS;
        }
        if (graceRef.current > now) {
          raf = requestAnimationFrame(loop);
          return;
        }
        endLapRef.current(false);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        wasHidden = true;
        cancelAnimationFrame(raf);
        return;
      }
      if (!wasHidden) return;
      wasHidden = false;
      if (!mountedRef.current || lapEndedRef.current) return;
      last = performance.now();
      resumeAtRef.current = last + RESUME_GRACE_MS;
      pausedQRef.current = true;
      setResuming(true);
      raf = requestAnimationFrame(loop);
    };
    document.addEventListener('visibilitychange', onVis);
    raf = requestAnimationFrame(loop);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      cancelAnimationFrame(raf);
    };
  }, [phase]);

  // 최종 구간 고조
  useEffect(() => {
    if (phase !== 'racing') return;
    const on = Math.max(youSeg, ghostSeg) >= SEG - 4;
    setFinalStretch((prev) => (prev === on ? prev : on));
  }, [youSeg, ghostSeg, phase]);

  // 리드 변화만 알린다(문항마다 떠들지 않게)
  useEffect(() => {
    if (phase !== 'racing') return;
    const gap = youSeg - ghostSeg;
    const band = gap >= 2 ? 2 : gap === 1 ? 1 : gap === 0 ? 0 : gap === -1 ? -1 : -2;
    if (band === prevBandRef.current) return;
    prevBandRef.current = band;
    // prio 1 — 제출 결과 낭독(prio 2) 이 아직 900ms 안이면 덮지 않는다.
    say(
      band === 2 ? `앞섬 ${gap}구간`
        : band === 1 ? '앞섬 1구간'
          : band === 0 ? '유령과 나란히'
            : band === -1 ? '뒤처짐 1구간'
              : `뒤처짐 ${-gap}구간`,
      1,
    );
  }, [youSeg, ghostSeg, phase, say]);

  // ─── 전진 ───
  const advance = useCallback((d: number) => {
    const v = clamp(youRef.current + d, 0, SEG);
    youRef.current = v;
    setYouSeg(v);
    return v;
  }, []);

  // ─── 제출 ───
  const submit = useCallback((raw: string, tileIdx: number | null) => {
    if (phase !== 'racing' || !target || lockRef.current || lapEndedRef.current) return;
    if (resumeAtRef.current > performance.now()) return; // 탭 복귀 재출발 유예 중
    lockRef.current = true;

    const isOut = lineRef.current === 'out';
    // IME 제안 스트립·붙여넣기로 한 번에 채워진 철자는 '생성 인출' 이 아니다.
    const autoFilled = isOut && autoFillRef.current;
    const answers = [target.en, ...(target.inflected ?? [])].map((s) => norm(s));
    const given = norm(raw);
    const ok = isOut ? answers.includes(given) : given === norm(target.en);
    const near = !ok && isOut && given.length > 0 && answers.some((a) => isOneEdit(given, a));

    const gap = youRef.current - ghostSegRef.current;
    setPicked(tileIdx);
    setReveal(true);

    if (ok) {
      const nc = comboHit();
      // 자동완성은 벌하지 않는다 — 다만 철자를 만든 게 아니므로 인코스와 같은 +1 만 준다.
      const gain = autoFilled ? 1 : isOut ? (gap >= 3 ? 3 : 2) : 1;
      const pos = advance(gain);
      if (isOut && !autoFilled) stallGhost(OUT_STALL_MS);
      // 슬립스트림 — 칸을 두 배로 주는 대신 유령을 잠깐 묶는다(리드 구축이 손해가 되지 않게).
      const slip = !isOut && gap <= SLIPSTREAM_AT ? stallGhost(SLIPSTREAM_STALL_MS) : 0;
      stallGhost(stallForCombo(nc));
      setVerdict('correct');
      setAutoFilledShown(autoFilled);
      sfx.correct(nc, nc % 5 === 0);
      // 자동완성으로 채웠거나 이 문항 도중 탭을 떠났다 왔으면 독립 인출이 아니다.
      grade(target, true, autoFilled || pausedQRef.current);
      say(`정답 ${target.en} · ${gain}구간 전진`, 2);
      if (slip > 0) laneToast(`슬립스트림 · 유령 ${(slip / 1000).toFixed(1)}초 정지`);
      if (pos >= SEG) { endLap(true); return; }
      after(isOut ? REVEAL_OK_OUT_MS : REVEAL_OK_MS, () => { if (!lapEndedRef.current) nextQuestion(); });
      return;
    }

    comboMiss();
    // 모르는 단어는 **정직한 오답으로** 올라간다(레이스 첫 채점이면 assisted 아님).
    grade(target, false, false);
    missedRef.current.push(target);
    requeue(target);

    if (isOut && near) {
      // 철자 하나 차이 — 칸도 잃지 않고 복귀 잠금도 걸지 않는다(비난 금지, 다만 콤보는 끊긴다).
      setVerdict('near');
      sfx.nearMiss();
      say(`아까워요, 정답은 ${target.en}`, 2);
    } else if (isOut) {
      const loss = gap >= 3 ? 2 : 1;
      advance(-loss);
      outLockRef.current = OUT_LOCK_Q;
      setOutLock(OUT_LOCK_Q);
      nextLineRef.current = 'in';
      setNextLine('in');
      setVerdict('wrong');
      sfx.wrong();
      say(`정답은 ${target.en} · ${loss}구간 후퇴, 인코스로 복귀`, 2);
    } else {
      // 인코스 오답의 위치 비용 — 리드를 IN_WRONG_LEAD_MIN 이상 쌓았을 때만 1칸을 반납한다.
      // 뒤처지거나 나란한 사람에게는 여전히 후퇴가 없다(정답률 0.5 대 보호).
      const loss = gap >= IN_WRONG_LEAD_MIN ? 1 : 0;
      if (loss > 0) advance(-loss);
      setVerdict('wrong');
      sfx.wrong();
      say(loss > 0 ? `정답은 ${target.en} · 리드 1구간 반납` : `정답은 ${target.en}`, 2);
    }
    after(REVEAL_NG_MS, () => { if (!lapEndedRef.current) nextQuestion(); });
  }, [
    phase, target, comboHit, comboMiss, advance, stallGhost, sfx, grade, say,
    after, nextQuestion, endLap, requeue, laneToast,
  ]);

  // ─── 라인 전환 (다음 구간부터 — 선택지를 본 뒤 타이핑으로 갈아타는 새치기 차단) ───
  const chooseLine = useCallback((l: Line) => {
    if (l === 'out' && outLockRef.current > 0) return;
    if (nextLineRef.current === l) return;
    nextLineRef.current = l;
    setNextLine(l);
    sfx.click();
  }, [sfx]);

  // ─── 재시작 ───
  const restart = useCallback(() => {
    clearTimers();
    queueRef.current = [];
    pendingRef.current = [];
    drawNoRef.current = 0;
    lastDrawnRef.current = '';
    gradedRef.current = new Map(); // 채점 원장은 레이스 단위 — 새 레이스에서 다시 1회씩 정직하게
    paceRef.current = [];
    missedRef.current = [];
    lapTimesRef.current = [];
    lapResRef.current = [];
    lapIdxRef.current = 0;
    nextLineRef.current = 'in';
    lineRef.current = 'in';
    outLockRef.current = 0;
    resumeAtRef.current = 0;
    setResuming(false);
    setLapRes([]);
    setLapIdx(0);
    setNextLine('in');
    setLine('in');
    setOutLock(0);
    setResult(null);
    setLapEndMsg('');
    setPhase('grid');
  }, [clearTimers]);

  const handleExit = useCallback(() => { clearTimers(); onExit?.(); }, [clearTimers, onExit]);

  const skipGrid = useCallback(() => {
    if (phase !== 'grid') return;
    clearTimers();
    beginLap();
  }, [phase, clearTimers, beginLap]);

  // ─── 키보드 ───
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
      if (phase === 'grid') {
        if (e.key === '1') { e.preventDefault(); chooseLine('in'); }
        else if (e.key === '2') { e.preventDefault(); chooseLine('out'); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skipGrid(); }
        return;
      }
      if (phase !== 'racing' || typing) return;
      if (e.key >= '1' && e.key <= '5') {
        const i = Number(e.key) - 1;
        if (lineRef.current !== 'in' || reveal || i >= options.length) return;
        e.preventDefault();
        focusIdxRef.current = i;
        submit(options[i].en, i);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, options, reveal, submit, chooseLine, skipGrid]);

  // 재출발 유예는 시각 배지(aria-hidden)로 보이므로, 낭독은 라이브 리전 한 곳에서 따로 준다.
  useEffect(() => {
    if (resuming) say('돌아왔어요 · 유령을 잠시 세웠습니다', 2);
  }, [resuming, say]);

  // 리빌 뒤 포커스 복원 — disabled 대신 aria-disabled 를 쓰므로 포커스가 날아가지 않지만,
  // 문항이 교체되면 노드가 바뀌므로 키보드 사용자에게 같은 자리로 되돌려준다.
  useEffect(() => {
    if (phase !== 'racing' || reveal) return;
    if (line === 'out') { inputRef.current?.focus(); return; }
    const i = focusIdxRef.current;
    if (i == null) return;
    const btns = tilesWrapRef.current?.querySelectorAll<HTMLButtonElement>('.gr-tile');
    btns?.[Math.min(i, (btns.length || 1) - 1)]?.focus();
  }, [qKey, phase, reveal, line]);

  if (!enough) return <NotEnoughWords need={6} onExit={onExit} />;

  const tier = tierOf(store.lapWins);
  const gap = youSeg - ghostSeg;
  const inSlip = gap <= SLIPSTREAM_AT;      // 인코스 정답 시 유령 0.5초 정지
  const inLoss = gap >= IN_WRONG_LEAD_MIN ? 1 : 0; // 인코스 오답 시 반납할 칸
  const outGain = gap >= 3 ? 3 : 2;
  const outLoss = gap >= 3 ? 2 : 1;
  const youPct = (youSeg / SEG) * 100;
  const comboStall = stallForCombo(combo.combo);
  const lapWinCount = lapRes.filter((r) => r === true).length;
  const lapLossCount = lapRes.filter((r) => r === false).length;

  const gapText = gap > 0 ? `앞섬 ${gap}구간` : gap < 0 ? `뒤처짐 ${-gap}구간` : '나란히';
  const raceWins = result?.lapWins ?? 0;

  return (
    <div className="gk-root gr-root" data-final={finalStretch ? '1' : '0'}>
      <GameMusic gameId="ghost-race" />
      <div className="gk-sr" aria-live="polite">{srMsg}</div>
      <GameKitStyles />
      <AmbientBackground
        center="#F4EBF6" mid="#DEC8E7" edge="#4E3277"
        glow="rgba(255,120,205,.36)" glowAt="50% 15%" watermark="ghost-race"
      />
      <style dangerouslySetInnerHTML={{ __html: GR_CSS }} />

      <Hud
        progress={youSeg / SEG}
        combo={combo.combo}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={
          <div className="gr-hudx">
            <div className="gr-league" style={{ color: tier.color }}>
              <span className="gk-stat-label">리그</span>
              <span className="gr-tier">{tier.name} · {store.lapWins}랩승</span>
            </div>
            {/* 3판 2선승 스코어를 핍 색만이 아니라 이름으로도 준다 —
                예전엔 시각장애 사용자가 랩 스코어를 lapend 화면 외에서 알 방법이 없었다. */}
            <div
              className="gr-lappips"
              role="img"
              aria-label={`랩 ${Math.min(lapIdx + 1, LAPS)} / ${LAPS} · ${lapWinCount}승 ${lapLossCount}패`}
            >
              {Array.from({ length: LAPS }, (_, i) => (
                <span
                  key={i}
                  className="gr-lappip"
                  data-state={lapRes[i] === true ? 'win' : lapRes[i] === false ? 'loss' : i === lapIdx ? 'now' : 'idle'}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
        }
      />

      {/* 트랙 */}
      <div className="gr-track" data-final={finalStretch ? '1' : '0'}>
        <div className="gr-lane gr-lane--you" aria-hidden="true">
          <div className="gr-line gr-line--you" style={{ width: `${youPct}%` }} data-blaze={combo.combo >= 6 ? '1' : '0'} />
          {/* 파티클을 타일이 아니라 러너에 붙인다 — 타일은 480ms 뒤 교체되며 버스트째 사라지고,
              아웃코스(타일 없음) 성공은 아예 터질 자리가 없었다. 러너는 랩 내내 살아 있다. */}
          <span className="gr-runner gr-you" style={{ left: `calc(${youPct}% - 15px)` }} data-verdict={verdict ?? 'none'}>
            🏃
            {verdict === 'correct' && (
              <ParticleBurst
                key={`${qKey}-${youSeg}`}
                intensity={1 + clamp(Math.floor(combo.combo / 4), 0, 3)}
                colors={combo.combo >= 6 ? ['var(--streak)', 'var(--combo)'] : undefined}
              />
            )}
          </span>
          <span className="gr-flag">🏁</span>
        </div>
        <div className="gr-lane gr-lane--ghost" aria-hidden="true">
          <div className="gr-line gr-line--ghost" ref={ghostLineElRef} />
          <span className="gr-runner gr-ghost" ref={ghostElRef} data-stalled="0">👻</span>
        </div>
        <div className="gr-meta">
          <span className="gr-meta-score">🏃 {youSeg} <span className="gr-meta-mid">vs</span> {ghostSeg} 👻</span>
          <span className="gr-meta-gap" data-sign={gap > 0 ? 'up' : gap < 0 ? 'down' : 'even'}>
            <span aria-hidden="true">{gap > 0 ? '▲' : gap < 0 ? '▼' : '＝'}</span> {gapText}
          </span>
          <span className="gr-meta-lap">랩 {Math.min(lapIdx + 1, LAPS)}/{LAPS} · 유령 {(lapMs / 1000).toFixed(1)}초</span>
        </div>
        {/* 낭독은 상단 gk-sr 한 곳에서만 — 여기 role="status" 를 두면 라이브 리전이 둘이 되어
            정답 낭독과 경합한다(laneToast 가 gk-sr 로 prio 1 낭독을 이미 보낸다). */}
        {toast && <div className="gr-toast" aria-hidden="true">{toast}</div>}
        {resuming && (
          <div className="gr-resume" aria-hidden="true">
            <span className="gr-resume-mark">⏸</span> 돌아왔어요 · 유령을 세워 뒀습니다
          </div>
        )}
      </div>

      {phase === 'result' && result ? (
        <GameDone
          mark="ghost-race"
          lead={
            raceWins === 3 ? '3랩 완봉 — 유령을 완전히 따돌렸어요'
              : raceWins === 2 ? '레이스 승리 — 유령을 앞질렀어요'
                : raceWins === 1 ? '1랩을 가져왔어요. 다음엔 두 랩'
                  : '오늘은 유령이 빨랐어요. 페이스는 남아 있어요'
          }
          celebrate={raceWins === 3}
          badge={
            result.improved ? `랩 신기록 ${result.prevBest?.toFixed(1)}초 → ${((result.bestLap ?? 0) / 1000).toFixed(1)}초`
              : result.promoted ? `${result.promoted} 승급`
                : raceWins === 3 ? '완봉'
                  : undefined
          }
          reveal={
            result.missed.length > 0 ? (
              <div className="gr-missed">
                <p className="gr-missed-h">이번 레이스에서 놓친 단어</p>
                <ul className="gr-missed-l">
                  {result.missed.map((w) => (
                    <li key={w.en}><b>{w.en}</b><span>{w.ko}</span></li>
                  ))}
                </ul>
              </div>
            ) : undefined
          }
          stats={[
            { num: `${raceWins}/${LAPS}`, label: '랩 승', accent: true },
            { num: result.bestLap != null ? `${(result.bestLap / 1000).toFixed(1)}s` : '—', label: '최고 랩' },
            { num: tier.name, label: `누적 ${store.lapWins}랩승` },
          ]}
          best={
            result.bestLap != null
              ? {
                prev: result.prevBest,
                now: Math.round(result.bestLap / 100) / 10,
                label: '랩 기록(초)',
                improved: result.improved,
              }
              : undefined
          }
          restartLabel={raceWins >= 2 ? '한 랩 더 빠르게' : '재대결'}
          restartHint={
            raceWins >= 2
              ? nextTierOf(store.lapWins)
                ? `${nextTierOf(store.lapWins)!.name}까지 ${nextTierOf(store.lapWins)!.min - store.lapWins}랩승`
                : '유령은 이제 당신의 최고 랩을 따라옵니다'
              : `${-SLIPSTREAM_AT}구간 뒤처지면 인코스 정답마다 유령이 잠깐 멈춰요 — 거기서 붙이세요`
          }
          onRestart={restart}
          onExit={handleExit}
        />
      ) : phase === 'grid' ? (
        <main className="gk-stage gr-grid">
          <p className="gr-grid-lap">랩 {lapIdx + 1} / {LAPS}</p>
          <p className="gr-grid-count" aria-hidden="true">{gridCount}</p>
          <p className="gr-grid-pace">유령 목표 {(lapMs / 1000).toFixed(1)}초 · {SEG}구간</p>
          <LineSwitch
            nextLine={nextLine}
            outLock={outLock}
            inSlip={false}
            inLoss={0}
            outGain={2}
            outLoss={1}
            onChoose={chooseLine}
            heading="출발 라인"
          />
          <button type="button" className="gk-btn gr-gostart" onClick={skipGrid}>바로 출발</button>
          <p className="gr-hint">
            <Kbd>1</Kbd> 인코스 · <Kbd>2</Kbd> 아웃코스 · <Kbd>Enter</Kbd> 출발
          </p>
        </main>
      ) : phase === 'lapend' ? (
        <main className="gk-stage gr-lapend" role="status">
          <p className="gr-lapend-h">{lapRes[lapRes.length - 1] ? '랩 획득' : '랩 내줌'}</p>
          <p className="gr-lapend-m">{lapEndMsg}</p>
          <div className="gr-lapend-pips" aria-hidden="true">
            {lapRes.map((r, i) => <span key={i} className="gr-lappip gr-lappip--big" data-state={r ? 'win' : 'loss'} />)}
          </div>
        </main>
      ) : target ? (
        <main className="gk-stage gr-stage">
          <div className="gr-lineflag" data-line={line}>
            <span className="gr-lineflag-mark" aria-hidden="true">{line === 'out' ? '◆' : '●'}</span>
            {line === 'out' ? '아웃코스 · 철자를 직접 입력' : '인코스 · 보기에서 고르기'}
          </div>

          <h1 className="gr-meaning" key={qKey}>{target.ko}</h1>

          {line === 'in' ? (
            <div
              ref={tilesWrapRef}
              className={`gr-tiles ${options.length <= 2 ? 'gr-tiles--two' : ''}`}
            >
              {options.map((o, i) => {
                const isAns = o.en === target.en;
                const isPick = picked === i;
                const tone = reveal ? (isAns ? 'gk-tile--correct' : isPick ? 'gk-tile--wrong' : 'gk-tile--dim') : '';
                return (
                  <button
                    key={`${qKey}-${o.en}`}
                    type="button"
                    className={`gk-tile gr-tile ${tone}`}
                    aria-disabled={reveal}
                    onClick={() => { if (!reveal) { focusIdxRef.current = null; submit(o.en, i); } }}
                  >
                    <span className="gr-tile-key" aria-hidden="true">{i + 1}</span>
                    <span className="gr-tile-en">{o.en}</span>
                    {reveal && isAns && <FeedbackIcon kind="correct" size={16} />}
                    {reveal && isPick && !isAns && <FeedbackIcon kind="wrong" size={16} />}
                  </button>
                );
              })}
            </div>
          ) : (
            <form
              className="gr-sprint"
              onSubmit={(e) => {
                e.preventDefault();
                // 빈 제출은 무시 — Enter 오타로 한 구간을 잃지 않게. 대신 시계(=유령)는 계속 간다.
                if (!reveal && typed.trim().length > 0) submit(typed, null);
              }}
            >
              <label className="gr-sprint-lbl" htmlFor="gr-sprint-input">영어 철자를 입력하세요</label>
              <div className="gr-sprint-row">
                <input
                  id="gr-sprint-input"
                  ref={inputRef}
                  className="gr-sprint-input"
                  value={typed}
                  onChange={(e) => {
                    const next = e.target.value;
                    // 안드로이드 IME(Gboard 등)의 상단 제안 스트립은 autoComplete/autoCorrect/
                    // spellCheck 를 전부 무시한다. 물리 입력과 구분되는 유일한 신호는
                    // "한 번에 두 글자 이상이 채워지는 것" — 키 입력은 브라우저가 글자마다
                    // input 이벤트를 낸다. 막지는 않고, 생성 인출로 세지 않기 위해 표시만 한다.
                    if (next.length - typedRef.current.length >= 2) autoFillRef.current = true;
                    typedRef.current = next;
                    setTyped(next);
                  }}
                  onPaste={(e) => { e.preventDefault(); autoFillRef.current = true; }}
                  readOnly={reveal}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  inputMode="text"
                  placeholder="영어 단어"
                  aria-describedby="gr-sprint-help"
                />
                <button type="submit" className="gk-btn gk-btn--primary gr-sprint-go" aria-disabled={reveal}>
                  제출
                </button>
              </div>
              <p id="gr-sprint-help" className="gr-sprint-help">
                성공 +{outGain}구간 · 유령 {(OUT_STALL_MS / 1000).toFixed(1)}초 정지 / 실패 −{outLoss}구간
              </p>
            </form>
          )}

          {/* 정답 공개는 제출 후에만. 낭독은 상단 gk-sr 라이브 리전 한 곳에서만 한다(중복 발화 방지). */}
          <div className="gr-reveal" data-open={reveal ? '1' : '0'} data-kind={verdict ?? 'none'}>
            {reveal && target && (
              <>
                <span className="gr-reveal-head">
                  <FeedbackIcon kind={verdict === 'correct' ? 'correct' : verdict === 'near' ? 'near' : 'wrong'} size={15} />
                  <b className="gr-reveal-en">{target.en}</b>
                  {target.pron && <i className="gr-reveal-pron">{target.pron}</i>}
                  <span className="gr-reveal-ko">{target.ko}</span>
                  {verdict === 'near' && <span className="gr-reveal-tag">철자 하나 차이 — 칸은 지켰어요</span>}
                  {autoFilledShown && (
                    <span className="gr-reveal-tag">자동완성으로 채워진 답 — 인코스와 같은 1구간으로 계산했어요</span>
                  )}
                </span>
                {target.example && <span className="gr-reveal-ex">{highlight(target.example, target.en)}</span>}
              </>
            )}
          </div>

          <LineSwitch
            nextLine={nextLine}
            outLock={outLock}
            inSlip={inSlip}
            inLoss={inLoss}
            outGain={outGain}
            outLoss={outLoss}
            onChoose={chooseLine}
            heading="다음 구간 라인"
            note={comboStall > 0 ? `콤보 ${combo.combo} · 정답마다 유령 ${(comboStall / 1000).toFixed(1)}초 정지` : undefined}
          />
        </main>
      ) : null}
    </div>
  );
}

// ─── 라인 전환 바 ─────────────────────────────────────────────────────────
function LineSwitch({
  nextLine, outLock, inSlip, inLoss, outGain, outLoss, onChoose, heading, note,
}: {
  nextLine: Line;
  outLock: number;
  /** 지금 위치에서 인코스 정답이 유령을 묶는가(슬립스트림 발동 구간인가). */
  inSlip: boolean;
  /** 지금 위치에서 인코스 오답이 반납할 칸(리드 중이 아니면 0). */
  inLoss: number;
  outGain: number;
  outLoss: number;
  onChoose: (l: Line) => void;
  heading: string;
  note?: string;
}) {
  const locked = outLock > 0;
  return (
    <div className="gr-lines">
      <p className="gr-lines-h">{heading}</p>
      <div className="gr-lines-row">
        <button
          type="button"
          className="gr-linebtn"
          aria-pressed={nextLine === 'in'}
          onClick={() => onChoose('in')}
        >
          <span className="gr-linebtn-t">
            <span className="gr-linebtn-mark" aria-hidden="true">{nextLine === 'in' ? '●' : '○'}</span>
            인코스 <Kbd>1</Kbd>
          </span>
          <span className="gr-linebtn-s">
            보기에서 고르기 · +1구간{inSlip ? ' · 슬립스트림(유령 0.5초 정지)' : ''}
            {inLoss > 0 ? ` · 오답 −${inLoss}구간(리드 반납)` : ' · 후퇴 없음'}
          </span>
        </button>
        <button
          type="button"
          className="gr-linebtn gr-linebtn--out"
          aria-pressed={nextLine === 'out'}
          aria-disabled={locked}
          onClick={() => onChoose('out')}
        >
          <span className="gr-linebtn-t">
            <span className="gr-linebtn-mark" aria-hidden="true">{nextLine === 'out' ? '●' : '○'}</span>
            아웃코스 <Kbd>2</Kbd>
          </span>
          <span className="gr-linebtn-s">
            {locked
              ? `코스 이탈 · ${outLock}구간 뒤 복귀`
              : `철자 직접 입력 · +${outGain}구간 & 유령 정지 · 실패 −${outLoss}`}
          </span>
        </button>
      </div>
      {note && <p className="gr-lines-note">{note}</p>}
    </div>
  );
}

const GR_CSS = `
  .gr-hudx { display: flex; align-items: center; gap: 10px; }
  .gr-league { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.05; }
  .gr-tier { font-family: var(--font-display, system-ui); font-size: 13.5px; font-weight: 800; white-space: nowrap; }
  .gr-lappips { display: inline-flex; gap: 4px; }
  .gr-lappip { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid color-mix(in srgb, var(--t1) 34%, transparent); background: transparent; }
  .gr-lappip[data-state="win"] { background: var(--success); border-color: var(--success); }
  .gr-lappip[data-state="loss"] { background: transparent; border-color: var(--t4); transform: scale(.8); }
  .gr-lappip[data-state="now"] { border-color: var(--combo); box-shadow: 0 0 0 2px color-mix(in srgb, var(--combo) 26%, transparent); }
  .gr-lappip--big { width: 14px; height: 14px; border-width: 2px; }

  .gr-track { position: relative; padding: 12px 20px 8px; display: flex; flex-direction: column; gap: 7px; border-bottom: 1px solid var(--bd); transition: box-shadow .5s var(--ease-settle, ease), padding .35s ease; }
  /* 킷의 '.gk-root > :not(.gk-energy):not(.gk-atmos):not(.gk-music-btn)' 이 모든 직계 자식을
     z-index:1 로 눕혀서, 트랙 아래로 삐져나오는 인라인 토스트가 스테이지에 가려진다.
     같은 규칙보다 높은 명시도로 트랙만 한 층 올린다(모달을 쓰지 않기 위한 대가). */
  .gk-root.gr-root > .gr-track:not(.gk-atmos):not(.gk-energy) { z-index: 3; }
  .gr-track[data-final="1"] { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--error) 24%, transparent), inset 0 -22px 34px -22px color-mix(in srgb, var(--error) 46%, transparent); }
  .gr-lane { position: relative; height: 30px; border-radius: 999px; background: color-mix(in srgb, var(--bg) 62%, transparent); box-shadow: inset 0 2px 6px rgba(60,26,86,.2), 0 1px 0 rgba(255,255,255,.35); backdrop-filter: blur(2px); transition: height .35s var(--ease-settle, ease); }
  .gr-lane--ghost { height: 22px; opacity: .9; }
  .gr-track[data-final="1"] .gr-lane--you { height: 36px; }
  .gr-line { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; }
  .gr-line--you { background: var(--combo); transition: width .3s var(--ease-settle, cubic-bezier(.22,.61,.36,1)); }
  .gr-line--you[data-blaze="1"] { background: linear-gradient(90deg, var(--combo), var(--streak)); }
  .gr-line--ghost { width: 0%; background: color-mix(in srgb, var(--t4) 72%, transparent); }
  .gr-runner { position: absolute; top: 50%; transform: translateY(-50%); font-size: 21px; z-index: 2; line-height: 1; }
  .gr-you { transition: left .3s var(--ease-settle, cubic-bezier(.22,.61,.36,1)); }
  .gr-you[data-verdict="correct"] { filter: drop-shadow(0 0 7px color-mix(in srgb, var(--success) 70%, transparent)); }
  .gr-you[data-verdict="wrong"] { animation: gk-shake .4s ease-in-out; }
  .gr-you[data-verdict="near"] { filter: drop-shadow(0 0 7px color-mix(in srgb, var(--streak) 70%, transparent)); }
  .gr-ghost[data-stalled="1"] { filter: grayscale(.55) drop-shadow(0 0 8px color-mix(in srgb, var(--combo) 65%, transparent)); opacity: .72; }
  .gr-flag { position: absolute; right: 2px; top: 50%; transform: translateY(-50%); font-size: 17px; opacity: .9; }

  .gr-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-family: var(--font-display, system-ui); font-size: 12.5px; font-weight: 800; color: var(--t2); }
  .gr-meta-mid { color: var(--t4); font-size: 11px; margin: 0 3px; font-weight: 700; }
  .gr-meta-gap[data-sign="up"] { color: var(--success); }
  .gr-meta-gap[data-sign="down"] { color: var(--t3); }
  .gr-meta-gap[data-sign="even"] { color: var(--t3); }
  .gr-meta-lap { color: var(--t3); font-weight: 700; font-variant-numeric: tabular-nums; }

  .gr-toast { position: absolute; left: 50%; bottom: -13px; transform: translateX(-50%); z-index: 5; padding: 5px 13px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--streak) 45%, var(--bd)); background: color-mix(in srgb, var(--bg) 92%, transparent); color: var(--t1); font-size: 11.5px; font-weight: 800; white-space: nowrap; box-shadow: 0 6px 18px -8px rgba(0,0,0,.42); animation: gr-toast-in .28s var(--ease-settle, ease-out); }
  @keyframes gr-toast-in { from { opacity: 0; transform: translate(-50%, 5px); } to { opacity: 1; transform: translate(-50%, 0); } }

  /* 탭 복귀 재출발 — 모달로 학습을 끊지 않고 트랙 위에 인라인으로만 알린다. */
  .gr-resume { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 6; display: inline-flex; align-items: center; gap: 7px; padding: 7px 15px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--combo) 52%, var(--bd)); background: color-mix(in srgb, var(--bg) 94%, transparent); color: var(--t1); font-family: var(--font-display, system-ui); font-size: 12px; font-weight: 800; white-space: nowrap; box-shadow: 0 8px 22px -10px rgba(0,0,0,.5); animation: gr-toast-in .22s var(--ease-settle, ease-out); }
  .gr-resume-mark { font-size: 11px; color: var(--combo); }

  .gr-stage { gap: clamp(10px, 2.2vh, 22px); justify-content: center; }
  .gr-lineflag { display: inline-flex; align-items: center; gap: 7px; padding: 5px 13px; border-radius: 999px; border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 70%, transparent); font-size: 12px; font-weight: 800; color: var(--t2); }
  .gr-lineflag[data-line="out"] { border-color: color-mix(in srgb, var(--streak) 55%, var(--bd)); color: var(--t1); }
  .gr-lineflag-mark { font-size: 10px; color: var(--combo); }
  .gr-lineflag[data-line="out"] .gr-lineflag-mark { color: var(--streak, var(--combo)); }
  .gr-meaning { margin: 0; font-family: var(--font-display, system-ui); font-size: clamp(26px, 5.6vw, 44px); font-weight: 800; word-break: keep-all; text-align: center; animation: gk-pop .3s ease-out; }

  .gr-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; width: min(520px, 92vw); }
  .gr-tiles--two { grid-template-columns: 1fr; max-width: 400px; }
  .gr-tiles .gr-tile { justify-content: center; min-height: 62px; font-size: clamp(15px, 3.2vw, 21px); padding: 14px 16px; }
  .gr-tiles .gr-tile:nth-child(5):last-child { grid-column: span 2; }
  .gr-tile-key { position: absolute; top: 6px; right: 9px; font-family: var(--font-display, monospace); font-size: 10.5px; font-weight: 800; color: var(--t4); }
  .gr-tile-en { pointer-events: none; }
  @media (max-width: 640px) { .gr-tile-key { display: none; } }

  .gr-sprint { display: flex; flex-direction: column; align-items: center; gap: 8px; width: min(520px, 92vw); }
  .gr-sprint-lbl { font-size: 12px; font-weight: 800; color: var(--t3); letter-spacing: .02em; }
  .gr-sprint-row { display: flex; gap: 9px; width: 100%; }
  .gr-sprint-input { flex: 1; min-width: 0; min-height: 56px; padding: 0 16px; border-radius: var(--r-lg, 14px); border: 1.5px solid var(--bd); background: var(--bg); color: var(--t1); font-family: var(--font-english, var(--font-display, system-ui)); font-size: clamp(18px, 4vw, 24px); font-weight: 700; letter-spacing: .01em; transition: border-color .15s, box-shadow .15s; }
  .gr-sprint-input::placeholder { color: var(--t4); font-weight: 600; }
  .gr-sprint-input:hover { border-color: var(--t3); }
  .gr-sprint-input:focus-visible, .gr-sprint-input:focus { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 28%, transparent); }
  .gr-sprint-input:read-only { opacity: .6; }
  .gr-sprint-go { min-height: 56px; padding: 0 20px; }
  .gr-sprint-go[aria-disabled="true"] { pointer-events: none; opacity: .5; }
  .gr-sprint-help { margin: 0; font-size: 11.5px; font-weight: 700; color: var(--t3); text-align: center; }

  .gr-reveal { min-height: 62px; width: min(560px, 92vw); display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; opacity: 0; transition: opacity .2s ease; }
  .gr-reveal[data-open="1"] { opacity: 1; }
  .gr-reveal-head { display: inline-flex; align-items: center; justify-content: center; gap: 7px; flex-wrap: wrap; font-size: 14px; color: var(--t2); }
  .gr-reveal[data-kind="correct"] .gr-reveal-head { color: var(--success); }
  .gr-reveal[data-kind="wrong"] .gr-reveal-head { color: var(--error); }
  .gr-reveal[data-kind="near"] .gr-reveal-head { color: var(--streak, var(--combo)); }
  .gr-reveal-en { font-family: var(--font-english, var(--font-display, system-ui)); font-size: 17px; font-weight: 800; }
  .gr-reveal-pron { font-size: 12.5px; color: var(--t3); font-style: italic; }
  .gr-reveal-ko { font-size: 13.5px; font-weight: 700; color: var(--t2); }
  .gr-reveal-tag { font-size: 11.5px; font-weight: 800; color: var(--t3); }
  .gr-reveal-ex { font-family: var(--font-body, Georgia, serif); font-size: 12.5px; line-height: 1.6; color: var(--t3); max-width: 52ch; }
  .gr-ex-hit { color: var(--t1); font-weight: 800; }

  .gr-lines { display: flex; flex-direction: column; align-items: center; gap: 6px; width: min(560px, 94vw); }
  .gr-lines-h { margin: 0; font-size: 10.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--t3); }
  .gr-lines-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; }
  .gr-linebtn { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; min-height: 56px; padding: 9px 13px; border-radius: var(--r-lg, 14px); border: 1.5px solid var(--bd); background: color-mix(in srgb, var(--bg) 72%, transparent); color: var(--t2); font-family: var(--font-display, system-ui); text-align: left; cursor: pointer; transition: transform .18s var(--ease-spring), border-color .15s, background .15s, color .15s; }
  .gr-linebtn:hover { border-color: var(--t3); color: var(--t1); transform: translateY(-2px); }
  .gr-linebtn:active { transform: translateY(0) scale(.98); }
  .gr-linebtn:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  .gr-linebtn[aria-pressed="true"] { border-color: var(--combo); background: color-mix(in srgb, var(--combo) 13%, transparent); color: var(--t1); }
  .gr-linebtn--out[aria-pressed="true"] { border-color: var(--streak, var(--combo)); background: color-mix(in srgb, var(--streak, var(--combo)) 14%, transparent); }
  .gr-linebtn[aria-disabled="true"] { pointer-events: none; opacity: .5; }
  .gr-linebtn-t { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 800; }
  .gr-linebtn-mark { font-size: 11px; }
  .gr-linebtn-s { font-size: 11px; font-weight: 700; color: var(--t3); line-height: 1.35; }
  .gr-lines-note { margin: 0; font-size: 11.5px; font-weight: 800; color: var(--streak, var(--combo)); }

  .gr-grid { gap: clamp(12px, 2.6vh, 24px); }
  .gr-grid-lap { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--t3); }
  .gr-grid-count { margin: 0; font-family: var(--font-display, system-ui); font-size: clamp(56px, 14vw, 96px); font-weight: 800; line-height: 1; color: var(--t1); font-variant-numeric: tabular-nums; animation: gk-pop .32s var(--ease-spring, ease-out); }
  .gr-grid-pace { margin: 0; font-size: 13px; font-weight: 700; color: var(--t2); font-variant-numeric: tabular-nums; }
  .gr-gostart { min-width: 150px; }

  .gr-lapend { gap: 14px; }
  .gr-lapend-h { margin: 0; font-family: var(--font-display, system-ui); font-size: clamp(24px, 6vw, 38px); font-weight: 800; animation: gk-pop .34s var(--ease-spring, ease-out); }
  .gr-lapend-m { margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 15px; color: var(--t2); text-align: center; }
  .gr-lapend-pips { display: inline-flex; gap: 8px; }

  .gr-missed { width: 100%; }
  .gr-missed-h { margin: 0 0 8px; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--t3); }
  .gr-missed-l { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 4px 14px; }
  .gr-missed-l li { display: flex; align-items: baseline; gap: 7px; font-size: 13px; }
  .gr-missed-l b { font-family: var(--font-english, var(--font-display, system-ui)); font-weight: 800; color: var(--t1); }
  .gr-missed-l span { color: var(--t3); font-size: 12px; }

  .gr-hint { margin: 0; font-size: 11.5px; color: var(--t3); text-align: center; display: flex; align-items: center; gap: 5px; flex-wrap: wrap; justify-content: center; }

  @media (max-width: 420px) {
    .gk-root.gr-root .gk-progress-spacer, .gk-root.gr-root .gk-progress { display: none; }
    .gr-tier { font-size: 11.5px; }
    .gr-track { padding: 10px 14px 8px; }
    .gr-meta { font-size: 11.5px; }
    .gr-linebtn-s { font-size: 10.5px; }
    .gr-lines-row { gap: 8px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .gr-meaning, .gr-grid-count, .gr-lapend-h, .gr-toast, .gr-resume { animation: none; }
    .gr-you[data-verdict="wrong"] { animation: none; }
    .gr-line--you, .gr-you, .gr-lane, .gr-track, .gr-linebtn { transition: none; }
    .gr-track[data-final="1"] .gr-lane--you { height: 30px; }
  }
`;
