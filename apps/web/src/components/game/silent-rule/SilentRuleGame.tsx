// apps/web/src/components/game/silent-rule/SilentRuleGame.tsx
// The Silent Rule — 설명 없는 철자 규칙 귀납 (The Witness 계열).
//
// v07.9 전면 재설계. 이전 판의 붕괴 지점 세 가지를 구조로 막았다.
//   ① 해밍거리 오라클 제거 — "N칸이 어긋난다"를 알려주면 규칙을 몰라도 한 칸씩 토글해
//      숫자를 줄이는 마스터마인드 힐클라임이 지배 전략이 된다. 이제 **제출은 한 번**이고,
//      제출 전에는 어떤 부분 정답 정보도 주지 않는다. 정답은 제출 뒤에 전부 공개한다.
//   ② 고정 뱅크 제거 — 규칙·증거·격자·봉인어를 매 판 런타임에 조립한다(rules.ts).
//      wordPool 이 오면 학습자 단어에서 파생한 쌍을 격자에 우선 배치하고, 그 칸만 FSRS 에
//      기록한다(뱅크 단어는 기록하지 않아 복습 큐를 오염시키지 않는다).
//   ③ 판돈 신설 — 하나의 시계가 전체 세션을 관통한다. 완봉하면 시간이 늘고, 두 칸 이상
//      어긋나면 준다. 증거를 오래 볼수록 시계도 흐르므로 "더 볼까 / 지금 갈까"가 선택이 된다.
//      마지막에 '봉인'(새 오철자를 직접 타이핑해 교정) 으로 그 문의 점수를 걸 수 있다.

'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  GameKitStyles, AmbientBackground, GameMark, Hud, GameDone, ParticleBurst, FeedbackIcon,
  TimerBar, Kbd, GameMusic, useSfx, useCountdown, useCombo, usePersonalBest,
  type Word, type ComboTier,
} from '@/components/game/_shared/gamekit';

import { buildDeck, buildGate, gatesFor, type Deck, type Gate, type Tile } from './rules';

/**
 * `assisted` — 정답을 이미 보여준 뒤의 입력. 게임 점수·콤보에는 반영하되 FSRS 에는 올리지 않는다.
 * 판정 자체는 record-result 가 중앙에서 한다(play-scaffold.tsx ResultOpts).
 */
interface ResultOpts { assisted?: boolean }

interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word, opts?: ResultOpts) => void;
  onWrong?: (w: Word, opts?: ResultOpts) => void;
}

// 증거와 격자를 한 화면에 둔다 — 화면을 쪼개면 게임이 '증거 암기'를 재게 되고,
// 세션도 길어져 2~4분에 완결되지 않는다. 시계는 첫 칸을 밝히는 순간 시작한다.
type Phase = 'gate' | 'verdict' | 'seal' | 'reveal' | 'done';

const TOTAL_MS = 120_000;
const WARN_MS = 15_000;
const TILE_POINTS = 120;
const CLEAN_BONUS = 250;
const MISS_MS = 8_000;

/**
 * 완봉 보너스 시간은 **뒤로 갈수록 줄어든다**.
 *
 * v07.10 반증 #4 실측: 고정 +14초는 8칸 판정의 한계 작업 증가분(약 +3초)을 크게 웃돌아
 * 잘하는 플레이어의 마지막 30초가 첫 30초보다 헐거워졌다("난이도가 조여든다" 주장 반증).
 *
 * v07.11 — index 가 아니라 **진행률**의 함수로 바꿨다: 14초 → 5초.
 *   cleanBonusMs(prog) = 14000 − prog × 9000
 * 문 수가 8이든 4든 첫 문은 +14초, 마지막 문은 +5초로 같은 곡선을 돈다(index 기반이면
 * 짧은 판에서 곡선이 잘려 끝까지 헐거운 채로 끝난다). 8문 전부 완봉해도 가산 총량은
 * 76초로 useCountdown 의 가산 상한(총량의 75% = 90초) 안쪽이다.
 */
const cleanBonusMs = (prog: number) => Math.round((14_000 - prog * 9_000) / 1_000) * 1_000;

/**
 * 봉인 판돈 (v07.10 반증 #2 — "봉인은 항상 거는 게 맞다"의 정면 수정).
 *
 * 예전: 성공 +points(2배) / 실패 −points/2 → 점수 손익분기 p = 1/3. 봉인 성공률이 0.9 였으니
 * '넘어간다'는 눌러선 안 되는 지배당한 선택지였다.
 * 지금: 성공 +points×0.5 / 실패 −points 전액 + **연속(콤보) 끊김**.
 *   손익분기 p = 1 / (1 + 0.5) = 2/3.
 *   여기에 콤보 손실이 얹히므로 배수가 높을수록 손익분기가 더 올라간다 —
 *   "완봉으로 연속을 쌓는 중이면 걸지 않고, 한 칸 흘려 연속이 이미 끊겼으면 건다"가 된다.
 */
const SEAL_WIN_RATIO = 0.5;
const SEAL_WIN_MS = 12_000;
const SEAL_LOSE_MS = 14_000;

/**
 * 판정 화면은 정답이 전부 보이는 화면이다. 여기서 시계를 완전히 멈추면 '무료 열람 시간'이
 * 되어 뒤의 판단을 공짜로 준비할 수 있다. 1/3 속도로 흘려 체류에 값을 매긴다.
 * (리빌 화면은 규칙을 배우는 자리이므로 그대로 무료다 — 학습에는 값을 매기지 않는다.)
 */
const VERDICT_TICK_MS = 300;
const VERDICT_DRAIN_MS = 100;

const COMBO_TIERS: ComboTier[] = [
  { at: 0, mult: 1 },
  { at: 1, mult: 1.5, label: '통찰' },
  { at: 2, mult: 2, label: '꿰뚫음' },
  { at: 4, mult: 3, label: '침묵의 독해' },
];

interface Run {
  deck: Deck;
  gate: Gate;
  used: Set<string>;
  /** 이 판의 문 수 — 규칙 공급량의 함수(rules.gatesFor). 한 판에 열리는 규칙이 10개인 지금은 8. */
  total: number;
}

function makeRun(pool: Word[] | undefined): Run {
  const deck = buildDeck(pool);
  const total = gatesFor(deck);
  // 첫 문에는 넘겨받은 예비 쌍이 없다 → 봉인 없음. 공개된 규칙이 아직 하나도 없으니 당연하다.
  const gate = buildGate(deck, 0, new Set<string>(), null, total);
  return { deck, gate, used: new Set(gate.keys), total };
}

