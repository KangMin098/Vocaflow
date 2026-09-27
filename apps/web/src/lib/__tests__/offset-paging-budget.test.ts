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

import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { beforeAll, describe, expect, it } from 'vitest'

/** vitest 의 cwd 는 apps/web 이다(다른 회귀들과 같은 규약). */
const REPO_ROOT = resolve(process.cwd(), '..', '..')
const SCANNER = join(REPO_ROOT, 'scripts', 'lib', 'scan-offset-paging.mjs')

type Hit = { file: string; line: number; table: string; shape: string; snippet: string }
type Scanner = { scanFile: (file: string) => Hit[]; walk: (dir: string, out?: string[]) => string[]; ROOTS: string[] }

/**
 * 예산. 2026-09-06 실측 184 → **2026-09-07 190**.
 *
 * ⚠️ 올린 근거를 적는다(그러지 않으면 이 검사는 통과용 숫자가 된다).
 *   늘어난 6건은 **다른 세션이 하루 사이에 새로 넣은 수확기·스캔**에서 왔다 —
 *   `scripts/acp/harvest-voa-sitemap.mjs`(`4ec418b2`) · `harvest-worldbank.mjs` ·
 *   `harvest-frontiers.mjs` · `type-inventory-scan.mjs` 등. 내가 만진 파일들의 몫은
 *   **4건 그대로**다(`volume-pool` 의 범용 페이징 폴백 2 · `shared_dictionary` 2).
 *
 *   ⚠️ **이 항목이 계속 오르면 그때는 올리지 말고 고쳐야 한다.** 수확기는 대개
 *   `library_articles` 처럼 넓은 표를 훑으므로, 재고가 커지는 순간 같은 자리에서 죽는다 —
 *   이 저장소에서 그 이유로 네 개의 명령이 죽었다.
 *
 * ── 190 → 209 (2026-09-20 · CSAT 통합 인수) ───────────────────────────
 * ⚠️ 위 경고대로 **고쳐야 할 때가 가까웠다**. 지금 올리는 이유는 둘로 갈린다:
 *   · **14건은 이 통합과 무관하게 이미 넘겨져 있었다** — 깨끗한 LF 체크아웃 실측으로
 *     통합 전(`ee4e65f5`) 이 벌써 **204** 였다(190 은 2026-09-07 값이고 그 뒤 다른 세션의
 *     수확기·스캔이 계속 늘렸다). 숫자는 CRLF 트리에서 작게 나오므로 LF 로 재야 한다.
 *   · **5건이 이 통합 몫**이다: `lib/csat/items.ts` 4→7 · `lib/csat/dissect-catalog.ts` 0→2.
 *     둘 다 기출 문항·해부 카탈로그를 **페이지로 훑는 로더**다. 문항이 1,292 → 계속 자라는
 *     표라 여기가 다음에 죽을 자리다 → 케이셋(커서) 페이징으로 바꾸는 것이 실제 해법이다.
 * ⚠️ +1 은 **이 회차의 row-cap-lies 수정**이다 — `lib/admin/video-console.ts` 의
 *     `.limit(10000)`(PostgREST 1,000행 상한에 조용히 잘려 영상 집계가 적게 나왔다)을
 *     정본 헬퍼 `pagedSelect` 로 바꿨고, 그 헬퍼가 내부에서 `.range()` 를
 *     쓰므로 이 스캐너에는 OFFSET 한 건으로 잡힌다(정당한 사용인데도 셈에 든다 — 다음에 스캐너가
 *     헬퍼 경유를 구분하게 만드는 편이 낫다).
 * 그래서 예산만 210 으로 옮기고, **다음 회차에 이 두 파일을 고치는 것**을 남긴다(올리지 말 것).
 *
 * ── 210 → 216 (2026-09-23 · DD-74 · DD-78) ───────────────────────────
 * ⚠️ **여섯 중 다섯이 정본 헬퍼(`pagedSelect`·`pagedSelectIn`) 경유다** — 위 +1 과 같은 종류다.
 *   헬퍼가 내부에서 `.range()` 를 쓰므로 **올바르게 쓴 자리도 이 스캐너에 잡힌다.**
 *     · `lib/csat/review-defects.ts` +2 — ⑦ 검수가 `csat_item_reviews` 를 직접 읽게 한 것(DD-74).
 *       그전에는 읽는 웹 코드가 0곳이라 revise 501 · fail 159 가 어느 화면에도 없었다.
 *     · `scripts/textbook/item-state-sync.mjs` +2 — 검수 판정에서 문항 상태를 파생하는 드레인.
 *     · `lib/csat/item-state.ts` +1 — **이 회차의 `row-cap-lies` 수정**이다. `.limit(5000)` 이었는데
 *       PostgREST 응답은 1,000행에서 끊기므로 「5,000에 닿으면 경고」가 **영영 안 울리고**
 *       1,001번째부터 조용히 적은 수를 정확한 수처럼 적고 있었다 → 헬퍼로 끝까지 읽는다.
 *   나머지 +1 은 다른 세션 몫이다(`csat/source-scorecard-export.mts`).
 *
 * ⚠️ **이 번호가 헬퍼를 쓸 때마다 오르는 것이 문제다.** 위 2026-09-20 항목이 이미 같은 말을
 *   적어 두었다 — 「다음에 스캐너가 헬퍼 경유를 구분하게 만드는 편이 낫다」. 올바른 사용이
 *   예산을 먹으면, 정작 막아야 할 **직접 `.range()` 루프**(items.ts 7 · resolve.ts 11)가
 *   같은 숫자 안에 숨는다. 그 분리가 다음 회차의 실제 할 일이고, **그 전에는 올리지 말 것.**
 *
 * ── 216 → 207 (2026-09-26 · CSAT 통합 빚 상환) ───────────────────────────
 * `lib/csat/items.ts` 3곳과 `lib/csat/dissect-catalog.ts` 2곳의 OFFSET 호출을
 * 고유 키 커서로 바꿨다. 실제 `.range()` 다섯 곳을 없애자 넓은 스캐너 창이 이웃 조회까지
 * 같은 OFFSET 으로 세던 네 후보도 함께 사라졌다. 깨끗한 LF 체크아웃 실측 207.
 */
