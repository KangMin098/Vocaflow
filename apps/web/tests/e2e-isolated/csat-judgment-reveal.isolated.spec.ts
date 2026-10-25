// apps/web/tests/e2e-isolated/csat-judgment-reveal.isolated.spec.ts
//
// 판단 장면 정답 지연 조회 (b) · T-0147 — 실제 AnalysisTheater · 실제 CSS 를 브라우저(1280/1440)에 띄우는 **인증 없는 격리 하네스**.
// 첫 응답 props 는 서버와 같은 분리 규칙(lib/csat/lecture/answer-split.ts)으로 실제 정본(탐구 · 골격 · 강의)에서 만들고,
// 「정답 보기」 를 누를 때만 판단 라우트 응답(공개 응답)을 Playwright route 로 돌려준다.
// 범위: 화면 DOM · ARIA · data-* · 키보드 · 포커스 · 요청 시점. 실제 RSC 직렬화 · 판단 라우트 서버 · DB 기록 · 로그인 화면은
// 이 하네스가 보지 않는다(NOT_VERIFIED · 실계정 E2E 는 BLOCKED_AUTH). 문항 분석 본문(why_correct 등)은 DB 에만 있어 표식 문자열로 대신한다.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

import { expect, test, type Page } from '@playwright/test'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'

import { lookupInquiry } from '../../src/lib/csat/inquiry/data'
import { lectureDisclosure, lectureUntil } from '../../src/lib/csat/lecture/disclosure'
import { lectureMeta, lectureOutline, loadLecture } from '../../src/lib/csat/lecture/store'
import { neutralSteps, splitAnswer, splitMapSentences, type TheaterAnswerData } from '../../src/lib/csat/lecture/answer-split'
import { maskDisclosureSteps, theaterBlocks, theaterSteps, type TheaterSource } from '../../src/lib/csat/theater'
import { buildChecks } from '../../src/lib/csat/understanding-check'
import type { HarnessEsbuildApi } from '../../scripts/harness-esbuild-types'

const ROOT = path.resolve(__dirname, '../..')
const requireFromWeb = createRequire(path.join(ROOT, 'package.json'))
const viteRequire = createRequire(createRequire(requireFromWeb.resolve('vitest/package.json')).resolve('vite/package.json'))
const { build } = viteRequire('esbuild') as HarnessEsbuildApi
const ARTIFACTS = process.env.T0147_ARTIFACTS ?? path.resolve(ROOT, '../../../Vocaflow-AI-Control/runtime/t0147-ui')

// R147-10 대표 문항(근거 문장 위치가 정답 밑줄을 특정하던 강의) — 실제 정본에서 첫 응답 · 공개 응답을 만든다
const ITEMS = ['2014A#27', '2023#30', 'M2309#30'] as const
const SECRET = { why: 'ZZ정답근거표식', reject: 'ZZ오답소거표식', ability: 'ZZ재는능력표식' }

function skeletonOf(id: string) {
  const exam = id.split('#')[0]
  const f = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/lib/csat/skeleton-data', `${exam}.json`), 'utf8')) as { items: { id: string; sentences: { chars: number; reveals: unknown[] }[]; anchors: { id: string; sentences: number[]; from?: string }[] }[] }
  const s = f.items.find((x) => x.id === id)
  if (!s) throw new Error(`골격 없음 ${id}`)
  return s
}

