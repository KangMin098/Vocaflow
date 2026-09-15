// apps/web/src/lib/video/__tests__/surfaces.test.tsx
//
// **영상이 공개 화면에 실제로 그려지는가.**
//
// 컴포넌트를 import 했다고 화면에 뜨는 게 아니다 — 조건 분기 하나가 꺼져 있으면
// **오류 없이** 사라진다(그게 이 저장소가 영상에서 반복해 겪은 실패 모양이다).
// 그래서 renderToString 해서 **발행된 URL 이 HTML 에 있는지**로 판정한다.
//
// 랜딩은 여기 없다 — 그 첫 화면의 자리는 **작동하는 증명**(CoverageHero)이고 영상은
// 말하기다(CLAUDE.md I1). 그 규칙도 아래에서 소스로 확인한다.

import fs from 'node:fs'
import path from 'node:path'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import AboutPage from '@/app/(marketing)/about/page'
import { PricingClient } from '@/components/marketing/PricingClient'
import { VIDEO_PUBLISHED, videosByKind } from '../catalog'

/** 발행 URL 조각 — 이게 HTML 에 있으면 플레이어가 실제로 그려진 것이다. */
const MARK = 'storage/v1/object/public/video/'

function posterCount(html: string): number {
  const m = html.match(new RegExp(`${MARK}wide/[^"]+\\.jpg`, 'g')) ?? []
  return new Set(m).size
}

describe('공개 화면에 영상이 실제로 그려진다', () => {
  it('발행 상태여야 이 검사가 의미를 갖는다', () => {
    expect(VIDEO_PUBLISHED).toBe(true)
  })

  it('/about — 소개 1편 + 장점 N편', () => {
    const html = renderToString(<AboutPage />)
    expect(posterCount(html)).toBe(1 + videosByKind().benefit.length)
  })

  it('/pricing — 커리큘럼 1편 + 시리즈 N편', () => {
    // 신뢰 지표는 DB 에서 오는데 이 검사와 무관하다 — null 로 넘겨도 화면은 그려진다.
    const html = renderToString(<PricingClient signals={null} />)
    expect(posterCount(html)).toBe(1 + videosByKind().series.length)
  })
})

describe('랜딩 히어로에는 영상을 넣지 않는다', () => {
  // 규칙을 주석에만 적으면 다음 사람이 "여기에도 넣자" 고 한다. 소스로 확인한다.
  const landing = fs.readFileSync(
    path.join(process.cwd(), 'src', 'app', 'page.tsx'),
    'utf8',
  )

  it('랜딩이 플레이어를 직접 그리지 않는다 — 그 자리는 작동하는 증명의 것이다', () => {
    expect(landing).not.toContain('ComponentVideo')
  })

  it('대신 링크로 잇는다 — 영상이 아예 안 닿으면 그것도 문제다', () => {
    expect(landing).toContain('/video')
  })
})
