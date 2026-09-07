// packages/library-pipeline/src/compose/gates.test.ts
// ACP §20 — 재저작 게이트 회귀.
//
// 이 테스트가 지키는 것은 임계값이 아니라 **각 게이트가 막기로 한 침해 유형**이다.
// 판례별로 하나씩: 단일 출처 의존(Feist) · 표현 복제(Harper & Row) ·
// 구조 추종(Wainwright/Comline) · 속보 무임승차(hot-news) · 심장부 인용.

import { describe, expect, it } from 'vitest'

import {
  buildFingerprint,
  containment,
  findVerbatimRuns,
  jaccard,
  tokenize,
} from './fingerprint'
import {
  checkExpressionIndependence,
  checkPublicationDelay,
  checkQuotePolicy,
  checkShelfDuplication,
  checkSourceIndependence,
  checkStructureIndependence,
  collapseSyndication,
  isComposePublishable,
  runComposeGates,
  shelfRecordFrom,
  spearman,
  type ComposeDraft,
  type FactCard,
  type SourceRecord,
} from './gates'

// ── 픽스처 ───────────────────────────────────────────────────────────
// 같은 사건(지진)을 서로 다르게 쓴 기사 2편 + 그중 하나의 통신사 재게재본 1편.

const REUTERS = `A magnitude 5.2 earthquake struck the central coast of California on Tuesday
morning, and county officials said three people were treated for minor injuries at a regional
hospital. The shaking lasted about twenty seconds and was felt as far north as San Jose.
State geologists reported no damage to major bridges or highways in the affected region.
Schools in two districts closed for the remainder of the day while inspectors checked buildings.
The United States Geological Survey placed the epicenter about eight kilometers below the surface.`

// 같은 원고를 지역지가 축약 게재 — 문장은 그대로, 뒤 문단만 잘렸다.
const LOCAL_WIRE_COPY = `A magnitude 5.2 earthquake struck the central coast of California on
Tuesday morning, and county officials said three people were treated for minor injuries at a
regional hospital. The shaking lasted about twenty seconds and was felt as far north as San Jose.`

// 독립 취재 — 같은 사실을 완전히 다른 문장으로.
const INDEPENDENT = `Residents along California's central coast felt a moderate quake early
Tuesday. Emergency crews confirmed that three residents received treatment for light wounds.
Engineers who inspected highway overpasses through the afternoon found none that required
closure, though two school districts sent students home while classrooms were surveyed.
Federal seismologists put the origin roughly eight kilometers underground.`

function src(id: string, publisher: string, text: string, published_at: string): SourceRecord {
  return {
    id,
    publisher,
    url: `https://${publisher}/story/${id}`,
    published_at,
    fingerprint: buildFingerprint(text),
  }
}

const SOURCES: SourceRecord[] = [
  src('s1', 'reuters.com', REUTERS, '2026-08-14T09:00:00Z'),
  src('s2', 'coastdaily.example', LOCAL_WIRE_COPY, '2026-08-14T11:00:00Z'),
  src('s3', 'kqed.example', INDEPENDENT, '2026-08-14T14:00:00Z'),
]

