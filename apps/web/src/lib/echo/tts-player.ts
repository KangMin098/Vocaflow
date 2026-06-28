// apps/web/src/lib/echo/tts-player.ts
//
// EchoMatch Layer 1 — 원어민 음성 (Web Speech API).
// 텍스트 → SpeechSynthesisUtterance → MediaStream 캡처 → AudioBuffer.
//
// 참고: speechSynthesis 출력은 직접 AudioBuffer 추출 불가 (브라우저 보안).
// 우회: utterance 재생하면서 동시에 사용자 마이크 disable → 시스템 사운드 캡처는 X.
// 대안: speak() 으로 재생만 하고, 분석은 user voice 만 수행.
//       reference 의 pitch contour 는 사전 산정 or 동기 prediction.
//
// 본 모듈은:
//   - speakSentence(text, voice): Promise<duration>  — 재생만
//   - tts-controller 와 voice 선택 공유

export interface TTSPlaybackResult {
  durationMs: number
}

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function getEnglishVoices(): SpeechSynthesisVoice[] {
  if (!isTTSSupported()) return []
  const voices = window.speechSynthesis.getVoices()
  return voices.filter((v) => v.lang.toLowerCase().startsWith('en'))
}

export function speakSentence(
  text: string,
  options: { rate?: number; voiceURI?: string | null } = {},
): Promise<TTSPlaybackResult> {
  return new Promise((resolve, reject) => {
    if (!isTTSSupported()) {
      reject(new Error('Web Speech API 미지원 브라우저'))
      return
    }
    window.speechSynthesis.cancel()

    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'en-US'
    utter.rate = options.rate ?? 1.0

    if (options.voiceURI) {
      const voices = window.speechSynthesis.getVoices()
      const v = voices.find((vv) => vv.voiceURI === options.voiceURI)
      if (v) utter.voice = v
    }

    const startedAt = performance.now()
    utter.onend = () => {
      resolve({ durationMs: performance.now() - startedAt })
    }
    utter.onerror = (e) => {
      reject(new Error(`TTS 오류: ${e.error}`))
    }

    window.speechSynthesis.speak(utter)
  })
}

export function cancelTTS(): void {
  if (isTTSSupported()) {
    window.speechSynthesis.cancel()
  }
}
