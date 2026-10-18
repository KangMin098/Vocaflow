// apps/web/src/lib/csat/map/v4/__tests__/workspace-authored.test.ts
// FI-011(#304) — 납품된 창작 확인 · 전이 자료가 Workspace 실행 링크 · 가용량 · 다음 요구 키에 이어진다.
//   정본 템플릿 준비 상태가 content_needed · ready 여도 그 TASK 의 창작 납품이 있으면 그 자료로 단계를 연다. 납품이 없으면 그대로 막는다.
import { describe, expect, it } from 'vitest'

import type { AsIsMap } from '../as-is'
import { evidenceKeysOfTask, templateOf } from '../definition'
import { stagesOf } from '../workspace'

const asIsWith = (task: string, check: Record<string, unknown> | null) => ({ tasks: { [task]: { check } } }) as unknown as AsIsMap

describe('Workspace × 창작 납품', () => {
  it('근거 키 = 정본 확인 키 + 창작 키(To-Be 다음 요구 · 전이 판정이 같은 키를 쓴다)', () => {
    expect(evidenceKeysOfTask('r.central_meaning')).toEqual(expect.arrayContaining(['claim-support', 'authored-central-meaning']))
    expect(evidenceKeysOfTask('v.contextual_sense')).toContain('authored-vocab-context')
  })

  it('content_needed 템플릿(ws.vocab-context): 창작 확인 링크가 있으면 확인 단계가 열리고 · 없으면 그대로 content_needed', () => {
    const t = templateOf('ws.vocab-context')!
    expect(t.readiness).toBe('content_needed')
    const ref = 'authored:vcs-ind-1'
    const asIs = asIsWith('v.contextual_sense', { status: 'checking', unseen: [ref], verifiedItems: [], wrongItems: [] })
    const withLink = stagesOf(t, asIs, { confirmLinks: { 'authored-vocab-context': [{ target: ref, href: `/csat/learn/vcs-ind-1?d=x`, label: '받은 자료 · 혼자 확인' }] }, transferItems: {}, transferTargets: {} })
    expect(withLink.check).toEqual({ ready: true, count: 1, blocked: null })
    const without = stagesOf(t, asIs, { confirmLinks: {}, transferItems: {}, transferTargets: {} })
    expect(without.check).toMatchObject({ ready: false, blocked: 'content_needed' })
  })

  it('live 템플릿(ws.central-meaning): 정본 링크와 창작 링크를 함께 센다 · 창작 전이 납품도 적용 가용량(지문 정체성 단위)', () => {
    const t = templateOf('ws.central-meaning')!
    const asIs = asIsWith('r.central_meaning', { status: 'verified', unseen: ['2026#20', 'authored:r5-cm-ind-1'], verifiedItems: ['2022#20'], wrongItems: [] })
    const st = stagesOf(t, asIs, {
      confirmLinks: { 'claim-support': [{ target: '2026#20', href: '/x', label: 'a' }], 'authored-central-meaning': [{ target: 'authored:r5-cm-ind-1', href: '/y', label: 'b' }] },
      transferItems: {},
      transferTargets: { 'authored-central-meaning': [
        { target: 'authored:r5-cm-transfer-1', href: '/t1', label: 't', passageKey: 'authored:aaa' },
        { target: 'authored:r5-cm-transfer-2', href: '/t2', label: 't', passageKey: 'authored:bbb' },
        { target: 'authored:r5-cm-transfer-3', href: '/t3', label: 't', passageKey: 'authored:aaa' },
      ] },
    })
    expect(st.transfer).toEqual({ ready: true, count: 2, blocked: null })
    expect(st.recheck.ready).toBe(true)
  })
})