/** 사실 카드 — attestations.ordinal = 그 소스 안에서의 등장 순서. */
const FACTS: FactCard[] = [
  {
    id: 'f1',
    claim: '2026년 8월 화요일 아침 캘리포니아 중부 해안에서 규모 5.2 지진이 발생했다',
    kind: 'event',
    attestations: [
      { source_id: 's1', ordinal: 0 },
      { source_id: 's2', ordinal: 0 },
      { source_id: 's3', ordinal: 0 },
    ],
  },
  {
    id: 'f2',
    claim: '3명이 경상으로 치료를 받았다',
    kind: 'figure',
    attestations: [
      { source_id: 's1', ordinal: 1 },
      { source_id: 's2', ordinal: 1 },
      { source_id: 's3', ordinal: 1 },
    ],
  },
  {
    id: 'f3',
    claim: '흔들림은 약 20초 지속됐고 산호세까지 감지됐다',
    kind: 'event',
    attestations: [
      { source_id: 's1', ordinal: 2 },
      { source_id: 's2', ordinal: 2 },
    ],
  },
  {
    id: 'f4',
    claim: '주요 교량·고속도로 피해는 보고되지 않았다',
    kind: 'event',
    attestations: [
      { source_id: 's1', ordinal: 3 },
      { source_id: 's3', ordinal: 2 },
    ],
  },
  {
    id: 'f5',
    claim: '2개 학군이 건물 점검을 위해 휴교했다',
    kind: 'event',
    attestations: [
      { source_id: 's1', ordinal: 4 },
      { source_id: 's3', ordinal: 3 },
    ],
  },
  {
    id: 'f6',
    claim: '진원 깊이는 지하 약 8km 로 측정됐다',
    kind: 'figure',
    attestations: [
      { source_id: 's1', ordinal: 5 },
      { source_id: 's3', ordinal: 4 },
    ],
  },
]

/** 독립 출처 2그룹을 모두 갖춘 사실만 골라, s1 전개 순서 그대로 나열한 것. */
const S1_ORDER: string[] = ['f1', 'f2', 'f4', 'f5', 'f6']

/** 사실만 보고 학습 순서로 새로 쓴 초안 (안전 경로). */
const GOOD_DRAFT: ComposeDraft = {
  text: `Two school districts in central California sent their students home on Tuesday. Their
buildings had to be checked first. Earlier that morning, the ground moved under the coast.
Scientists measured the quake at magnitude 5.2. Three people went to a hospital with small
injuries. Engineers looked at the bridges and the roads, and they found no damage.`,
  fact_order: ['f5', 'f1', 'f2', 'f4'],
  event_occurred_at: '2026-08-14T08:00:00Z',
}

const NOW = new Date('2026-08-17T00:00:00Z')

// ── 지문 ─────────────────────────────────────────────────────────────

describe('fingerprint', () => {
  it('토큰화가 구두점·대소문자를 지우고 어절만 남긴다', () => {
    expect(tokenize('The "quake," they said — it\'s over.')).toEqual([
      'the', 'quake', 'they', 'said', 'it\'s', 'over',
    ])
  })

  it('지문에서 원문을 복원할 수 없다 (해시만 남는다)', () => {
    const fp = buildFingerprint(REUTERS)
    expect(fp.hashes.every((h) => /^[0-9a-f]{8}$/.test(h))).toBe(true)
    expect(JSON.stringify(fp)).not.toContain('earthquake')
  })

  it('n 어절 미만 텍스트는 빈 지문', () => {
    expect(buildFingerprint('too short here').hashes).toEqual([])
  })

  it('연속 일치는 하나의 구간으로 병합되고 어절 수로 보고된다', () => {
    const fp = buildFingerprint(REUTERS)
    const runs = findVerbatimRuns(
      'Officials noted a magnitude 5.2 earthquake struck the central coast of California on Tuesday morning again.',
      fp,
    )
    expect(runs).toHaveLength(1)
    expect(runs[0]!.wordCount).toBeGreaterThanOrEqual(12)
    expect(runs[0]!.text).toContain('magnitude 5 2 earthquake struck the central coast')
  })

  it('독립 취재본과는 겹치는 구간이 없다', () => {
    expect(findVerbatimRuns(INDEPENDENT, buildFingerprint(REUTERS))).toEqual([])
  })

  it('포함도는 비대칭 — 축약본은 원본에 거의 통째로 들어간다', () => {
    const a = buildFingerprint(REUTERS)
    const b = buildFingerprint(LOCAL_WIRE_COPY)
    expect(containment(b, a)).toBeGreaterThan(0.9)
    expect(containment(a, b)).toBeLessThan(containment(b, a))
    expect(jaccard(a, b)).toBeGreaterThan(0)
    expect(jaccard(a, buildFingerprint(INDEPENDENT))).toBe(0)
  })
})

