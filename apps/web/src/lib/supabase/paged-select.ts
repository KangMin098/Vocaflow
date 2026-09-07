// apps/web/src/lib/supabase/paged-select.ts
//
// PostgREST 는 **한 응답에 1,000행까지만** 준다(`db-max-rows`). 그보다 많이 요청해도
// (`.limit(10000)` 을 걸어도) 조용히 1,000행에서 끊긴다 — 오류가 아니다.
// 그래서 "전부 받아 세는" 코드는 모집단이 자라는 순간 **틀린 숫자를 조용히 보여 준다.**
//
// 2026-08-30 하루에 같은 결함을 세 번 만났다. 전부 오류 없이 화면만 틀렸다:
//   ① 도서 카탈로그의 "단어장 N" 배지 — 발행 300권을 넘기며 정확히 1000행에서 잘렸다.
//   ② 계획 자료 선택기 — 큐레이션 단어장 70개 중 1개만 남았다.
//   ③ 학습 자산(hub) — 한 사용자의 `vocabularies` 가 이미 1,945행이라 세트별 단어 수가
//      적게 세어지고, 그 수로 정렬까지 하고 있었다. 챕터 보유 판정도 26,390행 중 1,000행만 봤다.
//
// 규칙: **개수를 세거나 전량이 필요하면 여기 헬퍼를 쓴다.** 직접 `.limit()` 을 적지 않는다.
//   (표시용 상위 N개처럼 *의도적으로* 자르는 곳은 그대로 `.limit()` 을 쓰되 왜인지 적을 것.)

/** PostgREST 한 응답의 최대 행 수. 이보다 크게 요청해도 잘린다. */
export const PAGE_SIZE = 1000

/** `.range(from, to)` 를 받아 한 페이지를 돌려주는 조회. */
export type RangeQuery = (
  from: number,
  to: number,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>

/**
 * 마지막 페이지가 채워지지 않을 때까지 `.range()` 로 끝까지 받는다.
 * @param label 실패 메시지에 쓸 이름 — 어느 조회가 깨졌는지 알 수 있어야 한다.
 */
export async function pagedSelect<T>(run: RangeQuery, label: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await run(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`${label} 조회 실패: ${error.message}`)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE_SIZE) break
  }
  return out
}

/**
 * `.in()` 대상 id 가 많을 때 — id 를 나눠 보내고 각 조각을 끝까지 페이지네이션한다.
 *
 * `.in()` 은 GET 쿼리스트링이라 id 수만큼 URL 이 길어진다.
 *
 * ⚠️ **개수가 아니라 길이로 쪼갠다.** 여기 있던 `chunkSize = 50` 은 UUID 를 염두에 둔
 *    짐작이었고, 값이 짧은 낱말에는 지나치게 잘게 쪼개 왕복만 늘렸다. 반대로 다른 자리의
 *    `500` 은 낱말에는 맞지만 UUID 에는 **깨지는 값**이었다(400개 = 약 14,800자 → 실패).
 *    같은 상수를 값 종류에 따라 다르게 써야 한다는 것 자체가 단위가 틀렸다는 신호다.
 */
export async function pagedSelectIn<T>(
  ids: readonly string[],
  run: (chunk: string[], from: number, to: number) => PromiseLike<{
    data: unknown
    error: { message: string } | null
  }>,
  label: string,
  maxChars = IN_VALUE_MAX_CHARS,
): Promise<T[]> {
  if (ids.length === 0) return []
  const out: T[] = []
  for (const chunk of chunkForIn(ids, maxChars)) {
    const rows = await pagedSelect<T>((from, to) => run([...chunk], from, to), label)
    out.push(...rows)
  }
  return out
}

/**
 * **인자 배열이 큰 RPC 는 쪼개서 부른다.**
 *
 * ⚠️ 상한은 테이블 조회만의 이야기가 아니다 — PostgREST 는 **RPC 결과에도** `db-max-rows`
 *    를 적용한다. 실측 2026-08-30: `textfit_resolve_levels` 에 표면형 1,500개를 넣으니
 *    **1,000행만** 왔고, 500개씩 쪼개 부르니 1,499행이 왔다. 오류는 나지 않는다.
 *    거기서 빠진 낱말은 "해석 못 한 단어" 로 남아 **아는 비율이 낮게** 계산된다 —
 *    그 수치가 랜딩 1차 CTA(`/fit`)가 파는 것 자체다.
 *
 * 낱말 하나하나를 독립적으로 푸는 RPC 에만 쓴다(순서·집계에 의존하지 않는 것).
 * 조각 하나라도 실패하면 **전체를 실패로 돌린다** — 반쯤 푼 결과를 정상이라고 부르면
 * 그게 더 나쁘다.
 */
export async function chunkedRpc<TRow, TItem = string>(
  items: readonly TItem[],
  run: (chunk: TItem[]) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  label: string,
  chunkSize = 500,
): Promise<TRow[]> {
  if (items.length === 0) return []
  const out: TRow[] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    const { data, error } = await run([...items].slice(i, i + chunkSize))
    if (error) throw new Error(`${label} RPC 실패: ${error.message}`)
    out.push(...((data ?? []) as TRow[]))
  }
  return out
}

/**
 * `.in()` 한 번에 넣어도 되는 **값 문자열 길이** 상한.
 *
 * ⚠️ 한계는 **개수가 아니라 길이**다. 실측 2026-08-30 (같은 코드, 값만 다름):
 *
 *   | 값 문자열 길이 | 결과                          |
 *   |---------------|-------------------------------|
 *   | ~11,100자      | 성공                          |
 *   | ~14,800자      | `TypeError: fetch failed` (7.5초 뒤) |
 *   | ~25,900자      | `Bad Request` (즉시)           |
 *
 * 그래서 **개수로 쪼개면 값에 따라 되기도 하고 안 되기도 한다** — 낱말(평균 18자)은
 * 1,000개가 되는데 **UUID(36자)는 400개에서 이미 깨진다.** 이 저장소는 50·300·400·500 을
 * 제각각 쓰고 있었고, 그중 어느 것이 왜 그 값인지 아무도 몰랐다.
 *
 * 8,000자는 성공 구간(~11,100)의 약 70% — 실패 구간과 사이를 벌려 둔다.
 * 첫 실패 모드가 **7.5초 뒤의 `fetch failed`** 라 화면에서는 "느리다" 로만 보인다.
 */
export const IN_VALUE_MAX_CHARS = 8000

/**
 * `.in()` 에 넣을 값을 **길이 기준**으로 쪼갠다.
 *
 * 값 하나가 상한보다 길면 그것만 담은 조각을 만든다 — 버리지 않는다(그러면 조용히 빠진다).
 */
export function chunkForIn<T extends string | number>(
  values: readonly T[],
  maxChars = IN_VALUE_MAX_CHARS,
): T[][] {
  const out: T[][] = []
  let cur: T[] = []
  let len = 0
  for (const v of values) {
    const w = String(v).length + 1 // 구분자 한 자
    if (cur.length > 0 && len + w > maxChars) {
      out.push(cur)
      cur = []
      len = 0
    }
    cur.push(v)
    len += w
  }
  if (cur.length > 0) out.push(cur)
  return out
}
