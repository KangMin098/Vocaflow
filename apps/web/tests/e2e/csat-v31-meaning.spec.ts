// apps/web/tests/e2e/csat-v31-meaning.spec.ts
//
// v3.1 원문 이해 교수 — 실화면에서 직접 조작한다. PC 1280 · 1440 라이트(다크 제외 — 사용자 결정).
//   A. 2026#34 여정: 원문 로딩 완료(기기 문제지 대조 ok) → 구절 대응 조작 → 문제지 표시 글자 = 구절 · 지도 강조 →
//      관계(필수) → 관계 선택 뒤 다중 대응 문장 · 무대응 문장(이전 설명 · 관계 강조 해제) → 깊이 → 초안 600자(자르지 않음) →
//      문항 성립(그 의미의 선택지) · 설계 재구성(그 의미의 근거) → 뒤로/앞으로(장면 · 의미 · 깊이 · 주소 복원 · 초안 유지) →
//      무효 주소의 **실제 주소** 정규화 · pair/back/from 유지 → 원문이 다른 기기 문제지(같은 문장 수 · 같은 길이 · 다른 글자) = 대응 불가 ·
//      강조 금지 → 교수 설명 없는 문항
//   B. 8문항(2026#22·23·25·29·34·36·38·43) 각각: 진입 · 원문 대조 상태 · 구절 조작(대조된 문항은 문제지 표시 일치) · 관계 조작(필수) · 캡처
// 결속 stale · 배포 레코드 변경 · 검수 메타 가드는 서버 단위 회귀(lib/csat/meaning-support/__tests__), 접근 제한 SSR/Flight 는 격리 스펙.
// CI 의 e2e 잡은 이 스펙을 돌리지 않는다(원문 문제지가 개발 기기에만 있다) — 로컬 실행 결과로만 보고한다.
//   PLAYWRIGHT_BASE_URL=http://localhost:3218 pnpm --filter web exec playwright test csat-v31-meaning
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/** FINAL §6 ② — 원문 이해 판의 「먼저 짚어 보기」(구절 역할)가 있으면 건너뛰고 구절 대응을 연다 */
async function skipRoleCheck(page: import('@playwright/test').Page) {
  const skip = page.getByRole('button', { name: '짚지 않고 보기' })
  if (await skip.count()) await skip.first().click()
}

const USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password:
    process.env.PLAYWRIGHT_RUNTIME_PASSWORD ??
    (() => {
      throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다 — apps/web/.env.local')
    })(),
}
const SHOTS = path.resolve('test-results-csat-learner/v31-meaning')
const ARTIFACT = JSON.parse(readFileSync(path.resolve('src/lib/csat/meaning-support-data.json'), 'utf8')) as {
  items: Record<string, { defaultUnitId: string; units: { id: string; sentences: number[] }[]; relations: { id: string; from: string[]; to: string[] }[] }>
}
// 기기 문제지에 대조할 글자가 없는 문항 — 도표(2026#25 · 문항 글자 없음) · 어법(2026#29 · 밑줄 때문에 문제지 원본 그림으로 보임)
const NO_TEXT = new Set(['2026#25', '2026#29'])

test.describe.configure({ mode: 'serial' })
test.setTimeout(420_000)

async function login(page: Page) {
  await page.route('**/api/analytics/event', (route) => route.fulfill({ json: { ok: true } }))
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', USER.email)
  await page.fill('input[type="password"]', USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60_000 })
}
async function noOverflow(page: Page, what: string) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(o, `${what} 가로 넘침`).toBeLessThanOrEqual(0)
}
const q = (page: Page, k: string) => new URL(page.url()).searchParams.get(k)
/** 원문 대조가 끝났다(여는 중이 아니다) */
async function alignSettled(page: Page) {
  await expect(page.getByTestId('ms-panel')).toBeVisible({ timeout: 120_000 })
  await expect(page.getByTestId('ms-panel')).not.toHaveAttribute('data-align', 'pending', { timeout: 120_000 })
}
/** 지도에서 고른 문장(0-기반 막대) — 고른 근거 표시 문장 번호 집합 */
async function litSentences(page: Page): Promise<number[]> {
  return page.locator('[aria-label="지문의 문장"] li').evaluateAll((lis) =>
    lis.flatMap((li, i) => ((li.getAttribute('aria-label') ?? '').includes('고른 근거 문장') ? [i + 1] : [])),
  )
}

