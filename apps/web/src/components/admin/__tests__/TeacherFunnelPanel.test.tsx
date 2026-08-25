// apps/web/src/components/admin/__tests__/TeacherFunnelPanel.test.tsx
//
// 이 패널의 계약 셋을 못 박는다:
//   ① 조회 실패(null)와 "아직 0" 을 **화면에서 구별**한다 — 0 을 "교사가 안 온다" 로 읽으면
//      배포 직후에 잘못된 결론을 내린다.
//   ② 표본이 작으면 **비율을 그리지 않는다** — RetentionPanel 과 같은 규칙.
//      3명 중 1명을 33% 로 인쇄하는 순간 그 숫자가 근거처럼 읽힌다.
//   ③ 분모가 0 이면 빈 힌트를 낸다(0/0 을 인쇄하지 않는다).
//
// `renderToString` 을 쓰는 이유는 RetentionPanel.test 와 같다 — 이 저장소에 DOM 테스트
// 라이브러리가 없고, 서버 컴포넌트의 출력만 확인하면 충분하다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { TeacherFunnelPanel } from '../TeacherFunnelPanel'

/** SSR 은 인접한 텍스트 조각 사이에 `<!-- -->` 를 넣는다 — 비교 전에 걷어낸다. */
const plain = (html: string) => html.replace(/<!-- -->/g, '')

describe('TeacherFunnelPanel', () => {
  it('조회 실패는 "못 쟀음" 으로 — 0 과 구별한다', () => {
    const html = plain(renderToString(<TeacherFunnelPanel gaps={null} />))
    expect(html).toContain('못 쟀음')
  })

  it('분모 0 이면 0/0 대신 빈 힌트를 내고, 관측 시작 안내를 함께 낸다', () => {
    const html = plain(renderToString(
      <TeacherFunnelPanel
        gaps={{ hubVisitors: 0, createdClass: 0, sharedInvite: 0, gotStudent: 0 }}
      />,
    ))
    expect(html).toContain('아직 /teacher 에 도달한 기록이 없어요')
    // "교사가 안 온다" 로 오독하지 않도록 관측 시작 안내가 함께 떠야 한다.
    expect(html).toContain('관측 구간이 시작되지 않았다')
    expect(html).not.toContain('0 / 0')
  })

  it('표본이 작으면 비율을 그리지 않고 원수만 낸다', () => {
    const html = plain(renderToString(
      <TeacherFunnelPanel
        gaps={{ hubVisitors: 3, createdClass: 1, sharedInvite: 0, gotStudent: 0 }}
      />,
    ))
    expect(html).toContain('1 / 3')
    expect(html).not.toContain('33%')
    expect(html).toContain('비율을 내기엔 적어')
  })
})
