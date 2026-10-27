// apps/web/scripts/build-lcp-story-reader-harness.mts
//
// T-0176 LCP Story S5 — 학습자 이야기 서가 · 독서 화면의 **실제 클라이언트 컴포넌트**(components/library/story/** 와 그것이 import 하는 것)를
// **실제 앱 CSS**(globals.css → 앱 tailwind 설정 · tines 스킨 · learner-pc 스킨 + 화면이 import 하는 전역 CSS · CSS module) 와
// **실제 글꼴 파일**(app/layout.tsx 가 import 하는 @fontsource 파일 그대로)로 굽는 격리 하네스. build-lcp-story-harness.mts(S4)와 같은 방식.
//
// 두 산출물(덮어쓰지 않는다 — 이름이 다르다):
//   --baseline → work/lcp-story-s5/harness/baseline-library.html : 기존 Library Books 면(라이브러리 탭 줄 + AreaHero + BooksExplorer)과
//                LibraryBrowseFrame 레일. **작업 트리에서 HEAD 와 다른 추적 파일은 HEAD 내용(git show)으로 싣는다** — 다른 작업자가 탭을
//                바꾼 뒤에 구워도 기준선은 HEAD 코드다. HEAD 에 없는(새) 파일이 번들에 들어오면 빌드를 멈춘다.
//   (기본)     → work/lcp-story-s5/harness/reader-harness.html : /library/stories(StoryCatalog) · /library/stories/[releaseKey](StoryReader)
//                + 같은 Library 면(현재 작업 트리 코드).
//
// 실제 제품 부분: components/library/story/** · LibraryTabs · LibraryBrowseFrame · ModuleBanner · LearnerColorScope · Screen · (기준선) AreaHero · BooksExplorer ·
//   lib/** 의 클라이언트 측 코드 · 앱 CSS · 디자인 토큰 · 글꼴 파일.
// 대역(명시 — 아래 shims · SERVER_ACTION_MODULES):
//   · next/navigation → History API 위의 구현. router.push/replace = pushState 후 window.__vfOnNavigate(하네스가 그 URL 의 서버 판정을
//     다시 받아 같은 React 루트에 다시 그린다 — Next 의 소프트 이동처럼 RSC 를 다시 부르고 클라이언트 트리를 유지한다).
//     router.refresh = window.__vfOnRefresh(같은 URL 로 다시 받음). popstate 도 같다.
//   · next/link → <a>. 수정키 없는 왼쪽 클릭은 router.push(소프트 이동). next/image → <img>.
//   · 'use server' 모듈 → 같은 이름의 브라우저 대역: 인자를 JSON 으로 http://harness.local/__story/<name> 에 POST(스펙이 tsx 자식 프로세스로
//     **실제** lib/library/story/learner.ts 를 돌려 응답). 목록에 없는 'use server' 모듈이 번들에 들어오면 빌드 실패.
//   · @/lib/supabase/client → 네트워크 없는 대역. auth.onAuthStateChange · getUser · getSession 은 window.__vfAuth(스펙이 조종 — SIGNED_OUT ·
//     사용자 전환 흉내)를 읽는다. 그 밖의 체인 호출은 window.__vfSupabase 에 기록되고 오류로 끝난다.
//   · @/lib/analytics/client → window.__vfEvents 에 쌓는다(전송 없음).
// 표현하지 않는 것: middleware · (main)/layout.tsx 의 RSC 셸(AppHeader · CompassRibbon · 나침반 조회) · page.tsx RSC 실행 자체(아래 entry 에
//   같은 마크업을 옮겨 적었다 — RSC 는 번들할 수 없다) · 실제 쿠키 인증 · PostgREST/RPC · RLS · 실제 Server Action HTTP.
//
//   pnpm.cmd --dir apps/web exec tsx scripts/build-lcp-story-reader-harness.mts --baseline
//   pnpm.cmd --dir apps/web exec tsx scripts/build-lcp-story-reader-harness.mts
//   pnpm.cmd --dir apps/web exec playwright test -c playwright.isolated.config.ts tests/e2e-isolated/lcp-story-reader.isolated.spec.ts --reporter=list

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { HarnessEsbuildApi } from './harness-esbuild-types'

import postcss from 'postcss'
import tailwindcss from 'tailwindcss'

import { BASELINE_BOOKS, SYNTHETIC_BOOKS_LABEL } from '../tests/fixtures/lcp-story/reader-baseline-books'

const MODE: 'baseline' | 'current' = process.argv.includes('--baseline') ? 'baseline' : 'current'
const ROOT = path.resolve('.')
const REPO = path.resolve(ROOT, '../..')
const OUT_DIR = path.resolve(REPO, 'work/lcp-story-s5/harness')
const require = createRequire(path.join(ROOT, 'package.json'))
const viteRequire = createRequire(createRequire(require.resolve('vitest/package.json')).resolve('vite/package.json'))
const { build } = viteRequire('esbuild') as HarnessEsbuildApi

const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex')
const rel = (abs: string) => path.relative(REPO, abs).replace(/\\/g, '/')
const git = (args: string[]) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 })

