// apps/web/src/components/csat/judgment/TypeJudgment.tsx
// 공유 화면(AnalysisTheater) 의 단일 연결 지점 — 문항 유형에 맞는 판단 도구를 고른다. 유형별 판단 논리는 각 도구에 그대로 있다.
// 연결 준비가 안 된 유형(도구 없음)은 null — 공유 화면은 기존 구성을 그대로 보인다.
'use client'

import type { ComponentType } from 'react'
import type { JudgmentToolProps } from '@/lib/csat/judgment/types'
import { GrammarTool } from './GrammarTool'
import { InfoMatchTool } from './InfoMatchTool'
import { IrrelevantTool } from './IrrelevantTool'
import { MoodTool } from './MoodTool'
import { OrderTool } from './OrderTool'
import { SummaryTool } from './SummaryTool'

/**
 * 유형 → 도구. 'first' = 첫 제품 연결 후보(R-IRRELEVANT), 'isolated' = 격리 검증만 된 도구.
 * X-FACT · X-ORDER 처럼 판단은 같고 범위만 다른 장문 유형은 실물 문항으로 격리 검증하기 전까지 넣지 않는다.
 */
export const JUDGMENT_TOOLS: Record<string, { tool: ComponentType<JudgmentToolProps>; stage: 'first' | 'isolated' }> = {
  'R-IRRELEVANT': { tool: IrrelevantTool, stage: 'first' },
  'R-ORDER': { tool: OrderTool, stage: 'isolated' },
  'R-NOTICE': { tool: InfoMatchTool, stage: 'isolated' },
  'R-FACT': { tool: InfoMatchTool, stage: 'isolated' },
  'R-GRAMMAR': { tool: GrammarTool, stage: 'isolated' },
  'R-SUMMARY': { tool: SummaryTool, stage: 'isolated' },
  'R-MOOD': { tool: MoodTool, stage: 'isolated' },
}

/** 공유 화면이 연결 여부를 미리 판정할 때 쓴다(도구 없는 유형에 빈 영역을 만들지 않게) */
export function hasJudgmentTool(typeId: string | null | undefined, stages: readonly ('first' | 'isolated')[] = ['first']): boolean {
  const t = typeId ? JUDGMENT_TOOLS[typeId] : undefined
  return Boolean(t && stages.includes(t.stage))
}

export function TypeJudgment({ item, reveal, stages = ['first'] }: JudgmentToolProps & { stages?: readonly ('first' | 'isolated')[] }) {
  const entry = JUDGMENT_TOOLS[item.typeId]
  if (!entry || !stages.includes(entry.stage)) return null
  const Tool = entry.tool
  return <Tool item={item} reveal={reveal} />
}
