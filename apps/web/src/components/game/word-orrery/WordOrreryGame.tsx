// apps/web/src/components/game/word-orrery/WordOrreryGame.tsx
// The Word Orrery — 항성계 탐사 → 핵 봉인 (Outer Wilds 계열).
//
// 한 판의 형태(2~4분):
//   ① 탐사(무시간·Calm) — 여섯 성좌에서 **영어 신호**를 받아 그 의미를 골라낸다(en→ko 인출).
//      맞히면 '정합', 틀리면 '흐림'. 어느 쪽이든 답을 보여주고 성좌는 이름을 얻는다.
//   ② 핵(카운트다운) — 4성좌 이상 읽으면 들어갈 수 있고, **들어서면 문이 닫힌다**(코덱스 참조 불가).
//      여섯 봉인이 하나씩, 점점 어렵게: 4지 → 6지 → 각인(철자 조립). ko→en 산출 인출.
//   ③ 결과 — 성좌 명부 전체 공개 + 개인 최고 비교 + 다음 판 목표.
//
// 이 게임의 선택(트레이드오프):
//   여섯 성좌를 다 읽고 넉넉한 시간(최대 76초)으로 안전하게 들어갈 것인가,
//   네 성좌만 읽고 **정렬 ×1.5** 와 미관측 성좌 ×2 를 노리며 짧은 시간에 들어갈 것인가.
//   시간은 보상이자 벌이다 — 봉인 정답 +5초, 오답 -8초, 잔광(힌트) -12초.
//
// 인출 규칙 준수:
//   · 제출 전에 정답을 특정할 정보를 인쇄하지 않는다(신호 화면에 ko 없음, 봉인 화면에 코덱스 없음).
//   · en·ko 를 동시에 띄운 채 그 쌍을 묻지 않는다 — 코덱스는 en 만, 봉인은 ko 만 보여준다.
//   · 부분 정답 오라클 없음. 각 문항 1회 제출, 철자는 전 글자를 채워야 제출된다.
//   · 정답 공개는 제출 후에만. 그때는 뜻·예문까지 충분히 보여준다.
//   · onCorrect/onWrong 은 **출제된 단어**로만 나간다. 잔광(힌트)으로 산 정답은 기록하지 않는다.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  GameKitStyles, AmbientBackground, Hud, GameDone, ParticleBurst, FeedbackIcon, TimerBar,
  GameMusic, useSfx, useCountdown, useCombo, usePersonalBest, shuffle,
  type Word, type ComboTier,
} from '@/components/game/_shared/gamekit';

interface Props { wordPool?: Word[]; onExit?: () => void; onCorrect?: (w: Word) => void; onWrong?: (w: Word) => void; }

const SYSTEM_SIZE = 6;
const MIN_TO_ENTER = 4;
const BASE_SEC = 40;
const SEC_PER_CLEAN = 6;
const SEAL_GAIN_MS = 5000;
const SEAL_LOSS_MS = 8000;
const FLARE_COST_MS = 12000;
const MASK = '⋯';

// ── 맛보기 성계 뱅크 ──────────────────────────────────────────────────────
// wordPool 이 없거나(비로그인·단어 부족) 6개를 못 채울 때만 쓴다. 14개에서 6개를 뽑으므로
// 맛보기로 들어와도 판마다 성계가 달라진다(하드코딩 6성좌 고정이 재플레이를 죽였다).
const BANK: Word[] = [
  { en: 'desolate', ko: '황량한', pos: 'adj', example: 'The desolate plain stretched for miles without a single tree.' },
  { en: 'profound', ko: '깊은 · 심오한', pos: 'adj', example: 'Her speech had a profound effect on everyone in the hall.' },
  { en: 'erratic', ko: '종잡을 수 없는', pos: 'adj', example: 'His erratic driving made the passengers nervous.' },
  { en: 'volatile', ko: '변덕스러운 · 휘발성의', pos: 'adj', example: 'The market has been volatile since the announcement.' },
  { en: 'dormant', ko: '잠든 · 휴면의', pos: 'adj', example: 'The volcano stayed dormant for three hundred years.' },
  { en: 'radiant', ko: '눈부시게 빛나는', pos: 'adj', example: 'She gave a radiant smile as the doors opened.' },
  { en: 'brittle', ko: '부서지기 쉬운', pos: 'adj', example: 'The old paper had grown brittle and cracked at a touch.' },
  { en: 'austere', ko: '꾸밈없이 엄격한', pos: 'adj', example: 'The monks lived an austere life with very few possessions.' },
  { en: 'turbulent', ko: '요동치는 · 격동하는', pos: 'adj', example: 'The plane shook as it crossed turbulent air.' },
  { en: 'serene', ko: '고요하고 평온한', pos: 'adj', example: 'The lake was serene in the early morning light.' },
  { en: 'obscure', ko: '흐릿한 · 잘 알려지지 않은', pos: 'adj', example: 'The origin of the custom remains obscure to historians.' },
  { en: 'resilient', ko: '회복력 있는', pos: 'adj', example: 'Children are remarkably resilient after a setback.' },
  { en: 'immense', ko: '거대한', pos: 'adj', example: 'An immense shadow moved beneath the surface of the water.' },
  { en: 'fleeting', ko: '순식간에 지나가는', pos: 'adj', example: 'He caught only a fleeting glimpse of the comet.' },
];

const NAME_ADJ = ['재의', '심연의', '길 잃은', '불의', '얼어붙은', '쌍둥이', '메마른', '안개의', '부서진', '침묵의', '붉은', '먼'];
const NAME_NOUN = ['행성', '위성', '성운', '혜성', '고리', '표류지'];
const ICONS = ['🌑', '🌊', '☄️', '🌋', '❄️', '✨', '🪐', '🌘', '🛰️', '🌌', '🌕', '🪨'];
const HUES = ['#8A7A6A', '#3E7AB0', '#B06AC0', '#D2603A', '#5AA6C4', '#D8B24A', '#6FA86B', '#C05A7A'];

const RIDDLES = [
  '「{ko}」 — 그 성질을 지닌 세계. 이름을 새겨라.',
  '「{ko}」 — 이 상태로 굳은 별을 무엇이라 부르는가.',
  '「{ko}」 — 그 본질을 품은 궤도. 이름을 답하라.',
];

// 공명(콤보) 티어 — 한 판의 인출 횟수가 12회(관측 6 + 봉인 6)라 기본 티어(최대 16)를 낮춰 잡는다.
const TIERS: ComboTier[] = [
  { at: 0, mult: 1 },
  { at: 3, mult: 1.5, label: '공명' },
  { at: 5, mult: 2, label: '정합' },
  { at: 8, mult: 2.5, label: '동조' },
  { at: 11, mult: 3, label: '전율' },
];
const multOf = (c: number) => { let m = 1; for (const t of TIERS) if (c >= t.at) m = t.mult; return m; };

const GLOWS = ['rgba(255,176,86,.30)', 'rgba(255,176,86,.42)', 'rgba(255,186,96,.54)', 'rgba(255,196,110,.62)', 'rgba(255,206,124,.70)'];
const SPINS = ['90s', '70s', '52s', '38s', '28s'];

type SealKind = 'c4' | 'c6' | 'spell';
type Survey = 'clean' | 'miss' | null;
type SealState = 'open' | 'fail' | null;

interface Planet { w: Word; icon: string; name: string; hue: string; ctx: string | null; skel: string; spellable: boolean; }
interface Seal { p: number; kind: SealKind; choices: number[]; letters: string[]; riddle: string; }
interface System { planets: Planet[]; seals: Seal[]; }

// ── 순수 헬퍼 ─────────────────────────────────────────────────────────────

/** 예문에서 타깃 어형만 가린다. 굴절형(Word.inflected)과 흔한 접미를 함께 처리. */
function maskTarget(sentence: string, en: string, inflected?: string[]): string {
  const forms = Array.from(new Set([en, ...(inflected ?? [])]))
    .map((f) => f.trim())
    .filter((f) => f.length >= 2)
    .sort((a, b) => b.length - a.length);
  let out = sentence;
  for (const f of forms) {
    const esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      out = out.replace(new RegExp(`\\b${esc}(?:'s|s|es|ed|d|ing|er|est|ly)?\\b`, 'gi'), MASK);
    } catch {
      // 사전 데이터가 정규식으로 못 쓸 형태면 이 어형만 건너뛴다(마스킹 실패 시 잔광은 비활성).
    }
  }
  return out;
}

