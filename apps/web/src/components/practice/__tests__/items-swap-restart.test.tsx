// apps/web/src/components/practice/__tests__/items-swap-restart.test.tsx
// T-0248 — R0 문항 목록이 교체되면 플레이어를 새로 시작한다(이전 답 · 채점 · 집계 섞임 없음). 판정은 순수 함수, 흐름은 PC 하네스(pc-t248)가 잰다.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import type { DcpItem } from '@/lib/learner/dcp'

vi.mock('@/lib/learner/dcp-actions', () => ({ gradeDcpItem: vi.fn(), recordDcpErrorCause: vi.fn() }))
vi.mock('@/lib/learner/article-practice-actions', () => ({ submitArticlePractice: vi.fn() }))

import { articlePlayerKey, nextItemsGeneration, sameItemList } from '../ArticlePracticeBridge'

const mk = (id: string): DcpItem => ({ id, type: 'title', paragraphIdx: 0, payload: { passage: 'One. Two.', choices: ['a', 'b', 'c', 'd', 'e'], stemKo: '제목은?', underline: null, summarySentence: null } })
const A = mk('a'), B = mk('b')

describe('sameItemList — 순서 · 문항 객체 그대로일 때만 같다', () => {
  it('배열 포장만 바뀌면 같다', () => expect(sameItemList([A, B], [A, B])).toBe(true))
  it('같은 id 의 새 payload 객체는 다르다', () => expect(sameItemList([A, B], [{ ...A, payload: { ...(A.payload as object) } } as DcpItem, B])).toBe(false))
  it('순서 변경 · 추가 · 삭제 · 빈 목록은 다르다', () => {
    expect(sameItemList([A, B], [B, A])).toBe(false)
    expect(sameItemList([A], [A, B])).toBe(false)
    expect(sameItemList([A, B], [A])).toBe(false)
    expect(sameItemList([A, B], [])).toBe(false)
    expect(sameItemList([], [])).toBe(true)
  })
})

describe('nextItemsGeneration — 다르면 세대 +1, 같으면 그대로(같은 객체)', () => {
  const g0 = { items: [A, B], gen: 0 }
  it('포장만 바뀌면 재시작 없음', () => expect(nextItemsGeneration(g0, [A, B])).toBe(g0))
  it('교체 · 새 payload · 순서 · 빈 목록은 다음 세대', () => {
    expect(nextItemsGeneration(g0, [B, A]).gen).toBe(1)
    expect(nextItemsGeneration(g0, [{ ...A }, B]).gen).toBe(1)
    expect(nextItemsGeneration(g0, []).gen).toBe(1)
    const g1 = nextItemsGeneration(g0, [B])
    expect(nextItemsGeneration(g1, [B]).gen).toBe(1)
    expect(nextItemsGeneration(g1, [A, B]).gen).toBe(2) // 원래 목록으로 돌아와도 새로 시작(이전 인스턴스와 다른 세대)
  })
})

describe('articlePlayerKey — 문항 세대가 키에 들어간다', () => {
  it('문항 세대만 달라도 다른 키 · 기본 0', () => {
    expect(articlePlayerKey('art', 'txt', 'own', 0, 1)).not.toBe(articlePlayerKey('art', 'txt', 'own', 0, 0))
    expect(articlePlayerKey('art', 'txt', 'own', 0)).toBe(articlePlayerKey('art', 'txt', 'own', 0, 0))
  })
})

describe('Bridge 배선 — 렌더 중 세대 반영 · 키에 넣기', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../ArticlePracticeBridge.tsx'), 'utf8')
  it('nextItemsGeneration 으로 세대를 올리고 DcpPlayer key 에 넣는다', () => {
    expect(src).toMatch(/const nextItems = nextItemsGeneration\(itemGen, items\)/)
    expect(src).toMatch(/if \(nextItems !== itemGen\) setItemGen\(nextItems\)/)
    expect(src).toMatch(/key=\{articlePlayerKey\(articleId, textId, ownerId, nextReading\.gen, nextItems\.gen\)\}/)
  })
})
