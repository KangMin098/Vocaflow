// scripts/audit/admin-console.mjs
//
// Admin 콘솔 전수 감사 — READ ONLY. 정적 분석만 하고 아무것도 고치지 않는다.
//
// 왜 스크립트인가: "빈틈이 없다" 는 눈으로 훑어서 말할 수 없다. 화면 49개 × 축 8개는
// 사람이 세면 매번 다른 수가 나오고, 고친 뒤에 줄었는지도 알 수 없다. 그래서 **같은 입력에
// 같은 수**를 내는 자를 먼저 만든다. 이 파일이 그 자다.
//
// 축(axis) 8개 — 각 화면마다 O/X:
//   header   화면 제목(AdminPageHeader 또는 h1)이 있는가
//   help     화면도움말(AdminScreenHelp)이 배선됐는가
//   back     상위로 돌아가는 화면 안의 링크가 있는가 (깊이 2 이상만 해당)
//   nav      메뉴(사이드바·2차 내비)에서 도달 가능한가 (동적 라우트는 부모 목록에서 링크되면 통과)
//   loading  로딩 경계가 있는가 (자기 디렉터리 또는 admin 안 조상)
//   error    에러 경계가 있는가 (같은 규칙)
//   guard    서버 가드(requireAdmin)가 RSC 진입점에 있는가 (미들웨어와 2층)
//   nomock   하드코딩된 가짜 수치를 실측인 척 그리지 않는가
//
// 전역 검사:
//   deadLinks   코드 안의 /admin/... 링크 중 존재하지 않는 라우트를 가리키는 것
//   helpKeys    HELP_REGISTRY 키 ↔ 실제 라우트 슬러그 대조 (양방향 고아)
//   apiGuards   /api/**/route.ts 의 가드 종류 (JSON 401 vs RSC redirect vs 없음)
//
// 실행:  node scripts/audit/admin-console.mjs [--json] [--fail-under=<점수>]

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, relative, dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const WEB_SRC = join(ROOT, 'apps', 'web', 'src')
const ADMIN_APP = join(WEB_SRC, 'app', 'admin')
const API_APP = join(WEB_SRC, 'app', 'api')

const args = process.argv.slice(2)
const AS_JSON = args.includes('--json')
const failUnder = Number(
  (args.find((a) => a.startsWith('--fail-under=')) ?? '').split('=')[1] ?? NaN,
)

// ── 파일 유틸 ────────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const readCache = new Map()
function read(p) {
  if (!readCache.has(p)) {
    try {
      readCache.set(p, readFileSync(p, 'utf8'))
    } catch {
      readCache.set(p, '')
    }
  }
  return readCache.get(p)
}

function rel(p) {
  return relative(ROOT, p).split(sep).join('/')
}

// ── 라우트 열거 ──────────────────────────────────────────────────────────────
/** app 디렉터리 경로 → 라우트 경로 (route group `(x)` 제거) */
function dirToRoute(dir) {
  const r = relative(join(WEB_SRC, 'app'), dir).split(sep).filter(Boolean)
  const segs = r.filter((s) => !(s.startsWith('(') && s.endsWith(')')))
  return '/' + segs.join('/')
}

const adminPages = walk(ADMIN_APP)
  .filter((p) => p.endsWith(`${sep}page.tsx`))
  .map((p) => ({ file: p, dir: dirname(p), route: dirToRoute(dirname(p)) }))
  .sort((a, b) => a.route.localeCompare(b.route))

const ROUTE_SET = new Set(adminPages.map((p) => p.route))

// ── 임포트 그래프 (화면이 실제로 그리는 파일 전부) ───────────────────────────
function resolveImport(spec, fromFile) {
  let base = null
  if (spec.startsWith('@/')) base = join(WEB_SRC, spec.slice(2))
  else if (spec.startsWith('./') || spec.startsWith('../')) base = resolve(dirname(fromFile), spec)
  else return null // node_modules · workspace 패키지는 화면 표면이 아니다
  for (const cand of [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    join(base, 'index.tsx'),
    join(base, 'index.ts'),
  ]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand
  }
  return null
}

