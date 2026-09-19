// apps/web/src/components/game/daily-blitz/DailyBlitzGame.tsx
// Daily Blitz — 데일리 의식(Wordle × 스트릭)을 "하나의 시계 위에서 판돈을 거는 릴레이"로 재설계(v07.9).
//
// 무엇이 바뀌었나 (감사 23/50 → 대응):
//  1) 보이지 않던 6초 문항 타이머를 없애고 **세션 전체를 관통하는 시계 하나**로 바꿨다.
//     맞히면 늘고(extend) 틀리면 준다(drain). 남은 시간은 항상 TimerBar 로 보인다 —
//     경고 없이 miss 를 먹는 "함정"이 구조적으로 사라진다.
//  2) 문항마다 조인다: 정답 보상 시간이 5.0s → 2.3s 로 줄고, 선택지가 4 → 5 → 6개로 늘고,
//     후반·연장에서는 오답이 **철자·품사가 닮은 단어**로 바뀐다(형태 혼동 변별 훈련).
//  3) 유일하고 진짜인 선택 — **승부 걸기**. 뜻만 보이는 상태에서 3초를 선불로 걸면
//     점수 ×3 · 시간 보상 ×2, 실패하면 시간을 더 잃는다. 시계가 화폐라서 같은 베팅도
//     남은 시간에 따라 가치가 달라진다(= 매 문항 판단이 살아있다).
//  4) 선택지는 **결정한 뒤에** 열린다. 뜻만 보고 먼저 떠올리게 하는 구조라
//     인출(Active Recall)이 강해지고, 베팅이 "정답을 본 뒤 거는" 무위험 도박이 되지 않는다.
//  5) 10문항이 끝나도 시간이 남으면 **연장전**이 이어진다 — 점수·개인기록·다음 판의 이유.
//  6) 내장 뱅크는 폴백일 뿐. wordPool 이 오면 **학습자의 도서/스크립트/단어장 단어**로 돈다.
//     그래야 recordGameResult 가 silent skip 되지 않고 FSRS 에 적재된다.
//
// ── v07.10 · 적대적 반증 4건 봉쇄 (수치는 전부 재시뮬로 확인, scratchpad/db-sim*.js) ──
//  E1 [높음] 스트릭 무임승차 — finish() 가 성적을 보지 않아 "40초 오답 난사"·"90초 방치"로도
//     연속 +1 이 지급됐다. → 성능 게이트 3분기(counted / held / none)로 교체.
//     · counted(+1)  = dailyN 전 문항 도달 && 정답 ≥ ceil(dailyN×0.4)
//     · held(유지)   = 문항 80% 이상 도달 — 연속을 끊지 않되 늘리지도 않는다(나쁜 날 보호)
//     · none(끊김)   = 그 외(방치)
//     실측 30일 후 평균 연속: 정답률0.5 학습자 24.8일 · 0.35 학습자 14.6일 ·
//     오답난사 3.9일 · 방치 0.0일 (이전에는 셋 다 30일).
//     또한 데일리 시도는 성적과 무관하게 소비된다(today 마커) — 게이트를 못 넘었다고
//     같은 시드의 데일리를 다시 도는 "정답 본 뒤 재도전" 루프가 생기지 않게.
//  E2 [보통] 고갈된 연장전이 방금 정답을 공개한 단어를 재출제 → 점수 파밍.
//     → 연장전은 **이번 판에 안 쓴 단어만** 쓰고, 미사용이 3개 미만이면 열지 않고 끝낸다.
//     실측 평균 점수: pool 8 = 47,440 → 571점 / pool 48 = 42,393 → 3,669점.
//     "작은 단어장이 유리"가 "큰 단어장이 유리"로 뒤집혔다.
//  E3 [보통] 소거법 누수 — 오늘의 세트가 풀 전체라 후반 문항이 영어 없이 확정됐다.
//     → dailyN = min(10, max(5, pool−5)) 로 항상 미공개 예비어를 남기고,
//       오답 후보는 **아직 공개되지 않은 단어 우선**. 실측 확정 문항 비율:
//       pool 8 = 22.0% → 0.0% / pool 10 = 19.4% → 0.0% / pool 12 = 6.4% → 0.0%.
//       그래도 확정되는 문항(작은 풀의 연장전)은 forced 로 표시해 **정답만 assisted 로**
//       올린다 — 소거법으로 맞힌 것은 인출이 아니므로 FSRS 를 오염시키지 않는다.
//       (오답은 assisted 가 아니다. 모르는 단어는 정직하게 오답으로 올라가야 복습이 잡힌다.)
//  E4 [보통] 자유 모드 재시작 루프로 같은 단어에 Rating.Again 무제한 적재.
//     → 보고 기록을 판 단위(new Set)가 아니라 **페이지 세션 전체의 시각 Map** 으로 바꾸고
//       record-result 의 REGRADE_COOLDOWN_MS(10분)를 그대로 미러링한다. 재시작 루프는
//       서버 왕복조차 하지 않는다. 자유 모드 단어 선정도 "가장 오래 안 본 순"이라
//       방금 답을 본 단어로 되돌아가지 않는다.
//  + 답이 둘인 문항 차단(collides): 같은 뜻·굴절쌍(develop/developed)을 후보에서 배제.
//    hard 모드의 nearness 가 굴절쌍을 오히려 상위로 끌어올리던 문제까지 함께 닫힌다.
//  + 시간 가산 한도(총량의 75%)에 걸렸을 때 그 사실을 화면에 말한다 — 잘하는 학습자만
//    겪던 "이유 없는 불이익" 제거.
//
// 인출 규칙: 제출 전 화면에는 한국어 뜻만 있다(정답 특정 정보 없음). 부분 정답 오라클 없음.
// 정답 공개는 제출 후, 예문·발음까지 충분히.

'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  GameKitStyles, AmbientBackground, GameMark, IconSound, ParticleBurst, useSfx, shuffle, clamp, type Word,
  GameMusic, Hud, TimerBar, FeedbackIcon, Kbd, GameDone, NotEnoughWords,
  useCountdown, useCombo, usePersonalBest, DEFAULT_COMBO_TIERS,
} from '@/components/game/_shared/gamekit';

interface ResultOpts { assisted?: boolean }

interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word, opts?: ResultOpts) => void;
  onWrong?: (w: Word, opts?: ResultOpts) => void;
}

// 폴백 뱅크 — wordPool 이 없을 때(비로그인·단어장 미충족)만 쓰는 맛보기.
const BANK: Word[] = [
  { en: 'advantage', ko: '이점', pos: 'n' }, { en: 'reserved', ko: '내성적인', pos: 'adj' },
  { en: 'inclined', ko: '경향이 있는', pos: 'adj' }, { en: 'consequence', ko: '결과', pos: 'n' },
  { en: 'judgment', ko: '판단', pos: 'n' }, { en: 'ability', ko: '능력', pos: 'n' },
  { en: 'balance', ko: '균형', pos: 'n' }, { en: 'courage', ko: '용기', pos: 'n' },
  { en: 'develop', ko: '발전시키다', pos: 'v' }, { en: 'reduce', ko: '줄이다', pos: 'v' },
  { en: 'sudden', ko: '갑작스러운', pos: 'adj' }, { en: 'honest', ko: '정직한', pos: 'adj' },
  { en: 'generous', ko: '관대한', pos: 'adj' }, { en: 'stubborn', ko: '고집센', pos: 'adj' },
  { en: 'massive', ko: '거대한', pos: 'adj' }, { en: 'budget', ko: '예산', pos: 'n' },
  { en: 'profit', ko: '이익', pos: 'n' }, { en: 'debt', ko: '빚', pos: 'n' },
  { en: 'flood', ko: '홍수', pos: 'n' }, { en: 'ancient', ko: '고대의', pos: 'adj' },
  { en: 'fragile', ko: '연약한', pos: 'adj' }, { en: 'genuine', ko: '진짜의', pos: 'adj' },
  { en: 'hostile', ko: '적대적인', pos: 'adj' }, { en: 'obvious', ko: '분명한', pos: 'adj' },
  { en: 'reveal', ko: '드러내다', pos: 'v' }, { en: 'seek', ko: '찾다', pos: 'v' },
  { en: 'vivid', ko: '생생한', pos: 'adj' }, { en: 'wander', ko: '거닐다', pos: 'v' },
  { en: 'yield', ko: '양보하다', pos: 'v' }, { en: 'grasp', ko: '움켜쥐다', pos: 'v' },
  { en: 'deliberate', ko: '신중한', pos: 'adj' }, { en: 'reluctant', ko: '마지못한', pos: 'adj' },
  { en: 'thorough', ko: '철저한', pos: 'adj' }, { en: 'arrogant', ko: '오만한', pos: 'adj' },
  { en: 'humble', ko: '겸손한', pos: 'adj' }, { en: 'cautious', ko: '조심스러운', pos: 'adj' },
  { en: 'accomplish', ko: '성취하다', pos: 'v' }, { en: 'endure', ko: '견디다', pos: 'v' },
  { en: 'persuade', ko: '설득하다', pos: 'v' }, { en: 'hesitate', ko: '망설이다', pos: 'v' },
  { en: 'overcome', ko: '극복하다', pos: 'v' }, { en: 'dedicate', ko: '헌신하다', pos: 'v' },
  { en: 'scarce', ko: '부족한', pos: 'adj' }, { en: 'abundant', ko: '풍부한', pos: 'adj' },
  { en: 'temporary', ko: '일시적인', pos: 'adj' }, { en: 'permanent', ko: '영구적인', pos: 'adj' },
  { en: 'adequate', ko: '충분한', pos: 'adj' }, { en: 'immense', ko: '엄청난', pos: 'adj' },
];

