// apps/web/src/lib/workspace/tts-controller.ts
// Phase 11.13/14/14.2 — TTS singleton with 3 modes + rich navigation
//
// 정책:
//   - 브라우저 native speechSynthesis (외부 의존 0)
//   - 3 mode: 'all' (chapter 전체) / 'paragraph' (현재 단락만) / 'sentence' (현재 문장만)
//   - sentence 단위 큐 + paragraph navigation
//   - 새 발화 시 이전 cancel
//   - 페이지 이탈 / chapter 변경 시 자동 cancel

'use client';

import { useEffect, useSyncExternalStore } from 'react';

export type PlayMode = 'all' | 'paragraph' | 'sentence' | 'step';
export type PlayState = 'idle' | 'playing' | 'paused' | 'awaiting_repeat';

export interface SentenceItem {
  paragraphId: string;
  sentenceIdx: number; // 전체 chapter 기준 0-based
  text: string;
}

export interface TTSState {
  state: PlayState;
  mode: PlayMode;
  currentParagraphId: string | null;
  currentSentenceIdx: number | null;
  totalSentences: number;
  rate: number;
  /** Phase 11.15 — 사용자 선택 voice URI (null = 브라우저 default) */
  selectedVoiceURI: string | null;
  /** Phase 11.17 — 현재 미리듣기 중인 voice URI (null = 미리듣기 없음) */
  previewingVoiceURI: string | null;
  /**
   * v06.35 — Step (따라하기) 모드 — 문장 재생 직후 자동 일시정지하고 학습자가
   * 따라 말할 시간 동안 카운트다운. 0 이 되면 자동으로 다음 문장 진행.
   * null = step mode 아님 또는 재생 중.
   */
  repeatCountdown: number | null;
  /** 카운트다운 시작 시 총 초 (UI ring 비율 계산용) */
  repeatTotalSec: number;
  /** v06.35 — Step 모드의 현재 문장 텍스트 (player 카드에 노출) */
  currentText: string | null;
}

const INITIAL: TTSState = {
  state: 'idle',
  mode: 'all',
  currentParagraphId: null,
  currentSentenceIdx: null,
  totalSentences: 0,
  rate: 1.0,
  selectedVoiceURI: null,
  previewingVoiceURI: null,
  repeatCountdown: null,
  repeatTotalSec: 0,
  currentText: null,
};

const VOICE_LS_KEY = 'vocaflow:tts:voice-uri';