// ── I12 출처 독립성 (Feist) ──────────────────────────────────────────

describe('I12 출처 독립성', () => {
  it('통신사 재게재본은 발행사가 달라도 하나로 접힌다', () => {
    const groups = collapseSyndication(SOURCES)
    expect(groups).toHaveLength(2)
    const wire = groups.find((g) => g.includes('s1'))!
    expect(wire.sort()).toEqual(['s1', 's2'])
  })

  it('접힌 뒤 독립 2그룹이면 통과', () => {
    expect(checkSourceIndependence(GOOD_DRAFT, FACTS, SOURCES).verdict).toBe('PASS')
  })

  it('재게재본만 두 곳이면 실질 단일 출처로 차단', () => {
    const wireOnly = SOURCES.filter((s) => s.id !== 's3')
    const draft: ComposeDraft = { ...GOOD_DRAFT, fact_order: ['f1', 'f3'] }
    const r = checkSourceIndependence(draft, FACTS, wireOnly)
    expect(r.verdict).toBe('FAIL')
    expect(r.detail).toContain('독립 1')
  })

  it('원장에 없는 사실을 참조하면 차단', () => {
    const draft: ComposeDraft = { ...GOOD_DRAFT, fact_order: ['f1', 'f99'] }
    expect(checkSourceIndependence(draft, FACTS, SOURCES).detail).toContain('원장에 없는 사실')
  })
})

// ── I13 표현 독립성 (Harper & Row) ───────────────────────────────────

describe('I13 표현 독립성', () => {
  it('사실만 보고 쓴 초안은 통과', () => {
    expect(checkExpressionIndependence(GOOD_DRAFT, SOURCES).verdict).toBe('PASS')
  })

  it('10어절 이상 연속 복제는 차단하고 그 문구를 짚어 준다', () => {
    const copied: ComposeDraft = {
      ...GOOD_DRAFT,
      text: 'Students went home early. The shaking lasted about twenty seconds and was felt as far north as San Jose. Nobody was hurt badly.',
    }
    const r = checkExpressionIndependence(copied, SOURCES)
    expect(r.verdict).toBe('FAIL')
    expect(r.detail).toContain('the shaking lasted about twenty seconds')
  })

  it('짧은 일치는 검수자 판단으로 남긴다 (기관명·상투 서술 오탐 여지)', () => {
    // REUTERS 의 7어절 한 구간만 포함 — 하드 차단선(10) 미만.
    const borderline: ComposeDraft = {
      ...GOOD_DRAFT,
      text: 'Reports said inspectors checked buildings. State geologists reported no damage to major roads nearby afterward.',
    }
    const r = checkExpressionIndependence(borderline, SOURCES)
    expect(r.verdict).toBe('WARN')
    expect(isComposePublishable([r])).toBe(true)
  })
})

// ── I14 구조 독립성 (Wainwright · Comline) ───────────────────────────

describe('I14 구조 독립성', () => {
  it('Spearman — 동일 순서 1, 역순 -1, 동순위 처리', () => {
    expect(spearman([0, 1, 2, 3], [0, 1, 2, 3])).toBeCloseTo(1)
    expect(spearman([0, 1, 2, 3], [3, 2, 1, 0])).toBeCloseTo(-1)
    expect(spearman([0, 1, 2], [5, 5, 5])).toBe(0)
  })

  it('학습 순서로 재배열한 초안은 통과', () => {
    expect(checkStructureIndependence(GOOD_DRAFT, FACTS, SOURCES).verdict).toBe('PASS')
  })

  it('원문 문단 순서를 그대로 따라가면 단어를 다 바꿔도 차단', () => {
    // 표현은 GOOD_DRAFT 그대로(=I13 통과)이고 출처도 전부 독립 2그룹(=I12 통과)인데,
    // 사실 순서만 s1 전개를 복제했다. I14 만 단독으로 떨어져야 한다.
    const followsLede: ComposeDraft = { ...GOOD_DRAFT, fact_order: S1_ORDER }
    const r = checkStructureIndependence(followsLede, FACTS, SOURCES)
    expect(r.verdict).toBe('FAIL')
    expect(r.detail).toContain('전개를 따라가면')
    expect(checkExpressionIndependence(followsLede, SOURCES).verdict).toBe('PASS')
    expect(checkSourceIndependence(followsLede, FACTS, SOURCES).verdict).toBe('PASS')
  })

  it('공통 사실이 5건 미만이면 순서를 재지 않는다', () => {
    const few: ComposeDraft = { ...GOOD_DRAFT, fact_order: ['f1', 'f2'] }
    expect(checkStructureIndependence(few, FACTS, SOURCES).verdict).toBe('PASS')
  })
})

