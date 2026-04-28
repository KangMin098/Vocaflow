'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import QuickStartCard from '@/components/layout/QuickStartCard'
import SidebarFooter from '@/components/layout/SidebarFooter'

type NavItemProps = {
  href: string
  icon: string
  iconBg: string
  iconColor: string
  title: string
  metaNum?: string
  metaText: string
  metaPending?: string
  badge?: 'new'
}

function NavItem({
  href,
  icon,
  iconBg,
  iconColor,
  title,
  metaNum,
  metaText,
  metaPending,
  badge,
}: NavItemProps) {
  const pathname = usePathname() ?? ''
  const isActive = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={`relative mx-1 my-px flex w-[calc(100%-8px)] items-center gap-[11px] rounded-[10px] px-[11px] py-2 transition-all duration-[220ms] ${
        isActive
          ? 'bg-[var(--bg2)] text-[var(--t1)] before:absolute before:left-[-4px] before:top-1/2 before:h-[60%] before:w-[3px] before:-translate-y-1/2 before:rounded-r-[2px] before:bg-[var(--p)]'
          : 'text-[var(--t2)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]'
      }`}
      style={{ fontFamily: 'var(--font-display)' }}
    >
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px] text-[14px]"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold leading-[1.2] tracking-[-0.005em]">
          {title}
          {badge === 'new' && (
            <span
              className="inline-flex items-center rounded px-[5px] py-px text-[8px] font-extrabold uppercase tracking-[0.05em] text-white"
              style={{
                background: 'linear-gradient(135deg, var(--combo), var(--streak))',
                fontFamily: 'var(--font-mono)',
              }}
            >
              NEW
            </span>
          )}
        </div>
        <div
          className="mt-[3px] flex items-center gap-[5px] text-[10px] font-semibold tracking-[0.02em] text-[var(--t3)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {metaNum && <span className="font-bold text-[var(--t2)]">{metaNum}</span>}
          {metaNum && <span className="text-[var(--t4)]">·</span>}
          {metaPending ? (
            <span className="font-extrabold text-[var(--active)]">{metaPending}</span>
          ) : (
            <span>{metaText}</span>
          )}
        </div>
      </div>
    </Link>
  )
}

function StageHeader({ label }: { label: string }) {
  return (
    <div className="mb-0.5 flex items-center gap-[10px] px-3 pb-[7px] pt-[5px]">
      <div className="h-[1.5px] w-[14px] flex-shrink-0 bg-[var(--bd-strong)]" />
      <span
        className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--t2)]"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {label}
      </span>
      <div className="h-px flex-1 bg-[var(--bd)]" />
    </div>
  )
}

export default function Sidebar() {
  return (
    <aside className="sticky top-0 flex h-screen flex-col overflow-y-auto border-r border-[var(--bd)] bg-[var(--bg)] [&::-webkit-scrollbar]:hidden">
      <div className="flex items-center gap-[11px] px-[18px] pb-4 pt-[18px]">
        <div
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-[15px] font-extrabold text-white"
          style={{
            background: 'linear-gradient(135deg, var(--p) 0%, var(--combo) 100%)',
            boxShadow: '0 3px 10px rgba(59,130,246,.3)',
          }}
        >
          ✨
        </div>
        <div
          className="text-[17px] font-extrabold leading-none tracking-[-0.02em]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Vocaflow
        </div>
      </div>

      <QuickStartCard />

      <nav className="flex-1 px-2 pb-3 pt-1.5">
        <div className="mt-1.5">
          <StageHeader label="입력" />
          <NavItem
            href="/main/library"
            icon="📚"
            iconBg="rgba(139,92,246,.15)"
            iconColor="#8B5CF6"
            title="라이브러리"
            metaNum="70K+"
            metaText="탐색"
          />
          <NavItem
            href="/main/input"
            icon="✍️"
            iconBg="rgba(59,130,246,.15)"
            iconColor="#3B82F6"
            title="직접 입력"
            metaText="텍스트 · 파일"
          />
        </div>

        <div className="mt-3.5">
          <StageHeader label="학습" />
          <NavItem
            href="/main/wordvault"
            icon="📖"
            iconBg="rgba(139,92,246,.15)"
            iconColor="#8B5CF6"
            title="WordVault"
            metaNum="342"
            metaText="단어"
            metaPending="12 대기"
          />
          <NavItem
            href="/main/flashcard"
            icon="🃏"
            iconBg="rgba(236,72,153,.15)"
            iconColor="#EC4899"
            title="Flashcard"
            metaNum="35%"
            metaText="마스터"
          />
        </div>

        <div className="mt-3.5">
          <StageHeader label="강화" />
          <NavItem
            href="/main/spellforge"
            icon="⚡"
            iconBg="rgba(245,158,11,.15)"
            iconColor="#F59E0B"
            title="SpellForge"
            metaNum="Lv 3"
            metaText="철자"
          />
          <NavItem
            href="/main/wordblitz"
            icon="🌴"
            iconBg="rgba(16,185,129,.15)"
            iconColor="#10B981"
            title="WordBlitz"
            metaNum="Lv 1"
            metaText="인식"
          />
          <NavItem
            href="/main/storyflow"
            icon="📜"
            iconBg="rgba(234,179,8,.15)"
            iconColor="#EAB308"
            title="StoryFlow"
            metaNum="Lv 0"
            metaText="문맥"
            badge="new"
          />
        </div>
      </nav>

      <div className="mx-4 mb-2 mt-3 flex items-center gap-[10px]">
        <div className="h-px flex-1 bg-[var(--bd)]" />
        <span
          className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--t4)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          메타 도구
        </span>
        <div className="h-px flex-1 bg-[var(--bd)]" />
      </div>
      <div className="px-2 pb-3.5">
        <NavItem
          href="/main"
          icon="📊"
          iconBg="rgba(6,182,212,.15)"
          iconColor="#06B6D4"
          title="Dashboard"
          metaNum="+47"
          metaText="이번주"
        />
      </div>

      <SidebarFooter />
    </aside>
  )
}
