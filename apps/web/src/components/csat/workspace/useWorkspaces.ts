// apps/web/src/components/csat/workspace/useWorkspaces.ts
'use client'

//
// Workspace 화면들이 기록을 읽고 **고치는** 훅. 읽기는 `useCsatRecord`(기기 + 서버 병합)를 그대로 쓴다.
// 쓰기는 저장 직전에 기기 기록을 **다시 읽어** 그 위에 한 벌만 바꿔 넣는다 — 화면을 연 뒤 다른 탭에서 한
// 학습이 덮이지 않게. 서버로는 `saveDissectionRecord` 가 모아서 올리고, 서버가 `mergeDissection` 으로 합친다.

import { useCallback, useEffect, useState } from 'react'

import type { DissectionRecord } from '@/lib/csat/dissect'
import { loadDissectionRecord, saveDissectionRecord } from '@/lib/csat/session/store'
import { putWorkspace, type Workspace } from '@/lib/csat/workspace'

import { useCsatRecord } from '../home/useCsatRecord'

export function useWorkspaces() {
  const rec = useCsatRecord()
  const [record, setRecord] = useState<DissectionRecord | null>(null)
  useEffect(() => {
    if (rec) setRecord(rec.record)
  }, [rec])

  const save = useCallback(async (ws: Workspace): Promise<boolean> => {
    const fresh = await loadDissectionRecord()
    const next = putWorkspace(fresh, ws)
    const ok = await saveDissectionRecord(next)
    setRecord(next)
    return ok
  }, [])

  return { rec, record, now: rec?.now ?? null, synced: rec?.synced ?? false, save }
}
