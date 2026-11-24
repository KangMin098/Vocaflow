// apps/web/scripts/build-factory-dcp-harness.mts
//
// 단계 1D D5 — 공장 DCP 지도 연습 Runner 를 **실제 제품 컴포넌트**(FactoryDcpRunner → DcpPlayer → DcpChoiceItem)와
// **실제 앱 CSS**(빌드 산출물 또는 globals.css 를 앱 tailwind 설정으로 컴파일 — appCss 참고)로 브라우저에 올리는 격리 하네스를 굽는다. 서버 · 로그인 · DB 없음.
//
// 실제 제품 부분: FactoryDcpRunner · DcpPlayer · DcpItems · lucide 아이콘 · 앱 CSS · 디자인 토큰.
// 대역(명시):
//   · next/link → <a> 심(앱 라우터 없이 마운트하기 위해). 링크 href 는 그대로.
//   · @/lib/learner/dcp-actions → 브라우저 심(서버 액션은 next/headers 를 끌어온다). 이 화면은 grade 를 직접 넘기므로
//     심의 grade 는 호출되지 않는다. recordDcpErrorCause 는 { ok:true } 를 돌려주는 대역이다(오답 원인 1-tap 기록은 범위 밖).
//   · 문항: 1B 실제 원천 본문(dcp-fixture CONTENT, CC0)과 1B 요지 문항 선택지. 정답키는 하네스에 싣지 않는다.
//   · POST /api/csat/factory/…/attempt 응답은 Playwright 스펙이 page.route 로 준다 — 실제 SQL 판정은 dcp-learning.pglite.test.ts.
//
//   pnpm --filter web build  (또는 NEXT_DIST_DIR=.next-verify …)  &&  pnpm --dir apps/web exec tsx scripts/build-factory-dcp-harness.mts

import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { HarnessEsbuildApi } from './harness-esbuild-types'

import postcss from 'postcss'
import tailwindcss from 'tailwindcss'

import { CONTENT } from '../src/lib/csat/map/v62/factory-bridge/__tests__/dcp-fixture'
import { beforeAnswerSupport, formativeFeedback, LESSON_SENTENCES } from '../src/lib/csat/map/v62/factory-bridge/source-lesson'

const ROOT = path.resolve('.')
const require = createRequire(path.join(ROOT, 'package.json'))
// esbuild 는 web 의 직접 의존성이 아니다 — 이미 설치된 vitest → vite 가 쓰는 같은 esbuild 를 빌린다(새 의존성 없음)
const viteRequire = createRequire(createRequire(require.resolve('vitest/package.json')).resolve('vite/package.json'))
const { build } = viteRequire('esbuild') as HarnessEsbuildApi
const distDir = process.env.NEXT_DIST_DIR ?? '.next'
const cssDir = path.resolve(distDir, 'static/css')

/** CSS @import 를 실제 파일로 펼친다(패키지 경로 · 상대 경로) — Next 의 css-loader 가 하는 일 중 이 하네스에 필요한 부분 */
function inlineImports(file: string, seen = new Set<string>()): string {
  if (seen.has(file)) return ''
  seen.add(file)
  return fs.readFileSync(file, 'utf8').replace(/^@import\s+['"]([^'"]+)['"];?\s*$/gm, (_m, spec: string) => {
    const target = spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : require.resolve(spec)
    return inlineImports(target, seen)
  })
}

/**
 * 앱 CSS — ① 빌드 산출물(<distDir>/static/css)이 있으면 그것, ② 없으면 실제 src/app/globals.css 를 앱의 tailwind.config.ts 로
 * 직접 컴파일한다(postcss.config.mjs 와 같은 플러그인). 실행 중 dev 산출물(.next-dev)은 읽지도 지우지도 않는다.
 * ②에는 layout.tsx 가 따로 import 하는 웹폰트(@fontsource)가 없다 — 서체는 대체 글꼴로 그려진다(캡처 비평 시 감안).
 */
