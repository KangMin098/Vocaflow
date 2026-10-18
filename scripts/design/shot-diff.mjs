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
const files = fs.readdirSync(after).filter((f) => f.endsWith('.png') && (!re || re.test(f)))
let changed = 0
for (const f of files) {
  const b = path.join(before, f)
  if (!fs.existsSync(b)) { console.log(`- ${f} — 기준 없음`); continue }
  const A = PNG.sync.read(fs.readFileSync(b))
  const B = PNG.sync.read(fs.readFileSync(path.join(after, f)))
  if (A.width !== B.width || A.height !== B.height) { console.log(`≠ ${f} — 크기 다름 ${A.width}×${A.height} → ${B.width}×${B.height}`); changed++; continue }
  const n = pixelmatch(A.data, B.data, null, A.width, A.height, { threshold: 0.1 })
  const pct = (100 * n) / (A.width * A.height)
  if (pct > 0.5) changed++
  console.log(`${pct > 0.5 ? '≠' : '='} ${f} — ${pct.toFixed(2)}%`)
}
console.log(`\n${files.length}개 중 0.5% 넘게 다른 것 ${changed}`)
