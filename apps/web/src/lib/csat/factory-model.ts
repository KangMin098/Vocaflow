// apps/web/src/lib/csat/factory-model.ts
//
// **교재 공장 — 공정 정본.**
//
// ── 왜 이 파일이 있는가 ──────────────────────────────────────────────
// `/admin/csat` 은 "파이프라인" 으로 요청됐는데 **조회용 표 세 개**가 됐다. 표는 "지금 몇 개인가"
// 에는 답하지만 **"다음에 무엇을 돌려야 하는가"** 에는 답하지 않는다. 그래서 관리자는 화면을 보고도
// 터미널로 가서 스크립트 목록(csat 131개 · textbook 66개)을 뒤져야 했다.
//
// 시중 교재는 공정이 정해져 있다 — 기획 → 설계 → 소재 → 집필 → 해설 → 검수 → 조판. 각 공정에는
// **넘어야 통과하는 게이트**가 있고, 게이트를 못 넘으면 다음 공정으로 원고가 안 넘어간다. 그 구조를
// 화면에 그대로 옮긴 것이 이 파일이다. 공정 정의(무엇을 만드는가 · 무엇을 넘어야 하는가 · 다음 명령이
// 무엇인가)는 여기, 실측은 `factory.ts`, 그림은 화면이 맡는다.
//
// ⚠️ **못 잰 것을 0 으로 뭉개지 않는다.** 이 저장소는 이미 그 사고를 겪었다 —
//   `count ?? 0` 이 없는 테이블을 "미처리 0건" 으로 그려 관리자를 안심시켰다. 여기서는
//   `'unmeasured'` 라는 별도 상태를 두고, 화면이 "못 잼" 이라고 말하게 한다.
//
// ⚠️ **명령을 지어내지 않는다.** `nextCommands` 의 모든 명령은 저장소에 실제로 있는 파일이며,
//   `__tests__/factory-model.test.ts` 가 파일 존재를 실측으로 확인한다. 없는 명령을 적으면
//   관리자가 터미널에서 막히고, 그때부터 이 화면을 안 믿는다.

/** 공정 한 칸. 순서는 `FACTORY_STAGES` 의 배열 순서가 정본이다. */
export type StageId =
  | 'evidence'
  | 'market'
  | 'blueprint'
  | 'source'
  | 'author'
  | 'explain'
  | 'review'
  | 'press'

/**
 * 두 레인.
 *
 * · `lab`(전략 연구소) — **무엇을 만들지 정하는** 공정. 산출물은 규격·표·판정이지 문항이 아니다.
 * · `line`(생산 라인) — **정해진 규격대로 찍어 내는** 공정. 산출물이 학습자에게 간다.
 *
 * 이 둘을 한 표에 섞으면 "재고가 많다" 가 "잘 팔린다" 처럼 읽힌다. 연구소가 규격을 바꾸면
 * 라인의 재고가 통째로 낡으므로, 레인을 갈라 두면 그 인과가 화면에서 보인다.
 */
export type Lane = 'lab' | 'line'

/** 게이트 판정. `unmeasured` 는 실패가 아니라 **아직 안 잰 것**이다 — 0 과 다르다. */
export type StageStatus = 'pass' | 'short' | 'blocked' | 'unmeasured'

export interface StageCommand {
  /** 터미널에 그대로 붙여 넣을 수 있는 명령. 저장소에 실제로 있는 파일만. */
  cmd: string
  /** 왜 이걸 돌리는가 — 한 줄. */
  why: string
  /** 되돌릴 수 없는 동작인가(쓰기·삭제·외부 유료 호출). 화면이 경고를 띄운다. */
  writes?: boolean
  /** Claude Code 배치가 사람 대신 채우는 단계인가. */
  claudeCode?: boolean
}

