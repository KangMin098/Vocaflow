// scripts/audit/learner-linkgraph.mjs
//
// 학습자 표면의 **정적 링크 그래프** — 죽은 링크 · 고아 화면을 센다.
//
// ── 왜 런타임 훑기로 부족한가 ──────────────────────────────────────────
// `26-learner-sweep` 은 화면을 열어 **그 순간 보이는** 앞길을 누른다. 그래서
// 조건부로만 렌더되는 링크(빈 상태 · 에러 분기 · 권한 분기)는 영영 안 눌린다 —
// 학습자가 실제로 막히는 자리가 바로 거기다. 여기서는 **코드에 적힌 모든 목적지**를
// 라우트 표와 대조한다. 열지 않으므로 빠르고, 로그인·DB 상태에 좌우되지 않는다.
//
// 반대로 이 감사가 못 보는 것: 템플릿 문자열 목적지(`/text/${id}`)와 런타임 계산.
// 그건 런타임 훑기의 몫이다. 둘은 겹치지 않는다.
//
// 실행: node scripts/audit/learner-linkgraph.mjs   (저장소 루트에서)

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const APP = path.join(ROOT, 'apps/web/src/app')
const SRC = path.join(ROOT, 'apps/web/src')

/** app 디렉터리를 훑어 Next 라우트 패턴 목록을 만든다(동적 세그먼트 포함). */
function collectRoutes(kind) {
  const out = []
  const walk = (dir, url) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name)
      if (!fs.statSync(full).isDirectory()) continue
      const seg = name.startsWith('(') || name.startsWith('_') ? '' : '/' + name
      const child = url + seg
      if (fs.existsSync(path.join(full, kind))) out.push(child === '' ? '/' : child)
      walk(full, child)
    }
  }
  if (fs.existsSync(path.join(APP, kind))) out.push('/')
  walk(APP, '')
  return [...new Set(out)].sort()
}

const pageRoutes = collectRoutes('page.tsx')
const apiRoutes = collectRoutes('route.ts')

const ESCAPE = /[.*+?^${}()|[\]\\]/g

/** `/library/books/[bookId]` → 정규식 */
function toRe(pattern) {
  const body = pattern
    .split('/')
    .map((s) => {
      if (s.startsWith('[[...')) return '(?:.*)?'
      if (s.startsWith('[...')) return '.+'
      if (s.startsWith('[')) return '[^/]+'
      return s.replace(ESCAPE, '\\$&')
    })
    .join('/')
  return new RegExp('^' + body + '/?$')
}

const pageRes = pageRoutes.map((r) => [r, toRe(r)])
const apiRes = apiRoutes.map((r) => [r, toRe(r)])

function clean(url) {
  return url.split('?')[0].split('#')[0]
}

/**
 * 링크 URL 과 라우트 패턴을 **세그먼트 단위 양방향 와일드카드**로 맞춘다.
 *
 * 링크 쪽 `<seg>`(템플릿 자리)와 라우트 쪽 `[id]`(동적 자리)는 서로를 받아 준다.
 * 한쪽만 와일드카드로 보면 `/play/${slug}` 가 `/play/cascade` 같은 **정적 형제**로
 * 풀리는 것을 놓쳐 멀쩡한 링크를 죽은 링크로 부른다(첫 판이 그랬다).
 */
function resolveLink(url, routes) {
  const parts = clean(url).replace(/\/$/, '').split('/')
  const hits = []
  for (const r of routes) {
    const rp = r.replace(/\/$/, '').split('/')
    if (rp.length !== parts.length) {
      // catch-all 만 길이가 달라도 된다
      if (!rp.some((s) => s.startsWith('[...') || s.startsWith('[['))) continue
    }
    let ok = true
    for (let i = 0; i < Math.max(rp.length, parts.length); i++) {
      const a = parts[i]
      const b = rp[i]
      if (b && (b.startsWith('[...') || b.startsWith('[['))) break // 나머지 전부 흡수
      if (a === undefined || b === undefined) {
        ok = false
        break
      }
      if (b.startsWith('[')) continue // 동적 세그먼트 — 무엇이든 받는다
      if (a.includes('<seg>')) continue // 템플릿 자리 — 정적 형제 중 하나로 풀린다
      if (a !== b) {
        ok = false
        break
      }
    }
    if (ok) hits.push(r)
  }
  return hits
}

