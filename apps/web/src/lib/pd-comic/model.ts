// apps/web/src/lib/pd-comic/model.ts
//
// PDCP 공용 모델 — **서버·클라이언트 양쪽에서 import 되는 순수 타입/상수**.
//
// 왜 queries.ts 에서 분리했나:
//   queries.ts 는 `import 'server-only'` 로 잠겨 있다(서비스 키 경로 보호).
//   Admin 운영 콘솔은 클라이언트 컴포넌트인데 행 타입과 단계 목록이 필요했고,
//   거기서 queries.ts 를 import 하는 순간 server-only 가 클라이언트 번들 그래프로
//   딸려 들어가 빌드가 통째로 깨졌다(실측: /api/pdcp/* 전부 500).
//   → 순수 데이터만 이 파일로 내리고, queries.ts 는 이 파일을 re-export 한다.

/** 파이프라인 단계 — Admin stepper 와 CLI 단계명을 한 곳에서 맞춘다. */
export const PD_STAGES = [
  { key: 'queued', label: '대기' },
  { key: 'acquired', label: '취득' },
  { key: 'restored', label: '복원' },
  { key: 'segmented', label: '컷 분할' },
  { key: 'ocr', label: '대사 추출' },
  // 선택 단계 — 건너뛸 수 있다(ocr→review 직행이 기본). 산출물은 modern/ 에 따로 쓴다.
  { key: 'modernized', label: '현대화' },
  { key: 'review', label: '검수' },
  { key: 'published', label: '발행' },
] as const

/**
 * 단계 인덱스. `failed` 는 단계가 아니라 **상태**이므로 -1 을 돌려준다 —
 * 0(대기)으로 뭉개면 실패한 호가 stepper 에서 정상 대기처럼 보인다.
 */
export function stageIndex(status: string): number {
  return PD_STAGES.findIndex((s) => s.key === status)
}

// ── 상태 정본 (SSoT) ────────────────────────────────────────────────
//
// 왜 여기에 모으나 — **실제로 갈려서 호가 갇혔다.**
//   `/api/pdcp/modernize` 가 행을 `modernized` 로 옮겼는데, 콘솔의 드레인 대상 집합도
//   드레인 라우트의 전이표도 발행 버튼 조건도 그 값을 몰랐다. 결과: 현대화를 누른 호는
//   전진(드레인)도 후퇴(되돌리기)도 불가능했고, 탈출구는 UI 에 없는 PATCH 뿐이었다.
//   그래서 **상태·전이·액션 가용 상태를 이 파일에서만 정의하고**, UI 조건 · 드레인 전이 ·
//   발행 조건은 전부 여기서 파생시킨다. 한 곳을 고치면 세 곳이 같이 움직인다.

/** 단계가 아닌 종결 상태 — stepper 칸을 차지하지 않지만 DB 에는 실재한다(실측 archived 19행). */
export const PD_TERMINAL_STATES = [
  { key: 'archived', label: '보관' },
  // 앱은 이 값을 **쓰지 않는다**(드레인 실패는 status 를 보존하고 last_error 로만 표시).
  // DB CHECK 에 남아 있는 과거 값이라 라벨만 준비해 둔다 — 화면에 뜨면 원인부터 찾을 것.
  { key: 'failed', label: '실패' },
] as const

/** DB `pd_issues_status_chk` 와 **같은 집합**이어야 한다(2026-09-05 실측 대조). */
export const PD_STATUSES: ReadonlyArray<{ key: string; label: string }> = [
  ...PD_STAGES.map((s) => ({ key: s.key as string, label: s.label as string })),
  ...PD_TERMINAL_STATES.map((s) => ({ key: s.key as string, label: s.label as string })),
]

export const PD_STATUS_KEYS: ReadonlySet<string> = new Set(PD_STATUSES.map((s) => s.key))

/** 상태 라벨 — 모르는 값은 삼키지 않고 그대로 보여준다(조용히 사라지면 오판한다). */
export function pdStatusLabel(status: string): string {
  return PD_STATUSES.find((s) => s.key === status)?.label ?? status
}

