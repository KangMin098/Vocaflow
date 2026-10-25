// apps/web/scripts/build-lcp-story-harness.mts
//
// T-0174 LCP Story S4 — /admin/curation 의 **실제 클라이언트 컴포넌트**(AdminShell 시각 틀 + AdminCurationClient 와 그것이
// import 하는 원본 탭들 · AdminScreenHelp · 연결된 뒤에는 Story 줄 컴포넌트)와 **실제 앱 CSS**(globals.css → 앱 tailwind 설정,
// admin-app 스킨 포함 · CSS module 은 esbuild local-css)를 data-area="admin" 아래에 올리는 격리 하네스를 굽는다.
// 서버 · 로그인 · DB · 네트워크 없음. build-fast-worksheet-harness.mts / build-factory-dcp-harness.mts 와 같은 방식.
//
// 실제 제품 부분: AdminShell · AdminSidebar(클라이언트 시각 틀) · AdminCurationClient · components/admin/curation/* ·
//   AdminScreenHelp + lib/admin/help · lib/admin/curation-view · lib/admin/navigation(updateAdminUrl 포함) · 앱 CSS · 디자인 토큰.
// 대역(명시 — 아래 shims 와 SERVER_ACTION_MODULES):
//   · next/navigation → 브라우저 History API 위의 작은 구현. useSearchParams 는 window.location.search 를 읽고
//     pushState/replaceState/popstate 때 다시 그린다(Next 가 history 를 패치해 useSearchParams 를 알리는 것과 같은 효과).
//     useRouter().refresh 는 window.__vfNav 에 기록만 한다(RSC 재페치 없음).
//   · next/link → <a>, next/image → <img>.
//   · 'use server' 모듈(Server Action) → 같은 이름의 브라우저 대역. 인자를 JSON(FormData 의 File 은 이름·형식·크기·본문 텍스트)으로
//     http://harness.local/__action/<name>(원본 줄) 또는 /__story/<name>(Story 줄)에 POST 하고, Playwright 스펙이 응답한다.
//     목록에 없는 'use server' 모듈이 번들에 들어오면 빌드를 멈춘다(대역 없이 서버 코드가 섞이는 것을 막는다).
//   · @/lib/supabase/client → 네트워크를 쓰지 않는 체인 대역. 모든 호출은 window.__vfSupabase 에 기록되고
//     { data: null, error: { message: 'harness: Supabase 미연결(대역)' } } 로 끝난다.
//   · @/lib/analytics/client → window.__vfEvents 에 쌓는 대역(전송 없음). 스펙은 그 밖의 모든 외부 요청을 abort 한다.
// 표현하지 않는 것: app/admin/layout.tsx 의 requireAdmin · middleware · page.tsx RSC 데이터 로딩 · 실제 쿠키 인증 ·
//   PostgREST/RPC 실행 · 실제 Server Action 전송. page.tsx 의 머리말 마크업은 RSC 라 번들할 수 없어 아래 entry 에 그대로 옮겨 적었다.
//
//   pnpm.cmd --dir apps/web exec tsx scripts/build-lcp-story-harness.mts
//   pnpm.cmd --dir apps/web exec playwright test -c playwright.isolated.config.ts tests/e2e-isolated/lcp-story.isolated.spec.ts

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { HarnessEsbuildApi } from './harness-esbuild-types'

import postcss from 'postcss'
import tailwindcss from 'tailwindcss'

import { ORIGINAL_PROPS, SYNTHETIC_LABEL } from '../tests/fixtures/lcp-story/original-curation'

const ROOT = path.resolve('.')
const REPO = path.resolve(ROOT, '../..')
const OUT_DIR = path.resolve(REPO, 'work/lcp-story-s4/harness')
const require = createRequire(path.join(ROOT, 'package.json'))
// esbuild 는 web 의 직접 의존성이 아니다 — vitest → vite 가 쓰는 같은 esbuild 를 빌린다(새 의존성 없음)
const viteRequire = createRequire(createRequire(require.resolve('vitest/package.json')).resolve('vite/package.json'))
const { build } = viteRequire('esbuild') as HarnessEsbuildApi

function inlineImports(file: string, seen = new Set<string>()): string {
  if (seen.has(file)) return ''
  seen.add(file)
  return fs.readFileSync(file, 'utf8').replace(/^@import\s+['"]([^'"]+)['"];?\s*$/gm, (_m, spec: string) => {
    const target = spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : require.resolve(spec)
    return inlineImports(target, seen)
  })
}
const from = path.resolve('src/app/globals.css')
const appCss = (await postcss([tailwindcss({ config: path.resolve('tailwind.config.ts') })]).process(inlineImports(from), { from })).css
if (appCss.length < 10_000 || !appCss.includes('data-area="admin"')) {
  console.error(`앱 CSS 가 비었거나 admin 스킨이 없다(${appCss.length}B) — 스타일 없이 구우면 시각 검증이 거짓이 된다.`)
  process.exit(1)
}

