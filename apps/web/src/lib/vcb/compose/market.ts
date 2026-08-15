// apps/web/src/lib/vcb/compose/market.ts
//
// 경쟁 루브릭 — "시중 베스트 단어장보다 요소별로 우위인가" 를 수치로 답한다.
//
// 왜 별도 루브릭인가:
//   evaluate.ts 의 7지표는 **우리 기준 내부 품질**(선언한 것을 지켰나)이다. 그것이 1.00 이어도
//   "시중 책보다 나은가" 에는 답하지 못한다. 두 질문은 다르므로 지표도 따로 둔다.
//
// 공정성 규칙 — 경쟁 상대는 **그 유형의 베스트**다:
//   빈도순 세트를 어원편(Word Power Made Easy)과 비교하면 어원 점수에서 부당하게 진다.
//   그래서 blueprint 마다 "같은 유형의 시중 대표작" 을 지정하고 그 프로필과 비교한다.
//
// 기준선의 출처(정직하게):
//   시중 책의 요소별 수치는 **관측이 아니라 그 매체가 지면에서 제공하는 것의 합의된 상한**이다.
//   (예: 인쇄 단어장은 표제어마다 발음기호를 싣는다 → pronunciation 1.00 · 개인 기지 어휘를
//   차감할 수 없다 → personalization 0.00). 실측이 아닌 값은 `assumed` 로 표시하고,
//   우리 쪽 수치만 실데이터로 계산한다. 우리 값을 후하게 주지 않는 것이 이 파일의 목적이다.

import type { CandidateWord, ComposedSet } from './types'
import { hasField, meaningIsClean as isMeaningClean } from './facets'
import { isUngroupedKey as isUngroupedGroupKey } from './organize'
import { exampleContainsHeadword } from './match'

// ── 요소 ────────────────────────────────────────────────────────────

export type ElementId =
  // 지면 책이 잘하는 것 (품질)
  | 'meaning'
  | 'example'
  | 'pronunciation'
  | 'morphology'
  | 'relations'
  | 'collocation'
  | 'mnemonic'
  | 'ordering'
  | 'pacing'
  | 'exam_evidence'
  | 'error_free'
  | 'type_fidelity'
  // 지면 책이 구조상 못 하는 것 (장점)
  | 'personalization'
  | 'adaptive_review'
  | 'content_link'
  | 'updatable'

export interface ElementDef {
  id: ElementId
  label: string
  /** 이 요소가 학습자에게 무엇을 뜻하나 */
  says: string
  /** 지면 매체가 구조상 못 하는 요소인가 (그러면 기준선은 0 이고 우리는 자동 우위) */
  print_impossible: boolean
}

export const ELEMENTS: ElementDef[] = [
  { id: 'meaning', label: '뜻 품질', says: '한국어 뜻이 정확하고 간결한가', print_impossible: false },
  { id: 'example', label: '예문 품질', says: '그 단어가 실제로 쓰인 문장이 붙어 있는가', print_impossible: false },
  { id: 'pronunciation', label: '발음 표기', says: '발음기호가 있는가', print_impossible: false },
  { id: 'morphology', label: '어원·파생', says: '조각으로 나눠 확장할 수 있는가', print_impossible: false },
  { id: 'relations', label: '유의·반의', says: '비슷한 말·반대말로 변별되는가', print_impossible: false },
  { id: 'collocation', label: '연어', says: '함께 쓰는 말이 붙어 있는가', print_impossible: false },
  { id: 'mnemonic', label: '암기 장치', says: '연상 고리가 있는가', print_impossible: false },
  { id: 'ordering', label: '목차 설계', says: '목차가 원리를 갖고 갈렸는가', print_impossible: false },
  { id: 'pacing', label: '분량 설계', says: '하루치가 소화 가능한 크기로 잘려 있는가', print_impossible: false },
  { id: 'exam_evidence', label: '시험 근거', says: '출제 근거가 데이터로 있는가', print_impossible: false },
  { id: 'error_free', label: '오류 없음', says: '중복·깨진 글자·잡음 표제어가 없는가', print_impossible: false },
  { id: 'type_fidelity', label: '유형 충실도', says: '그 유형이 약속한 것을 전 항목이 지키는가', print_impossible: false },
  {
    id: 'personalization',
    label: '개인화',
    says: '내가 이미 아는 단어를 빼 주는가',
    print_impossible: true,
  },
  {
    id: 'adaptive_review',
    label: '적응 복습',
    says: '잊을 때쯤 다시 물어보는가',
    print_impossible: true,
  },
  {
    id: 'content_link',
    label: '콘텐츠 연결',
    says: '내가 읽을 바로 그 글의 문장이 예문인가',
    print_impossible: true,
  },
  { id: 'updatable', label: '갱신 가능', says: '기준이 바뀌면 다시 뽑히는가', print_impossible: true },
]

