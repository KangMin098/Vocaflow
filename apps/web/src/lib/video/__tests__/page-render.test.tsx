// apps/web/src/lib/video/__tests__/page-render.test.tsx
//
// **카탈로그가 풀리는 것과 화면이 뜨는 것은 다르다.**
//
// 옆 파일(`catalog.test.ts`)은 "id 로 찾으면 나오는가" 를 본다. 그런데 그게 전부 통과해도
// 화면이 빈 채로 뜰 수 있다 — 목록 순서(`ORDER`)에서 한 종류를 빠뜨리거나, 발행 판정이
// 뒤집혀 빈 상태 분기로 가면 **오류 없이** 아무것도 안 나온다.
// 그래서 여기서는 **실제로 그려서** HTML 을 센다.
//
// ⚠️ 발행 전(`baseUrl` null)에는 이 파일의 기대값이 0 이 되는 게 맞다 —
//   그 상태는 `VIDEO_PUBLISHED` 검사가 먼저 걸러 주므로, 여기 실패는 "발행했는데 안 뜬다" 를 뜻한다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import VideoIndexPage from '@/app/(marketing)/video/page'
import manifest from '../manifest.json'
import { VIDEO_PUBLISHED } from '../catalog'

const html = renderToString(<VideoIndexPage />)

describe('/video 가 실제로 그려진다', () => {
  it('발행 상태다', () => {
    expect(VIDEO_PUBLISHED).toBe(true)
  })

  it('manifest 의 모든 편이 카드로 나온다', () => {
    // 포스터 URL 의 중복 없는 개수 = 카드 수. 카드가 하나라도 빠지면 여기서 걸린다.
    const posters = html.match(/storage\/v1\/object\/public\/video\/wide\/[^"]+\.jpg/g) ?? []
    expect(new Set(posters).size).toBe(manifest.videos.length)
  })

  it('종류 여섯이 전부 절로 나온다 — 목록 순서에서 빠지면 그 종류는 영영 안 보인다', () => {
    for (const label of [
      '플랫폼 소개',
      '이 제품이 다른 점',
      '커리큘럼',
      '브랜드 시리즈',
      '문항 유형',
      '학습 활동',
    ]) {
      expect(html, label).toContain(label)
    }
  })

  it('빈 상태 문구가 남아 있지 않다', () => {
    expect(html).not.toContain('영상은 아직 올라가지 않았습니다')
  })

  it('누르기 전에는 `<video>` 가 하나도 없다 — 서가 전체가 포스터만 받는다', () => {
    expect(html).not.toContain('<video')
  })
})
