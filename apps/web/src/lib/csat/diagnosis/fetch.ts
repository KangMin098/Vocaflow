// apps/web/src/lib/csat/diagnosis/fetch.ts
//
// 진단 조회의 묶음 읽기 — OFFSET 페이징을 쓰지 않는다(scan-offset-paging 예산).
// 키 묶음을 작게 잘라 **묶음당 한 번**만 묻는다. 묶음 크기는 「키 하나당 최대 행 수 × 묶음 < 1,000」이 되게
// 호출부가 고른다. 그래도 한 응답이 1,000행에 닿으면 잘렸을 수 있으니 조용히 넘기지 않고 던진다.

const CAP = 1000

export async function selectByChunks<T>(
  keys: readonly string[],
  chunkSize: number,
  run: (chunk: string[]) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const uniq = [...new Set(keys)]
  const out: T[] = []
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const { data, error } = await run(uniq.slice(i, i + chunkSize))
    if (error) throw new Error(`${label} 조회 실패: ${error.message}`)
    const rows = (data ?? []) as T[]
    if (rows.length >= CAP) throw new Error(`${label} 조회가 ${CAP}행 상한에 닿았다 — 묶음 크기(${chunkSize})를 줄여야 한다`)
    out.push(...rows)
  }
  return out
}

/** 한 번에 받는 작은 표(설정 · 함정 계열 · 회차 목록). 상한에 닿으면 던진다 */
export async function selectSmall<T>(
  run: () => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const { data, error } = await run()
  if (error) throw new Error(`${label} 조회 실패: ${error.message}`)
  const rows = (data ?? []) as T[]
  if (rows.length >= CAP) throw new Error(`${label} 조회가 ${CAP}행 상한에 닿았다 — keyset 으로 바꿔야 한다`)
  return rows
}
