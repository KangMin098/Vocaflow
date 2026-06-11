// apps/web/src/lib/workspace/speech-recognition.ts
//
// Web Speech API (SpeechRecognition) 얇은 래퍼 — 따라읽기 발화의 "대략 인식".
//
// 정책:
//   - 외부 의존 0. Chrome/Edge/Safari = webkitSpeechRecognition.
//   - 미지원 브라우저(Firefox 등)는 supported=false → 호출측이 듣기 중심 fallback.
//   - 한 문장 단위로 짧게 start → 침묵/결과 시 onend. interimResults 로 라이브 하이라이트.
//
// lib.dom 에 SpeechRecognition 타입이 없어 최소 인터페이스만 로컬 선언한다.

'use client'

interface SpeechRecognitionAlternativeLike {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly length: number
  readonly [index: number]: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionResultListLike {
  readonly length: number
  readonly [index: number]: SpeechRecognitionResultLike
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultListLike
}

interface SpeechRecognitionErrorEventLike {
  readonly error: string
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** 현재 브라우저가 음성 인식을 지원하는지. */
export function isSpeechRecognitionSupported(): boolean {
  return getCtor() !== null
}

export interface RecognizerHandlers {
  /** 중간/최종 누적 transcript (라이브 하이라이트용). */
  onInterim?: (transcript: string) => void
  /** 세션 종료 시 확정된 최종 transcript (없으면 호출 안 됨). */
  onFinal?: (transcript: string) => void
  /** 오류 (예: 'not-allowed' = 마이크 거부). */
  onError?: (error: string) => void
  /** 인식 종료 (결과·침묵·stop 어느 경우든). */
  onEnd?: () => void
}

export interface Recognizer {
  /** 인식 시작. 지원 안 되거나 start 실패 시 false. */
  start(handlers: RecognizerHandlers): boolean
  /** 정상 종료 요청 (onend 발생). */
  stop(): void
  /** 즉시 중단 (onend 미보장). */
  abort(): void
}

/**
 * 재사용 가능한 recognizer 인스턴스 생성.
 * 한 인스턴스로 여러 문장을 순차 start/stop 한다 (매 start 마다 내부 SpeechRecognition 재생성 —
 * 일부 브라우저가 재사용 인스턴스에서 onend 누락되는 문제 회피).
 */
export function createRecognizer(lang = 'en-US'): Recognizer {
  const Ctor = getCtor()
  let rec: SpeechRecognitionLike | null = null
  let active = false

  function cleanup(): void {
    if (rec) {
      rec.onresult = null
      rec.onerror = null
      rec.onend = null
      rec.onstart = null
    }
  }

  return {
    start(handlers) {
      if (!Ctor) return false
      // 이전 인스턴스 정리
      if (rec) {
        try {
          rec.abort()
        } catch {
          /* noop */
        }
        cleanup()
        rec = null
      }

      const r = new Ctor()
      r.lang = lang
      r.continuous = false
      r.interimResults = true
      r.maxAlternatives = 1

      let finalText = ''

      r.onresult = (event) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i]
          if (!result) continue
          const alt = result[0]
          if (!alt) continue
          if (result.isFinal) finalText += `${alt.transcript} `
          else interim += alt.transcript
        }
        const combined = `${finalText}${interim}`.trim()
        if (combined) handlers.onInterim?.(combined)
      }

      r.onerror = (event) => {
        handlers.onError?.(event.error)
      }

      r.onend = () => {
        active = false
        const trimmed = finalText.trim()
        if (trimmed) handlers.onFinal?.(trimmed)
        handlers.onEnd?.()
      }

      rec = r
      active = true
      try {
        r.start()
      } catch {
        active = false
        return false
      }
      return true
    },

    stop() {
      if (rec && active) {
        try {
          rec.stop()
        } catch {
          /* noop */
        }
      }
    },

    abort() {
      if (rec) {
        try {
          rec.abort()
        } catch {
          /* noop */
        }
        active = false
      }
    },
  }
}
