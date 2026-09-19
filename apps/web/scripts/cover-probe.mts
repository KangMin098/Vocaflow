// apps/web/scripts/cover-probe.mts
//
// **표지를 실제로 그려서 눈으로 본다.**
//
// ── 왜 이 도구가 있어야 하는가 ───────────────────────────────────────
// 표지는 코드를 읽어서 판정할 수 없다. `coverSvg()` 의 주석에는 시중 대비 실측(NE능률
// 15,336px² · 다락원 31.9%)과 색 대비까지 적혀 있는데, **그린 그림을 아무도 안 봤다.**
// 그래서 2026-09-07 에 처음 굽어 보고서야 다음 셋이 드러났다:
//
//   · 표지에 **제목이 없다** — "READING · 고1 · 5" 만 있고 책 이름이 없다
//   · 표지 숫자가 제목과 **어긋난다** — 표지 "5" 인데 제목은 "Vocaflow Reading 4"
//     (`SERIES_SPINE` 의 step 은 1~7, volumeTitle 은 Starter·1~6 이다. 매대 카드에서
//      둘이 나란히 보이므로 학습자는 같은 책에서 다른 두 수를 읽는다)
//   · 글줄 리듬 네 줄이 **로딩 스켈레톤으로 읽힌다** — 회색 둥근 막대라 콘텐츠가
//     아직 안 온 카드처럼 보인다
//
// 세 가지 다 **그림을 봐야만** 보이는 것이다. 그래서 도구로 남긴다.
//
// ── 쓰기 ────────────────────────────────────────────────────────────
//   pnpm --filter web cover:probe <출력디렉터리>
//
// 읽기만 한다 · 재실행 안전 · 산출물은 저장소 밖(인자로 받은 디렉터리)에 쓴다.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { chromium } from '@playwright/test'

import { coverSpecOf, coverSvg, type CoverSpec } from '@vocaflow/library-pipeline/textbook-cover'
import { SERIES_BRAND, SERIES_SPINE } from '@vocaflow/library-pipeline/textbook-series'
import { SERIES_CATALOG } from '@vocaflow/library-pipeline/textbook-series-catalog'

// 표지의 한 줄 주제는 **매대 카드와 같은 문장**이어야 한다 — 같은 함수에서 뽑는다.
import { taglineOf } from '../src/lib/textbook/shelf-copy'

const OUT = process.argv[2] ?? '.'
mkdirSync(OUT, { recursive: true })

/** 매대가 실제로 쓰는 두 폭 — 목록(112)과 격자 전폭(290). */
const LIST_W = 112
const GRID_W = 290

const SHORT = SERIES_BRAND.split(' ').slice(-1)[0] ?? SERIES_BRAND

function cell(svg: string, caption: string): string {
  return `<figure style="margin:0;display:flex;flex-direction:column;gap:6px;align-items:flex-start">
    ${svg}
    <figcaption style="font:400 11px/1.4 'DM Sans',system-ui;color:#6B655C">${caption}</figcaption>
  </figure>`
}

function h2(text: string): string {
  return `<h2 style="font:700 15px/1.3 'Plus Jakarta Sans',system-ui;color:#2A2622;margin:22px 0 0">${text}</h2>`
}

type Rung = (typeof SERIES_SPINE)[number]

/** 사다리 한 칸 → 표지 사양. 화면과 **같은 경로**로 만든다(다른 길로 만들면 다른 표지를 본다). */
const specOf = (r: Rung, accent?: string): CoverSpec => ({
  ...coverSpecOf(r, SHORT, SERIES_SPINE.length, false, taglineOf(r.rationale)),
  ...(accent ? { accent } : {}),
})

const rows: string[] = []

rows.push(h2(`① 독해 7권 · 목록 폭 ${LIST_W}px — 매대 목록에서 보이는 크기`))
rows.push(
  `<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end">` +
    SERIES_SPINE.map((r) =>
      cell(coverSvg(specOf(r), LIST_W), `${r.step}단 · ${r.volumeTitle}`),
    ).join('') +
    `</div>`,
)

rows.push(h2(`② 같은 표지 · 격자 전폭 ${GRID_W}px — 상업 매대가 쓰는 크기`))
rows.push(
  `<div style="display:grid;grid-template-columns:repeat(4,${GRID_W}px);gap:20px;align-items:start">` +
    SERIES_SPINE.slice(0, 4)
      .map((r) =>
        cell(coverSvg(specOf(r), GRID_W), `${r.step}단 · ${r.volumeTitle}`),
      )
      .join('') +
    `</div>`,
)

rows.push(h2('③ 시리즈 3종 × 같은 5단 — 액센트로 갈리는가'))
rows.push(
  `<div style="display:flex;gap:16px;align-items:flex-end">` +
    SERIES_CATALOG.map((s) =>
      cell(
        coverSvg(
          { ...specOf(SERIES_SPINE[4]!, s.accent), brand: s.brand.split(' ').slice(-1)[0] ?? s.brand },
          160,
        ),
        `${s.brand} · ${s.accent}`,
      ),
    ).join('') +
    `</div>`,
)

rows.push(h2('④ 아직 못 펼친 권(pending)'))
rows.push(
  `<div style="display:flex;gap:16px;align-items:flex-end">` +
    cell(coverSvg({ ...specOf(SERIES_SPINE[5]!), pending: true }, 160), '준비 중') +
    `</div>`,
)

const html = `<!doctype html><meta charset="utf-8">
<body style="margin:0;padding:28px;background:#FBFAF6;display:flex;flex-direction:column;gap:10px">
${rows.join('\n')}
</body>`

const htmlPath = join(OUT, 'cover-probe.html')
writeFileSync(htmlPath, html, 'utf8')

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1400, height: 900 },
  deviceScaleFactor: 2,
})
await page.goto(pathToFileURL(htmlPath).href)
await page.waitForTimeout(500)
const pngPath = join(OUT, 'cover-probe.png')
await page.screenshot({ path: pngPath, fullPage: true })
await browser.close()

console.log(`표지 ${SERIES_SPINE.length}권 + 시리즈 ${SERIES_CATALOG.length}종 → ${pngPath}`)
