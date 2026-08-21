// packages/library-pipeline/src/textbook/csat-types.ts
//
// **수능 영어 읽기 문항 유형 정본.** 커버리지를 말하려면 분모가 있어야 한다.
//
// ── 왜 이 파일이 먼저인가 ────────────────────────────────────────────
// "시중 교재 100% 커버리지" 를 목표로 삼으려면 **무엇의 100%인지**가 있어야 한다.
// 시중 교재는 수능 유형을 모사하므로, 분모는 시중 교재가 아니라 **수능 유형 자체**다.
// 원본을 기준으로 삼는 편이 더 엄격하고, 저작권 문제도 없다(문항 유형은 아이디어다).
//
// ── 출처 (2026-08-21 조사) ───────────────────────────────────────────
// 수능 영어 45문항 = 듣기·말하기 17 + 읽기·쓰기 28(18~45번). 70분.
//   https://namu.wiki/w/대학수학능력시험/영어%20영역/문제%20유형
//   https://www.kci.go.kr/kciportal/landing/article.kci?arti_id=ART003267809
//
// 이 파일은 **읽기 28문항**만 다룬다 — 듣기는 음원이 필요해 별개 파이프라인이다.
//
// ── 생성 방식을 셋으로 나눈 이유 ─────────────────────────────────────
// 유형마다 "만들 수 있는가" 의 성질이 다르다. 뭉뚱그리면 커버리지가 거짓말이 된다.
//
//   deterministic  원문 구조가 정답을 정한다. 오답 설계가 필요 없고 모호성이 0 이다.
//   generative     그럴듯한 오답을 만들어야 한다. **여기가 품질이 갈리는 자리다.**
//   external       지문 밖 재료가 있어야 한다(도표·안내문 등).

export type CsatGeneration = 'deterministic' | 'generative' | 'external'

export interface CsatType {
  /** 유형 키. */
  key: string
  /** 수능 시험지에서의 문항 번호(들). 같은 유형이 여러 번호에 걸치기도 한다. */
  numbers: number[]
  label: string
  generation: CsatGeneration
  /** 지금 이 저장소에서 만들 수 있는가. */
  implemented: boolean
  /**
   * `csat_dcp_items.type` 에 들어가는 값. **키와 다를 수 있다.**
   *
   * 이 표는 *수능 유형*의 이름이고 DB 는 *문항 종류*의 이름이라 원래 다른 축인데,
   * 같은 것을 가리키면서 이름이 다르면 언젠가 한쪽만 고친다(실제로 요지는 `gist` ↔ `main_point` 로
   * 갈려 있었다). 다르면 여기 적어 다리를 놓는다. 같으면 생략한다.
   */
  dbType?: string
  /**
   * 왜 그 방식이고 왜 (안) 되는가. **판단의 근거를 여기 적는다** —
   * 적지 않으면 다음 사람이 "쉬워 보이는데 왜 없지" 로 시간을 쓴다.
   */
  note: string
}

/**
 * 수능 영어 읽기 유형 18종 (문항 28개).
 *
 * ⚠️ 번호는 해마다 한두 자리 움직인다. 여기 적힌 것은 2018학년도 개편 이후의 통상 배치다.
 *   커버리지 계산은 번호가 아니라 **유형 수**로 한다 — 번호가 바뀌어도 유형은 유지된다.
 */