class TTSController {
  private state: TTSState = { ...INITIAL };
  private listeners: Set<() => void> = new Set();
  private queue: SentenceItem[] = [];
  private currentIdx = 0;
  private cancelled = false;
  private modeStartParagraphId: string | null = null;
  // Phase 11.15 — voice cache
  private voicesCache: SpeechSynthesisVoice[] = [];
  // Phase 11.17 — preview utterance ref (cancel/state 추적)
  private previewUtter: SpeechSynthesisUtterance | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.loadVoices();
      window.speechSynthesis.addEventListener('voiceschanged', () => this.loadVoices());
      try {
        const saved = localStorage.getItem(VOICE_LS_KEY);
        if (saved) this.state = { ...this.state, selectedVoiceURI: saved };
      } catch {
        // localStorage 접근 차단 (incognito 등) — silent
      }
    }
  }

  private loadVoices(): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    this.voicesCache = window.speechSynthesis.getVoices();
    // best voice 자동 선택 — (1) LS 미설정 OR (2) 저장값이 이 기기에 없음(stale).
    //   stale 미처리 시 getSelectedVoice()=undefined → 브라우저 기본(로봇) 음성으로 강등.
    //   (LS 는 덮어쓰지 않음 — 원 기기 복귀 시 사용자 선택 보존, 이 기기선 best 사용.)
    if (this.voicesCache.length > 0) {
      const hasSelected =
        !!this.state.selectedVoiceURI &&
        this.voicesCache.some((v) => v.voiceURI === this.state.selectedVoiceURI);
      if (!hasSelected) {
        const best = pickBestVoice(this.voicesCache);
        if (best) this.state = { ...this.state, selectedVoiceURI: best.voiceURI };
      }
    }
    this.notify();
  }

  /** Voice quality 분류 — UI badge용. */
  classifyVoice(voice: SpeechSynthesisVoice): VoiceQuality {
    return classifyVoiceQuality(voice);
  }

  /**
   * Phase 11.17 — Voice 미리듣기 (toggle + 상태 추적).
   *  · 같은 voice 재클릭 → cancel
   *  · 다른 voice 클릭 → 이전 cancel + 새 preview
   *  · 메인 재생 중 → 메인 stop 후 preview (단순 정책)
   */
  previewVoice(
    voice: SpeechSynthesisVoice,
    text = 'Hello! This is a sample of my voice. The quick brown fox jumps over the lazy dog.',
  ): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // 같은 voice가 preview 중이면 toggle off
    if (this.state.previewingVoiceURI === voice.voiceURI) {
      this.cancelPreview();
      return;
    }

    // 메인 재생 중이면 stop
    if (this.state.state !== 'idle') {
      this.stop();
    }

    // 이전 preview cancel
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = voice.lang || 'en-US';
    utter.rate = 1.0; // preview는 표준 속도 (메인 rate와 분리)
    utter.voice = voice;

    utter.onend = () => {
      if (this.previewUtter === utter) {
        this.previewUtter = null;
        this.state = { ...this.state, previewingVoiceURI: null };
        this.notify();
      }
    };
    utter.onerror = () => {
      if (this.previewUtter === utter) {
        this.previewUtter = null;
        this.state = { ...this.state, previewingVoiceURI: null };
        this.notify();
      }
    };

    this.previewUtter = utter;
    this.state = { ...this.state, previewingVoiceURI: voice.voiceURI };
    this.notify();

    window.speechSynthesis.speak(utter);
  }

  /** Phase 11.17 — Preview 중단. */
  cancelPreview(): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (this.previewUtter) {
      window.speechSynthesis.cancel();
      this.previewUtter = null;
    }
    if (this.state.previewingVoiceURI !== null) {
      this.state = { ...this.state, previewingVoiceURI: null };
      this.notify();
    }
  }

  /** 영어 voices만 필터링 — 품질 best-first 정렬 (피커 상단 = 최선 음성). */
  getEnglishVoices(): SpeechSynthesisVoice[] {
    if (this.voicesCache.length === 0) this.loadVoices();
    return this.voicesCache
      .filter((v) => v.lang.toLowerCase().startsWith('en'))
      .sort((a, b) => voiceScore(b) - voiceScore(a));
  }

  /** voice 선택 — null = 브라우저 default. localStorage 저장. */
  setVoice(voiceURI: string | null): void {
    this.state = { ...this.state, selectedVoiceURI: voiceURI };
    this.notify();
    try {
      if (voiceURI) localStorage.setItem(VOICE_LS_KEY, voiceURI);
      else localStorage.removeItem(VOICE_LS_KEY);
    } catch {
      // silent
    }
  }

  /** 현재 selected voice 반환 (Utterance 적용용). */
  private getSelectedVoice(): SpeechSynthesisVoice | undefined {
    if (!this.state.selectedVoiceURI) return undefined;
    return this.voicesCache.find((v) => v.voiceURI === this.state.selectedVoiceURI);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): TTSState => this.state;

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  private hasSynth(): boolean {
    return typeof window !== 'undefined' && !!window.speechSynthesis;
  }

  /** 통합 진입 — 모드 + 큐 + 시작 인덱스. */
  playFromMode(mode: PlayMode, sentences: SentenceItem[], startIdx = 0): void {
    if (!this.hasSynth() || sentences.length === 0) return;
    this.stop();
    this.cancelled = false;
    this.queue = sentences.filter((s) => s.text.trim().length > 0);
    if (this.queue.length === 0) return;
    this.currentIdx = Math.max(0, Math.min(startIdx, this.queue.length - 1));
    const start = this.queue[this.currentIdx]!;
    this.modeStartParagraphId = start.paragraphId;
    this.state = {
      ...this.state,
      state: 'playing',
      mode,
      currentParagraphId: start.paragraphId,
      currentSentenceIdx: start.sentenceIdx,
      totalSentences: this.queue.length,
    };
    this.notify();
    this.playNext();
  }

  /** 재생 중 mode 변경 — 현재 위치에서 새 모드로 즉시 재시작. */
  setMode(mode: PlayMode): void {
    if (this.state.mode === mode) return;
    if (this.state.state === 'idle' || this.queue.length === 0) {
      this.state = { ...this.state, mode };
      this.notify();
      return;
    }
    this.cancelled = true;
    if (this.hasSynth()) window.speechSynthesis.cancel();
    this.modeStartParagraphId = this.queue[this.currentIdx]?.paragraphId ?? null;
    this.state = { ...this.state, mode };
    this.notify();
    setTimeout(() => {
      this.cancelled = false;
      this.playNext();
    }, 50);
  }

  // v06.35 — step mode countdown 타이머 핸들
  private repeatTimer: ReturnType<typeof setInterval> | null = null;
  // step mode 의 따라하기 대기 시간 (초)
  private repeatPauseSec = 3;

  private clearRepeatTimer(): void {
    if (this.repeatTimer != null) {
      clearInterval(this.repeatTimer);
      this.repeatTimer = null;
    }
  }

  private playNext(): void {
    if (this.cancelled || this.currentIdx >= this.queue.length) {
      this.finish();
      return;
    }
    const item = this.queue[this.currentIdx]!;
    this.state = {
      ...this.state,
      state: 'playing',
      currentParagraphId: item.paragraphId,
      currentSentenceIdx: item.sentenceIdx,
      currentText: item.text,
      repeatCountdown: null,
      repeatTotalSec: 0,
    };
    this.notify();

    const utter = new SpeechSynthesisUtterance(item.text);
    utter.lang = 'en-US';
    utter.rate = this.state.rate;
    const selectedVoice = this.getSelectedVoice();
    if (selectedVoice) utter.voice = selectedVoice;
    utter.onend = () => {
      if (this.cancelled) return;
      const mode = this.state.mode;

      // v06.35 — step mode: 문장 종료 후 따라하기 카운트다운 시작.
      // 시간 끝나면 자동으로 다음 문장. 사용자가 nextSentence() 누르면 즉시 진행.
      if (mode === 'step') {
        // 마지막 문장이면 그냥 종료 (다음 없음)
        if (this.currentIdx + 1 >= this.queue.length) {
          this.finish();
          return;
        }
        // 단어 수 비례 pause — 짧은 문장은 빨리, 긴 문장은 천천히 (max 8초)
        const wordCount = item.text.trim().split(/\s+/).length;
        const baseSec = Math.min(8, Math.max(2, Math.round(wordCount * 0.35)));
        const pauseSec = Math.max(this.repeatPauseSec, baseSec);
        this.startRepeatCountdown(pauseSec);
        return;
      }

      if (mode === 'sentence') {
        this.finish();
        return;
      }
      const nextIdx = this.currentIdx + 1;
      if (nextIdx >= this.queue.length) {
        this.finish();
        return;
      }
      const nextItem = this.queue[nextIdx]!;
      if (mode === 'paragraph' && nextItem.paragraphId !== this.modeStartParagraphId) {
        this.finish();
        return;
      }
      this.currentIdx = nextIdx;
      this.playNext();
    };
    utter.onerror = () => this.finish();
    window.speechSynthesis.speak(utter);
  }

  /** v06.35 — Step mode 의 따라하기 카운트다운. */
  private startRepeatCountdown(totalSec: number): void {
    this.clearRepeatTimer();
    this.state = {
      ...this.state,
      state: 'awaiting_repeat',
      repeatCountdown: totalSec,
      repeatTotalSec: totalSec,
    };
    this.notify();
    this.repeatTimer = setInterval(() => {
      if (this.cancelled) {
        this.clearRepeatTimer();
        return;
      }
      const next = (this.state.repeatCountdown ?? 0) - 1;
      if (next <= 0) {
        this.clearRepeatTimer();
        // 다음 문장 자동 진행
        if (this.currentIdx + 1 < this.queue.length) {
          this.currentIdx += 1;
          this.playNext();
        } else {
          this.finish();
        }
        return;
      }
      this.state = { ...this.state, repeatCountdown: next };
      this.notify();
    }, 1000);
  }

  private finish(): void {
    this.clearRepeatTimer();
    this.state = {
      ...INITIAL,
      mode: this.state.mode,
      rate: this.state.rate,
      selectedVoiceURI: this.state.selectedVoiceURI,
    };
    this.notify();
  }

  /** v06.35 — Step mode: 카운트다운 중 다음 문장으로 즉시 이동 (사용자 액션). */
  stepAdvance(): void {
    if (this.state.mode !== 'step') {
      this.nextSentence();
      return;
    }
    this.clearRepeatTimer();
    if (this.currentIdx + 1 < this.queue.length) {
      this.currentIdx += 1;
      this.modeStartParagraphId = this.queue[this.currentIdx]!.paragraphId;
      this.playNext();
    } else {
      this.finish();
    }
  }

  /** v06.35 — Step mode: 현재 문장 다시 듣기. */
  stepReplay(): void {
    if (this.state.mode !== 'step' || this.queue.length === 0) return;
    this.clearRepeatTimer();
    this.cancelled = true;
    if (this.hasSynth()) window.speechSynthesis.cancel();
    setTimeout(() => {
      this.cancelled = false;
      this.playNext();
    }, 50);
  }

  /** sentence 단위 — 다음 문장. */
  nextSentence(): void {
    if (!this.hasSynth() || this.queue.length === 0) return;
    if (this.currentIdx + 1 >= this.queue.length) {
      this.stop();
      return;
    }
    this.cancelled = true;
    window.speechSynthesis.cancel();
    setTimeout(() => {
      this.cancelled = false;
      this.currentIdx += 1;
      this.modeStartParagraphId = this.queue[this.currentIdx]!.paragraphId;
      this.playNext();
    }, 50);
  }

  /** sentence 단위 — 이전 문장. */
  prevSentence(): void {
    if (!this.hasSynth() || this.queue.length === 0) return;
    this.cancelled = true;
    window.speechSynthesis.cancel();
    setTimeout(() => {
      this.cancelled = false;
      if (this.currentIdx > 0) this.currentIdx -= 1;
      this.modeStartParagraphId = this.queue[this.currentIdx]!.paragraphId;
      this.playNext();
    }, 50);
  }

  /** paragraph 단위 — 다음 단락 첫 문장. */
  nextParagraph(): void {
    if (!this.hasSynth() || this.queue.length === 0) return;
    const currentParagraphId = this.queue[this.currentIdx]?.paragraphId;
    const nextIdx = this.queue.findIndex(
      (item, i) => i > this.currentIdx && item.paragraphId !== currentParagraphId,
    );
    if (nextIdx < 0) {
      this.stop();
      return;
    }
    this.cancelled = true;
    window.speechSynthesis.cancel();
    setTimeout(() => {
      this.cancelled = false;
      this.currentIdx = nextIdx;
      this.modeStartParagraphId = this.queue[this.currentIdx]!.paragraphId;
      this.playNext();
    }, 50);
  }

  /** paragraph 단위 — 이전 단락 첫 문장 (또는 현재 단락 처음). */
  prevParagraph(): void {
    if (!this.hasSynth() || this.queue.length === 0) return;
    const currentParagraphId = this.queue[this.currentIdx]?.paragraphId;
    if (!currentParagraphId) return;

    const currentParaStart = this.queue.findIndex(
      (item) => item.paragraphId === currentParagraphId,
    );
    let targetIdx: number;
    if (this.currentIdx > currentParaStart) {
      targetIdx = currentParaStart;
    } else {
      let prevParaIdx = -1;
      for (let i = currentParaStart - 1; i >= 0; i -= 1) {
        const it = this.queue[i]!;
        if (it.paragraphId !== currentParagraphId) {
          // 이전 paragraph의 첫 sentence 찾기
          const prevPid = it.paragraphId;
          for (let j = 0; j < this.queue.length; j += 1) {
            if (this.queue[j]!.paragraphId === prevPid) {
              prevParaIdx = j;
              break;
            }
          }
          break;
        }
      }
      targetIdx = prevParaIdx >= 0 ? prevParaIdx : 0;
    }

    this.cancelled = true;
    window.speechSynthesis.cancel();
    setTimeout(() => {
      this.cancelled = false;
      this.currentIdx = targetIdx;
      this.modeStartParagraphId = this.queue[this.currentIdx]!.paragraphId;
      this.playNext();
    }, 50);
  }

  pause(): void {
    if (!this.hasSynth() || this.state.state !== 'playing') return;
    window.speechSynthesis.pause();
    this.state = { ...this.state, state: 'paused' };
    this.notify();
  }

  resume(): void {
    if (!this.hasSynth() || this.state.state !== 'paused') return;
    window.speechSynthesis.resume();
    this.state = { ...this.state, state: 'playing' };
    this.notify();
  }

  stop(): void {
    if (!this.hasSynth()) return;
    this.clearRepeatTimer();
    this.cancelled = true;
    window.speechSynthesis.cancel();
    this.queue = [];
    this.currentIdx = 0;
    this.modeStartParagraphId = null;
    this.state = {
      ...INITIAL,
      mode: this.state.mode,
      rate: this.state.rate,
      selectedVoiceURI: this.state.selectedVoiceURI,
    };
    this.notify();
  }

  setRate(rate: number): void {
    this.state = { ...this.state, rate };
    this.notify();
  }
}

