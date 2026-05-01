// apps/web/src/app/(main)/wordblitz/page.tsx

import { StubPage } from '@/components/dev/StubPage'

export default function WordBlitzPage() {
  return (
    <StubPage
      title="WordBlitz"
      description="타임어택 4지선다 게임 · 정글 어드벤처 테마 · 콤보 시스템"
      upcoming={[
        '정글 배경 · SVG 크리처 4종 (creatureBob 애니메이션)',
        'Fredoka One 타이틀 · #FFE234 점수 텍스트',
        'HUD — 타이머 바 · 콤보 점 4개',
        '4지선다 — 정답 correctPop / 오답 wrongShake',
        '파티클 fly + starSpin',
      ]}
    />
  )
}
