// apps/web/src/lib/video/__tests__/detail-page.test.tsx
//
// **편별 페이지의 존재 이유는 자막 전문이다.** 그게 서버 렌더 HTML 에 없으면
// 62개 주소를 만든 값이 없다 — 검색이 읽을 것이 제목뿐이라 `/video` 한 장과 다를 게 없다.
//
// 여기서 보는 것 셋: 전사가 HTML 에 있는가 · 구조화 데이터(VideoObject)가 있는가 ·
// 막다른 화면이 아닌가(다음 걸음).

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import VideoDetailPage from '@/app/(marketing)/video/[id]/page'
import { allVideoIds, videoById } from '../catalog'

const id = allVideoIds()[0]!
const video = videoById(id)!
const html = renderToString(<VideoDetailPage params={{ id }} />)

describe('편별 페이지', () => {
  it('발행본이 있어야 이 검사가 의미를 갖는다', () => {
    expect(allVideoIds().length).toBeGreaterThan(0)
    expect(video.transcript.length).toBeGreaterThan(0)
  })

  it('자막 전문이 서버 렌더 HTML 에 있다 — 이 페이지의 존재 이유', () => {
    for (const line of video.transcript) {
      // HTML 엔티티로 바뀌는 문자가 있으므로 앞 열 글자만 본다.
      expect(html).toContain(line.slice(0, 10))
    }
  })

  it('VideoObject 구조화 데이터가 있다 — 없으면 검색이 영상으로 안 본다', () => {
    expect(html).toContain('application/ld+json')
    expect(html).toContain('VideoObject')
  })

  it('막다른 화면이 아니다 — 다음 걸음이 있다', () => {
    expect(html).toContain('/fit')
  })

  it('근거가 있으면 출처까지 함께 나온다', () => {
    if (video.evidence.length === 0) return
    expect(html).toContain(video.evidence[0]!.source.slice(0, 10))
  })
})
