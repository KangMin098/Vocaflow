// apps/web/src/lib/supabase/keyset-select.ts

/** PostgREST 한 응답의 최대 행 수. */
export const KEYSET_PAGE_SIZE = 1000

type KeysetPage<T> = {
  data: T[] | null
  error: { message: string } | null
}

/**
 * 고유하고 정렬된 키를 커서로 삼아 표를 끝까지 읽는다.
 *
 * OFFSET 과 달리 뒤 페이지가 앞 행을 다시 훑지 않는다. `run` 은 반드시 커서와 같은
 * 정렬을 적용하고, 커서가 있으면 그 뒤 행만 반환해야 한다.
 */
export async function keysetSelectResult<T, TCursor>(
  run: (cursor: TCursor | null, limit: number) => PromiseLike<KeysetPage<T>>,
  cursorOf: (row: T) => TCursor,
): Promise<{ rows: T[]; error: string | null }> {
  const out: T[] = []
  let cursor: TCursor | null = null

  for (;;) {
    const { data, error } = await run(cursor, KEYSET_PAGE_SIZE)
    if (error) return { rows: out, error: error.message }
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < KEYSET_PAGE_SIZE) return { rows: out, error: null }
    cursor = cursorOf(rows.at(-1)!)
  }
}

export async function keysetSelect<T, TCursor>(
  run: (cursor: TCursor | null, limit: number) => PromiseLike<KeysetPage<T>>,
  cursorOf: (row: T) => TCursor,
  label: string,
): Promise<T[]> {
  const result = await keysetSelectResult(run, cursorOf)
  if (result.error) throw new Error(`${label} 조회 실패: ${result.error}`)
  return result.rows
}
