// apps/web/src/lib/csat/review-batching.ts
//
// 검수 모니터 읽기 도우미 — 순수 함수(DB 클라이언트를 인자로 받는다). scripts/csat/lib-review-batching.mjs 와 같은 규칙.
//
// · 유효 승인(csat_valid_review_personas_many)은 분석 1개에 ~56ms(2026-10-18 실측: 200개 11.2s) — authenticator
//   statement_timeout 8s 를 넘는다. 함수는 그대로 두고 작은 묶음 · 제한된 동시성으로 부른다. 시간 초과(57014)만
//   반으로 쪼개 다시 묻고, 한 개짜리도 넘으면 오류로 돌려준다(0건·빈 승인으로 삼키지 않는다).
// · 후속 조치(csat_review_followups)는 PK (item_id, source, finding_key) 복합 커서로 끝까지 — 1,000행 상한에서 자르지 않는다.

export const VALID_BATCH = 20
export const VALID_CONCURRENCY = 4
const TIMEOUT = '57014'

type RpcError = { message: string; code?: string } | null
export type ValidRpc = (ids: string[]) => PromiseLike<{ data: unknown; error: RpcError }>
export interface ValidRow { analysis_id: string; personas: string[] | null }

/** 모든 id 의 유효 승인 페르소나. 하나라도 못 읽으면 error — 부분 결과를 정상으로 내지 않는다 */
export async function validPersonasBatched(ids: string[], rpc: ValidRpc, size = VALID_BATCH, concurrency = VALID_CONCURRENCY): Promise<{ rows: ValidRow[]; error: string | null }> {
  const rows: ValidRow[] = []
  const queue: string[][] = []
  for (let i = 0; i < ids.length; i += size) queue.push(ids.slice(i, i + size))
  let error: string | null = null
  const ask = async (part: string[]): Promise<void> => {
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
    rows.push(...((res.data ?? []) as ValidRow[]))
  }
  const worker = async () => { for (let part = queue.shift(); part && !error; part = queue.shift()) await ask(part) }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker))
  if (error) return { rows: [], error }
  const got = new Set(rows.map((r) => r.analysis_id))
  const missing = ids.filter((id) => !got.has(id))
  // 함수는 요청한 분석마다 한 행을 돌려준다 — 빠진 행은 «승인 0» 이 아니라 읽기 실패다
  return missing.length ? { rows: [], error: `유효 승인 결과에 분석 ${missing.length}개가 없다(예: ${missing[0]})` } : { rows, error: null }
}

export interface FollowupKey { item_id: string; source: string; finding_key: string }
/** PostgREST or() 안의 값 — 쉼표·괄호·따옴표가 있어도 깨지지 않게 큰따옴표로 감싼다 */
const q = (v: string) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
/** (item_id, source, finding_key) > after 조건 */
export function followupAfter(k: FollowupKey): string {
  return [
    `item_id.gt.${q(k.item_id)}`,
    `and(item_id.eq.${q(k.item_id)},source.gt.${q(k.source)})`,
    `and(item_id.eq.${q(k.item_id)},source.eq.${q(k.source)},finding_key.gt.${q(k.finding_key)})`,
  ].join(',')
}

type Page = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
/** 복합 PK 커서로 끝까지. build(after) 는 PK 순 정렬 + limit(pageCap) 을 건 질의를 돌려준다 */
export async function keysetFollowups<T extends FollowupKey>(build: (after: string | null) => Page, pageCap = 1000): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = []
  const seen = new Set<string>()
  for (let after: string | null = null; ;) {
    const res = await build(after)
    if (res.error) return { rows: [], error: res.error.message }
    const batch = (res.data ?? []) as T[]
    for (const r of batch) {
      const key = JSON.stringify([r.item_id, r.source, r.finding_key])
      if (seen.has(key)) return { rows: [], error: `후속 조치 커서가 같은 행을 두 번 읽었다(${r.item_id})` }
      seen.add(key)
      rows.push(r)
    }
    if (batch.length < pageCap) return { rows, error: null }
    after = followupAfter(batch[batch.length - 1])
  }
}
