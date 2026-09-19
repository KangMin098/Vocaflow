// apps/web/src/app/(main)/diagnostic/page.tsx
// @form: 채색 지문 — 「알아요 / 몰라요」 답마다 지금까지의 답으로 본 수준에서 지문 칠이 다시 갈림 · 200ms (DiagnosticPassage)
//
// VRL Placement v1 진단 페이지 — 40문항 V-Level 측정
//
// 2026-09-19 화면 재설계(발산 A 「답할수록 칠해지는 지문」 · docs/design/compare/diagnostic.md · DD-23):
//   첫 시선이 그라디언트 히어로 카드였다(감사 평균). 이제 골격은 **낱말별 레벨이 매겨진 지문**이고,
//   답할수록 서버와 같은 규칙(`lib/diagnostic/interim-level.ts`)의 중간 추정으로 다시 칠해진다.
//   결과는 숫자 「V{n}」 이 아니라 **그 수준에서 이 글이 어떻게 보이는가 + 지금 읽을 수 있는 책 수**다
//   (전역 헤더가 약속한 「312권 중 읽을 수 있는 책」).
//
// 데이터는 새로 부르지 않는다 — 데모 지문은 랜딩과 같은 계산(`buildHeroDemo`), 레벨별 사정권은
// 셸이 쓰는 10분 캐시(`fetchLevelReach`)다.
//
// Phase 2 활용 시스템 진입점:
//   - 사용자 진단 → user_profiles.current_v_level 셋팅
//   - interests 선택 → specialty 단어장 추천
//   - WordVault hub 추천 카드 활성화 + Library Krashen i+1 weight

// 배럴 대신 파일 직접 — 배럴은 이 화면이 쓰지 않는 카드(떠오르는 hover)까지 트리에 싣는다(DD-22 후보)
import { Screen } from '@/components/ui/ios/Screen'
import { DiagnosticClient } from '@/components/diagnostic/DiagnosticClient'
import { fetchLevelReach, V_LEVEL_MAX, type LevelReach } from '@/lib/learner/library-reach'
import { buildHeroDemo } from '@/lib/marketing/hero-demo'

export const metadata = {
  title: '진단',
  description: '5분 진단으로 당신의 V-Level을 측정하고 맞춤 단어장을 추천받으세요.',
}

export default async function DiagnosticPage() {
  const levels = Array.from({ length: V_LEVEL_MAX }, (_, i) => i + 1)
  const [demo, ...reach] = await Promise.all([
    buildHeroDemo(),
    // 같은 분포(캐시)를 레벨마다 접을 뿐이다 — 쿼리는 캐시가 비었을 때 한 번
    ...levels.map((lv) => fetchLevelReach(lv).catch((): LevelReach | null => null)),
  ])

  return (
    <Screen width="full" background="bg2" padX="none">
      <DiagnosticClient
        passage={demo ? demo.tokens : null}
        reachByLevel={Object.fromEntries(
          levels.flatMap((lv, i) => (reach[i] ? [[lv, reach[i] as LevelReach]] : [])),
        )}
      />
    </Screen>
  )
}