/** 콘솔·API 가 제공하는 조작. 상태를 옮기는 것과 안 옮기는 것이 섞여 있다. */
export type PdAction =
  | 'drain'
  | 'modernize'
  | 'confirm-pd'
  | 'upload'
  | 'publish'
  | 'archive'
  | 'restore'
  | 'delete'

export interface PdTransition {
  action: PdAction
  from: string
  /** 전이 후 상태. `from` 과 같으면 "실행은 되지만 단계를 옮기지 않는다". */
  to: string
}

/**
 * 상태를 옮기는 전이 정본.
 *
 * `modernize` 가 review·modernized 에서 제자리인 이유: 현대화는 여러 번 다시 돌린다.
 * 그때마다 `modernized` 로 덮으면 검수까지 올라간 호가 **뒤로 끌려 내려간다**.
 */
export const PD_TRANSITIONS: readonly PdTransition[] = [
  // 자동 단계 — 호출 1회 = 한 단계
  { action: 'drain', from: 'queued', to: 'acquired' },
  { action: 'drain', from: 'acquired', to: 'restored' },
  { action: 'drain', from: 'restored', to: 'segmented' },
  { action: 'drain', from: 'segmented', to: 'ocr' },
  { action: 'drain', from: 'ocr', to: 'review' },
  // 현대화한 호가 갇히지 않게 하는 출구 — 실행할 스크립트는 없고 사람 검수로 넘긴다.
  { action: 'drain', from: 'modernized', to: 'review' },
  // 현대화(선택 트랙) — ocr 에서 누르면 단계가 오르고, 그 뒤로는 제자리 재실행
  { action: 'modernize', from: 'ocr', to: 'modernized' },
  { action: 'modernize', from: 'modernized', to: 'modernized' },
  { action: 'modernize', from: 'review', to: 'review' },
  // 발행 · 회수 · 복원
  { action: 'publish', from: 'review', to: 'published' },
  { action: 'archive', from: 'published', to: 'archived' },
  { action: 'restore', from: 'archived', to: 'review' },
]

/**
 * 상태를 옮기지 않는 조작이 어디서 유효한가.
 * `published` 를 뺀 이유: 발행본은 게이트를 이미 통과했고, 근거를 다시 쓰거나 지우면
 * 노출 중인 콘텐츠의 법적 진술이 조용히 바뀐다(먼저 보관으로 내린 뒤 다룬다).
 */
const PD_STATIC_ACTION_STATES: Record<'confirm-pd' | 'upload' | 'delete', readonly string[]> = {
  'confirm-pd': PD_STATUSES.map((s) => s.key).filter((k) => k !== 'published'),
  upload: ['ocr', 'modernized', 'review'],
  delete: PD_STATUSES.map((s) => s.key).filter((k) => k !== 'published'),
}

function buildActionStates(): Record<PdAction, ReadonlySet<string>> {
  const out: Record<string, Set<string>> = {}
  for (const t of PD_TRANSITIONS) (out[t.action] ??= new Set()).add(t.from)
  for (const [a, states] of Object.entries(PD_STATIC_ACTION_STATES)) out[a] = new Set(states)
  return out as Record<PdAction, ReadonlySet<string>>
}

/** 액션 → 그 액션이 유효한 상태들. **버튼 표시 조건은 전부 여기서 나온다.** */
export const PD_ACTION_STATES: Readonly<Record<PdAction, ReadonlySet<string>>> = buildActionStates()

/** 드레인 전이표 — 라우트가 이 객체를 그대로 쓴다(사본을 두면 또 갈린다). */
export const PD_DRAIN_CHAIN: Readonly<Record<string, string>> = Object.fromEntries(
  PD_TRANSITIONS.filter((t) => t.action === 'drain').map((t) => [t.from, t.to]),
)

/** 드레인 대상 상태 — 콘솔의 "대기 N건" 과 라우트의 자동 선택이 같은 집합을 본다. */
export const PD_DRAINABLE: ReadonlySet<string> = new Set(Object.keys(PD_DRAIN_CHAIN))

/** 이 상태에서 그 액션을 눌러도 되는가 (버튼 노출 조건 = API 게이트 조건). */
export function pdActionAllowed(action: PdAction, status: string): boolean {
  return PD_ACTION_STATES[action]?.has(status) ?? false
}

