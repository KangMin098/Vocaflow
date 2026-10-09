// apps/web/src/lib/csat/learner-text.ts
//
// 학습자에게 보이는 분석 문장에서 **분석 작업 메모**를 걷어 낸다(2026-10-09 학습 가치 감사).
// 드레인 분석가가 데이터 처리 사정(파싱 잔여 · OCR 잔여 · 저장 지문 2단 병합 · 코퍼스 지문 · raw_block)을
// 설명 속에 적어 둔 문장이 학습자 화면에 그대로 나왔다 — 실측 3,408 분석 중 63건.
// 원본 분석은 고치지 않는다(검수 · 재분석 근거로 남긴다). 화면 경계에서만 거른다.
//
// 거르는 단위: ① 메모가 든 괄호 덩어리 ② 메모가 든 문장(「참고: …」 포함). 나머지 설명은 그대로 둔다.
// 오탐 주의: 「QR 코드를 스캔」 · 「데이터에 기반한」 · 「병합(merge)」 같은 지문 내용은 패턴에 없다.

const INTERNAL = /파싱 ?(잔여|값)|OCR 잔여|저장(된)? 지문|2단 병합|코퍼스 지문|우리 코퍼스|원문 데이터|raw_block|쪽번호 잡음/

/** 분석 작업 메모를 걷어 낸 학습자용 문장. 남는 것이 없으면 null */
export function stripInternalNotes(s: string | null | undefined): string | null {
  if (!s) return null
  if (!INTERNAL.test(s)) return s
  // ① 메모가 든 괄호 덩어리
  let out = s.replace(/\s*\([^()]*\)/g, (m) => (INTERNAL.test(m) ? '' : m))
  // ② 메모가 든 문장 — 마침표 뒤 공백에서 나눈다
  out = out
    .split(/(?<=\.)\s+/)
    .filter((sentence) => !INTERNAL.test(sentence))
    .join(' ')
    .trim()
  return out ? out : null
}

/** 메모 패턴이 남았나 — 가드 · 측정용 */
export function hasInternalNote(s: string | null | undefined): boolean {
  return !!s && INTERNAL.test(s)
}
