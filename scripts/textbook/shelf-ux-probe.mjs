// scripts/textbook/shelf-ux-probe.mjs
//
// **매대 사용성 지수 — 실제 브라우저에서 잰다.**
//
// ── 왜 이 자가 또 필요한가 ──────────────────────────────────────────
// `catalog-benchmark.mjs` 는 **기능 개수**를 센다. 그 자로 우리 매대는 이미 1.283 이다.
// 그런데 그 자는 스스로 한계를 적어 두었다 — "검색창 하나와 좋은 검색은 여기서 같은 1점이다".
// 사용자가 "수준이 낮다" 고 말한 것은 **개수가 아니라 그 1점의 질**이다.
//
// 이 자는 개수를 세지 않는다. **학습자가 상품에 닿기까지 치르는 비용**을 잰다 —
// 스크롤 · Tab · 첫 화면에 보이는 상품 수 · 조작요소 밀도 · 타이포 난립 · 작은 터치타겟.
// 전부 실제 브라우저(Playwright)에서 레이아웃이 끝난 뒤 읽는 값이라
// "코드에 있다" 로는 점수가 나지 않는다.
//
// ── 기준선 ──────────────────────────────────────────────────────────
// 관측한 상업 카탈로그를 **같은 자로** 잰다(하드코딩한 목표치가 아니다).
// 축마다 좋은 방향이 다르므로 lowerIsBetter 를 명시한다.
//
// 재실행 안전: 읽기만 한다(HTTP GET). 실행:
//   node scripts/textbook/shelf-ux-probe.mjs [--json] [--out <경로>] [--only ours]

import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ⚠️ `playwright` 는 이 워크스페이스 루트에 링크돼 있지 않다 — `@playwright/test` 가
//    `apps/web` 의 devDependency 라서 거기서만 풀린다(실측 2026-09-01: 루트 import 는
//    ERR_MODULE_NOT_FOUND). 스크립트 위치 기준으로 그 package.json 에서 해석한다 —
//    cwd 에 기대면 어디서 실행하느냐에 따라 조용히 실패한다.
const HERE = path.dirname(fileURLToPath(import.meta.url))
const req = createRequire(path.join(HERE, '..', '..', 'apps', 'web', 'package.json'))
const { chromium } = req('@playwright/test')

