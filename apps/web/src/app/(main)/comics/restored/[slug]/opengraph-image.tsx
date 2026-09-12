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

import { pdComicDisplayTitle } from '@/lib/pd-comic/display-title'
import { OgCard, OG_SIZE, ogCardText, type OgCardProps } from '@/lib/seo/og-card'
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
  /** 임베드한 정본 시리즈 — 표의 `series_title` 보다 이쪽이 우선이다. */
  pd_comic_series: { title: string | null } | null
}

/**
 * ⚠️ 표를 직접 읽는다 — edge 에서 RPC 를 쓰려면 supabase-js 가 필요한데 여기서는 fetch 로
 *    충분하다. 조건은 RLS 가 이미 강제한다(`status='published'` 만 공개).
 *
 * ⚠️ 컬럼명은 **표 기준**이다. 표에는 `source_adapter` 로 있고, RPC 마다 부르는 이름이 다르다
 *    (`select_pd_comic_info` 는 `source_archive`, `select_pd_comic_provenance` 는 `source_adapter`).
 *    처음에 RPC 이름으로 select 해서 PostgREST 가 400 을 냈고, 카드가 조용히 폴백
 *    (제목 "Vocaflow")으로 그려졌다. 같은 이름 혼동이 상세 화면에서도 한 번 더 났다 —
 *    거기서는 `sourceArchive` 가 **언제나 null** 이라 PD 출처 표기가 비어 있었다(2026-08-26 해소).
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

  // 제목 규칙은 화면과 **같은 것**을 쓴다(`lib/pd-comic/display-title.ts`) —
  // 정본 시리즈 + 호수, 이미 호수를 품고 있으면 덧붙이지 않는다.
  const title = c
    ? pdComicDisplayTitle({
        title: c.title,
        seriesTitle: c.pd_comic_series?.title ?? c.series_title,
        issueNo: c.issue_no,
      })
    : 'Vocaflow'

  // 아카이브 원본 표기가 우리 이름표와 다를 때만 부제로 — 같은 말을 두 줄에 겹쳐 쓰지 않는다.
  const subtitle = c && c.title !== title ? c.title : null

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

  // 한글이 없으면 로더가 스스로 null 을 준다 — 판정을 두 곳에 두지 않는다.
  const font = await loadKoreanOgFont(ogCardText(props))

  return new ImageResponse(<OgCard {...props} />, {
    ...OG_SIZE,
    ...(font
      ? { fonts: [{ name: 'KoreanOg', data: font, style: 'normal' as const, weight: 700 as const }] }
      : {}),
  })
}
