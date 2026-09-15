// scripts/lib/scan-offset-paging.mjs
//
// **OFFSET 으로 페이지를 넘기는 조회를 찾는다.**
//
// ── 왜 필요한가 (실측 2026-09-06, 하루에 네 번) ──────────────────────
// 같은 함정을 이 저장소에서 하루에 **네 번** 고쳤다. 매번 다른 파일, 매번 같은 모양이다 —
// 세거나 존재만 확인하면 되는데 **행을 통째로 받아 온다**:
//
//   · `gen-db-stats.mjs`  상태별 집계가 `library_articles` 91,358행을 1,000씩 OFFSET.
//     이 표는 본문을 담아 1,000행당 힙이 ~8 MB 라 700 MB 를 읽었고 12페이지에서 죽었다.
//   · `reprocess.mjs`     어휘 유무를 5개씩 묶어 행으로 셌다. PostgREST 가 1,000행에서
//     자르므로 잘린 글이 전부 "어휘 0" → **9,936편이라 답했다. 실제는 87편.**
//     그대로 `--commit` 했으면 멀쩡한 9,849편을 재분석했을 것이다.
//   · `store-new-types.mjs` 원글 두 편 때문에 V6 **13,041편을 본문째** 읽었다.
//   · `series-report.mjs` `csat_dcp_items` **656,988행**을 OFFSET 으로 훑어 타임아웃.
//     시리즈 전체를 보는 유일한 자가 그래서 몇 주째 죽어 있었다.
//
// 같은 날 DB 가 55분 전면 정지했고, 원인은 쓰기 폭주가 아니라 **읽기 포화**였다.
// 네 번 고쳤으면 다섯 번째가 온다 — 주석으로는 못 막는다.
//
// ── 무엇을 의심하는가 ────────────────────────────────────────────────
// `.select(...)` 로 행을 받아 오는데, 그 결과가 **세거나 존재만 확인하는 데** 쓰이는 형태:
//   ① 페이지 루프(`.range(`) 가 있는데 받은 것을 `count`·`length`·`Set`·`Map` 으로만 접는다
//   ② `.in(...)` 로 여러 키를 묶어 받아 `Set`/`Map` 에 넣어 "있나 없나" 를 본다
//
// **가드로 인정하는 것**(후보에서 뺀다):
//   · `count:` 를 이미 쓰는 질의 — 그게 정답이다
//   · `head: true` — 행을 안 받는다
//   · 받은 행의 필드를 실제로 **쓰는** 흔적(`.map(` 안에서 두 개 이상의 속성 접근 등)은
//     이 스캐너가 못 가르므로 **좁게 잡는다**: 접는 연산이 `length`/`size`/`add`/`set` 뿐일 때만.
//
// 판정은 **후보**다 — 표가 작거나 실행이 드물면 문제가 아니다.
// (CLAUDE.md 의 교훈: 판정을 좁히지 못하면 규칙이 틀린 것이다.)
//
// 재실행 안전: 읽기만 한다.
// 실행: node scripts/lib/scan-offset-paging.mjs [--json]
//   종료 코드는 항상 0 — 게이트가 아니라 목록이다.

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOTS = ['scripts', 'apps/web/src', 'packages']
const EXT = new Set(['.ts', '.tsx', '.mjs', '.mts', '.js'])
const SKIP = /node_modules|\.next|dist|build|__tests__|\.test\.|\.spec\./

/** 체인·소비를 함께 보려면 창이 넓어야 한다 — 받는 줄과 접는 줄이 떨어져 있다. */
const WINDOW_CHARS = 900

/** 이미 제대로 세고 있는 형태 — 후보가 아니다. */
const ALREADY_COUNTING = /count\s*:\s*['"]exact['"]|head\s*:\s*true/

export function walk(dir, out = []) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (SKIP.test(full)) continue
    if (e.isDirectory()) walk(full, out)
    else if (e.isFile() && EXT.has(path.extname(e.name))) out.push(full)
  }
  return out
}

export function scanFile(file) {
  const src = fs.readFileSync(file, 'utf8')
  const lines = src.split(/\r?\n/)
  const hits = []

  for (let i = 0; i < lines.length; i += 1) {
    if (!/\.from\s*\(/.test(lines[i])) continue
    const offset = lines.slice(0, i).reduce((n, l) => n + l.length + 1, 0)
    const window = src.slice(offset, offset + WINDOW_CHARS)

    if (!/\.select\s*\(/.test(window)) continue
    // 이미 세고 있으면 후보가 아니다.
    if (ALREADY_COUNTING.test(window)) continue
    // 쓰기는 다른 스캐너(scan-row-writes)의 몫이다.
    if (/\.(update|delete|upsert|insert)\s*\(/.test(window)) continue

    // **OFFSET 페이징만 잡는다.** 처음에는 「세려고 행을 받는」 모양을 넓게 봤는데
    // 388건이 나왔다 — 그건 결함 388개가 아니라 **규칙이 틀렸다**는 뜻이다
    // (이 저장소가 「루프 애니메이션 금지」로 정당한 로더 20곳을 걸었을 때 배운 것).
    // 기계가 확실히 가를 수 있는 것은 하나다: 변수 오프셋으로 넘기는 `.range(from, …)`.
    // 뒤 페이지일수록 앞을 다시 훑으므로 표가 커지면 **반드시** 느려지고, 커서로 바꾸면
    // 산출물이 같다. 실측한 네 사고 중 셋이 이 모양이었다.
    const paged = /\.range\s*\(\s*[A-Za-z_$][\w$]*/.test(window)
    if (!paged) continue

    const table =
      /\.from\s*\(\s*['"`]([a-z_][a-z0-9_]*)['"`]\s*\)/i.exec(lines[i])?.[1] ??
      /\.from\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/.exec(lines[i])?.[1] ??
      '(알 수 없음)'

    hits.push({
      file: path.relative(process.cwd(), file).replace(/\\/g, '/'),
      line: i + 1,
      table,
      shape: paged ? 'range' : 'in',
      snippet: lines[i].trim().slice(0, 100),
    })
  }
  return hits
}

export { ROOTS }

// ⚠️ Windows 에서는 `file://D:\…` 가 아니라 `file:///D:/…` 라 문자열 비교가 안 맞는다.
//   경로를 URL 로 바꿔 비교한다 — 이 파일을 직접 돌렸을 때만 출력한다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = ROOTS.flatMap((r) => walk(path.resolve(r)))
  const hits = files.flatMap((f) => scanFile(f))
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(hits, null, 1))
  } else {
    console.log(`OFFSET 페이징 후보 ${hits.length}건\n`)
    const byFile = new Map()
    for (const h of hits) byFile.set(h.file, (byFile.get(h.file) ?? 0) + 1)
    for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${f}`)
    console.log('\n후보다 — 표가 작거나 실행이 드물면 문제가 아니다. 큰 표부터 본다.')
  }
}
