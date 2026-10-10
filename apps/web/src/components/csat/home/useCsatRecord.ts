// apps/web/src/components/csat/home/useCsatRecord.ts
'use client'

//
// 기출 화면들이 **같은 방법으로** 학습 기록을 읽는 훅.
// 기기 기록을 읽고 서버 사본과 합친 뒤(`loadSyncedDissectionRecord`), 밀린 복습이 3개를 넘으면
// 오늘 몫만 남기고 뒤로 민다(`compressDue` — ia-design §2-3). 민 결과는 저장한다.
// `dueBefore` 는 압축 **전** 개수다 — 공백 복귀 카드가 「밀린 9개 중 오늘은 3개」라고 말하려면 필요하다.

import { useEffect, useState } from 'react'

import { compressDue, dueNow } from '@/lib/csat/continuity'
import type { DissectionRecord } from '@/lib/csat/dissect'
import { loadSyncedDissectionRecord, saveDissectionRecord } from '@/lib/csat/session/store'

export interface CsatRecordState {
  record: DissectionRecord
  /** 서버 사본과 합쳤나(false = 기기 기록만) */
  synced: boolean
  /** 압축 전 오늘 할 복습 수 */
  dueBefore: number
  /** 읽은 시각 — 화면의 모든 날짜 계산이 이 값 하나를 쓴다 */
  now: number
}

/** 읽은 기록의 밀린 복습을 압축하고, 쓰기 화면이 아니면 저장한다. 순수하게 떼어 둔다(useCsatRecord.test.ts). */
export async function settleRecord(
  record: DissectionRecord,
  now: number,
  { readOnly, save }: { readOnly: boolean; save: (r: DissectionRecord) => Promise<unknown> },
): Promise<{ record: DissectionRecord; dueBefore: number }> {
  const dueBefore = dueNow(record, now).length
  const compressed = compressDue(record, now)
  if (!readOnly && compressed !== record) await save(compressed)
  return { record: compressed, dueBefore }
}

/**
 * `readOnly` — 읽기만 한다(압축 결과를 저장하지 않는다). 기록을 **쓰는 화면**(해설 극장 · 해부 · 연습) 위에 얹히는 셸이 쓴다:
 * 셸이 마운트 때 읽은 기록을 늦게 저장하면 그 사이 화면이 쓴 세션 · 예측을 옛 사본으로 덮는다(Codex P1 · 2026-10-10).
 */
export function useCsatRecord({ readOnly = false }: { readOnly?: boolean } = {}): CsatRecordState | null {
  const [state, setState] = useState<CsatRecordState | null>(null)
  useEffect(() => {
    let alive = true
    void loadSyncedDissectionRecord().then(async ({ record, synced }) => {
      const now = Date.now()
      const settled = await settleRecord(record, now, { readOnly, save: saveDissectionRecord })
      if (alive) setState({ record: settled.record, synced, dueBefore: settled.dueBefore, now })
    })
    return () => {
      alive = false
    }
  }, [readOnly])
  return state
}
