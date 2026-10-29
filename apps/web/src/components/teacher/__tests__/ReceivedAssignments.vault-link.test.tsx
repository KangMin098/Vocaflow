// apps/web/src/components/teacher/__tests__/ReceivedAssignments.vault-link.test.tsx
import { describe, expect, it } from 'vitest'
import { receivedWordVaultHref } from '../ReceivedAssignments'

describe('receivedWordVaultHref (T-0273)', () => {
  it('영어 낱말 꼴은 기존 검색 경로 + from=/teacher', () => {
    expect(receivedWordVaultHref('apple')).toBe('/wordvault/browse?q=apple&from=%2Fteacher')
    expect(receivedWordVaultHref('  well-being ')).toBe('/wordvault/browse?q=well-being&from=%2Fteacher')
    expect(receivedWordVaultHref("don't")).toBe('/wordvault/browse?q=don%27t&from=%2Fteacher')
  })
  it('영어 낱말 꼴이 아니면 링크 없음', () => {
    for (const w of ['', '   ', 'take off', '사과', 'a1', 'x&y=1', '-pre', 'end-', "a''b", 'q?z']) {
      expect(receivedWordVaultHref(w)).toBeNull()
    }
  })
  it('긴 낱말도 그대로 하나만 싣는다', () => {
    const w = 'a'.repeat(60)
    expect(receivedWordVaultHref(w)).toBe(`/wordvault/browse?q=${w}&from=%2Fteacher`)
  })
})

// 본인 확인 경계 — 서버 viewer 와 브라우저 세션이 같을 때(same)만 링크
import { renderToString } from 'react-dom/server'
import { vi } from 'vitest'
import { StoryAuthSourceContext, type StoryAuthSource } from '@/components/library/story/use-story-auth-guard'
import { ReceivedAssignments } from '../ReceivedAssignments'
import type { ClassAssignment } from '@/lib/teacher/assignment-actions'

const g = vi.hoisted(() => ({ calls: 0 }))
vi.mock('@/lib/teacher/assignment-actions', () => ({ markAssignmentCollected: vi.fn(async () => { g.calls++; return { ok: true } }) }))

const a1: ClassAssignment = { id: 'a1', classId: 'c', className: '1반', title: '과제', words: [{ w: 'apple', m: '사과' }, { w: 'take off', m: '이륙' }], createdAt: '2026-10-29T00:00:00Z' }
const src = (known: string | null | undefined): StoryAuthSource => ({ subscribe: () => () => {}, currentUserId: async () => known ?? null, testOnlyKnownUserId: () => known })
const links = (viewerId: string | null, known: string | null | undefined, as = [a1], failed = false) => {
  const html = renderToString(
    <StoryAuthSourceContext.Provider value={src(known)}>
      <ReceivedAssignments assignments={as} viewerId={viewerId} failed={failed} />
    </StoryAuthSourceContext.Provider>,
  )
  return (html.match(/data-testid="received-word-vault-link"/g) ?? []).length
}

describe('ReceivedAssignments 본인 확인 (T-0273)', () => {
  it('same — 영어 낱말 꼴에만 링크', () => expect(links('u1', 'u1')).toBe(1))
  it('checking(브라우저 신원 모름) — 링크 0', () => expect(links('u1', undefined)).toBe(0))
  it('changed(다른 계정) — 이전 계정 과제에서 링크 0', () => expect(links('u1', 'u2')).toBe(0))
  it('signed-out — 링크 0', () => expect(links('u1', null)).toBe(0))
  it('서버 viewer 없음 — 브라우저도 비로그인(null=null)이어도 링크 0', () => expect(links(null, null)).toBe(0))
  it('실패 · 빈 목록 — 링크 0 · 담기 호출 0', () => {
    expect(links('u1', 'u1', [], true)).toBe(0)
    expect(links('u1', 'u1', [])).toBe(0)
    expect(g.calls).toBe(0)
  })
})
