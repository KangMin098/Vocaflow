// apps/web/src/lib/csat/factory-plain.ts
//
// **교재 공장 — 사용자가 읽는 걸음.**
//
// ── 왜 이 파일이 있는가 (2026-09-24) ─────────────────────────────────
// `factory-model.ts` 는 공정을 **코드가 재는 단위**로 세운다(기출 원천 · 기획 · 설계 · 소재 · 집필 …
// 게이트 · 눈금 · 명령). 재는 데는 정확하지만, 화면을 처음 연 사람은 「교재 한 권이 어떻게
// 만들어지는가」를 그 목록에서 읽어 내지 못했다 — 첫 화면이 「게이트 · 청크 · 밴드 V2 · 드레인」과
// 터미널 명령으로 시작했기 때문이다.
//
// 이 파일은 같은 공정을 **재료가 책이 되는 순서**로 다시 편다. 새로 재는 것은 없다:
//   · 걸음마다 어느 실측 공정(`StageId`)을 읽는지만 적고, 상태는 그 실측에서 옮겨 온다.
//   · 기준을 세우는 연구 세 칸(기출 · 시중 비교 · 학년 계단 설계)은 재료 흐름 밖이라 **옆줄**로 뺀다.
//     재료는 그 칸을 거치지 않는다 — 한 줄에 세우면 라인이 연구에 막힌 것처럼 읽힌다(DD-74 과 같은 이유).
//
// ⚠️ 여기 문장은 화면에 **그대로** 나간다. 개발 말(`JARGON`)이 섞이면 회귀가 떨어진다.

import type { StageGauge, StageId, StageState, StageStatus } from './factory-model'
import type { TermId } from './factory-glossary'

/** 누가 움직이는 걸음인가 — 화면이 작은 표로 붙인다. */
export type Who = 'person' | 'claude' | 'auto' | 'mix'

export const WHO_KO: Record<Who, string> = {
  person: '사람이 정해요',
  claude: 'Claude 가 채워요',
  auto: '자동으로 돌아요',
  mix: '자동 + 사람 확인',
}

export type StepKey =
  | 'order'
  | 'gather'
  | 'pick'
  | 'passage'
  | 'items'
  | 'explain'
  | 'check'
  | 'publish'
  | 'after'

export interface PlainExample {
  /** 「예시 보기」 단추 옆 설명. */
  caption: string
  before: { label: string; text: string }
  after: { label: string; text: string }
}

export interface PlainStep {
  key: StepKey
  /** 걸음 번호. `after` 는 순환 칸이라 번호가 없다. */
  no: number | null
  name: string
  /** 항상 보이는 한 줄 — 「여기서는 …」. */
  says: string
  who: Who
  /** 들어오는 것 · 나가는 것 — 쉬운 말. */
  takes: string
  gives: string
  /** 사람이 결정하는 것. 없으면 자동으로 넘어간다는 뜻이 아니라 결정할 것이 없다는 뜻이다. */
  decides?: string
  href: string
  /** 이 걸음의 상태를 읽을 실측 공정. 없으면 상태를 그리지 않는다(지어내지 않는다). */
  stage?: StageId
  /** 이 걸음의 숫자로 쓸 눈금 라벨(앞부분 일치). */
  gauge?: string
  /** 지도 칸의 큰 숫자가 무엇을 센 것인지 — 쉬운 말. 없으면 숫자를 안 그린다. */
  countLabel?: string
  terms: readonly TermId[]
  example?: PlainExample
}

