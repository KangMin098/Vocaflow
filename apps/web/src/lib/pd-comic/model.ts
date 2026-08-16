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
 * PD 근거 → 학습자에게 보여줄 한국어 한 줄.
 *
 * 이걸 화면마다 적지 않는 이유: 저작권 근거는 **틀리게 적으면 법적 진술이 틀리는 문구**다.
 * 한 곳에서만 정한다. 근거가 없으면(null) 발행 게이트가 막으므로 학습자 화면에는 원래 안 뜬다 —
 * 그래도 방어적으로 문구를 둔다(게이트가 뚫렸을 때 조용히 빈칸이 되는 것보다 낫다).
 */
export const PD_BASIS_LABEL: Record<string, string> = {
  'pre-1929': '1929년 이전 발행 — 미국 저작권 보호기간 만료',
  'term-expired': '보호기간 만료',
  'no-renewal': '저작권 갱신 기록 없음 — 1964년 이전 발행물은 갱신하지 않으면 소멸',
  'explicit-license': '권리자가 명시적으로 공개한 자료',
}

export function pdBasisLabel(basis: string | null): string {
  return basis ? (PD_BASIS_LABEL[basis] ?? basis) : '근거 확인 중'
}

export interface PdComicPanel {
  panelOrder: number
  sourcePageNo: number
  imageUrl: string
  bubbles: Array<{ text: string; box?: { x: number; y: number; w: number; h: number }; kind?: string }>
  targetVocab: string[]
}

export interface PdComicProvenance {
  title: string
  seriesTitle: string | null
  issueNo: number | null
  publishedYear: number | null
  sourceArchive: string | null
  sourceUrl: string | null
  pdBasis: string | null
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