// ── 작업 트리 ↔ HEAD 차이(기준선은 HEAD 내용으로 싣는다) ─────────────────────────────
const head = git(['rev-parse', 'HEAD']).trim()
const statusPorcelain = git(['status', '--porcelain']).trim()
const worktreeDirty = statusPorcelain.length > 0
const modified = new Set(git(['diff', '--name-only', 'HEAD']).split('\n').map((s) => s.trim()).filter(Boolean))
const untracked = new Set(git(['ls-files', '--others', '--exclude-standard']).split('\n').map((s) => s.trim()).filter(Boolean))
/** 번들 · CSS 가 실제로 읽은 저장소 파일 — { 경로 → 실린 바이트의 sha256 · 출처(worktree | HEAD) } */
const loaded = new Map<string, { sha256: string; from: 'worktree' | 'HEAD' }>()
const baselineNew: string[] = []

function readSource(abs: string): string {
  const r = rel(abs)
  if (MODE === 'baseline' && !r.startsWith('..') && !r.includes('node_modules/')) {
    if (untracked.has(r)) baselineNew.push(r)
    if (modified.has(r)) {
      const text = git(['show', `HEAD:${r}`])
      loaded.set(r, { sha256: sha(text), from: 'HEAD' })
      return text
    }
  }
  const text = fs.readFileSync(abs, 'utf8')
  if (!r.startsWith('..') && !r.includes('node_modules/')) loaded.set(r, { sha256: sha(text), from: 'worktree' })
  return text
}

// ── 앱 CSS ─────────────────────────────────────────────────────────────────────
function inlineImports(file: string, seen = new Set<string>()): string {
  if (seen.has(file)) return ''
  seen.add(file)
  return readSource(file).replace(/^@import\s+['"]([^'"]+)['"];?\s*$/gm, (_m, spec: string) => {
    const target = spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : require.resolve(spec)
    return inlineImports(target, seen)
  })
}
const globalsFile = path.resolve('src/app/globals.css')
const appCss = (await postcss([tailwindcss({ config: path.resolve('tailwind.config.ts') })]).process(inlineImports(globalsFile), { from: globalsFile })).css
if (appCss.length < 10_000 || !appCss.includes('[data-skin="tines"]') && !appCss.includes("[data-skin='tines']") && !appCss.includes('data-skin=tines')) {
  console.error(`앱 CSS 가 비었거나 tines 스킨이 없다(${appCss.length}B) — 스타일 없이 구우면 시각 검증이 거짓이 된다.`)
  process.exit(1)
}

