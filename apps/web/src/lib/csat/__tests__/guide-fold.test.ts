// apps/web/src/lib/csat/__tests__/guide-fold.test.ts
//
// 함정 **계열 병합**과 가이드 Markdown 을 고정한다.
//
// 왜 이 두 개인가: 교재 목차가 이 병합 결과로 정해진다. 과소 병합이면 한 유형에 30꼭지가 생기고
// (그중 12개가 같은 말), 과잉 병합이면 서로 다른 함정이 한 꼭지로 뭉개진다. 둘 다 조용히 틀리는
// 종류라 실제 리포트에서 뽑은 라벨로 못 박는다.

import { describe, expect, it } from 'vitest'

import {
  detectAnalystMeta,
  foldTrapFamilies,
  renderGuideMarkdown,
  sameTrapFamily,
  trapTokens,
  type CsatGuideSource,
  type RawTrap,
} from '../guide-fold'

// 실제 `csat_type_reports.recurring_traps['R-ORDER']` 에서 가져온 라벨들 (2026-09-05 실측).
// 「지시어 선행사」4줄 · 「첫 등장」4줄 · 「연결사 방향」4줄이 갈라져 있던 자료다.
const R_ORDER: RawTrap[] = [
  { trap: '지시어 선행사 없음', count: 18, signature: 'such · this · They 로 시작하는데 받을 대상이 없다' },
  { trap: '지시어 선행사 절단', count: 16 },
  { trap: '마무리 문장 위치 오판', count: 14 },
  { trap: '지시어 선행사 없음 / 어긋남', count: 14 },
  { trap: '예고–응답 분리', count: 11 },
  { trap: '첫 등장 위반', count: 10 },
  { trap: '총론-각론 역전', count: 10 },
  { trap: '첫 등장 뒤집힘', count: 10 },
  { trap: '정보 첫 등장 역전 (부정관사 → 정관사)', count: 9 },
  { trap: '연결사 근거 없음 · 방향 어긋남', count: 9 },
  { trap: '어휘 반복 유인', count: 8 },
  { trap: '연결사 방향 충돌', count: 8 },
  { trap: '첫 등장 역전', count: 8 },
  { trap: '지시어 선행사 앞당김', count: 7 },
  { trap: '논지-부연 역전', count: 7 },
  { trap: '연결사 방향 오독', count: 7 },
  { trap: '연쇄 고리 절단', count: 6 },
  { trap: '연결사 방향 어긋남', count: 6 },
  { trap: '결론·마무리 문장 위치 오판', count: 6 },
  { trap: '끝맺음 위반', count: 5 },
  { trap: '어휘 반복에 낚임', count: 2 },
]

const familyOf = (label: string, fams: ReturnType<typeof foldTrapFamilies>) =>
  fams.find((f) => f.labels.includes(label))

describe('trapTokens', () => {
  it('구분자(·, /, -, →, 괄호)를 전부 경계로 본다', () => {
    expect([...trapTokens('정보 첫 등장 역전 (부정관사 → 정관사)')]).toEqual([
      '정보',
      '첫',
      '등장',
      '역전',
      '부정관사',
      '정관사',
    ])
    expect([...trapTokens('총론-각론 역전')]).toEqual(['총론', '각론', '역전'])
  })

  it('3자 이상 토큰의 조사만 뗀다 — 「반복에」는 「반복」, 「역전」은 그대로', () => {
    expect(trapTokens('어휘 반복에 낚임').has('반복')).toBe(true)
    expect(trapTokens('총론-각론 역전').has('역전')).toBe(true)
  })
})

describe('sameTrapFamily', () => {
  it('겹치는 낱말이 둘 이상이면 같은 계열', () => {
    expect(sameTrapFamily('지시어 선행사 없음', '지시어 선행사 절단')).toBe(true)
    expect(sameTrapFamily('연결사 방향 충돌', '연결사 방향 오독')).toBe(true)
    expect(sameTrapFamily('어휘 반복 유인', '어휘 반복에 낚임')).toBe(true)
  })

  it('한 낱말만 겹치는 것은 계열이 아니다 — 「없음」끼리 묶이면 안 된다', () => {
    expect(sameTrapFamily('지시어 선행사 없음', '연결사 근거 없음')).toBe(false)
    expect(sameTrapFamily('총론-각론 역전', '논지-부연 역전')).toBe(false)
  })

  it('1자 토큰만 겹치는 것으로는 묶지 않는다', () => {
    expect(sameTrapFamily('첫 글 위반', '첫 말 역전')).toBe(false)
  })
})

