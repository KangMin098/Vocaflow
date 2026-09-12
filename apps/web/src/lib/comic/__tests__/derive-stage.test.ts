// apps/web/src/lib/comic/__tests__/derive-stage.test.ts
//
// `deriveStage` 회귀 — **failed 를 queued 로 접지 않는다.**
//
// 접었을 때 실제로 벌어진 일:
//   · 검수 화면(ComicReviewClient)의 stepper 가 "큐 대기" 로 활성화되어 스피너가 영원히 돈다.
//   · 그 화면의 폴링(useEffect)이 queued·generating 에서만 도는데 failed 가 queued 로
//     보였으므로 **5초마다 router.refresh() 를 무한히** 걸었다(서버 부하).
//   · 재생성 버튼은 review/published 에만 있어서 실패한 도서에는 재시도 수단이 없었다.
// 셋 다 "failed 가 자기 이름을 못 가진 것" 하나에서 나왔다.

import { describe, expect, it } from 'vitest'
import { deriveStage, summarize, type ComicCatalogRow } from '../admin-queries'

describe('deriveStage', () => {
  it('실패 잡을 큐 대기로 접지 않는다 (스피너·무한 폴링의 원인)', () => {
    expect(deriveStage(null, 'failed', 0)).toBe('failed')
    expect(deriveStage('draft', 'failed', 0)).toBe('failed')
    // 회귀의 핵심: 어떤 조합에서도 실패가 queued 로 보이면 안 된다.
    expect(deriveStage(null, 'failed', 0)).not.toBe('queued')
    expect(deriveStage('draft', 'failed', 0)).not.toBe('queued')
  })

  it('컷이 이미 있으면 잡이 실패했어도 검수할 것이 남아 있다', () => {
    // failed 는 "보여 줄 컷이 하나도 없는 실패" 에만 붙는다.
    expect(deriveStage('draft', 'failed', 12)).toBe('review')
  })

  it('진행 중인 잡이 실패보다 앞선다', () => {
    expect(deriveStage('draft', 'running', 3)).toBe('generating')
    expect(deriveStage('draft', 'pending', 0)).toBe('queued')
  })

  it('보관은 잡 상태보다 우선한다 (관리자 종결 결정)', () => {
    expect(deriveStage('archived', 'failed', 0)).toBe('archived')
    expect(deriveStage('archived', 'running', 5)).toBe('archived')
  })

  it('발행됨은 컷 존재보다 앞서고, 잡이 없으면 컷 유무로 갈린다', () => {
    expect(deriveStage('published', null, 40)).toBe('published')
    expect(deriveStage('draft', null, 40)).toBe('review')
    expect(deriveStage(null, null, 0)).toBe('none')
  })

  it('완료된 잡은 단계를 만들지 않는다 — 컷이 판정한다', () => {
    expect(deriveStage('draft', 'done', 0)).toBe('none')
    expect(deriveStage('draft', 'done', 7)).toBe('review')
  })
})

function row(over: Partial<ComicCatalogRow>): ComicCatalogRow {
  return {
    bookId: over.bookId ?? 'b',
    title: 'T',
    author: null,
    bookStatus: 'published',
    vLevel: null,
    comicStatus: 'none',
    panelsTotal: 0,
    panelsPass: false,
    jobStatus: null,
    panelsDone: null,
    jobError: null,
    ...over,
  }
}

describe('summarize', () => {
  it('실패를 큐 대기와 섞지 않고 따로 센다', () => {
    const s = summarize([
      row({ bookId: '1', jobStatus: 'pending' }),
      row({ bookId: '2', jobStatus: 'running' }),
      row({ bookId: '3', jobStatus: 'failed' }),
      row({ bookId: '4', jobStatus: 'failed' }),
      row({ bookId: '5', jobStatus: 'done', comicStatus: 'published' }),
      row({ bookId: '6', comicStatus: 'draft' }),
    ])
    expect(s.queued).toBe(2)
    expect(s.failed).toBe(2)
    expect(s.published).toBe(1)
    expect(s.drafts).toBe(1)
    expect(s.eligible).toBe(6)
  })
})
