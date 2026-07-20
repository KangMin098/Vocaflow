import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth:{persistSession:false} })
// ready 책들이 이미 단어세트 보유? (있으면 발행=플래그, 없으면 생성 필요)
const { data: ready } = await sb.from('library_books').select('id, title, status').neq('status','published').eq('status','ready')
for(const b of ((ready??[]) as any[]).slice(0,6)){
  const { count } = await sb.from('shared_word_sets').select('*',{count:'exact',head:true}).eq('category','library_book').filter('curation_query->>book_id','eq',b.id)
  const { count: pubSet } = await sb.from('shared_word_sets').select('*',{count:'exact',head:true}).eq('category','library_book').eq('is_published',true).filter('curation_query->>book_id','eq',b.id)
  console.log(`  "${(b.title||'').slice(0,32)}" 단어세트 ${count} (published ${pubSet})`)
}
