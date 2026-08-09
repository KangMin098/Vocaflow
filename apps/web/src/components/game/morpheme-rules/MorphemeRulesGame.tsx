// apps/web/src/components/game/morpheme-rules/MorphemeRulesGame.tsx
// Morpheme Rules (형태소가 곧 의미) — 봉인된 회랑을 형태소 조립으로 뚫는 연역 아케이드.
//
// v07.9 전면 재설계. 이전 버전의 세 가지 구조적 결함을 걷어냈다.
//   1) 조립대가 발동 전에 '✓ 실재 / ✗ 없는 단어 + 한국어 뜻'을 공짜로 인쇄했다.
//      → 판정은 오직 '발동' 이후에만 일어난다. 조립대는 학습자가 입력한 철자만 비춘다.
//      블록의 한국어 뜻도 기본 비노출 — 한국어끼리 짝짓는 우회로를 막는다(인출 보호).
//   2) 9문제가 모듈 상수라 두 번째 판의 정보량이 0이었다.
//      → 접두사 8 × 어근 28 격자에서 시드로 4회랑을 절차 생성한다(morpheme-bank).
//   3) 타이머·점수·콤보·실패가 전부 없어 판돈이 0이었다.
//      → 봉인 시계(useCountdown) + 콤보 배수(useCombo) + '확신 발동' 트레이드오프.
//
// 인출 규칙 준수 요약
//   · 제출(발동) 전 화면에는 정답을 특정할 정보가 없다 — 장면은 상황 서술이고,
//     형태소 뜻은 비용을 치른 '해독' 후에만 보인다.
//   · 해독한 블록으로 얻은 정답은 onCorrect 로 올리지 않는다(힌트로 산 정답 금지).
//   · 무위험 탐색 오라클 없음 — 모든 시도가 시간과 콤보를 실제로 태운다.
//   · 정답 공개는 발동 후, 그리고 시간이 끝난 뒤 결과 화면에서 충분히.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  GameKitStyles,
  AmbientBackground,
  Hud,
  GameDone,
  GameMusic,
  ParticleBurst,
  FeedbackIcon,
  TimerBar,
  LifePips,
  Kbd,
  useSfx,
  useCountdown,
  useCombo,
  usePersonalBest,
  DEFAULT_COMBO_TIERS,
  type Word,
} from '@/components/game/_shared/gamekit';

import {
  makeSession,
  findOwnWord,
  SPELL_BY_KEY,
  TOTAL_SEALS,
  ROOT_KEYS,
  type Corridor,
  type Prefix,
  type Root,
  type Spell,
} from './morpheme-bank';

interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word) => void;
  onWrong?: (w: Word) => void;
}

/** 세션 총 제한 시간. 정답 가산은 킷이 총량의 75% 로 자동 상한 → 최장 ≈ 3분 50초. */
const TOTAL_MS = 130_000;
const WARN_MS = 15_000;
/** 확신 발동 — 성공 시 점수 ×2 와 추가 시간, 실패 시 추가 시간 손실. */
const CONVICTION_BONUS_MS = 4_000;
const CONVICTION_PENALTY_MS = 8_000;
const DECODE_COST_MS = 4_000;
const DECODE_TOKENS = 3;
const CORRIDOR_CLEAR_MS = 5_000;
const CORRIDOR_CLEAR_SCORE = 200;

type FlashKind = 'correct' | 'near' | 'wrong' | 'info';
interface Flash {
  kind: FlashKind;
  main: string;
  sub?: string;
  /** 학습자 단어장 연결 한 줄(있을 때만). */
  own?: string;
}

type LedgerKind = 'solved' | 'real' | 'dead';
interface LedgerEntry {
  key: string;
  word: string;
  ko: string;
  kind: LedgerKind;
}

function multFor(combo: number): number {
  let m = 1;
  for (const t of DEFAULT_COMBO_TIERS) if (combo >= t.at) m = t.mult;
  return m;
}

function fmtMult(m: number) {
  return m % 1 === 0 ? `×${m}` : `×${m.toFixed(1)}`;
}

