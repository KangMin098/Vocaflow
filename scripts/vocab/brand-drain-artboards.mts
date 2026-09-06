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
import { BRAND_FAMILIES } from '@vocaflow/library-pipeline/vocab-brand-canvas'

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

/**
 * 계열 도판 — **선으로만** 그린다.
 *
 * 표지 프로그램이 PD 판화(`covers/design.ts`)라 도판의 결이 선이다. 채운 도형이나 그라디언트를
 * 쓰면 수집한 도판과 나란히 놓였을 때 한 시리즈로 안 읽힌다.
 */
const PLATE: Record<string, string> = {
  list: `
    <path d="M20 148 H196" />
    <path d="M20 148 V20" />
    ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${34 + i * 26}" y="${132 - (12 + i * 19)}" width="14" height="${12 + i * 19}" />`).join('\n    ')}
    <path d="M34 40 L182 40" stroke-dasharray="3 5" />`,
  structure: `
    <path d="M108 152 V88" />
    <path d="M108 108 C 82 96, 66 74, 62 46" />
    <path d="M108 100 C 134 88, 152 66, 158 38" />
    <path d="M108 122 C 88 116, 74 102, 68 84" />
    ${[[62, 46], [158, 38], [68, 84]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="13" ry="8" transform="rotate(-18 ${x} ${y})" />`).join('\n    ')}
    <path d="M84 152 H132" />`,
  corpus: `
    <path d="M28 44 C 62 32, 92 36, 106 46 C 120 36, 150 32, 184 44 L184 138 C 150 128, 120 132, 106 142 C 92 132, 62 128, 28 138 Z" />
    <path d="M106 46 V142" />
    ${[0, 1, 2].map((i) => `<path d="M44 ${66 + i * 20} C 66 ${58 + i * 20}, 86 ${60 + i * 20}, 96 ${66 + i * 20}" />`).join('\n    ')}
    ${[0, 1, 2].map((i) => `<path d="M116 ${66 + i * 20} C 128 ${60 + i * 20}, 148 ${58 + i * 20}, 168 ${66 + i * 20}" />`).join('\n    ')}`,
  delivery: `
    <circle cx="106" cy="90" r="62" />
    <circle cx="106" cy="90" r="52" stroke-dasharray="2 6" />
    <path d="M106 90 V52" />
    <path d="M106 90 L134 104" />
    ${Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2
      const x1 = 106 + Math.sin(a) * 56
      const y1 = 90 - Math.cos(a) * 56
      const x2 = 106 + Math.sin(a) * 62
      const y2 = 90 - Math.cos(a) * 62
      return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}" />`
    }).join('\n    ')}`,
  unique: `
    <circle cx="106" cy="90" r="66" />
    ${[[62, 54], [148, 62], [96, 96], [132, 128], [70, 126], [116, 40]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" />`)
      .join('\n    ')}
    <path d="M62 54 L96 96 L148 62 M96 96 L132 128 M96 96 L70 126 M116 40 L148 62" />`,
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

/** 표지 한 장 — 3:4 (480×640). */
function cover(family: string): string {
  const duo = FAMILY_DUOTONE.light[family as keyof typeof FAMILY_DUOTONE.light]
  const d = DIRECTION[family]!
  return `${head()}
<div style="width: 480px; height: 640px; background: ${P.bg}; display: flex; flex-direction: column; box-sizing: border-box;">
  <!-- 책등 — 서가에서 계열을 가르는 자리 -->
  <div style="display: flex; flex: 1; min-height: 0;">
    <div style="width: 14px; background: ${duo.ink};"></div>
    <div style="flex: 1; display: flex; flex-direction: column; padding: 28px 30px 0 26px; min-width: 0;">

      <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px;">
        <span class="kicker" style="color: ${P.sub};">${VOCAB_SERIES_BRAND}</span>
        <span class="num" style="font-size: 11px; color: ${duo.ink};">VOL. 05</span>
      </div>

      <div style="margin-top: 6px; height: 1px; background: ${P.line};"></div>

      <!-- 도판 — 듀오톤으로 눌린 자리 -->
      <div style="margin-top: 26px; background: ${duo.paper}; display: flex; align-items: center; justify-content: center; padding: 16px 0;">
        <svg width="212" height="172" viewBox="0 0 212 172" fill="none"
             stroke="${duo.ink}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
          ${PLATE[family]}
        </svg>
      </div>

      <div style="margin-top: 26px; display: flex; flex-direction: column; gap: 8px;">
        <span class="kicker" style="color: ${duo.ink};">${d.en} · ${d.ko} 계열</span>
        <h1 class="serif" style="margin: 0; font-size: 34px; line-height: 1.18; font-weight: 600; color: ${P.ink}; text-wrap: pretty;">
          어원으로 익히는<br>1,500
        </h1>
        <p style="margin: 0; font-size: 13px; line-height: 1.6; color: ${P.sub};">${d.grain}</p>
      </div>

    </div>
  </div>

  <!-- 사다리 — 시중 단어장의 뒤표지가 하는 일(다음에 무엇을 볼지)을 앞으로 당겼다 -->
  <div style="display: flex; align-items: center; gap: 10px; padding: 16px 30px 22px 40px; border-top: 1px solid ${P.line};">
    <span class="kicker" style="color: ${P.sub};">사다리</span>
    <div style="display: flex; gap: 6px;">
      ${[1, 2, 3, 4, 5, 6, 7]
        .map(
          (n) =>
            `<span class="num" style="font-size: 11px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border-radius: 3px; ${
              n === 5
                ? `background: ${duo.ink}; color: ${P.bg};`
                : `border: 1px solid ${P.line}; color: ${P.sub};`
            }">${n}</span>`,
        )
        .join('\n      ')}
    </div>
  </div>
</div>
${tail()}`
}

/** lockup 해부 — 표지의 어느 자리에 무엇이 오는가. */
function main(): string {
  const rows: Array<[string, string]> = [
    ['kicker', `표지 맨 위 · ${F.mono} 10px · 자간 .18em · 값은 시리즈 상수에서 읽는다`],
    ['권 번호', '오른쪽 위 · VOL. {n} · 계열 잉크색 · tabular-nums (자리가 맞아야 서가에서 줄이 선다)'],
    ['도판', '듀오톤 판 위 선화 · 계열 ink/paper 두 색만 · 채움·그라디언트 금지'],
    ['계열 줄', '도판 아래 · 영문 대문자 + 한국어 계열명'],
    ['제목', `${F.english} 34px / 1.18 · 최대 2줄 · 넘치면 줄이지 말고 자간을 좁힌다`],
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
    <p class="kicker" style="margin: 0 0 10px; color: ${P.ink};">표지 격자 3:4</p>
    <div style="position: relative; width: 240px; height: 320px; border: 1px solid ${P.line}; background: ${P.plate};">
      <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 7px; background: ${P.spine};"></div>
      <div style="position: absolute; left: 7px; right: 15px; top: 14px; height: 1px; background: ${P.line};"></div>
      <div style="position: absolute; left: 20px; right: 15px; top: 40px; height: 86px; background: ${CATALOG_PALETTE.light.bg};"></div>
      <div style="position: absolute; left: 20px; right: 15px; bottom: 46px; height: 54px; border: 1px dashed ${P.line};"></div>
      <div style="position: absolute; left: 7px; right: 0; bottom: 32px; height: 1px; background: ${P.line};"></div>
      <span class="num" style="position: absolute; right: 8px; bottom: 10px; font-size: 10px; color: ${P.sub};">480 × 640</span>
    </div>
    <p style="margin: 10px 0 0; font-size: 12px; line-height: 1.6; color: ${P.sub};">
      바깥 여백 26 / 30 · 도판 안쪽 여백 8% · 도판 위 글자를 덮는 정도 0.35
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
