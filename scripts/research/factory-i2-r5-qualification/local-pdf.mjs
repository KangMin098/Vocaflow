// scripts/research/factory-i2-r5-qualification/local-pdf.mjs
// Local inspection only: render an explicitly supplied PDF page outside git; optionally print answer-key text.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
const root = path.resolve(import.meta.dirname, '../../..'), pnpm = path.join(root, 'node_modules/.pnpm')
const pkg = name => path.join(pnpm, fs.readdirSync(pnpm).find(d => d.startsWith(name.replace('/', '+') + '@')), 'node_modules', name)
const req = createRequire(path.join(pkg('@napi-rs/canvas'), 'package.json'))
const { createCanvas } = req('@napi-rs/canvas')
const pdfjs = await import(pathToFileURL(path.join(pkg('pdfjs-dist'), 'legacy/build/pdf.mjs')).href)
const [file, pageNo, output] = process.argv.slice(2)
if (!file || !pageNo || !output) throw new Error('local-pdf.mjs <pdf> <page> <output.png> [--text]')
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), useSystemFonts: true, verbosity: 0 }).promise
const page = await doc.getPage(Number(pageNo)), viewport = page.getViewport({ scale: 1.5 })
const canvas = createCanvas(viewport.width, viewport.height)
await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, canvas.toBuffer('image/png'))
if (process.argv.includes('--text')) console.log((await page.getTextContent()).items.map(x => x.str).join(' '))
console.log(`rendered ${Number(pageNo)}/${doc.numPages}: ${path.basename(output)}`)
