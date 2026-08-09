// apps/web/src/components/game/wordblitz/WordBlitzGame.tsx
// WordBlitz — 연사(Rapid Fire). v08 전면 재설계.
//
// ── 계열 안에서 무엇으로 구분되는가 ──────────────────────────────────────
// blitz 계열 4종은 같은 인출(뜻→단어)을 공유하되 동기 장치가 달라야 한다.
//   daily-blitz  = 세션 시계를 화폐로 쓰는 데일리 의식(선불 베팅)
//   word-economy = 코인 경제와 상점 투자
//   ghost-race   = 내 최고기록 유령과의 비동기 경주
//   wordblitz    = **생존형 가속** — 시계가 없다. 목숨 3개로 어디까지 버티는가.
//
// wordblitz 에만 있는 결정: **조임 카드**. 5발(문항)을 클리어할 때마다 게임이
// 두 장을 내밀고 학습자가 "어느 방향으로 어려워질지"를 고른다. 가속이냐 혼선이냐
// 역방향이냐 잔상이냐 — 고른 카드는 그 판 내내 남고 점수 배수를 키운다.
// 다치면 '정비'(목숨 +1)가 위험 카드와 나란히 나오므로 안전과 욕심이 둘 다 합리적이다.
// → 같은 4지선다인데 판마다 빌드가 달라지고, 난이도를 스스로 정했으므로 불공정하지 않다.
//
// ── 이전 판(v07.2)에서 고친 것 ──────────────────────────────────────────
//  1) 톱니 제거 — 창(문항 제한시간)이 combo 파생이라 오답 1회에 5000ms 로 리셋됐다.
//     이제 창은 누적 진행(단계·발수)과 내가 고른 카드로만 좁아진다. 단조 감소.
//  2) 결정 0개 → 단계마다 조임 카드 1택. 콤보에는 목숨이라는 판돈이 붙었다.
//  3) 45초 세션 → 최대 8단계 × 5발(40문항) + 목숨 3. 실측 체감 2~4분.
//  4) 오답이 0.68초 스쳐가던 문제 → 오답 리빌 1.7초 + 정답 카드(뜻·발음·예문) +
//     TTS(정답/오답 양쪽, 음소거 시 침묵) + **세션 내 재출제 큐**(다시 만난 단어).
//  5) 오답 후보 완전 무작위 → 철자·품사 유사도 계층. 표적은 무복원(bag) 추출.
//  6) 자체 DoneScreen(무조건 폭죽·팡파르) → gamekit GameDone. 폭죽은 8단계 완주에만.
//
// ── 인출 규칙(비타협) ────────────────────────────────────────────────────
//  · 제출 전 화면에는 뜻(또는 영단어, 또는 빈칸 예문) 하나뿐 — 정답 특정 정보 없음.
//  · 영단어와 뜻을 동시에 보여준 채 그 쌍을 묻지 않는다.
//  · 부분 정답 오라클 없음. 힌트로 정답을 사는 경로 없음.
//  · 정답 공개는 제출 후에만, 대신 충분히(en·뜻·발음·예문).
//  · FSRS 보고(onCorrect/onWrong)는 **단어별 첫 조우 1회만** — 재출제가 학습 기록을
//    중복으로 부풀리지 않게. 재출제는 순수 세션 내 복구용이다.
//
// 계약: { wordPool?, onExit?, onCorrect?, onWrong? } + 선택적 onRestart.
// wordPool 이 오면 반드시 그 단어로 논다. 아래 BANK 는 wordPool 이 없을 때만 쓰는 맛보기.

'use client';

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  AmbientBackground,
  FeedbackIcon,
  GameDone,
  GameKitStyles,
  GameMusic,
  Hud,
  Kbd,
  NotEnoughWords,
  ParticleBurst,
  TimerBar,
  clamp,
  shuffle,
  useCombo,
  useCountUp,
  useCountdown,
  usePersonalBest,
  useSfx,
  DEFAULT_COMBO_TIERS,
  type Word,
} from '@/components/game/_shared/gamekit';

interface WordBlitzGameProps {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (word: Word) => void;
  onWrong?: (word: Word) => void;
  /**
   * 다시 하기. 주면 게임은 스스로 초기화하지 않고 이것만 호출한다 —
   * 호출부가 라운드 key 를 바꿔 새 세션 레코더로 remount 하라는 뜻
   * (useGameSessionRecorder 는 1회 가드라 remount 없이는 2판째부터 scores·XP 가 0).
   * 주지 않으면 내부적으로 초기화한다.
   */
  onRestart?: () => void;
  enableSpeech?: boolean;
}

// ─── 맛보기 뱅크 (wordPool 이 없을 때만) ─────────────────────────────────
// 예문을 함께 둔다 — '문맥' 조임 카드가 예문 빈칸으로 출제하기 때문.
const BANK: Word[] = [
  { en: 'advantage', ko: '이점, 유리한 점', pos: 'n', example: 'Her height gave her a clear advantage in the match.' },
  { en: 'reserved', ko: '내성적인', pos: 'adj', example: 'He is reserved with strangers but warm with friends.' },
  { en: 'inclined', ko: '경향이 있는', pos: 'adj', example: 'She is inclined to agree with the new plan.' },
  { en: 'consequence', ko: '결과, 영향', pos: 'n', example: 'He accepted the consequence of his careless decision.' },
  { en: 'judgment', ko: '판단, 평가', pos: 'n', example: 'Trust your own judgment rather than the rumors.' },
  { en: 'ability', ko: '능력', pos: 'n', example: 'The job requires the ability to work under pressure.' },
  { en: 'balance', ko: '균형', pos: 'n', example: 'She lost her balance on the icy step.' },
  { en: 'courage', ko: '용기', pos: 'n', example: 'It took courage to admit the mistake in public.' },
  { en: 'develop', ko: '발전시키다', pos: 'v', example: 'The city plans to develop the old harbor area.' },
  { en: 'reduce', ko: '줄이다', pos: 'v', example: 'We must reduce waste in every department.' },
  { en: 'sudden', ko: '갑작스러운', pos: 'adj', example: 'A sudden noise woke the whole house.' },
  { en: 'honest', ko: '정직한', pos: 'adj', example: 'An honest answer is better than a clever excuse.' },
  { en: 'generous', ko: '관대한', pos: 'adj', example: 'The owner was generous with his time and advice.' },
  { en: 'stubborn', ko: '고집 센', pos: 'adj', example: 'The stubborn stain would not wash out.' },
  { en: 'fragile', ko: '연약한, 깨지기 쉬운', pos: 'adj', example: 'The fragile vase was wrapped in thick paper.' },
  { en: 'genuine', ko: '진짜의, 진심의', pos: 'adj', example: 'Her surprise looked completely genuine.' },
  { en: 'obvious', ko: '분명한', pos: 'adj', example: 'The answer was obvious once he explained it.' },
  { en: 'reveal', ko: '드러내다', pos: 'v', example: 'The letter may reveal who sent the warning.' },
  { en: 'hesitate', ko: '망설이다', pos: 'v', example: 'Do not hesitate to ask for help.' },
  { en: 'persuade', ko: '설득하다', pos: 'v', example: 'She tried to persuade him to stay one more day.' },
  { en: 'endure', ko: '견디다', pos: 'v', example: 'They had to endure a long, cold winter.' },
  { en: 'scarce', ko: '부족한, 드문', pos: 'adj', example: 'Fresh water became scarce after the drought.' },
  { en: 'temporary', ko: '일시적인', pos: 'adj', example: 'This is only a temporary fix for the leak.' },
  { en: 'thorough', ko: '철저한', pos: 'adj', example: 'The inspector made a thorough search of the building.' },
];

