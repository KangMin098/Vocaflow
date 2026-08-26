// apps/web/src/app/(main)/library/scripts/[bookId]/opengraph-image.tsx
//
// 짧은 글 공유 미리보기 — **제목과 난이도를 그림으로.**
//
// 왜 필요한가 (2026-08-26 실측):
//   같은 날 글 160개에 공개 주소를 만들었는데, 공유했을 때 걸 이미지가 없다.
//   `library_articles` 에는 `cover_image_url`·`cover_image_meta`·`cover_verified_at` 세 컬럼이
//   설계돼 있지만 **779개 글 전부 비어 있다**(채우는 코드가 없다 — 도서에만 표지 해결 단계가 있다).
//   그림 없는 카드가 뜨면 "눌러 봐야 아는" 상태가 되고, 그 마찰이 확산 계수를 깎는다
//   (`/fit/s/[payload]/opengraph-image.tsx` 와 같은 이유).
//
//   원천 이미지를 기다리는 대신 **우리가 아는 것으로 그린다** — 제목·난이도·분량·출처.
//   이건 표지 파이프라인이 생겨도 유효하다(그때는 표지를 배경으로 얹으면 된다).
//
// ⚠️ 본문은 그리지 않는다. 발행 160개 중 25개가 CC-BY-ND(개작 금지)이고, 발췌를 이미지로
//    재구성하는 것이 그 경계에 닿는다. 제목·서지 정보는 어느 라이선스에서도 안전하다.
//
// ⚠️ Satori(ImageResponse) 제약: flex 레이아웃만, CSS 변수 없음, 웹폰트 별도 로드.
//    그래서 색을 여기서 하드코딩한다 — 이미지에는 테마가 없고 토큰이 닿지 않는다.

import { ImageResponse } from 'next/og'

import { loadKoreanOgFont } from '@/lib/seo/og-font'

// Edge 런타임 — Node 에서는 Next 가 번들한 기본 폰트를 못 읽어 이미지가 통째로 500 이 난다
// (`/fit/s` 구현의 실측 주석 참조).
export const runtime = 'edge'
export const alt = 'Vocaflow — 영어 원문을 어휘와 함께'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const INK = '#161A18'
const MUTED = '#5D6560'
const FAINT = '#8A928C'
const PAPER = '#F7F8F6'
const RULE = '#DDE3DE'
const ACCENT = '#2E7D5A'

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
 * 조건은 화면과 **같게**(published + copyright_safe) 맞춘다. 갈라지면 없는 글의 카드를 그린다.
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

  const title = a?.title ?? 'Vocaflow'
  const source = a?.feed_label ?? a?.source ?? null
  const meta = [
    a?.cefr_level ?? null,
    a?.article_v_level != null ? `V${a.article_v_level}` : null,
    a?.word_count ? `${a.word_count.toLocaleString('en-US')} words` : null,
  ].filter(Boolean) as string[]

  /**
   * 한글이 실제로 있을 때만 한글 폰트를 싣는다.
   *
   * ⚠️ 무조건 실으면 **라틴 글자가 섞여 보인다.** 한글 폰트가 가진 라틴 글리프와 Satori 기본
   *    폰트가 글자마다 갈려서, 영어 제목이 `Pr**agu**e` 처럼 굵기가 들쭉날쭉해진다
   *    (2026-08-26 실측 — 첫 렌더가 그 상태였다).
   *    이 카드에 들어가는 것은 원문 제목·저자·출처라 대부분 영어다. 한글이 없으면
   *    기본 폰트 하나로 그리는 편이 고르다.
   */
  const font = /[가-힣]/.test(`${title}${a?.author ?? ''}${source ?? ''}`)
    ? await loadKoreanOgFont()
    : null

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: PAPER,
          padding: '64px 72px',
        }}
      >
        {/* 머리 — 어디의 글인지 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: ACCENT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: PAPER,
              fontSize: 24,
              fontWeight: 800,
            }}
          >
            V
          </div>
          <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: INK }}>Vocaflow</div>
          <div style={{ display: 'flex', fontSize: 20, color: FAINT }}>·</div>
          <div style={{ display: 'flex', fontSize: 20, color: MUTED }}>Dispatches</div>
        </div>

        {/* 제목 — 이 카드의 본체 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              fontSize: title.length > 60 ? 52 : 64,
              lineHeight: 1.15,
              fontWeight: 800,
              color: INK,
              letterSpacing: '-0.02em',
            }}
          >
            {title.length > 110 ? `${title.slice(0, 108)}…` : title}
          </div>
          {a?.author && (
            <div style={{ display: 'flex', fontSize: 26, color: MUTED }}>{a.author}</div>
          )}
        </div>

        {/* 발 — 난이도·분량·출처 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: `2px solid ${RULE}`,
            paddingTop: 22,
          }}
        >
          <div style={{ display: 'flex', gap: 18 }}>
            {meta.map((m) => (
              <div
                key={m}
                style={{
                  display: 'flex',
                  fontSize: 22,
                  color: MUTED,
                  border: `2px solid ${RULE}`,
                  borderRadius: 8,
                  padding: '6px 14px',
                }}
              >
                {m}
              </div>
            ))}
          </div>
          {source && (
            <div style={{ display: 'flex', fontSize: 20, color: FAINT }}>{source}</div>
          )}
        </div>
      </div>
    ),
    {
      ...size,
      ...(font
        ? { fonts: [{ name: 'KoreanOg', data: font, style: 'normal' as const, weight: 700 as const }] }
        : {}),
    },
  )
}
