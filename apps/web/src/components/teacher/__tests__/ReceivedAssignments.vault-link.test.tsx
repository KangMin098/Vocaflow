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
