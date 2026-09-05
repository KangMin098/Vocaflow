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

/** `/text/${id}/echo` → `/text/<seg>/echo` (한 세그먼트로 취급). */
function normalizeTemplate(url) {
  return url.replace(/\$\{[^}]*\}/g, '<seg>')
}

const ASSET = /\.(png|jpe?g|svg|webp|ico|json|txt|xml|mp3|wav|webm|webmanifest|woff2?|css|js)$/i

const dead = []
const linkedPages = new Set()
const linkedApis = new Set()

for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/')
  const lines = fs.readFileSync(f, 'utf8').split('\n')
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
      if (hits.length) for (const h of hits) linkedPages.add(h)
      else dead.push({ file: rel, line: i + 1, url, kind: 'page' })
    }
  })
}

const isLearner = (r) => !r.startsWith('/admin') && !r.startsWith('/dev')
const learnerPages = pageRoutes.filter(isLearner)
const orphans = learnerPages.filter((r) => !linkedPages.has(r))
const orphanApis = apiRoutes.filter((r) => !linkedApis.has(r))

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
console.log(`고아 학습자 화면(코드 어디서도 정적 링크 없음): ${orphans.length}`)
for (const o of orphans) console.log(`  . ${o}`)
console.log(`고아 API(코드에서 정적 fetch 없음): ${orphanApis.length}`)
for (const o of orphanApis) console.log(`  . ${o}`)
