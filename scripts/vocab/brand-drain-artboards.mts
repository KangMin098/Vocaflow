// scripts/vocab/brand-drain-artboards.mts
//
// **브랜드 드레인 2/3 (앞단) — Claude Design 아트보드를 토큰에서 만든다.**
//
// ── 왜 손으로 그리지 않는가 ────────────────────────────────────────
// 아트보드는 색을 **값으로** 칠해야 한다(캔버스 안에서는 CSS 변수가 풀리지 않는다). 그런데
// 이 저장소는 값을 손으로 옮겨 적었다가 두 번 어긋났다 — 교재 조판기의 팔레트 다섯 항목,
// 단어장 표지의 듀오톤 열 개 중 여덟. **그래서 여기서 적지 않고 읽어서 칠한다.**
// 토큰이 바뀌면 이 스크립트를 다시 돌리는 것으로 아트보드가 따라온다.
//
// ── 무엇을 내는가 ──────────────────────────────────────────────────
//   Main.dc.html      시리즈 lockup 해부 — 표지의 어느 자리에 무엇이 오는가
//   Grid.dc.html      표지 격자·타이포 스케일 명세
//   <Family>.dc.html  계열 다섯의 표지 (3:4)
//   canvas.json       배치
//
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/vocab/brand-drain-artboards.mts [--out <디렉터리>]
// 재실행 안전: 파일을 덮어쓸 뿐 DB 를 건드리지 않는다.

import fs from 'node:fs'
import path from 'node:path'
import {
  CATALOG_FONTS,
  CATALOG_PALETTE,
  FAMILY_DUOTONE,
  VOCAB_SERIES_BRAND,
} from '@vocaflow/library-pipeline/vocab-brand'
import {
  BRAND_COVER_GRID, BRAND_FAMILIES, BRAND_LOCKUP_SPEC,
} from '@vocaflow/library-pipeline/vocab-brand-canvas'
import { coverArtFor } from '@vocaflow/library-pipeline/vocab-cover-art'

const argOf = (flag: string, fallback: string): string => {
  const i = process.argv.indexOf(flag)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback
}
const OUT = path.resolve(argOf('--out', 'scripts/vocab/brand-drain/canvas'))
fs.mkdirSync(OUT, { recursive: true })

const P = CATALOG_PALETTE.light
const F = CATALOG_FONTS

/** 계열의 결과 도판 성격 — `covers/design.ts` 의 `FAMILY_DIRECTION` 과 같은 말이어야 한다. */
const DIRECTION: Record<string, { ko: string; en: string; grain: string }> = {
  list: { ko: '목록', en: 'LIST', grain: '축적과 질서 — 세어서 줄 세운 것' },
  structure: { ko: '구조', en: 'STRUCTURE', grain: '해부와 분해 — 조각으로 나눠 본 것' },
  corpus: { ko: '원서', en: 'CORPUS', grain: '장면과 서사 — 이야기 속에서 만난 것' },
  delivery: { ko: '전달', en: 'DELIVERY', grain: '리듬과 반복 — 매일 같은 자리로 돌아오는 것' },
  unique: { ko: '고유', en: 'UNIQUE', grain: '열림과 연결 — 이 플랫폼만 그릴 수 있는 지도' },
}

/*
  도판은 **제품이 쓰는 엔진**에서 가져온다(`coverArtFor`). 캔버스가 손으로 그린 사본을
  들고 있으면 규격이 화면과 갈리고, 그 순간 캔버스는 규격이 아니라 그림이 된다.
*/
const plateSvg = (family: string, key: string, stroke: string): string => {
  const art = coverArtFor(family as never, key)
  const paths = art.paths.map((d) => `<path d="${d}" />`).join('\n          ')
  const dots = art.dots.map((c) => `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" />`).join('\n          ')
  return `<svg width="240" height="195" viewBox="${art.viewBox}" fill="none"
             stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
             style="opacity: .62">
          ${paths}
          ${dots}
        </svg>`
}

