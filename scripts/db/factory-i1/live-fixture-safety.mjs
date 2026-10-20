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
export function liveFixtureEmail(run) {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(run)) throw new Error('Expected fixture run UUID')
  // Existing application + demand-statistics synthetic domain; never count a live check as a real signup.
  return `d3-live-${run}@vocaflow.dev`
}
function registrationIdentity(command, run) {
  const entry = {
    product_order_id: command.order.product_order_id, order_revision: command.order.order_revision,
    order_hash: command.order_hash, request_key: command.request_key, command,
  }
  assertOwnedProduct(entry.product_order_id, run)
  if (command.action !== 'register' || !Number.isInteger(entry.order_revision) || entry.order_revision < 1 ||
      !/^[0-9a-f]{64}$/.test(entry.order_hash) || !entry.request_key) throw new Error('Invalid fixture registration identity')
  return entry
}
export async function sendOwnedRegistration({ command, run, registrations, persist, send }) {
  const entry = registrationIdentity(command, run)
  const key = `${entry.product_order_id}:${entry.order_revision}`
  const previous = registrations.get(key)
  registrations.set(key, entry)
  // A durable write-ahead record is required even when the server commits but its response is lost.
  try { persist() }
  catch (error) {
    if (previous) registrations.set(key, previous)
    else registrations.delete(key)
    throw error
  }
  return send(command)
}
export async function reconcileOwnedRegistration({ entry, run, actor, settle, lookup, withdraw }) {
  assertOwnedProduct(entry.product_order_id, run)
  const identity = registrationIdentity(entry.command, run)
  for (const key of ['product_order_id', 'order_revision', 'order_hash', 'request_key']) {
    if (identity[key] !== entry[key]) throw new Error('Journal command mismatch; do not replay')
  }
  // Same full-body UUID replay settles even a late original request before withdrawal.
  await settle(entry.command)
  const row = await lookup(entry)
  if (!row) throw new Error('Registration settlement missing; cleanup remains incomplete')
  for (const key of ['product_order_id', 'order_revision', 'order_hash', 'request_key']) {
    if (row[key] !== entry[key]) throw new Error('Registration identity mismatch; do not withdraw')
  }
  if (row.registered_by !== actor) throw new Error('Registration actor mismatch; do not withdraw')
  if (row.is_current === false) return 'already_inactive'
  if (row.is_current !== true) throw new Error('Registration current state unknown')
  await withdraw(entry)
  return 'withdrawn'
}
export async function runCleanupSteps(steps) {
  const errors = []
  for (const [name, operation] of steps) {
    try { await operation() }
    catch (error) { errors.push({ name, message: error instanceof Error ? error.message : 'unknown cleanup failure' }) }
  }
  return errors
}
