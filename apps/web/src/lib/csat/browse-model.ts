// apps/web/src/lib/csat/browse-model.ts
//
// **전체 기출 서가의 모양과 규칙 — 순수.** 파일도 DB 도 React 도 모른다.
//
// 로더(`browse.ts`)는 서버 전용이라 `@/lib/supabase/server` 를 끌고 온다. 모양과 규칙이
// 거기 같이 있으면 **화면과 회귀가 서버 모듈을 import 하게 된다** — 이 저장소가
// `item-slug.ts` 머리말에 적어 둔 사고가 정확히 그것이다. 그래서 갈라 둔다.

/** 수능 본시험인가, 6·9월 모의평가인가 — 학습자가 가장 먼저 가르는 축 */
export type ExamKind = 'suneung' | 'mock'

export interface BrowseItem {
  /** `2026#34` */
  id: string
  exam_id: string
  no: number
  type_id: string
  points: number | null
  /** 해설 상영(강의 큐)이 있다 */
  lecture: boolean
  /** 상영 길이(초) — 없으면 0 */
  sec: number
  /** 지문 지도가 선다(골격 + 정답 근거 앵커) */
  map: boolean
}

export interface BrowseExam {
  id: string
  label: string
  kind: ExamKind
  /** 학년도 */
  year: number
  /** 모의평가의 시행 월(6 · 9). 수능은 null */
  month: number | null
  items: number
}

export interface BrowseType {
  id: string
  name: string
  /** `retired` = 지금은 출제되지 않는 유형. 감추지 않고 **표시한다** */
  status: string
  items: number
}

export interface BrowseCatalog {
  items: BrowseItem[]
  exams: BrowseExam[]
  types: BrowseType[]
  /** 배점·목록을 못 읽었을 때의 사유 — 화면은 그래도 선다 */
  error: string | null
}

/**
 * 회차 id 에서 **종류와 학년도**를 읽는다. 이름은 읽지 않는다 — 그건 구운 골격 파일이 준다
 * (`skeletonExamMeta`). `2014A` · `2026` = 수능 · `M2606` = 2026학년도 6월 모의평가.
 */
export function examAxis(examId: string): { kind: ExamKind; year: number; month: number | null } {
  const mock = /^M(\d{2})(\d{2})$/.exec(examId)
  if (mock) return { kind: 'mock', year: 2000 + Number(mock[1]), month: Number(mock[2]) }
  const year = Number(examId.slice(0, 4))
  return { kind: 'suneung', year: Number.isFinite(year) ? year : 0, month: null }
}

/** 최근 회차가 위로. 같은 학년도면 수능 → 9월 → 6월 순(시행 역순) */
export function browseExamOrder(a: BrowseExam, b: BrowseExam): number {
  if (a.year !== b.year) return b.year - a.year
  const rank = (e: BrowseExam) => (e.kind === 'suneung' ? 99 : (e.month ?? 0))
  if (rank(a) !== rank(b)) return rank(b) - rank(a)
  return a.id.localeCompare(b.id)
}

export interface BrowseFilter {
  kind: ExamKind | 'all'
  year: number | 'all'
  type: string
  /** `lecture` = 상영 있는 것만 · `map` = 지도 있는 것만 */
  status: 'all' | 'lecture' | 'map'
  /** 유형 이름 · 회차 이름 · 번호 */
  query: string
  /** 한 회차만(회차별 경로). 'all' 이면 거르지 않는다 */
  exam?: string
  /** 이 학년도 이후만(목적별 「최근 기출부터」). 'all' 이면 거르지 않는다 */
  from?: number | 'all'
}

export const EMPTY_FILTER: BrowseFilter = { kind: 'all', year: 'all', type: 'all', status: 'all', query: '', exam: 'all', from: 'all' }

/**
 * 네 축 + 찾기. **한 축이라도 맞지 않으면 뺀다**(AND) — 축을 늘릴수록 결과가 좁아지는 것이
 * 학습자가 기대하는 동작이고, OR 로 섞으면 「모의평가를 골랐는데 수능이 나온다」가 된다.
 */
export function filterBrowse(catalog: BrowseCatalog, filter: BrowseFilter): BrowseItem[] {
  const exams = new Map(catalog.exams.map((e) => [e.id, e]))
  const names = new Map(catalog.types.map((t) => [t.id, t.name]))
  const needle = filter.query.trim().toLowerCase()
  return catalog.items.filter((i) => {
    const exam = exams.get(i.exam_id)
    if (!exam) return false
    if (filter.kind !== 'all' && exam.kind !== filter.kind) return false
    if (filter.year !== 'all' && exam.year !== filter.year) return false
    if (filter.exam && filter.exam !== 'all' && exam.id !== filter.exam) return false
    if (filter.from && filter.from !== 'all' && exam.year < filter.from) return false
    if (filter.type !== 'all' && i.type_id !== filter.type) return false
    if (filter.status === 'lecture' && !i.lecture) return false
    if (filter.status === 'map' && !i.map) return false
    if (!needle) return true
    const name = (names.get(i.type_id) ?? i.type_id).toLowerCase()
    return name.includes(needle) || exam.label.toLowerCase().includes(needle) || String(i.no) === needle
  })
}

/** 회차별로 묶어 최근 회차부터. 번호는 시험지 순서 그대로(오름차순). */
export function groupByExam(catalog: BrowseCatalog, items: BrowseItem[]): { exam: BrowseExam; items: BrowseItem[] }[] {
  const by = new Map<string, BrowseItem[]>()
  for (const i of items) by.set(i.exam_id, [...(by.get(i.exam_id) ?? []), i])
  return catalog.exams
    .filter((e) => by.has(e.id))
    .map((e) => ({ exam: e, items: [...by.get(e.id)!].sort((a, b) => a.no - b.no) }))
}
