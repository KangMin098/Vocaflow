// apps/web/src/app/(main)/teacher/page.tsx
// L3 B2B 교사 허브 — 클래스 개설·초대코드·참여·멤버 수 + **단어 과제**(v06.44).
// 데이터 모델 = classes/class_members + class_assignments/class_assignment_progress.
//
// 왜 교사·학생이 같은 화면인가: 학급은 두 역할이 공유하는 하나의 표면이다. 학생용 라우트를
//   새로 만들면 학습자 표면이 22 → 23 이 된다(진단 F5 는 4개 이하가 목표).
//   역할에 따라 다른 블록을 보여주는 편이 옳다 — 교사는 "보낸 단어", 학생은 "받은 단어".

import { ReceivedAssignments } from '@/components/teacher/ReceivedAssignments'
import { SentAssignments } from '@/components/teacher/SentAssignments'
import { TeacherClient } from '@/components/teacher/TeacherClient'
import { Screen } from '@/components/ui/ios'
import {
  fetchMyAssignments,
  fetchMyCollectedIds,
  fetchSentAssignments,
} from '@/lib/teacher/assignment-actions'
import { fetchMyMemberships, fetchTeacherClasses } from '@/lib/teacher/class-actions'

export const metadata = {
  title: '클래스 · Vocaflow',
  description: '클래스를 만들고 초대코드로 학생을 모아요',
}

export default async function TeacherPage() {
  const [taught, joined, received, sent, collectedIds] = await Promise.all([
    fetchTeacherClasses(),
    fetchMyMemberships(),
    fetchMyAssignments(),
    fetchSentAssignments(),
    fetchMyCollectedIds(),
  ])

  // 학생 화면에서는 내가 보낸 것(교사 역할)까지 다시 받은 것으로 보이지 않게 거른다 —
  // 교사가 자기 학급 학생이기도 한 경우는 없지만, 여러 학급에 걸친 사람은 있을 수 있다.
  const sentIds = new Set(sent.rows.map((r) => r.assignment.id))
  const receivedOnly = received.assignments.filter((a) => !sentIds.has(a.id))

  return (
    <Screen width="content" background="bg2" padX="md">
      <div className="flex flex-col gap-8">
        <TeacherClient
          classes={taught.classes}
          memberships={joined.memberships}
          // 조회 실패와 "정말 클래스가 없음" 은 화면에서 구별되어야 한다 —
          // 빈 목록만 보여주면 교사는 자기 클래스가 사라졌다고 읽는다.
          unavailable={taught.unavailable || joined.unavailable}
        />

        <ReceivedAssignments
          assignments={receivedOnly}
          failed={received.failed}
          collectedIds={collectedIds}
        />

        <SentAssignments rows={sent.rows} />
      </div>
    </Screen>
  )
}