const IMPORT_RE = /(?:from\s+|import\s+)['"]([^'"]+)['"]/g

/** page.tsx 에서 시작해 지역 임포트를 depth 까지 따라간 파일 집합 */
function surfaceFiles(entry, maxDepth = 4) {
  const seen = new Set([entry])
  let frontier = [entry]
  for (let d = 0; d < maxDepth; d++) {
    const next = []
    for (const f of frontier) {
      const src = read(f)
      for (const m of src.matchAll(IMPORT_RE)) {
        const r = resolveImport(m[1], f)
        if (r && !seen.has(r)) {
          seen.add(r)
          next.push(r)
        }
      }
    }
    if (next.length === 0) break
    frontier = next
  }
  return [...seen]
}

// ── 메뉴에서 도달 가능한 라우트 집합 ─────────────────────────────────────────
// 사이드바만 보면 2차 내비(VcbSectionNav · FactoryRail · 파이프라인 안 탭)가 빠진다.
// 그래서 admin 화면 + admin 컴포넌트 전체에서 /admin 링크를 긁는다.
const NAV_SOURCES = [
  ...walk(join(WEB_SRC, 'components', 'admin')),
  ...walk(ADMIN_APP),
].filter((p) => p.endsWith('.tsx') || p.endsWith('.ts'))

const HREF_RE = /['"`](\/admin(?:\/[A-Za-z0-9\-_\[\]\.$\{\}\/]*)?)['"`]/g

/** 링크 문자열 → 라우트 (템플릿 리터럴의 ${...} 는 동적 세그먼트로 본다) */
function normalizeHref(h) {
  return h
    .replace(/\$\{[^}]*\}/g, ':p')
    .replace(/\[[^\]]+\]/g, ':p')
    .replace(/\/+$/, '')
    .split('?')[0]
}

function routePattern(route) {
  return route.replace(/\[[^\]]+\]/g, ':p')
}

/**
 * 링크가 이 라우트에 도달하는가 — 세그먼트 수가 같고, 라우트의 동적 칸(:p)은 무엇이든 받는다.
 * 문자열을 그대로 비교하면 `/admin/curation/preview/<uuid>` 같은 정상 링크가
 * "죽은 링크" 로 잘못 잡힌다. 자가 틀리면 이 감사 전체가 틀린다.
 */
function linkMatchesRoute(href, route) {
  const a = href.split('/').filter(Boolean)
  const b = routePattern(route).split('/').filter(Boolean)
  if (a.length !== b.length) return false
  return b.every((seg, i) => seg === ':p' || seg === a[i])
}

function resolvesToSomeRoute(href) {
  return [...ROUTE_SET].some((r) => linkMatchesRoute(href, r))
}

const linkedHrefs = new Map() // normalized href -> [file:line]
for (const f of NAV_SOURCES) {
  const src = read(f)
  const lines = src.split('\n')
  lines.forEach((line, i) => {
    for (const m of line.matchAll(HREF_RE)) {
      const key = normalizeHref(m[1])
      if (!key.startsWith('/admin')) continue
      if (!linkedHrefs.has(key)) linkedHrefs.set(key, [])
      linkedHrefs.get(key).push(`${rel(f)}:${i + 1}`)
    }
  })
}

// 링크가 자기 자신인 경우(그 화면 안에서 자기 href)를 빼고 센다
function inboundLinks(route) {
  const hits = [...linkedHrefs.entries()]
    .filter(([href]) => linkMatchesRoute(href, route))
    .flatMap(([, at]) => at)
  const own = adminPages.find((p) => p.route === route)
  const ownDir = own ? rel(own.dir) + '/' : null
  return hits.filter((h) => !(ownDir && h.startsWith(ownDir)))
}

// ── 도움말 레지스트리 ────────────────────────────────────────────────────────
const helpDir = join(WEB_SRC, 'lib', 'admin', 'help')
const helpFiles = existsSync(helpDir)
  ? readdirSync(helpDir).filter((f) => f.endsWith('.ts') && f !== 'types.ts' && f !== 'index.ts')
  : []

