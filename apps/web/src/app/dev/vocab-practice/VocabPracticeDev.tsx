// apps/web/src/app/dev/vocab-practice/VocabPracticeDev.tsx
//
// 격리 화면의 클라이언트 — 기존 `DcpPlayer` 를 그대로 쓰고 채점 · 오답 원인 기록만 로컬로 바꾼다.
// 채점 규칙은 보류 SQL 과 같은 `gradeUnderlineChoice`(PGlite 시험이 둘의 일치를 본다).
'use client'

import { DcpPlayer } from '@/components/practice/DcpPlayer'
import type { DcpGradeResult } from '@/lib/learner/dcp'
import { gradeUnderlineChoice } from '@/lib/learner/dcp-underline'

import { fixtureItems, fixtureKey } from './fixtures'

async function grade(itemId: string, answer: Record<string, unknown>): Promise<DcpGradeResult> {
  const key = fixtureKey(itemId)
  if (!key) return { ok: false, error: '합성 문항을 찾지 못했어요.' }
  const correct = gradeUnderlineChoice(key, answer)
  // 서버 채점과 같은 모양 — 맞히면 해설만, 틀리면 정답 키 전체(정답 공개)
  return {
    ok: true,
    correct,
    attemptId: null,
    answerKey: correct ? { explanation_ko: key.explanation_ko } : { ...key },
  }
}

export function VocabPracticeDev() {
  return <DcpPlayer items={fixtureItems()} backHref="/dev" backCta="개발 목록으로" grade={grade} recordCause={async () => ({ ok: true })} />
}
