// apps/web/src/lib/dictation/word-vault-link.ts
//
// 받아쓰기 결과의 놓친 낱말 → 내 단어장 검색(DIC-VOC-01). 검색 링크일 뿐이다 —
// 그 낱말이 이미 저장됐는지·같은 원문 카드인지·복습 기한인지 약속하지 않는다(목적지 WordVault 가 서버 인증·본인 필터로 판단).
// URL 에는 낱말 하나만 싣는다(UID · 세션 · 입력문 없음). 인코딩은 URLSearchParams 하나로 — WordVault 는 searchParams.get('q') → trim 으로 읽는다.

export const WORD_VAULT_BROWSE_PATH = '/wordvault/browse'

/** 놓친 낱말 하나의 검색 경로 — 앞뒤 공백을 지운 뒤 비면 null(링크를 만들지 않는다). */
export function wordVaultSearchHref(word: string): string | null {
  const q = word.trim()
  if (!q) return null
  return `${WORD_VAULT_BROWSE_PATH}?${new URLSearchParams({ q }).toString()}`
}