/** 예문이 없을 때의 잔광 — 첫 글자와 길이만. 답을 주지 않되 방향은 준다. */
function skeleton(en: string): string {
  const head = en.charAt(0).toUpperCase();
  const rest = '·'.repeat(Math.max(0, en.length - 1));
  return `${head}${rest} · ${en.length}글자`;
}

/** 철자 타일 — 원래 순서와 같아지지 않게 섞는다. */
function spread(w: string): string[] {
  const base = w.split('');
  if (base.length < 3) return base;
  for (let i = 0; i < 8; i++) {
    const s = shuffle(base);
    if (s.join('') !== w) return s;
  }
  return shuffle(base);
}

/** en·ko 중복을 걷어낸 사용 가능 단어. 6개를 못 채우면 뱅크로 보충한다. */
function usableWords(pool: Word[] | undefined): Word[] {
  const seenEn = new Set<string>();
  const seenKo = new Set<string>();
  const out: Word[] = [];
  const take = (src: Word[]) => {
    for (const w of src) {
      const en = (w.en ?? '').trim();
      const ko = (w.ko ?? '').trim();
      if (!en || !ko) continue;
      const ke = en.toLowerCase();
      const kk = ko.replace(/\s+/g, '');
      if (seenEn.has(ke) || seenKo.has(kk)) continue;
      seenEn.add(ke);
      seenKo.add(kk);
      out.push({ ...w, en, ko });
    }
  };
  if (pool && pool.length > 0) take(pool);
  if (out.length < SYSTEM_SIZE) take(BANK);
  return out;
}

function buildSystem(pool: Word[] | undefined): System {
  const words = shuffle(usableWords(pool)).slice(0, SYSTEM_SIZE);
  const adjs = shuffle(NAME_ADJ);
  const nouns = shuffle(NAME_NOUN);
  const icons = shuffle(ICONS);
  const hues = shuffle(HUES);

  const planets: Planet[] = words.map((w, i) => {
    const masked = w.example ? maskTarget(w.example, w.en, w.inflected) : null;
    return {
      w,
      icon: icons[i % icons.length],
      name: `${adjs[i % adjs.length]} ${nouns[i % nouns.length]}`,
      hue: hues[i % hues.length],
      ctx: masked && masked.includes(MASK) ? masked : null,
      skel: skeleton(w.en),
      spellable: /^[A-Za-z]{3,9}$/.test(w.en),
    };
  });

  const order = shuffle(planets.map((_, i) => i));
  const riddles = shuffle(RIDDLES);
  const all = planets.map((_, i) => i);

  const seals: Seal[] = order.map((p, step) => {
    let kind: SealKind = step < 2 ? 'c4' : step < 4 ? 'c6' : 'spell';
    if (kind === 'spell' && !planets[p].spellable) kind = 'c6';
    const others = shuffle(all.filter((i) => i !== p));
    const choices = kind === 'c4' ? shuffle([p, ...others.slice(0, 3)]) : kind === 'c6' ? shuffle(all) : [];
    const letters = kind === 'spell' ? spread(planets[p].w.en.toLowerCase()) : [];
    // 치환은 함수형으로 — ko 안의 `$&` 같은 시퀀스가 치환 패턴으로 해석되지 않게.
    const riddle = riddles[step % riddles.length].replace('{ko}', () => planets[p].w.ko);
    return { p, kind, choices, letters, riddle };
  });

  return { planets, seals };
}

const KIND_LABEL: Record<SealKind, string> = { c4: '네 이름 중에서', c6: '여섯 이름 중에서', spell: '각인 — 글자를 조립하라' };
const KIND_PTS: Record<SealKind, number> = { c4: 120, c6: 150, spell: 200 };

interface Say { kind: 'ok' | 'miss' | 'info'; text: string }
interface Reveal { ok: boolean; hinted: boolean; blind: boolean; last: boolean }