const argOf = (flag, fallback = null) => {
  const i = process.argv.indexOf(flag)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const BASE = argOf('--base', 'http://localhost:3000')
const ONLY = argOf('--only')

/**
 * 잴 대상들. `card` 는 **관측해서 고른 선택자**다 — 사이트마다 다르므로 근거를 함께 적는다.
 * 경쟁 사이트를 못 열면(차단·개편) 그 사이트는 조용히 빠지지 않고 error 로 남는다.
 */
const TARGETS = [
  {
    id: 'ours',
    name: 'Vocaflow 교재 서가',
    url: `${BASE}/library/textbooks`,
    card: '[data-volume-card]',
    // 폴백 — 재설계 전 화면에는 data 속성이 없다. 그때는 목록 안의 article 이 곧 권이다.
    cardFallback: '#textbook-list article',
    kind: 'ours',
  },
  {
    id: 'nebooks',
    name: 'NE능률 고등 독해 목록',
    url: 'https://m.nebooks.co.kr/pages/book/category.asp?c=BD02',
    card: '.books',
    cardEvidence: 'HTML 실측 2026-09-01 — .books 가 낱권 카드(10/페이지)',
    kind: 'market',
  },
  // ── 기준선을 한 곳에서 셋으로 (2026-09-01) ──────────────────────────
  // 이 자는 스스로 "표본 1이라 '업계 평균' 이 아니라 '관측된 상업 기준선'" 이라고 적어 두었다.
  // 한 곳만 이기면 그 한 곳이 약한 축에서 우리가 강한 것처럼 보인다.
  // 그래서 축마다 **가장 강한 경쟁사 값**을 기준선으로 쓴다(아래 bestOf) — 목표가 올라간다.
  //
  // ⚠️ URL 은 홈이 아니라 **낱권 목록**이어야 한다. 홈에서 재면 캐러셀이 카드로 잡혀
  //    "첫 화면에 상품 20개" 같은 거짓 우위가 나온다(실측: 홈에서 swiper-slide 38개).
  // ⚠️ **YBM북샘은 일부러 뺐다** (2026-09-01). 낱권 목록이 지연 로딩이라 카드 수가
  //    대기 시간에 따라 계속 변한다 — 실측 2초 16개 · 6초 30개, 6초에도 아직 증가 중.
  //    U3(첫 화면 상품 수)·U4(상품당 조작요소)는 **카드 수로 나누는 축**이라, 이런 값을
  //    기준선에 넣으면 우리 지수가 남의 로딩 속도에 따라 흔들린다.
  //    대기 시간에 따라 변하는 값은 기준선이 아니다. 안정된 선택자를 찾으면 그때 넣을 것.
  {
    id: 'visang',
    name: '비상교재 고등',
    url: 'https://book.visang.com/books/HS',
    card: '.product-list-item',
    cardEvidence: 'HTML 실측 2026-09-01 — .product-list-item 이 낱권 카드(9/페이지)',
    kind: 'market',
  },
]

const VIEW_DESKTOP = { width: 1280, height: 900 }
const VIEW_MOBILE = { width: 390, height: 844 }

/** 페이지 안에서 계산되는 측정 — 레이아웃이 끝난 뒤의 실제 값만 읽는다. */
async function measure(page, cardSel) {
  return page.evaluate((sel) => {
    const cards = Array.from(document.querySelectorAll(sel))
    const vh = window.innerHeight
    const vw = window.innerWidth
    const docTop = (el) => el.getBoundingClientRect().top + window.scrollY

    const first = cards[0] ?? null
    const firstY = first ? docTop(first) : null

    // 첫 화면(스크롤 0)에서 **온전히** 보이는 상품 수. 반만 보이는 것은 세지 않는다 —
    // 반쪽 카드는 "있다" 는 신호일 뿐 고를 수 있는 상품이 아니다.
    const visibleInFold = cards.filter((c) => {
      const r = c.getBoundingClientRect()
      const top = r.top + window.scrollY
      return top >= 0 && top + r.height <= vh
    }).length

    // 포커스 가능한 요소 — Tab 순서 그대로. 첫 상품 카드 안의 첫 포커스 요소까지 몇 번인가.
    const FOCUSABLE =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
    const focusables = Array.from(document.querySelectorAll(FOCUSABLE)).filter((el) => {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') return false
      const r = el.getBoundingClientRect()
      // sr-only 건너뛰기 링크는 Tab 순서에 실재하므로 센다(1x1 이라도).
      return r.width > 0 || r.height > 0
    })

    let tabsToFirstCard = null
    if (first) {
      for (let i = 0; i < focusables.length; i += 1) {
        if (first.contains(focusables[i])) {
          tabsToFirstCard = i + 1
          break
        }
      }
    }

    // ── 건너뛰기 링크를 쓰면 몇 번인가 ────────────────────────────────
    // WCAG 2.4.1(Bypass Blocks)이 있는 이유가 바로 이 자리다 — 전역 내비를 매 페이지마다
    // 다시 지나가지 않게 하는 **표준 우회로**다. 그것을 무시하고 원 Tab 수만 세면
    // "우회로를 갖춘 화면" 과 "없는 화면" 이 같은 점수를 받는다.
    //
    // ⚠️ **양쪽에 같은 규칙으로 적용한다.** 우리에게만 유리하게 세면 그건 자가 아니라 자화자찬이다.
    //    (실측 2026-09-01: 우리 32 → 11 · NE능률은 건너뛰기 링크가 **없어** 25 → 25.
    //     NE 쪽 앵커 전체가 1개뿐이고 건너뛰기 후보는 0개였다.)
    // ⚠️ 원 Tab 수(`tabsToFirstCard`)도 그대로 남긴다 — 우회로를 **모르는** 사용자의 비용은
    //    여전히 그 값이고, 둘을 함께 봐야 판단할 수 있다.
    let skipHref = null
    for (const el of focusables) {
      const href = el.getAttribute?.('href') ?? ''
      if (!href.startsWith('#') || href.length < 2) continue
      if (!/건너뛰|바로가기|skip|본문/i.test(`${el.textContent ?? ''} ${el.className ?? ''}`)) continue
      if (!document.getElementById(href.slice(1))) continue
      skipHref = href
      break
    }

    let tabsAfterSkip = tabsToFirstCard
    if (skipHref && first) {
      const target = document.getElementById(skipHref.slice(1))
      // 건너뛰기 표적 **뒤에 오는** 포커스 요소부터 다시 센다(+1 은 건너뛰기 링크 자신).
      const after = focusables.filter(
        (el) =>
          target &&
          !target.contains(el) &&
          (target.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      )
      const inside = focusables.filter((el) => target && target.contains(el))
      const seq = [...inside, ...after]
      const idx = seq.findIndex((el) => first.contains(el))
      if (idx >= 0) tabsAfterSkip = idx + 2
    }

    // 조작요소 밀도 — 상품 하나를 고르기 위해 화면이 내미는 조작 요소 수.
    // 상품 카드 **밖**의 것만 센다(카드 안 버튼은 상품의 일부다).
    const controlsOutsideCards = focusables.filter(
      (el) => !cards.some((c) => c.contains(el)),
    ).length

    // 타이포 난립 — 본문 영역에서 실제로 쓰인 서로 다른 font-size 값 개수.
    const main = document.querySelector('main') ?? document.body
    const sizes = new Set()
    const weights = new Set()
    for (const el of main.querySelectorAll('*')) {
      // 텍스트를 **직접** 가진 요소만 — 감싸는 div 까지 세면 상속값이 중복된다.
      const own = Array.from(el.childNodes).some(
        (n) => n.nodeType === 3 && n.textContent && n.textContent.trim(),
      )
      if (!own) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const cs = getComputedStyle(el)
      sizes.add(cs.fontSize)
      weights.add(cs.fontWeight)
    }

    // 44px 미만 터치타겟 — 보이는 것만.
    const tinyTargets = focusables.filter((el) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return false
      return r.height < 44
    }).length

    return {
      cards: cards.length,
      firstCardY: firstY == null ? null : Math.round(firstY),
      firstCardScreens: firstY == null ? null : Number((firstY / vh).toFixed(2)),
      visibleInFold,
      tabsToFirstCard,
      tabsAfterSkip,
      hasSkipLink: !!skipHref,
      controlsOutsideCards,
      fontSizes: sizes.size,
      fontWeights: weights.size,
      tinyTargets,
      docHeight: Math.round(document.documentElement.scrollHeight),
      hOverflow: Math.round(document.documentElement.scrollWidth - vw),
    }
  }, cardSel)
}

const browser = await chromium.launch()
const results = []

for (const t of TARGETS) {
  if (ONLY && t.id !== ONLY) continue
  const entry = { id: t.id, name: t.name, url: t.url, kind: t.kind }
  let ctx = null
  try {
    ctx = await browser.newContext({ viewport: VIEW_DESKTOP })
    const page = await ctx.newPage()
    await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForTimeout(2000)

    let sel = t.card
    if ((await page.locator(sel).count()) === 0 && t.cardFallback) sel = t.cardFallback
    entry.cardSelector = sel
    if ((await page.locator(sel).count()) === 0) throw new Error(`상품 카드를 못 찾았다: ${sel}`)

    // ⚠️ **못 잰 회차를 잰 회차와 나란히 적지 않는다.**
    //    재고 조회(RLS·집계 RPC)가 순간적으로 실패하면 화면이 '재고 확인 중' 배너를 띄우고
    //    권마다 '문항 0' 을 인쇄한다. 그러면 카드가 높아지고 배너가 74px 을 더해
    //    **화면이 나빠진 것처럼 보인다** — 실제로 나빠진 것은 그 순간의 DB 읽기다.
    //    실측 2026-09-01: 같은 코드로 연속 측정 중 한 회차만 이 상태였다.
    if (t.kind === 'ours') {
      entry.inventoryDegraded = (await page.locator('text=재고를 확인하지 못했어요').count()) > 0
    }

    entry.desktop = await measure(page, sel)

    await page.setViewportSize(VIEW_MOBILE)
    await page.waitForTimeout(800)
    entry.mobile = await measure(page, sel)
  } catch (e) {
    // 못 잰 것을 0 으로 적지 않는다 — 이 저장소가 못 박은 규칙이 계측기에도 걸린다.
    entry.error = String((e && e.message) || e)
  } finally {
    if (ctx) await ctx.close()
  }
  results.push(entry)
}

await browser.close()

const ours = results.find((r) => r.id === 'ours')
const market = results.filter((r) => r.kind === 'market' && !r.error)

/**
 * 축 정의 — **낮을수록 좋은 축**과 높을수록 좋은 축을 섞지 않는다.
 * 지수는 기준선 대비이며, 낮을수록 좋은 축은 뒤집어 계산한다(기준선/우리).
 */
const AXES = [
  { id: 'U1', name: '첫 상품까지 스크롤(화면)', pick: (m) => m.firstCardScreens, lower: true },
  { id: 'U2', name: '첫 상품까지 Tab 수 (건너뛰기 반영)', pick: (m) => m.tabsAfterSkip ?? m.tabsToFirstCard, lower: true },
  { id: 'U3', name: '첫 화면에 온전히 보이는 상품', pick: (m) => m.visibleInFold, lower: false },
  {
    id: 'U4',
    name: '상품 밖 조작요소 / 상품',
    pick: (m) => (m.cards ? Number((m.controlsOutsideCards / m.cards).toFixed(2)) : null),
    lower: true,
  },
  { id: 'U5', name: '본문 font-size 종류', pick: (m) => m.fontSizes, lower: true },
  { id: 'U6', name: '44px 미만 터치타겟', pick: (m) => m.tinyTargets, lower: true },
]

function indexOf(axis, oursVal, marketVal) {
  if (oursVal == null || marketVal == null) return null
  if (axis.lower) {
    // 0 은 나눗셈이 안 된다. 기준선도 0 이면 동률(1), 아니면 상한 3 으로 묶는다 —
    // 무한대를 지수에 넣으면 기하평균이 그 축 하나로 결정된다.
    if (oursVal === 0) return marketVal === 0 ? 1 : 3
    return Number(Math.min(marketVal / oursVal, 3).toFixed(3))
  }
  if (marketVal === 0) return null
  return Number(Math.min(oursVal / marketVal, 3).toFixed(3))
}

const report = { generatedAt: new Date().toISOString(), base: BASE, targets: results, axes: [] }

if (ours?.inventoryDegraded) {
  report.warning =
    '이 회차는 재고 조회가 막힌 상태에서 쟀다 — 카드 높이와 배너가 달라지므로 다른 회차와 비교하지 말 것.'
}

/**
 * 축마다 **가장 강한 경쟁사 값**을 고른다 — 기준선 상향(2026-09-01).
 *
 * ── 왜 최강값인가 ──────────────────────────────────────────────────
 * 한 곳(NE능률)만 기준선으로 쓰면, 그 한 곳이 약한 축에서 우리가 강한 것처럼 보인다.
 * 예컨대 어떤 사이트는 터치타겟이 79개나 44px 미만인데, 그걸 이겼다고 "업계 대비 우위" 라
 * 적으면 과장이다. **각 축에서 제일 잘하는 곳**을 상대로 이겨야 업계를 이겼다고 말할 수 있다.
 *
 * ⚠️ 사이트마다 강한 축이 다르므로 기준선은 **한 사이트가 아니라 합성**이다. 그래서
 *    축마다 어느 사이트에서 왔는지(`marketSite`)를 반드시 함께 적는다 — 합성 기준선은
 *    출처를 안 밝히면 검증할 수 없는 숫자가 된다.
 * ⚠️ 못 연 사이트는 조용히 빠지지 않는다(`error` 로 남고 기준선에서 제외된다).
 *    남은 곳이 하나뿐이면 그건 예전과 같은 표본 1이므로 그 사실을 보고에 적는다.
 */
function bestMarket(axis, view) {
  let best = null
  for (const m of market) {
    const v = axis.pick(m[view])
    if (v == null) continue
    if (best == null) best = { value: v, site: m.name }
    else if (axis.lower ? v < best.value : v > best.value) best = { value: v, site: m.name }
  }
  return best
}

if (ours && !ours.error && market.length > 0) {
  for (const view of ['desktop', 'mobile']) {
    for (const a of AXES) {
      const o = a.pick(ours[view])
      const b = bestMarket(a, view)
      report.axes.push({
        view,
        id: a.id,
        name: a.name,
        lowerIsBetter: a.lower,
        ours: o,
        market: b?.value ?? null,
        marketSite: b?.site ?? null,
        marketSampleSize: market.length,
        index: indexOf(a, o, b?.value ?? null),
      })
    }
  }
  const geo = (xs) =>
    xs.length === 0
      ? null
      : Number(Math.exp(xs.reduce((s, x) => s + Math.log(Math.max(x, 0.001)), 0) / xs.length).toFixed(3))
  const pick = (v) => report.axes.filter((x) => x.view === v && x.index != null).map((x) => x.index)
  report.desktopIndex = geo(pick('desktop'))
  report.mobileIndex = geo(pick('mobile'))
  report.uxIndex =
    report.desktopIndex != null && report.mobileIndex != null
      ? Number(Math.sqrt(report.desktopIndex * report.mobileIndex).toFixed(3))
      : null
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log('매대 사용성 지수 — 실제 브라우저 측정\n')
  if (report.warning) console.log(`  ⚠ ${report.warning}\n`)
  for (const r of results) {
    if (r.error) {
      console.log(`  ❌ ${r.name} — ${r.error}`)
      continue
    }
    console.log(`  ${r.name}  (${r.cardSelector})`)
    for (const v of ['desktop', 'mobile']) {
      const m = r[v]
      console.log(
        `    ${v.padEnd(7)} 상품 ${String(m.cards).padStart(3)} · 첫상품 ${String(m.firstCardScreens).padStart(5)}화면(${m.firstCardY}px) · 첫화면노출 ${m.visibleInFold} · Tab ${m.tabsToFirstCard}${m.hasSkipLink && m.tabsAfterSkip !== m.tabsToFirstCard ? `→${m.tabsAfterSkip}(건너뛰기)` : ""} · 조작 ${m.controlsOutsideCards} · font-size ${m.fontSizes}종 · 작은타겟 ${m.tinyTargets} · 가로넘침 ${m.hOverflow}`,
      )
    }
    console.log('')
  }
  if (report.axes.length) {
    for (const view of ['desktop', 'mobile']) {
      console.log(`  [${view}] 축                         우리   최강경쟁    지수  (기준선을 세운 곳)`)
      console.log(`  ${'─'.repeat(74)}`)
      for (const a of report.axes.filter((x) => x.view === view)) {
        const mark = a.index == null ? ' ' : a.index >= 1.2 ? '✅' : a.index >= 1.0 ? '△' : '❌'
        // 합성 기준선은 **출처를 안 밝히면 검증할 수 없다** — 축마다 어디서 왔는지 함께 찍는다.
        const from = a.marketSite ? a.marketSite.replace(/ 고등.*| 목록$/, '') : '—'
        console.log(
          `  ${a.id} ${a.name.padEnd(24)} ${String(a.ours).padStart(6)} ${String(a.market).padStart(8)} ${String(a.index).padStart(7)} ${mark}  ${from}`,
        )
      }
      console.log('')
    }
    console.log(`  desktop ${report.desktopIndex} · mobile ${report.mobileIndex}`)
    console.log(`  ▶ 사용성 지수(기하평균) ${report.uxIndex}   목표 1.2`)
  }
}

const outPath = argOf('--out')
if (outPath) fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