const controller = new TTSController();

export function useTTS() {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  return {
    state,
    playFromMode: controller.playFromMode.bind(controller),
    setMode: controller.setMode.bind(controller),
    nextSentence: controller.nextSentence.bind(controller),
    prevSentence: controller.prevSentence.bind(controller),
    nextParagraph: controller.nextParagraph.bind(controller),
    prevParagraph: controller.prevParagraph.bind(controller),
    pause: controller.pause.bind(controller),
    resume: controller.resume.bind(controller),
    stop: controller.stop.bind(controller),
    setRate: controller.setRate.bind(controller),
    setVoice: controller.setVoice.bind(controller),
    getEnglishVoices: controller.getEnglishVoices.bind(controller),
    classifyVoice: controller.classifyVoice.bind(controller),
    previewVoice: controller.previewVoice.bind(controller),
    cancelPreview: controller.cancelPreview.bind(controller),
    // v06.35 — Step (따라하기) 모드 액션
    stepAdvance: controller.stepAdvance.bind(controller),
    stepReplay: controller.stepReplay.bind(controller),
  };
}

// ─────────────────────────────────────────────
// Voice quality classification & smart default selection
// ─────────────────────────────────────────────

export type VoiceQuality = 'neural' | 'premium' | 'standard';

// 품질 등급(배지용). "Google"(Chrome 클라우드 WaveNet)·Online(Edge neural)·Siri 도 고품질.
const NEURAL_RE = /neural|natural|wavenet|studio|\bonline\b|\bgoogle\b/i;
const PREMIUM_RE = /siri|premium|enhanced/i;
// 잘 알려진 양질 named 음성 (동급 내 선호 — 학습용 명료/자연).
const PREFERRED_RE = /\b(aria|jenny|ava|emma|michelle|guy|eric|samantha|allison|libby|sonia)\b/i;
// 레거시 로컬(로봇 음질) — 감점. espeak(Linux) + 구형 MS SAPI5.
const LEGACY_BAD_RE = /espeak|\b(david|zira|mark|hazel|george)\b/i;

