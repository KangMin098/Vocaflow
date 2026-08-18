// apps/web/src/lib/articles/__tests__/adaptation-visibility.test.ts
//
// ACP §20 레벨 적응 — 학습자 화면에서 원본과 구별되는가.
//
// 적응 글은 출처를 **원본 그대로**(nasa 등) 쓴다. 그래야 카탈로그의 제자리(topic 트랙)에
// 서고 학습자가 "우리가 지어낸 글" 로 오해하지 않는다. 대가로 원본 바로 옆에 서게 되므로,
// 구별 표시가 빠지면 **같은 글이 두 개**로 보인다. 그 표시가 사라지지 않게 못 박는다.

import { describe, expect, it } from 'vitest'

import { SOURCE_TRACKS } from '@/lib/articles/source-map'
import type { PublishedArticle } from '@/lib/articles/types'

const base: PublishedArticle = {
  id: 'a1',
  title: 'Hubble Sees Swarm of Galaxies',
  author: null,
  source: 'nasa',
  source_url: 'https://science.nasa.gov/x',
  cefr_level: 'C1',
  word_count: 393,
  reading_minutes: 2,
  category_tags: null,
  published_at: '2026-06-12T00:00:00Z',
  article_v_level: 5,
  register: 'expository',
  audio_url: null,
}

describe('적응 글의 학습자 노출', () => {
  it('원본과 같은 트랙에 선다 — 출처를 원본 그대로 쓰기 때문이다', () => {
    const trackOf = (src: string) => SOURCE_TRACKS.find((t) => (t.sources as readonly string[]).includes(src))?.key
    // 적응 글의 source 는 원본과 같으므로 같은 트랙이다 — 그래서 구별 표시가 필요하다.
    expect(trackOf(base.source)).toBeDefined()
    expect(trackOf('nasa')).toBe(trackOf(base.source))
  })

  it('카드가 구별할 근거를 갖는다 — adapted_from_id 가 타입에 있어야 한다', () => {
    // 카탈로그 질의에서 이 컬럼이 빠지면 값이 undefined 가 되어 배지가 조용히 사라진다.
    const easier: PublishedArticle = { ...base, id: 'a2', adapted_from_id: 'a1' }
    expect(easier.adapted_from_id).toBe('a1')
    expect(base.adapted_from_id ?? null).toBeNull()
  })

  it('카탈로그 질의가 adapted_from_id 를 실제로 읽는다', async () => {
    // 타입에만 있고 질의에 없으면 화면에서는 영원히 undefined 다 — 실제 파일을 본다.
    const fs = await import('node:fs')
    const src = fs.readFileSync('src/app/(main)/library/scripts/page.tsx', 'utf8')
    expect(src).toContain('adapted_from_id')
  })

  it('카드가 쉬운 판 문구를 렌더한다', async () => {
    const fs = await import('node:fs')
    const card = fs.readFileSync('src/components/library/browse/ArticleCard.tsx', 'utf8')
    expect(card).toContain('adapted_from_id')
    expect(card).toContain('쉬운 판')
  })
})
