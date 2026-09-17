// apps/web/src/lib/csat/session/reveal.ts
//
// **답을 고른 뒤에만 나가는 것.** 정답 번호 · 해설 · 근거 자리 · 강의 길이.
//
// ⚠️ 이 모듈의 결과는 `/api/csat/session/reveal`(POST · 로그인) 한 길로만 나간다. 세션 화면의
//    서버 렌더 props 에 넣으면 RSC 페이로드에 박혀 「먼저 푼다」가 코드로 안 지켜진다(지시문 A4 · D9).
// ⚠️ 원문(지문·선지)은 여기서도 읽지 않는다 — `csat_items_public` · 우리 분석 · 커밋된 골격뿐이다.
//    골격의 `reveals[].text` 는 분석이 근거로 든 **짧은 인용**이다(`passage-skeleton.ts` 경계).

import type { SupabaseClient } from '@supabase/supabase-js'

import { loadCsatItemExplain } from '@/lib/csat/learner'
import { lectureMeta } from '@/lib/csat/lecture/store'
import type { AnchorOrigin } from '@/lib/csat/passage-skeleton'
import { loadItemSkeleton } from '@/lib/csat/skeleton'
import { createClient } from '@/lib/supabase/server'

import { firstSentences, oneLiner } from './text'

export interface RevealAnchor {
  /** `answer` · `reject:3` */
  id: string
  from: AnchorOrigin | null
  /** 골격 문장 번호(0부터) */
  sentences: number[]
  /** 그 자리의 짧은 인용 — reflow 문장에서 다시 찾는 열쇠 */
  quotes: string[]
}

export interface RevealPayload {
  item_id: string
  answer: number | null
  answer_unknown: boolean
  type_name: string | null
  /** 「다음에 이 유형: …」 */
  one_liner: string | null
  /** 근거 문장 밑 설명(≤3문장) */
  evidence: { text: string; cut: boolean }
  /** 정답이 왜 정답인가(≤3문장) */
  why_correct: { text: string; cut: boolean }
  distractors: { n: number; trap: string | null; line: string; tempting: string | null }[]
  /** [더 보기] 안 — 재는 힘 · 출제 의도 · 절차 · 어휘 */
  more: {
    ability: string | null
    intent: string | null
    procedure: string[]
    vocab: string[]
  }
  /** 골격 — 문장 길이열과 앵커. 없으면 인라인 대신 설명 카드 목록으로 간다 */
  skeleton: { sentences: number[]; anchors: RevealAnchor[] } | null
  lecture: { sec: number; cues: number } | null
}

export async function loadReveal(itemId: string): Promise<{ payload: RevealPayload | null; error: string | null }> {
  const { item, error } = await loadCsatItemExplain(itemId)
  if (error) return { payload: null, error }
  if (!item) return { payload: null, error: null }

  // 유형 첫 절차 — 「한 줄」의 재료. 못 읽으면 문항 절차의 첫 줄로 대신한다
  let firstStep: string | null = null
  if (item.type_id) {
    // `Database` 타입에 `csat_*` 가 없다 — `learner.ts` 의 `csatDb()` 와 같은 완화(한 줄)
    const db = (await createClient()) as unknown as SupabaseClient
    const { data } = await db
      .from('csat_type_reports')
      .select('procedure_steps')
      .eq('type_id', item.type_id)
      .maybeSingle()
    const steps = (data as { procedure_steps?: { step?: string }[] } | null)?.procedure_steps
    firstStep = Array.isArray(steps) ? (steps[0]?.step ?? null) : null
  }

  const sk = loadItemSkeleton(item.id)
  const skeleton = sk
    ? {
        sentences: sk.sentences.map((s) => s.chars),
        anchors: sk.anchors.map((a) => ({
          id: a.id,
          from: a.from ?? null,
          sentences: a.sentences,
          quotes: sk.sentences.flatMap((s) => s.reveals.filter((r) => r.anchorId === a.id).map((r) => r.text)),
        })),
      }
    : null

  const line = (s: string | null) => firstSentences(s, 1).text
  return {
    payload: {
      item_id: item.id,
      answer: item.answer,
      answer_unknown: item.answer_unknown,
      type_name: item.type_name,
      one_liner: oneLiner(firstStep ?? item.procedure[0]?.step ?? null),
      evidence: firstSentences(item.evidence_reasoning ?? item.why_correct, 3),
      why_correct: firstSentences(item.why_correct, 3),
      distractors: item.distractors.map((d) => ({
        n: d.n,
        trap: d.trap,
        line: line(d.how_to_reject),
        tempting: d.why_tempting ? line(d.why_tempting) : null,
      })),
      more: {
        ability: item.measured_ability,
        intent: item.design_intent,
        procedure: item.procedure.map((p) => p.step),
        vocab: item.required_vocab,
      },
      skeleton,
      lecture: lectureMeta(item.id),
    },
    error: null,
  }
}
