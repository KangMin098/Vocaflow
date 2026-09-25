// apps/web/src/components/layout/AppHeader.tsx
//
// 학습자 셸의 **상단 메뉴**(DD-68 · tines-mapping §27) — 참조 사이트(Tines)의
// 「가운데 알약 다섯 + 옅은 면 한 장짜리 메가메뉴」 골격.
//
// ── 왜 위로 올렸나 ────────────────────────────────────────────────────────
// 사이드바는 1440 화면에서 **가로 240px(17%)** 를 상시 점유하면서 열세 개 주소를 늘 펴 놓고
// 있었다. 읽기·본문 화면은 그만큼 좁아졌는데(우리 학습의 주 화면이 본문이다) 정작 그 목록은
// 화면마다 같은 것을 반복했다. 상단 막대는 같은 IA 를 64px 한 줄에 담고, 깊이는
// **열 때만** 보여 준다(Progressive Disclosure).
//
// ── v08.7 — 「더 보기」를 없앴다 ─────────────────────────────────────────
// 체계·근거는 `top-nav-data.ts` 머리 주석. 여기서는 **모양**만 맡는다:
//   · 막대 = 로고 · 가운데 알약 다섯(Today · Library ▾ · Practice ▾ · CSAT · Growth ▾) · 오른쪽 Class
//   · 패널 = 옅은 면 **한 장**(메뉴마다 색이 다르다) 안에 2~3열, 열 사이 얇은 세로선,
//            첫 열은 큰 블록(제목 + 한 줄 + 그림), 나머지는 선 아이콘 목록(행 사이 얇은 가로선),
//            맨 아래 텍스트 링크 줄(참조 Resources 의 Events · Podcast … 자리).
//   · 원색 카드(1차 구현)는 쓰지 않는다 — 참조의 이 메뉴들은 **면 하나 + 구분선**이다.
//
// ── 지킨 것 ──────────────────────────────────────────────────────────────
// · 항목·주소·순서·`owns` 의 정본은 `sidebar-config.ts`(여기서 목록을 새로 적지 않는다).
// · 흐름 다섯 단계의 **번호 = 순서**. 진도도 자격도 잠금도 아니다(LEARNING_FRAMEWORK §4①).
// · 만화는 열 밖 · 번호 밖(하단 링크 줄) — 학습 단계가 아니라 읽는 방식이다.
// · 현재 위치 표식은 화면 전체에 **정확히 하나**(`nav-match.ts` 의 `pickCurrent`).
//
// ── 왜 모바일에는 그리지 않나 ────────────────────────────────────────────
// 사이드바도 `hidden md:flex` 였다. 폰의 셸은 이미 세 줄(유틸리티 바 · 나침반 띠 · 하단 탭)이고,
// 그 위에 메가메뉴 서랍을 더하면 같은 주소가 두 벌이 된다(`MobileUtilityBar` 머리 주석의
// "같은 링크가 두 번" 문제). 폰의 길은 하단 탭 + 유틸리티 바가 그대로 맡는다.

'use client'

import { ArrowRight, ArrowUpRight, ChevronDown, type LucideIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { isFullScreenRoute } from '@/lib/layout/full-screen-routes'

import { pickCurrent } from './nav-match'
import {
  BAR_ENTRIES,
  CLASS_ENTRY,
  TOP_ENTRIES,
  allEntryItems,
  type MenuPanel,
  type PanelFeature,
  type PanelRow,
  type Step,
  type TopEntry,
} from './top-nav-data'

const ILLO = '/illustrations/tines'
const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg)]'
/** 모노 대문자 눈썹 — 참조 「BY TEAM」 자리 */
const EYEBROW = 'font-mono text-[11px] font-[700] uppercase tracking-[0.07em] text-[var(--t1)]'
/** 면 위의 얇은 선 — 열 사이 세로선 · 행 사이 가로선(참조는 면 글자색의 아주 옅은 값) */
const HAIRLINE = 'color-mix(in srgb, var(--t1) 14%, transparent)'

