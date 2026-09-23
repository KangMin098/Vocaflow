// apps/web/src/app/(app)/csat/space/page.tsx
//
// **기출 작업 공간** — `/csat` 과 나란히 서는 별도 화면이다(기존 홈은 그대로 둔다).
// 참조(Tines 3B) 앱 화면의 골격을 그대로 쓰되, 안에 들어가는 것은 우리 기출 코퍼스다.
// 자세한 대응은 `components/csat/space/SpaceScreen.tsx` 머리말 · `lib/csat/space-model.ts`.
//
// ⚠️ **`(app)` 그룹에 둔다**(`(main)` 이 아니다). 이 화면은 참조처럼 **자기 레일과 자기 상단
//    줄을 갖는다** — `(main)` 의 상단 막대 · 나침반 띠 · 모듈 머리띠 위에 또 레일을 얹으면
//    한 화면에 머리가 셋이 된다. `(app)/layout.tsx` 는 `SessionFrame` 만 감싸고, 이 경로는
//    풀스크린 목록에 없으므로 그 프레임은 그대로 통과한다(= 화면이 뷰포트를 통째로 갖는다).
//    진입 계측은 그 layout 의 `ScreenViewTracker group="app"` 이 맡는다(D2).
//
// 서버가 하는 일은 **회차 이름 목록 하나**뿐이다 — 나머지 수치는 클라이언트가 구운 JSON
// (`trap-atlas.json`)에서 직접 읽는다. 그래서 이 화면은 DB 왕복이 0 이고, 로그인 세션이
// 만료돼도 빈 표가 되지 않는다(`/csat` 홈은 공개 분석을 읽으므로 그렇지 않다).

import type { Metadata } from 'next'

import { SpaceScreen, type SpaceExam } from '@/components/csat/space/SpaceScreen'
import { browseExamOrder, examAxis } from '@/lib/csat/browse-model'
import { skeletonExamMeta } from '@/lib/csat/skeleton'
import { spaceHeadline } from '@/lib/csat/space-model'

// 제목의 수는 **세어서 넣는다.** 26·32 를 손으로 적으면 코퍼스를 다시 구울 때 탭 제목만
// 조용히 낡는다(AGENTS I5 — 같은 이유로 화면 안의 수도 전부 계산값이다).
export function generateMetadata(): Metadata {
  const head = spaceHeadline()
  return {
    title: `기출 작업 공간 — 유형 ${head.types} · 함정 ${head.traps}`,
    description: '평가원 기출의 유형과 오답 제조법을 한 판에 놓고 고릅니다. 수치는 구운 코퍼스 실측입니다.',
  }
}

export default function CsatSpacePage() {
  // 구운 골격 파일에서 온다 — DB 를 치지 않는다(`skeleton.ts` 머리말).
  const exams: SpaceExam[] = skeletonExamMeta()
    .map((exam) => ({ ...exam, id: exam.exam_id, ...examAxis(exam.exam_id) }))
    .sort(browseExamOrder)
    .map(({ exam_id, label, items }) => ({ exam_id, label, items }))

  return <SpaceScreen exams={exams} />
}
