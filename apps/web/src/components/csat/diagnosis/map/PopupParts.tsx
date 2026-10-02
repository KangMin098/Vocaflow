// apps/web/src/components/csat/diagnosis/map/PopupParts.tsx
//
// 학습 지도 팝업 부품 — 참조(3B 앱)의 팝업 패턴을 부품으로: 배너(+ 옅은 노드 그림 · 알약 버튼) · 카드 · 검색창 ·
// 목록 박스(아이콘 타일 + 두 줄 글 + 오른쪽 칩) · 칩(아이콘 · 톤) · 표 머리. 패턴 목록: docs/design/refs/3b/access-map/popup-patterns.md

'use client'

import { Search } from 'lucide-react'
import type { ReactNode } from 'react'

import p from './popup.module.css'

export type ChipTone = 'neutral' | 'good' | 'warn' | 'bad' | 'ink'

export function Chip({ tone = 'neutral', icon, children, title }: { tone?: ChipTone; icon?: ReactNode; children: ReactNode; title?: string }) {
  const toneClass = tone === 'good' ? p.chipGood : tone === 'warn' ? p.chipWarn : tone === 'bad' ? p.chipBad : tone === 'ink' ? p.chipInk : ''
  return (
    <span className={`${p.chip} ${toneClass}`} title={title}>
      {icon}
      {children}
    </span>
  )
}

/** 카드 — 제목 + 작은 회색 설명 + 본문(참조의 옅은 바탕 둥근 카드) */
export function Card({ title, desc, right, children }: { title: string; desc?: string; right?: ReactNode; children?: ReactNode }) {
  return (
    <section className={p.card} data-map-card="">
      <div className={p.cardHead}>
        <div>
          <div className={p.cardTitle}>{title}</div>
          {desc && <div className={p.cardDesc}>{desc}</div>}
        </div>
        {right}
      </div>
      {children !== undefined && <div className={p.cardBody}>{children}</div>}
    </section>
  )
}

/** 배너 — 옅은 노드 그림이 깔린 한 줄 카드. 오른쪽 흰 알약 버튼(예: 「지도에서 경로 보기」) */
export function Banner({ title, desc, actionLabel, actionIcon, onAction }: { title: string; desc: string; actionLabel: string; actionIcon?: ReactNode; onAction: () => void }) {
  return (
    <section className={p.banner} data-map-card="">
      <BannerArt />
      <div className={p.bannerText}>
        <div className={p.cardTitle}>{title}</div>
        <div className={p.cardDesc}>{desc}</div>
      </div>
      <button type="button" className={p.whitePill} onClick={onAction}>
        {actionIcon}
        {actionLabel}
      </button>
    </section>
  )
}

/** 배너 바탕 — 옅은 노드 사각형과 점선 곡선(참조의 Access map 배너). 장식이라 스크린리더에서 뺀다 */
export function BannerArt() {
  return (
    <svg className={p.bannerArt} viewBox="0 0 600 120" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <path d="M180 28 C 230 28, 240 70, 290 72" stroke="#e2dfdb" fill="none" />
      <path d="M300 40 C 360 38, 372 78, 420 84" stroke="#e2dfdb" fill="none" strokeDasharray="4 4" />
      <path d="M120 98 C 220 96, 330 108, 520 66" stroke="#e8e5e1" fill="none" />
      <rect x="248" y="8" width="110" height="26" rx="7" fill="#f1eeea" />
      <rect x="330" y="52" width="96" height="24" rx="7" fill="#efece8" />
      <rect x="440" y="78" width="130" height="28" rx="7" fill="#f0ede9" />
      <rect x="150" y="70" width="80" height="22" rx="7" fill="#f3f0ec" />
    </svg>
  )
}

export function SearchBox({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <label className={p.search}>
      <Search size={16} strokeWidth={1.8} aria-hidden="true" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
    </label>
  )
}

/** 목록 박스 — 흰 박스 안에 줄로 나뉜 행(참조의 Access · Members 목록) */
export function ListBox({ head, children }: { head?: string[]; children: ReactNode }) {
  return (
    <div className={p.listBox}>
      {head && (
        <div className={p.listHead} style={{ gridTemplateColumns: `1.4fr repeat(${Math.max(head.length - 1, 1)}, 1fr)` }}>
          {head.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
      )}
      {children}
    </div>
  )
}

export function ListRow({
  tile,
  tileTone = 'neutral',
  title,
  sub,
  right,
  onClick,
  leading,
}: {
  tile?: ReactNode
  tileTone?: 'neutral' | 'teal' | 'pink' | 'sky' | 'purple'
  title: ReactNode
  sub?: ReactNode
  right?: ReactNode
  onClick?: () => void
  /** 타일 앞의 조작(체크박스 등) */
  leading?: ReactNode
}) {
  const tileClass = tileTone === 'teal' ? p.tileTeal : tileTone === 'pink' ? p.tilePink : tileTone === 'sky' ? p.tileSky : tileTone === 'purple' ? p.tilePurple : ''
  const body = (
    <>
      {leading}
      {tile && <span className={`${p.rowTile} ${tileClass}`} aria-hidden="true">{tile}</span>}
      <span className={p.rowText}>
        <span className={p.rowTitle}>{title}</span>
        {sub && <span className={p.rowSub}>{sub}</span>}
      </span>
      {right && <span className={p.rowRight}>{right}</span>}
    </>
  )
  return onClick ? (
    <button type="button" className={`${p.row} ${p.rowBtn}`} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={p.row}>{body}</div>
  )
}

/** 큰 막대 — 채움 = 지금 · 눈금 = 목표 */
export function BigMeter({ rate, target, tone }: { rate: number | null; target: number | null; tone: 'met' | 'near' | 'short' | 'muted' }) {
  return (
    <div className={p.bigMeter} role="img" aria-label="성취율 막대">
      {rate !== null && <span className={`${p.bigFill} ${tone === 'met' ? p.fMet : tone === 'near' ? p.fNear : tone === 'short' ? p.fShort : ''}`} style={{ width: `${Math.min(100, rate * 100)}%` }} />}
      {target !== null && <span className={p.bigTick} style={{ left: `${Math.min(100, target * 100)}%` }} />}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className={p.empty}>{children}</p>
}