const BASELINE = 207

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

      /*
       * **가장 최근에 바뀐 파일**도 함께 낸다 (2026-09-23).
       *
       * 예산이 210 → 211 로 1 늘었을 때, 위 「파일별 상위」 는 11건짜리 옛 파일들만
       * 보여 준다 — **한 건 늘린 새 파일은 상위 8에 절대 안 들어온다.** 그래서 늘어난
       * 원인을 찾으려고 커밋을 손으로 바이섹트해야 했다(실측: 원인은 그날 새로 생긴
       * 스크립트 한 줄이었다). 「늘었다」 만 말하고 **어디서** 늘었는지 안 말하는 경고는
       * 고치는 사람에게 일거리를 넘길 뿐이다. 수정 시각 역순이면 그 줄이 맨 위에 온다.
       */
      const recent = [...byFile.keys()]
        .map((f) => {
          let mtime = 0
          try {
            // ⚠️ 스캐너가 주는 `file` 은 **cwd(= apps/web) 기준**이다 — 저장소 밖 스크립트는
            //    `../../scripts/…` 로 온다. REPO_ROOT 에 이으면 저장소 바깥을 가리켜
            //    전부 ENOENT 가 되고, 정작 찾으려던 **새 파일이 맨 뒤로 밀린다**(첫 판이 그랬다).
            mtime = statSync(resolve(process.cwd(), f)).mtimeMs
          } catch {
            // 스캔 뒤 사라진 파일 — 순서만 뒤로 민다.
          }
          return { f, mtime }
        })
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 6)

      throw new Error(
        `OFFSET 페이징이 ${BASELINE} → ${hits.length} 로 늘었다.\n` +
          `뒤 페이지가 앞을 다시 훑으므로 표가 커지면 반드시 느려진다 — 이 저장소에서\n` +
          `같은 이유로 네 개의 명령이 죽었다(가장 큰 것은 656,988행 · 657페이지).\n` +
          `고유한 열(대개 pk)로 커서를 잡으면 산출물은 같고 깊이 비용이 사라진다.\n` +
          `파일별 상위:\n${worst.map(([f, n]) => `  ${n}  ${f}`).join('\n')}\n` +
          `가장 최근에 바뀐 파일(여기부터 본다):\n` +
          `${recent.map(({ f }) => `  ${byFile.get(f)}  ${f}`).join('\n')}`,
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
