// apps/web/src/lib/echo/piper-tts.ts
//
// EchoMatch Layer 1 v2 — Piper TTS WASM (100% client-side, audio Blob 직접 추출).
// Web Speech API 의 audio capture 불가 한계 해결.
// - 첫 사용 시 voice model 다운로드 (en_US-amy-medium ~17MB)
// - 이후 OPFS (Origin Private File System) 자동 캐싱
// - Blob → ArrayBuffer → AudioBuffer → extractPitchContour 직접 분석 가능

'use client'

import { TtsSession, type VoiceId, type Progress } from '@mintplex-labs/piper-tts-web'

/** 기본 voice — en_US Amy medium quality (가장 자연스러운 영어 여성 보이스) */
export const DEFAULT_PIPER_VOICE: VoiceId = 'en_US-amy-medium'

let session: TtsSession | null = null
let initPromise: Promise<TtsSession> | null = null

export interface PiperTtsResult {
  /** 합성 wav Blob (Float32 PCM 16kHz mono) */
  blob: Blob
  /** AudioBuffer 변환 결과 — extractPitchContour 입력용 */
  audioBuffer: AudioBuffer
  durationMs: number
}

let audioCtx: AudioContext | null = null
function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioCtx = new AC()
  }
  return audioCtx
}

/**
 * 세션 ensure — 첫 호출 시 모델 다운로드. progress 콜백 옵션.
 *
 * v06.33 fix — Piper default ONNX_BASE 는 cdnjs 1.18.0 의 .mjs dynamic import
 * 시도 → 실패 (`no available backend found`). onnxruntime-web 1.26.0 의 wasm 파일을
 * apps/web/public/onnx/ 로 복사 후 wasmPaths.onnxWasm 명시 → 로컬 serving.
 * piperData/piperWasm 은 jsdelivr 그대로 (별도 호스팅 안 함).
 */
export async function ensurePiperSession(
  voiceId: VoiceId = DEFAULT_PIPER_VOICE,
  onProgress?: (loaded: number, total: number, url: string) => void,
): Promise<TtsSession> {
  if (session && session.voiceId === voiceId && session.ready) return session
  if (initPromise) return initPromise

  initPromise = (async () => {
    const s = await TtsSession.create({
      voiceId,
      progress: (p: Progress) => {
        if (onProgress) onProgress(p.loaded, p.total, p.url)
      },
      wasmPaths: {
        // 로컬 onnxruntime-web 1.26.0 dist (apps/web/public/onnx/)
        onnxWasm: '/onnx/',
        // piper_phonemize jsdelivr default 유지
        piperData:
          'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.data',
        piperWasm:
          'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.wasm',
      },
    })
    session = s
    return s
  })()
  try {
    return await initPromise
  } finally {
    initPromise = null
  }
}

/** TTS 합성 → AudioBuffer. 분석/재생 모두 가능. */
export async function piperSynthesize(
  text: string,
  voiceId: VoiceId = DEFAULT_PIPER_VOICE,
): Promise<PiperTtsResult> {
  const s = await ensurePiperSession(voiceId)
  const blob = await s.predict(text)
  const arrayBuffer = await blob.arrayBuffer()
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') await ctx.resume()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  return {
    blob,
    audioBuffer,
    durationMs: (audioBuffer.length / audioBuffer.sampleRate) * 1000,
  }
}

/** AudioBuffer 재생 (이미 변환된 경우) */
export function playAudioBuffer(buffer: AudioBuffer): Promise<void> {
  const ctx = getAudioContext()
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.connect(ctx.destination)
  return new Promise((resolve) => {
    src.onended = () => resolve()
    src.start()
  })
}

/** Piper 사용 가능 여부 (WASM 지원) */
export function isPiperSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof WebAssembly !== 'undefined' &&
    'AudioContext' in window
  )
}