for (const width of [1280, 1440]) {
  test(`A. 2026#34 원문 이해 여정 ${width}`, async ({ page }) => {
    mkdirSync(SHOTS, { recursive: true })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewportSize({ width, height: 900 })
    await login(page)

    // 1) 진입 — 원문 로딩 완료 · 대조 ok
    await page.goto('/csat/item/2026-34?scene=meaning&from=map&pair=keep~me', { waitUntil: 'domcontentloaded' })
    await alignSettled(page)
    await expect(page.getByTestId('item-paper')).toBeVisible()
    await expect(page.getByTestId('ms-panel')).toHaveAttribute('data-align', 'ok')
    await expect(page.getByTestId('ms-panel')).toHaveAttribute('data-split', 'ok')
    await expect(page.getByTestId('ms-explain')).toHaveAttribute('data-unit', 'u1')
    expect(await litSentences(page)).toEqual([6])
    // 지도의 근거 칩을 고르면 원문 이해 강조를 내려놓는다(칩과 의미를 동시에 비추지 않는다) → 의미를 다시 고르면 돌아온다
    await page.locator('[data-lecture-target^="analysis:reject:"]').first().click()
    await expect(page.getByTestId('map-chosen-evidence')).toHaveCount(0)
    expect(await litSentences(page)).toEqual([])
    await page.locator('[data-testid="ms-unit"][data-unit="u1"]').click()
    await expect(page.getByTestId('map-chosen-evidence')).toBeVisible()
    expect(await litSentences(page)).toEqual([6])

    // 2) 구절 대응 — 원문 위치(sourceRange)로만 가리키던 구절도 기기 문제지 글자로 보이고, 누르면 문제지에 그 글자가 표시된다
    await skipRoleCheck(page)
    const fromPaper = page.locator('[data-testid="ms-phrase"]:has([data-from="paper"])')
    const phrase = (await fromPaper.count()) ? fromPaper.first() : page.getByTestId('ms-phrase').first()
    const en = (await phrase.getByTestId('ms-phrase-en').first().innerText()).replace(/[“”]/g, '').trim()
    await phrase.click()
    await expect(phrase).toHaveAttribute('aria-pressed', 'true')
    const mark = page.getByTestId('paper-highlight')
    await expect(mark).toBeVisible()
    expect((await mark.innerText()).replace(/\s+/g, ' ').trim()).toBe(en.replace(/\s+/g, ' '))
    await page.screenshot({ path: `${SHOTS}/A-${width}-1-phrase.png` })
    await phrase.click()
    await expect(mark).toHaveCount(0)

    // 3) 관계(필수 — 2026#34 는 관계 3개) → 지도는 관계 양쪽 문장
    await page.getByTestId('ms-relation-pick').first().click()
    await expect(page.getByTestId('ms-relation')).toBeVisible()
    const rel = await page.getByTestId('ms-relation').getAttribute('data-relation')
    expect(q(page, 'rel')).toBe(rel)
    expect((await litSentences(page)).length).toBeGreaterThan(1)
    // 관계를 연 채 구절을 고르면 관계가 풀린다 — 문제지 · 지도가 같은 구절 하나를 가리킨다
    await skipRoleCheck(page)
    await page.getByTestId('ms-phrase').first().click()
    await expect(page.getByTestId('ms-relation')).toHaveCount(0)
    expect(q(page, 'rel')).toBeNull()
    await expect(page.getByTestId('paper-highlight')).toBeVisible()
    expect((await litSentences(page)).length).toBe(1)
    // 의미는 라디오처럼 — 열린 의미를 다시 눌러도 접히지 않고 주소의 meaning 이 남는다
    await page.locator('[data-testid="ms-unit"][data-unit="u1"]').click()
    await expect(page.getByTestId('ms-explain')).toHaveAttribute('data-unit', 'u1')
    expect(q(page, 'meaning')).toBe('u1')
    await page.getByTestId('ms-relation-pick').first().click()
    await expect(page.getByTestId('ms-relation')).toBeVisible()

    // 4) 관계 선택 뒤 다중 대응 문장(7번 — u2 · u3) → 관계 해제 · 이전 설명 접힘 · 그 문장만 강조 · 의미 고르기
    await page.locator('[data-testid="map-sentence-pick"][data-sentence="7"]').click()
    await expect(page.getByTestId('ms-pick')).toHaveAttribute('data-count', '2')
    await expect(page.getByTestId('ms-explain')).toHaveCount(0)
    await expect(page.getByTestId('ms-relation')).toHaveCount(0)
    expect(q(page, 'rel')).toBeNull()
    expect(await litSentences(page)).toEqual([7])
    await page.locator('[data-testid="ms-pick-unit"][data-unit="u3"]').click()
    await expect(page.getByTestId('ms-explain')).toHaveAttribute('data-unit', 'u3')
    expect(q(page, 'meaning')).toBe('u3')
    // 무대응 문장(3번) — 설명을 지어내지 않고 위치만
    await page.getByTestId('ms-relation-pick').first().click()
    await page.locator('[data-testid="map-sentence-pick"][data-sentence="3"]').click()
    await expect(page.getByTestId('ms-pick')).toHaveAttribute('data-count', '0')
    await expect(page.getByTestId('ms-relation')).toHaveCount(0)
    expect(await litSentences(page)).toEqual([3])
    // 한 의미 문장(6번) → 바로 u1
    await page.locator('[data-testid="map-sentence-pick"][data-sentence="6"]').click()
    await expect(page.getByTestId('ms-explain')).toHaveAttribute('data-unit', 'u1')

    // 5) 깊이 · 초안(600자 초과는 경고만, 자르지 않음)
    await page.getByTestId('ms-depth').locator('[data-depth="deep"]').click()
    expect(q(page, 'depth')).toBe('deep')
    // 5-1) 깊이 탐구 — 읽기의 경계 세 칸(원문 · 가능한 해석 · 지원되지 않는 확대 + 다루지 않는 범위)
    await expect(page.getByTestId('ms-boundary')).toBeVisible()
    for (const k of ['observed', 'possible', 'unsupported']) await expect(page.getByTestId(`ms-boundary-${k}`)).toBeVisible()
    await expect(page.getByTestId('ms-boundary-unsupported')).toContainText('이 설명이 다루지 않는 것')
    // 5-2) 글 전체 통합 — 깊이 탐구에서는 단계가 펼쳐진다. 단계 → 그 의미로, 연결 → 그 관계로 거슬러 오른다
    await expect(page.getByTestId('ms-whole-steps')).toBeVisible()
    const steps = page.getByTestId('ms-whole-step')
    expect(await steps.count()).toBeGreaterThan(1)
    await expect(page.getByTestId('ms-whole-result')).toBeVisible()
    await steps.last().click()
    const traced = await page.getByTestId('ms-explain').getAttribute('data-unit')
    expect(traced).toBeTruthy()
    expect(q(page, 'meaning')).toBe(traced)
    const link = page.getByTestId('ms-whole-link').first()
    if (await link.count()) {
      const rel = await link.getAttribute('data-relation')
      await link.click()
      await expect(page.getByTestId('ms-relation')).toHaveAttribute('data-relation', rel!)
      expect(q(page, 'rel')).toBe(rel)
      expect((await litSentences(page)).length).toBeGreaterThan(0)
    }
    // 5-3) 읽어 주기 — 검수된 단계 본문을 차례로 읽으며 지금 읽는 자리(단계 · 연결 · 결론)를 하나만 강조하고 넘어간다(음성 없는 기기는 무음 진행)
    await page.getByTestId('ms-whole-speak').click()
    const speaking = page.locator('[data-testid="ms-panel"] [data-speaking="true"]')
    const speakKey = () => speaking.first().evaluate((el) => el.getAttribute('data-prop') ?? el.getAttribute('data-relation') ?? el.getAttribute('data-testid'))
    await expect(speaking).toHaveCount(1, { timeout: 30_000 })
    const firstKey = await speakKey()
    await expect(async () => expect(await speakKey().catch(() => firstKey)).not.toBe(firstKey)).toPass({ timeout: 60_000 })
    await page.getByTestId('ms-speak-stop').click()
    await expect(speaking).toHaveCount(0)
    await page.screenshot({ path: `${SHOTS}/A-${width}-1b-whole-boundary.png`, fullPage: false })
    await page.locator('[data-testid="ms-unit"][data-unit="u1"]').click()
    await expect(page.getByTestId('ms-explain')).toHaveAttribute('data-unit', 'u1')
    // 「내 말로」(v3.2) — 같은 테스트 계정에 저장된 노트가 있으면 노트가 보이고(저장 흐름은 csat-v32-my-words 스펙),
    // 없으면 저장 전 입력(300자 넘으면 경고만 · 자르지 않음)이 장면 왕복에도 탭 메모리로 남는지 본다
    const hasNote = (await page.getByTestId('ms-note').count()) > 0
    if (!hasNote) {
      await page.getByTestId('ms-draft-open').click()
      const draft = page.getByTestId('ms-draft-text')
      await draft.fill('가'.repeat(305))
      await expect(draft).toHaveValue('가'.repeat(305))
      await expect(draft).toHaveAttribute('aria-invalid', 'true')
      await expect(page.getByTestId('ms-draft-save')).toBeDisabled()
      await draft.fill('이성적인 법은 어차피 안 할 일만 막는다')
    }

    // 6) 문항 성립 — 그 의미가 걸린 선택지를 들고 간다
    const choices = (await page.getByTestId('ms-go-judgment').getAttribute('data-choices'))!.split(',').filter(Boolean).map(Number)
    expect(choices.length).toBeGreaterThan(0)
    await page.getByTestId('ms-go-judgment').click()
    expect(q(page, 'scene')).toBe('judgment')
    expect(q(page, 'bridge')).toBe('1')
    expect(q(page, 'meaning')).toBe('u1')
    await expect(page.getByTestId('ms-bridge')).toBeVisible()
    const judgment = page.getByTestId('v3-judgment')
    for (const n of choices) await expect(judgment.locator(`[data-choice="${n}"]`)).toHaveAttribute('data-bridge', 'true')
    await expect(judgment.locator(`[data-choice="${choices[0]}"]`)).toHaveAttribute('aria-pressed', 'true')
    await page.screenshot({ path: `${SHOTS}/A-${width}-2-judgment-bridge.png` })

    // 7) 뒤로 → 원문 이해(같은 의미 · 깊이 · 초안), 앞으로 → 다시 그 선택지
    await page.goBack()
    await expect(page.getByTestId('ms-explain')).toHaveAttribute('data-unit', 'u1')
    expect(q(page, 'scene')).toBe('meaning')
    expect(q(page, 'depth')).toBe('deep')
    expect(q(page, 'bridge')).toBeNull()
    await expect(page.getByTestId('ms-depth').locator('[data-depth="deep"]')).toHaveAttribute('aria-pressed', 'true')
    if (hasNote) await expect(page.getByTestId('ms-note')).toBeVisible()
    else await expect(page.getByTestId('ms-draft-text')).toHaveValue('이성적인 법은 어차피 안 할 일만 막는다')
    await page.goForward()
    await expect(page.getByTestId('ms-bridge')).toBeVisible()
    await expect(page.getByTestId('v3-judgment').locator(`[data-choice="${choices[0]}"]`)).toHaveAttribute('aria-pressed', 'true')
    await page.getByTestId('ms-bridge-return').click()
    await expect(page.getByTestId('ms-explain')).toHaveAttribute('data-unit', 'u1')

    // 8) 설계 재구성 — 그 의미가 받치는 설계 근거 표시
    const claims = (await page.getByTestId('ms-go-design').getAttribute('data-claims'))!.split(',').filter(Boolean)
    await page.getByTestId('ms-go-design').click()
    expect(q(page, 'scene')).toBe('design')
    await expect(page.getByTestId('ms-bridge')).toBeVisible()
    await expect(page.locator('[data-testid="v3-design-claim"][data-bridge="true"]')).toHaveCount(claims.length)
    await noOverflow(page, `${width} 설계`)
    // 맥락 키 유지
    expect(q(page, 'from')).toBe('map')
    expect(q(page, 'pair')).toBe('keep~me')

    // 9) 무효 주소 — 화면 상태와 **실제 주소** 모두 정규형
    await page.goto('/csat/item/2026-34?scene=meaning&meaning=evil&depth=max&rel=zzz&bridge=yes&from=map&back=2026-38', { waitUntil: 'domcontentloaded' })
    await alignSettled(page)
    await expect(page.getByTestId('ms-explain')).toHaveAttribute('data-unit', 'u1')
    await expect(page.getByTestId('ms-depth').locator('[data-depth="brief"]')).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => page.url()).not.toContain('evil')
    for (const k of ['depth', 'rel', 'bridge']) expect(q(page, k), k).toBeNull()
    expect(q(page, 'meaning')).toBe('u1')
    expect(q(page, 'from')).toBe('map')
    expect(q(page, 'back')).toBe('2026-38')

    // 10) 원문이 다른 기기 문제지 — 같은 문장 수 · 같은 길이 · 다른 글자 → 대응 불가 · 강조 금지 · 구절 표시 안 함
    const swapped = await page.evaluate(() => new Promise<boolean>((res, rej) => {
      const r = indexedDB.open('vocaflow-csat')
      r.onerror = () => rej(r.error)
      r.onsuccess = () => {
        const tx = r.result.transaction('papers', 'readwrite')
        const st = tx.objectStore('papers')
        const keys = st.getAllKeys()
        keys.onsuccess = () => {
          let done = false
          for (const k of keys.result) {
            const g = st.get(k)
            g.onsuccess = () => {
              const p = g.result as { exam_id: string; items: { no: number; passage: string }[] }
              const it = p?.exam_id === '2026' ? p.items.find((i) => i.no === 34) : null
              if (!it) return
              // 첫 단어의 글자 하나만 바꾼다(길이 · 문장 수 그대로)
              const m = /[a-z]/.exec(it.passage)
              if (!m) return
              const c = m[0] === 'e' ? 'a' : 'e'
              it.passage = it.passage.slice(0, m.index) + c + it.passage.slice(m.index + 1)
              st.put(p, k)
              done = true
            }
          }
          tx.oncomplete = () => res(done)
        }
      }
    }))
    expect(swapped).toBe(true)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await alignSettled(page)
    await expect(page.getByTestId('ms-panel')).toHaveAttribute('data-align', 'mismatch')
    await expect(page.getByTestId('ms-align-status')).toContainText('원문과 달라요')
    await expect(page.getByTestId('map-chosen-evidence')).toHaveCount(0)
    await expect(page.getByTestId('map-sentence-pick')).toHaveCount(0)
    await expect(page.locator('[data-from="paper"]')).toHaveCount(0)
    await skipRoleCheck(page)
    await page.getByTestId('ms-phrase').first().click()
    await expect(page.getByTestId('paper-highlight')).toHaveCount(0)
    await page.screenshot({ path: `${SHOTS}/A-${width}-3-mismatch.png` })
    // 기기 문제지를 원래대로(다음 실행 · 다른 스펙이 오염되지 않게)
    await page.evaluate(() => new Promise<void>((res) => {
      const r = indexedDB.open('vocaflow-csat')
      r.onsuccess = () => {
        const tx = r.result.transaction('papers', 'readwrite')
        tx.objectStore('papers').clear()
        tx.oncomplete = () => res()
      }
    }))

    // 11) 교수 설명이 없는 문항 — 기존 v3 의미 화면 그대로(2026 은 27문항 모두 설명이 생겨 2025 회차로 확인)
    await page.goto('/csat/item/2025-31?scene=meaning', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('inquiry-dock')).toBeVisible({ timeout: 90_000 })
    await expect(page.getByTestId('ms-panel')).toHaveCount(0)
    await expect(page.getByTestId('map-sentence-pick')).toHaveCount(0)

    expect(errors).toEqual([])
  })

  test(`B. 파일럿 8문항 실화면 ${width}`, async ({ page }) => {
    mkdirSync(SHOTS, { recursive: true })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    // 파일럿 8문항(원문 대조 기대값이 확정된 대표) — 확대 회차 19문항은 공개 산출물에 함께 있다(v31-wave-2)
    const ids = ['2026#22', '2026#23', '2026#25', '2026#29', '2026#34', '2026#36', '2026#38', '2026#43']
    for (const id of ids) expect(ARTIFACT.items[id], id).toBeTruthy()
    for (const id of ids) {
      const v = ARTIFACT.items[id]
      await page.goto(`/csat/item/${id.replace('#', '-')}?scene=meaning`, { waitUntil: 'domcontentloaded' })
      await alignSettled(page)
      await expect(page.getByTestId('ms-explain'), id).toHaveAttribute('data-unit', v.defaultUnitId)
      await expect(page.getByTestId('ms-panel'), id).toHaveAttribute('data-align', NO_TEXT.has(id) ? 'no_source' : 'ok')
      await expect(page.getByTestId('ms-panel'), id).toHaveAttribute('data-split', 'ok')
      // 구절 대응 — 첫 행을 고른다. 대조된 문항은 문제지에 표시된 글자가 그 구절의 영어와 같아야 한다
      await skipRoleCheck(page)
      const row = page.getByTestId('ms-phrase').first()
      await row.click()
      await expect(row).toHaveAttribute('aria-pressed', 'true')
      if (NO_TEXT.has(id)) {
        await expect(page.getByTestId('paper-highlight'), id).toHaveCount(0)
      } else {
        const en = (await row.getByTestId('ms-phrase-en').first().innerText()).replace(/[“”]/g, '').replace(/\s+/g, ' ').trim()
        await expect(page.getByTestId('paper-highlight'), id).toBeVisible()
        expect((await page.getByTestId('paper-highlight').innerText()).replace(/\s+/g, ' ').trim(), id).toBe(en)
      }
      await page.screenshot({ path: `${SHOTS}/B-${width}-${id.replace('#', '-')}.png` })
      // 관계 — 모든 파일럿 문항에 관계가 있다(건너뛰지 않는다). 첫 관계의 앞쪽 의미를 고르고 그 관계를 연다
      expect(v.relations.length, id).toBeGreaterThan(0)
      const r0 = v.relations[0]
      await page.locator(`[data-testid="ms-unit"][data-unit="${r0.from[0]}"]`).click()
      await expect(page.getByTestId('ms-explain'), id).toHaveAttribute('data-unit', r0.from[0])
      await page.locator(`[data-testid="ms-relation-pick"][data-relation="${r0.id}"]`).click()
      await expect(page.getByTestId('ms-relation'), id).toHaveAttribute('data-relation', r0.id)
      expect(q(page, 'rel'), id).toBe(r0.id)
      await noOverflow(page, `${width} ${id}`)
    }
    // 접근성 — 새 패널(serious · critical 0)
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).include('[data-testid="ms-panel"]').analyze()
    expect(res.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => x.id)).toEqual([])
    expect(errors).toEqual([])
  })
}
