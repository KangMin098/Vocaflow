// apps/web/src/app/api/csat/state/route.ts
//
// GET /api/csat/state → 내 해부 기록(DissectionRecord v1) 또는 null
// PUT /api/csat/state { record } → 서버 사본과 **항목 단위로 합쳐** 저장(`continuity.mergeDissection`)
//   통째로 덮으면 탭 둘 · 기기 둘 중 늦게 쓴 쪽이 다른 쪽의 학습을 지운다(2026-09-25 시나리오 C3 에서 실측).
//
// 기기(IndexedDB)가 먼저다. 이 경로가 막히거나 표가 아직 없어도 학습은 기기 기록으로 돈다 —
// 그래서 실패는 전부 `ok:false` 한 줄로 돌려주고, 부르는 쪽은 조용히 기기 기록을 쓴다.
//
// Reveal Gate(2026-10-06): 로그인 확인은 쿠키 클라이언트로, 읽기 · 쓰기는 **서버(service role)** 로 한다 —
// ②(20261005170100)가 csat_learner_state 의 학습자 직접 읽기 · 쓰기를 회수한다. 행은 언제나 로그인한 본인(user.id)의 것만 만진다.
// GET 은 보류 시험(오답 원인 Pilot 수집 중) 문항의 정오 칸(예측 · 초안)을 빼고 내보낸다(embargo-gate · 판정 실패면 전부 뺀다).

import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { correctnessItemIds, mergeDissection, withoutHeldCorrectness } from '@/lib/csat/continuity'
import type { DissectionRecord } from '@/lib/csat/dissect'
import { itemRevealDecision, revealHeldResponse } from '@/lib/csat/embargo-gate'
import { authoredNoteBindingOk } from '@/lib/csat/authored/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 900_000
const NO_STORE = { 'cache-control': 'no-store' }

async function session() {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()
  // `Database` 타입에 새 표가 아직 없다 — record/route.ts 와 같은 완화(한 줄)
  return { db: user ? (createAdminClient() as unknown as SupabaseClient) : null, user, learner: auth as unknown as SupabaseClient }
}

/**
 * FI-011 C — 창작 교수 자료의 자기 설명 노트는 서버가 결속(본인 · 지금 유효한 교수 납품 · 현재 주석 hash)을 확인한 것만 받는다.
 * 서버 사본과 같은(id · updatedAt) 노트는 다시 검사하지 않는다 — 결속이 나중에 무효가 돼도 과거 노트는 지우지 않는다(병합은 합집합).
 * 검증 실패 노트는 들어온 기록에서만 뺀다(쓴 글은 기기에 남는다). 기출 노트는 그대로.
 */
async function withVerifiedAuthoredNotes(incoming: DissectionRecord, existing: unknown, db: SupabaseClient, learner: SupabaseClient, userId: string): Promise<DissectionRecord> {
  const notes = incoming.reasoningNotes ?? []
  if (!notes.some((x) => typeof x?.item === 'string' && x.item.startsWith('authored:'))) return incoming
  const prev = new Map(((looksLikeRecord(existing) ? (existing as unknown as DissectionRecord).reasoningNotes : undefined) ?? []).map((x) => [x.id, x.updatedAt]))
  const keep = await Promise.all(notes.map(async (x) => {
    if (typeof x?.item !== 'string' || !x.item.startsWith('authored:')) return true
    if (prev.get(x.id) === x.updatedAt) return true
    return authoredNoteBindingOk(db, learner, userId, x.item, x.authored).catch(() => false)
  }))
  return { ...incoming, reasoningNotes: notes.filter((_, i) => keep[i]) }
}

/** 모양만 본다 — 내용 규칙은 코드(continuity)에 있다. 원문이 실릴 자리는 없다. */
function looksLikeRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const r = value as Record<string, unknown>
  return (
    r.version === 1 &&
    Array.isArray(r.predictions) &&
    Array.isArray(r.formulas) &&
    Array.isArray(r.queue) &&
    Array.isArray(r.completed) &&
    typeof r.seed === 'number' &&
    typeof r.onboarded === 'boolean'
  )
}

