// apps/web/src/app/admin/pending-words/PendingWordActions.tsx
// Client wrapper for admin status transition buttons.

'use client'

import { useTransition } from 'react'
import { Check, Loader2, RefreshCw, RotateCcw, X, Zap } from 'lucide-react'

import { transitionPendingWord, type PendingWordStatus } from './actions'
import { useToast } from '@/components/ui/Toast'

interface PendingWordActionsProps {
  id: string
  currentStatus: PendingWordStatus
}

interface ActionDef {
  to: PendingWordStatus
  label: string
  Icon: typeof Check
  color: string
  bg: string
  hoverBg: string
  title: string
}

const ACTIONS: ActionDef[] = [
  {
    // 되돌리기 — 잘못 누른 판정을 UI 로 복구하는 유일한 경로.
    // 이게 없던 동안 관리자는 한 번 누른 상태를 화면에서 되돌릴 수 없었다
    // (RPC 는 처음부터 'pending' 을 받았다 — 버튼만 없었다).
    to: 'pending',
    label: '되돌리기',
    Icon: RotateCcw,
    color: 'var(--error)',
    bg: 'var(--error-light)',
    hoverBg: 'var(--error)',
    title: '대기 상태로 되돌리기 — 판정 취소',
  },
  {
    to: 'reviewing',
    label: '검토',
    Icon: RefreshCw,
    color: 'var(--active)',
    bg: 'var(--warning-light)',
    hoverBg: 'var(--active)',
    title: '검토중 상태로 이동',
  },
  {
    to: 'auto-classify',
    label: 'AI',
    Icon: Zap,
    color: 'var(--info)',
    bg: 'var(--info-light)',
    hoverBg: 'var(--info)',
    title: 'AI 자동 분류 예약',
  },
  {
    to: 'added',
    label: '추가',
    Icon: Check,
    color: 'var(--success)',
    bg: 'var(--success-light)',
    hoverBg: 'var(--success)',
    title: 'shared_dictionary 에 추가됨 표시',
  },
  {
    to: 'rejected',
    label: '거절',
    Icon: X,
    color: 'var(--t3)',
    bg: 'var(--bg3)',
    hoverBg: 'var(--t3)',
    title: '거절 — 사전 추가 부적합',
  },
]

export function PendingWordActions({ id, currentStatus }: PendingWordActionsProps) {
  const [pending, startTransition] = useTransition()
  const toast = useToast()

  function onClick(to: PendingWordStatus) {
    startTransition(async () => {
      const result = await transitionPendingWord(id, to)
      if (!result.ok) {
        toast.error(result.error ?? '상태 변경에 실패했어요')
      }
    })
  }

  return (
    <div className="flex items-center gap-1">
      {pending && (
        <Loader2 size={11} className="animate-spin text-[var(--t2)]" aria-hidden />
      )}
      {ACTIONS.map((a) => {
        const isCurrent = currentStatus === a.to
        return (
          <button
            key={a.to}
            type="button"
            onClick={() => onClick(a.to)}
            disabled={pending || isCurrent}
            title={a.title}
            aria-label={a.title}
            className="inline-flex items-center gap-1 rounded-[var(--r-sm)] px-2 py-1 font-display text-[10px] font-[700] transition-all duration-[var(--dur-fast)] hover:scale-105 disabled:cursor-not-allowed disabled:opacity-30"
            style={{ backgroundColor: a.bg, color: a.color }}
          >
            <a.Icon size={9} aria-hidden />
            {a.label}
          </button>
        )
      })}
    </div>
  )
}