const DAILY_MAX = 10;
/** 오늘의 세트 최소 문항 — 이보다 작으면 "하루의 의식"이 성립하지 않는다. */
const DAILY_MIN = 5;
/**
 * 오늘의 세트 밖에 남겨 두는 예비 단어 수.
 * 이게 0 이면(= 오늘의 세트가 풀 전체) 매 문항의 정답 공개가 곧 소거법 단서가 되어
 * 후반 문항이 영어 지식 없이 확정된다(반증 E3, 실측 pool 10 에서 19.4%).
 * 5 개를 남기면 연장전 재고(≥3)와 "미공개 오답 후보" 여유(+2)가 동시에 확보된다.
 */
const POOL_RESERVE = 5;
/**
 * 연장전을 열기 위한 최소 미사용 단어 수.
 * 미사용이 1 개면 "남은 건 그것뿐"이라 정답이 자동 확정된다. 3 개면 최악의 경우에도
 * 후보가 셋 이상 남아 추측 확률이 1/3 을 넘지 않는다.
 */
const OT_RESERVE = 3;
/** 연속 +1 에 필요한 정답 비율 — 게이트 근거는 파일 상단 주석의 시뮬 수치 참조. */
const STREAK_MARK_RATIO = 0.4;
/** 연속을 "끊지 않는"(유지) 최소 도달 비율 — 느린 학습자가 구조적으로 지지 않게. */
const STREAK_HOLD_RATIO = 0.8;
/** record-result.ts 의 REGRADE_COOLDOWN_MS 와 같은 값 — 재시작 루프를 서버 앞에서 끊는다. */
const REPORT_COOLDOWN_MS = 10 * 60 * 1000;
const TOTAL_MS = 90_000;
/** useCountdown 내부 가산 상한과 같은 비율 — 화면에 찍는 "+N초"가 거짓이 되지 않게 미러링한다. */
const EXTEND_CAP = TOTAL_MS * 0.75;
const STAKE_COST_MS = 3000;
const WARN_MS = 10_000;
const FAST_MS = 2800;
const STORE_KEY = 'vf_dailyblitz_v2';
const LEGACY_KEY = 'vf_dailyblitz_v1';

type Stage = 'decide' | 'pick' | 'reveal';
type Phase = 'intro' | 'playing' | 'result';
type Mark = 'fast' | 'ok' | 'stake' | 'wrong' | 'skip';
type Mode = 'daily' | 'free';
/** 데일리 판정 — counted(+1) · held(연속 유지) · none(연속 끊김) · free(집계 대상 아님). */
type Outcome = 'counted' | 'held' | 'none' | 'free';

interface Store {
  lastDate: string;
  streak: number;
  history: string[];
  today?: { date: string; grid: string; correct: number; score: number; counted: boolean };
}

interface Question {
  word: Word;
  options: Word[];
  /** 통합 라운드 인덱스(0-based). dailyN 이상이면 연장전. */
  round: number;
  over: boolean;
  /**
   * 오답 후보가 **전부 이미 공개된 단어**인가.
   * 이 경우 소거법만으로 정답이 확정되므로 "맞힌 것"은 인출이 아니다 → assisted 로 보고.
   */
  forced: boolean;
}

// 색 하나로만 구분되던 결과 그리드를 형태까지 다르게 — 공유 텍스트에도 그대로 실린다.
// (사각 / 마름모 / 별 / 삼각 / 빈칸)
const MARK_CHAR: Record<Mark, string> = { fast: '🟩', ok: '🔷', stake: '⭐', wrong: '🔺', skip: '⬛' };
const MARK_GLYPH: Record<Mark, string> = { fast: '✓✓', ok: '✓', stake: '★', wrong: '✕', skip: '·' };
const MARK_TEXT: Record<Mark, string> = { fast: '빠른 정답', ok: '정답', stake: '승부 성공', wrong: '오답', skip: '미도달' };

// ─── 날짜 시드 유틸 ───
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function dateKey(d: Date) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
function dayNumber(d: Date) { return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }
function isYesterday(prev: string, today: string) {
  const p = new Date(+prev.slice(0, 4), +prev.slice(4, 6) - 1, +prev.slice(6, 8));
  const t = new Date(+today.slice(0, 4), +today.slice(4, 6) - 1, +today.slice(6, 8));
  return Math.round((t.getTime() - p.getTime()) / 86400000) === 1;
}

// ─── 오답 선택지 난이도 ───
// 초반엔 무작위, 후반·연장엔 **철자·품사가 닮은** 단어로. 찍기가 통하지 않게 되고,
// 동시에 형태 혼동(develop/deliver, adequate/adopt)을 변별하는 실제 학습이 된다.
function levenshtein(a: string, b: string) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}
function nearness(cand: Word, target: Word) {
  const a = cand.en.toLowerCase(), b = target.en.toLowerCase();
  let s = 0;
  if (a[0] === b[0]) s += 2;
  if (Math.abs(a.length - b.length) <= 1) s += 1.2;
  if (cand.pos && target.pos && cand.pos === target.pos) s += 1.6;
  if (a.slice(-3) === b.slice(-3)) s += 1.4;
  s += Math.max(0, 3 - levenshtein(a, b) * 0.45);
  return s;
}
function isNearMiss(chosen: Word, target: Word) {
  const a = chosen.en.toLowerCase(), b = target.en.toLowerCase();
  return a.slice(0, 3) === b.slice(0, 3) || levenshtein(a, b) <= 2;
}

/**
 * 답이 둘이 되는 후보를 구조적으로 배제한다.
 * 같은 한국어 뜻(동의어)·굴절쌍(develop/developed)은 "정답이 두 개인 문항"이고,
 * 특히 hard 모드에서 위험하다 — nearness 가 같은 품사(+1.6)·같은 끝 3자(+1.4)·낮은
 * 편집거리를 가산해서 굴절쌍을 오히려 상위 후보로 끌어올리기 때문이다.
 */
function collides(cand: Word, target: Word) {
  const a = cand.en.trim().toLowerCase();
  const b = target.en.trim().toLowerCase();
  if (a === b) return true;
  if (cand.ko.trim() === target.ko.trim()) return true;
  const ci = (cand.inflected ?? []).map((s) => s.trim().toLowerCase());
  const ti = (target.inflected ?? []).map((s) => s.trim().toLowerCase());
  if (ci.includes(b) || ti.includes(a)) return true;
  return ci.some((x) => ti.includes(x));
}

/**
 * 선택지 수 — dailyN 이 풀 크기에 따라 5~10 으로 변하므로 절대 라운드가 아니라
 * **진행 비율**로 조인다(dailyN=10 일 때는 기존과 동일한 4/5/6 배분).
 */
function optionCount(round: number, over: boolean, dailyN: number, poolSize: number) {
  const t = dailyN > 0 ? round / dailyN : 1;
  const want = over ? 6 : t < 0.3 ? 4 : t < 0.7 ? 5 : 6;
  return clamp(Math.min(want, poolSize), 2, 6);
}

function chooseDistractors(cands: Word[], word: Word, need: number, hard: boolean): Word[] {
  if (need <= 0) return [];
  if (cands.length <= need) return shuffle(cands);
  if (!hard) return shuffle(cands).slice(0, need);
  const ranked = [...cands].sort((x, y) => nearness(y, word) - nearness(x, word));
  return shuffle(ranked.slice(0, Math.min(cands.length, need * 3))).slice(0, need);
}

/**
 * @param seen 이번 판에서 이미 정답이 공개된 단어들 — 오답 후보에서 **뒤로 민다**.
 *             (지워버리면 후보가 모자라므로 부족분만 채운다 = 하한 보장)
 */
function makeQuestion(
  pool: Word[], word: Word, round: number, over: boolean, dailyN: number, seen: Set<string>,
): Question {
  const n = optionCount(round, over, dailyN, pool.length);
  const need = n - 1;
  const strict = pool.filter((w) => !collides(w, word));
  // 동의어·굴절쌍을 걸러내다 후보가 0 이 되는 극단(중복 뜻만 있는 풀)에서는 en 만 다르면 허용.
  const usable = strict.length > 0 ? strict : pool.filter((w) => w.en.toLowerCase() !== word.en.toLowerCase());
  const hard = over || round >= Math.ceil(dailyN * 0.4);
  const fresh = usable.filter((w) => !seen.has(w.en));
  const picked = chooseDistractors(fresh, word, need, hard);
  if (picked.length < need) {
    const stale = usable.filter((w) => seen.has(w.en));
    picked.push(...chooseDistractors(stale, word, need - picked.length, hard));
  }
  const forced = picked.length > 0 && picked.every((w) => seen.has(w.en));
  return { word, options: shuffle([word, ...picked]), round, over, forced };
}

