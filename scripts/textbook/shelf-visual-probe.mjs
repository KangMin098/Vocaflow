// scripts/textbook/shelf-visual-probe.mjs
//
// **매대 시각 상품성 지수 — "이미지가 거의 없고 텍스트 위주" 를 숫자로 만든다.**
//
// ── 왜 또 자가 필요한가 ─────────────────────────────────────────────
// `shelf-ux-probe.mjs` 는 **닿는 비용**(스크롤·Tab·밀도)을 잰다. 그 자로 우리는 이미
// 기준선을 넘었다(1.523 / 목표 1.2). 그런데 사용자가 지적한 것은 그 축이 아니다 —
// "이미지도 거의 없고 텍스트 위주. 상업성·마케팅이 없는 화면."
//
// 닿는 비용이 낮은 것과 **상품으로 보이는 것**은 다른 축이다. 매대에서 먼저 일어나는 일은
// 고르는 것이 아니라 **눈에 걸리는 것**이고, 그 일은 이미지가 한다.
//
// ── 무엇을 재는가 ───────────────────────────────────────────────────
// 첫 화면(스크롤 0) 안에서:
//   V1 이미지 면적비   — 표지·삽화가 첫 화면의 몇 %를 차지하는가
//   V2 상품당 이미지   — 카드 하나가 이미지를 몇 개 갖는가
//   V3 표지 크기       — 표지 하나의 평균 면적(px²)
//   V4 색면 요소       — 배지·라벨처럼 **칠해진** 요소 수(테두리만 있는 것은 안 센다)
//
// ⚠️ **`<img>` 만 세지 않는다.** CSS 배경 이미지와 인라인 `<svg>` 도 표지 노릇을 한다.
//   셋을 다 세지 않으면 "우리는 0" 이라는 틀린 결론이 나온다(우리 표지는 지금 CSS
//   그라디언트라 `<img>` 가 하나도 없다 — 그것을 0 으로 적으면 맞지만, 경쟁 사이트가
//   배경으로 표지를 깔았을 때 그쪽도 0 이 되어 비교가 무너진다).
// ⚠️ 그라디언트는 **이미지로 세지 않는다.** `linear-gradient` 는 색면이지 표지가 아니다 —
//   그것을 이미지로 세면 우리 STEP 칩이 표지로 둔갑해 이 자가 거짓말을 한다.
//
// 재실행 안전: 읽기만 한다(HTTP GET).
// 실행: node scripts/textbook/shelf-visual-probe.mjs [--json] [--only ours]

import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const req = createRequire(path.join(HERE, '..', '..', 'apps', 'web', 'package.json'))
const { chromium } = req('@playwright/test')

const argOf = (flag, fallback = null) => {
  const i = process.argv.indexOf(flag)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const BASE = argOf('--base', 'http://localhost:3000')
const ONLY = argOf('--only')
const AS_JSON = process.argv.includes('--json')

const TARGETS = [
  {
    id: 'ours-textbooks',
    name: 'Vocaflow 교재 서가',
    url: `${BASE}/library/textbooks`,
    card: '[data-volume-card]',
    kind: 'ours',
  },
  {
    id: 'ours-decks',
    name: 'Vocaflow 공용 단어장',
    url: `${BASE}/library/vocab`,
    card: 'article',
    kind: 'ours',
  },
  {
    id: 'nebooks',
    name: 'NE능률 고등 독해 목록',
    url: 'https://m.nebooks.co.kr/pages/book/category.asp?c=BD02',
    card: '.books',
    kind: 'market',
  },
  {
    id: 'darakwon',
    name: '다락원 도서 목록',
    url: 'https://www.darakwon.co.kr/books/listProduct.asp?pc_id_1=1&pc_id_2=7',
    card: 'table tr',
    kind: 'market',
  },
]

const VIEWS = [
  { id: 'desktop', width: 1280, height: 900 },
  { id: 'mobile', width: 390, height: 844 },
]

async function measure(page, cardSel) {
  return page.evaluate((sel) => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const foldArea = vw * vh

    /** 첫 화면과 겹치는 부분의 면적만 센다 — 반쯤 걸친 것은 걸친 만큼만. */
    const areaInFold = (el) => {
      const r = el.getBoundingClientRect()
      const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0))
      const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0))
      return w * h
    }
    const visible = (el) => {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false
      const r = el.getBoundingClientRect()
      return r.width > 4 && r.height > 4
    }

    // ── 이미지 노릇을 하는 것 셋: <img> · <svg> · CSS 배경 '이미지'
    //    그라디언트는 뺀다(색면이지 표지가 아니다).
    const imgs = Array.from(document.querySelectorAll('img, svg, picture')).filter(visible)
    const bgEls = Array.from(document.querySelectorAll('div, span, a, li, section, article')).filter((el) => {
      if (!visible(el)) return false
      const bg = getComputedStyle(el).backgroundImage
      return bg && bg !== 'none' && bg.includes('url(')
    })

    const imageArea =
      imgs.reduce((s, el) => s + areaInFold(el), 0) + bgEls.reduce((s, el) => s + areaInFold(el), 0)

    const cards = Array.from(document.querySelectorAll(sel)).filter(visible)
    const cardsInFold = cards.filter((c) => areaInFold(c) > 0)
    const imagesInCards = cardsInFold.reduce((s, c) => {
      const n =
        c.querySelectorAll('img, svg, picture').length +
        Array.from(c.querySelectorAll('div, span, a')).filter((el) => {
          const bg = getComputedStyle(el).backgroundImage
          return bg && bg !== 'none' && bg.includes('url(')
        }).length
      return s + n
    }, 0)

    // 표지 후보 — 카드 안의 이미지 중 가장 큰 것.
    const coverSizes = cardsInFold
      .map((c) => {
        const inner = Array.from(c.querySelectorAll('img, svg, picture')).filter(visible)
        if (!inner.length) return 0
        return Math.max(...inner.map((el) => {
          const r = el.getBoundingClientRect()
          return r.width * r.height
        }))
      })
      .filter((n) => n > 0)

    // ── 색면 요소 — 배경이 **칠해진** 작은 것(배지·라벨·태그).
    //    테두리만 있는 칩은 안 센다. 매대에서 눈에 걸리는 것은 칠해진 쪽이다.
    const painted = Array.from(document.querySelectorAll('span, em, strong, div, i, b')).filter((el) => {
      if (!visible(el)) return false
      const r = el.getBoundingClientRect()
      if (r.width > 220 || r.height > 60) return false // 큰 면은 배지가 아니다
      if (areaInFold(el) <= 0) return false
      const cs = getComputedStyle(el)
      const bg = cs.backgroundColor
      if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return false
      const m = bg.match(/rgba?\(([^)]+)\)/)
      if (!m) return false
      const [r0, g0, b0, a0 = '1'] = m[1].split(',').map((x) => Number(x.trim()))
      if (Number(a0) < 0.12) return false
      // 부모와 같은 색이면 칠한 것이 아니라 물려받은 것이다.
      const pbg = el.parentElement ? getComputedStyle(el.parentElement).backgroundColor : ''
      return bg !== pbg
    }).length

    return {
      viewport: { vw, vh },
      imageAreaPct: foldArea ? +((100 * imageArea) / foldArea).toFixed(2) : 0,
      cardsInFold: cardsInFold.length,
      imagesPerCard: cardsInFold.length ? +(imagesInCards / cardsInFold.length).toFixed(2) : 0,
      medianCoverPx: coverSizes.length
        ? Math.round(coverSizes.sort((a, b) => a - b)[Math.floor(coverSizes.length / 2)])
        : 0,
      paintedChips: painted,
    }
  }, cardSel)
}

