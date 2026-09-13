// apps/web/src/lib/video/components.ts
//
// **플랫폼 구성요소 목록 — "영상이 있어야 할 것" 의 분모.**
//
// 왜 앱이 다시 세나 (공장에도 같은 목록이 있는데):
//   공장(`packages/video-factory/src/catalog/build.ts`)은 **그날 뽑은 번들**을 센다. 번들은
//   커밋하지 않으므로(낡은 수치로 광고를 찍지 않기 위해서) **운영 환경에는 없다.**
//   그래서 Admin 이 공장의 목록을 읽을 수가 없다.
//
//   대신 여기서 **커밋된 원천**(유형 설명·시리즈 카탈로그·활동 레지스트리·장점)을 직접 센다.
//   그러면 둘의 차이가 곧 **"플랫폼은 자랐는데 영상은 아직"** 이 된다 — 그게 Admin 이
//   답해야 하는 질문이고, 공장의 `stale` 은 로컬에서만 답할 수 있는 질문이다.
//
// ⚠️ id 규칙은 여기서 짓지 않는다 — `@vocaflow/video-factory/ids` 하나가 정본이다.
//   앱과 공장이 각자 규칙을 적으면 갈리는데, 갈려도 **오류가 안 난다**(영상만 조용히 안 뜬다).

import 'server-only'

import { SERIES_CATALOG } from '@vocaflow/library-pipeline/textbook-series-catalog'
import {
  VIDEO_IDS,
  activityVideoId,
  benefitVideoId,
  seriesVideoId,
  typeVideoId,
} from '@vocaflow/video-factory/ids'

import { activities } from '@/lib/framework/registry'
import { DIFFERENTIATORS } from '@/lib/marketing/differentiators'
import { TYPE_GUIDE } from '@/lib/textbook/type-guide'

import { KIND_LABEL, type VideoKind } from './catalog'

/** 장점 영상의 슬러그 — 공장(`build.ts`)의 `BENEFIT_SLUG` 와 같은 순서여야 한다. */
const BENEFIT_SLUG = ['coverage', 'decay', 'minimum'] as const

export interface PlatformComponent {
  /** 있어야 할 영상 id. */
  id: string
  kind: VideoKind
  /** 화면에 쓰는 이름 — 구성요소의 실제 이름이지 영상 제목이 아니다. */
  name: string
  /** 이 구성요소가 어디서 왔는가 — 관리자가 "왜 이게 목록에 있나" 를 물을 때의 답. */
  source: string
}

/**
 * 지금 플랫폼에 있는 구성요소 전부. **이 목록이 길어지면 영상도 그만큼 있어야 한다.**
 *
 * 순서는 학습자·교사가 읽는 순서(무엇인가 → 왜 → 어떻게 → 무엇으로)를 따른다.
 */
export function platformComponents(): PlatformComponent[] {
  const out: PlatformComponent[] = [
    {
      id: VIDEO_IDS.intro,
      kind: 'intro',
      name: 'Vocaflow',
      source: '플랫폼 자체 — 한 편 고정',
    },
  ]

  DIFFERENTIATORS.forEach((d, i) => {
    out.push({
      id: benefitVideoId(BENEFIT_SLUG[i] ?? `n${i + 1}`),
      kind: 'benefit',
      name: d.title,
      source: 'lib/marketing/differentiators.ts',
    })
  })

  out.push({
    id: VIDEO_IDS.curriculum,
    kind: 'curriculum',
    name: '7단 커리큘럼',
    source: 'SERIES_SPINE (학령 사다리)',
  })

  for (const s of SERIES_CATALOG) {
    out.push({
      id: seriesVideoId(s.id),
      kind: 'series',
      name: s.brand,
      source: 'library-pipeline/textbook/series-catalog.ts',
    })
  }

  for (const [code, g] of Object.entries(TYPE_GUIDE).sort(([a], [b]) => a.localeCompare(b))) {
    out.push({
      id: typeVideoId(code),
      kind: 'type',
      name: g.label,
      source: 'lib/textbook/type-guide.ts',
    })
  }

  for (const a of activities()) {
    out.push({
      id: activityVideoId(a.id),
      kind: 'module',
      name: a.name,
      source: 'lib/framework/registry.ts',
    })
  }

  return out
}

/** 종류별 구성요소 수 — 화면의 분모. */
export function componentCountByKind(): Record<VideoKind, number> {
  const out = { intro: 0, benefit: 0, curriculum: 0, series: 0, type: 0, module: 0 } as Record<
    VideoKind,
    number
  >
  for (const c of platformComponents()) out[c.kind] += 1
  return out
}

export { KIND_LABEL }
