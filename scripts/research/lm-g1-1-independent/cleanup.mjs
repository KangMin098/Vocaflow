// scripts/research/lm-g1-1-independent/cleanup.mjs
// Missing users require an explicit admin API user_not_found response, not an empty/error response.
export async function cleanupOwnedAccounts(admin, ids) {
  const errors = []
  let present = 0
  let unknown = 0
  for (const id of ids) {
    try {
      const result = await admin.deleteUser(id)
      if (result.error) errors.push('delete_failed')
    } catch {
      errors.push('delete_failed')
    }
    try {
      const result = await admin.getUserById(id)
      if (result.error?.status === 404 && result.error?.code === 'user_not_found') continue
      if (result.error || !result.data?.user) {
        unknown++
        errors.push('absence_unconfirmed')
      } else present++
    } catch {
      unknown++
      errors.push('absence_unconfirmed')
    }
  }
  return { ok: present === 0 && unknown === 0 && errors.length === 0, accountsLeft: unknown ? null : present, unknown, errors }
}
