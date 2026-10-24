// apps/web/src/components/csat/f08-proto/Workbench.tsx
// 후보 셋을 같은 상태 모델 위에 고른다. 「처음부터」는 이 후보에 남긴 판단만 지운다.

'use client'

import type { CandidateId, ProtoItem } from '@/lib/csat/f08-proto/types'

import { CandidateA } from './CandidateA'
import { CandidateB } from './CandidateB'
import { CandidateC } from './CandidateC'
import { btn } from './parts'
import { useProtoState } from './useProtoState'

export function Workbench({ candidate, item, fault }: { candidate: CandidateId; item: ProtoItem; fault: string }) {
  const proto = useProtoState(candidate, item.itemId)
  const View = candidate === 'a' ? CandidateA : candidate === 'b' ? CandidateB : CandidateC
  return (
    <>
      <div className="mb-3 flex justify-end">
        <button type="button" className={`${btn} text-xs`} onClick={proto.reset}>이 후보 처음부터</button>
      </div>
      <View item={item} proto={proto} fault={fault} />
    </>
  )
}
