// apps/web/src/components/csat/theater/task-meta.ts
'use client'
//
// **문항 확인 과제의 G2 기록 메타** — PrinciplePanel · CohesionPanel 이 같이 쓴다(G2 계약 §2 · G2_INTEGRATED_SQL §6 ③).
//   세션 id      : 패널을 열 때마다 하나(「다시 풀기」 = 새 세션)
//   mutation id  : 「같은 답」 의 첫 전송에 정하고, 실패 뒤 재전송에만 다시 쓴다 — 답이 바뀌면 새 id
//   판단 시각 · 도움 수준 : 같은 mutation 에 묶어 고정한다(서버가 재전송을 요청 원문으로 비교 — 바뀌면 conflict)
//   도움 수준    : 이 기기의 해설 극장 세션이 이미 공개됐으면(정답 · 근거 · 오답 설계를 봤다) viewed_first, 아니면 independent.
//                  보수적 판정 — 해설을 본 뒤의 판단을 독립 표본으로 세지 않는다.

import { useRef } from 'react'

import { fromItemSlug } from '@/lib/csat/item-slug'
import { latestSession } from '@/lib/csat/learning-session'
import { loadDissectionRecord } from '@/lib/csat/session/store'

export type TaskHelpLevel = 'independent' | 'viewed_first'

export interface TaskMeta {
  clientSessionId: string
  clientMutationId: string
  answeredAt: string
  helpLevel: TaskHelpLevel
}

const newId = () => globalThis.crypto.randomUUID()

/** 이 기기에서 그 문항의 해설 극장이 이미 공개됐나 — 기록을 못 읽으면 보수적으로 viewed_first */
export async function theaterHelpLevel(slug: string): Promise<TaskHelpLevel> {
  try {
    const s = latestSession(await loadDissectionRecord(), fromItemSlug(slug))
    return s && s.stage !== 'open' ? 'viewed_first' : 'independent'
  } catch {
    return 'viewed_first'
  }
}

export function useTaskMeta(slug: string) {
  const session = useRef<string>(newId())
  const pending = useRef<{ key: string; meta: TaskMeta } | null>(null)
  return {
    /** answerKey = 이번 답의 정규화된 표현. 같은 답의 재전송이면 같은 메타를 돌려준다 */
    async meta(answerKey: string): Promise<TaskMeta> {
      if (pending.current?.key === answerKey) return pending.current.meta
      const meta: TaskMeta = {
        clientSessionId: session.current,
        clientMutationId: newId(),
        answeredAt: new Date().toISOString(),
        helpLevel: await theaterHelpLevel(slug),
      }
      pending.current = { key: answerKey, meta }
      return meta
    },
    /** 서버가 받았다 — 다음 답은 새 mutation */
    settled() {
      pending.current = null
    },
    /** 다시 풀기 — 새 세션 */
    restart() {
      session.current = newId()
      pending.current = null
    },
  }
}
