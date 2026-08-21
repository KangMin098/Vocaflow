// packages/library-pipeline/src/textbook/evaluation.ts
//
// **평가 요소 정본 — "시중 교재보다 낫다" 를 말하려면 분모가 있어야 한다.**
//
// ── 분모는 어디서 왔나 (시장 조사 2026-08-21) ────────────────────────
// 교재 평가 연구가 쓰는 **4대 대범주**를 뼈대로 삼는다:
//   법령·규범 및 공정성 · 외형 및 실용성 · 교육과정의 준수 · 교육 방법 및 내용
//   (한국어 교재 평가 기준 설정 연구 — https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART002653957)
//
// 여기에 **시장이 실제로 고르는 기준**을 더한다 — 해설의 깊이(오답 분석·어휘·전략까지),
// 수준별 구성, 공식 시험 유형 반영. 그리고 학령별 관심축이 다르다(초등 읽기+말하기 병행 ·
// 중등 학교별 시험 범위 · 고등 수능 사고력).
//
// ── 판정 규칙 ────────────────────────────────────────────────────────
// **측정할 수 없는 요소는 우위라고 적지 않는다.** "우리 지문이 더 좋다" 같은 주장은
// 근거가 없으면 광고 문구다. 요소마다 `howMeasured` 를 적고, 못 재면 `unmeasured` 로 둔다.
//
// ⚠️ 그리고 **열위를 숨기지 않는다.** 이 표의 값어치는 "우리가 어디서 지고 있는지" 를
//   한 곳에서 볼 수 있다는 데 있다. 유형 커버리지와 해설이 지금 크게 진다.

/** 교재 평가 4대 대범주. */
export type EvalCategory = 'legal' | 'physical' | 'curriculum' | 'pedagogy'

export const CATEGORY_KO: Record<EvalCategory, string> = {
  legal: '법령·규범 및 공정성',
  physical: '외형 및 실용성',
  curriculum: '교육과정의 준수',
  pedagogy: '교육 방법 및 내용',
}

/** 시중 교재 대비 우리 위치. */
export type Standing =
  /** 우리가 낫다 — **측정으로 뒷받침될 때만.** */
  | 'superior'
  /** 비슷하다. */
  | 'parity'
  /** 우리가 진다. */
  | 'inferior'
  /** 우리에게 아예 없다. */
  | 'absent'
  /** 잴 방법이 없다 — 우위라고도 열위라고도 적지 않는다. */
  | 'unmeasured'

export interface EvalDimension {
  key: string
  category: EvalCategory
  label: string
  /** 시중 교재는 이 요소를 어떻게 하는가. */
  market: string
  /** 우리는 어떻게 하는가. */
  ours: string
  /** **어떻게 쟀는가.** 못 쟀으면 그렇게 적는다. */
  howMeasured: string
  standing: Standing
}

