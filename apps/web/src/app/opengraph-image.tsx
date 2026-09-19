// apps/web/src/app/opengraph-image.tsx
//
// 랜딩(`/`) 공유 카드 — 이미지 체계 manifest `og-root`(docs/design/asset-manifest.json · DD-36).
// 루트 layout 의 openGraph 에 images 가 없어 랜딩을 공유하면 글자만 나갔다. 공용 카드(og-card)에 모눈 무대를 입혀 쓴다.
// 문구는 랜딩 h1 과 같다(`app/page.tsx`) — 지어낸 수치 0(I5).

import { ImageResponse } from 'next/og'

import { OgCard, OG_SIZE, ogCardText, type OgCardProps } from '@/lib/seo/og-card'
import { loadKoreanOgFont } from '@/lib/seo/og-font'

export const runtime = 'edge'
export const alt = 'Vocaflow — 글이 어려운 게 아니라 내가 아는 비율이 다른 겁니다'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image() {
  const props: OgCardProps = {
    kind: '영어 읽기',
    title: '글이 어려운 게 아니라 내가 아는 비율이 다른 겁니다',
    subtitle: '붙여 넣은 글에서 내가 아는 낱말의 비율부터 봅니다',
    // 둘 다 공개 화면에 실제로 있는 사실 — 「가입 없이」(/fit 머리글 · /pricing CTA) · 학년 8단 V3~V10(lib/textfit/profile.ts LEVEL_LABEL 3~10)
    badges: ['가입 없이', '학년 8단 V3–V10'],
    source: null,
  }
  const font = await loadKoreanOgFont(ogCardText(props))
  return new ImageResponse(<OgCard {...props} />, {
    ...OG_SIZE,
    ...(font ? { fonts: [{ name: 'KoreanOg', data: font, style: 'normal' as const, weight: 700 as const }] } : {}),
  })
}
