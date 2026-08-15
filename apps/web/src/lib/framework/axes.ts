// apps/web/src/lib/framework/axes.ts
//
// 학습 프레임워크의 축 — Facet(무엇을 아는가) · Stage(어디까지) · Surface(어디서 고르는가).
//
// 왜 이 파일이 먼저인가:
//   지금 학습 활동의 이름·소속·의미가 **9개 내비 표면**에 각자 흩어져 있고, 같은 모듈군을
//   부르는 라벨 세트가 8종이다. 어느 화면을 먼저 고쳐도 나머지 8곳이 낡는다.
//   그래서 화면보다 **축과 이름**을 먼저 고정한다. 이 파일은 아무 화면도 바꾸지 않는다.
//
// 이름 규칙 (프로젝트 관례: docs/MODULES.md — "구조 라벨만 영문, 설명 문장은 한국어"):
//   · 축·활동·단계의 **정식명은 영문 한 단어**. 좁은 자리용 별칭 하나만 더 허용한다.
//   · 학습자에게 보이는 설명 문장은 한국어. 영문 라벨을 한국어로 번역해 두 이름을 만들지 않는다
//     ('따라읽기/따라하기' 가 같은 것을 가리키며 갈라진 것이 그 실패다).
//
// 참고: docs/LEARNING_FRAMEWORK.md (이름 결정 근거 · 흐름 설계) ·
//       docs/VOCAB_FRAMEWORK_PROPOSAL.md (조사 근거 144건)

// ── Facet — 어휘 지식의 면 ──────────────────────────────────────────
//
// Nation 의 "무엇을 아는 것이 단어를 아는 것인가" 는 9면 × 수용/생산 = 18칸이다.
// 전부 다루려는 설계는 우리 데이터로 측정할 수 없으므로 **측정 가능한 6면**으로 줄인다.
//
// 이름을 동사로 고른 이유: 학습자가 하는 일이 곧 면이므로 처방 문장이 자연스러워진다
// ("Spell 6개" 는 읽히고 "F2 6개" 는 안 읽힌다).

export type FacetId = 'recognize' | 'spell' | 'sound' | 'build' | 'use' | 'fluency'

export interface Facet {
  id: FacetId
  /** 데이터·리포트용 안정 코드 */
  code: 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6'
  /** 정식명 — 영문 한 단어 */
  name: string
  /** 학습자에게 이 면을 설명하는 한국어 한 줄 */
  says: string
  /**
   * spine — 이 면의 통과가 Stage 를 정의한다 (Recognize → Spell → Use → Fluency)
   * cross — Stage 를 정의하지 않고 폭을 넓힌다. 어느 단계에서든 할 수 있다.
   *
   * 이 구분이 "어떤 조합" 에 대한 답이다. Sound·Build 를 spine 에 넣으면
   * "발음을 모르면 문맥으로 못 간다" 는 근거 없는 게이트가 생긴다.
   */
  kind: 'spine' | 'cross'
  /**
   * 이 면이 보장하는 인출 형식. 전이 적합 처리(TAP)가 강제한다 —
   * 4지선다로 익힌 단어를 "말할 수 있다" 로 표기하는 것은 배제된다.
   */
  retrieval: string
}

