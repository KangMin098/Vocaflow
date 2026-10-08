// scripts/textbook/atomic-production-race-prepare.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const runId = process.argv[2];
if (!/^[a-f0-9-]{36}$/.test(runId ?? '')) throw new Error('Expected a UUID run ID');
const groupId = `atomic-race:${runId}`;
const sql = execFileSync(process.execPath,
  [fileURLToPath(new URL('./atomic-production-smoke-prepare.mjs', import.meta.url))],
  { encoding: 'utf8' }).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const marker = "  v_group text := 'atomic-group:' || gen_random_uuid()::text;";
if (!sql.includes(marker)) throw new Error('Group marker missing');
const approval = "  IF v_approved->>'approved_output_hash' <> v_output_hash THEN RAISE EXCEPTION 'approval failed'; END IF;";
const at = sql.indexOf(approval);
if (at < 0 || sql.indexOf(approval, at + 1) >= 0) throw new Error('Approval marker ambiguous');
const setup = sql.slice(0, at + approval.length).replace(marker, `  v_group text := '${groupId}';`);
process.stdout.write(`${setup}\nEND $smoke$;\nCOMMIT;\n`);
