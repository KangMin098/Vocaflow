// apps/web/src/components/illustrations/Illustration.tsx
//
// 삽화 한 점 — 방향 A 「원고지」(docs/design/03-system.md §3-9 · DD-30~36).
// 삽화는 **서명이 아니다**: 공개 화면 섹션 머리 · 빈 상태에만 둔다. 학습 중 화면 · ModuleHero 에는 두지 않는다(DD-25 · DD-26).
//
// 왜 인라인인가: 삽화의 색은 전부 CSS 변수(`var(--t1)` · `var(--ju)` …)라 <img> 로 넣으면 토큰을 못 받는다
// (다크 테마가 안 뒤집힌다). 그래서 SVG 문자열을 그대로 DOM 에 넣는다. 문자열은 저장소의 생성기가 만든 것뿐이다 —
// 사용자 입력이 섞이지 않는다(apps/web/src/components/illustrations/generated/*.ts, 드레인 import 가 쓴다).
// 폭은 규격이 정한다(S 240 · E 320 · B 640 — 상한), 높이는 viewBox 비율.

export interface IllustrationAsset {
  id: string
  size: 'S' | 'E' | 'B'
  svg: string
}

const MAX_W: Record<IllustrationAsset['size'], string> = {
  S: 'max-w-[240px]',
  E: 'max-w-[320px]',
  B: 'max-w-[640px]',
}

export function Illustration({
  asset,
  className = '',
  decorative = false,
}: {
  asset: IllustrationAsset
  className?: string
  /** 옆 문장이 같은 말을 하면 true — 스크린리더가 두 번 읽지 않게(§3-9 접근성). <title> 은 SVG 안에 남는다. */
  decorative?: boolean
}) {
  return (
    <span
      data-illo={asset.id}
      aria-hidden={decorative || undefined}
      className={`block w-full ${MAX_W[asset.size]} ${className}`}
      // 생성기 산출물만 들어온다(위 주석) — 외부 문자열 0
      dangerouslySetInnerHTML={{ __html: asset.svg }}
    />
  )
}
