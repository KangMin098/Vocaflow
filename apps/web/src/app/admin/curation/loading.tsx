// apps/web/src/app/admin/curation/loading.tsx
// LCP v2.0 Phase 12 묶음 D — admin curation 페이지 자동 loading

export default function AdminCurationLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-48 animate-pulse rounded-[var(--r-sm)] bg-[var(--bg2)]" />
        <div className="h-4 w-96 animate-pulse rounded-[var(--r-sm)] bg-[var(--bg2)]" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3"
          >
            <div className="h-3 w-16 animate-pulse rounded-[var(--r-sm)] bg-[var(--bg3)]" />
            <div className="h-7 w-12 animate-pulse rounded-[var(--r-sm)] bg-[var(--bg3)]" />
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-b border-[var(--bd)]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-10 w-32 animate-pulse rounded-t-[var(--r-sm)] bg-[var(--bg2)]"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex h-64 animate-pulse rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)]"
          />
        ))}
      </div>
    </div>
  );
}
