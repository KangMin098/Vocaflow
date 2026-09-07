// apps/web/src/components/teacher/__tests__/TeacherClient.test.tsx
//
// 교사 클래스 화면 — **조회 실패와 "클래스가 없음" 이 구별되어야 한다**.
//
// 왜 이 테스트가 있는가:
//   `classes`/`class_members` 가 삭제된 동안(20260719 → 20260812) `fetchTeacherClasses` 가
//   `const { data } = ...` 로 error 를 버리고 빈 배열을 반환했다. 그래서 교사 화면은
//   **"개설한 클래스가 없어요"** 를 보여줬다 — 조회 실패가 정상 상태를 완벽히 흉내 냈다.
//   테이블은 복원했지만, 이 구별이 코드에 없으면 다음에 같은 일이 또 조용히 지나간다.
//
//   같은 실패 유형을 hub 처방에서도 겪었다(csat_item_attempts → prescribe_today).
//   그쪽 계약은 TodayPrescriptionCard.test.tsx 가 고정한다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { MyMembership, TeacherClass } from '@/lib/teacher/class-actions'

import { TeacherClient } from '../TeacherClient'

// 서버 액션 · 라우터는 renderToString 컨텍스트 밖 — 스텁
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}))
vi.mock('@/lib/teacher/class-actions', async () => ({
  createClass: vi.fn(),
  joinClassByCode: vi.fn(),
  leaveClass: vi.fn(),
  deleteClass: vi.fn(),
}))

const CLASS: TeacherClass = {
  id: 'c-1',
  name: '3학년 2반',
  invite_code: 'ABC234',
  created_at: '2026-08-01T00:00:00Z',
  member_count: 12,
}
const MEMBERSHIP: MyMembership = {
  class_id: 'c-9',
  class_name: '옆 반',
  joined_at: '2026-08-02T00:00:00Z',
}

describe('TeacherClient — 실패와 빈 상태의 구별', () => {
  it('클래스가 있으면 이름·초대코드·멤버 수를 렌더한다', () => {
    const html = renderToString(<TeacherClient classes={[CLASS]} memberships={[MEMBERSHIP]} />)
    expect(html).toContain('3학년 2반')
    expect(html).toContain('ABC234')
    expect(html).toContain('옆 반')
  })

  it('unavailable 이면 "사라진 것이 아니다" 를 밝힌다', () => {
    const html = renderToString(<TeacherClient classes={[]} memberships={[]} unavailable />)
    expect(html).toContain('불러오지 못했어요')
    expect(html, '교사를 안심시키는 문구가 없다').toContain('사라진 것은 아니에요')
  })

  it('정상 빈 상태에서는 실패 고지가 뜨지 않는다 (거짓 경보 금지)', () => {
    const html = renderToString(<TeacherClient classes={[]} memberships={[]} />)
    expect(html).not.toContain('불러오지 못했어요')
  })

  it('빈 목록 두 경우의 화면이 실제로 달라야 한다 — 같으면 구별이 불가능하다', () => {
    const empty = renderToString(<TeacherClient classes={[]} memberships={[]} />)
    const failed = renderToString(<TeacherClient classes={[]} memberships={[]} unavailable />)
    expect(failed, 'unavailable 이 화면에 아무 차이도 만들지 않는다').not.toBe(empty)
  })

  it('조회 실패라도 개설·참여 입력은 막지 않는다 (쓰기 경로는 별개다)', () => {
    const html = renderToString(<TeacherClient classes={[]} memberships={[]} unavailable />)
    // 클래스 개설/참여 UI 가 남아 있어야 한다 — 읽기 실패가 쓰기를 봉쇄하면 안 된다
    expect(html).toMatch(/개설|만들/)
    expect(html).toMatch(/초대코드|참여/)
  })
})

/**
 * **빈 상태에서 다음 할 일이 보이는가** — 제품이 사람을 잃는 자리다.
 *
 * 2026-08-27 실측(학급 하나 · 학생 0 · 과제 0):
 *   화면은 "학생 0명" 과 코드 칩 `TSTEM1` 만 보여주고, 다음 할 일을 **"단어 보내기"** 라고 했다.
 *   보낼 대상이 없는데 보내라고 하면 그 화면은 틀린 말을 하는 것이고, 교사는 시킨 대로 해도
 *   아무 일이 안 일어난다. 학생 쪽도 같았다 — 참여했는데 받은 것이 없으면 반 이름 한 줄뿐이었다
 *   (`ReceivedAssignments` 가 빈 목록에서 `return null` 이라 아무것도 안 그린다).
 */
describe('TeacherClient — 빈 상태의 다음 할 일', () => {
  const EMPTY_CLASS: TeacherClass = { ...CLASS, member_count: 0 }

  it('학생이 없으면 다음 할 일은 **부르기**다 — 보낼 대상이 없는데 보내라고 하지 않는다', () => {
    const html = renderToString(<TeacherClient classes={[EMPTY_CLASS]} memberships={[]} />)
    expect(html).toContain('학생 부르기')
    expect(html).not.toContain('우리 반에 단어 보내기')
  })

  it('학생이 없는 학급 줄은 코드가 무엇인지 말한다 — 칩만 두면 처음 온 교사는 모른다', () => {
    const html = renderToString(<TeacherClient classes={[EMPTY_CLASS]} memberships={[]} />)
    expect(html).toContain('초대 링크')
  })

  it('학생이 들어오면 다음 할 일이 **보내기**로 바뀐다', () => {
    const html = renderToString(<TeacherClient classes={[CLASS]} memberships={[]} />)
    expect(html).toContain('우리 반에 단어 보내기')
    expect(html).not.toContain('학생 부르기')
    // 안내 줄도 사라진다 — 이미 들어온 학급에 초대 설명이 남아 있으면 소음이다.
    expect(html).not.toContain('반 채팅방에 붙여넣으면')
  })

  it('참여했는데 받은 것이 없는 학생에게 무엇을 기다리는지 말한다', () => {
    const html = renderToString(
      <TeacherClient classes={[]} memberships={[MEMBERSHIP]} hasReceived={false} />,
    )
    expect(html).toContain('선생님이 단어를 보내면')
  })

  it('받은 것이 있으면 그 안내를 지운다 — 이미 도착했는데 기다리라고 하지 않는다', () => {
    const html = renderToString(
      <TeacherClient classes={[]} memberships={[MEMBERSHIP]} hasReceived />,
    )
    expect(html).not.toContain('선생님이 단어를 보내면')
  })
})
