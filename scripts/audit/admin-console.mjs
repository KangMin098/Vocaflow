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
/** 레지스트리 키가 아니라 엔트리 **안쪽 속성** 이름 — 2칸 들여쓰기로 잡히면 오탐이 된다. */
const HELP_RESERVED = new Set(['screen', 'tabs', 'title'])
for (const hf of helpFiles) {
  const src = read(join(helpDir, hf))
  const tops = [...src.matchAll(/^ {2}'?([A-Za-z0-9\-_\/]+)'?:\s*\{/gm)]
  tops.forEach((m, idx) => {
    if (HELP_RESERVED.has(m[1])) return
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
  // 별칭 형태 — `'vocab-runs': RUNS_ENTRY,` 처럼 **다른 엔트리를 가리키는** 키.
  // 인라인 객체만 보면 이런 키가 통째로 안 보여서, 멀쩡한 화면이 "도움말 없음" 으로 찍혔다.
  for (const m of src.matchAll(/^ {2}'?([A-Za-z0-9\-_\/]+)'?:\s*([A-Za-z_$][\w$]*)\s*,/gm)) {
    if (HELP_RESERVED.has(m[1]) || helpEntries.has(m[1])) continue
    // 별칭이 가리키는 상수의 탭 목록은 알 수 없다 — 탭 검사는 원본 키에서 이미 한다.
    helpEntries.set(m[1], { file: `apps/web/src/lib/admin/help/${hf}`, tabs: [], alias: m[2] })
  }
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

/** 이 화면 위에 실제로 얹히는 layout.tsx 들 — 사용자가 보는 화면의 일부다. */
function ancestorLayouts(startDir) {
  const out = []
  let d = startDir
  while (d.startsWith(ADMIN_APP)) {
    const lay = join(d, 'layout.tsx')
    if (existsSync(lay)) out.push(lay)
    if (d === ADMIN_APP) break
    d = dirname(d)
  }
  return out
}

/**
 * **오직 다른 곳으로 보내기만 하는 화면** — `redirect()` 한 줄이 전부다.
 *
 * 그리는 것이 없으니 제목도 도움말도 있을 수 없다. 그런데도 축을 물으면 X 가 붙고,
 * 그 X 를 없애려고 **없는 화면에 도움말을 다는** 잘못된 수리를 하게 된다(실제로
 * `help/vocab.ts` 에 아무도 안 부르는 별칭이 그렇게 남아 있었다).
 * 런타임이 아니라 소스로 판별한다 — 이 저장소는 리다이렉트 껍데기에 반환형 `never` 를 쓴다
 * (e2e 의 `adminRedirectOnlyRoutes()` 가 같은 근거를 쓴다).
 */
function isRedirectOnly(pageFile) {
  const src = read(pageFile)
  return src.includes('redirect(') && src.includes('): never')
}

const rows = []
for (const p of adminPages) {
  // 레이아웃을 빼면 2차 내비(VcbSectionNav · FactoryRail)가 안 보여서
  // 「나갈 길이 없다」 는 오답이 나온다. 화면은 page + 그 위에 얹힌 layout 전부다.
  const files = [
    ...new Set([
      ...surfaceFiles(p.file),
      ...ancestorLayouts(p.dir).flatMap((l) => surfaceFiles(l)),
    ]),
  ]
  const blob = files.map((f) => read(f)).join('\n')
  const pageSrc = read(p.file)

  const depth = p.route.split('/').filter(Boolean).length // /admin = 1
  const parent = parentRoute(p.route)
  const parentPat = parent ? routePattern(parent) : null

  // back — 재는 것은 "부모 링크" 가 아니라 **탈출 경로가 있는가** 다.
  //   부모 링크만 세면 탭 내비로 형제 화면을 오가는 구간(VCB 처럼 섹션 루트가 redirect 인 곳)이
  //   억울하게 X 가 되고, 반대로 부모 링크 하나만 있고 갈 곳이 없는 화면이 O 가 된다.
  // 통과 조건: ① 1차 화면(사이드바가 늘 보인다) ② 조상 라우트로 가는 링크가 있다
  //           ③ 같은 부모 아래 형제 2개 이상으로 가는 섹션 내비가 있다
  const ancestors = []
  {
    const parts = p.route.split('/').filter(Boolean)
    for (let i = parts.length - 1; i >= 1; i--) {
      const cand = '/' + parts.slice(0, i).join('/')
      if (ROUTE_SET.has(cand)) ancestors.push(cand)
    }
  }
  const surfaceHrefs = new Set()
  for (const f of files) {
    if (!f.startsWith(ADMIN_APP) && !f.includes(`${sep}components${sep}admin${sep}`)) continue
    for (const m of read(f).matchAll(HREF_RE)) surfaceHrefs.add(normalizeHref(m[1]))
  }
  const linksToAncestor = ancestors.some((a) =>
    [...surfaceHrefs].some((h) => linkMatchesRoute(h, a)),
  )
  const siblings = [...ROUTE_SET].filter(
    (r) => r !== p.route && parent && parentRoute(r) === parent,
  )
  const siblingLinks = siblings.filter((s) =>
    [...surfaceHrefs].some((h) => linkMatchesRoute(h, s)),
  ).length
  const backLink = depth <= 2 || linksToAncestor || siblingLinks >= 2

  const isDynamic = p.route.includes('[')
  const inbound = inboundLinks(p.route)

  const mock = looksMock(files)

  // 이 화면이 조회하는 도움말 키 — 계약은 문자열이다.
  //
  // ⚠️ 예전에는 `screenKeys[0]` **하나만** 봤다. 그런데 blob 은 page + 임포트 + 레이아웃을
  //    이어 붙인 것이라, 첫 번째로 걸리는 `screen="..."` 이 **다른 파일의 것**일 수 있다.
  //    그래서 도움말이 멀쩡한 화면이 X 로 찍혔다. 화면이 부르는 키는 **전부** 검사한다.
  const screenKeys = [
    ...new Set([...blob.matchAll(/screen=["']([A-Za-z0-9\-_\/]+)["']/g)].map((m) => m[1])),
  ]
  // 대표 키는 page 파일 자신의 것을 우선한다(리포트 가독성용).
  const ownKeys = [...pageSrc.matchAll(/screen=["']([A-Za-z0-9\-_\/]+)["']/g)].map((m) => m[1])
  const helpKey = ownKeys[0] ?? screenKeys[0] ?? null
  const missingKeys = screenKeys.filter((k) => !helpEntries.has(k))
  // 탭 도움말 정합 — 레지스트리의 탭 라벨이 화면 소스에 실제 문자열로 존재하는가.
  const tabMisses = screenKeys.flatMap((k) => {
    const e = helpEntries.get(k)
    if (!e) return []
    return e.tabs
      .filter(
        (label) =>
          !blob.includes(`'${label}'`) &&
          !blob.includes(`"${label}"`) &&
          !blob.includes(`>${label}<`),
      )
      .map((label) => `${k}:${label}`)
  })

  const redirectOnly = isRedirectOnly(p.file)

  rows.push({
    route: p.route,
    file: rel(p.file),
    depth,
    redirectOnly,
    header: redirectOnly || /AdminPageHeader|<h1[ >]/.test(blob),
    help:
      redirectOnly ||
      (screenKeys.length > 0 && missingKeys.length === 0 && tabMisses.length === 0),
    helpKey,
    screenKeys,
    helpKeyMissing: missingKeys.length > 0,
    missingKeys,
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
const usedHelpKeys = new Set(rows.flatMap((r) => r.screenKeys ?? []))
const helpOrphans = [...helpScreens].filter((k) => !usedHelpKeys.has(k)) // 정의됐으나 아무 화면도 안 씀
const screensWithoutHelp = rows
  .filter((r) => !r.helpKey && !r.redirectOnly)
  .map((r) => r.route)
const helpKeyMissing = rows.filter((r) => r.helpKeyMissing).map((r) => `${r.route} → ${r.missingKeys.join(", ")}`)
const tabMismatches = rows
  .filter((r) => r.tabMisses.length)
  .map((r) => `${r.route} [${r.helpKey}] → ${r.tabMisses.join(' / ')}`)

// ── 전역: 정의되지 않은 CSS 변수 ────────────────────────────────────────────
//
// 왜 이걸 재는가: `var(--ok)` 처럼 없는 토큰을 쓰면 **오류가 나지 않는다.** 그 선언만
// 조용히 무시돼 색이 부모에서 상속되고, 그 화면만 다크 테마에 대응하지 못한다.
// 즉 눈으로 보지 않으면 영원히 안 잡히는 결함이라 자가 대신 잡아야 한다.
const TOKEN_SOURCES = [
  join(WEB_SRC, 'app', 'globals.css'),
  join(ROOT, 'packages', 'design-tokens', 'src', 'tokens.css'),
]
const definedTokens = new Set()
for (const f of TOKEN_SOURCES) {
  if (!existsSync(f)) continue
  for (const m of read(f).matchAll(/(--[A-Za-z0-9-]+)\s*:/g)) definedTokens.add(m[1])
}
// Tailwind 설정에서 선언한 것도 정의로 친다
const twCfg = ['tailwind.config.ts', 'tailwind.config.js'].map((n) =>
  join(ROOT, 'apps', 'web', n),
)
for (const f of twCfg) {
  if (!existsSync(f)) continue
  for (const m of read(f).matchAll(/(--[A-Za-z0-9-]+)/g)) definedTokens.add(m[1])
}

const undefinedTokens = []
if (definedTokens.size > 0) {
  const scanned = [
    ...walk(ADMIN_APP),
    ...walk(join(WEB_SRC, 'components', 'admin')),
  ].filter((p) => p.endsWith('.tsx') || p.endsWith('.ts'))
  for (const f of scanned) {
    const lines = read(f).split('\n')
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/var\((--[A-Za-z0-9-]+)(\s*,)?/g)) {
        // `var(--cefr-${level}-bg)` 처럼 템플릿 리터럴로 조립되는 토큰은 접두만 잡힌다 —
        // 실제 이름은 런타임에 완성되므로 여기서는 판정할 수 없다. 오탐을 내느니 건너뛴다.
        if (m[1].endsWith('-')) continue
        // `var(--x, fallback)` 은 없어도 fallback 이 그려진다 — 렌더 결함이 아니라 관례 문제라
        // 이 축(“색이 아예 안 나온다”)에서는 세지 않는다.
        if (m[2]) continue
        if (!definedTokens.has(m[1])) {
          undefinedTokens.push({ token: m[1], at: `${rel(f)}:${i + 1}` })
        }
      }
    })
  }
}

// ── 전역: 조회 실패를 0/빈값으로 뭉개는 자리 ────────────────────────────────
// `count ?? 0` 은 이 저장소가 실측으로 금지한 안티패턴이다 — head 요청은 **없는 테이블에도**
// count=null 을 준다. `if (err) return []` 도 같은 부류로, 장애를 "데이터 없음" 으로 바꾼다.
const swallowHits = []
{
  const scanned = [
    ...walk(ADMIN_APP),
    ...walk(join(WEB_SRC, 'components', 'admin')),
    ...walk(join(WEB_SRC, 'lib', 'admin')),
  ].filter((p) => p.endsWith('.tsx') || p.endsWith('.ts'))
  for (const f of scanned) {
    if (f.includes('__tests__')) continue
    const lines = read(f).split('\n')
    lines.forEach((line, i) => {
      // 주석 줄은 세지 않는다 — 이 안티패턴을 **금지한다고 적은 주석**이 위반으로 잡혔다.
      const t = line.trim()
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
      if (/\bcount\s*\?\?\s*0/.test(line)) {
        swallowHits.push({ kind: 'count??0', at: `${rel(f)}:${i + 1}` })
      }
      if (/if\s*\(\s*\w*[eE]rr\w*\s*(\|\||\)\s*)/.test(line) && /return\s*\[\]/.test(line)) {
        swallowHits.push({ kind: 'err→[]', at: `${rel(f)}:${i + 1}` })
      }
    })
  }
}

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
  undefinedTokens,
  swallowHits,
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

  console.log(`\n정의되지 않은 CSS 변수: ${undefinedTokens.length}`)
  const byToken = {}
  for (const u of undefinedTokens) (byToken[u.token] ??= []).push(u.at)
  for (const [t, at] of Object.entries(byToken))
    console.log(`  ${t}  ${at.length}곳  (예: ${at[0]})`)

  console.log(`\n조회 실패를 0/빈값으로 뭉개는 자리: ${swallowHits.length}`)
  for (const s of swallowHits.slice(0, 15)) console.log(`  [${s.kind}] ${s.at}`)
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
