// apps/web/tests/e2e-isolated/authored-sets.ts
//
// 격리 e2e 가 쓰는 창작 세트 목록 — 제품 레지스트리(authored-items.ts 의 json import)가 정본이다(scripts/ci/authored-isolated-seed.mjs 와 같은 규칙).
// 폴더에는 세트가 아닌 수업 모델 자산과 대체된 옛 판(r5-cycle-supplement.v1)도 있어 통째로 읽으면 `s.items` 가 없거나 문항 id 가 겹친다(2026-10-24 CI).
import fs from 'node:fs'
import path from 'node:path'

export const SET_DIR = path.resolve(__dirname, '../../src/lib/knowledge/authored')

export function readAuthoredSets<T extends { items: unknown[] }>(dir = SET_DIR): T[] {
  const registry = fs.readFileSync(path.join(dir, 'authored-items.ts'), 'utf8')
  const names = [...new Set([...registry.matchAll(/from '\.\/([^']+\.json)'/g)].map((m) => m[1]))].sort()
  const sets = names
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as T & { set?: unknown })
    .filter((doc) => typeof doc.set === 'string')
  if (sets.length === 0 || sets.some((s) => !Array.isArray(s.items))) throw new Error(`창작 세트 레지스트리를 읽지 못했다: ${dir}`)
  return sets
}