// ── 글꼴 — app/layout.tsx 와 같은 것(관리자 화면이 실제로 쓰는 것만): Inter Variable(admin sans) · JetBrains Mono(admin mono) + app/fonts.css 변수 클래스.
//    woff2 는 설치된 @fontsource 파일을 data URL 로 넣는다(네트워크 · 설치 없음). woff(구형) 대체 항목은 뺀다.
//    html 의 클래스 · data-skin 은 layout.tsx 원문에서 읽는다(손으로 옮기면 어긋난다). Pretendard(한글)는 layout 이 CDN 링크로 싣는 것이라 하네스에 없다 — 한글은 시스템 대체 글꼴이다.
const LAYOUT = fs.readFileSync(path.resolve('src/app/layout.tsx'), 'utf8')
const fontClasses = /const FONT_VARIABLE_CLASSES = \[([\s\S]*?)\]\.join/.exec(LAYOUT)?.[1]?.match(/"([^"]+)"/g)?.map((s) => s.slice(1, -1)) ?? []
const skin = /const SKIN = "([a-z-]+)"/.exec(LAYOUT)?.[1]
const bodyClass = /<body className="([^"]+)"/.exec(LAYOUT)?.[1]
const FONT_CSS = ['@fontsource-variable/inter/wght.css', '@fontsource/jetbrains-mono/latin-400.css', '@fontsource/jetbrains-mono/latin-500.css', '@fontsource/jetbrains-mono/latin-700.css']
for (const spec of FONT_CSS) if (!LAYOUT.includes(`import "${spec}"`)) throw new Error(`layout.tsx no longer imports ${spec} — harness fonts would diverge`)
if (!fontClasses.includes('vf-font-admin-sans') || !fontClasses.includes('vf-font-admin-mono') || !skin || !bodyClass) throw new Error('layout.tsx font classes / skin / body class not found')
const fontAssets: { path: string; sha256: string }[] = []
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex')
function inlineFontCss(spec: string): string {
  const file = require.resolve(spec)
  const css = fs.readFileSync(file, 'utf8')
  fontAssets.push({ path: path.relative(REPO, file).replace(/\\/g, '/'), sha256: sha(css) })
  return css
    .replace(/,\s*url\([^)]+\.woff\)\s*format\('woff'\)/g, '')
    .replace(/url\((\.\/files\/[^)]+\.woff2)\)/g, (_m, rel: string) => {
      const bytes = fs.readFileSync(path.resolve(path.dirname(file), rel))
      fontAssets.push({ path: path.relative(REPO, path.resolve(path.dirname(file), rel)).replace(/\\/g, '/'), sha256: sha(bytes) })
      return `url(data:font/woff2;base64,${bytes.toString('base64')})`
    })
}
const fontsCssFile = path.resolve('src/app/fonts.css')
fontAssets.push({ path: path.relative(REPO, fontsCssFile).replace(/\\/g, '/'), sha256: sha(fs.readFileSync(fontsCssFile)) })
const fontCss = [...FONT_CSS.map(inlineFontCss), fs.readFileSync(fontsCssFile, 'utf8')].join('\n')
if (/url\(\.\//.test(fontCss)) throw new Error('relative font url left in harness CSS')

/** Server Action 모듈 → 대역 응답 경로 접두. 여기 없는 'use server' 모듈은 빌드 실패. */
const SERVER_ACTION_MODULES: Record<string, string> = {
  'src/app/admin/curation/actions.ts': '__action',
  'src/app/admin/curation/story-actions.ts': '__story',
}
const USE_SERVER = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*['"]use server['"]/

function actionShim(file: string, prefix: string): string {
  const src = fs.readFileSync(file, 'utf8')
  const names = new Set<string>()
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]!)
  for (const m of src.matchAll(/export\s+const\s+([A-Za-z0-9_$]+)\s*=/g)) names.add(m[1]!)
  if (!names.size) throw new Error(`no exported actions found in ${file}`)
  return `
async function encode(v) {
  if (typeof FormData !== 'undefined' && v instanceof FormData) {
    const out = []
    for (const [k, val] of v.entries()) {
      if (typeof val === 'string') out.push([k, val])
      else out.push([k, { __file: true, name: val.name, type: val.type, size: val.size, text: await val.text() }])
    }
    return { __formData: out }
  }
  if (typeof File !== 'undefined' && v instanceof File) return { __file: true, name: v.name, type: v.type, size: v.size, text: await v.text() }
  return v
}
async function call(name, args) {
  const body = JSON.stringify({ args: await Promise.all(args.map(encode)) })
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
export default forwardRef(function Link({ href, children, prefetch, replace, scroll, shallow, passHref, legacyBehavior, ...rest }, ref) {
  const h = typeof href === 'string' ? href : href && typeof href === 'object' ? (href.pathname || '') + (href.search || (href.query ? '?' + new URLSearchParams(href.query) : '')) : String(href)
  return createElement('a', { href: h, ref, ...rest }, children)
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
  window.addEventListener('popstate', () => { window.__vfNav.push({ kind: 'popstate', url: location.pathname + location.search }); window.dispatchEvent(new Event(EVT)) })
}
function subscribe(cb) { window.addEventListener(EVT, cb); return () => window.removeEventListener(EVT, cb) }
const search = () => location.search
const pathname = () => location.pathname
export function useSearchParams() { const s = useSyncExternalStore(subscribe, search, search); return useMemo(() => new URLSearchParams(s), [s]) }
export function usePathname() { return useSyncExternalStore(subscribe, pathname, pathname) }
const router = {
  refresh() { window.__vfNav.push({ kind: 'refresh', url: location.pathname + location.search }) },
  push(href) { window.history.pushState(null, '', href) },
  replace(href) { window.history.replaceState(null, '', href) },
  back() { window.history.back() },
  forward() { window.history.forward() },
  prefetch() {},
}
export function useRouter() { return router }
export function useParams() { return {} }
export function useSelectedLayoutSegment() { return null }
export function redirect(href) { throw new Error('harness: redirect(' + href + ') is server-only') }
export function notFound() { throw new Error('harness: notFound() is server-only') }
`,
  '@/lib/supabase/client': `
function chain(path) {
  const settle = () => { (window.__vfSupabase ||= []).push(path.join('.')); return Promise.resolve({ data: null, error: { message: 'harness: Supabase 미연결(대역)' }, count: null, status: 0 }) }
  const fn = function () {}
  return new Proxy(fn, {
    get(_t, key) {
      if (key === 'then') { const p = settle(); return p.then.bind(p) }
      if (typeof key === 'symbol') return undefined
      return chain([...path, key])
    },
    apply() { return chain(path) },
  })
}
export function createClient() { return chain(['supabase']) }
`,
  '@/lib/analytics/client': `export function track(e) { (window.__vfEvents ||= []).push(e) }
export function trackEvent(...a) { (window.__vfEvents ||= []).push(a) }
export default { track }`,
}
const SHIM_FILTER = /^(next\/link|next\/image|next\/navigation|@\/lib\/supabase\/client|@\/lib\/analytics\/client)$/

const stories = fs.existsSync(path.resolve('src/app/admin/curation/story-actions.ts'))
const entry = `
import { createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { AdminShell } from '@/components/admin/AdminShell'
import { AdminCurationClient } from '@/app/admin/curation/AdminCurationClient'
// SYNTHETIC props (${SYNTHETIC_LABEL}) — tests/fixtures/lcp-story/original-curation.ts
const props = window.__VF_HARNESS_PROPS__ || ${JSON.stringify(ORIGINAL_PROPS)}
// page.tsx 머리말 마크업(RSC 라 번들하지 않음 — 같은 클래스 · 같은 글을 옮겨 적었다)
function PageHeader() {
  return h('header', { className: 'flex flex-col gap-1' },
    h('h1', { className: 'font-display text-[24px] font-[700] text-[var(--t1)]' }, '도서'),
    h('p', { className: 'font-body text-[13px] text-[var(--t2)]' }, '자료를 수집하고 도서 목록에서 검토·발행합니다.'))
}
createRoot(document.getElementById('root')).render(
  h(AdminShell, null, h('div', { className: 'flex flex-col gap-6 p-6' }, h(PageHeader), h(AdminCurationClient, props))))
`

const unknownServer: string[] = []
const r = await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: 'tsx' },
  bundle: true, write: false, metafile: true, format: 'iife', platform: 'browser', jsx: 'automatic', target: 'es2020',
  outdir: path.join(OUT_DIR, '.esbuild'),
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_SUPABASE_URL': '"http://supabase.harness.invalid"', 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': '"harness-anon-placeholder"' },
  banner: { js: 'var process = { env: { NODE_ENV: "production" } };' },
  loader: { '.css': 'empty', '.module.css': 'local-css', '.json': 'json' },
  plugins: [{
    name: 'vf-lcp-story-harness',
    setup(b) {
      b.onResolve({ filter: SHIM_FILTER }, (a) => ({ path: a.path, namespace: 'shim' }))
      b.onLoad({ filter: /.*/, namespace: 'shim' }, (a) => ({ contents: shims[a.path], loader: 'jsx', resolveDir: ROOT }))
      b.onResolve({ filter: /^@\// }, async (a) => b.resolve('./src/' + a.path.slice(2), { kind: a.kind, resolveDir: ROOT }))
      b.onLoad({ filter: /[\\/]src[\\/].*\.(ts|tsx)$/ }, (a) => {
        const text = fs.readFileSync(a.path, 'utf8')
        if (!USE_SERVER.test(text)) return {} // contents 없음 = 다음 로더(esbuild 기본)로 넘김
        const rel = path.relative(ROOT, a.path).replace(/\\/g, '/')
        const prefix = SERVER_ACTION_MODULES[rel]
        if (!prefix) { unknownServer.push(rel); return { contents: 'export {}', loader: 'js' } }
        return { contents: actionShim(a.path, prefix), loader: 'js', resolveDir: ROOT }
      })
    },
  }],
})
if (unknownServer.length) throw new Error(`대역 없는 'use server' 모듈이 번들에 들어왔다: ${unknownServer.join(', ')}`)
const inputs = Object.keys(r.metafile!.inputs).map((f) => f.replace(/\\/g, '/'))
const leaked = inputs.filter((f) => /@supabase[\\/](ssr|supabase-js|postgrest-js|auth-js)/.test(f) || /next[\\/]dist[\\/]/.test(f) || /[\\/]lib[\\/]supabase[\\/](server|admin)\.ts$/.test(f) || f.includes('node:'))
if (leaked.length) throw new Error(`browser harness must not bundle network/server clients: ${leaked.join(', ')}`)
const js = r.outputFiles.find((f) => f.path.endsWith('.js'))!.text
const moduleCss = r.outputFiles.filter((f) => f.path.endsWith('.css')).map((f) => f.text).join('\n')

