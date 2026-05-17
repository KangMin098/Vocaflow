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

export type PlayMode = 'all' | 'paragraph' | 'sentence';
export type PlayState = 'idle' | 'playing' | 'paused';

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
    // Phase 11.15.3 — LS 저장값이 없으면 best voice 자동 선택 (Edge Neural/Online > Chrome Google > 로컬)
    if (!this.state.selectedVoiceURI && this.voicesCache.length > 0) {
      const best = pickBestVoice(this.voicesCache);
      if (best) {
        this.state = { ...this.state, selectedVoiceURI: best.voiceURI };
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

  /** 영어 voices만 필터링. */
  getEnglishVoices(): SpeechSynthesisVoice[] {
    if (this.voicesCache.length === 0) this.loadVoices();
    return this.voicesCache.filter((v) => v.lang.toLowerCase().startsWith('en'));
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

  private playNext(): void {
    if (this.cancelled || this.currentIdx >= this.queue.length) {
      this.finish();
      return;
    }
    const item = this.queue[this.currentIdx]!;
    this.state = {
      ...this.state,
      currentParagraphId: item.paragraphId,
      currentSentenceIdx: item.sentenceIdx,
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

  private finish(): void {
    this.state = {
      ...INITIAL,
      mode: this.state.mode,
      rate: this.state.rate,
    };
    this.notify();
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
  };
}

// ─────────────────────────────────────────────
// Voice quality classification & smart default selection
// ─────────────────────────────────────────────

export type VoiceQuality = 'neural' | 'premium' | 'standard';

const NEURAL_KEYWORDS = [
  'Neural',
  'Natural',
  'Online', // Edge online voices = Neural backend
  'WaveNet',
  'Studio',
];
const PREMIUM_KEYWORDS = ['Premium', 'Enhanced'];

function classifyVoiceQuality(voice: SpeechSynthesisVoice): VoiceQuality {
  const name = voice.name;
  if (NEURAL_KEYWORDS.some((kw) => name.includes(kw))) return 'neural';
  if (PREMIUM_KEYWORDS.some((kw) => name.includes(kw))) return 'premium';
  return 'standard';
}

/**
 * 사용자 LS 미설정 시 best voice 자동 선택.
 * 우선순위: Neural > Premium > Standard.
 * 동일 등급 내: en-US > en-GB > en-* > 기타. localService 가산점.
 */
function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const englishVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  if (englishVoices.length === 0) return voices[0] ?? null;

  const scored = englishVoices.map((voice) => {
    let score = 0;
    const quality = classifyVoiceQuality(voice);
    if (quality === 'neural') score += 100;
    else if (quality === 'premium') score += 50;
    if (voice.localService) score += 20;
    if (voice.default) score += 10;
    const lang = voice.lang.toLowerCase();
    if (lang.startsWith('en-us')) score += 15;
    else if (lang.startsWith('en-gb')) score += 10;
    return { voice, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.voice ?? null;
}

/** 페이지 이탈 시 자동 stop. */
export function useTTSCleanup(): void {
  useEffect(() => {
    return () => {
      controller.stop();
    };
  }, []);
}
