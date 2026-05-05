'use client'

import Link from 'next/link'

type Props = {
  userName?: string
  userInitial?: string
  level?: number
  streak?: number
  isOnline?: boolean
}

export default function SidebarFooter({
  userName = '김학생',
  userInitial = '김',
  level = 4,
  streak = 7,
  isOnline = true,
}: Props) {
  return (
    <div className="flex items-center gap-2.5 border-t border-[var(--bd)] bg-[var(--bg)] px-3.5 py-[11px]">
      <div
        className="relative flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
        style={{
          background: 'linear-gradient(135deg, var(--p), var(--combo))',
          boxShadow: '0 2px 6px rgba(59,130,246,.25)',
        }}
      >
        {userInitial}
        {isOnline && (
          <span
            className="absolute bottom-0 right-0 h-[9px] w-[9px] rounded-full"
            style={{ background: 'var(--success)', border: '2px solid var(--bg)' }}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div
          className="flex items-center gap-1.5 text-[13px] font-bold leading-[1.2] text-[var(--t1)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <span>{userName}</span>
          <span
            className="rounded px-[5px] py-px text-[9px] font-extrabold tracking-[0.05em]"
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--combo)',
              background: 'var(--combo-light)',
            }}
          >
            Lv {level}
          </span>
        </div>
        <div
          className="mt-0.5 flex items-center gap-[3px] text-[10px] font-semibold text-[var(--t3)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          <span className="text-[var(--active)]">🔥</span>
          <span>{streak}일 연속</span>
        </div>
      </div>

      <Link
        href="/settings"
        className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[7px] text-[13px] text-[var(--t3)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
      >
        ⚙
      </Link>
    </div>
  )
}
