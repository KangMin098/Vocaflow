// apps/web/src/components/teacher/__tests__/invite-sheet.test.tsx
//
// `/teacher` 「교실에 붙일 초대장」(2026-09-19 · DD-33) 의 계약.
//   ① 반이 있으면 그 반의 초대장(이름 · 큰 코드 · 학생 수)이 첫 사물이다
//   ② 반이 없으면 같은 종이가 미리보기 — 반 이름 칸이 종이 위에 있고, 코드 자리는 비어 있다(지어내지 않는다)
//   ③ 여러 반이면 초대장에 올릴 반을 고른다 — 처음엔 학생이 가장 적은 반(부를 일이 남은 곳)

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { TeacherClass } from '@/lib/teacher/class-actions'

import { InviteSheet } from '../InviteSheet'
import { TeacherClient } from '../TeacherClient'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock('@/lib/teacher/class-actions', () => ({
  createClass: vi.fn(),
  joinClassByCode: vi.fn(),
  noteInviteShared: vi.fn(),
}))

const cls = (over: Partial<TeacherClass>): TeacherClass => ({
  id: 'c1',
  name: '3학년 2반',
  invite_code: 'ABC234',
  created_at: '2026-09-01',
  member_count: 0,
  ...over,
})

describe('InviteSheet', () => {
  it('반의 초대장 — 이름·코드·학생 수', () => {
    const html = renderToString(<InviteSheet name="3학년 2반" code="ABC234" memberCount={12} />).replace(/<!-- -->/g, '')
    expect(html).toContain('data-invite-sheet="class"')
    expect(html).toContain('3학년 2반')
    expect(html).toContain('ABC234')
    expect(html).toContain('들어온 학생 <b class="font-mono text-[var(--t1)]">12</b>명')
  })

  it('미리보기 — 반 이름 칸이 종이 위에 있고 코드는 지어내지 않는다', () => {
    const html = renderToString(<InviteSheet name="" code={null} editable />)
    expect(html).toContain('data-invite-sheet="preview"')
    expect(html).toContain('id="invite-class-name"')
    expect(html).not.toMatch(/[A-Z0-9]{6}<\/p>/)
    expect(html).toContain('반을 만들면 QR 이 생겨요')
  })
})

describe('TeacherClient — 초대장이 첫 사물', () => {
  it('반이 없으면 미리보기 + 「이 반 만들기」', () => {
    const html = renderToString(<TeacherClient classes={[]} memberships={[]} />)
    expect(html).toContain('data-invite-sheet="preview"')
    expect(html).toContain('이 반 만들기')
  })

  it('여러 반이면 처음엔 학생이 가장 적은 반의 초대장', () => {
    const html = renderToString(
      <TeacherClient
        classes={[cls({ id: 'a', name: '가득 찬 반', invite_code: 'FULL01', member_count: 28 }), cls({ id: 'b', name: '빈 반', invite_code: 'EMPTY1', member_count: 0 })]}
        memberships={[]}
      />,
    )
    const sheet = html.slice(html.indexOf('data-invite-sheet="class"'))
    expect(sheet.indexOf('빈 반')).toBeGreaterThan(-1)
    expect(sheet.indexOf('빈 반')).toBeLessThan(sheet.indexOf('가득 찬 반'))
  })
})