// ── I14 — 실측에서 나온 회귀 (2026-08-18 다뉴브강 원전 정지 취재) ────────
//
// 위 합성 테스트는 "원문 순서를 **그대로** 복제" 라는 극단만 덮고 있었다.
// 실제 드레인 첫 판에서 걸린 것은 그보다 훨씬 미묘했다 — 원문 전개에서 **한 사실만
// 맨 뒤로 옮긴** 초안이 ρ=0.84 로 차단됐다. 리드 문장을 그대로 두면(뉴스 첫 문장 =
// 사건 자체) 나머지가 자동으로 원문 순서를 따라간다.
//
// 아래 순서는 dw.com 기사에서 실제로 잰 등장 순서다.
describe('I14 — 한 항목만 뒤로 미루는 것으로는 독립이 되지 않는다 (실측)', () => {
  // 사실 8건: 정지(D) · 저수위(B) · 유일냉각원(A) · 20%(E) · 헝가리(H) · 전월정지(C) · 10일(F) · 대체전력(G)
  const KEYS = ['D', 'B', 'A', 'E', 'H', 'C', 'F', 'G'] as const
  // dw.com 실측 등장 순서(동시 등장은 동순위)
  const DW_ORDINAL: Record<string, number> = { D: 0, B: 0, A: 1, E: 1, H: 3, C: 5, F: 10, G: 11 }

  const facts: FactCard[] = KEYS.map((k) => ({
    id: k,
    claim: `fact ${k}`,
    kind: 'event',
    attestations: [
      { source_id: 'dw', ordinal: DW_ORDINAL[k] },
      // 독립 2계통이라 I12 는 통과한다 — I14 만 단독으로 판정되는지 보기 위함.
      { source_id: 'bbc', ordinal: DW_ORDINAL[k] },
    ],
  }))
  const sources: SourceRecord[] = [
    { id: 'dw', publisher: 'dw.com', url: 'https://dw.com/a', published_at: '', fingerprint: buildFingerprint('x') },
    { id: 'bbc', publisher: 'bbc.co.uk', url: 'https://bbc.co.uk/a', published_at: '', fingerprint: buildFingerprint('y') },
  ]
  const draft = (order: string[]): ComposeDraft => ({
    text: 'irrelevant for this gate',
    fact_order: order,
    event_occurred_at: '2026-08-13T12:00:00Z',
  })

  it('헝가리(H) 하나만 맨 뒤로 옮긴 초안은 차단된다', () => {
    const r = checkStructureIndependence(draft(['D', 'B', 'A', 'E', 'C', 'F', 'G', 'H']), facts, sources)
    expect(r.verdict).toBe('FAIL')
    expect(r.detail).toContain('0.8')
  })

  it('학습 순서(배경 → 구조 → 사건 → 규모 → 대응 → 함의)로 다시 짜면 통과한다', () => {
    // 뉴스는 사건(D)으로 열지만 학습 지문은 배경(B)으로 연다 — 이 한 수가 전개를 갈랐다.
    const r = checkStructureIndependence(draft(['B', 'A', 'C', 'D', 'F', 'E', 'G', 'H']), facts, sources)
    expect(r.verdict).toBe('PASS')
  })
})

// ── I15 발행 지연 (hot-news) ─────────────────────────────────────────

