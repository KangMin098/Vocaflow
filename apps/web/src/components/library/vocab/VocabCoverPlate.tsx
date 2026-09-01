// apps/web/src/components/library/vocab/VocabCoverPlate.tsx
//
// **표지 도판 레이어 — 카드와 캐러셀이 같은 것을 그리게 한다.**
//
// ── 왜 뽑았나 (실측 2026-09-01) ─────────────────────────────────────
// 도판을 그리는 코드가 `VocabSetCard` 에만 있었다. 서가에서 **가장 큰 요소인 캐러셀**은
// 책 크롬(광택·그레인·책등·페이지 단면)은 그리면서 **도판만 빼고** 있었다.
//
// 그래서 DB 상 표지는 55/55 인데 학습자가 보는 화면은 **그라디언트 상자**였다.
// "표지를 붙였다" 는 보고와 "아직 시중 단어장이 아니다" 는 지적이 동시에 참이었던 이유다.
//
// 한 그림을 두 곳에서 따로 그리면 반드시 갈라진다 — 이 저장소가 `ladder_step` 에서
// 이미 한 번 치른 값이다(`scripts/vocab/reconcile-ladder.mts` 머리 주석).
//
// ── 왜 듀오톤인가 ───────────────────────────────────────────────────
// 도판 출처가 제각각이라(Flickr·Wikimedia·rawpixel) 채도·시대·선 밀도가 다 다르다.
// 그냥 얹으면 카탈로그가 스크랩북이 된다. 계열 색으로 눌러 두면 서로 다른 그림이
// **한 시리즈로** 읽히고, 색만 보고 "저건 원서 계열" 이 된다.
//
// 구현은 CSS 뿐이다 — 원본 링크를 그대로 쓰고 내려받아 가공하지 않는다(라이선스 안전).

import { FAMILY_GRAIN, type CoverFamily } from '@/lib/vcb/covers/design'

interface Props {
  /** 도판 URL. 없으면 아무것도 그리지 않는다 — 그라디언트 표지가 그대로 보인다. */
  url: string | null
  /** 계열 — 듀오톤 색이 여기서 온다. 모르면 `list` 로 떨어진다. */
  family: CoverFamily | null | undefined
  /**
   * 아래쪽 어둡기. 제목이 그림 위에서 읽혀야 하는데, 캐러셀은 제목이 더 크고 중앙에 있어
   * 카드보다 약하게 눌러야 그림이 산다.
   */
  scrim?: 'card' | 'hero'
}

const SCRIM = {
  card: 'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.05) 42%, rgba(0,0,0,0.55) 100%)',
  hero: 'linear-gradient(180deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.04) 46%, rgba(0,0,0,0.46) 100%)',
} as const

export function VocabCoverPlate({ url, family, scrim = 'card' }: Props) {
  if (!url) return null
  const duotone = family ? FAMILY_GRAIN[family] : FAMILY_GRAIN.list

  return (
    <div aria-hidden className="absolute inset-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- 외부 PD 도판. next/image 원격 허용 목록을 늘리지 않는다(출처가 4곳이고 더 늘어난다). */}
      <img
        src={url}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover opacity-90 [filter:grayscale(1)_contrast(1.15)]"
      />
      <div className="absolute inset-0 mix-blend-multiply" style={{ background: duotone.ink }} />
      <div
        className="absolute inset-0 opacity-[0.22] mix-blend-screen"
        style={{ background: duotone.paper }}
      />
      <div className="absolute inset-0" style={{ background: SCRIM[scrim] }} />
    </div>
  )
}