function propsFor(id: string) {
  const hit = lookupInquiry(id, (JSON.parse(fs.readFileSync(path.join(ROOT, 'src/lib/csat/inquiry-data.json'), 'utf8')) as { items: Record<string, { analysis_version: number }> }).items[id]?.analysis_version ?? null)
  const inquiry = hit.state === 'ready' ? hit.record : null
  const answer = inquiry?.v3?.choices.find((c) => c.selected_as_answer)?.n ?? 3
  const sk = skeletonOf(id)
  const item = {
    id, exam_label: id.split('#')[0], no: Number(id.split('#')[1]), type_id: 'R-GRAMMAR', type_name: '어법', points: 3, time_budget_sec: 90,
    answer, answer_unknown: false, measured_ability: SECRET.ability, design_intent: SECRET.ability, why_correct: SECRET.why, evidence_reasoning: null,
    evidence_quote: null, distractors: [1, 2, 3, 4, 5].filter((n) => n !== answer).map((n) => ({ n, trap: '형태 오인', why_tempting: SECRET.reject, how_to_reject: SECRET.reject })),
    procedure: [{ step: SECRET.ability }], required_vocab: [],
  } as unknown as TheaterSource
  const anchors = [{ id: 'answer', label: String(answer), kind: 'answer' as const, detail: SECRET.why }, ...item.distractors.map((d) => ({ id: `reject:${d.n}`, label: String(d.n), kind: 'reject' as const, detail: SECRET.reject, tempting: SECRET.reject }))]
    .flatMap((a) => (sk.anchors.some((x) => x.id === a.id) ? [a] : []))
  const full: TheaterAnswerData = {
    blocks: theaterBlocks(item), anchors, placements: sk.anchors, checks: buildChecks({ id, type_id: 'R-GRAMMAR', distractors: item.distractors, map: { sentenceCount: sk.sentences.length, answerSentences: sk.anchors.find((x) => x.id === 'answer')?.sentences ?? [] } }),
    comparePairs: [], v3Pairs: [], inquiry, gate: { answer, evidence: sk.anchors.find((x) => x.id === 'answer')?.sentences ?? [], design: null },
  }
  const { initial, reveal } = splitAnswer(full, inquiry?.analysis_version ?? null)
  const steps = maskDisclosureSteps(theaterSteps(lectureOutline(id)))
  const sentences = splitMapSentences(sk.sentences as never)
  const props = {
    title: `${id} 해설`, examLabel: id.split('#')[0], typeName: '어법', points: 3, minutes: 4, steps: neutralSteps(steps),
    lectureDisclosure: { verified: false }, blocks: initial.blocks, checks: initial.checks, comparePairs: initial.comparePairs, v3Pairs: initial.v3Pairs,
    pairAbsence: null, pairWithheld: { held: 0, missing: 0, changed: 0 }, inquiry: initial.inquiry, initialScene: 'judgment', meaningSupport: null,
    map: { sentences: sentences.initial, anchors: initial.anchors, placements: initial.placements }, itemId: id, backHref: '/csat', typeHref: null, next: null,
    source: { url: null, direct: false, reason: null }, siblings: [], paper: { catalog: { items: [], exams: {}, papers: {}, anchored: [] }, examId: id.split('#')[0], no: Number(id.split('#')[1]) },
    gate: initial.gate, analysisVersion: inquiry?.analysis_version ?? null, typeId: 'R-GRAMMAR', finder: null,
  }
  return { props, reveal: { ...reveal, steps, mapSentences: sentences.reveal, meaningSupport: null }, fullSteps: steps, answer }
}

let bundle = ''
let css = ''

