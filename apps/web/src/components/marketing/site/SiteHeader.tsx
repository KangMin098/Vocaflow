// apps/web/src/components/marketing/site/SiteHeader.tsx
//
// 공개 화면 공통 헤더(DD-68 · tines-mapping C1–C6) — 참조 사이트 `SiteNav26` 의 골격:
// 로고 · 알약 내비(메가메뉴 3 + 요금제) · 오른쪽 로그인/가입 · 채움 알약 CTA · 390 에서는 서랍.
//
// 메가메뉴: 올리면 열리고(데스크톱) 누르면 토글한다. Esc · 바깥 누름 · 다른 메뉴로 옮김에 닫힌다.
// 열림은 `aria-expanded` + `aria-controls` 로 알린다 — 키보드만으로 열고 닫고 안을 돌 수 있다.
// 모션은 참조의 `areaDropdownIn`(opacity + translateY, .3s out-quint)을 토큰으로 옮긴 것이다.

'use client'

import { ChevronDown, Menu as MenuIcon, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { PILL } from '../pill'
import { LogoMark } from './LogoMark'
import { SearchButton } from './SearchDialog'
import { MENUS, TOP_LINKS, type Menu, type MenuCard } from './nav-data'

// 면 톤(globals.css `.tone-*` · tines-mapping §13-1) — 진한 면 위는 크림 글자, 옅은 면 위는 같은 색상 글자.
const TONE: Record<MenuCard['tone'], string> = {
  feature: 'tone-deep-purple text-[var(--t1)]',
  ju: 'tone-deep-magenta text-[var(--t1)]',
  success: 'tone-deep-green text-[var(--t1)]',
  warning: 'tone-deep-orange text-[var(--t1)]',
  info: 'tone-deep-ink text-[var(--t1)]',
  soft: 'tone-lavender text-[var(--t1)]',
}

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

      {/* 모바일 서랍 — 390 에서 내비가 숨던 결함(tines-mapping C6)을 닫는다 */}
      <div id={`${baseId}-drawer`} hidden={!drawer} className="border-t border-[var(--bd)] bg-[var(--bg)] px-4 pb-6 pt-2 md:hidden">
        <nav aria-label="모바일 주요">
          {MENUS.map((m) => (
            <section key={m.id} className="border-b border-[var(--bd)] py-3">
              <p className="px-1 font-display text-[13px] font-[700] tracking-[0.04em] text-[var(--ju)]">{m.label}</p>
              <ul className="mt-1">
                {[...m.cards, ...m.list].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} onClick={() => setDrawer(false)} className={`flex min-h-[44px] items-center rounded-[var(--r-md)] px-1 font-display text-[16px] font-[500] text-[var(--ju)] ${FOCUS}`}>
                      {l.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/signup" onClick={() => setDrawer(false)} className={`${PILL} bg-[var(--p)] text-[var(--on-p)]`}>무료로 시작</Link>
            <Link href="/login" onClick={() => setDrawer(false)} className={`${PILL} border border-[var(--ju)] text-[var(--ju)]`}>로그인</Link>
          </div>
        </nav>
      </div>
    </header>
  )
}

function MegaPanel({ menu, onNavigate }: { menu: Menu; onNavigate: () => void }) {
  const [feature, ...rest] = menu.cards
  return (
    <div className="mt-1 flex gap-2 motion-safe:animate-[vf-dropdown-in_var(--dur-slow)_var(--ease-out-quint)_both]">
      <div className="rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg2)] p-2">
        {menu.cardsLabel && <p className="px-2 pb-2 pt-1 font-display text-[12px] font-[700] tracking-[0.06em] text-[var(--ju)]">{menu.cardsLabel}</p>}
        <div className="flex gap-2">
          {feature && <PanelCard card={feature} big onNavigate={onNavigate} />}
          {rest.length > 0 && (
            <div className="flex flex-col gap-2">
              {rest.map((c) => <PanelCard key={c.href} card={c} onNavigate={onNavigate} />)}
            </div>
          )}
        </div>
      </div>
      {menu.list.length > 0 && (
        <div className="min-w-[280px] rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg3)] p-2">
          {menu.listLabel && <p className="px-2 pb-1 pt-1 font-display text-[12px] font-[700] tracking-[0.06em] text-[var(--ju)]">{menu.listLabel}</p>}
          <ul>
            {menu.list.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={onNavigate} className={`block rounded-[var(--r-lg)] px-3 py-2.5 transition-colors duration-[var(--dur-quick)] hover:bg-[var(--bg2)] ${FOCUS}`}>
                  <span className="block font-display text-[15px] font-[600] text-[var(--ju)]">{l.title}</span>
                  <span className="mt-0.5 block font-body text-[13px] text-[var(--ju)]">{l.body}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function PanelCard({ card, big = false, onNavigate }: { card: MenuCard; big?: boolean; onNavigate: () => void }) {
  return (
    <Link
      href={card.href}
      onClick={onNavigate}
      className={`relative flex flex-col overflow-hidden rounded-[var(--r-lg)] p-4 transition-[filter] duration-[var(--dur-quick)] hover:brightness-110 ${TONE[card.tone]} ${big ? 'h-[266px] w-[360px]' : 'h-[129px] w-[260px]'} ${FOCUS}`}
    >
      <span className={`font-display font-[500] leading-tight ${big ? 'text-[24px]' : 'text-[17px]'}`}>{card.title}</span>
      <span className="mt-1 max-w-[24ch] font-body text-[13.5px] leading-snug">{card.body}</span>
      {card.illo && (
        <Image
          src={`/illustrations/tines/${card.illo}.webp`}
          alt=""
          width={1328}
          height={1328}
          className={`pointer-events-none absolute ${big ? 'bottom-2 left-1/2 w-[150px] -translate-x-1/2' : 'bottom-1 right-2 w-[64px]'}`}
        />
      )}
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