/** 소스 파일 전부(테스트 제외). */
function allFiles(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) allFiles(full, acc)
    else if (/\.(tsx?|mts)$/.test(name) && !/\.(test|spec)\./.test(name)) acc.push(full)
  }
  return acc
}

// `/dev/*` 는 개발자용 화면 목차다 — 거기엔 모든 화면이 적혀 있으므로 포함하면
// **모든 고아가 사라져** 감사가 항상 0을 답한다. 학습자 이동 수단이 아니므로 뺀다.
const files = allFiles(SRC).filter((f) => !f.replace(/\\/g, '/').includes('/src/app/dev/'))

// href="/…" · href={`/text/${id}`} · router.push('/…') · redirect('/…') · fetch('/api/…')
//
// ⚠️ 템플릿 목적지(`/text/${id}`)를 버리면 안 된다. 이 앱의 상세 화면은 **전부** 템플릿으로만
//    링크되므로, 버리는 순간 동적 라우트 전부가 "고아" 로 오보고된다(첫 판이 그랬다 —
//    50개가 고아로 찍혔는데 실제로는 대부분 템플릿 링크였다). `${…}` 를 한 세그먼트로 친다.
const LINK_RE = new RegExp(
  [
    '(?:href|action)=["\'](/[^"\'\\s>]*)["\']', // 따옴표 문자열
    '(?:href|action)=\\{?`(/[^`]*)`', //          템플릿 리터럴
    // 네비 설정 객체(`sidebar-config.ts` 의 `href: '/settings',`)도 **이동 수단**이다.
    // 이걸 빼면 사이드바로만 닿는 화면이 통째로 "고아" 로 찍힌다(실측: 19건 중 다수).
    '\\bhref:\\s*[`"\'](/[^`"\']*)[`"\']',
    'router\\.(?:push|replace|prefetch)\\(\\s*[`"\'](/[^`"\']*)[`"\']',
    '\\bredirect\\(\\s*[`"\'](/[^`"\']*)[`"\']',
    'fetch\\(\\s*[`"\'](/api/[^`"\'?]*)',
  ].join('|'),
  'g',
)

