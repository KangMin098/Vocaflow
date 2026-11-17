// apps/web/scripts/build-fast-worksheet-harness.mts
//
// 단계 3 FAST — 실제 관리자 화면 컴포넌트(FastWorksheet + AdminScreenHelp)와 실제 앱 CSS(globals.css → 앱 tailwind 설정, admin-app 스킨 포함)를
// data-area="admin" 아래에 올리는 격리 하네스를 굽는다. 서버 · 로그인 · DB 없음. build-factory-dcp-harness.mts 와 같은 방식.
// 대역(명시): next/link → <a>. POST /api/admin/csat/fast-worksheet 는 Playwright 스펙이 page.route 로 받아 **실제** evaluateFast/fastView/fastFiles 를 Node 에서 돌린다.
// 묶음: 1B 실제 경로(dcp-fixture packetOf · outputOf — 1B 실제 원천과 같은 CC0 본문)로 만든 FAST 묶음을 tests/fixtures/fast-harness-bundle.json 에 둔다.
//
//   pnpm --dir apps/web exec tsx scripts/build-fast-worksheet-harness.mts
//   pnpm --dir apps/web exec playwright test -c playwright.isolated.config.ts tests/e2e-isolated/fast-worksheet.isolated.spec.ts

import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { HarnessEsbuildApi } from './harness-esbuild-types'

import postcss from 'postcss'
import tailwindcss from 'tailwindcss'

import { FAST_BUNDLE_SCHEMA } from '../src/lib/csat/map/v62/factory-bridge/fast-worksheet'
import { outputOf, packetOf, snapshot } from '../src/lib/csat/map/v62/factory-bridge/__tests__/dcp-fixture'

const ROOT = path.resolve('.')
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
const css = (await postcss([tailwindcss({ config: path.resolve('tailwind.config.ts') })]).process(inlineImports(from), { from })).css
if (css.length < 10_000 || !css.includes('data-area="admin"')) {
  console.error(`앱 CSS 가 비었거나 admin 스킨이 없다(${css.length}B) — 스타일 없이 구우면 시각 검증이 거짓이 된다.`)
  process.exit(1)
}

const s = snapshot()
const packet = await packetOf(true, s)
const bundle = { schema: FAST_BUNDLE_SCHEMA, packet, base_output: outputOf(packet), source_snapshot: s, edit: null, review: null }
fs.writeFileSync(path.resolve('tests/fixtures/fast-harness-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`)

const entry = `
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { FastWorksheet } from '@/app/admin/csat/new/fast/FastWorksheet'
createRoot(document.getElementById('root')).render(createElement(FastWorksheet))
`
const r = await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: 'tsx' },
  bundle: true, write: false, metafile: true, format: 'iife', platform: 'browser', jsx: 'automatic', target: 'es2020',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.css': 'empty' },
  plugins: [{
    name: 'vf-harness',
    setup(b) {
      b.onResolve({ filter: /^next\/link$/ }, (a) => ({ path: a.path, namespace: 'shim' }))
      b.onLoad({ filter: /.*/, namespace: 'shim' }, () => ({ contents: `import { createElement } from 'react'; export default function Link({ href, children, ...rest }) { return createElement('a', { href: String(href), ...rest }, children) }`, loader: 'jsx', resolveDir: ROOT }))
      b.onResolve({ filter: /^@\// }, async (a) => b.resolve('./src/' + a.path.slice(2), { kind: a.kind, resolveDir: ROOT }))
    },
  }],
})
// 브라우저 번들에 Node crypto · 판정 helper 가 들어오면 안 된다(화면은 서버 DTO 만 받는다)
const leaked = Object.keys(r.metafile!.inputs).filter((f) => /factory-bridge[\\/](fast-worksheet|local-production|dcp-admission)\.ts$/.test(f) || f.includes('node:crypto'))
if (leaked.length) throw new Error(`server-only helper entered the browser bundle: ${leaked.join(', ')}`)
const js = r.outputFiles[0]!.text
const out = path.resolve('tests/fixtures/fast-worksheet-harness.html')
fs.writeFileSync(out, `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>FAST 빠른 학습지 하네스(격리)</title><style>${css}</style></head>
<body><div data-area="admin" class="min-h-screen bg-[var(--bg)]"><main class="mx-auto max-w-[1200px] px-8 py-8"><div id="root"></div></main></div>
<script>${js.replace(/<\/script/g, '<\\/script')}</script></body></html>`)
console.log(`구움: ${path.relative(process.cwd(), out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB) · CSS ${(css.length / 1024).toFixed(0)} KB`)
