// apps/web/src/components/csat/diagnosis/map/study-av.ts
//
// T-0186 — 지도의 기출 해부 링크에 「지금 결속된 분석 판본」(map_av)을 싣는다. 문항 화면의 「학습 지도로」 가
//   그 값을 그대로 돌려주고(T-0167 map-return KEYS), 돌아온 지도는 「떠날 때와 지금 판본이 같은가」만 비교한다.
// 직렬화 · 형식 검증은 map-return 한 곳(withMapReturn → parseMapVersion: 1 이상 9자리 정수)만 쓴다 — 여기서 다시 만들지 않는다.
// 판본을 모르면(목록에 없음 · 형식 밖 · 과거 보기) 싣지 않는다. 지어낸 값 · 다른 문항의 값은 싣지 않는다.
import { withMapReturn } from '@/lib/csat/map-return'

/** 문항 ref(`2019#23`) → 지금 결속 분석 판본. 지도 자료가 실어 줄 때만 있다 */
export type StudyAnalysisVersions = Readonly<Record<string, number | null | undefined>>

/** 지도 자료(data.v4)에서 판본 목록을 읽는다 — 없으면 null(판본을 모른다) */
export function studyVersionsOf(v4: unknown): StudyAnalysisVersions | null {
  const raw = v4 && typeof v4 === 'object' ? (v4 as { studyAnalysisVersions?: unknown }).studyAnalysisVersions : undefined
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as StudyAnalysisVersions) : null
}

/**
 * 지도 문맥이 실린 문항 링크(`from=map`)에만 그 문항의 판본을 더한다. 다른 키(map_task · map_goal · map_ws · map_plan · ws · step)는 그대로.
 * 판본을 모르거나 형식 밖이면 링크를 바꾸지 않는다.
 */
export function studyHref(href: string, itemRef: string, versions: StudyAnalysisVersions | null): string {
  if (!versions || !href.startsWith('/csat/item/') || !/[?&]from=map(&|#|$)/.test(href)) return href
  const v = versions[itemRef]
  if (typeof v !== 'number' || !Number.isInteger(v)) return href
  return withMapReturn(href, { mapAv: String(v) })
}