// ─── 규칙 상수 ────────────────────────────────────────────────────────────
/** 게임이 성립하는 절대 하한(선택지 4개 + 표적 반복 완화). page 의 minWords 는 더 높다. */
const MIN_POOL = 6;
const SHOTS_PER_STAGE = 5;
const MAX_STAGES = 8;
const START_LIVES = 3;
const MAX_LIVES = 3;

const BASE_WINDOW_MS = 4600;
const MIN_WINDOW_MS = 1500;
/** 단계가 오를수록 창이 좁아진다(콤보와 무관 — 톱니 없음). */
const STAGE_TIGHTEN_MS = 140;
/** 한 단계 안에서도 발마다 조금씩 좁아진다(단계 내 미세 고조). */
const SHOT_TIGHTEN_MS = 70;
/** 읽을 것이 많은 문항에는 시간을 더 준다 — 조임은 난이도지 함정이 아니다. */
const CONTEXT_GRACE_MS = 900;
const REVERSE_GRACE_MS = 250;

const REVEAL_OK_MS = 620;
const REVEAL_MISS_MS = 1700;

const PERFECT_STAGE_BONUS = 200;
const LAPSE_SCORE_RATIO = 0.6;
const MAX_LAPSE_REPEATS = 2;

const BEST_KEY = 'wordblitz-score';

type Phase = 'playing' | 'reveal' | 'stage' | 'done';
type Outcome = 'correct' | 'wrong' | 'timeout';
type Rating = 'perfect' | 'great' | 'good';
/** 프롬프트 형태 — ko: 뜻→단어 / en: 단어→뜻(역방향) / context: 예문 빈칸→단어 */
type Form = 'ko' | 'en' | 'context';

const RATING_LABEL: Record<Rating, string> = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD' };

interface Question {
  key: number;
  target: Word;
  options: Word[];
  windowMs: number;
  form: Form;
  promptText: string;
  isLapse: boolean;
  stage: number;
  shot: number;
}

interface Mods {
  /** '가속' 획득 수 */
  speed: number;
  /** '표적 증가' 획득 수 (선택지 +n) */
  choices: number;
  /** '혼선' 획득 수 (유사 오답 강제 +n) */
  confuse: number;
  reverse: boolean;
  blind: boolean;
  context: boolean;
  /** '호흡' 획득 수 (창 완화) */
  breathe: number;
  /** 점수 배수 — 조임 카드로만 자란다. */
  mult: number;
}

const INITIAL_MODS: Mods = {
  speed: 0,
  choices: 0,
  confuse: 0,
  reverse: false,
  blind: false,
  context: false,
  breathe: 0,
  mult: 1,
};

interface CardDef {
  id: string;
  title: string;
  /** 규칙 한 줄 — 고르기 전에 무엇이 바뀌는지 정확히 안다(공정성). */
  effect: string;
  /** 배수 증가분 */
  gain: number;
  kind: 'tighten' | 'relief';
  glyph: ReactNode;
  apply: (m: Mods) => Mods;
}

const GLYPH_SPEED = (
  <>
    <path d="M6 16h9" />
    <path d="M13 9l6 7-6 7" />
    <path d="M20 9l6 7-6 7" opacity=".55" />
  </>
);
const GLYPH_CHOICES = (
  <>
    <rect x="5" y="7" width="9" height="7" rx="1.6" />
    <rect x="18" y="7" width="9" height="7" rx="1.6" />
    <rect x="5" y="18" width="9" height="7" rx="1.6" />
    <rect x="18" y="18" width="9" height="7" rx="1.6" opacity=".55" />
  </>
);
const GLYPH_CONFUSE = (
  <>
    <path d="M6 10h20" />
    <path d="M6 16h13" opacity=".8" />
    <path d="M6 22h20" />
    <path d="M23 13l4 6" opacity=".55" />
  </>
);
const GLYPH_REVERSE = (
  <>
    <path d="M7 12h16l-4-4" />
    <path d="M25 20H9l4 4" />
  </>
);
const GLYPH_BLIND = (
  <>
    <path d="M4 16s4.6-7 12-7 12 7 12 7-4.6 7-12 7-12-7-12-7Z" />
    <circle cx="16" cy="16" r="2.6" opacity=".6" />
    <path d="M6 25L26 7" />
  </>
);
const GLYPH_CONTEXT = (
  <>
    <rect x="5" y="7" width="22" height="18" rx="2.4" />
    <path d="M9 13h8M9 18h14" opacity=".8" />
    <path d="M9 22h5" opacity=".5" />
  </>
);
const GLYPH_REPAIR = (
  <>
    <path d="M16 26S6 20 6 13.5A5.5 5.5 0 0 1 16 10a5.5 5.5 0 0 1 10 3.5C26 20 16 26 16 26Z" />
  </>
);
const GLYPH_BREATHE = (
  <>
    <circle cx="16" cy="16" r="9" />
    <path d="M16 11v5l3.5 2.5" />
  </>
);

const TIGHTEN_CARDS: CardDef[] = [
  {
    id: 'speed',
    title: '가속',
    effect: '사격 창 −0.45초 (누적)',
    gain: 0.25,
    kind: 'tighten',
    glyph: GLYPH_SPEED,
    apply: (m) => ({ ...m, speed: m.speed + 1 }),
  },
  {
    id: 'choices',
    title: '표적 증가',
    effect: '선택지 +1개',
    gain: 0.3,
    kind: 'tighten',
    glyph: GLYPH_CHOICES,
    apply: (m) => ({ ...m, choices: m.choices + 1 }),
  },
  {
    id: 'confuse',
    title: '혼선',
    effect: '오답이 철자·품사가 닮은 단어로',
    gain: 0.35,
    kind: 'tighten',
    glyph: GLYPH_CONFUSE,
    apply: (m) => ({ ...m, confuse: m.confuse + 1 }),
  },
  {
    id: 'reverse',
    title: '역방향',
    effect: '한 발 걸러 영어를 보고 뜻 고르기',
    gain: 0.3,
    kind: 'tighten',
    glyph: GLYPH_REVERSE,
    apply: (m) => ({ ...m, reverse: true }),
  },
  {
    id: 'blind',
    title: '잔상',
    effect: '문제가 1.4초 뒤 흐려짐',
    gain: 0.4,
    kind: 'tighten',
    glyph: GLYPH_BLIND,
    apply: (m) => ({ ...m, blind: true }),
  },
  {
    id: 'context',
    title: '문맥',
    effect: '예문 빈칸으로 출제 (읽는 시간 +0.9초)',
    gain: 0.3,
    kind: 'tighten',
    glyph: GLYPH_CONTEXT,
    apply: (m) => ({ ...m, context: true }),
  },
];

const CARD_REPAIR: CardDef = {
  id: 'repair',
  title: '정비',
  effect: '목숨 +1 · 배수는 그대로',
  gain: 0,
  kind: 'relief',
  glyph: GLYPH_REPAIR,
  apply: (m) => m,
};
const CARD_BREATHE: CardDef = {
  id: 'breathe',
  title: '호흡',
  effect: '사격 창 +0.35초 · 배수는 그대로',
  gain: 0,
  kind: 'relief',
  glyph: GLYPH_BREATHE,
  apply: (m) => ({ ...m, breathe: m.breathe + 1 }),
};

const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(
  [...TIGHTEN_CARDS, CARD_REPAIR, CARD_BREATHE].map((c) => [c.id, c]),
);

