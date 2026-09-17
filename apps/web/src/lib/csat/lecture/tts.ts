// apps/web/src/lib/csat/lecture/tts.ts
//
// **TTS 어댑터 — 소리를 내는 쪽은 이 파일 하나만 안다.**
//
// 대본·큐·하이라이트는 엔진이 무엇인지 모른다. 지금은 브라우저 Web Speech 이고, 서버 TTS 로
// 바꾸는 날에는 이 인터페이스를 구현한 새 어댑터 하나만 더하면 된다.
//
// ── Web Speech 에서 실제로 부딪히는 것 (Gate 0 프로브가 재는 것들) ─────────────
//   · 긴 발화가 중간에 끊긴다(Chrome 의 클라우드 음성) → 조각을 **문장 단위 발화**로 더 쪼갠다
//   · `onend` 가 안 오는 발화가 있다(GC 로 사라진 발화 객체) → 발화 객체를 붙들고, 감시 시한을 둔다
//   · `pause()`/`resume()` 이 음성마다 다르게 군다 → **멈춤 = 지금 문장 취소, 재개 = 그 문장부터 다시**.
//     문장은 짧으니(대개 3초 안) 한 문장 되풀이가 「어디까지 들었지」보다 낫다
//   · 한/영이 한 발화에 섞이면 발음이 무너진다 → 조각마다 `lang` 과 그 언어의 목소리를 따로 준다
//   · 음성이 아예 없는 기기 → 무음 어댑터로 바꿔 하이라이트만 진행한다

import { koSentences } from './speakable'
import type { LectureCue, LectureSegment, SegmentLang } from './types'

export interface CueOutcome {
  /** 끝까지 읽었는가 (취소되면 false) */
  completed: boolean
  cancelled: boolean
  /** 발화 오류 — 취소로 생긴 interrupted/canceled 는 세지 않는다 */
  errors: string[]
  /** 읽은 발화 수 / 계획한 발화 수 */
  spoken: number
  planned: number
}

export interface TtsAdapter {
  readonly kind: 'webspeech' | 'silent'
  speak(cue: LectureCue): Promise<CueOutcome>
  pause(): void
  resume(): void
  cancel(): void
  setRate(rate: number): void
  onCueStart?: (cue: LectureCue) => void
  onCueEnd?: (cue: LectureCue, outcome: CueOutcome) => void
  /** 발화 하나가 시작될 때(프로브·검사용) */
  onUtterance?: (e: { cueId: string; lang: SegmentLang; index: number; at: number }) => void
  /** 발화 하나가 끝날 때(프로브·검사용) */
  onUtteranceEnd?: (e: { cueId: string; lang: SegmentLang; index: number; at: number }) => void
  /**
   * 「말하라」고 한 뒤 실제로 소리가 나기까지 걸리는 시간(ms) — 실측 이동평균.
   * 엔진은 큐 사이 쉼에서 이만큼을 **먼저 출발**시켜, 들리는 쉼이 대본의 쉼과 같아지게 한다.
   * (실측 2026-09-17: Chrome 의 네트워크 음성은 이 준비가 쉼 위에 그대로 얹혀 큐 사이가 최대 396ms 늘어졌다)
   */
  readonly leadMs: number
}

/** 조각을 발화 단위로 — 한국어는 문장마다, 영어는 조각째(대개 짧은 구절이다) */
export function utterancePlan(segments: LectureSegment[]): LectureSegment[] {
  const out: LectureSegment[] = []
  for (const g of segments) {
    if (g.lang === 'ko-KR') for (const s of koSentences(g.text)) out.push({ lang: g.lang, text: s })
    else if (g.text.trim()) out.push({ lang: g.lang, text: g.text.trim() })
  }
  return out
}

export interface VoiceLike {
  name: string
  lang: string
  localService: boolean
  default?: boolean
}

