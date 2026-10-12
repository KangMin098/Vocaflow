// scripts/csat/meaning-support-isolated-gate-fault.mjs
//
// **게이트 고장 주입 — 일회용 격리 DB 전용.** CI job `e2e-gate-faultclosed` 가 정본 마이그레이션 · seed 뒤에 부른다.
//
//   VOCAFLOW_CSAT_ISOLATED_NAMESPACE=csat-v31 VOCAFLOW_CSAT_ISOLATED_RUN_ID=<run>-<attempt> \
//   VOCAFLOW_CSAT_ISOLATED_DB_URL=<러너 로컬 DB URL> NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/csat/meaning-support-isolated-gate-fault.mjs --mode absent            # dry-run — 가드 + 계획만
//     node scripts/csat/meaning-support-isolated-gate-fault.mjs --mode absent --commit   # 적용
//
// mode absent = Reveal Gate 서비스 RPC 셋(csat_ec_embargoed_items · csat_ec_embargoed_exams · csat_ec_reveal_state)을 DROP 한다(진짜 부재).
//   앱 플래그 · 가짜 RPC 없음 — 앱의 fail-closed(RPC 오류 = 보류)를 실제 오류로 확인하기 위한 것.
// 가드(항상 먼저 · psql/클라이언트 전): seed 와 같은 환경 가드(namespace · run ID · API loopback:54321) + DB URL 이 postgres(ql)://loopback:54322.
//   seed 의 소유 marker 가 같은 namespace/run 이어야 한다(그 러너가 만든 DB 라는 결속). 하나라도 어긋나면 거부 · 쓰기 0. 키 · URL 원문은 출력하지 않는다.
// 재실행 안전: 예(DROP FUNCTION IF EXISTS). 되돌리기: 러너 폐기 — 이 스크립트는 공유 DB 에서 돌 수 없다(가드).

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { SeedRefusal, fileMarkerIo, guardEnv, isMissingRpc } from './meaning-support-isolated-seed.mjs'

export const MODES = Object.freeze(['absent'])
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

export const ABSENT_SQL = [
  'begin;',
  'drop function if exists public.csat_ec_embargoed_items(text[]);',
  'drop function if exists public.csat_ec_embargoed_exams(text[]);',
  'drop function if exists public.csat_ec_reveal_state(uuid);',
  'commit;',
  "notify pgrst, 'reload schema';",
].join('\n')

/** DB URL 가드 — 로컬 Supabase DB(loopback:54322)만 */
export function guardDbUrl(raw) {
  if (!raw) throw new SeedRefusal('VOCAFLOW_CSAT_ISOLATED_DB_URL 미설정')
  let u
  try {
    u = new URL(raw)
  } catch {
    throw new SeedRefusal('VOCAFLOW_CSAT_ISOLATED_DB_URL 을 해석할 수 없다')
  }
  if (u.protocol !== 'postgresql:' && u.protocol !== 'postgres:') throw new SeedRefusal('DB URL 이 postgres 가 아니다')
  if (!LOOPBACK.has(u.hostname)) throw new SeedRefusal('DB host 가 loopback 이 아니다 — 원격 · 공유 DB 거부')
  if (u.port !== '54322') throw new SeedRefusal('DB port 가 54322(로컬 Supabase DB)가 아니다')
  return raw
}

export function guardMode(mode) {
  if (!MODES.includes(mode)) throw new SeedRefusal(`--mode 는 ${MODES.join('|')} 중 하나`)
  return mode
}

/** seed 의 소유 marker 가 이 run 의 것이어야 한다 */
export function guardOwner(marker, { namespace, runId }) {
  if (!marker) throw new SeedRefusal('seed 소유 marker 없음 — 이 러너의 격리 DB 라는 결속이 없다')
  if (marker.namespace !== namespace || marker.runId !== runId) throw new SeedRefusal('다른 namespace/run 의 소유 marker — 중단')
}

/**
 * @param deps.psql (dbUrl, sql) => { status, stderr } — 테스트가 주입한다
 * @param deps.makeClient () => supabase client(검증용 rpc)
 */
export async function runFault({ env, argv, markerIo = fileMarkerIo(), psql, makeClient, log = () => {} }) {
  const g = guardEnv(env)
  const mi = argv.indexOf('--mode')
  const mode = guardMode(mi >= 0 ? argv[mi + 1] : undefined)
  const dbUrl = guardDbUrl(env.VOCAFLOW_CSAT_ISOLATED_DB_URL)
  guardOwner(markerIo.read(), g)
  log(`계획: mode=${mode} — 게이트 RPC 3개 DROP(일회용 격리 DB)`)
  if (!argv.includes('--commit')) return { mode: 'dry-run' }
  const r = psql(dbUrl, ABSENT_SQL)
  if (r.status !== 0) throw new Error(`psql 실패(exit ${r.status}): ${String(r.stderr ?? '').split('\n').find((l) => /ERROR/.test(l)) ?? ''}`)
  // 진짜 부재인지 — PostgREST 가 스키마를 다시 읽을 때까지 잠깐 기다리며 확인
  const client = await makeClient(g)
  for (let i = 0; i < 20; i += 1) {
    const a = await client.rpc('csat_ec_embargoed_items', { p_items: ['2026#34'] })
    if (a.error && isMissingRpc(`${a.error.code ?? ''} ${a.error.message ?? ''}`)) return { mode: 'committed', verified: true }
    await new Promise((res) => setTimeout(res, 500))
  }
  throw new Error('DROP 뒤에도 csat_ec_embargoed_items 가 응답한다 — 고장 주입 실패')
}

async function main() {
  const r = await runFault({
    env: process.env,
    argv: process.argv.slice(2),
    log: (m) => console.log(m),
    psql: (dbUrl, sql) => spawnSync('psql', [dbUrl, '-q', '-X', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' }),
    makeClient: async (g) => {
      const { createClient } = await import('@supabase/supabase-js')
      return createClient(g.url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    },
  })
  console.log(r.mode === 'dry-run' ? 'dry-run — DB 에 쓰지 않았다. 적용은 --commit.' : '게이트 RPC 부재 확인(fail-closed 검증 준비 완료)')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`${e.name === 'SeedRefusal' ? '거부' : '실패'}: ${e.message}`)
    process.exit(1)
  })
}
