// apps/web/src/lib/csat/review-defects.ts
//
// **⑦ 검수에서 막힌 문항을 실제로 읽는다** — `csat_item_reviews` 직조회.
//
// ── 왜 생겼나 (실측 2026-09-23 · DD-69 B4) ──────────────────────────
// `csat_item_reviews` 를 읽는 **웹 코드가 0곳**이었다. 판정은 조판기 안에서만 쓰이고
// (fail 문항을 후보에서 뺀다) 화면은 `textbook_volume_renders.colophon` 에 **조판 시각에
// 얼린 요약**만 봤다. 그래서 이 수들이 어느 화면에도 없었다:
//
//   검수된 문항 321 · 3인 전원 pass **29** · **미해소 결함 292**
//   판정 963행 = pass 303 · revise 501 · fail 159
//
// 292문항은 지금도 재고에 있고, 조판기는 그것을 말없이 건너뛴다. 관리자는 왜 권이 안
// 차는지 모른 채 집필을 더 돌린다 — **고칠 것이 아니라 만들 것을 늘린다.**
//
// ── 「최신 판정」을 왜 안 고르나 ────────────────────────────────────
// `csat_item_reviews` 는 `unique (item_id, persona)` 다(마이그레이션 20260912210000).
// 한 문항의 한 페르소나에 행이 **하나뿐**이라 최신을 고를 것이 없다 — 적재기가 upsert 한다.
// 여기서 window 함수를 흉내 내면 없는 복잡도를 더하고, 그 코드가 제약이 바뀔 때 조용히 틀린다.
//
// ⚠️ **「0건」과 「못 읽음」을 가른다.** 조회가 실패하면 `total: null` 이고 화면이 「못 잼」을
//   그린다. `count ?? 0` 으로 뭉개면 「막힌 문항 0」이라는 거짓 안심이 된다
//   (AGENTS.md 「하지 말 것」).

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { pagedSelect, pagedSelectIn } from '@/lib/supabase/paged-select'

// 순수 조각(타입 · 라벨 · UNREAD 상수)은 모델이 소유한다 — 화면이 그쪽에서 가져간다.
export * from './review-defects-model'
import {
  UNREAD_REVIEW_DEFECTS,
  type ReviewDefect,
  type ReviewDefectView,
} from './review-defects-model'

const EMPTY = UNREAD_REVIEW_DEFECTS

interface ReviewRow {
  item_id: string
  persona: string
  verdict: string
  findings: unknown
  reviewed_at: string
}

