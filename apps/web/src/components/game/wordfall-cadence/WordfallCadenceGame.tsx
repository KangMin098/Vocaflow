// apps/web/src/components/game/wordfall-cadence/WordfallCadenceGame.tsx
// Wordfall Cadence — 듣기 케이던스. 영단어 발음(TTS)만 듣고 뜻을 짚는다.
//
// v07.9 전면 재설계. 이전 버전은 "카운트다운 바를 붙인 4지선다"였다:
//   · 낙하도 박도 없고 난도 축은 시간 하나(7.0s→5.2s)뿐이라 클라이맥스가 없었다.
//   · '다시 듣기'가 무제한 공짜여서 최적 전략이 "무한 재생 후 클릭" — 청취 정확도라는
//     이 게임의 존재 이유가 무효였다.
//   · BGM 덕킹이 없어 유일한 문제 제시 채널(TTS)이 배경음에 묻혔고, 마운트 즉시
//     타이머가 돌아 자동재생이 막힌 모바일에서는 소리 한 번 없이 ♪3이 증발했다.
//   · restart() 가 setQ(null) 을 하지 않아 '한 판 더'가 무음·바 0·무한시간 판을 줬다.
//
// 지금의 뼈대 — 판돈은 전부 "박(beat)" 하나로 통일된다.
//   · 오디오 게이트 → 3박 카운트인 → 악장. 소리는 사용자 제스처 뒤에만 나고,
//     타이머도 그때 처음 돈다(iOS Safari 포함 어디서도 "내 탓 아닌 실패"가 없다).
//   · **배수 사다리**가 상시 트레이드오프다. 남은 박이 많을 때 답하면 ×3, 중간 ×2,
//     끝자락 ×1. 지금 짚을 것인가, 한 박 더 곱씹을 것인가를 매 문제 고르게 된다.
//   · **앙코르(다시 듣기)에 값을 매겼다**. 1회차 −2박 ×½, 2회차 −3박 ×¼, 그 뒤 소진.
//     열기 4에서는 잠긴다("한 번에"). 확신을 시간과 점수로 사는 구조.
//   · **열기(heat)** 가 단일 난도 축이다. 3연속마다 +1, 어긋나면 −1(전면 초기화 아님 —
//     회복 가능해야 좌절이 없다). 열기는 박 길이·박 수·선택지 수·발화 속도·
//     디스트랙터의 음운 유사도를 한꺼번에 올린다: 7.7s/4지 → 4.3s/5지.
//   · **종지(cadence) 도박** — 악장(5문제)이 끝날 때마다 고른다. 안전하게 이어 가거나,
//     방금 들은 단어 3개를 이어서 듣고 순서대로 뜻을 잇거나. 3/3 이면 ♪ 회복 + 큰 점수,
//     2개 미만이면 ♪ 하나를 잃는다. 세션에 세 번의 클라이맥스가 생긴다.
//   · BGM 덕킹 — <GameMusic> 대신 useGameMusic 훅을 직접 써서 발음이 나갈 때
//     배경음을 낮춘다(버튼 UI 는 동일한 gk-music-btn 으로 유지).
//
// 인출 규칙 준수:
//   · 제출 전 화면에 영단어 철자는 한 글자도 없다. 근거는 귀로 들은 소리뿐이다.
//   · 영단어와 뜻을 동시에 보여준 상태로 그 쌍을 묻지 않는다.
//   · 부분 정답 개수 오라클 없음 — 종지는 3개를 모두 이은 뒤에만 채점·공개된다.
//   · 정답 공개는 제출 후에만. 대신 그때는 철자 + 발음기호 + 뜻 + (오답이면) 예문까지
//     펼친다(음운-철자 결합이 이 게임의 최대 학습 이득인데 이전엔 통째로 버려졌다).
//   · '다시 듣기'는 정답을 알려주는 힌트가 아니라 같은 자극의 재제시다. 그래도 공짜가
//     아니어야 하므로 박과 배수를 태운다. 정답을 사는 수단은 이 게임에 없다.
//
// 자료 연계: wordPool 이 오면 반드시 그 단어로만 돈다. 내장 뱅크는 폴백 전용.

'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles,
  AmbientBackground,
  Hud,
  GameDone,
  NotEnoughWords,
  ParticleBurst,
  FeedbackIcon,
  IconMusic,
  Kbd,
  useSfx,
  useGameMusic,
  useCombo,
  useCountdown,
  usePersonalBest,
  shuffle,
  clamp,
  type Word,
  type ComboTier,
} from '@/components/game/_shared/gamekit';

interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word) => void;
  onWrong?: (w: Word) => void;
}

// ── 폴백 뱅크 — wordPool 이 없을 때만 쓴다(데모/직접 진입) ──────────────────
const DEFAULT_POOL: Word[] = [
  { en: 'advantage', ko: '이점', pron: '/ədˈvæntɪdʒ/', example: 'Her height gave her a real advantage on the court.' },
  { en: 'reserved', ko: '내성적인', pron: '/rɪˈzɜːrvd/', example: 'He is reserved with strangers but warm with friends.' },
  { en: 'consequence', ko: '결과', pron: '/ˈkɑːnsəkwens/', example: 'Every choice carries a consequence of some kind.' },
  { en: 'judgment', ko: '판단', pron: '/ˈdʒʌdʒmənt/', example: 'Trust your own judgment when the map fails.' },
  { en: 'ability', ko: '능력', pron: '/əˈbɪləti/', example: 'She has a rare ability to calm a crowd.' },
  { en: 'courage', ko: '용기', pron: '/ˈkɜːrɪdʒ/', example: 'It took courage to speak first in that room.' },
  { en: 'develop', ko: '발전시키다', pron: '/dɪˈveləp/', example: 'They will develop the idea over the winter.' },
  { en: 'reduce', ko: '줄이다', pron: '/rɪˈduːs/', example: 'We must reduce the noise before the guests arrive.' },
  { en: 'sudden', ko: '갑작스러운', pron: '/ˈsʌdn/', example: 'A sudden gust tore the sail in half.' },
  { en: 'honest', ko: '정직한', pron: '/ˈɑːnɪst/', example: 'An honest answer is worth more than a clever one.' },
  { en: 'generous', ko: '관대한', pron: '/ˈdʒenərəs/', example: 'He was generous with both time and bread.' },
  { en: 'vivid', ko: '생생한', pron: '/ˈvɪvɪd/', example: 'She kept a vivid memory of that harbour.' },
  { en: 'endure', ko: '견디다', pron: '/ɪnˈdʊr/', example: 'They had to endure three days without water.' },
  { en: 'persuade', ko: '설득하다', pron: '/pərˈsweɪd/', example: 'Nothing could persuade him to turn back.' },
  { en: 'genuine', ko: '진짜의', pron: '/ˈdʒenjuɪn/', example: 'The coin turned out to be genuine after all.' },
  { en: 'scarce', ko: '부족한', pron: '/skers/', example: 'Fresh water grew scarce by the second week.' },
  { en: 'wander', ko: '거닐다', pron: '/ˈwɑːndər/', example: 'He likes to wander the old town at dusk.' },
  { en: 'wonder', ko: '궁금해하다', pron: '/ˈwʌndər/', example: 'I wonder whether the letter ever arrived.' },
];

// ── 튜닝 상수 (열기 0~4 로 인덱싱 — 난도 축이 한곳에 모여 균형이 눈에 읽힌다) ──
const START_HP = 3;
const MAX_HP = 3;
const MOVEMENTS = 3;
const PER_MOVEMENT = 5;
/** 한 박의 길이(ms) — 열기가 오를수록 템포가 빨라진다. 96 → 111 BPM. */
const BEAT_MS = [640, 615, 590, 565, 540];
/** 한 문제에 주는 박 수. 12박 7.7s → 8박 4.3s. */
const BEATS = [12, 11, 10, 9, 8];
const TILES = [4, 4, 5, 5, 5];
const TTS_RATE = [0.9, 0.95, 1.0, 1.05, 1.1];
const ECHO_LOCK_HEAT = 4;
const MAX_ECHO = 2;
/** 앙코르 비용(박) · 그 문제의 배수 곱 — 확신을 시간과 점수로 산다. */
const ECHO_BEAT_COST = [2, 3];
const ECHO_MULT = [1, 0.5, 0.25];
const ECHO_LABEL = ['×1', '×½', '×¼'];
/** 배수 사다리 — 남은 비율이 이 값 이상이면 그 배수. 빠를수록 크다. */
const LADDER: { from: number; mult: number }[] = [
  { from: 0.66, mult: 3 },
  { from: 0.36, mult: 2 },
  { from: 0, mult: 1 },
];
const ZONE_FLEX = [36, 30, 34]; // ×1 / ×2 / ×3 (왼쪽부터) — 사다리 경계와 같은 비율
const BASE_SCORE = 100;
const WARN_BEATS = 2;
const CHAIN_WARN_BEATS = 3;
const CHAIN_LEN = 3;
const CHAIN_BOARD = 6;
const CHAIN_BEATS = 18;
const CHAIN_REPLAY_COST = 4;
const CHAIN_HIT = 200;
const CHAIN_PERFECT = 600;
const SAFE_BONUS = 120;
const MIN_POOL = 6;
const REVEAL_OK_MS = 900;
const REVEAL_NG_MS = 1700;
const CHAIN_REVEAL_MS = 2800;

