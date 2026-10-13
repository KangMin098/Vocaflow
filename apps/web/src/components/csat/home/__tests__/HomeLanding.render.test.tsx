// apps/web/src/components/csat/home/__tests__/HomeLanding.render.test.tsx
//
// 지도 홈 첫 제안 — 정상 복귀와 지도 오류를 **따로** 그려 본다(서버 첫 그림 · 기기 기록을 읽기 전).
//   오류: role=alert · 「기록이 없다는 뜻이 아니에요」 · 기출 탐구 링크 · 복귀 카드 없음(복귀 문맥이 있어도 오류가 먼저)
//   정상 복귀: 「탐구에서 돌아왔어요」 · 그 문항으로 다시 가기 링크 · 오류 문구 없음
//   e2e(csat-v3-m1)는 실제 지도 loader 로 정상 복귀만 단언한다 — loader 오류는 앱 플래그 없이 실화면에서 만들 수 없다.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { HomeLanding } from '../HomeLanding'

const exams = [{ exam_id: '2026', label: '2026학년도 수능', items: 28 }]
const returned = { slug: '2026-34', label: '2026학년도 수능 34번' }

describe('HomeLanding — 첫 제안 분기', () => {
  it('지도 오류는 복귀 문맥이 있어도 오류 안내가 먼저', () => {
    const html = renderToStaticMarkup(<HomeLanding exams={exams} map="error" mapData={null} focusKind={null} returned={returned} />)
    expect(html).toContain('data-kind="error"')
    expect(html).toContain('role="alert"')
    expect(html).toContain('기록이 없다는 뜻이 아니에요')
    expect(html).toContain('href="/csat/browse"')
    expect(html).not.toContain('data-testid="home-return"')
  })
  it('정상 복귀는 탐구 복귀 카드 · 그 문항 링크 · 오류 문구 없음', () => {
    const html = renderToStaticMarkup(<HomeLanding exams={exams} map="preparing" mapData={null} focusKind={null} returned={returned} />)
    expect(html).toContain('data-kind="return"')
    expect(html).toContain('href="/csat/item/2026-34?from=map"')
    expect(html).not.toContain('role="alert"')
  })
  it('보류 시험 기록(권한 · 보류)은 기록 없음이 아니라고 말한다', () => {
    const html = renderToStaticMarkup(<HomeLanding exams={exams} map="withheld" mapData={null} focusKind={null} returned={null} />)
    expect(html).toContain('data-kind="withheld"')
    expect(html).toContain('기록이 없다는 뜻이 아니에요')
    expect(html).not.toContain('role="alert"')
  })
  it('복귀 문맥이 없으면 지도 초점 안내(확인 필요 · 목표 · 기록 없음)', () => {
    expect(renderToStaticMarkup(<HomeLanding exams={exams} map="preparing" mapData={null} focusKind={null} returned={null} />)).toContain('data-kind="preparing"')
  })
})
