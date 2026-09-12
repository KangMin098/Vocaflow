// apps/web/src/app/admin/loading.tsx
//
// Admin 전용 로딩 경계.
//
// 없을 때: admin 화면 대부분이 `dynamic = 'force-dynamic'` 서버 컴포넌트라 집계 질의가
// 끝날 때까지 **직전 화면이 그대로 얼어 있는다.** 관리자는 클릭이 먹었는지 몰라 다시
// 누르고, 무거운 집계가 두 번 돈다. 골격을 즉시 그려 "받는 중" 을 보이면 그 재클릭이 없다.
//
// 하위 디렉터리에 더 좁은 loading.tsx 가 있으면 그쪽이 우선한다 (curation 등).
//
// 애니메이션은 `animate-pulse` 하나 — 학습 화면이 아니라 예산 밖이지만, 루프 모션을
// 금지한 이유(주의 강탈)는 여기도 같아서 요소 수를 줄이고 진폭을 낮게 둔다.

export default function AdminLoading() {
  return (
    <div className="p-6 sm:p-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">불러오는 중</span>

      {/* 헤더 골격 — AdminPageHeader 와 같은 자리 */}
      <div className="mb-6 flex items-center gap-3">
        <div className="h-9 w-9 shrink-0 animate-pulse rounded-[var(--r-md)] bg-[var(--bg3)]" />
        <div className="min-w-0 flex-1">
          <div className="h-2.5 w-24 animate-pulse rounded-[var(--r-sm)] bg-[var(--bg3)]" />
          <div className="mt-2 h-5 w-56 animate-pulse rounded-[var(--r-sm)] bg-[var(--bg3)]" />
        </div>
      </div>

      {/* KPI 골격 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[84px] animate-pulse rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)]"
          />
        ))}
      </div>

      {/* 본문 골격 */}
      <div className="mt-4 space-y-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-11 animate-pulse rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]"
          />
        ))}
      </div>
    </div>
  )
}
