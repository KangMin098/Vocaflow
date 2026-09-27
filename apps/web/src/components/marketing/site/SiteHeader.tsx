// apps/web/src/components/marketing/site/SiteHeader.tsx
//
// 공개 화면 공통 헤더(DD-68 · tines-mapping C1–C6) — 참조 사이트 `SiteNav26` 의 골격:
// 로고 · 알약 내비(메가메뉴 3 + 요금제) · 오른쪽 로그인/가입 · 채움 알약 CTA · 390 에서는 서랍.
//
// 메가메뉴: 올리면 열리고(데스크톱) 누르면 토글한다. Esc · 바깥 누름 · 다른 메뉴로 옮김에 닫힌다.
// 열림은 `aria-expanded` + `aria-controls` 로 알린다 — 키보드만으로 열고 닫고 안을 돌 수 있다.
// 모션은 참조의 `areaDropdownIn`(opacity + translateY, .3s out-quint)을 토큰으로 옮긴 것이다.

'use client'

import { ArrowRight, ArrowUpRight, ChevronDown, Menu as MenuIcon, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { PILL } from '../pill'
import { LogoMark } from './LogoMark'
import { SearchButton } from './SearchDialog'
import { MENUS, TOP_LINKS, type CardTone, type Menu, type MenuLink } from './nav-data'

// 카드 면(tines-mapping §19) — 글자 그대로 적는다(Tailwind). 면 안 글자색은 .tone-* 가 준다.
const TONE: Record<CardTone, string> = {
  'deep-purple': 'tone-deep-purple',
  'deep-green': 'tone-deep-green',
  'deep-orange': 'tone-deep-orange',
  'deep-magenta': 'tone-deep-magenta',
  'deep-ink': 'tone-deep-ink',
  lavender: 'tone-lavender',
  green: 'tone-green',
  peach: 'tone-peach',
}
/** 모노 대문자 눈썹 — 참조 「BY FUNCTION」 */
const EYEBROW = 'px-2 pb-2 pt-1 font-mono text-[11.5px] font-[700] uppercase tracking-[0.06em] text-[var(--t1)]'
/** 진한 틀 안의 안쪽 카드 — 틀보다 한 단 밝은 면 */
const INNER = 'bg-[color-mix(in_srgb,var(--on-deep)_9%,transparent)] hover:bg-[color-mix(in_srgb,var(--on-deep)_16%,transparent)]'
const ILLO = '/illustrations/tines'

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'

export function SiteHeader() {
  const [open, setOpen] = useState<Menu['id'] | null>(null)
  const [drawer, setDrawer] = useState(false)
  const root = useRef<HTMLElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const baseId = useId()

  const close = useCallback(() => setOpen(null), [])
  const hoverOpen = (id: Menu['id']) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(id)
  }
  const hoverClose = () => {
    // 메뉴 단추에서 패널로 내려가는 사이에 닫히지 않게 조금 기다린다.
    closeTimer.current = setTimeout(close, 140)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(null); setDrawer(false) } }
    const onDown = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(null) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown) }
  }, [])

  return (
    <header ref={root} className="sticky top-0 z-40 bg-[var(--bg)]" onMouseLeave={hoverClose}>
      {/* 공지 띠 — 참조 「NEW! … [Get the guide]」(짙은 보라 · 크림 글자 · 흰 알약). 띠 전체가 누르는 자리(44px). */}
      <Link href="/fit" className={`flex min-h-[44px] items-center justify-center gap-3 bg-[var(--deep-ink)] px-4 text-center font-display text-[13.5px] font-[500] text-[var(--on-deep)] ${FOCUS}`}>
        <span className="break-keep">새로 · 로그인 없이, 읽을 글에서 내가 아는 단어 비율을 재 보세요</span>
        <span className="hidden shrink-0 rounded-full bg-[var(--on-deep)] px-3 py-1 text-[12.5px] font-[700] text-[var(--deep-ink)] sm:inline">진단 해보기</span>
      </Link>
      <div className="mx-auto flex h-[72px] max-w-[1360px] items-center justify-between px-4 lg:px-10">
        <div className="flex items-center gap-6">
          <Link href="/" className={`flex min-h-[44px] items-center gap-2 rounded-full ${FOCUS}`} aria-label="Vocaflow 홈">
            <LogoMark />
            <span className="font-display text-[22px] font-[500] tracking-[-0.02em] text-[var(--ju)]">vocaflow</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="주요">
            {MENUS.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-expanded={open === m.id}
                aria-controls={`${baseId}-${m.id}`}
                onClick={() => setOpen((o) => (o === m.id ? null : m.id))}
                onMouseEnter={() => hoverOpen(m.id)}
                className={`inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 font-display text-[14px] font-[600] text-[var(--ju)] transition-colors duration-[var(--dur-quick)] hover:bg-[var(--bg3)] aria-expanded:bg-[var(--bg3)] ${FOCUS}`}
              >
                {m.label}
                <ChevronDown size={13} aria-hidden className={`transition-transform duration-[var(--dur-quick)] ${open === m.id ? 'rotate-180' : ''}`} />
              </button>
            ))}
            {TOP_LINKS.map((l) => (
              <NavPill key={l.href} href={l.href} onEnter={close}>{l.label}</NavPill>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-1"><SearchButton /></span>
          <span className="hidden sm:inline-flex"><NavPill href="/login">로그인</NavPill></span>
          <span className="hidden sm:inline-flex"><NavPill href="/signup">가입</NavPill></span>
          <span className="ml-2 hidden sm:block">
            <Link href="/signup" className={`${PILL} bg-[var(--p)] text-[var(--on-p)] hover:bg-[var(--p-hover)]`}>무료로 시작</Link>
          </span>
          <button
            type="button"
            className={`ml-1 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg3)] text-[var(--ju)] md:hidden ${FOCUS}`}
            aria-expanded={drawer}
            aria-controls={`${baseId}-drawer`}
            aria-label={drawer ? '메뉴 닫기' : '메뉴 열기'}
            onClick={() => setDrawer((d) => !d)}
          >
            {drawer ? <X size={20} aria-hidden /> : <MenuIcon size={20} aria-hidden />}
          </button>
        </div>
      </div>

      {/* 메가메뉴 — 헤더 바로 아래, 페이지 위에 뜬다 */}
      {MENUS.map((m) => (
        <div
          key={m.id}
          id={`${baseId}-${m.id}`}
          hidden={open !== m.id}
          onMouseEnter={() => hoverOpen(m.id)}
          className="absolute inset-x-0 top-full"
        >
          {/* ⚠️ `hidden` 속성과 같은 요소에 `md:block` 을 두면 class 가 이겨 늘 열린다 — 폭 제한은 안쪽에. */}
          <div className="mx-auto max-w-[1360px] px-4 max-md:hidden lg:px-10">
            <MegaPanel menu={m} onNavigate={close} />
          </div>
        </div>
      ))}

      {/* 모바일 서랍 — 참조 390 메뉴(tines-mapping §19): 반투명 라벤더 알약 행이 쌓이고, 누르면 펼친다(<details> — 스크립트 없이 열림).
          맨 아래 로그인 · 가입 반반 알약 + 채움/테두리 CTA. */}
      <div id={`${baseId}-drawer`} hidden={!drawer} className="px-2 pb-6 pt-1 md:hidden">
        <nav aria-label="모바일 주요" className="flex flex-col gap-1.5">
          {MENUS.map((m) => (
            <details key={m.id} className="group rounded-[24px] bg-[color-mix(in_srgb,var(--tint-lavender)_85%,transparent)] backdrop-blur-[12px]">
              <summary className={`flex min-h-[48px] cursor-pointer list-none items-center justify-between rounded-[24px] px-4 font-display text-[15px] font-[600] text-[var(--ju)] [&::-webkit-details-marker]:hidden ${FOCUS}`}>
                {m.label}
                <ChevronDown size={16} aria-hidden className="transition-transform duration-[var(--dur-quick)] group-open:rotate-180" />
              </summary>
              <ul className="px-2 pb-2">
                {[...m.cards, ...m.list].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} onClick={() => setDrawer(false)} className={`flex min-h-[44px] items-center gap-2.5 rounded-[16px] px-2 font-display text-[15px] font-[500] text-[var(--ju)] hover:bg-[var(--bg)] ${FOCUS}`}>
                      <span aria-hidden className="inline-flex h-7 w-7 shrink-0 items-center justify-center">{l.illo && <Image loading="eager" src={`${ILLO}/${l.illo}.webp`} alt="" width={64} height={64} className="h-7 w-7 select-none" />}</span>
                      {l.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
          {TOP_LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setDrawer(false)} className={`flex min-h-[48px] items-center rounded-[24px] bg-[color-mix(in_srgb,var(--tint-lavender)_85%,transparent)] px-4 font-display text-[15px] font-[600] text-[var(--ju)] ${FOCUS}`}>
              {l.label}
            </Link>
          ))}
          <div className="grid grid-cols-2 gap-1.5">
            <Link href="/login" onClick={() => setDrawer(false)} className={`flex min-h-[48px] items-center justify-center rounded-[24px] bg-[color-mix(in_srgb,var(--tint-lavender)_85%,transparent)] font-display text-[15px] font-[600] text-[var(--ju)] ${FOCUS}`}>로그인</Link>
            <Link href="/signup" onClick={() => setDrawer(false)} className={`flex min-h-[48px] items-center justify-center rounded-[24px] bg-[color-mix(in_srgb,var(--tint-lavender)_85%,transparent)] font-display text-[15px] font-[600] text-[var(--ju)] ${FOCUS}`}>가입</Link>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Link href="/signup" onClick={() => setDrawer(false)} className={`${PILL} bg-[var(--p)] text-[var(--on-p)]`}>무료로 시작</Link>
            <Link href="/fit" onClick={() => setDrawer(false)} className={`${PILL} border border-[var(--ju)] text-[var(--ju)]`}>지문 진단</Link>
          </div>
        </nav>
      </div>
    </header>
  )
}

function MegaPanel({ menu, onNavigate }: { menu: Menu; onNavigate: () => void }) {
  const cls = 'mt-1 flex items-start gap-2 motion-safe:animate-[vf-dropdown-in_var(--dur-slow)_var(--ease-out-quint)_both]'
  if (menu.layout === 'product') return <ProductPanel menu={menu} onNavigate={onNavigate} cls={cls} />
  if (menu.layout === 'solutions') return <SolutionsPanel menu={menu} onNavigate={onNavigate} cls={cls} />
  return <DiscoverPanel menu={menu} onNavigate={onNavigate} cls={cls} />
}

/** 참조 화살표 두 종 — → 안쪽 이동 · ↗ 다른 구역 */
function Arrow({ kind = 'in' }: { kind?: 'in' | 'out' }) {
  return kind === 'out' ? <ArrowUpRight size={15} aria-hidden className="shrink-0" /> : <ArrowRight size={15} aria-hidden className="shrink-0" />
}

/** 참조 Product — 진한 보라 틀: 큰 카드(가운데 소품 + 아래 꽃밭 띠) + 작은 카드 세로. 떨어진 라벤더 카드(list[0]). */
function ProductPanel({ menu, onNavigate, cls }: { menu: Menu; onNavigate: () => void; cls: string }) {
  const [feature, ...stack] = menu.cards
  const aside = menu.list[0]
  return (
    <div className={cls}>
      <div className={`${TONE[feature.tone]} flex gap-1.5 rounded-[14px] p-1.5`}>
        <Link href={feature.href} onClick={onNavigate} className={`relative flex h-[300px] w-[360px] flex-col overflow-hidden rounded-[10px] p-4 text-[var(--t1)] transition-colors ${INNER} ${FOCUS}`}>
          <span className="font-display text-[24px] font-[500] leading-tight">{feature.title}</span>
          <span className="mt-1 max-w-[30ch] font-body text-[13.5px] leading-snug">{feature.body}</span>
          <Image loading="eager" src={`${ILLO}/bed-flowers.webp`} alt="" width={1664} height={928} className="pointer-events-none absolute inset-x-0 bottom-0 h-auto w-full select-none [mask-image:linear-gradient(to_bottom,transparent,black_35%)]" />
          {feature.illo && (
            <Image loading="eager" src={`${ILLO}/${feature.illo}.webp`} alt="" width={1328} height={1328} className="pointer-events-none absolute bottom-12 left-1/2 w-[132px] -translate-x-1/2 select-none" />
          )}
        </Link>
        <div className="flex w-[240px] flex-col gap-1.5">
          {stack.map((c) => (
            <Link key={c.href} href={c.href} onClick={onNavigate} className={`flex flex-1 flex-col rounded-[10px] p-3.5 text-[var(--t1)] transition-colors ${INNER} ${FOCUS}`}>
              <span className="font-display text-[15px] font-[700]">{c.title}</span>
              <span className="mt-0.5 font-body text-[12.5px] leading-snug">{c.body}</span>
              <span className="mt-auto self-end"><Arrow kind={c.arrow} /></span>
            </Link>
          ))}
        </div>
      </div>
      {aside && (
        <Link href={aside.href} onClick={onNavigate} className={`tone-lavender relative flex h-[300px] w-[240px] flex-col rounded-[14px] border border-[var(--bd)] p-4 text-[var(--t1)] transition-[filter] hover:brightness-[1.03] ${FOCUS}`}>
          <span className="font-display text-[20px] font-[500] leading-tight">{aside.title}</span>
          <span className="mt-1 font-body text-[12.5px] leading-snug">{aside.body}</span>
          {aside.illo && <Image loading="eager" src={`${ILLO}/${aside.illo}.webp`} alt="" width={1328} height={1328} className="mt-auto w-[96px] select-none" />}
          <span className="absolute bottom-4 right-4"><Arrow /></span>
        </Link>
      )}
    </div>
  )
}

/** 참조 Solutions — 옅은 틀(BY FUNCTION) 안 원색 카드들 + 떨어진 살구 패널(BY INDUSTRY · 아이콘 칩 목록). */
function SolutionsPanel({ menu, onNavigate, cls }: { menu: Menu; onNavigate: () => void; cls: string }) {
  return (
    <div className={cls}>
      <div className="rounded-[14px] bg-[color-mix(in_srgb,var(--ju)_28%,var(--tint-lavender))] p-1.5">
        {menu.cardsLabel && <p className={EYEBROW}>{menu.cardsLabel}</p>}
        <div className="flex gap-1.5">
          {menu.cards.map((c) => (
            <Link key={c.href} href={c.href} onClick={onNavigate} className={`${TONE[c.tone]} relative flex h-[210px] w-[200px] flex-col rounded-[10px] p-3.5 text-[var(--t1)] transition-[filter] duration-[var(--dur-quick)] hover:brightness-110 ${FOCUS}`}>
              <span className="font-display text-[22px] font-[500] leading-tight">{c.title}</span>
              <span className="mt-1 font-body text-[12.5px] leading-snug">{c.body}</span>
              {c.illo && <Image loading="eager" src={`${ILLO}/${c.illo}.webp`} alt="" width={1328} height={1328} className="mt-auto w-[64px] select-none" />}
              <span className="absolute bottom-3.5 right-3.5"><Arrow kind={c.arrow} /></span>
            </Link>
          ))}
        </div>
      </div>
      {menu.list.length > 0 && (
        <div className="tone-peach w-[300px] rounded-[14px] p-1.5">
          {menu.listLabel && <p className={EYEBROW}>{menu.listLabel}</p>}
          <ul>
            {menu.list.map((l) => (
              <li key={l.href}><ChipRow link={l} onNavigate={onNavigate} /></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** 참조 Discover — 열마다 옅은 틀(이미지 카드 + 아래 목록 행), 마지막은 원색 카드(둥근 소품 · ↗). */
function DiscoverPanel({ menu, onNavigate, cls }: { menu: Menu; onNavigate: () => void; cls: string }) {
  const cols = menu.cards.filter((c) => c.image)
  const solid = menu.cards.filter((c) => !c.image)
  return (
    <div className={cls}>
      {cols.map((c, i) => (
        <div key={c.href} className={`${TONE[c.tone]} w-[250px] rounded-[14px] p-1.5`}>
          <Link href={c.href} onClick={onNavigate} className={`block overflow-hidden rounded-[10px] bg-[var(--bg)] transition-[filter] hover:brightness-[1.02] ${FOCUS}`}>
            <span className="relative block h-[120px] overflow-hidden">
              <Image loading="eager" src={`${ILLO}/${c.image}.webp`} alt="" width={1328} height={1328} className="h-full w-full select-none object-cover" />
              {c.illo && (
                <Image loading="eager" src={`${ILLO}/${c.illo}.webp`} alt="" width={1328} height={1328} className="absolute left-1/2 top-1/2 w-[76px] -translate-x-1/2 -translate-y-1/2 select-none" />
              )}
            </span>
            <span className="block px-3 pb-3 pt-2.5">
              <span className="block break-keep font-display text-[15px] font-[600] leading-snug text-[var(--t1)]">{c.title}</span>
              <span className="mt-1 inline-flex items-center gap-1 font-mono text-[11.5px] font-[700] uppercase tracking-[0.04em] text-[var(--t1)]">
                {c.body} <ArrowRight size={12} aria-hidden />
              </span>
            </span>
          </Link>
          <ul className="mt-1">
            {menu.list.filter((l) => (l.col ?? 0) === i).map((l) => (
              <li key={l.href}><ChipRow link={l} onNavigate={onNavigate} /></li>
            ))}
          </ul>
        </div>
      ))}
      {solid.map((c) => (
        <Link key={c.href} href={c.href} onClick={onNavigate} className={`${TONE[c.tone]} relative flex h-[200px] w-[200px] flex-col rounded-[14px] p-4 text-[var(--t1)] transition-[filter] hover:brightness-110 ${FOCUS}`}>
          <span className="font-display text-[20px] font-[500] leading-tight">{c.title}</span>
          <span className="mt-1 font-body text-[12.5px] leading-snug">{c.body}</span>
          {c.illo && (
            <span className="mt-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-[var(--on-deep)]">
              <Image loading="eager" src={`${ILLO}/${c.illo}.webp`} alt="" width={1328} height={1328} className="w-12 select-none" />
            </span>
          )}
          <span className="absolute bottom-4 right-4"><Arrow kind={c.arrow} /></span>
        </Link>
      ))}
    </div>
  )
}

/** 목록 행 — 아이콘 칩(면 글자색 10% 위 소품) + 제목 + 한 줄. 누르는 자리 44px 이상. */
function ChipRow({ link, onNavigate }: { link: MenuLink; onNavigate: () => void }) {
  return (
    <Link href={link.href} onClick={onNavigate} className={`flex min-h-[44px] items-start gap-2.5 rounded-[10px] px-2 py-2 text-[var(--t1)] transition-colors hover:bg-[color-mix(in_srgb,var(--t1)_8%,transparent)] ${FOCUS}`}>
      {link.illo && (
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[color-mix(in_srgb,var(--t1)_10%,transparent)]">
          <Image loading="eager" src={`${ILLO}/${link.illo}.webp`} alt="" width={64} height={64} className="h-6 w-6 select-none" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block font-display text-[14px] font-[600] leading-tight">{link.title}</span>
        <span className="mt-0.5 block font-body text-[12.5px] leading-snug">{link.body}</span>
      </span>
    </Link>
  )
}

/** 내비 알약 — 14px 600 · 누르면 옅은 보라 면. 누르는 자리는 44px. */
export function NavPill({ href, children, onEnter }: { href: string; children: React.ReactNode; onEnter?: () => void }) {
  return (
    <Link
      href={href}
      onMouseEnter={onEnter}
      className={`inline-flex min-h-[44px] items-center rounded-full px-3 font-display text-[14px] font-[600] text-[var(--ju)] transition-colors duration-[var(--dur-quick)] hover:bg-[var(--bg3)] ${FOCUS}`}
    >
      {children}
    </Link>
  )
}