fs.mkdirSync(OUT_DIR, { recursive: true })
const out = path.join(OUT_DIR, 'curation-harness.html')
// html: layout.tsx 의 글꼴 변수 클래스 · data-skin. data-theme 는 layout 의 첫 칠 스크립트가 저장값 · prefers-color-scheme 로 정한다 —
// 하네스는 Playwright 기본(light)과 같은 light 로 고정한다.
fs.writeFileSync(out, `<!doctype html><html lang="ko" class="${fontClasses.join(' ')}" data-skin="${skin}" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>도서 — Vocaflow Admin (격리 하네스 · 합성 데이터)</title><style>${fontCss}\n${appCss}\n${moduleCss}</style></head>
<body class="${bodyClass}"><div id="root"></div>
<script>${js.replace(/<\/script/g, '<\\/script')}</script></body></html>`)

// 번들에 실제로 들어간 저장소 소스(src/ · packages/)의 sha256 — UI 증거의 「검증한 파일」 목록
const sources = inputs
  .filter((f) => !f.startsWith('shim:') && !f.includes('node_modules') && !f.startsWith('<stdin>'))
  .map((f) => path.resolve(ROOT, f))
  .filter((f) => fs.existsSync(f))
  .map((abs) => ({ path: path.relative(REPO, abs).replace(/\\/g, '/'), sha256: createHash('sha256').update(fs.readFileSync(abs)).digest('hex') }))
  .sort((a, b) => a.path.localeCompare(b.path))