const head = (): string => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;600&display=swap">
  <style>
    body { margin: 0; font-family: ${F.body}; -webkit-font-smoothing: antialiased; }
    a { color: ${P.accent}; } a:hover { color: ${P.ink}; }
    .kicker { font-family: ${F.mono}; font-size: 10px; letter-spacing: .18em; text-transform: uppercase; }
    .num { font-family: ${F.mono}; font-variant-numeric: tabular-nums; }
    .serif { font-family: ${F.english}; }
  </style>
</helmet>`

const tail = (): string => `</x-dc>
</body>
</html>
`

/**
 * 표지 한 장 — 3:4 (480×640).
 *
 * **제품과 같은 결이어야 한다**: 짙은 바탕(계열 잉크) 위에 밝은 선(계열 지면).
 * 처음엔 반대로 그렸다가 화면에서 창백해지는 것을 보고 되돌렸다(2026-09-07) —
 * 캔버스가 제품과 다른 결을 보이면 규격을 보고 만든 화면이 규격과 달라진다.
 */
function cover(family: string): string {
  const duo = FAMILY_DUOTONE.light[family as keyof typeof FAMILY_DUOTONE.light]
  const d = DIRECTION[family]!
  const key = `sample-${family}`
  return `${head()}
<div style="width: 480px; height: 640px; background: ${duo.ink}; display: flex; flex-direction: column; box-sizing: border-box; position: relative;">
  <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(12,10,8,.30) 0%, rgba(12,10,8,.42) 100%);"></div>
  <div style="position: absolute; inset: 7%; border: 1px solid ${duo.paper}; opacity: .30;"></div>

  <div style="position: relative; display: flex; flex-direction: column; height: 100%; padding: 34px 34px 26px; box-sizing: border-box;">
    <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px;">
      <span class="kicker" style="color: ${duo.paper}; opacity: .85;">${VOCAB_SERIES_BRAND}</span>
      <span class="num" style="font-size: 11px; color: ${duo.paper}; opacity: .85;">${BRAND_LOCKUP_SPEC.volumeFormat.replace('{n}', '4')}</span>
    </div>

    <div style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 18px 0 0;">
      ${plateSvg(family, key, duo.paper)}
    </div>

    <div style="display: flex; flex-direction: column; gap: 7px;">
      <span class="kicker" style="color: ${duo.paper}; opacity: .8;">${d.en} · ${d.ko} 계열</span>
      <h1 class="serif" style="margin: 0; font-size: 32px; line-height: 1.18; font-weight: 600; color: #FFFFFF; text-wrap: pretty;">
        어원으로 익히는 1,500
      </h1>
      <p style="margin: 0; font-size: 12.5px; line-height: 1.6; color: ${duo.paper}; opacity: .78;">${d.grain}</p>
    </div>

    <div style="display: flex; align-items: center; gap: 10px; margin-top: 16px; padding-top: 14px; border-top: 1px solid ${duo.paper}33;">
      <span class="kicker" style="color: ${duo.paper}; opacity: .7;">사다리</span>
      <div style="display: flex; gap: 6px;">
        ${[1, 2, 3, 4, 5, 6, 7]
          .map(
            (n) =>
              `<span class="num" style="font-size: 11px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border-radius: 3px; ${
                n === 5
                  ? `background: ${duo.paper}; color: ${duo.ink};`
                  : `border: 1px solid ${duo.paper}55; color: ${duo.paper}; opacity: .8;`
              }">${n}</span>`,
          )
          .join('\n        ')}
      </div>
    </div>
  </div>
