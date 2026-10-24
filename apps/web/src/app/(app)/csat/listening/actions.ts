// apps/web/src/app/(app)/csat/listening/actions.ts
//
// 듣기 근거 추적 — 제출 뒤 분석(정답 번호 · 기대 판정 · 근거 역할) 열기. 첫 렌더 props 에는 정답이 없다(redactForClient).
// 로그인 확인 → 문항 id 화이트리스트 → Reveal Gate(`examRevealDecision`)를 **이 요청에서 다시** 판정 → 'open' 일 때만 전체.
// 기존 CSAT 화면은 `/api/csat/state` 가 itemRevealDecision 뒤 423 으로 보류를 알린다 — 여기는 같은 관문을 서버 액션으로 쓴다.

'use server'

import { examRevealDecision } from '@/lib/csat/embargo-gate'
import { resolveListeningAnalysis, type ListeningAnalysisResult } from '@/lib/csat/listening/fixtures/analysis'
import { createClient } from '@/lib/supabase/server'

export async function revealListeningAnalysis(itemId: string): Promise<ListeningAnalysisResult> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { status: 'unauthenticated' }
  } catch {
    return { status: 'failure' }
  }
  return resolveListeningAnalysis(itemId, (examId) => examRevealDecision(examId))
}
