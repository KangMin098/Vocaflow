// apps/web/src/lib/csat/heatmap.ts
//
// **① 전수 스캔 — 연도 × 유형 한 판.**
//
// ── 이 화면이 답하는 질문 ────────────────────────────────────────────
// "이 유형이 **언제부터, 얼마나 자주** 나오나." 유형 카드 26장으로는 못 답한다 —
// 카드는 총합만 말하고 **시간축이 없어서**, 2018년에 사라진 유형과 작년에 새로 는 유형이
// 같은 얼굴로 놓인다. 기출 분석에서 그 둘을 가르는 것이 첫걸음이다.
//
// ⚠️ **원문을 읽지 않는다.** `csat_items_public` 뷰만 쓴다 — 그 뷰에는 `passage`·`choices`
//   가 아예 없다. 지문이 필요 없는 화면이 지문 테이블을 읽지 않는 것이 A1 을 코드로
//   보장하는 방법이다(`learner.ts` 와 같은 규율).
//
// ⚠️ **셀은 색만으로 말하지 않는다.** 농도는 훑기용이고 값은 숫자로 함께 적는다
//   (`axes.ts` §DENSITY_STEPS). 색약 사용자가 숫자로 읽는다.

import type { SupabaseClient } from '@supabase/supabase-js'

import { pagedSelect } from '@/lib/supabase/paged-select'
import { createClient } from '@/lib/supabase/server'

/** 한 칸 — (연도 × 유형). */
export interface HeatCell {
  year: number
  typeId: string
  /** 그 해 그 유형의 문항 수. 0 이면 **그 해에 안 나왔다**(빈칸과 구별된다). */
  n: number
  /** 그중 3점 문항 수. */
  hard: number
}

export interface HeatRow {
  typeId: string
  name: string
  /** `CSAT_YEARS` 와 같은 순서·같은 길이. */
  cells: HeatCell[]
  /** 그 유형의 전체 문항 수 — 행 끝에 적는다. */
  total: number
  /** 최근 4개년(2023~) 문항 수. 0 이면 «요즘 안 나온다». */
  recent: number
}

export interface Heatmap {
  years: number[]
  rows: HeatRow[]
  /** 어느 칸이든 가장 큰 값 — 농도 척도의 분모. */
  max: number
  /** 센 문항 수 / 회차 수 — 화면이 분모를 함께 적어야 한다(브리프 E5). */
  items: number
  exams: number
  error: string | null
}

/** 최근 4개년의 시작 — `learner.ts` 와 같은 값이어야 한다. */
export const RECENT_FROM = 2023

/**
 * `M2409` 같은 모의고사 id 와 `2024...` 수능 id 에서 연도를 뽑는다.
 * `learner.ts` 의 같은 함수와 **규칙이 같아야 한다** — 갈리면 두 화면이 다른 해를 말한다.
 */
export function yearOf(examId: string): number {
  if (examId.startsWith('M')) return 2000 + Number(examId.slice(1, 3))
  return Number(examId.slice(0, 4))
}

export interface HeatInput {
  typeId: string | null
  examId: string
  hard: boolean
}

/**
 * 행렬을 짓는다 — **순수 함수.** DB 를 모른다.
 *
 * ⚠️ **유형이 없는 문항(`type_id === null`)은 세지 않는다.** 어느 행에도 못 넣는데
 *   총합에만 더하면 행 합계와 전체 합계가 어긋나고, 그 어긋남은 조용하다.
 *   대신 몇 건을 뺐는지는 호출부가 `items` 로 확인할 수 있다.
 *
 * ⚠️ **빈 행을 지우지 않는다.** 그 유형이 사정권 기출에 한 번도 없었다면 그것이야말로
 *   학습자가 알아야 할 사실이다(「준비 중」이 아니라 「안 나왔다」).
 */
export function buildHeatmap(
  items: readonly HeatInput[],
  types: readonly { id: string; name: string }[],
): Omit<Heatmap, 'error' | 'exams'> {
  const years = [...new Set(items.map((i) => yearOf(i.examId)))]
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b)

  const key = (t: string, y: number) => `${t}|${y}`
  const tally = new Map<string, { n: number; hard: number }>()
  let counted = 0
  for (const it of items) {
    if (!it.typeId) continue
    const y = yearOf(it.examId)
    if (!Number.isFinite(y)) continue
    counted += 1
    const e = tally.get(key(it.typeId, y)) ?? { n: 0, hard: 0 }
    e.n += 1
    if (it.hard) e.hard += 1
    tally.set(key(it.typeId, y), e)
  }

  let max = 0
  const rows: HeatRow[] = types.map((t) => {
    const cells = years.map<HeatCell>((y) => {
      const hit = tally.get(key(t.id, y))
      const n = hit?.n ?? 0
      if (n > max) max = n
      return { year: y, typeId: t.id, n, hard: hit?.hard ?? 0 }
    })
    return {
      typeId: t.id,
      name: t.name,
      cells,
      total: cells.reduce((s, c) => s + c.n, 0),
      recent: cells.filter((c) => c.year >= RECENT_FROM).reduce((s, c) => s + c.n, 0),
    }
  })

  // 많이 나오는 유형이 위로 — 학습자가 위에서부터 읽는다.
  rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'ko'))
  return { years, rows, max, items: counted }
}

type ItemRow = { type_id: string | null; exam_id: string; high_score: boolean | null }
type TypeRow = { id: string; name: string }

/** 화면 몫. 조회가 깨져도 화면이 서도록 `error` 를 값으로 돌려준다. */
export async function loadHeatmap(): Promise<Heatmap> {
  const empty: Heatmap = { years: [], rows: [], max: 0, items: 0, exams: 0, error: null }
  let db: SupabaseClient
  try {
    db = (await createClient()) as unknown as SupabaseClient
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : String(e) }
  }

  try {
    const [typeRes, itemRows, examRes] = await Promise.all([
      db.from('csat_types').select('id, name').eq('in_scope', true),
      // ⚠️ **페이징한다.** 802행이라 지금은 1,000 아래지만, 넘는 날 오류 없이
      //    「출제가 줄었다」로 보인다(`learner.ts` 가 같은 함정을 이미 겪었다).
      pagedSelect<ItemRow>(
        (from, to) =>
          db
            .from('csat_items_public')
            .select('type_id, exam_id, high_score')
            .eq('in_scope', true)
            .range(from, to),
        '기출 지형 문항',
      ),
      db.from('csat_exams').select('id', { count: 'exact', head: true }),
    ])
    if (typeRes.error) return { ...empty, error: typeRes.error.message }

    const built = buildHeatmap(
      itemRows.map((r) => ({ typeId: r.type_id, examId: r.exam_id, hard: r.high_score === true })),
      (typeRes.data ?? []) as TypeRow[],
    )
    return { ...built, exams: examRes.count ?? 0, error: null }
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : String(e) }
  }
}
