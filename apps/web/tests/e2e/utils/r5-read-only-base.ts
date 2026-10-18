// apps/web/tests/e2e/utils/r5-read-only-base.ts
export function r5ReadOnlyBase(env: Record<string, string | undefined>): string {
  return env.R5_READ_ONLY_BASE_URL || `http://localhost:${env.R5_READ_ONLY_PORT || '3129'}`
}
