// apps/web/src/components/csat/home/__tests__/HomeLanding.render.test.tsx
//
// 지도 홈 첫 제안 — 정상 복귀와 지도 오류를 **따로** 그려 본다(서버 첫 그림 · 기기 기록을 읽기 전).
//   오류: role=alert · 「기록이 없다는 뜻이 아니에요」 · 기출 탐구 링크 · 복귀 카드 없음(복귀 문맥이 있어도 오류가 먼저)
//   정상 복귀: 「탐구에서 돌아왔어요」 · 그 문항으로 다시 가기 링크 · 오류 문구 없음
//   e2e(csat-v3-m1)는 실제 지도 loader 로 정상 복귀만 단언한다 — loader 오류는 앱 플래그 없이 실화면에서 만들 수 없다.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// 오류 안내의 「다시 열기」 가 router.refresh 를 쓴다 — 정적 렌더에는 앱 라우터가 없으니 대역
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }))

import { parseMapReturn } from '@/lib/csat/map-return'

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
    // 같은 주소 Link 가 아니라 다시 조회하는 버튼(라우터 캐시의 오류 화면을 다시 쓰지 않게)
    expect(html).toMatch(/<button type="button"[^>]*data-testid="home-map-retry"/)
  })
  it('지도에서 하던 일 — 확인 중 과제 카드는 그 과제 · 묶음으로 지도를 다시 여는 링크', () => {
    // T-0080 — progress.check.task 는 지도 TASK id(home-progress) → map_task 로 보낸다(task = 과거 활동 키 칸 아님)
    const progress = { check: { task: 'e.evidence_location', name: '근거 찾기', ws: 'ws.evidence-locate' }, plan: { ws: 'ws.cohesion', name: '연결', planned: 6, done: 2 } }
    const html = renderToStaticMarkup(<HomeLanding exams={exams} map="ok" mapData={null} focusKind="step" returned={null} progress={progress} />)
    expect(html).toContain('data-kind="continue_check"')
    const tag = html.match(/<a[^>]*data-testid="home-continue-check-go"[^>]*>/)![0]
    const href = tag.match(/href="([^"]+)"/)![1].replace(/&amp;/g, '&')
    const ctx = parseMapReturn(Object.fromEntries(new URL(href as string, 'http://x').searchParams))
    expect(ctx.mapTask).toBe(progress.check.task)
    expect(ctx.ws).toBe(progress.check.ws)
    expect(ctx.task ?? null).toBeNull()
    for (const k of ['map_item', 'map_attempt', 'map_plan', 'map_goal']) expect(href).not.toContain(k)
    expect(html).not.toContain('data-testid="home-continue-plan"')
  })
  it('지도에서 하던 일 — 확인 중 과제가 없으면 저장 계획 카드(진행 수 · 그 묶음으로)', () => {
    const progress = { check: null, plan: { ws: 'ws.cohesion', name: '연결', planned: 6, done: 2 } }
    const html = renderToStaticMarkup(<HomeLanding exams={exams} map="ok" mapData={null} focusKind="step" returned={null} progress={progress} />)
    expect(html).toContain('data-kind="continue_plan"')
    expect(html).toContain('6개 중 2개')
    expect(html).toContain('href="/csat?ws=ws.cohesion"')
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
  it('T-0079 — 기록 0(no_records) = 미측정 · 시작 전(시험 기록이 필수라 하지 않음) · 대기(records_only) = 기록 없음이라 하지 않음', () => {
    const none = renderToStaticMarkup(<HomeLanding exams={exams} map="ok" mapData={null} focusKind="record" returned={null} />)
    expect(none).toContain('data-kind="no_records"')
    expect(none).toContain('약점을 정한 것은 아니에요')
    expect(none).toContain('계획을 정하고 받은 자료로 바로 확인을 시작할 수 있어요')
    expect(none).not.toContain('기록을 넣으면 그려져요')
    const waiting = renderToStaticMarkup(<HomeLanding exams={exams} map="ok" mapData={null} focusKind="pending" returned={null} />)
    expect(waiting).toContain('data-kind="records_only"')
    expect(waiting).toContain('다음 단계(자료 · 대기 이유 포함)')
    expect(waiting).not.toMatch(/기록이 없어요|처음 시작/)
  })
})
