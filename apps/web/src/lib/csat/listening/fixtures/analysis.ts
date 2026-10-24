// apps/web/src/lib/csat/listening/fixtures/analysis.ts
//
// 제출 뒤 분석 열기 — 서버 액션의 판정 본체(시험 가능하게 판정 함수를 주입). 문항 id 는 픽스처 화이트리스트로만 받는다.
// 판정이 'open' 일 때만 전체 픽스처를 돌려주고, 보류 · 실패 · 예외는 정답 없이 상태만 돌려준다(fail-closed).

import type { RevealDecision } from '../../embargo-gate'
import { traceFixtureByKey } from './index'
import type { ListeningTraceFixture } from './types'

export type ListeningAnalysisResult =
  | { status: 'open'; fixture: ListeningTraceFixture }
  | { status: 'held' }
  | { status: 'failure' }
  | { status: 'invalid' }
  | { status: 'unauthenticated' }

export async function resolveListeningAnalysis(itemId: unknown, decide: (examId: string) => Promise<RevealDecision>): Promise<ListeningAnalysisResult> {
  if (typeof itemId !== 'string') return { status: 'invalid' }
  const fx = traceFixtureByKey(itemId)
  if (!fx) return { status: 'invalid' }
  let d: RevealDecision
  try {
    d = await decide(fx.examId)
  } catch {
    return { status: 'failure' }
  }
  if (d === 'open') return { status: 'open', fixture: fx }
  return d === 'embargo' ? { status: 'held' } : { status: 'failure' }
}
