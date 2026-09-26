// scripts/vcb/trade-covers/trade-import.mts
//
// **VCB 교재 표지 — 4단계 import.** `work/specs.out.json` 을 `shared_word_sets.cover_image_meta.trade` 에 적는다.
//
//   npx tsx --tsconfig apps/web/tsconfig.json --env-file=apps/web/.env.local scripts/vcb/trade-covers/trade-import.mts            # 드라이런
//   npx tsx --tsconfig apps/web/tsconfig.json --env-file=apps/web/.env.local scripts/vcb/trade-covers/trade-import.mts --commit
//
// 재실행 안전 — jsonb 를 통째로 덮지 않는다. 기존 cover_image_meta 를 읽어 `trade` 키 하나만 바꾼다
// (덮으면 family · edition 이 날아간다). 규칙(validateTradeSpec)을 어긴 명세는 넣지 않고 **건너뛴 수와 사유를 출력**한다.
// 「변경 없음」 판정은 키 순서에 흔들리지 않는 정규화 비교다(jsonb 가 키 순서를 바꾼다 — JSON.stringify 비교는 매번 「변경」).
// 되돌리기: `trade` 키를 지우면 선반은 에디션 도판 → 종전 표지 순으로 돌아간다.

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { validateTradeSpec, type TradeCoverSpec } from '../../../packages/library-pipeline/src/vocab/trade-cover'

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const COMMIT = process.argv.includes('--commit')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 부재 — --env-file=apps/web/.env.local')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })

/** 키 순서와 무관한 정규 문자열 */
const canon = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(canon).join(',')}]`
    : v && typeof v === 'object'
      ? `{${Object.keys(v as object)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`)
          .join(',')}}`
      : JSON.stringify(v ?? null)

const specs = JSON.parse(fs.readFileSync(path.join(HERE, 'work', 'specs.out.json'), 'utf8')) as Record<string, TradeCoverSpec>
let wrote = 0,
  unchanged = 0,
  invalid = 0,
  missing = 0
for (const [slug, spec] of Object.entries(specs)) {
  const errs = validateTradeSpec(spec)
  if (errs.length) {
    invalid++
    console.warn(`  ✗ ${slug}: ${errs.join(' · ')}`)
    continue
  }
  const { data: row, error } = await sb.from('shared_word_sets').select('id, cover_image_meta').eq('slug', slug).maybeSingle()
  if (error || !row) {
    missing++
    console.warn(`  ? ${slug} — 세트를 못 찾음 ${error?.message ?? ''}`)
    continue
  }
  const meta = (row.cover_image_meta ?? {}) as Record<string, unknown>
  if (canon(meta.trade) === canon(spec)) {
    unchanged++
    continue
  }
  if (COMMIT) {
    const { error: e2 } = await sb.from('shared_word_sets').update({ cover_image_meta: { ...meta, trade: spec } }).eq('id', row.id)
    if (e2) {
      console.warn(`  ✗ ${slug} ${e2.message}`)
      continue
    }
  }
  wrote++
  console.log(`  ${COMMIT ? '✓' : '·'} ${slug} (${spec.mode}/${spec.template} · ${spec.series})`)
}
console.log(`${COMMIT ? '적재' : '드라이런'} ${wrote} · 변경 없음 ${unchanged} · 규칙 위반 건너뜀 ${invalid} · 세트 없음 ${missing}`)
if (invalid || missing) process.exitCode = 1
