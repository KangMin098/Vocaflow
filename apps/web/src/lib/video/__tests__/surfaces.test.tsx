// apps/web/src/lib/video/__tests__/surfaces.test.tsx
//
// **영상이 공개 화면에 실제로 그려지는가.**
//
// 컴포넌트를 import 했다고 화면에 뜨는 게 아니다 — 조건 분기 하나가 꺼져 있으면
// **오류 없이** 사라진다(그게 이 저장소가 영상에서 반복해 겪은 실패 모양이다).
// 그래서 renderToString 해서 **발행된 URL 이 HTML 에 있는지**로 판정한다.

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

describe('랜딩은 영상으로 링크를 잇는다', () => {
  const landing = fs.readFileSync(
    path.join(process.cwd(), 'src', 'app', 'page.tsx'),
    'utf8',
  )

  // 디자인·UX 금지 검사 1건(랜딩 히어로 플레이어 금지)은 DD-66(사용자 결정 2026-09-21)으로 삭제했다.

  it('대신 링크로 잇는다 — 영상이 아예 안 닿으면 그것도 문제다', () => {
    // 랜딩의 링크는 공통 헤더·푸터(nav-data 한 곳)가 그린다(DD-68). 랜딩이 그 부품을 쓰고,
    // 그 데이터에 영상 경로가 있어야 한다.
    const navData = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'marketing', 'site', 'nav-data.ts'),
      'utf8',
    )
    expect(landing).toMatch(/<SiteHeader\s*\/>/)
    expect(landing).toMatch(/<SiteFooter\s*\/>/)
    expect(navData).toContain("'/video'")
  })
})