// ─── 유사도 (오답 후보 난이도) ────────────────────────────────────────────
// 완전 무작위 오답은 "첫 글자만 봐도 풀림" → 인출이 아니라 스캔이 된다.
// 철자 근접·같은 품사·같은 어미를 점수화해 후반에 강제로 섞는다.
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
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

function nearness(cand: Word, target: Word): number {
  const a = cand.en.toLowerCase();
  const b = target.en.toLowerCase();
  let s = 0;
  if (a.slice(0, 2) === b.slice(0, 2)) s += 3;
  else if (a[0] === b[0]) s += 1.4;
  if (Math.abs(a.length - b.length) <= 2) s += 1;
  if (a.slice(-3) === b.slice(-3)) s += 1.6;
  if (cand.pos && target.pos && cand.pos === target.pos) s += 1.4;
  s += Math.max(0, 3 - levenshtein(a, b) * 0.5);
  return s;
}

/** 고른 오답이 "아까웠다"에 해당하는가 — 니어미스 사운드/아이콘 분기. */
function isNearMiss(chosen: Word, target: Word): boolean {
  const a = chosen.en.toLowerCase();
  const b = target.en.toLowerCase();
  return a.slice(0, 3) === b.slice(0, 3) || levenshtein(a, b) <= 2;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 예문에서 표적(굴절형 포함)을 빈칸으로. 못 찾으면 null → 그 단어는 문맥 출제 제외. */
function blankExample(w: Word): string | null {
  const ex = w.example?.trim();
  if (!ex || ex.length < 14 || ex.length > 170) return null;
  const forms = Array.from(new Set([w.en, ...(w.inflected ?? [])])).filter((f) => f && f.length > 1);
  let out = ex;
  for (const f of forms) out = out.replace(new RegExp(`\\b${escapeRe(f)}\\b`, 'gi'), '_____');
  if (out === ex && w.en.length > 5) {
    const stem = w.en.slice(0, w.en.length - 3);
    out = ex.replace(new RegExp(`\\b${escapeRe(stem)}[a-z]{0,5}\\b`, 'gi'), '_____');
  }
  return out === ex ? null : out;
}

function multFor(combo: number): number {
  let m = 1;
  for (const t of DEFAULT_COMBO_TIERS) if (combo >= t.at) m = t.mult;
  return m;
}

function windowFor(mods: Mods, stage: number, shot: number, form: Form): number {
  const base =
    BASE_WINDOW_MS -
    stage * STAGE_TIGHTEN_MS -
    shot * SHOT_TIGHTEN_MS -
    mods.speed * 450 +
    mods.breathe * 350;
  const grace = form === 'context' ? CONTEXT_GRACE_MS : form === 'en' ? REVERSE_GRACE_MS : 0;
  return clamp(base, MIN_WINDOW_MS, 6200) + grace;
}

// ─── 문항 타이머 (leaf) ───────────────────────────────────────────────────
// useCountdown 은 매 프레임 setState 한다. 문항 key 로 remount 되는 이 잎에 가두면
// 타일 격자와 프롬프트가 초당 60회 재조정되지 않는다.
const ShotTimer = memo(function ShotTimer({
  windowMs,
  running,
  onExpire,
}: {
  windowMs: number;
  running: boolean;
  onExpire: () => void;
}) {
  const cd = useCountdown({
    totalMs: windowMs,
    running,
    onEnd: onExpire,
    warnAtMs: Math.min(1300, Math.round(windowMs * 0.34)),
  });
  return <TimerBar frac={cd.frac} warning={cd.warning} seconds={cd.remainSec} label="이번 발 남은 시간" />;
});

// ─── 타일 보드 ────────────────────────────────────────────────────────────
const Board = memo(function Board({
  q,
  revealed,
  picked,
  outcome,
  gained,
  onPick,
}: {
  q: Question;
  revealed: boolean;
  picked: number | null;
  outcome: Outcome | null;
  gained: number;
  onPick: (i: number) => void;
}) {
  const chosen = picked != null ? q.options[picked] : null;
  const near = !!chosen && outcome === 'wrong' && isNearMiss(chosen, q.target);
  const two = q.options.length <= 2;
  return (
    <section
      className={`wbz-tiles ${two ? 'wbz-tiles--two' : ''}`}
      role="group"
      aria-label={q.form === 'en' ? '뜻 선택' : '단어 선택'}
    >
      {q.options.map((opt, i) => {
        const isPicked = picked === i;
        const isAnswer = opt.en === q.target.en;
        let tone = '';
        if (revealed) {
          if (isAnswer) tone = 'wbz-tile--correct';
          else if (isPicked) tone = 'wbz-tile--wrong';
          else tone = 'wbz-tile--dim';
        }
        return (
          <button
            key={`${q.key}-${opt.en}`}
            type="button"
            aria-disabled={revealed}
            onClick={() => {
              if (!revealed) onPick(i);
            }}
            className={`wbz-tile ${tone} ${q.form === 'en' ? 'wbz-tile--ko' : ''}`}
            style={{ animationDelay: revealed ? undefined : `${i * 0.035}s` }}
          >
            <span className="wbz-tile-num" aria-hidden="true">
              {i + 1}
            </span>
            <span className="wbz-tile-word">{q.form === 'en' ? opt.ko : opt.en}</span>
            {revealed && isAnswer && (
              <span className="wbz-tile-icon wbz-tile-icon--ok">
                <FeedbackIcon kind="correct" size={22} />
              </span>
            )}
            {revealed && isPicked && !isAnswer && (
              <span className="wbz-tile-icon wbz-tile-icon--no">
                <FeedbackIcon kind={near ? 'near' : 'wrong'} size={22} />
              </span>
            )}
            {revealed && isPicked && outcome === 'correct' && gained > 0 && (
              <span className="wbz-gain" aria-hidden="true">
                +{gained.toLocaleString()}
              </span>
            )}
            {revealed && isAnswer && outcome === 'correct' && (
              <ParticleBurst intensity={2} />
            )}
          </button>
        );
      })}
    </section>
  );
});

export function WordBlitzGame({
  wordPool,
  onExit,
  onCorrect,
  onWrong,
  onRestart,
  enableSpeech = true,
}: WordBlitzGameProps) {
  const pool = useMemo(() => {
    const p = wordPool && wordPool.length > 0 ? wordPool : BANK;
    const seen = new Set<string>();
    return p.filter((w) => {
      const k = w.en.trim().toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [wordPool]);

  /** '문맥' 카드를 제안할 수 있는가 — 빈칸을 만들 수 있는 단어가 충분해야 한다. */
  const contextable = useMemo(() => pool.filter((w) => blankExample(w) !== null).length, [pool]);
  const maxTiles = Math.min(6, pool.length);

  const sfx = useSfx();
  const mutedRef = useRef(false);
  mutedRef.current = sfx.muted;

  const [phase, setPhase] = useState<Phase>('playing');
  const [question, setQuestion] = useState<Question | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [gained, setGained] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [stage, setStage] = useState(0);
  const [shot, setShot] = useState(0);
  const [mods, setMods] = useState<Mods>(INITIAL_MODS);
  const [pickedCards, setPickedCards] = useState<string[]>([]);
  const [cardPair, setCardPair] = useState<CardDef[]>([]);
  const [answered, setAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [perfectStages, setPerfectStages] = useState(0);
  const [missed, setMissed] = useState<Word[]>([]);
  const [flash, setFlash] = useState<{ kind: 'combo' | 'stage'; text: string } | null>(null);
  const [srMsg, setSrMsg] = useState('');
  const [cleared, setCleared] = useState(false);
  const [finalBest, setFinalBest] = useState<{ prev: number | null; improved: boolean }>({
    prev: null,
    improved: false,
  });

  const shownScore = useCountUp(score);

  // 콤보 티어가 올라가는 순간만 배너 — 매 정답마다 터뜨리면 Calm 이 깨진다.
  const combo = useCombo({
    onTierUp: (tier, c) => {
      if (tier.label) setFlash({ kind: 'combo', text: `${tier.label} · 콤보 ${c} · ×${tier.mult}` });
    },
  });
  const best = usePersonalBest(BEST_KEY, true);

  // ── 로직용 ref (rAF·타이머 콜백에서 stale 방지) ──
  const answeredGuardRef = useRef(false);
  const questionRef = useRef<Question | null>(null);
  const startAtRef = useRef(0);
  const keyRef = useRef(0);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const modsRef = useRef(mods);
  modsRef.current = mods;
  const livesRef = useRef(lives);
  livesRef.current = lives;
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const answeredRef = useRef(0);
  const bagRef = useRef<Word[]>([]);
  const recentRef = useRef<string[]>([]);
  const lapseRef = useRef<{ word: Word; dueAt: number }[]>([]);
  /** 단어별 재출제 횟수 — 무한 재출제를 막는 유일한 진실(큐에서 빠져도 남는다). */
  const lapseCountRef = useRef(new Map<string, number>());
  const stageMissRef = useRef(0);
  /** FSRS 보고 1회 가드 — 재출제가 학습 기록을 중복으로 부풀리지 않게. */
  const reportedRef = useRef(new Set<string>());
  const scoreRef = useRef(0);
  scoreRef.current = score;
  const phaseRef = useRef<Phase>('playing');
  phaseRef.current = phase;

  const enoughWords = pool.length >= MIN_POOL;

  const showFlash = useCallback((kind: 'combo' | 'stage', text: string) => {
    setFlash({ kind, text });
  }, []);

  useEffect(() => {
    if (!flash) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(null), 1100);
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [flash]);

  const speak = useCallback(
    (text: string) => {
      if (!enableSpeech || mutedRef.current) return;
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        u.rate = 1.02;
        window.speechSynthesis.speak(u);
      } catch {
        /* 음성 합성 미지원 — 무해 */
      }
    },
    [enableSpeech],
  );

  // ── 표적 추출: 무복원(bag). 직전 3개와 겹치면 한 칸 회전. ──
  const drawTarget = useCallback((): Word => {
    if (bagRef.current.length === 0) {
      let next = shuffle(pool);
      if (next.length > 1 && recentRef.current.includes(next[next.length - 1].en)) {
        next = [next[next.length - 1], ...next.slice(0, next.length - 1)];
      }
      bagRef.current = next;
    }
    const w = bagRef.current.pop()!;
    recentRef.current = [...recentRef.current, w.en].slice(-3);
    return w;
  }, [pool]);

  const buildOptions = useCallback(
    (target: Word, n: number, hardness: number): Word[] => {
      const others = pool.filter((w) => w.en !== target.en);
      if (others.length <= n - 1) return shuffle([target, ...others]);
      const want = clamp(hardness, 0, n - 1);
      let similar: Word[] = [];
      if (want > 0) {
        const ranked = [...others].sort((a, b) => nearness(b, target) - nearness(a, target));
        const bandSize = Math.min(others.length, Math.max(want + 2, (n - 1) * 2));
        similar = shuffle(ranked.slice(0, bandSize)).slice(0, want);
      }
      const chosenSet = new Set(similar.map((w) => w.en));
      const rest = shuffle(others.filter((w) => !chosenSet.has(w.en))).slice(0, n - 1 - similar.length);
      return shuffle([target, ...similar, ...rest]);
    },
    [pool],
  );

  const startShot = useCallback(
    (stageIdx: number, shotIdx: number) => {
      if (!mountedRef.current) return;
      const m = modsRef.current;
      const total = answeredRef.current;

      // 재출제 큐 우선 — 틀린 단어를 3~5문항 뒤에 다시 만난다.
      let target: Word | null = null;
      let isLapse = false;
      const dueIdx = lapseRef.current.findIndex((l) => l.dueAt <= total);
      if (dueIdx >= 0) {
        const [entry] = lapseRef.current.splice(dueIdx, 1);
        target = entry.word;
        isLapse = true;
        recentRef.current = [...recentRef.current, entry.word.en].slice(-3);
      }
      if (!target) target = drawTarget();

      let form: Form = 'ko';
      let promptText = target.ko;
      if (m.context) {
        const blanked = blankExample(target);
        if (blanked) {
          form = 'context';
          promptText = blanked;
        }
      }
      if (form === 'ko' && m.reverse && total % 2 === 1) {
        form = 'en';
        promptText = target.en;
      }

      const n = clamp(4 + m.choices, 2, maxTiles);
      const baseHard = stageIdx < 2 ? 0 : stageIdx < 4 ? 1 : 2;
      const options = buildOptions(target, n, baseHard + m.confuse);

      keyRef.current += 1;
      const q: Question = {
        key: keyRef.current,
        target,
        options,
        windowMs: windowFor(m, stageIdx, shotIdx, form),
        form,
        promptText,
        isLapse,
        stage: stageIdx,
        shot: shotIdx,
      };
      questionRef.current = q;
      answeredGuardRef.current = false;
      startAtRef.current = Date.now();
      setQuestion(q);
      setStage(stageIdx);
      setShot(shotIdx);
      setPicked(null);
      setOutcome(null);
      setRating(null);
      setGained(0);
      setPhase('playing');
    },
    [buildOptions, drawTarget, maxTiles],
  );

  const startShotRef = useRef(startShot);
  startShotRef.current = startShot;

  // ── 단계 종료 처리 ──
  const finishStage = useCallback(
    (stageIdx: number) => {
      const clean = stageMissRef.current === 0;
      if (clean) {
        const bonus = Math.round(PERFECT_STAGE_BONUS * modsRef.current.mult);
        setScore((s) => s + bonus);
        setPerfectStages((p) => p + 1);
        showFlash('stage', `무결점 단계 +${bonus.toLocaleString()}`);
        sfx.coin();
      }
      stageMissRef.current = 0;

      if (stageIdx + 1 >= MAX_STAGES) {
        setCleared(true);
        setPhase('done');
        setQuestion(null);
        questionRef.current = null;
        return;
      }

      // 조임 카드 2장 뽑기 — 다쳤으면 '정비'가 나란히 선다(안전/욕심 트레이드오프).
      const m = modsRef.current;
      const avail = TIGHTEN_CARDS.filter((c) => {
        if (c.id === 'speed') return m.speed < 4;
        if (c.id === 'choices') return m.choices < 2 && maxTiles >= 4 + m.choices + 1;
        if (c.id === 'confuse') return m.confuse < 2 && pool.length >= 6;
        if (c.id === 'reverse') return !m.reverse;
        if (c.id === 'blind') return !m.blind;
        if (c.id === 'context') return !m.context && contextable >= 4;
        return false;
      });
      const shuffledAvail = shuffle(avail);
      const slotA = shuffledAvail[0] ?? CARD_BREATHE;
      let slotB: CardDef;
      if (livesRef.current < MAX_LIVES) slotB = CARD_REPAIR;
      else if (m.breathe < 2) slotB = CARD_BREATHE;
      else slotB = shuffledAvail[1] ?? CARD_BREATHE;
      // 같은 카드 두 장은 선택이 아니다(그리고 key 도 충돌한다).
      if (slotB.id === slotA.id) slotB = slotA.id === 'breathe' ? CARD_REPAIR : CARD_BREATHE;
      setCardPair(shuffle([slotA, slotB]));
      setStage(stageIdx + 1);
      setShot(0);
      setPhase('stage');
      setQuestion(null);
      questionRef.current = null;
    },
    [contextable, maxTiles, pool.length, sfx, showFlash],
  );

  const finishStageRef = useRef(finishStage);
  finishStageRef.current = finishStage;

  const endRun = useCallback(() => {
    setPhase('done');
    setQuestion(null);
    questionRef.current = null;
  }, []);

  // ── 제출 ──
  const answer = useCallback(
    (tileIndex: number | null) => {
      if (answeredGuardRef.current) return;
      const q = questionRef.current;
      if (!q) return;
      answeredGuardRef.current = true;

      const chosen = tileIndex === null ? null : q.options[tileIndex];
      const isCorrect = !!chosen && chosen.en === q.target.en;
      const elapsed = Date.now() - startAtRef.current;
      const remainRatio = clamp(1 - elapsed / q.windowMs, 0, 1);
      const firstTime = !reportedRef.current.has(q.target.en);

      answeredRef.current += 1;
      setAnswered(answeredRef.current);
      setPicked(tileIndex);

      let nextLives = livesRef.current;

      if (isCorrect) {
        const c = combo.hit();
        const rt: Rating = remainRatio > 0.62 ? 'perfect' : remainRatio > 0.34 ? 'great' : 'good';
        const ratingBonus = rt === 'perfect' ? 40 : rt === 'great' ? 20 : 0;
        const raw = (100 + Math.round(remainRatio * 60) + ratingBonus) * multFor(c) * modsRef.current.mult;
        const g = Math.round(raw * (q.isLapse ? LAPSE_SCORE_RATIO : 1));
        setGained(g);
        setScore((s) => s + g);
        setRating(rt);
        setCorrectCount((n) => n + 1);
        setOutcome('correct');
        setSrMsg(`정답 ${q.target.en}. 콤보 ${c}. ${g}점.`);
        sfx.correct(c, false);
        speak(q.target.en);
        if (firstTime) {
          reportedRef.current.add(q.target.en);
          onCorrect?.(q.target);
        }
      } else {
        combo.miss();
        nextLives = Math.max(0, livesRef.current - 1);
        setLives(nextLives);
        stageMissRef.current += 1;
        setOutcome(tileIndex === null ? 'timeout' : 'wrong');
        setRating(null);
        setGained(0);
        setMissed((prev) => (prev.some((w) => w.en === q.target.en) ? prev : [...prev, q.target]));
        setSrMsg(
          tileIndex === null
            ? `시간 초과. 정답은 ${q.target.en}, 뜻은 ${q.target.ko}. 남은 목숨 ${nextLives}.`
            : `오답. 정답은 ${q.target.en}, 뜻은 ${q.target.ko}. 남은 목숨 ${nextLives}.`,
        );
        if (chosen && isNearMiss(chosen, q.target)) sfx.nearMiss();
        else sfx.wrong();
        speak(q.target.en);
        if (firstTime) {
          reportedRef.current.add(q.target.en);
          onWrong?.(q.target);
        }
        // 세션 내 복구 기회 — 3~5문항 뒤 재출제(단어당 최대 2회).
        const queued = lapseCountRef.current.get(q.target.en) ?? 0;
        if (queued < MAX_LAPSE_REPEATS) {
          lapseCountRef.current.set(q.target.en, queued + 1);
          lapseRef.current = [
            ...lapseRef.current.filter((l) => l.word.en !== q.target.en),
            { word: q.target, dueAt: answeredRef.current + 3 + Math.floor(Math.random() * 3) },
          ];
        }
      }

      setPhase('reveal');
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      revealTimerRef.current = setTimeout(
        () => {
          if (!mountedRef.current) return;
          if (nextLives <= 0) {
            endRun();
            return;
          }
          const nextShot = q.shot + 1;
          if (nextShot >= SHOTS_PER_STAGE) finishStageRef.current(q.stage);
          else startShotRef.current(q.stage, nextShot);
        },
        isCorrect ? REVEAL_OK_MS : REVEAL_MISS_MS,
      );
    },
    [combo, endRun, onCorrect, onWrong, sfx, speak],
  );

  const answerRef = useRef(answer);
  answerRef.current = answer;

  const onPick = useCallback((i: number) => answerRef.current(i), []);
  const onExpire = useCallback(() => answerRef.current(null), []);

  // ── 조임 카드 선택 ──
  const chooseCard = useCallback(
    (card: CardDef) => {
      if (phaseRef.current !== 'stage') return;
      // 같은 틱에 두 번 눌리면(더블탭·키 리핏) 두 장을 다 먹는다 — 렌더를 기다리지 않고 잠근다.
      phaseRef.current = 'playing';
      sfx.click();
      if (card.id === 'repair') setLives((l) => Math.min(MAX_LIVES, l + 1));
      const next = { ...card.apply(modsRef.current) };
      next.mult = Math.round((next.mult + card.gain) * 100) / 100;
      modsRef.current = next;
      setMods(next);
      setPickedCards((p) => [...p, card.id]);
      setCardPair([]);
      setSrMsg(`${card.title} 선택. ${card.effect}.`);
      startShotRef.current(stageRef.current, 0);
    },
    [sfx],
  );

  const chooseCardRef = useRef(chooseCard);
  chooseCardRef.current = chooseCard;

  // ── 최종 기록 제출 ──
  useEffect(() => {
    if (phase !== 'done') return;
    const r = best.submit(scoreRef.current);
    setFinalBest({ prev: r.prev, improved: r.improved });
    if (cleared) sfx.fanfare();
    // best.submit 은 렌더마다 새 함수 — phase 전이 1회만 돌게 의도적으로 제외한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── 마운트 / 정리 ──
  useEffect(() => {
    mountedRef.current = true;
    if (pool.length >= MIN_POOL) startShotRef.current(0, 0);
    return () => {
      mountedRef.current = false;
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* 무해 */
        }
      }
    };
    // 풀은 세션 중 바뀌지 않는다(스코프 확정 후 마운트).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 키보드 ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number.parseInt(e.key, 10);
      if (Number.isNaN(n)) return;
      if (phase === 'playing' && question && n >= 1 && n <= question.options.length) {
        e.preventDefault();
        answerRef.current(n - 1);
        return;
      }
      if (phase === 'stage' && n >= 1 && n <= cardPair.length) {
        e.preventDefault();
        chooseCardRef.current(cardPair[n - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, question, cardPair]);

  const handleRestart = useCallback(() => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    if (onRestart) {
      onRestart();
      return;
    }
    combo.reset();
    modsRef.current = INITIAL_MODS;
    answeredRef.current = 0;
    bagRef.current = [];
    recentRef.current = [];
    lapseRef.current = [];
    lapseCountRef.current = new Map();
    stageMissRef.current = 0;
    reportedRef.current = new Set();
    setMods(INITIAL_MODS);
    setPickedCards([]);
    setCardPair([]);
    setScore(0);
    setLives(START_LIVES);
    setAnswered(0);
    setCorrectCount(0);
    setPerfectStages(0);
    setMissed([]);
    setCleared(false);
    setFlash(null);
    setSrMsg('');
    startShotRef.current(0, 0);
  }, [combo, onRestart]);

  const handleExit = useCallback(() => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    onExit?.();
  }, [onExit]);

  if (!enoughWords) {
    return <NotEnoughWords need={MIN_POOL} onExit={onExit} />;
  }

  const accuracy = answered > 0 ? Math.round((correctCount / answered) * 100) : 0;
  const tight = question ? question.windowMs <= 2400 : false;
  const revealed = phase === 'reveal';
  const q = question;

  const restartHint = (() => {
    if (finalBest.improved) return '다음 판은 다른 조임 카드로 — 같은 단어도 다른 게임이 됩니다.';
    if (best.best != null && best.best > score) return `개인 최고까지 ${(best.best - score).toLocaleString()}점.`;
    return '5발마다 고르는 조임 카드가 판을 바꿉니다.';
  })();

  const badge: ReactNode = cleared ? (
    <>
      <span aria-hidden="true">🏁</span> 8단계 완주
    </>
  ) : finalBest.improved ? (
    <>
      <span aria-hidden="true">↗</span> 개인 최고 갱신
    </>
  ) : perfectStages > 0 ? (
    <>
      <span aria-hidden="true">◎</span> 무결점 {perfectStages}단계
    </>
  ) : undefined;

  return (
    <div className="wbz-root" data-tight={tight ? '1' : '0'} data-low={lives <= 1 ? '1' : '0'}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <GameKitStyles />
      <AmbientBackground center="#F3EEFF" mid="#CDBBF2" edge="#2A1B45" glow="rgba(190,160,255,.5)" />
      <GameMusic gameId="wordblitz" />

      <Hud
        score={shownScore}
        progress={(stage * SHOTS_PER_STAGE + shot) / (MAX_STAGES * SHOTS_PER_STAGE)}
        combo={combo.combo}
        comboMult={multFor(combo.combo)}
        lives={{ total: MAX_LIVES, left: lives, label: '남은 목숨' }}
        extra={
          <div className="wbz-meta" aria-hidden="true">
            <span className="wbz-chip wbz-chip--stage">
              단계 {Math.min(stage + 1, MAX_STAGES)}/{MAX_STAGES}
            </span>
            <span className="wbz-chip wbz-chip--mult">×{mods.mult.toFixed(2)}</span>
          </div>
        }
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={onExit ? handleExit : undefined}
      />

      <div className="gk-sr" aria-live="polite" role="status">
        {srMsg}
      </div>

      {phase === 'done' ? (
        <GameDone
          lead={cleared ? '끝까지 버텼어요' : '오늘 잘 마쳤어요'}
          celebrate={cleared}
          badge={badge}
          stats={[
            { num: score.toLocaleString(), label: '점수', accent: true },
            { num: `${correctCount}/${answered}`, label: `정답 · ${accuracy}%` },
            { num: `🔥 ${combo.best}`, label: '최고 콤보' },
            { num: `${Math.min(stage + 1, MAX_STAGES)}단계`, label: `배수 ×${mods.mult.toFixed(2)}` },
          ]}
          best={{ prev: finalBest.prev, now: score, label: '점수', improved: finalBest.improved }}
          restartLabel="한 판 더"
          restartHint={restartHint}
          reveal={
            missed.length > 0 ? (
              <div className="wbz-recap">
                <p className="wbz-recap-title">이번 판에서 놓친 단어</p>
                <ul className="wbz-recap-list">
                  {missed.slice(0, 8).map((w) => (
                    <li key={w.en}>
                      <b className="wbz-recap-en">{w.en}</b>
                      <span className="wbz-recap-ko">{w.ko}</span>
                      {w.pron && <span className="wbz-recap-pron">{w.pron}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ) : undefined
          }
          footer={
            pickedCards.length > 0 ? (
              <>
                <span className="wbz-build-label">이번 판의 조임</span>
                {pickedCards.map((id, i) => (
                  <span key={`${id}-${i}`} className="wbz-build-chip">
                    {CARD_BY_ID[id]?.title ?? id}
                  </span>
                ))}
              </>
            ) : undefined
          }
          onRestart={handleRestart}
          onExit={handleExit}
        />
      ) : phase === 'stage' ? (
        <main className="wbz-cards" aria-label="조임 카드 선택">
          <p className="wbz-cards-lead">
            {stage === 1 ? '5발마다 한 장 — 어느 방향으로 어려워질지 고르세요' : `단계 ${stage + 1} 준비`}
          </p>
          <p className="wbz-cards-sub">
            고른 카드는 이 판 내내 남고 점수 배수를 키웁니다. 현재 ×{mods.mult.toFixed(2)}
          </p>
          <div className="wbz-card-row">
            {cardPair.map((c, i) => (
              <button
                key={c.id}
                type="button"
                className={`wbz-card wbz-card--${c.kind}`}
                onClick={() => chooseCardRef.current(c)}
              >
                <span className="wbz-card-top">
                  <svg
                    viewBox="0 0 32 32"
                    className="wbz-card-glyph"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {c.glyph}
                  </svg>
                  <span className="wbz-card-gain">
                    {c.gain > 0 ? `배수 +${c.gain.toFixed(2)}` : '배수 유지'}
                  </span>
                </span>
                <span className="wbz-card-title">{c.title}</span>
                <span className="wbz-card-effect">{c.effect}</span>
                <span className="wbz-card-key">
                  <Kbd>{i + 1}</Kbd>
                </span>
              </button>
            ))}
          </div>
          <p className="wbz-cards-foot">
            지금 기준 — 창 {(windowFor(mods, stage, 0, 'ko') / 1000).toFixed(1)}초 · 선택지{' '}
            {clamp(4 + mods.choices, 2, maxTiles)}개 · 목숨 {lives}/{MAX_LIVES}
          </p>
        </main>
      ) : q ? (
        <main className="wbz-stage" key={q.key}>
          <section className="wbz-prompt">
            <div className="wbz-prompt-head">
              <span className="wbz-prompt-label">
                {q.form === 'context' ? '빈칸에 들어갈 단어는?' : q.form === 'en' ? '이 단어의 뜻은?' : '이 뜻의 단어는?'}
              </span>
              {q.isLapse && (
                <span className="wbz-chip wbz-chip--lapse">
                  <span aria-hidden="true">↺</span> 다시 만난 단어
                </span>
              )}
            </div>

            <h1
              className={`wbz-prompt-text ${q.form === 'en' ? 'wbz-prompt-text--en' : ''} ${
                q.form === 'context' ? 'wbz-prompt-text--ctx' : ''
              } ${mods.blind && !revealed ? 'wbz-blind' : ''}`}
            >
              {q.promptText}
            </h1>

            <div className="wbz-timer-wrap">
              <ShotTimer key={q.key} windowMs={q.windowMs} running={!revealed} onExpire={onExpire} />
            </div>

            {revealed && outcome === 'correct' && rating && (
              <div className={`wbz-verdict wbz-verdict--${rating}`}>
                <FeedbackIcon kind="correct" size={16} />
                <span>{RATING_LABEL[rating]}</span>
                {q.isLapse && <span className="wbz-verdict-note">복구 · 점수 60%</span>}
              </div>
            )}

            {revealed && outcome !== 'correct' && (
              <div className="wbz-answer" role="group" aria-label="정답 공개">
                <span className={`wbz-answer-tag ${outcome === 'timeout' ? 'wbz-answer-tag--time' : ''}`}>
                  <FeedbackIcon kind="wrong" size={14} />
                  {outcome === 'timeout' ? '시간 초과' : '오답'}
                </span>
                <div className="wbz-answer-body">
                  <b className="wbz-answer-en">{q.target.en}</b>
                  <span className="wbz-answer-ko">{q.target.ko}</span>
                  {q.target.pron && <span className="wbz-answer-pron">{q.target.pron}</span>}
                  {q.target.example && <span className="wbz-answer-ex">{q.target.example}</span>}
                </div>
              </div>
            )}
          </section>

          <Board
            q={q}
            revealed={revealed}
            picked={picked}
            outcome={outcome}
            gained={gained}
            onPick={onPick}
          />

          <p className="wbz-hint" aria-hidden="true">
            탭 또는 <Kbd>1</Kbd>–<Kbd>{q.options.length}</Kbd> · {SHOTS_PER_STAGE}발마다 조임 카드 · 목숨 {lives}
          </p>
        </main>
      ) : null}

      {/* 배너는 본문 뒤에 둔다 — 앞에 두면 같은 z-index 의 본문이 위로 덮는다. */}
      {flash && (
        <div className={`wbz-flash wbz-flash--${flash.kind}`} aria-hidden="true">
          {flash.text}
        </div>
      )}
    </div>
  );
}

// 테마 토큰 기반(라이트/다크 자동). 게임 예외로 --combo/--streak 사용.
const STYLES = `
  .wbz-root {
    /* dvh 미지원 브라우저용 폴백 → 지원 시 뒤 선언이 이긴다(iOS 주소창 대응). */
    position: relative; width: 100vw; height: 100vh; height: 100dvh; overflow: hidden;
    display: flex; flex-direction: column;
    background: var(--bg2); color: var(--t1);
    font-family: var(--font-display, system-ui, sans-serif); user-select: none;
  }
  .wbz-root > :not(.gk-atmos):not(.gk-music-btn) { position: relative; z-index: 1; }
  /* 창이 좁아진 후반 — 색만 바꾸는 조용한 압박(폭죽·번쩍임 아님) */
  .wbz-root[data-tight="1"] .wbz-prompt-text { text-shadow: 0 0 24px color-mix(in srgb, var(--streak) 24%, transparent); }
  .wbz-root[data-low="1"]::after {
    content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 2;
    box-shadow: inset 0 0 120px 8px color-mix(in srgb, var(--error) 16%, transparent);
  }

  .wbz-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .wbz-chip {
    display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px;
    border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 74%, transparent);
    font-size: 11px; font-weight: 800; color: var(--t2); letter-spacing: -.01em; white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .wbz-chip--mult { color: var(--combo); border-color: color-mix(in srgb, var(--combo) 42%, var(--bd)); }
  .wbz-chip--lapse { color: var(--t2); border-color: color-mix(in srgb, var(--active, var(--combo)) 45%, var(--bd)); }

  .wbz-flash {
    position: absolute; top: 21%; left: 50%; transform: translateX(-50%); z-index: 3; pointer-events: none;
    font-size: clamp(17px, 4.2vw, 26px); font-weight: 900; letter-spacing: -.01em; text-align: center;
    animation: wbz-flash .95s var(--ease, ease-out) forwards;
  }
  .wbz-flash--combo { color: var(--streak); text-shadow: 0 4px 22px color-mix(in srgb, var(--streak) 55%, transparent); }
  .wbz-flash--stage { color: var(--combo); text-shadow: 0 4px 22px color-mix(in srgb, var(--combo) 45%, transparent); }

  .wbz-stage {
    flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: clamp(18px, 3.6vh, 38px); padding: 18px 16px; animation: wbz-in .24s var(--ease, ease-out);
  }
  .wbz-prompt {
    width: 100%; max-width: 640px; display: flex; flex-direction: column; align-items: center; gap: 12px;
    text-align: center; min-height: clamp(158px, 26vh, 210px); justify-content: flex-start;
  }
  .wbz-prompt-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .wbz-prompt-label { font-size: 12px; font-weight: 800; letter-spacing: .09em; color: var(--t3); text-transform: uppercase; }
  .wbz-prompt-text {
    margin: 0; font-size: clamp(24px, 5.6vw, 42px); font-weight: 800; color: var(--t1); line-height: 1.18;
    word-break: keep-all; overflow-wrap: anywhere;
  }
  .wbz-prompt-text--en { font-family: var(--font-english, var(--font-display, system-ui)); word-break: normal; }
  .wbz-prompt-text--ctx {
    font-family: var(--font-english, var(--font-display, system-ui));
    font-size: clamp(16px, 3.4vw, 24px); font-weight: 700; line-height: 1.5; max-width: 34ch;
  }
  /* '잔상' 카드 — 규칙이지 장식이 아니라 reduced-motion 에서도 유지한다. */
  .wbz-blind { animation: wbz-blur .55s ease 1.4s forwards; }

  .wbz-timer-wrap { width: min(320px, 82%); }

  .wbz-verdict {
    display: inline-flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 900; letter-spacing: .04em;
    animation: wbz-rise .5s var(--ease, ease-out);
  }
  .wbz-verdict--perfect { color: var(--streak); font-size: 16px; }
  .wbz-verdict--great { color: var(--combo); }
  .wbz-verdict--good { color: var(--success); }
  .wbz-verdict-note { font-size: 11.5px; font-weight: 700; color: var(--t3); letter-spacing: 0; }

  .wbz-answer {
    display: flex; align-items: flex-start; gap: 10px; text-align: left;
    max-width: min(560px, 94vw); padding: 10px 14px; border-radius: var(--r-lg, 14px);
    border: 1px solid color-mix(in srgb, var(--error) 34%, var(--bd));
    background: color-mix(in srgb, var(--bg) 80%, transparent);
    animation: wbz-rise .3s var(--ease, ease-out);
  }
  .wbz-answer-tag {
    display: inline-flex; align-items: center; gap: 5px; flex: none; margin-top: 2px;
    font-size: 11.5px; font-weight: 800; color: var(--error); white-space: nowrap;
  }
  .wbz-answer-tag--time { color: var(--warning); }
  .wbz-answer-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .wbz-answer-en { font-family: var(--font-english, var(--font-display, system-ui)); font-size: 21px; font-weight: 800; color: var(--t1); overflow-wrap: anywhere; }
  .wbz-answer-ko { font-size: 14px; font-weight: 700; color: var(--t2); }
  .wbz-answer-pron { font-family: var(--font-english, var(--font-display, system-ui)); font-size: 12.5px; color: var(--t3); }
  .wbz-answer-ex { font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13px; color: var(--t3); line-height: 1.5; }

  .wbz-tiles { width: 100%; max-width: 640px; display: grid; grid-template-columns: 1fr 1fr; gap: clamp(10px, 2.2vw, 16px); }
  .wbz-tiles--two { grid-template-columns: 1fr; max-width: 420px; }
  .wbz-tile {
    position: relative; overflow: visible; display: flex; align-items: center; gap: 10px;
    min-height: 74px; padding: 14px 16px; border-radius: var(--r-lg, 14px);
    border: 1.5px solid var(--bd); background: var(--bg); color: var(--t1);
    font-family: var(--font-english, var(--font-display, system-ui));
    font-size: clamp(15px, 3.4vw, 23px); font-weight: 700; cursor: pointer; text-align: left;
    transition: transform .14s var(--ease, ease-out), border-color .15s, background .15s, box-shadow .15s, opacity .15s;
    animation: wbz-tile-in .28s var(--ease, ease-out) both;
  }
  .wbz-tile--ko { font-family: var(--font-display, system-ui); font-size: clamp(14px, 3.1vw, 20px); word-break: keep-all; }
  .wbz-tile:hover:not([aria-disabled="true"]) { border-color: var(--combo); transform: translateY(-3px); box-shadow: 0 8px 24px color-mix(in srgb, var(--combo) 18%, transparent); }
  .wbz-tile:active:not([aria-disabled="true"]) { transform: translateY(0) scale(.96); }
  .wbz-tile:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 32%, transparent); }
  /* 리빌에 disabled 를 걸면 포커스가 날아간다 — aria-disabled + 핸들러 가드. */
  .wbz-tile[aria-disabled="true"] { cursor: default; animation: none; }
  .wbz-tile-num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; flex: none; border-radius: 7px; background: var(--bg3); color: var(--t3);
    font-family: var(--font-display, system-ui); font-size: 12px; font-weight: 800;
  }
  .wbz-tile-word { flex: 1; min-width: 0; overflow-wrap: anywhere; hyphens: auto; }
  .wbz-tile-icon { flex: none; display: inline-flex; animation: wbz-pop .34s var(--ease, ease-out) .04s both; }
  .wbz-tile-icon--ok { color: var(--success); }
  .wbz-tile-icon--no { color: var(--error); }
  .wbz-tile--correct {
    border-color: var(--success); background: var(--success-light); color: var(--success);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 32%, transparent), 0 8px 30px color-mix(in srgb, var(--success) 26%, transparent);
    animation: wbz-correct .4s var(--ease, ease-out);
  }
  .wbz-tile--correct .wbz-tile-num { background: var(--success); color: var(--ti); }
  .wbz-tile--wrong { border-color: var(--error); background: var(--error-light); color: var(--error); animation: wbz-shake .34s ease-in-out; }
  .wbz-tile--dim { opacity: .4; }
  .wbz-gain {
    position: absolute; top: 3px; right: 10px; font-family: var(--font-display, system-ui);
    font-size: 14px; font-weight: 900; color: var(--success); font-variant-numeric: tabular-nums;
    animation: wbz-gain .8s var(--ease, ease-out) forwards;
  }

  .wbz-hint { margin: 0; font-size: 12px; color: var(--t3); text-align: center; }

  /* ── 조임 카드 선택 ── */
  .wbz-cards {
    flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 14px; padding: 22px 16px; animation: wbz-in .26s var(--ease, ease-out); overflow-y: auto;
  }
  .wbz-cards-lead {
    margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic;
    font-size: clamp(18px, 4.2vw, 26px); font-weight: 500; color: var(--t1); text-align: center;
  }
  .wbz-cards-sub { margin: 0; font-size: 13px; color: var(--t3); text-align: center; max-width: 36ch; }
  .wbz-card-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; max-width: 620px; }
  .wbz-card {
    display: flex; flex-direction: column; align-items: flex-start; gap: 7px;
    min-height: 148px; padding: 16px; border-radius: var(--r-lg, 14px);
    border: 1.5px solid var(--bd); background: color-mix(in srgb, var(--bg) 88%, transparent);
    color: var(--t1); text-align: left; cursor: pointer;
    transition: transform .16s var(--ease, ease-out), border-color .15s, box-shadow .15s, background .15s;
  }
  .wbz-card:hover { transform: translateY(-3px); border-color: var(--combo); box-shadow: 0 10px 28px color-mix(in srgb, var(--combo) 18%, transparent); }
  .wbz-card:active { transform: translateY(0) scale(.975); }
  .wbz-card:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 32%, transparent); }
  .wbz-card:disabled { opacity: .5; cursor: not-allowed; transform: none; }
  .wbz-card--relief { border-color: color-mix(in srgb, var(--success) 40%, var(--bd)); }
  .wbz-card--relief:hover { border-color: var(--success); box-shadow: 0 10px 28px color-mix(in srgb, var(--success) 18%, transparent); }
  .wbz-card--relief .wbz-card-glyph { color: var(--success); }
  .wbz-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; }
  .wbz-card-glyph { width: 26px; height: 26px; color: var(--combo); flex: none; }
  .wbz-card-gain { font-size: 11px; font-weight: 800; color: var(--t3); font-variant-numeric: tabular-nums; }
  .wbz-card-title { font-size: 17px; font-weight: 900; letter-spacing: -.01em; }
  .wbz-card-effect { font-size: 12.5px; font-weight: 600; color: var(--t2); line-height: 1.45; word-break: keep-all; }
  .wbz-card-key { margin-top: auto; }
  .wbz-cards-foot { margin: 0; font-size: 12px; color: var(--t3); text-align: center; font-variant-numeric: tabular-nums; }

  /* ── 끝화면 부록 ── */
  .wbz-recap { text-align: left; }
  .wbz-recap-title { margin: 0 0 8px; font-size: 12px; font-weight: 800; color: var(--t3); letter-spacing: .06em; text-transform: uppercase; }
  .wbz-recap-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 5px; }
  .wbz-recap-list li { display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; }
  .wbz-recap-en { font-family: var(--font-english, var(--font-display, system-ui)); font-size: 15px; font-weight: 800; color: var(--t1); }
  .wbz-recap-ko { font-size: 13.5px; color: var(--t2); }
  .wbz-recap-pron { font-family: var(--font-english, var(--font-display, system-ui)); font-size: 12px; color: var(--t3); }
  .wbz-build-label { font-size: 11.5px; font-weight: 800; color: var(--t3); align-self: center; letter-spacing: .04em; }
  .wbz-build-chip {
    display: inline-flex; align-items: center; padding: 4px 11px; border-radius: 999px;
    border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 70%, transparent);
    font-size: 12px; font-weight: 800; color: var(--t2);
  }

  @keyframes wbz-pop { 0% { transform: scale(.9); } 50% { transform: scale(1.06); } 100% { transform: scale(1); } }
  @keyframes wbz-correct { 0% { transform: scale(1); } 18% { transform: scale(.98); } 55% { transform: scale(1.05); } 100% { transform: scale(1); } }
  @keyframes wbz-shake { 0%,100% { transform: translateX(0); } 18% { transform: translateX(-7px); } 38% { transform: translateX(7px); } 58% { transform: translateX(-5px); } 78% { transform: translateX(4px); } }
  @keyframes wbz-gain { 0% { opacity: 0; transform: translateY(8px) scale(.82); } 25% { opacity: 1; transform: translateY(-2px) scale(1.1); } 100% { opacity: 0; transform: translateY(-22px) scale(1); } }
  @keyframes wbz-flash { 0% { opacity: 0; transform: translateX(-50%) scale(.72); } 26% { opacity: 1; transform: translateX(-50%) scale(1.08); } 74% { opacity: 1; transform: translateX(-50%) scale(1); } 100% { opacity: 0; transform: translateX(-50%) scale(1); } }
  @keyframes wbz-in { from { opacity: .45; } to { opacity: 1; } }
  @keyframes wbz-tile-in { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes wbz-rise { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
  @keyframes wbz-blur { to { filter: blur(7px); opacity: .5; } }

  @media (max-width: 400px) {
    .wbz-card-row { grid-template-columns: 1fr; }
    .wbz-card { min-height: 112px; }
    .wbz-meta { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .wbz-tile, .wbz-card { transition: none; }
    .wbz-tile, .wbz-stage, .wbz-cards, .wbz-tile--correct, .wbz-tile--wrong,
    .wbz-gain, .wbz-tile-icon, .wbz-verdict, .wbz-answer { animation: none !important; }
    .wbz-flash { animation: wbz-in .2s ease forwards; }
    /* '잔상'은 장식이 아니라 학습자가 스스로 고른 게임 규칙이다 —
       여기서 끄면 카드가 무효가 되므로 유지한다(전정계 자극이 없는 블러). */
  }
`;