</div>
${tail()}`
}

/** lockup 해부 — 표지의 어느 자리에 무엇이 오는가. */
function main(): string {
  const rows: Array<[string, string]> = [
    ['kicker', `표지 맨 위 · ${F.mono} 10px · 자간 .18em · 값은 시리즈 상수에서 읽는다`],
    ['권 번호', `오른쪽 위 · ${BRAND_LOCKUP_SPEC.volumeFormat} · tabular-nums (자리가 맞아야 서가에서 줄이 선다) · `
      + '{n} 은 계단 번호가 아니라 **권 이름**이다 — 계단은 한 칸 밀려 있어 나란히 두면 한 책이 두 수를 말한다'],
    ['도판', '듀오톤 판 위 선화 · 계열 ink/paper 두 색만 · 채움·그라디언트 금지'],
    ['계열 줄', '도판 아래 · 영문 대문자 + 한국어 계열명'],
    ['제목', `${F.english} 34px / 1.18 · 최대 ${BRAND_LOCKUP_SPEC.titleMaxLines}줄`
      + ' (480px 판형이 아니라 150px 타일에서 잰 값 — 여기서는 넉넉해 보인다)'],
    ['결', '제목 아래 한 줄 · 이 계열이 무엇을 모으는가'],
    ['책등', '왼쪽 14px 띠 · 계열 잉크 · 서가에서 계열을 가르는 유일한 신호'],
    ['사다리', '아래 · 일곱 계단 중 이 권의 자리 · 다음에 무엇을 볼지'],
  ]
  return `${head()}
<div style="width: 560px; height: 640px; background: ${P.bg}; padding: 32px; box-sizing: border-box; display: flex; flex-direction: column; gap: 20px;">
  <div>
    <p class="kicker" style="margin: 0; color: ${P.sub};">${VOCAB_SERIES_BRAND}</p>
    <h1 class="serif" style="margin: 6px 0 0; font-size: 30px; line-height: 1.2; font-weight: 600; color: ${P.ink};">표지 lockup</h1>
    <p style="margin: 8px 0 0; font-size: 13px; line-height: 1.65; color: ${P.sub}; text-wrap: pretty;">
      계열이 달라도 자리는 같다 — 바뀌는 것은 두 색과 도판뿐이다. 자리가 흔들리면 스물아홉 권이 한 시리즈로 안 읽힌다.
    </p>
  </div>

  <div style="display: flex; flex-direction: column; gap: 0; border-top: 1px solid ${P.line};">
    ${rows
      .map(
        ([k, v]) => `<div style="display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 14px; padding: 11px 0; border-bottom: 1px solid ${P.line};">
      <span class="kicker" style="color: ${P.ink}; padding-top: 2px;">${k}</span>
      <span style="font-size: 12.5px; line-height: 1.6; color: ${P.sub};">${v}</span>
    </div>`,
      )
      .join('\n    ')}
  </div>

  <p style="margin: 0; font-size: 11.5px; line-height: 1.6; color: ${P.sub};">
    색은 이 판에 적혀 있지 않다 — 계열 잉크·지면은 디자인 토큰이 정본이고, 규격은 역할 이름(ink · paper · accent)만 싣는다.
  </p>
</div>
${tail()}`
}

/** 격자·타이포 명세. */
function grid(): string {
  const scale: Array<[string, string, string]> = [
    ['제목', '34 / 1.18 · 600', F.english],
    ['계열 줄', '10 / .18em · 대문자', F.mono],
    ['결', '13 / 1.6', F.body],
    ['권 번호', '11 · tabular', F.mono],
    ['사다리', '11 · tabular', F.mono],
  ]
  return `${head()}
