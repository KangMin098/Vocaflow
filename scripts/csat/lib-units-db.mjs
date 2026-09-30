// scripts/csat/lib-units-db.mjs
//
// **현재 근거 단위 목록을 DB 에서 읽는다** — export·import·검수 CLI 가 모두 이 함수만 쓴다(다시 나누지 않는다).
// «현재» 는 DB 함수 csat_current_units_many 가 **한 문장에서** 정한다: 지금 원문 해시(input_hash)에 맞는 가장 높은 버전.
//
// ⚠️ 목록 해시(units_hash)는 버전·경계만 담는다 — 원문을 같은 길이로 고치면 옛 목록과 새 목록의 해시가 같다.
//    그래서 예전처럼 «현재 해시를 받고 → 그 해시로 행을 찾으면» 옛 원문의 목록 글을 돌려줄 수 있었다(PR #126 리뷰 P1-3).
//    원문 해시까지 묶어 한 번에 찾는다. 원문이 바뀌었는데 units-build 를 안 돌렸으면 현재 목록이 **없다**(null).

/** 에이전트에게 보이는 모양 — 오프셋은 빼고 번호·글·종류만 */
export const unitsForAgent = (units) => units.map((u) => ({ n: u.n, text: u.text, ...(u.kind === 'line' ? { kind: 'line' } : {}) }))

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string[]} itemIds
 * @returns {Promise<Map<string, { units_version: number, units_hash: string, input_hash: string, units: any[] } | null>>}
 */
export async function loadCurrentUnits(db, itemIds) {
  const ids = [...new Set(itemIds)]
  const out = new Map(ids.map((id) => [id, null]))
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.rpc('csat_current_units_many', { p_items: ids.slice(i, i + 200) })
    if (error) throw new Error(`근거 단위 목록 조회: ${error.message}`)
    if (!Array.isArray(data)) throw new Error('근거 단위 목록 조회: 응답이 배열이 아니다')
    for (const r of data) out.set(r.item_id, { units_version: r.units_version, units_hash: r.units_hash, input_hash: r.input_hash, units: r.units })
  }
  return out
}
