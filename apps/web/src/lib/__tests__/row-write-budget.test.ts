// apps/web/src/lib/__tests__/row-write-budget.test.ts
//
// **루프 안 단건 쓰기 예산** — scripts/lib/scan-row-writes.mjs 를 실제로 돌린다.
//
// ── 왜 검사가 필요한가 ────────────────────────────────────────────────
// 이 저장소에는 같은 발상의 스캐너가 이미 하나 더 있다(scan-unpaged-queries.mjs).
// 그런데 **어떤 테스트에도 연결돼 있지 않아** 주석에서만 언급된다 — 즉 아무도 안 돌린다.
// 그 사이 2026-09-05·09-06 에 단건 쓰기 폭주가 두 번 났다:
//   · 09-05 07:37~09:36 /rest/v1/library_article_vocabularies 분당 최대 6,859건(초당 114)
//     → 체크포인트 109~272초 · statement timeout 분당 34건
//   · 09-06 02:0x /rest/v1/shared_dictionary 분당 1,995건 → DB 25분 전면 정지
// 스캐너를 만들어 두고 안 돌리면 없는 것과 같다. 그래서 검사가 돌린다.
//
// ── 이 검사가 하는 판정 ──────────────────────────────────────────────
// **게이트가 아니라 예산이다.** 135건 전부를 고치라고 요구하지 않는다 — 표가 작거나
// 실행이 드물면 문제가 아니다. 잠그는 것은 "**늘지 않는다**" 하나뿐이다.
// 새 드레인이 같은 함정에 빠지면 숫자가 올라가고 여기서 걸린다.
//
// 기준선을 낮추는 것은 환영이다 — 실제로 고쳤다면 BASELINE 을 그 수로 내리면 된다.
// 올리는 것은 근거(왜 이 단건 쓰기가 안전한가)를 주석에 남기고 해야 한다.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { beforeAll, describe, expect, it } from 'vitest'

/** vitest 의 cwd 는 apps/web 이다(다른 회귀들과 같은 규약). */
const REPO_ROOT = resolve(process.cwd(), '..', '..')
const SCANNER = join(REPO_ROOT, 'scripts', 'lib', 'scan-row-writes.mjs')

type Hit = {
  file: string
  line: number
  table: string
  dynamicTable?: boolean
  op: 'update' | 'delete'
  loopAt: number
  loop: string
  snippet: string
}

type Scanner = {
  scanFile: (file: string) => Hit[]
  walk: (dir: string, out?: string[]) => string[]
  ROOTS: string[]
}

/**
 * 예산. 2026-09-06 실측치다.
 *
 * 133 → 135 로 오른 것은 코드가 나빠져서가 아니라 **스캐너가 눈을 떠서**다:
 * 그전에는 `.from('문자열')` 만 봤고 `db.from(table)` 처럼 변수를 쓰는 형태를 통째로 놓쳤다.
 * 그 구멍 때문에 그날 측정된 **최악의 사례**(repair-first-sentence.mts, 초당 114건)가
 * 133건 목록에 없었다. 가장 큰 것을 못 보는 감시는 감시가 아니다.
 *
 * ── 135 → 140 (2026-09-08 재측정 · 근거) ──────────────────────────────
 * 예산을 올리는 것은 근거를 적고 해야 한다(이 파일의 규약). 근거는 **파일별 차이**다 —
 * 09-06 트리(같은 스캐너로 다시 훑음) 131건과 지금을 대조하면 늘어난 곳이 전부 이름을 갖는다:
 *
 *   +2  scripts/acp/backfill-source-ids.mjs      (9fd4698a · 일회성 중복 정정 백필)
 *   +2  scripts/acp/harvest-voa-sitemap.mjs      (4ec418b2 · 새 수확 경로)
 *   +1  scripts/compose/drain-coverage.mjs · drain-process.mjs
 *   +1  scripts/csat/analysis-drain-import.mjs · scripts/dict/drain-pending-words.mjs
 *   +1  apps/web/src/app/admin/compose/actions.ts · src/lib/vcb/compose/publish.ts
 *   +1  scripts/lcp/safety/apply-slur-verdicts.mjs
 *   -1  scripts/dict-quality/apply-pending-dict-migrations.ts (4 → 3)
 *
 * 전부 **회당 수십~수백 행짜리 일회성 백필·드레인**이고, 09-05/09-06 을 멈춘 경로
 * (수만 행 × 초당 100+)와는 자릿수가 다르다. 그래서 고치라고 요구하지 않고 예산만 옮긴다.
 * ⚠️ 다만 **여기서 한 칸이라도 더 오르면 그때는 근거를 다시 적어야 한다** — 이 목록이
 * 길어지는 것 자체가 「행마다 PATCH」가 여전히 기본 발상이라는 신호다.
 */
const BASELINE = 140

let scanner: Scanner

beforeAll(async () => {
  scanner = (await import(pathToFileURL(SCANNER).href)) as unknown as Scanner
})

