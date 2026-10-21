// scripts/db/check-anon-rpc-grants.mjs
//
// **anon 이 실행할 수 있는 SECURITY DEFINER 함수 목록을 양방향으로 고정한다.**
//
// 왜 필요한가 — 2026-09-20 에 기본 권한을 고쳤다(마이그레이션 20260919231528·232557).
// 그 전까지 public 스키마의 새 함수는 두 경로로 anon 에게 열렸다:
//   ① 전역 기본값의 `PUBLIC EXECUTE`  ② Supabase 의 스키마별 `anon=X` 명시 GRANT
// 둘 다 닫았고, 그래서 **위험의 방향이 하나 더 생겼다**:
//
//   조치 전 위험: 새 함수가 아무도 모르게 anon 에 열린다 (발견 111 · 160 · 161 · video_job_*)
//   조치 후 위험: anon 이 **의도적으로** 호출해야 하는 RPC 가 GRANT 를 빠뜨려 조용히 막힌다
//                (funnel_events_allow_anonymous · peek_class_by_code 계열. 브라우저에서만 터진다)
//
// 한쪽만 막는 가드는 다른 쪽을 키운다. 그래서 이 스크립트는 **늘어난 것과 줄어든 것을 똑같이** 잡는다.
// 기준선을 올려 통과시키지 말 것 — 기준선 변경은 사람이 보고 `--update` 로 남기는 행위다.
//
// 어디서 읽나 — 새 RPC 를 만들지 않는다. db_health 수집기가 이미 매일
// `db_health_metrics(axis='advisor', metric='exposed_secdef_funcs').dims.anon_funcs` 에
// 그 목록을 적는다(마이그레이션 20260906011000). 여기서 그걸 읽어 비교만 한다.
//
// 한계(알고 쓰는 것) — 수집기 모수가 `prosecdef` 참인 함수라, SECURITY INVOKER 함수는 안 본다.
//   anon 이 부르는 RPC 는 사실상 전부 SECURITY DEFINER 라 실무상 구멍은 아니지만,
//   "이 스크립트가 통과 = 모든 anon 권한이 정상" 이 아니라 "정의자 권한 함수 목록이 그대로다" 이다.
//
// 실행:
//   node scripts/db/check-anon-rpc-grants.mjs            # 어긋나면 exit 1
//   node scripts/db/check-anon-rpc-grants.mjs --update   # 기준선을 현재 DB 로 다시 적는다
//   (TLS 1.3 이 막힌 망이면 `node --tls-max-v1.2 ...` — AGENTS.md 「하지 말 것」 참조)
//
// 재실행 안전: 읽기만 한다(`--update` 만 파일을 고친다). DB 는 절대 안 고친다.

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const BASELINE = path.resolve('scripts/db/anon-executable-functions.json')
const UPDATE = process.argv.includes('--update')

/**
 * `apps/web/.env.local` 후보들. 앞의 것이 이기고, **이미 있는 process.env 는 안 덮는다.**
 *
 * ⚠️ **워크트리에는 `.env.local` 이 없다** (실측 2026-09-20). `scripts/worktree.mjs` 는 env 를
 *   다루지 않고 `.env*` 는 gitignore 라, `pnpm wt new` 로 만든 트리에서 이 가드는 exit 2 로
 *   "판정하지 않음" 이 된다. 판정을 거부하는 것 자체는 맞지만(조용히 통과하는 것보다 낫다),
 *   AGENTS.md 가 장기 병행 작업을 워크트리로 밀고 있어서 **가드가 거기서 못 도는 건 가드가 없는 것과 같다.**
 *   그래서 주 워크트리의 것을 fallback 으로 찾는다 — `--git-common-dir` 이 `<주 트리>/.git` 이다.
 */
function envCandidates() {
  const here = path.resolve('apps/web/.env.local')
  try {
    const common = execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim()
    const mainTree = path.dirname(path.resolve(common))
    return [here, path.join(mainTree, 'apps/web/.env.local')]
  } catch {
    // git 이 없거나 저장소 밖이면 현재 트리만 본다. 여기서 죽을 이유는 없다.
    return [here]
  }
}