// 레지스트리 키 → { 정의 파일, 탭 라벨 목록 }
// 키는 화면이 `<AdminScreenHelp screen="키" />` 로 조회하는 문자열이고,
// 탭 키는 **화면에 보이는 라벨 그대로**다 — 라벨을 바꾸면 도움말이 조용히 사라진다.
const helpEntries = new Map()
for (const hf of helpFiles) {
  const src = read(join(helpDir, hf))
  const tops = [...src.matchAll(/^ {2}'?([A-Za-z0-9\-_\/]+)'?:\s*\{/gm)]
  tops.forEach((m, idx) => {
    const start = m.index
    const end = idx + 1 < tops.length ? tops[idx + 1].index : src.length
    const block = src.slice(start, end)
    const tabsMatch = block.match(/tabs:\s*\{([\s\S]*)$/)
    const tabs = []
    if (tabsMatch) {
      for (const t of tabsMatch[1].matchAll(/^ {4}'([^']+)':\s*\{/gm)) tabs.push(t[1])
    }
    helpEntries.set(m[1], { file: `apps/web/src/lib/admin/help/${hf}`, tabs })
  })
}
const helpScreens = new Set(helpEntries.keys())

// ── 목업 탐지 ────────────────────────────────────────────────────────────────
// "숫자 리터럴이 UI 로 흘러가는가" 를 본다. 상수 배열에 value/count/label 이 함께 있으면 후보.
const MOCK_HINT = /(?:value|count|total|delta|dau|mau|revenue)\s*:\s*['"]?[0-9][0-9,.%]*['"]?/i
function looksMock(files) {
  const hits = []
  for (const f of files) {
    if (!f.startsWith(ADMIN_APP) && !f.includes(`${sep}components${sep}admin${sep}`)) continue
    const lines = read(f).split('\n')
    lines.forEach((line, i) => {
      if (MOCK_HINT.test(line) && !/props|param|\bdata\b|row\.|stats\./i.test(line)) {
        hits.push(`${rel(f)}:${i + 1}`)
      }
    })
  }
  return hits
}

// ── 화면별 판정 ──────────────────────────────────────────────────────────────
function hasFileInAncestors(startDir, name) {
  let d = startDir
  while (d.startsWith(ADMIN_APP)) {
    if (existsSync(join(d, name))) return rel(join(d, name))
    if (d === ADMIN_APP) break
    d = dirname(d)
  }
  return null
}

function parentRoute(route) {
  const parts = route.split('/').filter(Boolean)
  for (let i = parts.length - 1; i > 1; i--) {
    const cand = '/' + parts.slice(0, i).join('/')
    if (ROUTE_SET.has(cand)) return cand
  }
  return route === '/admin' ? null : '/admin'
}

const rows = []
for (const p of adminPages) {
  const files = surfaceFiles(p.file)
  const blob = files.map((f) => read(f)).join('\n')
  const pageSrc = read(p.file)

  const depth = p.route.split('/').filter(Boolean).length // /admin = 1
  const parent = parentRoute(p.route)
  const parentPat = parent ? routePattern(parent) : null

  // back: 화면 표면 어딘가에 부모 라우트로 가는 링크가 있는가
  const backLink =
    depth <= 2
      ? true // 1차 화면은 사이드바가 늘 보이므로 별도 back 불필요
      : files.some((f) => {
          if (!f.startsWith(ADMIN_APP) && !f.includes(`${sep}components${sep}admin${sep}`))
            return false
          const src = read(f)
          for (const m of src.matchAll(HREF_RE)) {
            if (parent && linkMatchesRoute(normalizeHref(m[1]), parent)) return true
          }
          return false
        })

  const isDynamic = p.route.includes('[')
  const inbound = inboundLinks(p.route)

  const mock = looksMock(files)

  // 이 화면이 조회하는 도움말 키 — 계약은 문자열이다.
  const screenKeys = [...blob.matchAll(/screen=["']([A-Za-z0-9\-_\/]+)["']/g)].map((m) => m[1])
  const helpKey = screenKeys[0] ?? null
  const helpEntry = helpKey ? helpEntries.get(helpKey) : null
  // 탭 도움말 정합 — 레지스트리의 탭 라벨이 화면 소스에 실제 문자열로 존재하는가.
  const tabMisses = helpEntry
    ? helpEntry.tabs.filter((label) => !blob.includes(`'${label}'`) && !blob.includes(`"${label}"`) && !blob.includes(`>${label}<`))
    : []

  rows.push({
    route: p.route,
    file: rel(p.file),
    depth,
    header: /AdminPageHeader|<h1[ >]/.test(blob),
    help: !!helpKey && !!helpEntry && tabMisses.length === 0,
    helpKey,
    helpKeyMissing: !!helpKey && !helpEntry,
    tabMisses,
    back: backLink,
    nav: p.route === '/admin' ? true : inbound.length > 0,
    inbound: inbound.slice(0, 3),
    loading: hasFileInAncestors(p.dir, 'loading.tsx'),
    error: hasFileInAncestors(p.dir, 'error.tsx'),
    guard: /requireAdmin\s*\(/.test(pageSrc) || !!hasLayoutGuard(p.dir),
    clientOnly: /^'use client'/m.test(pageSrc),
    nomock: mock.length === 0,
    mockHits: mock.slice(0, 5),
    isDynamic,
    files: files.length,
  })
}

function hasLayoutGuard(startDir) {
  let d = startDir
  while (d.startsWith(ADMIN_APP)) {
    const lay = join(d, 'layout.tsx')
    if (existsSync(lay) && /requireAdmin\s*\(/.test(read(lay))) return rel(lay)
    if (d === ADMIN_APP) break
    d = dirname(d)
  }
  return null
}

// ── 전역: 죽은 링크 ──────────────────────────────────────────────────────────
const allSrc = walk(WEB_SRC).filter((p) => p.endsWith('.tsx') || p.endsWith('.ts'))
const routePatterns = new Set([...ROUTE_SET].map(routePattern))
const deadLinks = []
for (const f of allSrc) {
  const lines = read(f).split('\n')
  lines.forEach((line, i) => {
    for (const m of line.matchAll(HREF_RE)) {
      const key = normalizeHref(m[1])
      if (!key.startsWith('/admin')) continue
      if (resolvesToSomeRoute(key)) continue
      if (key.includes('...')) continue // 주석·문서 안의 자리표시자
      deadLinks.push({ href: key, at: `${rel(f)}:${i + 1}` })
    }
  })
}

// ── 전역: 도움말 키 계약 ─────────────────────────────────────────────────────
// 계약은 "라우트 슬러그" 가 아니라 화면이 실제로 넘기는 `screen="..."` 문자열이다.
const usedHelpKeys = new Set(rows.map((r) => r.helpKey).filter(Boolean))
const helpOrphans = [...helpScreens].filter((k) => !usedHelpKeys.has(k)) // 정의됐으나 아무 화면도 안 씀
const screensWithoutHelp = rows.filter((r) => !r.helpKey).map((r) => r.route)
const helpKeyMissing = rows.filter((r) => r.helpKeyMissing).map((r) => `${r.route} → ${r.helpKey}`)
const tabMismatches = rows
  .filter((r) => r.tabMisses.length)
  .map((r) => `${r.route} [${r.helpKey}] → ${r.tabMisses.join(' / ')}`)

// ── 전역: API 가드 ───────────────────────────────────────────────────────────
const apiRoutes = walk(API_APP).filter((p) => p.endsWith(`${sep}route.ts`))
const apiGuard = { json: [], rscRedirect: [], token: [], none: [] }
for (const f of apiRoutes) {
  const src = read(f)
  const name = rel(f).replace('apps/web/src/app/api/', '').replace('/route.ts', '')
  if (/requireAdminApi\s*\(/.test(src)) apiGuard.json.push(name)
  else if (/\brequireAdmin\s*\(/.test(src)) apiGuard.rscRedirect.push(name)
  else if (/INTERNAL_TOKEN|X-[A-Z]+-Token/.test(src)) apiGuard.token.push(name)
  else apiGuard.none.push(name)
}

// ── 점수 ─────────────────────────────────────────────────────────────────────
const AXES = ['header', 'help', 'back', 'nav', 'loading', 'error', 'guard', 'nomock']
function axisPass(r, a) {
  if (a === 'loading' || a === 'error') return !!r[a]
  return !!r[a]
}
const perAxis = Object.fromEntries(
  AXES.map((a) => [a, rows.filter((r) => axisPass(r, a)).length]),
)
const cells = rows.length * AXES.length
const passed = AXES.reduce((s, a) => s + perAxis[a], 0)
const score = cells ? (passed / cells) * 100 : 0

const report = {
  generatedAt: new Date().toISOString(),
  screens: rows.length,
  axes: AXES,
  perAxis,
  score: Number(score.toFixed(1)),
  passed,
  cells,
  deadLinks,
  helpOrphans,
  screensWithoutHelp,
  helpKeyMissing,
  tabMismatches,
  apiGuard: {
    total: apiRoutes.length,
    json: apiGuard.json.length,
    rscRedirect: apiGuard.rscRedirect,
    token: apiGuard.token,
    none: apiGuard.none,
  },
  rows,
}

if (AS_JSON) {
  console.log(JSON.stringify(report, null, 2))
} else {
  const pad = (s, n) => String(s).padEnd(n)
  console.log(`\nAdmin 콘솔 감사 — 화면 ${rows.length}개 × 축 ${AXES.length}개`)
  console.log(`점수 ${report.score}%  (${passed}/${cells} 칸 통과)\n`)
  console.log(
    pad('ROUTE', 44) + AXES.map((a) => pad(a.slice(0, 7), 8)).join(''),
  )
  for (const r of rows) {
    console.log(
      pad(r.route, 44) + AXES.map((a) => pad(axisPass(r, a) ? 'O' : 'X', 8)).join(''),
    )
  }
  console.log('\n축별 통과:')
  for (const a of AXES) console.log(`  ${pad(a, 10)} ${perAxis[a]}/${rows.length}`)
  console.log(`\n죽은 /admin 링크: ${deadLinks.length}`)
  for (const d of deadLinks.slice(0, 20)) console.log(`  ${d.href}  ← ${d.at}`)
  console.log(`\n도움말 — 정의됐으나 아무 화면도 안 쓰는 키: ${helpOrphans.length}`)
  if (helpOrphans.length) console.log(`  ${helpOrphans.join(', ')}`)
  console.log(`도움말 — 화면이 부르는데 항목이 없는 키: ${helpKeyMissing.length}`)
  if (helpKeyMissing.length) console.log(`  ${helpKeyMissing.join('\n  ')}`)
  console.log(`도움말 — 배선 자체가 없는 화면: ${screensWithoutHelp.length}`)
  if (screensWithoutHelp.length) console.log(`  ${screensWithoutHelp.join(', ')}`)
  console.log(`도움말 — 탭 라벨이 화면과 어긋난 곳: ${tabMismatches.length}`)
  if (tabMismatches.length) console.log(`  ${tabMismatches.join('\n  ')}`)
  const mocky = rows.filter((r) => !r.nomock)
  console.log(`\n목업 의심 화면: ${mocky.length}`)
  for (const r of mocky) console.log(`  ${r.route}  ← ${r.mockHits.join(', ')}`)
  console.log(
    `\nAPI 가드 — 총 ${apiRoutes.length} · JSON 401 ${apiGuard.json.length} · RSC redirect ${apiGuard.rscRedirect.length} · 토큰 ${apiGuard.token.length} · 없음 ${apiGuard.none.length}`,
  )
  if (apiGuard.rscRedirect.length) console.log(`  redirect: ${apiGuard.rscRedirect.join(', ')}`)
  if (apiGuard.none.length) console.log(`  없음: ${apiGuard.none.join(', ')}`)
  console.log('')
}

if (!Number.isNaN(failUnder) && score < failUnder) {
  console.error(`FAIL — 점수 ${score.toFixed(1)}% < 기준 ${failUnder}%`)
  process.exit(1)
}