/** 임시 파일 하나를 만들어 스캐너에 물린다 — 저장소를 건드리지 않는다(워크스페이스 공유). */
function scanSource(source: string, name = 'probe.mts'): Hit[] {
  const dir = mkdtempSync(join(tmpdir(), 'rowwrite-'))
  const file = join(dir, name)
  try {
    writeFileSync(file, source, 'utf8')
    return scanner.scanFile(file)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('루프 안 단건 쓰기 예산', () => {
  it('저장소 전체 후보가 기준선을 넘지 않는다', () => {
    const files = scanner.ROOTS.flatMap((r) => scanner.walk(join(REPO_ROOT, r)))
    const hits = files.flatMap((f) => scanner.scanFile(f))

    if (hits.length > BASELINE) {
      const byFile = new Map<string, number>()
      for (const h of hits) byFile.set(h.file, (byFile.get(h.file) ?? 0) + 1)
      const worst = [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 8)
      throw new Error(
        `루프 안 단건 쓰기가 ${BASELINE} → ${hits.length} 로 늘었다.\n` +
          `새 드레인이 행마다 PATCH 를 보내고 있지 않은지 볼 것 — 이 DB 는 초당 33건에서 25분 멈췄다.\n` +
          `대량 갱신은 jsonb 배열을 받는 RPC 하나로 넘긴다(예: repair_vocab_first_sentences).\n` +
          `파일별 상위:\n${worst.map(([f, n]) => `  ${n}  ${f}`).join('\n')}`,
      )
    }
    expect(hits.length).toBeLessThanOrEqual(BASELINE)
  })

  // ── 스캐너 자체가 무력화되는 것을 막는다 ────────────────────────────
  // 예산 검사만 있으면 스캐너를 눈멀게 하는 변경이 **숫자를 내리면서** 통과한다.
  // 그래서 "이건 반드시 잡아야 한다"를 따로 못 박는다.

  it('변수 테이블명(db.from(table))을 잡는다 — 2026-09-05 폭주를 만든 바로 그 형태', () => {
    const hits = scanSource(`
declare const db: any
async function probe(table: string, updates: Array<{ row: any; next: string }>) {
  const CONC = 3
  for (let i = 0; i < updates.length; i += CONC) {
    await Promise.all(updates.slice(i, i + CONC).map(async (u) => {
      const q = db.from(table).update({ first_sentence: u.next })
      const { error } = await (table === 'library_book_vocabularies'
        ? q.eq('id', u.row.id)
        : q.eq('library_article_id', u.row.library_article_id).eq('word', u.row.word))
      if (error) throw new Error(String(error))
    }))
  }
}
export default probe
`)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]!.dynamicTable).toBe(true)
    expect(hits[0]!.op).toBe('update')
  })

  it('문자열 테이블명의 루프 안 단건 갱신을 잡는다', () => {
    const hits = scanSource(`
declare const db: any
export async function probe(words: string[]) {
  for (const w of words) {
    await db.from('shared_dictionary').update({ meaning_ko: 'x' }).eq('word', w)
  }
}
`)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]!.table).toBe('shared_dictionary')
  })

  it('배치 관용구는 잡지 않는다 — 오탐이 쌓이면 목록을 통째로 무시하게 된다', () => {
    const clean = scanSource(`
declare const db: any
export async function probe(rows: Array<{ id: string }>) {
  for (let i = 0; i < rows.length; i += 500) {
    await db.from('shared_dictionary').upsert(rows.slice(i, i + 500), { onConflict: 'word' })
  }
}
`)
    expect(clean).toHaveLength(0)
  })

  it('RPC 로 넘기는 형태는 잡지 않는다 — 권장하는 모양이 걸리면 규칙이 틀린 것이다', () => {
    const clean = scanSource(`
declare const db: any
export async function probe(table: string, updates: Array<{ row: any; next: string }>) {
  for (let i = 0; i < updates.length; i += 500) {
    const payload = updates.slice(i, i + 500).map((u) => ({ id: u.row.id, first_sentence: u.next }))
    await db.rpc('repair_vocab_first_sentences', { p_table: table, p_rows: payload })
  }
}
`)
    expect(clean).toHaveLength(0)
  })
})

describe('repair-first-sentence 는 행 단위로 쓰지 않는다', () => {
  // 이 파일이 2026-09-05 폭주의 원인이었다. 되돌아오는 것을 이름으로 막는다.
  const TARGET = join(REPO_ROOT, 'scripts', 'dict', 'repair-first-sentence.mts')

  it('스캐너에 걸리지 않는다', () => {
    expect(scanner.scanFile(TARGET)).toHaveLength(0)
  })

  it('일괄 RPC 를 쓴다', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(TARGET, 'utf8')
    expect(src).toContain('repair_vocab_first_sentences')
    // 옛 모양이 돌아오면 여기서 걸린다.
    expect(src).not.toMatch(/db\.from\(table\)\.update\(/)
  })
})
