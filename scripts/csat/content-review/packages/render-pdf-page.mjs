// scripts/csat/content-review/packages/render-pdf-page.mjs
//
// 공식 문제지 PDF 한 쪽을 이미지로 — 도표 값은 PDF 글자층에 없고 그림이라 눈으로 읽어 대조해야 한다(감수 근거 확인용).
// pdftoppm 없이 pdfjs-dist(설치됨)를 Playwright Chromium 캔버스에 그려 스크린샷한다. 원본 PDF 는 바꾸지 않는다.
// 실행: node scripts/csat/content-review/packages/render-pdf-page.mjs <pdf> <page> <out.png> [scale]

import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(new URL('../../../../apps/web/package.json', import.meta.url))
const { chromium } = require('@playwright/test')
const [pdf, page = '1', out, scale = '2'] = process.argv.slice(2)
if (!pdf || !out) throw new Error('사용: <pdf> <page> <out.png> [scale]')

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..')
const pdfjsDir = join(root, 'node_modules/.pnpm/pdfjs-dist@6.3.289/node_modules/pdfjs-dist/build')
const data = readFileSync(pdf).toString('base64')

// about:blank 은 file:// 모듈을 못 불러온다 — 출력 폴더에 임시 HTML 을 두고 파일 접근을 허용해 연다
const html = out.replace(/\.png$/i, '') + '.render.html'
writeFileSync(html, '<!doctype html><meta charset="utf-8"><canvas id="c"></canvas>')
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] })
const p = await browser.newPage()
await p.goto(pathToFileURL(html).href)
await p.addScriptTag({ type: 'module', content: `
  import * as pdfjs from '${pathToFileURL(join(pdfjsDir, 'pdf.min.mjs')).href}';
  pdfjs.GlobalWorkerOptions.workerSrc = '${pathToFileURL(join(pdfjsDir, 'pdf.worker.min.mjs')).href}';
  window.__render = async (b64, n, s) => {
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    const doc = await pdfjs.getDocument({ data: bytes }).promise;
    const pg = await doc.getPage(n);
    const vp = pg.getViewport({ scale: s });
    const c = document.getElementById('c'); c.width = vp.width; c.height = vp.height;
    await pg.render({ canvasContext: c.getContext('2d'), viewport: vp, canvas: c }).promise;
    return [vp.width, vp.height];
  };
` })
await p.waitForFunction(() => typeof window.__render === 'function')
const size = await p.evaluate(([b, n, s]) => window.__render(b, n, s), [data, Number(page), Number(scale)])
await p.locator('#c').screenshot({ path: out })
await browser.close()
console.log(JSON.stringify({ out, size }))
