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
   *
   * voices 는 비동기 로드(voiceschanged)라 첫 발화 전 ensureVoices() 로 대기 —
   * 동기 getVoices() 는 첫 호출 시 빈 배열이라 영어 음성 미선택 → 잘못된 언어/무음 발생.
   */
  async speak(options: SpeakOptions): Promise<void> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const voices = await ensureVoices();
    if (this.cancelled) return;

    return new Promise((resolve) => {
      this.cancel();
      this.cancelled = false;

      const u = new SpeechSynthesisUtterance(options.text);
      u.lang = 'en-US';
      u.rate = options.rate ?? 0.9;
      u.pitch = 1;
      u.volume = 1;

      // 음성 선택 — 지정 voiceURI → en-US(고품질/기본) → 임의 영어 순
      const picked =
        (options.voiceURI && voices.find((vv) => vv.voiceURI === options.voiceURI)) ||
        pickEnglishVoice(voices);
      if (picked) {
        u.voice = picked;
        u.lang = picked.lang;
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
 * 사용 가능한 영어 음성 목록 (동기 — 즉시성용. 첫 로드엔 빈 배열일 수 있어 UI 는 ensureVoices 권장).
 */
export function getEnglishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
}

// ─── voices 비동기 로드 대응 ───
let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

/**
 * 음성 목록이 로드될 때까지 대기 후 반환. getVoices() 즉시 비면 voiceschanged 를 기다리되
 * 1.5s 타임아웃으로 폴백(일부 브라우저는 이벤트를 안 쏨). 결과는 프로세스 1회 캐시.
 */
export function ensureVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve([]);
  }
  const synth = window.speechSynthesis;
  const immediate = synth.getVoices();
  if (immediate.length > 0) return Promise.resolve(immediate);
  if (voicesPromise) return voicesPromise;

  voicesPromise = new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      synth.removeEventListener('voiceschanged', onChange);
      resolve(synth.getVoices());
    };
    const onChange = () => finish();
    synth.addEventListener('voiceschanged', onChange);
    setTimeout(finish, 1500); // 이벤트 미발화 브라우저 폴백
  });
  return voicesPromise;
}

/** 영어 음성 선택 — en-US 우선(자연스러움), 없으면 임의 영어. 없으면 null. */
export function pickEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => v.lang.startsWith('en'));
  if (en.length === 0) return null;
  return en.find((v) => v.lang === 'en-US') ?? en.find((v) => v.default) ?? en[0];
}

/** 영어 음성 사용 가능 여부 — 비동기 로드 대기 후 판정(UI 안내용). */
export async function hasEnglishVoice(): Promise<boolean> {
  const voices = await ensureVoices();
  return voices.some((v) => v.lang.startsWith('en'));
}
