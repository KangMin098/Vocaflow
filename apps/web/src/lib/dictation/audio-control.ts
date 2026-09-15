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
  /**
   * 재생 세대(generation). `cancel()` 이 올리고, 각 호출은 자기 세대를 들고 다닌다.
   *
   * ⚠️ 예전엔 `cancelled` **불리언**이었고 `speak()` 가 그것을 **리셋하기 전에 검사**했다.
   *    그래서 한 번 `cancel()` 이 불리면 그 뒤의 모든 재생이 조용히 즉시 반환됐다 —
   *    제출·다음·건너뛰기·Esc 가 전부 `stop()` 을 부르므로 **첫 문항을 넘기는 순간
   *    받아쓰기에 소리가 영영 안 났다**(사용자 신고 2026-08-16 "재생 버튼 안됨").
   *    세대 번호는 "이 호출이 아직 최신인가" 만 묻기 때문에 그 상태가 눌어붙지 않는다.
   */
  private generation = 0;

  /**
   * 단발 발화. Promise 가 끝나면 발화 완료.
   *
   * voices 는 비동기 로드(voiceschanged)라 첫 발화 전 ensureVoices() 로 대기 —
   * 동기 getVoices() 는 첫 호출 시 빈 배열이라 영어 음성 미선택 → 잘못된 언어/무음 발생.
   */
  async speak(options: SpeakOptions): Promise<void> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    // 이 호출이 최신 재생이 된다. 진행 중이던 발화는 여기서 끊는다.
    const gen = this.supersede();

    const voices = await ensureVoices();
    // 음성 목록을 기다리는 사이에 정지되었거나 새 재생이 시작됐으면 이 호출은 버린다.
    // (예전 불리언 방식은 이 판정이 **다음 재생까지 눌어붙어** 소리를 영영 죽였다.)
    if (gen !== this.generation) return;
    return this.utter(voices, options, gen);
  }

  /**
   * 실제 발화 한 번. **어떤 경로로 끝나든 반드시 resolve 한다** —
   * 안 끝나면 호출부의 `isPlaying` 이 참에 갇혀 재생 버튼이 죽는다.
   */
  private utter(
    voices: SpeechSynthesisVoice[],
    options: SpeakOptions,
    gen: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      const timer: { id?: ReturnType<typeof setTimeout> } = {};
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (timer.id) clearTimeout(timer.id);
        resolve();
      };

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
        finish();
      };
      u.onerror = (e) => {
        options.onError?.(e);
        finish();
      };

      this.utterance = u;
      window.speechSynthesis.speak(u);

      // 브라우저가 발화를 조용히 흘리면 onend/onerror 가 영영 안 온다(알려진 동작).
      // 그때도 이 Promise 는 끝나야 한다 — 대략 읽는 데 걸릴 시간의 넉넉한 상한을 둔다.
      const budgetMs = Math.min(120_000, 4_000 + options.text.length * 120);
      timer.id = setTimeout(() => {
        if (gen === this.generation) window.speechSynthesis.cancel();
        finish();
      }, budgetMs);
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
    // 반복 전체가 하나의 재생이다 — 시작 시점의 세대를 들고 다니며 "아직 최신인가" 만 본다.
    const gen = this.supersede();
    for (let i = 0; i < times; i++) {
      if (gen !== this.generation) return;
      onIteration?.(i + 1);
      // speak 은 자기 세대를 다시 올리므로, 그 값을 이어받아 다음 회차 판정에 쓴다.
      await this.speakWithin(gen, { text, rate, voiceURI });
      if (gen !== this.generation || i === times - 1) break;
      await this.delay(pauseMs, gen);
    }
  }

  /**
   * 세대를 새로 올리지 않고 발화한다 — `repeat` 의 각 회차용.
   * (회차마다 세대를 올리면 자기 자신을 무효화해 두 번째 회차가 즉시 끊긴다.)
   */
  private async speakWithin(gen: number, options: SpeakOptions): Promise<void> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = await ensureVoices();
    if (gen !== this.generation) return;
    return this.utter(voices, options, gen);
  }

  pause(): void {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.pause();
  }

  resume(): void {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.resume();
  }

  /** 진행 중이던 발화를 무효화하고 새 세대 번호를 돌려준다. */
  private supersede(): number {
    this.generation += 1;
    if (typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
      this.utterance = null;
    }
    return this.generation;
  }

  cancel(): void {
    // 세대만 올린다 — 플래그를 세워 두지 않으므로 **다음 재생이 정상으로 시작한다.**
    this.supersede();
  }

  isSpeaking(): boolean {
    if (typeof window === 'undefined') return false;
    return window.speechSynthesis.speaking;
  }

  isPaused(): boolean {
    if (typeof window === 'undefined') return false;
    return window.speechSynthesis.paused;
  }

  /**
   * 회차 사이 무음. 정지되면(세대가 바뀌면) 즉시 끝난다.
   *
   * ⚠️ 예전 구현은 취소 시 `resolve` 를 **안 부르는 경로**가 있었다(타이머가 먼저 끝나고
   *    cancelled 가 참이면 그대로 반환). 그러면 반복이 멈춘 채 Promise 가 안 끝나 호출부의
   *    `isPlaying` 이 참에 갇힌다 — 재생 버튼이 죽는 또 하나의 길이었다.
   *    여기서는 **어떤 경우에도 resolve 한다.**
   */
  private delay(ms: number, gen: number): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(t);
        clearInterval(check);
        resolve();
      };
      const t = setTimeout(finish, ms);
      const check = setInterval(() => {
        if (gen !== this.generation) finish();
      }, 100);
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
