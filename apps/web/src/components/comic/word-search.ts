// apps/web/src/components/comic/word-search.ts
//
// T-0242 PD-COMIC-WORD-SEARCH-01 — 복원만화 뜻 시트의 「내 단어장에서 찾기」(공개 리더에서만 · 학습자가 고를 때만).
// - 검색어는 학습자가 실제로 탭한 낱말이다. 사전의 resolved_word(늦게 오는 조회 결과)는 쓰지 않는다.
// - 정규화(앞뒤 공백 · 소문자)한 뒤 영어 낱말 꼴(글자 · 내부 아포스트로피/하이픈 · 2~64자)일 때만 링크를 만든다. 아니면 null(링크 없음).
// - 경로 · 인코딩은 받아쓰기와 같은 기존 WordVault 검색 계약(wordVaultSearchHref — ?q=)을 그대로 쓴다.
//   검색 링크일 뿐이다 — 저장 · 등록 · 숙달을 뜻하지 않고, 결과가 0개여도 정상이다(목적지가 로그인 · 본인 범위를 판단).

import { wordVaultSearchHref } from '@/lib/dictation/word-vault-link'

const COMIC_WORD = /^[a-z][a-z'-]*[a-z]$/

export function comicWordSearchHref(tapped: string | null | undefined): string | null {
  if (typeof tapped !== 'string') return null
  const q = tapped.trim().toLowerCase()
  if (q.length < 2 || q.length > 64 || !COMIC_WORD.test(q)) return null
  return wordVaultSearchHref(q)
}