/**
 * 액션 후 상태. 유효하지 않으면 `null`, 제자리 전이면 `status` 그대로.
 * 호출부는 `next === status` 일 때 DB status 를 건드리지 않아도 된다.
 */
export function pdNextStatus(action: PdAction, status: string): string | null {
  return PD_TRANSITIONS.find((t) => t.action === action && t.from === status)?.to ?? null
}

export interface PdComicIssue {
  id: string
  slug: string
  title: string
  seriesTitle: string | null
  issueNo: number | null
  publishedYear: number | null
  coverUrl: string | null
  panelsTotal: number
  vLevel: number | null
  libraryBookId: string | null
  /** 유형 키 — `pd_comic_kinds.key`. 미분류(other)이거나 적재 전 호는 null. */
  kind: string | null
  kindLabel: string | null
  seriesKey: string | null
}

/**
 * 서가 한 칸 = **시리즈 하나**. 유형은 그 위 묶음이다.
 *
 * 왜 호가 아니라 시리즈가 칸인가: 발행본이 1,000권 규모로 늘면 호 단위 격자는
 * "Whiz Comics 001~102" 가 화면 두 페이지를 먹는다. 학습자가 고르는 단위는 시리즈이고,
 * 호는 시리즈 안에서 고른다.
 */
export interface PdComicShelfSeries {
  kind: string
  kindLabel: string
  kindBlurb: string | null
  kindLearnerNote: string | null
  kindSort: number
  seriesKey: string
  seriesTitle: string
  publisher: string | null
  seriesBlurb: string | null
  yearFrom: number | null
  yearTo: number | null
  issuesPublished: number
  panelsTotal: number
  coverUrl: string | null
}

/** 유형 묶음 — 서가가 실제로 그리는 단위. */
export interface PdComicShelfKind {
  kind: string
  label: string
  blurb: string | null
  learnerNote: string | null
  sort: number
  series: PdComicShelfSeries[]
  issuesPublished: number
}

/** 콘텐츠 정보 팝업 — 학습자가 "이게 뭔지" 판단할 근거 한 벌. */
export interface PdComicInfo {
  slug: string
  title: string
  issueNo: number | null
  publishedYear: number | null
  coverUrl: string | null
  panelsTotal: number
  vLevel: number | null
  libraryBookId: string | null
  seriesKey: string | null
  seriesTitle: string | null
  seriesBlurb: string | null
  publisher: string | null
  kind: string | null
  kindLabel: string | null
  kindBlurb: string | null
  kindLearnerNote: string | null
  sourceArchive: string | null
  sourceUrl: string | null
  pdBasis: string | null
  publishedAt: string | null
  bubbleCount: number
  seriesIssuesPublished: number
}

/**
 * PD 근거 토큰 — **DB CHECK(`pd_issues_basis_chk`) 와 같은 집합이어야 한다.**
 *
 * 왜 한 곳에 모으나: 저작권 근거는 틀리게 적으면 **법적 진술이 틀리는 값**이다.
 * 그리고 실제로 갈려 있었다 — `usPdHint()` 는 1930년 이전에 `term-expired` 를 내고 DB 도
 * 허용하는데, 발행 API 의 화이트리스트에는 그 토큰이 없어서 **확정이 400 으로 거부됐다**.
 * 파이프라인이 만들어 낸 값을 API 가 받지 못하는 상태였다.
 *
 * `needsEvidence` 가 계약의 핵심이다. "갱신 기록이 없다"는 **어딘가를 찾아봤다는 주장**이므로
 * 어디를 봤는지 없이는 기록될 수 없다. 연도만으로 결정되는 `term-expired` 만 예외다.
 */
export interface PdBasisSpec {
  key: string
  label: string
  /** 이 근거를 쓸 수 있는 조건 — 화면이 그대로 보여준다 */
  when: string
  /** 근거 URL 없이 확정할 수 있는가 (연도만으로 판정되는 것만 false) */
  needsEvidence: boolean
  /** 학습자에게 보여줄 한 줄 */
  learnerText: string
}