async function appCss(): Promise<{ css: string; source: string }> {
  if (fs.existsSync(cssDir)) {
    const css = fs.readdirSync(cssDir, { recursive: true }).map(String).filter((f) => f.endsWith('.css'))
      .map((f) => fs.readFileSync(path.join(cssDir, f), 'utf8')).join('\n')
    return { css, source: path.relative(ROOT, cssDir) }
  }
  const from = path.resolve('src/app/globals.css')
  const r = await postcss([tailwindcss({ config: path.resolve('tailwind.config.ts') })]).process(inlineImports(from), { from })
  return { css: r.css, source: 'src/app/globals.css → tailwindcss(tailwind.config.ts)' }
}
const { css, source: cssSource } = await appCss()
// 실제 CsatShell 의 CSS module root 에 있는 3B 토큰을 같은 범위로 적용한다.
// CSS module 번들러 없이 실행하므로 root 선택자 이름만 바꾼다. 레일/상단 바는 이 Runner 하네스 범위 밖이다.
const shellCss = fs.readFileSync(path.resolve('src/components/csat/space/space.module.css'), 'utf8')
  .replace(/\.root\b/g, '.csat-harness-root')
if (css.length < 10_000 || !css.includes('--bd')) {
  console.error(`앱 CSS 가 비었거나 토큰이 없다(${cssSource}, ${css.length}B) — 스타일 없이 구우면 시각 검증이 거짓이 된다.`)
  process.exit(1)
}

const ITEM = {
  id: '00000000-0000-4000-8000-00000000d1d1', type: 'main_point', paragraphIdx: 0,
  payload: {
    passage: CONTENT, stemKo: '다음 글의 요지로 가장 적절한 것은?', underline: null, summarySentence: null,
    choices: ['그림은 세부보다 전체 구도를 먼저 보아야 한다.', '제목은 감상자가 주목할 곳을 정하므로 작품의 일부이다.', '집단마다 취향이 달라 같은 그림을 다르게 묘사한다.',
      '예술가는 작품에 제목을 붙이지 말아야 한다.', '노래의 제목은 그림의 제목보다 영향이 크다.'],
  },
}
const DELIVERY = '00000000-0000-4000-8000-00000000dd01'
const reviewed = JSON.parse(fs.readFileSync(path.resolve('../../docs/implementation/learning-outcomes-20261021/evidence/ai-trial-portable-evidence.json'), 'utf8'))
  .training_script.items as { type: string; stem: string; choices: { text: string }[] }[]
const lessonItems = Object.fromEntries(reviewed.map((it) => [it.type, {
  ...ITEM, type: it.type, payload: { ...ITEM.payload, stemKo: it.stem, choices: it.choices.map((c) => c.text) },
}]))
// Compute server-only lesson projections here: the browser bundle receives no model/Gold asset.
const lessonBefore = Object.fromEntries((['main_point', 'title', 'topic'] as const).map((s) => [s, beforeAnswerSupport(s)]))
// 2C — savedReflection 이 돌려주는 닫힌 복원 값(본인 본문 · 형성 피드백 · 다음 단계). 실제 SQL 복원은 reassess-plan.pglite 가 검증한다
const NEXT_OF = { main_point: 'title', title: 'topic', topic: null } as const
const restoredFixtures = Object.fromEntries((['main_point', 'title', 'topic'] as const).map((s, i) => {
  const body = { step: s, claim: s === 'title' ? null : 6, support: s === 'title' ? [8] : s === 'topic' ? [1, 5] : [3], relation: `저장해 둔 ${s} 관계 설명이에요.`,
    comparison: s === 'main_point' ? '저장해 둔 비교 — 나는 사례에 머물렀다.' : null, procedure: s === 'topic' ? '저장해 둔 절차 — 사례와 설명을 가른다.' : null }
  const next = NEXT_OF[s] ? { type: NEXT_OF[s], deliveryId: `00000000-0000-4000-8000-00000000dd0${i + 2}`, state: 'ok', attempted: false, reflected: false } : null
  return [s, { reflectionId: `00000000-0000-4000-8000-00000000ee0${i + 1}`, attemptId: `00000000-0000-4000-8000-00000000ef0${i + 1}`, step: s, body, feedback: formativeFeedback(s, body.claim, body.support), next }]
}))

