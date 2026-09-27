#!/usr/bin/env node
// scripts/vcb/editions/edition-export.mjs
//
// **VCB 에디션 표지 — 1단계 export.** 발행된 단어장을 `work/sets.json` 으로 내보낸다.
// 3단 드레인(AGENTS.md): export → 에이전트(아트 디렉터)가 `work/prompts.out.json` 을 채움 → gen → import.
//
//   node --env-file=apps/web/.env.local scripts/vcb/editions/edition-export.mjs           # 표지 없는 세트만
//   node --env-file=apps/web/.env.local scripts/vcb/editions/edition-export.mjs --all     # 전부(다시 그릴 때)
//
// 재실행 안전 — DB 를 읽기만 한다. 이미 `cover_image_meta.edition` 이 있는 세트는 건너뛴다(--all 제외).
// node 가 Supabase 에 TLS 로 못 붙으면 `node --tls-max-v1.2` 를 앞에 붙인다.

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const HERE = import.meta.dirname
const WORK = path.join(HERE, 'work')
const ALL = process.argv.includes('--all')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 부재 — --env-file=apps/web/.env.local')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })

const { data, error } = await sb
  .from('shared_word_sets')
  .select('id, slug, title, description, category, cefr_level, cover_image_meta')
  .eq('is_published', true)
  // 앱 서가와 같은 거름(queries.ts fetchPublishedSets) — 소스 종속 자동생성 세트는 공용 서가에 없다.
  .neq('category', 'library_book')
  .neq('category', 'library_article')
  .order('sort_order', { ascending: true })
if (error) {
  console.error('조회 실패:', error.message)
  process.exit(1)
}

const rows = (data ?? []).filter((r) => ALL || !r.cover_image_meta?.edition)
fs.mkdirSync(WORK, { recursive: true })
fs.writeFileSync(
  path.join(WORK, 'sets.json'),
  JSON.stringify(
    rows.map((r) => ({
      id: r.id,
      slug: r.slug ?? r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      cefr: r.cefr_level,
      family: r.cover_image_meta?.family ?? null,
    })),
    null,
    2,
  ),
)
console.log(`발행 ${data?.length ?? 0}권 중 ${rows.length}권 내보냄 → ${path.relative(process.cwd(), path.join(WORK, 'sets.json'))}`)
console.log(`건너뜀(이미 에디션 표지 있음): ${(data?.length ?? 0) - rows.length}`)
