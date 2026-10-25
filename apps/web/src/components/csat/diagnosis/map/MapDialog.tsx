// apps/web/src/components/csat/diagnosis/map/MapDialog.tsx
//
// 학습지도 팝업 껍데기(LM-W1) — 3B 모달(popup.module.css · --p-* = spec.json modal) 과 오른쪽 드로어 두 가지.
// 계약: Esc · 바깥 누르기 닫기 · 포커스 가둠/복원(useModalFocus) · 배경 스크롤 잠금 · role="dialog" + aria-modal + aria-labelledby.
// 마운트 = 열림. 닫힌 뒤 포커스는 연 요소로 돌아간다(useModalFocus 가 이전 activeElement 로 되돌린다).

'use client'

import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

import { useModalFocus } from '../useModalFocus'
import p from './popup.module.css'
import u from './unified.module.css'

export function MapDialog({ kind = 'modal', labelledBy, head, foot, navigation, wide = false, onClose, testId, dataWs, children }: {
  kind?: 'modal' | 'drawer'
  labelledBy: string
  head: ReactNode
  foot?: ReactNode
  navigation?: ReactNode
  wide?: boolean
  onClose: () => void
  testId: string
  dataWs?: string
  children: ReactNode
}) {
  const ref = useModalFocus<HTMLDivElement>()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  return (
    <div className={`${p.overlay} ${kind === 'drawer' ? u.drawerOverlay : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`${p.modal} ${wide ? p.detailModal : ''} ${kind === 'drawer' ? u.drawer : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} data-testid={testId} data-ws={dataWs}>
        <div className={p.head}>
          <div className={p.who}>{head}</div>
          <button type="button" className={p.close} onClick={onClose} aria-label="닫기" data-testid={`${testId}-close`}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {navigation}
        <div className={p.body}>{children}</div>
        {foot && <div className={p.foot}>{foot}</div>}
      </div>
    </div>
  )
}
