// apps/web/src/components/library/story/__tests__/story-revisit-return.test.tsx
// T-0246 — 근거 활동의 「본문에서 다시 확인」으로 온 경우에만 강조 문장 곁 「근거 비교로 돌아가기」.
// 렌더 경계만 잠근다(node 환경 — effect · 클릭은 돌지 않는다). 실제 왕복 · 초점 · 결속 폐기 · 호출 0 은 실제 StoryReader PC 하네스(pe-t246)가 덮는다.
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/lib/analytics/client', () => ({ track: vi.fn() }))

import { ACTIVITY_LABELS } from '../story-activity-view'
import { StoryUnitText } from '../StoryUnitText'

const TEXT = 'Horner was taken to the station.\n\nIf Ryder does not testify, the case collapses. The stone is back.'
const RETURN = 'data-story-revisit-return'

describe('근거 비교로 돌아가기 — 렌더 경계', () => {
  it('다시 확인(revisit) + 복귀 함수가 있을 때만 강조 문장 바로 곁에 돌아가기 단추', () => {
    const html = renderToString(<StoryUnitText text={TEXT} tracing={false} lookup={() => null} revisit={{ wordIndex: 8, nonce: 1 }} onRevisitReturn={() => {}} />)
    expect(html.split(RETURN).length - 1).toBe(1)
    expect(html).toContain(ACTIVITY_LABELS.returnToCompare)
    // 강조 span 이 닫힌 바로 뒤(같은 문단)에 온다
    expect(html).toMatch(/data-story-return-sentence[^>]*>[\s\S]*?<\/span>(?:<!-- -->)?\s?(?:<!-- -->)?<button[^>]*data-story-revisit-return/)
  })

  it('복귀 함수가 없거나(활동 밖) · 다시 확인이 아니면(단어장 복귀 강조) 단추 0', () => {
    expect(renderToString(<StoryUnitText text={TEXT} tracing={false} lookup={() => null} revisit={{ wordIndex: 8, nonce: 1 }} />)).not.toContain(RETURN)
    expect(renderToString(<StoryUnitText text={TEXT} tracing={false} lookup={() => null} returnWordIndex={8} onRevisitReturn={() => {}} />)).not.toContain(RETURN)
    expect(renderToString(<StoryUnitText text={TEXT} tracing={false} lookup={() => null} />)).not.toContain(RETURN)
  })

  it('StoryReader 결선: 활동 결속(revisitContext)과 같은 다시 확인일 때만 넘기고, 돌아가기는 같은 kind 의 다시 확인 단추로 초점 · 활동 호출 없음', () => {
    const src = readFileSync(path.resolve(__dirname, '../StoryReader.tsx'), 'utf8')
    expect(src).toContain('onRevisitReturn={unitRevisit ? returnToCompare : undefined}')
    const block = src.slice(src.indexOf('const returnToCompare = () => {'), src.indexOf('const returnToNotesEntry = () => {'))
    expect(block).toContain('[data-story-activity-revisit="${kind}"]')
    expect(block).toContain('setRevisit(null)')
    expect(block).not.toMatch(/load|submit|complete|record|track/i)
  })
})
