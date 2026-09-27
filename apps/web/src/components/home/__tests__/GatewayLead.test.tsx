// apps/web/src/components/home/__tests__/GatewayLead.test.tsx
//
// 관문 첫 줄이 **네 상태에서 각각 무엇을 그리는가**.
//
// 왜 렌더 테스트가 꼭 필요한가:
//   이 줄은 검증 계정에서 거의 항상 **안 보인다.** 그 계정은 e2e 가 매일 돌아서 늘
//   `today` 상태이고, `today` 는 설계상 아무것도 그리지 않기 때문이다. 즉 화면을 띄워
//   눈으로 보는 방식으로는 **정작 이 기능이 존재하는 이유인 복귀 상태를 영원히 못 본다.**
//   실제로 라이브 캡처에서 이 줄은 한 번도 나타나지 않았다(정상 동작이다).
//   그래서 상태별 렌더를 여기서 잠근다 — dev 서버 없이 돈다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { classifyGateway, type LastTouch } from '@/lib/learner/gateway-state'

import { GatewayLead } from '../GatewayLead'

const NOW = Date.parse('2026-08-16T03:00:00Z') // 12:00 KST

function touch(iso: string, over: Partial<LastTouch> = {}): LastTouch {
  return { module: 'dictation', title: null, href: null, at: iso, ...over }
}

describe('GatewayLead — 그리지 않아야 할 때', () => {
  it('처음 온 사람에게는 아무것도 그리지 않는다', () => {
    expect(renderToString(<GatewayLead state={classifyGateway(null, NOW)} />)).toBe('')
  })

  it('오늘 이미 온 사람에게도 그리지 않는다 (자리를 채우려고 인사말을 만들지 않는다)', () => {
    const state = classifyGateway(touch('2026-08-16T01:00:00Z'), NOW)
    expect(renderToString(<GatewayLead state={state} />)).toBe('')
  })
})

describe('GatewayLead — 복귀', () => {
  it('사흘 만에 온 사람에게 마지막에 한 것을 되짚고 그 자리로 보낸다', () => {
    const state = classifyGateway(
      touch('2026-08-13T14:00:00Z', {
        title: 'A Christmas Carol',
        href: '/dictate/setup?textId=abc',
      }),
      NOW,
    )
    const html = renderToString(<GatewayLead state={state} />)
    expect(html).toContain('3일 만이에요')
    expect(html).toContain('A Christmas Carol')
    expect(html).toContain('거기서 이어하기')
    expect(html).toContain('/dictate/setup?textId=abc')
  })

  it('돌아갈 자리를 모르면 링크를 만들지 않는다 (빈 링크를 팔지 않는다)', () => {
    const state = classifyGateway(touch('2026-08-13T14:00:00Z', { href: null }), NOW)
    const html = renderToString(<GatewayLead state={state} />)
    expect(html).toContain('3일 만이에요')
    expect(html).not.toContain('거기서 이어하기')
  })
})

describe('GatewayLead — 오래 비었을 때 (가장 위험한 자리)', () => {
  it('오래 비었던 사람에게 복귀 인사를 그린다', () => {
    const state = classifyGateway(touch('2026-05-01T14:00:00Z'), NOW)
    const html = renderToString(<GatewayLead state={state} />)
    expect(html).toContain('다시 오셨어요')
  })

  // 디자인·UX 금지 검사 2건(일수 표기 금지 · 비난·손실 어휘 금지)은 DD-66(사용자 결정 2026-09-21)으로 삭제했다.
})

describe('GatewayLead — 접근성·이름 규칙', () => {
  it('이어하기 링크는 44px 이상 터치 타겟이다', () => {
    const state = classifyGateway(
      touch('2026-08-13T14:00:00Z', { href: '/text/abc' }),
      NOW,
    )
    expect(renderToString(<GatewayLead state={state} />)).toContain('min-h-[44px]')
  })

  it('활동 이름은 레지스트리에서 온다 — raw 슬러그를 노출하지 않는다', () => {
    const state = classifyGateway(
      touch('2026-08-13T14:00:00Z', { module: 'ghost-race', href: null }),
      NOW,
    )
    const html = renderToString(<GatewayLead state={state} />)
    expect(html).not.toContain('ghost-race')
  })
})
