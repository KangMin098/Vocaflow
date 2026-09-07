// apps/web/src/components/game/_shared/gamekit.tsx
// 게임 공용 킷 — SFX · 파티클 · HUD · 완료화면 · 토큰 스타일 · 유틸.
// 6종 아케이드 게임(Cascade·Connections·Word Economy·Daily Blitz·Letter Forge·Ghost Race) 공용.
// WordBlitz v07.2 의 검증된 주스 패턴을 일반화. 전부 테마 토큰(라이트/다크) + 접근성.

'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { getArcadeMeta } from '@/lib/game/arcade-meta';
import { GAME_BY_SLUG, GAME_MARKS, type GameSlug } from '@/lib/game/catalog';
import { DEFAULT_MUSIC_ON, readMusicPref, writeMusicPref } from '@/lib/game/music-pref';

// Esc 소유권 — 게임은 키 리스너를 달지 않고 **의사만 등록**한다(session-escape.ts 가 정본).
// 규칙: 핸들러가 true 를 돌려주면 세션이 그 Esc 를 소비한 것이고 셸은 나가지 않는다.
export { useSessionEscape, type SessionEscapeHandler } from '@/components/layout/session-escape';

// 게임 메커닉 훅(시간·콤보·FLIP·개인기록)은 mechanics.tsx 에 있다.
// 게임이 import 를 한 군데로 유지할 수 있게 여기서 다시 내보낸다.
export {
  useCountdown,
  useCombo,
  useFlipGrid,
  usePersonalBest,
  useSessionPause,
  useSessionPauseClock,
  DEFAULT_COMBO_TIERS,
  type Countdown,
  type ComboState,
  type ComboTier,
} from './mechanics';

// 정지 소유권 — 탭 이탈·수동 일시정지의 판정은 session-pause.ts 한 곳이다.
// 자기 rAF 루프를 도는 게임도 리스너를 달지 않고 useSessionPauseClock 으로 상태만 읽는다.
export type { SessionPauseSnapshot } from '@/lib/game/session-pause';

export type Word = {
  en: string;
  ko: string;
  pron?: string;
  /** 실 어휘 배선용 — 예문(문맥)·품사·굴절형. 스코프 단어에서 스캐폴드가 전달. */
  example?: string;
  pos?: string;
  inflected?: string[];
};

// 신규 아케이드 게임 6종 id — ModuleId ∩ ScoreModule (양쪽에 대입 가능).
export type ArcadeGameId =
  | 'cascade'
  | 'connections'
  | 'word-economy'
  | 'daily-blitz'
  | 'letter-forge'
  | 'ghost-race'
  | 'glyph-tongue'
  | 'word-customs'
  | 'lexicon-hands'
  | 'lexicon-detective'
  | 'morpheme-rules'
  | 'silent-rule'
  | 'lexicon-estate'
  | 'word-orrery'
  | 'wordsmith-vigil'
  | 'morphmerge'
  | 'wordfall-cadence'
  // 3D — 라벨↔모델 결합을 끊어 학습자 단어로 도는 게임이 됐다(v07.8). 스캐폴드·FSRS 편입.
  | 'pirate-quest';

// ─── 유틸 ───
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export function pickDistinct<T>(pool: T[], n: number, exclude: (t: T) => boolean): T[] {
  return shuffle(pool.filter((x) => !exclude(x))).slice(0, n);
}

// ─── SFX (실녹음 샘플 · public/audio/sfx/ · Mixkit 무료 라이선스) ───────────
// 실제 효과음 샘플을 Web Audio 버퍼로 저지연 재생(합성 아님). 로드 전/실패 시에만
// 합성 tone 폴백으로 무음 방지. 콤보는 playbackRate로 상승감. mute 지원.
//
// v07.6 — Kenney "Interface Sounds" 를 걷어냈다. FFT 실측으로 6종 전부 모노 ·
// 8 kHz 이상 에너지 0~0.6% · correct/complete 는 스펙트럴 평탄도 0.0000 —
// 대역제한 합성음이라 "그냥 컴퓨터 소리" 라는 지적이 수치로도 맞았다.
// 교체본(벨·나무 타격·동전·타자기·금관 합주)은 전부 스테레오 실녹음이고
// 비조화 부분음·자연 감쇠·고역 공기감을 갖는다. 상세는 games/CREDITS.txt.
const SFX_SRC = {
  correct: "/audio/sfx/correct.wav",
  wrong: "/audio/sfx/wrong.wav",
  combo: "/audio/sfx/combo.wav",
  complete: "/audio/sfx/complete.ogg",
  click: "/audio/sfx/click.wav",
  coin: "/audio/sfx/coin.wav",
} as const;
type SfxName = keyof typeof SFX_SRC;

