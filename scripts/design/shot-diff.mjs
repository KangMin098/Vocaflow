// scripts/design/shot-diff.mjs
//
// 두 캡처 폴더에서 같은 이름의 PNG 를 픽셀 비교한다 — 「이 변경이 범위 밖 화면(/csat · /admin)을 건드리지 않았다」의 근거.
// 사용: node scripts/design/shot-diff.mjs <before-dir> <after-dir> [패턴 정규식]
// 출력: 파일마다 다른 픽셀 비율. 같은 크기가 아니면 「크기 다름」으로 적는다.

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const pnpmDir = path.join(ROOT, 'node_modules/.pnpm')
// 둘 다 직접 의존성이 아니라 다른 패키지의 하위 의존성으로만 설치돼 있다 — .pnpm 에서 찾는다.
const find = (name) => {
  const dir = fs.readdirSync(pnpmDir).filter((d) => d.startsWith(`${name}@`)).sort().pop()
  if (!dir) throw new Error(`${name} 이 설치돼 있지 않다`)
  return path.join(pnpmDir, dir, 'node_modules', name)
}
const require_ = createRequire(import.meta.url)
const { PNG } = require_(find('pngjs'))
const pixelmatchMod = require_(find('pixelmatch'))
const pixelmatch = pixelmatchMod.default ?? pixelmatchMod

const [before, after, pattern] = process.argv.slice(2)
if (!before || !after) { console.error('사용: shot-diff.mjs <before> <after> [패턴]'); process.exit(2) }
const re = pattern ? new RegExp(pattern) : null
// 차이 그림은 after 폴더 옆 `_diff/` 에 둔다
const outDiff = path.join(after, '_diff')
fs.mkdirSync(outDiff, { recursive: true })
const files = fs.readdirSync(after).filter((f) => f.endsWith('.png') && (!re || re.test(f)))
let changed = 0
for (const f of files) {
  const b = path.join(before, f)
  if (!fs.existsSync(b)) { console.log(`- ${f} — 기준 없음`); continue }
  const A = PNG.sync.read(fs.readFileSync(b))
  const B = PNG.sync.read(fs.readFileSync(path.join(after, f)))
  if (A.width !== B.width || A.height !== B.height) { console.log(`≠ ${f} — 크기 다름 ${A.width}×${A.height} → ${B.width}×${B.height}`); changed++; continue }
  const D = new PNG({ width: A.width, height: A.height })
  const n = pixelmatch(A.data, B.data, D.data, A.width, A.height, { threshold: 0.1, diffMask: true })
  const pct = (100 * n) / (A.width * A.height)
  if (pct > 0.5) changed++
  // 「몇 %」만으로는 원인을 못 가린다 — 다른 픽셀이 모인 사각형(바운딩 박스)과 차이 그림을 남긴다.
  let box = null
  if (n > 0) {
    let x0 = A.width, y0 = A.height, x1 = -1, y1 = -1
    for (let y = 0; y < A.height; y++) for (let x = 0; x < A.width; x++) {
      if (D.data[(y * A.width + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
    }
    box = `x${x0}–${x1} y${y0}–${y1}`
    if (outDiff) fs.writeFileSync(path.join(outDiff, f.replace('.png', '.diff.png')), PNG.sync.write(D))
  }
  console.log(`${pct > 0.5 ? '≠' : '='} ${f} — ${pct.toFixed(2)}%${box ? ` · 영역 ${box}` : ''}`)
}
console.log(`\n${files.length}개 중 0.5% 넘게 다른 것 ${changed}`)
