'use client'

// apps/web/src/app/dev/tts-probe/page.tsx
//
// **Gate 0 · TTS 프로브 — 이 브라우저에서 강의를 소리로 낼 수 있는가.**
//
// 강의 재생에 쓰는 **바로 그 어댑터와 엔진**(`lib/csat/lecture/tts.ts` · `player.ts`)을 돌려 잰다.
// 장난감 코드로 재면 통과해도 실제 재생이 끊길 수 있다.
//
// 재는 것:
//   ① 음성 목록 · ko-KR/en-US 유무 · 고른 목소리
//   ② `onboundary` 가 오는가(단어 단위 강조는 이것이 있는 브라우저에서만 켤 수 있다)
//   ③ 40초짜리 발화 하나가 끝까지 읽히는가(끊김 이슈)
//   ④ 큐 6개 연속 재생 — 유실 · 발화 오류 · 큐 간 지연(붙든 시간 제외)
//   ⑤ 한/영 전환 지연
//   ⑥ 낭독 속도 실측(초당 음절 · 초당 단어) — 대본 길이 어림의 계수가 된다
//
// `?auto=1` 이면 열자마자 돌고 결과를 `window.__TTS_PROBE__` 에 둔다(하네스가 읽는다).
// 문구는 전부 프로브용 합성 문장이다 — 기출 원문이 없다.

import { useEffect, useRef, useState } from 'react'

import { LecturePlayer } from '@/lib/csat/lecture/player'
import { enWords, syllables } from '@/lib/csat/lecture/speakable'
import { loadVoices, pickVoice, WebSpeechAdapter } from '@/lib/csat/lecture/tts'
import type { Lecture } from '@/lib/csat/lecture/types'

const LONG_KO =
  '자, 여러분 지금부터 긴 문장 하나를 끝까지 읽어 보겠습니다. 이 문장은 일부러 길게 만들었어요. ' +
  '브라우저에 따라서 십오 초 정도가 지나면 소리가 갑자기 멈추는 경우가 있다고 알려져 있거든요. ' +
  '그래서 이 프로브는 한 번의 발화로 사십 초 가까이 말하게 하고, 끝났다는 신호가 제때 오는지를 봅니다. ' +
  '만약 중간에 끊긴다면 강의 대본을 더 짧은 조각으로 나누어야 합니다. 조각이 짧으면 끊길 틈이 없죠. ' +
  '하나 더, 멈춘 뒤에 다시 이어 읽을 때도 문장 단위로 다시 시작하는 편이 안전합니다. ' +
  '여기까지 들리셨다면 긴 발화도 이 브라우저에서는 괜찮다는 뜻입니다. 수고하셨습니다.'

const CAL_KO = [
  '자, 여기 두 번째 문장을 보세요.',
  '결론부터 말하면 답은 삼 번입니다.',
  '이 선지는 범위를 넓혀서 틀린 거예요.',
]
const CAL_EN = ['However, the result was not what they expected.', 'In other words, less is more.']

const PROBE_LECTURE: Lecture = {
  item_id: 'probe#0',
  version: 0,
  total_sec_est: 0,
  generated_by: 'probe',
  rubric_score: 0,
  cues: [
    ['intro', [['ko-KR', '자, 오늘은 빈칸 문제를 하나 풀어 보겠습니다.']]],
    ['strategy', [['ko-KR', '먼저 빈칸이 있는 문장부터 보세요.'], ['en-US', 'This is why'], ['ko-KR', '로 시작하죠.']]],
    ['structure', [['ko-KR', '글은 주장, 예시, 다시 주장의 순서예요.']]],
    ['evidence', [['ko-KR', '여기 세 번째 문장이 근거입니다.'], ['en-US', 'less is more'], ['ko-KR', '라는 말이 핵심이죠.']]],
    ['eliminate', [['ko-KR', '일 번은 범위를 넓혀서 틀렸습니다.']]],
    ['wrapup', [['ko-KR', '다음에 빈칸을 만나면, 첫 십 초에 주장 문장부터 찾으세요.']]],
  ].map(([role, segs], i) => ({
    id: `c${i + 1}`,
    order: i + 1,
    target: { kind: 'analysis' as const, id: 'head' },
    role: role as Lecture['cues'][number]['role'],
    segments: (segs as [string, string][]).map(([lang, text]) => ({ lang: lang as 'ko-KR' | 'en-US', text })),
    est_sec: 4,
    pause_after_ms: 300,
  })),
}

type Report = Record<string, unknown>

