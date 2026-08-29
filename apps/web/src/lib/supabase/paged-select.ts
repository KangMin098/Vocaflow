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
 * `.in()` 은 GET 쿼리스트링이라 id 수만큼 URL 이 길어진다(316개 UUID = 약 11,700자).
 * 실측에서 그 길이 자체는 거부되지 않았지만, 조각내면 URL 길이와 행 상한을 함께 벗어난다.
 */
export async function pagedSelectIn<T>(
  ids: readonly string[],
  run: (chunk: string[], from: number, to: number) => PromiseLike<{
    data: unknown
    error: { message: string } | null
  }>,
  label: string,
  chunkSize = 50,
): Promise<T[]> {
  if (ids.length === 0) return []
  const out: T[] = []
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = [...ids].slice(i, i + chunkSize)
    const rows = await pagedSelect<T>((from, to) => run(chunk, from, to), label)
    out.push(...rows)
  }
  return out
}