test.beforeAll(async () => {
  fs.mkdirSync(ARTIFACTS, { recursive: true })
  const result = await build({
    stdin: {
      contents: [
        "import { createRoot } from 'react-dom/client'",
        "import { AnalysisTheater } from '@/components/csat/theater/AnalysisTheater'",
        "import { LectureStage } from '@/components/csat/lecture/LectureStage'",
        // 강의 조작 검사는 실제 문항 페이지처럼 실제 LectureStage(무음 모드 · 실제 플레이어) 안에 극장을 둔다
        'const L = window.__lecture',
        'createRoot(document.getElementById("root")).render(L ? <LectureStage slug={L.slug} meta={L.meta} keys={false}><AnalysisTheater {...window.__props} /></LectureStage> : <AnalysisTheater {...window.__props} />)',
      ].join('\n'),
      loader: 'tsx', resolveDir: ROOT, sourcefile: 'judgment-harness.tsx',
    },
    absWorkingDir: ROOT, bundle: true, write: false, outdir: 'judgment-output', format: 'iife', platform: 'browser', jsx: 'automatic', target: 'es2020',
    define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_SUPABASE_URL': '"https://supabase.invalid"', 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': '"anon"' },
    plugins: [{
      name: 'next-shims',
      setup(b) {
        // 하네스 경계: Next 링크 → 일반 a, 브라우저 Supabase → 쓰기 · 조회 0 인 빈 클라이언트.
        // /csat/item 은 보호 라우트라 학습자는 항상 로그인 상태다 — 세션은 고정 합성 학습자(T-0172 소유자 결속 저장의 전제, T-0177)
        b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'shim' }))
        b.onResolve({ filter: /^@\/lib\/supabase\/client$/ }, () => ({ path: 'supabase', namespace: 'shim' }))
        b.onLoad({ filter: /^link$/, namespace: 'shim' }, () => ({ loader: 'tsx', resolveDir: ROOT, contents: "export default function Link({ href, children, prefetch: _p, ...r }: any) { return <a href={typeof href === 'string' ? href : '#'} {...r}>{children}</a> }" }))
        b.onLoad({ filter: /^supabase$/, namespace: 'shim' }, () => ({ loader: 'ts', resolveDir: ROOT, contents: "const q: any = new Proxy(function () {}, { get: (_t, k) => (k === 'then' ? undefined : () => q), apply: () => q }); const user = { id: 'harness-learner' }; export function createClient() { return { auth: { getUser: async () => ({ data: { user }, error: null }), getSession: async () => ({ data: { session: { user } }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }, from: () => q, rpc: async () => ({ data: null, error: null }) } }" }))
      },
    }],
  })
  bundle = result.outputFiles.find((f) => f.path.endsWith('.js'))?.text ?? ''
  const modulesCss = result.outputFiles.filter((f) => f.path.endsWith('.css')).map((f) => f.text).join('\n')
  const cssFile = path.join(ROOT, 'src/app/globals.css')
  const imports = (file: string, seen = new Set<string>()): string =>
    seen.has(file) ? '' : (seen.add(file), fs.readFileSync(file, 'utf8').replace(/^@import\s+['"]([^'"]+)['"];?\s*$/gm, (_m, spec: string) => imports(spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : requireFromWeb.resolve(spec), seen)))
  css = (await postcss([tailwindcss({ config: path.join(ROOT, 'tailwind.config.ts') })]).process(imports(cssFile), { from: cssFile })).css + '\n' + modulesCss
  if (!bundle) throw new Error('AnalysisTheater 번들 실패')
})

async function open(page: Page, id: string) {
  const { props, reveal } = propsFor(id)
  const calls: string[] = []
  const html = `<!doctype html><html lang="ko" data-skin="tines"><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"></div><script>window.__props=${JSON.stringify(props).replace(/</g, '\\u003c')}</script><script>${bundle.replace(/<\/script/g, '<\\/script')}</script></body></html>`
  await page.route('https://judgment.test/**', async (route) => {
    const u = new URL(route.request().url())
    if (u.pathname.endsWith('/judgment') && route.request().method() === 'POST') {
      calls.push(route.request().postData() ?? '')
      return route.fulfill({ contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify({ ok: true, exposureId: 1, reveal }) })
    }
    if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"ok":false}' })
    return route.fulfill({ contentType: 'text/html', body: html })
  })
  await page.goto(`https://judgment.test/csat/item/${id.replace('#', '-')}`)
  await expect(page.getByTestId('judgment-reveal')).toBeVisible()
  return { calls, props, reveal }
}

/**
 * 시각 회귀(UI 게이트 ⑤) — 기준 이미지는 제품 저장소 밖(ARTIFACTS/baseline)에 둔다(TASK 허용 경로를 넓히지 않는다).
 * T0147_UPDATE_BASELINE=1 일 때만 기준을 쓰고, 그 밖에는 기준이 없으면 실패한다(갱신 없이 재비교가 통과해야 PASS).
 * 비교는 의존성 없이 브라우저 캔버스로 — 채널 차 > 16 인 픽셀이 0.1% 를 넘으면 회귀.
 */