/** 한 공정이 내놓는 계기판 눈금 하나. 분자/분모를 그대로 들고 다닌다(반올림이 숨을 자리를 없앤다). */
export interface StageGauge {
  label: string
  /** 분자. 못 쟀으면 null — 0 으로 뭉개지 않는다. */
  num: number | null
  /** 분모. 비율이 아닌 눈금(지수 등)이면 null. */
  den: number | null
  /** 화면에 붙일 단위. `'ratio'` 는 분자/분모를 그대로 적는다. */
  unit: 'ratio' | 'count' | 'index' | 'percent'
  /** 이 눈금이 넘어야 하는 값. 지수 축의 1.200 처럼. 없으면 게이트가 아니다. */
  target?: number
  /** 못 쟀으면 왜 못 쟀는지. 화면이 그 이유를 적는다. */
  unmeasuredReason?: string
}

export interface StageDef {
  id: StageId
  lane: Lane
  /** 라인 위 순번 — 1부터. 병목 판정이 이 순서를 쓴다. */
  ord: number
  /** 우리 공정 이름. */
  name: string
  /** 시중 출판사가 같은 일을 부르는 이름. 화면에 나란히 적어 "이게 그 공정" 임을 보이게 한다. */
  marketName: string
  /** 이 공정이 답하는 질문 하나. 화면 부제로 쓴다. */
  question: string
  /** 이 공정이 내놓는 것. */
  output: string
  /** 게이트 — 이걸 넘어야 다음 공정으로 원고가 넘어간다. */
  gate: string
  /** 하위 화면이 있으면 그 경로. 없으면 null(현황판 카드로만 산다). */
  href: string | null
}

/**
 * 공정 8칸.
 *
 * 시중 공정과 1:1 로 맞췄다. `evidence` 만 시장에 대응물이 애매한데, 출판사도 기출 DB 를 만들어
 * 두고 기획이 그것을 읽는다(출제경향 분석). 우리는 그 DB 를 스스로 만들므로 공정으로 세운다.
 */
export const FACTORY_STAGES: readonly StageDef[] = [
  {
    id: 'evidence',
    lane: 'lab',
    ord: 1,
    name: '기출 원천',
    marketName: '출제경향 분석',
    question: '우리가 겨냥한 시험을 실제로 아는가',
    output: '회차·유형별 기출 분석과 유형 리포트',
    gate: '사정권 배점을 덮은 회차가 늘고 있는가',
    href: '/admin/csat/evidence',
  },
  {
    id: 'market',
    lane: 'lab',
    ord: 2,
    name: '기획',
    marketName: '시장조사 · 경쟁교재 분석',
    question: '시중 교재를 이기는가, 어디서 지는가',
    output: '출판사별 우위 지수와 구속점',
    gate: '구속 출판사 지수 ≥ 1.200',
    href: '/admin/csat/strategy',
  },
  {
    id: 'blueprint',
    lane: 'lab',
    ord: 3,
    name: '설계',
    marketName: '이원목적분류표 · 목차 설계',
    question: '연령 × 수준 × 유형 칸이 규격대로 정의됐는가',
    output: '학령 사다리 7단과 단별 허용 유형',
    gate: '사다리에 끊긴 계단이 없는가',
    href: '/admin/csat/blueprint',
  },
  {
    id: 'source',
    lane: 'line',
    ord: 4,
    name: '소재',
    marketName: '지문 섭외 · 저작권 검토',
    question: '각 칸에 쓸 지문이 있는가',
    output: '단계 밴드별 지문 재고',
    gate: '게이트가 정의된 밴드에 지문이 하나라도 있는가',
    href: '/admin/csat/sourcing',
  },
  {
    id: 'author',
    lane: 'line',
    ord: 5,
    name: '집필',
    marketName: '원고 집필 (문항)',
    question: '각 칸에 문항이 있는가',
    output: '유형 × 수준 문항 재고',
    gate: '사다리 각 단이 쓰는 유형 중 재고 0인 칸이 없는가',
    href: '/admin/csat/authoring',
  },
  {
    id: 'explain',
    lane: 'line',
    ord: 6,
    name: '해설',
    marketName: '정답해설 집필',
    question: '문항마다 해설이 붙었는가',
    output: '문항별 한국어 해설',
    gate: '해설 보유율 100%',
    href: null,
  },
  {
    id: 'review',
    lane: 'line',
    ord: 7,
    name: '검수',
    marketName: '초교 · 재교 · 삼교 + 감수',
    question: '다층 검수를 통과했는가',
    output: '층별 통과 기록',
    gate: '층마다 통과율 100%',
    href: '/admin/csat/review',
  },
  {
    id: 'press',
    lane: 'line',
    ord: 8,
    name: '조판 · 발행',
    marketName: '조판 · 교정쇄 · 인쇄',
    question: '권으로 나왔는가',
    output: '조판된 권과 그 검수 기록',
    gate: '사다리 계단마다 최신 규격으로 조판된 권이 있는가',
    href: '/admin/csat/press',
  },
] as const

