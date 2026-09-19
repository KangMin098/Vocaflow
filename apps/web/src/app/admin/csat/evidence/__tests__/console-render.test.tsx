// apps/web/src/app/admin/csat/evidence/__tests__/console-render.test.tsx
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  AXES,
  applyFilter,
  bucketsOf,
  coverageOf,
  keysOf,
  pivot,
  axisContext,
  type AxisContext,
  type EvidenceExam,
  type EvidenceItem,
  type EvidenceType,
} from '@/lib/csat/evidence-fold'
import {
  filterOperations,
  parseOperationsState,
  operationsHref,
  pipelineHealth,
  readinessIndex,
  workQueue,
  makeWorkPackage,
  type OperationsData,
} from '@/lib/csat/evidence-operations'
import { EvidenceConsole } from '../EvidenceConsole'
const EXAMS: EvidenceExam[] = [
  { id: '2026', label: '2026학년도 수능', kind: 'suneung', year: 2026, month: 11, items: 3 },
  { id: 'M2606', label: '2026학년도 6월 모의평가', kind: 'mock', year: 2026, month: 6, items: 1 },
  // **문항이 0인 회차** — 옛 콘솔은 이런 회차를 행째로 잃었다(`csat_coverage()` 가 INNER JOIN).
  { id: 'M2009', label: '2020학년도 9월 모의평가', kind: 'mock', year: 2020, month: 9, items: 0 },
]

const TYPES: EvidenceType[] = [
  {
    id: 'R-BLANK',
    name: '빈칸 추론',
    status: 'active',
    items: 2,
    reportN: 3,
    analystMeta: ['청크'],
  },
  { id: 'R-ORDER', name: '글의 순서', status: 'active', items: 2, reportN: 2, analystMeta: [] },
]

function item(over: Partial<EvidenceItem> & Pick<EvidenceItem, 'id'>): EvidenceItem {
  return {
    examId: '2026',
    examLabel: '2026학년도 수능',
    year: 2026,
    kind: 'suneung',
    no: 31,
    typeId: 'R-BLANK',
    typeName: '빈칸 추론',
    points: 2,
    highScore: false,
    answer: 3,
    answerCount: 1,
    steps: 5,
    vocab: 4,
    traps: ['어휘 함정'],
    predicted: 0.5,
    timeSec: 110,
    whyLen: 300,
    rejected: 4,
    distractors: 4,
    bodyOk: true,
    quoteLocated: true,
    reviewed3: true,
    defects: [],
    ...over,
  }
}

const ITEMS: EvidenceItem[] = [
  // 깨끗한 것
  item({ id: 'a', no: 31 }),
  // 지문이 잘린 것 + 인용을 못 찾은 것 (실측에서 둘은 늘 함께 온다)
  item({ id: 'b', no: 32, bodyOk: false, quoteLocated: false, defects: ['body', 'quote'] }),
  // 유형 리포트가 오염된 것 — 문항 자체는 멀쩡한데 배포가 막힌다
  item({
    id: 'c',
    no: 33,
    points: 3,
    highScore: true,
    defects: ['reportText'],
    traps: ['반대 진술', '무관'],
  }),
  // 다른 회차 · 다른 유형 · 함정 라벨 없음
  item({
    id: 'd',
    examId: 'M2606',
    examLabel: '2026학년도 6월 모의평가',
    year: 2026,
    kind: 'mock',
    no: 37,
    typeId: 'R-ORDER',
    typeName: '글의 순서',
    steps: 6,
    vocab: 5,
    traps: [],
    predicted: 0.85,
    defects: [],
  }),
]

const CTX: AxisContext = axisContext(ITEMS, EXAMS, TYPES)