export const PD_BASES: PdBasisSpec[] = [
  {
    key: 'term-expired',
    label: '보호기간 만료',
    when: '1930년 이전 발행 — 발행연도만으로 확정된다(갱신 여부와 무관).',
    needsEvidence: false,
    learnerText: '미국 저작권 보호기간이 만료된 자료입니다',
  },
  {
    key: 'no-renewal',
    label: '갱신 기록 없음',
    when: '1930~1963 발행 — 발행 27~28년 뒤 갱신 등록이 없었음을 확인해야 한다.',
    needsEvidence: true,
    learnerText: '저작권이 갱신되지 않아 공유 자산이 된 자료입니다',
  },
  {
    key: 'explicit-license',
    label: '권리자 공개',
    when: '권리자가 퍼블릭도메인·공개 라이선스로 명시한 경우.',
    needsEvidence: true,
    learnerText: '권리자가 공개한 자료입니다',
  },
  {
    key: 'pre-1929',
    label: '(레거시) 1929년 이전',
    when: '옛 토큰. 신규 확정에는 쓰지 말고 term-expired 를 쓴다.',
    needsEvidence: false,
    learnerText: '미국 저작권 보호기간이 만료된 자료입니다',
  },
]

export const PD_BASIS_KEYS = new Set(PD_BASES.map((b) => b.key))

/**
 * **화면 선택지 정본** — 근거를 고르는 모든 select 는 이 배열만 쓴다.
 *
 * 왜 별도로 두나: `PD_BASES` 는 DB CHECK 와 같은 집합이라 레거시 토큰(`pre-1929`)까지
 * 담는다. 그것을 그대로 select 에 뿌리면 신규 확정이 레거시 값으로 기록된다.
 * 반대로 화면마다 손으로 목록을 적으면 갈린다 — 실제로 발행 패널에는 정상 토큰
 * `term-expired` 가 빠지고 레거시가 첫 옵션이었고, 기본값 `no-renewal` 은 증빙 필수인데
 * 라벨이 "(선택)" 이라 **기본 상태로 누르면 400** 이었다.
 */
export const PD_BASIS_CHOICES: PdBasisSpec[] = PD_BASES.filter((b) => !b.key.startsWith('pre-'))

/**
 * 발행연도가 정하는 기본 근거 — 1930년 이전은 갱신 여부와 무관하게 연도만으로 확정된다.
 * 두 화면(발행 패널 · PD 근거 확인)이 같은 기본값을 써야 운영자가 화면마다 다른 값을
 * 기본으로 만나지 않는다.
 */
export function defaultPdBasis(publishedYear: number | null): string {
  return publishedYear != null && publishedYear <= 1929 ? 'term-expired' : 'no-renewal'
}

export function pdBasisSpec(basis: string | null): PdBasisSpec | null {
  return basis ? (PD_BASES.find((b) => b.key === basis) ?? null) : null
}

export function pdBasisLabel(basis: string | null): string {
  return pdBasisSpec(basis)?.learnerText ?? (basis ?? '근거 확인 중')
}

/**
 * 갱신 확인 연도 — 미국 1909년법상 갱신은 **발행 27~28년째**에 등록해야 했다.
 * 1952년 발행물이면 1979~1980년 갱신 목록을 본다. 이 범위를 모르면 운영자가
 * 60년치 목록을 뒤지게 되므로, 어디를 볼지 계산해서 알려준다.
 */
export function renewalWindow(publishedYear: number | null): [number, number] | null {
  if (!publishedYear) return null
  return [publishedYear + 27, publishedYear + 28]
}

/**
 * 갱신 기록 조회처 — **만화는 Stanford 판권갱신 DB 에 없다.**
 * 그 DB 는 Class A(도서)만 담고 있고, 만화책은 정기간행물(Class B)이라
 * `Catalog of Copyright Entries` 의 정기간행물 갱신 편을 봐야 한다.
 * 잘못된 조회처를 안내하면 "찾아봤는데 없더라" 라는 **틀린 확신**을 만든다.
 */
