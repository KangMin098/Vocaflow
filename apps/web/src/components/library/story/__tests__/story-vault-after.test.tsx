// apps/web/src/components/library/story/__tests__/story-vault-after.test.tsx
//
// U03 — 독서 후 「내 단어장 살펴보기」 선택: 유효 저장(saved · already_exists)을 같은 세션에서 관측했을 때만,
// 늦은 응답 · 실패 · 다른 세션(본인 · 판본 전환) · 확인 중 · 거부에는 없음. 서가 · 다시 읽기는 그대로 앞선다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/lib/analytics/client', () => ({ track: vi.fn() }))

import type { StoryWordSaveOutcome } from '@/lib/library/story/learner-types'
import { storyVaultHref } from '@/lib/library/story/return-context'

import { AfterCompletion } from '../StoryReader'
import { markAfterSave, visibleVaultAfterHref } from '../story-vault-after'

const KEY = 'story-a'
const HREF = storyVaultHref({ releaseKey: KEY, unitIndex: 2 })
const ok = (status: 'saved' | 'already_exists'): StoryWordSaveOutcome => ({
  ok: true,
  data: { viewerId: 'v1', status, headword: 'hat', surface: 'hat' },
})
const failed: StoryWordSaveOutcome = { ok: false, code: 'temporary', message: '지금은 저장할 수 없어요.', retryable: true }
const stale = { stale: true } as const
const here = (owner: object, verified = true, denied = false) => ({ owner, verified, denied })

describe('markAfterSave · visibleVaultAfterHref', () => {
  const session = {}

  it('저장 안 함 → 없음', () => {
    expect(visibleVaultAfterHref(null, here(session))).toBeNull()
  })

  it('실패 · 늦은(stale) 응답만 → 없음', () => {
    expect(visibleVaultAfterHref(markAfterSave(null, session, failed, HREF), here(session))).toBeNull()
    expect(visibleVaultAfterHref(markAfterSave(null, session, stale, HREF), here(session))).toBeNull()
  })

  it('saved · already_exists → 기존 검증 왕복 주소 그대로', () => {
    for (const s of ['saved', 'already_exists'] as const) {
      const href = visibleVaultAfterHref(markAfterSave(null, session, ok(s), HREF), here(session))
      expect(href).toBe(HREF)
      expect(href).toBe('/wordvault/browse?story_release=story-a&story_unit=2')
    }
  })

  it('앞선 유효 저장 뒤 실패 · stale 은 표지를 지우지 않고 새로 만들지도 않는다', () => {
    const m = markAfterSave(null, session, ok('saved'), HREF)
    expect(markAfterSave(m, session, failed, 'x')).toBe(m)
    expect(markAfterSave(m, session, stale, 'x')).toBe(m)
  })

  it('다른 세션(본인 · 판본 · 인증 경계 전환) · 확인 중 · 거부 → 없음', () => {
    const m = markAfterSave(null, session, ok('saved'), HREF)
    expect(visibleVaultAfterHref(m, here({}))).toBeNull()
    expect(visibleVaultAfterHref(m, here(session, false))).toBeNull()
    expect(visibleVaultAfterHref(m, here(session, true, true))).toBeNull()
  })
})

describe('AfterCompletion 렌더', () => {
  const render = (vaultHref?: string | null) =>
    renderToString(<AfterCompletion otherWorks={3} releaseKey={KEY} navLocked={false} onGo={() => {}} vaultHref={vaultHref} />)

  it('표지 없음 → 링크 없음 · 서가/다시 읽기 그대로', () => {
    const html = render(null)
    expect(html).not.toContain('data-story-vault-after')
    expect(html).toContain('data-story-next-story')
    expect(html).toContain('data-story-go="reread"')
  })

  it('유효 저장 뒤 → 서가 · 다시 읽기 다음 마지막 보조 링크, 개수 · 「이 Story 만」 주장 없음', () => {
    const html = render(HREF)
    const next = html.indexOf('data-story-next-story')
    const reread = html.indexOf('data-story-go="reread"')
    const vault = html.indexOf('data-story-vault-after')
    expect(next).toBeGreaterThan(-1)
    expect(reread).toBeGreaterThan(next)
    expect(vault).toBeGreaterThan(reread)
    expect(html).toContain(`href="${HREF.replace(/&/g, '&amp;')}"`)
    expect(html).toContain('내 단어장 살펴보기')
    expect(html).not.toMatch(/이 Story에서|개의 낱말|\d+개/)
  })
})
