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
// ⚠️ **두 폰트가 같은 글자를 가지면 한 단어 안에서 굵기가 갈린다.** 영어 제목이
//    `Pr**agu**e` · `A Chr**ist**mas Carol` 처럼 나왔다(2026-08-26 실측, 두 번).
//    처음엔 "한글이 있을 때만 싣기" 로 막았는데, 한글 배지가 하나만 있어도 다시 실리므로
//    반쪽이었다. 지금은 `loadKoreanOgFont` 가 **한글만** 받아 두 폰트의 범위가 겹치지 않는다.
//    → 호출부는 `ogCardText(props)` 를 넘기기만 하면 된다(판정도 로더 안에 있다).

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

/**
 * 이 카드에 그려질 **모든 글자** — 폰트 서브셋 요청에 그대로 넘긴다.
 *
 * 손으로 유지하는 글자 목록을 두지 않는 이유: 빠진 글자는 오류 없이 **조용히 사라진다.**
 * 카드가 아는 것을 카드가 넘기면 잊을 일이 없다.
 */
export function ogCardText(p: OgCardProps): string {
  return [p.kind, p.title, p.subtitle ?? '', ...(p.badges ?? []), p.source ?? ''].join('')
}

/**
 * 제목이 길면 줄인다 — Satori 는 말줄임을 안 해 준다.
 *
 * 상한 110자의 근거(2026-08-26 실측): 카탈로그에서 가장 긴 제목은 **218자** 짜리 논문 글이다
 * (`Sepsis neonatorum: …`). 110자로 자르면 52px 에서 **세 줄**이 되고 부제·표식과 겹치지 않는다.
 * 발행 도서 최대 48자·복원 만화 최대 24자는 애초에 걸리지 않는다.
 */
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

      {/*
        제목 — 이 카드의 본체.

        ⚠️ 이 안쪽 div 에 `display: 'flex'` 를 주지 않는다. 주면 글자 전체가 **하나의 flex 항목**이
           되어 줄바꿈 없이 한 줄로 뻗고, 카드 오른쪽 밖으로 잘려 나간다(2026-08-26 실측 —
           `ATOMIC WAR! No. 1 - Comic Book, 1952` 가 `… Issue #1` 에서 끊겼다).
           `flexWrap`·`maxWidth`·`width` 로는 안 고쳐진다. 텍스트 컨테이너로 두어야 흐른다.
      */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: '100%' }}>
        <div
          style={{
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
