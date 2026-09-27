// apps/web/src/lib/csat/browse.ts
//
// **전체 기출을 학습자가 직접 고르게 하는 목록 — 글자가 한 자도 없다.** (서버 전용)
//
// 지금까지 `/csat` 이 학습자에게 내준 문항은 **12개**였다. 802개가 아니라 12개다.
// 까닭은 데이터가 없어서가 아니라 «오늘의 해부» 한 갈래만 두고, 그 갈래가 요구하는
// 손질된 메타데이터(`DISSECTION_METADATA`)를 가진 문항만 통과시켰기 때문이다.
// 실측(2026-09-23):
//
//   · `csat_items_public` in_scope             **802** 문항 · 29 회차 · 26 유형
//   · 공개 분석(`csat_item_analyses` published) **802 / 802**
//   · 강의(큐 12~14개 · 평균 4분)               **792 / 802**
//   · 지문 지도(골격 + 정답 근거 앵커)           **666 / 802**
//
// 그래서 이 모듈은 **거르지 않는다.** 802개를 전부 싣고, 문항마다 «무엇까지 되는가»를
// 플래그로 달아 화면이 판단하게 한다. 못 하는 것을 숨기지 않고 **말한다** — 목록에서
// 사라진 문항은 학습자에게 「없는 문항」이 되지만, 배지가 붙은 문항은 「지금은 여기까지」다.
//
// ⚠️ 지문·선지·발문은 여기로 오지 않는다. `csat_items_public` 에 `stem` 컬럼이 있어도
//    읽지 않는다 — 학습자 쪽 원문은 기기의 PDF(reflow)에서만 온다(copyright-boundary).
// ⚠️ 모양과 규칙은 `browse-model.ts`(순수)에 있다. 화면과 회귀가 이 파일을 import 하면
//    `@/lib/supabase/server` 가 딸려 간다.

import type { SupabaseClient } from '@supabase/supabase-js'

import { examAxis, browseExamOrder, type BrowseCatalog, type BrowseExam, type BrowseItem, type BrowseType } from './browse-model'
import { lectureMeta } from './lecture/store'
import { loadItemSkeleton, skeletonExamMeta } from './skeleton'
import { ATLAS_TYPES } from './trap-atlas'
import { PAGE_SIZE } from '@/lib/supabase/paged-select'
import { createClient } from '@/lib/supabase/server'

export type { BrowseCatalog, BrowseExam, BrowseItem, BrowseType, ExamKind } from './browse-model'

/**
 * **프로세스 캐시(10분).** `session/catalog.ts` 와 같은 이유다 — 이 값은 사용자와 무관하고
 * 하루에 몇 번 바뀔까 말까인데, 홈을 열 때마다 802행을 다시 읽으면 공유 DB 가 바쁜 순간
 * 첫 화면이 초 단위로 흔들린다. 실패한 결과는 담지 않는다 — 다음 요청이 다시 읽는다.
 */
const TTL_MS = 10 * 60 * 1000
let cache: { at: number; catalog: BrowseCatalog } | null = null

export async function loadBrowseCatalog(options: { db?: SupabaseClient; fresh?: boolean } = {}): Promise<BrowseCatalog> {
  if (!options.db && !options.fresh && cache && Date.now() - cache.at < TTL_MS) return cache.catalog
  const catalog = await readBrowseCatalog(options.db)
  if (!options.db && !catalog.error) cache = { at: Date.now(), catalog }
  return catalog
}

interface Row {
  id: string
  exam_id: string
  no: number
  type_id: string | null
  points: number | null
}

async function readBrowseCatalog(client?: SupabaseClient): Promise<BrowseCatalog> {
  const labels = new Map(skeletonExamMeta().map((e) => [e.exam_id, e.label]))
  const types = new Map(ATLAS_TYPES.map((t) => [t.id, t]))

  const rows: Row[] = []
  let error: string | null = null
  try {
    // `Database` 타입에 `csat_*` 가 없다 — `learner.ts` 의 `csatDb()` 와 같은 완화(한 줄)
    const db = client ?? ((await createClient()) as unknown as SupabaseClient)
    // **커서 페이징이다 — `.range(from, …)` 를 쓰지 않는다.** 이 저장소는 OFFSET 페이징으로
    // 네 개의 명령이 죽었고(가장 큰 것 656,988행), `offset-paging-budget` 회귀가 그 수가
    // 느는 것을 막는다. `id` 는 고유하고 정렬 가능하므로 커서로 그대로 쓸 수 있다.
    for (let cursor = ''; ; ) {
      let query = db.from('csat_items_public').select('id, exam_id, no, type_id, points').eq('in_scope', true)
      if (cursor) query = query.gt('id', cursor)
      const { data, error: queryError } = await query.order('id').limit(PAGE_SIZE)
      if (queryError) throw new Error(`기출 탐색 목록 조회 실패: ${queryError.message}`)
      const page = (data ?? []) as Row[]
      rows.push(...page)
      if (page.length < PAGE_SIZE) break
      cursor = page[page.length - 1].id
    }
  } catch (e) {
    error = e instanceof Error ? e.message : '문항 목록을 읽지 못했어요'
  }

  const items: BrowseItem[] = []
  const examCount = new Map<string, number>()
  const typeCount = new Map<string, number>()
  for (const row of rows) {
    if (!row.type_id) continue
    const lecture = lectureMeta(row.id)
    const skeleton = loadItemSkeleton(row.id)
    items.push({
      id: row.id,
      exam_id: row.exam_id,
      no: row.no,
      type_id: row.type_id,
      points: row.points,
      lecture: lecture != null,
      sec: lecture?.sec ?? 0,
      map: Boolean(skeleton?.anchors.some((a) => a.id === 'answer' && a.sentences.length > 0)),
    })
    examCount.set(row.exam_id, (examCount.get(row.exam_id) ?? 0) + 1)
    typeCount.set(row.type_id, (typeCount.get(row.type_id) ?? 0) + 1)
  }

  const exams: BrowseExam[] = [...examCount]
    .map(([id, n]) => ({ id, label: labels.get(id) ?? id, ...examAxis(id), items: n }))
    .sort(browseExamOrder)

  const browseTypes: BrowseType[] = [...typeCount]
    .map(([id, n]) => ({ id, name: types.get(id)?.name ?? id, status: types.get(id)?.status ?? 'active', items: n }))
    .sort((a, b) => b.items - a.items || a.id.localeCompare(b.id))

  return { items, exams, types: browseTypes, error }
}
