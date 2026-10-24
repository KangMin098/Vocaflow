// apps/web/src/lib/csat/listening/fixtures/analysis.ts
//
// 제출 뒤 분석 열기 — 서버 액션의 판정 본체(시험 가능하게 판정 함수를 주입).
// 1) 문항 id 는 픽스처 화이트리스트로만 받는다.
// 2) 학습자의 확정 판단(submission)을 **정답을 지운 픽스처 구조**로만 검증한다 — 모든 후보를 한 번씩, 판정은
//    eliminated/remaining, 연결 발화는 그 문항의 발화, 하나 이상 남김, 모르는 키 없음, 크기 상한.
//    불완전·위조 모양이면 Reveal 판정을 부르지도 않고 'invalid'.
// 3) 그다음에만 판정을 다시 하고 'open' 일 때 전체 픽스처. 보류 · 실패 · 예외는 정답 없이 상태만(fail-closed).
// 판단의 옳고 그름은 여기서 보지 않는다(채점 아님) — 정답과 무관한 구조 검증만.

import type { RevealDecision } from '../../embargo-gate'
import { traceFixtureByKey } from './index'
import { redactForClient } from './redact'
import type { ClientTraceFixture, ListeningTraceFixture } from './types'

export type ListeningAnalysisResult =
  | { status: 'open'; fixture: ListeningTraceFixture }
  | { status: 'held' }
  | { status: 'failure' }
  | { status: 'invalid' }
  | { status: 'unauthenticated' }

export type SubmittedJudgments = Record<string, { verdict: 'eliminated' | 'remaining'; utteranceId: string }>

const MAX_CANDIDATES = 16
const MAX_ID_LEN = 64

/** 구조 검증 — 정답을 지운 픽스처만 본다 */
export function isCompleteSubmission(fx: ClientTraceFixture, submission: unknown): submission is SubmittedJudgments {
  if (!submission || typeof submission !== 'object' || Array.isArray(submission)) return false
  if (Object.getPrototypeOf(submission) !== Object.prototype) return false
  const entries = Object.entries(submission as Record<string, unknown>)
  if (entries.length > MAX_CANDIDATES || entries.length !== fx.candidates.length) return false
  const cand = new Set(fx.candidates.map((c) => c.id))
  const utt = new Set(fx.utterances.map((u) => u.id))
  let kept = 0
  for (const [id, j] of entries) {
    if (id.length > MAX_ID_LEN || !cand.has(id)) return false
    if (!j || typeof j !== 'object' || Array.isArray(j)) return false
    const keys = Object.keys(j)
    if (keys.length !== 2 || !keys.includes('verdict') || !keys.includes('utteranceId')) return false
    const { verdict, utteranceId } = j as { verdict: unknown; utteranceId: unknown }
    if (verdict !== 'eliminated' && verdict !== 'remaining') return false
    if (typeof utteranceId !== 'string' || utteranceId.length > MAX_ID_LEN || !utt.has(utteranceId)) return false
    if (verdict === 'remaining') kept++
  }
  return kept >= 1
}

export async function resolveListeningAnalysis(
  itemId: unknown,
  submission: unknown,
  decide: (examId: string) => Promise<RevealDecision>,
): Promise<ListeningAnalysisResult> {
  if (typeof itemId !== 'string' || itemId.length > MAX_ID_LEN) return { status: 'invalid' }
  const fx = traceFixtureByKey(itemId)
  if (!fx) return { status: 'invalid' }
  if (!isCompleteSubmission(redactForClient(fx), submission)) return { status: 'invalid' }
  let d: RevealDecision
  try {
    d = await decide(fx.examId)
  } catch {
    return { status: 'failure' }
  }
  if (d === 'open') return { status: 'open', fixture: fx }
  return d === 'embargo' ? { status: 'held' } : { status: 'failure' }
}
