// apps/web/src/app/admin/csat/press/actions.ts
//
// **발행 판정을 남긴다** — ⑧ 조판의 유일한 쓰기 경로.
//
// ── 왜 화면에 버튼이 있나 (2026-09-23 · DD-74) ──────────────────────
// 이 파이프라인의 조작은 거의 다 터미널 드레인이고, 화면은 보기만 한다. 승인은 예외다 —
// **승인은 사람의 판단 자체**라 스크립트로 대신할 것이 없고, 터미널로 밀면 기록이
// 남지 않는다(실측: 승인 컬럼이 파이프라인 전체에 0개였고, 그래서 3인 검수 1/60 인 권이
// 카탈로그에 「냈음」으로 서 있었다).
//
// ⚠️ **게이트가 막은 권은 승인할 수 없다.** 화면이 버튼을 감추는 것만으로는 부족하다 —
//   여기서 다시 판정한다(`judgePressGate`, 화면·후보 스크립트와 **같은 함수**). 화면만
//   믿으면 요청을 직접 보내는 길이 열린 채로 남는다.
//
// ⚠️ **못 잰 것은 통과가 아니다.** `approvable` 은 막는 것이 없고 **못 잰 것도 없어야**
//   참이다. 검수를 한 번도 안 돌린 권을 깨끗한 권으로 내보내는 것이 이 저장소의 지배적 결함이다.

'use server'

import { revalidatePath } from 'next/cache'

import { judgePressGate } from '@vocaflow/library-pipeline/textbook-press-gate'
import { brandFingerprint } from '@vocaflow/library-pipeline'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdmin } from '@/lib/auth/require-admin'
import { recordApproval } from '@/lib/csat/approvals'
import { createAdminClient } from '@/lib/supabase/admin'
import { seriesHasContents } from '@/lib/textbook/volume-contents'

export interface PublishResult {
  ok: boolean
  /** 화면이 그대로 보여 줄 한 줄. 성공이든 실패든 **왜인지**를 담는다. */
  says: string
}

/**
 * 한 권의 발행 판정을 남긴다.
 *
 * `decision: 'approved'` 는 매대 노출(`colophon.publish.status = 'published'`)까지 간다.
 * `'withdrawn'` 은 내린다 — 사유 10자 이상이 필수다.
 */
export async function decideVolumeAction(
  series: string,
  band: number,
  decision: 'approved' | 'withdrawn',
  reason?: string,
): Promise<PublishResult> {
  const admin = await requireAdmin('/admin/csat/press')
  const by = admin?.email ?? 'admin'

  const db = createAdminClient() as unknown as SupabaseClient
  const { data, error } = await db
    .from('textbook_volume_renders')
    .select(
      'band, series, volume_title, items, auto_passed, auto_total, ' +
        'explained_batch, explained_rule, brand_fingerprint, colophon',
    )
    .eq('series', series)
    .eq('band', band)
    .maybeSingle()

  if (error) return { ok: false, says: `조판 기록을 못 읽었다: ${error.message}` }
  if (!data) return { ok: false, says: `그 권의 조판 기록이 없다 — ${series} V${band}` }

  // `unknown` 을 거쳐 좁힌다 — PostgREST 의 반환 타입에는 오류 모양이 섞여 있어 직접 캐스트가 막힌다.
  const r = data as unknown as Record<string, unknown> & { colophon: Record<string, unknown> | null }
  const items = Number(r.items ?? 0)
  const pr = (r.colophon as { review?: { personaReview?: { passed: number; settled: number | null } } } | null)
    ?.review?.personaReview ?? null

  const verdict = judgePressGate({
    series,
    band,
    items,
    missingExplanations: Math.max(
      0,
      items - Number(r.explained_batch ?? 0) - Number(r.explained_rule ?? 0),
    ),
    personaBlocked: pr && pr.settled != null ? Math.max(0, pr.settled - pr.passed) : null,
    autoPassed: Number(r.auto_passed ?? 0),
    autoTotal: Number(r.auto_total ?? 0),
    brandCurrent: r.brand_fingerprint === brandFingerprint(),
    hasContents: seriesHasContents(series),
    publishStatus: null,
  })

  if (decision === 'approved' && !verdict.approvable) {
    // 막는 것과 못 잰 것을 **갈라서** 말한다 — 할 일이 정반대다.
    const why = [
      verdict.blockers.length ? `막는 것: ${verdict.blockers.join(' · ')}` : null,
      verdict.unmeasured.length ? `못 잰 것: ${verdict.unmeasured.join(' · ')}` : null,
    ]
      .filter(Boolean)
      .join(' / ')
    return { ok: false, says: `승인할 수 없다 — ${why}` }
  }

  const rec = await recordApproval({
    stage: 'press',
    subjectKind: 'volume',
    subjectId: `${series}:${band}`,
    decision,
    reason: reason ?? null,
    decidedBy: by,
    // 그때의 눈금을 함께 남긴다 — 나중에 「그때는 이랬다」를 재구성하는 유일한 근거다.
    evidence: {
      items,
      blockers: verdict.blockers,
      unmeasured: verdict.unmeasured,
      brandFingerprint: brandFingerprint(),
    },
  })
  if (!rec.ok) return { ok: false, says: `승인을 기록하지 못했다: ${rec.error}` }

  // ⚠️ `colophon` 을 **통째로 덮지 않는다** — 기존 값을 읽어 `publish` 키 하나만 더한다.
  //   덮으면 검수 기록(`colophon.review`)이 날아가고, 그 권은 「검수 기록 없음」이 된다.
  const nextColophon = {
    ...(r.colophon ?? {}),
    publish: {
      status: decision === 'approved' ? 'published' : 'withdrawn',
      reason: reason?.trim() || null,
      at: new Date().toISOString(),
      by,
    },
  }
  const patch: Record<string, unknown> = {
    colophon: nextColophon,
    status: decision === 'approved' ? 'published' : 'withdrawn',
    status_reason: reason?.trim() || null,
  }
  if (decision === 'approved') patch.published_at = new Date().toISOString()

  const upd = await db
    .from('textbook_volume_renders')
    .update(patch)
    .eq('series', series)
    .eq('band', band)

  if (upd.error) {
    // 승인 기록은 남았는데 상태가 안 바뀐 상태다 — **그 사실을 숨기지 않는다.**
    return {
      ok: false,
      says: `승인은 기록됐는데 조판 기록을 못 고쳤다: ${upd.error.message}. 마이그레이션 20260923060200 이 적용됐는지 본다`,
    }
  }

  revalidatePath('/admin/csat/press')
  return {
    ok: true,
    says:
      decision === 'approved'
        ? `발행했다 — ${r.volume_title ?? `${series} V${band}`}`
        : `내렸다 — ${r.volume_title ?? `${series} V${band}`}`,
  }
}
