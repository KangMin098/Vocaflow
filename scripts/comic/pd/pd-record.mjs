// scripts/comic/pd/pd-record.mjs
//
// PDCP CLI 진행 상황을 pd_comic_issues 에 기록 — CLI 테스트를 admin '테스트·모니터' 탭에서
// 라이브로 보이게 한다(CCP Kaggle 테스트를 comic_gen_tests 에 기록한 것과 동형).
//   기본은 무기록(임시 QC). --record 일 때만 이 모듈을 동적 import 해서 DB 를 건드린다.
//
// 왜 별도 모듈: pipeline.mjs 는 순수 파이프라인 도구(앱 브리지도 로드). Supabase 의존을
// 옵션 경로로 격리해 기본 실행에 영향 0.

import fs from 'node:fs'
import path from 'node:path'

function loadEnv(root) {
  const p = path.join(root, 'apps', 'web', '.env.local')
  if (!fs.existsSync(p)) return
  for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const slugify = (s) => String(s || 'issue').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'issue'

/**
 * 레코더 생성. env 없으면 null(무기록 graceful).
 * @param {string} root 저장소 루트
 */
export async function createRecorder(root) {
  loadEnv(root)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error('   (기록 skip: Supabase env 없음 — apps/web/.env.local)'); return null }
  let createClient
  try { ({ createClient } = await import('@supabase/supabase-js')) }
  catch { console.error('   (기록 skip: @supabase/supabase-js 없음)'); return null }
  const db = createClient(url, key, { auth: { persistSession: false } })

  return {
    /** 이슈 upsert — source_identifier 로 재사용(재실행 시 중복 방지). 반환 id 또는 null. */
    async upsert({ source, id, title, seriesTitle, testPages }) {
      try {
        const { data: existing } = await db.from('pd_comic_issues')
          .select('id').eq('source_adapter', source).eq('source_identifier', id).maybeSingle()
        if (existing?.id) {
          await db.from('pd_comic_issues').update({ status: 'queued', last_error: null, acquire_pages: testPages ?? null }).eq('id', existing.id)
          return existing.id
        }
        const slug = `${slugify(seriesTitle ? `${seriesTitle}-${title}` : title)}-${String(id).slice(-6).toLowerCase()}`
        const { data, error } = await db.from('pd_comic_issues').insert({
          slug, title: title || id, series_title: seriesTitle ?? null,
          source_adapter: source, source_identifier: id, status: 'queued', acquire_pages: testPages ?? null,
        }).select('id').single()
        if (error) { console.error(`   (기록 실패: ${error.message})`); return null }
        return data?.id ?? null
      } catch (e) { console.error(`   (기록 오류: ${e.message})`); return null }
    },
    /** 단계 전이 기록 — status + last_run_at (+ qc/panels_total). */
    async stage(issueId, status, extra = {}) {
      if (!issueId) return
      try {
        await db.from('pd_comic_issues').update({
          status, last_run_at: new Date().toISOString(),
          ...(extra.qc ? { qc: extra.qc } : {}),
          ...(extra.panelsTotal != null ? { panels_total: extra.panelsTotal } : {}),
          ...(extra.attemptsInc ? {} : {}),
        }).eq('id', issueId)
      } catch (e) { console.error(`   (단계 기록 오류: ${e.message})`) }
    },
  }
}
