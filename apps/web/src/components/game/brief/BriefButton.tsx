// apps/web/src/components/game/brief/BriefButton.tsx
// 브리핑 트리거 — 서버 렌더된 허브 위에 얹히는 최소 클라이언트 아일랜드.
//
// 왜 카드 전체가 아니라 별도 버튼인가:
//   카드 자체는 `<a href="/play/...">` 여야 한다(새 탭 열기·주소 복사·프리페치가 전부 거기 달려 있고,
//   e2e 가 `.arc-grid a[href^="/play/"]` 수로 "도달 가능한 게임 수" 를 못 박고 있다).
//   중첩 인터랙티브는 HTML 위반이므로, 트리거는 카드의 **형제**로 두고 위에 겹친다.
//
// 왜 아일랜드로 쪼개는가:
//   허브 전체를 'use client' 로 바꾸면 19장 카드와 카탈로그가 통째로 클라이언트 번들에 실린다.
//   실제로 상호작용이 필요한 것은 이 버튼과 열렸을 때의 다이얼로그뿐이다.

'use client'

import { useState } from 'react'

import GameBriefModal, { type BriefEntry } from '@/components/game/brief/GameBriefModal'

interface Props {
  entries: BriefEntry[]
  /** 계열 카드에서 열 때의 계열명 — 다이얼로그 머리글에 표기 */
  familyName?: string
  /** 스크린리더용 이름의 주어 (예: "Cascade") */
  subject: string
  /** icon = 카드 모서리 44px 원형 · pill = 라벨 있는 알약 */
  variant?: 'icon' | 'pill'
}

export default function BriefButton({ entries, familyName, subject, variant = 'icon' }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={variant === 'pill' ? 'arc-brief arc-brief--pill' : 'arc-brief'}
        aria-label={`${subject} — 게임 설명과 연습 보기`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6v.3" />
          <path d="M12 17.2h.01" />
        </svg>
        {variant === 'pill' && <span>How to play</span>}
      </button>

      {open && (
        <GameBriefModal entries={entries} familyName={familyName} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