<div style="width: 560px; height: 640px; background: ${P.bg}; padding: 32px; box-sizing: border-box; display: flex; flex-direction: column; gap: 22px;">
  <div>
    <p class="kicker" style="margin: 0; color: ${P.sub};">${VOCAB_SERIES_BRAND}</p>
    <h1 class="serif" style="margin: 6px 0 0; font-size: 30px; line-height: 1.2; font-weight: 600; color: ${P.ink};">격자와 활자</h1>
  </div>

  <div>
    <p class="kicker" style="margin: 0 0 10px; color: ${P.ink};">표지 격자 ${BRAND_COVER_GRID.ratio}</p>
    <div style="position: relative; width: 240px; height: 320px; border: 1px solid ${P.line}; background: ${P.plate};">
      <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 7px; background: ${P.spine};"></div>
      <div style="position: absolute; left: 7px; right: 15px; top: 14px; height: 1px; background: ${P.line};"></div>
      <div style="position: absolute; left: 20px; right: 15px; top: 40px; height: 86px; background: ${CATALOG_PALETTE.light.bg};"></div>
      <div style="position: absolute; left: 20px; right: 15px; bottom: 46px; height: 54px; border: 1px dashed ${P.line};"></div>
      <div style="position: absolute; left: 7px; right: 0; bottom: 32px; height: 1px; background: ${P.line};"></div>
      <span class="num" style="position: absolute; right: 8px; bottom: 10px; font-size: 10px; color: ${P.sub};">480 × 640</span>
    </div>
    <p style="margin: 10px 0 0; font-size: 12px; line-height: 1.6; color: ${P.sub};">
      바깥 여백 26 / 30 · 도판 안쪽 여백 ${BRAND_COVER_GRID.plateInset}% · 도판 위 글자를 덮는 정도 ${BRAND_COVER_GRID.scrimStrength}
    </p>
  </div>

  <div>
    <p class="kicker" style="margin: 0 0 8px; color: ${P.ink};">활자</p>
    <div style="display: flex; flex-direction: column; border-top: 1px solid ${P.line};">
      ${scale
        .map(
          ([k, v, f]) => `<div style="display: grid; grid-template-columns: 68px 108px minmax(0, 1fr); gap: 12px; padding: 9px 0; border-bottom: 1px solid ${P.line};">
        <span style="font-size: 12px; color: ${P.ink};">${k}</span>
        <span class="num" style="font-size: 11.5px; color: ${P.sub};">${v}</span>
        <span style="font-size: 11.5px; color: ${P.sub}; font-family: ${f};">${f.split(',')[0]!.replace(/"/g, '')}</span>
      </div>`,
        )
        .join('\n      ')}
    </div>
  </div>
</div>
${tail()}`
}

// ── 쓴다 ────────────────────────────────────────────────────────────
const written: string[] = []
const write = (name: string, body: string): void => {
  fs.writeFileSync(path.join(OUT, name), body, 'utf8')
  written.push(name)
}

write('Main.dc.html', main())
write('Grid.dc.html', grid())
const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
for (const f of BRAND_FAMILIES) write(`${capital(f)}.dc.html`, cover(f))

const canvas = {
  artboards: [
    { file: 'Main.dc.html', x: 0, y: 0, w: 560, h: 640 },
    { file: 'Grid.dc.html', x: 660, y: 0, w: 560, h: 640 },
    ...BRAND_FAMILIES.map((f, i) => ({
      file: `${capital(f)}.dc.html`,
      x: i * 560,
      y: 780,
      w: 480,
      h: 640,
    })),
  ],
  annotations: [
    {
      id: 'token-rule',
      x: 0,
      y: -150,
      w: 560,
      text:
        '색은 규격에 적지 않는다 — 역할 이름(ink · paper · accent)만 싣고 값은 디자인 토큰이 정본이다.\n'
        + '이 판의 색은 토큰에서 읽어 칠한 것이라, 토큰이 바뀌면 아트보드를 다시 내면 따라온다.',
    },
  ],
  launch: { view: 'canvas' },
}
fs.writeFileSync(path.join(OUT, 'canvas.json'), `${JSON.stringify(canvas, null, 2)}\n`, 'utf8')

console.log(`아트보드 ${written.length}장 + canvas.json → ${OUT}`)
for (const w of written) console.log(`  ${w}`)
