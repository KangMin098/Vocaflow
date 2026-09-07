// apps/web/src/app/(main)/library/books/[bookId]/opengraph-image.tsx
//
// 발행 도서 공유 미리보기.
//
// 도서에는 `cover_image_url`(원천 표지)이 실제로 채워져 있다 — 글과 다른 점이다.
// 그런데 **여기서 그것을 배경으로 쓰지 않는다.** 표지는 외부 호스트(Gutenberg·Standard Ebooks·
// GCS)에 있고, edge 에서 매번 받아 오면 카드 생성이 남의 서버 상태에 묶인다.
// 크롤러가 여러 번 가져가는 자리라 그 결합이 비싸다. 표지를 우리 스토리지로 옮기면
// 그때 배경으로 얹으면 된다 — 그때까지는 제목·저자·난이도로 충분히 알아볼 수 있다.
//
// 카드 모양은 `lib/seo/og-card.tsx` 가 소유한다.

import { ImageResponse } from 'next/og'

import { OgCard, OG_SIZE, ogCardText, type OgCardProps } from '@/lib/seo/og-card'
import { loadKoreanOgFont } from '@/lib/seo/og-font'
import { ogQueryUrl } from '@/lib/seo/og-queries'

export const runtime = 'edge'
export const alt = 'Vocaflow — 영어 원서를 챕터별 어휘와 함께'
export const size = OG_SIZE
export const contentType = 'image/png'

interface Row {
  title: string
  author: string | null
  cefr_band: string | null
  cefr_level: string | null
  book_v_level: number | null
  word_count: number | null
  chapter_count: number | null
}

/** 조건을 화면(`page.tsx`)과 **같게** — published + copyright_safe. */
async function fetchBook(id: string): Promise<Row | null> {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
  if (!url || !key) return null

  const q = ogQueryUrl(url, 'book', id)

  const res = await fetch(q, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    next: { revalidate: 86400 },
  })
  if (!res.ok) return null

  const rows = (await res.json()) as Row[]
  return rows[0] ?? null
}

export default async function Image({ params }: { params: { bookId: string } }) {
  const b = await fetchBook(params.bookId)

  const props: OgCardProps = {
    kind: 'Books',
    title: b?.title ?? 'Vocaflow',
    subtitle: b?.author ?? null,
    badges: [
      b?.cefr_band ?? b?.cefr_level ?? null,
      b?.book_v_level != null ? `V${b.book_v_level}` : null,
      b?.word_count ? `${b.word_count.toLocaleString('en-US')} words` : null,
      b?.chapter_count ? `${b.chapter_count} ch` : null,
    ].filter((x): x is string => typeof x === 'string'),
    source: null,
  }

  // 한글이 없으면 로더가 스스로 null 을 준다 — 판정을 두 곳에 두지 않는다.
  const font = await loadKoreanOgFont(ogCardText(props))

  return new ImageResponse(<OgCard {...props} />, {
    ...OG_SIZE,
    ...(font
      ? { fonts: [{ name: 'KoreanOg', data: font, style: 'normal' as const, weight: 700 as const }] }
      : {}),
  })
}
