// apps/web/src/app/(main)/library/scripts/[bookId]/opengraph-image.tsx
//
// 짧은 글 공유 미리보기.
//
// 왜 필요한가 (2026-08-26 실측): `library_articles` 의 표지 컬럼 셋이 **779개 글 전부 비어 있다**
// (채우는 코드가 없다 — 도서에만 표지 해결 단계가 있다). 같은 날 만든 글 상세 160개가
// 공유될 때 그림 없는 카드가 뜬다는 뜻이고, 그 마찰이 확산을 깎는다.
// 원천 표지를 기다리는 대신 **우리가 아는 것으로** 그린다.
//
// ⚠️ **본문은 그리지 않는다.** 발행 160개 중 25개가 CC-BY-ND(개작 금지)이고,
//    발췌를 이미지로 재구성하는 것이 그 경계에 닿는다. 제목·서지 정보는 어느 라이선스에서도 안전하다.
//
// 카드 모양은 `lib/seo/og-card.tsx` 가 소유한다 — 세 서가가 같은 얼굴을 갖게.

import { ImageResponse } from 'next/og'

import { OgCard, OG_SIZE, needsKoreanFont, type OgCardProps } from '@/lib/seo/og-card'
import { loadKoreanOgFont } from '@/lib/seo/og-font'

// Edge — Node 에서는 Next 가 번들한 기본 폰트를 못 읽어 이미지가 통째로 500 이 난다
// (`/fit/s` 구현의 실측 주석 참조).
export const runtime = 'edge'
export const alt = 'Vocaflow — 영어 원문을 어휘와 함께'
export const size = OG_SIZE
export const contentType = 'image/png'

interface Row {
  title: string
  author: string | null
  cefr_level: string | null
  article_v_level: number | null
  word_count: number | null
  feed_label: string | null
  source: string | null
}

/**
 * edge 에서 직접 읽는다 — 페이지의 `cache()` 헬퍼는 `server-only` 계열이라 여기서 못 쓴다.
 * 조건은 화면과 **같게**(published + copyright_safe). 갈라지면 없는 글의 카드를 그린다.
 */
async function fetchArticle(id: string): Promise<Row | null> {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
  if (!url || !key) return null

  const q =
    `${url}/rest/v1/library_articles` +
    `?id=eq.${encodeURIComponent(id)}` +
    `&status=eq.published&copyright_safe_in_kr=is.true` +
    `&select=title,author,cefr_level,article_v_level,word_count,feed_label,source&limit=1`

  const res = await fetch(q, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    // 공유 카드는 자주 바뀌지 않는다 — 크롤러가 여러 번 가져가도 DB 를 매번 치지 않게.
    next: { revalidate: 86400 },
  })
  if (!res.ok) return null

  const rows = (await res.json()) as Row[]
  return rows[0] ?? null
}

export default async function Image({ params }: { params: { bookId: string } }) {
  const a = await fetchArticle(params.bookId)

  const props: OgCardProps = {
    kind: 'Dispatches',
    title: a?.title ?? 'Vocaflow',
    subtitle: a?.author ?? null,
    badges: [
      a?.cefr_level ?? null,
      a?.article_v_level != null ? `V${a.article_v_level}` : null,
      a?.word_count ? `${a.word_count.toLocaleString('en-US')} words` : null,
    ].filter((b): b is string => typeof b === 'string'),
    source: a?.feed_label ?? a?.source ?? null,
  }

  const font = needsKoreanFont(props) ? await loadKoreanOgFont() : null

  return new ImageResponse(<OgCard {...props} />, {
    ...OG_SIZE,
    ...(font
      ? { fonts: [{ name: 'KoreanOg', data: font, style: 'normal' as const, weight: 700 as const }] }
      : {}),
  })
}