const results = []
const browser = await chromium.launch()
try {
  for (const t of TARGETS) {
    if (ONLY && !t.id.startsWith(ONLY)) continue
    const row = { ...t, views: {} }
    for (const v of VIEWS) {
      const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height } })
      const page = await ctx.newPage()
      try {
        await page.goto(t.url, { waitUntil: 'networkidle', timeout: 45000 })
        await page.waitForTimeout(900)
        row.views[v.id] = await measure(page, t.card)
      } catch (e) {
        // 못 연 사이트는 조용히 빠지지 않는다 — 비교가 무너진 것을 알아야 한다.
        row.views[v.id] = { error: String(e.message).slice(0, 90) }
      }
      await ctx.close()
    }
    results.push(row)
  }
} finally {
  await browser.close()
}

if (AS_JSON) {
  console.log(JSON.stringify(results, null, 2))
} else {
  console.log('\n매대 시각 상품성 — 첫 화면 실측\n')
  for (const r of results) {
    console.log(`  ${r.name}`)
    for (const [vid, m] of Object.entries(r.views)) {
      if (m.error) {
        console.log(`    ${vid.padEnd(7)} ✗ ${m.error}`)
        continue
      }
      console.log(
        `    ${vid.padEnd(7)} 이미지면적 ${String(m.imageAreaPct).padStart(5)}%` +
          ` · 상품 ${String(m.cardsInFold).padStart(2)}` +
          ` · 상품당이미지 ${String(m.imagesPerCard).padStart(4)}` +
          ` · 표지중앙 ${String(m.medianCoverPx).padStart(6)}px²` +
          ` · 색면배지 ${String(m.paintedChips).padStart(3)}`,
      )
    }
  }

  const pick = (id, view, key) => results.find((r) => r.id === id)?.views?.[view]?.[key] ?? null
  console.log('\n  축                          우리(교재)   시장 중앙   비고')
  console.log('  ' + '─'.repeat(62))
  for (const [label, key] of [
    ['V1 첫화면 이미지 면적 %', 'imageAreaPct'],
    ['V2 상품당 이미지 수', 'imagesPerCard'],
    ['V3 표지 중앙값 px²', 'medianCoverPx'],
    ['V4 색면 배지 수', 'paintedChips'],
  ]) {
    const ours = pick('ours-textbooks', 'desktop', key)
    const market = [pick('nebooks', 'desktop', key), pick('darakwon', 'desktop', key)].filter(
      (n) => n != null,
    )
    const mid = market.length ? market.sort((a, b) => a - b)[Math.floor(market.length / 2)] : null
    const ratio = mid ? (ours / mid).toFixed(2) : '—'
    const flag = mid == null ? '—' : ours >= mid ? '✅' : ours >= mid * 0.6 ? '△' : '❌'
    console.log(
      `  ${label.padEnd(26)} ${String(ours).padStart(8)} ${String(mid ?? '—').padStart(10)}   ${ratio} ${flag}`,
    )
  }
  console.log('')
}
