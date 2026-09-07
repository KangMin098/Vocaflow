// apps/web/src/components/admin/textbook/__tests__/production-panel.test.tsx
//
// 제작 단계 콘솔이 **실제로 그 사실을 화면에 적는가.**
//
// 모델 계약은 `lib/textbook/__tests__/production-stages.test.ts` 가 잠근다. 여기서는
// 그 값이 **화면까지 오는지**를 본다 — 모델을 고쳐도 화면이 옛 필드를 읽으면 관리자가
// 보는 것은 그대로다(표지에서 똑같은 일을 겪었다: 파이프라인은 고쳤는데 매대가 옛 인자를
// 넘기고 있었다).

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { ShelfVolume } from '@/lib/textbook/shelf'
import { measureProduction } from '@/lib/textbook/production-stages'

import { TextbookProductionPanel } from '../TextbookProductionPanel'

function volume(over: Partial<ShelfVolume> = {}): ShelfVolume {
  return {
    step: 5,
    title: 'Vocaflow Reading 4',
    schoolBand: '고1',
    vLevels: [5],
    types: ['order', 'insert'],
    rationale: '학평 대응.',
    itemCount: 1200,
    byType: { order: 600, insert: 600 },
    emptyTypes: [],
    status: 'ready',
    maxUnits: 10,
    bySource: { original: 1200 },
    explainedCount: 1200,
    ...over,
  } as ShelfVolume
}

/**
 * ⚠️ React SSR 은 이웃한 텍스트 노드 사이에 `<!-- -->` 를 넣는다 — `{ACTOR_LABEL[…]} 차례` 는
 *    HTML 에서 `Claude Code<!-- --> 차례` 가 된다. 그걸 모르고 문장으로 찾으면 **화면은
 *    멀쩡한데 테스트만 빨간불**이 된다(실측 2026-09-07에 그렇게 두 건이 걸렸다).
 *    사람이 읽는 것을 재려는 것이므로 그 구분자를 지우고 본다.
 */
const render = (volumes: ShelfVolume[]): string =>
  renderToString(<TextbookProductionPanel report={measureProduction(volumes)} />).replaceAll(
    '<!-- -->',
    '',
  )

describe('제작 단계 콘솔', () => {
  it('**지금 누구 차례인가**를 먼저 적는다 — 콘솔이 첫째로 답해야 하는 질문이다', () => {
    // 해설이 비면 Claude Code 차례여야 한다.
    const html = render([volume({ explainedCount: 0 })])
    expect(html).toContain('Claude Code 차례')
    expect(html).toContain('해설')
  })

  it('사람 차례도 그렇게 적는다 — 기계 차례만 있으면 교대가 아니다', () => {
    const html = render([volume({ status: 'building' })])
    expect(html).toContain('사람 차례')
  })

  it('막힌 칸의 **다음 한 걸음**을 그대로 적는다 — 막다른 화면을 두지 않는다', () => {
    const html = render([volume({ explainedCount: 0 })])
    expect(html).toContain('explain-drain-export')
  })

  it('다 됐으면 누구 차례라고 적지 않는다 — 할 일이 없는데 부르지 않는다', () => {
    const html = render([volume()])
    expect(html).toContain('전 권이 모든 단계를 넘었다')
    expect(html).not.toContain('차례')
  })

  it('권 이름과 막힌 칸을 권마다 적는다 — 개수만 세면 무엇을 고칠지 모른다', () => {
    const html = render([volume(), volume({ step: 6, title: 'Vocaflow Reading 5', maxUnits: 0 })])
    expect(html).toContain('Vocaflow Reading 5')
    expect(html).toContain('단원')
  })

  it('**못 잰 권을 따로 적는다** — 0 으로 그리면 없는 일을 하러 간다', () => {
    const html = render([volume({ explainedCount: null })])
    expect(html).toContain('못 잼')
  })

  it('색 말고 기호와 이름으로도 상태가 읽힌다 — 색맹 대응', () => {
    const html = render([volume({ explainedCount: null })])
    expect(html).toContain('aria-label="해설 못 잼"')
    expect(html).toContain('aria-label="재고 됨"')
  })

  it('권이 없어도 죽지 않는다', () => {
    expect(render([])).toContain('아직 권이 없다')
  })
})
