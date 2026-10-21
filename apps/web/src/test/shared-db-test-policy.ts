// apps/web/src/test/shared-db-test-policy.ts
/** Shared DB mutations require a deliberate local run; central/hosted CI never opts in. */
export function allowMutatingSharedDbTests(env: Readonly<Record<string, string | undefined>>): boolean {
  return !env.CI && env.RUN_MUTATING_DB_TESTS === '1'
}