/**
 * 언어별 목소리 고르기. **자연스러움 우선**: Natural(Edge) → Google(Chrome) → 기기 음성.
 * 정확히 같은 언어가 없으면 언어 앞부분(ko)만 맞는 것 → 없으면 null.
 */
export function pickVoice<T extends VoiceLike>(voices: readonly T[], lang: SegmentLang): T | null {
  const norm = (s: string) => s.replace('_', '-').toLowerCase()
  const exact = voices.filter((v) => norm(v.lang) === lang.toLowerCase())
  const pool = exact.length ? exact : voices.filter((v) => norm(v.lang).startsWith(lang.slice(0, 2).toLowerCase()))
  if (!pool.length) return null
  const score = (v: T) =>
    (/natural/i.test(v.name) ? 4 : 0) +
    (/multilingual/i.test(v.name) ? -1 : 0) +
    (/google/i.test(v.name) ? 3 : 0) +
    (v.default ? 1 : 0)
  return [...pool].sort((a, b) => score(b) - score(a))[0] ?? null
}

/** 이 기기에서 목소리를 받는다. 목록은 늦게 오므로 잠깐 기다린다. */
export function loadVoices(timeoutMs = 2500): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve([])
  const now = window.speechSynthesis.getVoices()
  if (now.length) return Promise.resolve(now)
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', done)
      resolve(window.speechSynthesis.getVoices())
    }
    window.speechSynthesis.addEventListener('voiceschanged', done)
    window.setTimeout(done, timeoutMs)
  })
}

/** 소리 없이 시간만 흐르는 어댑터 — 음성이 없는 기기에서 하이라이트만 진행한다 */
export class SilentAdapter implements TtsAdapter {
  readonly kind = 'silent' as const
  readonly leadMs = 0
  onUtteranceEnd?: TtsAdapter['onUtteranceEnd']
  onCueStart?: TtsAdapter['onCueStart']
  onCueEnd?: TtsAdapter['onCueEnd']
  onUtterance?: TtsAdapter['onUtterance']
  private rate = 1
  private seq = 0
  private paused = false
  private remaining = 0
  private wake: (() => void) | null = null

  setRate(rate: number) {
    this.rate = rate
  }

  async speak(cue: LectureCue): Promise<CueOutcome> {
    const my = ++this.seq
    this.onCueStart?.(cue)
    this.remaining = (cue.est_sec * 1000) / this.rate
    const planned = utterancePlan(cue.segments).length
    while (this.remaining > 0) {
      if (my !== this.seq) return this.finish(cue, { completed: false, cancelled: true, errors: [], spoken: 0, planned })
      if (this.paused) {
        await new Promise<void>((r) => (this.wake = r))
        continue
      }
      const step = Math.min(100, this.remaining)
      await new Promise((r) => setTimeout(r, step))
      if (!this.paused && my === this.seq) this.remaining -= step
    }
    if (my !== this.seq) return this.finish(cue, { completed: false, cancelled: true, errors: [], spoken: 0, planned })
    return this.finish(cue, { completed: true, cancelled: false, errors: [], spoken: planned, planned })
  }

  private finish(cue: LectureCue, o: CueOutcome) {
    this.onCueEnd?.(cue, o)
    return o
  }

  pause() {
    this.paused = true
  }
  resume() {
    this.paused = false
    this.wake?.()
    this.wake = null
  }
  cancel() {
    this.seq += 1
    this.resume()
  }
}

/** 브라우저 Web Speech 어댑터 */
export class WebSpeechAdapter implements TtsAdapter {
  readonly kind = 'webspeech' as const
  onUtteranceEnd?: TtsAdapter['onUtteranceEnd']
  private lead = 0
  private leadSamples = 0
  /** 첫 발화 준비 시간의 이동평균. 너무 앞당기면 앞 큐의 끝을 밟으므로 상한을 둔다. */
  get leadMs() {
    return Math.min(300, Math.round(this.lead))
  }
  onCueStart?: TtsAdapter['onCueStart']
  onCueEnd?: TtsAdapter['onCueEnd']
  onUtterance?: TtsAdapter['onUtterance']
  private rate = 1
  private seq = 0
  private paused = false
  private wake: (() => void) | null = null
  /** 발화 객체를 붙들어 둔다 — 놓치면 GC 가 거둬 `onend` 가 영영 안 온다(Chrome) */
  private live = new Set<SpeechSynthesisUtterance>()