export function AppHeader() {
  const pathname = usePathname() ?? ''
  // `/text?view=` 자식의 활성 판정용 — (main) 세그먼트는 레이아웃이 쿠키를 읽어 전부 동적이라
  // 정적 프리렌더 Suspense 요건에 걸리지 않는다.
  const searchParams = useSearchParams()
  const [open, setOpen] = useState<string | null>(null)
  const root = useRef<HTMLElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const baseId = useId()

  const close = useCallback(() => setOpen(null), [])

  // 사이드바가 쓰던 자리 폭을 0 으로 알린다 — fixed 오버레이(하단 player)가
  // `md:left-[var(--sidebar-w,240px)]` 로 그 값을 읽는다. 안 넣으면 기본값 240px 만큼
  // 화면 왼쪽이 비어 보인다(`components/workspace/FloatingAudioPlayer`).
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', '0px')
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
    }
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [])

  // 화면을 옮기면 닫는다 — 열린 채로 남으면 다음 화면 위에 패널이 떠 있다.
  useEffect(() => {
    setOpen(null)
  }, [pathname])

  // 학습 세션(풀스크린)에서는 셸을 걷어낸다 — 나침반 띠 · 하단 탭과 **같은 판정**.
  if (isFullScreenRoute(pathname)) return null

  const hoverOpen = (key: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(key)
  }
  // 단추에서 패널로 마우스가 내려가는 사이에 닫히지 않게 조금 기다린다(참조와 같은 140ms).
  const hoverClose = () => {
    closeTimer.current = setTimeout(() => setOpen(null), 140)
  }

  /** 현재 위치를 말할 주소 — 막대·패널을 통틀어 하나만 고른다. */
  const current = pickCurrent(pathname, allEntryItems(), searchParams)
  /** 그 주소를 품은 막대 칸(메뉴 포함) */
  const hereKey = entryHolding(current)

  return (
    <header
      ref={root}
      aria-label="주 메뉴"
      onMouseLeave={hoverClose}
      className="sticky top-0 z-40 hidden border-b border-[var(--bd)] bg-[var(--bg)] md:block"
    >
      <div className="mx-auto flex h-[64px] w-full max-w-[1600px] items-center gap-3 px-4 lg:px-6">
        {/* 로고 — 라틴은 Lora, 뒤에 주묵 권점 하나(사이드바 머리에서 그대로 옮겼다). */}
        <div className="flex min-w-0 flex-1 items-center">
          <Link
            href="/hub"
            aria-label="Vocaflow 홈"
            className={`flex min-h-[44px] shrink-0 items-center gap-2.5 rounded-full pr-2 transition-opacity duration-[var(--dur-normal)] hover:opacity-90 ${FOCUS}`}
          >
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] bg-[var(--ju)] font-english text-[16px] font-[500] leading-none text-[var(--on-ju)]"
            >
              V
            </span>
            <span className="hidden font-english text-[18px] font-[500] tracking-[0.01em] text-[var(--t1)] lg:inline">
              Vocaflow
              <span
                aria-hidden
                className="ml-[3px] inline-block h-[5px] w-[5px] rounded-full bg-[var(--ju)] align-[3px]"
              />
            </span>
          </Link>
        </div>

        {/* 가운데 알약 다섯 — 참조의 `SiteNav` 와 같은 자리. 순서가 곧 화면의 순서다. */}
        <nav
          aria-label="주요 화면 메뉴"
          className="flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--bg2)] px-1.5 py-1"
        >
          {BAR_ENTRIES.map((e) => (
            <BarEntry
              key={e.key}
              entry={e}
              current={current}
              hereKey={hereKey}
              open={open}
              baseId={baseId}
              onOpen={hoverOpen}
              onToggle={setOpen}
              onNavigate={close}
            />
          ))}
        </nav>

        {/* 오른쪽 — 참조의 「Book a demo」 자리. 학습자 동선이 아니라 역할이 바뀌는 곳이라
            가운데 다섯에 끼우지 않는다. */}
        <div className="flex min-w-0 flex-1 items-center justify-end">
          <Link
            href={CLASS_ENTRY.kind === 'link' ? CLASS_ENTRY.item.href : '/teacher'}
            aria-current={
              CLASS_ENTRY.kind === 'link' && current === CLASS_ENTRY.item.href ? 'page' : undefined
            }
            aria-label={CLASS_ENTRY.kind === 'link' ? CLASS_ENTRY.item.ariaLabel : undefined}
            onMouseEnter={close}
            className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border border-[var(--ju)] px-4 font-display text-[13.5px] font-[600] text-[var(--ju)] transition-colors duration-[var(--dur-quick)] hover:bg-[var(--ju)] hover:text-[var(--on-ju)] ${FOCUS}`}
          >
            {CLASS_ENTRY.label}
            <ArrowUpRight size={14} aria-hidden className="shrink-0" />
          </Link>
        </div>
      </div>

      {/* 메가메뉴 — 막대 바로 아래, 화면 위로 뜬다. 닫혀 있어도 DOM 에 남는다(`hidden`):
          링크가 사라지지 않아야 스크린리더가 목록을 잃지 않고, 회귀 테스트도 주소를 셀 수 있다. */}
      {TOP_ENTRIES.filter((e) => e.kind === 'menu').map((e) =>
        e.kind === 'menu' ? (
          <div
            key={e.key}
            id={`${baseId}-${e.key}`}
            hidden={open !== e.key}
            onMouseEnter={() => hoverOpen(e.key)}
            className="absolute inset-x-0 top-full px-4 pb-6 lg:px-6"
          >
            <Panel
              panel={e.panel}
              label={e.label}
              says={e.says}
              current={current}
              onNavigate={close}
            />
          </div>
        ) : null,
      )}
    </header>
  )
}

/** 지금 위치를 품은 막대 칸의 key — 메뉴 칸은 **자기 패널 안의 주소까지** 자기 것으로 센다. */
function entryHolding(current: string | null): string | null {
  if (!current) return null
  for (const e of TOP_ENTRIES) {
    if (e.kind === 'link') {
      if (e.item.href === current) return e.key
      continue
    }
    if (allEntryItems([e]).some((i) => i.href === current)) return e.key
  }
  return null
}

// ── 막대 한 칸 — 링크이거나, 패널을 여는 단추이거나 ─────────────────────────
interface BarEntryProps {
  entry: TopEntry
  current: string | null
  hereKey: string | null
  open: string | null
  baseId: string
  onOpen: (key: string) => void
  onToggle: (fn: (prev: string | null) => string | null) => void
  onNavigate: () => void
}

function BarEntry({
  entry,
  current,
  hereKey,
  open,
  baseId,
  onOpen,
  onToggle,
  onNavigate,
}: BarEntryProps) {
  const here = hereKey === entry.key
  // 지금 있는 구역은 **면**이 찬다(참조도 고른 알약만 면을 갖는다). 색만으로 알리지 않으므로
  // 글자도 굵어지고, 메뉴 칸에는 sr-only 「(현재 구역)」 이 붙는다.
  const base = `inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-full px-3.5 font-display text-[14px] transition-colors duration-[var(--dur-quick)] ${
    here
      ? 'bg-[var(--bg)] font-[700] text-[var(--t1)] shadow-[var(--sh-sm)]'
      : 'font-[500] text-[var(--t2)] hover:bg-[color-mix(in_srgb,var(--t1)_7%,transparent)] hover:text-[var(--t1)]'
  } ${FOCUS}`

  if (entry.kind === 'link') {
    return (
      <Link
        href={entry.item.href}
        aria-current={current === entry.item.href ? 'page' : undefined}
        aria-label={entry.item.ariaLabel ?? entry.label}
        title={entry.says}
        onMouseEnter={() => onToggle(() => null)}
        onClick={onNavigate}
        className={base}
      >
        {entry.label}
      </Link>
    )
  }

  const expanded = open === entry.key
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={`${baseId}-${entry.key}`}
      onMouseEnter={() => onOpen(entry.key)}
      onClick={() => onToggle((o) => (o === entry.key ? null : entry.key))}
      className={base}
    >
      {entry.label}
      {here && <span className="sr-only">(현재 구역)</span>}
      <ChevronDown
        size={13}
        aria-hidden
        className={`shrink-0 transition-transform duration-[var(--dur-quick)] ${
          expanded ? 'rotate-180' : ''
        }`}
      />
    </button>
  )
}

// ── 패널 — 옅은 면 한 장 + 열 + 얇은 선(참조 Solutions · Resources · Company 공통 골격) ──
function Panel({
  panel,
  label,
  says,
  current,
  onNavigate,
}: {
  panel: MenuPanel
  label: string
  says?: string
  current: string | null
  onNavigate: () => void
}) {
  return (
    <div
      className={`${panel.tone} mx-auto w-full max-w-[1040px] rounded-[22px] p-5 motion-safe:animate-[vf-dropdown-in_var(--dur-slow)_var(--ease-out-quint)_both]`}
    >
      {/* 참조에는 패널 제목 줄이 없다 — 왼쪽 위 눈썹이 그 일을 한다. 우리도 머리를 따로 두지 않고
          **첫 열의 눈썹 아래**에 그 구역이 하는 일 한 줄을 붙인다(아래 `says`). */}
      <div className="flex items-stretch">
        {panel.columns.map((c, i) => (
          <div
            key={c.eyebrow}
            className={`min-w-0 ${c.wide ? 'flex-[1.5]' : 'flex-1'} ${i > 0 ? 'pl-5' : ''}`}
            style={i > 0 ? { borderLeft: `1px solid ${HAIRLINE}` } : undefined}
          >
            <p
              className={`${EYEBROW} flex items-center gap-1.5 px-1 ${
                i === 0 && says ? '' : 'mb-2'
              }`}
            >
              {c.step && <StepBadge step={c.step} />}
              {c.eyebrow}
              {/* 열만 훑는 스크린리더가 어느 메뉴 안인지 잃지 않게 — 화면에는 나오지 않는다. */}
              <span className="sr-only">{` — ${label}`}</span>
            </p>
            {/* 그 구역이 하는 일 — 첫 열에서 한 번만. 열마다 붙이면 설명서가 된다. */}
            {i === 0 && says && (
              <p className="mb-2 mt-1 break-keep px-1 font-body text-[12.5px] leading-snug text-[var(--t1)] opacity-75">
                {says}
              </p>
            )}
            {c.features.map((f) => (
              <Feature key={f.item.href} feature={f} current={current} onNavigate={onNavigate} />
            ))}
            {c.rows.length > 0 && (
              <ul>
                {c.rows.map((r, n) => (
                  <li key={r.item.href}>
                    <Row
                      row={r}
                      last={n === c.rows.length - 1}
                      current={current}
                      onNavigate={onNavigate}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* 하단 텍스트 링크 줄 — 참조 Resources 의 「Events · Podcast · Webinars …」.
          열 밖 · 번호 밖이라 흐름 단계로 읽히지 않는다(만화가 여기 산다). */}
      {panel.links && (
        <div
          className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 pt-3"
          style={{ borderTop: `1px solid ${HAIRLINE}` }}
        >
          <span className={`${EYEBROW} opacity-70`}>{panel.links.eyebrow}</span>
          {panel.links.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current === item.href ? 'page' : undefined}
              aria-label={item.ariaLabel ?? item.label}
              onClick={onNavigate}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-2 font-display text-[13.5px] text-[var(--t1)] transition-colors hover:bg-[color-mix(in_srgb,var(--t1)_10%,transparent)] ${
                current === item.href ? 'font-[700]' : 'font-[500]'
              } ${FOCUS}`}
            >
              {item.label}
              <ArrowRight size={13} aria-hidden className="shrink-0 opacity-70" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

