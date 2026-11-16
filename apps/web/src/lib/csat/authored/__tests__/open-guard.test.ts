// apps/web/src/lib/csat/authored/__tests__/open-guard.test.ts
// FI-010(#302) — 미완료 창작 자료는 열기(노출) 기록이 확보된 뒤에만 본문(AuthoredRunner)을 준다.
//   기록 실패 시 본문을 주면 뒤의 정상 열기 · 제출이 첫 노출 · 독립 근거로 승격된다. 페이지(서버 컴포넌트) 분기 순서를 지킨다.
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const PAGE = fs.readFileSync(path.resolve(__dirname, '../../../../app/(app)/csat/learn/[id]/page.tsx'), 'utf8')

describe('창작 자료 열기 가드', () => {
  it('기록 실패(미완료 · opened 거짓) 분기가 본문 렌더보다 먼저 반환한다', () => {
    const guard = PAGE.indexOf('if (!v.done && !opened2)')
    const unavailable = PAGE.indexOf('data-testid="authored-open-unavailable"')
    const runner = PAGE.indexOf('<AuthoredRunner')
    expect(guard).toBeGreaterThan(-1)
    expect(unavailable).toBeGreaterThan(guard)
    expect(runner).toBeGreaterThan(unavailable)
  })
  it('기록 실패 화면에는 본문 · 문항이 없다(지도 링크만)', () => {
    const block = PAGE.slice(PAGE.indexOf('if (!v.done && !opened2)'), PAGE.indexOf('<AuthoredRunner'))
    expect(block).not.toMatch(/body|sentences|v\.extra|v\.teach/)
    expect(block).toContain('href={returnHref}')
  })
  it('본문으로 넘기는 세션은 기록에 성공한 세션뿐', () => {
    expect(PAGE).toMatch(/sessionId=\{opened2 \? sessionId : undefined\}/)
  })
})

describe('창작 자료 출구의 지도 복귀(FI-011 C) — 열 수 없음 · 기록 실패 · 로그인 · 묶음 선택', () => {
  it('페이지의 안내 링크 · 로그인 · 선택 링크가 같은 복귀 도우미를 쓴다(고정 지도 주소 없음)', () => {
    expect(PAGE).not.toContain('MAP_HREF')
    expect(PAGE.match(/href=\{returnHref\}>학습 지도로 가기/g)?.length).toBe(2)
    expect(PAGE).toContain('loginUrlWithReturn(learnSelfHref(params.id, searchParams, searchParams.d))')
    expect(PAGE).toContain('href={learnSelfHref(params.id, searchParams, c.deliveryId)}')
  })
})
