// scripts/knowledge/vertical-claim-support-build.mts
//
// Phase 3 첫 수직 경로 「주장과 근거 관계」 사슬을 **관리자 화면(Server Action)으로** 실제 데이터로 만든다(2026-10-08).
// DB 에 직접 쓰지 않는다 — 버튼을 눌러 같은 규칙 · 트리거 · 검토 기록을 탄다. 읽기만 service_role 로 한다(있는지 확인).
// 재실행 안전: 단계마다 이미 있으면 건너뛴다. 시험 데이터가 아니다 — 지우지 않는다.
//   만드는 것: 처리 기제 · 방법 · 실행 과제(검토 중으로) → implements 연결(과제→방법→기제→본질 「의미 처리」) →
//   기출 원천 근거(2022 수능 20번 · B) 3건 → 탐구 질문(후보 · 지지 연결 · 결론 · 남은 불확실성) →
//   채택(Claude 작성 + Codex 독립 검토 사유) → 제품 적용 2(문항 과제 · 학습 지도 FIND B6-3) + 검증 계획 → 켜기 → 과제 「제품 적용」
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/knowledge/vertical-claim-support-build.mts [--base http://localhost:3001]
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

const ITEM = '2022#20'
const ESSENCE = 'essence-meaning-processing'
const REVIEW = 'Claude Code 작성 · Codex 독립 검토 adopt(docs/methodology/vertical/claim-support.md §채택 검토) — 채택은 제품 사용 판단이지 효과 입증이 아니다(efficacy 미확정)'
const CHAIN = [
  { layer: 'principle', layerLabel: '원리', kind: '언어 처리 기제', slug: 'claim-support-relation', title: '주장과 근거 연결', page: '/admin/knowledge/principles',
    statement: '논증하는 글에서 필자의 주장 문장을 찾고, 다른 문장이 그 주장과 맺는 관계(이유·조건으로 떠받침 / 다른 말로 다시 함 / 필자가 반박하는 생각)를 연결해 논증 구조를 세우는 처리. 주장형 문항(필자의 주장·요지)에 쓰이는 처리 후보다 — 주장 문장 하나만으로 풀리는 문항도 있어 이 처리가 필수라는 근거는 없고, 연습 효과도 아직 확인하지 않았다.' },
  { layer: 'method', layerLabel: '방법론', kind: null, slug: 'method-claim-support-marking', title: '주장·뒷받침 문장 표시하며 읽기', page: '/admin/knowledge/methods',
    statement: '주장 문장 하나에 표시하고, 나머지 문장을 ① 이유·조건으로 주장을 떠받치는 문장 ② 주장을 다른 말로 다시 하는 문장 ③ 필자가 반박하는 생각(통념·실수)을 말하는 문장으로 나눠 적는다. 통념을 부정하며 주장 쪽으로 끌어오는 문장은 ①과 ③ 중 어디인지 판단이 갈릴 수 있어 따로 표시한다. 선지를 고르기 전에 표시한 주장과 비교한다.' },
  { layer: 'practice', layerLabel: '공부법', kind: null, slug: 'task-claim-support-link', title: '주장 문장·뒷받침 문장 고르고 관계 표시', page: '/admin/knowledge/methods',
    statement: '기출 주장형 문항 한 개에서 ① 주장이 가장 직접 드러난 문장 ② 이유·조건으로 주장을 떠받치는 문장(모두 — 주장을 다시 말한 문장 · 필자가 반박하는 생각은 빼고) ③ 지정한 한 문장과 주장의 관계를 문장 번호로 고른다. 채점은 두 판정자가 맹검으로 합의한 문항 주석으로만 하고, 판정이 갈린 문장은 채점에서 뺀다.' },
] as const
const INQUIRY = {
  slug: 'claim-support-relation-csat',
  question: '수능 독해에서 학생이 주장과 근거의 관계를 정확히 파악하는 것이 주장형 문항 판단에 어떤 역할을 하는가?',
  uncertainty: '연구 근거 없음(연구 서지 미등록) — 근거는 기출 관찰 1건(2022 수능 20번 · 원천 B)과 문항 주석 이중 맹검뿐. 효과는 실제 학습자 검증(사전·사후·지연·전이) 전까지 미확정. 3번째 문장처럼 뒷받침/반박 판정이 갈리는 문장이 있다.',
}

const log = (s: string) => console.log(`· ${s}`)
const one = async <T,>(q: PromiseLike<{ data: T | null; error: { message: string } | null }>) => { const { data, error } = await q; if (error) throw new Error(error.message); return data }
const itemRow = (slug: string) => one(db.from('knowledge_items').select('id, slug, status, title, layer').eq('slug', slug).maybeSingle())

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.setDefaultTimeout(180_000)
const go = async (url: string) => { await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}) }
const expectText = async (t: string | RegExp) => {
  // 성공 문장 또는 오류(role=alert) 중 먼저 오는 것 — 오류면 그 문장으로 멈춘다(무엇이 막았는지 알게)
  const ok = page.getByText(t).first()
  const bad = page.locator('[role="alert"]').filter({ hasText: /./ }).first()
  await Promise.race([ok.waitFor(), bad.waitFor().then(async () => { throw new Error(`화면 오류: ${await bad.innerText()}`) })])
}

