// apps/web/src/lib/csat/ec-pilot/__tests__/targets-correctness-free.test.ts
//
// G3 가드 — 수집 대상 선택 코드(targets.ts · server.ts)가 정오 · 정답표 · 채점 결과를 읽으면 실패한다(주석은 뺀 코드만 본다).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FORBIDDEN = [/is_correct/, /isCorrect/, /csat_dx_answer_key/, /scoreAnswers/, /\bcorrectControls\b/, /['"`]answers?['"`,\s)]/, /select\([^)]*\banswer\b/]

const code = (file: string) => fs.readFileSync(path.join(DIR, file), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '')).join('\n')

describe('ec-pilot 대상 선택 — 정오 독립', () => {
  for (const file of ['targets.ts', 'server.ts']) {
    it(`${file} 는 정오 · 정답표 · 채점 결과를 읽지 않는다`, () => {
      const src = code(file)
      expect(FORBIDDEN.filter((re) => re.test(src)).map(String)).toEqual([])
    })
  }
})
