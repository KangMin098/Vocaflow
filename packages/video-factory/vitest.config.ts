// packages/video-factory/vitest.config.ts
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

// 원료가 필요한 두 테스트는 work/(로컬 실측) 또는 tests/fixtures/(고정 원료)가 있어야 돈다.
// **둘 다 없으면 빼고 이유를 출력한다** — 조용히 사라지면 안 되므로 경고 한 줄을 남긴다(이슈 #101).
const HERE = path.dirname(fileURLToPath(import.meta.url))
const hasBundle =
  fs.existsSync(path.join(HERE, 'work/source-bundle.json')) ||
  fs.existsSync(path.join(HERE, 'tests/fixtures/source-bundle.json'))
const NEEDS_BUNDLE = ['src/__tests__/factory.test.ts', 'src/__tests__/plan-evaluate.test.ts']
if (!hasBundle) {
  console.warn(
    `[video-factory] 원료 없음 — ${NEEDS_BUNDLE.join(' · ')} 건너뜀. ` +
      'work/source-bundle.json(pnpm --filter web video:source) 또는 tests/fixtures/source-bundle.json 이 필요하다.',
  )
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: hasBundle ? [] : NEEDS_BUNDLE,
  },
})
