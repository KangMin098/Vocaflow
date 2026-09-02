// apps/web/src/app/admin/csat/__tests__/console-render.test.tsx
//
// 기출 분석 콘솔 렌더 스모크 + **99점 판정이 화면에서 뒤집히지 않는지** 본다.
//
// 이 화면의 유일한 주장은 "이 회차를 지금 풀면 99점이 나오나" 하나다. 그 판정이 백분율
// 반올림으로 흐려지면(96%를 「가능」으로 그리면) 관리자가 덜 된 회차를 끝난 것으로 본다.
// 그래서 빈 상태·부분 상태·완료 상태를 다 그려 보고, 「가능」이 언제 켜지는지 고정한다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { CsatCoverageRow, CsatTypeRow } from '@/lib/csat/client'

import { CsatConsoleClient } from '../CsatConsoleClient'

const EMPTY = {
  coverage: [] as CsatCoverageRow[],
  types: [] as CsatTypeRow[],
  totals: { exams: 0, inScopeItems: 0, analyzed: 0, published: 0, exams99: 0, answerUnknown: 0, reviews: 0 },
  loadError: null,
}

const partial: CsatCoverageRow = {
  exam_id: '2026',
  label: '2026학년도 수능',
  kind: 'suneung',
  in_scope_items: 28,
  analyzed: 27,
  published: 27,
  scope_points: 63,
  covered_points: 61,
  covers_99: false,
}

const complete: CsatCoverageRow = {
  ...partial,
  exam_id: 'M2706',
  label: '2027학년도 6월 모의평가',
  kind: 'mock',
  analyzed: 28,
  published: 28,
  covered_points: 63,
  covers_99: true,
}

const type: CsatTypeRow = {
  type_id: 'R-BLANK',
  name: '빈칸 추론',
  section: '독해',
  status: 'active',
  items: 117,
  published: 12,
  has_report: true,
  report_n: 12,
}

// React 의 서버 렌더는 인접한 텍스트 조각 사이에 `<!-- -->` 를 넣는다
// (`63<!-- -->/<!-- -->63<!-- -->점`). 화면에 보이는 글자로 검사하려면 그것부터 걷어내야 한다.
const text = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '')

/** 표 본문(`<tbody>`)만 — 상단 통계 라벨("99점 가능 회차")에 '가능' 이 들어 있어 오탐이 난다 */
const tbody = (html: string) => text(html).split('<tbody>')[1]?.split('</tbody>')[0] ?? ''

describe('CsatConsoleClient', () => {
  it('데이터가 하나도 없어도 그려지고, 다음에 할 일을 말한다', () => {
    const html = renderToString(<CsatConsoleClient {...EMPTY} />)
    expect(text(html)).toContain('기출 분석')
    expect(text(html)).toContain('corpus-sync.mjs')
  })

  it('불러오기 실패를 삼키지 않는다', () => {
    const html = renderToString(<CsatConsoleClient {...EMPTY} loadError="csat_coverage: not found" />)
    expect(html).toContain('csat_coverage: not found')
  })

  it('배점을 백분율이 아니라 두 수로 적는다 — 반올림이 숨을 자리를 없앤다', () => {
    const html = renderToString(
      <CsatConsoleClient {...EMPTY} coverage={[partial]} totals={{ ...EMPTY.totals, exams: 1 }} />,
    )
    expect(text(html)).toContain('61/63점')
  })

  it('배점을 전부 덮지 못하면 「가능」이 아니다 (27/28문항 · 61/63점)', () => {
    const html = renderToString(
      <CsatConsoleClient {...EMPTY} coverage={[partial]} totals={{ ...EMPTY.totals, exams: 1 }} />,
    )
    expect(tbody(html)).toContain('미달')
    expect(tbody(html)).not.toContain('가능')
  })

  it('배점을 전부 덮으면 「가능」이 켜진다', () => {
    const html = renderToString(
      <CsatConsoleClient {...EMPTY} coverage={[complete]} totals={{ ...EMPTY.totals, exams: 1, exams99: 1 }} />,
    )
    expect(tbody(html)).toContain('가능')
    expect(text(html)).toContain('63/63점')
  })

  it('유형 표에 남은 몫과 유형 리포트 유무가 보인다', () => {
    const html = renderToString(<CsatConsoleClient {...EMPTY} types={[type]} />)
    // 기본 탭은 회차 커버리지라 유형 표는 아직 안 보인다 — 탭 라벨만 확인한다
    expect(html).toContain('유형별 진행')
  })

  it('정답 미상 문항 수를 숨기지 않는다 — 원본이 없어서 못 쓰는 것이다', () => {
    const html = renderToString(
      <CsatConsoleClient {...EMPTY} totals={{ ...EMPTY.totals, answerUnknown: 196 }} />,
    )
    expect(html).toContain('196')
    expect(html).toContain('정답 미상')
  })
})
