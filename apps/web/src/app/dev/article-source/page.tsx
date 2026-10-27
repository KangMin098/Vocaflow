// apps/web/src/app/dev/article-source/page.tsx
// 기사 원문 출처 링크 PC 실측 — 실제 ReadingUniverse/SourceLink 에 합성 문단 · 주입한 공개 주소만 준다.
// ?src=<주소> 로 주소를 바꾸고, ?chapter=1 이면 장 표식 출처를 함께 넣는다. 서버 조회 · DB 없음. 프로덕션 404.
import { notFound } from 'next/navigation'

import { ArticleSourceDev } from './dev'

export const dynamic = 'force-dynamic'

export default function Page({ searchParams }: { searchParams: { src?: string; chapter?: string } }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const src = searchParams.src ?? 'https://www.bbc.com/news/articles/synthetic-1'
  return (
    <main className="mx-auto max-w-[760px] px-6 py-8">
      <p className="mb-4 font-display text-[12px] text-[var(--t2)]">합성 문단 · 합성 주소 · 개인 데이터 아님 · 서버 기록 없음</p>
      <ArticleSourceDev src={src === 'none' ? null : src} withChapter={searchParams.chapter === '1'} />
    </main>
  )
}