async function main() {
  // --- 접속 (저장소 관례: apps/web/.env.local 을 직접 읽는다 — 값은 출력하지 않는다) ---
  for (const envPath of envCandidates()) {
    if (!fs.existsSync(envPath)) continue
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\r/g, '')
    }
  }
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다.')
    console.error(`  찾아본 곳: ${envCandidates().join(' · ')}`)
    return 2
  }
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(url, key, { auth: { persistSession: false } })

  const { data, error } = await db
    .from('db_health_metrics')
    .select('measured_at, dims')
    .eq('axis', 'advisor')
    .eq('metric', 'exposed_secdef_funcs')
    .order('measured_at', { ascending: false })
    .limit(1)

  // ⚠️ 오류를 빈 목록으로 삼키면 "전부 사라졌다" 는 거짓 경보가 되거나, 더 나쁘게는
  //    `--update` 가 기준선을 통째로 비운다. 못 읽으면 판정하지 않는다(exit 2).
  if (error) {
    console.error(`db_health_metrics 를 못 읽었다: ${error.message || '(message 없음)'}`)
    return 2
  }
  if (!data || data.length === 0) {
    console.error('advisor/exposed_secdef_funcs 측정이 하나도 없다 — 수집기가 돈 적이 있는지 확인할 것.')
    return 2
  }

  const measuredAt = data[0].measured_at
  const live = [...new Set(data[0].dims?.anon_funcs ?? [])].sort()

  if (live.length === 0) {
    console.error('anon_funcs 가 비어 있다 — 측정이 실패했을 때도 이 모양이라 판정하지 않는다.')
    return 2
  }

  if (UPDATE) {
    const payload = {
      note: 'anon 이 EXECUTE 할 수 있는 public 스키마 SECURITY DEFINER 함수. 손으로 고치지 말 것 — --update 로만.',
      measured_at: measuredAt,
      functions: live,
    }
    fs.writeFileSync(BASELINE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    console.log(`기준선 갱신: ${live.length}개 (측정 ${measuredAt})`)
    return 0
  }

  if (!fs.existsSync(BASELINE)) {
    console.error(`기준선이 없다: ${BASELINE} — 먼저 --update 로 만들 것.`)
    return 2
  }
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
  const expected = [...new Set(base.functions ?? [])].sort()

  const added = live.filter((f) => !expected.includes(f))
  const removed = expected.filter((f) => !live.includes(f))

  if (added.length === 0 && removed.length === 0) {
    console.log(`anon 실행 가능 정의자 함수 ${live.length}개 — 기준선과 일치 (측정 ${measuredAt})`)
    return 0
  }

  if (added.length > 0) {
    console.error(`\n[늘었다] anon 에 새로 열린 함수 ${added.length}개 — 의도한 것인가?`)
    console.error('  기본 권한은 anon 을 막는다. 열렸다면 마이그레이션에 명시 GRANT 가 있다는 뜻이다.')
    for (const f of added) console.error(`  + ${f}`)
  }
  if (removed.length > 0) {
    console.error(`\n[줄었다] anon 이 못 부르게 된 함수 ${removed.length}개 — 화면이 조용히 깨진다`)
    console.error('  새 마이그레이션이 GRANT EXECUTE ... TO anon 을 빠뜨렸을 가능성이 가장 높다.')
    for (const f of removed) console.error(`  - ${f}`)
  }
  console.error(`\n확인 후 의도한 변화면: node scripts/db/check-anon-rpc-grants.mjs --update (커밋에 포함)`)
  return 1
}

// ⚠️ **`process.exit()` 로 끝내면 Windows 에서 exit 127 이 된다** (실측 2026-09-20).
//   supabase-js 의 keep-alive 소켓이 아직 닫히는 중일 때 강제 종료하면 libuv 가
//   `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` 로 죽는다. 종료 코드가 127 이면
//   가드가 "실패" 도 "통과" 도 아닌 것이 되어 게이트로 못 쓴다 — 실패를 놓치는 쪽으로 조용히 망가진다.
//   그래서 코드를 **반환**하고 exitCode 만 세운 뒤 이벤트 루프가 스스로 비도록 둔다.
process.exitCode = await main()
