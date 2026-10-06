// apps/web/src/lib/csat/workspace-index.ts
//
// **Workspace 문항 색인 — 서버가 만들어 화면에 넘긴다.** (2026-09-29)
//
// 넘기는 것: 문항 id · 유형 · 회차 · 오답 계열(함정)들 · 지문 지도 유무 · 학년도 + 고를 수 있는 단위 목록.
// 지문 · 선지 원문은 없다(D15). 기출 데이터는 읽기만 한다.
//
// ⚠️ 해부 카탈로그(`dissect-catalog`)를 쓰지 않는다 — 손으로 채운 메타데이터가 있는 소수 문항만 들어 있어
//    (실측 2026-09-29: 빈칸 7 · 2026 수능 2) Workspace 가 담을 것이 거의 없었다. 서가 카탈로그(평가원 802)를
//    뼈대로 쓰고, 함정은 오답 지도(`build-trap-atlas.mjs`)와 **같은 규칙**으로 최신 published 분석의
//    `choice_analysis[].trap` 에서 읽는다. 함정 이름은 지도에 오른 것(TRAPS)만 — 화면의 함정 32 와 같게.

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import { keysetSelect } from '@/lib/supabase/keyset-select'

import { loadBrowseCatalog } from './browse'
import { isItemHeld, loadRevealScope, type RevealScope } from './embargo-gate'
import { HAKPYEONG_ID_PREFIX, examOrder, isKiceExam, schoolYearOf } from './exam-id'
import { TRAPS } from './trap-atlas'
import type { WorkspaceIndexItem } from './workspace'

export interface WorkspaceUnits {
  types: { id: string; name: string; n: number }[]
  traps: { key: string; n: number }[]
  exams: { id: string; label: string; n: number; year: number }[]
}

export interface WorkspaceIndex {
  items: WorkspaceIndexItem[]
  units: WorkspaceUnits
}

interface AnalysisRow {
  item_id: string
  version: number
  choice_analysis: { trap?: unknown }[] | null
}

const TTL_MS = 600_000
type BrowseCatalog = Awaited<ReturnType<typeof loadBrowseCatalog>>
// 캐시는 **원본**(서가 카탈로그 · 문항별 함정)이다 — 보류 문항의 함정(정답 분석 파생)은 요청마다 embargo-gate 로 뺀다
let cache: { at: number; browse: BrowseCatalog; traps: Map<string, string[]> } | null = null

async function trapsByItem(db: SupabaseClient): Promise<Map<string, string[]>> {
  const named = new Set(TRAPS.map((t) => t.key))
  const rows = await keysetSelect<AnalysisRow, { itemId: string; version: number }>(
    (cursor, limit) => {
      let q = db.from('csat_item_analyses').select('item_id,version,choice_analysis').eq('status', 'published').not('item_id', 'like', `${HAKPYEONG_ID_PREFIX}%`).order('item_id').order('version').limit(limit)
      if (cursor) q = q.or(`item_id.gt.${cursor.itemId},and(item_id.eq.${cursor.itemId},version.gt.${cursor.version})`)
      return q
    },
    (row) => ({ itemId: row.item_id, version: row.version }),
    'Workspace 함정',
  )
  // 문항마다 최신 버전 하나(오답 지도와 같은 규칙 — 버전을 안 접으면 함정이 버전 수만큼 겹친다)
  const latest = new Map<string, AnalysisRow>()
  for (const r of rows) {
    const prev = latest.get(r.item_id)
    if (!prev || r.version > prev.version) latest.set(r.item_id, r)
  }
  const out = new Map<string, string[]>()
  for (const [id, a] of latest) {
    const traps = (Array.isArray(a.choice_analysis) ? a.choice_analysis : [])
      .map((c) => (typeof c?.trap === 'string' ? c.trap.trim() : ''))
      .filter((t) => named.has(t))
    out.set(id, [...new Set(traps)])
  }
  return out
}

export async function loadWorkspaceIndex(): Promise<WorkspaceIndex> {
  let browse: BrowseCatalog
  let traps: Map<string, string[]>
  if (cache && Date.now() - cache.at < TTL_MS) {
    ;({ browse, traps } = cache)
  } else {
    const db = (await createClient()) as unknown as SupabaseClient
    ;[browse, traps] = await Promise.all([loadBrowseCatalog(), trapsByItem(db)])
    if (browse.error) throw new Error(browse.error)
    // 함정을 하나도 못 읽었으면(로그인 만료 · RLS 빈 결과) 캐시하지 않는다 — 다음 요청이 다시 읽게
    if (traps.size > 0) cache = { at: Date.now(), browse, traps }
  }
  return buildWorkspaceIndex(browse, traps, await loadRevealScope())
}

/** 요청마다 — 보류 시험 문항은 남기되 함정(오답 계열)을 비우고, 단위 수도 그 기준으로 다시 센다 */
export function buildWorkspaceIndex(browse: BrowseCatalog, traps: Map<string, string[]>, scope: RevealScope): WorkspaceIndex {

  const items: WorkspaceIndexItem[] = browse.items
    .filter((it) => isKiceExam(it.id))
    .map((it) => ({
      id: it.id,
      type_id: it.type_id,
      exam_id: it.exam_id,
      families: isItemHeld(scope, it.id) ? [] : (traps.get(it.id) ?? []),
      mapped: it.map,
      year: schoolYearOf(it.exam_id),
    }))

  const typeN = new Map<string, number>()
  const trapN = new Map<string, number>()
  const examN = new Map<string, number>()
  for (const it of items) {
    typeN.set(it.type_id, (typeN.get(it.type_id) ?? 0) + 1)
    examN.set(it.exam_id, (examN.get(it.exam_id) ?? 0) + 1)
    for (const f of it.families) trapN.set(f, (trapN.get(f) ?? 0) + 1)
  }
  // 유형은 문항이 많은 순 — 레일 「유형별」 과 같은 순서(「처음 시작하기」 가 앞 3개를 쓴다)
  const types = browse.types
    .filter((t) => typeN.has(t.id) && t.status !== 'retired')
    .map((t) => ({ id: t.id, name: t.name, n: typeN.get(t.id)! }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
  const trapUnits = [...trapN.entries()].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key))
  const exams = browse.exams
    .filter((e) => examN.has(e.id))
    .map((e) => ({ id: e.id, label: e.label, n: examN.get(e.id)!, year: e.year }))
    .sort((a, b) => examOrder(b.id) - examOrder(a.id))

  return { items, units: { types, traps: trapUnits, exams } }
}
