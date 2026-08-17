// apps/web/src/app/(marketing)/fit/s/[payload]/opengraph-image.tsx
//
// 공유 링크 미리보기 이미지 — **그 결과의 곡선**을 그린다.
//
// ⚠️ 이 파일이 `/fit` 이 아니라 `/fit/s/[payload]` 아래 있는 이유:
//    `opengraph-image.tsx` 는 **라우트 세그먼트(`params`)만 받고 `searchParams` 는 못 받는다.**
//    `/fit?r=` 로 두면 크롤러가 가져가는 og:image URL 에 페이로드가 실리지 않아
//    이 이미지가 결과를 볼 수 없다(2026-08-17 실측 — 생성된 og:image URL 에 `r=` 이 없었다).
//
// 왜 만드나:
//   공유는 이 제품의 유일한 확산 경로인데(교사 → 교사, CAC 0), 메신저에 링크를 붙였을 때
//   그림 없는 카드가 뜨면 "눌러 봐야 아는" 상태가 된다. 그 한 번의 마찰이 확산 계수를 깎는다.
//   제목·설명은 이미 `generateMetadata` 가 결과로 바꾼다. 여기서는 **숫자를 그림으로** 보여준다.
//
// 지문은 그리지 않는다 — 페이로드에 애초에 없다(`share.ts` §지문 유출 금지).
// 그릴 수 있는 것은 커버리지 곡선과 낱말뿐이고, 그것이 정확히 공유해도 되는 것이다.
//
// ⚠️ Satori(ImageResponse) 제약: flex 레이아웃만, CSS 변수 없음, 웹폰트는 별도 로드.
//    그래서 색을 **여기서 하드코딩**한다 — 이미지에는 테마가 없고 토큰도 닿지 않는다.
//    값은 `packages/design-tokens` 의 Memory Decay 4색과 같은 것을 손으로 옮겼다.

import { ImageResponse } from 'next/og'

import { loadKoreanOgFont } from '@/lib/seo/og-font'
import { BAND_THRESHOLDS } from '@/lib/textfit/coverage'
import { LEVEL_LABEL } from '@/lib/textfit/profile'
import { decodeProfile } from '@/lib/textfit/share'
import type { FitBand } from '@/lib/textfit/types'

// Edge 런타임 — `@vercel/og` 의 권장 구성이자, Node 런타임에서 나던 **Windows 폰트 경로 버그**
// 를 피한다. Node 에서는 Next 가 번들한 기본 폰트를 ERR_INVALID_URL 로 못 읽어 이미지가 통째로
// 500 이 났다 — `fonts` 를 명시 주입해도 마찬가지였다(기본 폰트를 무조건 먼저 건드린다).
// Edge 로 바꾸니 200 · 49.8 KB (2026-08-17 실측).
export const runtime = 'edge'
export const alt = '지문 난이도 진단 — 학년별 어휘 커버리지'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Memory Decay 4색 (tokens.css 와 같은 값 — 이미지에는 CSS 변수가 닿지 않는다). */
const INK = '#161A18'
const MUTED = '#5D6560'
const FAINT = '#8A928C'
const PAPER = '#F7F8F6'
const RULE = '#DDE3DE'
const BAND_COLOR: Record<FitBand, string> = {
  flow: '#2E7D5A',
  growth: '#2E7D5A',
  study: '#B5803A',
  hard: '#B5803A',
  overload: '#9C3A30',
}

const SCALE_MIN = 0.7
const pos = (c: number) => Math.min(100, Math.max(0, ((c - SCALE_MIN) / (1 - SCALE_MIN)) * 100))