const TIERS: ComboTier[] = [
  { at: 0, mult: 1 },
  { at: 3, mult: 1.3, label: '맞춘 귀' },
  { at: 6, mult: 1.7, label: '또렷함' },
  { at: 10, mult: 2.2, label: '무결' },
  { at: 15, mult: 3, label: '절대음' },
];
function multFor(c: number) {
  let m = 1;
  for (const t of TIERS) if (c >= t.at) m = t.mult;
  return m;
}
/** 2.20 · 1.50 같은 꼬리 0 을 떨어뜨린다 — HUD 숫자는 짧을수록 읽힌다. */
function fmtMult(m: number) {
  if (Number.isInteger(m)) return String(m);
  return m.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

// ── 음운 유사도 — 디스트랙터가 "아무 단어"가 아니라 **헷갈릴 만한 소리**가 되게 ──
const clean = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
function vowelGroups(s: string) {
  const m = s.match(/[aeiouy]+/g);
  return m ? m.length : 1;
}
function editDist(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}
function phonScore(a: Word, b: Word) {
  const x = clean(a.en);
  const y = clean(b.en);
  let s = 0;
  if (x[0] === y[0]) s += 3;
  if (x.slice(0, 2) === y.slice(0, 2)) s += 1;
  if (vowelGroups(x) === vowelGroups(y)) s += 2;
  const d = editDist(x, y);
  if (d <= 3) s += 3;
  else if (d <= 4) s += 1;
  if (x.length >= 3 && x.slice(-3) === y.slice(-3)) s += 2;
  if (Math.abs(x.length - y.length) <= 1) s += 1;
  return s;
}
/** 이 점수 이상이면 "아까웠어요"(near) — 오답음이 아니라 니어미스음으로 다룬다. */
const NEAR_AT = 7;

/** 열기가 오를수록 음운 이웃 비중이 커진다. 전부 유사어로 채우면 불공정하므로 상한을 둔다. */
function pickOptions(pool: Word[], target: Word, n: number, heat: number): Word[] {
  const cands = pool.filter((w) => w.en !== target.en && w.ko !== target.ko);
  if (cands.length <= n) return shuffle(cands).slice(0, n);
  const nearWanted = clamp(heat, 0, Math.max(0, n - 1));
  const scored = cands
    .map((w) => ({ w, s: phonScore(target, w) + Math.random() * 0.8 }))
    .sort((a, b) => b.s - a.s);
  const near = scored.slice(0, nearWanted).map((x) => x.w);
  const nearSet = new Set(near.map((w) => w.en));
  const rest = shuffle(cands.filter((w) => !nearSet.has(w.en)));
  return [...near, ...rest.slice(0, Math.max(0, n - near.length))];
}

/** 종지 보드용 미끼 — 세 표적 중 무엇과도 헷갈릴 만한 소리를 우선. */
function pickChainDecoys(pool: Word[], targets: Word[], n: number): Word[] {
  const tEn = new Set(targets.map((t) => t.en));
  const tKo = new Set(targets.map((t) => t.ko));
  const cands = pool.filter((w) => !tEn.has(w.en) && !tKo.has(w.ko));
  if (cands.length <= n) return shuffle(cands).slice(0, n);
  return cands
    .map((w) => ({ w, s: Math.max(...targets.map((t) => phonScore(t, w))) + Math.random() * 0.8 }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.w);
}

/** 놓친 단어를 앞쪽에 섞어 넣은 출제 큐 — "다음 판의 이유"를 자료로 만든다. */
function buildQueue(pool: Word[], focus: Word[]): Word[] {
  const inPool = focus.filter((f) => pool.some((p) => p.en === f.en));
  const fEn = new Set(inPool.map((w) => w.en));
  const f = shuffle(pool.filter((w) => fEn.has(w.en)));
  const rest = shuffle(pool.filter((w) => !fEn.has(w.en)));
  const head = shuffle([...f, ...rest.slice(0, f.length)]);
  return [...head, ...rest.slice(f.length)];
}

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return reduce;
}

type Phase = 'gate' | 'countin' | 'play' | 'wager' | 'chain' | 'done';
type ChainStage = 'listen' | 'pick' | 'reveal';
type FeedKind = 'correct' | 'wrong' | 'near';

interface Q {
  key: number;
  target: Word;
  options: Word[];
}
interface RevealState {
  kind: FeedKind;
  word: Word;
  picked: number | null;
  gain: number;
}

// ── 타일 보드 (memo) ────────────────────────────────────────────────────────
// useCountdown 은 매 프레임 setState 한다. 보드를 memo 로 끊지 않으면 초당 60회
// 4~6개 타일이 통째로 재조정된다.
const TileBoard = memo(function TileBoard({
  qKey,
  options,
  targetEn,
  picked,
  revealKind,
  onPick,
}: {
  qKey: number;
  options: Word[];
  targetEn: string;
  picked: number | null;
  revealKind: FeedKind | null;
  onPick: (i: number) => void;
}) {
  const revealed = revealKind !== null;
  return (
    <div className="wf-tiles" data-count={options.length}>
      {options.map((o, i) => {
        const isAns = o.en === targetEn;
        const isPick = picked === i;
        let tone = '';
        if (revealed) tone = isAns ? 'gk-tile--correct' : isPick ? 'gk-tile--wrong' : 'gk-tile--dim';
        return (
          <button
            key={`${qKey}-${o.en}`}
            type="button"
            className={`gk-tile wf-tile ${tone}`}
            aria-disabled={revealed}
            onClick={() => {
              if (revealed) return;
              onPick(i);
            }}
          >
            <Kbd>{i + 1}</Kbd>
            <span className="wf-tile-ko">{o.ko}</span>
            {revealed && isAns && <FeedbackIcon kind="correct" size={17} />}
            {revealed && isPick && !isAns && <FeedbackIcon kind={revealKind === 'near' ? 'near' : 'wrong'} size={17} />}
            {revealed && isAns && <ParticleBurst intensity={1} />}
          </button>
        );
      })}
    </div>
  );
});

// ── 종지 보드 (memo) ────────────────────────────────────────────────────────
const ChainBoard = memo(function ChainBoard({
  board,
  picks,
  locked,
  targets,
  onPick,
}: {
  board: Word[];
  picks: number[];
  locked: boolean;
  targets: Word[] | null;
  onPick: (i: number) => void;
}) {
  return (
    <div className="wf-tiles wf-tiles--chain" data-count={board.length}>
      {board.map((o, i) => {
        const order = picks.indexOf(i);
        const chosen = order >= 0;
        let tone = '';
        if (targets) {
          const rightHere = order >= 0 && targets[order] && targets[order].en === o.en;
          const isTarget = targets.some((t) => t.en === o.en);
          if (chosen) tone = rightHere ? 'gk-tile--correct' : 'gk-tile--wrong';
          else if (isTarget) tone = 'gk-tile--correct';
          else tone = 'gk-tile--dim';
        } else if (chosen) {
          tone = 'wf-tile--chosen';
        }
        return (
          <button
            key={o.en}
            type="button"
            className={`gk-tile wf-tile ${tone}`}
            aria-disabled={locked || (chosen && !targets)}
            aria-label={chosen ? `${o.ko} · ${order + 1}번째로 이음` : o.ko}
            onClick={() => {
              if (locked || chosen) return;
              onPick(i);
            }}
          >
            <span className="wf-order" aria-hidden="true">{chosen ? order + 1 : i + 1}</span>
            <span className="wf-tile-ko">{o.ko}</span>
          </button>
        );
      })}
    </div>
  );
});

export function WordfallCadenceGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();
  const sfxRef = useRef(sfx);
  sfxRef.current = sfx;
  const music = useGameMusic('wordfall-cadence');
  const duckRef = useRef(music.duck);
  duckRef.current = music.duck;
  const reduceMotion = useReducedMotion();
  const pb = usePersonalBest('wordfall-cadence');
  const pbRef = useRef(pb);
  pbRef.current = pb;

  const pool = useMemo(() => {
    const seen = new Set<string>();
    return (wordPool && wordPool.length > 0 ? wordPool : DEFAULT_POOL)
      .filter((w) => w.en && w.ko && clean(w.en).length >= 2)
      .filter((w) => (seen.has(w.en) ? false : (seen.add(w.en), true)));
  }, [wordPool]);
  const poolRef = useRef(pool);
  poolRef.current = pool;

  const hasTTS = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const enough = pool.length >= MIN_POOL;

  // ── 상태 ──
  const [phase, setPhase] = useState<Phase>('gate');
  const [countIn, setCountIn] = useState(3);
  const [q, setQ] = useState<Q | null>(null);
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [echoes, setEchoes] = useState(0);
  /** 발음이 나가는 동안은 시계를 멈춘다 — 문제 제시 시간이 곧 벌이 되면 불공정하다. */
  const [speaking, setSpeaking] = useState(false);
  const [hp, setHp] = useState(START_HP);
  const [score, setScore] = useState(0);
  const [heat, setHeat] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [heard, setHeard] = useState(0);
  const [inMovement, setInMovement] = useState(0);
  const [movement, setMovement] = useState(1);
  const [chainsWon, setChainsWon] = useState(0);
  const [chainsTried, setChainsTried] = useState(0);
  const [missed, setMissed] = useState<Word[]>([]);
  const [announce, setAnnounce] = useState('');
  const [clock, setClock] = useState({ beats: BEATS[0], beatMs: BEAT_MS[0] });
  const [bestInfo, setBestInfo] = useState<{ improved: boolean; prev: number | null } | null>(null);

  // 종지
  const [chainStage, setChainStage] = useState<ChainStage>('listen');
  const [chainTargets, setChainTargets] = useState<Word[]>([]);
  const [chainBoard, setChainBoard] = useState<Word[]>([]);
  const [chainPicks, setChainPicks] = useState<number[]>([]);
  const [chainPlaying, setChainPlaying] = useState(0);
  const [chainReplayed, setChainReplayed] = useState(false);
  const [chainResult, setChainResult] = useState<{ hits: number; picks: Word[] } | null>(null);

  const combo = useCombo({
    tiers: TIERS,
    onTierUp: (t) => {
      if (t.label) setAnnounce(`연쇄 ${t.label} · ×${t.mult}`);
    },
  });

  // ── ref 거울 (프레임 콜백·타이머·키보드에서 최신값을 읽기 위해) ──
  const mountedRef = useRef(true);
  const timersRef = useRef<number[]>([]);
  const keyRef = useRef(0);
  const qRef = useRef<Q | null>(null);
  const phaseRef = useRef<Phase>('gate');
  phaseRef.current = phase;
  const chainStageRef = useRef<ChainStage>('listen');
  chainStageRef.current = chainStage;
  const chainPicksRef = useRef<number[]>([]);
  chainPicksRef.current = chainPicks;
  const chainTargetsRef = useRef<Word[]>([]);
  chainTargetsRef.current = chainTargets;
  const chainBoardRef = useRef<Word[]>([]);
  chainBoardRef.current = chainBoard;
  const chainSubmittedRef = useRef(false);
  const hpRef = useRef(START_HP);
  const heatRef = useRef(0);
  const runRef = useRef(0);
  const scoreRef = useRef(0);
  const clearedRef = useRef(0);
  const inMovementRef = useRef(0);
  const movementRef = useRef(1);
  const echoRef = useRef(0);
  const heardWordsRef = useRef<Word[]>([]);
  const missedRef = useRef<Word[]>([]);
  const queueRef = useRef<Word[]>([]);
  const lockRef = useRef(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const speakingRef = useRef(false);
  speakingRef.current = speaking;
  /** 새 발화가 시작되면 이전 발화의 콜백은 무효 — cancel() 이 늦게 던지는 end 이벤트가
   *  다음 문제의 시계를 제멋대로 풀어놓는 것을 막는다. */
  const speakSeqRef = useRef(0);
  const lastBeatRef = useRef(-1);
  const comboCountRef = useRef(0);
  comboCountRef.current = combo.combo;
  const onCorrectRef = useRef(onCorrect);
  onCorrectRef.current = onCorrect;
  const onWrongRef = useRef(onWrong);
  onWrongRef.current = onWrong;
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  const pushTimer = useCallback((t: number) => {
    timersRef.current.push(t);
  }, []);
  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  // ── 시계 ──────────────────────────────────────────────────────────────────
  const running =
    (phase === 'play' && !!q && !reveal && !speaking) ||
    (phase === 'chain' && chainStage === 'pick' && chainPlaying === 0);
  const warnMs = (phase === 'chain' ? CHAIN_WARN_BEATS : WARN_BEATS) * clock.beatMs;

  const timeUpRef = useRef<() => void>(() => {});
  const cd = useCountdown({
    totalMs: BEATS[0] * BEAT_MS[0],
    running,
    warnAtMs: warnMs,
    onEnd: () => timeUpRef.current(),
  });
  const cdRef = useRef(cd);
  cdRef.current = cd;

  const beatsLeft = Math.max(0, Math.ceil(cd.remainMs / clock.beatMs));
  const ladderMult = useMemo(() => {
    const f = cd.frac;
    for (const l of LADDER) if (f >= l.from) return l.mult;
    return 1;
  }, [cd.frac]);
  const ladderRef = useRef(ladderMult);
  ladderRef.current = ladderMult;

  // ── 음성 ──────────────────────────────────────────────────────────────────
  const speak = useCallback(
    (text: string, rate: number, onDone?: () => void) => {
      const token = speakSeqRef.current + 1;
      speakSeqRef.current = token;
      if (!hasTTS) {
        onDone?.();
        return;
      }
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        // 더 새로운 발화가 시작됐다면 이 콜백은 죽은 콜백이다.
        if (speakSeqRef.current !== token) return;
        onDone?.();
      };
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        u.rate = rate;
        if (voiceRef.current) u.voice = voiceRef.current;
        const est = Math.round((460 + text.length * 95) / rate);
        duckRef.current?.(est + 320);
        u.onend = finish;
        u.onerror = finish;
        window.speechSynthesis.speak(u);
        // onend 가 오지 않는 브라우저가 있다 — 안전망(콜백 체인이 멈추면 게임이 멈춘다).
        pushTimer(window.setTimeout(finish, est + 1100));
      } catch {
        finish();
      }
    },
    [hasTTS, pushTimer],
  );

  const takeNext = useCallback(() => {
    if (queueRef.current.length === 0) queueRef.current = buildQueue(poolRef.current, []);
    return queueRef.current.shift() ?? poolRef.current[0];
  }, []);

  // ── 문제 시작 ─────────────────────────────────────────────────────────────
  const startQuestion = useCallback(() => {
    if (!mountedRef.current) return;
    const h = heatRef.current;
    const target = takeNext();
    const n = Math.min(TILES[h], poolRef.current.length);
    const opts = shuffle([target, ...pickOptions(poolRef.current, target, n - 1, h)]);
    keyRef.current += 1;
    const nq: Q = { key: keyRef.current, target, options: opts };
    qRef.current = nq;
    setQ(nq);
    setReveal(null);
    setPicked(null);
    setEchoes(0);
    echoRef.current = 0;
    lockRef.current = false;
    lastBeatRef.current = -1;
    setClock({ beats: BEATS[h], beatMs: BEAT_MS[h] });
    cdRef.current.reset(BEATS[h] * BEAT_MS[h]);
    setPhase('play');
    // 발음이 끝난 뒤에야 박이 흐른다. 그래야 ×3 이 "빨리 알아들었다"의 보상이지
    // "TTS 가 짧았다"의 보상이 되지 않는다. 발화 종료 시점에 한 번 더 reset 해서
    // 발화에 걸린 실제 시간이 박에서 빠지지 않도록 종료 시각을 다시 앵커링한다.
    setSpeaking(true);
    speak(target.en, TTS_RATE[h], () => {
      if (!mountedRef.current) return;
      if (!lockRef.current) cdRef.current.reset(BEATS[h] * BEAT_MS[h]);
      setSpeaking(false);
    });
  }, [speak, takeNext]);

  const endGame = useCallback(() => {
    clearTimers();
    speakSeqRef.current += 1;
    setSpeaking(false);
    setChainPlaying(0);
    if (hasTTS) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* noop */
      }
    }
    setQ(null);
    qRef.current = null;
    setReveal(null);
    sfxRef.current.fanfare();
    setPhase('done');
  }, [clearTimers, hasTTS]);

  // ── 종지 ──────────────────────────────────────────────────────────────────
  const playSeq = useCallback(
    (ws: Word[], rate: number, onFinish: () => void) => {
      let i = 0;
      const step = () => {
        if (!mountedRef.current) return;
        if (i >= ws.length) {
          setChainPlaying(0);
          onFinish();
          return;
        }
        const w = ws[i];
        i += 1;
        setChainPlaying(i);
        speak(w.en, rate, () => {
          if (!mountedRef.current) return;
          pushTimer(window.setTimeout(step, 540));
        });
      };
      step();
    },
    [pushTimer, speak],
  );

  const beginChain = useCallback(() => {
    const h = heatRef.current;
    // 한 악장 안에서 같은 단어가 두 번 나올 수 있다(큐가 한 바퀴 돈 경우).
    // 표적이 중복되면 보드 키가 겹치고 "순서대로 잇기"가 성립하지 않는다.
    const seen = new Set<string>();
    const targets: Word[] = shuffle(heardWordsRef.current)
      .filter((w) => (seen.has(w.en) ? false : (seen.add(w.en), true)))
      .slice(0, CHAIN_LEN);
    let guard = 0;
    while (targets.length < CHAIN_LEN && guard < 40) {
      guard += 1;
      const w = takeNext();
      if (!targets.some((t) => t.en === w.en)) targets.push(w);
    }
    chainSubmittedRef.current = false;
    const decoys = pickChainDecoys(poolRef.current, targets, CHAIN_BOARD - targets.length);
    setChainTargets(targets);
    setChainBoard(shuffle([...targets, ...decoys]));
    setChainPicks([]);
    setChainResult(null);
    setChainReplayed(false);
    setChainStage('listen');
    setChainsTried((n) => n + 1);
    setQ(null);
    qRef.current = null;
    setClock({ beats: CHAIN_BEATS, beatMs: BEAT_MS[h] });
    setPhase('chain');
    setAnnounce(`종지 · 단어 ${CHAIN_LEN}개가 이어서 흐릅니다`);
    playSeq(targets, TTS_RATE[h], () => {
      if (!mountedRef.current) return;
      lastBeatRef.current = -1;
      cdRef.current.reset(CHAIN_BEATS * BEAT_MS[heatRef.current]);
      setChainStage('pick');
    });
  }, [playSeq, takeNext]);

  const finishMovement = useCallback(() => {
    heardWordsRef.current = [];
    const m = movementRef.current + 1;
    movementRef.current = m;
    setMovement(m);
    inMovementRef.current = 0;
    setInMovement(0);
    if (m > MOVEMENTS || hpRef.current <= 0) {
      endGame();
      return;
    }
    startQuestion();
  }, [endGame, startQuestion]);

  const submitChain = useCallback(() => {
    // 시간 만료(rAF)와 '종지 잇기' 클릭이 같은 틱에 겹칠 수 있다 — 상태 ref 는
    // 다음 렌더까지 갱신되지 않으므로 동기 잠금이 따로 필요하다.
    if (chainStageRef.current !== 'pick' || chainSubmittedRef.current) return;
    chainSubmittedRef.current = true;
    const targets = chainTargetsRef.current;
    const board = chainBoardRef.current;
    const picks = chainPicksRef.current;
    const chosen: Word[] = picks.map((i) => board[i]);
    let hits = 0;
    targets.forEach((t, i) => {
      const got = chosen[i];
      if (got && got.en === t.en) {
        hits += 1;
        onCorrectRef.current?.(t);
      } else {
        onWrongRef.current?.(t);
        if (!missedRef.current.some((m) => m.en === t.en)) {
          missedRef.current = [...missedRef.current, t];
          setMissed(missedRef.current);
        }
      }
    });
    const mult = multFor(comboCountRef.current);
    const gain = Math.round((hits * CHAIN_HIT + (hits === CHAIN_LEN ? CHAIN_PERFECT : 0)) * mult);
    scoreRef.current += gain;
    setScore(scoreRef.current);
    clearedRef.current += hits;
    setCleared(clearedRef.current);
    setHeard((n) => n + targets.length);
    if (hits === CHAIN_LEN) {
      combo.hit();
      setChainsWon((n) => n + 1);
      hpRef.current = Math.min(MAX_HP, hpRef.current + 1);
      setHp(hpRef.current);
      sfxRef.current.correct(comboCountRef.current + 1, true);
      setAnnounce(`종지 성공 · ${CHAIN_LEN}개 모두 · +${gain}점 · ♪ 하나 회복`);
    } else {
      combo.miss();
      if (hits < 2) {
        hpRef.current -= 1;
        setHp(hpRef.current);
      }
      if (hits === 2) sfxRef.current.nearMiss();
      else sfxRef.current.wrong();
      setAnnounce(`종지 ${hits}/${CHAIN_LEN} · +${gain}점`);
    }
    setChainResult({ hits, picks: chosen });
    setChainStage('reveal');
    pushTimer(
      window.setTimeout(() => {
        if (!mountedRef.current) return;
        if (hpRef.current <= 0) {
          endGame();
          return;
        }
        finishMovement();
      }, CHAIN_REVEAL_MS),
    );
  }, [combo, endGame, finishMovement, pushTimer]);

  // ── 응답 ──────────────────────────────────────────────────────────────────
  const answer = useCallback(
    (idx: number | null) => {
      const cur = qRef.current;
      if (!cur || lockRef.current) return;
      if (idx !== null && (idx < 0 || idx >= cur.options.length)) return;
      lockRef.current = true;
      const chosen = idx === null ? null : cur.options[idx];
      const ok = !!chosen && chosen.en === cur.target.en;
      const kind: FeedKind = ok ? 'correct' : chosen && phonScore(cur.target, chosen) >= NEAR_AT ? 'near' : 'wrong';

      heardWordsRef.current = [...heardWordsRef.current, cur.target];
      setHeard((n) => n + 1);
      inMovementRef.current += 1;
      setInMovement(inMovementRef.current);

      let gain = 0;
      if (ok) {
        const nc = combo.hit();
        gain = Math.round(BASE_SCORE * ladderRef.current * ECHO_MULT[echoRef.current] * multFor(nc));
        scoreRef.current += gain;
        setScore(scoreRef.current);
        clearedRef.current += 1;
        setCleared(clearedRef.current);
        runRef.current += 1;
        if (runRef.current % 3 === 0 && heatRef.current < BEATS.length - 1) {
          heatRef.current += 1;
          setHeat(heatRef.current);
        }
        sfxRef.current.correct(nc, nc % 5 === 0);
        onCorrectRef.current?.(cur.target);
        setAnnounce(`정답 · ${cur.target.en} · ${cur.target.ko} · ×${ladderRef.current} · +${gain}점`);
      } else {
        combo.miss();
        runRef.current = 0;
        if (heatRef.current > 0) {
          heatRef.current -= 1;
          setHeat(heatRef.current);
        }
        hpRef.current -= 1;
        setHp(hpRef.current);
        if (kind === 'near') sfxRef.current.nearMiss();
        else sfxRef.current.wrong();
        onWrongRef.current?.(cur.target);
        if (!missedRef.current.some((m) => m.en === cur.target.en)) {
          missedRef.current = [...missedRef.current, cur.target];
          setMissed(missedRef.current);
        }
        setAnnounce(
          idx === null
            ? `박이 지났어요 · ${cur.target.en} · ${cur.target.ko}`
            : kind === 'near'
              ? `아까웠어요 · 정답은 ${cur.target.en} · ${cur.target.ko}`
              : `${cur.target.en} · ${cur.target.ko}`,
        );
      }
      setPicked(idx);
      setReveal({ kind, word: cur.target, picked: idx, gain });

      pushTimer(
        window.setTimeout(
          () => {
            if (!mountedRef.current) return;
            if (hpRef.current <= 0) {
              endGame();
              return;
            }
            if (inMovementRef.current >= PER_MOVEMENT) {
              setQ(null);
              qRef.current = null;
              setReveal(null);
              setPhase('wager');
              return;
            }
            startQuestion();
          },
          ok ? REVEAL_OK_MS : REVEAL_NG_MS,
        ),
      );
    },
    [combo, endGame, pushTimer, startQuestion],
  );
  const answerRef = useRef(answer);
  answerRef.current = answer;
  /** memo 된 보드에 넘길 안정 참조 — 매 프레임 새 함수를 주면 memo 가 무의미해진다. */
  const handlePick = useCallback((i: number) => answerRef.current(i), []);

  timeUpRef.current = () => {
    if (phaseRef.current === 'play') answerRef.current(null);
    else if (phaseRef.current === 'chain' && chainStageRef.current === 'pick') submitChain();
  };

  // ── 앙코르(다시 듣기) ─────────────────────────────────────────────────────
  const echoLocked = heat >= ECHO_LOCK_HEAT;
  const echoSpent = echoes >= MAX_ECHO;
  const echoDisabled = !q || !!reveal || echoLocked || echoSpent || speaking;

  const doEcho = useCallback(() => {
    const cur = qRef.current;
    if (!cur || lockRef.current || speakingRef.current) return;
    if (heatRef.current >= ECHO_LOCK_HEAT) return;
    if (echoRef.current >= MAX_ECHO) return;
    const cost = ECHO_BEAT_COST[echoRef.current];
    echoRef.current += 1;
    setEchoes(echoRef.current);
    cdRef.current.drain(cost * BEAT_MS[heatRef.current]);
    sfxRef.current.click();
    setAnnounce(`앙코르 · ${cost}박 소모 · 이 문제 ${ECHO_LABEL[echoRef.current]}`);
    setSpeaking(true);
    speak(cur.target.en, TTS_RATE[heatRef.current], () => {
      if (mountedRef.current) setSpeaking(false);
    });
  }, [speak]);
  const doEchoRef = useRef(doEcho);
  doEchoRef.current = doEcho;

  // ── 종지 조작 ─────────────────────────────────────────────────────────────
  const chainPick = useCallback((i: number) => {
    if (chainStageRef.current !== 'pick') return;
    if (i < 0 || i >= chainBoardRef.current.length) return;
    setChainPicks((p) => (p.length >= CHAIN_LEN || p.includes(i) ? p : [...p, i]));
    sfxRef.current.click();
  }, []);
  const chainUndo = useCallback(() => {
    if (chainStageRef.current !== 'pick') return;
    setChainPicks((p) => p.slice(0, -1));
    sfxRef.current.click();
  }, []);
  const chainReplay = useCallback(() => {
    if (chainStageRef.current !== 'pick') return;
    if (chainReplayed) return;
    setChainReplayed(true);
    cdRef.current.drain(CHAIN_REPLAY_COST * BEAT_MS[heatRef.current]);
    setAnnounce(`종지 다시 듣기 · ${CHAIN_REPLAY_COST}박 소모`);
    playSeq(chainTargetsRef.current, TTS_RATE[heatRef.current], () => {
      /* 재생이 끝나면 시계가 저절로 다시 흐른다 */
    });
  }, [chainReplayed, playSeq]);
  const chainPickRef = useRef(chainPick);
  chainPickRef.current = chainPick;
  const chainUndoRef = useRef(chainUndo);
  chainUndoRef.current = chainUndo;
  const chainReplayRef = useRef(chainReplay);
  chainReplayRef.current = chainReplay;
  const submitChainRef = useRef(submitChain);
  submitChainRef.current = submitChain;

  // ── 악장 종료 선택 ────────────────────────────────────────────────────────
  const takeSafe = useCallback(() => {
    scoreRef.current += SAFE_BONUS;
    setScore(scoreRef.current);
    sfxRef.current.coin();
    setAnnounce(`이어 가기 · +${SAFE_BONUS}점`);
    finishMovement();
  }, [finishMovement]);
  const takeSafeRef = useRef(takeSafe);
  takeSafeRef.current = takeSafe;
  const beginChainRef = useRef(beginChain);
  beginChainRef.current = beginChain;

  // ── 시작 / 재시작 ─────────────────────────────────────────────────────────
  const runCountIn = useCallback(() => {
    setPhase('countin');
    let n = 3;
    setCountIn(n);
    sfxRef.current.click();
    const tick = () => {
      if (!mountedRef.current) return;
      n -= 1;
      if (n <= 0) {
        startQuestion();
        return;
      }
      setCountIn(n);
      sfxRef.current.click();
      pushTimer(window.setTimeout(tick, BEAT_MS[heatRef.current]));
    };
    pushTimer(window.setTimeout(tick, BEAT_MS[heatRef.current]));
  }, [pushTimer, startQuestion]);

  const resetRun = useCallback(
    (focusMissed: boolean) => {
      clearTimers();
      queueRef.current = buildQueue(poolRef.current, focusMissed ? missedRef.current : []);
      heatRef.current = 0;
      setHeat(0);
      runRef.current = 0;
      hpRef.current = START_HP;
      setHp(START_HP);
      scoreRef.current = 0;
      setScore(0);
      clearedRef.current = 0;
      setCleared(0);
      setHeard(0);
      combo.reset();
      movementRef.current = 1;
      setMovement(1);
      inMovementRef.current = 0;
      setInMovement(0);
      heardWordsRef.current = [];
      // 놓친 목록은 큐를 만든 뒤 항상 비운다 — 이월되면 다음 판의 '놓친 N개'가
      // 지난 판의 흔적까지 세게 된다.
      missedRef.current = [];
      setMissed([]);
      setChainsWon(0);
      setChainsTried(0);
      setChainResult(null);
      setChainPicks([]);
      setChainTargets([]);
      setChainBoard([]);
      setBestInfo(null);
      setAnnounce('');
      setQ(null);
      qRef.current = null;
      setReveal(null);
      setPicked(null);
      setEchoes(0);
      echoRef.current = 0;
      setSpeaking(false);
      speakSeqRef.current += 1;
      lockRef.current = false;
      lastBeatRef.current = -1;
      chainSubmittedRef.current = false;
      setChainPlaying(0);
      setChainStage('listen');
      setClock({ beats: BEATS[0], beatMs: BEAT_MS[0] });
      runCountIn();
    },
    [clearTimers, combo, runCountIn],
  );
  const resetRunRef = useRef(resetRun);
  resetRunRef.current = resetRun;

  const beginRun = useCallback(() => {
    // iOS Safari 오디오 언락 — 반드시 사용자 제스처 안에서 한 번.
    if (hasTTS) {
      try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        window.speechSynthesis.speak(u);
      } catch {
        /* noop */
      }
    }
    queueRef.current = buildQueue(poolRef.current, []);
    runCountIn();
  }, [hasTTS, runCountIn]);
  const beginRunRef = useRef(beginRun);
  beginRunRef.current = beginRun;

  // ── 마운트 / 정리 ─────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    if (hasTTS) {
      const pick = () => {
        const vs = window.speechSynthesis.getVoices();
        voiceRef.current =
          vs.find((v) => /^en[-_]US/i.test(v.lang)) ?? vs.find((v) => /^en[-_]/i.test(v.lang)) ?? null;
      };
      pick();
      window.speechSynthesis.onvoiceschanged = pick;
    }
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
      if (hasTTS) {
        try {
          window.speechSynthesis.onvoiceschanged = null;
          window.speechSynthesis.cancel();
        } catch {
          /* noop */
        }
      }
    };
  }, [hasTTS]);

  // 마지막 두 박에만 메트로놈 — 임박을 소리로도 알린다(계속 울리면 소음이 된다).
  useEffect(() => {
    if (!running) return;
    const warnAt = phase === 'chain' ? CHAIN_WARN_BEATS : WARN_BEATS;
    if (beatsLeft > warnAt) {
      lastBeatRef.current = -1;
      return;
    }
    if (beatsLeft <= 0 || beatsLeft === lastBeatRef.current) return;
    lastBeatRef.current = beatsLeft;
    sfxRef.current.click();
  }, [beatsLeft, running, phase]);

  // 개인 최고 기록은 결과 화면 진입 때 한 번만 제출.
  useEffect(() => {
    if (phase !== 'done') return;
    setBestInfo(pbRef.current.submit(scoreRef.current));
  }, [phase]);

  // 키보드 — 1~5 선택 · R 앙코르 · Enter 진행 · Backspace 되돌리기 · Esc 나가기.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const p = phaseRef.current;
      if (e.key === 'Escape') {
        onExitRef.current?.();
        return;
      }
      if (p === 'gate') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          beginRunRef.current();
        }
        return;
      }
      if (p === 'done') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          resetRunRef.current(false);
        }
        return;
      }
      if (p === 'play') {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= 9) {
          e.preventDefault();
          answerRef.current(n - 1);
          return;
        }
        if (e.key.toLowerCase() === 'r') {
          e.preventDefault();
          doEchoRef.current();
        }
        return;
      }
      if (p === 'wager') {
        if (e.key === 'Enter') {
          e.preventDefault();
          beginChainRef.current();
          return;
        }
        if (e.key === ' ') {
          e.preventDefault();
          takeSafeRef.current();
        }
        return;
      }
      if (p === 'chain') {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= 9) {
          e.preventDefault();
          chainPickRef.current(n - 1);
          return;
        }
        if (e.key === 'Backspace') {
          e.preventDefault();
          chainUndoRef.current();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (chainPicksRef.current.length === CHAIN_LEN) submitChainRef.current();
          return;
        }
        if (e.key.toLowerCase() === 'r') {
          e.preventDefault();
          chainReplayRef.current();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── 렌더 ──────────────────────────────────────────────────────────────────
  if (!hasTTS) {
    return (
      <div className="gk-empty" role="alert">
        <GameKitStyles />
        <div className="gk-empty-emoji" aria-hidden="true">🎧</div>
        <h1 className="gk-empty-title">브라우저 음성이 필요해요</h1>
        <p className="gk-empty-sub">
          이 게임은 단어 발음을 듣고 뜻을 고릅니다. 음성(TTS)을 지원하는 브라우저에서 열어 주세요.
        </p>
        {onExit && (
          <button type="button" className="gk-btn gk-btn--primary" onClick={onExit}>
            돌아가기
          </button>
        )}
      </div>
    );
  }
  if (!enough) return <NotEnoughWords need={MIN_POOL} onExit={onExit} />;

  const musicBtn = music.hasTrack ? (
    <button
      type="button"
      className="gk-music-btn"
      onClick={music.toggle}
      aria-pressed={music.on}
      aria-label={music.on ? '배경음악 끄기' : '배경음악 켜기'}
      data-on={music.on ? '1' : '0'}
      data-hint={music.undecided ? '1' : '0'}
    >
      <IconMusic on={music.on} />
      {music.undecided && <span className="gk-music-hint">배경음악</span>}
    </button>
  ) : null;

  const atmos = (
    <AmbientBackground
      center="#E7ECF7"
      mid="#B6C4E4"
      edge="#1C2440"
      glow="rgba(140,176,255,.28)"
      glowAt="50% 24%"
      watermark="wordfall-cadence"
    />
  );

  if (phase === 'done') {
    const accuracy = heard > 0 ? Math.round((cleared / heard) * 100) : 0;
    const swept = movement > MOVEMENTS && hp > 0;
    return (
      <div className="gk-root wf-root">
        <GameKitStyles />
        {atmos}
        <style dangerouslySetInnerHTML={{ __html: WF_CSS }} />
        {musicBtn}
        <GameDone
          lead={swept ? '세 악장을 끝까지 이었어요' : '오늘 잘 마쳤어요'}
          celebrate={swept}
          stats={[
            { num: score.toLocaleString(), label: '점수', accent: true },
            { num: `${cleared}/${heard}`, label: `짚어낸 발음 · ${accuracy}%` },
            { num: `🔥 ${combo.best}`, label: '최고 연쇄' },
            { num: `${chainsWon}/${chainsTried}`, label: '종지' },
          ]}
          best={{
            prev: bestInfo?.prev ?? null,
            now: score,
            label: '점수',
            improved: bestInfo?.improved,
          }}
          badge={
            bestInfo?.improved ? (
              <>
                <FeedbackIcon kind="correct" size={13} />
                개인 최고 갱신
              </>
            ) : chainsWon > 0 ? (
              <>♪ 종지 {chainsWon}회 성공</>
            ) : undefined
          }
          restartHint={
            missed.length > 0
              ? `놓친 ${missed.length}개를 다음 판 앞쪽에 놓아 둘게요`
              : '한 번에 듣고 빠르게 짚으면 ×3이 붙어요'
          }
          onRestart={() => resetRun(false)}
          onExit={() => onExit?.()}
          mark="wordfall-cadence"
          footer={
            missed.length > 0 ? (
              <div className="wf-missed">
                <p className="wf-missed-lbl">다시 들어볼 단어</p>
                <div className="wf-chips">
                  {missed.slice(0, 6).map((w) => (
                    <button
                      key={w.en}
                      type="button"
                      className="wf-chip"
                      onClick={() => speak(w.en, 0.9, undefined)}
                      aria-label={`${w.en} 발음 듣기 · 뜻 ${w.ko}`}
                    >
                      <span className="wf-chip-en">{w.en}</span>
                      <span className="wf-chip-ko">{w.ko}</span>
                    </button>
                  ))}
                </div>
                <button type="button" className="gk-btn wf-refocus" onClick={() => resetRun(true)}>
                  놓친 단어로 한 판 더
                </button>
              </div>
            ) : undefined
          }
        />
      </div>
    );
  }

  const totalQuestions = MOVEMENTS * PER_MOVEMENT;
  const answered = (movement - 1) * PER_MOVEMENT + inMovement;
  const progress = clamp(answered / totalQuestions, 0, 1);
  const fallFrac = reduceMotion
    ? clamp(1 - beatsLeft / Math.max(1, clock.beats), 0, 1)
    : clamp(1 - cd.frac, 0, 1);
  const warn = running && beatsLeft <= (phase === 'chain' ? CHAIN_WARN_BEATS : WARN_BEATS);
  const echoMultLabel = ECHO_LABEL[Math.min(echoes, MAX_ECHO)];

  return (
    <div className="gk-root wf-root">
      <GameKitStyles />
      {atmos}
      <style dangerouslySetInnerHTML={{ __html: WF_CSS }} />
      {musicBtn}
      <div className="gk-sr" aria-live="assertive">{announce}</div>

      <Hud
        score={score}
        progress={progress}
        combo={combo.combo}
        comboMult={combo.mult}
        lives={{ total: MAX_HP, left: Math.max(0, hp), label: '남은 박자' }}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted(!sfx.muted)}
        onExit={onExit}
      />

      <main className="gk-stage wf-stage">
        {phase === 'gate' && (
          <section className="wf-panel wf-panel--gate" aria-labelledby="wf-gate-title">
            <div className="wf-gate-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
                <rect x="2.5" y="14" width="4.5" height="6.5" rx="2" />
                <rect x="17" y="14" width="4.5" height="6.5" rx="2" />
              </svg>
            </div>
            <h1 id="wf-gate-title" className="wf-panel-title">발음을 듣고 뜻을 짚습니다</h1>
            <p className="wf-panel-sub">
              단어는 <b>소리로만</b> 나옵니다 · 빠르게 짚을수록 배수가 커집니다 (×3 → ×2 → ×1)
            </p>
            <p className="wf-panel-sub">
              다시 듣기는 박과 배수를 태웁니다 · 악장 5문제마다 <b>종지</b>를 걸지 고릅니다
            </p>
            <button type="button" className="gk-btn gk-btn--primary wf-gate-btn" onClick={beginRun}>
              준비됐어요
            </button>
            <p className="wf-panel-foot">
              헤드폰을 권합니다 · <Kbd>1</Kbd>~<Kbd>5</Kbd> 선택 · <Kbd>R</Kbd> 다시 듣기 · <Kbd>Esc</Kbd> 나가기
            </p>
          </section>
        )}

        {phase === 'countin' && (
          <section className="wf-panel wf-panel--count" role="status" aria-live="polite">
            <p className="wf-count-num" key={countIn}>{countIn}</p>
            <p className="wf-panel-sub">첫 발음이 곧 나옵니다</p>
          </section>
        )}

        {phase === 'play' && q && (
          <>
            <p className="wf-caption">
              악장 {Math.min(movement, MOVEMENTS)}/{MOVEMENTS}
              <span className="wf-dots" aria-hidden="true">
                {Array.from({ length: PER_MOVEMENT }, (_, i) => (
                  <i key={i} data-on={i < inMovement ? '1' : '0'} />
                ))}
              </span>
              <span className="wf-heat" aria-label={`열기 ${heat} 단계`}>
                열기
                <span className="wf-heat-bars" aria-hidden="true">
                  {Array.from({ length: BEATS.length - 1 }, (_, i) => (
                    <i key={i} data-on={i < heat ? '1' : '0'} />
                  ))}
                </span>
              </span>
            </p>

            <div className="wf-lane">
              {!reveal && (
                <span className="wf-note" style={{ ['--fall' as string]: String(fallFrac) }} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18V5l10-2v13" />
                    <circle cx="6.5" cy="18" r="2.6" />
                    <circle cx="16.5" cy="16" r="2.6" />
                  </svg>
                </span>
              )}
              {reveal && (
                <div className={`wf-reveal wf-reveal--${reveal.kind}`} role="status">
                  <div className="wf-reveal-head">
                    <FeedbackIcon kind={reveal.kind} size={16} />
                    <span className="wf-reveal-tag">
                      {reveal.kind === 'correct'
                        ? `+${reveal.gain}점`
                        : reveal.kind === 'near'
                          ? '아까웠어요 · 소리가 닮은 단어예요'
                          : '이번엔 이 단어였어요'}
                    </span>
                  </div>
                  <p className="wf-reveal-en">
                    {reveal.word.en}
                    {reveal.word.pron && <span className="wf-reveal-pron">{reveal.word.pron}</span>}
                  </p>
                  <p className="wf-reveal-ko">{reveal.word.ko}</p>
                  {reveal.kind !== 'correct' && reveal.word.example && (
                    <p className="wf-reveal-ex">{reveal.word.example}</p>
                  )}
                </div>
              )}
            </div>

            <div className="wf-meter">
              <div className="wf-gauge">
                <div className="wf-ladder" aria-hidden="true">
                  {ZONE_FLEX.map((f, i) => (
                    <span key={i} style={{ flex: f }} data-live={ladderMult === i + 1 ? '1' : '0'}>
                      <i>×{i + 1}</i>
                    </span>
                  ))}
                </div>
                <div
                  className="wf-bar"
                  data-warn={warn ? '1' : '0'}
                  role="progressbar"
                  aria-label="남은 박"
                  aria-valuemin={0}
                  aria-valuemax={clock.beats}
                  aria-valuenow={beatsLeft}
                >
                  <div
                    className="wf-fill"
                    style={{ width: `${cd.frac * 100}%`, ['--tickw' as string]: `${100 / Math.max(1, clock.beats)}%` }}
                  />
                  <div className="wf-divs" aria-hidden="true">
                    {ZONE_FLEX.map((f, i) => (
                      <span key={i} style={{ flex: f }} />
                    ))}
                  </div>
                </div>
              </div>
              <p className="wf-read" data-warn={warn ? '1' : '0'}>
                {warn && <FeedbackIcon kind="wrong" size={13} />}
                <span className="wf-read-beat">♪ {beatsLeft}박</span>
                <span className="wf-read-mult">×{fmtMult(ladderMult * ECHO_MULT[Math.min(echoes, MAX_ECHO)])}</span>
              </p>
            </div>

            <TileBoard
              qKey={q.key}
              options={q.options}
              targetEn={q.target.en}
              picked={picked}
              revealKind={reveal ? reveal.kind : null}
              onPick={handlePick}
            />

            <div className="wf-actions">
              <button
                type="button"
                className="wf-listen"
                aria-disabled={echoDisabled}
                onClick={() => {
                  if (echoDisabled) return;
                  doEcho();
                }}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 9v6h3.5L12 19V5L7.5 9H4Z" />
                  <path d="M15.5 9a4 4 0 0 1 0 6" />
                  <path d="M18 6.6a7.5 7.5 0 0 1 0 10.8" opacity=".55" />
                </svg>
                <span className="wf-listen-txt">
                  {echoLocked
                    ? '한 번에 들어야 해요'
                    : echoSpent
                      ? '앙코르 소진'
                      : `다시 듣기 −${ECHO_BEAT_COST[echoes]}박`}
                </span>
                {!echoLocked && !echoSpent && <span className="wf-listen-cost">{ECHO_LABEL[echoes + 1]}</span>}
              </button>
              <span className="wf-echo" aria-label={`남은 앙코르 ${Math.max(0, MAX_ECHO - echoes)}회`}>
                {Array.from({ length: MAX_ECHO }, (_, i) => (
                  <i key={i} data-on={i < MAX_ECHO - echoes && !echoLocked ? '1' : '0'} aria-hidden="true" />
                ))}
              </span>
              <span className="wf-mult-now" aria-hidden="true">이 문제 {echoMultLabel}</span>
            </div>

            {movement === 1 && heard <= 1 && (
              <p className="wf-hint">
                발음을 듣고 <b>뜻</b>을 고르세요 · 남은 박이 많을수록 배수가 큽니다
              </p>
            )}
          </>
        )}

        {phase === 'wager' && (
          <section className="wf-panel" aria-labelledby="wf-wager-title">
            <p className="wf-caption wf-caption--solo">악장 {Math.min(movement, MOVEMENTS)} 끝</p>
            <h2 id="wf-wager-title" className="wf-panel-title">종지를 걸까요?</h2>
            <p className="wf-panel-sub">
              방금 들은 단어 <b>{CHAIN_LEN}개</b>가 이어서 흐릅니다. 순서대로 뜻을 이으면
              큰 점수와 <b>♪ 하나</b>를 돌려받습니다.
            </p>
            <p className="wf-panel-warn">
              <FeedbackIcon kind="wrong" size={13} />
              {CHAIN_LEN - 1}개 미만이면 ♪ 하나를 잃어요 · 지금 남은 ♪ {hp}
            </p>
            <div className="wf-wager-btns">
              <button type="button" className="gk-btn gk-btn--primary wf-wager-btn" onClick={beginChain}>
                종지 걸기
              </button>
              <button type="button" className="gk-btn wf-wager-btn" onClick={takeSafe}>
                그냥 이어 가기 <span className="wf-wager-sub">+{SAFE_BONUS}점</span>
              </button>
            </div>
          </section>
        )}

        {phase === 'chain' && (
          <>
            <p className="wf-caption wf-caption--solo">
              종지 · 악장 {Math.min(movement, MOVEMENTS)}
            </p>

            <div className="wf-lane">
              {chainStage === 'listen' && (
                <div className="wf-chain-listen" role="status" aria-live="polite">
                  <span className="wf-chain-beat" aria-hidden="true">♪</span>
                  <p className="wf-chain-txt">
                    듣는 중 · {Math.max(1, chainPlaying)}/{CHAIN_LEN}
                  </p>
                  <div className="wf-chain-dots" aria-hidden="true">
                    {Array.from({ length: CHAIN_LEN }, (_, i) => (
                      <i key={i} data-on={i < chainPlaying ? '1' : '0'} />
                    ))}
                  </div>
                </div>
              )}
              {chainStage === 'pick' && (
                <div className="wf-chain-listen" role="status">
                  <p className="wf-chain-txt">
                    {chainPlaying > 0
                      ? `다시 듣는 중 · ${chainPlaying}/${CHAIN_LEN}`
                      : `들은 순서대로 ${CHAIN_LEN}개를 이으세요`}
                  </p>
                  <div className="wf-chain-slots" aria-hidden="true">
                    {Array.from({ length: CHAIN_LEN }, (_, i) => (
                      <span key={i} className="wf-slot" data-on={i < chainPicks.length ? '1' : '0'}>
                        {i < chainPicks.length ? chainBoard[chainPicks[i]]?.ko : i + 1}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {chainStage === 'reveal' && chainResult && (
                <div className={`wf-reveal ${chainResult.hits === CHAIN_LEN ? 'wf-reveal--correct' : 'wf-reveal--wrong'}`} role="status">
                  <div className="wf-reveal-head">
                    <FeedbackIcon kind={chainResult.hits === CHAIN_LEN ? 'correct' : chainResult.hits === 2 ? 'near' : 'wrong'} size={16} />
                    <span className="wf-reveal-tag">
                      종지 {chainResult.hits}/{CHAIN_LEN}
                      {chainResult.hits === CHAIN_LEN ? ' · ♪ 하나 회복' : ''}
                    </span>
                  </div>
                  <ol className="wf-chain-answers">
                    {chainTargets.map((t, i) => {
                      const got = chainResult.picks[i];
                      const ok = !!got && got.en === t.en;
                      return (
                        <li key={t.en} className={ok ? 'is-ok' : 'is-ng'}>
                          <FeedbackIcon kind={ok ? 'correct' : 'wrong'} size={13} />
                          <b>{t.en}</b>
                          {t.pron && <em>{t.pron}</em>}
                          <span>{t.ko}</span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </div>

            {chainStage === 'pick' && (
              <div className="wf-meter">
                <div className="wf-gauge">
                  <div
                    className="wf-bar"
                    data-warn={warn ? '1' : '0'}
                    role="progressbar"
                    aria-label="남은 박"
                    aria-valuemin={0}
                    aria-valuemax={clock.beats}
                    aria-valuenow={beatsLeft}
                  >
                    <div className="wf-fill" style={{ width: `${cd.frac * 100}%`, ['--tickw' as string]: `${100 / CHAIN_BEATS}%` }} />
                  </div>
                </div>
                <p className="wf-read" data-warn={warn ? '1' : '0'}>
                  {warn && <FeedbackIcon kind="wrong" size={13} />}
                  <span className="wf-read-beat">♪ {beatsLeft}박</span>
                </p>
              </div>
            )}

            {chainStage !== 'listen' && (
              <ChainBoard
                board={chainBoard}
                picks={chainPicks}
                locked={chainStage !== 'pick' || chainPlaying > 0}
                targets={chainStage === 'reveal' ? chainTargets : null}
                onPick={chainPick}
              />
            )}

            {chainStage === 'pick' && (
              <div className="wf-actions">
                <button
                  type="button"
                  className="wf-listen"
                  aria-disabled={chainReplayed || chainPlaying > 0}
                  onClick={() => {
                    if (chainReplayed || chainPlaying > 0) return;
                    chainReplay();
                  }}
                >
                  <span className="wf-listen-txt">
                    {chainReplayed ? '다시 듣기 소진' : `다시 듣기 −${CHAIN_REPLAY_COST}박`}
                  </span>
                </button>
                <button
                  type="button"
                  className="gk-btn wf-act"
                  aria-disabled={chainPicks.length === 0}
                  onClick={() => {
                    if (chainPicks.length === 0) return;
                    chainUndo();
                  }}
                >
                  되돌리기
                </button>
                <button
                  type="button"
                  className="gk-btn gk-btn--primary wf-act"
                  aria-disabled={chainPicks.length !== CHAIN_LEN}
                  onClick={() => {
                    if (chainPicks.length !== CHAIN_LEN) return;
                    submitChain();
                  }}
                >
                  종지 잇기
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

const WF_CSS = `
  .wf-root { display: flex; flex-direction: column; }
  .wf-stage { gap: clamp(12px, 2.4vh, 22px); justify-content: flex-start; padding-top: clamp(12px, 3vh, 28px); }

  /* ── 악장 캡션 ── */
  .wf-caption { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 11.5px; font-weight: 800; letter-spacing: .06em; color: var(--t3); text-transform: none; }
  .wf-caption--solo { justify-content: center; }
  .wf-dots { display: inline-flex; gap: 4px; }
  .wf-dots i { width: 7px; height: 7px; border-radius: 50%; border: 1.5px solid color-mix(in srgb, var(--t1) 30%, transparent); background: transparent; transition: background .2s, transform .2s; }
  .wf-dots i[data-on="1"] { background: var(--combo); border-color: var(--combo); }
  .wf-heat { display: inline-flex; align-items: center; gap: 5px; }
  .wf-heat-bars { display: inline-flex; align-items: flex-end; gap: 2.5px; height: 12px; }
  .wf-heat-bars i { width: 4px; border-radius: 2px; background: color-mix(in srgb, var(--t1) 20%, transparent); transition: background .25s, height .25s; }
  .wf-heat-bars i:nth-child(1) { height: 5px; } .wf-heat-bars i:nth-child(2) { height: 7px; }
  .wf-heat-bars i:nth-child(3) { height: 9px; } .wf-heat-bars i:nth-child(4) { height: 12px; }
  .wf-heat-bars i[data-on="1"] { background: var(--streak); }

  /* ── 낙하 레인 (Wordfall) + 리빌 카드가 같은 자리를 쓴다 — 레이아웃 점프 없음 ── */
  .wf-lane { position: relative; width: min(560px, 94vw); min-height: 128px; display: flex; align-items: center; justify-content: center; }
  .wf-note { position: absolute; left: 50%; top: 0; margin-left: -13px; color: var(--combo); filter: drop-shadow(0 6px 14px color-mix(in srgb, var(--combo) 35%, transparent));
    transform: translateY(calc((128px - 30px) * var(--fall, 0))); }

  /* ── 리빌 (제출 후에만 — 철자·발음기호·뜻·예문) ── */
  .wf-reveal { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 14px 18px; border-radius: var(--r-lg, 14px); border: 1.5px solid var(--bd); background: color-mix(in srgb, var(--bg) 82%, transparent); backdrop-filter: blur(6px); animation: wf-rise .26s var(--ease-settle, ease-out); text-align: center; }
  .wf-reveal--correct { border-color: color-mix(in srgb, var(--success) 55%, var(--bd)); }
  .wf-reveal--near { border-color: color-mix(in srgb, var(--streak) 55%, var(--bd)); }
  .wf-reveal--wrong { border-color: color-mix(in srgb, var(--error) 45%, var(--bd)); }
  .wf-reveal-head { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 800; letter-spacing: .02em; }
  .wf-reveal--correct .wf-reveal-head { color: var(--success); }
  .wf-reveal--near .wf-reveal-head { color: var(--streak); }
  .wf-reveal--wrong .wf-reveal-head { color: var(--error); }
  .wf-reveal-en { margin: 0; font-family: var(--font-english, var(--font-display, system-ui)); font-size: clamp(22px, 5.4vw, 30px); font-weight: 800; color: var(--t1); letter-spacing: -.01em; display: flex; flex-wrap: wrap; align-items: baseline; gap: 9px; justify-content: center; }
  .wf-reveal-pron { font-size: 13px; font-weight: 600; color: var(--t3); letter-spacing: 0; }
  .wf-reveal-ko { margin: 0; font-size: 14.5px; font-weight: 700; color: var(--t2); }
  .wf-reveal-ex { margin: 2px 0 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13px; line-height: 1.55; color: var(--t3); max-width: 46ch; }

  /* ── 케이던스 바 (배수 사다리 + 박 눈금) ── */
  .wf-meter { display: flex; align-items: center; gap: 12px; width: min(560px, 94vw); }
  .wf-gauge { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  /* 배수 사다리를 바 밖(위)에 둔다 — 바 안에 두면 게이지가 가득 찬 시작 순간에
     라벨이 통째로 덮여, 정작 판단이 필요한 때 사다리가 보이지 않는다. */
  .wf-ladder { display: flex; align-items: flex-end; }
  .wf-ladder > span { display: flex; justify-content: flex-end; padding-right: 5px; border-right: 1px solid color-mix(in srgb, var(--t1) 16%, transparent); }
  .wf-ladder > span:last-child { border-right: 0; padding-right: 1px; }
  .wf-ladder i { font-style: normal; font-size: 9.5px; font-weight: 800; letter-spacing: .04em; color: color-mix(in srgb, var(--t1) 36%, transparent); transition: color .2s, transform .2s; }
  .wf-ladder > span[data-live="1"] i { color: var(--combo); transform: scale(1.18); }
  .wf-bar { position: relative; width: 100%; height: 14px; border-radius: 999px; background: var(--bg3); overflow: hidden; border: 1px solid color-mix(in srgb, var(--t1) 10%, transparent); }
  .wf-divs { position: absolute; inset: 0; display: flex; pointer-events: none; }
  .wf-divs > span { border-right: 1px dashed color-mix(in srgb, var(--t1) 26%, transparent); }
  .wf-divs > span:last-child { border-right: 0; }
  .wf-fill { position: absolute; inset: 0 auto 0 0; border-radius: 999px; background:
      repeating-linear-gradient(90deg, color-mix(in srgb, #fff 26%, transparent) 0, color-mix(in srgb, #fff 26%, transparent) 1.5px, transparent 1.5px, transparent var(--tickw, 8%)),
      linear-gradient(90deg, color-mix(in srgb, var(--combo) 78%, #fff), var(--combo));
    transition: background .25s; }
  .wf-bar[data-warn="1"] .wf-fill { background:
      repeating-linear-gradient(90deg, color-mix(in srgb, #fff 30%, transparent) 0, color-mix(in srgb, #fff 30%, transparent) 1.5px, transparent 1.5px, transparent var(--tickw, 8%)),
      linear-gradient(90deg, color-mix(in srgb, var(--error) 78%, #fff), var(--error));
    animation: wf-pulse .6s ease-in-out infinite; }
  .wf-read { display: inline-flex; align-items: center; gap: 6px; margin: 0; min-width: 96px; justify-content: flex-end; font-size: 12.5px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--t2); }
  .wf-read[data-warn="1"] { color: var(--error); }
  .wf-read-mult { padding: 2px 7px; border-radius: 999px; background: color-mix(in srgb, var(--combo) 16%, transparent); color: var(--combo); }
  .wf-read[data-warn="1"] .wf-read-mult { background: color-mix(in srgb, var(--error) 14%, transparent); color: var(--error); }

  /* ── 타일 ── */
  .wf-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: min(560px, 94vw); }
  .wf-tiles[data-count="5"] > :nth-child(5) { grid-column: 1 / -1; }
  .wf-tile { min-height: 62px; justify-content: flex-start; gap: 10px; }
  .wf-tile-ko { flex: 1; font-family: var(--font-display, system-ui); font-size: clamp(15px, 3.4vw, 20px); }
  .wf-tile .gk-kbd { flex: none; opacity: .6; }
  .wf-tile--chosen { border-color: var(--combo); background: color-mix(in srgb, var(--combo) 12%, var(--bg)); }
  .wf-order { flex: none; display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 7px; border: 1px solid var(--bd); font-size: 11px; font-weight: 800; color: var(--t3); }
  .wf-tile--chosen .wf-order { border-color: var(--combo); color: var(--combo); }
  .wf-tiles--chain { grid-template-columns: 1fr 1fr; }
  @media (min-width: 560px) { .wf-tiles--chain { grid-template-columns: repeat(3, 1fr); } }

  /* ── 액션 열 ── */
  .wf-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px; width: min(560px, 94vw); }
  .wf-listen { display: inline-flex; align-items: center; gap: 9px; min-height: 48px; padding: 0 18px; border-radius: 999px; border: 1.5px solid var(--bd); background: color-mix(in srgb, var(--bg) 76%, transparent); color: var(--combo); font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 800; cursor: pointer; backdrop-filter: blur(6px); transition: transform .18s var(--ease-spring), border-color .15s, color .15s, opacity .15s; }
  .wf-listen:hover { border-color: var(--combo); }
  .wf-listen:active { transform: scale(.96); }
  .wf-listen:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  .wf-listen[aria-disabled="true"] { opacity: .5; cursor: default; color: var(--t3); border-color: var(--bd); }
  .wf-listen[aria-disabled="true"]:hover { border-color: var(--bd); transform: none; }
  .wf-listen-txt { color: var(--t2); letter-spacing: -.01em; }
  .wf-listen-cost { padding: 2px 7px; border-radius: 999px; background: color-mix(in srgb, var(--error) 12%, transparent); color: var(--error); font-size: 11px; }
  .wf-echo { display: inline-flex; gap: 5px; }
  .wf-echo i { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid color-mix(in srgb, var(--t1) 30%, transparent); }
  .wf-echo i[data-on="1"] { background: var(--combo); border-color: var(--combo); }
  .wf-mult-now { font-size: 11.5px; font-weight: 800; color: var(--t3); }
  .wf-hint { margin: 0; font-size: 12.5px; color: var(--t3); text-align: center; }
  .wf-hint b { color: var(--t2); }
  .wf-act { min-height: 48px; font-size: 13.5px; }
  .wf-act[aria-disabled="true"] { opacity: .45; cursor: default; }
  .wf-act[aria-disabled="true"]:hover { border-color: var(--bd); }

  /* ── 패널 (게이트 · 카운트인 · 종지 도박) ── */
  .wf-panel { display: flex; flex-direction: column; align-items: center; gap: 12px; width: min(520px, 94vw); margin: auto 0; padding: 26px 22px; border-radius: var(--r-lg, 16px); border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 78%, transparent); backdrop-filter: blur(8px); box-shadow: 0 18px 46px -18px rgba(0,0,0,.4); text-align: center; }
  .wf-gate-mark { display: grid; place-items: center; width: 60px; height: 60px; border-radius: 18px; color: var(--combo); border: 1px solid color-mix(in srgb, var(--combo) 35%, var(--bd)); background: color-mix(in srgb, var(--combo) 8%, transparent); }
  .wf-panel-title { margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: clamp(20px, 4.6vw, 26px); font-weight: 500; color: var(--t1); }
  .wf-panel-sub { margin: 0; font-size: 13.5px; line-height: 1.65; color: var(--t2); max-width: 40ch; }
  .wf-panel-sub b { color: var(--t1); font-weight: 800; }
  .wf-panel-warn { display: inline-flex; align-items: center; gap: 6px; margin: 0; font-size: 12.5px; font-weight: 700; color: var(--t3); }
  .wf-panel-foot { margin: 2px 0 0; font-size: 11.5px; color: var(--t3); display: flex; flex-wrap: wrap; gap: 5px; align-items: center; justify-content: center; }
  .wf-gate-btn { min-height: 56px; padding: 0 34px; font-size: 16px; }
  .wf-panel--count { border: 0; background: transparent; box-shadow: none; backdrop-filter: none; gap: 6px; }
  .wf-count-num { margin: 0; font-size: clamp(64px, 18vw, 104px); font-weight: 800; line-height: 1; color: var(--combo); font-variant-numeric: tabular-nums; animation: wf-count .4s var(--ease-spring, ease-out); }
  .wf-wager-btns { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
  .wf-wager-btn { min-height: 52px; }
  .wf-wager-sub { margin-left: 7px; font-size: 11.5px; font-weight: 700; opacity: .75; }

  /* ── 종지 진행 ── */
  .wf-chain-listen { display: flex; flex-direction: column; align-items: center; gap: 9px; }
  .wf-chain-beat { font-size: 30px; color: var(--combo); animation: wf-pulse .9s ease-in-out infinite; }
  .wf-chain-txt { margin: 0; font-size: 13.5px; font-weight: 800; color: var(--t2); }
  .wf-chain-dots { display: flex; gap: 7px; }
  .wf-chain-dots i { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid color-mix(in srgb, var(--t1) 28%, transparent); }
  .wf-chain-dots i[data-on="1"] { background: var(--combo); border-color: var(--combo); }
  .wf-chain-slots { display: flex; flex-wrap: wrap; gap: 7px; justify-content: center; }
  .wf-slot { display: inline-grid; place-items: center; min-width: 62px; min-height: 34px; padding: 0 11px; border-radius: 10px; border: 1.5px dashed color-mix(in srgb, var(--t1) 26%, transparent); font-size: 12.5px; font-weight: 800; color: var(--t3); }
  .wf-slot[data-on="1"] { border-style: solid; border-color: var(--combo); color: var(--t1); background: color-mix(in srgb, var(--combo) 10%, transparent); }
  .wf-chain-answers { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 5px; width: 100%; }
  .wf-chain-answers li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; justify-content: center; font-size: 13.5px; }
  .wf-chain-answers li.is-ok { color: var(--success); }
  .wf-chain-answers li.is-ng { color: var(--error); }
  .wf-chain-answers b { font-family: var(--font-english, var(--font-display, system-ui)); font-size: 17px; font-weight: 800; color: var(--t1); }
  .wf-chain-answers em { font-style: normal; font-size: 11.5px; color: var(--t3); }
  .wf-chain-answers span { color: var(--t2); font-weight: 700; }

  /* ── 결과: 놓친 단어 ── */
  .wf-missed { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .wf-missed-lbl { margin: 0; font-size: 11.5px; font-weight: 800; letter-spacing: .06em; color: var(--t3); }
  .wf-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .wf-chip { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 1px; min-height: 44px; padding: 6px 14px; border-radius: 12px; border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 72%, transparent); cursor: pointer; transition: border-color .15s, transform .18s var(--ease-spring); }
  .wf-chip:hover { border-color: var(--combo); }
  .wf-chip:active { transform: scale(.96); }
  .wf-chip:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 28%, transparent); }
  .wf-chip-en { font-family: var(--font-english, var(--font-display, system-ui)); font-size: 14px; font-weight: 800; color: var(--t1); }
  .wf-chip-ko { font-size: 11px; font-weight: 700; color: var(--t3); }
  .wf-refocus { min-height: 44px; font-size: 13px; }

  @keyframes wf-rise { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes wf-pulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
  @keyframes wf-count { 0% { transform: scale(.7); opacity: .3; } 60% { transform: scale(1.06); opacity: 1; } 100% { transform: scale(1); } }

  @media (max-width: 420px) {
    .wf-caption { font-size: 10.5px; gap: 7px; }
    .wf-lane { min-height: 116px; }
    .wf-note { transform: translateY(calc((116px - 30px) * var(--fall, 0))); }
    .wf-mult-now { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .wf-listen, .wf-chip, .wf-dots i, .wf-heat-bars i { transition: none; }
    .wf-reveal, .wf-count-num { animation: none; }
    .wf-bar[data-warn="1"] .wf-fill, .wf-chain-beat { animation: none; }
    .wf-bar[data-warn="1"] { box-shadow: 0 0 0 2px color-mix(in srgb, var(--error) 45%, transparent); }
  }
`;