const DATA: OperationsData = {
  items: ITEMS,
  exams: EXAMS,
  types: TYPES,
  generatedAt: '2026-09-18T00:00:00Z',
  loadError: null,
  readinessError: null,
  readiness: {
    total: 4,
    fields: { answer: 4, anchor: 3, topic: 2 },
    readyIds: ['a'],
    excluded: [
      { id: 'b', missing: ['anchor', 'topic'] },
      { id: 'c', missing: ['topic'] },
      { id: 'd', missing: ['catalog'] },
    ],
  },
}
const INDEX = readinessIndex(DATA.readiness)
const text = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '')
const render = (query = '', data = DATA) =>
  text(
    renderToString(
      <EvidenceConsole
        data={data}
        initialState={parseOperationsState(new URLSearchParams(query))}
      />
    )
  )

describe('operations rendering', () => {
  it('학습 준비는 원천 결함 없음과 다른 판정이며 요약에서 문항으로 연결한다', () => {
    const html = render()
    expect(html).toContain('data-ready="1"')
    expect(html).toContain('3문항이 학습 후보 기준')
    expect(html).toContain('검토 필요 2문항')
    expect(html).toContain('제외 문항 검토')
    expect(html).not.toContain('행<select')
    expect(html).not.toContain('13,634')
  })
  it('조회 실패는 판정 보류이며 정상 0건이 아니다', () => {
    const html = render('', { ...DATA, loadError: 'query failure' })
    expect(html).toContain('판정 보류')
    expect(html).toContain('query failure')
    expect(html).not.toContain('3문항이 학습 후보 기준')
  })
  it('빈 데이터는 다음 단계와 재검증을 남긴다', () => {
    const html = render('view=questions', { ...DATA, items: [] })
    expect(html).toContain('조건에 맞는 문항이 없습니다')
    expect(html).toContain('전체 문항 보기')
  })
  it('교차 진단과 전체 산출물은 보존하고 고급 분석에 둔다', () => {
    const html = render('view=questions&matrix=1')
    expect(html).toContain('방향키')
    expect(html).toContain('칸 합')
    for (const axis of AXES) expect(html).toContain(axis.label)
    expect(html).toContain('/api/admin/csat/guide?format=md')
    expect(html).toContain('format=json')
  })
  it('작업 큐에 영향, 우선순위, 조치와 실행 경계를 적는다', () => {
    const html = render('view=issues')
    expect(html).toContain('원천 검토')
    expect(html).toContain('학습 후보 제외')
    expect(html).toContain('처리 방법')
    expect(html).toContain('실행 예약이 아닙니다')
  })
})

