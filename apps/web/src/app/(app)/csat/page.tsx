// apps/web/src/app/(app)/csat/page.tsx
//
// **기출 메인** — 참조(Tines 3B) 앱 메인 화면. 2026-09-24 `/csat/space` 에서 `/csat` 으로 올렸다(옛 경로는 여기로 보낸다).
// 문항 목록은 별도 화면 `/csat/browse`(전체 서가), 문항 해설은 `/csat/item/[slug]`.
// 참조(Tines 3B) 앱 화면의 골격을 그대로 쓰되, 안에 들어가는 것은 우리 기출 코퍼스다.
// 자세한 대응은 `components/csat/space/SpaceScreen.tsx` 머리말 · `lib/csat/space-model.ts`.
//
// ⚠️ **`(app)` 그룹에 둔다**(`(main)` 이 아니다). 이 화면은 참조처럼 **자기 레일과 자기 상단
//    줄을 갖는다** — `(main)` 의 상단 막대 · 나침반 띠 · 모듈 머리띠 위에 또 레일을 얹으면
//    한 화면에 머리가 셋이 된다. `(app)/layout.tsx` 는 `SessionFrame` 만 감싸고, 이 경로는
//    풀스크린 목록에 없으므로 그 프레임은 그대로 통과한다(= 화면이 뷰포트를 통째로 갖는다).
//    진입 계측은 그 layout 의 `ScreenViewTracker group="app"` 이 맡는다(D2).
//
// 서버가 하는 일: 회차 이름 목록(구운 JSON) + 문항 → 유형 표(서가 카탈로그, 캐시). 표의 수치는
// 클라이언트가 구운 `trap-atlas.json` 에서 읽는다. 학습 기록은 브라우저가 기기 + `/api/csat/state` 에서 읽는다.

import type { Metadata } from 'next'

import type { NeedId } from '@/components/csat/home/CsatRail'
import { SpaceScreen } from '@/components/csat/space/SpaceScreen'
import { itemTypeMap, railExams } from '@/lib/csat/rail-data'
import { spaceHeadline } from '@/lib/csat/space-model'

export const dynamic = 'force-dynamic'

// 제목의 수는 **세어서 넣는다.** 26·32 를 손으로 적으면 코퍼스를 다시 구울 때 탭 제목만
// 조용히 낡는다(AGENTS I5 — 같은 이유로 화면 안의 수도 전부 계산값이다).
export function generateMetadata(): Metadata {
  const head = spaceHeadline()
  return {
    title: `기출분석공간 — 유형 ${head.types} · 함정 ${head.traps}`,
    description: '평가원 기출의 유형과 오답 제조법을 한 판에 놓고 고르고, 멈춘 자리에서 이어 갑니다.',
  }
}

const NEED_IDS: NeedId[] = ['start', 'killer', 'trap', 'evidence', 'recent']
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined)

export default async function CsatHomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const needParam = one(params.need)
  const need = NEED_IDS.find((n) => n === needParam) ?? (one(params.tab) === 'trap' ? 'trap' : null)
  // 회차 목록은 구운 골격 JSON, 문항 → 유형은 서가 카탈로그(프로세스 캐시)에서 온다.
  const [exams, itemTypes] = [railExams(), await itemTypeMap()]
  return (
    // 쿼리가 바뀌면 다시 세운다 — 같은 경로 안의 링크 이동은 컴포넌트를 재사용해 첫 필터가 남는다(A2 실패 2026-09-25)
    <SpaceScreen
      key={[need ?? '', one(params.tab) ?? '', one(params.view) ?? ''].join('|')}
      exams={exams}
      itemTypes={itemTypes}
      initialTab={one(params.tab) === 'trap' ? 'trap' : 'type'}
      need={need}
      view={one(params.view) === 'continue' ? 'continue' : 'home'}
    />
  )
}
