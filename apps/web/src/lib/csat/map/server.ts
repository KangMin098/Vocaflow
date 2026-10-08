// apps/web/src/lib/csat/map/server.ts
//
// 학습 지도 쓰기 — 목표 점수 · 과제 완료. 학습자는 이 테이블을 직접 쓰지 못하고(RLS 읽기만) 서버가 service role 로 쓴다.
// userId 는 로그인 세션에서만 온다. 검증은 입력 형식(parse*)과 DB 제약(0~100 · 복합 PK · FK)이 이중으로 막는다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { parseGoal, parseTaskId } from './payload'

export class MapInputError extends Error {}

export async function setGoal(db: SupabaseClient, userId: string, body: unknown): Promise<{ goal: number }> {
  const goal = parseGoal(body)
  if (goal === null) throw new MapInputError('목표 점수는 0~100 사이 정수예요')
  const { error } = await db.from('csat_map_goal').upsert({ user_id: userId, target_score: goal, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) throw new Error(`목표 저장 실패: ${error.message}`)
  return { goal }
}

/** 과제 완료를 켠다(멱등) — 없는 과제 id 는 FK 위반으로 거절 */
export async function checkTask(db: SupabaseClient, userId: string, rawId: string): Promise<void> {
  const taskId = parseTaskId(rawId)
  if (!taskId) throw new MapInputError('과제 번호 형식이 맞지 않아요')
  const { error } = await db.from('csat_map_task_done').upsert({ user_id: userId, task_id: taskId }, { onConflict: 'user_id,task_id', ignoreDuplicates: true })
  if (error) {
    if (error.code === '23503') throw new MapInputError('없는 과제예요')
    throw new Error(`과제 체크 실패: ${error.message}`)
  }
}

/** 과제 완료를 끈다(멱등 — 이미 꺼져 있어도 성공) */
export async function uncheckTask(db: SupabaseClient, userId: string, rawId: string): Promise<void> {
  const taskId = parseTaskId(rawId)
  if (!taskId) throw new MapInputError('과제 번호 형식이 맞지 않아요')
  const { error } = await db.from('csat_map_task_done').delete().eq('user_id', userId).eq('task_id', taskId)
  if (error) throw new Error(`과제 체크 해제 실패: ${error.message}`)
}