/** 타일의 판정 상태 — 색 외에 아이콘·취소선·라벨로도 구분한다(색각 이중 인코딩). */
type TileState = 'hit' | 'kept' | 'missed' | 'lured';

function tileState(t: Tile, lit: boolean): TileState {
  if (t.valid) return lit ? 'hit' : 'missed';
  return lit ? 'lured' : 'kept';
}

/**
 * 배지 라벨은 **내 판단의 정오** 한 축만 말한다.
 *
 * v07.10 반증 #6: 예전에는 아이콘(판단의 정오)과 텍스트('옳음'/'어긋남' = 철자의 정오)를
 * 한 배지에 섞어, 놓친 칸에 빨간 ✗ 옆에 '옳음'이라고 적혀 두 인코딩이 서로 모순됐다.
 * 철자의 정오는 취소선(.sr-panel-word--bad)이 이미 인코딩한다 — 겹쳐 쓰지 않는다.
 */
const STATE_LABEL: Record<TileState, string> = {
  hit: '맞힘',
  kept: '지킴',
  missed: '놓침',
  lured: '걸림',
};

/** 스크린리더에는 두 축을 풀어서 읽어 준다. */
const STATE_SR: Record<TileState, string> = {
  hit: '옳은 철자를 밝혔다',
  kept: '어긋난 철자를 남겨 뒀다',
  missed: '옳은데 밝히지 않았다',
  lured: '어긋났는데 밝혔다',
};

