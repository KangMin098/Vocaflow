// scripts/csat/drain-run.mjs
//
// **드레인 실행을 `csat_drain_runs` 에 남긴다.**
//
// ── 왜 있는가 (실측 2026-09-23) ─────────────────────────────────────────────
// 표(`20260923060100_csat_drain_runs.sql`)와 화면(`StageFrame.tsx` 의 `LastRun`)은
// 이미 있는데 **쓰는 쪽이 한 곳도 없었다.** 그래서 행이 0개였고, 화면은 「아직 안 돌렸다」만
// 말할 수 있었다. 여기가 그 빠진 칸이다.
//
// ── 두 가지를 절대 하지 않는다 ─────────────────────────────────────────────
// ① **기록 실패로 드레인을 죽이지 않는다.** 이건 계측이지 일이 아니다. 표가 없거나 권한이
//    없어도 본 작업은 끝까지 가야 한다 — 다만 stderr 에 반드시 적는다(조용히 삼키면
//    「기록이 없다」와 「안 돌았다」가 또 섞인다. 그게 애초에 이 표를 만든 이유다).
// ② **`items_skipped` 를 0 으로 채워 넣지 않는다.** null = 「안 셌다」이고 0 과 다르다.
//    0 은 「재실행인데 하나도 안 건너뛰었다」= 재실행 안전이 깨졌다는 신호다(2026-09-13
//    `analysis-drain-import` 가 802행을 더한 사고를 몇 달간 아무도 못 본 이유).
//
// ── 죽은 실행 ───────────────────────────────────────────────────────────────
// 프로세스가 중간에 죽으면 행은 `running` 인 채 남는다. 여기서 고치려 들지 않는다 —
// 읽는 쪽이 「너무 오래 running」을 판정한다(쓰는 쪽은 자기가 죽은 걸 쓸 수 없다).
// 대신 정상 종료 경로(`finish`)와 예외 경로를 `track()` 이 둘 다 덮는다.

const STAGES = new Set(['evidence', 'source', 'market', 'blueprint', 'material', 'author', 'explain', 'review', 'press'])
const MODES = new Set(['export', 'agent', 'validate', 'import', 'render'])

function warn(what, error) {
  // 표준 오류로만 낸다 — 드레인의 표준 출력은 대개 JSON 한 줄이고, 섞으면 파이프가 깨진다.
  process.stderr.write(`[drain-run] ${what}: ${error?.message ?? error}\n`)
}

/**
 * 실행을 연다. 돌려주는 핸들의 `finish` 를 반드시 부른다(또는 `track()` 을 쓴다).
 * 표가 없거나 쓰기가 막히면 **아무것도 안 하는 핸들**을 돌려준다 — 본 작업은 그대로 간다.
 *
 * @param db      supabase-js 클라이언트(service role)
 * @param stage   `csat_pipeline_approvals.stage` 와 같은 목록
 * @param script  저장소에 실제로 있는 경로. `scripts/` 로 시작해야 한다(표의 CHECK)
 * @param mode    export · agent · validate · import · render
 * @param args    화면에 그대로 보일 인자 문자열
 * @param runBy   누가 돌렸나. 기본은 환경의 `DRAIN_RUN_BY`, 없으면 'unknown'
 */
export async function startRun(db, { stage, script, mode, args = null, runBy = null }) {
  // 표의 CHECK 가 잡기 전에 여기서 잡는다 — 오타 하나로 드레인이 끝난 뒤에야
  // 「기록 실패」를 보는 것보다, 부르는 쪽에서 바로 틀린 걸 아는 편이 낫다.
  if (!STAGES.has(stage)) throw new Error(`Unknown drain stage: ${stage}`)
  if (!MODES.has(mode)) throw new Error(`Unknown drain mode: ${mode}`)
  if (!script.startsWith('scripts/')) throw new Error(`Drain script path must start with scripts/: ${script}`)

  let id = null
  let startedAt = null
  try {
    const inserted = await db.from('csat_drain_runs')
      .insert({ stage, script, mode, args, run_by: runBy ?? process.env.DRAIN_RUN_BY ?? 'unknown' })
      .select('id,started_at').single()
    if (inserted.error) throw inserted.error
    id = inserted.data.id
    startedAt = Date.parse(inserted.data.started_at)
  } catch (error) {
    warn('실행 기록을 열지 못했다(작업은 계속한다)', error)
  }

  let settled = false
  async function settle(patch) {
    if (settled) return
    settled = true
    if (!id) return
    /* ⚠️ **두 시각이 서로 다른 시계에서 온다.** `started_at` 은 DB 의 now(), 끝 시각은 이
     *   기계다. 실측(2026-09-23 첫 기록)에서 1.08초 **음수** 소요가 나왔다 — 화면이 「끝난 뒤에
     *   시작한 실행」을 그리게 된다. 시작 시각을 되읽어 그보다 앞서지 못하게 막는다.
     *   (DB 가 직접 찍게 하는 트리거가 정답이고, 그건 마이그레이션 승인 대기 중이다.
     *    트리거가 붙으면 이 값은 서버 시각으로 덮어써지고 이 바닥값은 무해해진다.) */
    const finishedAt = new Date(Math.max(Date.now(), startedAt ?? 0)).toISOString()
    try {
      const updated = await db.from('csat_drain_runs')
        .update({ finished_at: finishedAt, ...patch })
        .eq('id', id)
      if (updated.error) throw updated.error
    } catch (error) {
      warn('실행 기록을 닫지 못했다', error)
    }
  }

  return {
    id,
    /** 정상 종료. 센 수만 넘긴다 — 안 센 것은 넘기지 않는다(null 이 곧 「안 셌다」다). */
    finish: ({ total = null, done = null, skipped = null } = {}) =>
      settle({ status: 'ok', items_total: total, items_done: done, items_skipped: skipped }),
    /** 실패. 사유는 반드시 남는다(표의 CHECK 가 빈 사유를 거부한다). */
    fail: (error) =>
      settle({ status: 'failed', error: String(error?.stack ?? error?.message ?? error).slice(0, 4000) }),
  }
}

/**
 * `startRun` + 성공/실패 마감을 한 번에. 본체가 던지면 실패로 닫고 **그대로 다시 던진다** —
 * 계측이 오류를 삼키면 드레인이 실패해도 종료 코드가 0 이 된다.
 *
 * 본체는 `{ total, done, skipped }` 를 돌려주면 그대로 기록된다.
 */
export async function track(db, meta, body) {
  const run = await startRun(db, meta)
  try {
    const counts = await body(run)
    await run.finish(counts ?? {})
    return counts
  } catch (error) {
    await run.fail(error)
    throw error
  }
}