function classifyVoiceQuality(voice: SpeechSynthesisVoice): VoiceQuality {
  const name = voice.name;
  if (NEURAL_RE.test(name)) return 'neural';
  if (PREMIUM_RE.test(name)) return 'premium';
  return 'standard';
}

/**
 * Voice 품질 점수 — best 자동 선택 + 피커 정렬 공용 SSoT.
 * 음질 키워드 우선(클라우드 neural > Google > premium > 양질 named > 표준),
 * 레거시 로컬 감점, 로케일(en-US 우선). localService 는 품질 신호 아님 → 미반영
 * (최고 음질은 클라우드 neural=non-local · macOS premium=local — 이름 기반 판정).
 */
export function voiceScore(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let s = 0;
  if (/neural|natural|wavenet|studio/.test(name)) s += 100;
  else if (/\bonline\b/.test(name)) s += 95; // Edge online (neural backend)
  else if (/\bgoogle\b/.test(name)) s += 85; // Chrome 클라우드 (WaveNet)
  else if (PREMIUM_RE.test(name)) s += 70; // Apple Siri / Premium / Enhanced
  else if (/samantha|ava|allison|serena|karen|moira|tessa|fiona|daniel|arthur|martha/.test(name))
    s += 45; // Apple 기본 named (로컬이지만 양호)
  if (LEGACY_BAD_RE.test(name)) s -= 60; // 로봇 음질 강등
  if (lang.startsWith('en-us')) s += 15;
  else if (lang.startsWith('en-gb')) s += 10;
  else if (lang.startsWith('en')) s += 4;
  if (PREFERRED_RE.test(name)) s += 8; // 동급 내 학습 친화 음성 nudge
  if (voice.default) s += 2;
  return s;
}

/**
 * best voice 자동 선택 (LS 미설정 또는 저장값 무효 시).
 * 영어 음성 중 voiceScore 최고. 영어 없으면 전체 default/첫 항목.
 */
function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const englishVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  if (englishVoices.length === 0) return voices.find((v) => v.default) ?? voices[0] ?? null;
  let best = englishVoices[0]!;
  let bestScore = voiceScore(best);
  for (const v of englishVoices) {
    const sc = voiceScore(v);
    if (sc > bestScore) {
      best = v;
      bestScore = sc;
    }
  }
  return best;
}

/** 페이지 이탈 시 자동 stop. */
export function useTTSCleanup(): void {
  useEffect(() => {
    return () => {
      controller.stop();
    };
  }, []);
}
