// apps/web/src/app/(main)/teacher/page.tsx
// L3 B2B 교사 허브 (P4.2) — 클래스 개설·초대코드·참여·멤버 수. 클래스카드 모델.
// 데이터 모델 = P4.1(classes/class_members). 과제배포/리포트공유는 P4.3.

import { TeacherClient } from '@/components/teacher/TeacherClient'
import { Screen } from '@/components/ui/ios'
import { fetchMyMemberships, fetchTeacherClasses } from '@/lib/teacher/class-actions'

export const metadata = {
  title: '클래스 · Vocaflow',
  description: '클래스를 만들고 초대코드로 학생을 모아요',
}

export default async function TeacherPage() {
  const [classes, memberships] = await Promise.all([
    fetchTeacherClasses(),
    fetchMyMemberships(),
  ])
  return (
    <Screen width="content" background="bg2" padX="md">
      <TeacherClient classes={classes} memberships={memberships} />
    </Screen>
  )
}