async function matchBaseline(page: Page, name: string, shot: Buffer) {
  const dir = path.join(ARTIFACTS, 'baseline')
  const file = path.join(dir, `${name}.png`)
  if (process.env.T0147_UPDATE_BASELINE === '1') {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(file, shot)
    return
  }
  if (!fs.existsSync(file)) throw new Error(`기준 이미지 없음: ${file} — T0147_UPDATE_BASELINE=1 로 한 번 만든 뒤 갱신 없이 다시 비교한다`)
  const base = fs.readFileSync(file)
  const diff = await page.evaluate(async ([a, b]) => {
    const load = (src: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src })
    const [x, y] = await Promise.all([load(a), load(b)])
    if (x.width !== y.width || x.height !== y.height) return { size: true, ratio: 1 }
    const px = (img: HTMLImageElement) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d')!; g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data }
    const p = px(x)
    const q = px(y)
    let bad = 0
    for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - q[i]) > 16 || Math.abs(p[i + 1] - q[i + 1]) > 16 || Math.abs(p[i + 2] - q[i + 2]) > 16) bad++
    return { size: false, ratio: bad / (p.length / 4) }
  }, [`data:image/png;base64,${base.toString('base64')}`, `data:image/png;base64,${shot.toString('base64')}`] as const)
  expect(diff.size, `${name} 크기가 기준과 다르다`).toBe(false)
  expect(diff.ratio, `${name} 기준 대비 달라진 픽셀 비율`).toBeLessThanOrEqual(0.001)
}

/** 렌더된 화면 DOM(속성 포함 — data-* · aria-* · 숨은 텍스트) + 첫 응답 props 직렬화(RSC 에 해당). 번들 스크립트 본문은 제외 */
const dom = (page: Page) => page.evaluate(() => [document.getElementById('root')?.outerHTML ?? '', JSON.stringify((window as unknown as { __props: unknown }).__props)].join(' '))

