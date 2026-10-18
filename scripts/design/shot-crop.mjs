// scripts/design/shot-crop.mjs
//
// 캡처의 일부를 잘라 확대한 PNG 로 낸다 — shot-diff 가 찾은 작은 차이 영역을 눈으로 확인하기 위한 것.
// 사용: node scripts/design/shot-crop.mjs <in.png> <out.png> <x> <y> <w> <h> [배율=4]

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const pnpmDir = path.join(ROOT, 'node_modules/.pnpm')
const dir = fs.readdirSync(pnpmDir).filter((d) => d.startsWith('pngjs@')).sort().pop()
const { PNG } = createRequire(import.meta.url)(path.join(pnpmDir, dir, 'node_modules', 'pngjs'))

const [inp, out, ...nums] = process.argv.slice(2)
const [x, y, w, h, s = 4] = nums.map(Number)
const src = PNG.sync.read(fs.readFileSync(inp))
const dst = new PNG({ width: w * s, height: h * s })
for (let yy = 0; yy < h * s; yy++) for (let xx = 0; xx < w * s; xx++) {
  const si = ((y + Math.floor(yy / s)) * src.width + (x + Math.floor(xx / s))) * 4
  const di = (yy * w * s + xx) * 4
  for (let k = 0; k < 4; k++) dst.data[di + k] = src.data[si + k]
}
fs.writeFileSync(out, PNG.sync.write(dst))
console.log(`${out} (${w * s}×${h * s})`)
