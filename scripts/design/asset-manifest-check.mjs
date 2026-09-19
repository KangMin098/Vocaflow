// scripts/design/asset-manifest-check.mjs
//
// 이미지 체계 manifest(docs/design/asset-manifest.json)의 target 이 **실재하는지** 검사한다 — brief Gate 4 · C4.
// 실행: node scripts/design/asset-manifest-check.mjs   (실패가 하나라도 있으면 exit 1)
//
// 판정 (항목마다):
//   ① target.component 파일이 있다
//   ② target.file(있으면)이 있다
//   ③ target.route 가 app 라우터의 page.tsx 하나로 풀린다(route group `(x)` 는 경로에서 지운다)
//   ④ 그 page.tsx 에서 import 를 따라가면 component 에 닿는다(깊이 ≤ 6). component 가 page 자신이면 통과.
//      tsx/ts 가 아닌 component(manifest.json 등)는 ①만 본다.
//   status 'blocked' 는 target 이 null 이어야 하고 note 에 이유가 있어야 한다.
// 경로 치환은 정규화한 '/' 로만 비교한다(저장소는 CRLF/LF 혼재 · Windows 경로 — AGENTS.md 「하지 말 것」).

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const APP = join(ROOT, 'apps/web/src/app')
const SRC = join(ROOT, 'apps/web/src')
const norm = (p) => p.replace(/\\/g, '/')

function pages(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) pages(p, out)
    else if (n === 'page.tsx') out.push(p)
  }
  return out
}
const ROUTES = new Map()
for (const p of pages(APP)) {
  const r = '/' + norm(relative(APP, dirname(p))).split('/').filter((s) => s && !/^\(.*\)$/.test(s)).join('/')
  ROUTES.set(r === '/' ? '/' : r.replace(/\/$/, ''), p)
}

const EXT = ['', '.tsx', '.ts', '/index.tsx', '/index.ts']
function resolveImport(from, spec) {
  let base
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec)
  else return null
  for (const e of EXT) { const p = base + e; if (existsSync(p) && statSync(p).isFile()) return p }
  return null
}
const IMPORT = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g
function reaches(page, target, maxDepth = 6) {
  const want = norm(target)
  const seen = new Set([norm(page)])
  let frontier = [page]
  for (let d = 0; d <= maxDepth && frontier.length; d++) {
    const next = []
    for (const f of frontier) {
      if (norm(f) === want) return d
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(IMPORT)) {
        const p = resolveImport(f, m[1] ?? m[2])
        if (p && !seen.has(norm(p))) { seen.add(norm(p)); next.push(p) }
      }
    }
    frontier = next
  }
  return -1
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'docs/design/asset-manifest.json'), 'utf8'))
const fails = []
const rows = []
for (const it of manifest.items) {
  if (it.status === 'blocked') {
    if (it.target !== null || !it.note) fails.push(`${it.id}: blocked 는 target=null + note 필수`)
    rows.push([it.id, 'blocked', '—'])
    continue
  }
  const t = it.target
  const comp = join(ROOT, t.component)
  if (!existsSync(comp)) { fails.push(`${it.id}: component 없음 ${t.component}`); rows.push([it.id, 'FAIL', 'component']); continue }
  if (t.file && !existsSync(join(ROOT, t.file))) { fails.push(`${it.id}: file 없음 ${t.file}`); rows.push([it.id, 'FAIL', 'file']); continue }
  const page = ROUTES.get(t.route)
  if (!page) { fails.push(`${it.id}: route 가 page.tsx 로 안 풀린다 ${t.route}`); rows.push([it.id, 'FAIL', 'route']); continue }
  if (!/\.tsx?$/.test(t.component)) { rows.push([it.id, 'ok', 'file']); continue }
  // layout.tsx · opengraph-image.tsx 처럼 page 가 import 하지 않는 라우트 파일은 같은 라우트 폴더(또는 상위)에 있으면 통과
  // 앱 루트의 opengraph-image.tsx 도 라우트 파일이다(첫 판 정규식은 루트를 못 잡았다 — og-root 추가 때 발견)
  const routeFile = /\/app\/(?:.*\/)?(layout|opengraph-image)\.tsx$/.test(norm(comp))
  if (routeFile) {
    const ok = norm(dirname(page)).startsWith(norm(dirname(comp)))
    if (!ok) fails.push(`${it.id}: 라우트 파일이 ${t.route} 의 조상 폴더가 아니다`)
    rows.push([it.id, ok ? 'ok' : 'FAIL', 'route-file'])
    continue
  }
  const d = reaches(page, comp)
  if (d < 0) fails.push(`${it.id}: ${t.route} 에서 import 로 ${t.component} 에 닿지 않는다`)
  rows.push([it.id, d < 0 ? 'FAIL' : 'ok', d < 0 ? 'unreached' : `depth ${d}`])
}

for (const r of rows) console.log(r.join('\t'))
const live = rows.filter((r) => r[1] !== 'blocked')
console.log(`\n실재 ${live.filter((r) => r[1] === 'ok').length}/${live.length} · blocked ${rows.length - live.length}`)
if (fails.length) { console.error('\n' + fails.join('\n')); process.exit(1) }