export default async function Image({ params }: { params: { payload: string } }) {
  // 페이로드가 망가졌어도 이미지는 **반드시 나와야 한다** — 미리보기가 깨진 링크는
  // 아무도 누르지 않는다. 해독 실패 시 일반 소개 카드로 떨어진다.
  const profile = decodeProfile(params.payload)

  // Satori 기본 폰트는 라틴 전용이라 한글이 빈칸으로 나온다. 폰트를 명시 주입한다.
  // 실패하면 `null` — 폰트 없이라도 렌더한다(숫자·곡선은 그대로 나온다).
  const koreanFont = await loadKoreanOgFont()

  // 화면용 문장(`profileHeadline`)을 그대로 쓰면 한 줄에 안 들어가 다음 블록과 겹친다 —
  // Satori 는 넘친 텍스트를 잘라 주지 않고 그냥 겹쳐 그린다(2026-08-17 실측).
  // 그래서 카드에는 **주어를 뺀 짧은 형태**를 쓴다. 뜻은 같고 한 줄에 들어간다.
  const headline = !profile
    ? '이 지문, 우리 반에 맞을까?'
    : profile.fitLevel !== null
      ? `${LEVEL_LABEL[profile.fitLevel]} 수준이면 편하게 읽혀요`
      : '고등 교육과정을 넘는 지문이에요'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: PAPER,
          padding: '64px 72px',
          fontFamily: koreanFont ? 'NotoSansKR' : 'sans-serif',
        }}
      >
        {/* 머리 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              width: 34,
              height: 34,
              borderRadius: 9,
              background: INK,
            }}
          />
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, color: INK }}>Vocaflow</div>
          <div style={{ display: 'flex', fontSize: 22, color: FAINT, marginLeft: 6 }}>
            지문 난이도 진단
          </div>
        </div>

        {/* 한 줄 답 */}
        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 46,
            fontWeight: 800,
            lineHeight: 1.25,
            color: INK,
            letterSpacing: '-0.02em',
            flexShrink: 0,
          }}
        >
          {headline}
        </div>

        {/* 곡선 — 결과가 있을 때만 */}
        {profile ? (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 26, gap: 8 }}>
            {profile.readings.map((r) => {
              const color = BAND_COLOR[r.band]
              const isFit = profile.fitLevel === r.level
              return (
                <div key={r.level} style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  <div
                    style={{
                      display: 'flex',
                      width: 190,
                      fontSize: 21,
                      fontWeight: isFit ? 700 : 400,
                      color: isFit ? color : MUTED,
                    }}
                  >
                    {LEVEL_LABEL[r.level]}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      width: 640,
                      height: 22,
                      background: '#EDF0EC',
                      borderRadius: 5,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        width: `${pos(r.coverage)}%`,
                        height: '100%',
                        background: color,
                        opacity: isFit ? 0.95 : 0.4,
                        borderRadius: 5,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      width: 96,
                      fontSize: 21,
                      fontWeight: 700,
                      color: isFit ? color : MUTED,
                    }}
                  >
                    {(r.coverage * 100).toFixed(1)}%
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', marginTop: 30, fontSize: 26, color: MUTED, maxWidth: 900 }}>
            교과서 지문이든 수업 프린트든 붙여넣으면 됩니다. 가입도, 설치도 필요 없어요.
          </div>
        )}

        {/* 꼬리 */}
        <div
          style={{
            display: 'flex',
            marginTop: 'auto',
            paddingTop: 24,
            borderTop: `1px solid ${RULE}`,
            fontSize: 20,
            color: FAINT,
          }}
        >
          {profile
            ? `기준 ${(BAND_THRESHOLDS.growth * 100).toFixed(0)}% = 편하게 읽히는 구간 · Hu & Nation (2000)`
            : 'vocaflow.app/fit — 로그인 없이, 저장하지 않고'}
        </div>
      </div>
    ),
    {
      ...size,
      // 폰트를 못 받았으면 옵션을 아예 안 넘긴다 — 빈 배열은 Satori 가 기본 폰트를 찾게 만든다.
      ...(koreanFont
        ? { fonts: [{ name: 'NotoSansKR', data: koreanFont, weight: 700 as const, style: 'normal' as const }] }
        : {}),
    },
  )
}
