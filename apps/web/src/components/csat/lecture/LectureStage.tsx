'use client'

// apps/web/src/components/csat/lecture/LectureStage.tsx
//
// **강의 무대 — 소리와 하이라이트를 한 박자로 묶는다.**
//
// 해설 화면의 블록들은 서버가 그린다. 그 블록마다 `data-lecture-target` 이 붙어 있고, 이 무대는
// 재생 중에만 **DOM 에 상태를 단다**(`data-lecture-state` = active · path · inside · dim).
// 블록을 전부 클라이언트 컴포넌트로 바꾸지 않아도 되고, CSS 가 모양을 맡는다(globals.css).
//
//   active — 지금 설명하는 블록(테두리+배경)
//   path   — 그 블록을 품은 바깥 블록(옅어지면 안의 active 까지 옅어진다)
//   inside — 그 블록 안의 블록(설명 대상의 일부다)
//   dim    — 나머지(40%)
//
// ⚠️ **대본은 여기서도 그리지 않는다.** 재생을 누른 뒤 API 로 받아 엔진에만 넣는다(A1).
//    이 파일이 화면에 내놓는 것은 큐의 **역할과 순번**뿐이다.
// ⚠️ 한국어 목소리가 없는 기기는 **무음 모드** — 큐마다 추정 시간만큼 하이라이트만 넘긴다(F6).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { track } from '@/lib/analytics/client'
import { LecturePlayer, type PlayerState } from '@/lib/csat/lecture/player'
import { targetKey } from '@/lib/csat/lecture/targets'
import { loadVoices, pickVoice, SilentAdapter, WebSpeechAdapter } from '@/lib/csat/lecture/tts'
import type { Lecture, LectureRole } from '@/lib/csat/lecture/types'

export type LectureMode = 'unknown' | 'voice' | 'silent'
export type StageStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error'

export interface CueStub {
  id: string
  role: LectureRole
  key: string
  /** 대본이 말한 문장 번호(0부터) — 번호뿐, 대본 글자는 없다 */
  focus?: number[]
}

interface LectureCtx {
  meta: { sec: number; cues: number }
  mode: LectureMode
  status: StageStatus
  error: string | null
  index: number
  holding: boolean
  rate: number
  /** 불러온 뒤에만 채워진다 — 역할과 타깃 키뿐(대본 없음) */
  cues: CueStub[]
  activeKey: string | null
  /** 지금 큐가 말한 문장 번호 — 지도가 켤 막대를 말과 맞춘다(`focus.ts`) */
  activeFocus: number[] | null
  start: (from?: number, via?: 'start' | 'cue' | 'block') => void
  toggle: () => void
  prev: () => void
  next: () => void
  setRate: (r: number) => void
}

const Ctx = createContext<LectureCtx | null>(null)

export function useLecture(): LectureCtx | null {
  return useContext(Ctx)
}

/** 지금 켜진 타깃 키 — 무대 밖(다른 화면)에서는 언제나 null */
export function useLectureTargetKey(): string | null {
  const c = useContext(Ctx)
  return c && (c.status === 'playing' || c.status === 'paused') ? c.activeKey : null
}

/** 지금 큐가 말한 문장 번호 — 재생 중이 아니면 null */
export function useLectureFocus(): number[] | null {
  const c = useContext(Ctx)
  return c && (c.status === 'playing' || c.status === 'paused') ? c.activeFocus : null
}

const RATE_CODE: Record<string, 90 | 100 | 115> = { '0.9': 90, '1': 100, '1.15': 115 }

type Debug = {
  checks: { i: number; cue: string; want: string; got: string | null }[]
  mode: LectureMode
  player: LecturePlayer | null
  ended: boolean
}

