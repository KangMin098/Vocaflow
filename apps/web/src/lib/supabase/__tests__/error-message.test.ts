// apps/web/src/lib/supabase/__tests__/error-message.test.ts
//
// 학습자에게 DB 오류 원문이 새지 않는가.
//
// ── 왜 (실측 2026-08-30) ─────────────────────────────────────────────
// 쓰기 페이로드가 커지면 응답이 JSON 이 아니라 **HTML 오류 페이지**로 온다
// (19.7MB 통과 · 48.1MB 는 43초 뒤 HTML). 그런데 `VocabSetGrid` 는 그 문자열을
// 토스트에 그대로 그렸다 — 단어장을 담다가 **HTML 소스를 보게 된다.**
//
// 그렇다고 빈 문장으로 삼키면 안 된다. "실패했다" 는 사실은 남아야 한다.

import { describe, expect, it } from 'vitest'

import { dbErrorForUi, humanDbError } from '@/lib/supabase/error-message'

describe('humanDbError', () => {
  it('HTML 응답은 사람의 문장으로 바꾼다', () => {
    const html = '<!DOCTYPE html>\n<!--[if lt IE 7]> <html class="no-js ie6 old"> <![endif]-->'
    expect(humanDbError(html)).toMatch(/너무 커서/)
    expect(humanDbError(html)).not.toContain('<')
  })

  it('닫는 태그만 있어도 HTML 로 본다 — 앞이 잘려 온다', () => {
    expect(humanDbError('… 502 Bad Gateway</body></html>')).toMatch(/너무 커서/)
  })

  it('짧고 구체적인 원문은 그대로 쓴다 — 더 도움이 된다', () => {
    expect(humanDbError('duplicate key value violates unique constraint')).toBe(
      'duplicate key value violates unique constraint',
    )
  })

  it('지나치게 긴 문자열은 대체 문장으로', () => {
    expect(humanDbError('x'.repeat(500))).toBe('잠시 후 다시 시도해 주세요')
  })

  it('빈 값도 문장을 준다 — 실패를 조용히 삼키지 않는다', () => {
    expect(humanDbError(null)).toBe('잠시 후 다시 시도해 주세요')
    expect(humanDbError('   ')).toBe('잠시 후 다시 시도해 주세요')
    expect(humanDbError(undefined, '단어장을 담지 못했어요')).toBe('단어장을 담지 못했어요')
  })
})

describe('dbErrorForUi', () => {
  it('화면 문장과 로그 원문을 함께 준다 — 원인은 잃지 않는다', () => {
    const r = dbErrorForUi('<!DOCTYPE html> …')
    expect(r.shown).toMatch(/너무 커서/)
    expect(r.raw).toContain('<!DOCTYPE html>')
  })

  it('원문 로그는 잘라 둔다 — 로그에 HTML 한 장을 통째로 남기지 않는다', () => {
    expect(dbErrorForUi('y'.repeat(5000)).raw.length).toBeLessThanOrEqual(500)
  })
})