// ── 경쟁 상대 프로필 ────────────────────────────────────────────────
//
// 값은 **그 책이 지면에서 제공하는 비율**이다. 1.00 = 표제어 전부에 있다.
// 우리 쪽에 유리하게 낮춰 잡지 않는다 — 예문·발음·뜻은 시중 베스트가 사실상 100% 다.

export interface Competitor {
  id: string
  /** 시중 대표작 — 이름을 적어야 비교가 검증 가능해진다 */
  title: string
  note: string
  profile: Partial<Record<ElementId, number>>
}

/** 지면 매체의 공통 상한 — 개인화·적응복습·콘텐츠연결·갱신은 구조상 0. */
const PRINT_FLOOR: Partial<Record<ElementId, number>> = {
  personalization: 0,
  adaptive_review: 0,
  content_link: 0,
  updatable: 0,
  // 편집자가 교열하므로 뜻·예문·발음·오류는 사실상 만점으로 잡는다 (우리에게 가장 불리한 가정).
  meaning: 1,
  example: 0.95,
  pronunciation: 1,
  error_free: 1,
  type_fidelity: 1,
}

const c = (
  id: string,
  title: string,
  note: string,
  profile: Partial<Record<ElementId, number>>,
): Competitor => ({ id, title, note, profile: { ...PRINT_FLOOR, ...profile } })

export const COMPETITORS: Competitor[] = [
  c('voca-freq', '능률 VOCA / NGSL 기반 빈출 단어장', '빈도순 표제어 + 뜻 + 예문 + 발음', {
    morphology: 0.2,
    relations: 0.4,
    collocation: 0.2,
    mnemonic: 0.1,
    ordering: 0.6,
    pacing: 0.8,
    exam_evidence: 0.2,
  }),
  c('voca-exam', '수능/토익 빈출 보카 (해커스·워드마스터류)', '기출 빈도 근거 + 시험용 배열', {
    morphology: 0.2,
    relations: 0.5,
    collocation: 0.3,
    mnemonic: 0.1,
    ordering: 0.7,
    pacing: 0.9,
    exam_evidence: 0.8,
  }),
  c('voca-etymology', 'Word Power Made Easy / 어원편 보카', '어근 챕터가 목차', {
    morphology: 1,
    relations: 0.5,
    collocation: 0.2,
    mnemonic: 0.5,
    ordering: 0.9,
    pacing: 0.7,
    exam_evidence: 0.1,
  }),
  c('voca-collocation', 'English Collocations in Use', '연어 묶음이 단위', {
    morphology: 0.2,
    relations: 0.4,
    collocation: 1,
    mnemonic: 0.1,
    ordering: 0.8,
    pacing: 0.8,
    exam_evidence: 0.1,
  }),
  c('voca-thesaurus', '유의어·반의어 대조 보카', '변별이 목적', {
    morphology: 0.2,
    relations: 1,
    collocation: 0.3,
    mnemonic: 0.1,
    ordering: 0.8,
    pacing: 0.7,
    exam_evidence: 0.2,
  }),
  c('voca-confusable', 'Confusing Words / 헷갈리는 단어', '짝 대조가 목적', {
    morphology: 0.3,
    relations: 0.7,
    collocation: 0.2,
    mnemonic: 0.3,
    ordering: 0.9,
    pacing: 0.7,
    exam_evidence: 0.2,
  }),
  c('voca-topic', '주제별 테마 보카 / 그림 사전', '장면 단위 묶음', {
    morphology: 0.1,
    relations: 0.3,
    collocation: 0.3,
    mnemonic: 0.2,
    ordering: 0.9,
    pacing: 0.8,
    exam_evidence: 0.1,
  }),
  c('voca-mnemonic', '해마학습법 / 연상 암기 보카', '연상 고리가 상품성', {
    morphology: 0.3,
    relations: 0.3,
    collocation: 0.1,
    mnemonic: 1,
    ordering: 0.6,
    pacing: 0.8,
    exam_evidence: 0.1,
  }),
  c('voca-daily', '30일 완성 / 하루 N개 보카', '분량 설계가 상품성', {
    morphology: 0.2,
    relations: 0.4,
    collocation: 0.2,
    mnemonic: 0.2,
    ordering: 0.7,
    pacing: 1,
    exam_evidence: 0.3,
  }),
  c('voca-reader', '원서 부록 단어장 (Reader companion)', '그 책 어휘 목록', {
    morphology: 0.1,
    relations: 0.2,
    collocation: 0.2,
    mnemonic: 0.1,
    ordering: 0.8,
    pacing: 0.6,
    exam_evidence: 0,
    // 부록은 책 문장을 예문으로 쓰기도 한다 — 유일하게 콘텐츠 연결을 부분 제공하는 유형.
    content_link: 0.5,
    // 원서 부록 용어집은 보통 "쪽수 + 단어 + 뜻" 이고 발음기호를 싣지 않는다.
    pronunciation: 0.3,
  }),
  c('voca-phrasal', 'Phrasal Verbs in Use / 구동사·관용어 책', '구 단위 표현 — 지면도 발음기호를 싣지 않는다', {
    morphology: 0.1,
    relations: 0.3,
    // 구동사 책의 "연어" 는 표제어 자체가 구라서 별도 연어 목록을 잘 싣지 않는다.
    collocation: 0.2,
    mnemonic: 0.05,
    ordering: 0.7,
    pacing: 0.8,
    exam_evidence: 0.3,
    // 구에는 발음기호를 싣지 않는다 → 이 유형의 지면 기준선은 낮다.
    pronunciation: 0.2,
  }),
  c('voca-polysemy', '다의어 정복 / 한 단어 여러 뜻', '뜻 개수가 목차', {
    morphology: 0.2,
    // 다의어 책의 목적은 유의어 변별이 아니라 뜻 갈래다.
    relations: 0.4,
    collocation: 0.4,
    mnemonic: 0.1,
    ordering: 0.7,
    pacing: 0.8,
    exam_evidence: 0.4,
  }),
  c('voca-phonics', '파닉스·라임 카드', '소리 규칙 묶음', {
    morphology: 0.3,
    relations: 0.2,
    collocation: 0.1,
    mnemonic: 0.3,
    ordering: 0.9,
    pacing: 0.8,
    exam_evidence: 0,
  }),
]

