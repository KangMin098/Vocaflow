// apps/web/src/lib/admin/dcp-admission.ts
//
// 1C 관리자 경계 — DCP 후보 등록 미리보기(읽기 전용)와 입고(관리자 로그인 세션 RPC).
//   · preview: service 클라이언트로 원천 현재 행을 SELECT 해 planAdmission 만 돌린다. RPC · 쓰기 없음.
//   · admit: 관리자 **세션** 클라이언트가 factory_dcp_admit → factory_dcp_qualify 를 호출한다(service_role 로 흉내내지 않는다).
//     real_admissible=false(합성 수요 · 합성 정책)는 RPC 전에 거절한다. 권리 unknown은 후보만 등록하고 자격은 보류한다.
//   · 미설치 RPC(PGRST202)는 not_installed 로 따로 돌려준다 — 실패 · 0건으로 섞지 않는다.

import type { SupabaseClient } from '@supabase/supabase-js'
import { SOURCE_POLICY_SELECT } from '@vocaflow/library-pipeline'

import type { AdmissionInput, AdmissionPlan } from '@/lib/csat/map/v62/factory-bridge/dcp-admission'
import {
  admitCandidates,
  previewAdmission,
  type AdmittedItem,
  type SourceReader,
  type SupplyClient,
} from '@/lib/csat/map/v62/factory-bridge/dcp-supply'

/** 정본 정책 투영(gate:csat_fit->gate · windows:csat_fit->make->windows) + 본문 · 출처 · 권리. raw csat_fit 은 읽지 않는다 */
export const CURRENT_SOURCE_SELECT = `${SOURCE_POLICY_SELECT},content,source,source_url,license`

/**
 * 원천 현재 행 — library_articles 한 행을 planAdmission 의 snapshot 모양(평평한 gate/windows/has_items)으로. now 는 경계에서 주입.
 * has_items = 같은 article 의 csat_dcp_items 가 **지금** 있는지(현재 보유 문항 정보 — 과거 이력 · 다른 kind 는 보지 않는다).
 * 조회 오류 · null count 는 false/0 으로 삼키지 않고 던진다.
 */
export function currentSourceReader(service: SupabaseClient, now: Date): SourceReader {
  return async (id) => {
    const [article, items] = await Promise.all([
      service.from('library_articles').select(CURRENT_SOURCE_SELECT).eq('id', id).maybeSingle(),
      service.from('csat_dcp_items').select('id', { head: true, count: 'exact' }).eq('kind', 'article').eq('ref_id', id),
    ])
    if (article.error) throw new Error(`source_read_failed:${article.error.code ?? ''}`)
    if (!article.data) return null
    if (items.error) throw new Error(`source_items_read_failed:${items.error.code ?? ''}`)
    if (typeof items.count !== 'number') throw new Error('source_items_count_unavailable')
    const data = article.data as unknown as Record<string, unknown>
    if ('csat_fit' in data) throw new Error('source_row_not_projected')
    return {
      snapshot_kind: 'read_only_database_export',
      current_time: now.toISOString(),
      row: { ...data, has_items: items.count > 0 },
    }
  }
}

export type PreviewResult =
  | { status: 'ok'; plan: AdmissionPlan; writes: 'not_performed' }
  | { status: 'rejected'; code: string; detail?: string }

export async function previewDcpAdmission(reader: SourceReader, input: Omit<AdmissionInput, 'currentSource'>): Promise<PreviewResult> {
  const r = await previewAdmission(reader, input)
  return r.ok ? { status: 'ok', plan: r.plan, writes: 'not_performed' } : { status: 'rejected', code: r.code, ...(r.detail ? { detail: r.detail } : {}) }
}

export type AdmitResult =
  | { status: 'ok'; items: AdmittedItem[]; release: 'not_performed'; delivery: 'not_performed' }
  | { status: 'not_installed' }
  | { status: 'rejected'; code: string; detail?: string }

/** 입고 — 관리자 세션 클라이언트(createClient)로만. 실패한 RPC 이름이 미설치면 not_installed */
export async function admitDcpCandidates(session: SupabaseClient, reader: SourceReader, input: Omit<AdmissionInput, 'currentSource'>): Promise<AdmitResult> {
  let missing = false
  const client: SupplyClient = {
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      const { data, error } = await session.rpc(fn, args)
      if (error?.code === 'PGRST202') missing = true
      return { data: (data ?? null) as T | null, error: error ? { message: error.message, code: error.code } : null }
    },
  }
  const r = await admitCandidates(client, reader, input)
  if (missing) return { status: 'not_installed' }
  return r.ok
    ? { status: 'ok', items: r.items, release: 'not_performed', delivery: 'not_performed' }
    : { status: 'rejected', code: r.code, ...(r.detail ? { detail: r.detail } : {}) }
}
