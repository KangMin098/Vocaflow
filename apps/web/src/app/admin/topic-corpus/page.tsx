// apps/web/src/app/admin/topic-corpus/page.tsx
// TCP(주제 코퍼스) 콘솔 — 소스별 큐/수확/승격 현황 + 적재·드레인·승격 조작.

import { requireAdmin } from '@/lib/auth/require-admin'
import { createTopicCorpusClient } from '@/lib/topic-corpus/client'

import { TopicCorpusClient, type TopicCorpusRow } from './TopicCorpusClient'

export const dynamic = 'force-dynamic'

export default async function AdminTopicCorpusPage() {
  await requireAdmin('/admin/topic-corpus')

  const supabase = createTopicCorpusClient()
  const { data, error } = await supabase.rpc('topic_corpus_overview')

  // 마이그레이션 적용 전이면 RPC 가 없다 — 빈 화면 대신 이유를 말한다.
  const rows = (data ?? []) as unknown as TopicCorpusRow[]

  return (
    <TopicCorpusClient
      rows={rows}
      loadError={error ? error.message : null}
    />
  )
}
