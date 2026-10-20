// apps/web/src/components/csat/authored/__tests__/AuthoredRunner.test.tsx
// FINAL §5 · §10 — 모든 창작 세트의 모든 문항이 학습자 화면에 그려지고, 풀기 전 HTML 에 Gold(정답 · 근거 · 해설)가 없다.
// 형식마다 입력 칸(문장 · 선택지 · 판정 · 쌍 · 밑줄 · 역할 · 덩어리 · 표현 쌍)이 보이는지 본다. 서버 렌더 정적 HTML 기준.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AUTHORED_SETS, learnerBody } from '@/lib/knowledge/authored/authored-items'
import { formatOf } from '@/lib/knowledge/authored/formats'

import { AuthoredRunner } from '../AuthoredRunner'

const MARKER: Record<string, string> = {
  option_correspondence: 'data-testid="authored-verdicts"',
  sentence_relation: 'data-testid="authored-pairs"',
  discourse_roles: 'data-testid="authored-roles"',
  segment_choice: 'data-testid="authored-segments"',
  equivalence: 'data-testid="authored-equivalence"',
  demand_choice: 'data-testid="authored-task-stem"',
}

/** Gold 에만 있는 긴 설명 문자열(정답 노출 판정용) */
function goldStrings(gold: Record<string, unknown>): string[] {
  const out: string[] = []
  const walk = (v: unknown, k: string) => {
    if (typeof v === 'string' && v.length >= 12 && ['gist', 'rationale', 'why', 'senseGloss', 'correction'].includes(k)) out.push(v)
    else if (Array.isArray(v)) v.forEach((x) => walk(x, k))
    else if (v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) walk(vv, kk)
  }
  walk(gold, '')
  return out
}

describe('AuthoredRunner — 모든 세트 · 모든 문항', () => {
  for (const set of AUTHORED_SETS) {
    it(`${set.set}: 그려지고 풀기 전 Gold 가 없다`, () => {
      for (const item of set.items) {
        const b = learnerBody(item.role, item.body)
        const html = renderToStaticMarkup(
          <AuthoredRunner id={item.id} deliveryId="00000000-0000-4000-8000-000000000001" role={item.role} format={b.format}
            sentences={b.sentences} stem={b.stem} choices={b.choices} teach={b.teach} hints={b.hints} extra={b.extra}
            probe={b.format === 'central_meaning' ? (item.gold as { relationProbe: { sentence: number } }).relationProbe.sentence : null}
            done={null} returnHref="/csat/diagnosis?tab=map&view=full" />,
        )
        expect(html, item.id).toContain(`data-format="${formatOf(item.body)}"`)
        expect(html, item.id).not.toContain('data-testid="authored-result"')
        if (MARKER[b.format]) expect(html, `${item.id} 입력 칸`).toContain(MARKER[b.format])
        // 교수 단계의 설명은 교수 역할에서 보이는 것이 정상 — 평가 · 안내 역할에서는 Gold 설명 문자열이 HTML 에 없어야 한다
        if (item.role !== 'model_explanation') {
          for (const g of goldStrings(item.gold as Record<string, unknown>)) expect(html, `${item.id} Gold 노출`).not.toContain(g.slice(0, 40))
        }
      }
    })
  }
})