export const FACETS: Record<FacetId, Facet> = {
  recognize: {
    id: 'recognize',
    code: 'F1',
    name: 'Recognize',
    says: '뜻을 보면 그 단어를 고를 수 있어요',
    kind: 'spine',
    retrieval: '후보가 있는 재인 (뜻→단어 · 단어→뜻)',
  },
  spell: {
    id: 'spell',
    code: 'F2',
    name: 'Spell',
    says: '후보 없이 직접 쓸 수 있어요',
    kind: 'spine',
    retrieval: '철자 생산 (타이핑 · 글자 조립)',
  },
  sound: {
    id: 'sound',
    code: 'F3',
    name: 'Sound',
    says: '들으면 알고, 소리 내어 말할 수 있어요',
    kind: 'cross',
    retrieval: '청각 단서 인출 · 발화 모방',
  },
  build: {
    id: 'build',
    code: 'F4',
    name: 'Build',
    says: '조각으로 나누고 다시 붙일 수 있어요',
    kind: 'cross',
    retrieval: '형태소 조립·분해',
  },
  use: {
    id: 'use',
    code: 'F5',
    name: 'Use',
    says: '문장 안에서 알맞게 쓸 수 있어요',
    kind: 'spine',
    retrieval: '문맥 인출 · 연어 판정',
  },
  fluency: {
    id: 'fluency',
    code: 'F6',
    name: 'Fluency',
    says: '생각하지 않아도 바로 나와요',
    kind: 'spine',
    retrieval: '정확 + 속도 대역',
  },
}

export const FACET_ORDER: FacetId[] = ['recognize', 'spell', 'sound', 'build', 'use', 'fluency']

/** Stage 를 정의하는 면 — 순서가 곧 깊이다. */
export const SPINE: FacetId[] = ['recognize', 'spell', 'use', 'fluency']

/** Stage 를 정의하지 않는 면 — 어느 단계에서든 할 수 있다. */
export const CROSS: FacetId[] = ['sound', 'build']

// ── Stage — 단어 하나가 어디까지 왔는가 ────────────────────────────
//
// **Stage 는 별도 상태 기계가 아니다 — 통과한 가장 깊은 spine 면에서 파생된다.**
// 두 시스템을 두면 반드시 어긋나므로 하나에서 계산한다.
//
// ⚠️ Memory state(new · risk · shaky · stable)와 혼동하지 말 것. 둘은 직교한다:
//     Memory state = "지금 기억하고 있나" (R(t) 에서 동적 계산 · DB 저장 금지)
//     Stage        = "얼마나 깊이 아나"   (통과한 면에서 파생)
//   같은 단어가 Stage=Recalled 이면서 Memory state=risk 일 수 있다 — 깊이 배웠지만
//   오래 안 봐서 흔들리는 상태다. 이 조합이 처방의 가장 값나가는 신호다.

export type StageId = 'met' | 'recognized' | 'recalled' | 'applied' | 'fluent'

export interface Stage {
  id: StageId
  /** 데이터·리포트용 안정 코드 */
  code: 'S0' | 'S1' | 'S2' | 'S3' | 'S4'
  /** 정식명 — 영문 한 단어 */
  name: string
  /** 이 단계에 도달했다는 것을 학습자에게 알리는 한국어 한 줄 */
  says: string
  /** 이 단계로 올려 주는 spine 면. met 은 노출뿐이라 없다. */
  by: FacetId | null
}

export const STAGES: Record<StageId, Stage> = {
  met: {
    id: 'met',
    code: 'S0',
    name: 'Met',
    says: '만난 적 있어요',
    by: null,
  },
  recognized: {
    id: 'recognized',
    code: 'S1',
    name: 'Recognized',
    says: '뜻을 알아봐요',
    by: 'recognize',
  },
  recalled: {
    id: 'recalled',
    code: 'S2',
    name: 'Recalled',
    says: '직접 쓸 수 있어요',
    by: 'spell',
  },
  applied: {
    id: 'applied',
    code: 'S3',
    name: 'Applied',
    says: '문장에서 써요',
    by: 'use',
  },
  fluent: {
    id: 'fluent',
    code: 'S4',
    name: 'Fluent',
    says: '바로 나와요',
    by: 'fluency',
  },
}

export const STAGE_ORDER: StageId[] = ['met', 'recognized', 'recalled', 'applied', 'fluent']

/** spine 면 → 그 면이 올려 주는 단계. */
export const STAGE_BY_FACET: Partial<Record<FacetId, StageId>> = {
  recognize: 'recognized',
  spell: 'recalled',
  use: 'applied',
  fluency: 'fluent',
}

