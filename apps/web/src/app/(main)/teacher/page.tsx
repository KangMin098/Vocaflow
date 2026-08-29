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
import { recordFunnel } from '@/lib/analytics/funnel'
import { createClient } from '@/lib/supabase/server'
import { Screen } from '@/components/ui/ios'
import {
  fetchMyAssignments,
  fetchMyCollectedIds,
  fetchSentAssignments,
} from '@/lib/teacher/assignment-actions'
import { fetchMyMemberships, fetchTeacherClasses } from '@/lib/teacher/class-actions'

export const metadata = {
  title: '클래스',
  description: '클래스를 만들고 초대코드로 학생을 모아요',
}

export default async function TeacherPage() {
  // 왕복 3단계 — 링크를 받은 교사가 **여기까지 왔는가**. 개설(4단계)과의 차이가
  // "화면은 봤는데 만들지 않았다" 를 드러낸다. 지금은 그 구간이 통째로 안 보인다.
  void recordFunnel(await createClient(), 'teacher_hub_view', { surface: '/teacher' })

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
          // 받은 것이 없으면 참여 중인 학급 아래에 무엇을 기다리는지 적는다 —
          // `ReceivedAssignments` 는 빈 목록에서 아무것도 그리지 않아 학생이 막다른 골목에 선다.
          hasReceived={receivedOnly.length > 0}
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
