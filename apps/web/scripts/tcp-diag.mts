// apps/web/scripts/tcp-diag.mts
//
// TCP 수확 실패 진단 — 소스 하나를 편별로 돌려 소요 시간과 실패 사유를 그대로 찍는다.
//
// 만든 이유(2026-08-16): 첫 로컬 수확에서 162편 중 85편(52%)이 건너뛰어졌는데,
// CLI 가 사유를 세기만 하고 찍지 않아 원인이 보이지 않았다. 큰 문서를 가진 소스일수록
// 실패율이 높다는 패턴(wikipedia 0/2 · wikivoyage 1/7 · plos 2/6)이 유일한 단서였다.
//
// 사용: npx tsx scripts/tcp-diag.mts <library_articles.source>

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { tokenizeText } from '../src/lib/text-extract/tokenize'
import { harvestLocalArticle, type LocalArticle } from '../src/lib/topic-corpus/local-corpus'

config({ path: resolve(process.cwd(), '.env.local') })

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const src = process.argv[2] ?? 'wikipedia'
const sourceId = `local:${src.replace(/_/g, '-')}`

const { data, error } = await db
  .from('library_articles')
  .select('id,title,source_url,published_at,content')
  .eq('source', src)

if (error) {
  console.error(error.message)
  process.exit(1)
}

for (const a of (data ?? []) as LocalArticle[]) {
  const chars = (a.content ?? '').length
  const tok = tokenizeText(a.content ?? '')
  const t0 = Date.now()
  const out = await harvestLocalArticle(db as never, sourceId, a)
  const ms = Date.now() - t0
  console.log(
    `${String(chars).padStart(6)}자 uniq=${String(tok.uniqueFinal).padStart(4)} ${String(ms).padStart(6)}ms  ` +
      (out.ok
        ? `OK resolved=${out.resolvedWords} gap=${out.gapWords} dup=${out.alreadyIngested}`
        : `FAIL ${out.reason}`),
  )
}