export const COMPETITOR_BY_ID = new Map(COMPETITORS.map((x) => [x.id, x]))

/** blueprint → 같은 유형의 시중 대표작. 없으면 범용 빈출 보카와 비교한다. */
export const BLUEPRINT_COMPETITOR: Record<string, string> = {
  'freq-tier': 'voca-freq',
  'exam-list': 'voca-exam',
  'curriculum-grade': 'voca-exam',
  'academic-awl': 'voca-freq',
  'level-band': 'voca-freq',
  'domain-specialty': 'voca-topic',
  'exam-items': 'voca-exam',
  'root-etymology': 'voca-etymology',
  'word-family': 'voca-etymology',
  'pos-focus': 'voca-freq',
  'topic-field': 'voca-topic',
  'synonym-cluster': 'voca-thesaurus',
  'antonym-pair': 'voca-thesaurus',
  confusable: 'voca-confusable',
  collocation: 'voca-collocation',
  'phrasal-idiom': 'voca-phrasal',
  polysemy: 'voca-polysemy',
  'rhyme-phonics': 'voca-phonics',
  'book-companion': 'voca-reader',
  'chapter-companion': 'voca-reader',
  'news-article': 'voca-reader',
  'script-media': 'voca-reader',
  'day-pacing': 'voca-daily',
  'mnemonic-story': 'voca-mnemonic',
  'picture-dict': 'voca-topic',
  'audio-only': 'voca-freq',
  unlock: 'voca-reader',
  recycle: 'voca-reader',
  'facet-ladder': 'voca-freq',
  'confusion-log': 'voca-confusable',
  uncovered: 'voca-freq',
}

// ── 우리 쪽 측정 (실데이터) ─────────────────────────────────────────

// 예문 포함 판정은 match.ts 가 정본이다 (선별과 평가가 같은 판정을 써야 한다).
export { exampleContainsHeadword } from './match'

const MOJIBAKE = /[�]/

