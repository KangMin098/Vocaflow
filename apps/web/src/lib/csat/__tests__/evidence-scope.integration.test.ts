// apps/web/src/lib/csat/__tests__/evidence-scope.integration.test.ts
//
// 근거 매트릭스의 학평 범위를 **실 DB** 로 읽는다. 범위 조건은 LIKE 패턴(`H____G3%`)이라
// 한 글자만 어긋나도 오류 없이 0건이나 전량이 온다 — 그래서 수를 DB 에 직접 대 본다.

import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { loadEvidence } from '../evidence'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const skip = !SUPABASE_URL || !SERVICE_KEY

describe.skipIf(skip)('evidence 학평 범위 (실 DB)', () => {
  it('학평 고3 — 그 학년 회차·문항만, 평가원은 섞이지 않는다', async () => {
    const svc = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
    const exams = await svc.from('csat_exams').select('id', { count: 'exact', head: true }).eq('organizer', 'edu_office').eq('grade', 3)
    const items = await svc.from('csat_items').select('id', { count: 'exact', head: true }).eq('in_scope', true).like('exam_id', 'H____G3%')
    expect(exams.error).toBeNull()
    expect(items.count ?? 0).toBeGreaterThan(0)

    const data = await loadEvidence({ set: 'hakpyeong', grade: 3 })
    expect(data.loadError).toBeNull()
    expect(data.exams.length).toBe(exams.count)
    expect(data.items.length).toBe(items.count)
    expect(data.items.every((i) => /^H\d{4}G3$/.test(i.examId))).toBe(true)
    expect(data.exams.every((e) => e.kind === 'hakpyeong')).toBe(true)
    // 분석이 없는 문항은 「분석 없음」이지 「인용 미정착」이 아니다(PR #125 리뷰: 미분석 924문항 오진)
    const unanalyzed = data.items.filter((i) => i.analysisVersion == null)
    expect(unanalyzed.every((i) => i.defects.includes('unanalyzed') && !i.defects.includes('quote'))).toBe(true)
    expect(data.items.filter((i) => i.defects.includes('quote')).every((i) => i.analysisVersion != null)).toBe(true)
    // 평가원 유형 리포트 잣대를 학평에 대지 않는다
    expect(data.items.some((i) => i.defects.includes('reportText') || i.defects.includes('reportCount'))).toBe(false)
  })

  it('평가원 범위(기본)에는 학평이 없다', async () => {
    const data = await loadEvidence()
    expect(data.loadError).toBeNull()
    expect(data.items.some((i) => i.examId.startsWith('H'))).toBe(false)
  })
})