/**
 * 통과한 면 집합에서 단계를 계산한다 — 단계를 따로 저장하지 않는 이유.
 *
 * spine 을 건너뛴 통과도 정직하게 반영한다(Use 를 통과했는데 Spell 이 비어 있으면
 * Applied 로 올린다) — 순서를 강제하는 것은 **처방**이지 계산이 아니다.
 * 계산이 게이트를 흉내 내면 "했는데 안 올라간다" 가 되고, 그건 거짓말이다.
 */
export function stageOf(passed: Iterable<FacetId>): StageId {
  const set = new Set(passed)
  let deepest: StageId = 'met'
  for (const facet of SPINE) {
    if (set.has(facet)) deepest = STAGE_BY_FACET[facet] ?? deepest
  }
  return deepest
}

/** 다음 spine 면 — 처방이 "다음 한 걸음" 을 고를 때 쓴다. 끝이면 null. */
export function nextSpine(passed: Iterable<FacetId>): FacetId | null {
  const set = new Set(passed)
  return SPINE.find((f) => !set.has(f)) ?? null
}

// ── Surface — 학습자가 무언가를 고르는 최상위 자리 ─────────────────
//
// 국외 12종 관측치: Busuu 3 · Memrise 3 · Babbel 4 · Vocabulary.com 4 · Duolingo 코어 6.
// 현재 우리는 8 표면 / 14 리프로 그 범위 밖이다.
//
// **활동(모드)은 Surface 가 아니다.** Flashcard·Game Lab 은 "어떻게 연습하는가" 이므로
// 콘텐츠를 고른 뒤의 선택지로 내려간다. 국외 선례가 강제한다 — 별도 활동 탭은
// 사용률로 정당화되지 않으면 유지된 사례가 없다(Quizlet Gravity 제거 · Duolingo Stories 탭 폐지).

export type SurfaceId = 'today' | 'library' | 'vault' | 'growth'

export interface Surface {
  id: SurfaceId
  /** 정식명 — 모바일 하단 탭에 그대로 들어가는 한 단어 */
  name: string
  /**
   * 이 표면의 진입 경로.
   *
   * 하단 탭이 이 값을 쓴다 — 탭이 자체 목록을 갖는 순간 그것이 **10번째 내비 표면**이 되고,
   * 표면을 옮길 때 여기와 탭이 갈라진다. 흡수 대상(`absorbs`)이 정리되면 이 값만 바뀐다.
   */
  href: string
  /** 이 자리에서 학습자가 하는 일 */
  says: string
  /** 지금 무엇을 흡수하는가 — 이행 시 옮겨 올 대상 */
  absorbs: string[]
}

export const SURFACES: Record<SurfaceId, Surface> = {
  today: {
    id: 'today',
    name: 'Today',
    href: '/hub',
    says: '오늘 할 것과 언제 끝나는지',
    // 처방 정본은 하나여야 한다 — 현재 7개 표면이 서로 다른 근거로 경쟁한다.
    absorbs: ['/hub 오늘', 'FlowNav 추천(mock)', "arcade Today's Experiment", '모듈 허브 TodayQueue(mock)'],
  },
  library: {
    id: 'library',
    name: 'Library',
    href: '/library',
    says: '무엇으로 공부할지 고르는 곳',
    // 콘텐츠 축 전부. 'Library' 가 큐레이션 카탈로그만 뜻했던 모호함이 여기서 사라진다.
    absorbs: ['/library (도서·Articles·Sets)', '/text (Texts)', '/comics (Book) — Vintage 는 ADR 0007 로 제거'],
  },
  vault: {
    id: 'vault',
    name: 'Vault',
    href: '/wordvault',
    says: '내 단어가 면별로 어디까지 왔는지',
    absorbs: ['/wordvault', '/my/words (redirect 껍데기)'],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    href: '/dashboard',
    says: '지나온 것과 증빙',
    absorbs: ['/dashboard', '/reports'],
  },
}

export const SURFACE_ORDER: SurfaceId[] = ['today', 'library', 'vault', 'growth']

