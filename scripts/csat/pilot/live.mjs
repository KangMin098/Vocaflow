// scripts/csat/pilot/live.mjs
//
// G6 게이트의 live 값 읽기(운영 점검 · 봉인 공용) — **읽기 전용 트랜잭션**으로만 질의한다(DB 쓰기 없음).
// 해시 · 판정 규칙은 앱과 같은 파일(apps/web/src/lib/csat/ec-pilot/run-gate.ts)을 node 타입 제거 실행으로 그대로 쓴다.
// pg 모듈: 저장소 의존성이 아니다 — 전역/로컬 설치가 없으면 env CSAT_PG_MODULE_DIR(그 아래 node_modules/pg 가 있는 디렉터리)로 지정한다.

import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { rulesHash } from '../error-evidence/model-input/deidentify.mjs'
import { captureProbeConfig } from '../../../apps/web/src/lib/csat/ec-pilot/probes.ts'
import { examSeal, probeConfigHash, sha256 } from '../../../apps/web/src/lib/csat/ec-pilot/run-gate.ts'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
export const RUNS = path.join(ROOT, 'docs/csat-learner/pilot-runs')
const DEV_REF = 'jajenrevcbmrpaliomxv'

export async function loadPg() {
  try { return (await import('pg')).default } catch {
    const dir = process.env.CSAT_PG_MODULE_DIR
    if (!dir) throw new Error('pg 모듈이 없다 — env CSAT_PG_MODULE_DIR 에 pg 가 설치된 디렉터리를 준다')
    return createRequire(path.join(dir, 'noop.js'))('pg')
  }
}

/** 앱 설정(config.ts)의 probeCapPerSession — config.ts 는 server-only 라 import 하지 못해 소스에서 읽는다 */
export function configProbeCap() {
  const src = fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/csat/ec-pilot/config.ts'), 'utf8')
  const m = src.match(/probeCapPerSession:\s*(null|[0-9]+)\s*,/)
  if (!m) throw new Error('config.ts 에서 probeCapPerSession 을 찾지 못했다')
  return m[1] === 'null' ? null : Number(m[1])
}
export function configTaxonomy() {
  const src = fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/csat/ec-pilot/config.ts'), 'utf8')
  return src.match(/taxonomyVersion:\s*'([^']+)'/)?.[1] ?? null
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const participantIdCount = (env = process.env.CSAT_EC_PILOT_USER_IDS) =>
  new Set((env ?? '').split(',').map((x) => x.trim().toLowerCase()).filter((x) => UUID.test(x))).size

export const fileSha256 = (p) => sha256(fs.readFileSync(p, 'utf8'))
export { rulesHash }

/** live 상태(LiveState + db) — 시험은 examIds 만 */
export async function readLive(examIds, { appCommit }) {
  const url = process.env.SUPABASE_DB_URL
  if (!url) throw new Error('SUPABASE_DB_URL 없음 — --env-file 로 실행')
  if (!url.includes(DEV_REF)) throw new Error(`Pilot DB(${DEV_REF})가 아니다`)
  const pg = await loadPg()
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await c.connect()
  try {
    await c.query('begin transaction read only')
    const tax = configTaxonomy()
    const t = (await c.query('select status, note, definitions_hash from public.csat_ec_taxonomy_version where version = $1', [tax])).rows[0]
    const fn = (await c.query(`select pg_get_functiondef('public.csat_ec_detect_boundaries(uuid, smallint, uuid)'::regprocedure) d`)).rows[0]?.d ?? ''
    const detector = fn.match(/c_version constant text := '(bd-[0-9.]+)'/)?.[1] ?? null
    const mig = (await c.query('select max(version) v, count(*)::int n from supabase_migrations.schema_migrations')).rows[0]
    const exams = {}
    for (const id of examIds) {
      const ex = (await c.query('select id, organizer, source_note, item_count, listening_end from public.csat_exams where id = $1', [id])).rows[0]
      const items = (await c.query('select id, no, section, in_scope, type_id, stem, passage, choices, body_ok, raw_block from public.csat_items where exam_id = $1', [id])).rows
      const key = (await c.query('select no, answers, points from public.csat_dx_answer_key where exam_id = $1', [id])).rows
      const traps = (await c.query('select item_id, option_no, trap_key, source, analysis_version from public.csat_dx_option_trap where item_id = any($1)', [items.map((i) => i.id)])).rows
      exams[id] = ex && items.length && key.length ? examSeal(ex, items, key, traps) : null
    }
    await c.query('rollback')
    const cap = configProbeCap()
    return {
      configTaxonomyVersion: tax,
      dbTaxonomy: t ? { status: t.status, note: t.note, definitionsHash: t.definitions_hash } : null,
      detectorVersion: detector,
      probeCap: cap,
      probeConfigHash: probeConfigHash(captureProbeConfig(), cap),
      participantIdCount: participantIdCount(),
      appCommit: appCommit ?? null,
      exams,
      db: mig ? { latestMigration: mig.v, migrationCount: mig.n } : null,
    }
  } finally {
    await c.end()
  }
}