// ── 글꼴 · html 속성 — app/layout.tsx 원문에서 읽는다(손으로 옮기면 어긋난다) ───────────
const LAYOUT = readSource(path.resolve('src/app/layout.tsx'))
const fontClasses = /const FONT_VARIABLE_CLASSES = \[([\s\S]*?)\]\.join/.exec(LAYOUT)?.[1]?.match(/"([^"]+)"/g)?.map((s) => s.slice(1, -1)) ?? []
const skin = /const SKIN = "([a-z-]+)"/.exec(LAYOUT)?.[1]
const bodyClass = /<body className="([^"]+)"/.exec(LAYOUT)?.[1]
const cdnFontHref = /<link\s+rel="stylesheet"\s+href="(https:\/\/cdn\.jsdelivr\.net\/[^"]+)"/.exec(LAYOUT)?.[1] ?? null
const FONT_CSS = [...LAYOUT.matchAll(/^import "(@fontsource[^"]+\.css)";/gm)].map((m) => m[1]!)
if (!skin || !bodyClass || fontClasses.length < 5 || FONT_CSS.length < 10) throw new Error('layout.tsx font classes / skin / body class / @fontsource imports not found')
/** 하네스 URL → 실제 글꼴 파일. 스펙이 이 표에 있는 것만 응답한다(나머지 요청은 abort). */
const fontFiles: Record<string, { path: string; sha256: string; bytes: number }> = {}
const fontCssAssets: { path: string; sha256: string }[] = []
function fontCss(spec: string): string {
  const file = require.resolve(spec)
  const css = fs.readFileSync(file, 'utf8')
  fontCssAssets.push({ path: rel(file), sha256: sha(css) })
  return css
    .replace(/,\s*url\([^)]+\.woff\)\s*format\('woff'\)/g, '')
    .replace(/url\((\.\/files\/[^)]+\.woff2)\)/g, (_m, r: string) => {
      const abs = path.resolve(path.dirname(file), r)
      const bytes = fs.readFileSync(abs)
      const h = sha(bytes)
      const url = `/__fonts/${h.slice(0, 20)}.woff2`
      fontFiles[url] = { path: rel(abs), sha256: h, bytes: bytes.length }
      return `url(${url})`
    })
}
const fontsCssFile = path.resolve('src/app/fonts.css')
const allFontCss = [...FONT_CSS.map(fontCss), readSource(fontsCssFile)].join('\n')
if (/url\(\.\//.test(allFontCss)) throw new Error('relative font url left in harness CSS')

// ── 대역 ────────────────────────────────────────────────────────────────────────
/** Server Action 모듈 → 대역 응답 경로 접두. 여기 없는 'use server' 모듈은 빌드 실패. */
const SERVER_ACTION_MODULES: Record<string, string> = {
  'src/app/(main)/library/stories/actions.ts': '__story',
}
/** 기준선 Books 면이 끌어오는 원본 도서 액션(등록 해제 등) · 단어장 화면(T-0191)이 끌어오는 SRS 결과 전송 — 호출되면 스펙이 기록만 하고 { ok:false } 를 준다. */
const BASELINE_ACTION_MODULES = new Set(['src/lib/library/complete-chapter.ts', 'src/lib/library/mark-progress.ts', 'src/lib/srs/flush-actions.ts', 'src/lib/wordvault/set-membership-actions.ts'])
const USE_SERVER = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*['"]use server['"]/

function actionShim(text: string, prefix: string): string {
  const names = new Set<string>()
  for (const m of text.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]!)
  for (const m of text.matchAll(/export\s+const\s+([A-Za-z0-9_$]+)\s*=/g)) names.add(m[1]!)
  if (!names.size) throw new Error('no exported actions found')
  return `
async function call(name, args) {
  const body = JSON.stringify({ args })
  ;(window.__vfActions ||= []).push({ prefix: ${JSON.stringify(prefix)}, name, at: performance.now() })
  const r = await fetch('http://harness.local/${prefix}/' + name, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
  const out = await r.json()
  if (out && out.__throw) throw new Error(out.__throw)
  return out ? out.value : undefined
}
${[...names].map((n) => `export async function ${n}(...args) { return call(${JSON.stringify(n)}, args) }`).join('\n')}
`
}

const shims: Record<string, string> = {
  'next/link': `import { createElement, forwardRef } from 'react'
import { useRouter } from 'next/navigation'
export default forwardRef(function Link({ href, children, prefetch, replace, scroll, shallow, passHref, legacyBehavior, onClick, ...rest }, ref) {
  const router = useRouter()
  const h = typeof href === 'string' ? href : href && typeof href === 'object' ? (href.pathname || '') + (href.search || (href.query ? '?' + new URLSearchParams(href.query) : '')) : String(href)
  const click = (e) => {
    if (onClick) onClick(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (rest.target && rest.target !== '_self')) return
    let u
    try { u = new URL(h, location.href) } catch { return }
    if (u.origin !== location.origin) return
    e.preventDefault()
    if (replace) router.replace(u.pathname + u.search + u.hash, { scroll })
    else router.push(u.pathname + u.search + u.hash, { scroll })
  }
  return createElement('a', { href: h, ref, onClick: click, ...rest }, children)
})`,
  'next/image': `import { createElement } from 'react'
export default function Image({ src, alt, fill, priority, quality, placeholder, blurDataURL, loader, unoptimized, ...rest }) {
  return createElement('img', { src: typeof src === 'string' ? src : src && src.src, alt, ...rest })
}`,
  'next/navigation': `import { useMemo, useSyncExternalStore } from 'react'
const EVT = 'vf-harness-location'
if (!window.__vfHistoryPatched) {
  window.__vfHistoryPatched = true
  window.__vfNav = []
  for (const kind of ['pushState', 'replaceState']) {
    const orig = window.history[kind].bind(window.history)
    window.history[kind] = (state, unused, url) => {
      orig(state, unused, url)
      window.__vfNav.push({ kind, url: location.pathname + location.search })
      window.dispatchEvent(new Event(EVT))
    }
  }
  window.addEventListener('popstate', () => {
    window.__vfNav.push({ kind: 'popstate', url: location.pathname + location.search })
    window.dispatchEvent(new Event(EVT))
    if (window.__vfOnNavigate) window.__vfOnNavigate(location.pathname + location.search, { kind: 'popstate' })
  })
}
function subscribe(cb) { window.addEventListener(EVT, cb); return () => window.removeEventListener(EVT, cb) }
const search = () => location.search
const pathname = () => location.pathname
export function useSearchParams() { const s = useSyncExternalStore(subscribe, search, search); return useMemo(() => new URLSearchParams(s), [s]) }
export function usePathname() { return useSyncExternalStore(subscribe, pathname, pathname) }
function go(kind, href, opts) {
  window.history[kind](null, '', href)
  if (!opts || opts.scroll !== false) window.scrollTo(0, 0)
  if (window.__vfOnNavigate) window.__vfOnNavigate(location.pathname + location.search, { kind })
}
const router = {
  refresh() { window.__vfNav.push({ kind: 'refresh', url: location.pathname + location.search }); if (window.__vfOnRefresh) window.__vfOnRefresh() },
  push(href, opts) { go('pushState', href, opts) },
  replace(href, opts) { go('replaceState', href, opts) },
  back() { window.history.back() },
  forward() { window.history.forward() },
  prefetch() { (window.__vfPrefetch ||= []).push(location.pathname) },
}
export function useRouter() { return router }
export function useParams() {
  const p = usePathname()
  const m = /^\\/library\\/stories\\/([^/]+)$/.exec(p)
  return m ? { releaseKey: decodeURIComponent(m[1]) } : {}
}
export function useSelectedLayoutSegment() { return null }
export function redirect(href) { throw new Error('harness: redirect(' + href + ') is server-only') }
export function notFound() { throw new Error('harness: notFound() is server-only') }
`,
  '@/lib/supabase/client': `
// 인증 대역 — window.__vfAuth = { user: { id } | null, listeners: [] }. 스펙이 window.__vfAuthEmit(event, user) 로 SIGNED_OUT · 사용자 전환을 낸다.
const auth0 = (window.__vfAuth ||= { user: window.__VF_AUTH_USER__ ?? null, listeners: [], calls: [] })
let resolveAuth
const authReady = new Promise((r) => (resolveAuth = r))
window.__vfAuthResolve = (user) => { auth0.user = user; resolveAuth() }
window.__vfAuthEmit = (event, user) => {
  auth0.user = user
  const session = user ? { user, access_token: 'harness-not-a-token' } : null
  for (const cb of [...auth0.listeners]) { try { cb(event, session) } catch (e) { (window.__vfAuthErrors ||= []).push(String(e)) } }
}
function chain(p) {
  const settle = () => { (window.__vfSupabase ||= []).push(p.join('.')); return Promise.resolve({ data: null, error: { message: 'harness: Supabase 미연결(대역)' }, count: null, status: 0 }) }
  const fn = function () {}
  return new Proxy(fn, {
    get(_t, key) {
      if (key === 'then') { const pr = settle(); return pr.then.bind(pr) }
      if (typeof key === 'symbol') return undefined
      return chain([...p, key])
    },
    apply() { return chain(p) },
  })
}
const authApi = {
  onAuthStateChange(cb) {
    auth0.calls.push('onAuthStateChange')
    auth0.listeners.push(cb)
    // supabase-js 는 구독 직후 INITIAL_SESSION 을 비동기로 한 번 낸다. window.__VF_AUTH_DELAY__ = 'manual' 이면 스펙이
    // window.__vfAuthResolve(user) 를 부를 때까지 늦춘다(느린 세션 복원 흉내 — 기준선이 오기 전 상태를 시험한다).
    const fire = () => { if (!auth0.listeners.includes(cb)) return; const u = auth0.user; try { cb('INITIAL_SESSION', u ? { user: u, access_token: 'harness-not-a-token' } : null) } catch {} }
    if (window.__VF_AUTH_DELAY__ === 'manual') authReady.then(fire); else queueMicrotask(fire)
    return { data: { subscription: { unsubscribe() { auth0.listeners = auth0.listeners.filter((x) => x !== cb) } } } }
  },
  async getUser() { auth0.calls.push('getUser'); return { data: { user: auth0.user }, error: auth0.user ? null : { message: 'Auth session missing!', status: 400 } } },
  async getSession() {
    auth0.calls.push('getSession')
    if (window.__VF_AUTH_DELAY__ === 'manual') await authReady
    return { data: { session: auth0.user ? { user: auth0.user, access_token: 'harness-not-a-token' } : null }, error: null }
  },
}
// 낱말 도움(WordLookupPopover → lib/library/reader-queries lookupWord) 대역 — 공유 DB 없음. 스펙이 정한 합성 사전
// window.__VF_LOOKUP__ = { 소문자 낱말: { word, meaning_ko, pos } } 과 모드 window.__VF_LOOKUP_MODE__ = 'normal' | 'error' 로 답한다.
// 모든 호출은 window.__vfSupabase 에 { kind, fn | table, ... } 로 남는다(그 밖의 RPC · 표 쓰기가 없었음을 스펙이 확인).
const rec = (x) => (window.__vfSupabase ||= []).push(x)
async function rpc(fn, args) {
  rec({ kind: 'rpc', fn })
  if (fn !== 'lookup_word_meaning') return { data: null, error: { message: 'harness: rpc not wired (대역)' } }
  if (window.__VF_LOOKUP_MODE__ === 'error') return { data: null, error: { message: 'harness: lookup failed (synthetic)' } }
  const surface = String((args && args.p_surface) || '')
  const hit = (window.__VF_LOOKUP__ || {})[surface.toLowerCase()]
  const base = { surface, cefr_level: null, v_level: null, example_en: null, word_register: null }
  if (!hit) return { data: [{ ...base, found: false, resolved_word: null, meaning_ko: null, pos: null, match_via: 'none', lang: null }], error: null }
  return { data: [{ ...base, found: true, resolved_word: hit.word, meaning_ko: hit.meaning_ko, pos: hit.pos ?? null, cefr_level: hit.cefr_level ?? null, example_en: hit.example_en ?? null, match_via: 'exact', lang: 'en' }], error: null }
}
function from(table) {
  const q = { table, ops: [] }
  const b = {
    select(c) { q.ops.push('select'); return b },
    eq(_c, v) { q.ops.push('eq'); q.word = v; return b },
    async maybeSingle() {
      rec({ kind: 'from', table, ops: q.ops.join('.') })
      // 긴 사전 내용(T-0191 창 경계 시험) — window.__VF_LOOKUP_WEB__[표제어] 가 있으면 그 연어 · 예문 해석 · 낱말 그물을 준다(합성).
      if (table === 'shared_dictionary' && q.ops[0] === 'select') return { data: { collocations: null, meanings_ko: null, derived_forms: null, synonyms: null, antonyms: null, ...((window.__VF_LOOKUP_WEB__ || {})[q.word] || {}) }, error: null }
      return { data: null, error: { message: 'harness: table not wired (대역)' } }
    },
  }
  for (const m of ['insert', 'update', 'upsert', 'delete']) b[m] = () => { rec({ kind: 'write', table, op: m }); return chain(['supabase', table, m]) }
  return b
}
export function createClient() {
  const base = chain(['supabase'])
  return new Proxy({}, { get(_t, key) { if (key === 'auth') return authApi; if (key === 'rpc') return rpc; if (key === 'from') return from; return base[key] } })
}
`,
  '@/lib/analytics/client': `export function track(e) { (window.__vfEvents ||= []).push(e) }
export default { track }`,
}
const SHIM_FILTER = /^(next\/link|next\/image|next\/navigation|@\/lib\/supabase\/client|@\/lib\/analytics\/client)$/

// ── entry — page.tsx · layout.tsx 마크업을 옮겨 적었다(RSC 라 번들하지 않는다) ────────────
const LIBRARY_LAYOUT = `
// app/(main)/layout.tsx 의 건너뛰기 링크 · main#main-content(+ ModuleBanner main) 와 app/(main)/library/layout.tsx 의 탭 줄 · ModuleBanner(library).
// AppHeader · CompassRibbon · MobileTabBar 등 RSC 셸 조회가 필요한 것은 그리지 않는다(하네스 한계).
function MainShell({ children }) {
  return h('div', { className: 'flex min-h-screen flex-col bg-[var(--canvas,var(--bg2))]' },
    h('a', { href: '#main-content', className: 'sr-only rounded-[var(--r-md)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:flex focus:min-h-11 focus:items-center focus:bg-[var(--p)] focus:px-4 focus:font-display focus:text-[13px] focus:font-[700] focus:text-[var(--on-p)] focus:shadow-[var(--sh-md)] focus:outline-none focus:ring-2 focus:ring-[var(--p)] focus:ring-offset-2' }, '본문으로 건너뛰기'),
    h('div', { className: 'flex min-w-0 flex-1 flex-col' },
      h('main', { id: 'main-content', tabIndex: -1, className: 'min-w-0 flex-1 focus:outline-none' },
        h(ModuleBanner, null),
        h('div', { 'data-area-layout': true, className: 'mx-auto w-full max-w-[var(--ios-content-wide-max)] px-4 pt-4 md:px-6 md:pt-5 [body:has([data-shelf-wide])_&]:max-w-[var(--content-shelf-max)] lg:[body:has([data-shelf-wide])_&]:px-10' },
          h(LibraryTabs, null),
          h('div', { className: 'mt-4' }, h(ModuleBanner, { slot: 'library' }))),
        children)))
}
`

const BOOKS_PAGE_SRC = `
// ${SYNTHETIC_BOOKS_LABEL} — tests/fixtures/lcp-story/reader-baseline-books.ts
const books = ${JSON.stringify(BASELINE_BOOKS)}
const COUNT = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 })
// app/(main)/library/books/page.tsx 의 header 마크업(같은 props · 합성 수치는 합성 목록에서 즉석 계산)
function BooksPage() {
  const totalBooks = books.length
  const totalChapters = books.reduce((s, b) => s + (b.chapter_count ?? 0), 0)
  const totalWords = books.reduce((s, b) => s + (b.word_count ?? 0), 0)
  const header = h(AreaHero, {
    kicker: '서가 · 영어 원서', title: MATERIAL_LABEL.book, sub: '큐레이션된 영어 원서 — i+1 수준에 맞춘 도서를 추천해드려요.',
    tile: 'tile-books', desktopScene: 'scene-library-v4', desktopSub: '읽고 싶은 책을 골라보세요.', tint: MATERIAL_TONE.book.tint,
    tabs: [{ href: '/library/books', label: '둘러보기', active: true }, { href: '/library/books?show=all', label: '전체 보기', count: String(totalBooks), active: false }],
    stats: [{ label: MATERIAL_LABEL.book, value: String(totalBooks) }, { label: '챕터', value: COUNT.format(totalChapters) }, { label: '단어', value: COUNT.format(totalWords) }],
  }, h('a', { href: '#browse', className: 'inline-flex min-h-11 items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--on-deep)_14%,transparent)] px-5 font-display text-[14px] font-[600] transition-colors duration-[var(--dur-quick)] hover:bg-[color-mix(in_srgb,var(--on-deep)_24%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--on-deep)]' }, '조건으로 찾기 — 전체 탐색 ↓'))
  return h(Screen, { width: 'shelf', background: 'bg2', padX: 'md' },
    h('div', { 'data-shelf-wide': true, className: 'books-reference-page flex flex-col gap-5 py-6 md:py-8' },
      h(BooksExplorer, { books, userVLevel: 0, userMastery: 'cold', showAll: false, header, feature: null })))
}
`

const BASELINE_ENTRY = `
import { createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import '@/components/layout/learner-reference.css'
import '@/components/layout/account-reference.css'
import '@/components/library/detail-reference.css'
import { LearnerColorScope } from '@/components/layout/LearnerColorScope'
import { ModuleBanner } from '@/components/layout/ModuleBanner'
import { LibraryTabs } from '@/components/library/LibraryTabs'
import { LibraryBrowseFrame } from '@/components/library/LibraryBrowseFrame'
import { AreaHero } from '@/components/layout/AreaHero'
import { BooksExplorer } from '@/components/library/browse/BooksExplorer'
import { Screen } from '@/components/ui/ios'
import { MATERIAL_TONE } from '@/lib/design/tone'
import { MATERIAL_LABEL } from '@/lib/learner/plan-activities'
${LIBRARY_LAYOUT}
${BOOKS_PAGE_SRC}
// LibraryBrowseFrame(레일 변형 LibraryTabs) — /library/scripts 등이 쓰는 PC 자료 유형 레일. 본문은 빈 자리표시.
function FramePage() {
  return h(LibraryBrowseFrame, null, h('section', { 'aria-label': '하네스 자리표시', className: 'p-6 font-body text-[14px] text-[var(--t2)]' }, '하네스 기준선 — 레일만 확인(본문 없음 · 합성)'))
}
function App() {
  const p = location.pathname
  return h('div', { 'data-reader-harness-ready': 'baseline' }, h(LearnerColorScope, null), h(MainShell, null, p.startsWith('/library/books') ? h(BooksPage) : h(FramePage)))
}
createRoot(document.getElementById('root')).render(h(App))
`


const CURRENT_ENTRY = `
import { createElement as h, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@/components/layout/learner-reference.css'
import '@/components/layout/account-reference.css'
import '@/components/library/detail-reference.css'
import { LearnerColorScope } from '@/components/layout/LearnerColorScope'
import { ModuleBanner } from '@/components/layout/ModuleBanner'
import { LibraryTabs } from '@/components/library/LibraryTabs'
import { LibraryBrowseFrame } from '@/components/library/LibraryBrowseFrame'
import { Screen } from '@/components/ui/ios'
import { AreaHero } from '@/components/layout/AreaHero'
import { BooksExplorer } from '@/components/library/browse/BooksExplorer'
import { MATERIAL_TONE } from '@/lib/design/tone'
import { MATERIAL_LABEL } from '@/lib/learner/plan-activities'
import { StoryCatalog } from '@/components/library/story/StoryCatalog'
import { StoryReader } from '@/components/library/story/StoryReader'
import { recordStoryPositionAction, completeStoryUnitAction, saveStoryWordAction } from '@/app/(main)/library/stories/actions'
import { StoryVaultReturnBar } from '@/components/library/story/StoryVaultReturn'
import { WordVaultBrowseClient, WordVaultViewerGate } from '@/components/wordvault/WordVaultBrowseClient'
import { MapReturnBar } from '@/components/wordvault/WordVaultStudyClient'
${LIBRARY_LAYOUT}
${BOOKS_PAGE_SRC}
// 서버 판정(loader 결과) — 스펙이 HTML 에 window.__VF_PAGE__ 로 넣는다(= RSC 가 직렬화해 보내는 props). 이동 · refresh 때는
// POST http://harness.local/__page 로 같은 loader 를 그 URL 에 다시 돌린 결과를 받는다.
async function fetchPage(url) {
  const r = await fetch('http://harness.local/__page', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) })
  return r.json()
}
// app/(main)/library/stories/page.tsx
function CatalogPage({ page }) {
  return h(LibraryBrowseFrame, null, h(StoryCatalog, { state: page.state }))
}
// app/(main)/library/stories/[releaseKey]/page.tsx
function ReaderPage({ page }) {
  return h(Screen, { width: 'wide', background: 'bg2', padX: 'md' },
    h(StoryReader, { key: page.releaseKey, state: page.state, releaseKey: page.releaseKey, actions: { recordPosition: recordStoryPositionAction, completeUnit: completeStoryUnitAction, saveWord: saveStoryWordAction } }))
}
// app/(main)/wordvault/browse/page.tsx(T-0191) — 같은 조립: 성공 · 실패 화면 모두 서버 getUser 주인(viewerId)의 계정 경계 안.
function VaultPage({ page }) {
  const storyBar = page.storyReturn ? h(StoryVaultReturnBar, { state: page.storyReturn }) : null
  const gate = { viewerId: page.viewerId, reopenHref: page.reopenHref }
  if (page.failed) {
    return h(WordVaultViewerGate, gate,
      page.mapBack ? h(MapReturnBar, { href: page.mapBack, note: '학습 지도 · 기본 의미(V1) 준비' }) : storyBar,
      h('div', { 'data-testid': 'vocab-browse-load-failed' }, h('h2', { role: 'alert' }, '단어를 불러오지 못했어요')))
  }
  return h(WordVaultViewerGate, gate, h(WordVaultBrowseClient, { words: page.words, textChips: [], setChips: [], bookContext: null, mapBack: page.mapBack, storyReturn: storyBar }))
}
function App() {
  const [page, setPage] = useState(window.__VF_PAGE__)
  useEffect(() => {
    let seq = 0
    const load = async (url) => {
      const my = ++seq
      const next = await fetchPage(url)
      if (my === seq) { setPage(next); (window.__vfRenders ||= []).push({ url, kind: next.kind }) }
    }
    window.__vfOnNavigate = (url) => { void load(url) }
    window.__vfOnRefresh = () => { void load(location.pathname + location.search) }
    return () => { window.__vfOnNavigate = undefined; window.__vfOnRefresh = undefined }
  }, [])
  // /library/books = 기준선과 같은 합성 Books 면(현재 작업 트리 코드 — 탭 줄 변화 비교용)
  const body = page.kind === 'catalog' ? h(CatalogPage, { page }) : page.kind === 'reader' ? h(ReaderPage, { page }) : page.kind === 'books' ? h(BooksPage) : page.kind === 'vault' ? h(VaultPage, { page }) : page.kind === 'redirect' ? h('p', { 'data-harness-redirect': page.to }, 'harness: redirect') : h('p', null, 'harness: unknown page')
  return h('div', { 'data-reader-harness-ready': page.kind, 'data-harness-url': page.url }, h(LearnerColorScope, null), h(MainShell, null, body))
}
createRoot(document.getElementById('root')).render(h(App))
`

// ── 번들 ────────────────────────────────────────────────────────────────────────
const unknownServer: string[] = []
const globalCssFiles: string[] = []
const loaderFor = (p: string) => (p.endsWith('.tsx') ? 'tsx' : p.endsWith('.ts') ? 'ts' : p.endsWith('.json') ? 'json' : p.endsWith('.module.css') ? 'local-css' : 'js')
const r = await build({
  stdin: { contents: MODE === 'baseline' ? BASELINE_ENTRY : CURRENT_ENTRY, resolveDir: ROOT, loader: 'tsx' },
  bundle: true, write: false, metafile: true, format: 'iife', platform: 'browser', jsx: 'automatic', target: 'es2020',
  outdir: path.join(OUT_DIR, '.esbuild'),
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_SUPABASE_URL': '"http://supabase.harness.invalid"', 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': '"harness-anon-placeholder"' },
  banner: { js: 'var process = { env: { NODE_ENV: "production" } };' },
  loader: { '.css': 'empty', '.module.css': 'local-css', '.json': 'json' },
  plugins: [{
    name: 'vf-lcp-story-reader-harness',
    setup(b) {
      b.onResolve({ filter: SHIM_FILTER }, (a) => ({ path: a.path, namespace: 'shim' }))
      b.onLoad({ filter: /.*/, namespace: 'shim' }, (a) => ({ contents: shims[a.path], loader: 'jsx', resolveDir: ROOT }))
      b.onResolve({ filter: /^@\// }, async (a) => b.resolve('./src/' + a.path.slice(2), { kind: a.kind, resolveDir: ROOT }))
      // 전역 CSS(모듈 아님) — 기록만 하고 아래에서 HTML <style> 에 원문을 붙인다(import 순서 그대로)
      b.onLoad({ filter: /\.css$/ }, (a) => {
        if (a.path.endsWith('.module.css')) {
          if (a.path.includes('node_modules')) return {}
          return { contents: readSource(a.path), loader: 'local-css', resolveDir: path.dirname(a.path) }
        }
        if (!globalCssFiles.includes(a.path)) globalCssFiles.push(a.path)
        return { contents: '', loader: 'js' }
      })
      b.onLoad({ filter: /\.(ts|tsx|json)$/ }, (a) => {
        if (a.path.includes('node_modules')) return {}
        const r0 = rel(a.path)
        if (r0.startsWith('..')) return {}
        const text = readSource(a.path)
        const r1 = path.relative(ROOT, a.path).replace(/\\/g, '/')
        if (USE_SERVER.test(text)) {
          const prefix = SERVER_ACTION_MODULES[r1] ?? (BASELINE_ACTION_MODULES.has(r1) ? '__action' : undefined)
          if (!prefix) { unknownServer.push(r1); return { contents: 'export {}', loader: 'js' } }
          return { contents: actionShim(text, prefix), loader: 'js', resolveDir: ROOT }
        }
        return { contents: text, loader: loaderFor(a.path), resolveDir: path.dirname(a.path) }
      })
    },
  }],
})
if (unknownServer.length) throw new Error(`대역 없는 'use server' 모듈이 번들에 들어왔다: ${unknownServer.join(', ')}`)
if (baselineNew.length) throw new Error(`기준선 번들에 HEAD 에 없는(새) 파일이 들어왔다: ${baselineNew.join(', ')}`)
const inputs = Object.keys(r.metafile!.inputs).map((f) => f.replace(/\\/g, '/'))
const leaked = inputs.filter((f) => /@supabase[\\/](ssr|supabase-js|postgrest-js|auth-js)/.test(f) || /next[\\/]dist[\\/]/.test(f) || /[\\/]lib[\\/]supabase[\\/](server|admin)\.ts$/.test(f) || f.includes('node:') || /[\\/]lib[\\/]library[\\/]story[\\/]learner\.ts$/.test(f))
if (leaked.length) throw new Error(`browser harness must not bundle network/server clients: ${leaked.join(', ')}`)
const js = r.outputFiles.find((f) => f.path.endsWith('.js'))!.text
const moduleCss = r.outputFiles.filter((f) => f.path.endsWith('.css')).map((f) => f.text).join('\n')
const componentCss = globalCssFiles.map((f) => `/* ${rel(f)} */\n${readSource(f)}`).join('\n')

fs.mkdirSync(OUT_DIR, { recursive: true })
const name = MODE === 'baseline' ? 'baseline-library' : 'reader-harness'
const out = path.join(OUT_DIR, `${name}.html`)
// data-theme: layout 의 첫 칠 스크립트가 저장값 · prefers-color-scheme 로 정한다 — 하네스는 Playwright 기본(light)과 같은 light 로 고정.
// Pretendard CDN <link> 는 layout.tsx 와 같이 둔다 — 스펙이 그 요청을 abort 하고 「알려진 외부(CDN 글꼴)」로 기록한다(한글은 시스템 대체).
fs.writeFileSync(out, `<!doctype html><html lang="ko" class="${fontClasses.join(' ')}" data-skin="${skin}" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Stories — Vocaflow (격리 하네스 · 합성 데이터)</title>${cdnFontHref ? `<link rel="stylesheet" href="${cdnFontHref}">` : ''}<style>${allFontCss}\n${appCss}\n${componentCss}\n${moduleCss}</style><!--VF_PAGE--></head>
<body class="${bodyClass}"><div id="root"></div>
<script>${js.replace(/<\/script/g, '<\\/script')}</script></body></html>`)

const bundledSources = inputs
  .filter((f) => !f.startsWith('shim:') && !f.includes('node_modules') && !f.startsWith('<stdin>'))
  .map((f) => rel(path.resolve(ROOT, f)))
const sources = [...new Set([...bundledSources, ...loaded.keys()])]
  .filter((p) => loaded.has(p) || fs.existsSync(path.join(REPO, p)))
  .map((p) => {
    const l = loaded.get(p)
    return { path: p, sha256: l?.sha256 ?? sha(fs.readFileSync(path.join(REPO, p))), from: l?.from ?? 'worktree', worktree_modified: modified.has(p), untracked: untracked.has(p) }
  })
  .sort((a, b) => a.path.localeCompare(b.path))
const manifest = {
  label: `${MODE} harness build — ${worktreeDirty ? 'uncommitted worktree on' : 'clean worktree at'} HEAD ${head.slice(0, 9)}${MODE === 'baseline' ? ' (sources differing from HEAD were loaded from HEAD)' : ''} — build manifest, not a verification verdict`,
  mode: MODE,
  head,
  worktree_dirty: worktreeDirty,
  worktree_status: statusPorcelain.split('\n').filter(Boolean),
  html: rel(out),
  html_sha256: sha(fs.readFileSync(out)),
  css_bytes: appCss.length,
  component_global_css: globalCssFiles.map(rel),
  module_css_bytes: moduleCss.length,
  html_attrs: { class: fontClasses, data_skin: skin, data_theme: 'light', body_class: bodyClass, cdn_font_link: cdnFontHref },
  synthetic: MODE === 'baseline' ? SYNTHETIC_BOOKS_LABEL : 'reader state comes from scripts/lcp/story/s5-reader-harness-eval.ts over synthetic gull-rock fixtures',
  font_css: fontCssAssets,
  font_files: Object.entries(fontFiles).map(([url, f]) => ({ url, ...f })),
  sources,
  tailwind_note: 'tailwind content globs scan the current worktree (both modes) — class set is a superset; baseline sources themselves are HEAD content',
}
fs.writeFileSync(path.join(OUT_DIR, `${name}.manifest.json`), `${JSON.stringify(manifest, null, 2)}\n`)
fs.writeFileSync(path.join(OUT_DIR, `${name}.fonts.json`), `${JSON.stringify(fontFiles, null, 2)}\n`)
console.log(`구움(${MODE}): ${rel(out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB) · 앱 CSS ${(appCss.length / 1024).toFixed(0)} KB · 전역 CSS ${globalCssFiles.length}개 · module CSS ${moduleCss.length}B · 글꼴 파일 ${Object.keys(fontFiles).length}개 · 소스 ${sources.length}개(HEAD 로 실은 것 ${sources.filter((s) => s.from === 'HEAD').length})`)