  constructor(private voices: { ko: SpeechSynthesisVoice | null; en: SpeechSynthesisVoice | null }) {}

  setRate(rate: number) {
    this.rate = rate
  }

  async speak(cue: LectureCue): Promise<CueOutcome> {
    const my = ++this.seq
    const plan = utterancePlan(cue.segments)
    const errors: string[] = []
    let spoken = 0
    this.onCueStart?.(cue)

    for (let i = 0; i < plan.length; ) {
      if (my !== this.seq) return this.finish(cue, { completed: false, cancelled: true, errors, spoken, planned: plan.length })
      if (this.paused) {
        await new Promise<void>((r) => (this.wake = r))
        continue
      }
      const g = plan[i]
      const r = await this.say(g, cue.id, i)
      if (my !== this.seq) return this.finish(cue, { completed: false, cancelled: true, errors, spoken, planned: plan.length })
      // 멈춤으로 끊긴 문장은 **다시 읽는다** — 같은 i 로 돌아간다
      if (r === 'interrupted' && this.paused) continue
      if (r !== 'ok' && r !== 'interrupted') errors.push(r)
      spoken += 1
      i += 1
    }
    return this.finish(cue, { completed: true, cancelled: false, errors, spoken, planned: plan.length })
  }

  private finish(cue: LectureCue, o: CueOutcome) {
    this.onCueEnd?.(cue, o)
    return o
  }

  private say(g: LectureSegment, cueId: string, index: number): Promise<string> {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(g.text)
      u.lang = g.lang
      const v = g.lang === 'ko-KR' ? this.voices.ko : this.voices.en
      if (v) u.voice = v
      u.rate = this.rate
      this.live.add(u)
      let settled = false
      // 감시 시한: 글자 수로 어림한 시간의 세 배 + 6초. 이 안에 끝나지 않으면 잃은 것으로 친다.
      const budget = ((g.text.length / (g.lang === 'ko-KR' ? 5 : 13)) * 3 * 1000) / this.rate + 6000
      const timer = window.setTimeout(() => settle('timeout'), budget)
      const calledAt = performance.now()
      const settle = (why: string) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        this.live.delete(u)
        resolve(why)
      }
      u.onstart = () => {
        const at = performance.now()
        // 큐의 첫 발화만 잰다 — 엔진이 앞당기는 것은 큐 사이 쉼이다
        if (index === 0) {
          const d = at - calledAt
          this.leadSamples += 1
          this.lead = this.leadSamples === 1 ? d : this.lead * 0.7 + d * 0.3
        }
        this.onUtterance?.({ cueId, lang: g.lang, index, at })
      }
      u.onend = () => {
        this.onUtteranceEnd?.({ cueId, lang: g.lang, index, at: performance.now() })
        settle('ok')
      }
      u.onerror = (e) => {
        const err = (e as SpeechSynthesisErrorEvent).error
        settle(err === 'interrupted' || err === 'canceled' ? 'interrupted' : `error:${err}`)
      }
      window.speechSynthesis.speak(u)
    })
  }

  pause() {
    if (this.paused) return
    this.paused = true
    // 음성마다 pause() 가 다르게 군다 — 지금 문장을 끊고, 재개하면 그 문장부터 읽는다
    window.speechSynthesis.cancel()
  }

  resume() {
    this.paused = false
    this.wake?.()
    this.wake = null
  }

  cancel() {
    this.seq += 1
    this.paused = false
    this.wake?.()
    this.wake = null
    window.speechSynthesis.cancel()
  }
}