export function renewalLookups(seriesTitle: string | null, publishedYear: number | null) {
  const w = renewalWindow(publishedYear)
  const q = encodeURIComponent(seriesTitle ?? '')
  return [
    {
      label: 'Catalog of Copyright Entries (UPenn)',
      note: w ? `${w[0]}~${w[1]}년 갱신 편 — 정기간행물(Class B)` : '갱신 편 — 정기간행물(Class B)',
      url: 'https://onlinebooks.library.upenn.edu/cce/',
    },
    {
      label: 'CCE 전문 검색 (Google Books)',
      note: seriesTitle ? `"${seriesTitle}" + renewal` : '시리즈명으로 검색',
      url: `https://www.google.com/search?q=${q}+%22catalog+of+copyright+entries%22+renewal`,
    },
    {
      label: 'Stanford 판권갱신 DB',
      note: '⚠️ 도서(Class A) 전용 — 만화는 여기 없다. 참고용',
      url: 'https://exhibits.stanford.edu/copyrightrenewals',
    },
  ]
}

export interface PdComicPanel {
  panelOrder: number
  sourcePageNo: number
  imageUrl: string
  bubbles: Array<{ text: string; box?: { x: number; y: number; w: number; h: number }; kind?: string }>
  targetVocab: string[]
}

/**
 * Admin 큐 집계 — **서버 전량 기준**. 목록(range)과 분리해 돌려주는 이유는,
 * 좁힌 목록으로 세면 상한(PostgREST 기본 1,000) 너머가 조용히 사라지기 때문이다.
 * 여기(model.ts)에 두는 이유는 queries.ts 가 `server-only` 라 클라이언트가 못 읽어서다.
 */
export interface PdAdminCounts {
  total: number
  /** 상태별 건수 */
  byStatus: Record<string, number>
  /** `last_error` 가 있는 행 — 드레인 자동 대상에서 빠진 수 */
  stuck: number
  /**
   * 드레인이 실제로 집어갈 수 있는 행 = 드레인 대상 상태 ∧ `last_error` 없음.
   * 상태별 합계에서 `stuck` 을 빼면 안 된다 — 멈춘 행이 검수·발행에도 있어서 음수가 난다.
   */
  drainablePending: number
}

export interface PdAdminList {
  rows: PdComicAdminRow[]
  /** 서버 전량 건수(목록 길이가 아니다) */
  total: number
  /** 상한에 걸려 뒷부분을 못 실었는가 */
  truncated: boolean
}

/** 스키마 미적용을 정상 상태로 구분하기 위한 래퍼. */
export interface PdResult<T> {
  /** 마이그레이션이 적용돼 조회가 실제로 수행됐는가 */
  ready: boolean
  data: T
}

export interface PdComicAdminRow extends PdComicIssue {
  status: string
  sourceAdapter: string
  sourceIdentifier: string
  sourceUrl: string | null
  pdBasis: string | null
  pdCheckedAt: string | null
  lastError: string | null
  /** 드레인 시도 횟수 — 같은 실패를 반복하는지 판단 */
  attempts: number
  publishedAt: string | null
  qc: Record<string, unknown> | null
  /** 마지막 드레인 실행 시각 — "지금 진행 중/멈춤" 라이브 판단 근거 */
  lastRunAt: string | null
  /** 테스트 모드 취득 페이지 수(NULL=전권, N=앞 N쪽만) — 테스트 이슈 식별 */
  acquirePages: number | null
  /** 현대화 트랙 상태(workDir 산출물로 판정) — 이슈별 "어디까지 현대화됐나" 한눈에. 현대화는 선형
   *  단계가 아니라 2개 선택 트랙이라 status 가 아닌 별도 필드로 둔다. queue route 가 채운다. */
  modern?: { preserve: boolean; reader: boolean; restyle: boolean }
}

/** Admin 모니터용 컷(발행 전 포함) — 콘텐츠(대사/OCR) 상태 관찰. */
export interface PdPanelAdmin {
  panelOrder: number
  sourcePageNo: number | null
  imageUrl: string | null
  bubbles: Array<{ text: string; kind?: string; confidence?: number; box?: { x: number; y: number; w: number; h: number } }>
  targetVocab: string[]
}
