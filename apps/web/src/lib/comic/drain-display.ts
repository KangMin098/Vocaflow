// apps/web/src/lib/comic/drain-display.ts
// Explicit KST components keep server and browser output identical across ICU/timezone settings.
export function formatDrainTimestamp(iso: string): string {
  const timestamp = Date.parse(iso)
  if (!Number.isFinite(timestamp)) return '—'
  const kst = new Date(timestamp + 9 * 3600_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${kst.getUTCFullYear()}.${pad(kst.getUTCMonth() + 1)}.${pad(kst.getUTCDate())} ${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}:${pad(kst.getUTCSeconds())} KST`
}