export function MorphemeRulesGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();
  const { correct: sfxCorrect, wrong: sfxWrong, nearMiss, click, coin, fanfare, tone, muted, setMuted } = sfx;

  // ── 세션 구성 ───────────────────────────────────────────────────────────
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const [runNo, setRunNo] = useState(0);

  // 학습자 단어장에 실제로 등장하는 어근을 회랑 생성에 가중치로 준다(Context-Dependent).
  const biasRoots = useMemo(() => {
    const s = new Set<string>();
    for (const w of wordPool ?? []) {
      const en = w.en.toLowerCase();
      for (const r of ROOT_KEYS) if (en.includes(r)) s.add(r);
    }
    return s;
  }, [wordPool]);

  const corridors = useMemo<Corridor[]>(() => makeSession(seed, biasRoots), [seed, biasRoots]);

  // ── 진행 상태 ───────────────────────────────────────────────────────────
  const [ci, setCi] = useState(0);
  const corridor = corridors[Math.min(ci, corridors.length - 1)];

  const [broken, setBroken] = useState<string[]>([]);
  const [focusId, setFocusId] = useState<string>(() => corridors[0].seals[0].id);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [pre, setPre] = useState<Prefix | null>(null);
  const [root, setRoot] = useState<Root | null>(null);
  const [decoded, setDecoded] = useState<Set<string>>(() => new Set());
  const [tokens, setTokens] = useState(DECODE_TOKENS);
  const [arming, setArming] = useState(false);
  const [interlude, setInterlude] = useState(false);

  const [score, setScore] = useState(0);
  const [built, setBuilt] = useState(0);
  const [convictions, setConvictions] = useState(0);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [flashSeq, setFlashSeq] = useState(0);
  const [shakeSeq, setShakeSeq] = useState(0);
  const [burstSeq, setBurstSeq] = useState(0);
  const [live, setLive] = useState('');
  const [phase, setPhase] = useState<'play' | 'done'>('play');
  const [endReason, setEndReason] = useState<'clear' | 'timeout'>('timeout');
  const [pb, setPb] = useState<{ prev: number | null; improved: boolean }>({ prev: null, improved: false });

  // ── refs (콜백이 최신 값을 보도록) ──────────────────────────────────────
  const mountedRef = useRef(true);
  const phaseRef = useRef<'play' | 'done'>('play');
  const interludeRef = useRef(false);
  const scoreRef = useRef(0);
  const remainRef = useRef(TOTAL_MS);
  const recordedRef = useRef<Set<string>>(new Set());
  const tierUpRef = useRef<string | null>(null);
  const finishRef = useRef<(reason: 'clear' | 'timeout') => void>(() => {});
  const advanceTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      mountedRef.current = false;
      if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    },
    [],
  );

  // ── 시계 · 콤보 · 개인 기록 ────────────────────────────────────────────
  const time = useCountdown({
    totalMs: TOTAL_MS,
    running: phase === 'play',
    warnAtMs: WARN_MS,
    onWarn: () => {
      tone(208, 0.34, 'sine', 0.045);
      tone(156, 0.42, 'sine', 0.04, 0.18);
    },
    onEnd: () => finishRef.current('timeout'),
  });
  remainRef.current = time.remainMs;
  const timeRef = useRef(time);
  timeRef.current = time;

  const combo = useCombo({
    onTierUp: (tier) => {
      tierUpRef.current = tier.label ?? null;
    },
    onBreak: () => {
      timeRef.current.drain(3000);
    },
  });
  const comboRef = useRef(combo);
  comboRef.current = combo;

  const { submit: pbSubmit } = usePersonalBest('morpheme-rules', true);
  const pbSubmitRef = useRef(pbSubmit);
  pbSubmitRef.current = pbSubmit;

  // ── 판 초기화 (새 세트 / 같은 세트 다시 / 최초 마운트 공통) ─────────────
  useEffect(() => {
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = null;
    setCi(0);
    setBroken([]);
    setFocusId(corridors[0].seals[0].id);
    setLedger([]);
    setPre(null);
    setRoot(null);
    setDecoded(new Set());
    setTokens(DECODE_TOKENS);
    setArming(false);
    setInterlude(false);
    setScore(0);
    setBuilt(0);
    setConvictions(0);
    setFlash(null);
    setLive('');
    setEndReason('timeout');
    setPb({ prev: null, improved: false });
    setPhase('play');
    scoreRef.current = 0;
    phaseRef.current = 'play';
    interludeRef.current = false;
    recordedRef.current = new Set();
    tierUpRef.current = null;
    comboRef.current.reset();
    timeRef.current.reset(TOTAL_MS);
  }, [corridors, runNo]);

  const addScore = useCallback((n: number) => {
    scoreRef.current += n;
    setScore(scoreRef.current);
  }, []);

  const pushFlash = useCallback((f: Flash) => {
    setFlash(f);
    setFlashSeq((n) => n + 1);
    setLive([f.main, f.sub, f.own].filter(Boolean).join(' · '));
  }, []);

  // ── 종료 ────────────────────────────────────────────────────────────────
  const finish = useCallback(
    (reason: 'clear' | 'timeout') => {
      if (phaseRef.current !== 'play') return;
      phaseRef.current = 'done';
      const bonus = reason === 'clear' ? Math.max(0, Math.ceil(remainRef.current / 1000)) * 6 : 0;
      const finalScore = scoreRef.current + bonus;
      scoreRef.current = finalScore;
      setScore(finalScore);
      setPb(pbSubmitRef.current(finalScore));
      setEndReason(reason);
      setPhase('done');
      if (reason === 'clear') fanfare();
      else {
        // 시간 종료는 '실패 효과음'으로 때리지 않는다 — 내려앉는 두 음(비난 없는 마무리).
        tone(262, 0.3, 'sine', 0.045);
        tone(175, 0.5, 'sine', 0.04, 0.2);
      }
    },
    [fanfare, tone],
  );
  finishRef.current = finish;

  // ── 회랑 전환 ───────────────────────────────────────────────────────────
  const enterCorridor = useCallback(
    (next: number) => {
      setCi(next);
      setBroken([]);
      setLedger([]);
      setPre(null);
      setRoot(null);
      setArming(false);
      setFocusId(corridors[next].seals[0].id);
    },
    [corridors],
  );

  // ── 발동 ────────────────────────────────────────────────────────────────
  const cast = useCallback(
    (conviction: boolean) => {
      if (phaseRef.current !== 'play' || interludeRef.current) return;
      if (arming) {
        setArming(false);
        return;
      }
      if (!pre || !root) {
        pushFlash({ kind: 'info', main: '접두사와 어근을 모두 놓아야 발동할 수 있어요' });
        return;
      }
      const seal =
        corridor.seals.find((s) => s.id === focusId && !broken.includes(s.id)) ??
        corridor.seals.find((s) => !broken.includes(s.id));
      if (!seal) return;

      const key = `${pre.text}+${root.text}`;
      const wordText = pre.text + root.text;
      const spell: Spell | undefined = SPELL_BY_KEY[key];
      const assisted = decoded.has(`p:${pre.text}`) || decoded.has(`r:${root.text}`);
      const firstTry = !recordedRef.current.has(seal.id);

      const addLedger = (entry: LedgerEntry) =>
        setLedger((l) => (l.some((e) => e.key === entry.key) ? l.map((e) => (e.key === entry.key ? entry : e)) : [...l, entry]));

      // ① 실재하지 않는 조합 ------------------------------------------------
      if (!spell) {
        const lost = combo.miss();
        sfxWrong();
        const pen = corridor.penaltyMs + (conviction ? CONVICTION_PENALTY_MS : 0);
        time.drain(pen);
        addLedger({ key, word: wordText, ko: '', kind: 'dead' });
        if (firstTry) {
          recordedRef.current.add(seal.id);
          onWrong?.({ en: seal.spell.word, ko: seal.spell.ko });
        }
        setShakeSeq((n) => n + 1);
        pushFlash({
          kind: 'wrong',
          main: `'${wordText}' 은 쓰이지 않는 말이에요`,
          sub: `${pre.rule} — ${root.text} 에는 그럴 자리가 없어요. −${Math.round(pen / 1000)}초${
            lost >= 2 ? ` · 콤보 ${lost} 끊김 −3초` : ''
          }`,
        });
        return;
      }

      // ② 실재하지만 이 봉인이 기다리는 뜻이 아님 ----------------------------
      if (spell.word !== seal.spell.word) {
        const lost = combo.miss();
        nearMiss();
        const pen = Math.max(2000, corridor.penaltyMs - 2000) + (conviction ? CONVICTION_PENALTY_MS : 0);
        time.drain(pen);
        addLedger({ key, word: spell.word, ko: spell.ko, kind: 'real' });
        if (firstTry) {
          recordedRef.current.add(seal.id);
          onWrong?.({ en: seal.spell.word, ko: seal.spell.ko });
        }
        setShakeSeq((n) => n + 1);
        pushFlash({
          kind: 'near',
          main: `'${spell.word}' 는 실제로 있는 말이에요 — ${spell.ko}`,
          sub: `다만 이 봉인이 기다리는 뜻은 아니에요. −${Math.round(pen / 1000)}초${
            lost >= 2 ? ` · 콤보 ${lost} 끊김 −3초` : ''
          }`,
        });
        return;
      }

      // ③ 정답 --------------------------------------------------------------
      const c = combo.hit();
      const tierLabel = tierUpRef.current;
      tierUpRef.current = null;
      sfxCorrect(c, !!tierLabel);

      const mult = multFor(c);
      const base = 100 + corridor.index * 20;
      const gain = Math.round(base * mult * (conviction ? 2 : 1) * (assisted ? 0.5 : 1));
      addScore(gain);

      const rewardMs = corridor.rewardMs + (conviction ? CONVICTION_BONUS_MS : 0);
      time.extend(rewardMs);

      if (firstTry) {
        recordedRef.current.add(seal.id);
        // 해독으로 산 정답은 FSRS 에 '알았다'로 올리지 않는다.
        if (!assisted) onCorrect?.({ en: spell.word, ko: spell.ko });
      }
      if (conviction) setConvictions((n) => n + 1);

      const own = findOwnWord(wordPool, spell.r, spell.word);
      const nextBroken = [...broken, seal.id];
      setBroken(nextBroken);
      setBuilt((b) => b + 1);
      addLedger({ key, word: spell.word, ko: spell.ko, kind: 'solved' });
      setPre(null);
      setRoot(null);
      setBurstSeq((n) => n + 1);

      pushFlash({
        kind: 'correct',
        main: `${spell.word} · ${spell.ko} — ${spell.effect}`,
        sub: [
          `+${gain}점`,
          mult > 1 ? `콤보 ${c} ${fmtMult(mult)}` : null,
          conviction ? '확신 ×2' : null,
          assisted ? '해독 사용 · 복습 기록 없음' : null,
          `+${Math.round(rewardMs / 1000)}초`,
          tierLabel ? `${tierLabel} 돌파` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        own: own ? `내 단어장 · ${own.en} — ${own.ko}` : undefined,
      });

      const remaining = corridor.seals.filter((s) => !nextBroken.includes(s.id));
      if (remaining.length > 0) {
        setFocusId(remaining[0].id);
        return;
      }

      // 회랑 클리어 — 인라인으로 잠깐 숨을 고르고 다음 회랑으로(모달 없음).
      interludeRef.current = true;
      setInterlude(true);
      addScore(CORRIDOR_CLEAR_SCORE);
      time.extend(CORRIDOR_CLEAR_MS);
      const isLast = corridor.index + 1 >= corridors.length;
      setLive((l) => `${l} · ${isLast ? '마지막 문이 열렸다' : '회랑을 통과했다'}`);
      advanceTimerRef.current = window.setTimeout(() => {
        advanceTimerRef.current = null;
        if (!mountedRef.current) return;
        interludeRef.current = false;
        setInterlude(false);
        if (isLast) finishRef.current('clear');
        else enterCorridor(corridor.index + 1);
      }, 1200);
    },
    [
      arming,
      pre,
      root,
      corridor,
      focusId,
      broken,
      decoded,
      combo,
      time,
      sfxWrong,
      sfxCorrect,
      nearMiss,
      onWrong,
      onCorrect,
      wordPool,
      addScore,
      pushFlash,
      corridors.length,
      enterCorridor,
    ],
  );

  // ── 블록 선택 / 해독 ────────────────────────────────────────────────────
  const decode = useCallback(
    (kind: 'p' | 'r', text: string) => {
      const k = `${kind}:${text}`;
      if (decoded.has(k)) {
        setArming(false);
        return;
      }
      if (tokens <= 0) return;
      setDecoded((d) => new Set(d).add(k));
      setTokens((t) => t - 1);
      time.drain(DECODE_COST_MS);
      coin();
      setArming(false);
      pushFlash({
        kind: 'info',
        main: `해독 — ${text} 의 뜻이 드러났어요`,
        sub: `−${DECODE_COST_MS / 1000}초 · 이 블록으로 만든 말은 점수 절반, 복습 기록 없음`,
      });
    },
    [decoded, tokens, time, coin, pushFlash],
  );

  const choosePrefix = useCallback(
    (p: Prefix) => {
      if (phaseRef.current !== 'play' || interludeRef.current) return;
      if (arming) {
        decode('p', p.text);
        return;
      }
      click();
      setPre((cur) => (cur?.text === p.text ? null : p));
    },
    [arming, decode, click],
  );

  const chooseRoot = useCallback(
    (r: Root) => {
      if (phaseRef.current !== 'play' || interludeRef.current) return;
      if (arming) {
        decode('r', r.text);
        return;
      }
      click();
      setRoot((cur) => (cur?.text === r.text ? null : r));
    },
    [arming, decode, click],
  );

  const focusSeal = useCallback(
    (id: string) => {
      if (phaseRef.current !== 'play' || interludeRef.current) return;
      if (broken.includes(id)) return;
      click();
      setFocusId(id);
    },
    [broken, click],
  );

  const moveFocus = useCallback(
    (dir: 1 | -1) => {
      const open = corridor.seals.filter((s) => !broken.includes(s.id));
      if (open.length < 2) return;
      const cur = Math.max(0, open.findIndex((s) => s.id === focusId));
      const next = open[(cur + dir + open.length) % open.length];
      click();
      setFocusId(next.id);
    },
    [corridor.seals, broken, focusId, click],
  );

  // ── 키보드 ──────────────────────────────────────────────────────────────
  const apiRef = useRef({ cast, choosePrefix, chooseRoot, moveFocus, corridor, setPre, setRoot, setArming, tokens, arming });
  apiRef.current = { cast, choosePrefix, chooseRoot, moveFocus, corridor, setPre, setRoot, setArming, tokens, arming };

  useEffect(() => {
    if (phase !== 'play') return;
    const onKey = (e: KeyboardEvent) => {
      const api = apiRef.current;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();

      if (e.key === 'Enter') {
        // 버튼에 포커스가 있으면 그 버튼의 기본 동작에 맡긴다(이중 발동 방지).
        if (tag === 'BUTTON' && !e.shiftKey) return;
        e.preventDefault();
        api.cast(e.shiftKey);
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        api.setPre(null);
        api.setRoot(null);
        return;
      }
      if (e.key === 'Escape' && api.arming) {
        e.preventDefault();
        api.setArming(false);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        api.moveFocus(1);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        api.moveFocus(-1);
        return;
      }
      if (k === 'h') {
        e.preventDefault();
        if (api.tokens > 0) api.setArming((v) => !v);
        return;
      }
      const pIdx = ['1', '2', '3', '4'].indexOf(e.key);
      if (pIdx >= 0 && api.corridor.prefixes[pIdx]) {
        e.preventDefault();
        api.choosePrefix(api.corridor.prefixes[pIdx]);
        return;
      }
      const rIdx = ['q', 'w', 'e', 'r'].indexOf(k);
      if (rIdx >= 0 && api.corridor.roots[rIdx]) {
        e.preventDefault();
        api.chooseRoot(api.corridor.roots[rIdx]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  // ── 파생 값 ─────────────────────────────────────────────────────────────
  const focusSealObj = corridor.seals.find((s) => s.id === focusId) ?? corridor.seals.find((s) => !broken.includes(s.id)) ?? null;
  const openSeals = corridor.seals.filter((s) => !broken.includes(s.id));
  const pendingKeys = new Set(openSeals.map((s) => `${s.spell.p}+${s.spell.r}`));
  const lastBrokenId = broken.length > 0 ? broken[broken.length - 1] : null;
  const assembled = `${pre?.text ?? ''}${root?.text ?? ''}`;
  const benchReady = !!pre && !!root;
  const canCast = benchReady && !interlude && !arming && phase === 'play';
  const assistedNow = !!pre && !!root && (decoded.has(`p:${pre.text}`) || decoded.has(`r:${root.text}`));
  const nextMult = multFor(combo.combo + 1);

  // ── 완료 화면 ───────────────────────────────────────────────────────────
  if (phase === 'done') {
    const cleared = endReason === 'clear';
    const unsolved = corridor.seals.filter((s) => !broken.includes(s.id));
    const restCorridors = corridors.length - corridor.index - (cleared ? 0 : 1);

    return (
      <div className="gk-root mr-root">
        <GameMusic gameId="morpheme-rules" />
        <div className="gk-sr" aria-live="polite">
          {live}
        </div>
        <GameKitStyles />
        <AmbientBackground center="#EAEEF3" mid="#B9C4D2" edge="#1A2330" glow="rgba(120,200,255,.26)" glowAt="50% 30%" watermark="morpheme-rules" />
        <style dangerouslySetInnerHTML={{ __html: MR_CSS }} />
        <Hud muted={muted} onToggleMute={() => setMuted((m) => !m)} onExit={() => onExit?.()} />
        <GameDone
          mark="morpheme-rules"
          celebrate={cleared}
          lead={cleared ? '회랑을 전부 지났어요' : '시간이 다 됐어요'}
          badge={
            pb.improved ? (
              <>
                <FeedbackIcon kind="correct" size={13} /> 개인 최고 갱신
              </>
            ) : cleared ? (
              <>
                <FeedbackIcon kind="correct" size={13} /> 전 회랑 통과
              </>
            ) : undefined
          }
          reveal={
            unsolved.length > 0 ? (
              <div className="mr-reveal">
                <p className="mr-reveal-head">닫힌 채 남은 봉인 — 다음 판을 위해 열어 둘게요</p>
                <ul className="mr-reveal-list">
                  {unsolved.map((s) => (
                    <li key={s.id}>
                      <span className="mr-reveal-ic" aria-hidden="true">
                        {s.spell.icon}
                      </span>
                      <span>
                        <b>
                          {s.spell.p}-{s.spell.r}
                        </b>{' '}
                        <em>{s.spell.word}</em> · {s.spell.ko}
                        <br />
                        <small>{s.spell.need}</small>
                      </span>
                    </li>
                  ))}
                </ul>
                {restCorridors > 0 && <p className="mr-reveal-rest">남은 회랑 {restCorridors}개는 다음 판에서.</p>}
              </div>
            ) : undefined
          }
          stats={[
            { num: score.toLocaleString(), label: '점수', accent: true },
            { num: `${built}/${TOTAL_SEALS}`, label: '푼 봉인' },
            { num: combo.best, label: '최장 콤보' },
            { num: convictions, label: '확신 성공' },
          ]}
          best={{ prev: pb.prev, now: score, label: '점수', improved: pb.improved }}
          restartLabel="새 세트"
          restartHint={
            cleared
              ? '다음엔 확신 발동을 한 번 더 걸어 보세요 — 맞히면 점수가 두 배예요.'
              : `이번엔 봉인 ${built}개. 다음 판은 ${built + 1}개를 노려봐요.`
          }
          onRestart={() => {
            setSeed(Math.floor(Math.random() * 0x7fffffff));
            setRunNo((n) => n + 1);
          }}
          onExit={() => onExit?.()}
          footer={
            <>
              <button
                type="button"
                className="gk-btn mr-footer-btn"
                onClick={() => setRunNo((n) => n + 1)}
              >
                같은 세트 다시
              </button>
              <span className="mr-seed">세트 #{seed.toString(36).toUpperCase().slice(-6)}</span>
            </>
          }
        />
      </div>
    );
  }

  // ── 플레이 화면 ─────────────────────────────────────────────────────────
  return (
    <div className="gk-root mr-root">
      <GameMusic gameId="morpheme-rules" />
      <div className="gk-sr" aria-live="polite">
        {live}
      </div>
      <GameKitStyles />
      <AmbientBackground center="#EAEEF3" mid="#B9C4D2" edge="#1A2330" glow="rgba(120,200,255,.24)" glowAt="50% 24%" watermark="morpheme-rules" />
      <style dangerouslySetInnerHTML={{ __html: MR_CSS }} />

      <Hud
        score={score}
        progress={built / TOTAL_SEALS}
        combo={combo.combo}
        comboMult={combo.mult}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        onExit={() => onExit?.()}
        extra={
          <div className="mr-hud">
            <TimerBar frac={time.frac} warning={time.warning} seconds={time.remainSec} label="봉인이 조여드는 시간" />
            <span className="mr-hud-cor">
              회랑 {corridor.index + 1}/{corridors.length}
            </span>
          </div>
        }
      />

      <main className="gk-stage mr-stage">
        <div className="mr-head">
          <h1 className="mr-title">{corridor.title}</h1>
          <p className="mr-sub">{corridor.sub}</p>
        </div>

        {/* 봉인 목록 — 하나만 '지금 겨누는 봉인'. 발동은 이 봉인에 대해서만 판정된다. */}
        <div className="mr-seals" role="group" aria-label="이 회랑의 봉인">
          {corridor.seals.map((s) => {
            const done = broken.includes(s.id);
            const active = !done && s.id === focusId;
            return (
              <button
                key={s.id}
                type="button"
                className="mr-seal"
                data-done={done ? '1' : '0'}
                data-active={active ? '1' : '0'}
                aria-pressed={active}
                aria-label={done ? `해제됨 · ${s.spell.word} ${s.spell.ko}` : `봉인 겨누기 · ${s.spell.need}`}
                onClick={() => focusSeal(s.id)}
                disabled={done}
              >
                <span className="mr-seal-ic" aria-hidden="true">
                  {done ? s.spell.done : s.spell.icon}
                  {done && s.id === lastBrokenId && (
                    <ParticleBurst key={burstSeq} intensity={2} colors={['var(--success)', 'var(--combo)']} />
                  )}
                </span>
                {done ? (
                  <span className="mr-seal-tag" data-done="1">
                    <FeedbackIcon kind="correct" size={11} />
                    {s.spell.word}
                  </span>
                ) : (
                  <span className="mr-seal-tag">{active ? '겨눔' : '봉인'}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* 겨누는 봉인의 장면 — 정답 단어도, 그 사전 뜻도 여기 없다. */}
        {focusSealObj && !broken.includes(focusSealObj.id) && (
          <div className="mr-focus" data-interlude={interlude ? '1' : '0'}>
            <span className="mr-focus-ic" aria-hidden="true">
              {focusSealObj.spell.icon}
            </span>
            <p className="mr-focus-need">{focusSealObj.spell.need}</p>
          </div>
        )}
        {interlude && (
          <div className="mr-focus mr-focus--clear">
            <span className="mr-focus-ic" aria-hidden="true">
              🚪
            </span>
            <p className="mr-focus-need">
              통로가 열렸다 · +{CORRIDOR_CLEAR_SCORE}점 · +{CORRIDOR_CLEAR_MS / 1000}초
            </p>
          </div>
        )}

        {/* 조립대 — 학습자가 놓은 철자만 비춘다. 실재 여부는 발동 전까지 알 수 없다. */}
        <div className="mr-bench" data-shake={shakeSeq === 0 ? '0' : shakeSeq % 2 === 0 ? '2' : '1'}>
          <span className="mr-slot" data-on={pre ? '1' : '0'} data-kind="pre">
            {pre ? `${pre.text}-` : '접두사'}
          </span>
          <span className="mr-op" aria-hidden="true">
            +
          </span>
          <span className="mr-slot" data-on={root ? '1' : '0'} data-kind="root">
            {root ? root.text : '어근'}
          </span>
          <span className="mr-op" aria-hidden="true">
            =
          </span>
          <span className="mr-out" data-on={benchReady ? '1' : '0'}>
            {benchReady ? assembled : '· · ·'}
          </span>
        </div>

        {/* 형태소 블록 — 뜻은 기본 비노출. 해독한 것만 뜻이 붙는다. */}
        <div className="mr-blocks" data-arming={arming ? '1' : '0'} data-lock={interlude ? '1' : '0'}>
          <div className="mr-row" role="group" aria-label="접두사">
            {corridor.prefixes.map((p, i) => {
              const on = pre?.text === p.text;
              const dec = decoded.has(`p:${p.text}`);
              return (
                <button
                  key={p.text}
                  type="button"
                  className="mr-block"
                  data-kind="pre"
                  data-on={on ? '1' : '0'}
                  data-decoded={dec ? '1' : '0'}
                  aria-pressed={on}
                  aria-label={arming ? `${p.text} 해독하기` : `접두사 ${p.text}${dec ? ` (${p.ko})` : ''}`}
                  onClick={() => choosePrefix(p)}
                >
                  <b>{p.text}-</b>
                  <span className="mr-block-ko">{dec ? p.ko : arming ? '해독?' : '　'}</span>
                  <span className="mr-block-key" aria-hidden="true">
                    <Kbd>{i + 1}</Kbd>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mr-row" role="group" aria-label="어근">
            {corridor.roots.map((r, i) => {
              const on = root?.text === r.text;
              const dec = decoded.has(`r:${r.text}`);
              return (
                <button
                  key={r.text}
                  type="button"
                  className="mr-block"
                  data-kind="root"
                  data-on={on ? '1' : '0'}
                  data-decoded={dec ? '1' : '0'}
                  aria-pressed={on}
                  aria-label={arming ? `${r.text} 해독하기` : `어근 ${r.text}${dec ? ` (${r.ko})` : ''}`}
                  onClick={() => chooseRoot(r)}
                >
                  <b>{r.text}</b>
                  <span className="mr-block-ko">{dec ? r.ko : arming ? '해독?' : '　'}</span>
                  <span className="mr-block-key" aria-hidden="true">
                    <Kbd>{['Q', 'W', 'E', 'R'][i]}</Kbd>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 행동 — 안전한 발동 vs 판돈 두 배 확신 발동 */}
        <div className="mr-actions">
          <button
            type="button"
            className="gk-btn gk-btn--primary mr-cast"
            onClick={() => cast(false)}
            disabled={!canCast}
          >
            발동 <Kbd>Enter</Kbd>
          </button>
          <button
            type="button"
            className="gk-btn mr-cast mr-cast--sure"
            onClick={() => cast(true)}
            disabled={!canCast}
            aria-label={`확신 발동 — 점수 두 배, 성공 시 시간 ${CONVICTION_BONUS_MS / 1000}초 추가, 실패 시 ${CONVICTION_PENALTY_MS / 1000}초 추가 손실`}
          >
            확신 발동 ×2 <Kbd>⇧Enter</Kbd>
          </button>
          <div className="mr-decode-wrap">
            <button
              type="button"
              className="gk-btn mr-decode"
              data-arm={arming ? '1' : '0'}
              onClick={() => {
                if (tokens <= 0 || interlude) return;
                click();
                setArming((v) => !v);
              }}
              disabled={tokens <= 0 || interlude}
              aria-pressed={arming}
              aria-label={`해독 — 남은 ${tokens}회. 블록의 뜻을 여는 대신 시간 ${DECODE_COST_MS / 1000}초를 씁니다`}
            >
              해독 <Kbd>H</Kbd>
            </button>
            <LifePips total={DECODE_TOKENS} left={tokens} label="남은 해독" />
          </div>
          <button
            type="button"
            className="gk-btn mr-clear"
            onClick={() => {
              click();
              setPre(null);
              setRoot(null);
            }}
            disabled={!pre && !root}
          >
            비우기 <Kbd>⌫</Kbd>
          </button>
        </div>

        <p className="mr-stakes">
          {arming ? (
            <>뜻을 열 블록을 고르세요 · −{DECODE_COST_MS / 1000}초 · 그 블록으로 만든 말은 점수 절반, 복습 기록 없음</>
          ) : benchReady ? (
            <>
              지금 발동하면 {Math.round((100 + corridor.index * 20) * nextMult * (assistedNow ? 0.5 : 1))}점 · 확신이면{' '}
              {Math.round((100 + corridor.index * 20) * nextMult * 2 * (assistedNow ? 0.5 : 1))}점 · 빗나가면 −
              {Math.round(corridor.penaltyMs / 1000)}초{combo.combo >= 2 ? `, 콤보 ${combo.combo} 소멸` : ''}
            </>
          ) : (
            <>겨눈 봉인이 원하는 뜻을 접두사 + 어근으로 만들어 발동하세요. 판정은 발동한 뒤에 나옵니다.</>
          )}
        </p>

        {/* 발동 결과 — 색 + 아이콘 + 모션 3중 피드백 */}
        <div className="mr-flash-wrap" aria-hidden="true">
          {flash && (
            <div key={flashSeq} className="mr-flash" data-kind={flash.kind}>
              <FeedbackIcon kind={flash.kind === 'correct' ? 'correct' : flash.kind === 'near' ? 'near' : 'wrong'} size={15} />
              <span className="mr-flash-txt">
                <b>{flash.main}</b>
                {flash.sub && <em>{flash.sub}</em>}
                {flash.own && <small>{flash.own}</small>}
              </span>
            </div>
          )}
        </div>

        {/* 이 회랑에서 '판명된' 조합 — 전부 시간을 치르고 얻은 정보다(무료 오라클 아님) */}
        {ledger.length > 0 && (
          <div className="mr-ledger" role="group" aria-label="이 회랑에서 판명된 조합">
            {ledger.map((e) => {
              const pending = e.kind === 'real' && pendingKeys.has(e.key);
              return (
                <span key={e.key} className="mr-chip" data-kind={e.kind}>
                  <FeedbackIcon kind={e.kind === 'solved' ? 'correct' : e.kind === 'real' ? 'near' : 'wrong'} size={11} />
                  <b>{e.word}</b>
                  {e.kind === 'dead' ? (
                    <i>없는 말</i>
                  ) : pending ? (
                    <i>어떤 봉인이 기다린다</i>
                  ) : (
                    <i>{e.ko}</i>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

const MR_CSS = `
  .mr-root { --mr-pre: var(--combo); --mr-root-c: var(--active); }
  .mr-hud { display: flex; align-items: center; gap: 10px; }
  .mr-hud-cor { font-family: var(--font-display, system-ui); font-size: 12px; font-weight: 800; color: var(--t2); white-space: nowrap; }

  .mr-stage { gap: clamp(9px, 1.9vh, 18px); justify-content: flex-start; padding-top: clamp(8px, 1.8vh, 18px); overflow-y: auto; overflow-x: hidden; }
  .mr-head { text-align: center; }
  .mr-title { margin: 0; font-family: var(--font-display, system-ui); font-size: clamp(18px, 3vw, 23px); font-weight: 800; color: var(--t1); }
  .mr-sub { margin: 3px 0 0; font-size: 12.5px; color: var(--t3); }

  /* ── 봉인 칩 ── */
  .mr-seals { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .mr-seal { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    min-width: 62px; min-height: 62px; padding: 7px 9px; border-radius: 14px; border: 1.5px solid var(--bd);
    background: color-mix(in srgb, var(--bg) 66%, transparent); color: var(--t2); cursor: pointer;
    transition: transform .18s var(--ease-spring), border-color .18s, background .18s, box-shadow .18s; }
  .mr-seal-ic { position: relative; font-size: 26px; line-height: 1.05; }
  .mr-seal-tag { display: inline-flex; align-items: center; gap: 3px; font-family: var(--font-display, system-ui); font-size: 10px; font-weight: 800; letter-spacing: .02em; color: var(--t3); }
  .mr-seal-tag[data-done="1"] { font-family: var(--font-english, system-ui); color: var(--success); max-width: 88px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mr-seal:hover:not(:disabled) { border-color: var(--t3); transform: translateY(-2px); }
  .mr-seal:active:not(:disabled) { transform: translateY(0) scale(.96); }
  .mr-seal:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 34%, transparent); }
  .mr-seal[data-active="1"] { border-color: var(--combo); border-width: 2px; background: color-mix(in srgb, var(--combo) 12%, var(--bg)); color: var(--t1); box-shadow: 0 8px 22px -12px color-mix(in srgb, var(--combo) 70%, transparent); }
  .mr-seal[data-active="1"] .mr-seal-tag { color: var(--combo); }
  .mr-seal[data-done="1"] { border-color: color-mix(in srgb, var(--success) 55%, var(--bd)); background: color-mix(in srgb, var(--success) 10%, var(--bg)); cursor: default; opacity: .92; }
  .mr-seal:disabled { cursor: default; }

  /* ── 겨눈 봉인의 장면 ── */
  .mr-focus { display: flex; align-items: center; gap: 12px; width: min(560px, 94vw); padding: 12px 16px; border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--combo) 38%, var(--bd)); background: color-mix(in srgb, var(--bg) 74%, transparent);
    backdrop-filter: blur(4px); animation: gk-pop .34s var(--ease-settle, ease-out); }
  .mr-focus-ic { font-size: 30px; line-height: 1; flex: none; }
  .mr-focus-need { margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 15px; line-height: 1.5; color: var(--t1); }
  .mr-focus[data-interlude="1"] { opacity: .45; }
  .mr-focus--clear { border-color: color-mix(in srgb, var(--success) 55%, var(--bd)); }
  .mr-focus--clear .mr-focus-need { font-style: normal; font-family: var(--font-display, system-ui); font-weight: 800; color: var(--success); }

  /* ── 조립대 ── */
  .mr-bench { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; padding: 10px 16px; border-radius: 12px;
    background: color-mix(in srgb, var(--bg) 58%, transparent); border: 1px solid var(--bd); backdrop-filter: blur(3px); }
  .mr-bench[data-shake="1"] { animation: gk-shake .36s ease-in-out; }
  .mr-bench[data-shake="2"] { animation: gk-shake .36s ease-in-out; }
  .mr-slot { display: inline-flex; align-items: center; justify-content: center; min-width: 84px; min-height: 44px; padding: 6px 14px; border-radius: 10px;
    border: 2px dashed var(--bd); color: var(--t3); font-family: var(--font-english, monospace); font-size: 16px; font-weight: 800; }
  .mr-slot[data-on="1"] { border-style: solid; color: var(--ti); }
  .mr-slot[data-on="1"][data-kind="pre"] { background: var(--mr-pre); border-color: var(--mr-pre); }
  .mr-slot[data-on="1"][data-kind="root"] { background: var(--mr-root-c); border-color: var(--mr-root-c); }
  .mr-op { font-family: var(--font-english, monospace); font-size: 17px; font-weight: 800; color: var(--t3); }
  .mr-out { min-width: 116px; text-align: center; font-family: var(--font-english, monospace); font-size: 19px; font-weight: 800; letter-spacing: .01em; color: var(--t3); }
  .mr-out[data-on="1"] { color: var(--t1); }

  /* ── 형태소 블록 ── */
  .mr-blocks { display: flex; flex-direction: column; gap: 8px; }
  .mr-row { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
  .mr-block { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
    min-width: 88px; min-height: 52px; padding: 8px 14px 9px; border-radius: 12px; border: 2px solid; cursor: pointer;
    transition: transform .14s var(--ease-spring), box-shadow .16s, filter .16s, opacity .16s; }
  .mr-block b { font-family: var(--font-english, monospace); font-size: 17px; font-weight: 800; letter-spacing: .02em; }
  .mr-block-ko { font-size: 10px; font-weight: 700; opacity: .85; min-height: 13px; }
  .mr-block-key { position: absolute; top: -7px; right: -6px; opacity: .8; }
  .mr-block[data-kind="pre"] { border-color: var(--mr-pre); color: var(--mr-pre); background: color-mix(in srgb, var(--mr-pre) 9%, var(--bg)); }
  .mr-block[data-kind="root"] { border-color: var(--mr-root-c); color: color-mix(in srgb, var(--mr-root-c) 86%, var(--t1)); background: color-mix(in srgb, var(--mr-root-c) 11%, var(--bg)); }
  .mr-block:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 8px 18px -10px color-mix(in srgb, currentColor 70%, transparent); }
  .mr-block:active:not(:disabled) { transform: translateY(-1px) scale(.97); }
  .mr-block:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 32%, transparent); }
  .mr-block:disabled { opacity: .45; cursor: default; }
  .mr-block[data-on="1"] { transform: translateY(-3px); box-shadow: 0 0 0 2px currentColor, 0 10px 20px -10px color-mix(in srgb, currentColor 55%, transparent); filter: brightness(1.05); }
  .mr-block[data-decoded="1"] .mr-block-ko { opacity: 1; color: var(--t2); }
  .mr-blocks[data-arming="1"] .mr-block { border-style: dashed; }
  .mr-blocks[data-arming="1"] .mr-block[data-decoded="1"] { opacity: .5; border-style: solid; }
  /* 회랑 전환 1.2초 — disabled 를 걸면 키보드 포커스가 날아가므로 시각만 잠근다. */
  .mr-blocks[data-lock="1"] .mr-block { opacity: .45; pointer-events: none; }

  /* ── 행동 ── */
  .mr-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .mr-cast { display: inline-flex; align-items: center; gap: 7px; padding: 0 18px; }
  .mr-cast--sure { border-color: color-mix(in srgb, var(--streak) 62%, var(--bd)); color: var(--streak); font-weight: 800; }
  .mr-cast--sure:hover:not(:disabled) { border-color: var(--streak); background: color-mix(in srgb, var(--streak) 10%, var(--bg)); }
  .mr-cast--sure:focus-visible, .mr-cast:focus-visible, .mr-decode:focus-visible, .mr-clear:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  .mr-decode-wrap { display: inline-flex; align-items: center; gap: 7px; }
  .mr-decode { display: inline-flex; align-items: center; gap: 7px; padding: 0 14px; }
  .mr-decode[data-arm="1"] { border-color: var(--warning); color: var(--warning); background: color-mix(in srgb, var(--warning) 12%, var(--bg)); }
  .mr-decode[data-arm="1"]::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .mr-clear { display: inline-flex; align-items: center; gap: 7px; padding: 0 14px; }

  .mr-stakes { margin: 0; max-width: 60ch; text-align: center; font-size: 12px; line-height: 1.5; color: var(--t3); font-variant-numeric: tabular-nums; }

  /* ── 결과 플래시 ── */
  .mr-flash-wrap { min-height: 54px; display: flex; align-items: flex-start; justify-content: center; width: min(600px, 96vw); }
  .mr-flash { display: flex; align-items: flex-start; gap: 8px; padding: 8px 14px; border-radius: 12px; border: 1px solid var(--bd);
    background: color-mix(in srgb, var(--bg) 76%, transparent); animation: gk-pop .32s var(--ease-spring, ease-out); }
  .mr-flash-txt { display: flex; flex-direction: column; gap: 2px; text-align: left; }
  .mr-flash-txt b { font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 14px; font-weight: 700; line-height: 1.4; }
  .mr-flash-txt em { font-style: normal; font-size: 11.5px; font-weight: 700; color: var(--t3); font-variant-numeric: tabular-nums; }
  .mr-flash-txt small { font-size: 11px; color: var(--t3); opacity: .9; }
  .mr-flash[data-kind="correct"] { border-color: color-mix(in srgb, var(--success) 55%, var(--bd)); color: var(--success); }
  .mr-flash[data-kind="near"] { border-color: color-mix(in srgb, var(--warning) 58%, var(--bd)); color: var(--warning); }
  .mr-flash[data-kind="wrong"] { border-color: color-mix(in srgb, var(--error) 50%, var(--bd)); color: var(--error); }
  .mr-flash[data-kind="info"] { color: var(--t2); }

  /* ── 판명된 조합 원장 ── */
  .mr-ledger { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; max-width: min(680px, 96vw); padding-bottom: 6px; }
  .mr-chip { display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px; border-radius: 999px; border: 1px solid var(--bd);
    background: color-mix(in srgb, var(--bg) 70%, transparent); font-size: 11px; }
  .mr-chip b { font-family: var(--font-english, monospace); font-size: 12px; font-weight: 800; }
  .mr-chip i { font-style: normal; color: var(--t3); }
  .mr-chip[data-kind="solved"] { border-color: color-mix(in srgb, var(--success) 50%, var(--bd)); color: var(--success); }
  .mr-chip[data-kind="real"] { border-color: color-mix(in srgb, var(--warning) 52%, var(--bd)); color: var(--warning); }
  .mr-chip[data-kind="dead"] { color: var(--t4, var(--t3)); opacity: .7; }
  .mr-chip[data-kind="dead"] b { text-decoration: line-through; }

  /* ── 완료 화면 부속 ── */
  .mr-reveal { text-align: left; }
  .mr-reveal-head { margin: 0 0 8px; font-size: 12.5px; font-weight: 800; color: var(--t2); }
  .mr-reveal-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
  .mr-reveal-list li { display: flex; gap: 9px; align-items: flex-start; font-size: 13px; line-height: 1.55; }
  .mr-reveal-ic { font-size: 20px; line-height: 1.2; flex: none; }
  .mr-reveal-list b { font-family: var(--font-english, monospace); font-weight: 800; color: var(--t3); }
  .mr-reveal-list em { font-style: normal; font-family: var(--font-english, system-ui); font-weight: 800; color: var(--t1); }
  .mr-reveal-list small { font-size: 11.5px; color: var(--t3); }
  .mr-reveal-rest { margin: 10px 0 0; font-size: 12px; color: var(--t3); }
  .mr-footer-btn { min-height: 44px; padding: 0 18px; font-size: 13px; }
  .mr-seed { display: inline-flex; align-items: center; font-family: var(--font-english, monospace); font-size: 11px; font-weight: 700; color: var(--t3); letter-spacing: .06em; }

  @media (max-width: 460px) {
    .mr-root .gk-hud { padding: 10px 12px; gap: 7px; }
    .mr-hud { gap: 7px; }
    .mr-hud-cor { font-size: 11px; }
    .mr-stage { padding-left: 10px; padding-right: 10px; }
    .mr-sub { font-size: 11.5px; }
    .mr-focus { gap: 10px; padding: 10px 12px; }
    .mr-focus-need { font-size: 14px; }
    .mr-slot { min-width: 74px; }
    .mr-out { min-width: 96px; font-size: 17px; }
    .mr-block { min-width: 76px; padding: 8px 10px 9px; }
    .mr-actions { gap: 6px; }
    .mr-cast, .mr-decode, .mr-clear { padding: 0 12px; font-size: 13px; }
    .mr-ledger { flex-wrap: nowrap; overflow-x: auto; justify-content: flex-start; width: 100%; padding-bottom: 8px; }
    .mr-chip { flex: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .mr-seal, .mr-block, .mr-focus, .mr-flash { transition: none; animation: none; }
    .mr-bench[data-shake="1"], .mr-bench[data-shake="2"] { animation: gk-rm-fade .3s ease; }
  }
`;