export function useSfx() {
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  mutedRef.current = muted;
  const ctxRef = useRef<AudioContext | null>(null);
  const bufRef = useRef<Partial<Record<SfxName, AudioBuffer>>>({});
  const loadingRef = useRef(false);

  const audioCtx = useCallback(() => {
    if (typeof window === "undefined") return null;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!ctxRef.current) ctxRef.current = new AC();
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const loadSamples = useCallback(() => {
    if (loadingRef.current) return;
    const c = ctxRef.current;
    if (!c) return;
    loadingRef.current = true;
    (Object.keys(SFX_SRC) as SfxName[]).forEach((name) => {
      fetch(SFX_SRC[name])
        .then((r) => r.arrayBuffer())
        .then((ab) => c.decodeAudioData(ab))
        .then((buf) => {
          bufRef.current[name] = buf;
        })
        .catch(() => {});
    });
  }, []);

  // 합성 폴백 (샘플 로드 전) — 기존 무자산 tone 유지.
  const tone = useCallback(
    (freq: number, dur = 0.09, type: OscillatorType = "sine", gain = 0.05, at = 0) => {
      if (mutedRef.current) return;
      const c = audioCtx();
      if (!c) return;
      const t0 = c.currentTime + at;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(t0);
      o.stop(t0 + dur);
    },
    [audioCtx],
  );

  const play = useCallback(
    (name: SfxName, rate: number, gain: number, fallback?: () => void) => {
      if (mutedRef.current) return;
      const c = audioCtx();
      if (!c) return;
      loadSamples();
      const buf = bufRef.current[name];
      if (!buf) {
        fallback?.();
        return;
      }
      const s = c.createBufferSource();
      const g = c.createGain();
      s.buffer = buf;
      s.playbackRate.value = rate;
      // 반복음 피로 제거 — 재생마다 미세 피치·음량 지터(±45센트 / ±9%).
      if (s.detune) s.detune.value = (Math.random() * 2 - 1) * 45;
      g.gain.value = gain * (0.9 + Math.random() * 0.18);
      s.connect(g);
      g.connect(c.destination);
      s.start();
    },
    [audioCtx, loadSamples],
  );

  const correct = useCallback(
    (combo = 0, milestone = false) => {
      play("correct", 1 + Math.min(combo, 12) * 0.03, 0.6, () =>
        tone(520 + Math.min(combo, 12) * 26, 0.1, "triangle", 0.06),
      );
      if (milestone) play("combo", 1, 0.55);
    },
    [play, tone],
  );
  const wrong = useCallback(
    () => play("wrong", 1, 0.5, () => tone(150, 0.16, "sawtooth", 0.05)),
    [play, tone],
  );
  const fanfare = useCallback(
    () =>
      play("complete", 1, 0.7, () =>
        [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, "sine", 0.05, i * 0.11)),
      ),
    [play, tone],
  );
  const click = useCallback(
    () => play("click", 1, 0.4, () => tone(340, 0.05, "sine", 0.03)),
    [play, tone],
  );
  const coin = useCallback(
    () => play("coin", 1, 0.5, () => tone(880, 0.06, "square", 0.035)),
    [play, tone],
  );
  // 니어미스 — "틀렸다"가 아니라 "아까웠다". 오답음과 반드시 구분돼야 한다.
  // 전용 샘플을 새로 받지 않고, wrong 을 높고 여리게(짧은 '탁') 낸 뒤 90ms 뒤
  // correct 벨을 낮고 아주 여리게 겹쳐 "닿을 뻔한" 잔향을 만든다.
  // 감사 지적: 현재 모든 게임이 near-miss 를 full wrong 음으로 때워 학습자가
  // 3/4 맞힌 시도와 완전 오답을 소리로 구분하지 못한다.
  const nearMiss = useCallback(() => {
    play("wrong", 1.28, 0.3, () => tone(300, 0.08, "triangle", 0.035));
    window.setTimeout(() => play("correct", 0.78, 0.16), 90);
  }, [play, tone]);

  const dispose = useCallback(() => {
    if (ctxRef.current) void ctxRef.current.close().catch(() => {});
    ctxRef.current = null;
    bufRef.current = {};
    loadingRef.current = false;
  }, []);

  useEffect(() => () => dispose(), [dispose]);

  return { muted, setMuted, tone, correct, wrong, fanfare, click, coin, nearMiss, dispose };
}

// ─── 정답/오답 아이콘 ─────────────────────────────────────────────────────
// CLAUDE.md 는 "정답/오답: 색상 + 아이콘 + 애니메이션 3중 피드백"을 요구하는데
// 킷이 색·모션 2축만 제공해 **전 게임이 똑같이 아이콘 축을 누락**하고 있었다
// (v07.8 전수 감사). 색만으로 정보를 전달하면 색각 이상 사용자에게는 피드백이 없다.
export function FeedbackIcon({
  kind,
  size = 14,
}: {
  kind: 'correct' | 'wrong' | 'near';
  size?: number;
}) {
  const label = kind === 'correct' ? '정답' : kind === 'wrong' ? '오답' : '거의';
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={label}
      className="gk-fbicon"
    >
      {kind === 'correct' && <path d="M3 8.5l3.2 3.2L13 5" />}
      {kind === 'wrong' && <path d="M4 4l8 8M12 4l-8 8" />}
      {kind === 'near' && <path d="M3 11.5l4-4 3 3 3.5-5" />}
    </svg>
  );
}

// ─── 남은 시간 게이지 ─────────────────────────────────────────────────────
// mechanics 의 useCountdown 과 짝. 마지막 구간에서 색·맥동이 바뀌어 "시간이 없다"가
// 숫자가 아니라 몸으로 읽히게 한다. reduced-motion 이면 맥동 없이 색만 바뀐다.
export function TimerBar({
  frac,
  warning = false,
  label = '남은 시간',
  seconds,
}: {
  /** 남은 비율 0..1 */
  frac: number;
  warning?: boolean;
  label?: string;
  /** 주면 게이지 옆에 초를 표기(스크린리더에도 읽힌다). */
  seconds?: number;
}) {
  return (
    <div className="gk-timer" data-warn={warning ? '1' : '0'}>
      <div
        className="gk-timer-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamp(frac, 0, 1) * 100)}
      >
        <div className="gk-timer-fill" style={{ width: `${clamp(frac, 0, 1) * 100}%` }} />
      </div>
      {seconds !== undefined && (
        <span className="gk-timer-sec" aria-live="off">
          {Math.max(0, seconds)}s
        </span>
      )}
    </div>
  );
}

