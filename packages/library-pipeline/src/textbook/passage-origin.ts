// packages/library-pipeline/src/textbook/passage-origin.ts
//
// **지문이 어디서 오는가 — 유형과는 다른 축.**
//
// ── 왜 축을 나누는가 ────────────────────────────────────────────────
// "기출", "기출변형" 은 **문항 유형이 아니다.** 기출 빈칸도 빈칸이고 창작 빈칸도 빈칸이다.
// 달라지는 것은 **지문의 출처**이고, 거기서 갈리는 것은 난이도가 아니라 **저작권과 신뢰**다.
//
//   유형 축   무엇을 묻는가 — 순서 · 삽입 · 빈칸 · 어법 …  (`csat-types` · `school-types`)
//   출처 축   지문이 어디서 왔는가 — 기출 · 기출변형 · 창작 · BYO  (이 파일)
//
// 두 축을 한 표에 뭉치면 "기출 빈칸" 과 "창작 빈칸" 이 다른 유형처럼 세어져
// 커버리지가 부풀려진다. 이 저장소는 축을 섞어 틀린 적이 여러 번 있다.
//
// ── 기출변형이 실제로 무엇인가 ──────────────────────────────────────
// 학원가의 핵심 상품이고, 방식은 셋이다:
//   ① 같은 지문 · 다른 유형   (순서로 나온 지문을 빈칸으로 다시 낸다)
//   ② 지문 일부 변형          (문장을 바꾸거나 어휘를 교체한다)
//   ③ 같은 소재 · 다른 지문   (주제만 빌리고 새로 쓴다)
//
// **①은 우리가 이미 하고 있다** — 한 글에서 순서와 삽입을 함께 뽑는다.
// ③은 `csat_korean` 생성이 하는 일이다. 즉 기출변형은 새로 만들 기능이 아니라
// **지문 출처를 바꾸면 그대로 되는 것**이다.

export type OriginKey = 'past_exam' | 'past_variant' | 'authored' | 'byo' | 'public_domain'

/** 우리가 이 출처의 지문을 쓸 수 있는가. */
export type OriginRight =
  /** 확인됨 — 지금 쓴다. */
  | 'clear'
  /** 조건부 — 이용 조건을 확인해야 한다. */
  | 'conditional'
  /** 우리가 공급할 수 없다 — 학습자·교사가 직접 넣어야 한다. */
  | 'user_supplied'
  /** 쓸 수 없다. */
  | 'blocked'

export interface PassageOrigin {
  key: OriginKey
  label: string
  right: OriginRight
  /** 이 출처로 만들 때 우리 파이프라인의 어느 부분이 쓰이는가. */
  ours: string[]
  note: string
}

export const PASSAGE_ORIGINS: readonly PassageOrigin[] = [
  {
    key: 'past_exam',
    label: '기출 (수능·모의고사 원문)',
    right: 'conditional',
    ours: [],
    note:
      '평가원·교육청이 공개하지만 이용 조건(공공누리 유형)을 건별로 확인해야 한다. ' +
      '확인 전에는 쓰지 않는다 — 이 저장소는 "라이선스는 눈으로 확인하기 전엔 가장 보수적인 값" 이 규칙이다.',
  },
  {
    key: 'past_variant',
    label: '기출 변형',
    right: 'conditional',
    ours: ['DCP (같은 글에서 순서·삽입을 함께 뽑는다 = 방식 ①)'],
    note:
      '기출 지문을 그대로 쓰고 유형만 바꾸면 **원저작물 이용**이라 기출과 같은 조건이 걸린다. ' +
      '지문까지 새로 쓰면(방식 ③) 그건 사실상 창작이고 조건이 사라진다.',
  },
  {
    key: 'authored',
    label: '창작 (사실에서 새로 씀)',
    right: 'clear',
    ours: ['csat_korean 유형 명세', 'Compose 게이트 6종', '재저작 6편(ready)'],
    note:
      '사실에는 저작권이 없다. 수능형 주제글은 시의성이 없어 48시간 보류와 독립 2계통도 면제된다 ' +
      '(게이트가 `event_occurred_at` 없으면 PASS). **조건 없이 쓸 수 있는 유일한 경로**다.',
  },
  {
    key: 'public_domain',
    label: 'PD·CC 원문',
    right: 'clear',
    ours: ['ACP 12소스 328편', 'csat_stage_catalog', 'DCP 문항 1,378'],
    note:
      '지금 교재 재고의 전부가 여기서 온다. 다만 소재가 백과·기관 보도자료·논문이라 ' +
      '수능 논설과 결이 다르다 — 형식은 맞출 수 있어도 결은 못 맞춘다.',
  },
  {
    key: 'byo',
    label: '학습자·교사 지문 (BYO)',
    right: 'user_supplied',
    ours: ['/fit (비로그인 지문 진단)', '/text/new (지문 입력)', 'class_assignments (지문 미저장)'],
    note:
      '**내신 대비의 유일한 경로**다. 본교 교과서는 출판사 저작물이라 우리가 공급할 수 없지만, ' +
      '교사·학생이 넣은 지문을 처리하는 것은 다른 문제다. 이 저장소는 지문을 저장하지 않는 구조로 만들어 뒀다.',
  },
] as const

export interface OriginReport {
  /** 조건 없이 지금 쓸 수 있는 출처. */
  usable: PassageOrigin[]
  /** 이용 조건 확인이 남은 출처 — 확인 전에는 쓰지 않는다. */
  needsCheck: PassageOrigin[]
  /** 우리가 공급할 수 없고 사용자가 넣어야 하는 출처. */
  userSupplied: PassageOrigin[]
}

export function measureOrigins(
  origins: readonly PassageOrigin[] = PASSAGE_ORIGINS,
): OriginReport {
  return {
    usable: origins.filter((o) => o.right === 'clear'),
    needsCheck: origins.filter((o) => o.right === 'conditional'),
    userSupplied: origins.filter((o) => o.right === 'user_supplied'),
  }
}