export async function GET() {
  const { db, user } = await session()
  if (!user || !db) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  const { data, error } = await db.from('csat_learner_state').select('record').eq('user_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 503, headers: NO_STORE })
  const record = (data as { record: unknown } | null)?.record ?? null
  if (record === null) return NextResponse.json({ ok: true, record: null }, { headers: NO_STORE })
  // 모양을 검증할 수 없는 기록은 거를 수도 없다 — 원문을 내지 않고 공통 423(fail-closed)
  if (!looksLikeRecord(record)) return revealHeldResponse()
  const rec = record as unknown as DissectionRecord
  const { held, failed } = await itemRevealDecision(correctnessItemIds(rec))
  // 관문 판정 실패 — 기록을 내보내지 않고 공통 423(기기 기록으로 계속 돈다)
  if (failed) return revealHeldResponse()
  if (!held.size) return NextResponse.json({ ok: true, record: rec }, { headers: NO_STORE })
  const stripped = withoutHeldCorrectness(rec, (id) => held.has(id))
  // 진행 세트를 뺀 사본이 기기 사본보다 새 것으로 보이면 기기 병합(새 쪽의 active 를 가져감)이 기기의 세트를 지운다(P2) —
  // 뺀 사본은 updatedAt 0 으로 내보내 기기 쪽이 언제나 새 것이 되게 한다(합집합 필드는 그대로 합쳐진다)
  // updatedAt 을 낮추면 보류와 무관한 최신 초안 · 복습까지 밀린다(Codex P2) — 대신 「뺐다」는 표시만 붙여 기기 병합이 세트를 지키게 한다
  const out = rec.active && !stripped.active ? { ...stripped, activeWithheld: true as const } : stripped
  return NextResponse.json({ ok: true, record: out }, { headers: NO_STORE })
}

export async function PUT(req: Request) {
  const { db, user, learner } = await session()
  if (!user || !db) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  const text = await req.text()
  if (text.length > MAX_BYTES) return NextResponse.json({ ok: false, error: 'too-large' }, { status: 413 })
  let record: unknown
  let owner: unknown
  try {
    const body = JSON.parse(text) as { record?: unknown; owner?: unknown }
    record = body.record
    owner = body.owner
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 })
  }
  // T-0172 공용 기기 — 기기 기록이 다른 계정 소유로 표시돼 있으면 이 계정 행에 합치지 않는다(재전송 안 하는 403).
  //   소유자 표시가 없는 요청(배포 전 열린 탭)은 기존대로 받는다 — 새 클라이언트는 계정별 키의 기록만 소유자와 함께 보낸다
  if (owner !== undefined && owner !== user.id) return NextResponse.json({ ok: false, error: 'owner-mismatch' }, { status: 403 })
  if (!looksLikeRecord(record)) return NextResponse.json({ ok: false, error: 'bad-record' }, { status: 400 })
  // FI-015(#308) — 읽기 → 병합 → 쓰기를 비교 갱신(updated_at CAS) 한 번으로 묶는다. 두 기기가 같은 옛 사본을 읽고 각자 덮으면 한쪽 노트가 사라졌다.
  //   쓰기 직전 행이 바뀌었으면(다른 요청이 먼저 씀) 쓰지 않고 409 — 성공 응답은 「합친 결과가 서버에 남았다」는 뜻이다.
  //   재시도는 클라이언트(session/store.ts)가 잠시 뒤 같은 기기 기록으로 다시 보내고, 서버는 그때 최신 사본과 다시 합친다.
  //   서버 안 재시도 루프는 두지 않는다(요청 하나 = 쓰기 하나 · row-write-budget)
  const incoming = record as unknown as DissectionRecord
  const current = await db.from('csat_learner_state').select('record, updated_at').eq('user_id', user.id).maybeSingle()
  if (current.error) return NextResponse.json({ ok: false, error: current.error.message }, { status: 503 })
  const row = current.data as { record: unknown; updated_at: string | null } | null
  const merged = await mergeForWrite(await withVerifiedAuthoredNotes(incoming, row?.record, db, learner, user.id), row?.record)
  const at = nextStamp(row?.updated_at ?? null)
  if (!row) {
    const ins = await db.from('csat_learner_state').insert({ user_id: user.id, record: merged, updated_at: at })
    if (!ins.error) return NextResponse.json({ ok: true })
    // 다른 요청이 먼저 만들었다 — 이 기록은 아직 안 합쳐졌다
    if (ins.error.code === '23505') return NextResponse.json({ ok: false, error: 'conflict' }, { status: 409 })
    return NextResponse.json({ ok: false, error: ins.error.message }, { status: 503 })
  }
  let upd = db.from('csat_learner_state').update({ record: merged, updated_at: at }).eq('user_id', user.id)
  upd = row.updated_at === null ? upd.is('updated_at', null) : upd.eq('updated_at', row.updated_at)
  const { data, error } = await upd.select('user_id')
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 503 })
  if ((data ?? []).length === 1) return NextResponse.json({ ok: true })
  return NextResponse.json({ ok: false, error: 'conflict' }, { status: 409 })
}

