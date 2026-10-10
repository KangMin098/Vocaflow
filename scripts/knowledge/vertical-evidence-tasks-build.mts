// scripts/knowledge/vertical-evidence-tasks-build.mts
//
// E축 확인 과제 사슬(「선지가 다시 말한 본문 문장」 · 「빈칸을 정하는 근거 문장」)을 **관리자 화면(Server Action)으로** 만든다(2026-10-10 · 사용자 승인).
// vertical-cohesion-link-build 와 같은 경로 — DB 에 직접 쓰지 않고 버튼을 눌러 같은 규칙 · 트리거 · 검토 기록을 탄다. 읽기만 service_role.
// 재실행 안전: 단계마다 이미 있으면 건너뛴다. 한 번 채택된 뒤 보류 · 재검토 중인 항목은 다시 채택 · 켜지 않는다.
//   만드는 것: 기제 1 · 방법 1 · 과제 2(검토 중) → implements(과제→방법→기제→본질) → 기출 원천 근거(원천 A·B 문항) →
//   탐구 질문(후보 · 지지 · 결론 · 남은 불확실성) → 채택 → 적용 13(문항 과제 11 · 지도 FIND A4-4 · A5-4) + 검증 계획 → 켜기 → 과제 「제품 적용」
//   계획 · 근거: docs/methodology/vertical/evidence-tasks.md · docs/csat-learner/ROLE_LEARNER_SIM_2026-10-10.md
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/knowledge/vertical-evidence-tasks-build.mts [--base http://localhost:3001] [--no-activate]
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(import.meta.dirname, '../..')
const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3001'
const OUT = path.join(ROOT, 'tmp/knowledge/vertical')
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const { chromium } = createRequire(path.join(ROOT, 'apps/web/package.json'))('@playwright/test')
fs.mkdirSync(OUT, { recursive: true })

const ESSENCE = 'essence-meaning-processing'
const REVIEW_FILE = path.join(ROOT, 'docs/methodology/vertical/evidence-tasks-review.md')
// 채택 사유 — 맹검 검토 기록 파일이 있어야 한다(없으면 채택하지 않는다)
const REVIEW = 'Claude 맹검 검토 2건(서로 독립 · 판정 기록 docs/methodology/vertical/evidence-tasks-review.md) 모두 adopt · Codex 검토는 이 환경에 Codex 가 없어 하지 못했다 — 채택은 제품 사용 판단이지 효과 입증이 아니다(efficacy 미확정)'
const OPTION_ITEMS = ['2026#22', '2026#23', '2026#24', '2025#22', '2025#23', '2025#24']
const BLANK_ITEMS = ['2026#31', '2026#32', '2026#33', '2026#34', '2025#32'] // 2025#31 은 인정 문장이 지문 절반을 넘어 뺐다(검토자 2)
const TYPE_OF: Record<string, string> = { '2026#22': 'R-GIST', '2026#23': 'R-TOPIC', '2026#24': 'R-TITLE', '2025#22': 'R-GIST', '2025#23': 'R-TOPIC', '2025#24': 'R-TITLE' }

const CHAIN = [
  { layer: 'principle', layerLabel: '원리', kind: '언어 처리 기제', slug: 'semantic-correspondence', title: '의미 대응', page: '/admin/knowledge/principles',
    statement: '수능 독해의 정답 선지는 본문의 한 문장 · 명제를 다른 말로 다시 말하고, 매력적인 오답 선지는 그 말을 범위 · 정도 · 주체 · 인과 중 하나에서 비튼다는 처리 후보(정본 §13 6 · 7). 근거는 기출 주제 · 제목 · 요지 · 빈칸 문항 관찰과 문항 근거 주석뿐이다 — 이 대응을 먼저 찾는 처리가 필수인지, 연습 효과가 있는지는 아직 확인하지 않았다.' },
  { layer: 'method', layerLabel: '방법론', kind: null, slug: 'method-option-correspondence', title: '선지와 본문 문장 맞대기', page: '/admin/knowledge/methods',
    statement: '선지를 고르기 전에 그 선지가 다시 말한 본문 문장을 찾아 번호를 적는다. 대응 문장을 찾지 못하거나 말이 어긋나면 그 선지를 지운다. 빈칸 문항에서는 빈칸 문장이 아니라 빈칸과 같은 내용을 다른 말로 한 문장을 근거로 찾는다.' },
  { layer: 'practice', layerLabel: '공부법', kind: null, slug: 'task-option-restate', title: '정답이 다시 말한 본문 문장 고르기', page: '/admin/knowledge/methods',
    statement: '기출 주제 · 제목 · 요지 문항 한 개에서 정답 선지가 다른 말로 다시 말한 본문 문장을 번호 하나로 고른다. 채점은 골격 근거 표시 · 역할 학습자 · 맹검 판정자가 겹친 합의 주석으로만 하고, 판정이 갈린 문장은 틀리지 않게 한다.' },
  { layer: 'practice', layerLabel: '공부법', kind: null, slug: 'task-evidence-locate', title: '빈칸을 정하는 근거 문장 고르기', page: '/admin/knowledge/methods',
    statement: '기출 빈칸 문항 한 개에서 빈칸에 들어갈 말을 정해 주는 근거 문장을 번호 하나로 고른다. 빈칸 문장 자체는 근거가 아니다. 채점은 합의 주석으로만 하고, 판정이 갈린 문장은 틀리지 않게 한다.' },
] as const
const INQUIRY = {
  slug: 'semantic-correspondence-csat',
  question: '수능 독해에서 정답 선지가 다시 말한 본문 문장(또는 빈칸의 근거 문장)을 먼저 찾는 것이 선지 판단에 어떤 역할을 하는가?',
  uncertainty: '연구 근거 없음(연구 서지 미등록) — 근거는 기출 관찰(원천 A · B)과 문항 합의 주석 11건뿐. 역할 학습자 시뮬레이션은 모델 · 규칙 학습자라 효과 근거가 아니다. 골격 근거 표시가 빈칸 문장 자체를 가리킨 사례(2026#32)가 있어 합의 주석만 쓴다. 효과는 실제 학습자 검증 전까지 미확정.',
}
const APPS = [
  ...OPTION_ITEMS.map((i) => ({ task: 'task-option-restate', surface: 'csat_item_task', ref: `option-restate:${i.replace('#', '-')}`, audience: { item: i, exam: 'suneung', type: TYPE_OF[i] } })),
  ...BLANK_ITEMS.map((i) => ({ task: 'task-evidence-locate', surface: 'csat_item_task', ref: `evidence-locate:${i.replace('#', '-')}`, audience: { item: i, exam: 'suneung', type: 'R-BLANK' } })),
  { task: 'task-option-restate', surface: 'learning_map_find', ref: 'a4-4', audience: { item: OPTION_ITEMS[0], items: OPTION_ITEMS.slice(1), line: 'A4', step: 'option' } },
  { task: 'task-evidence-locate', surface: 'learning_map_find', ref: 'a5-4', audience: { item: BLANK_ITEMS[0], items: BLANK_ITEMS.slice(1), line: 'A5', step: 'evidence' } },
]

const log = (s: string) => console.log(`· ${s}`)
const NO_ACTIVATE = process.argv.includes('--no-activate')
const one = async <T,>(q: PromiseLike<{ data: T | null; error: { message: string } | null }>) => { const { data, error } = await q; if (error) throw new Error(error.message); return data }
const itemRow = (slug: string) => one(db.from('knowledge_items').select('id, slug, status, title, layer').eq('slug', slug).maybeSingle()) as Promise<{ id: string; slug: string; status: string; title: string } | null>

if (!fs.existsSync(REVIEW_FILE) || !/adopt/.test(fs.readFileSync(REVIEW_FILE, 'utf8'))) throw new Error('맹검 검토 기록(evidence-tasks-review.md)이 없거나 adopt 가 없다 — 채택 사유 없이 만들지 않는다')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.setDefaultTimeout(180_000)
const go = async (url: string) => { await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}) }
const expectText = async (t: string | RegExp) => {
  const ok = page.getByText(t).first()
  const bad = page.locator('[role="alert"]').filter({ hasText: /./ }).first()
  await Promise.race([ok.waitFor(), bad.waitFor().then(async () => { throw new Error(`화면 오류: ${await bad.innerText()}`) })])
}
try {
  // 근거로 쓸 기출 원천 — A · B 등급만(G 는 근거 불가)
  const origins = await one(db.from('knowledge_csat_origins').select('item_ids, passage_sha256, grade').overlaps('item_ids', [...OPTION_ITEMS, ...BLANK_ITEMS])) as { item_ids: string[]; passage_sha256: string; grade: string }[]
  const usable = (items: string[]) => origins.filter((o) => o.grade !== 'G' && o.item_ids.some((i) => items.includes(i)))
  const optOrigins = usable(OPTION_ITEMS)
  const blankOrigins = usable(BLANK_ITEMS)
  if (!optOrigins.length || !blankOrigins.length) throw new Error('A · B 원천이 없는 과제가 있다 — 근거 없이 만들지 않는다')

  // 1) 항목 — 「새 항목 쓰기」(검토 중으로 저장)
  for (const c of CHAIN) {
    if (await itemRow(c.slug)) { log(`항목 있음 ${c.slug}`); continue }
    await go(c.page)
    await page.getByRole('button', { name: '새 항목 쓰기' }).click()
    await page.getByRole('radio', { name: new RegExp(`^${c.layerLabel}`) }).check()
    if (c.kind) await page.getByRole('radio', { name: new RegExp(`^${c.kind}`) }).check()
    await page.getByRole('textbox', { name: '제목' }).fill(c.title)
    await page.getByLabel(/주소 이름/).fill(c.slug)
    await page.getByLabel(/문장 — 근거를 재서술한다/).fill(c.statement)
    await page.locator('fieldset', { has: page.locator('legend', { hasText: '영역' }) }).getByRole('checkbox', { name: /독해|읽기/ }).first().check()
    await page.getByRole('button', { name: '검토 중으로 저장' }).click()
    await page.waitForURL(new RegExp(`/admin/knowledge/item/${c.slug}`))
    log(`항목 만듦 ${c.slug}`)
  }
  const [P, M, T1, T2] = await Promise.all(CHAIN.map((c) => itemRow(c.slug))) as { id: string; slug: string; status: string; title: string }[]
  const E = await itemRow(ESSENCE)
  if (!E) throw new Error(`본질 묶음 ${ESSENCE} 이 없다`)

  // 2) implements — 과제 2 → 방법 → 기제 → 본질
  const ups: [typeof P, string, string][] = [
    [T1, `방법론 · ${M.title}`, '이 과제는 선지-본문 맞대기 방법을 주제 · 제목 · 요지 문항에서 채점되게 한 것'],
    [T2, `방법론 · ${M.title}`, '이 과제는 선지-본문 맞대기 방법을 빈칸 근거 찾기로 채점되게 한 것'],
    [M, `원리 · ${P.title}`, '선지가 다시 말한 본문 문장을 적는 것이 의미 대응을 밖으로 드러내는 방법'],
    [P, `본질 · ${E.title}`, '선지와 본문의 의미 대응은 글의 의미 처리의 한 기제'],
  ]
  for (const [from, target, reason] of ups) {
    const { count } = await db.from('knowledge_links').select('id', { count: 'exact', head: true }).eq('from_id', from.id).eq('kind', 'implements')
    if (count) { log(`연결 있음 ${from.slug}`); continue }
    await go(`/admin/knowledge/item/${from.slug}`)
    const form = page.locator('section', { has: page.locator('#link-form') })
    await form.getByLabel('대상').selectOption({ label: target })
    await form.getByLabel('이유').fill(reason)
    await form.getByRole('button', { name: '연결' }).click()
    await expectText('연결했습니다.')
    log(`연결 ${from.slug} → ${target}`)
  }

  // 3) 기출 원천 근거 — 채택 전에(채택 뒤 근거 추가는 재검토를 부른다). 기제 · 방법은 두 원천 묶음 모두, 과제는 자기 문항 원천
  const evidenceFor: [typeof P, typeof optOrigins][] = [[P, [...optOrigins, ...blankOrigins]], [M, [...optOrigins, ...blankOrigins]], [T1, optOrigins], [T2, blankOrigins]]
  for (const [it, os] of evidenceFor) {
    for (const o of os) {
      const { count } = await db.from('knowledge_evidence').select('id', { count: 'exact', head: true }).eq('item_id', it.id).eq('csat_passage_sha256', o.passage_sha256)
      if (count) continue
      await go(`/admin/knowledge/item/${it.slug}`)
      const form = page.locator('section', { has: page.locator('#evidence-form') })
      await form.getByRole('radio', { name: '기출 원천' }).check()
      await form.getByLabel('귀속').selectOption('observed')
      await form.getByLabel(/기출 원천 \(A·B·C/).selectOption(o.passage_sha256)
      await form.getByLabel(/메모/).fill(`${o.item_ids.join(' · ')} — 정답 선지(또는 빈칸)가 본문의 어느 문장을 다시 말했는지를 잰다(기출 관찰 · 합의 주석).`)
      await form.getByRole('button', { name: '근거 추가' }).click()
      await expectText('근거를 연결했습니다.')
      log(`근거 ${it.slug} ← ${o.item_ids.join(',')}`)
    }
  }

  // 4) 탐구 질문
  let inq = await one(db.from('knowledge_inquiries').select('id, status').eq('slug', INQUIRY.slug).maybeSingle()) as { id: string; status: string } | null
  if (!inq) {
    await go('/admin/knowledge/lab')
    await page.getByLabel(/질문 — 무엇을 알고 싶은가/).fill(INQUIRY.question)
    await page.getByLabel(/주소 이름/).fill(INQUIRY.slug)
    await page.locator('fieldset', { has: page.locator('legend', { hasText: '영역' }) }).getByRole('checkbox', { name: /독해|읽기/ }).first().check()
    await page.getByRole('button', { name: '질문 열기' }).click()
    await expectText('질문을 열었습니다')
    inq = await one(db.from('knowledge_inquiries').select('id, status').eq('slug', INQUIRY.slug).single()) as { id: string; status: string }
    log('탐구 질문 열기')
  }
  const has = async (role: string, col: 'item_id' | 'evidence_id') => (await db.from('knowledge_inquiry_links').select('id', { count: 'exact', head: true }).eq('inquiry_id', inq!.id).eq('role', role).not(col, 'is', null)).count
  const box = page.locator('section', { has: page.getByRole('heading', { name: '주장 · 근거 잇기' }) })
  if (!(await has('candidate', 'item_id'))) {
    await go(`/admin/knowledge/lab/${INQUIRY.slug}`)
    await box.getByLabel('항목 주소 이름').fill(P.slug)
    await box.getByRole('combobox', { name: '역할' }).selectOption('candidate')
    await box.getByLabel(/메모/).fill('결론 후보 — 의미 대응을 처리 기제로 채택할지')
    await box.getByRole('button', { name: '잇기' }).click()
    await expectText('이었습니다')
    log('탐구 질문 ← 후보 항목')
  }
  if (!(await has('support', 'evidence_id'))) {
    const ev = await one(db.from('knowledge_evidence').select('id').eq('item_id', P.id).limit(1).single()) as { id: string }
    await go(`/admin/knowledge/lab/${INQUIRY.slug}`)
    await box.getByRole('radio', { name: '근거 한 건' }).check()
    await box.getByRole('combobox', { name: /^근거/ }).selectOption(ev.id)
    await box.getByRole('combobox', { name: '역할' }).selectOption('support')
    await box.getByLabel(/메모/).fill('기출 관찰(원천 A · B) — 연구 근거 아님')
    await box.getByRole('button', { name: '잇기' }).click()
    await expectText('이었습니다')
    log('탐구 질문 ← 지지 근거')
  }

  // 한 번이라도 채택됐는데 지금 채택이 아니면(보류 · 재검토) 다시 채택 · 켜지 않는다
  const everAdopted = async (id: string) => {
    const r = await db.from('knowledge_reviews').select('id', { count: 'exact', head: true }).eq('item_id', id).eq('to_status', 'adopted')
    if (r.error || r.count === null) throw new Error(`검토 이력 조회 실패(${id}): ${r.error?.message ?? 'count=null'}`)
    return r.count > 0
  }
  const held: string[] = []
  for (const it of [P, M, T1, T2]) {
    const now = await itemRow(it.slug)
    if (now && now.status !== 'adopted' && now.status !== 'applied' && (await everAdopted(it.id))) held.push(`${it.slug}(${now.status})`)
  }
  if (held.length) console.log(`· 보류 · 재검토 중 — 채택 · 켜기를 하지 않는다: ${held.join(', ')}`)
  const firstBuild = held.length === 0

  // 5) 채택 — 기제 → 방법 → 과제
  for (const slug of firstBuild ? [P.slug, M.slug, T1.slug, T2.slug] : []) {
    const now = await itemRow(slug)
    if (now && (now.status === 'adopted' || now.status === 'applied')) { log(`채택돼 있음 ${slug}`); continue }
    await go(`/admin/knowledge/item/${slug}`)
    await page.locator('#status-reason').fill(REVIEW)
    await page.getByRole('button', { name: '채택(으)로' }).click()
    await expectText('바꿨습니다. 검토 기록에 남았습니다.')
    log(`채택 ${slug}`)
  }
  if (inq.status !== 'concluded') {
    await go(`/admin/knowledge/lab/${INQUIRY.slug}`)
    const b = page.locator('section', { has: page.getByRole('heading', { name: '상태 · 결론' }) })
    await b.getByLabel('상태').selectOption('concluded')
    await b.getByLabel(/결론 항목/).selectOption(P.slug)
    await b.getByLabel(/남은 불확실성/).fill(INQUIRY.uncertainty)
    await b.getByRole('button', { name: '저장' }).click()
    await expectText('저장했습니다')
    log('탐구 질문 결론')
  }

  // 6) 적용 14 + 검증 계획 → 켜기
  const taskId = { 'task-option-restate': T1.id, 'task-evidence-locate': T2.id } as Record<string, string>
  for (const a of APPS) {
    let app = await one(db.from('knowledge_applications').select('id, status').eq('surface', a.surface).eq('surface_ref', a.ref).eq('item_id', taskId[a.task]).maybeSingle()) as { id: string; status: string } | null
    if (!app) {
      await go('/admin/knowledge/design')
      const b = page.locator('section', { has: page.getByRole('heading', { name: /새 적용 초안/ }) })
      await b.getByLabel(/항목\(과제 · 방법\)/).selectOption(a.task)
      await b.getByLabel('적용 표면').selectOption(a.surface)
      await b.getByLabel('과제 키').fill(a.ref)
      await b.getByLabel(/대상 조건/).fill(JSON.stringify(a.audience))
      await b.getByRole('button', { name: '초안 만들기' }).click()
      await expectText('적용 초안을 만들었습니다')
      app = await one(db.from('knowledge_applications').select('id, status').eq('surface', a.surface).eq('surface_ref', a.ref).eq('item_id', taskId[a.task]).single()) as { id: string; status: string }
      log(`적용 초안 ${a.surface}:${a.ref}`)
    }
    const { count: trials } = await db.from('knowledge_trials').select('id', { count: 'exact', head: true }).eq('application_id', app.id)
    if (!trials) {
      await go('/admin/knowledge/design')
      const b = page.locator('section', { has: page.getByRole('heading', { name: /효과 검증 계획/ }) })
      await b.getByLabel('적용').selectOption(app.id)
      await b.getByLabel(/지연 평가/).fill('14')
      await b.getByLabel(/최소 표본/).fill('30')
      await b.getByLabel(/비교 조건/).fill('같은 기간 이 과제를 하지 않은 주제 · 제목 · 요지 · 빈칸 문항 정답률')
      await b.getByLabel(/측정 지표/).fill('근거 문장 선택 첫 시도 정답률, 함정 문장 선택률, 미연습 같은 유형 문항(전이) 정답률')
      await b.getByRole('button', { name: '계획 저장' }).click()
      await expectText('검증 계획을 만들었습니다')
      log(`검증 계획 ${a.ref}`)
    }
    if (app.status === 'draft' && firstBuild && !NO_ACTIVATE) {
      await go('/admin/knowledge/product')
      await page.locator(`[data-testid="app-status-${app.id}"]`).getByRole('button', { name: '학습자에게 켜기' }).click()
      await expectText('저장했습니다')
      log(`켜기 ${a.ref}`)
    }
  }
  for (const T of [T1, T2]) {
    const now = await itemRow(T.slug)
    if (now?.status === 'adopted' && firstBuild && !NO_ACTIVATE) {
      await go(`/admin/knowledge/item/${T.slug}`)
      await page.locator('#status-reason').fill('문항 과제 · 학습 지도 FIND 적용이 켜졌다')
      await page.getByRole('button', { name: '제품 적용(으)로' }).click()
      await expectText('바꿨습니다. 검토 기록에 남았습니다.')
      log(`${T.slug} → 제품 적용`)
    }
  }
  await page.screenshot({ path: path.join(OUT, 'evidence-build-final.png'), fullPage: true })
  console.log(JSON.stringify(await one(db.from('knowledge_items').select('slug, status, efficacy, version').in('slug', CHAIN.map((c) => c.slug)))))
} finally {
  await browser.close()
}