// 카운트다운은 매 프레임 setState 한다 — 격자는 memo 로 끊어 리렌더를 막는다.
const TileGrid = memo(function TileGrid({
  tiles, cols, sel, mode, shake, glow, onToggle,
}: {
  tiles: Tile[];
  cols: number;
  sel: Set<string>;
  mode: 'judge' | 'verdict';
  shake: boolean;
  glow: boolean;
  onToggle: (text: string) => void;
}) {
  return (
    <div
      className={`sr-grid ${shake ? 'sr-grid--shake' : ''} ${glow ? 'sr-grid--glow' : ''}`}
      style={{ ['--sr-cols' as string]: String(cols) } as CSSProperties}
    >
      {tiles.map((t, i) => {
        const lit = sel.has(t.text);
        const st = mode === 'verdict' ? tileState(t, lit) : null;
        const good = st === 'hit' || st === 'kept';
        return (
          <button
            key={t.text}
            type="button"
            className={`sr-panel ${lit ? 'sr-panel--on' : ''}`}
            data-on={lit ? '1' : '0'}
            data-state={st ?? 'open'}
            aria-pressed={mode === 'judge' ? lit : undefined}
            aria-disabled={mode === 'verdict' ? true : undefined}
            onClick={mode === 'judge' ? () => onToggle(t.text) : undefined}
          >
            <span className="sr-panel-top">
              {/* 숫자 = 그 칸의 단축키. 10번째 칸은 0 이다(1–9 다음). */}
              <span className="sr-panel-num" aria-hidden="true">{i === 9 ? 0 : i + 1}</span>
              <span className="sr-panel-node" aria-hidden="true" />
            </span>
            <span
              className={`sr-panel-word ${st && !t.valid ? 'sr-panel-word--bad' : ''}`}
              data-len={t.text.length >= 12 ? 'xlong' : t.text.length >= 9 ? 'long' : 'norm'}
            >
              {t.text}
            </span>
            {st && (
              <span className="sr-panel-mark">
                <FeedbackIcon kind={good ? 'correct' : 'wrong'} size={13} />
                <span className="sr-panel-mark-t">{STATE_LABEL[st]}</span>
                {t.outside?.kind === 'exception' && <span className="sr-panel-ex">예외</span>}
                <span className="gk-sr">{STATE_SR[st]}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});

export function SilentRuleGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();
  const [run, setRun] = useState<Run>(() => makeRun(wordPool));
  const [phase, setPhase] = useState<Phase>('gate');
  /** 첫 칸을 밝히기 전까지 시계는 멈춰 있다 — 규칙을 읽을 시간을 뺏지 않는다. */
  const [started, setStarted] = useState(false);
  const [sel, setSel] = useState<Set<string>>(() => new Set());
  const [verdict, setVerdict] = useState<{ wrongCount: number; points: number; kind: 'clean' | 'near' | 'off' } | null>(null);
  const [sealInput, setSealInput] = useState('');
  const [sealResult, setSealResult] = useState<'won' | 'lost' | 'skipped' | null>(null);
  const [score, setScore] = useState(0);
  const [gatesDone, setGatesDone] = useState(0);
  const [cleanGates, setCleanGates] = useState(0);
  const [sealsWon, setSealsWon] = useState(0);
  const [missed, setMissed] = useState<{ wrong: string; fix: string }[]>([]);
  const [mineUsed, setMineUsed] = useState(0);
  const [pendingRule, setPendingRule] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [glow, setGlow] = useState(false);
  const [bestRes, setBestRes] = useState<{ improved: boolean; prev: number | null } | null>(null);

  const mineRef = useRef<Set<string>>(new Set());
  const sealRef = useRef<HTMLInputElement | null>(null);
  // useSfx 는 매 렌더 새 객체를 돌려준다 — 콜백을 ref 로 붙잡아야 격자 memo 가 살아 있다.
  const sfxRef = useRef(sfx);
  sfxRef.current = sfx;
  const timers = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }, []);
  useEffect(() => () => { timers.current.forEach((id) => window.clearTimeout(id)); }, []);

  const combo = useCombo({
    tiers: COMBO_TIERS,
    onTierUp: (tier) => { if (tier.mult >= 2) sfx.coin(); },
  });
  const pb = usePersonalBest('silent-rule');

  const gate = run.gate;
  const totalGates = run.total;
  /** 진행률 — 시간 곡선·문 규격이 전부 이 값의 함수다. 문 수가 몇이든 0 → 1 을 다 돈다. */
  const gateProg = totalGates <= 1 ? 1 : gate.index / (totalGates - 1);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const gateRef = useRef(gate);
  gateRef.current = gate;
  const runRef = useRef(run);
  runRef.current = run;

  const onTimeUp = useCallback(() => {
    const p = phaseRef.current;
    if (p === 'gate' || p === 'seal' || p === 'verdict') {
      setPendingRule(`${gateRef.current.rule.statement} — ${gateRef.current.rule.hint}`);
    }
    setPhase('done');
  }, []);

  const clock = useCountdown({
    totalMs: TOTAL_MS,
    running: started && (phase === 'gate' || phase === 'seal'),
    warnAtMs: WARN_MS,
    onWarn: () => sfx.click(),
    onEnd: onTimeUp,
  });
  const clockRef = useRef(clock);
  clockRef.current = clock;

  // 판정 화면의 1/3 속도 시계. useCountdown 은 배속 개념이 없으므로 멈춘 시계를
  // 주기적으로 조금씩 깎아 같은 효과를 낸다(300ms 실시간마다 100ms 소모).
  useEffect(() => {
    if (!started || phase !== 'verdict') return;
    const id = window.setInterval(() => clockRef.current.drain(VERDICT_DRAIN_MS), VERDICT_TICK_MS);
    return () => window.clearInterval(id);
  }, [started, phase]);

  // 멈춘 시계는 rAF 루프가 돌지 않아 onEnd 가 못 뜬다 — 판정 중 0 이 되면 여기서 끝낸다.
  useEffect(() => {
    if (!started || phase !== 'verdict' || clock.remainMs > 0) return;
    onTimeUp();
  }, [started, phase, clock.remainMs, onTimeUp]);

  // 스코프가 바뀌면(내 단어 로드 완료 등) 덱을 다시 짠다.
  // 진행 중에는 갈아끼우지 않는다 — 판정 도중 격자가 바뀌면 그건 불공정이다.
  const poolRef = useRef(wordPool);
  useEffect(() => {
    if (poolRef.current === wordPool) return;
    if (started && phase !== 'done') return;
    poolRef.current = wordPool;
    setRun(makeRun(wordPool));
  }, [wordPool, phase, started]);

  useEffect(() => {
    if (phase !== 'done' || bestRes) return;
    setBestRes(pb.submit(score));
  }, [phase, score, pb, bestRes]);

  /**
   * FSRS 적재 정책 (v07.10 반증 #4 — "굴절형 판정이 원형 단어의 안정도를 대리로 올린다").
   *
   * 격자 타일은 'armies / armys' 같은 **표면 철자 판정**이다. 옳은 철자 타일은 정답이
   * 글자 그대로 칸에 인쇄돼 있고, 'army = 군대'라는 의미는 한 번도 인출되지 않는다.
   * 그런데 credit 은 원형 'army' 로 올라가 Rating.Good 으로 stability 를 밀어올렸다.
   * → 격자에서 **맞힌** 판정은 assisted 로 올린다. 점수·콤보·"내 단어 N개"는 그대로지만
   *   복습 스케줄은 건드리지 않는다.
   *
   * 반대로 **틀린** 판정은 정직하게 오답으로 올린다. 내 단어의 옳은 철자를 못 알아봤거나
   * 비단어에 걸렸다는 것은 그 단어에 대한 실패의 증거이고, 여기서 침묵하면
   * "합리적으로 플레이할수록 내가 모르는 단어가 복습 큐에서 사라지는" letter-forge 함정에
   * 그대로 빠진다. 모르는 단어일수록 오답으로 올라가야 복습이 잡힌다.
   *
   * 유일한 비-assisted 정답 경로는 봉인이다 — 화면에 없는 규칙을 떠올려 철자를 **손으로
   * 생성**하므로 진짜 인출이다.
   *
   * 무한 적재 경로는 없다: 제출은 최소 1칸을 밝혀야 가능하고(방치 진행 불가),
   * 시간 종료는 아무것도 기록하지 않으며, 같은 카드 재채점은 중앙에서 10분 쿨다운이 막는다.
   */
  const credit = useCallback((w: Word | undefined, ok: boolean, assisted: boolean) => {
    if (!w) return;
    const key = (w.en ?? '').trim().toLowerCase();
    if (!key) return;
    if (!mineRef.current.has(key)) {
      mineRef.current.add(key);
      setMineUsed(mineRef.current.size);
    }
    const opts = assisted ? { assisted: true } : undefined;
    if (ok) onCorrect?.(w, opts);
    else onWrong?.(w, opts);
  }, [onCorrect, onWrong]);

  const toggle = useCallback((text: string) => {
    setStarted(true);
    setSel((s) => {
      const n = new Set(s);
      if (n.has(text)) n.delete(text); else n.add(text);
      return n;
    });
    sfxRef.current.click();
  }, []);

  const submitJudge = useCallback(() => {
    if (phaseRef.current !== 'gate') return;
    const g = gateRef.current;
    if (sel.size === 0) return;

    let wrongCount = 0;
    const missedNow: { wrong: string; fix: string }[] = [];
    const scored = new Set<string>();
    for (const t of g.tiles) {
      const lit = sel.has(t.text);
      const ok = lit === t.valid;
      if (!ok) {
        wrongCount += 1;
        if (!t.valid) missedNow.push({ wrong: t.text, fix: t.fix });
      }
      const key = (t.src?.en ?? '').trim().toLowerCase();
      if (t.src && !scored.has(key)) {
        scored.add(key);
        // 맞힌 판정 = 재인(정답이 칸에 인쇄돼 있다) → assisted. 틀린 판정 = 정직한 오답.
        credit(t.src, ok, ok);
      }
    }

    const kind: 'clean' | 'near' | 'off' = wrongCount === 0 ? 'clean' : wrongCount === 1 ? 'near' : 'off';
    const mult = combo.mult;
    const base = (g.tiles.length - wrongCount) * TILE_POINTS + (wrongCount === 0 ? CLEAN_BONUS : 0);
    const points = Math.round(base * mult);

    setScore((s) => s + points);
    setGatesDone((n) => n + 1);
    if (missedNow.length) setMissed((m) => [...m, ...missedNow]);

    if (kind === 'clean') {
      setCleanGates((n) => n + 1);
      combo.hit();
      const t = runRef.current.total;
      clock.extend(cleanBonusMs(t <= 1 ? 1 : g.index / (t - 1)));
      setGlow(true);
      later(() => setGlow(false), 900);
      sfxRef.current.correct(combo.combo + 1, false);
    } else {
      combo.miss();
      if (kind === 'near') {
        sfxRef.current.nearMiss();
      } else {
        clock.drain(MISS_MS);
        sfxRef.current.wrong();
        setShake(true);
        later(() => setShake(false), 460);
      }
    }

    setVerdict({ wrongCount, points, kind });
    setPhase('verdict');
  }, [sel, combo, clock, credit, later]);

  const startSeal = useCallback(() => {
    setSealInput('');
    setPhase('seal');
  }, []);

  const skipSeal = useCallback(() => {
    setSealResult('skipped');
    setPhase('reveal');
  }, []);

  const submitSeal = useCallback(() => {
    const seal = gateRef.current.seal;
    const v = verdict;
    if (!seal || !v) return;
    const answer = sealInput.trim().toLowerCase();
    if (answer.length < 3) return;
    const won = answer === seal.answer;
    // 봉인만이 이 게임의 **진짜 인출**이다 — 화면에 없는 규칙을 떠올려 철자를 손으로 생성한다.
    // 그래서 여기만 assisted 없이(=FSRS 에 실제로) 기록한다.
    credit(seal.src, won, false);
    if (won) {
      setScore((s) => s + Math.round(v.points * SEAL_WIN_RATIO));
      setSealsWon((n) => n + 1);
      clock.extend(SEAL_WIN_MS);
      sfxRef.current.fanfare();
    } else {
      setScore((s) => Math.max(0, s - v.points));
      setMissed((m) => [...m, { wrong: seal.prompt, fix: seal.answer }]);
      clock.drain(SEAL_LOSE_MS);
      // 판돈에는 연속도 포함된다 — 이게 없으면 완봉 직후 봉인이 다시 공짜가 된다.
      combo.miss();
      sfxRef.current.wrong();
    }
    setSealResult(won ? 'won' : 'lost');
    setPhase('reveal');
  }, [sealInput, verdict, clock, credit, combo]);

  const nextGate = useCallback(() => {
    setRun((r) => {
      const i = r.gate.index + 1;
      if (i >= r.total) return r;
      // 직전 문이 떼어 둔 예비 쌍이 이번 문의 봉인어가 된다.
      const g = buildGate(r.deck, i, r.used, r.gate.reserve, r.total);
      return { deck: r.deck, gate: g, used: new Set([...r.used, ...g.keys]), total: r.total };
    });
    if (gateRef.current.index + 1 >= runRef.current.total) {
      setPhase('done');
      return;
    }
    setSel(new Set());
    setVerdict(null);
    setSealResult(null);
    setSealInput('');
    setPhase('gate');
  }, []);

  const restart = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    mineRef.current = new Set();
    setRun(makeRun(wordPool));
    setSel(new Set());
    setVerdict(null);
    setSealResult(null);
    setSealInput('');
    setScore(0);
    setGatesDone(0);
    setCleanGates(0);
    setSealsWon(0);
    setMissed([]);
    setMineUsed(0);
    setPendingRule(null);
    setBestRes(null);
    setShake(false);
    setGlow(false);
    combo.reset();
    clock.reset(TOTAL_MS);
    setStarted(false);
    setPhase('gate');
  }, [wordPool, combo, clock]);

  const handleExit = useCallback(() => onExit?.(), [onExit]);

  // 키보드 — 1~9 토글 · Enter 진행/제출. 버튼에 포커스가 있을 때의 Enter 는 버튼에 맡긴다.
  // 카운트다운이 매 프레임 리렌더하므로 핸들러는 ref 로 넘겨 리스너를 한 번만 건다.
  const keyOps = useRef({ phase, toggle, submitJudge, nextGate });
  keyOps.current = { phase, toggle, submitJudge, nextGate };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const op = keyOps.current;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      // 마지막 문은 10칸이다 — 0 을 10번 칸에 준다.
      if (op.phase === 'gate' && /^[0-9]$/.test(e.key)) {
        const t = gateRef.current.tiles[e.key === '0' ? 9 : Number(e.key) - 1];
        if (t) { e.preventDefault(); op.toggle(t.text); }
        return;
      }
      if (e.key !== 'Enter' || tag === 'BUTTON') return;
      e.preventDefault();
      if (op.phase === 'gate') op.submitJudge();
      else if (op.phase === 'reveal') op.nextGate();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 봉인 입력은 즉시 타이핑할 수 있어야 한다(시계가 흐르는 중).
  useEffect(() => { if (phase === 'seal') sealRef.current?.focus(); }, [phase]);

  const badTiles = useMemo(() => gate.tiles.filter((t) => !t.valid), [gate.tiles]);

  /**
   * 봉인을 제안할 자격 — 두 칸 이상 흘린 문에서는 걸 수 없다.
   * 규칙을 못 읽은 문에서까지 열어 두면 봉인이 '판돈'이 아니라 **공짜 재도전**이 된다
   * (v07.10 반증 #2). 완봉·한 칸 차이일 때만, 즉 "읽었다고 생각할 때만" 걸 수 있다.
   */
  const sealOffered = !!gate.seal && !!verdict && verdict.kind !== 'off';
  const liveMsg = verdict
    ? verdict.kind === 'clean'
      ? '완봉 — 한 칸도 어긋나지 않았어요'
      : verdict.kind === 'near'
        ? '한 칸만 어긋났어요'
        : `${verdict.wrongCount}칸이 어긋났어요`
    : '';

  const atmos = (
    <AmbientBackground
      center="#EAF3EE" mid="#AAC9BE" edge="#173F3B"
      glow="rgba(120,230,180,.28)" glowAt="50% 22%" watermark="silent-rule"
    />
  );

  if (phase === 'done') {
    const allClean = gatesDone > 0 && cleanGates === gatesDone;
    // Calm UI — 완료 시 폭죽 금지. 완주의 표시는 배지 한 줄로 조용히 남긴다.
    const badge = allClean && gatesDone >= 3
      ? `무결 완주 · ${gatesDone}문 전부 완봉`
      : combo.best >= 4
        ? '침묵의 독해 · 통찰 4연속'
        : sealsWon >= 2
          ? `봉인 ${sealsWon}회 · 규칙을 손으로 썼다`
          : undefined;
    const hint = bestRes && bestRes.prev != null && !bestRes.improved
      ? `개인 최고까지 ${Math.max(1, bestRes.prev - score)}점 — 완봉 한 번이면 닿아요`
      : '문마다 규칙이 다시 뽑혀요 — 다음 판은 다른 침묵이 열립니다';
    return (
      <div className="gk-root sr-root">
        <GameMusic gameId="silent-rule" />
        <GameKitStyles />
        {atmos}
        <style dangerouslySetInnerHTML={{ __html: SR_CSS }} />
        <Hud muted={sfx.muted} onToggleMute={() => sfx.setMuted((m) => !m)} onExit={handleExit} score={score} />
        <GameDone
          mark="silent-rule"
          lead={allClean ? '침묵을 끝까지 읽어냈어요' : '규칙이 보이기 시작했어요'}
          badge={badge}
          stats={[
            { num: score, label: '점수', accent: true },
            { num: gatesDone, label: '지난 문' },
            { num: cleanGates, label: '완봉' },
            { num: sealsWon, label: '봉인' },
          ]}
          best={{ prev: bestRes?.prev ?? null, now: score, label: '점수', improved: bestRes?.improved }}
          reveal={
            (missed.length > 0 || pendingRule) ? (
              <div className="sr-recap">
                {pendingRule && <p className="sr-recap-rule">마지막 문의 규칙 — {pendingRule}</p>}
                {missed.length > 0 && (
                  <>
                    <p className="sr-recap-h">놓친 철자</p>
                    <div className="sr-recap-list">
                      {missed.slice(-8).map((m) => (
                        <span key={`${m.wrong}-${m.fix}`} className="sr-fix">
                          <s>{m.wrong}</s> → <b>{m.fix}</b>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : undefined
          }
          footer={
            mineUsed > 0 ? (
              <span className="sr-foot-chip">내 단어 {mineUsed}개가 이번 판에 나왔어요</span>
            ) : (
              // v07.10 반증 #5 — 파생 0쌍이면 격자가 전부 내장 뱅크다. 그 사실을 숨기면
              // 학습자는 '내 단어로 플레이했다'고 오인한다. 침묵하지 않는다.
              <span className="sr-foot-chip" data-tone="plain">
                이번 판은 내장 규칙 뱅크로 열렸어요 — 내 단어에서 굴절 규칙이 파생되지 않았습니다
              </span>
            )
          }
          restartLabel="다시 귀납"
          restartHint={hint}
          onRestart={restart}
          onExit={handleExit}
        />
      </div>
    );
  }

  return (
    <div className="gk-root sr-root">
      <GameMusic gameId="silent-rule" />
      <div className="gk-sr" aria-live="polite">{liveMsg}</div>
      <GameKitStyles />
      {atmos}
      <style dangerouslySetInnerHTML={{ __html: SR_CSS }} />
      <Hud
        score={score}
        combo={combo.combo}
        comboMult={combo.mult}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={
          <div className="sr-hud">
            <TimerBar frac={clock.frac} warning={clock.warning} seconds={clock.remainSec} label="남은 시간" />
            <span className="sr-hud-gate">문 {gate.index + 1}/{totalGates}</span>
          </div>
        }
      />

      {phase === 'gate' && (
        <main className="gk-stage sr-stage">
          {gate.index === 0 ? (
            <div className="sr-brief">
              <p className="sr-brief-t">
                문마다 <b>말해주지 않는 철자 규칙</b>이 하나 있습니다. 증거를 보고 <b>철자가 옳은 칸만</b> 밝히세요.
              </p>
              <p className="sr-brief-s">
                제출은 한 번 · 힌트 없음 · 완봉하면 시간이 늘고 두 칸 이상 어긋나면 줄어듭니다.
                {started ? '' : ' 첫 칸을 밝히면 시계가 시작됩니다.'}
              </p>
              <p className="sr-brief-s">
                뒤로 갈수록 <b>규칙의 예외</b>가 한두 칸 섞입니다 — 끝 글자만 맞춰서는 넘지 못해요.
              </p>
              {/* 내 단어에서 규칙이 파생되지 않으면 그 사실을 말한다 — 조용히 내장 콘텐츠로
                  도는 것이 이 프로젝트가 '가짜 연계'라 부르는 결함이다. `data-scope` 는 그
                  고지를 기계도 읽게 한다(문구 정규식은 표현이 바뀌면 조용히 어긋난다). */}
              {run.deck.mineCount === 0 && (
                <p className="sr-brief-note" data-scope="builtin">
                  이번 판은 <b>내장 규칙 뱅크</b>로 열립니다 — 내 단어에서 굴절 규칙이 파생되지 않았어요.
                </p>
              )}
            </div>
          ) : (
            <p className="sr-instr">철자가 <b>옳은 칸만</b> 밝히세요. <span className="sr-instr-dim">제출은 한 번뿐입니다.</span></p>
          )}

          {/* 증거는 격자와 같은 화면에 둔다 — 이 게임이 재는 것은 규칙 귀납이지 증거 암기가 아니다.
              다만 '어긋난 예시 → 옳은 철자' 화살표는 변환 자체를 통째로 넘겨주는 정보라
              연습 구간(문 1·2)에서만 붙인다(gate.evidence.showFix). */}
          <div className="sr-ev">
            <div className="sr-ev-row" data-kind="ok">
              <span className="sr-ev-tag"><FeedbackIcon kind="correct" size={12} /> 옳다</span>
              <span className="sr-ev-words">
                {gate.evidence.ok.map((t) => <span key={t} className="sr-ev-word">{t}</span>)}
              </span>
            </div>
            <div className="sr-ev-row" data-kind="bad">
              <span className="sr-ev-tag"><FeedbackIcon kind="wrong" size={12} /> 어긋난다</span>
              <span className="sr-ev-words">
                {gate.evidence.bad.map((b) => (
                  <span key={b.text} className="sr-ev-word sr-ev-word--bad">
                    <s>{b.text}</s>
                    {gate.evidence.showFix && (
                      <>
                        <span className="sr-ev-arrow" aria-hidden="true">→</span>
                        <b>{b.fix}</b>
                      </>
                    )}
                  </span>
                ))}
              </span>
            </div>
          </div>

          <TileGrid tiles={gate.tiles} cols={gate.cols} sel={sel} mode="judge" shake={shake} glow={glow} onToggle={toggle} />
          <div className="sr-actions">
            <span className="sr-count">{sel.size}칸 선택</span>
            <button type="button" className="gk-btn gk-btn--primary sr-check" onClick={submitJudge} disabled={sel.size === 0}>
              판정 확정
            </button>
            <span className="sr-keys">
              <Kbd>1</Kbd>–<Kbd>9</Kbd>{gate.tiles.length >= 10 && <>·<Kbd>0</Kbd></>} 토글 · <Kbd>Enter</Kbd> 제출
            </span>
          </div>
        </main>
      )}

      {phase === 'verdict' && verdict && (
        <main className="gk-stage sr-stage">
          <div className="sr-verdict-head" data-kind={verdict.kind}>
            {verdict.kind === 'clean' && <span className="sr-burst" aria-hidden="true"><ParticleBurst intensity={2} colors={['var(--success)', 'var(--combo)']} /></span>}
            <FeedbackIcon kind={verdict.kind === 'clean' ? 'correct' : verdict.kind === 'near' ? 'near' : 'wrong'} size={18} />
            <span className="sr-verdict-t">
              {verdict.kind === 'clean' ? '완봉 — 한 칸도 어긋나지 않았어요'
                : verdict.kind === 'near' ? '한 칸만 어긋났어요 — 시간은 지켰습니다'
                  : `${verdict.wrongCount}칸이 어긋났어요`}
            </span>
            <span className="sr-verdict-num">
              +{verdict.points}점
              {verdict.kind === 'clean' && <em className="sr-verdict-time" data-dir="up">+{cleanBonusMs(gateProg) / 1000}초</em>}
              {verdict.kind === 'off' && <em className="sr-verdict-time" data-dir="down">−{MISS_MS / 1000}초</em>}
            </span>
          </div>
          <TileGrid tiles={gate.tiles} cols={gate.cols} sel={sel} mode="verdict" shake={shake} glow={glow} onToggle={toggle} />
          {gate.exceptionNote && <p className="sr-ex-note">{gate.exceptionNote}</p>}
          <div className="sr-choice">
            <button type="button" className="gk-btn sr-choice-btn" onClick={skipSeal}>
              <span className="sr-choice-t">넘어간다</span>
              <span className="sr-choice-s">{verdict.points}점을 그대로 챙깁니다</span>
            </button>
            {sealOffered && gate.seal && (
              <button type="button" className="gk-btn gk-btn--primary sr-choice-btn" onClick={startSeal}>
                <span className="sr-choice-t">봉인한다 · 문 {gate.seal.fromGate + 1}의 규칙</span>
                <span className="sr-choice-s">
                  성공 +{Math.round(verdict.points * SEAL_WIN_RATIO)}점 +{SEAL_WIN_MS / 1000}초 ·
                  {' '}실패 −{verdict.points}점 −{SEAL_LOSE_MS / 1000}초{combo.combo > 0 ? ' · 연속 끊김' : ''}
                </span>
              </button>
            )}
          </div>
          <p className="sr-instr-dim">
            판정 화면에서는 시계가 1/3 속도로 흐릅니다.
            {gate.seal && !sealOffered ? ' 두 칸 이상 어긋난 문에서는 봉인을 걸 수 없어요.' : ''}
          </p>
        </main>
      )}

      {phase === 'seal' && gate.seal && (
        <main className="gk-stage sr-stage">
          <p className="sr-eyebrow">문 {gate.index + 1} · 봉인</p>
          <p className="sr-instr">
            <b>문 {gate.seal.fromGate + 1}에서 열린 규칙</b>으로 아래 철자를 고쳐 쓰세요.
            <span className="sr-instr-dim"> 그 규칙은 지금 화면에 없습니다.</span>
          </p>
          <div className="sr-seal-word">
            <s>{gate.seal.prompt}</s>
            {gate.seal.src?.ko && <span className="sr-seal-ko">{gate.seal.src.ko}</span>}
          </div>
          <form
            className="sr-seal-form"
            onSubmit={(e) => { e.preventDefault(); submitSeal(); }}
          >
            <label className="sr-seal-label" htmlFor="sr-seal-input">옳은 철자</label>
            <input
              id="sr-seal-input"
              ref={sealRef}
              className="sr-seal-input"
              type="text"
              value={sealInput}
              onChange={(e) => setSealInput(e.target.value.replace(/[^a-zA-Z]/g, '').toLowerCase())}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="text"
              maxLength={20}
              placeholder="철자를 입력"
            />
            <button type="submit" className="gk-btn gk-btn--primary sr-seal-go" disabled={sealInput.trim().length < 3}>
              봉인
            </button>
          </form>
          <p className="sr-instr-dim">시계는 흐르고 있습니다. 확신이 없으면 되돌릴 수 없습니다.</p>
        </main>
      )}

      {phase === 'reveal' && (
        <main className="gk-stage sr-reveal">
          <div className="sr-reveal-mark" aria-hidden="true"><GameMark id="silent-rule" /></div>
          <p className="sr-reveal-lead">이 문의 규칙</p>
          <h2 className="sr-rule">{gate.rule.statement}</h2>
          <p className="sr-hint">{gate.rule.hint}</p>
          {sealResult && sealResult !== 'skipped' && gate.seal && (
            <p className="sr-seal-out" data-won={sealResult === 'won' ? '1' : '0'}>
              <FeedbackIcon kind={sealResult === 'won' ? 'correct' : 'wrong'} size={14} />
              {sealResult === 'won'
                ? `봉인 성공 — ${gate.seal.answer}`
                : `봉인 실패 — ${gate.seal.prompt} 의 옳은 철자는 ${gate.seal.answer}`}
            </p>
          )}
          {gate.exceptionNote && <p className="sr-ex-note">{gate.exceptionNote}</p>}
          <div className="sr-fixes">
            {badTiles.map((t) => (
              <span key={t.text} className="sr-fix">
                <s>{t.text}</s> → <b>{t.fix}</b>
                {t.outside && (
                  <em className="sr-fix-note">
                    {t.outside.kind === 'exception' ? '예외' : '다른 규칙'}
                  </em>
                )}
              </span>
            ))}
          </div>
          <button type="button" className="gk-btn gk-btn--primary sr-go" onClick={nextGate}>
            {gate.index + 1 < totalGates ? '다음 문 →' : '침묵을 끝내다'}
          </button>
        </main>
      )}
    </div>
  );
}

const SR_CSS = `
  .sr-hud { display: flex; align-items: center; gap: 10px; }
  .sr-hud-gate { font-family: var(--font-display, system-ui); font-size: 12px; font-weight: 800; color: var(--t2); white-space: nowrap; font-variant-numeric: tabular-nums; }
  @media (max-width: 520px) { .sr-hud-gate { display: none; } }

  /* 8칸 격자 + 증거 스트립이 낮은 뷰포트를 넘길 수 있다 — 스테이지 안에서만 스크롤시킨다. */
  .sr-stage, .sr-reveal { overflow-y: auto; overscroll-behavior: contain; }
  .sr-stage { gap: clamp(14px, 3vh, 30px); }
  .sr-eyebrow { margin: 0; font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--t3); }
  .sr-instr { margin: 0; font-size: 14px; color: var(--t2); text-align: center; max-width: 44ch; }
  .sr-instr b { color: var(--t1); }
  .sr-instr-dim { margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13px; color: var(--t3); text-align: center; }
  .sr-keys { margin: 0; font-size: 11px; color: var(--t3); display: flex; align-items: center; gap: 4px; }
  @media (max-width: 620px) { .sr-keys { display: none; } }

  /* ── 첫 문 안내 (30초 안에 읽히는 두 줄) ── */
  .sr-brief { display: flex; flex-direction: column; gap: 5px; max-width: min(52ch, 94vw); text-align: center; }
  .sr-brief-t { margin: 0; font-size: 14.5px; line-height: 1.55; color: var(--t2); }
  .sr-brief-t b { color: var(--t1); }
  .sr-brief-s { margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 12.5px; color: var(--t3); }
  .sr-brief-s b { font-style: normal; color: var(--t2); }
  .sr-brief-note { margin: 2px 0 0; font-size: 12px; font-weight: 700; color: var(--warning); }
  .sr-brief-note b { color: var(--warning); }
  .sr-go { min-width: 168px; }

  /* 예외 안내 — 판정·리빌에서만. 제출 전에는 절대 뜨지 않는다. */
  .sr-ex-note { margin: 0; max-width: min(56ch, 94vw); text-align: center; font-size: 12.5px; font-weight: 700; color: var(--warning); }
  .sr-panel-ex { font-family: var(--font-display, system-ui); font-size: 9.5px; font-weight: 800; letter-spacing: .04em; color: var(--warning); border: 1px solid color-mix(in srgb, var(--warning) 45%, transparent); border-radius: 999px; padding: 0 5px; }

  /* ── 증거 (격자와 같은 화면 · 두 줄) ── */
  .sr-ev { display: flex; flex-direction: column; gap: 6px; width: min(680px, 94vw); padding: 10px 14px; border-radius: var(--r-lg, 14px); border: 1.5px solid var(--bd); background: color-mix(in srgb, var(--bg) 70%, transparent); }
  .sr-ev-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
  .sr-ev-tag { display: inline-flex; align-items: center; gap: 4px; flex: none; min-width: 62px; font-family: var(--font-display, system-ui); font-size: 10.5px; font-weight: 800; letter-spacing: .04em; }
  .sr-ev-row[data-kind="ok"] .sr-ev-tag { color: var(--success); }
  .sr-ev-row[data-kind="bad"] .sr-ev-tag { color: var(--error); }
  .sr-ev-words { display: flex; flex-wrap: wrap; gap: 3px 12px; }
  .sr-ev-word { font-family: var(--font-english, system-ui); font-size: clamp(12.5px, 2.4vw, 15px); font-weight: 700; color: var(--t1); overflow-wrap: normal; word-break: normal; hyphens: none; }
  .sr-ev-word--bad { font-weight: 600; }
  .sr-ev-word--bad s { color: var(--error); opacity: .85; text-decoration-thickness: 2px; }
  .sr-ev-word--bad b { color: var(--success); }
  .sr-ev-arrow { color: var(--t3); margin: 0 3px; }

  /* ── 격자 ── */
  .sr-grid { display: grid; grid-template-columns: repeat(var(--sr-cols, 3), minmax(0, 1fr)); gap: clamp(8px, 1.6vw, 14px); width: min(680px, 94vw); }
  @media (max-width: 620px) { .sr-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: 380px; } }
  .sr-grid--shake { animation: gk-shake .46s ease-in-out; }
  .sr-grid--glow .sr-panel[data-on="1"] { box-shadow: 0 0 0 2px var(--success), 0 0 26px -2px color-mix(in srgb, var(--success) 55%, transparent); }

  .sr-panel { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; min-height: 86px; padding: 12px 8px; border-radius: 14px; border: 2px solid var(--bd); background: color-mix(in srgb, var(--bg) 82%, transparent); cursor: pointer; transition: transform .14s var(--ease-spring, ease-out), border-color .18s, box-shadow .18s, background .18s; }
  .sr-panel-top { display: flex; align-items: center; gap: 6px; }
  .sr-panel-num { font-size: 10px; font-weight: 800; color: var(--t3); font-variant-numeric: tabular-nums; }
  @media (max-width: 620px) { .sr-panel-num { display: none; } }
  .sr-panel-node { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--t3); background: transparent; transition: background .18s, border-color .18s, box-shadow .18s; }
  /* 철자 규칙 게임이므로 단어를 절대 중간에서 끊지 않는다(beautif/ull 은 문제 자체를 훼손).
     대신 글자 수에 따라 크기를 낮춰 칸 안에 들어오게 한다. */
  .sr-panel-word { font-family: var(--font-english, system-ui); font-size: clamp(12.5px, 2.5vw, 17px); font-weight: 700; color: var(--t1); text-align: center; overflow-wrap: normal; word-break: normal; hyphens: none; line-height: 1.25; max-width: 100%; }
  .sr-panel-word[data-len="long"] { font-size: clamp(11px, 2.1vw, 14.5px); letter-spacing: -.01em; }
  .sr-panel-word[data-len="xlong"] { font-size: clamp(10px, 1.9vw, 12.5px); letter-spacing: -.015em; }
  .sr-panel-word--bad { text-decoration: line-through; text-decoration-thickness: 2px; text-decoration-color: color-mix(in srgb, var(--error) 80%, transparent); }
  .sr-panel-mark { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 800; letter-spacing: .02em; }
  .sr-panel-mark-t { white-space: nowrap; }

  .sr-panel:hover { transform: translateY(-3px); border-color: var(--success); }
  .sr-panel:active { transform: translateY(0) scale(.96); }
  .sr-panel:focus-visible { outline: none; border-color: var(--success); box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 30%, transparent); }
  .sr-panel[data-on="1"] { border-color: var(--success); background: color-mix(in srgb, var(--success) 14%, var(--bg)); box-shadow: 0 8px 22px -8px color-mix(in srgb, var(--success) 40%, transparent); }
  .sr-panel[data-on="1"] .sr-panel-node { background: var(--success); border-color: var(--success); box-shadow: 0 0 12px 1px color-mix(in srgb, var(--success) 60%, transparent); }
  .sr-panel[aria-disabled="true"] { pointer-events: none; }
  .sr-panel[data-state="hit"] { border-color: var(--success); background: color-mix(in srgb, var(--success) 16%, var(--bg)); color: var(--success); }
  .sr-panel[data-state="kept"] { border-color: color-mix(in srgb, var(--success) 45%, var(--bd)); background: color-mix(in srgb, var(--bg) 86%, transparent); color: var(--success); }
  .sr-panel[data-state="missed"], .sr-panel[data-state="lured"] { border-color: var(--error); background: color-mix(in srgb, var(--error) 12%, var(--bg)); color: var(--error); }
  .sr-panel[data-state="hit"] .sr-panel-mark, .sr-panel[data-state="kept"] .sr-panel-mark { color: var(--success); }
  .sr-panel[data-state="missed"] .sr-panel-mark, .sr-panel[data-state="lured"] .sr-panel-mark { color: var(--error); }
  .sr-panel[data-state="kept"] .sr-panel-node, .sr-panel[data-state="lured"] .sr-panel-node { opacity: .45; }

  .sr-actions { display: flex; flex-direction: column; align-items: center; gap: 9px; }
  .sr-count { font-size: 12px; font-weight: 700; color: var(--t3); font-variant-numeric: tabular-nums; }
  .sr-check { min-width: 160px; }

  /* ── 판정 결과 ── */
  .sr-verdict-head { position: relative; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px 12px; max-width: min(560px, 94vw); text-align: center; }
  .sr-burst { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
  .sr-verdict-t { font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: clamp(15px, 3.4vw, 19px); font-weight: 600; color: var(--t1); }
  .sr-verdict-head[data-kind="clean"] { color: var(--success); }
  .sr-verdict-head[data-kind="near"] { color: var(--warning); }
  .sr-verdict-head[data-kind="off"] { color: var(--error); }
  .sr-verdict-num { display: inline-flex; align-items: baseline; gap: 8px; font-size: 14px; font-weight: 800; color: var(--combo); font-variant-numeric: tabular-nums; }
  .sr-verdict-time { font-style: normal; font-size: 12.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; }
  .sr-verdict-time[data-dir="up"] { color: var(--success); background: color-mix(in srgb, var(--success) 14%, transparent); }
  .sr-verdict-time[data-dir="down"] { color: var(--error); background: color-mix(in srgb, var(--error) 14%, transparent); }

  .sr-choice { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
  .sr-choice-btn { display: flex; flex-direction: column; align-items: center; gap: 3px; min-height: 62px; padding: 10px 20px; line-height: 1.3; }
  .sr-choice-t { font-size: 14.5px; font-weight: 800; }
  .sr-choice-s { font-size: 11.5px; font-weight: 600; opacity: .82; }

  /* ── 봉인 ── */
  .sr-seal-word { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .sr-seal-word s { font-family: var(--font-english, system-ui); font-size: clamp(24px, 6vw, 38px); font-weight: 800; color: var(--error); text-decoration-thickness: 3px; overflow-wrap: normal; hyphens: none; }
  .sr-seal-ko { font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 14px; color: var(--t2); }
  .sr-seal-form { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px; }
  .sr-seal-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .sr-seal-input { min-height: 52px; width: min(280px, 74vw); padding: 0 16px; border-radius: var(--r-md, 10px); border: 2px solid var(--bd); background: color-mix(in srgb, var(--bg) 88%, transparent); color: var(--t1); font-family: var(--font-english, system-ui); font-size: 19px; font-weight: 700; letter-spacing: .01em; transition: border-color .16s, box-shadow .16s; }
  .sr-seal-input::placeholder { color: var(--t4, var(--t3)); font-weight: 500; font-size: 15px; }
  .sr-seal-input:hover { border-color: var(--t3); }
  .sr-seal-input:focus-visible, .sr-seal-input:focus { outline: none; border-color: var(--success); box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 26%, transparent); }
  .sr-seal-go { min-width: 120px; }
  .sr-seal-out { display: inline-flex; align-items: center; gap: 7px; margin: 0; font-size: 13.5px; font-weight: 700; }
  .sr-seal-out[data-won="1"] { color: var(--success); }
  .sr-seal-out[data-won="0"] { color: var(--error); }

  /* ── 리빌 ── */
  .sr-reveal { gap: 12px; text-align: center; }
  .sr-reveal-mark { position: relative; width: 56px; height: 56px; color: var(--success); display: grid; place-items: center; }
  .sr-reveal-mark svg { width: 42px; height: 42px; }
  .sr-reveal-lead { margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 15px; color: var(--t2); }
  .sr-rule { margin: 0; font-family: var(--font-english, system-ui); font-size: clamp(19px, 4vw, 27px); font-weight: 800; color: var(--t1); max-width: 22ch; }
  .sr-hint { margin: 0; font-size: 13.5px; color: var(--t2); }
  .sr-fixes { display: flex; flex-wrap: wrap; gap: 8px 16px; justify-content: center; max-width: min(62ch, 94vw); margin: 4px 0; }
  .sr-fix { font-family: var(--font-english, system-ui); font-size: 13px; color: var(--t3); }
  .sr-fix s { color: var(--error); opacity: .85; }
  .sr-fix b { color: var(--success); }
  .sr-fix-note { margin-left: 5px; font-family: var(--font-display, system-ui); font-style: normal; font-size: 10px; font-weight: 800; color: var(--warning); border: 1px solid color-mix(in srgb, var(--warning) 45%, transparent); border-radius: 999px; padding: 1px 6px; }

  /* ── 결과 ── */
  .sr-recap { display: flex; flex-direction: column; gap: 8px; text-align: left; }
  .sr-recap-rule { margin: 0; font-size: 13px; font-weight: 700; color: var(--t2); }
  .sr-recap-h { margin: 0; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--t3); }
  .sr-recap-list { display: flex; flex-wrap: wrap; gap: 6px 14px; }
  .sr-foot-chip { display: inline-block; max-width: min(46ch, 92vw); padding: 5px 12px; border-radius: 999px; border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 70%, transparent); font-size: 12px; font-weight: 700; color: var(--t2); line-height: 1.45; }
  .sr-foot-chip[data-tone="plain"] { border-radius: 12px; color: var(--t3); font-weight: 600; }

  @media (prefers-reduced-motion: reduce) {
    .sr-grid--shake { animation: none; }
    .sr-panel { transition: none; }
  }
`;
