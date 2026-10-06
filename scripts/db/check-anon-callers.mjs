// scripts/db/check-anon-callers.mjs
//
// manifest 에서 anon 실행이 없는 함수(PUBLIC_RPC 외)를 **비로그인 경로**가 부르면 실패한다.
// 비로그인 경로 = lib/auth/protected-routes.ts 의 PUBLIC_PREFIXES 아래 페이지 · app/sitemap.ts · anon 키를 직접 쓰는 파일.
// 호출 추적: 페이지(또는 그 페이지가 import 하는 파일)를 따라 import 그래프를 깊이 4 까지 펼쳐 `.rpc('이름')` 을 모은다.
// 한계: 로그인 여부로 분기해 부르는 경우(if (user) …)도 잡힌다 — 그런 것은 manifest 항목에 anon_branch_ok: '근거' 로 적어 통과시킨다.
// 실행: node scripts/db/check-anon-callers.mjs   (DB 접속 없음)
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve('apps/web/src')
const man = JSON.parse(fs.readFileSync('scripts/db/function-exec-manifest.json', 'utf8')).functions
const anonOk = new Set(Object.entries(man).filter(([, m]) => m.class === 'PUBLIC_RPC' || m.anon_branch_ok).map(([s]) => s.split('(')[0]))
const known = new Set(Object.keys(man).map((s) => s.split('(')[0]))

const prot = fs.readFileSync(path.join(SRC, 'lib/auth/protected-routes.ts'), 'utf8')
const pubBlock = prot.slice(prot.indexOf('PUBLIC_PREFIXES'), prot.indexOf('] as const', prot.indexOf('PUBLIC_PREFIXES')))
const PUBLIC = [...pubBlock.matchAll(/'(\/[^']*)'/g)].map((m) => m[1])

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p, acc) }
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) acc.push(p)
  }
  return acc
}
const files = walk(SRC)
const routeOf = (f) => {
  const rel = path.relative(path.join(SRC, 'app'), f).replace(/\\/g, '/')
  if (rel.startsWith('..')) return null
  return '/' + rel.split('/').filter((s) => !/^\(.*\)$/.test(s)).slice(0, -1).join('/')
}
const isPublicRoute = (r) => r !== null && !r.startsWith('/admin') && !r.startsWith('/api') && PUBLIC.some((p) => p === '/' ? r === '/' : (r === p || r.startsWith(p + '/')))
const entries = files.filter((f) => {
  const r = routeOf(f)
  if (/app[\\/]sitemap\.ts$/.test(f)) return true
  return /[\\/](page|layout)\.tsx?$/.test(f) && isPublicRoute(r)
})

const resolveImport = (from, spec) => {
  let base
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec)
  else return null
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return base + ext
  return null
}
const fails = []
for (const entry of entries) {
  const seen = new Set([entry]); let frontier = [entry]
  for (let depth = 0; depth < 4 && frontier.length; depth++) {
    const next = []
    for (const f of frontier) {
      const s = fs.readFileSync(f, 'utf8')
      // .rpc('x') 와 bind 된 rpc('x') 둘 다 — 문법 매칭만으로는 래퍼를 놓칠 수 있어 check-revoked-callers 가 이름 문자열로 한 번 더 본다
      for (const m of s.matchAll(/\brpc\s*(?:<[^>]*>)?\(\s*['"]([a-z_0-9]+)['"]/g)) {
        const n = m[1]
        if (known.has(n) && !anonOk.has(n)) fails.push({ route: routeOf(entry) ?? 'sitemap', file: path.relative(SRC, f).replace(/\\/g, '/'), rpc: n })
      }
      for (const m of s.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)) {
        if (/^import\s+type\b/.test(m[0])) continue
        const t = resolveImport(f, m[1]); if (t && !seen.has(t)) { seen.add(t); next.push(t) }
      }
    }
    frontier = next
  }
}
const uniq = [...new Map(fails.map((f) => [`${f.rpc}|${f.file}`, f])).values()]
if (uniq.length) {
  for (const f of uniq) console.log(`FAIL ${f.rpc} ← ${f.file} (비로그인 경로 ${f.route})`)
  console.log(`\n비로그인 경로에서 anon 실행이 없는 RPC 호출 ${uniq.length}건 — PUBLIC_RPC 로 바꾸거나, 로그인 분기 안이면 manifest 에 anon_branch_ok 근거를 적는다`)
  process.exitCode = 1
} else console.log(`통과 — 비로그인 진입 ${entries.length}개의 import 그래프(깊이 4)에 anon 불가 RPC 호출 없음`)