// 뜻 판정은 facets.ts 가 정본이다 — 선별과 평가가 같은 규칙을 써야 한다.
export { meaningIsClean } from './facets'

const NOISE_REGISTER = new Set([
  'archaic_literary',
  'period_cultural',
  'brand',
  'abbreviation',
  'proper_noun',
])

export interface ElementScore {
  id: ElementId
  label: string
  ours: number
  baseline: number
  /** 우위(+) · 동률(0) · 열위(−) */
  delta: number
  print_impossible: boolean
  /** 이 세트에 이 요소가 **적용되는가** — 전부 구인 세트의 발음 표기처럼 판정 대상이 아닐 수 있다 */
  applicable: boolean
  note: string
}

export interface MarketScorecard {
  blueprint: string
  slug: string
  competitor: string
  competitor_title: string
  elements: ElementScore[]
  /** 기준선 미달 요소 */
  losing: ElementId[]
  /** 동률 요소 (우위는 아님) */
  tied: ElementId[]
  /**
   * **깰 수 있었는데 못 깬** 동률.
   *
   * 동률을 한 덩어리로 세면 판정이 거짓이 된다: 뜻 품질·발음 표기·오류 없음은 양쪽 다 1.00 이
   * 상한이라 "초과" 가 원리적으로 불가능하고, 개인화·콘텐츠 연결은 그 유형이 쓰지 않으면
   * 0 vs 0 (해당 없음)이다. 진짜 문제는 **상한도 아니고 해당 없음도 아닌 동률** 뿐이다.
   */
  beatable_ties: ElementId[]
  /** 전 요소 기준선 이상인가 */
  all_at_or_above: boolean
  /**
   * 목표 초과 판정 — 열위 0 이고, 남은 동률이 전부 상한(1.00) 또는 해당 없음(0 vs 0)인가.
   */
  all_above: boolean
  /** 우위 폭 평균 */
  mean_delta: number
}

const ratio = (n: number, d: number): number => (d === 0 ? 0 : n / d)

