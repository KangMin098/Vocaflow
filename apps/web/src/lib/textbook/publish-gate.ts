// apps/web/src/lib/textbook/publish-gate.ts
//
// 학습자 교재 화면의 **발행 게이트**(2026-10-14 · v6.2 P-F4a). 권(series × step)의 목차 · 미리보기 · 단어 목록 · 연습은
// `textbook_volume_renders.status = 'published'` 인 권에서만 보인다 — 발행 결정(`/admin/csat/press` → csat_pipeline_approvals)이 정본.
// 감사(P-F0)에서 학습자 화면이 이 상태를 읽지 않아 「조판만 된 미승인 권」의 목차가 보일 수 있었다.
// 그 표는 관리자 RLS 라 학습자 세션으로 못 읽는다 → 서버 컴포넌트가 서버 키로 **상태만** 읽는다(쓰기 없음 · DB 변경 없음).
// 읽기에 실패하면 막는다(fail-closed) — 발행 여부를 모르면 내용을 내보내지 않는다.
//
// 범위 밖(문서 · 승인 대상): 연습 RPC `textbook_practice_items` 는 권이 아니라 V레벨 · 출처 적격성 문항 풀을 돌려준다 —
// 권 발행과 묶으려면 RPC 변경(승인안 A). 이 게이트는 권 화면 · 연습 화면 진입을 막는다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createAdminClient } from '@/lib/supabase/admin'

export type PublishState = 'published' | 'unpublished' | 'unknown'

export interface PublishGate {
  /** 그 시리즈에서 발행된 단계 */
  published: ReadonlySet<number>
  /** 상태를 읽지 못했다 — 전부 막는다 */
  failed: boolean
}

/** 순수 판정 — 읽기 실패면 unknown(막는다), 발행 집합에 있으면 published */
export function stateOf(gate: PublishGate, step: number): PublishState {
  if (gate.failed) return 'unknown'
  return gate.published.has(step) ? 'published' : 'unpublished'
}

/** 학습자에게 권 내용 · 연습을 보여도 되는가 — published 일 때만 */
export const canShow = (s: PublishState) => s === 'published'

export async function loadPublishGate(seriesId: string, db?: SupabaseClient): Promise<PublishGate> {
  try {
    const client = db ?? (createAdminClient() as unknown as SupabaseClient)
    const { data, error } = await client.from('textbook_volume_renders').select('band, status').eq('series', seriesId).eq('status', 'published')
    if (error) {
      console.error('[textbook publish gate]', error.message)
      return { published: new Set(), failed: true }
    }
    return { published: new Set((data ?? []).map((r: { band: number | string }) => Number(r.band)).filter(Number.isFinite)), failed: false }
  } catch (e) {
    console.error('[textbook publish gate]', e)
    return { published: new Set(), failed: true }
  }
}

export const PUBLISH_STATE_NOTE: Record<Exclude<PublishState, 'published'>, string> = {
  unpublished: '이 권은 아직 발행 전이에요. 발행되면 목차 · 미리보기 · 연습이 열려요.',
  unknown: '이 권의 발행 상태를 지금 확인하지 못했어요. 잠시 뒤 다시 열어 주세요.',
}
