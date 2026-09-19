// apps/web/src/components/text-viewer/NewTextPaint.tsx
//
// `/text/new` 「붙여 넣으면 칠해지는 입력칸」(2026-09-19 화면 재설계 DD-30 · docs/design/compare/text-new.md 발산 A).
//
// `/fit` 골든 1호의 부품(`PaintedPassage` · `/api/fit`)을 **수정 없이** 가져와 새 글 입력에 붙인다.
// 붙여 넣은(또는 예시를 고른) 본문이 700ms 뒤 그 자리에서 칠해지고, 학년을 옮기면 그 학년이 처음 만나는
// 낱말에 주묵 면이 선다 — `/fit` · `/fit/s` · `/signup` · `/diagnostic` 과 같은 몸짓(B5).
//
// 원문은 서버로 보내지 않는다 — `/fit` 과 같이 빈도표만 보내고 표면형별 레벨을 받아 브라우저가 칠한다.
// 분석이 실패해도 **저장은 막지 않는다** — 칠하기는 미리보기다. 실패는 한 줄로 말한다.

'use client'

import { useEffect, useMemo, useState } from 'react'

import { PaintedPassage } from '@/components/textfit/PaintedPassage'
import { tokenizeText } from '@/lib/text-extract/tokenize'
import { paintTokens, type SurfaceLevels } from '@/lib/textfit/paint'
import type { LevelProfile, ProfileLevel } from '@/lib/textfit/profile'
import { analyzePublicText, FitRateLimitError, PUBLIC_TEXT_LIMIT } from '@/lib/textfit/public-queries'

/** 칠하기 시작하는 길이 — `/fit` 과 같다(그보다 짧으면 커버리지가 뜻을 잃는다) */
export const PAINT_MIN_CHARS = 120
/** 입력이 멈춘 뒤 조회까지 — `/fit` 과 같은 700ms(Calm UI: 매 글자 조회 금지) */
const DEBOUNCE_MS = 700
/** 적정 학년이 없으면(고등 교육과정 이상) 고1 에서 시작 — `/fit` 의 기본값과 같다 */
const DEFAULT_LEVEL: ProfileLevel = 6

export type PaintState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; profile: LevelProfile; surfaces: SurfaceLevels; analysed: string }
  | { kind: 'error'; message: string }

/** 본문 → 칠하기 상태. 입력이 바뀌면 이전 요청을 취소한다(늦게 온 옛 응답이 새 결과를 덮지 않게). */
export function useTextPaint(text: string): PaintState {
  const analysed = useMemo(() => text.trim().slice(0, PUBLIC_TEXT_LIMIT), [text])
  const [state, setState] = useState<PaintState>({ kind: 'idle' })

  useEffect(() => {
    if (analysed.length < PAINT_MIN_CHARS) {
      setState({ kind: 'idle' })
      return
    }
    const tok = tokenizeText(analysed)
    if (tok.uniqueFinal === 0) {
      setState({ kind: 'idle' })
      return
    }
    let alive = true
    const controller = new AbortController()
    setState((s) => (s.kind === 'ready' ? s : { kind: 'loading' }))
    const timer = setTimeout(() => {
      analyzePublicText(tok.counts, tok.totalWords, controller.signal)
        .then((p) => {
          if (alive) setState({ kind: 'ready', profile: p, surfaces: p.surfaces ?? {}, analysed })
        })
        .catch((err: unknown) => {
          if (!alive || (err instanceof DOMException && err.name === 'AbortError')) return
          setState({
            kind: 'error',
            message:
              err instanceof FitRateLimitError
                ? `요청이 잦아 ${err.retryAfterSeconds}초 뒤에 다시 칠할게요. 저장은 지금도 돼요.`
                : '지금은 이 글을 칠하지 못했어요. 저장은 그대로 돼요.',
          })
        })
    }, DEBOUNCE_MS)
    return () => {
      alive = false
      controller.abort()
      clearTimeout(timer)
    }
  }, [analysed])

  return state
}

/** 칠해진 결과의 커버리지(%) — 저장 관측용. 칠하지 못했으면 -1 */
export function coveragePctOf(state: PaintState, level: ProfileLevel): number {
  if (state.kind !== 'ready') return -1
  const r = state.profile.readings.find((x) => x.level === level)
  return r ? Math.round(r.coverage * 100) : -1
}

export function defaultLevelOf(state: PaintState): ProfileLevel {
  return state.kind === 'ready' ? (state.profile.fitLevel ?? DEFAULT_LEVEL) : DEFAULT_LEVEL
}

interface Props {
  state: PaintState
  /** 입력 중인 본문 — 칠한 본문과 다르면 칠이 옛 결과다(흐리게) */
  text: string
  level: ProfileLevel
  onLevelChange: (level: ProfileLevel) => void
}

/** 칠해진 본문 + 학년 슬라이더 + 판정 — `/fit` 의 `PaintedPassage` 그대로 */
export function NewTextPaint({ state, text, level, onLevelChange }: Props) {
  const tokens = useMemo(
    () => (state.kind === 'ready' ? paintTokens(state.analysed, state.surfaces) : null),
    [state],
  )
  if (state.kind !== 'ready') return null
  const stale = state.analysed !== text.trim().slice(0, PUBLIC_TEXT_LIMIT)
  return (
    <PaintedPassage
      tokens={tokens}
      readings={state.profile.readings}
      fitLevel={state.profile.fitLevel}
      level={level}
      onLevelChange={onLevelChange}
      stale={stale}
    />
  )
}