describe('foldTrapFamilies', () => {
  const fams = foldTrapFamilies(R_ORDER)

  it('라벨 21개를 계열로 줄인다 — 접지 않으면 교재 목차가 안 된다', () => {
    expect(R_ORDER.length).toBe(21)
    expect(fams.length).toBeLessThan(R_ORDER.length)
    expect(fams.length).toBeGreaterThan(5)
  })

  it('「지시어 선행사」 4줄이 한 계열로 모이고 횟수가 합쳐진다', () => {
    const f = familyOf('지시어 선행사 없음', fams)
    expect(f?.labels.sort()).toEqual(
      ['지시어 선행사 없음', '지시어 선행사 절단', '지시어 선행사 없음 / 어긋남', '지시어 선행사 앞당김'].sort(),
    )
    expect(f?.count).toBe(18 + 16 + 14 + 7)
    // 대표는 관찰 횟수가 가장 큰 라벨 — signature 도 그것을 따라온다
    expect(f?.key).toBe('지시어 선행사 없음')
    expect(f?.signature).toContain('받을 대상이 없다')
  })

  it('「첫 등장」 4줄, 「연결사 방향」 4줄도 각각 한 계열', () => {
    expect(familyOf('첫 등장 위반', fams)?.labels).toHaveLength(4)
    expect(familyOf('연결사 방향 충돌', fams)?.labels).toHaveLength(4)
  })

  it('서로 다른 함정은 뭉개지 않는다', () => {
    expect(familyOf('총론-각론 역전', fams)?.key).not.toBe(familyOf('논지-부연 역전', fams)?.key)
    expect(familyOf('연쇄 고리 절단', fams)?.labels).toEqual(['연쇄 고리 절단'])
  })

  it('누적 횟수 합은 보존된다 — 접는 과정에서 관찰이 사라지면 안 된다', () => {
    const before = R_ORDER.reduce((s, t) => s + (t.count ?? 0), 0)
    expect(fams.reduce((s, f) => s + f.count, 0)).toBe(before)
    expect(fams.flatMap((f) => f.labels)).toHaveLength(R_ORDER.length)
  })

  it('횟수 내림차순으로 나온다', () => {
    const counts = fams.map((f) => f.count)
    expect([...counts].sort((a, b) => b - a)).toEqual(counts)
  })

  it('빈 입력과 이름 없는 줄을 흘려보낸다', () => {
    expect(foldTrapFamilies([])).toEqual([])
    expect(foldTrapFamilies([{ trap: '   ' }])).toEqual([])
  })
})

describe('detectAnalystMeta', () => {
  // 실제 `csat_type_reports.answer_locus_pattern['R-BLANK']` 에서 가져온 문장들 (2026-09-05 실측).
  // 이 글이 학습자 화면 `/csat/R-BLANK` 에 그대로 나가고 있다.
  it('학습자에게 뜻이 없는 작업 표지를 집어낸다', () => {
    expect(detectAnalystMeta('앞선 청크의 관찰 ①은 이 청크에서는 성립하지 않는다')).toEqual([
      '청크',
      '관찰 번호',
    ])
    expect(detectAnalystMeta('── 2026-09-04 갱신: 정답표가 확보돼')).toEqual(['날짜 갱신 표시'])
    expect(detectAnalystMeta('confirmed_at 에 두 번째 자리를 적어야 했다')).toEqual(['내부 필드명'])
    expect(detectAnalystMeta('이번 회차분에서는 세 건 있었다')).toEqual(['배치 지시'])
  })

  it('학습자용 서술을 오탐하지 않는다 — 「재확인」·「성립하지 않는다」는 정당한 말이다', () => {
    expect(detectAnalystMeta('빈칸 앞 한 문장에 근거가 붙어 있는 경우가 다수다')).toEqual([])
    expect(detectAnalystMeta('이 규칙은 옛 회차에서는 성립하지 않는다')).toEqual([])
    expect(detectAnalystMeta(null)).toEqual([])
  })
})

