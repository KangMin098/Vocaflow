// apps/web/src/lib/csat/map/v62/__tests__/supply-sql-harness.ts
//
// v6.2 P-F7b/c — 보류 마이그레이션(C → B)을 **격리된 Postgres(PGlite, 프로세스 안 WASM)** 에 적용해 본다.
// 개발 DB 에 닿지 않는다. 의존 객체(auth · Workspace · 목표 · PLAN · DCP 문항 · 권한 함수)는 실제 정의의 최소 사본(스텁)이다.
// ⚠️ 한계: 연결이 하나라 진짜 동시 트랜잭션은 못 만든다 — 동시성은 「낡은 기대 상태 → 충돌」 · 고유 인덱스로 순차 검증한다.
import fs from 'node:fs'
import path from 'node:path'

import { PGlite } from '@electric-sql/pglite'

const MIG = path.resolve(__dirname, '../../../../../../../../supabase/migrations')
export const C_SQL = fs.readFileSync(path.join(MIG, '_pending_workspace_supply_c_qualification.sql'), 'utf8')
export const B_SQL = fs.readFileSync(path.join(MIG, '_pending_workspace_supply_b_orders.sql'), 'utf8')

/** 실제 스키마의 최소 사본 — `supply-stub.sql`(동시성 스크립트와 공유) */
export const STUB = fs.readFileSync(path.join(__dirname, 'supply-stub.sql'), 'utf8')

export async function openSupplyDb(opts: { withB?: boolean } = {}): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(STUB)
  await db.exec(C_SQL)
  if (opts.withB !== false) await db.exec(B_SQL)
  // Factory I1 회귀: SUPPLY_I1_OVERLAY=1 이면 B 위에 I1 safety · P 를 올려 B 의 기존 시험을 그대로 다시 돌린다
  if (opts.withB !== false && process.env.SUPPLY_I1_OVERLAY === '1') {
    await db.exec(fs.readFileSync(path.join(__dirname, 'supply-i1-stub.sql'), 'utf8'))
    await db.exec(fs.readFileSync(path.join(MIG, '_pending_workspace_supply_i1_safety.sql'), 'utf8'))
    await db.exec(fs.readFileSync(path.join(MIG, '_pending_workspace_supply_i1_partial.sql'), 'utf8'))
  }
  return db
}

/** 이 세션의 auth.uid() 를 바꾼다(null = 로그아웃) */
export async function as(db: PGlite, uid: string | null): Promise<void> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ''])
}

/** 오류 메시지(없으면 null) — 기대한 거절인지 문자열로 본다 */
export async function errorOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p
    return null
  } catch (e) {
    return (e as Error).message
  }
}

/** 산출물 현재 revision(SQL supply_artifact_revision) — 자격을 실제 내용에 묶을 때 쓴다 */
export async function revOf(db: PGlite, kind: string, ref: string): Promise<string | null> {
  return (await db.query<{ r: string | null }>(`select public.supply_artifact_revision($1, $2) r`, [kind, ref])).rows[0]!.r
}

export const AXES = (o: Partial<Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H', string>> = {}) =>
  Object.fromEntries((['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const).map((k) => [k, { state: o[k] ?? 'pass' }]))