export const PLAIN_STEPS: readonly PlainStep[] = [
  {
    key: 'order',
    no: 1,
    name: '무엇을 만들까',
    says: '어느 시리즈의 어느 학년 책을 낼지 고르면, 그 책에 무엇이 얼마나 필요한지 계산해 줘요.',
    who: 'person',
    takes: '시리즈 하나와 학년 하나',
    gives: '그 책에 필요한 문제 수와 모자란 몫',
    decides: '어느 책을 낼지',
    href: '/admin/csat/new',
    terms: ['series', 'gradeStep', 'questionType'],
    example: {
      caption: '주문 하나가 필요한 몫으로 바뀌는 모습',
      before: { label: '고른 것', text: 'Vocaflow Reading · 고1' },
      after: {
        label: '계산된 것',
        text: '20단원 × 3문제 = 60문제가 필요해요. 이 책이 쓰는 문제 유형 11가지 중 재고가 0인 유형이 있으면 먼저 채워야 해요.',
      },
    },
  },
  {
    key: 'gather',
    countLabel: '창고에 쌓인 글감',
    no: 2,
    name: '글감 모으기',
    says: '누리집과 기관에서 영어 글을 받아 와 창고에 쌓아요. 가져오는 곳마다 사용 허락을 따로 적어요.',
    who: 'auto',
    takes: '가져오는 곳 목록',
    gives: '창고에 쌓인 글감',
    href: '/admin/csat/sources',
    stage: 'source',
    gauge: '조판 후보 원문',
    terms: ['source', 'origin', 'license'],
    example: {
      caption: '같은 곳에서 온 글도 사용 허락이 다를 수 있어요',
      before: { label: '가져오는 곳의 표시', text: 'PLOS — 「CC BY 로 공개」' },
      after: {
        label: '글마다 확인한 결과',
        text: '한 편씩 열어 보니 세 가지 사용 허락이 섞여 있었어요. 그래서 가져오는 곳이 아니라 글 한 편마다 사용 허락을 적어요.',
      },
    },
  },
  {
    key: 'pick',
    countLabel: '실어도 되는 글감 / 전체',
    no: 3,
    name: '글감 고르기',
    says: '받아 온 글감을 교재에 실어도 되는지 살펴봐요. 실어도 됨 · 아직 안 봄 · 못 씀 셋으로 나눠요.',
    who: 'mix',
    takes: '창고의 글감',
    gives: '실어도 되는 글감',
    decides: '애매한 글감을 실을지 뺄지',
    href: '/admin/csat/sources?view=eligibility',
    terms: ['eligibility', 'license', 'rewrite'],
    example: {
      caption: '사용 허락에 따라 길이 갈려요',
      before: { label: '글감', text: 'The Conversation 기사 — 사용 허락 「고쳐 쓰기 금지(ND)」' },
      after: {
        label: '판정',
        text: '원문 그대로는 교재에 못 실어요. 대신 「새로 쓰기」로 보내 내용만 가져와 처음부터 다시 써요.',
      },
    },
  },
  {
    key: 'passage',
    countLabel: '지문이 있는 학년 단계',
    no: 4,
    name: '지문 채우기',
    says: '고른 글감을 학년 단계에 맞는 길이와 낱말로 다듬어 지문으로 만들어요. 모자란 학년은 Claude 가 새로 써요.',
    who: 'claude',
    takes: '실어도 되는 글감',
    gives: '학년 단계마다 쌓인 지문',
    href: '/admin/csat/sourcing',
    stage: 'source',
    gauge: '지문으로 채우는 밴드 중 재고 보유',
    terms: ['passage', 'gradeStep', 'rewrite', 'batch'],
    example: {
      caption: '글감이 지문이 되는 모습',
      before: {
        label: '글감 (원문 문단)',
        text: 'As Dr. Kowalski told reporters in Geneva last Tuesday, this approach, which the WHO endorsed in 2019, reduced infections by 40%.',
      },
      after: {
        label: '지문 (다듬은 뒤)',
        text: 'Scientists found a simple way to stop sickness from spreading. When people used it, far fewer of them became ill.',
      },
    },
  },
  {
    key: 'items',
    countLabel: '문제가 있는 칸',
    no: 5,
    name: '문제 만들기',
    says: '지문마다 문제 유형에 맞춰 질문과 보기, 정답을 만들어요.',
    who: 'auto',
    takes: '학년 단계별 지문',
    gives: '유형 × 학년 칸마다 쌓인 문제',
    href: '/admin/csat/authoring',
    stage: 'author',
    gauge: '사다리 칸 중 재고 있음',
    terms: ['item', 'questionType', 'gradeStep'],
    example: {
      caption: '지문 하나에서 여러 유형의 문제가 나와요',
      before: { label: '지문', text: 'Scientists found a simple way to stop sickness from spreading. …' },
      after: {
        label: '문제 (주제 찾기)',
        text: '다음 글의 주제로 가장 적절한 것은?  ① 병이 퍼지는 속도  ② 병을 막는 간단한 방법  ③ …',
      },
    },
  },
  {
    key: 'explain',
    countLabel: '해설이 붙은 문제',
    no: 6,
    name: '해설 달기',
    says: '문제마다 왜 정답인지, 나머지는 왜 틀렸는지 한국어 해설을 붙여요. 해설 없는 문제는 책에 못 들어가요.',
    who: 'claude',
    takes: '해설이 없는 문제',
    gives: '해설이 붙은 문제',
    href: '/admin/csat/explain',
    stage: 'explain',
    gauge: '해설 보유',
    terms: ['explanation', 'batch', 'claudeTurn'],
  },
  {
    key: 'check',
    countLabel: '마친 확인 (네 겹 중)',
    no: 7,
    name: '확인하기',
    says: '책에 실을 문제를 네 겹으로 살펴봐요. 틀린 정답, 헷갈리는 보기, 한쪽으로 몰린 정답 번호를 찾아요.',
    who: 'mix',
    takes: '책에 실릴 문제',
    gives: '네 겹 확인을 통과한 문제',
    decides: '고칠지 뺄지',
    href: '/admin/csat/review',
    stage: 'review',
    terms: ['check', 'item'],
  },
  {
    key: 'publish',
    countLabel: '책으로 묶인 학년 계단',
    no: 8,
    name: '책으로 내기',
    says: '확인을 마친 문제를 한 권으로 묶고, 사람이 「내도 된다」를 눌러야 학습자에게 나가요.',
    who: 'person',
    takes: '확인을 통과한 문제',
    gives: '매대에 놓인 책',
    decides: '이 책을 내보낼지 (사람 결재)',
    href: '/admin/csat/press',
    stage: 'press',
    gauge: '조판된 계단',
    terms: ['printing', 'spec', 'colophon', 'approval'],
  },
  {
    key: 'after',
    countLabel: '사람 결재를 받은 책',
    no: null,
    name: '낸 뒤 살피기',
    says: '낸 책을 학습자가 고르는지 보고, 고칠지 · 더 낼지 · 접을지 정해요. 여기서 정한 것이 다음 주문이 돼요.',
    who: 'person',
    takes: '매대에 놓인 책과 학습자가 고른 기록',
    gives: '다음에 낼 책',
    decides: '고칠지 · 접을지 · 새 시리즈를 낼지',
    href: '/admin/csat/catalog',
    stage: 'operate',
    gauge: '발행 결재를 받은 권',
    terms: ['shelf', 'approval', 'series'],
  },
]

