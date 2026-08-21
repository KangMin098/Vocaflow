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
    implemented: false,
    note: '편지·안내문 성격의 지문이 필요하고, 오답은 "지문에 나오지만 목적이 아닌 것" 이라 설계가 필요하다.',
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
    implemented: false,
    note: '논설 지문 필요. 오답은 "일부만 맞는 진술" 이라 난이도 조절이 어렵다.',
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
    implemented: false,
    note: '한국어 답지. 오답이 "지문의 부분 진술" 이어야 해서 요약 능력과 오답 설계가 함께 필요하다.',
  },
  {
    key: 'topic',
    numbers: [23],
    label: '주제',
    generation: 'generative',
    implemented: false,
    note: '영어 답지. 요지와 형식만 다르고 오답 설계 성질은 같다.',
  },
  {
    key: 'title',
    numbers: [24],
    label: '제목',
    generation: 'generative',
    implemented: false,
    note: '비유·대구를 쓴 제목이 정답인 경우가 많아 기계 생성이 특히 어렵다.',
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
    implemented: false,
    note: '전기문 지문 필요. 오답은 "지문 사실을 한 군데 비튼 것" 이라 **결정론 생성이 가능한 편**이다.',
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
    implemented: false,
    note: '**규칙 기반이라 결정론 생성이 가능하다** — 수일치·시제·태·관계사·병렬. 오답이 문법적으로 명확히 틀리므로 모호성이 없다. 미구현이지만 만들 값이 가장 크다.',
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
    implemented: false,
    note: '**수능 최고 난도이자 배점 최다(4문항).** 난이도가 전적으로 오답 매력도에서 나와 기계 생성이 가장 어렵다.',
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
    implemented: false,
    note: '요약문을 쓰고 두 빈칸의 오답 쌍을 만들어야 한다. 빈칸 다음으로 어렵다.',
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
