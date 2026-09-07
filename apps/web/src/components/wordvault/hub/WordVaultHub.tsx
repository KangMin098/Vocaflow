// apps/web/src/components/wordvault/hub/WordVaultHub.tsx
//
// WordVault 허브 v06.36 — iOS/iPadOS 감성 + 단어 관점 종합 포트폴리오.
//
// iOS HIG 핵심:
//   · 그레이 캔버스 (bg2) 위에 떠있는 흰 카드 (24px radius + soft shadow)
//   · 거대한 hero 숫자 + Activity Ring + 캡슐
//   · iOS Settings 인셋 그룹 list (탭 segment control)
//   · App Store 카드 가로 스크롤
//
// 6 Section 구조:
//   1. VaultIdentity        — Activity Ring + 거대 숫자 + 4 bucket + CTA
//   2. VocabularyLevelMap   — V-Level 캡슐 막대 + 트랙별 인셋 list
//   3. FacetProgressSection — 면 상태 + 가장 뒤처진 면 하나
//   4. ResourcePortfolio    — 도서/스크립트/단어장 (세그먼트 + 인셋 list)
//   5. RecommendedBooks     — App Store 가로 스크롤 카드
//   6. NextStepList         — 추천 단어장 인셋 list + 컬러 type 캡슐
//   7. FlowStripe           — Stats 캡슐 + 28일 캡슐 막대
//
// ── 2026-09-05 — 이 컴포넌트는 이제 **조회를 하지 않는다** ─────────────
// 여섯 섹션이 각자 `auth.getUser()` + 테이블을 치던 것을 `lib/wordvault/hub-query.ts`
// 하나로 접었다(서버에서 한 번). 여기서는 받은 값을 나눠 줄 뿐이다.
// 그 덕에 **서버 HTML 에 실제 수치가 남는다** — 예전 첫 화면은 스켈레톤뿐이었다.

import type { FacetSummary } from '@/lib/framework/word-progress-query'
import type { HubData } from '@/lib/wordvault/hub-query'

import { FacetProgressSection } from './FacetProgressSection'
import { FlowStripe } from './FlowStripe'
import { NextStepList } from './NextStepList'
import { RecommendedBooks } from './RecommendedBooks'
import { ResourcePortfolio } from './ResourcePortfolio'
import { VaultIdentity } from './VaultIdentity'
import { VocabularyLevelMap } from './VocabularyLevelMap'
import { WordVaultEmptyState } from './WordVaultEmptyState'

interface WordVaultHubProps {
  /** 서버가 한 번에 접어 준 허브 데이터. `state !== 'ready'` 면 null 이다. */
  data: HubData | null
  /** 면 요약 — 실패해도 나머지 섹션은 그대로 뜬다. */
  facets: FacetSummary | null
  /**
   * "아직 못 셌다" 와 "세어보니 0" 은 다른 것이다.
   * 그 구별이 없어서 목업이 실수치 자리에 앉아 있던 적이 있다(실측 2026-08-15:
   * 실제 252개인 계정이 "13 단어" 를 보고 있었다).
   */
  state: 'unauthenticated' | 'error' | 'ready'
}

export function WordVaultHub({ data, facets, state }: WordVaultHubProps) {
  // 규칙: 못 세었으면 못 세었다고 말한다. 그럴듯한 숫자를 지어내지 않는다.
  if (state !== 'ready' || !data) {
    // 실패를 침묵하지 않는다. Empathetic Feedback — 학습자 잘못이 아니라는 것과
    // 지금 무엇을 해도 되는지를 말한다.
    return (
      <div className="mx-auto max-w-[820px] px-4 py-10 md:px-6">
        <p
          role="status"
          className="rounded-ios-2xl bg-[var(--bg)] px-5 py-6 text-center font-body text-[13.5px] leading-[1.7] text-[var(--t2)] shadow-ios-1 [word-break:keep-all]"
        >
          {state === 'unauthenticated'
            ? '로그인하면 내 단어장이 여기 나타나요.'
            : '지금 단어장을 세지 못했어요. 잠시 뒤 다시 열어 주세요 — 단어가 사라진 건 아니에요.'}
        </p>
      </div>
    )
  }

  if (data.total === 0) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-10 md:px-6 md:py-14">
        <WordVaultEmptyState />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-4 py-6 md:px-6 md:py-8">
      {/* Section 1 — Identity Hero: 자산 + V-Level + 4 bucket + 주간 목표 + 단일 CTA */}
      <VaultIdentity
        total={data.total}
        buckets={data.buckets}
        collections={data.collectionsCount}
        accumulatedDays={data.accumulatedDays}
        weeklyDone={data.weeklyDone}
        weeklyTarget={data.weeklyTarget}
        vLevel={data.currentVLevel}
      />

      {/* Section 2 — Vocabulary Level Map: V-Level 분포 + i+1 zone + 트랙 */}
      <VocabularyLevelMap data={data.levelMap} />

      {/* Section 3 — 면(facet) 상태 + 가장 뒤처진 면 하나 (설계안 §2.3).
          레벨 맵이 "어디까지 왔나" 라면 이쪽은 "어느 쪽으로 아는가" 다.
          준비 전/실패 시에는 렌더하지 않는다 — 빈 카드가 자리만 차지하는 것보다 낫다. */}
      {facets && facets.total > 0 && <FacetProgressSection summary={facets} />}

      {/* Section 4 — Resource Portfolio: 도서 / 스크립트 / 공용 단어장 학습 이력 */}
      <ResourcePortfolio
        books={data.resources.books}
        scripts={data.resources.scripts}
        sets={data.resources.sets}
      />

      {/* Section 5 — Recommended Books: i+1 권장 도서 */}
      <RecommendedBooks books={data.recommendedBooks} vLevel={data.currentVLevel} />

      {/* Section 6 — Next Step (단어장 추천): recommend_word_sets_for_user */}
      <NextStepList
        sets={data.recommendedSets}
        status={data.recommendedSetsStatus}
        vLevel={data.currentVLevel}
      />

      {/* Section 7 — Flow: 28일 sparkline + 마지막 활동 */}
      <FlowStripe days={data.flow.days} lastActivity={data.flow.lastActivity} />
    </div>
  )
}
