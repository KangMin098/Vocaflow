// scripts/db/factory-i1/d3-baseline-query.mjs
// Prints read-only SQL. It never loads environment credentials or connects to a database.
import { CATALOG_SQL } from './catalog.mjs'
export const BASE_OBJECTS = [
  'factory_order',
  'workspace_content_demand',
  'workspace_content_demand_line',
  'learner_workspace',
  'learner_workspace_plan',
  'csat_map_goal_version',
  'user_profiles',
  'forbid_ledger_mutation',
]
export const BASELINE_SQL = `select coalesce(jsonb_agg(to_jsonb(c) order by k,name),'[]') as baseline from (${CATALOG_SQL}) c
where exists(select 1 from unnest(array[${BASE_OBJECTS.map((n) => `'public.${n}'`).join(',')}]) obj
  where name=obj or name like obj||'.%' or name like obj||'(%')`
if (process.argv[1]?.endsWith('d3-baseline-query.mjs')) process.stdout.write(BASELINE_SQL)