for (const width of [1280, 1440]) {
  test.describe(`T-0147 판단 장면 정답 지연 · PC ${width}`, () => {
    test.use({ viewport: { width, height: 1000 } })

    for (const id of ITEMS) {
      test(`${id} — 공개 전 DOM · ARIA · data-* 에 정답 · 근거 위치가 없고, 요청 0`, async ({ page }) => {
        const { calls, reveal } = await open(page, id)
        const html = await dom(page)
        for (const s of Object.values(SECRET)) expect(html).not.toContain(s)
        expect(html).not.toMatch(/analysis:reject:\d|"anchorId"|data-lecture-target="analysis:answer"/)
        // 지도 문장 표지(anchor:sentence:n)는 모든 문장에 똑같이 붙는 위치 표지다 — 어느 문장도 강조 · 근거 칩 · 다른 속성으로 구별되지 않아야 한다
        const sentences = await page.locator('[data-proof="passage-map"] > li').evaluateAll((els) => els.map((el) => [...el.attributes].map((a) => a.name).sort().join(',')))
        expect(new Set(sentences).size).toBeLessThanOrEqual(1)
        expect(await page.locator('[data-live="true"]').count()).toBe(0)
        expect(await page.locator('[role="group"][aria-label="근거 고르기"] > *').count()).toBe(0)
        expect(html).not.toMatch(/정답 [①-⑤]/)
        // R147-10 — 브라우저에 실린 첫 응답 차례는 대상 없는 중립 차례다(원래 차례에는 근거 문장 위치가 있다 — 재현 전제)
        const first = await page.evaluate(() => (window as unknown as { __props: { steps: { name: string; targetKey: string }[] } }).__props.steps)
        expect(reveal.steps!.some((s) => /^anchor:sentence:\d+$/.test(s.targetKey))).toBe(true)
        expect(first.every((s, i) => s.targetKey === 'analysis:none' && s.name === `${i + 1}번째 설명`)).toBe(true)
        expect(first).toHaveLength(reveal.steps!.length)
        for (const c of reveal.inquiry.v3?.claims ?? []) expect(html).not.toContain(c.text)
        // 감춘 것을 「설명이 없다」 로 말하지 않는다
        await expect(page.getByTestId('scene-empty')).toHaveCount(0)
        expect(calls).toEqual([])
        const shot = await page.screenshot({ path: path.join(ARTIFACTS, `${id.replace('#', '-')}-before-${width}.png`), fullPage: false, animations: 'disabled', caret: 'hide' })
        await matchBaseline(page, `${id.replace('#', '-')}-before-${width}`, shot)
      })
    }

    test('키보드로 「정답 보기」 → 요청 1회 · 공개 뒤 정답 근거 · 원래 차례 표시 · 포커스 유지', async ({ page }) => {
      const id = ITEMS[0]
      const { calls, reveal } = await open(page, id)
      const btn = page.getByTestId('judgment-reveal').getByRole('button', { name: '정답 보기' })
      await btn.focus()
      expect(await btn.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none')
      await page.keyboard.press('Enter')
      await expect(page.getByText(SECRET.why).first()).toBeVisible()
      expect(calls).toHaveLength(1)
      const body = JSON.parse(calls[0]) as { source: string; clientExposureId: string; analysisVersion: number | null }
      expect(body.source).toBe('judgment_scene')
      expect(body.clientExposureId).toMatch(/^[0-9a-f-]{36}$/)
      const html = await dom(page)
      expect(html).toContain(SECRET.reject)
      // 공개 뒤 지도에 실제 근거 자리 칩이 생긴다(공개 응답의 앵커 · 문장 인용이 화면에 합쳐졌다)
      expect(reveal.anchors.length).toBeGreaterThan(0)
      expect(await page.locator('[role="group"][aria-label="근거 고르기"] > *').count()).toBeGreaterThan(0)
      // 다시 눌러도 새 요청 없음(받은 자료는 상태에만)
      expect(calls).toHaveLength(1)
      // 포커스가 문서 밖으로 튀지 않았다
      // 누른 단추가 사라지므로 포커스는 공개된 정답 근거 제목으로 옮겨진다(문서 밖으로 빠지지 않는다)
      await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[data-block="analysis:answer"]') != null)).toBe(true)
      const shot = await page.screenshot({ path: path.join(ARTIFACTS, `${id.replace('#', '-')}-after-${width}.png`), fullPage: false, animations: 'disabled', caret: 'hide' })
      await matchBaseline(page, `${id.replace('#', '-')}-after-${width}`, shot)
    })

    test('기록 실패(503) — 정답을 그리지 않고 다시 누를 수 있다', async ({ page }) => {
      const id = ITEMS[1]
      const { props } = propsFor(id)
      const html = `<!doctype html><html lang="ko" data-skin="tines"><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"></div><script>window.__props=${JSON.stringify(props).replace(/</g, '\\u003c')}</script><script>${bundle.replace(/<\/script/g, '<\\/script')}</script></body></html>`
      let n = 0
      await page.route('https://judgment.test/**', async (route) => {
        const u = new URL(route.request().url())
        if (u.pathname.endsWith('/judgment')) { n++; return route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"error":"지금은 정답을 열 수 없어요"}' }) }
        if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 404, body: '{}' })
        return route.fulfill({ contentType: 'text/html', body: html })
      })
      await page.goto(`https://judgment.test/csat/item/${id.replace('#', '-')}`)
      await page.getByTestId('judgment-reveal').getByRole('button', { name: '정답 보기' }).click()
      await expect(page.getByTestId('answer-reveal-failed').first()).toBeVisible()
      const dom1 = await dom(page)
      for (const s of Object.values(SECRET)) expect(dom1).not.toContain(s)
      expect(n).toBe(1)
      await expect(page.getByTestId('judgment-reveal').getByRole('button', { name: '정답 보기' })).toBeEnabled()
    })
  })
}

// ── 강의 조작(UI 게이트 수용 기준 ③) — 실제 LectureStage · 실제 플레이어(무음 모드 ?lecture-silent=1) · 가상 시계 ──────────────
// 2026#34: 검증 경계 stopBefore=2(c1 · c2 만) — 검토 불일치 c3 은 안전 cue 가 아니다(T-0140 B1). 강의 API 는 route 로
// 실제 lectureUntil 결과(until)를 주고, 전체(full)는 판단 라우트 기록 뒤에만 준다(서버 관문과 같은 순서 — 실제 서버 코드는 아님).
const LID = '2026#34'
function lectureFixture() {
  const lecture = loadLecture(LID)!
  const d = lectureDisclosure(LID, lecture)
  if (!d.verified) throw new Error('2026#34 경계 결속 실패')
  const base = propsFor(LID)
  const props = { ...base.props, initialScene: 'task', lectureDisclosure: { verified: true, stopBefore: d.stopBefore, preStopRisk: d.preStopRisk } }
  return { lecture, d, props, reveal: base.reveal, meta: lectureMeta(LID)! }
}

