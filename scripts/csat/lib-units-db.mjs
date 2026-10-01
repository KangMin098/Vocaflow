// scripts/csat/lib-units-db.mjs
//
// **현재 근거 단위 목록을 DB 에서 읽는다** — export·import·검수 CLI 가 모두 이 함수만 쓴다(다시 나누지 않는다).
// «현재» 는 DB 함수 csat_current_units_many 가 **한 문장에서** 정한다: 지금 원문 해시(input_hash)에 맞는 가장 높은 버전.
//
// ⚠️ 목록 해시(units_hash)는 버전·경계만 담는다 — 원문을 같은 길이로 고치면 옛 목록과 새 목록의 해시가 같다.
//    그래서 예전처럼 «현재 해시를 받고 → 그 해시로 행을 찾으면» 옛 원문의 목록 글을 돌려줄 수 있었다(PR #126 리뷰 P1-3).
//    원문 해시까지 묶어 한 번에 찾는다. 원문이 바뀌었는데 units-build 를 안 돌렸으면 현재 목록이 **없다**(null).

import { isDeepStrictEqual } from 'node:util'
import crypto from 'node:crypto'

// Export-file provenance only; independent review hashes are still stamped by the DB.
export const exportAnswerHash = (item) => crypto.createHash('sha256').update(JSON.stringify([item.answer ?? null, item.answers ?? null])).digest('hex')

export async function loadCurrentAnswerHashes(db, itemIds) {
  const out = new Map()
  const ids = [...new Set(itemIds)]
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from('csat_items').select('id,answer,answers').in('id', ids.slice(i, i + 200))
    if (error) throw new Error(`정답 조회: ${error.message}`)
    if (!Array.isArray(data)) throw new Error('정답 조회: 응답이 배열이 아니다')
    for (const row of data) out.set(row.id, exportAnswerHash(row))
  }
  return out
}

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

/** The DB hash belongs to the DB source: only attach it after comparing the local export body. */
export async function loadVerifiedExportUnits(db, items) {
  const out = new Map()
  for (let i = 0; i < items.length; i += 200) {
    const part = items.slice(i, i + 200)
    const ids = part.map((it) => it.id)
    const before = await loadCurrentUnits(db, ids)
    const { data, error } = await db.from('csat_items').select('id,type_id,passage,stem,choices,answer,answers').in('id', ids)
    if (error) throw new Error(`export 원문 조회: ${error.message}`)
    if (!Array.isArray(data)) throw new Error('export 원문 조회: 응답이 배열이 아니다')
    const source = new Map(data.map((r) => [r.id, r]))
    const after = await loadCurrentUnits(db, ids)
    for (const it of part) {
      const row = source.get(it.id)
      const fields = ['type_id', 'passage', 'stem', 'choices', 'answer', 'answers']
      const changed = fields.filter((k) => !isDeepStrictEqual(it[k] ?? null, row?.[k] ?? null))
      if (!row || changed.length) throw new Error(`${it.id}: 로컬 코퍼스와 DB 원문 불일치(${changed.join(', ') || '문항 없음'}) — 원문을 대조·동기화한 뒤 다시 export 한다`)
      const a = before.get(it.id), b = after.get(it.id)
      if ((a?.input_hash ?? null) !== (b?.input_hash ?? null) || (a?.units_hash ?? null) !== (b?.units_hash ?? null)) {
        throw new Error(`${it.id}: export 원문 조회 중 목록이 바뀌었다 — 다시 export 한다`)
      }
      out.set(it.id, b)
    }
  }
  return out
}
