// apps/web/src/lib/__tests__/offset-paging-budget.test.ts
//
// **OFFSET 페이징 예산** — scripts/lib/scan-offset-paging.mjs 를 실제로 돌린다.
//
// ── 왜 검사가 필요한가 (실측 2026-09-06) ─────────────────────────────
// 같은 함정을 **하루에 네 번** 고쳤다. 매번 다른 파일, 매번 같은 모양이다 — 뒤 페이지가
// 앞을 다시 훑는 `.range(from, from+N)` 페이징이 표가 커지자 통째로 죽었다:
//
//   · `gen-db-stats.mjs`   `library_articles` 91,358행 · 본문을 담아 1,000행당 힙 ~8 MB
//     → 700 MB 를 읽고 12페이지에서 statement timeout. §DB 핵심 통계가 이틀 낡았다.
//   · `store-new-types.mjs` 원글 두 편 때문에 V6 **13,041편을 본문째** 읽었다.
//   · `series-report.mjs`  `csat_dcp_items` **656,988행** · 657페이지 → 아예 못 돌았다.
//     시리즈 전체를 보는 유일한 자가 그래서 몇 주째 죽어 있었다.
//   · (네 번째는 모양이 다르다 — `.in()` 묶음이 1,000행 상한에 잘려 **9,936편이라 답했다.
//      실제는 87편.** 그건 이 스캐너가 못 잡는다. 아래 §못 잡는 것 참조.)
//
// 같은 날 DB 가 55분 전면 정지했고 원인은 쓰기 폭주가 아니라 **읽기 포화**였다.
// 네 번 고쳤으면 다섯 번째가 온다 — 주석으로는 못 막는다.
//
// ── 이 검사가 하는 판정 ──────────────────────────────────────────────
// **게이트가 아니라 예산이다.** 184건 전부를 고치라고 요구하지 않는다 — 표가 작거나
// 실행이 드물면 OFFSET 도 괜찮다. 잠그는 것은 "**늘지 않는다**" 하나뿐이다.
// (형제 검사 `row-write-budget.test.ts` 와 같은 규약이다.)
//
// 기준선을 낮추는 것은 환영이다. 올리려면 **왜 이 OFFSET 이 안전한가**를 주석에 남긴다.
//
// ── 못 잡는 것 ───────────────────────────────────────────────────────
// 처음에는 「세려고 행을 받아 오는」 모양을 넓게 보려 했고 **388건**이 나왔다. 그건 결함
// 388개가 아니라 **규칙이 틀렸다**는 뜻이다 — 이 저장소가 「루프 애니메이션 금지」로 정당한
// 로더 20곳을 걸었을 때 배운 것이다. 그래서 기계가 확실히 가를 수 있는 하나만 잡는다.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { beforeAll, describe, expect, it } from 'vitest'

/** vitest 의 cwd 는 apps/web 이다(다른 회귀들과 같은 규약). */
const REPO_ROOT = resolve(process.cwd(), '..', '..')
const SCANNER = join(REPO_ROOT, 'scripts', 'lib', 'scan-offset-paging.mjs')

type Hit = { file: string; line: number; table: string; shape: string; snippet: string }
type Scanner = { scanFile: (file: string) => Hit[]; walk: (dir: string, out?: string[]) => string[]; ROOTS: string[] }

/** 예산. 2026-09-06 실측치 — 네 건을 커서로 고친 **뒤**의 수다. */
const BASELINE = 184

let scanner: Scanner

beforeAll(async () => {
  scanner = (await import(pathToFileURL(SCANNER).href)) as unknown as Scanner
})

/** 임시 파일 하나를 스캐너에 물린다 — 저장소를 안 건드린다(워크스페이스 공유). */
function scanSource(source: string, name = 'probe.mts'): Hit[] {
  const dir = mkdtempSync(join(tmpdir(), 'offsetpage-'))
  const file = join(dir, name)
  try {
    writeFileSync(file, source, 'utf8')
    return scanner.scanFile(file)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('OFFSET 페이징 예산', () => {
  it('저장소 전체 후보가 기준선을 넘지 않는다', () => {
    const files = scanner.ROOTS.flatMap((r) => scanner.walk(join(REPO_ROOT, r)))
    const hits = files.flatMap((f) => scanner.scanFile(f))

    if (hits.length > BASELINE) {
      const byFile = new Map<string, number>()
      for (const h of hits) byFile.set(h.file, (byFile.get(h.file) ?? 0) + 1)
      const worst = [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 8)
      throw new Error(
        `OFFSET 페이징이 ${BASELINE} → ${hits.length} 로 늘었다.\n` +
          `뒤 페이지가 앞을 다시 훑으므로 표가 커지면 반드시 느려진다 — 이 저장소에서\n` +
          `같은 이유로 네 개의 명령이 죽었다(가장 큰 것은 656,988행 · 657페이지).\n` +
          `고유한 열(대개 pk)로 커서를 잡으면 산출물은 같고 깊이 비용이 사라진다.\n` +
          `파일별 상위:\n${worst.map(([f, n]) => `  ${n}  ${f}`).join('\n')}`,
      )
    }
    expect(hits.length).toBeLessThanOrEqual(BASELINE)
  })

  // ── 스캐너가 눈멀지 않게 못 박는다 ──────────────────────────────────
  // 예산만 있으면 스캐너를 무력화하는 변경이 **숫자를 내리면서** 통과한다.

  it('변수 오프셋 페이징을 잡는다 — 네 사고가 전부 이 모양이었다', () => {
    const hits = scanSource(`
declare const db: any
async function probe() {
  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from('csat_dcp_items').select('type, v_level').order('id').range(from, from + 999)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
  }
  return rows.length
}
`)
    expect(hits.length).toBe(1)
    expect(hits[0]?.table).toBe('csat_dcp_items')
  })

  it('커서 페이징은 안 잡는다 — 그게 고친 모양이다', () => {
    const hits = scanSource(`
declare const db: any
async function probe() {
  let cursor: string | null = null
  for (;;) {
    let q = db.from('csat_dcp_items').select('id, type').order('id').limit(1000)
    if (cursor !== null) q = q.gt('id', cursor)
    const { data } = await q
    if (!data?.length) break
    cursor = data[data.length - 1].id
  }
}
`)
    expect(hits).toHaveLength(0)
  })

  it('이미 count 로 세는 질의는 안 잡는다 — 그게 정답이다', () => {
    const hits = scanSource(`
declare const db: any
async function probe(from: number) {
  return db.from('library_articles').select('id', { count: 'exact', head: true }).range(from, from + 999)
}
`)
    expect(hits).toHaveLength(0)
  })

  it('쓰기는 형제 검사(scan-row-writes)의 몫이라 안 잡는다', () => {
    const hits = scanSource(`
declare const db: any
async function probe(from: number, rows: any[]) {
  for (const r of rows) {
    await db.from('shared_dictionary').update({ meaning_ko: r.m }).eq('word', r.w).range(from, from + 1)
  }
}
`)
    expect(hits).toHaveLength(0)
  })
})