export const EVAL_DIMENSIONS: readonly EvalDimension[] = [
  // ── 법령·규범 및 공정성 ───────────────────────────────────────────
  {
    key: 'copyright',
    category: 'legal',
    label: '지문 저작권',
    market: '기출·교과서 지문을 계약이나 이용 허락으로 쓴다. 출판사 규모가 곧 진입 장벽이다.',
    ours: 'PD·CC 원문과 창작만 쓴다. 게이트 6종이 코드로 강제하고, 라이선스는 눈으로 확인 전엔 가장 보수적인 값으로 둔다.',
    howMeasured:
      '실측 — `passage-origin.ts` 출처 5종 중 조건 없이 쓸 수 있는 2종(창작·PD)만 재고에 있고, ' +
      'Compose 게이트 6종 통과가 발행 조건이라 **코드가 강제한다**(사람 약속이 아니다).',
    standing: 'superior',
  },
  {
    key: 'past_exam_access',
    category: 'legal',
    label: '기출 지문 사용',
    market: '기출을 전면에 쓴다 — 자이스토리·마더텅·기출의 미래가 그 자체로 상품이다.',
    ours: '**못 쓴다.** 공공누리 유형을 건별로 확인해야 하고 아직 확인하지 않았다.',
    howMeasured: '`passage-origin.ts` — `past_exam`·`past_variant` 는 `conditional`.',
    standing: 'inferior',
  },
  {
    key: 'bias_review',
    category: 'legal',
    label: '편향·차별 표현 심사',
    market: '검정 교과서는 한국교육과정평가원 심사를 거친다. 문제집도 편집부 감수가 있다.',
    ours: '**없다.** 게이트는 법적 안전만 보고 표현의 공정성은 보지 않는다.',
    howMeasured: '못 쟀다 — 그런 검사가 파이프라인에 없다.',
    standing: 'absent',
  },

  // ── 외형 및 실용성 ────────────────────────────────────────────────
  {
    key: 'passage_spec',
    category: 'physical',
    label: '지문 규격 일관성',
    market: '편집자가 지면에 맞춰 조정한다. 규격 준수 여부는 공개되지 않는다.',
    ours: '수능 지문 규격 90~200어를 기계가 강제하고, 규격 밖은 재고에서 뺀다.',
    howMeasured: '`item-health-report` 실측 — 교재 전용 유형(어휘·어법·흐름무관) 규격 밖 **0%**.',
    standing: 'superior',
  },
  {
    key: 'print_clean',
    category: 'physical',
    label: '인쇄 청결 (비산문 자국)',
    market: '교정 3회(초교·재교·삼교)로 사람이 잡는다.',
    ours: '`isPrintablePassage` 가 인용 잔해·용어풀이를 한 곳에서 판정한다.',
    howMeasured: '실측 — 이 필터를 넣자 어법 113문항·어휘 220문항이 오염으로 걸러졌다(16% 대).',
    standing: 'parity',
  },
  {
    key: 'answer_balance',
    category: 'physical',
    label: '정답 번호 균등',
    market: '편집 관행으로 맞추지만 **검증 결과를 공개하지 않는다.**',
    ours: '유형마다 카이제곱으로 검정하고 임계(χ²(0.05), df 4 → 9.488)를 넘으면 고친다.',
    howMeasured: '실측 — 6유형 전부 임계 아래(최대 χ²=9.3). 어휘는 52.7 → 6.3 으로 고쳤다.',
    standing: 'superior',
  },

  // ── 교육과정의 준수 ───────────────────────────────────────────────
  {
    key: 'level_ladder',
    category: 'curriculum',
    label: '학령 사다리',
    market: '5~7단으로 촘촘하다(능률·쎄듀·EBS 가 각각 전 학령을 잇는다).',
    ours: '7단. `vocaflow_levels` 의 학령 구분을 그대로 쓴다 — 눈금을 새로 만들지 않았다.',
    howMeasured: '`series-report` 실측 — 7단 전부 문항이 있다(총 8,004).',
    standing: 'parity',
  },
  {
    key: 'curriculum_vocab',
    category: 'curriculum',
    label: '교육과정 어휘 준거',
    market: '2022 개정 교육과정 기본어휘를 준거로 삼는다.',
    ours: '같은 별표를 쓴다 — `kcurr2022_1/2/0` 초등 808 · 중등 1,211 · 고등 1,006.',
    howMeasured: 'DB 실측 3,025 낱말. 초등 3종이 이 목록에서 나온다.',
    standing: 'parity',
  },
  {
    key: 'passage_leveling',
    category: 'curriculum',
    label: '지문 레벨링',
    market: '편집자 판단. **근거가 공개되지 않는다.** 시장이 돈을 내고 사는 기능이기도 하다.',
    ours: '지문마다 V-level 이 자동으로 붙고 재고가 레벨별로 집계된다.',
    howMeasured:
      '⚠️ **레벨 축 자체는 12밴드 중 V7 하나만 검증됐다**(`claude_verified`, KICE 13년, confidence 1.00). ' +
      'V6 은 0.70, 나머지 10밴드는 `in_progress` — 자동화는 우위지만 **눈금의 신뢰도는 아직 못 주장한다.**',
    standing: 'unmeasured',
  },
  {
    key: 'school_exam_fit',
    category: 'curriculum',
    label: '학교별 내신 대응',
    market: '교과서별 기출문제집(내신콘서트·백발백중)이 본문 분석까지 담당한다.',
    ours: '**못 한다.** 본교 교과서는 출판사 저작물이라 공급할 수 없고, 교사·학생이 넣는 경로(BYO)로만 성립한다.',
    howMeasured: '`school-types.ts` — `own_textbook` 필요 유형 2종이 BYO 전용.',
    standing: 'inferior',
  },

  // ── 교육 방법 및 내용 ─────────────────────────────────────────────
  {
    key: 'type_coverage',
    category: 'pedagogy',
    label: '문항 유형 커버리지',
    market: '수능 18유형을 전부 다룬다. 유형서는 그것이 상품 자체다.',
    ours: '**5/18.** 결정론으로 되는 것은 다 만들었고 남은 13은 지문을 새로 쓰거나 도표·안내문이 필요하다.',
    howMeasured: '`coverage.mjs` 실측 — 유형 5/18 · 문항 7/28.',
    standing: 'inferior',
  },
  {
    key: 'explanation',
    category: 'pedagogy',
    label: '해설',
    market: '전 문항에 해설이 붙는다. **해설의 깊이가 곧 경쟁력**이다(오답 분석·어휘·독해 전략까지).',
    ours: '**6.9%.** 근거를 못 찾으면 쓰지 않는다 — 지어낸 해설이 없는 해설보다 나쁘기 때문이다.',
    howMeasured: '`explain-probe` 실측 91/1,316. 희귀어 문턱·근거 다중화 두 실험 모두 실패했다.',
    standing: 'inferior',
  },
  {
    key: 'distractor_quality',
    category: 'pedagogy',
    label: '오답의 변별력',
    market: '편집자·검토진이 판단한다. **검증 결과를 공개하지 않는다.**',
    ours: '유형마다 "답이 하나로 갈리는가" 를 기계가 확인한다 — 무관 문장은 유일 최소, 철자는 사전 대조, 배열은 중복 낱말 배제.',
    howMeasured: '실측 — 유형별 불변식 위반 **0건**(흐름무관·어휘·어법·영작·초등 3종).',
    standing: 'superior',
  },
  {
    key: 'difficulty_data',
    category: 'pedagogy',
    label: '실사용 난이도·변별도',
    market: '판매 후 오류 신고와 사용 결과를 다음 쇄에 반영한다.',
    ours: '**관측 0행.** `csat_item_attempts` 가 비어 있어 난이도(P)·변별도(D)를 못 낸다.',
    howMeasured: '`item-health-report` — 관측 유무를 리포트 본문에 적는다(없는 것을 없다고).',
    standing: 'inferior',
  },
  {
    key: 'revision_speed',
    category: 'pedagogy',
    label: '개정 속도',
    market: '쇄 단위. 오류가 발견돼도 다음 인쇄까지 남는다.',
    ours: '규칙을 고치면 **낡은 문항을 기계가 찾아내고**(다시 만들어 대조) 재적재한다. 실측 1,425건을 한 번에 갱신했다.',
    howMeasured: '`store-new-types.mjs --prune` 실측 — 낡음 판정 + 재적재 왕복.',
    standing: 'superior',
  },
]