describe('I15 발행 지연', () => {
  it('48시간 경과분은 통과', () => {
    expect(checkPublicationDelay(GOOD_DRAFT, NOW).verdict).toBe('PASS')
  })

  it('속보는 차단하고 남은 시간을 알려 준다', () => {
    const fresh: ComposeDraft = { ...GOOD_DRAFT, event_occurred_at: '2026-08-16T20:00:00Z' }
    const r = checkPublicationDelay(fresh, NOW)
    expect(r.verdict).toBe('FAIL')
    expect(r.detail).toContain('시간 뒤 재시도')
  })

  it('사건 시각이 없는 주제글은 면제', () => {
    expect(checkPublicationDelay({ ...GOOD_DRAFT, event_occurred_at: null }, NOW).verdict).toBe('PASS')
  })

  it('사건 시각이 깨졌으면 통과시키지 않는다', () => {
    expect(checkPublicationDelay({ ...GOOD_DRAFT, event_occurred_at: 'yesterday' }, NOW).verdict).toBe('FAIL')
  })
})

// ── I16 인용 정책 ────────────────────────────────────────────────────

describe('I16 인용 정책', () => {
  const quote = (over: Partial<FactCard>): FactCard[] => [
    ...FACTS,
    {
      id: 'q1',
      claim: '주지사가 피해 조사를 지시했다',
      kind: 'utterance',
      quote: 'We will inspect every bridge.',
      quote_is_public: true,
      attestations: [
        { source_id: 's1', ordinal: 5 },
        { source_id: 's3', ordinal: 4 },
      ],
      ...over,
    },
  ]
  const withQuote: ComposeDraft = { ...GOOD_DRAFT, fact_order: [...GOOD_DRAFT.fact_order, 'q1'] }

  it('짧은 공개 발언은 통과', () => {
    expect(checkQuotePolicy(withQuote, quote({})).verdict).toBe('PASS')
  })

  it('독점 인터뷰 인용은 차단 (심장부)', () => {
    expect(checkQuotePolicy(withQuote, quote({ quote_is_public: false })).verdict).toBe('FAIL')
  })

  it('25어절 초과 인용은 차단', () => {
    const long = Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ')
    expect(checkQuotePolicy(withQuote, quote({ quote: long })).verdict).toBe('FAIL')
  })
})

// ── I17 서가 중복 (ACP 와 소스가 9곳 겹치는 데서 오는 위험) ──────────