/** 흐름 번호 — 순서이지 진도가 아니다. 화면에선 배지가, 스크린리더에선 문장이 말한다. */
function StepBadge({ step }: { step: Step }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="inline-flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border font-mono text-[9.5px] font-[700] tabular-nums"
        style={{
          borderColor: `color-mix(in srgb, ${step.accent} 60%, transparent)`,
          color: step.accent,
          backgroundColor: `color-mix(in srgb, ${step.accent} 12%, transparent)`,
        }}
      >
        {step.n}
      </span>
      {/* 「잠김/불가」 류 어휘를 쓰지 않는다 — 막는 것이 아니라 순서다. */}
      <span className="sr-only">{`흐름 ${step.n}번째 · ${step.stage} · `}</span>
    </>
  )
}

/** 큰 블록 — 제목 + 한 줄 + 그림(참조 첫 열의 「By product」 자리). */
function Feature({
  feature,
  current,
  onNavigate,
}: {
  feature: PanelFeature
  current: string | null
  onNavigate: () => void
}) {
  const isCurrent = current === feature.item.href
  return (
    <Link
      href={feature.item.href}
      aria-current={isCurrent ? 'page' : undefined}
      aria-label={feature.item.ariaLabel ?? feature.title}
      onClick={onNavigate}
      className={`group relative flex min-h-[112px] items-start gap-3 rounded-[14px] p-3 pr-2 text-[var(--t1)] transition-colors hover:bg-[color-mix(in_srgb,var(--t1)_8%,transparent)] ${
        isCurrent ? 'bg-[color-mix(in_srgb,var(--t1)_10%,transparent)]' : ''
      } ${FOCUS}`}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {feature.step && <StepBadge step={feature.step} />}
          <span className="break-keep font-serif text-[21px] font-[500] leading-tight">
            {feature.title}
          </span>
          {isCurrent && (
            <span className="ml-1 inline-flex h-[18px] items-center rounded-full bg-[color-mix(in_srgb,var(--t1)_18%,transparent)] px-1.5 font-mono text-[9.5px] font-[700] uppercase tracking-[0.04em]">
              지금
            </span>
          )}
        </span>
        <span className="mt-1.5 block max-w-[30ch] break-keep font-body text-[12.5px] leading-snug opacity-85">
          {feature.body}
        </span>
        <span className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] font-[700] uppercase tracking-[0.04em] opacity-0 transition-opacity duration-[var(--dur-quick)] group-hover:opacity-80">
          열기 {feature.arrow === 'out' ? <ArrowUpRight size={12} /> : <ArrowRight size={12} />}
        </span>
      </span>
      {feature.art && (
        <Image
          loading="eager"
          src={`${ILLO}/${feature.art}.webp`}
          alt=""
          width={1328}
          height={1328}
          className="mt-1 w-[76px] shrink-0 select-none rounded-[12px]"
        />
      )}
    </Link>
  )
}

