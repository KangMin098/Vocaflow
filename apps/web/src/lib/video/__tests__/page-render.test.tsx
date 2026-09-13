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
import { KIND_LABEL, KIND_ORDER, VIDEO_PUBLISHED, videosByKind } from '../catalog'

const html = renderToString(<VideoIndexPage />)
const byKind = videosByKind()

describe('/video 가 실제로 그려진다', () => {
  it('발행 상태다', () => {
    expect(VIDEO_PUBLISHED).toBe(true)
  })

  it('manifest 의 모든 편이 카드로 나온다', () => {
    // 포스터 URL 의 중복 없는 개수 = 카드 수. 카드가 하나라도 빠지면 여기서 걸린다.
    const posters = html.match(/storage\/v1\/object\/public\/video\/wide\/[^"]+\.jpg/g) ?? []
    expect(new Set(posters).size).toBe(manifest.videos.length)
  })

  it('**모든** 종류가 절로 나온다 — 목록 순서에서 빠지면 그 종류는 영영 안 보인다', () => {
    // ⚠️ 여기에 이름을 **손으로 적지 않는다.** 예전에는 여섯 개를 적어 뒀는데, 종류를 둘
    //   더한 날 이 검사는 초록인 채로 `/video` 에서 **11편이 조용히 사라졌다**
    //   (화면은 멀쩡히 떴다 — 카드 수를 세는 위 검사만 잡았다).
    //   `KIND_LABEL` 에서 돌면 새 종류가 자동으로 이 검사의 대상이 된다.
    for (const kind of KIND_ORDER) {
      const videos = byKind[kind]
      // 그 종류의 영상이 아직 없으면 절도 없는 것이 맞다 — 빈 절을 그리면 약속만 남는다.
      if (videos.length === 0) continue
      expect(html, `${kind} (${KIND_LABEL[kind]}) 절이 안 그려졌다`).toContain(KIND_LABEL[kind])
    }
  })

  it('절의 순서가 `KIND_LABEL` 의 키 순서와 같다 — 순서도 한 곳에서만 정한다', () => {
    const shown = KIND_ORDER.filter((k) => byKind[k].length > 0).map((k) => KIND_LABEL[k])
    const positions = shown.map((label) => html.indexOf(label))
    expect(positions.every((p) => p >= 0)).toBe(true)
    // 나온 자리가 오름차순이어야 정본 순서대로 그려진 것이다.
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('빈 상태 문구가 남아 있지 않다', () => {
    expect(html).not.toContain('영상은 아직 올라가지 않았습니다')
  })

  it('누르기 전에는 `<video>` 가 하나도 없다 — 서가 전체가 포스터만 받는다', () => {
    expect(html).not.toContain('<video')
  })
})