async function openLecture(page: Page) {
  const fx = lectureFixture()
  const log: string[] = []
  let revealed = false
  const html = `<!doctype html><html lang="ko" data-skin="tines"><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"></div><script>window.__props=${JSON.stringify(fx.props).replace(/</g, '\\u003c')};window.__lecture=${JSON.stringify({ slug: '2026-34', meta: fx.meta })}</script><script>${bundle.replace(/<\/script/g, '<\\/script')}</script></body></html>`
  await page.route('https://judgment.test/**', async (route) => {
    const u = new URL(route.request().url())
    if (u.pathname === '/api/csat/lecture') {
      const scope = u.searchParams.get('scope') ?? 'full'
      log.push(`lecture:${scope}`)
      if (scope === 'until') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, lecture: lectureUntil(fx.lecture, fx.d.stopBefore), disclosure: { scope: 'until', verified: true, stopBefore: fx.d.stopBefore, preStopRisk: fx.d.preStopRisk } }) })
      if (!revealed) return route.fulfill({ status: 403, contentType: 'application/json', body: '{"ok":false,"disclosure":{"scope":"full","needsReveal":true}}' })
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, lecture: fx.lecture, disclosure: { scope: 'full' } }) })
    }
    if (u.pathname.endsWith('/judgment')) {
      log.push(`judgment:${(JSON.parse(route.request().postData() ?? '{}') as { source?: string }).source}`)
      revealed = true
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, exposureId: 1, reveal: fx.reveal }) })
    }
    if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
    return route.fulfill({ contentType: 'text/html', body: html })
  })
  await page.clock.install()
  await page.goto('https://judgment.test/csat/item/2026-34?lecture-silent=1')
  const play = page.locator('header button').filter({ hasText: /하이라이트만|상영 시작|멈춤|이어서|처음부터/ })
  await expect(play).toBeVisible()
  return { fx, log, play }
}

