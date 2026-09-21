// apps/web/src/components/library/shared/ShelfEmptyState.tsx
//
// 서가의 **막다른 화면을 없애는** 한 조각 — 빈 서가 · 필터 0건 · 조회 실패 공용.
//
// ── 왜 한 곳에 모으나 (실측 2026-09-05) ─────────────────────────────────
// 라이브러리·만화 슬라이스의 빈 상태 네 곳이 서로 다른 모양으로 **전부 막다른 길**이었다:
//   · `/library/books`   — 이모지 + 제목 한 줄. 링크도 버튼도 없다.
//   · `/library/scripts` — 문장 두 줄. 다음 걸음 없음.
//   · `/library/vocab`   — 필터가 0건을 만들었을 때도 같은 죽은 상자. 되돌릴 버튼이 없어
//                          카테고리 칩을 잘못 누른 사람이 빠져나오지 못한다.
//   · `/comics/restored` — 바로 위 `NotReady()` 는 `/library/books` 링크를 가졌는데
//                          `Empty()` 만 링크가 빠졌다.
// CLAUDE.md D4: "빈 상태에 **다음 한 걸음**이 반드시 있다 — 막다른 화면 = 이탈".
//
// 결은 이 저장소에서 가장 잘 된 빈 상태를 따른다 —
// `components/game/scriptquiz/ScriptQuizQueue.tsx` 의 `AllCaughtUp`:
//   상황을 세 갈래로 갈라 각각 다른 문구와 CTA 를 주고, 비난하지 않고 맥락을 말한다
//   (Empathetic Feedback). 폭죽·트로피는 두지 않는다(철학 ④).
//
// ── 「없다」와 「못 읽었다」를 가른다 ────────────────────────────────────
// 조회가 실패했을 때 "아직 게시된 도서가 없어요" 를 보여 주면 재고 312권이 그대로인데
// 화면이 0을 말한다. 오류 로그도 화면 신호도 없어 아무도 못 잡는다. `tone="error"` 는
// 그 상태를 **다른 문구·다른 색·다시 시도 버튼**으로 갈라 놓는다.

'use client'

import { SpotState, type SpotArt } from '@/components/ui/SpotState'

export interface ShelfEmptyStateProps {
  /** 'empty' = 재고가 없다 · 'filtered' = 조건이 걸렀다 · 'error' = 못 읽었다 */
  tone?: 'empty' | 'filtered' | 'error'
  title: string
  /** 한 문단. 왜 비었는지 + 지금 할 수 있는 일. */
  body: string
  /** 다음 한 걸음 — 링크(있으면 항상 그린다). */
  ctaHref?: string
  ctaLabel?: string
  /** 되돌리기 — 필터 초기화·다시 시도처럼 화면 안에서 끝나는 동작. */
  onAction?: () => void
  actionLabel?: string
}

// DD-68 · tines-mapping §14 — 참조 빈 결과 문법(가운데 소품 · 세리프 제목 · 알약). 세 경우가 **다른 그림**이다:
//   비었다 = 빈 책장 · 조건이 걸렀다 = 돋보기 · 못 읽었다 = 뽑힌 플러그(서가가 빈 게 아니라는 것을 그림도 말한다)
const TONE_ART: Record<NonNullable<ShelfEmptyStateProps['tone']>, SpotArt> = {
  empty: 'empty-shelf',
  filtered: 'search',
  error: 'offline',
}

export function ShelfEmptyState({
  tone = 'empty',
  title,
  body,
  ctaHref,
  ctaLabel,
  onAction,
  actionLabel,
}: ShelfEmptyStateProps) {
  return (
    <SpotState
      art={TONE_ART[tone]}
      role={tone === 'error' ? 'alert' : 'status'}
      title={title}
      body={body}
      primary={ctaHref && ctaLabel ? { href: ctaHref, label: ctaLabel } : undefined}
      secondary={onAction && actionLabel ? { onClick: onAction, label: actionLabel } : undefined}
    />
  )
}
