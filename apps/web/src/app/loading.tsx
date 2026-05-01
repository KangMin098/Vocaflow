// apps/web/src/app/loading.tsx

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="페이지 로딩 중"
      className="flex min-h-screen items-center justify-center bg-[var(--bg2)]"
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--bg3)] border-t-[var(--p)]"
        style={{ animationDuration: '0.7s' }}
        aria-hidden="true"
      />
    </div>
  )
}
