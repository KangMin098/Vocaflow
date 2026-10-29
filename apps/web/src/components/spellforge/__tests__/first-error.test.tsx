// apps/web/src/components/spellforge/__tests__/first-error.test.tsx
// T-0238 — 이번 판에서 처음 틀리게 제출한 철자: 첫 값 유지 · 판/본인/철자 결속 · 철자 확인 뒤에만 대조, SpellForge 가 그 판정을 실제로 쓴다는 소스 결속.
// 실제 부모(SpellForge)의 제출 → 재시도 → 정답 → 완료 왕복 · 키보드 · 계정 전환은 PC 하네스가 덮는다(jsdom 없음 · 새 의존성 금지).
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/scores/record-score', () => ({ useRecordGameScore: () => {} }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }), usePathname: () => '/spellforge/play' }))

import { MissedWordRow } from '../SpellForgeCompletion'
import { NO_FIRST_ERRORS, firstErrorFor, firstErrorOwner, recordFirstError } from '../first-error'

const W = { id: 'w1', text: 'resilient' }
const OWNER = firstErrorOwner('u-1', 't1', 1000)

describe('recordFirstError / firstErrorFor', () => {
  it('오답 여러 번 → 첫 값 유지', () => {
    let s = recordFirstError(NO_FIRST_ERRORS, OWNER, W, 'resilent')
    s = recordFirstError(s, OWNER, W, 'reslient')
    s = recordFirstError(s, OWNER, W, 'resiliant')
    expect(firstErrorFor(s, OWNER, W)).toBe('resilent')
  })

  it('빈 입력은 넣지 않는다 · 기록 없는 낱말(건너뜀만 · 모두 정답)은 null', () => {
    const s = recordFirstError(NO_FIRST_ERRORS, OWNER, W, '  ')
    expect(firstErrorFor(s, OWNER, W)).toBeNull()
    expect(firstErrorFor(NO_FIRST_ERRORS, OWNER, W)).toBeNull()
  })

  it('같은 id 라도 철자가 바뀌면 예전 값을 새 정답에 붙이지 않는다', () => {
    const s = recordFirstError(NO_FIRST_ERRORS, OWNER, W, 'resilent')
    expect(firstErrorFor(s, OWNER, { id: 'w1', text: 'resilience' })).toBeNull()
    // 바뀐 철자에서 처음 틀린 값은 따로 첫 값이 된다
    const t = recordFirstError(s, OWNER, { id: 'w1', text: 'resilience' }, 'resilianse')
    expect(firstErrorFor(t, OWNER, { id: 'w1', text: 'resilience' })).toBe('resilianse')
  })

  it('판 주인(본인 · 자료 · 판 시작)이 바뀌면 처음부터 — 잔존 0', () => {
    const s = recordFirstError(NO_FIRST_ERRORS, OWNER, W, 'resilent')
    for (const other of [firstErrorOwner('u-2', 't1', 1000), firstErrorOwner('u-1', 't2', 1000), firstErrorOwner('u-1', 't1', 2000), firstErrorOwner(null, 't1', 1000), firstErrorOwner(undefined, 't1', 1000)]) {
      expect(other).not.toBe(OWNER)
      expect(firstErrorFor(s, other, W)).toBeNull()
      expect(recordFirstError(s, other, { id: 'w2', text: 'brave' }, 'brav').entries).toEqual({ w2: { text: 'brave', input: 'brav' } })
    }
  })
})

describe('MissedWordRow 대조', () => {
  const row = (firstError?: string | null) => renderToString(<ul><MissedWordRow miss={{ word: { ...W, meaning: '회복력 있는' }, kind: 'retried', firstError }} /></ul>)
  it('철자 확인 전에는 오입력도 정답도 없다', () => {
    const html = row('resilent')
    expect(html).not.toContain('resilent')
    expect(html).not.toContain('resilient')
    expect(html).not.toContain('sf-miss-compare')
  })
  it('대조 블록은 펼친 뒤에만 그린다(소스) · 없으면 대조 없음', () => {
    const src = readFileSync(path.resolve(__dirname, '../SpellForgeCompletion.tsx'), 'utf8')
    expect(src).toMatch(/\{shown && miss\.firstError \? \(/)
    expect(src).toContain('처음 틀리게 제출한 입력')
    expect(src).toContain('정답 철자')
    expect(src).toMatch(/key=\{`\$\{m\.word\.id\}\|\$\{m\.word\.text\}`\}/)
    expect(row(null)).not.toContain('sf-miss-compare')
  })
})

describe('SpellForge 소스 결속', () => {
  const src = readFileSync(path.resolve(__dirname, '../SpellForge.tsx'), 'utf8')
  it('incorrect 제출(handleError)에서만 · 주인일 때만 넣고, 계정 · 인증 변경 때 비우고, same 일 때만 넘긴다', () => {
    expect(src).toMatch(/handleError\(evalResult, userInput\)/)
    expect(src.match(/recordFirstError\(/g)?.length).toBe(1)
    const block = src.slice(src.indexOf('const handleError = useCallback('), src.indexOf('const handlePauseSkip'))
    expect(block).toMatch(/if \(currentWord && ownsSession\(\)\) \{[\s\S]*recordFirstError\(prev, firstErrorOwner\(viewerId, textId, session\.startedAt\.getTime\(\)\), word, submitted\)/)
    expect(src).toMatch(/setFirstErrors\(NO_FIRST_ERRORS\)\n\s*\}, \[viewerId, authStatus\]\)/)
    expect(src).toMatch(/viewerId === undefined \|\| authStatus === 'same'\s*\? firstErrorFor\(/)
    // 입력 문자열을 밖으로 보내지 않는다
    expect(src).not.toMatch(/firstErrors[^\n]*(track|localStorage|sessionStorage|fetch|push\()/)
  })
})
