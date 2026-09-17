// apps/web/src/lib/csat/reflow/align.ts
//
// **골격의 k번째 문장 = reflow 의 몇 번째 문장인가.**
//
// 강의 큐(`sentence:k`)와 골격 앵커는 **DB 지문**을 `splitSentences` 로 나눈 번호다. 학습자 화면의
// 문장은 **학습자 PDF 에서 뽑은 글**을 같은 함수로 나눈 번호다. 둘은 대개 같지만 늘 같지는 않다 —
// 실측 2026-09-17: DB 지문에 쪽 번호 `8` 이 섞인 장문(2026#43~45)은 `it. 8 (B) Mia’s` 에서 문장이
// 안 끊겨, 그 뒤 번호가 전부 하나씩 밀렸다(순번 대조 34문장 중 11개만 일치).
//
// 그래서 순번이 아니라 **길이열을 정렬**한다(Gale–Church 식 동적 계획법). 글자를 비교하지 않는
// 이유: 서버가 가진 것은 길이뿐이다(`skeleton-data` 에는 글자가 없다 — 그게 저작권 경계다).

/** 한 블록 — 골격 문장들(a)이 reflow 문장들(b)에 대응한다. 한쪽이 비면 대응 없음. */
export interface AlignBlock {
  a: number[]
  b: number[]
  /** 길이가 허용 오차 안에서 맞는가 */
  ok: boolean
}

const tolerance = (n: number) => Math.max(4, n * 0.08)

const MOVES: [number, number, number][] = [
  // [골격 몇 개, reflow 몇 개, 벌점]
  [1, 1, 0],
  [1, 2, 0.35],
  [2, 1, 0.35],
  [1, 0, 1],
  [0, 1, 1],
]

export function alignSentences(a: number[], b: number[]): AlignBlock[] {
  const n = a.length
  const m = b.length
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(Infinity))
  const back: ([number, number] | null)[][] = Array.from({ length: n + 1 }, () =>
    new Array<[number, number] | null>(m + 1).fill(null),
  )
  cost[0][0] = 0
  for (let i = 0; i <= n; i += 1) {
    for (let j = 0; j <= m; j += 1) {
      if (cost[i][j] === Infinity) continue
      for (const [da, db, pen] of MOVES) {
        const ni = i + da
        const nj = j + db
        if (ni > n || nj > m) continue
        const sa = a.slice(i, ni).reduce((x, y) => x + y, 0)
        const sb = b.slice(j, nj).reduce((x, y) => x + y, 0)
        const c = cost[i][j] + pen + (da && db ? Math.abs(sa - sb) / Math.max(sa, sb, 1) : 0)
        if (c < cost[ni][nj]) {
          cost[ni][nj] = c
          back[ni][nj] = [da, db]
        }
      }
    }
  }
  const blocks: AlignBlock[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    const mv = back[i][j]
    if (!mv) break
    const [da, db] = mv
    const ai = Array.from({ length: da }, (_, k) => i - da + k)
    const bj = Array.from({ length: db }, (_, k) => j - db + k)
    const sa = ai.reduce((x, k) => x + a[k], 0)
    const sb = bj.reduce((x, k) => x + b[k], 0)
    blocks.push({ a: ai, b: bj, ok: da > 0 && db > 0 && Math.abs(sa - sb) <= tolerance(sa) })
    i -= da
    j -= db
  }
  return blocks.reverse()
}

/** 골격 문장 k → reflow 문장 번호들. 대응이 없으면 빈 배열. */
export function skeletonToReflow(a: number[], b: number[]): number[][] {
  const out: number[][] = a.map(() => [])
  for (const blk of alignSentences(a, b)) if (blk.b.length) for (const k of blk.a) out[k] = blk.b
  return out
}

/** 골격 문장 중 길이가 맞게 대응된 몫 — Gate 1 「문장 앵커 매칭」 */
export function anchorMatchRate(a: number[], b: number[]): { matched: number; total: number } {
  let matched = 0
  for (const blk of alignSentences(a, b)) if (blk.ok) matched += blk.a.length
  return { matched, total: a.length }
}