/** 서버 사본과 합친 쓸 기록(보류 진행 세트 보호 포함 — 아래 규칙은 이전 단일 쓰기와 같다) */
async function mergeForWrite(record: DissectionRecord, existing: unknown): Promise<unknown> {
  // 합집합 병합 — 보류로 빠진 채 돌아온 기록이 서버 사본의 항목을 지우지 않는다. 응답에는 기록을 싣지 않는다
  let merged: unknown = looksLikeRecord(existing)
    ? mergeDissection(record, existing as unknown as DissectionRecord)
    : record
  // GET 은 보류 문항이 든 진행 세트(active)를 통째로 뺀다. 그 사본이 더 새 것으로 돌아오면 병합이 active 를 새 쪽에서 가져가
  // 서버의 세트가 지워진다(Codex P1) — 들어온 기록에 active 가 없고 서버 세트에 보류 문항이 있으면 서버 세트를 지킨다(판정 실패도 보류로)
  const serverActive = looksLikeRecord(existing) ? (existing as unknown as DissectionRecord).active : undefined
  // 들어온 기록에 새 세트가 있어도 덮지 않는다 — 숨긴 세트의 진행 위치 · 근거가 사라진다(Codex P1 재리뷰). 새 세트는 보류가 풀릴 때까지 기기에만 있다
  if (serverActive) {
    const { held, failed } = await itemRevealDecision([...serverActive.items, ...Object.keys(serverActive.loci ?? {})])
    // 같은 세트(문항 목록이 같음)의 더 나아간 진행이면 그 진행을 받는다 — 서버 세트로 덮으면 index · loci 가 되돌아간다(P2)
    const incoming = record.active
    const sameSet = Boolean(incoming) && incoming!.items.length === serverActive.items.length && incoming!.items.every((id, i) => id === serverActive.items[i])
      // 같은 세트라도 진행이 뒤로 가거나(index) 같은 자리에서 근거(loci) · 짝 확인(pairSeen)을 잃으면 서버 진행을 지킨다(Codex P2)
      && (incoming!.index > serverActive.index
        || (incoming!.index === serverActive.index
          && Object.keys(serverActive.loci ?? {}).every((k) => k in (incoming!.loci ?? {}))
          && (!serverActive.pairSeen || incoming!.pairSeen)))
    if ((failed || held.size) && !sameSet) merged = { ...(merged as DissectionRecord), active: serverActive }
  }
  return merged
}

/** 새 updated_at — 이전 값보다 반드시 뒤(같은 ms 두 쓰기가 같은 표지를 남기면 비교 갱신이 뒤 요청을 못 가른다) */
function nextStamp(prev: string | null): string {
  const now = Date.now()
  const p = prev ? Date.parse(prev) : NaN
  return new Date(Number.isFinite(p) && p >= now ? p + 1 : now).toISOString()
}

export async function DELETE() {
  const { db, user } = await session()
  if (!user || !db) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  const { error } = await db.from('csat_learner_state').delete().eq('user_id', user.id)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 503 })
  return NextResponse.json({ ok: true })
}