describe('renderGuideMarkdown', () => {
  const src: CsatGuideSource = {
    generated_at: '2026-09-05 00:00:00Z',
    types: [
      {
        type_id: 'R-ORDER',
        name: '글의 순서',
        section: '독해',
        status: 'active',
        items: 56,
        recent: 12,
        n_analyzed: 56,
        time_budget_sec: 115,
        answer_locus_pattern: '이음매는 지시어와 연결사에 있다',
        analyst_meta: [],
        procedure: [{ step: '주어진 글의 명사를 적는다', on_fail: '대명사를 먼저 적는다' }],
        traps_raw: R_ORDER.length,
        trap_families: foldTrapFamilies(R_ORDER),
        failure_modes: ['쌍을 통째로 앞당긴다'],
        predicted_avg: 0.62,
        vocab: [{ lemma: 'asymmetry', items: 3 }],
      },
    ],
    vocab: [
      {
        lemma: 'asymmetry',
        items: 3,
        types: ['글의 순서'],
        latest_year: 2026,
        in_dictionary: false,
        match: 'none',
        headword: null,
        is_phrase: false,
        cefr_level: null,
        v_level: null,
      },
      // 굴절형은 「없음」이 아니다 — 표제어를 적어 줘야 교재에 무엇을 실을지 안다
      {
        lemma: 'entries',
        items: 2,
        types: ['글의 순서'],
        latest_year: 2025,
        in_dictionary: true,
        match: 'inflected',
        headword: 'entry',
        is_phrase: false,
        cefr_level: 'B1',
        v_level: 4,
      },
    ],
    exams: [
      {
        exam_id: '2026',
        label: '2026학년도 수능',
        kind: 'suneung',
        year: 2026,
        items: 28,
        points: 63,
        time_budget_sec: 2640,
        predicted_avg: 0.71,
      },
    ],
    totals: {
      types: 1,
      items: 28,
      analyzed: 28,
      trapLabels: R_ORDER.length,
      trapFamilies: foldTrapFamilies(R_ORDER).length,
      typesLearnerReady: 1,
      vocabLemmas: 2,
      vocabDirect: 0,
      vocabInflected: 1,
      vocabGap: 1,
      vocabGapPhrase: 0,
      vocabInDictionary: 1,
      timeBudgetSec: 2640,
    },
  }

  const md = renderGuideMarkdown(src)

  it('교재 집필 순서대로 절·표를 낸다', () => {
    expect(md).toContain('# 기출 분석 학습 가이드 원천 자료')
    expect(md.indexOf('## 1. 유형별 가이드')).toBeLessThan(md.indexOf('## 2. 기출 필수 어휘 원천'))
    expect(md.indexOf('## 2. 기출 필수 어휘 원천')).toBeLessThan(md.indexOf('## 3. 회차별 구성'))
    expect(md).toContain('**정답 근거가 어디 있나**')
    expect(md).toContain('막히면: 대명사를 먼저 적는다')
  })

  it('접기 전 라벨 수를 함께 적는다 — 접었다는 사실이 자료에 남아야 한다', () => {
    expect(md).toContain(`원 라벨 ${R_ORDER.length}개를 접은 것`)
    expect(md).toContain('같은 계열 라벨 4:')
  })

  it('사전 미등재를 눈에 띄게 적는다 — 교재에 실을 뜻이 없는 낱말이다', () => {
    expect(md).toContain('| asymmetry | 3 | 글의 순서 | 2026 | **없음** | — | — |')
  })

  // 이 구분이 없으면 굴절형이 전부 「없음」이 되어 **뜻이 이미 있는 낱말을 다시 만들라고** 시킨다.
  // 실측 2026-09-05: 표제어 대조만으로 미등재 907이었는데 그중 433이 굴절형이었다.
  it('굴절형을 「없음」으로 세지 않고 표제어를 적는다', () => {
    expect(md).toContain('| entries | 2 | 글의 순서 | 2025 | 굴절형(entry) | B1 | 4 |')
    expect(md).toContain('| — 굴절형으로 (표제어는 있다) | 1 |')
    expect(md).toContain('| **뜻이 없는 빈칸** | 1 (낱말 1 · 구 0) |')
  })

  it('시간은 분·초로 — 초만 적으면 회차 분배를 못 한다', () => {
    expect(md).toContain('44분 00초')
  })

  it('평가원 지문 원문이 들어갈 자리가 없다는 것을 문서가 스스로 말한다', () => {
    expect(md).toContain('평가원 지문 원문이 들어 있지 않다')
  })
})
