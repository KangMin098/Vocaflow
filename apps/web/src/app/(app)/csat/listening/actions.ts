// apps/web/src/app/(app)/csat/listening/actions.ts
//
// 듣기 근거 추적 — 제출 뒤 분석(정답 번호 · 기대 판정 · 근거 역할) 열기. 첫 렌더 props 에는 정답이 없다(redactForClient).
// 로그인 확인 → 문항 id 화이트리스트 → 학습자 확정 판단(submission)의 구조 검증(모든 후보 1회 · 유효 판정 · 실재 발화 ·
// 하나 이상 남김 · 모르는 키 없음) → Reveal Gate(`examRevealDecision`)를 **이 요청에서 다시** 판정 → 'open' 일 때만 전체.
// 기존 CSAT 화면은 `/api/csat/state` 가 itemRevealDecision 뒤 423 으로 보류를 알린다 — 여기는 같은 관문을 서버 액션으로 쓴다.
//
// ⚠️ 남은 한계(문서화된 경계): 시도 기록을 DB 에 남기지 않으므로(쓰기는 별도 승인 필요) 스크립트로 완전한 제출 모양을
//    위조하면 분석을 받을 수 있다. 이는 Reveal Gate 가 'open' 인 시험 — 즉 정답이 공식 공개된 시험 — 에서만 가능하고,
//    보류 · 판정 실패 시험은 위조 제출로도 열리지 않는다. 제출 증명이 필요해지면 시도 기록 테이블과 함께 바꾼다.

'use server'

import { examRevealDecision } from '@/lib/csat/embargo-gate'
import { resolveListeningAnalysis, type ListeningAnalysisResult } from '@/lib/csat/listening/fixtures/analysis'
import { createClient } from '@/lib/supabase/server'

export async function revealListeningAnalysis(itemId: string, submission: unknown): Promise<ListeningAnalysisResult> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { status: 'unauthenticated' }
  } catch {
    return { status: 'failure' }
  }
  return resolveListeningAnalysis(itemId, submission, (examId) => examRevealDecision(examId))
}