// 빌드 시점의 실제 Git 상태(셸 · 환경 변수 없이 git 직접 실행). 깨끗해도 「검증된 커밋」이라는 뜻은 아니다 — 판정은 별도 수용이 한다.
const git = (args: string[]) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim()
const head = git(['rev-parse', 'HEAD'])
const worktreeDirty = git(['status', '--porcelain']).length > 0
const manifest = {
  label: `${worktreeDirty ? 'uncommitted worktree on' : 'clean worktree at'} HEAD ${head.slice(0, 9)} — harness build manifest (not a verification verdict)`,
  head,
  worktree_dirty: worktreeDirty,
  story_actions_present: stories,
  html: path.relative(REPO, out).replace(/\\/g, '/'),
  html_sha256: createHash('sha256').update(fs.readFileSync(out)).digest('hex'),
  css_bytes: appCss.length,
  module_css_bytes: moduleCss.length,
  html_attrs: { class: fontClasses, data_skin: skin, data_theme: 'light', body_class: bodyClass },
  font_assets: fontAssets,
  sources,
}
fs.writeFileSync(path.join(OUT_DIR, 'build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`구움: ${path.relative(process.cwd(), out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB) · 앱 CSS ${(appCss.length / 1024).toFixed(0)} KB · module CSS ${moduleCss.length}B · 글꼴 자산 ${fontAssets.length}개 · 소스 ${sources.length}개 · story-actions ${stories ? '있음' : '없음'}`)
