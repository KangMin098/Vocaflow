// apps/web/src/lib/seo/og-card.tsx
//
// 공유 미리보기 카드의 **단일 출처** — 도서·만화·짧은 글이 같은 얼굴을 갖게 한다.
//
// 왜 모아 두나: 세 라우트가 각자 카드를 그리면 반드시 갈라진다. 이 저장소가 이름
// (`axes.ts`)·경로(`protected-routes.ts`)·수치(`trust-signals.ts`)·목록(`content-entries.ts`)에서
// 이미 네 번 겪은 모양이다. 공유 카드는 **브랜드가 처음 보이는 자리**라 갈라지면 더 티가 난다.
//
// ⚠️ Satori(ImageResponse) 제약: flex 레이아웃만, CSS 변수 없음, 웹폰트 별도 로드.
//    색을 여기서 하드코딩한다 — 이미지에는 테마가 없고 토큰이 닿지 않는다.
//    값은 `packages/design-tokens` 에서 손으로 옮겼다.
//
// ⚠️ **한글 폰트를 무조건 싣지 않는다.** 한글 폰트가 가진 라틴 글리프와 Satori 기본 폰트가
//    글자마다 갈려 영어 제목이 `Pr**agu**e` 처럼 굵기가 들쭉날쭉해진다(2026-08-26 실측 —
//    첫 렌더가 그 상태였다). 카드에 들어가는 것은 원문 제목·저자·출처라 대부분 영어다.
//    → `needsKoreanFont()` 로 **한글이 실제로 있을 때만** 싣는다.

import type { ReactElement } from 'react'

export const OG_SIZE = { width: 1200, height: 630 } as const

const INK = '#161A18'
const MUTED = '#5D6560'
const FAINT = '#8A928C'
const PAPER = '#F7F8F6'
const RULE = '#DDE3DE'
const ACCENT = '#2E7D5A'

export interface OgCardProps {
  /** 어느 서가인지 — 머리에 브랜드 옆으로 붙는다 (`Dispatches` · `Books` · `Vintage Comics`). */
  kind: string
  title: string
  /** 저자·연도 등 제목 아래 한 줄. */
  subtitle?: string | null
  /** 난이도·분량 같은 짧은 표식. 빈 값은 호출부에서 걸러 넘긴다. */
  badges?: string[]
  /** 오른쪽 아래 출처(아카이브·피드). */
  source?: string | null
}

/** 이 카드에 한글이 들어가는가 — 폰트를 실을지 판단한다. */
export function needsKoreanFont(p: OgCardProps): boolean {
  const text = [p.kind, p.title, p.subtitle ?? '', ...(p.badges ?? []), p.source ?? ''].join('')
  return /[가-힣]/.test(text)
}

/** 제목이 길면 줄인다 — Satori 는 말줄임을 안 해 주고 넘치면 잘려 나간다. */
function clampTitle(title: string): string {
  return title.length > 110 ? `${title.slice(0, 108)}…` : title
}

export function OgCard({ kind, title, subtitle, badges = [], source }: OgCardProps): ReactElement {
  return (
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
      {/* 머리 — 어느 서가의 것인지 */}
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
        <div style={{ display: 'flex', fontSize: 20, color: MUTED }}>{kind}</div>
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
          {clampTitle(title)}
        </div>
        {subtitle && <div style={{ display: 'flex', fontSize: 26, color: MUTED }}>{subtitle}</div>}
      </div>

      {/* 발 — 표식과 출처 */}
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
          {badges.map((b) => (
            <div
              key={b}
              style={{
                display: 'flex',
                fontSize: 22,
                color: MUTED,
                border: `2px solid ${RULE}`,
                borderRadius: 8,
                padding: '6px 14px',
              }}
            >
              {b}
            </div>
          ))}
        </div>
        {source && <div style={{ display: 'flex', fontSize: 20, color: FAINT }}>{source}</div>}
      </div>
    </div>
  )
}
