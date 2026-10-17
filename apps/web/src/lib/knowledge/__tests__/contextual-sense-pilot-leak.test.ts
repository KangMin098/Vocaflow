// apps/web/src/lib/knowledge/__tests__/contextual-sense-pilot-leak.test.ts
//
// V2-F1 — PR #278 파일럿 12문항(비공개 DRAFT)으로 「제출 전 화면 모양에 B 단서가 남지 않는다」를 실제 자료에 대 본다(읽기 전용).
// 비공개 파일은 커밋되지 않은 worktree 에만 있다 — 경로가 없으면 이 묶음은 건너뛴다(SKIP 은 PASS 가 아니다 · 문서에 따로 적는다).
// 내용(뜻 · 정답)은 출력하지 않는다. 비교 결과 수만 단언한다.
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { contextualSensePanel, gradeContextualSense, parseContextualSense, releasable, validAnnotation } from '../contextual-sense'

const DIR = process.env.V2_PILOT_PRIVATE_DIR ?? 'D:/workspace/Vocaflow-v2-annotation-pilot/scripts/csat/v2-annotation-pilot/private/annotations'
const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith('.draft.json')) : []

describe.skipIf(files.length === 0)('V2-F1 파일럿 12문항 · 실제 초안', () => {
  const drafts = files.map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')))
  it('12문항 모두 모양 검증 통과 · 출시 자격 0(DRAFT · 표지 · 구성개념 미지정)', () => {
    expect(drafts).toHaveLength(12)
    expect(drafts.filter(validAnnotation)).toHaveLength(12)
    expect(drafts.filter(releasable)).toHaveLength(0)
  })
  it('제출 전 화면 모양에 뜻 선택지 문자열이 하나도 없다(12/12)', () => {
    const leaks = drafts.filter((d) => {
      const p = JSON.stringify(contextualSensePanel(d))
      return d.sense.options.some((o: string) => p.includes(o))
    })
    expect(leaks).toHaveLength(0)
  })
  it('B 를 틀리면 채점 응답에도 뜻 선택지가 없다 · 맞히면 연습으로만 온다(12/12)', () => {
    let wrongLeaks = 0, rightFollow = 0
    for (const d of drafts) {
      const wrong = gradeContextualSense(d, parseContextualSense({ misfit: (d.misfit + 1) % 5, cue: [] }, d)!)
      if (d.sense.options.some((o: string) => JSON.stringify(wrong).includes(o))) wrongLeaks++
      const right = gradeContextualSense(d, parseContextualSense({ misfit: d.misfit, cue: [] }, d)!)
      if (right.isCorrect && right.followUp?.senseOptions.length === d.sense.options.length) rightFollow++
    }
    expect(wrongLeaks).toBe(0)
    expect(rightFollow).toBe(12)
  })
})
