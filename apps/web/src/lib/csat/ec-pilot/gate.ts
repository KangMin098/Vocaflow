// apps/web/src/lib/csat/ec-pilot/gate.ts
//
// G6 시작 게이트 — 서버에서 live 값을 읽어 run-gate.ts 규칙으로 판정한다(fail-closed · 읽기 전용).
//
// 두 모드(서로 배타):
//   · run        : 활성 run 메타(env CSAT_EC_ACTIVE_RUN — active-run.ts)가 있고 live 해시 · 설정 · env · 배포 빌드 커밋이 모두 맞을 때만 연다.
//                  수집 대상 시험은 run 의 exam ids 로 제한.
//   · verification: 활성 run 이 **없고** 서버 env CSAT_EC_PILOT_MODE=verification 일 때만. 참가자 env 에 있으면서 로그인 이메일이
//                   `@example.com`(PILOT_PROTOCOL §2 — 실제 참가자에서 제외되는 테스트 계정)인 계정에만 연다. 시험 제한 없음.
//     근거: e2e 52 · §18 마지막 smoke 는 production 빌드 + 개발 DB(= Pilot 이 쓰는 DB)에서 돌아 NODE_ENV · DB 로는 실제와 구별되지 않는다.
//     테스트 계정 도메인은 실제 참가자가 가질 수 없고(§2 제외), §12 가 run 데이터 혼입을 중단 기준으로 감시한다.
//     활성 run 이 있으면 verification 은 거부한다 — run 기간에 테스트 계정이 실제 v0.1 수집 경로를 열지 못하게.
//   · 그 외(메타 없음 · env 없음): 닫힘. 실제 v0.1 수집은 게이트 없이 열리지 않는다.
// 실패 항목은 서버 로그(`[csat-ec-gate]`)와 scripts/csat/pilot/start-check.mjs 로만 보인다 — 학습자 응답은 기존처럼 404.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createAdminClient } from '@/lib/supabase/admin'

import { activeRun, type ActiveRun } from './active-run'
import { EC_PILOT, pilotParticipants } from './config'
import { captureProbeConfig } from './probes'
import {
  PILOT_DETECTOR_VERSION, evaluateRunGate, examSeal, probeConfigHash,
  type ExamRow, type ExamSeal, type GateResult, type ItemRow, type KeyRow, type LiveState, type TrapRow,
} from './run-gate'

/**
 * 감지기 판 — DB 함수(csat_ec_detect_boundaries)의 c_version 상수와 같아야 한다(run-gate.test.ts 가 최신 마이그레이션 본문과 대조).
 * 앱은 함수 본문을 읽을 수 없으므로(DB 구조를 바꾸지 않는다) 저장소 상수로 대조하고, start-check.mjs 가 live 함수 본문을 매일 다시 확인한다.
 */
export const DETECTOR_VERSION = PILOT_DETECTOR_VERSION

export type PilotMode = 'run' | 'verification' | 'closed'

export function pilotMode(run: ActiveRun = activeRun(), env: string | undefined = process.env.CSAT_EC_PILOT_MODE): PilotMode {
  if (run.present) return env === undefined || env === '' || env === 'run' ? 'run' : 'closed'
  return env === 'verification' ? 'verification' : 'closed'
}

/** 운영자가 선언한 검증 커밋(env) · 플랫폼이 주입한 실제 빌드 커밋(운영자가 덮어쓰지 못한다) — 둘을 섞지 않는다 */
const envOf = (k: string): string | null => (process.env[k] ?? '').trim() || null
export const appCommitEnv = () => envOf('CSAT_EC_APP_COMMIT')
export const buildCommitEnv = () => envOf('VERCEL_GIT_COMMIT_SHA')

/** 한 시험의 live 봉인값(service role 읽기). 못 읽으면 null */
export async function liveExamSeal(admin: SupabaseClient, examId: string): Promise<ExamSeal | null> {
  const [ex, it, key] = await Promise.all([
    admin.from('csat_exams').select('id, organizer, source_note, item_count, listening_end').eq('id', examId).maybeSingle(),
    admin.from('csat_items').select('id, no, section, in_scope, type_id, stem, passage, choices, body_ok, raw_block').eq('exam_id', examId),
    admin.from('csat_dx_answer_key').select('no, answers, points').eq('exam_id', examId),
  ])
  if (ex.error || it.error || key.error || !ex.data || !(it.data ?? []).length || !(key.data ?? []).length) return null
  const items = it.data as ItemRow[]
  const tr = await admin.from('csat_dx_option_trap').select('item_id, option_no, trap_key, source, analysis_version').in('item_id', items.map((i) => i.id))
  if (tr.error) return null
  return examSeal(ex.data as ExamRow, items, key.data as KeyRow[], (tr.data ?? []) as TrapRow[])
}

async function readLive(meta: unknown, rls: SupabaseClient): Promise<LiveState> {
  const admin = createAdminClient() as unknown as SupabaseClient
  // taxonomy 사전은 authenticated 만 읽는다(service_role 은 표 권한 없음) — 쿠키 클라이언트
  const { data: tax, error: te } = await rls.from('csat_ec_taxonomy_version').select('status, note, definitions_hash').eq('version', EC_PILOT.taxonomyVersion).maybeSingle()
  const exams: Record<string, ExamSeal | null> = {}
  const list = meta && typeof meta === 'object' && Array.isArray((meta as { exams?: unknown }).exams) ? (meta as { exams: { examId?: unknown }[] }).exams : []
  for (const e of list) {
    if (typeof e?.examId === 'string') exams[e.examId] = await liveExamSeal(admin, e.examId).catch(() => null)
  }
  return {
    configTaxonomyVersion: EC_PILOT.taxonomyVersion,
    dbTaxonomy: te || !tax ? null : { status: tax.status as string, note: (tax.note as string | null) ?? null, definitionsHash: (tax.definitions_hash as string | null) ?? null },
    detectorVersion: DETECTOR_VERSION,
    probeCap: EC_PILOT.probeCapPerSession,
    probeConfigHash: probeConfigHash(captureProbeConfig(), EC_PILOT.probeCapPerSession),
    participantIdCount: pilotParticipants().size,
    appCommit: appCommitEnv(),
    buildCommit: buildCommitEnv(),
    exams,
  }
}

/**
 * run 모드 게이트 판정 — **요청마다 live 를 다시 읽는다**(캐시 없음: 봉인 해시가 바뀐 직후의 수집 요청도 닫혀야 한다).
 * Pilot 규모(참가자 ≤ 8 · 시험 2)에서 요청당 질의 ~10개. 실패 항목은 서버 로그로만.
 */
export async function runGate(rls: SupabaseClient, run: ActiveRun = activeRun()): Promise<GateResult> {
  if (!run.present) return { open: false, failures: ['meta:missing'], exams: [] }
  let result: GateResult
  try {
    result = evaluateRunGate(run.meta, await readLive(run.meta, rls))
  } catch (e) {
    result = { open: false, failures: [`live:error:${e instanceof Error ? e.message.slice(0, 80) : 'unknown'}`], exams: [] }
  }
  if (!result.open) {
    const id = run.meta && typeof run.meta === 'object' ? String((run.meta as { runId?: unknown }).runId ?? '?').slice(0, 40) : '?'
    console.error('[csat-ec-gate] 닫힘', id, result.failures.join(','))
  }
  return result
}