/** 목록 행 — 선 아이콘 + 제목 + 한 줄. 행 사이 얇은 가로선(참조와 같다). 누르는 자리 44px. */
function Row({
  row,
  last,
  current,
  onNavigate,
}: {
  row: PanelRow
  last: boolean
  current: string | null
  onNavigate: () => void
}) {
  const isCurrent = current === row.item.href
  const Icon: LucideIcon = row.item.icon
  return (
    <Link
      href={row.item.href}
      aria-current={isCurrent ? 'page' : undefined}
      aria-label={row.item.ariaLabel ?? row.title}
      onClick={onNavigate}
      className={`flex min-h-[44px] items-start gap-2.5 rounded-[10px] px-2 py-2.5 text-[var(--t1)] transition-colors hover:bg-[color-mix(in_srgb,var(--t1)_9%,transparent)] ${
        isCurrent ? 'bg-[color-mix(in_srgb,var(--t1)_11%,transparent)]' : ''
      } ${FOCUS}`}
      style={last ? undefined : { borderBottom: `1px solid ${HAIRLINE}` }}
    >
      <span className="mt-[3px] inline-flex shrink-0 items-center gap-1.5">
        {row.step ? <StepBadge step={row.step} /> : <Icon size={15} strokeWidth={1.75} aria-hidden />}
      </span>
      <span className="min-w-0">
        <span
          className={`block font-display text-[13.5px] leading-tight ${
            isCurrent ? 'font-[700]' : 'font-[600]'
          }`}
        >
          {row.title}
          {isCurrent && <span className="sr-only"> (현재 화면)</span>}
        </span>
        {row.body && (
          <span className="mt-0.5 block break-keep font-body text-[12px] leading-snug opacity-80">
            {row.body}
          </span>
        )}
      </span>
    </Link>
  )
}
