// scripts/design/assets-drain-import.mjs
//
// 이미지 체계 드레인 3단 — 채운 청크(chunk-NN.out.json)를 **스타일 게이트(골든 3 + 규범 #10) 통과분만** 앱에 넣는다.
// 실행: node scripts/design/assets-drain-import.mjs <드레인 폴더>            ← 확인만(dry-run, 파일 안 씀)
//       node scripts/design/assets-drain-import.mjs <드레인 폴더> --commit   ← apps/web/src/components/illustrations/generated/<id>.ts + manifest status
//
// 거부(건너뜀으로 센다): 빈 값·400자 미만 · <title> 없음 · 청크에 없는 id · style-gate FAIL.
// 재실행 안전: 같은 내용이 이미 들어가 있으면 건너뛴다(내용이 바뀌면 version +1 로 덮는다).
// 들어갈 때 바꾸는 것 2가지 — ① SVG 안 id(무대 pattern · title)를 삽화 id 로 이름공간화(한 화면에 여러 점이 있어도 안 겹친다)
//                            ② 루트 <svg> 에 style="display:block;width:100%;height:auto" (폭은 감싸는 쪽이 정한다)

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GEN = join(ROOT, 'apps/web/src/components/illustrations/generated')
const MANIFEST = join(ROOT, 'docs/design/asset-manifest.json')
const dir = process.argv[2] && resolve(process.argv[2])
const commit = process.argv.includes('--commit')
if (!dir || !existsSync(dir)) { console.error('사용: node scripts/design/assets-drain-import.mjs <드레인 폴더> [--commit]'); process.exit(2) }

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
const skipped = []
const cand = []
for (const f of readdirSync(dir).filter((n) => /^chunk-\d+\.json$/.test(n)).sort()) {
  const outF = join(dir, f.replace('.json', '.out.json'))
  if (!existsSync(outF)) { console.log(`${f}: 아직 안 채움 — 건너뜀`); continue }
  const ids = new Set(JSON.parse(readFileSync(join(dir, f), 'utf8')).items.map((i) => i.id))
  for (const { id, svg } of JSON.parse(readFileSync(outF, 'utf8'))) {
    if (!ids.has(id)) { skipped.push(`${id}: 청크에 없는 id`); continue }
    if (!svg || svg.length < 400) { skipped.push(`${id}: 빈 값·너무 짧음`); continue }
    if (!/<title[ >]/.test(svg)) { skipped.push(`${id}: <title> 없음`); continue }
    cand.push({ id, svg })
  }
}

// 스타일 게이트 — 골든 3 + 규범 #10 만 기준
const tmp = join(tmpdir(), `assets-drain-${process.pid}`)
mkdirSync(tmp, { recursive: true })
for (const c of cand) writeFileSync(join(tmp, `${c.id}.svg`), c.svg)
let gate = []
if (cand.length) {
  const json = join(tmp, 'gate.json')
  try { execFileSync(process.execPath, [join(ROOT, 'scripts/design/style-gate.mjs'), tmp, '--ref', join(ROOT, 'docs/design/golden/illustrations'), '--json', json], { stdio: 'inherit' }) } catch { /* FAIL 은 아래에서 항목별로 센다 */ }
  gate = JSON.parse(readFileSync(json, 'utf8'))
}
const failed = new Map(gate.filter((g) => g.fails.length).map((g) => [g.file.replace('.svg', ''), g.fails.join(',')]))

const constName = (id) => id.replace(/^illo-/, 'ILLO_').replace(/-/g, '_').toUpperCase()
let wrote = 0, same = 0
for (const c of cand) {
  if (failed.has(c.id)) { skipped.push(`${c.id}: style-gate ${failed.get(c.id)}`); continue }
  const it = manifest.items.find((i) => i.id === c.id)
  const svg = c.svg
    .replace(/id="(t?g\d+)"/g, `id="${c.id}-$1"`).replace(/url\(#(g\d+)\)/g, `url(#${c.id}-$1)`).replace(/aria-labelledby="(tg\d+)"/g, `aria-labelledby="${c.id}-$1"`)
    .replace('<svg ', '<svg style="display:block;width:100%;height:auto" ')
    .trim()
  const file = join(GEN, `${c.id}.ts`)
  const prev = existsSync(file) ? readFileSync(file, 'utf8') : null
  const version = prev && !prev.includes(JSON.stringify(svg)) ? (it.version ?? 1) + 1 : it.version ?? 1
  const body = `// apps/web/src/components/illustrations/generated/${c.id}.ts
// 생성물 — scripts/design/assets-drain-import.mjs 가 쓴다. 손으로 고치지 말 것.
// 원본: docs/design/trial/20260919/build.mjs · 규칙: docs/design/03-system.md §3-9 · 사전 #${it.dict} 「${it.concept}」 — ${it.verb}

import type { IllustrationAsset } from '../Illustration'

export const ${constName(c.id)}: IllustrationAsset = {
  id: '${c.id}',
  size: '${it.size}',
  svg: ${JSON.stringify(svg)},
}
`
  if (prev === body) { same++; continue }
  if (commit) {
    mkdirSync(GEN, { recursive: true })
    writeFileSync(file, body)
    it.version = version
    if (it.status !== 'done') it.status = 'generated'
  }
  wrote++
}
if (commit) writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
console.log(`\n${commit ? '넣음' : '넣을 것(dry-run)'} ${wrote} · 이미 같음 ${same} · 건너뜀 ${skipped.length}`)
for (const s of skipped) console.log('  건너뜀 ' + s)
if (!commit) console.log('확인 뒤 --commit 으로 다시 실행')