export function WordOrreryGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();
  const mounted = useRef(true);

  const [sys, setSys] = useState<System>(() => buildSystem(wordPool));
  const [phase, setPhase] = useState<'survey' | 'core' | 'done'>('survey');
  const [view, setView] = useState<'map' | number>('map');

  // 탐사
  const [survey, setSurvey] = useState<Survey[]>(() => Array(SYSTEM_SIZE).fill(null));
  const [probe, setProbe] = useState<number[] | null>(null);
  const [justAnswered, setJustAnswered] = useState(false);

  // 핵
  const [step, setStep] = useState(0);
  const [seals, setSeals] = useState<SealState[]>(() => Array(SYSTEM_SIZE).fill(null));
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [typed, setTyped] = useState<number[]>([]);
  const [flare, setFlare] = useState(false);
  const [align, setAlign] = useState(1);

  // 집계
  const [score, setScore] = useState(0);
  const [blindWins, setBlindWins] = useState(0);
  const [flaresUsed, setFlaresUsed] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [timeBonus, setTimeBonus] = useState(0);
  const [bestInfo, setBestInfo] = useState<{ prev: number | null; improved: boolean } | null>(null);
  const [say, setSay] = useState<Say | null>(null);
  const [gain, setGain] = useState<{ id: number; text: string; up: boolean } | null>(null);

  const scoreRef = useRef(0);
  const sealsRef = useRef<SealState[]>(Array(SYSTEM_SIZE).fill(null));
  const doneRef = useRef(false);
  const remainRef = useRef(0);
  const gainId = useRef(0);
  const planetBtns = useRef<Array<HTMLButtonElement | null>>([]);
  const lastPlanet = useRef<number | null>(null);
  const advanceBtn = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  const pb = usePersonalBest('word-orrery', true);
  // 카운트다운의 onEnd 가 finish 를 부르는데 finish 는 아래에서 선언된다 —
  // ref 로 한 단계 미뤄 선언 순서에 의존하지 않게 한다.
  const finishRef = useRef<(byTimeout: boolean) => void>(() => {});

  // 티어 승급/붕괴 메시지는 콜백에서 바로 setSay 하면 곧이어 오는 정오답 문장에 덮인다.
  // ref 에 담아 두었다가 정오답 문장과 **합쳐서** 한 줄로 내보낸다.
  const comboNote = useRef<string | null>(null);
  const combo = useCombo({
    tiers: TIERS,
    onTierUp: (t) => {
      if (!t.label) return;
      sfx.coin();
      comboNote.current = `${t.label} ×${t.mult}`;
    },
    onBreak: (lost) => { comboNote.current = `공명 ${lost} 흩어짐`; },
  });
  const withNote = useCallback((text: string) => {
    const n = comboNote.current;
    comboNote.current = null;
    return n ? `${text} · ${n}` : text;
  }, []);

  const observed = survey.filter((s) => s !== null).length;
  const clean = survey.filter((s) => s === 'clean').length;
  const opened = seals.filter((s) => s === 'open').length;
  const coreReady = observed >= MIN_TO_ENTER;
  const entrySec = BASE_SEC + SEC_PER_CLEAN * clean;
  const entryAlign = 1 + 0.25 * (SYSTEM_SIZE - observed);

  const cd = useCountdown({
    totalMs: 45000,
    running: phase === 'core' && reveal === null,
    warnAtMs: 10000,
    onWarn: () => {
      sfx.tone(220, 0.2, 'triangle', 0.045);
      setSay({ kind: 'info', text: '안정도가 흔들린다 — 10초' });
    },
    onEnd: () => { if (mounted.current) finishRef.current(true); },
  });
  remainRef.current = cd.remainSec;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const flash = useCallback((text: string, up: boolean) => {
    gainId.current += 1;
    setGain({ id: gainId.current, text, up });
  }, []);

  const addScore = useCallback((n: number) => {
    scoreRef.current += n;
    setScore(scoreRef.current);
  }, []);

  // ── 판 시작 / 재시작 ────────────────────────────────────────────────────
  const start = useCallback(() => {
    doneRef.current = false;
    scoreRef.current = 0;
    sealsRef.current = Array(SYSTEM_SIZE).fill(null);
    lastPlanet.current = null;
    setSys(buildSystem(wordPool));
    setPhase('survey');
    setView('map');
    setSurvey(Array(SYSTEM_SIZE).fill(null));
    setProbe(null);
    setJustAnswered(false);
    setStep(0);
    setSeals(Array(SYSTEM_SIZE).fill(null));
    setReveal(null);
    setTyped([]);
    setFlare(false);
    setAlign(1);
    setScore(0);
    setBlindWins(0);
    setFlaresUsed(0);
    setTimedOut(false);
    setTimeBonus(0);
    setBestInfo(null);
    setSay(null);
    setGain(null);
    comboNote.current = null;
    combo.reset();
  }, [wordPool, combo]);

  // ── 종료 ────────────────────────────────────────────────────────────────
  const finish = useCallback((byTimeout: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const openedNow = sealsRef.current.filter((s) => s === 'open').length;
    let bonus = 0;
    if (!byTimeout && openedNow === SYSTEM_SIZE) {
      bonus = Math.max(0, remainRef.current) * 4;
      scoreRef.current += bonus;
    }
    setTimeBonus(bonus);
    setScore(scoreRef.current);
    const r = pb.submit(scoreRef.current);
    setBestInfo({ prev: r.prev, improved: r.improved });
    setTimedOut(byTimeout);
    setReveal(null);
    setPhase('done');
    // 팡파르는 여섯 봉인을 전부 연 진짜 개방에만. 그 외에는 조용히 마무리한다(Calm UI).
    if (!byTimeout && openedNow === SYSTEM_SIZE) sfx.fanfare();
    else setSay({ kind: 'info', text: byTimeout ? '핵이 닫혔다' : '항해를 마쳤다' });
  }, [pb, sfx]);
  finishRef.current = finish;

  // ── 탐사: 성좌 열기 ─────────────────────────────────────────────────────
  const openPlanet = useCallback((i: number) => {
    sfx.click();
    lastPlanet.current = i;
    setJustAnswered(false);
    if (survey[i] !== null) {
      setProbe(null);
      setView(i);
      return;
    }
    // 오답 후보는 아직 읽지 않은 성좌에서 먼저 뽑는다 — 이미 읽은 성좌의 뜻으로
    // 소거법을 돌리는 무위험 탐색을 줄인다.
    const others = sys.planets.map((_, j) => j).filter((j) => j !== i);
    const fresh = shuffle(others.filter((j) => survey[j] === null));
    const rest = shuffle(others.filter((j) => survey[j] !== null));
    const picked = [...fresh, ...rest].slice(0, 3);
    setProbe(shuffle([i, ...picked]));
    setView(i);
  }, [sfx, survey, sys]);

  const backToMap = useCallback(() => {
    sfx.click();
    setView('map');
    setProbe(null);
    setJustAnswered(false);
    const i = lastPlanet.current;
    if (i !== null) window.setTimeout(() => planetBtns.current[i]?.focus(), 0);
  }, [sfx]);

  // ── 탐사: 의미 제출 (en → ko) ───────────────────────────────────────────
  const answerSurvey = useCallback((planetIdx: number, pickIdx: number) => {
    if (typeof view !== 'number' || survey[view] !== null) return;
    const target = sys.planets[planetIdx];
    const ok = pickIdx === planetIdx;
    setSurvey((s) => { const n = s.slice(); n[planetIdx] = ok ? 'clean' : 'miss'; return n; });
    setJustAnswered(true);
    setProbe(null);
    if (ok) {
      const c = combo.hit();
      const pts = Math.round(60 * multOf(c));
      addScore(pts);
      sfx.correct(c, c >= 3);
      flash(`+${pts}`, true);
      setSay({ kind: 'ok', text: withNote(`정합 — ${target.w.en}`) });
      onCorrect?.(target.w);
    } else {
      combo.miss();
      sfx.wrong();
      setSay({ kind: 'miss', text: withNote(`이 신호는 「${sys.planets[pickIdx].w.ko}」 쪽이 아니었어요`) });
      onWrong?.(target.w);
    }
  }, [view, survey, sys, combo, addScore, sfx, flash, withNote, onCorrect, onWrong]);

  // ── 핵 진입 ─────────────────────────────────────────────────────────────
  const enterCore = useCallback(() => {
    if (!coreReady) {
      sfx.click();
      setSay({ kind: 'info', text: `아직 ${MIN_TO_ENTER - observed}개의 성좌가 어둡다` });
      return;
    }
    sfx.click();
    setAlign(entryAlign);
    setStep(0);
    setTyped([]);
    setFlare(false);
    setReveal(null);
    setView('map');
    setPhase('core');
    cd.reset(entrySec * 1000);
    setSay({ kind: 'info', text: '문이 닫혔다 — 성좌 노트는 여기까지다' });
  }, [coreReady, observed, entryAlign, entrySec, cd, sfx]);

  // ── 핵: 봉인 판정 ───────────────────────────────────────────────────────
  const resolveSeal = useCallback((ok: boolean) => {
    const sl = sys.seals[step];
    const target = sys.planets[sl.p];
    const hinted = flare;
    const blind = survey[sl.p] === null;
    const last = step === SYSTEM_SIZE - 1;

    const nextSeals = seals.slice();
    nextSeals[sl.p] = ok ? 'open' : 'fail';
    sealsRef.current = nextSeals;
    setSeals(nextSeals);

    if (ok) {
      cd.extend(SEAL_GAIN_MS);
      if (hinted) {
        // 잔광으로 산 정답 — 점수는 남기되 FSRS 인출 성공으로는 올리지 않는다.
        addScore(40);
        flash(`+40 · +${SEAL_GAIN_MS / 1000}s`, true);
        sfx.correct(0, false);
        setSay({ kind: 'ok', text: '잔광이 길을 밝혔다 — 기록에는 남기지 않는다' });
      } else {
        const c = combo.hit();
        const pts = Math.round(KIND_PTS[sl.kind] * multOf(c) * align * (blind ? 2 : 1));
        addScore(pts);
        sfx.correct(c, c >= 3);
        flash(`+${pts} · +${SEAL_GAIN_MS / 1000}s`, true);
        if (blind) setBlindWins((b) => b + 1);
        setSay({ kind: 'ok', text: withNote(blind ? '직감 항해 — 읽지 않은 성좌를 맞혔다' : '봉인이 열렸다') });
        onCorrect?.(target.w);
      }
    } else {
      combo.miss();
      cd.drain(SEAL_LOSS_MS);
      sfx.wrong();
      flash(`−${SEAL_LOSS_MS / 1000}s`, false);
      setSay({ kind: 'miss', text: withNote('다른 이름이었어요 — 아래에서 확인하고 가세요') });
      onWrong?.(target.w);
    }
    setReveal({ ok, hinted, blind, last });
  }, [sys, step, flare, survey, seals, cd, addScore, flash, sfx, combo, align, withNote, onCorrect, onWrong]);

  const advance = useCallback(() => {
    const last = reveal?.last ?? false;
    setReveal(null);
    setTyped([]);
    setFlare(false);
    setSay(null);
    if (last) finish(false);
    else setStep((s) => s + 1);
  }, [reveal, finish]);

  const buyFlare = useCallback(() => {
    if (flare || reveal || cd.remainMs <= FLARE_COST_MS + 2000) return;
    sfx.click();
    setFlare(true);
    setFlaresUsed((n) => n + 1);
    cd.drain(FLARE_COST_MS);
    flash(`−${FLARE_COST_MS / 1000}s`, false);
    setSay({ kind: 'info', text: '잔광을 켰다 — 이 봉인은 기록에 남지 않는다' });
  }, [flare, reveal, sfx, cd, flash]);

  // ── 철자 조립 ───────────────────────────────────────────────────────────
  const seal = phase === 'core' ? sys.seals[step] : null;

  const pushLetter = useCallback((i: number) => {
    setTyped((t) => (t.includes(i) || t.length >= (seal?.letters.length ?? 0) ? t : [...t, i]));
  }, [seal]);
  const popLetter = useCallback(() => setTyped((t) => t.slice(0, -1)), []);
  const clearLetters = useCallback(() => setTyped([]), []);

  const submitSpell = useCallback(() => {
    if (!seal || seal.kind !== 'spell' || reveal) return;
    if (typed.length !== seal.letters.length) return;
    const built = typed.map((i) => seal.letters[i]).join('');
    resolveSeal(built === sys.planets[seal.p].w.en.toLowerCase());
  }, [seal, reveal, typed, resolveSeal, sys]);

  // 키보드 조립 — 데스크톱에서 타일을 마우스로 쪼는 대신 바로 칠 수 있게.
  const keyHandlers = useRef<{ push: (k: string) => void; pop: () => void; submit: () => void }>({
    push: () => {}, pop: () => {}, submit: () => {},
  });
  keyHandlers.current = {
    push: (k: string) => {
      if (!seal) return;
      setTyped((t) => {
        if (t.length >= seal.letters.length) return t;
        const used = new Set(t);
        const i = seal.letters.findIndex((L, idx) => !used.has(idx) && L === k);
        return i < 0 ? t : [...t, i];
      });
    },
    pop: popLetter,
    submit: submitSpell,
  };
  const spellLive = phase === 'core' && seal?.kind === 'spell' && reveal === null;
  useEffect(() => {
    if (!spellLive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Backspace') { e.preventDefault(); keyHandlers.current.pop(); return; }
      if (e.key === 'Enter') { e.preventDefault(); keyHandlers.current.submit(); return; }
      const k = e.key.toLowerCase();
      if (/^[a-z]$/.test(k)) { e.preventDefault(); keyHandlers.current.push(k); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spellLive]);

  // 포커스 관리 — 패널이 통째로 갈리는 게임이라 포커스를 놓치면 키보드 사용자가 길을 잃는다.
  // 결과가 뜬 상태면 진행 버튼으로, 새 문항이면 패널 자체로(제목이 낭독된 뒤 Tab 이 이어진다).
  const surveyResolved = typeof view === 'number' && survey[view] !== null;
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (reveal || surveyResolved) advanceBtn.current?.focus();
      else panelRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [view, step, phase, reveal, surveyResolved]);

  const handleExit = useCallback(() => onExit?.(), [onExit]);

  const positions = useMemo(() => sys.planets.map((_, i) => {
    const ang = (-90 + i * (360 / SYSTEM_SIZE)) * (Math.PI / 180);
    return { x: 50 + Math.cos(ang) * 38, y: 50 + Math.sin(ang) * 38 };
  }), [sys]);

  const tier = combo.tierIndex;
  const rootStyle = { ['--wo-spin' as string]: SPINS[tier] };

  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const perfect = clean === SYSTEM_SIZE && opened === SYSTEM_SIZE && flaresUsed === 0;
    const lead = perfect ? '완벽한 항해 — 앎이 곧 열쇠였다'
      : opened === SYSTEM_SIZE ? '핵을 열었다'
        : timedOut ? '핵이 닫혔다 — 연 봉인은 남는다'
          : '항해를 마쳤다';

    const badge: ReactNode = blindWins > 0
      ? <><span aria-hidden="true">◈</span> 직감 항해 ×{blindWins}</>
      : perfect ? <><span aria-hidden="true">✦</span> 무결 개방</>
        : null;

    const hint = opened < SYSTEM_SIZE
      ? `봉인 ${SYSTEM_SIZE - opened}개가 남았다. 정확 관측 1개당 핵 안정도가 ${SEC_PER_CLEAN}초씩 늘어난다.`
      : align < 1.5
        ? `다음엔 ${MIN_TO_ENTER}성좌만 읽고 정렬 ×1.5 로 들어가 보세요 — 시간은 줄지만 점수는 커진다.`
        : `이번 ${scoreRef.current.toLocaleString()}점. 각인 봉인까지 무결로 가면 더 간다.`;

    return (
      <div className="gk-root wo-root" style={rootStyle}>
        <GameMusic gameId="word-orrery" />
        <GameKitStyles />
        <AmbientBackground center="#3A4468" mid="#141A2E" edge="#080A16" glow="rgba(255,176,86,.34)" glowAt="50% 48%" watermark="word-orrery" />
        <style dangerouslySetInnerHTML={{ __html: WO_CSS }} />
        <Hud muted={sfx.muted} onToggleMute={() => sfx.setMuted((m) => !m)} onExit={handleExit} />
        <GameDone
          mark="word-orrery"
          lead={lead}
          celebrate={perfect}
          badge={badge}
          stats={[
            { num: score.toLocaleString(), label: timeBonus > 0 ? `점수 (시간 +${timeBonus})` : '점수', accent: true },
            { num: `${opened}/${SYSTEM_SIZE}`, label: '연 봉인' },
            { num: `${combo.best}`, label: '최장 공명' },
          ]}
          best={{ prev: bestInfo?.prev ?? null, now: score, label: '점수', improved: bestInfo?.improved }}
          reveal={
            <div className="wo-manifest">
              <p className="wo-manifest-h">성좌 명부 — 이 항성계의 여섯 이름</p>
              <ul className="wo-manifest-l">
                {sys.planets.map((p, i) => (
                  <li key={p.w.en} className="wo-manifest-i">
                    <span className="wo-mf-icon" aria-hidden="true">{p.icon}</span>
                    <span className="wo-mf-en">{p.w.en}</span>
                    <span className="wo-mf-ko">{p.w.ko}</span>
                    <span className={`wo-mf-mark wo-mf-mark--${survey[i] ?? 'none'}`}>
                      {survey[i] === 'clean' ? '✓ 관측' : survey[i] === 'miss' ? '~ 흐림' : '○ 미관측'}
                    </span>
                    <span className={`wo-mf-mark wo-mf-mark--${seals[i] ?? 'none'}`}>
                      {seals[i] === 'open' ? '✦ 개방' : seals[i] === 'fail' ? '× 실패' : '○ 미개봉'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          }
          restartLabel="새 항성계"
          restartHint={hint}
          onRestart={start}
          onExit={handleExit}
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="gk-root wo-root" style={rootStyle}>
      <GameMusic gameId="word-orrery" />
      <GameKitStyles />
      <AmbientBackground center="#3A4468" mid="#141A2E" edge="#080A16" glow={GLOWS[tier]} glowAt="50% 46%" watermark="word-orrery" />
      <style dangerouslySetInnerHTML={{ __html: WO_CSS }} />
      <Hud
        score={score}
        progress={phase === 'survey' ? observed / SYSTEM_SIZE : undefined}
        combo={combo.combo}
        comboMult={combo.mult}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={phase === 'core'
          ? <TimerBar frac={cd.frac} warning={cd.warning} seconds={cd.remainSec} label="핵 안정도" />
          : <div className="wo-hud"><span className="gk-stat-label">관측</span><span className="wo-hud-v">{observed}/{SYSTEM_SIZE}</span></div>}
      />

      <main className="gk-stage wo-stage">
        {/* 점수·시간 증감 플로터. .gk-root 직계 자식은 킷 규칙이 position:relative 로
            덮어쓰므로 반드시 stage 안에 둔다(밖에 두면 흐름에 끼어 레이아웃이 밀린다). */}
        {gain && (
          <span key={gain.id} className="wo-gain" data-up={gain.up ? '1' : '0'} aria-hidden="true">{gain.text}</span>
        )}

        {/* ── 성계 지도 ── */}
        {phase === 'survey' && view === 'map' && (
          <>
            <p className="wo-help">
              행성을 눌러 <b>영어 신호</b>를 받고 그 뜻을 골라라. {MIN_TO_ENTER}성좌부터 핵에 들어갈 수 있고,
              <b> 들어서면 문이 닫힌다</b>.
            </p>

            <div className="wo-orrery" role="group" aria-label="항성계 지도">
              <span className="wo-orbit" aria-hidden="true" />
              <button
                type="button"
                className={`wo-sun ${coreReady ? 'wo-sun--ready' : 'wo-sun--locked'}`}
                onClick={enterCore}
                aria-label={coreReady
                  ? `핵 봉인 진입 — 안정 ${entrySec}초, 정렬 배수 ${entryAlign}배`
                  : `핵 잠김 — ${observed}/${SYSTEM_SIZE} 관측, ${MIN_TO_ENTER}개 필요`}
              >
                <span className="wo-sun-core" aria-hidden="true" />
                <span className="wo-sun-label">{coreReady ? '핵 봉인' : '핵'}</span>
                <span className="wo-sun-sub">{coreReady ? `${entrySec}초 · ×${entryAlign}` : `${observed}/${MIN_TO_ENTER}`}</span>
              </button>

              {sys.planets.map((p, i) => (
                <button
                  key={p.w.en}
                  type="button"
                  ref={(el) => { planetBtns.current[i] = el; }}
                  className={`wo-planet wo-planet--${survey[i] ?? 'new'}`}
                  style={{ left: `${positions[i].x}%`, top: `${positions[i].y}%`, ['--ph' as string]: p.hue }}
                  onClick={() => openPlanet(i)}
                  aria-label={`${p.name} — ${survey[i] === null ? '미관측' : `${p.w.en}, ${survey[i] === 'clean' ? '정합' : '흐림'}`}`}
                >
                  <span className="wo-planet-orb" aria-hidden="true">{p.icon}</span>
                  <span className="wo-planet-name">{p.name}</span>
                  <span className="wo-planet-en">{survey[i] === null ? '미관측' : p.w.en}</span>
                </button>
              ))}
            </div>

            {coreReady && (
              <p className="wo-entry">
                <span className="wo-entry-k">핵 진입 시</span>
                <b>안정 {entrySec}초</b>
                <b>정렬 ×{entryAlign}</b>
                {observed < SYSTEM_SIZE && <span className="wo-entry-r">미관측 {SYSTEM_SIZE - observed}성좌 — 맞히면 ×2</span>}
              </p>
            )}

            {/* 성좌 노트 — 읽어낸 '이름'만 남긴다. 뜻은 적지 않는다(봉인은 기억으로 연다). */}
            <div className="wo-codex">
              <span className="wo-codex-label">성좌 노트 · 이름만</span>
              <div className="wo-codex-list">
                {sys.planets.map((p, i) => (
                  <span key={p.w.en} className={`wo-codex-item is-${survey[i] ?? 'none'}`}>
                    <span className="wo-codex-mark" aria-hidden="true">{survey[i] === 'clean' ? '✦' : survey[i] === 'miss' ? '◇' : '?'}</span>
                    {survey[i] === null ? <i>미관측</i> : <b>{p.w.en}</b>}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── 관측 패널 ── */}
        {phase === 'survey' && typeof view === 'number' && (() => {
          const p = sys.planets[view];
          const res = survey[view];
          return (
            <section ref={panelRef} tabIndex={-1} className="wo-panel wo-obs" style={{ ['--ph' as string]: p.hue }} aria-label={`${p.name} 관측`}>
              <button type="button" className="wo-back" onClick={backToMap}>← 성계로</button>
              <div className="wo-obs-orb" aria-hidden="true">{p.icon}</div>
              <h2 className="wo-obs-name">{p.name}</h2>

              {res === null ? (
                <>
                  <span className="wo-obs-tag">수신된 신호</span>
                  <p className="wo-signal">{p.w.en}</p>
                  {(p.w.pron || p.w.pos) && (
                    <p className="wo-signal-meta">{p.w.pron ? `/${p.w.pron}/` : ''}{p.w.pron && p.w.pos ? ' · ' : ''}{p.w.pos ?? ''}</p>
                  )}
                  <p className="wo-ask">이 신호가 가리키는 의미는?</p>
                  <div className="wo-choices" role="group" aria-label="의미 후보">
                    {(probe ?? []).map((j) => (
                      <button key={j} type="button" className="wo-chip wo-chip--ko" onClick={() => answerSurvey(view, j)}>
                        {sys.planets[j].w.ko}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="wo-reveal">
                  <span className={`wo-verdict wo-verdict--${res === 'clean' ? 'ok' : 'miss'}`}>
                    {res === 'clean'
                      ? <><FeedbackIcon kind="correct" /> {justAnswered ? '정합 — 첫눈에 읽었다' : '정합'}</>
                      : <><FeedbackIcon kind="near" /> 흐림 — 다음엔 잡을 수 있어요</>}
                  </span>
                  <span className="wo-obs-en">{p.w.en}</span>
                  <span className="wo-obs-ko">{p.w.ko}</span>
                  {p.w.example && <p className="wo-obs-ex">{p.w.example}</p>}
                  {justAnswered && res === 'clean' && <ParticleBurst intensity={2} colors={[p.hue, '#FFB056', '#FFE3B8']} />}
                  <button ref={advanceBtn} type="button" className="wo-cta wo-cta--ghost" onClick={backToMap}>성계로 돌아가기</button>
                </div>
              )}
            </section>
          );
        })()}

        {/* ── 핵 봉인 ── */}
        {phase === 'core' && seal && (() => {
          const p = sys.planets[seal.p];
          const flareText = p.ctx ?? p.skel;
          const canFlare = !flare && !reveal && cd.remainMs > FLARE_COST_MS + 2000;
          return (
            <section ref={panelRef} tabIndex={-1} className="wo-panel wo-core" aria-label={`핵 봉인 ${step + 1} / ${SYSTEM_SIZE}`}>
              <p className="wo-core-head">
                <span className="wo-core-step">봉인 {step + 1}<span className="wo-core-of">/{SYSTEM_SIZE}</span></span>
                <span className="wo-core-kind">{KIND_LABEL[seal.kind]}</span>
                <span className="wo-core-align">정렬 ×{align}</span>
              </p>

              <div className="wo-pips" role="img" aria-label={`연 봉인 ${opened}/${SYSTEM_SIZE}`}>
                {sys.seals.map((s, k) => {
                  const st: string = seals[s.p] ?? (k === step ? 'now' : 'wait');
                  return <span key={k} className="wo-pip" data-s={st} />;
                })}
              </div>

              <p className="wo-riddle">{seal.riddle}</p>

              {flare && !reveal && (
                <p className="wo-flare" role="note">
                  <span className="wo-flare-k" aria-hidden="true">✧</span>
                  <span className="wo-flare-t">{flareText}</span>
                </p>
              )}

              {reveal ? (
                <div className="wo-reveal wo-reveal--seal">
                  <span className={`wo-verdict wo-verdict--${reveal.ok ? 'ok' : 'miss'}`}>
                    {reveal.ok ? <><FeedbackIcon kind="correct" /> {reveal.blind && !reveal.hinted ? '직감 항해' : '봉인이 열렸다'}</>
                      : <><FeedbackIcon kind="wrong" /> 다른 이름이었어요</>}
                  </span>
                  <span className="wo-obs-en">{p.w.en}</span>
                  <span className="wo-obs-ko">{p.w.ko}</span>
                  {p.w.example && <p className="wo-obs-ex">{p.w.example}</p>}
                  {reveal.ok && !reveal.hinted && <ParticleBurst intensity={3} colors={[p.hue, '#FFB056', '#FFE3B8']} />}
                  <button ref={advanceBtn} type="button" className="wo-cta" onClick={advance}>
                    {reveal.last ? '핵을 닫다' : '다음 봉인 →'}
                  </button>
                  <span className="wo-note">시계는 여기서 멈춰 있어요 — 천천히 읽고 가세요</span>
                </div>
              ) : seal.kind === 'spell' ? (
                <div className="wo-spell">
                  <div className="wo-slots" aria-label={`${seal.letters.length}글자`}>
                    {seal.letters.map((_, k) => (
                      <span key={k} className={`wo-slot ${typed[k] !== undefined ? 'is-on' : ''}`}>
                        {typed[k] !== undefined ? seal.letters[typed[k]].toUpperCase() : ''}
                      </span>
                    ))}
                  </div>
                  {/* disabled 대신 aria-disabled — 방금 누른 타일이 focus 를 잃고 body 로
                      튀지 않게(4지선다·타일 계열 게임 공통 버그). 동작은 핸들러에서 막는다. */}
                  <div className="wo-tiles" role="group" aria-label="글자 타일">
                    {seal.letters.map((L, k) => (
                      <button
                        key={k}
                        type="button"
                        className="wo-tile"
                        aria-disabled={typed.includes(k)}
                        onClick={() => pushLetter(k)}
                        aria-label={`글자 ${L.toUpperCase()}${typed.includes(k) ? ' — 사용됨' : ''}`}
                      >
                        {L.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <div className="wo-spell-act">
                    <button type="button" className="wo-mini" onClick={popLetter} aria-disabled={typed.length === 0} aria-label="한 글자 지우기">←</button>
                    <button type="button" className="wo-mini" onClick={clearLetters} aria-disabled={typed.length === 0}>지우기</button>
                    <button type="button" className="wo-cta" onClick={submitSpell} aria-disabled={typed.length !== seal.letters.length}>새기다</button>
                  </div>
                </div>
              ) : (
                <div className="wo-choices" role="group" aria-label="이름 후보">
                  {seal.choices.map((j) => (
                    <button key={j} type="button" className="wo-chip" onClick={() => resolveSeal(j === seal.p)}>
                      {sys.planets[j].w.en}
                    </button>
                  ))}
                </div>
              )}

              {!reveal && (
                <button type="button" className="wo-flare-btn" onClick={buyFlare} aria-disabled={!canFlare}>
                  {flare ? '잔광 켜짐 · 이 봉인은 기록에 남지 않음'
                    : canFlare ? `✧ 성좌 잔광 — ${FLARE_COST_MS / 1000}초를 태운다`
                      : '✧ 잔광을 켤 시간이 없다'}
                </button>
              )}
            </section>
          );
        })()}

        {/* 화면에 보이는 한 줄 피드백 + 스크린리더 동시 — sr-only 에만 있던 문장을 밖으로. */}
        <p className={`wo-say ${say ? `is-${say.kind}` : 'is-idle'}`} role="status" aria-live="polite">
          {say ? (
            <>
              <span className="wo-say-i" aria-hidden="true">
                {say.kind === 'ok' ? <FeedbackIcon kind="correct" /> : say.kind === 'miss' ? <FeedbackIcon kind="near" /> : '·'}
              </span>
              {say.text}
            </>
          ) : ''}
        </p>
      </main>
    </div>
  );
}

const WO_CSS = `
  /* 무대는 라이트/다크 어느 테마에서도 '우주'다(AmbientBackground 가 항상 어둡다).
     따라서 무대 위 글자는 테마 토큰이 아니라 고정 대비색을 쓴다 — var(--t1) 을 쓰면
     라이트 테마에서 dark-on-dark 로 사라진다. 패널 배경도 같은 이유로 고정 딥네이비. */
  .wo-root { --wo-1: #EAEFFA; --wo-2: #AFBBD6; --wo-3: #8B97B4;
    --wo-amber: #FFB056; --wo-amber-s: #FFD9A0; --wo-panel: rgba(11,15,32,.9); --wo-line: rgba(159,180,224,.22);
    --wo-spin: 90s; }

  .wo-hud { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.05; }
  .wo-hud-v { font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 800; color: var(--wo-1); }
  .wo-stage { gap: clamp(10px, 2.2vh, 20px); justify-content: flex-start; padding-top: clamp(10px, 3vh, 26px); overflow-y: auto; }
  .wo-help { margin: 0; max-width: 40ch; font-size: 13px; line-height: 1.6; color: var(--wo-2); text-align: center; word-break: keep-all; }
  .wo-help b { color: var(--wo-amber-s); }

  /* 점수·시간 증감 플로터 */
  .wo-gain { position: absolute; top: 4px; left: 50%; transform: translateX(-50%); z-index: 6; pointer-events: none;
    font-family: var(--font-english, monospace); font-size: 15px; font-weight: 900; letter-spacing: .01em;
    color: var(--wo-amber-s); text-shadow: 0 2px 12px rgba(0,0,0,.7); animation: gk-gain .95s ease-out forwards; }
  .wo-gain[data-up="0"] { color: #FF9A8B; }

  /* ── 오리리 ── */
  .wo-orrery { position: relative; width: min(430px, 92vw); aspect-ratio: 1; margin: 0 auto; flex: none; }
  .wo-orbit { position: absolute; left: 50%; top: 50%; width: 76%; height: 76%; transform: translate(-50%, -50%);
    border-radius: 50%; border: 1px dashed color-mix(in srgb, #9fb4e0 42%, transparent); pointer-events: none;
    box-shadow: 0 0 40px -6px rgba(140,170,255,.18) inset; animation: wo-spin var(--wo-spin) linear infinite; }

  .wo-sun { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
    width: clamp(84px, 21vw, 100px); height: clamp(84px, 21vw, 100px); border-radius: 50%; cursor: pointer;
    border: 1px solid rgba(255,210,150,.4); transition: transform .2s var(--ease-settle, ease-out), box-shadow .3s; z-index: 3; }
  .wo-sun-core { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; }
  .wo-sun--locked { background: radial-gradient(circle at 50% 42%, #4a5170, #262b44); color: #C6CEEA; box-shadow: 0 0 0 1px rgba(160,180,230,.2); }
  .wo-sun--locked .wo-sun-core { background: radial-gradient(circle at 50% 40%, rgba(160,180,230,.22), transparent 62%); }
  .wo-sun--ready { background: radial-gradient(circle at 50% 40%, #ffd27a, #e07a2c 74%, #b4531c); color: #3a1e08;
    box-shadow: 0 0 0 1px rgba(255,220,160,.6), 0 0 42px -2px rgba(255,168,72,.7), 0 0 90px -10px rgba(255,140,40,.5); animation: wo-pulse 2.6s ease-in-out infinite; }
  .wo-sun--ready .wo-sun-core { background: radial-gradient(circle at 50% 38%, rgba(255,244,214,.6), transparent 60%); }
  .wo-sun:hover { transform: translate(-50%, -50%) scale(1.06); }
  .wo-sun:active { transform: translate(-50%, -50%) scale(.98); }
  .wo-sun--ready:hover { box-shadow: 0 0 0 2px rgba(255,230,180,.8), 0 0 58px 2px rgba(255,168,72,.85); }
  .wo-sun:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,235,190,.9); }
  .wo-sun-label { position: relative; font-family: var(--font-display, system-ui); font-size: 14px; font-weight: 900; letter-spacing: .02em; }
  .wo-sun-sub { position: relative; font-family: var(--font-english, monospace); font-size: 10px; font-weight: 800; opacity: .88; }

  .wo-planet { position: absolute; transform: translate(-50%, -50%);
    display: flex; flex-direction: column; align-items: center; gap: 2px; width: clamp(74px, 18vw, 94px); min-height: 44px; padding: 6px 4px;
    background: none; border: none; cursor: pointer; z-index: 4; transition: transform .16s var(--ease-settle, ease-out); }
  .wo-planet:hover { transform: translate(-50%, -50%) scale(1.08); }
  .wo-planet:active { transform: translate(-50%, -50%) scale(1); }
  .wo-planet:focus-visible { outline: none; }
  .wo-planet:focus-visible .wo-planet-orb { box-shadow: 0 0 0 3px rgba(255,255,255,.85); }
  .wo-planet-orb { position: relative; display: grid; place-items: center; width: clamp(46px, 11.5vw, 56px); height: clamp(46px, 11.5vw, 56px);
    font-size: clamp(22px, 5.5vw, 28px); border-radius: 50%;
    background: radial-gradient(circle at 38% 32%, color-mix(in srgb, var(--ph) 60%, #fff 8%), color-mix(in srgb, var(--ph) 82%, #000 30%));
    border: 1px solid color-mix(in srgb, var(--ph) 55%, #fff 10%);
    box-shadow: 0 6px 20px -6px color-mix(in srgb, var(--ph) 70%, #000), inset 0 2px 6px rgba(255,255,255,.28); transition: box-shadow .3s; }
  .wo-planet-name { font-family: var(--font-display, system-ui); font-size: 11px; font-weight: 800; color: var(--wo-1); text-shadow: 0 1px 6px rgba(0,0,0,.65); white-space: nowrap; }
  .wo-planet-en { font-family: var(--font-english, monospace); font-size: 10px; font-weight: 700; color: var(--wo-3); }
  .wo-planet--new .wo-planet-orb { animation: wo-beacon 2.4s ease-in-out infinite; }
  .wo-planet--clean .wo-planet-orb { box-shadow: 0 0 0 2px color-mix(in srgb, var(--ph) 75%, #fff 25%), 0 6px 22px -6px color-mix(in srgb, var(--ph) 70%, #000), inset 0 2px 6px rgba(255,255,255,.28); }
  .wo-planet--miss .wo-planet-orb { box-shadow: 0 0 0 2px rgba(200,214,244,.34), 0 6px 20px -6px rgba(0,0,0,.6), inset 0 2px 6px rgba(255,255,255,.2); opacity: .82; }
  .wo-planet--clean .wo-planet-en, .wo-planet--miss .wo-planet-en { font-family: var(--font-english, system-ui); font-weight: 800; color: var(--wo-amber-s); }
  /* 상태는 색만이 아니라 글리프로도 — 색각 대응 */
  .wo-planet--clean .wo-planet-orb::after, .wo-planet--miss .wo-planet-orb::after {
    content: '✦'; position: absolute; top: -3px; right: -3px; width: 17px; height: 17px; display: grid; place-items: center;
    font-size: 10px; font-weight: 900; border-radius: 50%; background: #0B0F20; color: var(--wo-amber-s); border: 1px solid var(--wo-line); }
  .wo-planet--miss .wo-planet-orb::after { content: '◇'; color: var(--wo-2); }

  /* 진입 트레이드오프 — 안전/위험 선택을 숫자로 보여준다 */
  .wo-entry { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px 10px; margin: 0;
    padding: 7px 14px; border-radius: 999px; border: 1px solid var(--wo-line); background: rgba(11,15,32,.62);
    font-size: 12px; color: var(--wo-2); }
  .wo-entry b { font-family: var(--font-english, system-ui); font-size: 12.5px; font-weight: 900; color: var(--wo-amber-s); }
  .wo-entry-k { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--wo-3); }
  .wo-entry-r { color: var(--wo-2); }

  /* ── 성좌 노트 (이름만 · 뜻 없음) ── */
  .wo-codex { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .wo-codex-label { font-family: var(--font-english, monospace); font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--wo-3); }
  .wo-codex-list { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; max-width: min(460px, 92vw); }
  .wo-codex-item { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--wo-2);
    padding: 4px 11px; border-radius: 999px; border: 1px solid var(--wo-line); background: rgba(11,15,32,.55); }
  .wo-codex-item b { font-family: var(--font-english, system-ui); font-weight: 800; color: var(--wo-1); }
  .wo-codex-item i { font-style: italic; color: var(--wo-3); }
  .wo-codex-mark { font-size: 10px; color: var(--wo-3); }
  .wo-codex-item.is-clean { border-color: color-mix(in srgb, #FFB056 48%, transparent); }
  .wo-codex-item.is-clean .wo-codex-mark { color: var(--wo-amber); }
  .wo-codex-item.is-miss { border-style: dashed; }

  /* ── 패널 공통 ── */
  .wo-panel { position: relative; width: min(470px, 94vw); margin: 0 auto; padding: clamp(18px, 3.2vh, 26px) clamp(16px, 4vw, 24px);
    border-radius: 18px; background: var(--wo-panel); border: 1px solid var(--wo-line);
    box-shadow: 0 30px 70px -30px rgba(0,0,0,.8); display: flex; flex-direction: column; align-items: center; gap: 10px;
    animation: wo-rise .3s ease-out; }
  .wo-panel:focus { outline: none; }
  .wo-panel:focus-visible { outline: none; box-shadow: 0 30px 70px -30px rgba(0,0,0,.8), 0 0 0 2px color-mix(in srgb, #FFB056 55%, transparent); }
  .wo-back { position: absolute; left: 8px; top: 8px; min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; justify-content: center;
    font-family: var(--font-english, monospace); font-size: 11px; font-weight: 800; color: var(--wo-3);
    background: none; border: 1px solid transparent; cursor: pointer; padding: 0 10px; border-radius: 10px; transition: color .2s, background .2s, border-color .2s; }
  .wo-back:hover { color: var(--wo-1); background: rgba(200,214,244,.1); }
  .wo-back:active { background: rgba(200,214,244,.18); }
  .wo-back:focus-visible { outline: none; border-color: transparent; box-shadow: 0 0 0 3px color-mix(in srgb, #FFB056 42%, transparent); }

  /* ── 관측 패널 ── */
  .wo-obs { text-align: center; padding-top: 44px; }
  .wo-obs-orb { width: 62px; height: 62px; display: grid; place-items: center; font-size: 32px; border-radius: 50%;
    background: radial-gradient(circle at 38% 32%, color-mix(in srgb, var(--ph) 55%, #fff 10%), color-mix(in srgb, var(--ph) 82%, #000 26%));
    border: 1px solid color-mix(in srgb, var(--ph) 55%, #fff 10%); box-shadow: 0 0 34px -6px color-mix(in srgb, var(--ph) 70%, transparent); }
  .wo-obs-name { margin: 0; font-size: 15px; font-weight: 800; color: var(--wo-1); }
  .wo-obs-tag { font-family: var(--font-english, monospace); font-size: 9.5px; letter-spacing: .16em; text-transform: uppercase; color: var(--wo-3); }
  .wo-signal { margin: 0; font-family: var(--font-english, system-ui); font-size: clamp(30px, 8.4vw, 42px); font-weight: 900; letter-spacing: -.015em;
    color: var(--wo-amber-s); text-shadow: 0 0 26px rgba(255,176,86,.4); word-break: break-word; }
  .wo-signal-meta { margin: -4px 0 0; font-family: var(--font-english, monospace); font-size: 11.5px; color: var(--wo-3); }
  .wo-ask { margin: 4px 0 0; font-size: 12.5px; font-weight: 700; color: var(--wo-2); }

  /* ── 선택지 칩 ── */
  .wo-choices { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; width: 100%; }
  .wo-chip { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; max-width: 100%;
    font-family: var(--font-english, system-ui); font-size: 14px; font-weight: 800; color: var(--wo-1); cursor: pointer;
    padding: 0 16px; border-radius: 999px; border: 1px solid var(--wo-line); background: rgba(24,31,58,.9);
    transition: transform .12s var(--ease-settle, ease-out), border-color .2s, box-shadow .2s, background .2s; }
  .wo-chip--ko { font-family: var(--font-display, system-ui); font-size: 13.5px; font-weight: 700; word-break: keep-all; text-align: center; line-height: 1.35; padding: 8px 16px; }
  .wo-chip:hover { transform: translateY(-2px); border-color: var(--wo-amber); box-shadow: 0 8px 18px -9px rgba(255,176,86,.8); background: rgba(34,42,74,.95); }
  .wo-chip:active { transform: translateY(0) scale(.97); }
  .wo-chip:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, #FFB056 42%, transparent); }
  .wo-chip:disabled { opacity: .45; cursor: default; transform: none; box-shadow: none; }

  /* ── 리빌 ── */
  .wo-reveal { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; animation: wo-rise .3s ease-out; }
  .wo-reveal--seal { margin-top: 2px; }
  .wo-verdict { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px;
    font-size: 12px; font-weight: 800; border: 1px solid var(--wo-line); }
  .wo-verdict--ok { color: #9BE7BE; border-color: rgba(155,231,190,.45); background: rgba(60,140,105,.16); }
  .wo-verdict--miss { color: #FFC7A6; border-color: rgba(255,199,166,.42); background: rgba(150,90,60,.16); }
  .wo-verdict--info { color: var(--wo-2); }
  .wo-obs-en { font-family: var(--font-english, system-ui); font-size: clamp(24px, 6.6vw, 32px); font-weight: 900; letter-spacing: -.01em; color: var(--wo-amber-s); word-break: break-word; }
  .wo-obs-ko { font-size: 14px; font-weight: 700; color: var(--wo-1); word-break: keep-all; text-align: center; }
  .wo-obs-ex { margin: 6px 0 0; max-width: 36ch; font-family: var(--font-serif, Lora, Georgia, serif); font-style: italic;
    font-size: 13.5px; line-height: 1.62; color: var(--wo-2); text-align: center; }
  .wo-note { font-size: 11px; color: var(--wo-3); }

  .wo-cta { min-height: 46px; margin-top: 8px; padding: 0 24px; border-radius: 999px; cursor: pointer;
    font-family: var(--font-display, system-ui); font-size: 14px; font-weight: 800; color: #2a1806;
    border: 1px solid rgba(255,220,160,.6); background: linear-gradient(140deg, #ffd680, #e88a3a);
    box-shadow: 0 10px 26px -12px rgba(255,150,60,.8); transition: transform .16s var(--ease-settle, ease-out), box-shadow .24s, filter .2s; }
  .wo-cta:hover { transform: translateY(-2px); box-shadow: 0 16px 34px -14px rgba(255,150,60,.9); }
  .wo-cta:active { transform: translateY(0) scale(.98); }
  .wo-cta:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,235,190,.85); }
  .wo-cta:disabled, .wo-cta[aria-disabled="true"] { filter: grayscale(.6) brightness(.7); cursor: default; transform: none; box-shadow: none; }
  .wo-cta[aria-disabled="true"]:hover { transform: none; box-shadow: none; }
  .wo-cta--ghost { color: var(--wo-1); background: none; border-color: var(--wo-line); box-shadow: none; }
  .wo-cta--ghost:hover { border-color: var(--wo-2); box-shadow: none; }

  /* ── 핵 봉인 ── */
  .wo-core { align-items: center; }
  .wo-core-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: center; gap: 6px 12px; margin: 0; }
  .wo-core-step { font-family: var(--font-english, monospace); font-size: 15px; font-weight: 900; color: var(--wo-amber-s); }
  .wo-core-of { font-size: 11px; color: var(--wo-3); }
  .wo-core-kind { font-size: 11px; font-weight: 700; letter-spacing: .04em; color: var(--wo-2); }
  .wo-core-align { font-family: var(--font-english, monospace); font-size: 11px; font-weight: 800; color: var(--wo-3); }

  .wo-pips { display: inline-flex; gap: 6px; }
  .wo-pip { width: 22px; height: 5px; border-radius: 999px; background: rgba(200,214,244,.16); transition: background .3s, box-shadow .3s; }
  .wo-pip[data-s="open"] { background: var(--wo-amber); box-shadow: 0 0 10px -1px rgba(255,176,86,.8); }
  .wo-pip[data-s="fail"] { background: rgba(200,214,244,.16); box-shadow: inset 0 0 0 1px rgba(255,199,166,.6); }
  .wo-pip[data-s="now"] { background: var(--wo-amber-s); }

  .wo-riddle { margin: 2px 0 0; max-width: 34ch; font-family: var(--font-serif, Lora, Georgia, serif); font-style: italic;
    font-size: 15px; line-height: 1.6; color: var(--wo-1); text-align: center; word-break: keep-all; }

  .wo-flare { display: flex; align-items: flex-start; gap: 8px; margin: 0; padding: 9px 13px; border-radius: 12px;
    border: 1px solid rgba(255,176,86,.34); border-left: 4px solid var(--wo-amber); background: rgba(255,176,86,.08);
    font-size: 13px; line-height: 1.55; color: var(--wo-2); text-align: left; }
  .wo-flare-k { color: var(--wo-amber); font-size: 12px; line-height: 1.55; }
  .wo-flare-t { font-family: var(--font-english, system-ui); }
  .wo-flare-btn { min-height: 44px; padding: 0 16px; border-radius: 999px; cursor: pointer;
    font-size: 12px; font-weight: 700; color: var(--wo-2); background: none; border: 1px dashed var(--wo-line);
    transition: color .2s, border-color .2s, background .2s; }
  .wo-flare-btn:hover:not([aria-disabled="true"]) { color: var(--wo-amber-s); border-color: var(--wo-amber); background: rgba(255,176,86,.08); }
  .wo-flare-btn:active:not([aria-disabled="true"]) { background: rgba(255,176,86,.16); }
  .wo-flare-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, #FFB056 36%, transparent); }
  .wo-flare-btn[aria-disabled="true"] { opacity: .5; cursor: default; }

  /* ── 각인(철자 조립) ── */
  .wo-spell { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; }
  .wo-slots { display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; }
  .wo-slot { width: 30px; height: 40px; display: grid; place-items: center; border-radius: 8px;
    border-bottom: 2px solid var(--wo-line); background: rgba(24,31,58,.55);
    font-family: var(--font-english, system-ui); font-size: 19px; font-weight: 900; color: var(--wo-1); }
  .wo-slot.is-on { border-bottom-color: var(--wo-amber); background: rgba(255,176,86,.12); }
  .wo-tiles { display: flex; flex-wrap: wrap; gap: 7px; justify-content: center; }
  .wo-tile { width: 44px; height: 44px; border-radius: 11px; cursor: pointer;
    font-family: var(--font-english, system-ui); font-size: 18px; font-weight: 900; color: var(--wo-1);
    border: 1px solid var(--wo-line); background: rgba(28,36,66,.95);
    transition: transform .12s var(--ease-settle, ease-out), border-color .2s, box-shadow .2s, opacity .2s; }
  .wo-tile:hover:not([aria-disabled="true"]) { transform: translateY(-2px); border-color: var(--wo-amber); box-shadow: 0 8px 18px -10px rgba(255,176,86,.9); }
  .wo-tile:active:not([aria-disabled="true"]) { transform: translateY(0) scale(.94); }
  .wo-tile:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, #FFB056 42%, transparent); }
  /* 사용된 타일 — 색만이 아니라 빈 윤곽(글자 숨김)으로도 구분된다 */
  .wo-tile[aria-disabled="true"] { opacity: .3; cursor: default; color: transparent; border-style: dashed; }
  .wo-spell-act { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center; }
  .wo-spell-act .wo-cta { margin-top: 0; }
  .wo-mini { min-height: 44px; min-width: 44px; padding: 0 14px; border-radius: 999px; cursor: pointer;
    font-size: 12.5px; font-weight: 800; color: var(--wo-2); border: 1px solid var(--wo-line); background: rgba(24,31,58,.8);
    transition: color .2s, border-color .2s, background .2s; }
  .wo-mini:hover:not([aria-disabled="true"]) { color: var(--wo-1); border-color: var(--wo-2); }
  .wo-mini:active:not([aria-disabled="true"]) { background: rgba(40,50,86,.95); }
  .wo-mini:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, #FFB056 36%, transparent); }
  .wo-mini[aria-disabled="true"] { opacity: .4; cursor: default; }

  /* ── 보이는 한 줄 피드백 ── */
  .wo-say { display: flex; align-items: center; gap: 7px; margin: 0; min-height: 20px; padding: 0 12px;
    font-size: 12.5px; font-weight: 700; color: var(--wo-2); text-align: center; word-break: keep-all; transition: color .2s; }
  .wo-say.is-ok { color: #9BE7BE; }
  .wo-say.is-miss { color: #FFC7A6; }
  .wo-say.is-info { color: var(--wo-amber-s); }
  .wo-say-i { display: inline-flex; }

  /* ── 결과: 성좌 명부 ── */
  .wo-manifest { text-align: left; }
  .wo-manifest-h { margin: 0 0 8px; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--t3); }
  .wo-manifest-l { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .wo-manifest-i { display: grid; grid-template-columns: 20px minmax(0, 1fr) minmax(0, 1.2fr) auto auto; align-items: baseline; gap: 4px 8px; font-size: 13px; }
  .wo-mf-icon { font-size: 13px; }
  .wo-mf-en { font-family: var(--font-english, system-ui); font-weight: 800; color: var(--t1); overflow-wrap: anywhere; }
  .wo-mf-ko { color: var(--t2); word-break: keep-all; }
  .wo-mf-mark { font-size: 10.5px; font-weight: 800; color: var(--t3); white-space: nowrap; }
  .wo-mf-mark--clean, .wo-mf-mark--open { color: var(--streak, #E8622F); }
  .wo-mf-mark--miss, .wo-mf-mark--fail { color: var(--t2); }
  @media (max-width: 430px) {
    .wo-manifest-i { grid-template-columns: 18px minmax(0, 1fr) auto; }
    .wo-mf-ko { grid-column: 2 / -1; font-size: 12px; }
  }

  @keyframes wo-spin { to { transform: translate(-50%, -50%) rotate(360deg); } }
  @keyframes wo-pulse { 0%,100% { box-shadow: 0 0 0 1px rgba(255,220,160,.6), 0 0 42px -2px rgba(255,168,72,.7), 0 0 90px -10px rgba(255,140,40,.5); } 50% { box-shadow: 0 0 0 1px rgba(255,230,180,.75), 0 0 54px 2px rgba(255,178,86,.85), 0 0 110px -6px rgba(255,150,50,.6); } }
  @keyframes wo-beacon { 0%,100% { box-shadow: 0 6px 20px -6px color-mix(in srgb, var(--ph) 70%, #000), inset 0 2px 6px rgba(255,255,255,.28); } 50% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--ph) 40%, transparent), 0 6px 24px -4px color-mix(in srgb, var(--ph) 80%, #000), inset 0 2px 6px rgba(255,255,255,.28); } }
  @keyframes wo-rise { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: translateY(0); } }

  @media (prefers-reduced-motion: reduce) {
    .wo-orbit, .wo-sun--ready, .wo-planet--new .wo-planet-orb, .wo-panel, .wo-reveal { animation: none; }
    .wo-gain { animation: none; opacity: 1; }
    .wo-planet, .wo-sun, .wo-chip, .wo-cta, .wo-tile, .wo-mini { transition: none; }
    .wo-chip:hover, .wo-cta:hover, .wo-tile:hover { transform: none; }
  }
`;
