// apps/web/scripts/build-csat-system-learning-harness.mts
//
// T-0091 — 기출 문항 「학습 정리」(SystemLearningSummary)와 과거 기록 읽기 전용 칸(SelfExplain · ReasoningNoteForm)을 **실제 제품 컴포넌트** ·
// 실제 앱 CSS · theater CSS module 로 브라우저에 올리는 격리 하네스를 굽는다. 서버 · 로그인 · DB 없음(실제 서버 종단 검증이 아니다).
// 상태는 주소 해시로 고른다: #prepared · #preparing · #history · #loading · #empty. 정리 모델은 실제 buildLearningSummary 가 만든다.
// 대역(명시): next/link → <a> · @/lib/analytics/client → window.__vfEvents. 다음 활동 · 보관 클릭은 window.__vfActions 에 남는다.
// 출력은 커밋하지 않는 작업트리 .vfc-runs/ 에 쓴다.
//
//   pnpm --filter web exec tsx scripts/build-csat-system-learning-harness.mts

import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { HarnessEsbuildApi } from './harness-esbuild-types'

import postcss from 'postcss'
import tailwindcss from 'tailwindcss'

const ROOT = path.resolve('.')
const require = createRequire(path.join(ROOT, 'package.json'))
const viteRequire = createRequire(createRequire(require.resolve('vitest/package.json')).resolve('vite/package.json'))
const { build } = viteRequire('esbuild') as HarnessEsbuildApi
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

const shims: Record<string, string> = {
  'next/link': `import { createElement } from 'react'; export default function Link({ href, children, ...rest }) { return createElement('a', { href: typeof href === 'string' ? href : String(href), ...rest }, children) }`,
  '@/lib/analytics/client': `export function track(e) { (window.__vfEvents ||= []).push(e) }`,
}
const entry = `
import { createElement as h, Fragment, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SystemLearningSummary } from '@/components/csat/theater/SystemLearningSummary'
import { SelfExplain } from '@/components/csat/theater/SelfExplain'
import { ReasoningNoteForm } from '@/components/csat/theater/ReasoningNoteForm'
import { InquiryDock } from '@/components/csat/theater/InquiryDock'
import { buildLearningSummary } from '@/lib/csat/system-learning'

const act = (a) => { (window.__vfActions ||= []).push(a) }
const state = (location.hash || '#prepared').slice(1)
const long = '이 선지는 본문의 일부 표현을 그대로 가져왔지만, 필자가 그 표현을 쓴 조건(실험 집단에 한정)을 지우고 모든 경우로 넓혀 말하기 때문에 본문과 어긋나요. 한정 조건이 빠진 일반화는 이 유형에서 자주 쓰이는 매력적 오답 설계예요.'
const full = state !== 'empty'
const summary = buildLearningSummary({
  goal: full ? { relation: '필자의 판단 문장과 그것을 받치는 근거 문장의 관계를 찾는다', units: ['sentence', 'table_cell'] } : null,
  principle: full ? { statement: '판단 문장은 근거 문장의 사례가 바뀌어도 남는 공통 주장이다', when_applies: ['역접 뒤에 일반 진술이 올 때'], when_not: ['사례 문장만 반복될 때 — 사례는 판단이 아니다'] } : null,
  rejects: full ? [
    { key: 'analysis:reject:2', title: '2', body: [long] },
    { key: 'analysis:reject:4', title: '4', body: ['본문은 비용을 말하지 않아요. 언급되지 않은 정보를 더한 선지예요.'] },
  ] : [],
  checks: state === 'prepared' ? [{ kind: 'lure' }, { kind: 'evidence' }] : [],
  choiceEvidence: [{ n: 2, sentences: [2, 3] }],
  checkScene: (k) => (k === 'lure' ? 'judgment' : 'meaning'),
  hasCompare: full,
  hasLecture: full,
})
const notes = [
  { id: 'note-0001', item: '2026#34', pairIds: [], binding: { analysisVersion: 3 }, statement: '예전에 쓴 원리 노트 — 처음 설명', grounds: '', applicability: '역접 뒤', limit: '', evidence: [2, 3], afterExplanation: true, comparedWithModel: true, at: 1, updatedAt: 1 },
  { id: 'note-0002', item: '2026#34', pairIds: [], binding: { analysisVersion: 3 }, statement: '고친 설명 — 원본은 그대로', grounds: '', applicability: '', limit: '', evidence: [], afterExplanation: true, comparedWithModel: true, at: 2, updatedAt: 2, revisionOf: 'note-0001' },
]
const explained = [{ id: 'x1', item: '2026#34', kind: 'lure', choice: 2, tempting: '본문 표현이 그대로 있어서 끌렸다', reject: '조건이 빠졌다', at: 1, afterExplanation: true, compared: true }]

function App() {
  const [scene, setScene] = useState('explain')
  const [kept, setKept] = useState(false)
  const [highlight, setHighlight] = useState([])
  const go = (s) => { act({ go: s }); setScene(s); history.pushState(null, '', '?scene=' + s + location.hash) }
  return h('div', { style: { display: 'grid', gridTemplateRows: '1fr auto', height: '100vh' } },
    h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(260px, .65fr) minmax(0, 1fr)', minHeight: 0 } },
    h('aside', { style: { padding: '32px', overflow: 'auto', borderRight: '1px solid var(--bd)', background: 'var(--bg2)' } },
      h('h2', null, '격리 합성 근거 판'),
      h('p', { style: { fontSize: '12px', marginBottom: '24px' } }, '실제 서버 종단이 아닌 컴포넌트 연결 검증'),
      ...['The study involved one particular group.', 'The finding applies within the experimental condition.', 'Extending it to every situation removes that condition.', 'The passage does not discuss costs.'].map((text, i) => h('p', { key: i, 'data-testid': 'fixture-sentence', 'data-selected': highlight.includes(i + 1), style: { padding: '16px', marginBottom: '12px', borderLeft: '3px solid ' + (highlight.includes(i + 1) ? 'var(--p)' : 'transparent'), background: highlight.includes(i + 1) ? 'var(--bg)' : 'transparent', lineHeight: 1.8 } }, (i + 1) + '. ' + text))),
    h('div', { 'data-testid': 'pane-explain', style: { overflow: 'auto', minWidth: 0, padding: '28px' } },
      scene === 'explain'
        ? h(SystemLearningSummary, {
            summary, canKeep: full, kept, onKeep: () => { act({ keep: true }); setKept(true) }, onGo: go,
            onLecture: () => act({ lecture: true }),
            onShowEvidence: (sentences, key) => { act({ evidence: sentences, key }); setHighlight(sentences) },
            historyState: state === 'loading' ? 'loading' : 'ready',
            history: state === 'history' ? h(Fragment, null, h(SelfExplain, { saved: explained }), h(ReasoningNoteForm, { analysisVersion: 3, principle: null, saved: notes, showModel: false, onShowEvidence: (s) => act({ evidence: s }) })) : null,
          })
        : h('p', { 'data-testid': 'other-scene', 'data-scene': scene }, scene))),
    h(InquiryDock, { current: scene, last: {}, onSelect: go }))
}
createRoot(document.getElementById('root')).render(h(App))
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
const outDir = path.resolve('../../.vfc-runs')
fs.mkdirSync(outDir, { recursive: true })
const out = path.join(outDir, 'csat-system-learning-harness.html')
fs.writeFileSync(out, `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>학습 정리 하네스(격리)</title><style>${css}\n${moduleCss}</style></head>
<body style="margin:0"><div id="root"></div>
<script>${js.replace(/<\/script/g, '<\\/script')}</script></body></html>`)
console.log(`구움: ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`)
