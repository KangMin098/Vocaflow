// apps/web/src/components/wordvault/hub/WordVaultHubChrome.tsx
//
// 허브의 머리 — **이 파일만 클라이언트다.**
//
// 라우트가 서버 컴포넌트로 돌아가면서(요청 낭비 제거) 클라이언트가 꼭 필요한 것은
// 테마 토글 하나만 남았다. 그 하나 때문에 화면 전체를 클라이언트로 두면 서버 렌더가 0 이 된다 —
// 그게 정확히 2026-09-05 이전의 상태였다. 그래서 껍데기만 클라이언트로 떼어 둔다.
//
// 머리 한 장(2026-10-18 · learner-tines-audit §0-3 단어장): 예전에는 셸 머리띠(모듈 이름 + 한 줄) ·
// 얇은 바(18px 제목 + 보기 탭 + 테마) · 본문이 시작선 셋(x232 · x20 · x333)으로 갈렸고 제목이 18px 였다.
// 참조 도서관 머리(tines.com/library — 눈썹 · 44px 제목 · 설명 · 그림 · 판 아랫변 탭)처럼 서가와 같은
// `AreaHero` 한 장으로 합친다. 세 역할은 그대로다 — 제목(h1) · 자료 정보(아래 본문 카드) · 학습 조작(판 탭 + 본문 CTA).
// 문구는 새로 짓지 않는다 — 머리띠가 쓰던 사이드바 정의(stageOf)를 그대로 읽는다.

'use client'

import { Moon, Sun } from 'lucide-react'

import type { ReactNode } from 'react'

import { AreaHero } from '@/components/layout/AreaHero'
import { stageOf } from '@/components/layout/ModuleBanner'
import { useTheme } from '@/hooks/useTheme'
import { MODULE_TONE } from '@/lib/design/tone'

interface WordVaultHubChromeProps {
  activeView: 'hub' | 'browse' | 'study' | 'review'
  children: ReactNode
}

const VIEWS = [
  { key: 'hub', label: '허브', href: '/wordvault' },
  { key: 'browse', label: '둘러보기', href: '/wordvault/browse' },
  { key: 'study', label: '학습', href: '/wordvault/study' },
  { key: 'review', label: '복습', href: '/wordvault/review' },
] as const

export function WordVaultHubChrome({ activeView, children }: WordVaultHubChromeProps) {
  const { theme, toggleTheme } = useTheme()
  const stage = stageOf('/wordvault')

  return (
    <>
      {/* 본문(WordVaultHub)과 같은 틀 — max 820 · px-4/6 — 이라 판과 본문 카드가 한 시작선에 선다 */}
      <div data-vault-hero={activeView} className="mx-auto w-full max-w-[820px] px-4 pt-4 md:px-6 md:pt-5">
        <AreaHero
          kicker={stage ? `${stage.label} · ${stage.item}` : 'WordVault'}
          title="WordVault"
          sub={stage?.says ?? '만난 단어를 내 것으로 모아요'}
          tile="tile-vault"
          desktopScene={activeView === 'hub' ? 'scene-vault-v4' : undefined}
          desktopSub={activeView === 'hub' ? '읽다가 만난 단어, 여기서 다시 만나요.' : undefined}
          tint={MODULE_TONE.wordvault.tint}
          deep={MODULE_TONE.wordvault.deep}
          tabs={VIEWS.map((v) => ({ href: v.href, label: v.label, active: v.key === activeView }))}
          trailing={
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="테마 전환"
              className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--t1)] transition-colors duration-[var(--dur-quick)] hover:bg-[color-mix(in_srgb,var(--on-deep)_16%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--on-deep)]"
            >
              {theme === 'light' ? <Moon size={17} strokeWidth={2} aria-hidden /> : <Sun size={17} strokeWidth={2} aria-hidden />}
            </button>
          }
        />
      </div>
      {children}
    </>
  )
}
