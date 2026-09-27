// scripts/csat/render-pdf-page.mjs
//
// PDF 한 쪽을 PNG 로 그린다 — 글자층이 없는(스캔) 또는 기호가 그림인 정답표를 **사람·에이전트가
// 눈으로 읽게** 하려고. 학평 정답표 9회차가 그렇다(`ingest-hakpyeong.mjs` 가 정답 0 으로 보고).
// 읽은 값은 `data/hakpyeong-answers-manual.json` 에 적고, 수집기가 빈 회차만 그것으로 메운다(커밋 대상 — 원문이 아니라 정답 번호다).
//
// 실행: node scripts/csat/render-pdf-page.mjs <pdf> <page> <out.png> [scale=2] [cropTopRatio=1]

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'


const require = createRequire(import.meta.url)
const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json')).split(path.sep).join('/')
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
// canvas 는 pdfjs 의 선택 의존성으로만 깔려 있다 — 새 의존성을 더하지 않고 pdfjs 쪽에서 찾는다
const { createCanvas } = createRequire(require.resolve('pdfjs-dist/package.json'))('@napi-rs/canvas')

const [file, pageArg, out, scaleArg, cropArg] = process.argv.slice(2)
if (!file || !pageArg || !out) {
  console.error('usage: render-pdf-page.mjs <pdf> <page> <out.png> [scale] [cropTopRatio]')
  process.exit(2)
}
const scale = Number(scaleArg ?? 2)
const crop = Number(cropArg ?? 1)
const doc = await getDocument({
  data: new Uint8Array(fs.readFileSync(file)),
  cMapUrl: `${pdfjsRoot}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${pdfjsRoot}/standard_fonts/`,
  wasmUrl: `${pdfjsRoot}/wasm/`,
  isEvalSupported: false,
  verbosity: 0,
}).promise
const page = await doc.getPage(Number(pageArg))
const vp = page.getViewport({ scale })
const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height))
const ctx = canvas.getContext('2d')
ctx.fillStyle = '#fff'
ctx.fillRect(0, 0, canvas.width, canvas.height)
await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise
const h = Math.ceil(canvas.height * crop)
const outCanvas = createCanvas(canvas.width, h)
outCanvas.getContext('2d').drawImage(canvas, 0, 0)
fs.writeFileSync(out, outCanvas.toBuffer('image/png'))
console.log(`${out} ${canvas.width}x${h}`)
