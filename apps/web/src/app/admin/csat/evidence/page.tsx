// apps/web/src/app/admin/csat/evidence/page.tsx
// 기출 원천 — 평가원 수능·모의평가 독해 문항 802개의 근거 판. 듣기는 다루지 않는다.
//
// 공장의 **첫 공정**이다(시중 출판사의 「출제경향 분석」). 여기서 나온 유형 리포트가
// 설계(이원목적분류표)의 근거가 되므로, 이 화면이 비면 아래 공정 전부가 짐작 위에 선다.
//
// 축·필터를 **URL 로 받는다.** 「2025학년도의 R-BLANK 중 지문이 잘린 것」 같은 조건을 링크
// 하나로 넘길 수 있어야 하류 공정(설계·소재·집필)과 연결된다. 링크를 열면 그 조건이 이미
// 걸린 채로 뜬다 — 화면이 조건을 기억하지 못하면 근거는 매번 말로 옮겨진다.

import { requireAdmin } from '@/lib/auth/require-admin'
import { loadEvidence } from '@/lib/csat/evidence'
import { AXES, filterFromQuery, MEASURES, type AxisId, type Measure } from '@/lib/csat/evidence-fold'

import { EvidenceConsole } from './EvidenceConsole'

export const dynamic = 'force-dynamic'

type Search = Record<string, string | string[] | undefined>

function one(sp: Search, key: string): string | undefined {
  const v = sp[key]
  return Array.isArray(v) ? v[0] : v
}

function axisOr(sp: Search, key: string, fallback: AxisId): AxisId {
  const v = one(sp, key)
  return AXES.some((a) => a.id === v) ? (v as AxisId) : fallback
}

export default async function AdminCsatEvidencePage({ searchParams }: { searchParams?: Search }) {
  await requireAdmin('/admin/csat/evidence')
  const data = await loadEvidence()

  const sp = searchParams ?? {}
  const m = one(sp, 'm')

  return (
    <EvidenceConsole
      {...data}
      initialFilter={filterFromQuery(sp)}
      // 기본 조합은 **결함 × 유형** 이다 — 이 화면에 오는 첫 질문이 「지금 내보내도 되나,
      // 안 되면 어디가 막혔나」이고 그 답이 이 교차에 그대로 있다.
      initialRow={axisOr(sp, 'row', 'defect')}
      initialCol={axisOr(sp, 'col', 'type')}
      initialMeasure={MEASURES.some((x) => x.id === m) ? (m as Measure) : 'items'}
    />
  )
}
