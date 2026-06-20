// apps/web/src/app/admin/articles/preview/[id]/loading.tsx
// ACP v1.1 — 글 검수 로딩 스켈레톤

export default function Loading() {
  return (
    <div className="p-6">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5">
        <div className="flex flex-col gap-3 border-b border-[var(--bd)] pb-4">
          <div className="h-4 w-24 animate-pulse rounded bg-[var(--bg2)]" />
          <div className="h-7 w-2/3 animate-pulse rounded bg-[var(--bg2)]" />
          <div className="h-4 w-40 animate-pulse rounded bg-[var(--bg2)]" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="order-2 h-[480px] animate-pulse rounded-[var(--r-md)] bg-[var(--bg2)] lg:order-1" />
          <div className="order-1 h-[280px] animate-pulse rounded-[var(--r-md)] bg-[var(--bg2)] lg:order-2" />
        </div>
      </div>
    </div>
  )
}
