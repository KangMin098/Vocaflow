// apps/web/src/components/ui/Modal.tsx
//
// **기반 모달 — 참조 팝업 껍데기(`ui/Dialog`)의 얇은 호환 층**(DD-68 · tines-mapping §28).
//
// ── 왜 껍데기를 직접 그리지 않나 (2026-09-23) ──────────────────────────────
// 이 파일은 예전에 자기 배경막(black/50)·패널·머리·닫기 버튼·keyframes 를 전부 가지고
// 있었다. 그 결과 저장소에 팝업 껍데기가 두 벌(여기 + 화면마다 손으로 그린 것)이 되었고,
// 참조를 닮게 고칠 때 둘 다 고쳐야 했다. 지금은 `Dialog` 하나가 껍데기의 단일 출처다.
// 여기 남는 것은 **호출 방식의 차이**뿐이다:
//   · `Dialog` 는 마운트 = 열림이다(조건부 렌더).
//   · `Modal` 은 `isOpen` 을 받는다 — 이미 그렇게 쓰는 곳(`/dev/components` 갤러리)과
//     "상태 하나로 열고 닫는" 익숙한 형태를 위해 남긴다. 닫히면 아무것도 마운트하지 않는다.
//
// 결정을 받는 팝업(`ConfirmModal`)은 참조 바닥 줄 그대로 — 2차는 테두리 알약, 1차는 채운 알약.

'use client'

import { type ReactNode } from 'react'

import { Dialog, type DialogSize, type DialogTone } from './Dialog'
import { BTN } from './tines-kit'

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════
export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** 푸터 액션 (보통 버튼들) */
  footer?: ReactNode
  /** 빵부스러기 — 참조 팝업의 첫 줄(알약 → `›` 로 잇는 자리). */
  crumbs?: ReactNode[]
  /** 윤곽선 태그 알약 줄. */
  tags?: ReactNode[]
  /** 머리를 옅은 면으로. */
  headerTone?: DialogTone
  /** 크기 — `fullscreen` 은 참조에 대응물이 없어 가장 큰 `xl` 로 받는다. */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen'
  /** 배경 클릭 시 닫기 (기본 true) */
  closeOnBackdrop?: boolean
  className?: string
}

const SIZE_MAP: Record<NonNullable<ModalProps['size']>, DialogSize> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
  fullscreen: 'xl',
}

// ══════════════════════════════════════════════════════════════
// Modal
// ══════════════════════════════════════════════════════════════
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  crumbs,
  tags,
  headerTone,
  size = 'md',
  closeOnBackdrop = true,
  className,
}: ModalProps) {
  if (!isOpen) return null

  return (
    <Dialog
      onClose={onClose}
      title={title ?? ''}
      byline={description}
      crumbs={crumbs}
      tags={tags}
      headerTone={headerTone}
      size={SIZE_MAP[size]}
      closeOnBackdrop={closeOnBackdrop}
      footer={footer}
      className={className}
    >
      {children}
    </Dialog>
  )
}

// ══════════════════════════════════════════════════════════════
// ConfirmModal — 확인/취소 패턴 헬퍼
// ══════════════════════════════════════════════════════════════
export interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'primary'
  loading?: boolean
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = '확인',
  cancelText = '취소',
  variant = 'primary',
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button type="button" className={BTN.secondary} onClick={onClose} disabled={loading}>
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={
              variant === 'danger'
                ? // 되돌릴 수 없는 동작 — 채운 면을 오류색으로. 글자는 크림(--on-semantic).
                  `${BTN.primary} ml-auto bg-[var(--error)] text-[var(--on-semantic)] hover:bg-[var(--error-ink)]`
                : `${BTN.primary} ml-auto`
            }
          >
            {loading ? '처리 중…' : confirmText}
          </button>
        </>
      }
    />
  )
}
