// apps/web/src/app/admin/curation/preview/[bookId]/loading.tsx

export default function AdminPreviewLoading() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="h-6 w-48 animate-pulse rounded-[var(--r-sm)] bg-[var(--bg2)]" />
      <div className="h-[calc(100vh-180px)] animate-pulse rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)]" />
    </div>
  );
}
