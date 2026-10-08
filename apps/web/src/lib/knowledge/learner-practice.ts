// apps/web/src/lib/knowledge/learner-practice.ts
// 학습자 과제 로더 — 배포 중인 설계만 학습자에게 열린다. 관리자는 미리보기(preview)로 상태와 무관하게 연다.
// 설계·배포 표는 service_role 전용이라 서버가 읽고, 학습자에게는 `learner_summary`·절차·막대만 넘긴다(관리자 용어·근거 등급 없음).
// 자기 수행 기록은 학습자 RLS 클라이언트로 읽는다(knowledge_task_runs_own_select).
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { loadItemSkeleton, skeletonSiblings } from '@/lib/csat/skeleton'
import { buildClaimTask, type ClaimTask, type SkeletonItemLike } from './practice'
import { LEARNER_MODULES, isLearnerModuleKey, parseProcedure, type ProcedureStep } from './vnext'

function admin(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient
}

export interface PracticeDesign {
  id: string
  slug: string
  title: string
  learnerSummary: string
  procedure: ProcedureStep[]
  moduleKey: 'csat_claim_evidence'
  trainTypeIds: string[]
  transferTypeIds: string[]
  version: number
  /** 열린 배포 — 미리보기에서는 null 일 수 있다 */
  deploymentId: string | null
  deploymentVersion: number | null
  status: string
}

/**
 * 설계를 읽는다. 학습자: 배포 중 + 열린 배포가 있을 때만. 미리보기: 있으면 연다(상태 무관).
 * 배포 버전과 현재 버전이 다르면(있을 수 없다 — 배포 중 내용 변경은 DB 가 막는다) 학습자에게 열지 않는다.
 */
export async function loadPracticeDesign(slug: string, opts: { preview: boolean }): Promise<PracticeDesign | null> {
  if (!/^[a-z0-9][a-z0-9-]{1,80}$/.test(slug)) return null
  const db = admin()
  const { data, error } = await db
    .from('knowledge_designs')
    .select('id,slug,title,learner_summary,procedure,module_key,train_type_ids,transfer_type_ids,version,status')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(`설계 읽기 실패: ${error.message}`)
  if (!data || !isLearnerModuleKey(data.module_key)) return null
  const { data: dep, error: de } = await db
    .from('knowledge_deployments')
    .select('id,design_version')
    .eq('design_id', data.id)
    .is('ended_at', null)
    .maybeSingle()
  if (de) throw new Error(`배포 읽기 실패: ${de.message}`)
  const live = data.status === 'deployed' && dep && Number(dep.design_version) === Number(data.version)
  if (!live && !opts.preview) return null
  return {
    id: String(data.id),
    slug: String(data.slug),
    title: String(data.title),
    learnerSummary: String(data.learner_summary),
    procedure: parseProcedure(data.procedure),
    moduleKey: data.module_key,
    trainTypeIds: (data.train_type_ids as string[]) ?? [],
    transferTypeIds: (data.transfer_type_ids as string[]) ?? [],
    version: Number(data.version),
    deploymentId: live ? String(dep!.id) : null,
    deploymentVersion: live ? Number(dep!.design_version) : null,
    status: String(data.status),
  }
}

export interface PoolEntry {
  itemId: string
  no: number
  examLabel: string
  typeId: string
  phase: 'train' | 'transfer'
}

/** 과제 문항 풀 — 골격에 정답 근거 문장이 있는 문항만. 최근 회차부터. */
export function practicePool(d: Pick<PracticeDesign, 'trainTypeIds' | 'transferTypeIds' | 'moduleKey'>): PoolEntry[] {
  const allowed = LEARNER_MODULES[d.moduleKey].typeIds
  const out: PoolEntry[] = []
  const add = (types: string[], phase: 'train' | 'transfer') => {
    for (const t of types.filter((x) => allowed.includes(x))) {
      for (const s of skeletonSiblings(t)) {
        const sk = loadItemSkeleton(s.id) as unknown as SkeletonItemLike | null
        if (!sk || !buildClaimTask(sk)) continue
        out.push({ itemId: s.id, no: s.no, examLabel: s.exam_label, typeId: t, phase })
      }
    }
  }
  add(d.trainTypeIds, 'train')
  add(d.transferTypeIds.filter((t) => !d.trainTypeIds.includes(t)), 'transfer')
  return out.sort((a, b) => b.itemId.localeCompare(a.itemId) || a.no - b.no)
}

