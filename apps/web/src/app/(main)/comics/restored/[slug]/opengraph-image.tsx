// apps/web/src/app/(main)/comics/restored/[slug]/opengraph-image.tsx
//
// 복원 만화 공유 미리보기.
//
// 이 카드가 말해야 하는 것은 **"1940년대 원본을 복원했다"** 는 사실이다 — 그것이 이 콘텐츠의
// 매력이자 검색 가치다(리더 화면의 출처 표기와 같은 이유). 그래서 시리즈·호수·연도를
// 제목 자리에 놓고 아카이브를 출처로 남긴다.
//
// 컷 이미지를 배경으로 쓰지 않는 이유는 도서 표지와 같다 — 외부 스토리지에 있고,
// 크롤러가 여러 번 가져가는 자리를 남의 서버 상태에 묶지 않는다.
//
// 카드 모양은 `lib/seo/og-card.tsx` 가 소유한다.

import { ImageResponse } from 'next/og'

import { OgCard, OG_SIZE, needsKoreanFont, type OgCardProps } from '@/lib/seo/og-card'
import { loadKoreanOgFont } from '@/lib/seo/og-font'
import { ogQueryUrl } from '@/lib/seo/og-queries'

export const runtime = 'edge'
export const alt = 'Vocaflow — 퍼블릭 도메인 만화를 영어 원문 그대로'
export const size = OG_SIZE
export const contentType = 'image/png'

interface Row {
  title: string
  series_title: string | null
  issue_no: number | null
  published_year: number | null
  source_adapter: string | null
}

/**
 * ⚠️ 표를 직접 읽는다 — edge 에서 `select_pd_comic_provenance` RPC 를 쓰려면 supabase-js 가
 *    필요한데 여기서는 fetch 로 충분하다. 조건은 RLS 가 이미 강제한다(`status='published'` 만 공개).
 *
 * ⚠️ 컬럼명은 **표 기준**이다 — `selectPdProvenance` 가 돌려주는 `sourceArchive` 는 RPC 가
 *    매핑한 이름이고 표에는 `source_adapter` 로 있다. 처음에 RPC 이름으로 select 해서
 *    PostgREST 가 400 을 냈고, 카드가 조용히 폴백(제목 "Vocaflow")으로 그려졌다.
 */
async function fetchIssue(slug: string): Promise<Row | null> {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
  if (!url || !key) return null

  const q = ogQueryUrl(url, 'comic', slug)

  const res = await fetch(q, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    next: { revalidate: 86400 },
  })
  if (!res.ok) return null

  const rows = (await res.json()) as Row[]
  return rows[0] ?? null
}

export default async function Image({ params }: { params: { slug: string } }) {
  const c = await fetchIssue(params.slug)

  // 시리즈명이 호 제목과 같으면 한 번만 쓴다 — 카탈로그에 그런 행이 실제로 있다
  // (`Super Mystery Comics`). 같은 말을 두 줄에 겹쳐 쓰면 카드가 이상해진다.
  const series = c?.series_title ?? null
  const title = c?.title ?? 'Vocaflow'
  const subtitle = series && series !== title ? series : null

  const props: OgCardProps = {
    kind: 'Vintage Comics',
    title,
    subtitle,
    badges: [
      c?.issue_no != null ? `#${c.issue_no}` : null,
      c?.published_year != null ? String(c.published_year) : null,
    ].filter((x): x is string => typeof x === 'string'),
    source: c?.source_adapter ?? null,
  }

  const font = needsKoreanFont(props) ? await loadKoreanOgFont() : null

  return new ImageResponse(<OgCard {...props} />, {
    ...OG_SIZE,
    ...(font
      ? { fonts: [{ name: 'KoreanOg', data: font, style: 'normal' as const, weight: 700 as const }] }
      : {}),
  })
}