export function LectureStage({
  slug,
  meta,
  children,
}: {
  slug: string
  meta: { sec: number; cues: number }
  children: React.ReactNode
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<LecturePlayer | null>(null)
  const loading = useRef<Promise<LecturePlayer | null> | null>(null)
  const jumps = useRef(0)
  const debug = useRef<Debug | null>(null)
  /** 비동기 경계를 넘는 값은 상태가 아니라 ref 로 읽는다 — 닫힌 값이 낡는다 */
  const modeRef = useRef<LectureMode>('unknown')
  const rateRef = useRef(1)

  const [mode, setMode] = useState<LectureMode>('unknown')
  const [status, setStatus] = useState<StageStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [ps, setPs] = useState<PlayerState | null>(null)
  const [cues, setCues] = useState<CueStub[]>([])

  // 이 기기에 한국어 목소리가 있는가 — 버튼 문구가 여기에 달렸다(「강의 듣기」/「하이라이트만 보기」)
  useEffect(() => {
    const forced = new URLSearchParams(window.location.search).get('lecture-silent') === '1'
    if (new URLSearchParams(window.location.search).get('lecture-debug') === '1') {
      debug.current = { checks: [], mode: 'unknown', player: null, ended: false }
      ;(window as unknown as { __LECTURE__?: Debug }).__LECTURE__ = debug.current
    }
    if (forced) {
      modeRef.current = 'silent'
      setMode('silent')
      return
    }
    let alive = true
    void loadVoices().then((v) => {
      if (alive) setMode(pickVoice(v, 'ko-KR') ? 'voice' : 'silent')
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => () => playerRef.current?.destroy(), [])

  const ensure = useCallback(async (): Promise<LecturePlayer | null> => {
    if (playerRef.current) return playerRef.current
    if (loading.current) return loading.current
    loading.current = (async () => {
      setStatus('loading')
      setError(null)
      try {
        const res = await fetch(`/api/csat/lecture?item=${encodeURIComponent(slug)}`, { cache: 'no-store' })
        const json = (await res.json()) as { ok: boolean; lecture?: Lecture; error?: string }
        if (!json.ok || !json.lecture) throw new Error(json.error ?? '강의를 불러오지 못했어요')
        const lecture = json.lecture
        const forced = new URLSearchParams(window.location.search).get('lecture-silent') === '1'
        const voices = forced ? [] : await loadVoices()
        const ko = pickVoice(voices, 'ko-KR')
        const adapter = ko ? new WebSpeechAdapter({ ko, en: pickVoice(voices, 'en-US') }) : new SilentAdapter()
        const m: LectureMode = ko ? 'voice' : 'silent'
        modeRef.current = m
        setMode(m)
        const player = new LecturePlayer(lecture, adapter, (s) => {
          setPs(s)
          setStatus(s.status === 'idle' ? 'idle' : s.status)
        })
        // 불러오기 전에 고른 속도를 잃지 않는다
        player.setRate(rateRef.current)
        playerRef.current = player
        setCues(lecture.cues.map((c) => ({ id: c.id, role: c.role, key: targetKey(c.target), ...(c.focus?.length ? { focus: c.focus } : {}) })))
        if (debug.current) {
          debug.current.mode = m
          debug.current.player = player
        }
        return player
      } catch (e) {
        setStatus('error')
        setError(e instanceof Error ? e.message : '강의를 불러오지 못했어요')
        loading.current = null
        return null
      }
    })()
    return loading.current
  }, [slug])

  const start = useCallback(
    (from = 0, via: 'start' | 'cue' | 'block' = 'start') => {
      void (async () => {
        const first = !playerRef.current
        const p = await ensure()
        if (!p) return
        if (!first) jumps.current += 1
        if (first) {
          track({
            name: 'csat_lecture_played',
            props: { mode: modeRef.current === 'silent' ? 'silent' : 'voice', from: via, rate: RATE_CODE[String(rateRef.current)] ?? 100 },
          })
        }
        void p.play(from)
      })()
    },
    [ensure],
  )

  const toggle = useCallback(() => {
    const p = playerRef.current
    if (!p) return start(0, 'start')
    p.toggle()
  }, [start])

  const prev = useCallback(() => {
    if (!playerRef.current) return
    jumps.current += 1
    void playerRef.current.prev()
  }, [])
  const next = useCallback(() => {
    if (!playerRef.current) return
    jumps.current += 1
    void playerRef.current.next()
  }, [])
  const [rate, setRateState] = useState(1)
  const setRate = useCallback((r: number) => {
    rateRef.current = r
    setRateState(r)
    playerRef.current?.setRate(r)
  }, [])

  const activeKey = ps?.target ? targetKey(ps.target) : null
  const focusList = ps ? cues[ps.index]?.focus : undefined
  const activeFocus = useMemo(() => (focusList?.length ? focusList : null), [focusList])
  const sessionOn = status === 'playing' || status === 'paused'

  // ── DOM 에 상태를 단다 ────────────────────────────────────────────────
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const all = Array.from(root.querySelectorAll<HTMLElement>('[data-lecture-target]'))
    if (!sessionOn || !activeKey) {
      for (const el of all) el.removeAttribute('data-lecture-state')
      return
    }
    const active = all.find((el) => el.dataset.lectureTarget === activeKey) ?? null
    // 대본이 말한 막대도 켠다 — 오답 칩을 가리키며 「일곱 번째 문장」이라고 할 때 그 막대가 흐려지면
    // 귀와 눈이 갈라진다. 칩이 주인공이고 막대는 함께 켜지는 짝이다.
    const focusKeys = new Set((activeFocus ?? []).map((k) => `anchor:sentence:${k}`))
    const lit = [active, ...all.filter((el) => focusKeys.has(el.dataset.lectureTarget ?? ''))].filter(
      (el): el is HTMLElement => el != null,
    )
    for (const el of all) {
      const state = lit.includes(el)
        ? 'active'
        : lit.some((a) => el.contains(a))
          ? 'path'
          : lit.some((a) => a.contains(el))
            ? 'inside'
            : 'dim'
      el.setAttribute('data-lecture-state', state)
    }
    if (active) {
      // 접힌 층 안의 블록이면 편다 — 닫힌 채로 빛나면 학습자는 아무것도 못 본다
      const det = active.tagName === 'DETAILS' ? (active as HTMLDetailsElement) : active.closest('details')
      if (det && !det.open) det.open = true
    }
  }, [activeKey, activeFocus, sessionOn])

  // 큐가 바뀔 때만 한 번 움직인다(붙들기·멈춤으로는 움직이지 않는다) — 지시문 [D] 「스크롤 1회」
  const lastScrolled = useRef<number>(-1)
  useEffect(() => {
    if (!sessionOn || !ps || ps.index === lastScrolled.current) return
    lastScrolled.current = ps.index
    const root = rootRef.current
    const active = activeKey ? root?.querySelector<HTMLElement>(`[data-lecture-target="${CSS.escape(activeKey)}"]`) : null
    if (debug.current && cues[ps.index]) {
      debug.current.checks.push({
        i: ps.index,
        cue: cues[ps.index].id,
        want: cues[ps.index].key,
        got: active?.getAttribute('data-lecture-state') === 'active' ? (active.dataset.lectureTarget ?? null) : null,
      })
    }
    if (!active) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    active.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
  }, [ps, sessionOn, activeKey, cues])

  // 끝까지 들었다
  useEffect(() => {
    if (status !== 'ended') return
    if (debug.current) debug.current.ended = true
    track({
      name: 'csat_lecture_ended',
      props: { cues: cues.length, jumps: jumps.current, mode: modeRef.current === 'silent' ? 'silent' : 'voice' },
    })
    lastScrolled.current = -1
  }, [status, cues.length])

  // ── 블록을 누르면 그 블록 설명부터(지시문 [D]) ─────────────────────────────
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onClick = (e: MouseEvent) => {
      if (!playerRef.current || !cues.length) return
      const t = e.target as HTMLElement | null
      // 블록 안의 제 단추·링크는 제 일을 한다
      if (!t || t.closest('button, a, summary, input, select, textarea, [data-lecture-bar]')) return
      const block = t.closest<HTMLElement>('[data-lecture-target]')
      const key = block?.dataset.lectureTarget
      if (!key) return
      const i = cues.findIndex((c) => c.key === key)
      if (i < 0) return
      jumps.current += 1
      void playerRef.current.jump(i)
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [cues])

  // ── 키보드: Space 재생/정지 · ←/→ 큐 ────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const tag = t?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === ' ') {
        // 단추 위의 Space 는 그 단추의 일이다 — 가로채면 누른 것과 일어난 일이 달라진다
        if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return
        e.preventDefault()
        toggle()
        return
      }
      if (!playerRef.current) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, next, prev])

  const value = useMemo<LectureCtx>(
    () => ({
      meta,
      mode,
      status,
      error,
      index: ps?.index ?? 0,
      holding: ps?.holding ?? false,
      rate,
      cues,
      activeKey,
      activeFocus,
      start,
      toggle,
      prev,
      next,
      setRate,
    }),
    [meta, mode, status, error, ps, rate, cues, activeKey, activeFocus, start, toggle, prev, next, setRate],
  )

  return (
    <Ctx.Provider value={value}>
      <div ref={rootRef}>{children}</div>
    </Ctx.Provider>
  )
}
