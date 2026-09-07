// scripts/textbook/print-volume.mjs
//
// **조판된 권을 인쇄용 PDF 로 뽑는다 — 쪽 번호와 running head 를 붙여서.**
//
// ── 왜 브라우저 인쇄로는 안 되는가 (실측 2026-09-01) ──────────────────
// `render-volume.mjs` 가 넣은 `@page{size:188mm 257mm;margin:…}` 와 `break-inside:avoid`
// 는 Chrome 이 그대로 지킨다(V5 20단원 → 148쪽 · MediaBox 188×257.2mm 확인).
// 그런데 **쪽 번호는 CSS 로 못 넣는다** — `@page` 의 margin box(`@bottom-center` 에
// `counter(page)`)는 CSS Paged Media 규격이지만 **Chrome 이 구현하지 않았다.**
// 쪽 번호 없는 인쇄물은 교재가 아니다(차례도 못 만들고, 수업에서 "몇 쪽" 을 못 부른다).
//
// 그래서 CDP `Page.printToPDF` 의 `displayHeaderFooter` 를 쓴다 — CLI 플래그로는 못 준다.
// CDP 클라이언트는 `_cdp.mjs` 한 곳에 있다(`toc-volume.mjs` 와 공유 — 사본을 안 만든다).
//
// 재실행 안전: 읽기만 하고 PDF 를 덮어쓴다. DB 를 건드리지 않는다.
//
// 실행:
//   node scripts/textbook/print-volume.mjs --in scripts/textbook/out/volume-v5.html
//   node scripts/textbook/print-volume.mjs --in <html> --out <pdf> --title "책 제목"

import fs from 'node:fs'
import path from 'node:path'

import { openPrinter, pdfPageCount, pdfPageSizeMm, headerFooterOpts } from './_cdp.mjs'

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}

const IN = arg('in')
if (!IN) {
  console.error('--in <조판된 html> 이 필요하다.')
  console.error('예: node scripts/textbook/print-volume.mjs --in scripts/textbook/out/volume-v5.html')
  process.exit(1)
}
const inPath = path.resolve(IN)
if (!fs.existsSync(inPath)) {
  console.error(`파일이 없다: ${inPath}`)
  process.exit(1)
}
const outPath = path.resolve(arg('out', inPath.replace(/\.html?$/i, '.pdf')))

/** 머리말에 쓸 제목. 안 주면 조판물의 `<h1>` 에서 읽는다 — 정본이 하나여야 한다. */
const html = fs.readFileSync(inPath, 'utf8')
const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
const TITLE = arg('title', h1 ? h1[1].replace(/<[^>]+>/g, '').trim() : path.basename(inPath))


const printer = await openPrinter()
try {
  const buf = await printer.printFile(inPath, headerFooterOpts(TITLE))
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, buf)

  // 쪽 수와 판형을 되읽어 **찍힌 것**을 보고한다 — 요청한 값이 아니라.
  const size = pdfPageSizeMm(buf)
  console.log(path.relative(process.cwd(), outPath))
  console.log(`  ${pdfPageCount(buf)}쪽 · ${Math.round(buf.length / 1024)} KB`)
  if (size) console.log(`  판형 ${size.w.toFixed(1)} × ${size.h.toFixed(1)} mm`)
  console.log(`  머리말 "${TITLE}" · 꼬리말 쪽번호`)
} catch (e) {
  console.error('인쇄 실패:', e.message)
  printer.close()
  process.exit(1)
}
printer.close()
process.exit(0)
