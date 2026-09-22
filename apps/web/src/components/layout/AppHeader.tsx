// apps/web/src/components/layout/AppHeader.tsx
//
// 학습자 셸의 **상단 메뉴**(DD-68 · tines-mapping §27) — 왼쪽 240px 레일을 걷어내고
// 참조 사이트(Tines)의 막대 + 메가메뉴 골격으로 옮긴 것이다.
//
// ── 왜 위로 올렸나 ────────────────────────────────────────────────────────
// 사이드바는 1440 화면에서 **가로 240px(17%)** 를 상시 점유하면서 열세 개 주소를 늘 펴 놓고
// 있었다. 읽기·본문 화면은 그만큼 좁아졌는데(우리 학습의 주 화면이 본문이다) 정작 그 목록은
// 화면마다 같은 것을 반복했다. 상단 막대는 같은 IA 를 60px 세로 한 줄에 담고, 깊이는
// **열 때만** 보여 준다(Progressive Disclosure — DESIGN.md 방향 ②).
//
// ── 사이드바에서 그대로 가져온 것 ────────────────────────────────────────
// · 항목·주소·순서·`owns` 의 정본은 `sidebar-config.ts` 다(여기서 목록을 새로 적지 않는다).
// · 흐름 다섯 단계의 **번호 = 순서**. 진도도 자격도 잠금도 아니다(LEARNING_FRAMEWORK §4①).
//   세로 레일 선은 번호 사이를 잇는 가로 실선 조각이 됐다.
// · Comics 는 레일 밖 — 「더 보기」 패널로, DOM 순서로도 레일 뒤.
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
  MORE_ENTRY,
  META_ENTRIES,
  RAIL_ENTRIES,
  TOP_ENTRIES,
  allEntryItems,
  type MenuPanel,
  type PanelCard,
  type PanelRow,
  type TopEntry,
} from './top-nav-data'

