// apps/web/src/lib/teacher/__tests__/invite-link.test.ts
//
// 초대 링크가 어긋나면 **학생이 도착하지 못하고, 그 실패는 교사 쪽에 보이지 않는다.**
// 교사 화면은 "복사됨" 이라고 말하고, 학생 쪽에서는 아무 일도 안 일어난다.
// 그래서 모양을 여기서 못 박는다.

import { describe, expect, it } from 'vitest'

import { inviteUrl, invitePath, normalizeInviteCode } from '../invite-link'

describe('초대 링크', () => {
  it('학생이 도착하는 경로는 /join/[코드] 다', () => {
    expect(invitePath('ABC123')).toBe('/join/ABC123')
  })

  it('대문자로 고정한다 — 화면의 코드와 링크 속 코드가 달라 보이면 옮겨 적다가 틀린다', () => {
    expect(invitePath('abc123')).toBe('/join/ABC123')
    expect(normalizeInviteCode('  abc123 ')).toBe('ABC123')
  })

  it('origin 끝의 슬래시가 겹치지 않는다', () => {
    expect(inviteUrl('https://vocaflow.app', 'ABC123')).toBe('https://vocaflow.app/join/ABC123')
    expect(inviteUrl('https://vocaflow.app/', 'ABC123')).toBe('https://vocaflow.app/join/ABC123')
  })

  it('코드는 URL 인코딩된다 — 손으로 만든 코드가 섞여 들어와도 링크가 깨지지 않는다', () => {
    expect(invitePath('a b')).toBe('/join/A%20B')
  })
})
