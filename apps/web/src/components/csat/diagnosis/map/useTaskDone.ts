// apps/web/src/components/csat/diagnosis/map/useTaskDone.ts
//
// 과제 체크 — 낙관적 갱신 · 실패하면 되돌림(학습 지도 상세 분석 · 단계 시트가 함께 쓴다). 저장은 기존 API 그대로.

'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { track } from '@/lib/analytics/client'

export function useTaskDone(initial: readonly string[]) {
  const router = useRouter()
  const [done, setDone] = useState<Set<string>>(() => new Set(initial))
  const [err, setErr] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const flip = (id: string, on: boolean) =>
    setDone((prev) => {
      const n = new Set(prev)
      if (on) n.add(id)
      else n.delete(id)
      return n
    })
  const toggle = async (taskId: string, next: boolean) => {
    setErr(null)
    flip(taskId, next)
    try {
      const res = await fetch(`/api/csat/diagnosis/map/tasks/${encodeURIComponent(taskId)}`, { method: next ? 'POST' : 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? '저장하지 못했어요')
      track({ name: 'csat_map_task_toggled', props: { done: next } })
      startTransition(() => router.refresh())
    } catch (e) {
      flip(taskId, !next)
      setErr(e instanceof Error ? e.message : '저장하지 못했어요')
    }
  }
  return { done, err, toggle }
}