// ── 이름 충돌 해소 (결정) ──────────────────────────────────────────
//
// 발견이 아니라 **결정**이다 — 누군가 이름을 골라야 하고, 고른 뒤에는 한 곳에서만 바꾼다.
// 각 항목의 `retire` 는 내비게이션에서 **더 이상 쓰지 않는** 표기다(코드 식별자는 별개).

export interface NameDecision {
  /** 무엇이 갈라져 있었나 */
  was: string
  /** 확정 이름들 */
  now: { name: string; means: string; where: string }[]
  retire: string[]
  why: string
}

export const NAME_DECISIONS: NameDecision[] = [
  {
    was: '따라읽기 / 따라하기',
    now: [
      { name: 'Shadow', means: '워크스페이스 안에서 본문을 따라 읽는 인라인 모드', where: '/text/[id]?mode=shadow' },
      { name: 'Echo', means: '피치를 비교해 발음을 교정하는 독립 세션 (EchoMatch)', where: '/text/[id]/echo' },
    ],
    retire: ['따라하기(=Echo 를 가리켰던 /plan 라벨)'],
    why: '두 기능이 같은 한국어 이름을 쓰고 있었고, 그중 하나는 세 번째 이름(따라하기)까지 가졌다. 둘은 손동작도 목적도 다르다 — Shadow 는 읽기 흐름 유지, Echo 는 발음 측정.',
  },
  {
    was: '스크립트 (세 가지를 가리킴)',
    now: [
      { name: 'Texts', means: '학습자가 등록한 본문', where: '/text' },
      { name: 'Articles', means: 'ACP 큐레이션 짧은 글', where: '/library/articles' },
    ],
    retire: ['My Scripts', 'Library 탭 "스크립트"', 'TextVault(/my/texts 의 또 다른 이름)'],
    why: '"스크립트" 가 내 본문 · 큐레이션 아티클 · hub 카드 세 곳에서 서로 다른 것을 가리켰다. 무엇인지로 부른다 — 내 것은 Texts, 큐레이션 짧은 글은 Articles. "Script" 는 ScriptQuiz 라는 활동 이름 안에만 남는다(그 활동은 "지금 보고 있는 본문" 을 대상으로 하므로 뜻이 어긋나지 않는다).',
  },
  {
    was: '단어장 (두 가지를 가리킴)',
    now: [
      { name: 'Vault', means: '내 단어', where: '/wordvault' },
      { name: 'Sets', means: '공용 단어장(큐레이션 세트)', where: '/library/sets' },
    ],
    retire: ['hub ModuleCard "단어장"', 'Library 탭 "공용 단어장"'],
    why: '내 것과 공용을 같은 이름으로 부르면 "내 단어장에 넣었다" 가 어느 쪽인지 알 수 없다. 세트→내 단어 승격이 프레임워크의 결합 지점이므로 두 이름이 반드시 갈려야 한다.',
  },
  {
    was: '레벨 (V-Level vs 아케이드 Lv)',
    now: [{ name: 'Level', means: 'V-Level 0–11 — 학습자에게 보이는 유일한 진행 축', where: 'DB' }],
    retire: ['아케이드 localStorage Lv', '아케이드 XP'],
    why: '진행 축을 하나만 노출한다(국외 관측 일치 — WordUp 빈도 랭크 · Duolingo CEFR · Vocabulary.com 20단계, 모두 축이 하나다). 두 개를 두면 "내 레벨" 에 두 답이 나온다.',
  },
  {
    was: 'Streak (DB vs localStorage)',
    now: [{ name: 'Streak', means: 'DB streak — 하루 유예 규칙 하나', where: 'DB' }],
    retire: ['아케이드 localStorage streak'],
    why: '"오늘 다 했나" 에 세 개의 다른 답(daily_word_goal 12 · 30 XP · 처방 60~75분)이 나오는 원인 중 하나. 통화는 하나여야 한다.',
  },
]
