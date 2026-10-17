// scripts/csat/lib-review-batching.mjs
//
// 유효 승인 RPC 를 8s statement_timeout 안에서 부르는 규칙 — apps/web/src/lib/csat/review-batching.ts 와 같다.
// csat_valid_review_personas_many 는 분석 1개에 ~56ms(2026-10-18 실측: 200개 11.2s). 함수 의미는 그대로 두고
// 작은 묶음 · 동시성 제한으로 부른다. 시간 초과(57014)만 반으로 쪼개 다시 묻고, 그래도 안 되면 오류(0 으로 삼키지 않는다).
export const VALID_BATCH = 20
export const VALID_CONCURRENCY = 4
const TIMEOUT = '57014'

/** @returns {Promise<{rows: {analysis_id:string, personas:string[]|null}[], error: string|null}>} */
export async function validPersonasBatched(ids, rpc, size = VALID_BATCH, concurrency = VALID_CONCURRENCY) {
  const rows = []
  const queue = []
  for (let i = 0; i < ids.length; i += size) queue.push(ids.slice(i, i + size))
  let error = null
  const ask = async (part) => {
    if (error) return
    const res = await rpc(part)
    if (res.error) {
      if (res.error.code === TIMEOUT && part.length > 1) {
        const mid = Math.ceil(part.length / 2)
        await ask(part.slice(0, mid))
        await ask(part.slice(mid))
        return
      }
      error = `${res.error.message}${res.error.code === TIMEOUT ? ` (시간 초과 · 분석 ${part[0]})` : ''}`
      return
    }
    rows.push(...(res.data ?? []))
  }
  const worker = async () => { for (let part = queue.shift(); part && !error; part = queue.shift()) await ask(part) }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker))
  if (error) return { rows: [], error }
  const got = new Set(rows.map((r) => r.analysis_id))
  const missing = ids.filter((id) => !got.has(id))
  return missing.length ? { rows: [], error: `유효 승인 결과에 분석 ${missing.length}개가 없다(예: ${missing[0]})` } : { rows, error: null }
}
