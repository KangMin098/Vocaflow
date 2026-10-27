// apps/web/src/components/workspace/__tests__/complete-chapter-button.test.tsx
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { attemptCompletion, ChapterCompleteAction } from '../CompleteChapterButton'
import type { CompleteChapterResult } from '@/lib/library/complete-chapter'

const ok = (over: Partial<CompleteChapterResult> = {}): CompleteChapterResult => ({
  ok: true, alreadyCompleted: false, nextChapterTextId: 'next-1', bookCompleted: false, ...over,
})

describe('attemptCompletion', () => {
  it('성공·이미 완료는 ok 로 결과를 그대로 넘긴다', async () => {
    expect(await attemptCompletion('t1', async () => ok(), () => true)).toEqual({ kind: 'ok', result: ok() })
    const again = ok({ alreadyCompleted: true })
    expect(await attemptCompletion('t1', async () => again, () => true)).toEqual({ kind: 'ok', result: again })
  })
  it('ok=false 와 reject 는 실패', async () => {
    expect(await attemptCompletion('t1', async () => ({ ...ok(), ok: false }), () => true)).toEqual({ kind: 'failed' })
    expect(await attemptCompletion('t1', async () => { throw new Error('network') }, () => true)).toEqual({ kind: 'failed' })
  })
  it('실패 뒤 다시 시도하면 같은 textId 로 다시 호출해 성공한다', async () => {
    const complete = vi.fn<[string], Promise<CompleteChapterResult>>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(ok())
    expect((await attemptCompletion('t1', complete, () => true)).kind).toBe('failed')
    expect((await attemptCompletion('t1', complete, () => true)).kind).toBe('ok')
    expect(complete.mock.calls).toEqual([['t1'], ['t1']])
  })
  it('응답 전에 장이 바뀌면 성공·실패 모두 stale — 다른 장에 표시하지 않는다', async () => {
    expect(await attemptCompletion('t1', async () => ok(), () => false)).toEqual({ kind: 'stale' })
    expect(await attemptCompletion('t1', async () => { throw new Error('x') }, () => false)).toEqual({ kind: 'stale' })
  })
})

describe('ChapterCompleteAction 마크업', () => {
  it('기본: 44px 완료 버튼 · 보이는 focus · 오류 없음', () => {
    const html = renderToString(<ChapterCompleteAction phase="idle" onComplete={() => {}} />)
    expect(html).toContain('이 장 완료')
    expect(html).toContain('min-h-[44px]')
    expect(html).toContain('focus-visible:ring-2')
    expect(html).not.toContain('role="alert"')
    expect(html).not.toContain('aria-busy')
  })
  it('저장 중: aria-busy · aria-disabled(포커스 유지) · 상태 알림', () => {
    const html = renderToString(<ChapterCompleteAction phase="submitting" onComplete={() => {}} />)
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('aria-disabled="true"')
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/)
    expect(html).toContain('완료 표시를 저장하는 중')
  })
  it('실패: role=alert 안내 · 읽기 위치 보존 문구 · 다시 시도', () => {
    const html = renderToString(<ChapterCompleteAction phase="failed" onComplete={() => {}} />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('읽던 곳은 그대로예요')
    expect(html).toContain('다시 시도')
  })
})
