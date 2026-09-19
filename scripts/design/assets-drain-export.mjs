// scripts/design/assets-drain-export.mjs
//
// 이미지 체계 드레인 1단 — manifest 에서 **아직 앱에 들어가지 않은** 삽화를 청크로 내보낸다(brief Gate 6 · AGENTS.md 드레인 3단).
// 실행: node scripts/design/assets-drain-export.mjs [--out scripts/design/assets-drain/<날짜>] [--redo <id,…>]   → chunk-01.json …
//
// 대상: kind=illustration · 규격 S/E/B · status planned|trial|generated 중
//       apps/web/src/components/illustrations/generated/<id>.ts 가 **없는** 것. 이미 들어간 것은 건너뛴다(재실행 안전).
// 청크 항목에는 사전(symbol-dictionary.md) 행의 사물 · 액센트를 함께 싣는다 — 채우는 쪽이 개념→사물→동사를 그대로 그린다.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GEN = join(ROOT, 'apps/web/src/components/illustrations/generated')
const out = resolve(process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : join(ROOT, 'scripts/design/assets-drain', new Date().toISOString().slice(0, 10).replace(/-/g, '')))
const CHUNK = 8
// --redo id1,id2 : 이미 들어간 삽화라도 다시 그려 넣는다(비평 루프 수정용). import 가 내용이 바뀐 것만 version +1 로 덮는다
const redo = new Set(process.argv.includes('--redo') ? process.argv[process.argv.indexOf('--redo') + 1].split(',') : [])

const manifest = JSON.parse(readFileSync(join(ROOT, 'docs/design/asset-manifest.json'), 'utf8'))
const dict = new Map()
for (const line of readFileSync(join(ROOT, 'docs/design/symbol-dictionary.md'), 'utf8').replace(/\r\n/g, '\n').split('\n')) {
  const c = line.split('|').map((s) => s.trim())
  if (/^\d+$/.test(c[1] ?? '')) dict.set(Number(c[1]), { object: c[4], accent: c[6] })
}

const todo = [], skipped = []
for (const it of manifest.items) {
  if (it.kind !== 'illustration' || !['S', 'E', 'B'].includes(it.size) || !['planned', 'trial', 'generated'].includes(it.status)) continue
  if (existsSync(join(GEN, `${it.id}.ts`)) && !redo.has(it.id)) { skipped.push(it.id); continue }
  todo.push({ id: it.id, dict: it.dict, concept: it.concept, verb: it.verb, family: it.family, size: it.size, viewBox: it.viewBox, target: it.target, note: it.note ?? null, ...dict.get(it.dict) })
}
mkdirSync(out, { recursive: true })
let n = 0
for (let i = 0; i < todo.length; i += CHUNK) {
  const f = join(out, `chunk-${String(++n).padStart(2, '0')}.json`)
  writeFileSync(f, JSON.stringify({ rule: 'docs/design/03-system.md §3-9', golden: 'docs/design/golden/illustrations', items: todo.slice(i, i + CHUNK) }, null, 2) + '\n')
  console.log('wrote', f.replace(ROOT, '.').replace(/\\/g, '/'))
}
console.log(`대상 ${todo.length} · 청크 ${n} · 이미 들어가 건너뜀 ${skipped.length}`)
