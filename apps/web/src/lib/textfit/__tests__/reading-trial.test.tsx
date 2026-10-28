// apps/web/src/lib/textfit/__tests__/reading-trial.test.tsx
// /fit 고정 예시 읽기 체험 — 원문 결속(sha256) · 문항 계약 · 로컬 채점만 · 서버 채점/기록 0 · 기본 꺼짐.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const actions = vi.hoisted(() => ({ gradeDcpItem: vi.fn(), recordDcpErrorCause: vi.fn() }))
vi.mock('@/lib/learner/dcp-actions', () => actions)

import { HERO_PASSAGE } from '@/lib/marketing/hero-demo'
import { ReadingTrial } from '@/components/textfit/ReadingTrial'
import {
  READING_TRIAL_ENABLED, TRIAL_EXCERPT, TRIAL_EXCERPT_SHA256, TRIAL_ITEM, TRIAL_ITEM_ID, TRIAL_KEY, TRIAL_EXPLANATION, gradeTrial, inertCause, trialDoneCopy,
} from '../reading-trial'
import type { DcpChoicePayload } from '@/lib/learner/dcp'

describe('원문 결속', () => {
  it('발췌 = HERO_PASSAGE 의 첫 두 문장 · sha256 고정', () => {
    expect(HERO_PASSAGE.startsWith(TRIAL_EXCERPT)).toBe(true)
    expect(HERO_PASSAGE.slice(0, TRIAL_EXCERPT.length + 1).match(/\./g)).toHaveLength(2)
    expect(createHash('sha256').update(TRIAL_EXCERPT, 'utf8').digest('hex')).toBe(TRIAL_EXCERPT_SHA256)
    expect(TRIAL_EXCERPT_SHA256).toBe('0263921ebed4f09cadd442362fbfe8c2864bbf06e2aa0a9c33922128fbe62b71')
  })
})

describe('문항 계약', () => {
  const p = TRIAL_ITEM.payload as DcpChoicePayload
  it('topic · 5지 · 정답 1 · 해설 있음 · 지문 = 발췌', () => {
    expect(TRIAL_ITEM.type).toBe('topic')
    expect(p.choices).toHaveLength(5)
    expect(new Set(p.choices).size).toBe(5)
    expect(TRIAL_KEY).toBe(1)
    expect(p.choices[0]).toBe('how familiar and unfamiliar words affect reading differently')
    expect(p.passage).toBe(TRIAL_EXCERPT)
    expect(TRIAL_EXPLANATION).toContain('그 차이의 한 양상을 낱말의 대조로')
  })
})

describe('로컬 채점 — 고정 문항만', () => {
  it('정답 · 오답 모양 · attemptId null', async () => {
    expect(await gradeTrial(TRIAL_ITEM_ID, { choice: 1 })).toEqual({ ok: true, correct: true, attemptId: null, answerKey: { explanation_ko: TRIAL_EXPLANATION } })
    expect(await gradeTrial(TRIAL_ITEM_ID, { choice: 2 })).toMatchObject({ ok: true, correct: false, attemptId: null, answerKey: { answer: 1 } })
  })
  it('다른 문항 · 붙여 넣은 글 id 는 채점하지 않는다', async () => {
    expect((await gradeTrial('pasted-text', { choice: 1 })).ok).toBe(false)
  })
  it('원인 기록은 무동작 · 완료 문구에 실력 · 목표 주장 없음', async () => {
    expect(await inertCause()).toEqual({ ok: true })
    const c = trialDoneCopy()
    expect(`${c.title}${c.body}`).not.toMatch(/실력|향상|목표|달성|레벨/)
    expect(c.body).toContain('학습 기록에는 남지 않아요')
  })
})

describe('화면 · 경계', () => {
  it('닫힌 상태 — 안내 문구 · 44px 열기 버튼 · 문항 미렌더 · 서버 호출 0', () => {
    const html = renderToString(<ReadingTrial />)
    expect(html).toContain('예시 안내 연습 · 학습 기록에 포함되지 않음')
    expect(html).toMatch(/<button[^>]*min-h-\[44px\][^>]*aria-expanded="false"/)
    expect(html).not.toContain('slips past')
    expect(actions.gradeDcpItem).not.toHaveBeenCalled()
    expect(actions.recordDcpErrorCause).not.toHaveBeenCalled()
  })
  it('기본 꺼짐 · /fit 은 플래그 뒤에서만 렌더 · 체험은 붙여 넣은 글 분석(PublicFitClient)에 닿지 않는다', () => {
    expect(READING_TRIAL_ENABLED).toBe(false)
    const page = fs.readFileSync(path.resolve(__dirname, '../../../app/(marketing)/fit/page.tsx'), 'utf8')
    expect(page).toMatch(/\{READING_TRIAL_ENABLED && \(/)
    const comp = fs.readFileSync(path.resolve(__dirname, '../../../components/textfit/ReadingTrial.tsx'), 'utf8').replace(/^\s*\/\/.*$/gm, '')
    expect(comp).not.toMatch(/PublicFitClient|analyze|localStorage|sessionStorage|fetch\(|track\(|dcp-actions|supabase/)
  })
})
