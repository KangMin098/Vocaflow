// apps/web/scripts/build-factory-card-harness.mts
//
// 2F — Workspace 「공장 연습 자료」 카드(FactoryDcpCard)를 **실제 제품 컴포넌트**와 실제 앱 CSS · 3B 팝업 CSS module 로 브라우저에 올리는
// 격리 하네스를 굽는다. 서버 · 로그인 · DB 없음. build-factory-dcp-harness.mts 와 같은 방식(앱 CSS 확보 · esbuild · 심).
// 대역(명시): next/link → <a> · @/lib/analytics/client → window.__vfEvents. GET 목록 · POST 요청 응답은 Playwright page.route 가 준다
//   (실제 API → 서비스 → SQL 은 reassess-plan.pglite.test.ts 의 2F 사례).
//
//   pnpm --dir apps/web exec tsx scripts/build-factory-card-harness.mts

import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import postcss from 'postcss'
import tailwindcss from 'tailwindcss'

const ROOT = path.resolve('.')
const require = createRequire(path.join(ROOT, 'package.json'))
const viteRequire = createRequire(createRequire(require.resolve('vitest/package.json')).resolve('vite/package.json'))
const { build } = viteRequire('esbuild') as typeof import('esbuild')
const cssDir = path.resolve(process.env.NEXT_DIST_DIR ?? '.next', 'static/css')

function inlineImports(file: string, seen = new Set<string>()): string {
  if (seen.has(file)) return ''
  seen.add(file)
  return fs.readFileSync(file, 'utf8').replace(/^@import\s+['"]([^'"]+)['"];?\s*$/gm, (_m, spec: string) =>
    inlineImports(spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : require.resolve(spec), seen))
}
async function appCss(): Promise<string> {
  if (fs.existsSync(cssDir)) {
    return fs.readdirSync(cssDir, { recursive: true }).map(String).filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(path.join(cssDir, f), 'utf8')).join('\n')
  }
  const from = path.resolve('src/app/globals.css')
  return (await postcss([tailwindcss({ config: path.resolve('tailwind.config.ts') })]).process(inlineImports(from), { from })).css
}
const css = await appCss()
if (css.length < 10_000 || !css.includes('--bd')) { console.error('앱 CSS 가 비었거나 토큰이 없다'); process.exit(1) }
const shellCss = fs.readFileSync(path.resolve('src/components/csat/space/space.module.css'), 'utf8').replace(/\.root\b/g, '.csat-harness-root')

const shims: Record<string, string> = {
  'next/link': `import { createElement } from 'react'; export default function Link({ href, children, ...rest }) { return createElement('a', { href: typeof href === 'string' ? href : String(href), ...rest }, children) }`,
  '@/lib/analytics/client': `export function track(e) { (window.__vfEvents ||= []).push(e) }`,
}
const entry = `
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { FactoryDcpCard } from '@/components/csat/diagnosis/map/FactoryDcpCard'
createRoot(document.getElementById('root')).render(createElement(FactoryDcpCard, { template: 'ws.central-meaning', ctx: { task: 'r.central_meaning', ws: 'ws.central-meaning' } }))
`
const r = await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: 'tsx' },
  bundle: true, write: false, outdir: 'harness-out', format: 'iife', platform: 'browser', jsx: 'automatic', target: 'es2020',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.module.css': 'local-css', '.css': 'empty' },
  plugins: [{
    name: 'vf-harness',
    setup(b) {
      b.onResolve({ filter: /^(next\/link|@\/lib\/analytics\/client)$/ }, (a) => ({ path: a.path, namespace: 'shim' }))
      b.onLoad({ filter: /.*/, namespace: 'shim' }, (a) => ({ contents: shims[a.path], loader: 'jsx', resolveDir: ROOT }))
      b.onResolve({ filter: /^@\// }, async (a) => b.resolve('./src/' + a.path.slice(2), { kind: a.kind, resolveDir: ROOT }))
    },
  }],
})
const js = r.outputFiles.find((f) => f.path.endsWith('.js'))!.text
const moduleCss = r.outputFiles.filter((f) => f.path.endsWith('.css')).map((f) => f.text).join('\n')
const out = path.resolve('tests/fixtures/factory-card-harness.html')
fs.writeFileSync(out, `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>공장 연습 자료 카드 하네스(격리)</title><style>${css}\n${shellCss}\n${moduleCss}</style></head>
<body><div class="csat-harness-root" style="display:block"><main class="mx-auto max-w-3xl px-6 py-8"><div id="root"></div></main></div>
<script>${js.replace(/<\/script/g, '<\\/script')}</script></body></html>`)
console.log(`구움: ${path.relative(process.cwd(), out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`)