// ── 2층: **고아 판정 전용** 넓은 스캔 ─────────────────────────────────────────
//
// 왜 두 층인가 (실측 2026-09-06):
// 위 LINK_RE 는 "href:" **바로 뒤의 따옴표**만 본다. 그래서 이 저장소의 실제 링크 네 가지를
// 통째로 놓쳤고, 멀쩡히 닿는 화면이 "고아" 로 찍혔다 —
//   · 삼항        — href: id ? (템플릿 /text/<id>/echo) : '/library/books'
//   · 중첩 템플릿 — /login?next= 안에 encodeURIComponent(/comics/adapted/<id>)
//   · 경로 생성기 — lib/teacher/invite-link.ts 가 /join/<code> 를 만들어 반환
//   · 공유 링크   — lib/textfit/share.ts 의 /fit/s/<payload>
// 고아 10건 중 9건이 이 오보였다. 화면이 아니라 계측기가 틀린 것이다.
//
// ⚠️ 넓게 잡은 결과를 **죽은 링크 판정에 쓰지 않는다.** 경로처럼 생긴 문자열은 링크가 아닌
//    것도 많아서(설정 키·저장소 경로), 죽은 링크에 섞으면 그 신호가 잡음에 묻힌다.
//    2층은 오직 "이 화면을 코드가 목적지로 알고 있는가" 만 답한다.
const WIDE_RE = /[`"']([/][A-Za-z0-9_./$={}?&:-]*)[`"']/g

// API 도 같은 오보를 낸다 — 정규식이 fetch( 만 보는데 실제 호출은 이렇게 생겼다:
//   · <img src={`/api/pdcp/artifact?issueId=${id}`} />        (src=, href/fetch 아님)
//   · redirectTo: `${origin}/api/auth/callback`               (절대 URL 조립)
//   · postJson(`/api/admin/library/preview-gutenberg?id=…`)   (래퍼 함수)
// 그래서 줄 안 어디에 있든 /api/… 를 줍는다. **고아 판정에만** 쓴다(죽은 링크 아님).
const API_WIDE_RE = /[/]api[/][A-Za-z0-9_./$={}-]*/g

// 화면 도움말은 **산문**이다 — "화면에 버튼이 없다, DELETE /api/pdcp/issue 로 지워라" 처럼
// 앱이 부르지 않는다고 적어 둔 것도 있어서, 여기서 주우면 진짜 미사용을 가린다.
const PROSE_DIRS = ['apps/web/src/lib/admin/help/']

// ⚠️ **목록 파일은 2층에서 뺀다.** 레지스트리·사이트맵·보호경로표는 모든 경로를 적어 두므로
//    포함하면 고아가 **항상 0** 이 된다(/src/app/dev/ 를 뺀 것과 같은 이유).
const CATALOG_FILES = [
  'apps/web/src/lib/framework/learner-routes.ts',
  'apps/web/src/lib/framework/axes.ts',
  'apps/web/src/lib/framework/registry.ts',
  'apps/web/src/lib/auth/protected-routes.ts',
  'apps/web/src/lib/auth/redirect.ts',
  'apps/web/src/lib/seo/content-entries.ts',
  'apps/web/src/app/sitemap.ts',
  // robots 의 noindex 목록도 경로 카탈로그다 — 이것 때문에 /hub-lab 이 계속 '링크됨' 이었다.
  'apps/web/src/app/robots.ts',
]

/**
 * 레지스트리가 kind: 'redirect' 로 선언한 경로 — **목적지가 아니다.**
 * 옛 주소 호환용 별칭이라 들어오는 링크가 없는 게 정상이고, 고아로 세면 영영 안 사라진다.
 */
function redirectAliases() {
  const f = 'apps/web/src/lib/framework/learner-routes.ts'
  const full = path.join(ROOT, f)
  if (!fs.existsSync(full)) return new Set()
  const src = fs.readFileSync(full, 'utf8')
  const out = new Set()
  const re = /path:[ ]*'([^']+)'[^}]*?kind:[ ]*'redirect'/g
  let m
  while ((m = re.exec(src))) out.add(m[1])
  return out
}

/** `/text/${id}/echo` → `/text/<seg>/echo` (한 세그먼트로 취급). */
function normalizeTemplate(url) {
  return url.replace(/\$\{[^}]*\}/g, '<seg>')
}

const ASSET = /\.(png|jpe?g|svg|webp|ico|json|txt|xml|mp3|wav|webm|webmanifest|woff2?|css|js)$/i

const dead = []
const linkedPages = new Set()
const linkedApis = new Set()
/**
 * 이 파일이 **자기 자신인 라우트** — 없으면 null.
 *
 * 왜 필요한가 (실측 2026-09-06): /hub-lab 은 자기 안의 LabBar 가 /hub-lab?v=... 로
 * 링크할 뿐, **바깥 어디에서도 들어오는 길이 없다.** 그런데 그 자기 링크 하나 때문에
 * 감사는 계속 "링크됨" 이라 답했고, 같은 화면이 사람 감사에서는 고아 결함(M12)으로
 * 따로 적혔다 — 계측기가 사람보다 늦었다.
 *
 * ⚠️ **자식→부모 링크는 지우지 않는다.** /library/books/[id] 가 /library/books 로
 *    돌아가는 것은 다른 화면에서 오는 정상 링크다. 정확히 같은 라우트일 때만 뺀다.
 */
