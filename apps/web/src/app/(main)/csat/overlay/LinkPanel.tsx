'use client'

// apps/web/src/app/(main)/csat/overlay/LinkPanel.tsx
//
// **링크 모드의 옆 해설 — 여기도 풀고 나서 열린다.**
//
// ── 왜 생겼나 (2026-09-16) ───────────────────────────────────────────
// 오버레이의 파일 모드에 순차 공개를 넣고 나서 같은 화면을 다시 보니, **바로 위 칸이**
// 답·근거·오답 넷·절차를 서버 렌더로 **이미 다 펼쳐 놓고** 있었다. 아래에서 아무리 겹을
// 잠가도 학습자는 위를 보면 된다 — 문을 달아 놓고 옆벽을 터 둔 셈이었다.
//
// 그래서 같은 문을 여기에도 단다. 다른 점은 하나뿐이다: **여기에는 종이가 없다**
// (원본은 cross-origin iframe 이라 우리가 그 위에 칠할 수 없다). 그래서 겹 스위치를
// 숨긴다 — 켤 종이가 없는 스위치는 고장으로 읽힌다.
//
// ⚠️ 키보드 전역 단축키를 **여기서는 걸지 않는다.** 같은 화면에 파일 모드 패널이 함께 있고,
//    둘 다 window 에 걸면 숫자 하나가 두 패널을 동시에 움직인다 — 누른 것과 일어난 일이
//    달라진다. 전역 단축키는 종이가 있는 쪽(`OverlayClient`)의 몫이다.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ALL_LAYERS_ON, OverlayPanel } from '@/components/csat/OverlayPanel'
import { track } from '@/lib/analytics/client'
import {
  buildRevealSteps,
  revealSourceFromExplain,
  secondsBucket,
  type RevealStep,
} from '@/lib/csat/overlay-reveal'

export interface LinkPanelItem {
  no: number
  slug: string
  type_name: string | null
  points: number | null
  time_budget_sec: number | null
  answer: number | null
  answer_unknown: boolean
  why_correct: string | null
  evidence_quote: string | null
  evidence_reasoning: string | null
  distractors: { n: number; trap: string | null; why_tempting: string | null; how_to_reject: string | null }[]
  procedure: { step: string; on_fail?: string }[]
  required_vocab: string[]
}

export default function LinkPanel({ item }: { item: LinkPanelItem | null }) {
  const [phase, setPhase] = useState<'solve' | 'reveal'>('solve')
  const [picked, setPicked] = useState<number | null>(null)
  const [step, setStep] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const openedAt = useRef<number>(0)

  // 문항이 바뀌면(링크로 다음 문항에 가면) 처음부터.
  useEffect(() => {
    setPhase('solve')
    setPicked(null)
    setStep(0)
    setElapsed(0)
    openedAt.current = Date.now()
  }, [item?.slug])

  useEffect(() => {
    if (!item || phase !== 'solve') return
    const t = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - openedAt.current) / 1000))
    }, 1000)
    return () => window.clearInterval(t)
  }, [item, phase])

  const steps: RevealStep[] | null = useMemo(
    () => (phase === 'reveal' && item ? buildRevealSteps(revealSourceFromExplain(item)) : null),
    [phase, item],
  )

  const submit = useCallback(() => {
    if (!item) return
    const seconds = Math.floor((Date.now() - openedAt.current) / 1000)
    setElapsed(seconds)
    setStep(0)
    setPhase('reveal')
    track({
      name: 'csat_overlay_answered',
      props: {
        picked: picked != null,
        correct: picked != null && !item.answer_unknown && item.answer != null && picked === item.answer,
        secondsBucket: secondsBucket(seconds),
      },
    })
  }, [item, picked])

  const goStep = useCallback(
    (i: number) => {
      if (!steps || !steps.length) return
      const n = Math.max(0, Math.min(steps.length - 1, i))
      setStep(n)
      track({ name: 'csat_overlay_revealed', props: { seq: n + 1, total: steps.length, kind: steps[n].kind } })
    },
    [steps],
  )

  if (!item) {
    return (
      <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <p className="break-keep text-sm leading-relaxed text-[var(--t2)]">이 문항은 분석 준비 중이에요.</p>
      </div>
    )
  }

  return (
    <OverlayPanel
      item={{
        no: item.no,
        slug: item.slug,
        type_name: item.type_name,
        points: item.points,
        time_budget_sec: item.time_budget_sec,
        measured_ability: null,
        ready: true,
        answer: item.answer_unknown ? null : item.answer,
      }}
      steps={steps}
      picked={picked}
      step={step}
      elapsed={elapsed}
      layers={ALL_LAYERS_ON}
      showLayers={false}
      showClose={false}
      onPick={setPicked}
      onSubmit={submit}
      onStep={goStep}
      onLayer={() => {}}
      // 링크 모드에서는 닫을 것이 없다(단추도 숨긴다) — 이 패널이 그 문항의 자리 자체다.
      onClose={() => setPhase('solve')}
    />
  )
}
