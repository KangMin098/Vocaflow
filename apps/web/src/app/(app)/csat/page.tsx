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
// **v3 M1(2026-10-13) — 쿼리 없는 `/csat` 는 「내 학습 지도」 홈**(HomeLanding · 첫 제안 + 핵심 학습 지도 + 내 자료 + 기출 탐구).
//   옛 주소 `?need=<목적>` · `?tab=trap` · `?view=continue` 는 옛 URL 전용으로 기존 SpaceScreen 그대로 연다. 무효 need 는 지도 홈.
//   지도 loader 오류는 오류로(기록 0 으로 삼키지 않는다) · null(미설치 · 시드 전)은 준비 중.
//
// 서버가 하는 일: 회차 이름 목록(구운 JSON) + 문항 → 유형 표(서가 카탈로그, 캐시). 표의 수치는
// 클라이언트가 구운 `trap-atlas.json` 에서 읽는다. 학습 기록은 브라우저가 기기 + `/api/csat/state` 에서 읽는다.

import type { Metadata } from 'next'

import type { SupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

import type { NeedId } from '@/components/csat/home/CsatRail'
import { HomeLanding } from '@/components/csat/home/HomeLanding'
import { SpaceScreen } from '@/components/csat/space/SpaceScreen'
import { learnerSession, loadHomeDiagnosis } from '@/lib/csat/diagnosis/learner'
import { parseHomeReturn, type HomeFocusKind, type MapLoadState } from '@/lib/csat/home-suggestion'
import { mapProgressOf, type MapProgress } from '@/lib/csat/map/home-progress'
import { homeFocusOf } from '@/lib/csat/map/v62/home-focus'
import { parseMapReturn, returnQueryOf, type MapReturnCtx } from '@/lib/csat/map-return'
import { loadMapPage, type MapPageData } from '@/lib/csat/map/load'
import { createAdminClient } from '@/lib/supabase/admin'
import { itemTypeMap, railExams } from '@/lib/csat/rail-data'
import { spaceHeadline } from '@/lib/csat/space-model'
import { loadTrapExamples } from '@/lib/csat/trap-atlas-examples'

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
  // 옛 URL 전용 — 목적(need) · 함정 탭(tab=trap) · 유형 탭(tab=type) · 이어서(view=continue). 하나라도 있으면 옛 화면 그대로
  const legacy = need !== null || one(params.view) === 'continue' || one(params.tab) === 'type'
  if (!legacy) return <MapHome from={one(params.from)} item={one(params.item)} restore={parseMapReturn(returnQueryOf(params))} />
  // 회차 목록은 구운 골격 JSON, 문항 → 유형은 서가 카탈로그(프로세스 캐시)에서 온다.
  const [exams, itemTypes, diagnosis] = [await railExams(), await itemTypeMap(), await loadHomeDiagnosis()]
  // 함정 예시는 서버에서 보류 필터 뒤 — 식별 칸(문항 · 회차 · 번호 · 유형)만 넘긴다(오답 번호 · 이유는 싣지 않는다 · Reveal Gate G3)
  const detail = await loadTrapExamples()
  const trapExamples = Object.fromEntries(Object.entries(detail).map(([k, list]) => [k, list.map((e) => ({ slug: e.slug, exam_label: e.exam_label, no: e.no, type_id: e.type_id }))]))
  return (
    // 쿼리가 바뀌면 다시 세운다 — 같은 경로 안의 링크 이동은 컴포넌트를 재사용해 첫 필터가 남는다(A2 실패 2026-09-25)
    <SpaceScreen
      key={[need ?? '', one(params.tab) ?? '', one(params.view) ?? ''].join('|')}
      exams={exams}
      itemTypes={itemTypes}
      initialTab={one(params.tab) === 'trap' ? 'trap' : 'type'}
      need={need}
      view={one(params.view) === 'continue' ? 'continue' : 'home'}
      diagnosis={diagnosis}
      trapExamples={trapExamples}
    />
  )
}

/** 내 학습 지도 홈 — 지도 데이터는 진단 화면과 같은 loader(관리 클라이언트 · 본인 id) */
async function MapHome({ from, item, restore }: { from?: string; item?: string; restore: Required<MapReturnCtx> }) {
  const { userId } = await learnerSession()
  if (!userId) redirect('/login?next=/csat')
  const exams = await railExams()
  let map: MapLoadState = 'preparing'
  let mapData: MapPageData | null = null
  try {
    mapData = await loadMapPage(createAdminClient() as unknown as SupabaseClient, userId, new Date())
    // 보류 판정 실패는 오류(기록 0 으로 삼키지 않는다) · 보류 시험 기록은 권한 · 보류 안내
    map = !mapData ? 'preparing' : mapData.heldGate === 'failed' ? 'error' : mapData.heldGate === 'held' ? 'withheld' : 'ok'
  } catch {
    map = 'error'
  }
  // 핵심 지도가 이미 고른 초점(목표가 없으면 지도 카드가 「목표 정하기」 를 먼저 보인다) — 홈은 다시 판정하지 않는다
  // 첫 제안 = 지도와 같은 판정(composeV4 → ActionRank) — 옛 읽기 7단계 초점으로 두 번째 판정을 하지 않는다(v6.2 §9.1)
  const focusKind: HomeFocusKind | null = mapData ? homeFocusOf(mapData).kind : null
  const slug = parseHomeReturn(from, item)
  const exam = slug ? exams.find((e) => e.exam_id === slug.slice(0, slug.lastIndexOf('-'))) : null
  const returned = slug ? { slug, label: exam ? `${exam.label} ${slug.slice(slug.lastIndexOf('-') + 1)}번` : '방금 본 문항' } : null
  // 지도 활동 복귀(v3 M1 후속) — 과제 · 학습 묶음 · 단계(형식만 검증 · 지도에 없으면 화면이 무시). 문항 복귀와 「이어서」 카드가 같은 문맥을 쓴다
  // 지도에서 하던 일 — 지도와 같은 순수 계산. 계산이 실패해도 홈은 열린다(첫 제안만 지도 초점으로)
  let progress: MapProgress | null = null
  if (map === 'ok' && mapData) {
    try {
      progress = mapProgressOf(mapData)
    } catch (e) {
      console.error('[csat-home map progress]', e)
    }
  }
  return <HomeLanding exams={exams} map={map} mapData={mapData} focusKind={focusKind} returned={returned} restore={restore} progress={progress} />
}
