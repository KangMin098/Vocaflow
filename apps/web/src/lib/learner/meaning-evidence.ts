// apps/web/src/lib/learner/meaning-evidence.ts
//
// 의미 선택 뒤 「본문 근거 짚기」 — 글의 중심 의미(제목 · 주제 · 요지 · 요약 · 목적 · 주장)를 고른 학습자가
// 채점 **뒤에** 그 판단을 받치는 본문 문장 하나를 짚고, 등록된 해설과 나란히 비교한다.
//
// ⚠️ 안내 연습이다 — 짚은 문장을 맞다 · 틀렸다 판정하지 않는다. 문항마다 정답 근거가 따로 등록돼 있지 않고(채점 응답은
//    해설 · 정답 키만 돌려준다), 중심 의미는 여러 문장이 함께 받칠 수 있다. 다른 유효한 근거를 틀렸다고 하지 않는다.
//    점수 · 숙달 · SRS · 평가 기록을 만들지 않는다.
// ⚠️ 채점 전에는 쓰지 않는다(화면이 채점 뒤에만 부른다).
// 문장 나누기는 ScriptQuiz 근거 짚기(T-0193)와 같은 함수(splitSentences)를 쓴다.

import { splitSentences } from '@/lib/scriptquiz/evidence'

/** 근거 짚기를 붙이는 유형 — 글 전체의 중심 의미를 고르는 것만. 빈칸 · 순서 · 삽입 · 밑줄 · 내용 일치 등은 제외. */
export const MEANING_EVIDENCE_TYPES = ['title', 'topic', 'main_point', 'summary', 'purpose', 'claim', 'long_title'] as const

export function isMeaningEvidenceType(type: unknown): boolean {
  return typeof type === 'string' && (MEANING_EVIDENCE_TYPES as readonly string[]).includes(type)
}

/** 약어 안의 마침표를 잠시 바꿔 둘 문자 — 본문에 나오지 않는 사용자 영역 문자. 나눈 뒤 마침표로 되돌린다. */
const DOT = ''

/**
 * 약어 보호 — 「Washington, D.C., stands …」 가 splitSentences 의 마침표 기준에서 「D.」 · 「C.」 로 갈렸다(Codex 실측 · Lincoln 원문).
 * 나누기 전에 약어 안의 마침표만 DOT 로 바꾸고, 나눈 뒤 되돌린다 — **원문 글자는 하나도 바꾸지 않는다**(잇기 방식은
 * 공백 · 글자를 다시 만들다 원문을 바꿨다). 대상: 이니셜이 둘 이상 이어진 것(D.C. · U.S.) · 호칭(Mr. Mrs. Ms. Dr. St. Jr. Sr.).
 */
function protectAbbreviations(text: string): string {
  return text
    .replace(/\b(?:[A-Z]\.){2,}/g, (m) => m.replace(/\./g, DOT))
    .replace(/\b(Mr|Mrs|Ms|Dr|St|Jr|Sr)\./g, `$1${DOT}`)
}

/** 짚을 후보 문장 — 지문을 문장으로 나눈 것. 두 문장이 안 되면 짚을 것이 없어 null(화면이 그리지 않는다). */
export function meaningEvidenceSentences(type: unknown, passage: string | null | undefined): string[] | null {
  if (!isMeaningEvidenceType(type) || typeof passage !== 'string') return null
  const sentences = splitSentences(protectAbbreviations(passage)).map((s) => s.split(DOT).join('.'))
  return sentences.length >= 2 ? sentences : null
}
