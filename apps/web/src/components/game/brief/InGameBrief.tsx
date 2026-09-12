// apps/web/src/components/game/brief/InGameBrief.tsx
//
// 게임 **안에서** 브리핑에 닿는 자리 — 첫 판 자동 + 언제든 (?) 재열람.
//
// ── 왜 필요한가 ──────────────────────────────────────────────────
// 브리핑은 19종 전부에 있는데 트리거가 허브 카드 하나뿐이었다. 허브를 거치지 않는 경로가
// 이미 여럿이다 — 자료 화면의 코스 칩 · 오늘의 실험 · 주소 직접 입력 · 세션 복귀.
// 그 경로로 들어온 학습자는 규칙을 한 번도 못 본 채 게임 안에 떨어진다.
//
// ── 왜 "게임을 렌더하지 않고" 막는가 ─────────────────────────────
// 브리핑을 게임 **위에** 띄우면 뒤에서 게임이 이미 돌기 시작한다. 이 아케이드의 게임은
// 대부분 마운트와 함께 시계·박·거리가 흐르므로(각 게임 헤더의 판돈 계약), 학습자가
// 브리핑을 읽는 동안 첫 판이 소모된다. 그래서 **첫 판에 한해 게임을 아예 마운트하지 않는다.**
// 이것이 CLAUDE.md 의 "모달로 학습 중단 금지"와 충돌하지 않는 이유이기도 하다 —
// 끊는 것이 아니라, 시작 **전**에 답을 주고 시작시킨다.
//
// 재열람((?) 버튼)은 학습 중 오버레이가 맞다. 그래서 자동으로 열지 않고 **학습자가 누를 때만**
// 연다. 누르는 순간은 이미 "규칙을 모르겠다"는 상태라 인출이 진행 중이 아니다.

'use client'

import { useCallback, useEffect, useState } from 'react'

import GameBriefModal from '@/components/game/brief/GameBriefModal'
import { hasBrief } from '@/lib/game/brief'
import { isBriefSeen, markBriefSeen } from '@/lib/game/brief-seen'
import type { GameSlug } from '@/lib/game/catalog'

export type BriefGatePhase =
  /** localStorage 조회 전 — 서버/클라이언트가 갈리지 않도록 아무것도 결정하지 않는다 */
  | 'resolving'
  /** 첫 판 — 브리핑이 열려 있고 게임은 아직 마운트하지 않는다 */
  | 'blocking'
  /** 게임을 그린다 */
  | 'ready'

export interface BriefGate {
  phase: BriefGatePhase
  /** 다이얼로그가 열려 있는가 (첫 판 자동 + 재열람 공통) */
  open: boolean
  /** 브리핑을 닫고 게임으로 — 첫 판이면 '봤음'으로 기록한다 */
  dismiss: () => void
  /** (?) 버튼 — 다시 펼친다 */
  reopen: () => void
}

/**
 * 브리핑 게이트.
 *
 * ⚠️ `isBriefSeen` 을 렌더 중에 부르지 않는다 — 서버는 항상 false 라 hydration 이 깨진다.
 * effect 안에서 한 번만 묻고, 그 전에는 `resolving` 으로 둔다.
 */
export function useBriefGate(slug: GameSlug): BriefGate {
  const [phase, setPhase] = useState<BriefGatePhase>('resolving')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!hasBrief(slug) || isBriefSeen(slug)) {
      setPhase('ready')
      setOpen(false)
      return
    }
    setPhase('blocking')
    setOpen(true)
  }, [slug])

  const dismiss = useCallback(() => {
    markBriefSeen(slug)
    setOpen(false)
    setPhase('ready')
  }, [slug])

  const reopen = useCallback(() => setOpen(true), [])

  return { phase, open, dismiss, reopen }
}

/**
 * 게이트의 화면 — 다이얼로그 + (?) 버튼.
 *
 * 버튼은 허브의 `.arc-brief` 를 쓸 수 없다(그 CSS 는 /arcade 페이지 안에만 있다).
 * 게임 셸 위에 얹히므로 스타일을 인라인으로 들고 다닌다 — 44px 터치 타겟(CLAUDE.md).
 */
export default function InGameBrief({
  slug,
  gate,
  name,
}: {
  slug: GameSlug
  gate: BriefGate
  /** 스크린리더용 게임 이름 */
  name: string
}) {
  if (!hasBrief(slug)) return null

  return (
    <>
      {/* 첫 판 자동 열람이 끝난 뒤에만 (?) 를 그린다 — 브리핑이 열려 있는 동안
          그 뒤에 같은 기능의 버튼이 겹쳐 보이면 무엇을 눌러야 하는지가 흐려진다. */}
      {gate.phase === 'ready' && !gate.open && (
        <button
          type="button"
          onClick={gate.reopen}
          aria-label={`${name} — 게임 설명과 연습 다시 보기`}
          aria-haspopup="dialog"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 45,
            width: 44,
            height: 44,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,.22)',
            background: 'rgba(18,16,22,.62)',
            color: 'rgba(255,255,255,.82)',
            backdropFilter: 'blur(6px)',
            cursor: 'pointer',
            transition: 'background .18s cubic-bezier(.2,.7,.3,1), border-color .18s cubic-bezier(.2,.7,.3,1)',
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6v.3" />
            <path d="M12 17.2h.01" />
          </svg>
        </button>
      )}

      {gate.open && (
        <GameBriefModal
          entries={[{ slug, href: '#' }]}
          onClose={gate.dismiss}
          onLaunch={gate.dismiss}
          launchLabel={gate.phase === 'blocking' ? '시작하기' : '계속하기'}
        />
      )}
    </>
  )
}
