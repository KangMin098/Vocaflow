// apps/web/src/components/pairflip/__tests__/pairs-list-recall.test.tsx
// T-0218 — 두 번 이상 걸린 짝은 뜻을 가린 채 「뜻 확인」(aria-expanded), 한 번에 맞힌 짝 · 전부 1회면 예전 목록 그대로. 기록 호출 없음.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ seed: [] as unknown[] }))
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return { ...actual, useState: (init: unknown) => actual.useState(h.seed.length ? h.seed.shift() : init) }
})

import { PairFlipPairsList, needsRecall } from '../PairFlipPairsList'

const pair = (id: string, attempts: number) => ({ pairId: id, word: `word-${id}`, meaning: `뜻-${id}`, attempts, matchedAt: 0, fsrsRating: 3 as const })
const render = (pairs: ReturnType<typeof pair>[], seed: unknown[] = []) => {
  h.seed = seed
  return renderToStaticMarkup(<PairFlipPairsList pairs={pairs} />)
}

describe('needsRecall — attempts 경계', () => {
  it('1 은 아니고 2 · 3 은 다시 떠올리기', () => {
    expect(needsRecall(1)).toBe(false)
    expect(needsRecall(2)).toBe(true)
    expect(needsRecall(3)).toBe(true)
  })
})

describe('PairFlipPairsList 뜻 가리기', () => {
  it('attempts 1 은 뜻을 그대로, 2 · 3 은 뜻을 가리고 「뜻 확인」(aria-expanded=false · aria-controls · 44px)', () => {
    const html = render([pair('a', 1), pair('b', 2), pair('c', 3)])
    expect(html).toContain('뜻-a')
    expect(html).not.toContain('뜻-b')
    expect(html).not.toContain('뜻-c')
    expect(html.match(/data-testid="pf-recall-pair"/g)).toHaveLength(2)
    expect(html.match(/aria-expanded="false"[^>]*aria-controls=/g)).toHaveLength(2)
    expect(html.match(/뜻을 먼저 떠올려 보세요/g)).toHaveLength(2)
    expect(html.match(/>뜻 확인</g)).toHaveLength(2)
    expect(html).toContain('min-h-[44px]')
    expect(html).toContain('word-b')
  })
  it('토글을 연 상태면 그 짝 뜻 · 「뜻 가리기」 · aria-expanded=true', () => {
    // useState 순서: 목록 open · 행 b shown
    const html = render([pair('b', 2)], [true, true])
    expect(html).toContain('뜻-b')
    expect(html).toContain('>뜻 가리기<')
    expect(html).toMatch(/aria-expanded="true"[^>]*aria-controls=/)
    // 연 뜻은 자르지 않는다(가린 안내만 한 줄)
    expect(html).toMatch(/class="font-body text-[12px] text-[var(--t2)] break-keep" data-testid="pf-recall-meaning"/)
  })
  it('모두 한 번에 맞혔으면 예전 목록 그대로(가림 · 토글 없음)', () => {
    const html = render([pair('a', 1), pair('d', 1)])
    expect(html).not.toContain('pf-recall-pair')
    expect(html).not.toContain('뜻 확인')
    expect(html).toContain('뜻-a')
    expect(html).toContain('뜻-d')
  })
  it('기록 · 네트워크 호출이 없다(모듈이 서버 액션 · fetch 를 쓰지 않는다)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as never)
    render([pair('b', 2)], [true, true])
    expect(fetchSpy).not.toHaveBeenCalled()
    const src = (await import('node:fs')).readFileSync(new URL('../PairFlipPairsList.tsx', import.meta.url), 'utf8')
    expect(src).not.toMatch(/fetch\(|track\(|record|use server|supabase/i)
  })
})
