// apps/web/src/app/api/admin/csat/order-trace/route.ts
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createAdminClient } from '@/lib/supabase/admin'
import { deriveOrderTrace } from '@/lib/csat/order-trace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  if (admin.role !== 'admin') return NextResponse.json({ error: 'Administrator required' }, { status: 403 })
  const orderId = new URL(request.url).searchParams.get('order_id')?.trim()
  if (!orderId || orderId.length > 128) return NextResponse.json({ error: 'INVALID_ORDER_ID' }, { status: 400 })
  // Promotion tables are deployed but absent from the older generated Database type.
  const db = createAdminClient() as unknown as SupabaseClient
  const orderResult = await db.from('reading_product_order_revision')
    .select('order_id,order_revision,order_hash').eq('order_id', orderId).maybeSingle()
  if (orderResult.error) return NextResponse.json({ error: 'ORDER_TRACE_UNAVAILABLE' }, { status: 503 })
  const order = orderResult.data
  if (!order) return NextResponse.json(deriveOrderTrace({ order: null, audits: [], authority: null,
    article: null, source: null, items: null, itemStates: null, reviews: null, now: new Date().toISOString() }),
  { headers: { 'cache-control': 'no-store' } })
  const auditsResult = await db.from('reading_promotion_audit')
    .select('request_id,request_hash,evidence_hash,article_id,source_id,order_revision,order_hash,trust_policy_hash,benchmark_version,benchmark_snapshot_hash,certificate_hash,eligibility_hash,result_status,request_payload')
    .eq('order_id', orderId).order('promoted_at', { ascending: false }).limit(1)
  if (auditsResult.error) return NextResponse.json({ error: 'ORDER_TRACE_UNAVAILABLE' }, { status: 503 })
  const audit = auditsResult.data?.[0]
  if (!audit) return NextResponse.json(deriveOrderTrace({ order, audits: [], authority: null,
    article: null, source: null, items: null, itemStates: null, reviews: null, now: new Date().toISOString() }),
  { headers: { 'cache-control': 'no-store' } })
  if (!audit.request_payload || typeof audit.request_payload !== 'object' || Array.isArray(audit.request_payload))
    return NextResponse.json({ error: 'ORDER_TRACE_AUDIT_UNMEASURED' }, { status: 503 })
  const [authorityResult, articleResult, sourceResult] = await Promise.all([
    db.from('reading_promotion_authority')
      .select('trust_policy_hash,benchmark_version,benchmark_snapshot_hash,valid_until,revoked_certificate_hashes,revoked_eligibility_hashes')
      .eq('singleton', true).maybeSingle(),
    db.from('library_articles')
      .select('id,status,adapted_from_id,display_only,copyright_safe_in_kr,content,source,source_id,license,license_class,updated_at')
      .eq('id', audit.article_id).maybeSingle(),
    db.from('library_articles')
      .select('id,source_id,source_url,content,csat_fit,source,license,license_class,display_only,copyright_safe_in_kr,status,updated_at')
      .eq('id', audit.source_id).maybeSingle(),
  ])
  if (authorityResult.error || articleResult.error || sourceResult.error)
    return NextResponse.json({ error: 'ORDER_TRACE_UNAVAILABLE' }, { status: 503 })
  const itemsResult = await db.from('csat_dcp_items')
    .select('id,ref_id,payload,answer_key').eq('kind', 'article').eq('ref_id', audit.article_id)
    .order('id').limit(101)
  if (itemsResult.error || (itemsResult.data?.length ?? 0) > 100)
    return NextResponse.json({ error: 'ORDER_TRACE_ITEMS_UNMEASURED' }, { status: 503 })
  if ((itemsResult.data ?? []).some(row => !row.payload || typeof row.payload !== 'object' ||
      Array.isArray(row.payload) || !row.answer_key || typeof row.answer_key !== 'object' ||
      Array.isArray(row.answer_key)))
    return NextResponse.json({ error: 'ORDER_TRACE_ITEMS_UNMEASURED' }, { status: 503 })
  const itemIds = (itemsResult.data ?? []).map(row => row.id)
  const [reviewsResult, itemStatesResult] = itemIds.length ? await Promise.all([
    db.from('csat_item_reviews').select('item_id,persona,verdict,reviewed_digest').in('item_id', itemIds).limit(301),
    db.from('csat_item_state').select('item_id,status,reason_code').in('item_id', itemIds).limit(101),
  ]) : [{ data: [], error: null }, { data: [], error: null }]
  if (reviewsResult.error || (reviewsResult.data?.length ?? 0) > 300 ||
      itemStatesResult.error || (itemStatesResult.data?.length ?? 0) > 100)
    return NextResponse.json({ error: 'ORDER_TRACE_REVIEWS_UNMEASURED' }, { status: 503 })
  const trace = deriveOrderTrace({ order, audits: [audit], authority: authorityResult.data,
    article: articleResult.data, source: sourceResult.data, items: itemsResult.data ?? [],
    itemStates: itemStatesResult.data ?? [], reviews: reviewsResult.data ?? [],
    now: new Date().toISOString() })
  return NextResponse.json(trace, { headers: { 'cache-control': 'no-store' } })
}
