// scripts/ci/factory-i1-prerequisites.mjs
// Empty Supabase CI loses these two canonical helpers when known legacy migrations roll back.
// Restore only their versioned definitions/ACLs in the disposable CI DB. Never a production migration.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
const ROOT = path.resolve(import.meta.dirname, '../..')
export function sourceDirectory(root) {
  // CI archives the migration directory before starting an empty Supabase.
  const archive = path.join(root, 'supabase/_all_migrations')
  return fs.existsSync(archive) ? archive : path.join(root, 'supabase/migrations')
}
const read = (p) => fs.readFileSync(path.join(sourceDirectory(ROOT), p), 'utf8')
const admin = read('20260706010000_vrl_admin_read_policies.sql').match(/CREATE OR REPLACE FUNCTION is_admin\(\)[\s\S]*?GRANT EXECUTE ON FUNCTION is_admin\(\) TO authenticated;/)?.[0]
const eligible = read('20260924170000_eligibility_policy_v4_only.sql').match(/CREATE OR REPLACE FUNCTION public\.csat_source_is_eligible\(p_article_id uuid\)[\s\S]*?\$function\$;/)?.[0]
const eligibleAcl = read('20260918140000_csat_source_eligibility_cache.sql').match(/REVOKE ALL ON FUNCTION public\.csat_source_is_eligible\(uuid\) FROM PUBLIC;\s*GRANT EXECUTE ON FUNCTION public\.csat_source_is_eligible\(uuid\) TO authenticated, service_role;/)?.[0]
if (!admin || !eligible || !eligibleAcl) throw new Error('Canonical CI prerequisite definitions/ACLs not found')

export const prerequisiteSQL = `set local search_path = public, pg_catalog;
-- Preserve canonical SQL bodies even where the legacy article tables were never versioned.
-- Calling eligibility without those tables raises an error; it never silently returns true.
set local check_function_bodies = off;
do $ci$ begin
  if to_regprocedure('public.is_admin()') is null then execute $admin$${admin}$admin$; end if;
  if to_regprocedure('public.csat_source_is_eligible(uuid)') is null then execute $eligible$${eligible}\n${eligibleAcl}$eligible$; end if;
end $ci$;`

export function ciTargetAllowed(raw, env = process.env) {
  if (env.GITHUB_ACTIONS !== 'true' || env.CI !== 'true') return false
  try {
    const u = new URL(raw)
    return ['postgres:', 'postgresql:'].includes(u.protocol) && ['127.0.0.1', 'localhost'].includes(u.hostname)
      && u.port === '54322' && u.pathname === '/postgres' && !u.search && !u.hash
  } catch { return false }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const raw = (process.env.LOCAL_DB_URL ?? '').replace(/^"|"$/g, '')
  if (!ciTargetAllowed(raw)) throw new Error('CI_PREREQUISITES_BLOCKED: GitHub Actions disposable Supabase loopback:54322 only')
  try {
    execFileSync('psql', [raw, '-X', '-1', '-v', 'ON_ERROR_STOP=1'], { input: prerequisiteSQL, encoding: 'utf8', windowsHide: true })
    console.log('Factory I1 CI prerequisites restored from canonical migrations; no fixture tables or production history written')
  } catch {
    throw new Error('CI prerequisite recovery failed; connection information suppressed')
  }
}