for (const width of [1280, 1440]) {
  test.describe(`T-0147 강의 조작 · PC ${width}`, () => {
    test.use({ viewport: { width, height: 1000 } })

    test('①②③④ 경로 명시 선택 → until 만 받음(c3 제외) → 일시정지/이어서 → 경계 도달 → 정답 없이 마치기', async ({ page }) => {
      const { fx, log, play } = await openLecture(page)
      // ① 고르기 전에는 어떤 강의도 받지 않는다
      await play.click()
      await expect(page.getByTestId('lecture-chooser')).toBeVisible()
      expect(log).toEqual([])
      await page.getByTestId('lecture-path-until').click()
      await expect.poll(() => log).toEqual(['lecture:until'])
      // ⑥ 받은 범위 = c1 · c2(경계 앞) — c3 · 정답 cue 는 응답에 없다
      expect(lectureUntil(fx.lecture, fx.d.stopBefore).cues.map((c) => c.id)).toEqual(['c1', 'c2'])
      await expect(play).toHaveText(/멈춤/)
      // ② 일시정지 · 이어서 — 위치 유지
      const before = await page.evaluate(() => ({ y: window.scrollY, focus: document.activeElement?.tagName }))
      await play.click()
      await expect(play).toHaveText(/이어서/)
      await play.click()
      await expect(play).toHaveText(/멈춤/)
      // ③ 경계까지 재생(가상 시계) — 경계 안내가 열리되 포커스를 빼앗지 않는다(⑧)
      await page.clock.runFor((fx.lecture.cues[0].est_sec + fx.lecture.cues[1].est_sec + 5) * 1000)
      await expect(page.getByTestId('lecture-boundary')).toBeVisible()
      const after = await page.evaluate(() => ({ y: window.scrollY, focus: document.activeElement?.tagName, inBoundary: document.activeElement?.closest('[data-testid="lecture-boundary"]') != null }))
      expect(after.y).toBe(before.y)
      expect(after.inBoundary).toBe(false)
      // ④ 정답 없이 강의 마치기 — 전체 강의 · 정답 요청 없음, 경계 안내 닫힘
      await page.getByTestId('lecture-boundary-skip').click()
      await expect(page.getByTestId('lecture-boundary')).toHaveCount(0)
      await expect(page.locator('[aria-live="polite"]').filter({ hasText: '정답을 듣지 않고 강의를 마쳤어요' })).toHaveCount(1)
      expect(log).toEqual(['lecture:until'])
      expect(await page.locator('[data-live="true"]').count()).toBe(0)
      const shot = await page.screenshot({ path: path.join(ARTIFACTS, `lecture-closed-${width}.png`), animations: 'disabled', caret: 'hide' })
      await matchBaseline(page, `lecture-closed-${width}`, shot)
    })

    test('⑦ 경계에서 화살표 · 다음 차례로 넘지 못한다(끝남 · 일시정지 상태) — 경계 안내로', async ({ page }) => {
      const { fx, log, play } = await openLecture(page)
      await play.click()
      await page.getByTestId('lecture-path-until').click()
      await page.clock.runFor((fx.lecture.cues[0].est_sec + fx.lecture.cues[1].est_sec + 5) * 1000)
      await expect(page.getByTestId('lecture-boundary')).toBeVisible()
      await page.getByTestId('lecture-boundary-skip').click()
      // 포커스를 본문으로 돌리고(입력 · 단추 위가 아님) → 키를 여러 번
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight')
      await expect(page.getByTestId('lecture-boundary')).toBeVisible()
      expect(await page.locator('[data-live="true"]').count()).toBe(0)
      expect(log).toEqual(['lecture:until'])
    })

    test('⑤ 정답 포함 계속 듣기는 별도 동의 — 판단 기록(lecture_continue)이 먼저, 그 뒤에만 전체 강의', async ({ page }) => {
      const { fx, log, play } = await openLecture(page)
      await play.click()
      await page.getByTestId('lecture-path-until').click()
      await page.clock.runFor((fx.lecture.cues[0].est_sec + fx.lecture.cues[1].est_sec + 5) * 1000)
      await expect(page.getByTestId('lecture-boundary')).toBeVisible()
      // 경계 안내 자체는 동의가 아니다 — 아직 정답 요청 · 전체 강의 0
      expect(log).toEqual(['lecture:until'])
      await page.getByTestId('lecture-boundary-continue').focus()
      await page.keyboard.press('Enter')
      await expect.poll(() => log).toEqual(['lecture:until', 'judgment:lecture_continue', 'lecture:full'])
      await expect(play).toHaveText(/멈춤/)
    })

    test('⑤ 「전체(정답 포함)」 도 기록 뒤에만 — 실패하면 전체 강의를 받지 않고 다시 고르게', async ({ page }) => {
      const fx = lectureFixture()
      const log: string[] = []
      const html = `<!doctype html><html lang="ko" data-skin="tines"><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"></div><script>window.__props=${JSON.stringify(fx.props).replace(/</g, '\\u003c')};window.__lecture=${JSON.stringify({ slug: '2026-34', meta: fx.meta })}</script><script>${bundle.replace(/<\/script/g, '<\\/script')}</script></body></html>`
      await page.route('https://judgment.test/**', async (route) => {
        const u = new URL(route.request().url())
        if (u.pathname === '/api/csat/lecture') { log.push(`lecture:${u.searchParams.get('scope') ?? 'full'}`); return route.fulfill({ status: 403, body: '{"ok":false}' }) }
        if (u.pathname.endsWith('/judgment')) { log.push('judgment:fail'); return route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false}' }) }
        if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 404, body: '{}' })
        return route.fulfill({ contentType: 'text/html', body: html })
      })
      await page.goto('https://judgment.test/csat/item/2026-34?lecture-silent=1')
      await page.locator('header button').filter({ hasText: /하이라이트만|상영 시작/ }).click()
      await page.getByTestId('lecture-path-full').click()
      await expect.poll(() => log).toEqual(['judgment:fail'])
      await expect(page.getByTestId('lecture-chooser')).toBeVisible()
    })
  })
}
