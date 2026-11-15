// apps/web/src/components/spellforge/vault-search.ts
//
// T-0265 — 완료 복기의 놓친 낱말을 「내 단어장에서 이 낱말 찾기」로(기존 WordVault 검색 ?q= — wordVaultSearchHref 재사용).
// 본인 신원이 긍정 확인(viewerId 있음 + same)됐을 때만 만든다. 영어 낱말 · 구 꼴(글자 · 내부 공백/'/- · 1~64자)이 아니면 null.
// 링크는 철자를 펼친 뒤에만 그린다(SpellForgeCompletion) — 가린 동안 URL · 접근성 이름에 철자가 없다. 저장 · 원문 · 복습 기한을 약속하지 않는다.

import { wordVaultSearchHref } from '@/lib/dictation/word-vault-link'

const WORD = /^[A-Za-z](?:[A-Za-z' -]*[A-Za-z])?$/

export function missedWordSearchHref(text: string, identity: { viewerId: string | null | undefined; status: string }): string | null {
  if (!identity.viewerId || identity.status !== 'same') return null
  const q = text.trim().replace(/\s+/g, ' ')
  if (q.length < 1 || q.length > 64 || !WORD.test(q)) return null
  return wordVaultSearchHref(q.toLowerCase())
}