export const CSAT_READING_TYPES: readonly CsatType[] = [
  {
    key: 'purpose',
    numbers: [18],
    label: '글의 목적',
    generation: 'generative',
    implemented: true,
    dbType: 'purpose',
    note:
      '한국어 답지. Claude Code 드레인이 쓴다 — 오답은 글에 나오는 소재를 쓰되 목적이 아닌 것(배경·부수 효과·반대 방향)으로 만든다. 드레인 실측 정답 최장 6.3%.',
  },
  {
    key: 'mood',
    numbers: [19],
    label: '심경·분위기',
    generation: 'generative',
    implemented: false,
    note: '서사 지문 전용. 오답이 감정 어휘라 미묘한 차이를 만들어야 한다.',
  },
  {
    key: 'claim',
    numbers: [20],
    label: "필자의 주장",
    generation: 'generative',
    implemented: true,
    dbType: 'claim',
    note:
      '한국어 답지(~해야 한다). 오답은 **글이 사실로 서술한 것을 당위로 바꾼 것**이 가장 잘 듣는다. 드레인 실측 정답 최장 6.3%.',
  },
  {
    key: 'implication',
    numbers: [21],
    label: '밑줄 함의 추론',
    generation: 'generative',
    implemented: false,
    note: '비유 표현이 있는 지문이 전제. 2018학년도 신설 이후 난도 편차가 가장 큰 유형이다.',
  },
  {
    key: 'gist',
    numbers: [22],
    label: '요지',
    generation: 'generative',
    implemented: true,
    // ⚠️ **DB 의 `type` 값은 `main_point` 다.** 여기 키(`gist`)와 다르다 —
    //   이 표는 수능 유형의 이름이고 DB 는 문항 종류의 이름이라 원래 다른 축인데,
    //   같은 것을 가리키면서 이름이 다르면 언젠가 한쪽만 고친다. 아래 `dbType` 이 다리다.
    dbType: 'main_point',
    note:
      '한국어 답지. Claude Code 드레인이 쓴다(`item-drain`). ⚠️ 첫 파일럿에서 **정답이 최장인 비율 16/16 = 100%** ' +
      '였다 — 지문을 안 읽고 가장 긴 것을 고르면 다 맞았다. 길이 균등 지침 + 적재기 양방향 가드로 6.3% 까지 내렸다.',
  },
  {
    key: 'topic',
    numbers: [23],
    label: '주제',
    generation: 'generative',
    implemented: true,
    dbType: 'topic',
    note: '영어 답지. 요지와 형식만 다르고 오답 설계 성질은 같다. 드레인 실측 — 정답 최장 6.3% · 최단 25%.',
  },
  {
    key: 'title',
    numbers: [24],
    label: '제목',
    generation: 'generative',
    implemented: true,
    dbType: 'title',
    note:
      '비유·대구를 쓴 제목이 정답인 경우가 많아 기계 생성이 특히 어렵다 — 그래서 사람이 쓰지 않고 ' +
      'Claude Code 가 지문을 읽고 쓴다. 첫 파일럿에서 길이 편향 37.5% 로 유일하게 임계를 통과한 유형이었다.',
  },
  {
    key: 'chart',
    numbers: [25],
    label: '도표',
    generation: 'external',
    implemented: false,
    note: '도표 이미지·수치가 있어야 한다. OWID 같은 데이터 소스와 붙이면 가능성이 있다.',
  },
  {
    key: 'detail_person',
    numbers: [26],
    label: '내용 일치 (인물)',
    generation: 'generative',
    implemented: true,
    dbType: 'content_match',
    note:
      '⚠️ 수능은 전기문 지문이지만 우리는 **일반 지문의 사실 일치**로 낸다 — 오답 넷은 지문에서 확인되는 사실이고 정답만 한 군데(수·방향·주체)를 비튼다. 드레인 실측 정답 최장 0%.',
  },
  {
    key: 'notice',
    numbers: [27, 28],
    label: '안내문 일치·불일치',
    generation: 'external',
    implemented: false,
    note: '실용문(행사 안내 등) 지문이 필요하다. PD 소스에 이런 글이 거의 없다.',
  },
  {
    key: 'grammar',
    numbers: [29],
    label: '어법',
    generation: 'deterministic',
    implemented: true,
    note:
      '`buildGrammarChoice` — **어법이 맞는지 판정하지 않는다.** 발행된 원문이 이미 맞으므로 ' +
      '"반드시 틀리게 만드는 교체" 만 쓰면 된다(원문 = 정답 키). 다만 원문이 이미 어긋나 있으면 ' +
      '교체가 오히려 고치므로, **원문이 표준형과 맞을 때만** 손댄다(`an hour`·`a university` 는 그래서 빠진다). ' +
      '⚠️ 우리가 만드는 것은 **한정사·지시사 수일치뿐**이다 — 관계사·분사·병렬·태는 구문 분석이 필요해 못 만든다. ' +
      '실측 수율 **580/1,565 문단 = 37.1%**(관사 67.4% · 지시사 32.6%) · 정답 번호 최다 22.9% (2026-08-21).',
  },
  {
    key: 'vocabulary',
    numbers: [30],
    label: '어휘',
    generation: 'deterministic',
    implemented: true,
    note:
      '`buildVocabChoice` — 반대말로 바꿔 놓으면 답을 안다. 다만 **문장 하나만 보면 반대말도 자연스러워** ' +
      '틀렸다는 게 안 드러난다. 그래서 **글 안에서 두 번 이상 나오는 낱말**만 바꾼다 — 나머지 자리에 ' +
      '원래 낱말이 남아 지문 안에서 모순이 보인다. 굴절형은 안 건드린다(수일치가 깨지면 어법 문항이 된다). ' +
      '실측 수율 **1,315/1,565 문단 = 84.0%** · 정답 번호 최다 비중 24.6%(고르면 20%) (2026-08-21).',
  },
  {
    key: 'blank',
    numbers: [31, 32, 33, 34],
    label: '빈칸 추론 (단어·구·절)',
    generation: 'generative',
    implemented: true,
    dbType: 'blank',
    note:
      '**수능 최고 난도이자 배점 최다(4문항).** 난이도가 전적으로 오답 매력도에서 나와 기계 생성이 가장 어렵다 — ' +
      '그래서 Claude Code 가 지문을 읽고 **요지가 걸리는 자리**에 빈칸을 뚫는다(세부 사실 자리면 앞뒤만 보고 풀린다). ' +
      '드레인 실측 — 정답 최장 0% · 최단 12.5%.',
  },
  {
    key: 'irrelevant',
    numbers: [35],
    label: '흐름 무관 문장',
    generation: 'deterministic',
    implemented: true,
    note:
      '`buildIrrelevant` — 다른 글의 문장을 끼워 넣으면 정답이 구조적으로 확정된다. ' +
      '다만 **아무 문장이나 넣으면 안 된다**: 겉모습(낱말 수)을 본문 범위에 맞추고, ' +
      '주제어 하나는 공유하되 본문 어느 문장보다 덜 붙어 있어야 한다. ' +
      '실측 수율 **45/1,565 문단 = 2.9%** (2026-08-21) — 대부분은 본문 자체의 결속이 약해 탈락한다.',
  },
  {
    key: 'order',
    numbers: [36, 37],
    label: '글의 순서',
    generation: 'deterministic',
    implemented: true,
    note: '원문 순서가 정답. DCP 가 결정론으로 생성하고 `toCsatOrder` 가 (A)(B)(C) + 5지선다로 인쇄한다.',
  },
  {
    key: 'insert',
    numbers: [38, 39],
    label: '문장 삽입',
    generation: 'deterministic',
    implemented: true,
    note: '제거한 문장의 원위치가 정답. 지문 5~9문장에서 자리 5곳을 고른다(`toCsatInsert`).',
  },
  {
    key: 'summary',
    numbers: [40],
    label: '요약문 완성',
    generation: 'generative',
    implemented: true,
    dbType: 'summary',
    note:
      '(A)(B) 짝 답지. **한쪽만 맞는 짝을 반드시 섞어야** 둘 다 읽는다. 드레인 실측 정답 최장 18.8% · 최단 18.8%(둘 다 우연 수준).',
  },
  {
    key: 'long_passage',
    numbers: [41, 42, 43, 44, 45],
    label: '장문 (제목·어휘·순서·지칭·일치)',
    generation: 'generative',
    implemented: false,
    note: '**긴 지문 하나에 여러 유형을 붙이는 묶음**이라 개별 유형이 먼저 서야 한다. 43~45 는 서사 지문이 전제.',
  },
] as const