/** `findings` 첫 줄을 사람이 읽을 한 줄로. 모양이 여러 가지라 방어적으로 읽는다. */
function firstFinding(findings: unknown): string | null {
  if (!Array.isArray(findings) || findings.length === 0) return null
  const f = findings[0]
  if (typeof f === 'string') return f.trim() || null
  if (f && typeof f === 'object') {
    for (const k of ['says', 'detail', 'message', 'note', 'what']) {
      const v = (f as Record<string, unknown>)[k]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
  }
  return null
}

/**
 * 막힌 문항을 읽는다.
 *
 * @param limit 화면에 그릴 앞쪽 몇 건. 전량은 `itemsBlocked` 로 센다 —
 *   **자르는 것과 세는 것을 섞지 않는다**(`paged-select.ts` 머리말의 같은 규칙).
 */
export async function loadReviewDefects(
  db: SupabaseClient,
  limit = 12,
): Promise<ReviewDefectView> {
  let reviews: ReviewRow[]
  try {
    reviews = await pagedSelect<ReviewRow>(
      (from, to) =>
        db
          .from('csat_item_reviews')
          .select('item_id, persona, verdict, findings, reviewed_at')
          .order('item_id')
          .range(from, to),
      '문항 검수 판정',
    )
  } catch (e) {
    // 표가 없거나 조회가 깨졌다 — **0 으로 적지 않는다.**
    return { ...EMPTY, loadError: `검수 기록을 못 읽었다: ${(e as Error).message}` }
  }

  const byItem = new Map<string, ReviewRow[]>()
  for (const r of reviews) {
    const arr = byItem.get(r.item_id)
    if (arr) arr.push(r)
    else byItem.set(r.item_id, [r])
  }

  const byVerdict: Record<string, number> = {}
  for (const r of reviews) byVerdict[r.verdict] = (byVerdict[r.verdict] ?? 0) + 1

  let itemsAllPass = 0
  const blockedItems: string[] = []
  for (const [id, rs] of byItem) {
    const bad = rs.filter((r) => r.verdict !== 'pass')
    if (bad.length === 0 && rs.length >= 3) itemsAllPass++
    if (bad.length > 0) blockedItems.push(id)
  }

  // 문항 메타(유형·V레벨)를 붙인다. **못 찾으면 null 이다** — 문항이 지워졌거나
  // 초등 3종처럼 `csat_dcp_items` 에 행이 없는 갈래일 수 있다(도움말 csat.ts:1099).
  const ids = [...byItem.keys()]
  let meta = new Map<string, { type: string | null; vLevel: number | null }>()
  try {
    const rows = await pagedSelectIn<{ id: string; type: string | null; v_level: number | null }>(
      ids,
      (chunk, from, to) =>
        db.from('csat_dcp_items').select('id, type, v_level').in('id', chunk).order('id').range(from, to),
      '검수 대상 문항',
    )
    meta = new Map(rows.map((r) => [r.id, { type: r.type, vLevel: r.v_level }]))
  } catch {
    // 메타를 못 붙여도 판정은 보여 준다 — 「유형 못 찾음」이 「판정 없음」보다 낫다.
    meta = new Map()
  }

  // 밴드 × 판정. 메타를 못 찾은 것은 `null` 밴드로 모은다(0 으로 안 센다).
  const cells = new Map<string, { vLevel: number | null; pass: number; revise: number; fail: number; items: Set<string> }>()
  for (const r of reviews) {
    const v = meta.get(r.item_id)?.vLevel ?? null
    const key = String(v)
    let c = cells.get(key)
    if (!c) {
      c = { vLevel: v, pass: 0, revise: 0, fail: 0, items: new Set() }
      cells.set(key, c)
    }
    if (r.verdict === 'pass') c.pass++
    else if (r.verdict === 'revise') c.revise++
    else if (r.verdict === 'fail') c.fail++
    c.items.add(r.item_id)
  }

  const rows: ReviewDefect[] = reviews
    .filter((r) => r.verdict === 'revise' || r.verdict === 'fail')
    // 반려를 먼저 — 수정보다 무겁다. 같으면 최신 먼저.
    .sort((a, b) =>
      a.verdict === b.verdict
        ? b.reviewed_at.localeCompare(a.reviewed_at)
        : a.verdict === 'fail'
          ? -1
          : 1,
    )
    .slice(0, limit)
    .map((r) => ({
      itemId: r.item_id,
      type: meta.get(r.item_id)?.type ?? null,
      vLevel: meta.get(r.item_id)?.vLevel ?? null,
      persona: r.persona,
      verdict: r.verdict as 'revise' | 'fail',
      says: firstFinding(r.findings),
      reviewedAt: r.reviewed_at,
    }))

  return {
    available: true,
    loadError: null,
    itemsReviewed: byItem.size,
    itemsAllPass,
    itemsBlocked: blockedItems.length,
    byVerdict,
    matrix: [...cells.values()]
      .map((c) => ({ vLevel: c.vLevel, pass: c.pass, revise: c.revise, fail: c.fail, items: c.items.size }))
      // null 밴드는 맨 뒤로 — 못 찾은 것이 맨 앞에 서면 표가 그것부터 읽힌다.
      .sort((a, b) => (a.vLevel ?? 99) - (b.vLevel ?? 99)),
    rows,
  }
}
