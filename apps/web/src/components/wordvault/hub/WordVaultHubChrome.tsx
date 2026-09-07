// apps/web/src/components/wordvault/hub/WordVaultHubChrome.tsx
//
// 허브의 상단 바 — **이 파일만 클라이언트다.**
//
// 라우트가 서버 컴포넌트로 돌아가면서(요청 낭비 제거) 클라이언트가 꼭 필요한 것은
// 테마 토글 하나만 남았다. 그 하나 때문에 화면 전체를 클라이언트로 두면 서버 렌더가 0 이 된다 —
// 그게 정확히 2026-09-05 이전의 상태였다. 그래서 껍데기만 클라이언트로 떼어 둔다.

'use client'

import type { ReactNode } from 'react'

import { GlassBar, SegmentControl } from '@/components/ui/ios'
import { useTheme } from '@/hooks/useTheme'

interface WordVaultHubChromeProps {
  activeView: 'hub' | 'browse' | 'study' | 'review'
  children: ReactNode
}

export function WordVaultHubChrome({ activeView, children }: WordVaultHubChromeProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <>
      <GlassBar
        leading={
          <h1 className="font-editorial text-[18px] font-[500] tracking-[-0.012em] text-[var(--t1)]">
            WordVault
          </h1>
        }
        trailing={
          <>
            <SegmentControl
              ariaLabel="WordVault 뷰"
              active={activeView}
              items={[
                { key: 'hub', label: '허브', href: '/wordvault' },
                { key: 'browse', label: '둘러보기', href: '/wordvault/browse' },
                { key: 'study', label: '학습', href: '/wordvault/study' },
                { key: 'review', label: '복습', href: '/wordvault/review' },
              ]}
            />
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="테마 전환"
              // ⚠️ 보이는 크기는 32px 인데 **누르는 영역이 32px 이면 안 된다**(기준 44px).
              //    ⚠️ `::after` 로 히트영역만 얹으면 실제 탭은 커지지만 **계측기가 못 본다** —
              //       bounding rect 가 그대로라 위반이 그대로 찍힌다(WordRow 에서 겪었다).
              //    → 버튼 자체를 44px 로 만들고, 음수 마진으로 **차지하는 자리는 그대로** 둔다.
              className="group/theme -m-1.5 flex h-11 w-11 shrink-0 items-center justify-center"
            >
              <span
                aria-hidden
                className="flex h-8 w-8 items-center justify-center rounded-ios-pill text-[var(--t2)] transition-colors duration-[var(--dur-ios-fast)] group-hover/theme:bg-[var(--bg2)] group-hover/theme:text-[var(--t1)]"
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </span>
            </button>
          </>
        }
      />
      {children}
    </>
  )
}
