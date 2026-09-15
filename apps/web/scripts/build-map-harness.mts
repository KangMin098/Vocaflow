// apps/web/scripts/build-map-harness.mts
//
// **지문 지도만 담은 정적 HTML 을 굽는다 — 서버·로그인·DB 없이 접근성을 재기 위해.**
//
// 왜 굽는 단계가 따로 있나: Playwright 는 import 하는 TSX 를 **자기 JSX 런타임**으로 바꾼다.
// 그러면 `react-dom/server` 가 «Objects are not valid as a React child» 로 죽는다(실측
// 2026-09-15 · createElement 로 바꿔도 컴포넌트 **안쪽** JSX 에서 같은 일이 난다).
// 그래서 렌더는 올바른 런타임(tsx/esbuild)에서 하고, Playwright 는 결과 HTML 만 읽는다.
//
// CSS 는 빌드 산출물에서 통째로 가져온다 — 스타일 없이 재면 「대비 위반 0」이 거짓이 된다.
//
//   pnpm --filter web build && npx tsx scripts/build-map-harness.mts

import fs from 'node:fs'
import path from 'node:path'

import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

import { PassageMap } from '../src/components/csat/PassageMap'
import { ReportText } from '../src/components/csat/ReportText'
import type { MapAnchor } from '../src/lib/csat/passage-map-model'
import type { SkeletonSentence } from '../src/lib/csat/passage-skeleton'

/** 실제 문항(M2309#42)의 모양을 그대로 옮긴 고정값 — 막대 길이도 실제 값이다. */
const SENTENCES: SkeletonSentence[] = [
  { chars: 189, reveals: [] },
  {
    chars: 289,
    reveals: [
      { anchorId: 'reject:1', start: 171, end: 243, text: 'humans have failed to respond to climate change' },
    ],
  },
  {
    chars: 220,
    reveals: [{ anchorId: 'reject:2', start: 162, end: 219, text: 'too “improbable” to belong in stories' }],
  },
  { chars: 87, reveals: [] },
  {
    chars: 228,
    reveals: [
      { anchorId: 'answer', start: 40, end: 98, text: 'can be “imperceptible”; it proceeds (c) rapidly' },
    ],
  },
  { chars: 141, reveals: [] },
  { chars: 95, reveals: [] },
  { chars: 282, reveals: [] },
]

const ANCHORS: MapAnchor[] = [
  { id: 'answer', label: '③', kind: 'answer', detail: '세미콜론 앞의 imperceptible 과 정면으로 부딪힌다.' },
  {
    id: 'reject:1',
    label: '①',
    kind: 'reject',
    detail: '같은 문장의 주절이 fails 로 이어진다.',
    tempting: '문학을 다루는 글이라 소설을 옹호할 것 같다.',
  },
  { id: 'reject:2', label: '②', kind: 'reject', detail: '앞 문단이 같은 말을 다르게 적는다.' },
  // **위치를 못 찾은 근거**도 한 칸 넣는다 — 그 상태의 대비·터치 타깃도 재야 한다.
  { id: 'reject:4', label: '④', kind: 'reject', detail: '자리를 못 찾은 근거의 설명.' },
]

const PLACEMENTS = [
  { id: 'answer', sentences: [4] },
  { id: 'reject:1', sentences: [1] },
  { id: 'reject:2', sentences: [2] },
  { id: 'reject:4', sentences: [] },
]

const cssDir = path.resolve('.next/static/css')
if (!fs.existsSync(cssDir)) {
  console.error('.next/static/css 가 없다 — 먼저 빌드할 것. 스타일 없이 구우면 대비 측정이 거짓이 된다.')
  process.exit(1)
}
const css = fs
  .readdirSync(cssDir)
  .filter((f) => f.endsWith('.css'))
  .map((f) => fs.readFileSync(path.join(cssDir, f), 'utf8'))
  .join('\n')

const mapMarkup = renderToString(
  createElement(PassageMap, { sentences: SENTENCES, anchors: ANCHORS, placements: PLACEMENTS }),
)

/**
 * 유형 리포트 산문 — 실제 리포트의 모양을 옮긴 고정값.
 * **문항 인용 링크**가 이 컴포넌트에서 새로 생긴 것이라, 그 링크의 대비·크기를 여기서 잰다
 * (인라인이라 44px 을 줄 수 없다 — 그러면 «얼마인가» 를 숫자로 알고 있어야 한다).
 */
const REPORT_TEXT =
  '**옛 회차(2014~2015)는 빈칸을 문단 끝에 놓는다.** 9문항 중 8문항의 빈칸이 마지막 문장' +
  '(2014B#32 7/7 · 2014B#33 9/9)에 있다. 예외는 2014A#33 하나뿐이다.' +
  String.fromCharCode(10, 10) +
  '그래서 근거가 빈칸 **뒤**에 있는 문항은 M1809#35 처럼 드물다.'
const KNOWN = new Set(['2014B#32', '2014B#33', '2014A#33', 'M1809#35'])

const reportMarkup = renderToString(
  createElement(ReportText, {
    text: REPORT_TEXT,
    known: KNOWN,
    className: 'rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4',
  }),
)

const markup =
  '<section class="mb-8" data-harness="map">' + mapMarkup + '</section>' +
  '<section data-harness="report"><h2 class="font-display text-sm font-bold text-[var(--t1)] mb-2">정답 근거는 어디 있나</h2>' +
  reportMarkup + '</section>'

const out = path.resolve('tests/fixtures/csat-map-harness.html')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(
  out,
  `<!doctype html><html lang="ko"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>지문 지도 접근성 하네스</title><style>${css}</style></head>` +
    `<body><main class="mx-auto max-w-3xl px-4 py-6">${markup}</main></body></html>`,
)
console.log(`구움: ${path.relative(process.cwd(), out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`)