// ─── 목숨 / 실수 예산 pip ─────────────────────────────────────────────────
// 색만으로 남은 목숨을 말하지 않는다 — 남은 것은 채워진 원, 잃은 것은 빈 원(이중 인코딩).
export function LifePips({ total, left, label = '남은 기회' }: { total: number; left: number; label?: string }) {
  return (
    <div className="gk-pips" role="img" aria-label={`${label} ${left}/${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="gk-pip" data-on={i < left ? '1' : '0'} aria-hidden="true" />
      ))}
    </div>
  );
}

// ─── BGM (큐레이션 실제 트랙 · public/audio/games/) ───────────────────────
// 게임 무드에 맞춘 시네마틱 오케스트라 루프(Alexander Nakarada · creatorchords.com /
// Scott Buckley · scottbuckley.com.au · 둘 다 CC-BY 4.0 ·
// 크레딧: public/audio/games/CREDITS.txt · 아케이드 푸터 표기).
//
// v07.7 — 선곡을 **측정으로** 바꿨다. 요구는 "웅장 + 긴장 + 긴박 + 빠른 템포"인데
// 후보 118곡을 재보니 대부분의 앰비언트 곡은 pulse(박 선명도)가 1.0 언저리, 즉
// 박이 노이즈와 구별되지 않았다 — 제목이 아무리 장엄해도 몰아치지 않는 이유다.
// 지금은 전 곡 129~161 BPM · 박이 뚜렷한 것만 남겼다.
//
// 루프는 **마디 정수배**로 자른다. 임의 길이로 자르면 꼬리와 머리의 박 위상이
// 어긋나 겹박(플램)이 나고 추진력이 뭉개진다. 마디 정수배면 위상이 맞아떨어져
// 크로스페이드가 박 위에 정확히 얹힌다. 길이는 템포에 따라 109.5~110.6초.
// 트랙 간 음량은 -16 LUFS 로 통일.
//
// 기본 **ON**(v07.6 사용자 결정 — "단어 게임은 음악이 중요함"). 이전 기본 OFF 는
// Calm UI 근거였지만 결과가 Calm 이 아니라 무음이었다: 토글 전에는 트랙을 내려받지도
// 않아 19곡을 붙여놓고도 첫 진입 학습자는 한 곡도 듣지 못했다. 상세는 music-pref.ts.
// localStorage 기억 · 페이드 인/아웃 · SFX/TTS 시 살짝 덕킹 ·
// 자동재생 차단 시 다음 제스처(pointerdown/keydown)에 시작.
// 파일 없으면 hasTrack=false(무해).
// 트랙 매핑은 lib/game/catalog 의 `music` 필드 단일 출처 — 여기 복제본이 따로 있던 시절
// 독립 3D 2종(wordblitz·pirate-quest)이 이 표에서 빠져 영영 무음이었다.
const MUSIC_VOL = 0.3;

function rampVolume(a: HTMLAudioElement, to: number, ms: number, done?: () => void) {
  const from = a.volume;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    a.volume = clamp(from + (to - from) * t, 0, 1);
    if (t < 1) requestAnimationFrame(step);
    else done?.();
  };
  requestAnimationFrame(step);
}

export function useGameMusic(gameId: GameSlug) {
  const src = GAME_BY_SLUG[gameId]?.music;
  // 초기값은 localStorage 가 아니라 상수 — 서버·클라이언트가 같은 값을 그려
  // 하이드레이션 불일치도, 아이콘이 OFF→ON 으로 튀는 깜빡임도 없다.
  const [on, setOn] = useState(DEFAULT_MUSIC_ON);
  /** 사용자가 아직 한 번도 정하지 않음 → 버튼을 첫 진입에 한해 눈에 띄게(발견성). */
  const [undecided, setUndecided] = useState(false);
  /** 선호를 읽기 전에는 소리를 내지 않는다 — OFF 를 고른 학습자에게 한 순간도 울리면 안 된다. */
  const [ready, setReady] = useState(false);
  const aRef = useRef<HTMLAudioElement | null>(null);
  const onRef = useRef(on);
  onRef.current = on;

  useEffect(() => {
    const pref = readMusicPref();
    if (pref === null) setUndecided(true);
    else setOn(pref);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !src || typeof window === "undefined") return;
    // 자동재생 차단 시 다음 제스처에 시작하는 리스너 — 반드시 cleanup 으로 제거해야
    // OFF 후 탭이 음악을 되살리는 버그·리스너 리크를 막는다.
    // pointerdown 만으로는 부족하다: 타이핑 게임(wordsmith-vigil·letter-forge 등)은
    // 포인터를 한 번도 안 쓰고 끝낼 수 있어, 기본 ON 인데 영영 무음이 된다.
    let kick: ((e: Event) => void) | null = null;
    const KICK_EVENTS = ["pointerdown", "keydown"] as const;
    if (on) {
      let a = aRef.current;
      if (!a) {
        a = new Audio(src);
        a.loop = true;
        a.preload = "auto";
        a.volume = 0;
        aRef.current = a;
      }
      const audio = a;
      const begin = () => rampVolume(audio, MUSIC_VOL, 900);
      audio
        .play()
        .then(begin)
        .catch(() => {
          kick = () => {
            // OFF 됐거나 오디오가 교체됐으면 무시
            if (onRef.current && aRef.current === audio) void audio.play().then(begin).catch(() => {});
            if (kick) for (const ev of KICK_EVENTS) window.removeEventListener(ev, kick);
          };
          for (const ev of KICK_EVENTS) window.addEventListener(ev, kick);
        });
    } else if (aRef.current) {
      const audio = aRef.current;
      rampVolume(audio, 0, 450, () => audio.pause());
    }
    return () => {
      if (kick) for (const ev of KICK_EVENTS) window.removeEventListener(ev, kick);
    };
  }, [on, src, ready]);

  useEffect(
    () => () => {
      const a = aRef.current;
      if (a) {
        a.pause();
        a.src = "";
        aRef.current = null;
      }
    },
    [],
  );

  const toggle = useCallback(() => {
    setUndecided(false); // 한 번이라도 정하면 강조 해제
    setOn((v) => {
      const nv = !v;
      writeMusicPref(nv);
      return nv;
    });
  }, []);

  // 큰 SFX/TTS 순간 배경음을 잠깐 낮췄다 복귀 (음성·효과음이 묻히지 않게).
  const duck = useCallback((ms = 300) => {
    const a = aRef.current;
    if (!a || a.paused) return;
    rampVolume(a, MUSIC_VOL * 0.32, 120);
    window.setTimeout(() => {
      const b = aRef.current;
      if (b && !b.paused) rampVolume(b, MUSIC_VOL, 450);
    }, ms);
  }, []);

  return { on, toggle, duck, hasTrack: !!src, undecided };
}

export function IconMusic({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
      {!on && <path d="M4 3.5l16 17" opacity=".9" />}
    </svg>
  );
}

// 게임 루트 어디에나 1줄로: <GameMusic gameId="cascade" />
//
// 첫 진입(선호 미결정)에는 라벨 "배경음악"을 함께 펼쳐 존재를 알린다. 기본 ON 이 된
// v07.6 부터 이 라벨의 역할은 "여기 음악이 있다"에서 **"지금 나는 소리는 이것이고,
// 여기서 끌 수 있다"**로 바뀐다 — 소리가 갑자기 나는데 출처를 못 찾는 상황을 막는다.
// 한 번이라도 켜거나 끄면 아이콘만 남는다(Calm UI).
export function GameMusic({ gameId }: { gameId: GameSlug }) {
  const m = useGameMusic(gameId);
  if (!m.hasTrack) return null;
  return (
    <button
      type="button"
      className="gk-music-btn"
      onClick={m.toggle}
      aria-pressed={m.on}
      aria-label={m.on ? "배경음악 끄기" : "배경음악 켜기"}
      data-on={m.on ? "1" : "0"}
      data-hint={m.undecided ? "1" : "0"}
    >
      <IconMusic on={m.on} />
      {m.undecided && <span className="gk-music-hint">배경음악</span>}
    </button>
  );
}

// ─── 카운트업 ───
export function useCountUp(value: number, durMs = 450) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(from + (to - from) * eased);
      fromRef.current = v;
      setShown(v);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, durMs]);
  return shown;
}

// ─── 파티클 버스트 ───
// colors 를 주면 그 색으로 터진다 — "무엇을 해냈는지"를 파티클에도 인코딩하기 위해
// (예: Connections 에서 맞힌 그룹의 색). 안 주면 기존 4색 그대로.
const PARTICLE_COLORS = ['var(--streak)', 'var(--combo)', 'var(--success)', 'var(--active)'];
export function ParticleBurst({ intensity = 1, colors }: { intensity?: number; colors?: string[] }) {
  const palette = colors && colors.length > 0 ? colors : PARTICLE_COLORS;
  const paletteKey = palette.join('|');
  const parts = useMemo(() => {
    const pal = paletteKey.split('|');
    const c = 8 + intensity * 6;
    return Array.from({ length: c }, (_, i) => {
      const a = (Math.PI * 2 * i) / c + (Math.random() - 0.5) * 0.6;
      const d = 40 + Math.random() * 46 + intensity * 14;
      return {
        tx: Math.cos(a) * d,
        ty: Math.sin(a) * d,
        s: 5 + Math.random() * 6,
        delay: Math.random() * 0.04,
        color: pal[i % pal.length],
      };
    });
  }, [intensity, paletteKey]);
  return (
    <span className="gk-burst" aria-hidden="true">
      {parts.map((p, i) => (
        <span
          key={i}
          className="gk-particle"
          style={
            {
              '--tx': `${p.tx}px`,
              '--ty': `${p.ty}px`,
              width: `${p.s}px`,
              height: `${p.s}px`,
              background: p.color,
              animationDelay: `${p.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

// ─── 게임별 아이덴티티 마크 (SVG · 이모지 대체) ───
// path 정의는 lib/game/catalog 의 GAME_MARKS 단일 출처 — 허브 카드와 게임 내 워터마크가
// 같은 마크를 쓰도록(이전엔 arcade/page.tsx 에 같은 path 가 복제돼 있었다).
export function GameMark({ id, className }: { id: ArcadeGameId; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {GAME_MARKS[id]}
    </svg>
  );
}

// ─── 사운드 토글 아이콘 (SVG · 이모지 대체) ───
export function IconSound({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9v6h3.5L12 19V5L7.5 9H4Z" />
      {muted ? (
        <path d="M16 9.5l5 5M21 9.5l-5 5" />
      ) : (
        <><path d="M15.5 9a4 4 0 0 1 0 6" /><path d="M18 6.6a7.5 7.5 0 0 1 0 10.8" opacity=".5" /></>
      )}
    </svg>
  );
}

// ─── 분위기 배경 (게임별 무드 그레이딩) ───
// 중앙은 밝게(가독) · 가장자리는 무드로 깊게(드라마) + 앰비언트 글로우 + 그레인 + 비네트.
// 밝은 타일/어두운 텍스트가 그대로 읽히면서도 공간감·감성을 부여. Calm 유지(모션 없음).
export function AmbientBackground({
  center, mid, edge, glow, glowAt = '50% 14%', grain = true, watermark,
}: {
  center: string; mid: string; edge: string; glow: string; glowAt?: string; grain?: boolean; watermark?: ArcadeGameId;
}) {
  return (
    <div
      className="gk-atmos"
      aria-hidden="true"
      style={{ ['--at-c' as string]: center, ['--at-m' as string]: mid, ['--at-e' as string]: edge, ['--at-glow' as string]: glow, ['--at-glow-at' as string]: glowAt } as CSSProperties}
    >
      <div className="gk-atmos-grad" />
      <div className="gk-atmos-glow" />
      {grain && <div className="gk-atmos-grain" />}
      {watermark && <div className="gk-atmos-mark"><GameMark id={watermark} /></div>}
      <div className="gk-atmos-vig" />
    </div>
  );
}

// ─── HUD ───
export function Hud({
  score,
  progress,
  combo,
  comboMult,
  lives,
  extra,
  muted,
  onToggleMute,
  onExit,
}: {
  score?: number;
  progress?: number; // 0..1
  combo?: number;
  /** 콤보 배수 — 주면 콤보 옆에 ×2.0 처럼 붙어 "지금 뭘 잃게 되는지"가 보인다. */
  comboMult?: number;
  /** 실수 예산. 색+빈원 이중 인코딩으로 렌더(목숨형 게임 공통 수요). */
  lives?: { total: number; left: number; label?: string };
  extra?: ReactNode;
  muted: boolean;
  onToggleMute: () => void;
  onExit?: () => void;
}) {
  const tier = combo ? clamp(Math.floor(combo / 5), 0, 3) : 0;
  return (
    <header className="gk-hud">
      {score !== undefined ? (
        <div className="gk-stat">
          <span className="gk-stat-label">SCORE</span>
          <span key={score} className="gk-stat-value gk-score gk-bump">
            {score.toLocaleString()}
          </span>
        </div>
      ) : (
        <div />
      )}
      {progress !== undefined ? (
        <div className="gk-progress" aria-hidden="true">
          <div className="gk-progress-fill" style={{ width: `${clamp(progress, 0, 1) * 100}%` }} />
        </div>
      ) : (
        <div className="gk-progress-spacer" />
      )}
      {extra}
      {lives && <LifePips total={lives.total} left={lives.left} label={lives.label} />}
      {combo !== undefined && (
        <div className="gk-stat gk-stat--right">
          <span className="gk-stat-label">콤보</span>
          <span key={combo} data-tier={tier} className={`gk-combo ${combo > 0 ? 'gk-combo--on gk-bump' : ''}`}>
            {combo > 0 ? `🔥 ${combo}` : '—'}
            {combo > 0 && comboMult !== undefined && comboMult > 1 && (
              <span className="gk-combo-mult">×{comboMult % 1 === 0 ? comboMult : comboMult.toFixed(1)}</span>
            )}
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={onToggleMute}
        className="gk-icon-btn"
        aria-label={muted ? '소리 켜기' : '소리 끄기'}
        aria-pressed={muted}
      >
        <IconSound muted={muted} />
      </button>
      {onExit && (
        <button type="button" onClick={onExit} className="gk-exit" aria-label="게임 종료">
          나가기
        </button>
      )}
    </header>
  );
}

// ─── 완료 화면 ───
// v07.8 — 끝화면이 "죽은 끝"이던 문제를 고치는 슬롯 4개를 더했다.
// 감사 19건 중 다수가 같은 지적을 했다: 재시작 버튼은 있는데 **다시 할 이유**가 없다.
//   best        — 어제의 나와의 비교. 리더보드가 아니다(Calm UI · 남과 겨루지 않는다).
//   badge       — 신기록·티어 승급 같은 조용한 배지(폭죽 금지 원칙과 양립).
//   restartHint — 재시작 버튼 아래 한 줄. "0.6초만 줄이면 됩니다" 같은 다음 판 목표.
//   reveal      — 패배 시 정답 공개 블록. 지금은 게임이 phase 를 직접 쪼개야 했다.
export function GameDone({
  lead = '오늘 잘 마쳤어요',
  stats,
  onRestart,
  onExit,
  restartLabel = '다시 하기',
  celebrate = false, // Calm UI — 완료 시 폭죽 금지(차분한 마무리). 승리에 한해 게임이 명시 opt-in.
  mark,
  best,
  badge,
  restartHint,
  reveal,
  footer,
}: {
  lead?: string;
  stats: { num: ReactNode; label: string; accent?: boolean }[];
  onRestart: () => void;
  onExit: () => void;
  restartLabel?: string;
  celebrate?: boolean;
  mark?: ArcadeGameId;
  /** 개인 최고 비교. prev 가 null 이면 첫 기록으로 표기. */
  best?: { prev: number | null; now: number; label: string; improved?: boolean };
  badge?: ReactNode;
  restartHint?: string;
  /** 결과 상단에 얹는 블록 — 주로 패배 시 정답 공개. */
  reveal?: ReactNode;
  footer?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  // 결과 공유 (Wordle식 바이럴) — 클라이언트 전용. 모바일 navigator.share, 그 외 클립보드.
  const onShare = useCallback(async () => {
    const statStr = stats
      .filter((s) => typeof s.num === 'string' || typeof s.num === 'number')
      .map((s) => `${s.label} ${s.num}`)
      .join(' · ');
    const meta = getArcadeMeta();
    const lines = [lead];
    if (statStr) lines.push(statStr);
    if (meta.streak > 1) lines.push(`🔥 ${meta.streak}일 연속`);
    const text = lines.join('\n');
    const url = typeof window !== 'undefined' ? `${window.location.origin}/arcade` : '';
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Vocaflow 아케이드', text, url });
        return; // 공유 시트로 처리됨
      }
    } catch (e) {
      // 사용자 취소(AbortError)는 조용히 종료. 그 외 실패(NotAllowedError 등)는 클립보드 폴백.
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* 클립보드 미허용 */
    }
  }, [lead, stats]);

  return (
    <main className="gk-done" role="status">
      {celebrate && (
        <div className="gk-done-burst" aria-hidden="true">
          <ParticleBurst intensity={3} />
        </div>
      )}
      {mark && (
        <div className="gk-done-mark" aria-hidden="true">
          <GameMark id={mark} />
        </div>
      )}
      <p className="gk-done-lead">{lead}</p>
      {badge && <div className="gk-done-badge">{badge}</div>}
      {reveal && <div className="gk-done-reveal">{reveal}</div>}
      <div className="gk-done-stats">
        {stats.map((s, i) => (
          <div key={i} className="gk-done-stat">
            <span className={`gk-done-num ${s.accent ? 'gk-score' : ''}`}>{s.num}</span>
            <span className="gk-done-lbl">{s.label}</span>
          </div>
        ))}
      </div>
      {best && (
        <p className="gk-done-best" data-improved={best.improved ? '1' : '0'}>
          {best.prev == null
            ? `첫 기록 · ${best.label} ${best.now}`
            : best.improved
              ? `개인 최고 갱신 · ${best.label} ${best.prev} → ${best.now}`
              : `개인 최고 ${best.label} ${best.prev} · 이번 ${best.now}`}
        </p>
      )}
      <div className="gk-done-actions">
        <button type="button" onClick={onRestart} className="gk-btn gk-btn--primary">
          {restartLabel}
        </button>
        <button type="button" onClick={onShare} className="gk-btn" aria-live="polite">
          {copied ? '복사됨 ✓' : '결과 공유'}
        </button>
        <button type="button" onClick={onExit} className="gk-btn">
          나가기
        </button>
      </div>
      {restartHint && <p className="gk-done-hint">{restartHint}</p>}
      {footer && <div className="gk-done-footer">{footer}</div>}
    </main>
  );
}

// ─── 로딩 ───
export function GameLoading({ message }: { message?: string }) {
  return (
    <div className="gk-loading" role="status" aria-live="polite">
      <GameKitStyles />
      <div className="gk-spinner" aria-hidden="true" />
      <div className="gk-loading-text">{message ?? '불러오는 중…'}</div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="gk-kbd">{children}</kbd>;
}

// ─── 부족 단어 안내 ───
export function NotEnoughWords({ need, onExit }: { need: number; onExit?: () => void }) {
  return (
    <div className="gk-empty" role="alert">
      <GameKitStyles />
      <div className="gk-empty-emoji" aria-hidden="true">📚</div>
      <h1 className="gk-empty-title">학습할 단어가 부족해요</h1>
      <p className="gk-empty-sub">이 게임은 최소 {need}개 단어가 필요해요. 단어장을 먼저 채워 주세요.</p>
      {onExit && (
        <button type="button" onClick={onExit} className="gk-btn gk-btn--primary">
          돌아가기
        </button>
      )}
    </div>
  );
}

// ─── 공용 스타일 (한 번만 주입; 중복 주입돼도 동일 규칙이라 무해) ───
export function GameKitStyles() {
  return <style dangerouslySetInnerHTML={{ __html: GK_CSS }} />;
}

const GK_GRAIN = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

const GK_CSS = `
  .gk-root { position: relative; width: 100vw; height: 100vh; overflow: hidden; display: flex; flex-direction: column; background: var(--bg2); color: var(--t1); font-family: var(--font-display, system-ui, sans-serif); user-select: none;
    --ease-spring: cubic-bezier(.34, 1.56, .64, 1); --ease-settle: cubic-bezier(.22, .61, .36, 1); }
  /* 진짜 스프링 오버슈트(지원 브라우저) — 리빌·누름 감촉 고급화. 미지원 시 위 cubic-bezier 폴백. */
  @supports (animation-timing-function: linear(0, 1)) {
    .gk-root { --ease-spring: linear(0, 0.55 11%, 1.06 30%, 0.985 46%, 1.008 62%, 0.998 80%, 1); }
  }
  .gk-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  /* 배경 레이어 위로 콘텐츠를 올리는 규칙. 명시도가 (0,3,0) 이라 .gk-music-btn(0,1,0)의
     position:fixed 를 덮어써서, 음악 버튼이 좌하단 고정이 아니라 게임 상단 흐름에 전체 너비로
     박혀 있었다(=음악 컨트롤로 인식 불가). 배경 레이어들과 같은 방식으로 제외한다. */
  .gk-root > :not(.gk-energy):not(.gk-atmos):not(.gk-music-btn) { position: relative; z-index: 1; }
  .gk-energy { position: absolute; inset: 0; z-index: 0; pointer-events: none; background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--streak) 50%, transparent), transparent 60%); transition: opacity .5s ease, transform .6s ease; }

  /* 분위기 배경 레이어 (AmbientBackground) */
  .gk-atmos { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
  .gk-atmos-grad { position: absolute; inset: 0; background: radial-gradient(128% 112% at 50% 15%, var(--at-c) 0%, var(--at-m) 37%, var(--at-e) 92%); }
  .gk-atmos-glow { position: absolute; inset: 0; background: radial-gradient(52% 38% at var(--at-glow-at, 50% 14%), var(--at-glow), transparent 70%); }
  .gk-atmos-grain { position: absolute; inset: 0; opacity: .05; mix-blend-mode: overlay; background-image: url("${GK_GRAIN}"); }
  .gk-atmos-mark { position: absolute; right: -3%; bottom: -8%; width: min(52vh, 460px); color: #fff; opacity: .9; mix-blend-mode: soft-light; }
  .gk-atmos-mark svg { width: 100%; height: auto; display: block; }
  .gk-atmos-vig { position: absolute; inset: 0; box-shadow: inset 0 0 210px 40px rgba(28,14,38,.44), inset 0 -70px 100px rgba(18,8,28,.34); }

  /* ── 다크 모드 (v07.8 결함 수정) ──────────────────────────────────────
     게임은 AmbientBackground 에 밝은 색을 하드코딩해 넘긴다(예: center="#ECF7F7").
     그런데 텍스트는 테마 토큰(--t1)이라 다크에서 밝아진다 → **밝은 배경 위 밝은 글씨**.
     GK_CSS 에 data-theme 분기가 한 줄도 없어서 19게임이 전부 같은 증상이었다.

     19개 게임의 색 인자를 각각 고치는 대신, 여기서 게임의 색조는 유지한 채
     명도만 다크 캔버스(--bg)로 끌어내린다 — 중앙 한 곳 수정으로 전 게임 해결. */
  [data-theme="dark"] .gk-atmos-grad {
    background: radial-gradient(128% 112% at 50% 15%,
      color-mix(in srgb, var(--at-c) 24%, var(--bg)) 0%,
      color-mix(in srgb, var(--at-m) 30%, var(--bg)) 37%,
      color-mix(in srgb, var(--at-e) 58%, var(--bg)) 92%);
  }
  [data-theme="dark"] .gk-atmos-glow { opacity: .55; }
  [data-theme="dark"] .gk-atmos-mark { opacity: .5; mix-blend-mode: overlay; }
  [data-theme="dark"] .gk-atmos-vig { box-shadow: inset 0 0 210px 40px rgba(0,0,0,.5), inset 0 -70px 100px rgba(0,0,0,.4); }

  .gk-hud { display: grid; grid-template-columns: auto 1fr auto auto auto auto; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--bd); }
  .gk-stat { display: flex; flex-direction: column; line-height: 1.05; }
  .gk-stat--right { align-items: flex-end; }
  .gk-stat-label { font-size: 10px; font-weight: 700; letter-spacing: .12em; color: var(--t3); text-transform: uppercase; }
  .gk-stat-value { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .gk-score { color: var(--combo); }
  .gk-combo { font-size: 15px; font-weight: 800; color: var(--t4); font-variant-numeric: tabular-nums; transition: font-size .2s ease; }
  .gk-combo--on { color: var(--streak); }
  .gk-combo--on[data-tier="1"] { font-size: 17px; }
  .gk-combo--on[data-tier="2"] { font-size: 19px; color: #E8622F; text-shadow: 0 0 12px color-mix(in srgb, var(--streak) 60%, transparent); }
  .gk-combo--on[data-tier="3"] { font-size: 22px; color: #E0322F; text-shadow: 0 0 16px color-mix(in srgb, var(--error) 70%, transparent); }
  .gk-progress { height: 6px; border-radius: 999px; background: var(--bg3); overflow: hidden; }
  .gk-progress-spacer { min-width: 20px; }
  .gk-progress-fill { height: 100%; border-radius: 999px; background: var(--combo); transition: width .4s var(--ease, cubic-bezier(.4,0,.2,1)); }
  .gk-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: var(--r-md, 8px); border: 1px solid var(--bd); background: var(--bg); color: var(--t2); font-size: 15px; cursor: pointer; transition: border-color .15s, color .15s; }
  .gk-icon-btn:hover { border-color: var(--t3); color: var(--t1); }
  .gk-exit { display: inline-flex; align-items: center; padding: 8px 14px; border-radius: var(--r-md, 8px); border: 1px solid var(--bd); background: var(--bg); color: var(--t2); font-size: 12px; font-weight: 700; cursor: pointer; min-height: 44px; transition: background .15s, color .15s, border-color .15s; }
  .gk-exit:hover { color: var(--t1); border-color: var(--t3); }

  .gk-music-btn { position: fixed; left: 16px; bottom: calc(14px + env(safe-area-inset-bottom, 0px)); z-index: 40; width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 80%, transparent); color: var(--t3); backdrop-filter: blur(6px); cursor: pointer; transition: color .15s, border-color .15s, transform .12s; }
  .gk-music-btn:hover { color: var(--t1); border-color: var(--t3); }
  .gk-music-btn:active { transform: scale(.94); }
  .gk-music-btn[data-on="1"] { color: var(--combo); border-color: color-mix(in srgb, var(--combo) 50%, var(--bd)); }
  .gk-music-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  /* 첫 진입(선호 미결정) — 라벨을 펼쳐 BGM 존재를 알린다. 한 번 정하면 아이콘만 남음. */
  .gk-music-btn[data-hint="1"] { width: auto; gap: 8px; padding: 0 16px 0 13px; border-color: color-mix(in srgb, var(--combo) 45%, var(--bd)); color: var(--t1); }
  .gk-music-hint { font-family: var(--font-display, system-ui, sans-serif); font-size: 12.5px; font-weight: 700; letter-spacing: -.01em; white-space: nowrap; }
  @media (max-width: 420px) { .gk-music-hint { display: none; } .gk-music-btn[data-hint="1"] { width: 44px; padding: 0; } }

  .gk-stage { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(20px, 4.4vh, 44px); padding: 20px 16px; min-height: 0; }

  .gk-tile { position: relative; overflow: visible; display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 16px 18px; border-radius: var(--r-lg, 14px); border: 1.5px solid var(--bd); background: var(--bg); color: var(--t1); font-family: var(--font-english, var(--font-display, system-ui)); font-size: clamp(16px, 3vw, 22px); font-weight: 700; cursor: pointer; text-align: left; transition: transform .2s var(--ease-spring), border-color .15s, background .15s, box-shadow .15s; }
  .gk-tile:hover:not(:disabled) { border-color: var(--combo); transform: translateY(-3px); box-shadow: 0 8px 24px color-mix(in srgb, var(--combo) 18%, transparent); }
  .gk-tile:active:not(:disabled) { transform: translateY(0) scale(.96); }
  .gk-tile:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 30%, transparent); }
  .gk-tile--correct { border-color: var(--success); background: var(--success-light); color: var(--success); box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 32%, transparent), 0 8px 30px color-mix(in srgb, var(--success) 28%, transparent); animation: gk-correct .4s var(--ease, ease-out); }
  .gk-tile--wrong { border-color: var(--error); background: var(--error-light); color: var(--error); animation: gk-shake .36s ease-in-out; }
  .gk-tile--dim { opacity: .4; }
  /* 리빌·잠금 상태는 disabled 대신 aria-disabled 로 — disabled 를 걸면 포커스가 즉시
     날아가 키보드 사용자가 방금 답한 타일을 잃는다(4지선다 계열 전 게임 공통 버그). */
  .gk-tile[aria-disabled="true"] { pointer-events: none; }
  .gk-tile[aria-disabled="true"]:not(.gk-tile--correct):not(.gk-tile--wrong) { opacity: .45; }

  /* ── 남은 시간 게이지 ── */
  .gk-timer { display: flex; align-items: center; gap: 8px; min-width: 96px; }
  .gk-timer-track { flex: 1; height: 6px; border-radius: 999px; background: color-mix(in srgb, var(--t1) 12%, transparent); overflow: hidden; }
  .gk-timer-fill { height: 100%; border-radius: 999px; background: var(--combo); transition: width .12s linear, background .25s; }
  .gk-timer-sec { font-size: 12px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--t3); min-width: 28px; text-align: right; }
  .gk-timer[data-warn="1"] .gk-timer-fill { background: var(--error); animation: gk-timer-pulse .62s ease-in-out infinite; }
  .gk-timer[data-warn="1"] .gk-timer-sec { color: var(--error); }
  @keyframes gk-timer-pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }

  /* ── 목숨 pip — 색만이 아니라 채움/빔으로도 구분(색각 대응) ── */
  .gk-pips { display: inline-flex; align-items: center; gap: 5px; }
  .gk-pip { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid color-mix(in srgb, var(--t1) 34%, transparent); background: transparent; transition: background .2s, border-color .2s, transform .2s var(--ease-spring); }
  .gk-pip[data-on="1"] { background: var(--streak, var(--combo)); border-color: var(--streak, var(--combo)); }
  .gk-pip[data-on="0"] { transform: scale(.82); }

  /* ── 정답/오답 아이콘 — 색+아이콘+모션 3중 피드백의 아이콘 축 ── */
  .gk-fbicon { flex: none; vertical-align: -2px; }
  .gk-combo-mult { margin-left: 6px; font-size: .78em; font-weight: 800; opacity: .85; }

  .gk-btn { min-height: 48px; padding: 0 24px; border-radius: var(--r-md, 10px); border: 1px solid var(--bd); background: var(--bg); color: var(--t1); font-family: var(--font-display, system-ui); font-size: 15px; font-weight: 700; cursor: pointer; transition: transform .2s var(--ease-spring), background .15s, border-color .15s; }
  .gk-btn:hover { border-color: var(--t3); }
  .gk-btn:active { transform: scale(.97); }
  .gk-btn--primary { background: var(--combo); border-color: var(--combo); color: var(--ti); }
  .gk-btn--primary:hover { filter: brightness(1.08); border-color: var(--combo); }
  .gk-btn:disabled { opacity: .5; cursor: default; }

  .gk-done { position: relative; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 30px; padding: 24px; }
  .gk-done-burst { position: absolute; top: 34%; left: 50%; width: 0; height: 0; }
  .gk-done-mark { width: 66px; height: 66px; display: grid; place-items: center; border-radius: 20px; color: var(--t1); background: color-mix(in srgb, var(--bg) 60%, transparent); border: 1px solid color-mix(in srgb, var(--t1) 12%, transparent); box-shadow: 0 14px 36px -12px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.5); backdrop-filter: blur(6px); animation: gk-pop .5s var(--ease, ease-out); }
  .gk-done-mark svg { width: 36px; height: 36px; opacity: .82; }
  .gk-done-lead { margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: clamp(22px, 5vw, 32px); font-weight: 500; color: var(--t1); animation: gk-pop .5s var(--ease, ease-out); text-align: center; }
  .gk-done-stats { display: flex; gap: clamp(18px, 6vw, 52px); flex-wrap: wrap; justify-content: center; }
  .gk-done-stat { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .gk-done-num { font-size: clamp(24px, 6vw, 38px); font-weight: 800; font-variant-numeric: tabular-nums; color: var(--t1); }
  .gk-done-lbl { font-size: 12px; font-weight: 700; color: var(--t3); text-align: center; }
  .gk-done-actions { display: flex; gap: 12px; }
  /* 끝화면을 "다음 판의 발판"으로 만드는 슬롯들 — 전부 조용한 톤(폭죽 금지 원칙 유지). */
  .gk-done-badge { display: inline-flex; align-items: center; gap: 7px; padding: 6px 14px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--streak, var(--combo)) 45%, var(--bd)); background: color-mix(in srgb, var(--streak, var(--combo)) 12%, transparent); color: var(--t1); font-size: 12.5px; font-weight: 800; letter-spacing: -.01em; }
  .gk-done-reveal { max-width: min(560px, 92vw); padding: 14px 18px; border-radius: var(--r-lg, 14px); border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 72%, transparent); color: var(--t2); font-size: 14px; line-height: 1.7; }
  .gk-done-best { margin: -14px 0 0; font-size: 13px; font-weight: 700; color: var(--t3); font-variant-numeric: tabular-nums; text-align: center; }
  .gk-done-best[data-improved="1"] { color: var(--streak, var(--combo)); }
  .gk-done-hint { margin: -18px 0 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13.5px; color: var(--t3); text-align: center; }
  .gk-done-footer { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: min(600px, 92vw); }

  .gk-burst { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; overflow: visible; }
  .gk-particle { position: absolute; border-radius: 50%; animation: gk-particle .66s var(--ease, cubic-bezier(.2,.7,.3,1)) forwards; }

  .gk-kbd { font-family: var(--font-display, monospace); font-size: 11px; padding: 1px 5px; border-radius: 5px; border: 1px solid var(--bd); background: var(--bg); }

  .gk-loading, .gk-empty { width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: var(--bg2); color: var(--t2); padding: 24px; text-align: center; }
  .gk-spinner { width: 32px; height: 32px; border-radius: 50%; border: 3px solid var(--bd); border-top-color: var(--combo); animation: gk-spin .8s linear infinite; }
  .gk-loading-text { font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 700; }
  .gk-empty-emoji { font-size: 40px; }
  .gk-empty-title { margin: 0; font-family: var(--font-display, system-ui); font-size: 18px; font-weight: 800; color: var(--t1); }
  .gk-empty-sub { margin: 0; font-size: 14px; color: var(--t3); max-width: 34ch; }

  @keyframes gk-pop { 0% { transform: scale(.9); } 50% { transform: scale(1.06); } 100% { transform: scale(1); } }
  .gk-bump { animation: gk-pop .3s var(--ease, ease-out); }
  @keyframes gk-correct { 0% { transform: scale(1); } 16% { transform: scale(.97); } 55% { transform: scale(1.06); } 100% { transform: scale(1); } }
  @keyframes gk-shake { 0%,100% { transform: translateX(0); } 18% { transform: translateX(-7px); } 38% { transform: translateX(7px); } 58% { transform: translateX(-5px); } 78% { transform: translateX(4px); } }
  @keyframes gk-gain { 0% { opacity: 0; transform: translateY(8px) scale(.8); } 25% { opacity: 1; transform: translateY(-2px) scale(1.1); } 100% { opacity: 0; transform: translateY(-22px) scale(1); } }
  @keyframes gk-particle { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(var(--tx), var(--ty)) scale(.2); opacity: 0; } }
  @keyframes gk-spin { to { transform: rotate(360deg); } }

  @keyframes gk-rm-fade { from { opacity: .45; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    .gk-tile, .gk-btn, .gk-progress-fill, .gk-combo, .gk-energy { transition: none; }
    /* 모션 제거 대신 잔잔한 페이드로 대체 — 전정계 자극 없이도 피드백이 살아있게. */
    .gk-tile--correct, .gk-tile--wrong { animation: gk-rm-fade .28s ease !important; }
    .gk-bump, .gk-done-lead { animation: none !important; }
    .gk-particle { display: none; }
    .gk-spinner { animation-duration: 2s; }
  }
`;
