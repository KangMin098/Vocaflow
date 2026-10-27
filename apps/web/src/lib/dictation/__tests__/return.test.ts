// apps/web/src/lib/dictation/__tests__/return.test.ts
import { describe, expect, it } from 'vitest'

import { dictationFrom, dictationRetryHref, withDictationFrom } from '../return'

describe('받아쓰기 복귀 from', () => {
  it('안전한 내부 경로만 잇는다', () => {
    expect(withDictationFrom('/dictate/session?sessionId=s1', '/text/t1?mode=read')).toBe('/dictate/session?sessionId=s1&from=%2Ftext%2Ft1%3Fmode%3Dread')
    expect(withDictationFrom('/dictate/results', '/text/t1')).toBe('/dictate/results?from=%2Ftext%2Ft1')
  })

  it('불량 · 외부 from 은 버린다(기존 sanitizeInternalPath)', () => {
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', '/a b', 'text/t1', '', null, undefined]) {
      expect(withDictationFrom('/dictate/results?sessionId=s1', bad)).toBe('/dictate/results?sessionId=s1')
      expect(dictationFrom(bad)).toBeNull()
    }
  })

  it('같은 자료 재시도 — 글 · 묶음(장) 에 from, 붙여넣기 · 오늘은 허브(from 없음)', () => {
    expect(dictationRetryHref({ textId: 't1' }, '/text/t1')).toBe('/dictate/setup?text=t1&from=%2Ftext%2Ft1')
    expect(dictationRetryHref({ sharedSetId: 'w1', chapterIdx: 3 }, '/library/books/b1')).toBe('/dictate/setup?set=w1&chapter=3&from=%2Flibrary%2Fbooks%2Fb1')
    expect(dictationRetryHref({ textId: 't1' })).toBe('/dictate/setup?text=t1')
    expect(dictationRetryHref({ sharedSetId: 'w1' }, null)).toBe('/dictate/setup?set=w1')
    expect(dictationRetryHref({}, '/text/t1')).toBe('/dictate')
    expect(dictationRetryHref({ textId: 't1' }, 'https://evil.example')).toBe('/dictate/setup?text=t1')
  })
})