/** 실측이 붙은 공정 한 칸 — 화면이 받는 모양. */
export interface StageState {
  def: StageDef
  status: StageStatus
  gauges: StageGauge[]
  /** 게이트를 못 넘은 이유 한 줄. 통과했으면 null. */
  blocker: string | null
  /** 지금 이 공정에서 돌릴 것. 순서대로. */
  nextCommands: StageCommand[]
}

/**
 * 게이트 하나를 눈금으로 판정한다.
 *
 * 규칙은 셋뿐이다 — **못 쟀으면 `unmeasured`**(0 이 아니다), 분모가 0이면 아직 시작 안 한 것이라
 * `blocked`, 그 외에는 목표에 닿았으면 `pass`, 아니면 `short`.
 *
 * 여러 눈금이 붙은 공정은 **가장 나쁜 것**이 그 공정의 상태다. 평균을 내면 한 칸이 0이어도
 * 초록이 되고, 그 칸이 곧 학습자가 만나는 빈 페이지다.
 */
export function judgeGauge(g: StageGauge): StageStatus {
  if (g.num == null) return 'unmeasured'
  if (g.unit === 'index') {
    if (g.target == null) return 'pass'
    return g.num >= g.target ? 'pass' : 'short'
  }
  if (g.den == null) return g.num > 0 ? 'pass' : 'blocked'
  if (g.den === 0) return 'blocked'
  const ratio = g.num / g.den
  const target = g.target ?? 1
  if (g.num === 0) return 'blocked'
  return ratio >= target ? 'pass' : 'short'
}

const SEVERITY: Record<StageStatus, number> = { pass: 0, unmeasured: 1, short: 2, blocked: 3 }

/** 눈금 여러 개를 한 판정으로 접는다 — 가장 나쁜 것이 이긴다. */
export function judgeStage(gauges: readonly StageGauge[]): StageStatus {
  if (!gauges.length) return 'unmeasured'
  return gauges.reduce<StageStatus>(
    (worst, g) => (SEVERITY[judgeGauge(g)] > SEVERITY[worst] ? judgeGauge(g) : worst),
    'pass',
  )
}

/**
 * 병목 — **라인 순서에서 가장 앞선, 통과하지 못한 공정.**
 *
 * 뒤쪽 공정이 더 나빠 보여도 앞이 막혀 있으면 뒤를 고쳐 봐야 소용이 없다(해설이 0%인데 조판을
 * 돌리면 해설 없는 책이 나온다). 그래서 "가장 나쁜 공정" 이 아니라 **"가장 앞선 막힌 공정"** 을
 * 고른다. `unmeasured` 도 병목이다 — 재지 않은 것을 통과로 세면 그게 바로 거짓 안심이다.
 */
export function findBottleneck(stages: readonly StageState[]): StageState | null {
  return (
    [...stages]
      .sort((a, b) => a.def.ord - b.def.ord)
      .find((s) => s.status !== 'pass') ?? null
  )
}

/** 라인 전체 달성률 — 통과한 공정 / 전체 공정. 분자·분모를 그대로 화면에 적는다. */
export function lineCompletion(stages: readonly StageState[]): { passed: number; total: number } {
  return { passed: stages.filter((s) => s.status === 'pass').length, total: stages.length }
}

export const STATUS_KO: Record<StageStatus, { label: string; color: string }> = {
  pass: { label: '통과', color: '#2E7D5A' },
  short: { label: '몫 남음', color: '#B5803A' },
  blocked: { label: '막힘', color: '#9C3A30' },
  unmeasured: { label: '못 잼', color: '#8A8278' },
}
