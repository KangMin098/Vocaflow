// apps/web/src/lib/csat/session/catalog.ts
//
// **세션이 고를 수 있는 문항 목록 — 글자가 한 자도 없다.** (서버 전용)
//
// 후보는 **골격이 구워진 문항**이다(`skeleton-data` · 589개). 이유 둘:
//   ① 골격이 있다 = 지문이 온전하고(`body_ok`) 정답 근거 앵커가 있다 → ② 이해 단계의 인라인 밑줄이 선다
//   ② 커밋된 JSON 이라 DB 를 거의 안 친다(배점만 한 번 읽는다)
// 순서표(「다음 순서 유형」)는 오답 지도(`trap-atlas`)의 유형 순서 — 최근 출제가 많은 순 — 에서
// 은퇴 유형과 최근 출제 0 인 유형을 뺀 것이다.

import type { SupabaseClient } from '@supabase/supabase-js'

import { kiceSourceOf } from '@/lib/csat/kice-source'
import { anchorCatalog } from '@/lib/csat/overlay'
import { loadItemSkeleton, skeletonExams, skeletonSiblings } from '@/lib/csat/skeleton'
import { ATLAS_TYPES } from '@/lib/csat/trap-atlas'
import { pagedSelect } from '@/lib/supabase/paged-select'
import { createClient } from '@/lib/supabase/server'

import { examOrder, type CatalogItem, type SessionCatalog } from './model'

export interface PaperSource {
  /** 문제지 PDF 를 바로 받는 링크(평가원) — 없으면 목록으로 */
  url: string
  direct: boolean
}

export interface LearnerCatalog extends SessionCatalog {
  papers: Record<string, PaperSource>
  /** 좌표 색인이 있는 회차 — 없으면 학습자 파일에서 번호를 직접 찾는다 */
  anchored: string[]
}

/**
 * **프로세스 캐시(10분).** 카탈로그는 사용자와 무관하고(골격·배점·유형 시간) 하루에 몇 번 바뀔까 말까다.
 * 그런데 홈과 세션이 열릴 때마다 배점 802행을 다시 읽으면 공유 DB 가 바쁜 순간 **첫 문항까지
 * 1.3초 → 11.1초**로 흔들렸다(실측 2026-09-17 · 프로덕션 · 3G). `unstable_cache` 를 쓰지 않는 이유:
 * 읽기가 로그인 쿠키를 따르는 클라이언트(RLS)라 캐시 함수 안에서 쿠키를 읽을 수 없다.
 * 실패한 결과는 담지 않는다 — 다음 요청이 다시 읽는다.
 */
const CATALOG_TTL_MS = 10 * 60 * 1000
let catalogCache: { at: number; catalog: LearnerCatalog } | null = null

export async function loadSessionCatalog(): Promise<{ catalog: LearnerCatalog; error: string | null }> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) {
    return { catalog: catalogCache.catalog, error: null }
  }
  const res = await readSessionCatalog()
  if (!res.error) catalogCache = { at: Date.now(), catalog: res.catalog }
  return res
}

async function readSessionCatalog(): Promise<{ catalog: LearnerCatalog; error: string | null }> {
  const types = ATLAS_TYPES.filter((t) => t.status !== 'retired' && t.recent > 0)
  const exams = skeletonExams().map((e) => e.exam_id)

  const items: CatalogItem[] = []
  const labels: SessionCatalog['exams'] = {}
  for (const t of types) {
    for (const sib of skeletonSiblings(t.id)) {
      const examId = sib.id.split('#')[0]
      if (!exams.includes(examId)) continue
      items.push({ id: sib.id, exam_id: examId, no: sib.no, type_id: t.id, points: null })
      labels[examId] ??= { label: sib.exam_label, order: examOrder(examId) }
    }
  }

  let error: string | null = null
  const budget = new Map<string, number | null>()
  try {
    // `Database` 타입에 `csat_*` 가 없다 — `learner.ts` 의 `csatDb()` 와 같은 완화(한 줄)
    const db = (await createClient()) as unknown as SupabaseClient
    const [pts, reps] = await Promise.all([
      pagedSelect<{ id: string; points: number | null }>(
        (from, to) => db.from('csat_items_public').select('id, points').eq('in_scope', true).range(from, to),
        'CSAT 세션 배점',
      ),
      db.from('csat_type_reports').select('type_id, time_budget_sec'),
    ])
    const p = new Map(pts.map((r) => [r.id, r.points]))
    for (const it of items) it.points = p.get(it.id) ?? null
    for (const r of (reps.data ?? []) as { type_id: string; time_budget_sec: number | null }[]) {
      budget.set(r.type_id, r.time_budget_sec)
    }
  } catch (e) {
    // 배점·시간을 못 읽어도 세션은 선다 — 분 어림이 기본값(유형당 2분)으로 간다
    error = e instanceof Error ? e.message : '배점을 읽지 못했어요'
  }

  const papers: Record<string, PaperSource> = {}
  for (const examId of Object.keys(labels)) {
    const s = kiceSourceOf(examId)
    papers[examId] = { url: s.paperUrl ?? s.listUrl, direct: s.paperUrl != null }
  }

  return {
    catalog: {
      items,
      types: types.map((t) => ({ id: t.id, name: t.name, time_budget_sec: budget.get(t.id) ?? null })),
      exams: labels,
      papers,
      anchored: anchorCatalog().exams,
    },
    error,
  }
}

/** 세션 화면이 URL 로 받은 문항 id 가 후보에 있는가 — 없는 id 로 빈 화면을 만들지 않는다 */
export function isSessionItem(itemId: string): boolean {
  return loadItemSkeleton(itemId) != null
}
