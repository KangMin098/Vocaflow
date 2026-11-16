// apps/web/src/components/workspace/__tests__/complete-chapter-button.test.tsx
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ChapterCompleteAction } from '../CompleteChapterButton'

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