function selfRouteOf(relPath) {
  const appRel = 'apps/web/src/app/'
  if (!relPath.startsWith(appRel)) return null
  const segs = relPath.slice(appRel.length).split('/')
  segs.pop()
  const kept = segs.filter((x) => x && !x.startsWith('(') && !x.startsWith('_'))
  return '/' + kept.join('/')
}

/**
 * 2층 전용 **엄격** 매칭.
 *
 * ⚠️ 1층의 resolveLink 를 2층에 그대로 쓰면 안 된다 — 거기서는 <seg> 가 "정적 형제 중
 *    하나로 풀린다" 고 보아 **정적 세그먼트에도 맞는다.** 2층은 훨씬 넓게 문자열을 줍기
 *    때문에, 어딘가의 한 세그먼트 템플릿 하나가 /<seg> 로 정규화되면 **최상위 라우트
 *    전부**가 "링크됨" 이 되어 고아가 영원히 0 이 된다.
 *    (실측 2026-09-06: 링크 없는 화면을 일부러 심었는데 감사가 0 을 답했다 — 변이 검사가
 *     아니었으면 "고아 0" 을 성과로 적을 뻔했다.)
 *
 * 그래서 여기서는 <seg> 를 **동적 세그먼트에만** 맞춘다.
 */
/** resolveStrict 의 라우트 집합 일반화판. */
function resolveStrict2(url, routes) {
  const parts = url.split('/').filter(Boolean)
  const out = []
  for (const r of routes) {
    const rp = r.split('/').filter(Boolean)
    if (rp.length !== parts.length) continue
    let ok = true
    for (let i = 0; i < rp.length; i++) {
      const a = parts[i]
      const b = rp[i]
      const dyn = b.startsWith('[')
      if (a.includes('<seg>')) {
        if (!dyn) { ok = false; break }
        continue
      }
      if (a === b || dyn) continue
      ok = false
      break
    }
    if (ok) out.push(r)
  }
  return out
}

function resolveStrict(url) {
  const parts = url.split('/').filter(Boolean)
  const out = []
  for (const r of pageRoutes) {
    const rp = r.split('/').filter(Boolean)
    if (rp.length !== parts.length) continue
    let ok = true
    for (let i = 0; i < rp.length; i++) {
      const a = parts[i]
      const b = rp[i]
      const dyn = b.startsWith('[')
      if (a.includes('<seg>')) {
        if (!dyn) { ok = false; break }
        continue
      }
      if (a === b || dyn) continue
      ok = false
      break
    }
    if (ok) out.push(r)
  }
  return out
}

/**
 * 경로 **접두사 상수**가 가리키는 동적 자식들.
 *
 * 이 앱의 공유 링크는 상수 + 동적 조각으로 만들어진다 — lib/textfit/share.ts 의
 * SHARE_PATH = '/fit/s' 에 payload 를 붙여 /fit/s/<payload> 가 된다. 문자열 하나만 보면
 * 전체 경로가 어디에도 안 적혀 있어 그 화면이 "고아" 로 찍힌다(실측 2026-09-06).
 *
 * ⚠️ **남는 세그먼트가 전부 동적일 때만** 인정한다. 그냥 접두사 일치로 열어 두면
 *    /text 하나가 /text 아래 화면 전부의 고아 판정을 지워 버린다.
 */
function dynamicChildrenOf(prefix) {
  if (!prefix || prefix === '/') return []
  const base = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
  const out = []
  for (const r of pageRoutes) {
    if (r === base || !r.startsWith(base + '/')) continue
    const rest = r.slice(base.length + 1).split('/')
    if (rest.length && rest.every((seg) => seg.startsWith('['))) out.push(r)
  }
  return out
}

/** 2층이 "목적지로 알고 있다" 고 답한 화면. **고아 판정에서만** 쓴다. */
const mentionedPages = new Set()
const mentionedApis = new Set()

