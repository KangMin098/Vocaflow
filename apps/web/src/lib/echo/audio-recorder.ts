// apps/web/src/lib/echo/audio-recorder.ts
//
// EchoMatch Layer 3 — getUserMedia + MediaRecorder 사용자 음성 녹음.
// noise suppression + echo cancellation + AudioBuffer 변환.

export interface RecordingResult {
  audioBuffer: AudioBuffer
  blob: Blob
  durationMs: number
}

let mediaStream: MediaStream | null = null
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

export async function requestMicAccess(): Promise<MediaStream> {
  if (mediaStream && mediaStream.active) return mediaStream
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  })
  return mediaStream
}

export function hasMicPermission(): boolean {
  return !!mediaStream && mediaStream.active
}

export function releaseMic(): void {
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop())
    mediaStream = null
  }
}

/** 녹음 시작 — stop() 으로 종료. */
export async function recordUntilStop(): Promise<{
  stop: () => Promise<RecordingResult>
  analyser: AnalyserNode
}> {
  const stream = await requestMicAccess()
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') await ctx.resume()

  // 실시간 파형 분석용 AnalyserNode
  const source = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048
  source.connect(analyser)

  // 녹음용 MediaRecorder
  const mime =
    MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : ''
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  const startedAt = performance.now()
  recorder.start()

  function stop(): Promise<RecordingResult> {
    return new Promise((resolve, reject) => {
      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: mime || 'audio/webm' })
          const arrayBuf = await blob.arrayBuffer()
          const audioBuffer = await ctx.decodeAudioData(arrayBuf)
          const durationMs = performance.now() - startedAt
          source.disconnect()
          resolve({ audioBuffer, blob, durationMs })
        } catch (e) {
          reject(e)
        }
      }
      recorder.stop()
    })
  }

  return { stop, analyser }
}

/** AudioBuffer 재생 (Promise) */
export function playAudioBuffer(buffer: AudioBuffer): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getAudioContext()
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(ctx.destination)
    src.onended = () => resolve()
    src.start()
  })
}

/** 두 AudioBuffer 동시 재생 (overlay 비교용) */
export function playBothOverlay(
  refBuffer: AudioBuffer,
  userBuffer: AudioBuffer,
): Promise<void> {
  const ctx = getAudioContext()
  const refSrc = ctx.createBufferSource()
  const userSrc = ctx.createBufferSource()
  refSrc.buffer = refBuffer
  userSrc.buffer = userBuffer

  const refGain = ctx.createGain()
  refGain.gain.value = 0.7
  const userGain = ctx.createGain()
  userGain.gain.value = 0.7

  refSrc.connect(refGain).connect(ctx.destination)
  userSrc.connect(userGain).connect(ctx.destination)

  return new Promise((resolve) => {
    let done = 0
    const maybeResolve = () => {
      done += 1
      if (done === 2) resolve()
    }
    refSrc.onended = maybeResolve
    userSrc.onended = maybeResolve
    const now = ctx.currentTime
    refSrc.start(now)
    userSrc.start(now)
  })
}