/** 재료 흐름 밖에서 **기준을 세우는** 칸. 지도 아래 옆줄로 그린다. */
export interface PlainLab {
  key: 'evidence' | 'market' | 'blueprint'
  name: string
  says: string
  href: string
  stage: StageId
}

export const PLAIN_LAB: readonly PlainLab[] = [
  {
    key: 'evidence',
    name: '기출 살펴보기',
    says: '수능·모의고사 문제를 한 문제씩 뜯어봐요. 우리 문제가 닮아야 할 본보기예요.',
    href: '/admin/csat/evidence',
    stage: 'evidence',
  },
  {
    key: 'market',
    name: '시중 교재와 견주기',
    says: '서점에서 파는 교재와 여러 기준으로 비교해 어디서 앞서고 어디서 지는지 봐요.',
    href: '/admin/csat/strategy',
    stage: 'market',
  },
  {
    key: 'blueprint',
    name: '학년 계단 설계',
    says: '어느 학년 책에 어떤 문제 유형을 넣을지 표로 정해요.',
    href: '/admin/csat/blueprint',
    stage: 'blueprint',
  },
]

/* ───────────────────────── 상태 ───────────────────────── */

export type PlainTone = 'ok' | 'piling' | 'stopped' | 'unknown'

export const PLAIN_STATUS: Record<StageStatus, { tone: PlainTone; label: string; term: TermId }> = {
  pass: { tone: 'ok', label: '순조로움', term: 'ok' },
  short: { tone: 'piling', label: '할 일 남음', term: 'piling' },
  blocked: { tone: 'stopped', label: '멈춤', term: 'stopped' },
  unmeasured: { tone: 'unknown', label: '아직 못 셈', term: 'unknown' },
}

export function stepByKey(key: StepKey): PlainStep {
  const s = PLAIN_STEPS.find((x) => x.key === key)
  if (!s) throw new Error(`걸음이 없다: ${key}`)
  return s
}

/**
 * 단계 화면이 자기 걸음을 찾는다. 소재 공정(`source`)은 걸음 둘(글감 모으기 · 지문 채우기)이
 * 나눠 읽으므로 공정 id 만으로는 못 가른다 — 화면이 경로로 부른다.
 */
export function stepByHref(pathname: string): PlainStep | null {
  const path = pathname.split('?')[0]
  return PLAIN_STEPS.find((s) => s.href.split('?')[0] === path) ?? null
}

/**
 * 공정 id 로 걸음을 찾는다. 소재 공정(`source`)은 두 걸음이 나눠 읽는데, 그 공정의 **화면**
 * (`/admin/csat/sourcing`)은 학년 단계별 지문 재고라 「지문 채우기」다.
 * 연구 칸(기출 · 기획 · 설계)은 걸음이 아니다 — `labByStage` 를 쓴다.
 */
