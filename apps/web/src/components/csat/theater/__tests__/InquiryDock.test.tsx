// apps/web/src/components/csat/theater/__tests__/InquiryDock.test.tsx
//
// 하단 탐구 도크 — 네 요소 · 일곱 아이콘 · 버튼 중첩 금지 · 접근 이름 · 선택 상태(색 외 aria).
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { InquiryDock } from '../InquiryDock'

const html = (scene: Parameters<typeof InquiryDock>[0]['current']) => renderToStaticMarkup(<InquiryDock current={scene} last={{}} onSelect={() => {}} />)

describe('InquiryDock', () => {
  it('네 요소 제목 · 일곱 장면 아이콘', () => {
    const h = html('task')
    expect(h.match(/data-testid="dock-group"/g)).toHaveLength(4)
    expect(h.match(/data-testid="dock-scene"/g)).toHaveLength(7)
    for (const name of ['원문 이해', '문항 설계', '비교와 원리', '내 설명']) expect(h).toContain(name)
  })
  it('아이콘마다 접근 이름(aria-label)과 보이는 이름 툴팁이 있다', () => {
    const h = html('task')
    for (const name of ['평가 과제', '원문 이해', '문항 성립', '설계 재구성', '기출 비교', '조건부 원리', '내 설명']) expect(h).toContain(`aria-label="${name}"`)
    expect(h.match(/class="[^"]*dockTip/g)).toHaveLength(7)
  })
  it('버튼 안에 버튼이 없다(제목과 아이콘은 형제)', () => {
    expect(html('judgment')).not.toMatch(/<button[^>]*>(?:(?!<\/button>).)*<button/s)
  })
  it('선택은 aria 로도 — 현재 요소 제목 aria-pressed · 현재 장면 아이콘 aria-current', () => {
    const h = html('design')
    expect(h).toMatch(/aria-pressed="true"[^>]*>문항 설계/)
    expect(h).toMatch(/aria-label="설계 재구성" aria-current="page"/)
    expect(h.match(/aria-current="page"/g)).toHaveLength(1)
    expect(h.match(/aria-pressed="true"/g)).toHaveLength(1)
  })
})
