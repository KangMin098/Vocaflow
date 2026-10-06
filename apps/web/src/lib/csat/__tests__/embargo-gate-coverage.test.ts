// apps/web/src/lib/csat/__tests__/embargo-gate-coverage.test.ts
//
// Reveal Gate 앱 가드 — 경고가 아니라 실패한다. 규칙은 src/test/embargo-coverage.ts.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { checkGateCoverage, type GateManifest } from '@/test/embargo-coverage'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '../../..')
const MANIFEST = path.resolve(SRC, '../../../scripts/csat/reveal-gate/manifest.json')
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as GateManifest

describe('Reveal Gate 앱 가드', () => {
  it('정답 민감 · 정오 로더는 전부 embargo-gate 를 거치고, 미분류 민감 로더가 없다', () => {
    expect(checkGateCoverage(SRC, manifest)).toEqual([])
  })

  it('관문을 거치지 않은 로더 · 미분류 새 로더 · 부르지 않는 import 를 잡는다(픽스처)', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'embargo-guard-'))
    try {
      fs.mkdirSync(path.join(root, 'lib/csat'), { recursive: true })
      // 분류됐지만 관문 없음
      fs.writeFileSync(path.join(root, 'lib/csat/unrouted.ts'), "export const q = (db: any) => db.from('csat_item_analyses').select('answer_locus')\n")
      // import 만 하고 부르지 않음
      fs.writeFileSync(path.join(root, 'lib/csat/idle.ts'), "import { canRevealItem } from './embargo-gate'\nexport const q = (db: any) => db.from('csat_dx_response').select('is_correct')\nvoid canRevealItem\n")
      // 분류 안 된 새 민감 로더(기본 거부)
      fs.writeFileSync(path.join(root, 'lib/csat/new-loader.ts'), "export const q = (db: any) => db.from('csat_dx_session').select('raw_score')\n")
      // 정상
      fs.writeFileSync(path.join(root, 'lib/csat/ok.ts'), "import { canRevealExam } from './embargo-gate'\nexport const q = async (db: any) => (await canRevealExam('X')) ? db.from('csat_dx_session').select('raw_score') : null\n")
      const m: GateManifest = {
        ...manifest,
        app_db_loaders: {
          'lib/csat/unrouted.ts': { class: 'ANSWER_SENSITIVE' },
          'lib/csat/idle.ts': { class: 'CORRECTNESS' },
          'lib/csat/ok.ts': { class: 'CORRECTNESS' },
          'lib/csat/gone.ts': { class: 'CORRECTNESS' },
        },
      }
      const files = checkGateCoverage(root, m).map((p) => p.file).sort()
      expect(files).toEqual(['lib/csat/gone.ts', 'lib/csat/idle.ts', 'lib/csat/new-loader.ts', 'lib/csat/unrouted.ts'])
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