for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/')
  const lines = fs.readFileSync(f, 'utf8').split('\n')
  const selfRoute = selfRouteOf(rel)
  lines.forEach((line, i) => {
    // 주석 줄은 코드가 아니다 — 설명문의 예시 URL(`/play/...` · `/ebooks/...`)을
    // 죽은 링크로 세면 감사 결과가 잡음으로 덮인다.
    const t = line.trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
    LINK_RE.lastIndex = 0
    let m
    while ((m = LINK_RE.exec(line))) {
      const raw = (m[1] || m[2] || m[3] || m[4] || m[5] || m[6] || '').trim()
      if (!raw || raw.startsWith('//')) continue
      const url = normalizeTemplate(raw)
      // `${}` 밖의 중괄호는 JSX 표현식 조각이 잘려 들어온 것 — 목적지로 못 읽는다.
      if (url.includes('{') || url.includes('}')) continue
      const c = clean(url)
      if (url.startsWith('/api/')) {
        const hits = resolveLink(c, apiRoutes)
        if (hits.length) for (const h of hits) linkedApis.add(h)
        else dead.push({ file: rel, line: i + 1, url, kind: 'api' })
        continue
      }
      if (ASSET.test(c)) continue
      const hits = resolveLink(c, pageRoutes)
      if (hits.length) for (const h of hits) { if (h !== selfRoute) linkedPages.add(h) }
      else dead.push({ file: rel, line: i + 1, url, kind: 'page' })
    }
    // ── 2층 (고아 판정 전용) ──
    if (!CATALOG_FILES.includes(rel) && !PROSE_DIRS.some((d) => rel.startsWith(d))) {
      API_WIDE_RE.lastIndex = 0
      let aw
      while ((aw = API_WIDE_RE.exec(line))) {
        const c = clean(normalizeTemplate(aw[0]))
        if (c.includes('{') || c.includes('}')) continue
        for (const h of resolveStrict2(c, apiRoutes)) mentionedApis.add(h)
      }
      WIDE_RE.lastIndex = 0
      let w
      while ((w = WIDE_RE.exec(line))) {
        const url = normalizeTemplate(w[1])
        if (url.includes('{') || url.includes('}')) continue
        const c = clean(url)
        if (ASSET.test(c) || c.startsWith('/api/')) continue
        for (const h of resolveStrict(c)) { if (h !== selfRoute) mentionedPages.add(h) }
        for (const h of dynamicChildrenOf(c)) { if (h !== selfRoute) mentionedPages.add(h) }
      }
    }
  })
}

const isLearner = (r) => !r.startsWith('/admin') && !r.startsWith('/dev')
const learnerPages = pageRoutes.filter(isLearner)
const aliases = redirectAliases()
const orphans = learnerPages.filter(
  (r) => !linkedPages.has(r) && !mentionedPages.has(r) && !aliases.has(r),
)
const orphanApis = apiRoutes.filter((r) => !linkedApis.has(r) && !mentionedApis.has(r))

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    pageRoutes: pageRoutes.length,
    learnerPages: learnerPages.length,
    apiRoutes: apiRoutes.length,
    linkedLearnerPages: learnerPages.filter((r) => linkedPages.has(r)).length,
  },
  deadLinks: dead,
  orphanLearnerPages: orphans,
  redirectAliasesExcluded: [...aliases],
  orphanApiRoutes: orphanApis,
}

fs.writeFileSync(
  path.join(ROOT, 'scripts/audit/learner-linkgraph.result.json'),
  JSON.stringify(report, null, 2),
)

console.log(
  `라우트: page ${pageRoutes.length} (학습자 ${learnerPages.length}) · api ${apiRoutes.length}`,
)
console.log(`죽은 링크: ${dead.length}`)
for (const d of dead) console.log(`  x ${d.url}  <- ${d.file}:${d.line}`)
console.log(
  `고아 학습자 화면(코드 어디서도 목적지로 안 쓰임): ${orphans.length}` +
    ` · 리다이렉트 별칭 제외 ${aliases.size}`,
)
for (const o of orphans) console.log(`  . ${o}`)
console.log(`고아 API(코드에서 정적 fetch 없음): ${orphanApis.length}`)
for (const o of orphanApis) console.log(`  . ${o}`)
