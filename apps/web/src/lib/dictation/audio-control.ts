// apps/web/src/lib/dictation/audio-control.ts
// Web Speech API (SpeechSynthesis) 기반 TTS 컨트롤
// - Phonological Loop: 입력 시 음성 멈춤 (선택)
// - 속도/음색 조절
// - 자동 반복 + 구간 사이 무음 간격

export interface SpeakOptions {
  text: string;
  rate?: number; // 0.5 ~ 1.5
  voiceURI?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (e: SpeechSynthesisErrorEvent) => void;
}

export class AudioController {
  private utterance: SpeechSynthesisUtterance | null = null;
  private cancelled = false;

  /**
   * 단발 발화. Promise 가 끝나면 발화 완료.
   */
  speak(options: SpeakOptions): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve();
        return;
      }

      this.cancel();
      this.cancelled = false;

      const u = new SpeechSynthesisUtterance(options.text);
      u.lang = 'en-US';
      u.rate = options.rate ?? 0.9;
      u.pitch = 1;
      u.volume = 1;

      if (options.voiceURI) {
        const voices = window.speechSynthesis.getVoices();
        const v = voices.find((vv) => vv.voiceURI === options.voiceURI);
        if (v) u.voice = v;
      } else {
        const voices = window.speechSynthesis.getVoices();
        const en = voices.find((v) => v.lang.startsWith('en'));
        if (en) u.voice = en;
      }

      u.onstart = () => options.onStart?.();
      u.onend = () => {
        options.onEnd?.();
        resolve();
      };
      u.onerror = (e) => {
        options.onError?.(e);
        resolve();
      };

      this.utterance = u;
      window.speechSynthesis.speak(u);
    });
  }

  /**
   * 자동 반복 발화 (구간 사이 pauseMs 만큼 무음).
   */
  async repeat(
    text: string,
    times: number,
    rate: number,
    pauseMs: number = 1500,
    voiceURI?: string,
    onIteration?: (current: number) => void
  ): Promise<void> {
    for (let i = 0; i < times; i++) {
      if (this.cancelled) return;
      onIteration?.(i + 1);
      await this.speak({ text, rate, voiceURI });
      if (this.cancelled || i === times - 1) break;
      await this.delay(pauseMs);
    }
  }

  pause(): void {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.pause();
  }

  resume(): void {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.resume();
  }

  cancel(): void {
    this.cancelled = true;
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    this.utterance = null;
  }

  isSpeaking(): boolean {
    if (typeof window === 'undefined') return false;
    return window.speechSynthesis.speaking;
  }

  isPaused(): boolean {
    if (typeof window === 'undefined') return false;
    return window.speechSynthesis.paused;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        if (this.cancelled) return;
        resolve();
      }, ms);
      // 취소 시 즉시 resolve
      const check = setInterval(() => {
        if (this.cancelled) {
          clearTimeout(t);
          clearInterval(check);
          resolve();
        }
      }, 100);
      setTimeout(() => clearInterval(check), ms);
    });
  }
}

/**
 * 사용 가능한 영어 음성 목록.
 */
export function getEnglishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
}