export interface CoverageReport {
  /** 유형 수 기준. */
  types: { total: number; implemented: number; ratio: number }
  /** 문항 수 기준 — 수능 시험지에서 차지하는 비중이다. */
  questions: { total: number; implemented: number; ratio: number }
  /** 생성 방식별 — "쉬운 것부터" 를 정하는 근거. */
  byGeneration: Record<CsatGeneration, { total: number; implemented: number }>
  /** 아직 안 됐지만 **결정론으로 가능한** 유형 — 다음에 만들 것. */
  deterministicGap: CsatType[]
}

/**
 * 커버리지를 센다.
 *
 * 유형 수와 문항 수를 **둘 다** 낸다. 유형 수만 보면 빈칸(4문항)과 목적(1문항)이
 * 같은 무게가 되어, 시험지에서 차지하는 비중을 놓친다.
 */
export function measureCoverage(
  types: readonly CsatType[] = CSAT_READING_TYPES,
): CoverageReport {
  const totalQ = types.reduce((n, t) => n + t.numbers.length, 0)
  const implQ = types.filter((t) => t.implemented).reduce((n, t) => n + t.numbers.length, 0)
  const impl = types.filter((t) => t.implemented).length

  const byGeneration = { deterministic: { total: 0, implemented: 0 }, generative: { total: 0, implemented: 0 }, external: { total: 0, implemented: 0 } }
  for (const t of types) {
    byGeneration[t.generation].total++
    if (t.implemented) byGeneration[t.generation].implemented++
  }

  return {
    types: { total: types.length, implemented: impl, ratio: impl / types.length },
    questions: { total: totalQ, implemented: implQ, ratio: implQ / totalQ },
    byGeneration,
    deterministicGap: types.filter((t) => !t.implemented && t.generation === 'deterministic'),
  }
}
