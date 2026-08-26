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
