// apps/web/src/app/api/admin/sources/[source]/profile/route.ts
//
// **소스 한 곳의 수집 프로필 — 관리자 팝업(SourceProfileDialog)용 · 읽기 전용.**
//
// 전량 수치는 **head count** 로 센다(행을 받지 않는다 — PLOS 처럼 4만 편인 소스도 요청 수가 같다).
// 어수·피드·소재 분포처럼 SQL 집계가 필요한 것은 **최근 N편 표본**으로 세고 표본 크기를 함께 돌려준다.
// ⚠️ `count ?? 0` 을 쓰지 않는다 — 오류를 0 으로 삼키면 「없음」으로 읽힌다(AGENTS.md). 하나라도 못 세면 500.

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  ARTICLE_STATUSES, CEFR_LEVELS, V_LEVELS, LICENSE_CLASSES, RIGHTS_EVIDENCE, RETENTION_STATES, CONTENT_VERDICTS,
  ELIGIBILITY_GRADES, SOURCE_KEY, quartiles, topCounts, type SourceProfile,
} from '@/lib/admin/source-profile'

export const dynamic = 'force-dynamic'
const SAMPLE = 500
const reply = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'cache-control': 'no-store' } })

/** 파생물 — gate-rules.derivativeKind 와 같은 규칙(발췌 피드 · 개작 · `#` 조각 키 · derived_from). */
const DERIVED_OR = 'feed_id.eq.plos-extract,source_id.like.adapt:*,source_id.like.*#*,csat_fit->derived_from.not.is.null'

export async function GET(_request: Request, { params }: { params: { source: string } }) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  const source = params.source
  if (!SOURCE_KEY.test(source)) return reply({ error: 'invalid source' }, 400)
  try {
    const db = createAdminClient() as unknown as SupabaseClient
    const articles = () => db.from('library_articles').select('id', { count: 'exact', head: true }).eq('source', source)
    const cache = () => db.from('csat_source_eligibility').select('article_id', { count: 'exact', head: true }).eq('source', source)
    type Q = PromiseLike<{ count: number | null; error: { message: string } | null }>
    const jobs: Record<string, Q> = {
      total: articles(),
      derived: articles().or(DERIVED_OR),
      audio: articles().not('audio_url', 'is', null),
      vUnknown: articles().is('article_v_level', null),
      cefrUnknown: articles().is('cefr_level', null),
      licenseUnknown: articles().is('license_class', null),
      rightsUntagged: articles().is('csat_fit->rights', null),
      needsResolution: articles().eq('csat_fit->rights->>needsResolution', 'true'),
      retentionNone: articles().is('csat_fit->gate->retain', null),
      verdictNone: articles().is('csat_fit->gate->>verdict', null),
      cached: cache(),
    }
    for (const s of ARTICLE_STATUSES) jobs[`status:${s}`] = articles().eq('status', s)
    for (const v of V_LEVELS) jobs[`v:${v}`] = articles().eq('article_v_level', v)
    for (const c of CEFR_LEVELS) jobs[`cefr:${c}`] = articles().eq('cefr_level', c)
    for (const l of LICENSE_CLASSES) jobs[`license:${l}`] = articles().eq('license_class', l)
    for (const e of RIGHTS_EVIDENCE) jobs[`evidence:${e}`] = articles().eq('csat_fit->rights->>evidence', e)
    for (const r of RETENTION_STATES) jobs[`retain:${r}`] = articles().eq('csat_fit->gate->retain->>retention', r)
    for (const v of CONTENT_VERDICTS) jobs[`verdict:${v}`] = articles().eq('csat_fit->gate->>verdict', v)
    for (const g of ELIGIBILITY_GRADES) jobs[`grade:${g}`] = cache().eq('result->>grade', g)

    const keys = Object.keys(jobs)
    const results = await Promise.all(keys.map((k) => jobs[k]!))
    const n: Record<string, number> = {}
    results.forEach((r, i) => {
      if (r.error || r.count == null) throw new Error(`${keys[i]}: ${r.error?.message ?? 'count unavailable'}`)
      n[keys[i]!] = r.count
    })

    const [first, last, sample] = await Promise.all([
      db.from('library_articles').select('created_at').eq('source', source).order('created_at', { ascending: true }).limit(1),
      db.from('library_articles').select('created_at').eq('source', source).order('created_at', { ascending: false }).limit(1),
      db.from('library_articles')
        .select('id,title,status,article_v_level,cefr_level,word_count,created_at,source_url,source_id,feed_id,topic:csat_fit->>topic,derived:csat_fit->derived_from')
        .eq('source', source).order('created_at', { ascending: false }).limit(SAMPLE),
    ])
    for (const r of [first, last, sample]) if (r.error) throw new Error(r.error.message)
    const rows = (sample.data ?? []) as Array<Record<string, unknown>>
    const isDerived = (r: Record<string, unknown>) => {
      const id = String(r.source_id ?? '')
      return r.feed_id === 'plos-extract' || id.startsWith('adapt:') || id.includes('#') || r.derived != null
    }

    const pick = <K extends string | number>(prefix: string, list: readonly K[]) =>
      Object.fromEntries(list.map((k) => [k, n[`${prefix}:${k}`]!])) as Record<K, number>
    const profile: SourceProfile = {
      source,
      measuredAt: new Date().toISOString(),
      total: n.total!,
      firstAt: (first.data?.[0]?.created_at as string | undefined) ?? null,
      lastAt: (last.data?.[0]?.created_at as string | undefined) ?? null,
      status: pick('status', ARTICLE_STATUSES),
      units: { originals: n.total! - n.derived!, derived: n.derived! },
      audio: n.audio!,
      vLevel: { ...pick('v', V_LEVELS), unknown: n.vUnknown! },
      cefr: { ...pick('cefr', CEFR_LEVELS), unknown: n.cefrUnknown! },
      license: { ...pick('license', LICENSE_CLASSES), unknown: n.licenseUnknown! },
      rights: { evidence: pick('evidence', RIGHTS_EVIDENCE), untagged: n.rightsUntagged!, needsResolution: n.needsResolution! },
      retention: { ...pick('retain', RETENTION_STATES), none: n.retentionNone! },
      verdict: { ...pick('verdict', CONTENT_VERDICTS), none: n.verdictNone! },
      eligibility: { ...pick('grade', ELIGIBILITY_GRADES), uncached: Math.max(0, n.total! - n.cached!) },
      sample: {
        size: rows.length,
        words: quartiles(rows.map((r) => Number(r.word_count)).filter((x) => x > 0)),
        feeds: topCounts(rows.map((r) => (r.feed_id as string | null) ?? null)),
        topics: topCounts(rows.map((r) => (r.topic as string | null) ?? null)),
      },
      recent: rows.slice(0, 12).map((r) => ({
        id: String(r.id),
        title: String(r.title ?? ''),
        status: String(r.status ?? ''),
        vLevel: (r.article_v_level as number | null) ?? null,
        cefr: (r.cefr_level as string | null) ?? null,
        words: (r.word_count as number | null) ?? null,
        createdAt: String(r.created_at),
        derived: isDerived(r),
        url: (r.source_url as string | null) ?? null,
      })),
    }
    return reply(profile)
  } catch (e) {
    return reply({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
}