function speakOnce(text: string, lang: string, voice: SpeechSynthesisVoice | null, timeoutMs: number) {
  return new Promise<{ started: number | null; ended: number | null; error: string | null; boundaries: number }>(
    (resolve) => {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = lang
      if (voice) u.voice = voice
      let started: number | null = null
      let boundaries = 0
      const hold = u // GC 방지
      const timer = window.setTimeout(() => {
        window.speechSynthesis.cancel()
        resolve({ started, ended: null, error: 'timeout', boundaries })
      }, timeoutMs)
      u.onstart = () => (started = performance.now())
      u.onboundary = () => (boundaries += 1)
      u.onend = () => {
        window.clearTimeout(timer)
        void hold
        resolve({ started, ended: performance.now(), error: null, boundaries })
      }
      u.onerror = (e) => {
        window.clearTimeout(timer)
        resolve({ started, ended: performance.now(), error: (e as SpeechSynthesisErrorEvent).error, boundaries })
      }
      window.speechSynthesis.speak(u)
    },
  )
}

async function runProbe(): Promise<Report> {
  const t0 = performance.now()
  const ua = navigator.userAgent
  if (!('speechSynthesis' in window)) return { ua, supported: false, pass: false, reasons: ['speechSynthesis 없음'] }

  const voices = await loadVoices(5000)
  const ko = pickVoice(voices, 'ko-KR')
  const en = pickVoice(voices, 'en-US')
  const report: Report = {
    ua,
    supported: true,
    voices: voices.length,
    koVoices: voices.filter((v) => v.lang.toLowerCase().startsWith('ko')).map((v) => `${v.name} (${v.localService ? 'local' : 'network'})`),
    enVoices: voices.filter((v) => v.lang.toLowerCase() === 'en-us').length,
    chosen: { ko: ko ? `${ko.name} (${ko.localService ? 'local' : 'network'})` : null, en: en?.name ?? null },
  }
  if (!ko) return { ...report, pass: false, reasons: ['ko-KR 음성 없음 → 무음 하이라이트 모드'] }

  // ② onboundary
  const b = await speakOnce('자, 여기 두 번째 문장을 보세요.', 'ko-KR', ko, 15000)
  report.boundary = { events: b.boundaries, supported: b.boundaries > 0, error: b.error }

  // ⑥ 속도 실측
  const cal: { lang: string; units: number; ms: number }[] = []
  for (const s of CAL_KO) {
    const r = await speakOnce(s, 'ko-KR', ko, 15000)
    if (r.started && r.ended && !r.error) cal.push({ lang: 'ko', units: syllables(s), ms: r.ended - r.started })
  }
  for (const s of CAL_EN) {
    const r = await speakOnce(s, 'en-US', en, 15000)
    if (r.started && r.ended && !r.error) cal.push({ lang: 'en', units: enWords(s), ms: r.ended - r.started })
  }
  const rate = (lang: string) => {
    const xs = cal.filter((c) => c.lang === lang)
    const units = xs.reduce((a, c) => a + c.units, 0)
    const ms = xs.reduce((a, c) => a + c.ms, 0)
    return ms > 0 ? Math.round((units / (ms / 1000)) * 100) / 100 : null
  }
  report.calibration = { koSyllablesPerSec: rate('ko'), enWordsPerSec: rate('en'), samples: cal }

  // ③ 40초 발화
  const koRate = (report.calibration as { koSyllablesPerSec: number | null }).koSyllablesPerSec ?? 5.6
  const expectedMs = (syllables(LONG_KO) / koRate) * 1000
  const long = await speakOnce(LONG_KO, 'ko-KR', ko, expectedMs * 2 + 10000)
  const longMs = long.started && long.ended ? long.ended - long.started : null
  report.long40 = {
    expectedMs: Math.round(expectedMs),
    actualMs: longMs ? Math.round(longMs) : null,
    error: long.error,
    // 기대의 60% 도 못 채우고 끝났으면 끊긴 것이다
    cut: long.error != null || longMs == null || longMs < expectedMs * 0.6,
  }

  // ④⑤ 큐 연속 재생 — 실제 엔진으로
  const adapter = new WebSpeechAdapter({ ko, en })
  const starts: { cueId: string; lang: string; index: number; at: number }[] = []
  const endsU: { cueId: string; lang: string; index: number; at: number }[] = []
  adapter.onUtterance = (e) => starts.push(e)
  adapter.onUtteranceEnd = (e) => endsU.push(e)
  const done = new Promise<void>((resolve) => {
    const player = new LecturePlayer(PROBE_LECTURE, adapter, (s) => {
      if (s.status === 'ended') {
        ;(window as unknown as { __probePlayer?: LecturePlayer }).__probePlayer = player
        resolve()
      }
    })
    ;(window as unknown as { __probePlayer?: LecturePlayer }).__probePlayer = player
    void player.play(0)
  })
  const seqTimeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 90000))
  const seqResult = await Promise.race([done.then(() => 'ok' as const), seqTimeout])
  const player = (window as unknown as { __probePlayer: LecturePlayer }).__probePlayer
  const log = player.log
  const ends = log.filter((e) => e.type === 'cue-end')
  const holdEnds = log.filter((e) => e.type === 'hold-end')
  const lost = PROBE_LECTURE.cues.filter((c) => !ends.some((e) => e.cue === c.id && e.outcome?.completed)).map((c) => c.id)
  const errors = ends.flatMap((e) => e.outcome?.errors ?? [])
  // 큐 간 지연 = **들리는 초과 침묵**: (i+1)번 큐의 첫 소리 − i번 큐의 마지막 소리 − 대본의 쉼.
  // 처음에는 「붙든 시간 끝 → 첫 소리」로 쟀는데, 그건 엔진의 앞당김을 반영하지 못하고
  // 학습자가 실제로 듣는 것과도 다르다(대본의 쉼 자체는 지연이 아니다).
  const gaps: number[] = []
  const rawGaps: number[] = []
  for (let i = 0; i + 1 < PROBE_LECTURE.cues.length; i += 1) {
    const cue = PROBE_LECTURE.cues[i]
    const lastEnd = endsU.filter((x) => x.cueId === cue.id).at(-1)
    const nextStart = starts.find((x) => x.cueId === PROBE_LECTURE.cues[i + 1].id && x.index === 0)
    if (lastEnd && nextStart) gaps.push(Math.round(nextStart.at - lastEnd.at - cue.pause_after_ms))
    const h = holdEnds.find((e) => e.index === i)
    if (h && nextStart) rawGaps.push(Math.round(nextStart.at - h.t))
  }
  // 한/영 전환: 같은 큐 안에서 언어가 바뀌는 발화의 시작 간격(앞 발화 길이 포함 — 참고치)
  const switches = starts.filter((x, i) => i > 0 && starts[i - 1].cueId === x.cueId && starts[i - 1].lang !== x.lang).length
  report.sequence = {
    result: seqResult,
    cues: PROBE_LECTURE.cues.length,
    completed: ends.filter((e) => e.outcome?.completed).length,
    lost,
    utteranceErrors: errors,
    interCueGapMs: gaps,
    holdEndToSoundMs: rawGaps,
    leadMs: adapter.leadMs,
    maxInterCueGapMs: gaps.length ? Math.max(...gaps) : null,
    langSwitches: switches,
  }

  const reasons: string[] = []
  if (lost.length) reasons.push(`큐 유실 ${lost.length}`)
  if (errors.length) reasons.push(`발화 오류 ${errors.length}`)
  const maxGap = gaps.length ? Math.max(...gaps) : Infinity
  if (!(maxGap < 400)) reasons.push(`큐 간 지연 ${maxGap}ms ≥ 400`)
  if (seqResult !== 'ok') reasons.push('연속 재생이 끝나지 않음')
  return { ...report, elapsedMs: Math.round(performance.now() - t0), pass: reasons.length === 0, reasons }
}

export default function TtsProbePage() {
  const [report, setReport] = useState<Report | null>(null)
  const [running, setRunning] = useState(false)
  const started = useRef(false)

  const start = async () => {
    setRunning(true)
    const r = await runProbe().catch((e) => ({ pass: false, reasons: [String(e)] }))
    ;(window as unknown as { __TTS_PROBE__?: Report }).__TTS_PROBE__ = r
    setReport(r)
    setRunning(false)
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (new URLSearchParams(window.location.search).get('auto') === '1') void start()
  }, [])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-bold text-[var(--t1)]">TTS 프로브 (Gate 0)</h1>
      <p className="mt-2 break-keep text-sm text-[var(--t2)]">
        강의 재생에 쓰는 어댑터와 엔진을 이 브라우저에서 그대로 돌려 봅니다. 소리가 납니다.
      </p>
      <button
        type="button"
        onClick={() => void start()}
        disabled={running}
        className="mt-4 inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--p)] px-4 text-sm text-[var(--on-p)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--p-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:bg-[var(--p-dark)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? '재는 중…' : '프로브 실행'}
      </button>
      {report ? (
        <pre data-probe-done className="mt-6 overflow-x-auto rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4 text-xs">
          {JSON.stringify(report, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}
