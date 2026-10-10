// apps/web/src/app/api/__tests__/task-submit-gate.test.ts
// 확인 과제 · Practice 제출은 채점 결과(정오 · 근거 · 정답 키)를 돌려준다 — 보류 관문(Reveal Gate)을 기록 · 채점 **전에** 거쳐야 한다(Codex P1 · 2026-10-10).
// 라우트 소스에서 관문 호출이 기록 함수 호출보다 앞에 있는지 본다(관문을 빼거나 뒤로 옮기면 실패).
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const ROUTES: [string, string][] = [
  ['app/api/csat/item/[slug]/task/route.ts', 'recordItemTaskAttempt('],
  ['app/api/csat/practice/attempt/route.ts', 'submitPractice('],
]

describe('제출 라우트 보류 관문', () => {
  for (const [file, writer] of ROUTES) {
    it(`${file} — canRevealItem → revealHeldResponse 가 ${writer} 보다 먼저`, () => {
      const src = fs.readFileSync(path.join(process.cwd(), 'src', file), 'utf8')
      const gate = src.indexOf('await canRevealItem(')
      const held = src.indexOf('revealHeldResponse()', gate)
      const write = src.indexOf(writer, src.indexOf('export async function POST'))
      expect(gate).toBeGreaterThan(0)
      expect(held).toBeGreaterThan(gate)
      expect(write).toBeGreaterThan(held)
    })
  }
})