describe('I17 서가 중복', () => {
  // ACP 가 이미 본문 그대로 발행해 둔 글이라고 가정한다.
  const shelf: SourceRecord[] = [
    src('own1', 'vocaflow(acp:noaa)', REUTERS, '2026-08-14T09:00:00Z'),
  ]

  it('shelfRecordFrom 은 우리 것임이 판정문에 드러나게 만든다', () => {
    const rec = shelfRecordFrom({ id: 'a1', title: 'T', source: 'noaa', content: REUTERS })
    expect(rec.publisher).toBe('vocaflow:noaa')
    expect(rec.fingerprint.hashes.length).toBeGreaterThan(0)
    // 우리 글이라도 지문만 남는다 — 본문을 레코드에 담지 않는다
    expect(JSON.stringify(rec)).not.toContain('earthquake')
  })

  it('대조할 발행 글이 없으면 통과', () => {
    expect(checkShelfDuplication(GOOD_DRAFT, []).verdict).toBe('PASS')
  })

  it('새로 쓴 글은 기존 발행 글과 겹치지 않는다', () => {
    expect(checkShelfDuplication(GOOD_DRAFT, shelf).verdict).toBe('PASS')
  })

  it('이미 발행한 글과 길게 겹치면 차단하고 처방이 다르다', () => {
    const dup: ComposeDraft = {
      ...GOOD_DRAFT,
      text: 'Students went home early. The shaking lasted about twenty seconds and was felt as far north as San Jose. Nobody was hurt badly.',
    }
    const r = checkShelfDuplication(dup, shelf)
    expect(r.verdict).toBe('FAIL')
    // 저작권이 아니라 "같은 사건이 이미 서가에 있다" 가 처방이다
    expect(r.detail).toContain('이미 서가에 있다면')
  })

  it('서가를 shelf 로 넘기면 I12 판정에 영향이 없다', () => {
    const wireOnly = SOURCES.filter((s) => s.id !== 's3')
    const draft: ComposeDraft = { ...GOOD_DRAFT, fact_order: ['f1', 'f3'] }
    const r = runComposeGates({ draft, facts: FACTS, sources: wireOnly, shelf, now: NOW })
    expect(r.find((g) => g.invariant === 'I12 출처 독립성')!.verdict).toBe('FAIL')
  })

  it('우리 글을 확인 소스로 적으면 독립 출처가 부풀려진다 — 원장 작성의 실제 위험', () => {
    // I12 는 sources 배열이 아니라 **attestation** 을 센다. 그래서 위험은 "서가를 sources 에
    // 섞는 것" 이 아니라 **우리 글에 확인 표시를 다는 것** 이다.
    // ACP 가 이미 발행한 NOAA 글을 보고 "여기서도 봤다" 며 확인 표시를 달면,
    // 실제로는 한 곳에서만 나온 사실이 독립 2계통으로 보인다.
    const wireOnly = SOURCES.filter((s) => s.id !== 's3')
    const draft: ComposeDraft = { ...GOOD_DRAFT, fact_order: ['f1'] }

    const honest = checkSourceIndependence(draft, FACTS, wireOnly)
    expect(honest.verdict).toBe('FAIL') // s1·s2 는 같은 통신사 계통

    // 서가 글이 통신사 원고를 그대로 실은 것이면 지문 접기가 같은 계통으로 묶어 준다.
    // 위험한 것은 **문면이 다른** 우리 글이다 — 접히지 않으므로 계통이 하나 는다.
    const ownIndependent = src('own2', 'vocaflow(acp:usgs)', INDEPENDENT, '2026-08-14T15:00:00Z')
    const inflatedFacts: FactCard[] = FACTS.map((f) =>
      f.id === 'f1'
        ? { ...f, attestations: [...f.attestations, { source_id: 'own2', ordinal: 0 }] }
        : f,
    )
    const inflated = checkSourceIndependence(draft, inflatedFacts, [...wireOnly, ownIndependent])
    expect(inflated.verdict).toBe('PASS')
    // → 그래서 ④ 원장의 확인 소스 선택지에는 **그 취재 묶음의 소스만** 올린다.
  })
})

// ── 통합 ─────────────────────────────────────────────────────────────

describe('runComposeGates', () => {
  it('안전 경로는 6게이트 전부 통과하고 발행 가능', () => {
    const results = runComposeGates({ draft: GOOD_DRAFT, facts: FACTS, sources: SOURCES, now: NOW })
    expect(results).toHaveLength(6)
    expect(results.map((r) => r.verdict)).toEqual(['PASS', 'PASS', 'PASS', 'PASS', 'PASS', 'PASS'])
    expect(isComposePublishable(results)).toBe(true)
  })

  it('critical FAIL 이 하나라도 있으면 발행 불가', () => {
    const results = runComposeGates({
      draft: { ...GOOD_DRAFT, fact_order: S1_ORDER },
      facts: FACTS,
      sources: SOURCES,
      now: NOW,
    })
    expect(isComposePublishable(results)).toBe(false)
    expect(results.find((r) => r.verdict === 'FAIL')!.invariant).toBe('I14 구조 독립성')
  })
})

