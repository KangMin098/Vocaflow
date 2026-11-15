// apps/web/src/lib/csat/authored/learn-return.ts
//
// 받은 창작 자료(/csat/learn/[id])의 모든 출구가 지도 복귀 문맥(FI-011 C)을 같은 방식으로 싣는다.
//   정상 본문뿐 아니라 「열 수 없음」 · 열기 기록 실패 안내 · 로그인 왕복 · 묶음 선택에서도 지도에서 떠난 자리로 돌아간다.
//   문맥은 lib/csat/map-return 의 형식 검증만 통과한 값이고 조회 권한으로 쓰지 않는다. from=map 이 아니면 예전과 같은 전체 지도.
import { MAP_HOME_HREF, mapReturnQuery, parseMapReturn, returnQueryOf, withMapReturn } from '@/lib/csat/map-return'

type SearchParams = Record<string, string | string[] | undefined>

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/** 지도로 돌아가는 주소 — 이 자료(map_item)를 짚고, 시도(map_attempt)는 화면이 따로 붙인다 */
export function learnReturnHref(id: string, sp: SearchParams): string {
  if (one(sp.from) !== 'map') return MAP_HOME_HREF
  return `${MAP_HOME_HREF}${mapReturnQuery(parseMapReturn({ ...returnQueryOf(sp), map_item: id, map_attempt: undefined }))}`
}

/** 같은 자료를 다시 여는 주소(로그인 복귀 · 묶음 선택) — 납품 id 는 형식이 맞을 때만, 지도 문맥은 from=map 일 때만 */
export function learnSelfHref(id: string, sp: SearchParams, deliveryId?: string | null): string {
  const d = deliveryId && /^[0-9a-f-]{36}$/i.test(deliveryId) ? deliveryId : null
  const base = `/csat/learn/${id}${d ? `?d=${d}` : ''}`
  if (one(sp.from) !== 'map') return base
  return withMapReturn(base, parseMapReturn({ ...returnQueryOf(sp), map_item: undefined, map_attempt: undefined }))
}