export function stepOfStage(id: StageId): PlainStep | null {
  // 여기서 `stepByKey(…)` 로 부르지 않는다 — 제목 회귀가 그 호출을 「화면이 그 걸음을 그린다」로 읽는다.
  if (id === 'source') return PLAIN_STEPS.find((s) => s.key === 'passage') ?? null
  return PLAIN_STEPS.find((s) => s.stage === id) ?? null
}

export function labByStage(id: StageId): PlainLab | null {
  return PLAIN_LAB.find((l) => l.stage === id) ?? null
}

export function neighbours(step: PlainStep): { prev: PlainStep | null; next: PlainStep | null } {
  const i = PLAIN_STEPS.findIndex((s) => s.key === step.key)
  return {
    prev: i > 0 ? PLAIN_STEPS[i - 1]! : null,
    // 마지막 칸(낸 뒤 살피기)의 다음은 처음(무엇을 만들까)이다 — 공장은 돈다.
    next: i < PLAIN_STEPS.length - 1 ? PLAIN_STEPS[i + 1]! : PLAIN_STEPS[0]!,
  }
}

/* ───────────────────────── 숫자 ───────────────────────── */

export interface StepReading {
  step: PlainStep
  /** 실측 공정이 없는 걸음이면 null. */
  status: StageStatus | null
  gauge: StageGauge | null
}

export function readStep(
  step: PlainStep,
  stages: readonly StageState[],
  pick: PickSnapshot | null = null,
): StepReading {
  if (step.key === 'pick') {
    return {
      step,
      status: pickStatus(pick),
      gauge: {
        label: '실어도 되는 글감',
        num: pick ? pick.usable : null,
        den: pick ? pick.total : null,
        unit: 'ratio',
      },
    }
  }
  const st = step.stage ? stages.find((s) => s.def.id === step.stage) ?? null : null
  // 확인하기는 눈금이 넷(겹마다 하나)이다 — 숫자는 「넷 중 몇 겹을 마쳤나」로 접는다.
  // 한 겹이라도 못 셌으면 「아직 못 셈」이다(마친 것으로도, 안 한 것으로도 세지 않는다).
  if (step.key === 'check' && st) {
    const layers = st.gauges
    const done = layers.filter((g) => g.num != null && g.den != null && g.den > 0 && g.num >= g.den).length
    const unknown = layers.some((g) => g.num == null)
    return {
      step,
      status: st.status,
      gauge: { label: '마친 확인', num: unknown ? null : done, den: layers.length, unit: 'ratio' },
    }
  }
  const gauge =st && step.gauge ? st.gauges.find((g) => g.label.startsWith(step.gauge!)) ?? null : null
  // 소재 공정은 두 걸음이 나눠 읽는다 — 글감 모으기는 「쌓였는가」만 본다(개수 눈금).
  // 공정 전체 판정을 그대로 옮기면 「지문 채우기」의 빈 학년이 「글감 모으기」까지 멈춤으로 칠한다.
  if (st && gauge && gauge.unit === 'count') {
    return { step, status: gauge.num == null ? 'unmeasured' : gauge.num > 0 ? 'pass' : 'blocked', gauge }
  }
  return { step, status: st ? st.status : null, gauge }
}

const fmt = (n: number) => n.toLocaleString('ko-KR')

/**
 * 「글감 고르기」의 숫자 — 공정 실측이 아니라 **실어도 되는지 판정 스냅샷**에서 온다
 * (`source-eligibility-snapshot.json`, 본문을 읽어야 나오는 판정이라 요청마다 못 다시 잰다).
 */
export interface PickSnapshot {
  measuredAt: string
  total: number
  /** 책으로 묶을 때 실제로 싣는 글감. */
  usable: number
  /** 아직 판정을 안 한 글감. */
  unjudged: number
  /** 못 쓰는 글감. */
  blocked: number
}

/**
 * ⚠️ **아직 안 본 몫이 있어도 「순조로움」이다.** 이 걸음의 일은 다음 걸음이 쓸 글감을 대는 것이고,
 *   실어도 되는 글감이 있으면 뒤는 막히지 않는다. 안 본 몫(실측 2026-09-23 · 43,477편)을
 *   「할 일 남음」으로 칠하면 이 칸이 맨 위 카드를 **영원히** 차지해, 실제로 뒤를 막는 걸음
 *   (예: 해설 없는 문제)을 가린다. 안 본 몫은 숫자로 옆에 보인다 — 숨기지 않는다.
 */
export function pickStatus(p: PickSnapshot | null): StageStatus {
  if (!p) return 'unmeasured'
  return p.usable > 0 ? 'pass' : 'blocked'
}

