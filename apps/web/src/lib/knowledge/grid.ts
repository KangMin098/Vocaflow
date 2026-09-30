// apps/web/src/lib/knowledge/grid.ts
// 원리 지도 격자 (순수) — 영역(skill) × 층. 칸 = 채택(adopted·applied) 수와 전체 수.
// 영역이 없는 항목(원리처럼 영역을 가로지르는 것)은 「공통」 열에 모인다.
import type { Layer } from './labels'

export const COMMON = '__common__'

export interface GridCell {
  total: number
  adopted: number
  /** 칸에 든 항목 slug — 칸을 누르면 여는 목록 */
  slugs: string[]
}

export interface GridInput {
  slug: string
  layer: Layer
  status: string
  skillIds: string[]
}

export function buildGrid(items: GridInput[], skillIds: string[]) {
  const columns = [...skillIds, COMMON]
  const emptyCell = (): GridCell => ({ total: 0, adopted: 0, slugs: [] })
  const emptyRow = (): Record<string, GridCell> => Object.fromEntries(columns.map((c) => [c, emptyCell()]))
  const cells: Record<Layer, Record<string, GridCell>> = {
    essence: emptyRow(),
    principle: emptyRow(),
    method: emptyRow(),
    practice: emptyRow(),
  }

  for (const it of items) {
    const cols = it.skillIds.filter((s) => skillIds.includes(s))
    for (const col of cols.length > 0 ? cols : [COMMON]) {
      const cell = cells[it.layer][col]
      cell.total += 1
      if (it.status === 'adopted' || it.status === 'applied') cell.adopted += 1
      cell.slugs.push(it.slug)
    }
  }

  /** 영역별 본질(L1) 채택이 있는가 — 지도의 첫 질문 「이 영역의 본질을 아는가」 */
  const essenceKnown = Object.fromEntries(skillIds.map((s) => [s, cells.essence[s].adopted > 0]))
  return { columns, cells, essenceKnown }
}

/**
 * 기출 원천 격자 — 시험(행) × 문항 번호(열) → 등급. 문항 ID 는 `<시험>#<번호>` (예: 2015#34 · M2209#33).
 * 한 지문을 여러 문항이 쓰면(41–42번 등) 각 문항 칸에 같은 등급을 둔다.
 */
export function buildOriginGrid<G extends string>(origins: { itemIds: string[]; grade: G }[]) {
  const cells = new Map<string, G>()
  const exams = new Set<string>()
  const numbers = new Set<number>()
  for (const o of origins) {
    for (const id of o.itemIds) {
      const m = /^(.+)#(\d+)$/.exec(id)
      if (!m) continue
      exams.add(m[1])
      numbers.add(Number(m[2]))
      cells.set(`${m[1]}#${Number(m[2])}`, o.grade)
    }
  }
  return {
    // 최근 시험이 위 — 문자열 역순이면 2026 > 2015, M 접두 모평은 뒤로 모인다
    exams: [...exams].sort((a, b) => b.localeCompare(a)),
    numbers: [...numbers].sort((a, b) => a - b),
    gradeAt: (exam: string, no: number): G | null => cells.get(`${exam}#${no}`) ?? null,
  }
}

export type CellTone = 'unknown' | 'draft' | 'known'

/** 칸의 상태 — 색만으로 전하지 않고 화면이 글자(모름/초안/채택 n)를 함께 쓴다. */
export function cellTone(cell: GridCell): CellTone {
  if (cell.total === 0) return 'unknown'
  return cell.adopted > 0 ? 'known' : 'draft'
}