const shims: Record<string, string> = {
  'next/link': `import { createElement } from 'react'; export default function Link({ href, children, ...rest }) { return createElement('a', { href: typeof href === 'string' ? href : String(href), ...rest }, children) }`,
  '@/lib/learner/dcp-actions': `export async function gradeDcpItem() { return { ok: false, error: 'harness: server grade not used' } } export async function recordDcpErrorCause() { return { ok: true } }`,
  // 계측 대역 — 실제 전송 대신 window.__vfEvents 에 쌓는다(스펙이 이름 · 속성 모양을 단언). funnel_events 적재는 범위 밖
  '@/lib/analytics/client': `export function track(e) { (window.__vfEvents ||= []).push(e) }`,
}

const entry = `
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { FactoryDcpRunner } from '@/components/csat/factory/FactoryDcpRunner'
// 2B — #lesson=main_point|title|topic 이면 페이지(page.tsx)가 넘기는 것과 같은 교수 자료 props(답변 전 지원 · 문장 목록)를 싣는다. 시범은 싣지 않는다
const base = ${JSON.stringify({ deliveryId: DELIVERY, item: ITEM, returnHref: '/csat/diagnosis?tab=map&view=full', attempts: 0 })}
const step = (/lesson=(main_point|title|topic)/.exec(location.hash) || [])[1]
const items = ${JSON.stringify(lessonItems)}
const before = ${JSON.stringify(lessonBefore)}
const sentences = ${JSON.stringify(LESSON_SENTENCES)}
// 2C — #restore=1 이면 page.tsx 가 savedReflection 으로 읽어 넘기는 것과 같은 닫힌 복원 값 · #restore=fail 이면 읽기 실패
const restoredOf = ${JSON.stringify(restoredFixtures)}
const restore = (/restore=(1|fail)/.exec(location.hash) || [])[1]
const props = step ? { ...base, item: items[step],
  lesson: { step, before: before[step], sentences, returnQuery: '?from=map', restored: restore === '1' ? restoredOf[step] : null, restoreFailed: restore === 'fail' } } : base
createRoot(document.getElementById('root')).render(createElement(FactoryDcpRunner, props))
`

const r = await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: 'tsx' },
  bundle: true, write: false, metafile: true, format: 'iife', platform: 'browser', jsx: 'automatic', target: 'es2020',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.css': 'empty' },
  plugins: [{
    name: 'vf-harness',
    setup(b) {
      b.onResolve({ filter: /^(next\/link|@\/lib\/learner\/dcp-actions|@\/lib\/analytics\/client)$/ }, (a) => ({ path: a.path, namespace: 'shim' }))
      b.onLoad({ filter: /.*/, namespace: 'shim' }, (a) => ({ contents: shims[a.path], loader: 'jsx', resolveDir: ROOT }))
      b.onResolve({ filter: /^@\// }, async (a) => b.resolve('./src/' + a.path.slice(2), { kind: a.kind, resolveDir: ROOT }))
    },
  }],
})
const js = r.outputFiles[0]!.text
if (!r.metafile || Object.keys(r.metafile.inputs).some((f) => f.replace(/\\/g, '/').endsWith('/source-lesson-title-route.v3.json'))) {
  throw new Error('server-only model/Gold asset entered the browser harness bundle')
}
const out = path.resolve('tests/fixtures/factory-dcp-harness.html')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>공장 DCP 연습 하네스(격리)</title><style>${css}\n${shellCss}</style></head>
<body><div class="csat-harness-root" style="display:block"><main class="mx-auto max-w-3xl px-6 py-8"><h1 class="font-display text-[20px] font-[800] text-[var(--t1)] mb-4 break-keep">글의 중심 잡기 · 안내 연습</h1><div id="root"></div></main></div>
<script>${js.replace(/<\/script/g, '<\\/script')}</script></body></html>`)
console.log(`구움: ${path.relative(process.cwd(), out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB) · delivery ${DELIVERY} · CSS ${cssSource} (${(css.length / 1024).toFixed(0)} KB)`)