export function taskFor(itemId: string): ClaimTask | null {
  const sk = loadItemSkeleton(itemId) as unknown as SkeletonItemLike | null
  return sk ? buildClaimTask(sk) : null
}

export interface MyRun {
  itemId: string
  phase: 'train' | 'transfer'
  claimHit: boolean | null
  optionCorrect: boolean | null
  at: string
}

/**
 * 내 기록(RLS) — 이 설계·이 버전의 실학습 기록, 문항마다 첫 시도만(정답을 본 뒤 다시 낸 것은 판정에 넣지 않는다).
 * 실학습 화면에는 실기록만, 관리자 미리보기 화면에는 그 관리자의 미리보기 기록만 — 둘은 섞이지 않는다
 * (미리보기도 학습자와 같은 집계·추천 흐름을 돌려 보게 하려는 것. 효과 계산은 어느 쪽이든 미리보기를 넣지 않는다).
 */
export async function loadMyRuns(designId: string, version: number, opts: { preview: boolean } = { preview: false }): Promise<{ userId: string | null; runs: MyRun[] }> {
  const db = (await createClient()) as unknown as SupabaseClient
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return { userId: null, runs: [] }
  const { data, error } = await db
    .from('knowledge_task_runs')
    .select('item_id,phase,claim_hit,option_correct,created_at,preview,synthetic')
    .eq('design_id', designId)
    .eq('user_id', user.id)
    // 재배포로 버전이 바뀌면 새로 시작한다 — 옛 버전 기록으로 완료·판정을 이어받지 않는다
    .eq('design_version', version)
    .order('created_at')
    .limit(1000)
  if (error) throw new Error(`내 기록 읽기 실패: ${error.message}`)
  const first = new Set<string>()
  return {
    userId: user.id,
    runs: ((data ?? []) as Record<string, unknown>[])
      .filter((r) => r.synthetic !== true && (r.preview === true) === opts.preview)
      .filter((r) => (first.has(String(r.item_id)) ? false : (first.add(String(r.item_id)), true)))
      .map((r) => ({
        itemId: String(r.item_id),
        phase: r.phase === 'transfer' ? 'transfer' : 'train',
        claimHit: (r.claim_hit as boolean | null) ?? null,
        optionCorrect: (r.option_correct as boolean | null) ?? null,
        at: String(r.created_at),
      })),
  }
}

/** 정답 선지 — 판정에만 쓰고 학습자에게는 맞음/틀림으로만 돌려준다. */
export async function answerOf(itemId: string): Promise<number | null> {
  const { data, error } = await admin().from('csat_items_public').select('answer').eq('id', itemId).maybeSingle()
  if (error) throw new Error(`정답 읽기 실패: ${error.message}`)
  const a = data?.answer
  return typeof a === 'number' ? a : null
}

export async function insertRun(row: {
  userId: string
  design: PracticeDesign
  preview: boolean
  itemId: string
  phase: 'train' | 'transfer'
  response: Record<string, unknown>
  claimHit: boolean
  optionCorrect: boolean | null
  confidence: number
  sec: number
}): Promise<void> {
  const { error } = await admin()
    .from('knowledge_task_runs')
    .insert({
      user_id: row.userId,
      design_id: row.design.id,
      design_version: row.preview ? row.design.version : row.design.deploymentVersion,
      deployment_id: row.preview ? null : row.design.deploymentId,
      item_id: row.itemId,
      phase: row.phase,
      response: row.response,
      claim_hit: row.claimHit,
      option_correct: row.optionCorrect,
      confidence: row.confidence,
      sec: row.sec,
      preview: row.preview,
    })
  if (error) throw new Error(error.code === '23514' || error.code === 'P0001' ? (error.message ?? '기록 거부') : `기록 실패: ${error.message}`)
}
