// apps/web/src/app/(main)/wordvault/page.tsx
// WordVault 허브 + 옛 `?view=` 주소 호환.
//
// Routes:
//   /wordvault                 → 허브 (기본 진입)
//   /wordvault?view=browse     → `/wordvault/browse` 로 이동 (쿼리 보존)
//   /wordvault?view=study      → `/wordvault/study`
//   /wordvault?view=review     → `/wordvault/review`
//
// ── 2026-08-30 — 이 파일에서 목업을 걷어냈다 ─────────────────────────
// 여기에는 `MOCK_WORDS` 13개를 들고 browse·study·review 를 **직접 그리는 분기**가 남아
// 있었다. 세 분기 모두 위 redirect 뒤에 있으므로 학습자에게는 **한 프레임 남의 단어**로만
// 보였고, review 분기는 `오늘 복습할 단어 12개` 를 **하드코딩**해 두고 있었다
// (실데이터와 무관한 수다 — 공개 표면의 지어낸 수치와 같은 계열).
//
// 지울 수 있었던 근거:
//   · 세 분기는 전부 `router.replace` 뒤에 있다 — 실 화면은 `/wordvault/{browse,study,review}`
//     가 각자 서버에서 데이터를 받아 그린다.
//   · TextViewer 인계(`lib/text-viewer/handoff`)는 **쓰는 쪽이 0개**였다. 즉
//     `consumePendingWords()` 는 언제나 `null` 이었고, 그 뒤의 토스트·상태 주입은 한 번도
//     실행된 적이 없다. 추출 단어는 지금 `/text/new` 에서 DB(`vocabularies`)로 바로 간다.
//   · 그래서 `words` 상태는 **항상 정확히 `MOCK_WORDS`** 였다.
//
// ⚠️ 허브 통계는 목업으로 폴백하지 않는다 — `useHubStats` 의 상태를 그대로 넘겨
//    "못 셌다" 와 "세어보니 0" 을 화면이 구별하게 한다(WordVaultHub 머리 주석).

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

import { GlassBar, SegmentControl } from '@/components/ui/ios'
import { WordVaultHub } from '@/components/wordvault/hub/WordVaultHub'
import { useHubStats } from '@/components/wordvault/hooks/useHubStats'
import { useTheme } from '@/hooks/useTheme'

/** 옛 주소 → 새 라우트. 값 하나를 두 곳에 적지 않으려고 표로 둔다. */
const VIEW_ROUTES: Record<string, string> = {
  browse: '/wordvault/browse',
  study: '/wordvault/study',
  review: '/wordvault/review',
}

export default function WordVaultPage() {
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()
  const searchParams = useSearchParams()

  const view = searchParams?.get('view') ?? null
  const target = view ? VIEW_ROUTES[view] : undefined

  const hubStatsState = useHubStats()

  // ── 옛 `?view=` 주소 호환 ──
  //
  // ⚠️ **나머지 쿼리를 보존한다.** 허브는 `?view=browse&q=<단어>` · `&level=B1` 로 보내는데,
  //    `view` 만 떼고 넘기지 않으면 그 조건이 목적지에 닿지 않는다.
  //    (그 두 파라미터를 읽는 자는 `lib/wordvault/list-params` 하나다.)
  useEffect(() => {
    if (!target) return
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.delete('view')
    const qs = params.toString()
    router.replace(qs ? `${target}?${qs}` : target)
  }, [target, searchParams, router])

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
              active={view && VIEW_ROUTES[view] ? view : 'hub'}
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

      {/* ── 메인 (iOS 그레이 캔버스) ── */}
      <main className="flex-1 overflow-y-auto bg-[var(--bg2)] pb-12">
        {/* 이동 중에는 아무것도 그리지 않는다 — 한 프레임짜리 남의 화면을 보여 주느니
            빈 캔버스가 낫다(Calm UI). 목적지가 자기 데이터로 즉시 그린다. */}
        {!target && <WordVaultHub stats={hubStatsState} />}
      </main>
    </>
  )
}
