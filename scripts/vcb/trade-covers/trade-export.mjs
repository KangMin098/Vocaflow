#!/usr/bin/env node
// scripts/vcb/trade-covers/trade-export.mjs
//
// **VCB 교재 표지 — 1단계 export.** 발행된 단어장을 `work/sets.json` 으로 내보낸다.
// 4단: export → 아트 디렉션(에이전트가 `work/specs.out.json` 을 채운다 — 권마다 목적·틀·시리즈 묶음)
//      → 미리보기(`trade-preview.mjs`) → import(`trade-import.mjs --commit`, `cover_image_meta.trade`).
//
//   node --tls-max-v1.2 --env-file=apps/web/.env.local scripts/vcb/trade-covers/trade-export.mjs          # 명세 없는 권만
//   node --tls-max-v1.2 --env-file=apps/web/.env.local scripts/vcb/trade-covers/trade-export.mjs --all    # 전부
//
// 재실행 안전 — DB 를 읽기만 한다. 아트 디렉터가 묶음을 정하려면 **사다리 계단 · 계열 · 기존 브랜드 각인**이
// 필요하므로 함께 내보낸다(표제어 수는 참고용 — 표지 수치는 화면이 그릴 때 DB 에서 다시 읽는다).

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const WORK = path.join(import.meta.dirname, 'work')
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
  .select('id, slug, title, description, category, cefr_level, word_count, ladder_step, cover_image_meta, curation_query')
  .eq('is_published', true)
  // 앱 서가와 같은 거름(queries.ts fetchPublishedSets)
  .neq('category', 'library_book')
  .neq('category', 'library_article')
  .order('sort_order', { ascending: true })
if (error) {
  console.error('조회 실패:', error.message)
  process.exit(1)
}

const rows = (data ?? []).filter((r) => ALL || !r.cover_image_meta?.trade)
fs.mkdirSync(WORK, { recursive: true })
fs.writeFileSync(
  path.join(WORK, 'sets.json'),
  JSON.stringify(
    rows.map((r) => ({
      slug: r.slug ?? r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      cefr: r.cefr_level,
      words: r.word_count,
      ladder_step: r.ladder_step,
      family: r.curation_query?.brand?.family ?? r.cover_image_meta?.family ?? null,
      series_line: r.curation_query?.brand?.seriesLine ?? null,
    })),
    null,
    2,
  ) + '\n',
)
console.log(`발행 ${data?.length ?? 0}권 중 ${rows.length}권 내보냄 → scripts/vcb/trade-covers/work/sets.json`)
console.log(`건너뜀(이미 명세 있음): ${(data?.length ?? 0) - rows.length}`)