/**
 * 눈금 하나를 쉬운 말 숫자로. **못 셌으면 「아직 못 셈」이지 0 이 아니다.**
 */
export function gaugeText(g: StageGauge | null): string | null {
  if (!g) return null
  if (g.num == null) return '아직 못 셈'
  const approx = g.approx ? '약 ' : ''
  if (g.unit === 'count') return `${approx}${fmt(g.num)}`
  if (g.unit === 'index') return g.num.toFixed(3)
  if (g.den == null) return `${approx}${fmt(g.num)}`
  return `${approx}${fmt(g.num)} / ${fmt(g.den)}`
}

/* ───────────────────────── 가장 먼저 할 일 ───────────────────────── */

export interface FirstThing {
  step: PlainStep
  status: StageStatus
  /** 한 줄 — 무엇이 몇 개, 그래서 무엇을. */
  text: string
}

/** 걸음별 「지금 할 일」 문장. 눈금 숫자로 만든다 — 공정의 기술 문장(blocker)을 그대로 옮기지 않는다. */
export function todoText(r: StepReading, stages: readonly StageState[]): string {
  const st = r.step.stage ? stages.find((s) => s.def.id === r.step.stage) : undefined
  const g = r.gauge
  if (r.status === 'unmeasured') return `${r.step.name}의 숫자를 아직 못 셌어요 — 세는 방법부터 확인해야 해요.`
  const left = g && g.num != null && g.den != null ? g.den - g.num : null
  switch (r.step.key) {
    case 'pick':
      return '실어도 되는 글감이 한 편도 없어요 — 판정을 돌리거나 새 글감을 받아 와야 해요.'
    case 'gather':
      return '창고에 글감이 없어요 — 가져오는 곳에서 글을 받아 와야 해요.'
    case 'passage':
      return left
        ? `지문이 한 편도 없는 학년 단계가 ${fmt(left)}곳 있어요 — 그 학년 책은 지금 못 만들어요.`
        : '모든 학년 단계에 지문이 있어요.'
    case 'items':
      return left
        ? `문제가 0개인 칸이 ${fmt(left)}곳 있어요 — 그 유형을 쓰는 책은 채워질 때까지 못 묶어요.`
        : '책이 쓰는 모든 칸에 문제가 있어요.'
    case 'explain':
      return left
        ? `해설이 없는 문제가 ${fmt(left)}개 있어요 — 이대로 책을 묶으면 해설 빠진 쪽이 생겨요.`
        : '모든 문제에 해설이 있어요.'
    case 'check': {
      const open = (st?.gauges ?? []).filter((x) => x.num == null || (x.den != null && x.num < x.den))
      return open.length
        ? `네 겹 확인 중 ${open.length}겹이 아직 다 끝나지 않았어요 — 한 겹이라도 비면 확인을 받은 책이 아니에요.`
        : '네 겹 확인을 모두 마쳤어요.'
    }
    case 'publish': {
      const spec = st?.gauges.find((x) => x.label.startsWith('최신 규격'))
      const old = spec && spec.num != null && spec.den != null ? spec.den - spec.num : null
      if (left) return `학년 계단 ${fmt(g!.den!)}칸 중 ${fmt(left)}칸이 아직 책으로 안 묶였어요.`
      if (old) return `책 ${fmt(old)}권이 예전 책 규격으로 묶여 있어요 — 다시 묶어야 지금 모습의 책이 돼요.`
      return '모든 학년 계단이 지금 규격의 책으로 묶였어요.'
    }
    case 'after':
      return left
        ? `매대에 나간 책 ${fmt(g!.den!)}권 중 ${fmt(left)}권이 사람 결재 없이 나가 있어요 — 한 권씩 확인하고 결재해 주세요.`
        : '나간 책이 모두 사람 결재를 받았어요.'
    default:
      return st?.blocker ?? `${r.step.name}에 남은 일이 있어요.`
  }
}

/**
 * 지도 맨 위 카드 한 장 — **재료 흐름에서 가장 앞선, 순조롭지 않은 걸음.**
 *
 * 가장 나쁜 곳이 아니라 가장 앞선 곳을 고른다(`findBottleneck` 과 같은 이유 — 앞이 막혔는데 뒤를
 * 고치면 헛일이다). 순환 칸(낸 뒤 살피기)은 마지막에 본다. 다 순조로우면 null.
 */
export function firstThing(
  stages: readonly StageState[],
  pick: PickSnapshot | null = null,
): FirstThing | null {
  for (const step of PLAIN_STEPS) {
    const r = readStep(step, stages, pick)
    if (r.status == null || r.status === 'pass') continue
    return { step, status: r.status, text: todoText(r, stages) }
  }
  return null
}
