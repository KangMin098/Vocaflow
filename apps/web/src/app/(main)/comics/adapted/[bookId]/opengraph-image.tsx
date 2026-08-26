// apps/web/src/app/(main)/comics/adapted/[bookId]/opengraph-image.tsx
//
// 각색 만화(CCP) 공유 미리보기.
//
// 이 화면은 **도서에서 파생된 만화판**이라 카드도 도서 행을 읽는다. 그런데 조건이
// 도서 카탈로그와 다르다 — 여기는 `applyBookReadGate`(status 만)를 쓰므로 카드도 그것에 맞춘다
// (`lib/seo/og-queries.ts` 의 `comicAdapted`). 조건이 갈리면 **화면에는 있는데 카드만 비는**
// 도서가 생기고, 그건 상태 200 짜리 유효한 PNG 라 열어 보기 전에는 알 수 없다.
//
// 만화판 첫 컷을 배경으로 쓰지 않는 이유는 복원 만화와 같다 — 컷 이미지는 스토리지에 있고
// edge 에서 매번 받아 오면 카드 생성이 스토리지 지연에 묶인다. 크롤러가 여러 번 가져가는 자리다.

import { ImageResponse } from 'next/og'

import { OgCard, OG_SIZE, ogCardText, type OgCardProps } from '@/lib/seo/og-card'
import { loadKoreanOgFont } from '@/lib/seo/og-font'
import { ogQueryUrl } from '@/lib/seo/og-queries'

export const runtime = 'edge'
export const alt = 'Vocaflow — 같은 책, 그림으로 먼저'
export const size = OG_SIZE
export const contentType = 'image/png'

interface Row {
  title: string
  author: string | null
  cefr_band: string | null
  cefr_level: string | null
  book_v_level: number | null
  chapter_count: number | null
}

async function fetchBook(id: string): Promise<Row | null> {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
  if (!url || !key) return null

  const res = await fetch(ogQueryUrl(url, 'comicAdapted', id), {
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
    kind: 'Comics',
    title: b?.title ?? 'Vocaflow',
    subtitle: b?.author ?? null,
    badges: [
      b?.cefr_band ?? b?.cefr_level ?? null,
      b?.book_v_level != null ? `V${b.book_v_level}` : null,
      b?.chapter_count ? `${b.chapter_count} ch` : null,
      '만화판',
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