export interface EvalReport {
  total: number
  byStanding: Record<Standing, number>
  byCategory: Record<EvalCategory, { total: number; superior: number }>
  /** 우위 비율 — **분모는 요소 전체**다. 못 잰 것을 빼고 세면 숫자가 거짓말이 된다. */
  superiorRatio: number
  /** 지고 있는 요소 — 여기가 다음에 할 일이다. */
  losing: EvalDimension[]
}

/** 평가 요소 대조표를 낸다. */
export function measureEvaluation(
  dimensions: readonly EvalDimension[] = EVAL_DIMENSIONS,
): EvalReport {
  const byStanding: Record<Standing, number> = {
    superior: 0,
    parity: 0,
    inferior: 0,
    absent: 0,
    unmeasured: 0,
  }
  const byCategory = {
    legal: { total: 0, superior: 0 },
    physical: { total: 0, superior: 0 },
    curriculum: { total: 0, superior: 0 },
    pedagogy: { total: 0, superior: 0 },
  }
  for (const d of dimensions) {
    byStanding[d.standing]++
    byCategory[d.category].total++
    if (d.standing === 'superior') byCategory[d.category].superior++
  }
  return {
    total: dimensions.length,
    byStanding,
    byCategory,
    superiorRatio: dimensions.length ? byStanding.superior / dimensions.length : 0,
    losing: dimensions.filter((d) => d.standing === 'inferior' || d.standing === 'absent'),
  }
}
