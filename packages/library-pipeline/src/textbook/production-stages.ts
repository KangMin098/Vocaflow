// packages/library-pipeline/src/textbook/production-stages.ts
//
// **상업 교재 제작 단계 ↔ 이 파이프라인의 대응표.**
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// "상업교재 만드는 프로세스를 적용" 하려면 그 프로세스가 무엇인지 먼저 있어야 하고,
// 우리 파이프라인의 어느 단계가 그것에 대응하는지 **한 곳에** 적혀 있어야 한다.
// 적어 두지 않으면 "검수 단계가 있나요" 를 매번 코드를 뒤져 답하게 된다.
//
// ── 출처 (2026-08-21 조사) ───────────────────────────────────────────
// 교육출판 편집자 실무: 기획안 작성 → 저자 섭외·원고 의뢰 → 원고 검토 →
// 원고 교정(초교·재교·삼교) → 화면 교정·내부 검수 → 인쇄.
//   https://comento.kr/edu/learn/camp/detail-G854
//   https://www.typetak.com/ko/blog/publishing_process
//
// ⚠️ 이 표는 **시중 교재의 내용을 쓰는 것이 아니라 절차를 참고**한 것이다.
//   절차는 아이디어라 저작권 대상이 아니다. 내용을 입력으로 쓰는 것은 별개 문제이고,
//   목적이 시장 대체라면 성립하지 않는다.

export type StageState = 'done' | 'partial' | 'missing'

export interface ProductionStage {
  order: number
  /** 출판 실무에서 부르는 이름. */
  label: string
  /** 그 단계가 실제로 하는 일 — 우리가 흉내 내야 하는 것. */
  purpose: string
  state: StageState
  /** 우리 파이프라인의 대응물. `missing` 이면 빈 배열. */
  ours: string[]
  /** 무엇이 모자란가. `done` 이면 null. */
  gap: string | null
}

export const PRODUCTION_STAGES: readonly ProductionStage[] = [
  {
    order: 1,
    label: '기획',
    purpose: '대상 학년·수준·유형 구성과 단원 수를 정한다. 여기서 교재의 정체가 결정된다.',
    state: 'done',
    ours: ['article_compose_jobs (발주: track + target_v_level)', 'vocaflow_levels (학년 축 V0~11)'],
    gap: null,
  },
  {
    order: 2,
    label: '집필',
    purpose: '기획에 맞는 지문을 쓴다. 상업 교재는 저자를 섭외한다.',
    state: 'partial',
    ours: ['csat_korean 유형 명세 (130~190어 · 주제문→근거→함의)', 'PD 소스 재고 328편'],
    gap: '생성 지문의 산출 레벨이 목표보다 2~3밴드 낮게 나온다(실측 csat_korean 2건: 목표 V6·V8 → 산출 V3·V4).',
  },
  {
    order: 3,
    label: '문항 제작',
    purpose: '지문마다 유형별 문항과 답지를 만든다.',
    state: 'partial',
    ours: ['DCP 결정론 생성 (순서·삽입)', 'csat-format 수능 인쇄 변환'],
    gap: '수능 읽기 18유형 중 2유형만 생성한다. 어법·어휘·흐름무관은 결정론으로 가능한데 미구현이다.',
  },
  {
    order: 4,
    label: '원고 검토',
    purpose: '난이도·분량·오류를 본다. 페이지별 원고 양과 난이도가 적절한지 확인한다.',
    state: 'done',
    ours: ['게이트 6종 (법적 안전)', 'scorecard 자동 9항목 (분량·형식·중복·출처)', 'assessReadingLoad (길이)'],
    gap: null,
  },
  {
    order: 5,
    label: '교정 (초교·재교·삼교)',
    purpose: '오탈자·표기·일관성을 세 번 훑는다. 상업 교재 품질의 상당 부분이 여기서 나온다.',
    state: 'missing',
    ours: [],
    gap: '교정 단계가 아예 없다. 인용 잔해 필터 하나가 있을 뿐이고, 오탈자·표기 일관성·문장 부호를 보는 곳이 없다.',
  },
  {
    order: 6,
    label: '해답·해설',
    purpose: '정답과 **왜 그것이 답인지**를 쓴다. 학습자가 혼자 공부할 수 있게 하는 핵심이다.',
    state: 'partial',
    ours: [
      'explain.ts 결정론 해설 (한정사 전환 · 지시어 · 어휘 사슬 · 연결어 · 대명사)',
      '판별 규칙: 답지 5개를 같은 잣대로 재 정답이 유일 최다일 때만 해설을 쓴다',
    ],
    gap:
      '실측 커버리지 **91/1,316 = 6.9%** (2026-08-21). 나머지는 근거가 없거나(20.8%) ' +
      '오답과 동점이거나(37.8%) 오답 쪽 근거가 더 많다(34.4%) — 표면 단서만으로는 ' +
      '결속을 다 못 읽는다. 다음 레버는 **희귀어 사슬**이다(흔한 낱말의 반복은 어느 배열에서나 걸린다).',
  },
  {
    order: 7,
    label: '내부 검수',
    purpose: '인쇄 전 마지막 확인. 사람이 본다.',
    state: 'done',
    ours: ["status='ready' → 사람이 검수 → 'published'", 'csat_stage_catalog 가 published 만 노출'],
    gap: null,
  },
  {
    order: 8,
    label: '평가·개정',
    purpose: '출간 후 오류 신고와 사용 결과를 모아 다음 쇄에 반영한다.',
    state: 'missing',
    ours: [],
    gap: '피드백을 받는 곳이 없다. csat_item_attempts 테이블은 있으나 0행이라, 어느 문항이 너무 쉽거나 어려운지 알 수 없다.',
  },
] as const

export interface StageReport {
  done: number
  partial: number
  missing: number
  total: number
  /** 없는 단계 — 여기가 상업 교재와의 실제 격차다. */
  missingStages: ProductionStage[]
}

export function measureStages(
  stages: readonly ProductionStage[] = PRODUCTION_STAGES,
): StageReport {
  const count = (s: StageState): number => stages.filter((x) => x.state === s).length
  return {
    done: count('done'),
    partial: count('partial'),
    missing: count('missing'),
    total: stages.length,
    missingStages: stages.filter((x) => x.state === 'missing'),
  }
}
