// apps/web/src/app/(main)/library/scripts/[bookId]/page.tsx
//
// article/book 열기 리졸버 (v06.208 — plan/hub article 링크 404 수정).
//   - 발행 article id  → startArticleLearning(멱등: texts 변환) → /text/[textId]?mode=read
//   - 그 외(도서 id·레거시 북마크) → /library/books/[id]
//
// 배경: materialHref('article') = /library/scripts/{articleId} 인데 기존엔 무조건 도서로 redirect →
//   /library/books/{articleId} → notFound()(404). 브라우즈 카드·처방은 startArticleLearning 을 거쳐
//   정상이었으나 plan·TodayPlanCard 만 이 리졸버를 안 거쳐 깨졌음. 이제 article 을 여기서 리더로 연결.

import { redirect } from 'next/navigation'

import { startArticleLearning } from '@/lib/articles/start-learning'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  params: { bookId: string }
}

export default async function LibraryScriptsResolve({ params }: PageProps) {
  const id = params.bookId

  const supabase = await createClient()
  const { data: article } = await supabase
    .from('library_articles')
    .select('id')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle()

  if (article) {
    const res = await startArticleLearning(id)
    if (res.ok) redirect(`/text/${res.textId}?mode=read`)
    // 학습 텍스트 생성 불가(미로그인/미발행 등) → 스크립트 브라우즈로 폴백
    redirect('/library/scripts')
  }

  // article 아님 → 도서 라우트(레거시 북마크 보존)
  redirect(`/library/books/${id}`)
}
