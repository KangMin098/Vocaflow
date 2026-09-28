// scripts/csat/lib-units-db.mjs
//
// **현재 근거 단위 목록을 DB 에서 읽는다** — export·import·검수 CLI 가 모두 이 함수만 쓴다(다시 나누지 않는다).
// «현재» 는 DB 함수 csat_current_units_hash 가 정한다: 현재 원문 해시에 맞는 가장 높은 버전.
// 원문이 바뀌었는데 units-build 를 안 돌렸으면 현재 목록이 **없다**(null) — 옛 목록을 대신 쓰지 않는다.

/** 에이전트에게 보이는 모양 — 오프셋은 빼고 번호·글·종류만 */
export const unitsForAgent = (units) => units.map((u) => ({ n: u.n, text: u.text, ...(u.kind === 'line' ? { kind: 'line' } : {}) }))

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string[]} itemIds
 * @returns {Promise<Map<string, { units_version: number, units_hash: string, units: any[] } | null>>}
 */
export async function loadCurrentUnits(db, itemIds) {
  const out = new Map()
  const ids = [...new Set(itemIds)]
  for (let i = 0; i < ids.length; i += 16) {
    await Promise.all(ids.slice(i, i + 16).map(async (id) => {
      const { data: h, error } = await db.rpc('csat_current_units_hash', { p_item: id })
      if (error) throw new Error(`${id}: ${error.message}`)
      if (!h) { out.set(id, null); return }
      const { data: row, error: re } = await db.from('csat_item_units')
        .select('units_version, units_hash, units').eq('item_id', id).eq('units_hash', h)
        .order('units_version', { ascending: false }).limit(1).single()
      if (re) throw new Error(`${id}: ${re.message}`)
      out.set(id, row)
    }))
  }
  return out
}