function multFor(combo: number) {
  let m = 1;
  for (const t of DEFAULT_COMBO_TIERS) if (combo >= t.at) m = t.mult;
  return m;
}
/** 정답 보상 시간 — 문항이 갈수록 짧아진다(긴장 곡선의 뼈대). */
function rewardMs(round: number, over: boolean, dailyN: number) {
  if (over) return Math.max(1500, 2600 - (round - dailyN) * 70);
  return Math.max(2300, 5000 - round * 300);
}

// ─── 보드(문항 영역) ───
// useCountdown 이 매 프레임 setState 하므로 부모는 초당 60회 렌더된다.
// 문항 영역은 memo 로 끊어 프레임마다 4~6개 타일이 재조정되지 않게 한다.
const Board = memo(function Board({
  q, stage, picked, staked, canStake, dailyN, onOpen, onPick,
}: {
  q: Question;
  stage: Stage;
  picked: number | null;
  staked: boolean;
  canStake: boolean;
  dailyN: number;
  onOpen: (stake: boolean) => void;
  onPick: (i: number) => void;
}) {
  const revealed = stage === 'reveal';
  const chosen = picked != null ? q.options[picked] : null;
  const wasRight = !!chosen && chosen.en === q.word.en;
  const near = !!chosen && !wasRight && isNearMiss(chosen, q.word);

  return (
    <div className="db-board">
      <div className="db-prompt-wrap">
        <span className="db-round">
          {q.over ? `연장 ${q.round - dailyN + 1}` : `${q.round + 1} / ${dailyN}`}
        </span>
        <h1 className="db-meaning" key={q.round}>{q.word.ko}</h1>
        {staked && (
          <span className="db-staked-chip">
            <span aria-hidden="true">★</span> 승부 중 · 점수 ×3
          </span>
        )}
      </div>

      {stage === 'decide' ? (
        <div className="db-decide">
          <p className="db-decide-lead">뜻을 보고 영어 단어를 먼저 떠올려 보세요.</p>
          <div className="db-decide-btns">
            <button
              type="button"
              className="gk-btn gk-btn--primary db-choice"
              onClick={() => onOpen(false)}
            >
              <span className="db-choice-main">선택지 보기</span>
              <span className="db-choice-sub">기본 점수 · <Kbd>1</Kbd></span>
            </button>
            <button
              type="button"
              className="gk-btn db-choice db-choice--stake"
              aria-disabled={!canStake}
              onClick={() => { if (canStake) onOpen(true); }}
            >
              <span className="db-choice-main"><span aria-hidden="true">★</span> 승부 걸기</span>
              <span className="db-choice-sub">
                {canStake ? <>3초를 걸고 점수 ×3 · <Kbd>2</Kbd></> : '시간이 3초 넘게 남아야 걸 수 있어요'}
              </span>
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="db-tiles">
            {q.options.map((o, i) => {
              const isAns = o.en === q.word.en;
              const isPick = picked === i;
              let tone = '';
              if (revealed) tone = isAns ? 'gk-tile--correct' : isPick ? 'gk-tile--wrong' : 'gk-tile--dim';
              return (
                <button
                  key={`${q.round}-${o.en}`}
                  type="button"
                  className={`gk-tile db-tile ${tone}`}
                  aria-disabled={revealed}
                  onClick={() => { if (!revealed) onPick(i); }}
                >
                  <span className="db-tile-key" aria-hidden="true">{i + 1}</span>
                  <span className="db-tile-en">{o.en}</span>
                  {revealed && isAns && <FeedbackIcon kind="correct" size={16} />}
                  {revealed && isPick && !isAns && <FeedbackIcon kind={near ? 'near' : 'wrong'} size={16} />}
                  {revealed && isAns && <ParticleBurst intensity={1} colors={['var(--success)', 'var(--combo)']} />}
                </button>
              );
            })}
          </div>

          {revealed && (
            <div className="db-reveal" role="status">
              <div className="db-reveal-head">
                <b className="db-reveal-en">{q.word.en}</b>
                {q.word.pron && <span className="db-reveal-pron">{q.word.pron}</span>}
                {q.word.pos && <span className="db-reveal-pos">{q.word.pos}</span>}
              </div>
              <div className="db-reveal-ko">{q.word.ko}</div>
              {q.word.example && <div className="db-reveal-ex">{q.word.example}</div>}
              {!wasRight && chosen && (
                <div className="db-reveal-mine">
                  고른 것 <b>{chosen.en}</b> = {chosen.ko}
                  {near && <span className="db-reveal-near"> · 철자가 아주 비슷했어요</span>}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
});

export function DailyBlitzGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();

  // ── 단어 원천: wordPool 우선(= 학습자의 도서/스크립트/단어장). 없을 때만 내장 뱅크.
  // 기준을 8 로 올린 이유: 스캐폴드 minWords 와 같고, dailyN(≥5) + 예비어(≥3)가 성립하는
  // 최소 크기다. 그 아래에서는 오늘의 세트가 사실상 풀 전체가 되어 소거법이 열린다.
  const pool = useMemo<Word[]>(() => (wordPool && wordPool.length >= 8 ? wordPool : BANK), [wordPool]);
  const usingOwn = !!(wordPool && wordPool.length >= 8);
  // 오늘의 세트는 절대 풀 전체가 되지 않는다 — 예비어 5개를 남긴다(E3).
  const dailyN = Math.min(DAILY_MAX, Math.max(DAILY_MIN, pool.length - POOL_RESERVE));
  const streakMark = Math.max(2, Math.ceil(dailyN * STREAK_MARK_RATIO));

  const today = useMemo(() => (typeof window === 'undefined' ? new Date(0) : new Date()), []);
  const tKey = dateKey(today);
  const dayNo = dayNumber(today);

  const [store, setStore] = useState<Store | null>(null);
  const alreadyDone = store?.today?.date === tKey;

  const [phase, setPhase] = useState<Phase>('intro');
  const [mode, setMode] = useState<Mode>('daily');
  const [stage, setStage] = useState<Stage>('decide');
  const [question, setQuestion] = useState<Question | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [staked, setStaked] = useState(false);
  const [results, setResults] = useState<Mark[]>([]);
  const [score, setScore] = useState(0);
  const [overOk, setOverOk] = useState(0);
  const [overTotal, setOverTotal] = useState(0);
  const [stakeWins, setStakeWins] = useState(0);
  const [stakeTries, setStakeTries] = useState(0);
  const [missed, setMissed] = useState<Word[]>([]);
  const [gain, setGain] = useState<{ id: number; txt: string; tone: 'good' | 'bad' } | null>(null);
  const [capNote, setCapNote] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [toMidnight, setToMidnight] = useState('');
  const [outcome, setOutcome] = useState<Outcome>('free');
  const [otClosed, setOtClosed] = useState(false);
  const [bestInfo, setBestInfo] = useState<{ prev: number | null; improved: boolean }>({ prev: null, improved: false });

  const stageRef = useRef<Stage>('decide');
  stageRef.current = stage;
  const scoreRef = useRef(0);
  const storeRef = useRef<Store | null>(null);
  storeRef.current = store;
  const resultsRef = useRef<Mark[]>([]);
  const runWordsRef = useRef<Word[]>([]);
  /** 연장전 재고 — 이번 판에서 아직 쓰지 않은 단어만 들어간다(E2). */
  const otQueueRef = useRef<Word[]>([]);
  /** 이번 판에서 정답이 공개된 단어 — 오답 후보를 미공개 우선으로 고르는 데 쓴다(E3). */
  const seenRef = useRef<Set<string>>(new Set());
  /** 페이지 세션 전체에서 각 단어를 마지막으로 본 시각 — 자유 모드 단어 선정 순서(E4). */
  const seenAtRef = useRef<Map<string, number>>(new Map());
  /** 각 단어를 FSRS 로 마지막 보고한 시각 — 판이 바뀌어도 초기화하지 않는다(E4). */
  const reportedAtRef = useRef<Map<string, number>>(new Map());
  const grantedRef = useRef(0);
  const capNoticedRef = useRef(false);
  const qStartRef = useRef(0);
  const stakedRef = useRef(false);
  const finishedRef = useRef(false);
  const modeRef = useRef<Mode>('daily');
  const nextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gainTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gainId = useRef(0);
  const mounted = useRef(true);

  const best = usePersonalBest('daily-blitz-score');
  const bestRef = useRef(best);
  bestRef.current = best;

  // 티어 승급 순간에만 마일스톤 사운드. 일반 정답음은 pick() 이 낸다(중복 방지).
  const combo = useCombo({ onTierUp: (_tier, c) => sfx.correct(c, true) });
  const comboRef = useRef(combo);
  comboRef.current = combo;

  const finishRef = useRef<(reason: 'time' | 'quit') => void>(() => {});
  const count = useCountdown({
    totalMs: TOTAL_MS,
    running: phase === 'playing' && stage !== 'reveal',
    warnAtMs: WARN_MS,
    onWarn: () => sfx.click(),
    onEnd: () => finishRef.current('time'),
  });
  const countRef = useRef(count);
  countRef.current = count;

  // ── 저장소 ──
  useEffect(() => {
    mounted.current = true;
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      let s: Store;
      if (raw) {
        const p = JSON.parse(raw) as Partial<Store>;
        // counted 는 v07.10 신설 — 이전 기록은 전부 "연속에 반영됨"으로 읽는다.
        const t = p.today;
        s = {
          lastDate: p.lastDate ?? '',
          streak: p.streak ?? 0,
          history: p.history ?? [],
          today: t ? { ...t, counted: t.counted ?? true } : undefined,
        };
      } else {
        const legacy = window.localStorage.getItem(LEGACY_KEY);
        const lp = legacy ? (JSON.parse(legacy) as Partial<Store>) : null;
        s = { lastDate: lp?.lastDate ?? '', streak: lp?.streak ?? 0, history: lp?.lastDate ? [lp.lastDate] : [] };
      }
      if (s.lastDate && s.lastDate !== tKey && !isYesterday(s.lastDate, tKey)) s.streak = 0;
      if (s.today && s.today.date !== tKey) s.today = undefined;
      setStore(s);
    } catch {
      setStore({ lastDate: '', streak: 0, history: [] });
    }
    return () => {
      mounted.current = false;
      if (nextTimer.current) clearTimeout(nextTimer.current);
      if (gainTimer.current) clearTimeout(gainTimer.current);
      if (capTimer.current) clearTimeout(capTimer.current);
    };
  }, [tKey]);

  // ── 자정까지 남은 시간(결과 화면에서만) ──
  useEffect(() => {
    if (phase !== 'result') return;
    const tick = () => {
      const now = new Date();
      const nx = new Date(now);
      nx.setHours(24, 0, 0, 0);
      const s = Math.max(0, Math.floor((nx.getTime() - now.getTime()) / 1000));
      setToMidnight(
        `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`,
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const showGain = useCallback((txt: string, tone: 'good' | 'bad') => {
    gainId.current += 1;
    const id = gainId.current;
    setGain({ id, txt, tone });
    // 애니메이션이 꺼진 환경(reduced-motion)에서도 부유 텍스트가 남지 않도록 직접 걷어낸다.
    if (gainTimer.current) clearTimeout(gainTimer.current);
    gainTimer.current = setTimeout(() => {
      if (mounted.current) setGain((g) => (g && g.id === id ? null : g));
    }, 1150);
  }, []);

  const addScore = useCallback((pts: number) => {
    scoreRef.current += pts;
    setScore(scoreRef.current);
  }, []);

  /**
   * useCountdown 의 가산 상한을 그대로 미러링 — 실제로 더해진 만큼만 화면에 찍는다.
   * 상한에 처음 걸린 순간에는 그 사실을 시계 옆에 한 번 말한다. 지금까지는 정답을
   * 맞혔는데 게이지가 안 늘어나는 이유가 화면 어디에도 없었다(잘하는 학습자만 겪는 불이익).
   */
  const grantTime = useCallback((ms: number) => {
    const allowed = Math.max(0, Math.min(ms, EXTEND_CAP - grantedRef.current));
    if (allowed <= 0) {
      if (!capNoticedRef.current) {
        capNoticedRef.current = true;
        setCapNote(true);
        if (capTimer.current) clearTimeout(capTimer.current);
        capTimer.current = setTimeout(() => { if (mounted.current) setCapNote(false); }, 3600);
      }
      return 0;
    }
    grantedRef.current += allowed;
    countRef.current.extend(allowed);
    return allowed;
  }, []);

  /**
   * 무작위로 섞은 뒤 "가장 오래 안 본 순"으로 안정 정렬.
   * 자유 모드 재시작이 방금 정답을 공개한 단어로 되돌아가 점수를 파밍하던 경로를 막는다.
   */
  const freshOrder = useCallback((list: Word[]) => {
    const seenAt = seenAtRef.current;
    return shuffle(list).sort((a, b) => (seenAt.get(a.en) ?? 0) - (seenAt.get(b.en) ?? 0));
  }, []);

  const startQuestion = useCallback((idx: number) => {
    const over = idx >= dailyN;
    const w = over ? otQueueRef.current.shift() : runWordsRef.current[idx];
    if (!w) { finishRef.current('quit'); return; }
    setQuestion(makeQuestion(pool, w, idx, over, dailyN, seenRef.current));
    setPicked(null);
    setStaked(false);
    stakedRef.current = false;
    setStage('decide');
    stageRef.current = 'decide';
    qStartRef.current = performance.now();
  }, [dailyN, pool]);

  const startRun = useCallback((m: Mode) => {
    if (nextTimer.current) { clearTimeout(nextTimer.current); nextTimer.current = null; }
    const words = m === 'daily'
      ? seededShuffle(pool, mulberry32(dayNo)).slice(0, dailyN)
      : freshOrder(pool).slice(0, dailyN);
    runWordsRef.current = words;
    // 연장전 재고 = 오늘의 세트 밖 단어만. 재충전(= 같은 단어 재출제) 경로를 없앴다(E2).
    otQueueRef.current = freshOrder(pool.filter((w) => !words.some((x) => x.en === w.en)));
    seenRef.current = new Set();
    resultsRef.current = [];
    grantedRef.current = 0;
    capNoticedRef.current = false;
    finishedRef.current = false;
    modeRef.current = m;
    combo.reset();
    scoreRef.current = 0;
    setMode(m);
    setResults([]);
    setScore(0);
    setBestInfo({ prev: null, improved: false });
    setOverOk(0);
    setOverTotal(0);
    setStakeWins(0);
    setStakeTries(0);
    setMissed([]);
    setGain(null);
    setCapNote(false);
    setOtClosed(false);
    setOutcome('free');
    setAnnounce('');
    countRef.current.reset();
    setPhase('playing');
    startQuestion(0);
  }, [combo, dailyN, dayNo, freshOrder, pool, startQuestion]);

  const finish = useCallback((reason: 'time' | 'quit') => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (nextTimer.current) { clearTimeout(nextTimer.current); nextTimer.current = null; }

    const padded = [...resultsRef.current];
    const attempted = padded.length;
    while (padded.length < dailyN) padded.push('skip');
    resultsRef.current = padded;
    setResults(padded);
    setPhase('result');

    const correct = padded.filter((r) => r === 'fast' || r === 'ok' || r === 'stake').length;
    const perfect = correct === dailyN;
    // 보상은 판돈에 비례한다 — 2/10 이든 10/10 이든 같은 팡파르가 울리던 문제(감사 지적) 수정.
    if (perfect) sfx.fanfare();
    else if (correct >= Math.ceil(dailyN * 0.7)) sfx.correct(0, false);
    else sfx.click();

    const finalScore = scoreRef.current;
    setBestInfo(bestRef.current.submit(finalScore));

    // ── 스트릭 성능 게이트(E1) ──────────────────────────────────────────────
    // 시계만 태우면 지급되던 연속 기록을 3분기로 나눈다.
    //   counted — 전 문항 도달 + 정답 ≥ streakMark → 연속 +1, 캘린더 점 채움
    //   held    — 80% 이상 도달 → 연속을 끊지 않되 늘리지도 않는다(나쁜 날 보호)
    //   none    — 그 외(방치) → 오늘은 기록되지 않는다
    // 어느 쪽이든 today 마커는 남긴다. 게이트를 못 넘었다고 같은 시드의 데일리를
    // "정답을 다 본 채로" 다시 도는 루프가 생기면 게이트 자체가 무의미해지기 때문이다.
    let verdict: Outcome = 'free';
    if (modeRef.current === 'daily' && !alreadyDone) {
      const reachedAll = attempted >= dailyN;
      const held = attempted >= Math.ceil(dailyN * STREAK_HOLD_RATIO);
      verdict = reachedAll && correct >= streakMark ? 'counted' : held ? 'held' : 'none';

      const cur: Store = storeRef.current ?? { lastDate: '', streak: 0, history: [] };
      const bumped = !cur.lastDate
        ? 1
        : cur.lastDate === tKey
          ? cur.streak
          : isYesterday(cur.lastDate, tKey)
            ? cur.streak + 1
            : 1;
      // held 는 사슬만 이어 준다 — 없던 연속을 만들어 주지는 않는다(그러면 그게 다시 무임승차다).
      const chainKept = verdict !== 'none';
      const ns: Store = {
        lastDate: chainKept ? tKey : cur.lastDate,
        streak: verdict === 'counted' ? bumped : cur.streak,
        history: verdict === 'counted'
          ? Array.from(new Set([...cur.history, tKey])).slice(-14)
          : cur.history,
        today: { date: tKey, grid: padded.map((r) => MARK_CHAR[r]).join(''), correct, score: finalScore, counted: verdict === 'counted' },
      };
      storeRef.current = ns;
      setStore(ns);
      try { window.localStorage.setItem(STORE_KEY, JSON.stringify(ns)); } catch { /* private mode */ }
    }
    setOutcome(verdict);
    setOtClosed(reason === 'quit');
    setAnnounce(
      reason === 'quit'
        ? '단어를 모두 돌았어요. 결과를 확인하세요.'
        : '시간 종료. 결과를 확인하세요.',
    );
  }, [alreadyDone, dailyN, sfx, streakMark, tKey]);
  finishRef.current = finish;

  const advance = useCallback((from: number) => {
    if (finishedRef.current || !mounted.current) return;
    if (countRef.current.remainMs <= 0) { finishRef.current('time'); return; }
    const next = from + 1;
    // 연장전은 "이번 판에 안 쓴 단어"가 충분할 때만 연다. 재고가 마르면 방금 답을 공개한
    // 단어로 되돌아가는 대신 판을 닫는다(E2 · E3).
    if (next >= dailyN && otQueueRef.current.length < OT_RESERVE) { finishRef.current('quit'); return; }
    startQuestion(next);
  }, [dailyN, startQuestion]);

  const openOptions = useCallback((stake: boolean) => {
    if (stageRef.current !== 'decide' || !mounted.current) return;
    if (stake) {
      if (countRef.current.remainMs <= STAKE_COST_MS + 500) return;
      countRef.current.drain(STAKE_COST_MS);
      setStaked(true);
      stakedRef.current = true;
      setStakeTries((n) => n + 1);
      sfx.coin();
      showGain('−3초 · 승부', 'bad');
    } else {
      sfx.click();
    }
    setStage('pick');
    stageRef.current = 'pick';
  }, [sfx, showGain]);

  const pick = useCallback((i: number) => {
    if (stageRef.current !== 'pick' || !mounted.current) return;
    const q = question;
    if (!q || i < 0 || i >= q.options.length) return;
    stageRef.current = 'reveal';

    const chosen = q.options[i];
    const ok = chosen.en === q.word.en;
    const elapsed = performance.now() - qStartRef.current;
    const wasStaked = stakedRef.current;
    const near = !ok && isNearMiss(chosen, q.word);

    setPicked(i);
    setStage('reveal');

    let mark: Mark;
    if (ok) {
      const c = comboRef.current.hit();
      const mult = multFor(c);
      const tierUp = mult !== multFor(c - 1);
      const speed = clamp(1.7 - elapsed / 6000, 0.6, 1.7);
      const pts = Math.round(100 * mult * (wasStaked ? 3 : 1) * speed);
      addScore(pts);
      const added = grantTime(rewardMs(q.round, q.over, dailyN) * (wasStaked ? 2 : 1));
      const secTxt = added > 0 ? ` · +${(added / 1000).toFixed(1)}초` : ' · 시계 가산 한도';
      showGain(`+${pts}${secTxt}`, 'good');
      // 티어 승급 사운드는 useCombo 의 onTierUp 이 이미 냈다 — 겹쳐 울리지 않게.
      if (!tierUp) sfx.correct(c, false);
      mark = wasStaked ? 'stake' : elapsed < FAST_MS ? 'fast' : 'ok';
      if (wasStaked) setStakeWins((n) => n + 1);
      setAnnounce(
        `정답 ${q.word.en} · ${q.word.ko}${tierUp ? ` · ${c}연속 배수 ×${mult}` : ''}`,
      );
    } else {
      const lost = comboRef.current.miss();
      let penalty = near ? 2500 : 4000;
      if (wasStaked) penalty += 2000;
      if (lost >= 3) penalty += 1500;
      countRef.current.drain(penalty);
      if (near) sfx.nearMiss(); else sfx.wrong();
      showGain(`−${(penalty / 1000).toFixed(1)}초${lost >= 3 ? ` · ${lost}연속 끊김` : ''}`, 'bad');
      mark = 'wrong';
      setMissed((m) => (m.some((w) => w.en === q.word.en) ? m : [...m, q.word]));
      setAnnounce(`아쉬워요. 정답은 ${q.word.en} · ${q.word.ko}`);
    }

    if (!q.over) {
      resultsRef.current = [...resultsRef.current, mark];
      setResults(resultsRef.current);
    } else {
      setOverTotal((n) => n + 1);
      if (ok) setOverOk((n) => n + 1);
    }

    // 정답 공개 — 이후 이 단어는 오답 후보에서 뒤로 밀리고, 자유 모드 재시작에서도 뒤로 간다.
    seenRef.current.add(q.word.en);
    seenAtRef.current.set(q.word.en, Date.now());

    // ── FSRS 적재 ──────────────────────────────────────────────────────────
    // 원칙: **답한 단어는 처음 만났을 때 반드시 올라간다. 특히 틀린 단어가 그렇다.**
    //   모르는 단어를 안 올리면(letter-forge 함정) 합리적으로 플레이할수록 자기가 모르는
    //   단어를 복습 큐에서 지우게 된다. 여기서 걸러지는 것은 "같은 단어의 재채점"뿐이다.
    // ① 10분 쿨다운(record-result 의 REGRADE_COOLDOWN_MS 와 같은 값)을 판 단위가 아니라
    //    **페이지 세션** 단위로 건다 — "다시 도전"을 반복해 같은 단어에 Rating.Again 을
    //    쌓던 경로가 닫힌다(E4). 서버도 어차피 이 창 안의 재채점은 버리므로 왕복도 아낀다.
    // ② 오답 후보가 전부 이미 공개된 단어였다면(forced) 정답은 소거법의 결과다 →
    //    assisted 로 올려 카드를 갱신하지 않는다. **오답은 assisted 가 아니다** —
    //    소거법이 열려 있었는데도 틀렸다면 그건 정직한 "모름"이고, 복습이 잡혀야 한다.
    const key = q.word.en.toLowerCase();
    const lastAt = reportedAtRef.current.get(key) ?? 0;
    if (Date.now() - lastAt >= REPORT_COOLDOWN_MS) {
      reportedAtRef.current.set(key, Date.now());
      if (ok) onCorrect?.(q.word, { assisted: q.forced });
      else onWrong?.(q.word);
    }

    const hold = ok ? 950 : 1600;
    if (nextTimer.current) clearTimeout(nextTimer.current);
    nextTimer.current = setTimeout(() => advance(q.round), hold);
  }, [addScore, advance, dailyN, grantTime, onCorrect, onWrong, question, sfx, showGain]);

  // ── 키보드: 결정 단계 1/2, 선택 단계 1~6 ──
  const openRef = useRef(openOptions);
  openRef.current = openOptions;
  const pickRef = useRef(pick);
  pickRef.current = pick;
  const optionLen = question?.options.length ?? 0;

  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (!Number.isInteger(n)) return;
      if (stageRef.current === 'decide') {
        if (n === 1) { e.preventDefault(); openRef.current(false); }
        else if (n === 2) { e.preventDefault(); openRef.current(true); }
      } else if (stageRef.current === 'pick') {
        if (n >= 1 && n <= optionLen) { e.preventDefault(); pickRef.current(n - 1); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, optionLen]);

  const stableOpen = useCallback((stake: boolean) => openRef.current(stake), []);
  const stablePick = useCallback((i: number) => pickRef.current(i), []);

  const handleExit = useCallback(() => {
    if (nextTimer.current) { clearTimeout(nextTimer.current); nextTimer.current = null; }
    onExit?.();
  }, [onExit]);

  // ── 파생값 ──
  const correctCount = results.filter((r) => r === 'fast' || r === 'ok' || r === 'stake').length;
  const attemptedCount = results.filter((r) => r !== 'skip').length;
  const grid = results.map((r) => MARK_CHAR[r]).join('');
  const streak = store?.streak ?? 0;
  const progress = question ? clamp((question.over ? dailyN : question.round) / dailyN, 0, 1) : 0;
  const canStake = count.remainMs > STAKE_COST_MS + 500;
  const glowAlpha = 0.3 + progress * 0.26 + (combo.combo >= 6 ? 0.14 : 0);

  const week = useMemo(() => {
    const base = typeof window === 'undefined' ? new Date(0) : new Date(today);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() - (6 - i));
      return dateKey(d);
    });
  }, [today]);
  const doneSet = useMemo(() => new Set(store?.history ?? []), [store]);

  const hudExtra = useMemo(
    () => (
      <span className="db-hud-streak" title="연속 기록">
        <span aria-hidden="true">🔥</span> {streak}
      </span>
    ),
    [streak],
  );

  // pool 은 구조상 항상 8 이상이다(폴백 BANK 48). 그래도 상위에서 BANK 를 바꾸는 변경이
  // 들어오면 조용히 깨지는 대신 안내로 멈추게 둔다 — 스캐폴드 minWords 와 같은 8.
  if (pool.length < 8) return <NotEnoughWords need={8} onExit={onExit} />;

  return (
    <div className="gk-root db-root">
      <GameMusic gameId="daily-blitz" />
      <GameKitStyles />
      <AmbientBackground
        center="#FBEFE8"
        mid="#F2D2C3"
        edge="#7A3B54"
        glow={`rgba(255,158,120,${glowAlpha.toFixed(2)})`}
        glowAt="50% 34%"
        watermark="daily-blitz"
      />
      <style dangerouslySetInnerHTML={{ __html: DB_CSS }} />
      <div className="gk-sr" aria-live="assertive">{announce}</div>

      {phase === 'intro' && (
        <>
          <header className="db-bar">
            <div className="db-streak"><span aria-hidden="true">🔥</span> <b>{streak}</b>일 연속</div>
            <div className="db-title">오늘의 챌린지 <span className="db-num">#{dayNo % 100000}</span></div>
            <div className="db-bar-right">
              <button
                type="button"
                className="gk-icon-btn"
                aria-label={sfx.muted ? '소리 켜기' : '소리 끄기'}
                aria-pressed={sfx.muted}
                onClick={() => sfx.setMuted((m) => !m)}
              >
                <IconSound muted={sfx.muted} />
              </button>
              {onExit && <button type="button" className="gk-exit" onClick={handleExit}>나가기</button>}
            </div>
          </header>

          <main className="gk-stage db-intro">
            <div className="db-cal" aria-hidden="true"><GameMark id="daily-blitz" /></div>
            <h1 className="db-h1">Daily Blitz</h1>
            <p className="db-lead">
              오늘의 <b>{dailyN}단어</b>를 <b>{Math.round(TOTAL_MS / 1000)}초</b> 시계 하나로 통과하세요.
              {usingOwn ? ' 지금 고른 자료의 단어로 돌아갑니다.' : ' 단어장을 연결하면 내 단어로 바뀝니다.'}
            </p>

            <ul className="db-rules">
              <li><span className="db-rule-n" aria-hidden="true">1</span> 뜻을 보고 영어를 고릅니다. 빠를수록 점수가 큽니다.</li>
              <li><span className="db-rule-n" aria-hidden="true">2</span> 시계는 하나 — 맞히면 늘고, 틀리면 줄어듭니다.</li>
              <li><span className="db-rule-n" aria-hidden="true">3</span> 확신이 서면 <b>승부</b> — 3초를 걸고 점수 ×3.</li>
              <li><span className="db-rule-n" aria-hidden="true">4</span> {dailyN}문항 뒤에도 시간이 남으면 <b>연장전</b>이 이어집니다.</li>
            </ul>

            <WeekDots week={week} today={tKey} done={doneSet} />
            <p className="db-gate-note">
              {dailyN}문항을 끝내고 <b>{streakMark}개 이상</b> 맞히면 <span aria-hidden="true">🔥</span> 연속 +1.
              모자란 날에도 끝까지 돌면 연속은 그대로 이어집니다.
            </p>

            {alreadyDone ? (
              <>
                <div className={`db-done-badge ${store?.today?.counted ? '' : 'db-done-badge--held'}`}>
                  <span aria-hidden="true">{store?.today?.counted ? '✓' : '↺'}</span>
                  {store?.today?.counted ? '오늘 완료' : '오늘 도전함'} · {store?.today?.correct}/{dailyN} · {store?.today?.score?.toLocaleString()}점
                  <span className="db-done-grid" aria-hidden="true">{store?.today?.grid}</span>
                </div>
                {!store?.today?.counted && (
                  <p className="db-gate-note">
                    오늘 기록은 연속에 더해지지 않았어요. 연속은 그대로예요 — 내일 {streakMark}개를 넘겨 보세요.
                  </p>
                )}
                <div className="db-actions">
                  <button type="button" className="gk-btn gk-btn--primary db-start" onClick={() => startRun('free')}>
                    다시 도전 · 다른 단어
                  </button>
                  {onExit && <button type="button" className="gk-btn" onClick={handleExit}>내일 또 만나요</button>}
                </div>
              </>
            ) : (
              <div className="db-actions">
                <button type="button" className="gk-btn gk-btn--primary db-start" onClick={() => startRun('daily')}>
                  오늘의 챌린지 시작
                </button>
              </div>
            )}
          </main>
        </>
      )}

      {phase === 'playing' && question && (
        <>
          <Hud
            score={score}
            progress={progress}
            combo={combo.combo}
            comboMult={combo.mult}
            extra={hudExtra}
            muted={sfx.muted}
            onToggleMute={() => sfx.setMuted((m) => !m)}
            onExit={onExit ? handleExit : undefined}
          />
          <div className="db-clock">
            <TimerBar frac={count.frac} warning={count.warning} seconds={count.remainSec} label="남은 시간" />
            {capNote && (
              <p className="db-cap" role="status">
                <span aria-hidden="true">⌛</span> 시계 가산 한도 · +{Math.round(EXTEND_CAP / 1000)}초까지 채웠어요
              </p>
            )}
          </div>
          <div className="db-pips" aria-hidden="true">
            {Array.from({ length: dailyN }, (_, i) => {
              const r = results[i];
              const now = !question.over && i === question.round;
              return (
                <span
                  key={i}
                  className={`db-pip ${r ? `db-pip--${r}` : ''} ${now ? 'db-pip--now' : ''}`}
                  data-glyph={r ? MARK_GLYPH[r] : now ? '▸' : ''}
                />
              );
            })}
            {question.over && <span className="db-ot-chip">연장 {question.round - dailyN + 1}</span>}
          </div>
          <p className="gk-sr">
            {dailyN}문항 중 {results.length}문항 완료 · 정답 {correctCount}개
          </p>

          <main className="gk-stage db-play">
            <Board
              q={question}
              stage={stage}
              picked={picked}
              staked={staked}
              canStake={canStake}
              dailyN={dailyN}
              onOpen={stableOpen}
              onPick={stablePick}
            />
          </main>

          {/* 부유 텍스트는 래퍼 안에 둔다 — .gk-root > * 규칙(명시도 0,4,0)이 직계 자식의
              position 을 relative 로 덮어써서 직계로 두면 좌표가 먹지 않는다. */}
          <div className="db-gain-layer" aria-hidden="true">
            {gain && <span key={gain.id} className={`db-gain db-gain--${gain.tone}`}>{gain.txt}</span>}
          </div>
        </>
      )}

      {phase === 'result' && (
        <ResultView
          mode={mode}
          outcome={outcome}
          otClosed={otClosed}
          poolSize={pool.length}
          grid={grid}
          results={results}
          dailyN={dailyN}
          streakMark={streakMark}
          correctCount={correctCount}
          attemptedCount={attemptedCount}
          score={score}
          overOk={overOk}
          overTotal={overTotal}
          stakeWins={stakeWins}
          stakeTries={stakeTries}
          missed={missed}
          bestPrev={bestInfo.prev}
          bestImproved={bestInfo.improved}
          streak={streak}
          week={week}
          today={tKey}
          done={doneSet}
          toMidnight={toMidnight}
          comboBest={combo.best}
          onRestart={() => startRun('free')}
          onExit={handleExit}
        />
      )}
    </div>
  );
}

// ─── 7일 점 캘린더 ───
function WeekDots({ week, today, done }: { week: string[]; today: string; done: Set<string> }) {
  const filled = week.filter((d) => done.has(d)).length;
  return (
    <div className="db-week" role="img" aria-label={`최근 7일 중 ${filled}일 완료`}>
      {week.map((d) => {
        const isToday = d === today;
        const isDone = done.has(d);
        return (
          <span
            key={d}
            className={`db-day ${isDone ? 'db-day--on' : ''} ${isToday ? 'db-day--today' : ''}`}
            aria-hidden="true"
          >
            {isDone ? '●' : isToday ? '○' : '·'}
          </span>
        );
      })}
    </div>
  );
}

// ─── 결과 ───
function ResultView({
  mode, outcome, otClosed, poolSize, grid, results, dailyN, streakMark, correctCount, attemptedCount,
  score, overOk, overTotal, stakeWins, stakeTries, missed, bestPrev, bestImproved, streak,
  week, today, done, toMidnight, comboBest, onRestart, onExit,
}: {
  mode: Mode;
  outcome: Outcome;
  otClosed: boolean;
  poolSize: number;
  grid: string;
  results: Mark[];
  dailyN: number;
  streakMark: number;
  correctCount: number;
  attemptedCount: number;
  score: number;
  overOk: number;
  overTotal: number;
  stakeWins: number;
  stakeTries: number;
  missed: Word[];
  bestPrev: number | null;
  bestImproved: boolean;
  streak: number;
  week: string[];
  today: string;
  done: Set<string>;
  toMidnight: string;
  comboBest: number;
  onRestart: () => void;
  onExit: () => void;
}) {
  const perfect = correctCount === dailyN && dailyN > 0;
  const improved = bestImproved;

  // Empathetic Feedback — 미달을 비난하지 않는다. "안 됐다"가 아니라 "이렇게 하면 된다".
  const lead = outcome === 'none'
    ? '오늘은 여기까지 — 다음엔 끝까지 가 봐요'
    : outcome === 'held'
      ? '오늘도 한 바퀴 돌았어요'
      : perfect
        ? '오늘 전부 통과했어요'
        : correctCount >= Math.ceil(dailyN * 0.7)
          ? '오늘 잘 마쳤어요'
          : '오늘도 한 걸음';

  const stats: { num: ReactNode; label: string; accent?: boolean }[] = [
    { num: score.toLocaleString(), label: '점수', accent: true },
    { num: `${correctCount}/${dailyN}`, label: mode === 'daily' ? '오늘의 정답' : '정답' },
    { num: grid, label: '기록' },
  ];
  if (overTotal > 0) stats.push({ num: `${overOk}/${overTotal}`, label: '연장전' });
  if (mode === 'daily') {
    // 숫자는 같아도 라벨이 "무슨 일이 일어났는지"를 말한다 — 색이나 아이콘 없이도 읽힌다.
    stats.push({
      num: `🔥 ${streak}`,
      label: outcome === 'counted' ? '연속 +1' : outcome === 'held' ? '연속 유지' : '연속',
    });
  }

  // 다음 판의 목표를 한 줄로. 판정에 따라 "무엇을 하면 되는지"가 먼저 온다.
  const hint = outcome === 'none'
    ? `${dailyN}문항 중 ${attemptedCount}문항까지 갔어요. 끝까지 돌면 연속이 이어지고, ${streakMark}개를 넘기면 +1 이 됩니다.`
    : outcome === 'held'
      ? `정답 ${correctCount}개 — ${streakMark}개부터 연속 +1 이에요.${streak > 0 ? ` 연속 ${streak}일은 끊기지 않았습니다.` : ' 내일 넘기면 연속이 시작돼요.'}`
      : otClosed
        ? `단어가 ${poolSize}개라 연장전이 ${overTotal}라운드에서 닫혔어요. 단어장을 채우면 연장전이 길어집니다.`
        : overTotal === 0
          ? '시간을 아끼면 연장전이 열려요. 확실한 단어는 빠르게 통과하세요.'
          : stakeTries === 0
            ? `연장 ${overTotal}라운드. 확실한 단어에 승부를 걸면 점수가 3배가 됩니다.`
            : `연장 ${overTotal}라운드 · 승부 ${stakeWins}/${stakeTries}. 다음엔 한 라운드 더.`;

  const badge = improved
    ? <><span aria-hidden="true">▲</span> 개인 최고 갱신</>
    : perfect
      ? <><span aria-hidden="true">★</span> 오늘 만점</>
      : comboBest >= 6
        ? <><span aria-hidden="true">🔥</span> 최장 {comboBest}연속</>
        : undefined;

  const reveal = missed.length > 0
    ? (
      <div className="db-miss">
        <div className="db-miss-title">다시 만나면 좋을 단어</div>
        <ul className="db-miss-list">
          {missed.map((w) => (
            <li key={w.en} className="db-miss-item">
              <b className="db-miss-en">{w.en}</b>
              <span className="db-miss-ko">{w.ko}</span>
              {w.pron && <span className="db-miss-pron">{w.pron}</span>}
              {w.example && <span className="db-miss-ex">{w.example}</span>}
            </li>
          ))}
        </ul>
      </div>
    )
    : undefined;

  const footer = (
    <div className="db-foot">
      <div className="db-legend">
        {(['fast', 'ok', 'stake', 'wrong', 'skip'] as Mark[]).map((m) => (
          <span key={m} className="db-legend-item">
            <span aria-hidden="true">{MARK_CHAR[m]}</span> {MARK_TEXT[m]}
          </span>
        ))}
      </div>
      <div className="db-foot-row">
        <WeekDots week={week} today={today} done={done} />
        {toMidnight && <span className="db-next">{toMidnight} 후 새 챌린지</span>}
      </div>
      <p className="db-foot-note">
        {results.length}문항 결과 — {(['fast', 'ok', 'stake', 'wrong', 'skip'] as Mark[])
          .map((m) => ({ m, n: results.filter((r) => r === m).length }))
          .filter((x) => x.n > 0)
          .map((x) => `${MARK_TEXT[x.m]} ${x.n}`)
          .join(' · ')}
      </p>
    </div>
  );

  return (
    <GameDone
      lead={lead}
      stats={stats}
      onRestart={onRestart}
      onExit={onExit}
      restartLabel="다시 도전 · 다른 단어"
      celebrate={perfect}
      mark="daily-blitz"
      best={{ prev: bestPrev, now: score, label: '점수', improved }}
      badge={badge}
      restartHint={hint}
      reveal={reveal}
      footer={footer}
    />
  );
}

const DB_CSS = `
  .db-bar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--bd); }
  .db-streak { font-size: 13px; color: var(--t2); font-weight: 600; }
  .db-streak b { color: var(--streak); font-size: 15px; }
  .db-title { font-family: var(--font-display, system-ui); font-weight: 800; font-size: 14px; color: var(--t1); }
  .db-num { color: var(--t3); font-weight: 700; }
  .db-bar-right { display: flex; gap: 8px; justify-content: flex-end; align-items: center; }

  .db-intro { gap: 14px; text-align: center; }
  .db-cal { width: 72px; height: 72px; display: grid; place-items: center; border-radius: 22px; color: var(--streak); background: color-mix(in srgb, var(--bg) 55%, transparent); border: 1px solid color-mix(in srgb, var(--t1) 12%, transparent); box-shadow: 0 14px 38px -12px rgba(0,0,0,.32); backdrop-filter: blur(6px); }
  .db-cal svg { width: 40px; height: 40px; }
  .db-h1 { margin: 0; font-family: var(--font-display, system-ui); font-size: clamp(28px, 6vw, 44px); font-weight: 800; color: var(--t1); }
  .db-lead { margin: 0; color: var(--t2); font-size: 14.5px; max-width: 38ch; line-height: 1.6; }
  .db-lead b { color: var(--t1); }
  .db-rules { list-style: none; margin: 0; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; text-align: left; max-width: min(460px, 92vw); border-radius: var(--r-lg, 14px); border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 70%, transparent); }
  .db-rules li { display: flex; align-items: flex-start; gap: 9px; font-size: 13.5px; line-height: 1.55; color: var(--t2); }
  .db-rules b { color: var(--t1); }
  .db-rule-n { flex: none; width: 19px; height: 19px; margin-top: 1px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 800; color: var(--ti); background: var(--combo); }
  /* 스트릭 규약 — 캘린더 바로 아래에서 "무엇을 하면 연속이 오르는지"를 미리 말한다. */
  .db-gate-note { margin: 0; max-width: 40ch; font-size: 12.5px; line-height: 1.6; color: var(--t3); }
  .db-gate-note b { color: var(--t2); font-weight: 800; }
  .db-done-badge { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; font-size: 13.5px; font-weight: 700; color: var(--t1); background: color-mix(in srgb, var(--success) 14%, transparent); border: 1px solid color-mix(in srgb, var(--success) 40%, var(--bd)); padding: 8px 16px; border-radius: 999px; }
  /* 게이트 미달은 "실패"가 아니라 "기록되지 않음" — 경고색이 아니라 중립 톤. */
  .db-done-badge--held { background: color-mix(in srgb, var(--t1) 7%, transparent); border-color: var(--bd); color: var(--t2); }
  .db-done-grid { letter-spacing: 2px; }
  .db-start { min-width: 220px; font-size: 16px; min-height: 54px; }
  .db-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }

  /* 7일 점 캘린더 — 색만이 아니라 글리프(● ○ ·)로도 구분 */
  .db-week { display: inline-flex; align-items: center; gap: 9px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 65%, transparent); }
  .db-day { font-size: 13px; line-height: 1; color: var(--t4); font-weight: 800; }
  .db-day--on { color: var(--streak); }
  .db-day--today { outline: 2px solid color-mix(in srgb, var(--combo) 55%, transparent); outline-offset: 3px; border-radius: 50%; }

  .db-clock { padding: 10px 16px 0; }
  .db-clock .gk-timer { width: min(560px, 92vw); margin: 0 auto; }
  .db-clock .gk-timer-track { height: 10px; }
  /* 가산 상한 고지 — 3.6초 뒤 사라지는 정적 칩(모달 아님 · 학습 흐름을 끊지 않는다). */
  .db-cap { width: min(560px, 92vw); margin: 6px auto 0; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: var(--t3); border: 1px dashed var(--bd); border-radius: 999px; padding: 4px 10px; background: color-mix(in srgb, var(--bg) 70%, transparent); }

  .db-pips { display: flex; gap: 5px; align-items: center; justify-content: center; padding: 10px 16px 0; flex-wrap: wrap; }
  .db-pip { position: relative; width: 24px; height: 20px; border-radius: 6px; background: var(--bg3); border: 1px solid var(--bd); }
  .db-pip::after { content: attr(data-glyph); position: absolute; inset: 0; display: grid; place-items: center; font-size: 10px; font-weight: 800; line-height: 1; color: var(--ti); }
  .db-pip--now { border-color: var(--combo); background: color-mix(in srgb, var(--combo) 22%, transparent); animation: gk-pop 1.1s ease-in-out infinite; }
  .db-pip--now::after { color: var(--combo); }
  .db-pip--fast { background: var(--success); border-color: var(--success); }
  .db-pip--ok { background: var(--active); border-color: var(--active); }
  .db-pip--stake { background: var(--streak); border-color: var(--streak); }
  .db-pip--wrong { background: var(--error); border-color: var(--error); }
  .db-pip--skip { background: var(--bg3); border-color: var(--bd); }
  .db-pip--skip::after { color: var(--t4); }
  .db-ot-chip { margin-left: 6px; font-size: 11px; font-weight: 800; letter-spacing: .04em; color: var(--streak); border: 1px solid color-mix(in srgb, var(--streak) 45%, var(--bd)); border-radius: 999px; padding: 3px 9px; }

  .db-play { gap: clamp(14px, 3vh, 26px); justify-content: flex-start; padding-top: clamp(14px, 3vh, 30px); overflow-y: auto; overscroll-behavior: contain; }
  .db-board { display: flex; flex-direction: column; align-items: center; gap: clamp(14px, 3vh, 26px); width: min(560px, 94vw); }
  .db-prompt-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
  .db-round { font-family: var(--font-display, system-ui); font-size: 12px; font-weight: 800; letter-spacing: .1em; color: var(--t3); }
  .db-meaning { margin: 0; font-family: var(--font-display, system-ui); font-size: clamp(28px, 6.2vw, 46px); font-weight: 800; color: var(--t1); word-break: keep-all; animation: gk-pop .3s ease-out; }
  .db-staked-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800; color: var(--streak); border: 1px solid color-mix(in srgb, var(--streak) 50%, var(--bd)); background: color-mix(in srgb, var(--streak) 12%, transparent); border-radius: 999px; padding: 4px 11px; }

  .db-decide { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; }
  .db-decide-lead { margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 14px; color: var(--t2); text-align: center; }
  .db-decide-btns { display: grid; grid-template-columns: 1fr; gap: 10px; width: 100%; }
  @media (min-width: 480px) { .db-decide-btns { grid-template-columns: 1fr 1fr; } }
  .db-choice { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; min-height: 62px; padding: 10px 16px; }
  .db-choice-main { font-size: 15.5px; font-weight: 800; }
  .db-choice-sub { font-size: 11.5px; font-weight: 600; opacity: .82; display: inline-flex; align-items: center; gap: 5px; }
  /* .gk-kbd 는 색을 정하지 않아 상속받는다 — primary 버튼 위(--ti, 밝은색)에서는 배경(--bg)과
     같은 밝기라 사라진다. 칩 안에서는 본문색으로 고정. */
  .db-choice-sub .gk-kbd { color: var(--t1); }
  .db-choice--stake { border-color: color-mix(in srgb, var(--streak) 55%, var(--bd)); color: var(--t1); background: color-mix(in srgb, var(--streak) 10%, var(--bg)); }
  .db-choice--stake:hover { border-color: var(--streak); }
  .db-choice--stake:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--streak) 32%, transparent); }
  .db-choice[aria-disabled="true"] { opacity: .5; cursor: default; }
  .db-choice[aria-disabled="true"]:hover { border-color: var(--bd); }
  .gk-root .db-choice:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 32%, transparent); }

  .db-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; }
  /* 홀수 개(5지선다)면 마지막 타일이 한 칸 비우고 서지 않게 두 칸을 채운다. */
  .db-tiles > :last-child:nth-child(odd) { grid-column: 1 / -1; }
  .gk-root .db-tile { justify-content: flex-start; gap: 10px; min-height: 62px; padding: 12px 14px; font-size: clamp(15px, 3.4vw, 21px); }
  .db-tile-key { flex: none; width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; font-family: var(--font-display, system-ui); font-size: 11px; font-weight: 800; color: var(--t3); border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg2) 70%, transparent); }
  .db-tile-en { flex: 1; min-width: 0; overflow-wrap: anywhere; }

  .db-reveal { width: 100%; padding: 12px 15px; border-radius: var(--r-lg, 14px); border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 78%, transparent); display: flex; flex-direction: column; gap: 5px; text-align: left; animation: gk-pop .26s ease-out; }
  .db-reveal-head { display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; }
  .db-reveal-en { font-family: var(--font-english, var(--font-display, system-ui)); font-size: 19px; font-weight: 800; color: var(--t1); }
  .db-reveal-pron { font-size: 12.5px; color: var(--t3); }
  .db-reveal-pos { font-size: 10.5px; font-weight: 800; letter-spacing: .06em; color: var(--t3); border: 1px solid var(--bd); border-radius: 5px; padding: 1px 5px; }
  .db-reveal-ko { font-size: 14.5px; font-weight: 700; color: var(--t2); }
  .db-reveal-ex { font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13px; line-height: 1.6; color: var(--t3); }
  .db-reveal-mine { font-size: 12.5px; color: var(--t3); border-top: 1px dashed var(--bd); padding-top: 6px; margin-top: 2px; }
  .db-reveal-mine b { color: var(--t2); }
  .db-reveal-near { color: var(--streak); font-weight: 700; }

  .db-hud-streak { font-size: 13px; font-weight: 800; color: var(--streak); font-variant-numeric: tabular-nums; white-space: nowrap; }

  .db-gain-layer { height: 0; overflow: visible; pointer-events: none; }
  .db-gain { position: fixed; left: 50%; top: 46%; transform: translateX(-50%); font-family: var(--font-display, system-ui); font-size: 17px; font-weight: 800; pointer-events: none; z-index: 3; animation: gk-gain 1.05s ease-out forwards; white-space: nowrap; text-shadow: 0 1px 10px color-mix(in srgb, var(--bg) 80%, transparent); }
  .db-gain--good { color: var(--success); }
  .db-gain--bad { color: var(--error); }

  .db-miss { display: flex; flex-direction: column; gap: 8px; text-align: left; }
  .db-miss-title { font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 14px; color: var(--t2); }
  .db-miss-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; max-height: 30vh; overflow-y: auto; }
  .db-miss-item { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; min-height: 44px; padding: 7px 10px; border-radius: var(--r-md, 10px); background: color-mix(in srgb, var(--bg2) 70%, transparent); border: 1px solid var(--bd); }
  .db-miss-en { font-family: var(--font-english, var(--font-display, system-ui)); font-size: 15px; font-weight: 800; color: var(--t1); }
  .db-miss-ko { font-size: 13px; color: var(--t2); font-weight: 700; }
  .db-miss-pron { font-size: 11.5px; color: var(--t4); }
  .db-miss-ex { flex-basis: 100%; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 12px; color: var(--t3); line-height: 1.5; }

  /* 결과 화면 — 세로로 긴 구성(오답 복습 카드 + 캘린더)이라 작은 화면에서 스크롤을 허용한다. */
  .db-root .gk-done { overflow-y: auto; justify-content: center; gap: 26px; }
  /* stats 3번째 칸은 항상 결과 그리드(ResultView 의 stats 배열 순서 고정).
     기본 num 크기(최대 38px)로는 10칸이 가로를 터뜨린다. */
  .db-root .gk-done-stat:nth-child(3) .gk-done-num { font-size: clamp(15px, 3.8vw, 22px); letter-spacing: 2px; line-height: 1.3; }

  .db-foot { display: flex; flex-direction: column; align-items: center; gap: 9px; }
  .db-legend { display: flex; flex-wrap: wrap; gap: 6px 12px; justify-content: center; font-size: 11.5px; font-weight: 700; color: var(--t3); }
  .db-legend-item { display: inline-flex; align-items: center; gap: 4px; }
  .db-foot-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: center; }
  .db-next { font-size: 12px; font-weight: 800; color: var(--t3); font-variant-numeric: tabular-nums; }
  .db-foot-note { margin: 0; font-size: 11.5px; color: var(--t4); text-align: center; }

  @media (max-width: 400px) {
    .db-pip { width: 21px; height: 18px; }
    .db-clock { padding-top: 8px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .db-meaning, .db-pip--now, .db-reveal { animation: none; }
    /* 부유 텍스트는 모션 대신 정지 표기 — showGain 의 타이머가 1.15초 뒤 걷어낸다. */
    .db-gain { animation: none; opacity: 1; }
  }
`;