const ILLO = '/illustrations/tines'
const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg)]'
/** 모노 대문자 눈썹 — 참조 「BY FUNCTION」 자리 */
const EYEBROW =
  'font-mono text-[11.5px] font-[700] uppercase tracking-[0.06em] text-[var(--t1)]'

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

  // 학습 세션(풀스크린)에서는 셸을 걷어낸다 — 사이드바·나침반 띠·하단 탭과 **같은 판정**.
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
  /** 그 주소를 품은 막대 칸(메뉴 포함) — 색만이 아니라 sr-only 문장으로도 알린다. */
  const hereKey = entryHolding(current)

  return (
    <header
      ref={root}
      aria-label="주 메뉴"
      onMouseLeave={hoverClose}
      className="sticky top-0 z-40 hidden border-b border-[var(--bd)] bg-[var(--bg)] md:block"
    >
      <div className="mx-auto flex h-[60px] w-full max-w-[1600px] items-center gap-1 px-4 lg:px-6">
        {/* 로고 — 라틴은 Lora, 뒤에 주묵 권점 하나(사이드바 머리에서 그대로 옮겼다). */}
        <Link
          href="/hub"
          aria-label="Vocaflow 홈"
          className={`mr-1 flex min-h-[44px] shrink-0 items-center gap-2.5 rounded-full pr-2 transition-opacity duration-[var(--dur-normal)] hover:opacity-90 ${FOCUS}`}
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

        {/* 메타 둘(Today · Growth) — 사이드바의 맨 위 칸 그대로. 흐름 번호가 없다. */}
        <nav aria-label="메타" className="flex shrink-0 items-center gap-0.5">
          {META_ENTRIES.map((e) => (
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

        <span aria-hidden className="mx-2 h-6 w-px shrink-0 bg-[var(--bd)]" />

        {/* 흐름 레일 — 다섯 단계가 ①→⑤ 로 이어진다. 선은 장식이라 aria-hidden 이고,
            순서는 번호 배지의 sr-only 문장(「흐름 N번째 · 이름」)이 말한다.
            ⚠️ 여기에 "현재 단계" 를 진도로 표시하지 말 것 — 이동을 알리는 자리는 넷뿐이다. */}
        <nav aria-label="학습 흐름" className="flex min-w-0 flex-1 items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {RAIL_ENTRIES.map((e, i) => (
            <span key={e.key} className="flex shrink-0 items-center">
              {/* 레일 선 — 1024 아래에서는 번호와 함께 접는다(아래 `BarEntry` 주석).
                  선만 남기면 번호 없는 칸들 사이에 뜻 없는 줄이 그어진다. */}
              {i > 0 && (
                <span aria-hidden className="hidden h-px w-4 shrink-0 bg-[var(--bd)] lg:block" />
              )}
              <BarEntry
                entry={e}
                current={current}
                hereKey={hereKey}
                open={open}
                baseId={baseId}
                onOpen={hoverOpen}
                onToggle={setOpen}
                onNavigate={close}
              />
            </span>
          ))}
        </nav>

        {/* 레일 밖 — 만화 · 기출 · 학급 · 도구. 오른쪽 끝 한 칸. */}
        <nav aria-label="그 밖" className="flex shrink-0 items-center">
          <BarEntry
            entry={MORE_ENTRY}
            current={current}
            hereKey={hereKey}
            open={open}
            baseId={baseId}
            onOpen={hoverOpen}
            onToggle={setOpen}
            onNavigate={close}
          />
        </nav>
      </div>

      {/* 메가메뉴 — 막대 바로 아래, 화면 위로 뜬다. 닫혀 있어도 DOM 에 남는다(`hidden`):
          링크가 사라지지 않아야 스크린리더가 목록을 잃지 않고, 회귀 테스트도 주소를 셀 수 있다. */}
      {TOP_ENTRIES.filter((e) => e.kind === 'menu').map((e) => (
        <div
          key={e.key}
          id={`${baseId}-${e.key}`}
          hidden={open !== e.key}
          onMouseEnter={() => hoverOpen(e.key)}
          className="absolute inset-x-0 top-full border-b border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-lg)]"
        >
          <div className="mx-auto w-full max-w-[1600px] px-4 pb-4 pt-3 lg:px-6">
            {/* 패널 머리 — 번호 · 단계 이름 · 그 단계가 하는 일 한 줄.
                사이드바에서는 "지금 그 단계에 있을 때만" 보이던 문장인데, 패널은 연 사람만
                보므로 늘 적는다(설명서가 되지 않는다 — 열려 있는 동안만 있다). */}
            {e.kind === 'menu' && (e.says || e.stage) && (
              <p className="mb-2 flex items-center gap-2">
                {e.step && (
                  <span
                    aria-hidden
                    className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border font-mono text-[10px] font-[700] tabular-nums"
                    style={{ borderColor: e.accent, color: e.accent }}
                  >
                    {e.step}
                  </span>
                )}
                <span className={EYEBROW}>{e.stage ?? e.label}</span>
                {e.says && (
                  <span className="break-keep font-body text-[13px] text-[var(--t2)]">
                    {e.says}
                  </span>
                )}
              </p>
            )}
            {e.kind === 'menu' && (
              <Panel
                panel={e.panel}
                align={e.align ?? 'start'}
                current={current}
                onNavigate={close}
              />
            )}
          </div>
        </div>
      ))}
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

function BarEntry({ entry, current, hereKey, open, baseId, onOpen, onToggle, onNavigate }: BarEntryProps) {
  const here = hereKey === entry.key
  const accent = entry.accent ?? 'var(--ju)'
  // 활성 칸은 **면**으로 말한다(색 8% mix — Calm UI). 색맹 대응으로 글자도 굵어진다.
  const face = here
    ? { backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)` }
    : undefined
  const base = `group relative inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-3 font-display text-[14px] transition-colors duration-[var(--dur-quick)] ${
    here ? 'font-[700] text-[var(--t1)]' : 'font-[500] text-[var(--t2)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]'
  } ${FOCUS}`

  const badge = entry.step ? (
    <>
      <span
        aria-hidden="true"
        // ⚠️ 1024 아래에서는 배지를 접는다 — 접지 않으면 다섯 칸이 막대를 넘겨 **⑤ Dictation
        //    이 화면 밖으로 밀린다**(실측 820px). 순서는 옆의 sr-only 문장이 계속 말하고,
        //    화면에서도 왼쪽→오른쪽 차례가 그대로 남는다. 잃는 것은 숫자뿐이고,
        //    잃지 않는 것은 마지막 단계로 가는 길이다.
        className="hidden h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border bg-[var(--bg)] font-mono text-[10px] font-[700] tabular-nums transition-colors duration-[var(--dur-normal)] lg:inline-flex"
        // 번호는 **늘 그 단계의 색**을 쓴다 — 막대에서 색이 사라지면 다섯 칸이 글자만 남아
        // 「보라만 보인다」(DD-68 §12 진단)로 되돌아간다. 지금 있는 구역은 면까지 찬다.
        style={
          here
            ? {
                borderColor: accent,
                color: accent,
                backgroundColor: `color-mix(in srgb, ${accent} 16%, var(--bg))`,
              }
            : {
                borderColor: `color-mix(in srgb, ${accent} 45%, transparent)`,
                color: accent,
              }
        }
      >
        {entry.step}
      </span>
      {/* 순서는 화면에선 배지가, 스크린리더에선 이 문장이 말한다.
          「잠김/불가」 류 어휘를 쓰지 않는다 — 막는 것이 아니라 순서다. */}
      <span className="sr-only">{`흐름 ${entry.step}번째 · ${entry.stage ?? entry.label}`}</span>
    </>
  ) : null

  if (entry.kind === 'link') {
    const isCurrent = current === entry.item.href
    return (
      <Link
        href={entry.item.href}
        aria-current={isCurrent ? 'page' : undefined}
        aria-label={entry.item.ariaLabel ?? entry.label}
        title={entry.says ?? entry.item.ariaLabel}
        onMouseEnter={() => onToggle(() => null)}
        onClick={onNavigate}
        className={base}
        style={face}
      >
        {badge}
        <span className="whitespace-nowrap">{entry.label}</span>
        {here && <ActiveUnderline accent={accent} />}
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
      style={face}
    >
      {badge}
      <span className="whitespace-nowrap">{entry.label}</span>
      {here && <span className="sr-only">(현재 구역)</span>}
      <ChevronDown
        size={13}
        aria-hidden
        className={`shrink-0 transition-transform duration-[var(--dur-quick)] ${expanded ? 'rotate-180' : ''}`}
      />
      {here && <ActiveUnderline accent={accent} />}
    </button>
  )
}

/** 현재 구역 밑줄 — 면 색만으로 알리지 않는다(색맹 대응: 굵기 + 밑줄 + sr-only 문장). */
function ActiveUnderline({ accent }: { accent: string }) {
  return (
    <span
      aria-hidden
      className="absolute inset-x-3 -bottom-[11px] h-[2px] rounded-full"
      style={{ backgroundColor: accent }}
    />
  )
}

// ── 패널 — 옅은 틀 + 원색 카드 + 떨어진 목록(참조 메가메뉴 세 골격의 공통분모) ──
function Panel({
  panel,
  align,
  current,
  onNavigate,
}: {
  panel: MenuPanel
  /** 막대 오른쪽 끝 칸(「더 보기」)은 패널도 오른쪽에 붙는다 — 트리거에서 멀면 연결이 끊긴다. */
  align: 'start' | 'end'
  current: string | null
  onNavigate: () => void
}) {
  return (
    <div
      className={`flex flex-wrap items-start gap-2 motion-safe:animate-[vf-dropdown-in_var(--dur-slow)_var(--ease-out-quint)_both] ${
        align === 'end' ? 'justify-end' : ''
      }`}
    >
      {panel.frames.map((f) => (
        <div key={f.eyebrow} className={`${f.tone} dots rounded-[16px] p-1.5`}>
          <EyebrowRow
            label={f.eyebrow}
            href={f.eyebrowHref}
            current={current}
            onNavigate={onNavigate}
          />
          <div className="flex flex-wrap gap-1.5">
            {f.cards.map((c) => (
              <Card key={c.item.href} card={c} current={current} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}

      {panel.solids.map((c) => (
        <Card key={c.item.href} card={c} current={current} onNavigate={onNavigate} standalone />
      ))}

      {panel.aside && (
        <div className={`${panel.aside.tone} w-[300px] rounded-[16px] p-1.5`}>
          <EyebrowRow
            label={panel.aside.eyebrow}
            href={panel.aside.eyebrowHref}
            current={current}
            onNavigate={onNavigate}
          />
          <ul>
            {panel.aside.rows.map((r) => (
              <li key={r.item.href}>
                <Row row={r} current={current} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** 눈썹 — 그 구역의 이름. 부모 주소가 있으면 눈썹 자체가 그리로 가는 길이다(44px). */
function EyebrowRow({
  label,
  href,
  current,
  onNavigate,
}: {
  label: string
  href?: string
  current: string | null
  onNavigate: () => void
}) {
  if (!href) {
    return <p className={`${EYEBROW} px-2 pb-2 pt-1.5`}>{label}</p>
  }
  return (
    <Link
      href={href}
      aria-current={current === href ? 'page' : undefined}
      onClick={onNavigate}
      className={`${EYEBROW} mb-1 flex min-h-[44px] items-center gap-1.5 rounded-[10px] px-2 transition-colors hover:bg-[color-mix(in_srgb,var(--t1)_10%,transparent)] ${FOCUS}`}
    >
      {label}
      <ArrowRight size={13} aria-hidden className="shrink-0" />
    </Link>
  )
}

/** 원색 카드 — 면 색은 그 경로의 범주 색이고, 면 위 글자는 크림(`.tone-deep-*`). */
function Card({
  card,
  current,
  onNavigate,
  standalone = false,
}: {
  card: PanelCard
  current: string | null
  onNavigate: () => void
  standalone?: boolean
}) {
  const isCurrent = current === card.item.href
  return (
    <Link
      href={card.item.href}
      aria-current={isCurrent ? 'page' : undefined}
      aria-label={card.item.ariaLabel ?? card.title}
      onClick={onNavigate}
      className={`${card.tone} relative flex h-[188px] flex-col overflow-hidden p-3.5 text-[var(--t1)] transition-[filter] duration-[var(--dur-quick)] hover:brightness-110 ${
        card.size === 'lg' ? 'w-[240px] lg:w-[300px]' : 'w-[164px] lg:w-[190px]'
      } ${standalone ? 'rounded-[16px]' : 'rounded-[10px]'} ${FOCUS}`}
    >
      <span
        className={`break-keep font-display font-[500] leading-tight ${
          card.size === 'lg' ? 'text-[23px]' : 'text-[19px]'
        }`}
      >
        {card.title}
      </span>
      <span
        className={`mt-1 break-keep font-body text-[12.5px] leading-snug ${
          card.size === 'lg' ? 'max-w-[62%]' : ''
        }`}
      >
        {card.body}
      </span>
      {/* 큰 카드는 소품을 한 점 더 얹는다 — 참조 Product 카드의 「가운데 물건」 자리.
          면 색 위에 뜨는 장식이라 alt="" 이고 포인터를 먹지 않는다. */}
      {card.size === 'lg' && card.spot && (
        <Image
          loading="eager"
          src={`${ILLO}/${card.spot}.webp`}
          alt=""
          width={1328}
          height={1328}
          className="pointer-events-none absolute bottom-8 right-2 w-[104px] select-none"
        />
      )}
      {card.tile && (
        <Image
          loading="eager"
          src={`${ILLO}/${card.tile}.webp`}
          alt=""
          width={1328}
          height={1328}
          className={`relative mt-auto select-none rounded-[10px] ${
            card.size === 'lg' ? 'w-[62px]' : 'w-[54px]'
          }`}
        />
      )}
      {/* 지금 보고 있는 카드 — 면 위에서는 테두리보다 **작은 알약**이 읽힌다(참조의 이름표 문법).
          색만으로 알리지 않으므로 글자를 함께 둔다. */}
      {isCurrent && (
        <span className="absolute right-3 top-3 inline-flex h-6 items-center rounded-full bg-[color-mix(in_srgb,var(--t1)_22%,transparent)] px-2 font-mono text-[10.5px] font-[700] uppercase tracking-[0.04em]">
          지금
        </span>
      )}
      <span className="absolute bottom-3.5 right-3.5">
        {card.arrow === 'out' ? (
          <ArrowUpRight size={15} aria-hidden className="shrink-0" />
        ) : (
          <ArrowRight size={15} aria-hidden className="shrink-0" />
        )}
      </span>
    </Link>
  )
}

/** 목록 행 — 소품 칩 + 제목 + 한 줄. 누르는 자리 44px 이상. */
function Row({
  row,
  current,
  onNavigate,
}: {
  row: PanelRow
  current: string | null
  onNavigate: () => void
}) {
  const isCurrent = current === row.item.href
  const Icon: LucideIcon = row.item.icon
  // 쿼리 뷰(`/text?view=`)는 경로가 같아 소품이 전부 같다 — 그럴 때는 항목 아이콘이 면을 가른다.
  const sameSpot = !row.spot || row.item.href.includes('?')
  return (
    <Link
      href={row.item.href}
      aria-current={isCurrent ? 'page' : undefined}
      aria-label={row.item.ariaLabel ?? row.title}
      onClick={onNavigate}
      className={`flex min-h-[44px] items-start gap-2.5 rounded-[10px] px-2 py-2 text-[var(--t1)] transition-colors hover:bg-[color-mix(in_srgb,var(--t1)_9%,transparent)] ${
        isCurrent ? 'bg-[color-mix(in_srgb,var(--t1)_12%,transparent)]' : ''
      } ${FOCUS}`}
    >
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[color-mix(in_srgb,var(--t1)_12%,transparent)]">
        {sameSpot ? (
          <Icon size={15} strokeWidth={1.75} aria-hidden />
        ) : (
          <Image
            loading="eager"
            src={`${ILLO}/${row.spot}.webp`}
            alt=""
            width={1328}
            height={1328}
            className="h-6 w-6 select-none"
          />
        )}
      </span>
      <span className="min-w-0">
        <span className={`block font-display text-[14px] leading-tight ${isCurrent ? 'font-[700]' : 'font-[600]'}`}>
          {row.title}
        </span>
        <span className="mt-0.5 block break-keep font-body text-[12.5px] leading-snug">
          {row.body}
        </span>
      </span>
    </Link>
  )
}
