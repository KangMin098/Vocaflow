// apps/web/src/lib/wordvault/__tests__/set-chip-label.test.ts
// fetchUserSetChips — 구독 세트 제목의 엔티티는 label 에서만 풀고 id · count 는 그대로.
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { fetchUserSetChips } from '../browse-queries'

const S1 = '404f4977-7d03-4955-8834-833a668f13af'
function client(rows: { id: string; title: string; cover_emoji: string | null; category: string }[]) {
  const q = { select: () => q, in: () => q, neq: async () => ({ data: rows, error: null }) }
  return { from: () => q } as never
}

describe('fetchUserSetChips 라벨', () => {
  it('엔티티 제목 → 화면 글자, id · count 불변', async () => {
    const chips = await fetchUserSetChips(client([{ id: S1, title: 'Lincoln&#x27;s Cottage', cover_emoji: null, category: 'library_article' }]), [{ shared_set_id: S1 }, { shared_set_id: S1 }] as never)
    expect(chips).toEqual([{ id: `set:${S1}`, label: "Lincoln's Cottage", count: 2 }])
  })
  it('표지 이모지 · 한글 제목은 그대로 붙는다', async () => {
    const chips = await fetchUserSetChips(client([{ id: S1, title: '어린 왕자 &amp; 친구들', cover_emoji: '📚', category: 'theme' }]), [{ shared_set_id: S1 }] as never)
    expect(chips[0].label).toBe('📚 어린 왕자 & 친구들')
  })
})
