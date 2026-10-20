// scripts/db/factory-i1/live-fixture-safety.mjs
// Ownership and bounded cleanup for explicitly authorized synthetic live checks.
export function assertLiveFixtureOptIn(argv, env) {
  if (!argv.includes('--run-owned-fixture') || env.VF_D3_LIVE_APPROVED !== '1' || (env.CI && env.CI !== 'false'))
    throw new Error('Explicit owned-fixture opt-in required; CI is forbidden')
}
export function assertOwnedFixture(user, expectedId, run) {
  if (!user || user.id !== expectedId || user.user_metadata?.e2e_run !== run || user.user_metadata?.synthetic !== true)
    throw new Error('Fixture ownership mismatch; do not change this account')
}
export function assertOwnedProduct(id, run) {
  if (typeof id !== 'string' || !id.startsWith(`D3-LIVE-${run}-`))
    throw new Error('Product does not belong to this exact fixture run')
}
export async function runCleanupSteps(steps) {
  const errors = []
  for (const [name, operation] of steps) {
    try { await operation() }
    catch (error) { errors.push({ name, message: error instanceof Error ? error.message : 'unknown cleanup failure' }) }
  }
  return errors
}