describe('operational projections', () => {
  it('같은 다중 축의 교차 셀은 OR 대신 두 조건을 모두 만족한다', () => {
    const source = [
      { ...ITEMS[0], id: 'both', defects: ['body', 'quote'] as const },
      { ...ITEMS[0], id: 'one', defects: ['body'] as const },
    ].map((i) => ({ ...i, defects: [...i.defects] }))
    const state = parseOperationsState({ cellAxis: 'defect', cellRow: 'body', cellCol: 'quote' })
    expect(filterOperations(source, state, CTX, INDEX).map((i) => i.id)).toEqual(['both'])
    expect(
      parseOperationsState(new URL(operationsHref(state), 'http://localhost').searchParams)
    ).toEqual(state)
  })
  it('결함 중복을 더하지 않고 후보 제외 집합을 보존한다', () => {
    expect(
      filterOperations(ITEMS, parseOperationsState({ status: 'blocked' }), CTX, INDEX)
        .map((i) => i.id)
        .sort()
    ).toEqual(['b', 'c', 'd'])
    expect(
      filterOperations(ITEMS, parseOperationsState({ status: 'quality' }), CTX, INDEX)
        .map((i) => i.id)
        .sort()
    ).toEqual(['b', 'c'])
    expect(
      filterOperations(
        ITEMS,
        parseOperationsState({ issue: 'field:topic', type: 'R-BLANK' }),
        CTX,
        INDEX
      )
    ).toHaveLength(2)
  })
  it('파이프라인 최초 탈락 합 + 최종 통과 = 모집단', () => {
    const stages = pipelineHealth(ITEMS, INDEX)
    expect(stages.map((s) => s.blocked)).toEqual([0, 1, 0, 1, 1])
    expect(stages.reduce((n, s) => n + s.blocked, 0) + stages.at(-1)!.passed).toBe(4)
    expect(stages.at(-1)!.passed).toBe(1)
  })
  it('큰 문제보다 원문 손상을 우선하며 이유를 보존한다', () => {
    const queue = workQueue(ITEMS, INDEX)
    expect(queue[0].id).toBe('body')
    expect(queue.find((i) => i.id === 'field:topic')?.count).toBe(2)
    expect(queue.every((i) => i.action && i.location && i.why)).toBe(true)
  })
  it('8축 레거시 링크와 새 상태를 손실 없이 왕복한다', () => {
    const state = parseOperationsState({
      row: 'trap',
      col: 'year',
      type: 'R-BLANK|R-ORDER',
      defect: 'body',
      m: 'time',
      item: 'M2706#33',
      issue: 'field:anchor',
      q: '빈칸',
      status: 'blocked',
      sort: 'recent',
      page: '2',
    })
    expect(state.view).toBe('questions')
    expect(state.matrix).toBe(true)
    expect(
      parseOperationsState(new URL(operationsHref(state), 'http://localhost').searchParams)
    ).toEqual(state)
  })
  it('잘못된 enum은 안전하게 복구한다', () => {
    expect(
      parseOperationsState({ view: 'x', status: 'y', issue: 'injected', stage: 'x', page: '-8' })
    ).toMatchObject({ view: 'overview', status: 'all', issue: '', stage: '', page: 1 })
  })
  it('작업 묶음은 선택 대상만 포함하며 실행되지 않은 작업을 완료로 표시하지 않는다', () => {
    const item = { ...ITEMS[0], id: 'M2706#33', defects: ['body'] as EvidenceItem['defects'] }
    const packet = makeWorkPackage([item], parseOperationsState(), DATA.generatedAt)
    expect(packet.itemIds).toEqual(['M2706#33'])
    expect(packet.commands?.export).toContain("--redo 'M2706#33'")
    expect(packet.action).toContain('아직 실행되지 않았습니다')
    const meta = makeWorkPackage(
      [{ ...item, defects: [] }],
      parseOperationsState({ issue: 'field:history' }),
      DATA.generatedAt
    )
    expect(meta.commands).toBeNull()
    expect(meta.issues[0].label).toBe('형식 이력 부족')
    expect(
      makeWorkPackage([{ ...item, id: "bad'$(x)" }], parseOperationsState(), '').commands
    ).toBeNull()
  })
})

describe('기존 피벗·필터 무결성', () => {
  it('8 × 8 = 64 조합 모두 고유 문항 수를 보존한다', () => {
    for (const r of AXES)
      for (const c of AXES) {
        const p = pivot(ITEMS, r.id, c.id, 'items', CTX)
        expect(p.grand).toBe(4)
        if (!r.multi && !c.multi) expect(p.cellSum).toBe(4)
      }
  })
  it('다중 축은 중복 합을 구별하고 문항을 잃지 않는다', () => {
    expect(pivot(ITEMS, 'trap', 'type', 'items', CTX).cellSum).toBeGreaterThan(4)
    for (const axis of AXES)
      for (const item of ITEMS) expect(keysOf(item, axis.id).length).toBeGreaterThan(0)
    expect(bucketsOf('exam', CTX).map((b) => b.key)).toContain('M2009')
  })
  it('축 내 OR, 축 사이 AND와 결함 없음 필터를 보존한다', () => {
    expect(applyFilter(ITEMS, { type: ['R-BLANK', 'R-ORDER'] }, CTX)).toHaveLength(4)
    expect(applyFilter(ITEMS, { type: ['R-BLANK'], defect: ['body'] }, CTX)).toHaveLength(1)
    expect(applyFilter(ITEMS, { defect: ['__clean__'] }, CTX)).toHaveLength(2)
    const cov = coverageOf(ITEMS)
    expect(cov.byField.reduce((n, f) => n + f.bad, 0)).toBe(cov.cells - cov.fill)
  })
})