export function evaluateMarket(set: ComposedSet): MarketScorecard {
  const entries = set.entries
  const n = entries.length
  const cands = entries.map((e) => e.candidate)
  const compId = BLUEPRINT_COMPETITOR[set.recipe.blueprint] ?? 'voca-freq'
  const comp = COMPETITOR_BY_ID.get(compId)!

  const count = (pred: (c: CandidateWord) => boolean): number => cands.filter(pred).length

  // ── 품질 요소
  const meaning = ratio(count((x) => isMeaningClean(x.meaning_ko)), n)
  const example = ratio(
    count((c) => {
      const ex = c.corpus_sentence ?? c.example_en
      return !!ex && ex.trim().length > 0 && exampleContainsHeadword(c.word, ex, c.inflected_forms)
    }),
    n,
  )
  // 발음 표기 — **구(phrase)는 분모에서 뺀다.** 지면 책도 'give up' 에 발음기호를 싣지 않는다
  // (실측: 구 5,545개 중 IPA 8.3% · 단어 40,143개 중 90.5%). 구를 분모에 두면 구동사 단어장이
  // 매체 특성 때문에 지는 것이 되어 비교가 거짓이 된다.
  const needsIpa = cands.filter((x) => !/\s/.test(x.word.trim()))
  /** 전부 구인 세트에서는 발음 표기가 판정 대상이 아니다 (지면도 싣지 않는다). */
  const pronunciationApplicable = needsIpa.length > 0
  const pronunciation =
    needsIpa.length === 0
      ? // 전부 구 → 이 요소는 판정 대상이 아니다. 기준선과 같게 두어 승패에 영향을 주지 않는다.
        (COMPETITOR_BY_ID.get(compId)?.profile.pronunciation ?? 1)
      : ratio(needsIpa.filter((x) => !!x.ipa || !!x.audio_url).length, needsIpa.length)
  const morphology = ratio(count((c) => hasField(c, 'morphology')), n)
  const relations = ratio(count((c) => c.synonyms.length > 0 || c.antonyms.length > 0), n)
  const collocation = ratio(count((c) => c.collocations.length > 0), n)
  // 암기 장치 — `mnemonic_ko` 만 세면 유형 고유의 기억장치를 놓친다.
  //
  // 어원편의 기억장치는 낱말별 연상이 아니라 **어근 이야기**이고(그래서 기준선이 0.5),
  // 혼동어 책은 **대조 짝**, 파닉스는 **라임 묶음**이 그 자리를 한다. 지면 책이 그것을 자기
  // 기억장치로 세는데 우리만 안 세면 비교가 거짓이 된다. 단, 그 유형으로 조직됐을 때만 인정한다.
  const structuralHook =
    set.recipe.organize.group_by === 'root' ||
    set.recipe.organize.group_by === 'family' ||
    set.recipe.organize.group_by === 'confusable' ||
    set.recipe.organize.group_by === 'rhyme' ||
    set.recipe.present.contrast !== 'none'
  const mnemonic = structuralHook
    ? Math.max(
        ratio(count((c) => !!c.mnemonic_ko), n),
        // 구조적 기억장치는 "그 그룹에 실제로 묶인 항목" 에만 인정한다 (미분류는 제외).
        ratio(entries.filter((e) => !isUngroupedGroupKey(e.group_key)).length, n),
      )
    : ratio(count((c) => !!c.mnemonic_ko), n)

  // 목차 설계 — 그룹이 갈렸고 한 그룹이 전체를 삼키지 않는가
  const groups = set.groups
  const sizes = groups.map((g) => g.entries.length)
  const maxShare = n > 0 && sizes.length > 0 ? Math.max(...sizes) / n : 1
  const ordering =
    set.recipe.organize.group_by === 'none'
      ? // 목차 없음을 선언한 유형은 순서 자체가 설계다(해금·재등장) — 그 근거가 있으면 만점.
        set.evidence
        ? 1
        : 0.6
      : Math.min(1, (groups.length >= 2 ? 0.6 : 0.2) + (1 - Math.max(0, maxShare - 0.4)) * 0.4)

  // 분량 설계 — 페이싱이 있으면 1, 없으면 그룹 크기가 하루치로 소화 가능한가
  const pacingSpec = set.recipe.organize.pacing
  const medianGroup = sizes.length > 0 ? [...sizes].sort((a, b) => a - b)[Math.floor(sizes.length / 2)]! : n
  // 분량 설계 — 지면 책의 상한은 "하루 N개" 고정 분량이다(1.00). 우리 챕터가 한 자리에 들어가는
  // 크기(≤30)면 같은 상한에 닿는다. 그 위는 학습자별 적응 분량(`computeStudyPlan`)이 얹히지만
  // 그건 이 요소가 아니라 `adaptive_review`·`updatable` 이 이미 세는 값이므로 겹쳐 세지 않는다.
  const pacing = pacingSpec
    ? 1
    : medianGroup <= 30
      ? 1
      : medianGroup <= 60
        ? 0.7
        : medianGroup <= 120
          ? 0.5
          : 0.3

  // 시험 근거 — 출제/빈도 리스트 소속이 데이터로 있는가
  const pop = set.recipe.population
  //
  // 공식 시험·교육과정 목록 소속은 기출 데이터와 같은 등급의 근거다 — 출제 기관이 정한 목록이고
  // 우리는 그 소속을 행 단위로 들고 있다(`list_tags`). 일반 빈도 리스트(ngsl 류)는 시험 근거가
  // 아니므로 낮게 둔다.
  const EXAM_TAGS = /csat|kcurr|bsl|nawl|moel|fel|ndl|tsl/i
  const listTags = pop.kind === 'list' ? (pop.tags as string[]) : []
  const examEvidence =
    pop.kind === 'exam_items'
      ? 1
      : pop.kind === 'list'
        ? listTags.some((t) => EXAM_TAGS.test(t))
          ? 1
          : 0.8
        : ratio(count((c) => !!c.frequency_band), n) * 0.6

  // 오류 없음 — 중복·깨진 글자·잡음 register
  const seen = new Set<string>()
  let dup = 0
  for (const c of cands) {
    const k = c.word.toLowerCase()
    if (seen.has(k)) dup += 1
    seen.add(k)
  }
  const noisy = count((c) => NOISE_REGISTER.has(c.word_register ?? 'standard'))
  const broken = count((c) => MOJIBAKE.test(c.word) || MOJIBAKE.test(c.meaning_ko ?? ''))
  const errorFree = n === 0 ? 0 : Math.max(0, 1 - (dup + noisy + broken) / n)

  // 유형 충실도 — 평가기(evaluate.ts)의 blueprint_fit 을 이 축으로 재사용하지 않고,
  // 여기서는 "선언한 면의 요구 필드를 전 항목이 갖췄나" 로 본다.
  const required = set.recipe.select.filters.require_fields
  const fidelity =
    required.length === 0
      ? 1
      : ratio(count((c) => required.every((f) => hasField(c, f))), n)

  // ── 장점 요소 (지면 불가)
  const personalization = set.recipe.select.subtract_known_for ? 1 : 0
  // 모든 세트는 발행 즉시 FSRS 큐로 들어간다 (vocabularies · flushPendingSrsResults).
  const adaptiveReview = n > 0 ? 1 : 0
  const contentLink = ratio(count((c) => !!c.corpus_sentence), n)
  // 레시피가 curation_query 에 남으므로 같은 슬러그로 다시 뽑을 수 있다.
  const updatable = n > 0 ? 1 : 0

  const ourValues: Record<ElementId, { v: number; note: string }> = {
    meaning: { v: meaning, note: `뜻 정상 ${Math.round(meaning * 100)}%` },
    example: { v: example, note: `표제어가 실제로 쓰인 예문 ${Math.round(example * 100)}%` },
    pronunciation: { v: pronunciation, note: `발음기호 ${Math.round(pronunciation * 100)}%` },
    morphology: { v: morphology, note: `형태소 정보 ${Math.round(morphology * 100)}%` },
    relations: { v: relations, note: `유의/반의 ${Math.round(relations * 100)}%` },
    collocation: { v: collocation, note: `연어 ${Math.round(collocation * 100)}%` },
    mnemonic: { v: mnemonic, note: `연상 ${Math.round(mnemonic * 100)}%` },
    ordering: { v: ordering, note: `그룹 ${groups.length}개 · 최대 점유 ${Math.round(maxShare * 100)}%` },
    pacing: { v: pacing, note: pacingSpec ? `${pacingSpec.days}일 × ${pacingSpec.per_day}개` : `중위 묶음 ${medianGroup}개` },
    exam_evidence: { v: examEvidence, note: `모집단 ${pop.kind}` },
    error_free: { v: errorFree, note: `중복 ${dup} · 잡음 ${noisy} · 깨짐 ${broken}` },
    type_fidelity: { v: fidelity, note: required.length === 0 ? '요구 필드 없음' : `요구 ${required.join('·')}` },
    personalization: {
      v: personalization,
      note: personalization ? '기지 어휘 차감' : '개인화 없음 (유형상 불필요할 수 있음)',
    },
    adaptive_review: { v: adaptiveReview, note: 'FSRS 큐 연결' },
    content_link: { v: contentLink, note: `원문 문장 ${Math.round(contentLink * 100)}%` },
    updatable: { v: updatable, note: '레시피 저장 → 재생성 가능' },
  }

  const elements: ElementScore[] = ELEMENTS.map((def) => {
    const ours = ourValues[def.id].v
    const baseline = comp.profile[def.id] ?? 0
    return {
      id: def.id,
      label: def.label,
      ours,
      baseline,
      delta: ours - baseline,
      print_impossible: def.print_impossible,
      applicable: def.id === 'pronunciation' ? pronunciationApplicable : true,
      note: ourValues[def.id].note,
    }
  })

  // 부동소수 오차로 동률이 열위로 뒤집히지 않게 한다.
  const EPS = 1e-6
  const losing = elements.filter((e) => e.delta < -EPS).map((e) => e.id)
  const tiedEls = elements.filter((e) => Math.abs(e.delta) <= EPS)
  const tied = tiedEls.map((e) => e.id)
  const beatable = tiedEls.filter((e) => {
    if (!e.applicable) return false // 해당 없음 — 판정 대상이 아니다
    if (e.ours >= 1 - EPS) return false // 상한 — 더 올릴 곳이 없다
    if (e.baseline <= EPS && e.ours <= EPS) return false // 해당 없음 (0 vs 0)
    return true
  })

  return {
    blueprint: set.recipe.blueprint,
    slug: set.recipe.meta.slug,
    competitor: comp.id,
    competitor_title: comp.title,
    elements,
    losing,
    tied,
    beatable_ties: beatable.map((e) => e.id),
    all_at_or_above: losing.length === 0,
    all_above: losing.length === 0 && beatable.length === 0,
    mean_delta: elements.reduce((s, e) => s + e.delta, 0) / elements.length,
  }
}