try {
  const origin = await one(db.from('knowledge_csat_origins').select('passage_sha256, grade').contains('item_ids', [ITEM]).maybeSingle()) as { passage_sha256: string; grade: string } | null
  if (!origin || origin.grade === 'G') throw new Error('2022#20 원천이 A·B·C 가 아니다 — 근거로 쓸 수 없다')

  // 1) 항목 — 「새 항목 쓰기」 폼(검토 중으로 저장)
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
  const [P, M, T] = await Promise.all(CHAIN.map((c) => itemRow(c.slug))) as { id: string; slug: string; status: string; title: string }[]
  const E = await itemRow(ESSENCE) as { id: string; title: string } | null
  if (!E) throw new Error('본질 묶음 essence-meaning-processing 이 없다')

  // 2) implements 연결 — 과제→방법→기제→본질
  const ups: [typeof P, string, string][] = [[T, `방법론 · ${M.title}`, '이 과제는 표시하며 읽기 방법을 기출 한 문항에서 채점되게 한 것'], [M, `원리 · ${P.title}`, '주장·뒷받침을 표시하는 것이 관계 세우기를 밖으로 드러내는 방법'], [P, `본질 · ${E.title}`, '주장과 근거의 관계 세우기는 글의 의미 처리의 한 기제']]
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

  // 3) 기출 원천 근거 — 세 항목 각각(채택 전에 붙인다 — 채택 뒤 근거 추가는 재검토를 부른다)
  for (const it of [P, M, T]) {
    const { count } = await db.from('knowledge_evidence').select('id', { count: 'exact', head: true }).eq('item_id', it.id).eq('csat_passage_sha256', origin.passage_sha256)
    if (count) { log(`근거 있음 ${it.slug}`); continue }
    await go(`/admin/knowledge/item/${it.slug}`)
    const form = page.locator('section', { has: page.locator('#evidence-form') })
    await form.getByRole('radio', { name: '기출 원천' }).check()
    await form.getByLabel('귀속').selectOption('observed')
    await form.getByLabel(/기출 원천 \(A·B·C/).selectOption(origin.passage_sha256)
    await form.getByLabel(/메모/).fill('2022 수능 20번 — 반박 대상(흔한 실수)을 먼저 놓고 주장 문장을 세운 뒤 이유·조건 문장으로 떠받치는 구조. 문항이 그 관계를 세웠는지를 잰다(기출 관찰).')
    await form.getByRole('button', { name: '근거 추가' }).click()
    await expectText('근거를 연결했습니다.')
    log(`근거 ${it.slug}`)
  }

  // 4) 탐구 질문 — 열기 → 후보(기제) · 지지(근거) → 결론 + 남은 불확실성
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
    await box.getByLabel(/메모/).fill('결론 후보 — 관계 세우기를 처리 기제로 채택할지')
    await box.getByRole('button', { name: '잇기' }).click()
    await expectText('이었습니다')
    log('탐구 질문 ← 후보 항목')
  }
  if (!(await has('support', 'evidence_id'))) {
    const ev = await one(db.from('knowledge_evidence').select('id').eq('item_id', P.id).eq('csat_passage_sha256', origin.passage_sha256).limit(1).single()) as { id: string }
    await go(`/admin/knowledge/lab/${INQUIRY.slug}`)
    await box.getByRole('radio', { name: '근거 한 건' }).check()
    await box.getByRole('combobox', { name: /^근거/ }).selectOption(ev.id)
    await box.getByRole('combobox', { name: '역할' }).selectOption('support')
    await box.getByLabel(/메모/).fill('기출 관찰 1건(원천 B) — 연구 근거 아님')
    await box.getByRole('button', { name: '잇기' }).click()
    await expectText('이었습니다')
    log('탐구 질문 ← 지지 근거')
  }

  // ⚠️ 빌더는 **처음 만드는 사슬만** 채택하고 적용을 켠다. 한 번이라도 채택된 적이 있는 항목이 지금 채택 상태가 아니면
  //    (REVIEW_HOLD · 재검토 전파 · 반려) 그 판단은 새 독립 검토의 몫이다 — 옛 검토 사유로 다시 채택 · 켜지 않는다(Codex P1 · 2026-10-08).
  //    재개는 scripts/knowledge/review-hold.mts resume(두 판정자 adopt 뒤)만.
  const everAdopted = async (id: string) => ((await db.from('knowledge_reviews').select('id', { count: 'exact', head: true }).eq('item_id', id).eq('to_status', 'adopted')).count ?? 0) > 0
  const held: string[] = []
  for (const it of [P, M, T]) {
    const now = await itemRow(it.slug) as { status: string }
    if (now.status !== 'adopted' && now.status !== 'applied' && (await everAdopted(it.id))) held.push(`${it.slug}(${now.status})`)
  }
  if (held.length) {
    console.log(`· 보류 · 재검토 중인 사슬 — 빌더는 채택 · 적용 켜기를 하지 않는다: ${held.join(', ')}`)
    process.exitCode = 0
  }
  const firstBuild = held.length === 0
  // 5) 채택 — 기제 → 방법 → 과제(위에서 아래로: 아래 층 채택이 위 층 재검토 전파에 휩쓸리지 않게)
  for (const slug of firstBuild ? [P.slug, M.slug, T.slug] : []) {
    const now = await itemRow(slug) as { status: string }
    if (now.status === 'adopted' || now.status === 'applied') { log(`채택돼 있음 ${slug}`); continue }
    await go(`/admin/knowledge/item/${slug}`)
    await page.locator('#status-reason').fill(REVIEW)
    await page.getByRole('button', { name: '채택(으)로' }).click()
    await expectText('바꿨습니다. 검토 기록에 남았습니다.')
    log(`채택 ${slug}`)
  }
  if (inq.status !== 'concluded') {
    await go(`/admin/knowledge/lab/${INQUIRY.slug}`)
    const box = page.locator('section', { has: page.getByRole('heading', { name: '상태 · 결론' }) })
    await box.getByLabel('상태').selectOption('concluded')
    await box.getByLabel(/결론 항목/).selectOption(P.slug)
    await box.getByLabel(/남은 불확실성/).fill(INQUIRY.uncertainty)
    await box.getByRole('button', { name: '저장' }).click()
    await expectText('저장했습니다')
    log('탐구 질문 결론')
  }

  // 6) 제품 적용 2 + 검증 계획 → 켜기
  const APPS = [
    { surface: 'csat_item_task', ref: 'claim-support:2022-20', audience: JSON.stringify({ item: ITEM, exam: 'suneung', type: 'R-CLAIM' }) },
    { surface: 'learning_map_find', ref: 'b6-3', audience: JSON.stringify({ item: ITEM, line: 'B6', step: 'structure' }) },
  ]
  for (const a of APPS) {
    let app = await one(db.from('knowledge_applications').select('id, status').eq('surface', a.surface).eq('surface_ref', a.ref).eq('item_id', T.id).maybeSingle()) as { id: string; status: string } | null
    if (!app) {
      await go('/admin/knowledge/design')
      const box = page.locator('section', { has: page.getByRole('heading', { name: /새 적용 초안/ }) })
      await box.getByLabel(/항목\(과제 · 방법\)/).selectOption(T.slug)
      await box.getByLabel('적용 표면').selectOption(a.surface)
      await box.getByLabel('과제 키').fill(a.ref)
      await box.getByLabel(/대상 조건/).fill(a.audience)
      await box.getByRole('button', { name: '초안 만들기' }).click()
      await expectText('적용 초안을 만들었습니다')
      app = await one(db.from('knowledge_applications').select('id, status').eq('surface', a.surface).eq('surface_ref', a.ref).eq('item_id', T.id).single()) as { id: string; status: string }
      log(`적용 초안 ${a.surface}:${a.ref}`)
    }
    const { count: trials } = await db.from('knowledge_trials').select('id', { count: 'exact', head: true }).eq('application_id', app.id)
    if (!trials) {
      await go('/admin/knowledge/design')
      const box = page.locator('section', { has: page.getByRole('heading', { name: /효과 검증 계획/ }) })
      await box.getByLabel('적용').selectOption(app.id)
      await box.getByLabel(/지연 평가/).fill('14')
      await box.getByLabel(/최소 표본/).fill('30')
      await box.getByLabel(/비교 조건/).fill('같은 기간 이 과제를 하지 않은 주장형(R-CLAIM) 문항 정답률')
      await box.getByLabel(/측정 지표/).fill('주장형 문항 첫 시도 정답률, 주장 문장 선택 정답률, 뒷받침 문장 선택 정답률, 미연습 주장형 문항(전이) 정답률')
      await box.getByRole('button', { name: '계획 저장' }).click()
      await expectText('검증 계획을 만들었습니다')
      log(`검증 계획 ${a.ref}`)
    }
    // 중단된 적용(사유가 있는 paused)은 빌더가 켜지 않는다 — 처음 만든 draft 만
    if (app.status === 'draft' && firstBuild) {
      await go('/admin/knowledge/product')
      await page.locator(`[data-testid="app-status-${app.id}"]`).getByRole('button', { name: '학습자에게 켜기' }).click()
      await expectText('저장했습니다')
      log(`켜기 ${a.ref}`)
    }
  }
  const tNow = await itemRow(T.slug) as { status: string }
  if (tNow.status === 'adopted' && firstBuild) {
    await go(`/admin/knowledge/item/${T.slug}`)
    await page.locator('#status-reason').fill('문항 과제(2022 수능 20번) · 학습 지도 FIND(B6-3) 적용이 켜졌다')
    await page.getByRole('button', { name: '제품 적용(으)로' }).click()
    await expectText('바꿨습니다. 검토 기록에 남았습니다.')
    log('과제 → 제품 적용')
  }
  await page.screenshot({ path: path.join(OUT, 'build-final.png'), fullPage: true })
  const final = await one(db.from('knowledge_items').select('slug, status, efficacy, version').in('slug', CHAIN.map((c) => c.slug)))
  console.log(JSON.stringify(final))
} finally {
  await browser.close()
}
