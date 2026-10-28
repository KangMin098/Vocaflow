// apps/web/src/components/csat/theater/__tests__/session-done-review-days.test.tsx
// T-0216 — 완료 화면 「N일 뒤 다시 보기」 표시 = 클릭 때 예약 간격(reviewDays). 예전 표시는 늘 「3일 뒤」 였다(AnalysisTheater 는 1·3·7일 예약).
// 실제 SessionDone 마크업 + 실제 reviewDays · scheduleReview 로 표시 → 예약 → 예약 후 재렌더를 1·3·7일 모두 본다.
import fs from 'node:fs'
import path from 'node:path'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => '/csat/item/x' }))

import { emptyDissectionRecord } from '@/lib/csat/dissect'
import { finishSession, latestSession, openSession, revealSession, scheduleReview } from '@/lib/csat/learning-session'
import { reviewDays } from '@/lib/csat/understanding-check'

import { SessionDone } from '../SessionDone'

const T0 = Date.UTC(2026, 9, 29, 9, 0, 0)
const ITEM = '2026#34'
const a = (kind: string, tries: number, correct = true, revealed = false) => ({ kind, tries, correct, revealed })

/** 이해 확인 결과 → 기대 간격 · 화면 이름 · 예약 뒤 표시(SessionDone 의 dayLabel 규칙) */
const CASES = [
  { name: '확인 미참여 → 1일', attempts: [] as ReturnType<typeof a>[], days: 1, button: '내일 다시 보기', after: '다시 보기 내일' },
  { name: '답 공개 → 1일', attempts: [a('evidence', 2, true, true)], days: 1, button: '내일 다시 보기', after: '다시 보기 내일' },
  { name: '첫 시도 정답 → 7일', attempts: [a('evidence', 1), a('lure', 1)], days: 7, button: '7일 뒤 다시 보기', after: '다시 보기 7일 뒤' },
  { name: '재시도 정답 → 3일', attempts: [a('evidence', 1), a('lure', 3)], days: 3, button: '3일 뒤 다시 보기', after: '다시 보기 3일 뒤' },
]

function finished() {
  const o = openSession(emptyDissectionRecord(7), { itemId: ITEM, steps: 14, now: T0, newId: () => 's-1' })
  const record = finishSession(revealSession(o.record, o.session.id, 'independent', null, T0 + 1), o.session.id, T0 + 2)
  return { record, id: o.session.id }
}
const render = (session: ReturnType<typeof latestSession>, days: 1 | 3 | 7, now: number) =>
  renderToString(<SessionDone session={session!} result={null} next={null} typeHref={null} now={now} reviewDays={days} onReview={() => {}} onRestart={() => {}} />)
const buttonOf = (html: string) => /<button[^>]*data-testid="done-review"[^>]*>([^<]*(?:<!-- -->[^<]*)*)<\/button>/.exec(html)

describe('완료 화면 다시 보기 — 표시 = 예약', () => {
  for (const c of CASES) {
    it(`${c.name}: 버튼 「${c.button}」 → 예약 ${c.days}일 → 예약 뒤 「${c.after}」`, () => {
      const days = reviewDays(c.attempts)
      expect(days).toBe(c.days)
      const { record, id } = finished()
      const before = render(latestSession(record, ITEM), days, T0 + 3)
      const btn = buttonOf(before)
      expect(btn?.[1].replace(/<!-- -->/g, '')).toBe(c.button)
      expect(btn?.[0]).toContain(`data-review-days="${days}"`)
      // 부모(AnalysisTheater.review)와 같은 호출 — 같은 값으로 예약
      const scheduled = scheduleReview(record, id, T0 + 3, days)
      const s = latestSession(scheduled, ITEM)!
      expect(s.reviewAt).toBe(T0 + 3 + c.days * 86_400_000)
      const after = render(s, days, T0 + 3)
      expect(after).not.toContain('data-testid="done-review"')
      expect(/data-testid="done-review-set"[^>]*>([^<]*(?:<!-- -->[^<]*)*)</.exec(after)?.[1].replace(/<!-- -->/g, '')).toBe(c.after)
      // 중복 클릭 멱등 — 두 번째 예약은 그대로
      expect(scheduleReview(scheduled, id, T0 + 10, days)).toBe(scheduled)
    })
  }
})

describe('부모 결속 — 표시와 예약이 같은 값', () => {
  it('AnalysisTheater 는 doneReviewDays 하나를 예약(review)과 SessionDone 표시 둘 다에 쓴다 · 이벤트는 예약 1회만', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../AnalysisTheater.tsx'), 'utf8')
    expect(src).toMatch(/const doneReviewDays = reviewDays\(checked\.filter\(\(x\) => !x\.review\)\)/)
    expect(src).toMatch(/const days = doneReviewDays/)
    expect(src).toMatch(/reviewDays=\{doneReviewDays\}/)
    expect(src.match(/track\(\{ name: 'csat_review_scheduled'/g)?.length).toBe(1)
    expect(fs.readFileSync(path.resolve(__dirname, '../SessionDone.tsx'), 'utf8')).not.toContain('3일 뒤 다시 보기')
  })
})
