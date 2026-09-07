// apps/web/src/components/textviewer/DiscoveryFooter.tsx
//
// My Library 푸터 — **지금 보고 있는 면과 짝이 되는 공용 서가**로 넘긴다.
//
// ─────────────────────────────────────────────────────────────
// v08.6 수정 — Decks 면이 스크립트를 팔고 있었다 (사용자 신고 2026-08-17)
//
// 이 푸터는 면과 무관하게 **무조건** 렌더되면서 항상 "새로운 스크립트가 필요하신가요?" 를
// 띄웠다. 그래서 `?view=vocab`(Decks) 에서도 단어장 캐러셀 바로 아래에 스크립트 광고가 붙었다.
//
// 같은 화면의 **상단 카드는 이미 면마다 다르게** 그려지고 있었고, 주석까지 달려 있었다:
//   "다음 행동은 면마다 다르다. Decks 면에 '새 스크립트 추가하기' 를 두면 이 면이 무엇을
//    모으는 곳인지 잘못 가르친다"
// 푸터만 그 규칙을 안 따랐다. 한 화면에서 위아래가 서로 다른 규칙을 쓰면 반드시 이렇게 갈린다.
//
// 함께 있던 결함 둘:
//   · **은퇴한 이름** — 'Script' 는 활동명 `ScriptQuiz` 안에만 남는다. 내가 넣은 본문은 `Texts`,
//     공개 짧은 글은 `Dispatches` 다(apps/web/CLAUDE.md 이름 표). 게다가 링크 대상은 `/library`
//     루트라 "스크립트" 를 찾아가면 그런 이름의 면이 아예 없었다.
//   · **조사 오류 2개** — `스크립트이 필요하신가요` (→ 가) · `스크립트을 찾아보세요` (→ 를).
//     이번 세션에서만 세 번째 같은 계열이라, 아래 문구는 **조사가 필요 없는 형태**로 적는다.
//
// 규칙: 이름·주소는 레지스트리(`lib/library/tabs`)에서 가져온다. 여기서 짓지 않는다.
// ─────────────────────────────────────────────────────────────

import { ArrowRight, Library } from 'lucide-react'
import Link from 'next/link'

import { LIBRARY_TABS } from '@/lib/library/tabs'
import type { MyLibraryView } from '@/lib/library/tabs'

/**
 * 면 → 공용 서가의 짝.
 *
 * `vocab` 이 없는 것은 의도다 — Decks 면은 **상단에 이미** "단어장 더 둘러보기"(`/library/vocab`)
 * 카드가 있다. 아래에 또 두면 같은 곳으로 가는 CTA 가 한 화면에 둘이 된다.
 */
const PAIR: Partial<Record<MyLibraryView, { tabIndex: number; lead: string }>> = {
  books: { tabIndex: 0, lead: '더 읽을 책을 찾고 있나요?' },
  scripts: { tabIndex: 1, lead: '읽을거리를 더 찾고 있나요?' },
}

export function DiscoveryFooter({ view }: { view: MyLibraryView }) {
  const pair = PAIR[view]
  if (!pair) return null

  const tab = LIBRARY_TABS[pair.tabIndex]

  return (
    <Link
      href={tab.href}
      className="group flex items-center gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-4 transition-colors duration-[var(--dur-normal)] hover:border-[var(--p)] hover:bg-[var(--bg)]"
    >
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] bg-[var(--p)]/10 text-[var(--p)]"
        aria-hidden="true"
      >
        <Library size={16} strokeWidth={2} />
      </span>
      <div className="flex-1">
        <p className="font-display text-[13px] font-[700] text-[var(--t1)]">{pair.lead}</p>
        {/* 이름은 레지스트리에서 · 조사를 붙이지 않는 형태로 적는다 */}
        <p className="font-body text-[12px] text-[var(--t2)]">
          공용 서가 · {tab.label} — {tab.says}
        </p>
      </div>
      <ArrowRight
        size={16}
        className="text-[var(--t2)] transition-transform duration-[var(--dur-normal)] group-hover:translate-x-0.5 group-hover:text-[var(--p)]"
        aria-hidden="true"
      />
    </Link>
  )
}
