// apps/web/src/lib/csat/session/text.ts
//
// 세션 화면이 분석 글을 **짧게** 내놓는 규칙 — 순수 함수.
//
// 분석은 길다(유형 첫 절차 최대 274자 · 실측 2026-09-17). 학습 화면은 한 자리에 한 호흡만 둔다
// (지시문 B: 설명 한 단락 ≤ 3문장 · 「한 줄」). 자르되 **지어내지 않는다** — 원래 글의 앞부분이다.

/** 한국어 문장 끝 — `다.` `요.` `?` `!` 와 영어 마침표 뒤 공백 */
const SENT_END = /(?<=[다요죠음함]\.|[?!]|\.(?=\s+[A-Z가-힣“"(]))\s+/

export function splitKoSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(SENT_END)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 앞에서 n 문장까지. 잘렸으면 `cut: true` — 화면이 「더 보기」를 달 수 있게 */
export function firstSentences(text: string | null | undefined, n = 3): { text: string; cut: boolean } {
  if (!text) return { text: '', cut: false }
  const s = splitKoSentences(text)
  return { text: s.slice(0, n).join(' '), cut: s.length > n }
}

/**
 * 「다음에 이 유형: …」 한 줄 — 유형 첫 절차의 **첫 절**.
 * 괄호 속 예시는 걷어 내고(자르지 않는다), ` — ` 앞 · 첫 문장 끝에서 자른다.
 * 그래도 길면 70자 근처 낱말 경계.
 *
 * ⚠️ 괄호에서 **자르면** 안 된다 — `수신자 표기(Dear 뒤)와 서명·자기소개로 발신자 지위를 먼저 정한다`
 *    가 「수신자 표기」 네 글자가 됐다(실측 2026-09-17 · R-PURPOSE). 괄호만 빼면 문장이 산다.
 */
export function oneLiner(step: string | null | undefined): string | null {
  if (!step) return null
  let s = step.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
  s = s.split(/\s[—–]\s|\s-\s/)[0]
  // 괄호 속(예시·주석)을 걷는다 — 중첩이 없는 가장 안쪽부터 되풀이
  for (let k = 0; k < 3 && /\([^()]*\)/.test(s); k += 1) s = s.replace(/\s?\([^()]*\)/g, '')
  s = s.replace(/\s+/g, ' ').trim()
  s = splitKoSentences(s)[0] ?? s
  s = s.replace(/[.。]\s*$/, '').trim()
  if (s.length > 70) {
    const cut = s.slice(0, 70)
    s = cut.slice(0, Math.max(cut.lastIndexOf(' '), 40)).trim() + '…'
  }
  return s || null
}