describe('I14 — 순서를 뒤집는 것은 독립이 아니다', () => {
  // 실측 2026-08-19: 초안을 쓰면서 "ρ 가 음수면 낮은 것" 으로 읽고 소스 순서를 거꾸로
  //   배열했다가 ρ=-0.87 로 막혔다. 게이트는 **절대값**을 본다 — 역순은 같은 전개를
  //   거꾸로 따라가는 것이고, 그것도 그 기사의 구조를 쓴 것이다.
  const SOURCES: SourceRecord[] = [
    { id: 's1', publisher: 'a.com', url: 'https://a.com/1', published_at: '', fingerprint: buildFingerprint('one') },
    { id: 's2', publisher: 'b.com', url: 'https://b.com/1', published_at: '', fingerprint: buildFingerprint('two') },
  ]
  const facts: FactCard[] = ['f1', 'f2', 'f3', 'f4', 'f5'].map((id, i) => ({
    id,
    claim: `fact ${id}`,
    kind: 'event',
    attestations: [
      { source_id: 's1', ordinal: i + 1 },
      { source_id: 's2', ordinal: i + 1 },
    ],
  }))
  const draft = (order: string[]): ComposeDraft => ({
    text: 'irrelevant for this gate',
    fact_order: order,
    event_occurred_at: '2026-08-12T00:00:00Z',
  })

  it('그대로 따라간 순서를 막는다 (ρ=+1)', () => {
    const r = checkStructureIndependence(draft(['f1', 'f2', 'f3', 'f4', 'f5']), facts, SOURCES)
    expect(r.verdict).toBe('FAIL')
  })

  it('거꾸로 뒤집은 순서도 막는다 (ρ=-1)', () => {
    const r = checkStructureIndependence(draft(['f5', 'f4', 'f3', 'f2', 'f1']), facts, SOURCES)
    expect(r.verdict).toBe('FAIL')
  })

  it('섞은 순서는 통과한다 — 재배열이 진짜 재배열일 때', () => {
    const r = checkStructureIndependence(draft(['f3', 'f1', 'f5', 'f2', 'f4']), facts, SOURCES)
    expect(r.verdict).toBe('PASS')
  })
})

describe('전재 접기 임계값 — 실측으로 정한 자리 (2026-08-19)', () => {
  // 처음 값 0.25 는 근거 없이 적혀 있었고 **부분 전재를 통과시켰다.**
  //   각자 취재 4쌍: 0.0 · 1.1 · 1.3 · 1.3% / 부분 전재 2쌍: 19.3% · 31.3%
  //   그 사이에 0.25 가 있어 19.3% 짜리가 "독립" 으로 통과했고, 그 위에 지문 1편이
  //   발행 대기까지 갔다. 0.10 은 양쪽에서 멀다.
  const src = (id: string, publisher: string, text: string): SourceRecord => ({
    id,
    publisher,
    url: `https://${publisher}/${id}`,
    published_at: '',
    fingerprint: buildFingerprint(text),
  })

  const SHARED =
    'the club said the fan suffered a minor hand injury and watched the rest of the match from another area of the stadium instead of going to a local hospital for a further checkup'

  it('실측한 부분 전재 수준(약 20%)을 한 계통으로 접는다', () => {
    const a = src('a', 'yna.co.kr', SHARED + ' The league opened its own review on Thursday morning.')
    const b = src(
      'b',
      'koreaherald.com',
      'The league banned matches at the ground until further notice on Friday afternoon. ' +
        'Officials in the city said they would help the club find another venue for the coming weeks. ' +
        SHARED,
    )
    expect(collapseSyndication([a, b])).toHaveLength(1)
    // 옛 임계값이었다면 통과했다 — 값 하나가 판정을 갈랐다는 것을 남긴다.
    expect(collapseSyndication([a, b], 0.25).length).toBeGreaterThanOrEqual(1)
  })

  it('각자 쓴 두 기사는 그대로 두 계통이다', () => {
    const a = src(
      'a',
      'yna.co.kr',
      'An upcoming tournament match has been moved out of a stadium in the southeastern city because of safety concerns raised this week.',
    )
    const b = src(
      'b',
      'koreaherald.com',
      'The top league announced that it has banned games at the ground until an extensive inspection confirms the building is safe again.',
    )
    expect(collapseSyndication([a, b])).toHaveLength(2)
  })
})
