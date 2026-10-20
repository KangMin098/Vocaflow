// apps/web/src/components/csat/theater/__tests__/meaning-whole.test.ts
//
// 글 전체 통합 단계 — 배포 sidecar 8문항 전량에 대해: 명제는 whole 순서 그대로, 관계는 한 번만 쓰이고 버려지지 않는다.
import { describe, expect, it } from 'vitest'

import data from '@/lib/csat/meaning-support-data.json'
import type { MeaningSupportView } from '@/lib/csat/meaning-support/labels'

import { integrationSteps } from '../MeaningWholeView'

const items = (data as unknown as { items: Record<string, MeaningSupportView> }).items

describe('integrationSteps — 검수된 명제 · 관계만 다시 배치한다', () => {
  for (const [id, v] of Object.entries(items)) {
    it(id, () => {
      const { props, links, rest } = integrationSteps(v)
      expect(props.map((p) => p.id)).toEqual(v.whole.propositionIds.filter((pid) => v.propositions.some((p) => p.id === pid)))
      expect(links).toHaveLength(Math.max(0, props.length - 1))
      const used = [...links.filter(Boolean).map((r) => r!.id), ...rest.map((r) => r.id)]
      expect(new Set(used).size).toBe(used.length)
      expect([...used].sort()).toEqual(v.whole.relationIds.filter((rid) => v.relations.some((r) => r.id === rid)).sort())
    })
  }
})
