// apps/web/src/components/ui/Dialog.tsx
//
// **팝업 공통 골격 — 참조(Tines) 팝업 구조 그대로**(DD-68 · tines-mapping §28).
//
// ── 왜 한 부품인가 (실측 2026-09-23) ────────────────────────────────────────
// 저장소의 팝업 14개는 껍데기를 **저마다 손으로** 그리고 있었다. 배경막이 어떤 것은
// `rgba(23,17,10,.55)`, 어떤 것은 `--t1` 50%, 모서리는 `--r-lg`·`--r-xl` 이 섞였고,
// 닫기 버튼은 네 가지 모양이었다. 그래서 「참조를 닮게」 를 한 번 하려면 14곳을 똑같이
// 고쳐야 했고, 다음에 생기는 팝업은 또 자기 껍데기를 그렸다.
// 내용(무엇을 보여 줄지)은 화면마다 다르지만 **껍데기는 하나**다 — 여기에 둔다.
//
// ── 참조 팝업에서 그대로 가져온 것 ─────────────────────────────────────────
//   ① 배경막이 밝다 — 뒤 화면을 어둡게 덮는 대신 지면 색으로 씻는다. 팝업은 「덮개」가
//      아니라 「앞으로 나온 종이」다. 그래서 패널은 1px 라벤더 테두리로 자기 윤곽을 그린다.
//   ② 머리 차례: 빵부스러기 알약 → 큰 제목 → 작성자·한 줄 → 윤곽선 태그 + 오른쪽 메타.
//      팝업 제목이 페이지 제목만큼 크다(참조 40px) — 팝업이 곧 하나의 화면이다.
//   ③ 머리 아래 가로선, 본문 2열(넓은 왼쪽 + 좁은 오른쪽).
//   ④ 오른쪽 위 원형 아이콘 버튼, 패널 **바깥** 좌우에 원형 이전/다음.
//
// ── 계약(호출부가 안 해도 되는 것) ─────────────────────────────────────────
// Esc · 바깥 누르기 · 뒤로가기(`useCloseOnBack`) · 포커스 가둠과 복원(`useFocusTrap`) ·
// 배경 스크롤 잠금 · 포털 · `role="dialog"` + `aria-modal` + `aria-labelledby` 를 전부 여기서
// 한다. 호출부는 내용과 `onClose` 만 준다.
//
// ⚠️ 마운트 = 열림이다. `isOpen` 을 받지 않는다 — 조건부 렌더가 열고 닫는 유일한 방법이라
//    "열렸는데 훅이 안 걸린" 상태가 생기지 않는다.

'use client'

import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { DIALOG, TINT_PANEL } from './tines-kit'
import { cn } from '@/lib/utils/cn'
import { useCloseOnBack } from '@/lib/ui/use-close-on-back'
import { useFocusTrap } from '@/lib/ui/use-focus-trap'

// ══════════════════════════════════════════════════════════════
// 크기 — 참조 예제 모달은 1142px(xl). 결정만 받는 팝업은 좁게.
// ══════════════════════════════════════════════════════════════
const SIZE = {
  sm: 'max-w-[460px]',
  md: 'max-w-[620px]',
  lg: 'max-w-[880px]',
  xl: 'max-w-[1140px]',
} as const

export type DialogSize = keyof typeof SIZE

/** 옅은 면 색 — `.tone-*`(globals.css §면 톤)과 같은 이름. */
export type DialogTone = 'lavender' | 'green' | 'peach' | 'yellow' | 'pink' | 'teal'

export interface DialogProps {
  onClose: () => void
  /** 제목 — 참조처럼 크게 나간다. 문자열이 아니어도 된다. */
  title: ReactNode
  /** 빵부스러기. 첫 칸은 알약, 나머지는 `›` 로 잇는다. */
  crumbs?: ReactNode[]
  /** 제목 아래 한 줄 — 참조의 「By 작성자」 자리. */
  byline?: ReactNode
  /** 윤곽선 태그 알약. */
  tags?: ReactNode[]
  /** 태그 줄 오른쪽 — 참조의 「Works with」 자리. */
  meta?: ReactNode
  /** 제목 왼쪽 타일(표지·인장 등). */
  media?: ReactNode
  /** 닫기 왼쪽에 놓을 원형 아이콘 버튼들. */
  headerActions?: ReactNode
  /** 패널 바깥 좌우 원형 화살표 — 목록을 팝업 안에서 넘길 때만. */
  onPrev?: () => void
  onNext?: () => void
  prevLabel?: string
  nextLabel?: string
  footer?: ReactNode
  size?: DialogSize
  /** 머리를 옅은 면으로 — 범주 색이 있는 팝업(도서·시리즈·게임). */
  headerTone?: DialogTone
  /** 머리 면에 점 격자(§25). `headerTone` 과 함께. */
  headerDots?: boolean
  closeOnBackdrop?: boolean
  /** 본문 좌우 여백을 직접 다루고 싶을 때(표지 전면 등) — 기본 여백을 끈다. */
  bare?: boolean
  /** 스크린리더용 이름 — 제목이 글자가 아닐 때(표지·기호). */
  ariaLabel?: string
  className?: string
  children?: ReactNode
}

export function Dialog({
  onClose,
  title,
  crumbs,
  byline,
  tags,
  meta,
  media,
  headerActions,
  onPrev,
  onNext,
  prevLabel = '이전',
  nextLabel = '다음',
  footer,
  size = 'md',
  headerTone,
  headerDots = false,
  closeOnBackdrop = true,
  bare = false,
  ariaLabel,
  className,
  children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const [shown, setShown] = useState(false)

  // 뒤로가기로 닫는다 — 폰에는 Esc 가 없다.
  useCloseOnBack(true, onClose)
  // 포커스는 패널 자체로 들어간다(긴 팝업에서 첫 버튼으로 뛰면 제목을 건너뛴다).
  useFocusTrap(true, panelRef)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const raf = requestAnimationFrame(() => setShown(true))
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      cancelAnimationFrame(raf)
    }
  }, [onClose])

  // SSR 가드 — 포털은 브라우저에서만.
  if (typeof document === 'undefined') return null

  const hasHeader = Boolean(title || crumbs?.length || byline || tags?.length || meta)

  const closeRow = (
    <div className="absolute right-4 top-4 z-20 flex items-center gap-2 sm:right-6 sm:top-6">
      {headerActions}
      <button type="button" onClick={onClose} aria-label="닫기" className={DIALOG.iconBtn}>
        <X size={18} aria-hidden />
      </button>
    </div>
  )

  return createPortal(
    <div
      className={cn(
        DIALOG.overlay,
        'transition-opacity duration-[var(--dur-normal)] ease-[var(--ease-out-quint)]',
        shown ? 'opacity-100' : 'opacity-0',
      )}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      {/* 이전/다음 — 참조는 패널 **바깥** 좌우에 둔다. 목록을 닫지 않고 넘기는 자리다. */}
      {onPrev && (
        <button
          type="button"
          onClick={onPrev}
          aria-label={prevLabel}
          className={cn(DIALOG.edgeBtn, 'left-4 xl:left-8')}
        >
          <ArrowLeft size={20} aria-hidden />
        </button>
      )}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          aria-label={nextLabel}
          className={cn(DIALOG.edgeBtn, 'right-4 xl:right-8')}
        >
          <ArrowRight size={20} aria-hidden />
        </button>
      )}

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabel ? undefined : titleId}
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          DIALOG.panel,
          SIZE[size],
          'transition-[opacity,transform] duration-[var(--dur-normal)] ease-[var(--ease-out-quint)]',
          shown
            ? 'translate-y-0 opacity-100 sm:scale-100'
            : 'translate-y-6 opacity-0 sm:translate-y-0 sm:scale-[0.98]',
          className,
        )}
      >
        {hasHeader ? (
          <header
            className={cn(
              DIALOG.header,
              'relative',
              headerTone && `tone-${headerTone}`,
              headerTone && headerDots && 'dots',
            )}
          >
            {closeRow}

            <div className={cn('flex gap-4', media ? 'items-start' : 'flex-col')}>
              {media && <div className="shrink-0">{media}</div>}
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                {crumbs && crumbs.length > 0 && (
                  <nav className={cn(DIALOG.crumbs, 'pr-24 sm:pr-28')} aria-label="위치">
                    {crumbs.map((c, i) => (
                      <span key={i} className="inline-flex items-center gap-2">
                        {i > 0 && (
                          <span aria-hidden className="text-[var(--t3)]">
                            ›
                          </span>
                        )}
                        {i === 0 ? <span className={DIALOG.crumbPill}>{c}</span> : <span>{c}</span>}
                      </span>
                    ))}
                  </nav>
                )}
                <div className="flex flex-col gap-2">
                  <h2 id={titleId} className={cn(DIALOG.title, !crumbs?.length && 'pr-24 sm:pr-28')}>
                    {title}
                  </h2>
                  {byline && <p className={DIALOG.byline}>{byline}</p>}
                </div>
                {((tags && tags.length > 0) || meta) && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    {tags && tags.length > 0 && (
                      <ul className="flex flex-wrap items-center gap-2">
                        {tags.map((t, i) => (
                          <li key={i} className={DIALOG.tag}>
                            {t}
                          </li>
                        ))}
                      </ul>
                    )}
                    {/* 태그가 없으면 오른쪽으로 밀지 않는다 — 혼자 오른쪽 끝에 뜬 칩은
                        제목과 끊어져 보인다(Admin 도서 상세 「게시됨」 실측 2026-09-23). */}
                    {meta && <div className={cn(DIALOG.meta, tags?.length ? 'ml-auto' : '')}>{meta}</div>}
                  </div>
                )}
              </div>
            </div>
          </header>
        ) : (
          // 머리가 없으면 닫기 버튼이 갈 곳이 없다 — 본문 위에 띄운다.
          closeRow
        )}

        <div className={cn(bare ? 'flex-1 overflow-y-auto' : DIALOG.body)}>{children}</div>

        {footer && <footer className={DIALOG.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

// ══════════════════════════════════════════════════════════════
// 본문 부품 — 참조 팝업 본문의 두 칸과 틴트 패널
// ══════════════════════════════════════════════════════════════

/** 2열 본문 — 왼쪽이 넓다(참조 656:366). 좁은 화면에서는 한 줄로 쌓인다. */
export function DialogColumns({
  main,
  side,
  className,
}: {
  main: ReactNode
  side: ReactNode
  className?: string
}) {
  return (
    <div className={cn(DIALOG.columns, className)}>
      <div className="flex min-w-0 flex-col gap-5">{main}</div>
      <div className="flex min-w-0 flex-col gap-4">{side}</div>
    </div>
  )
}

/**
 * 틴트 패널 — 참조의 「Starting prompt」 칸.
 * `.tone-*` 이 안쪽 `--t1`·`--bd` 를 면 색상으로 바꾸므로 테두리·글자가 저절로 따라온다.
 */
export function DialogTintPanel({
  tone,
  title,
  note,
  action,
  dots = false,
  children,
  className,
}: {
  tone: DialogTone
  title?: ReactNode
  note?: ReactNode
  /** 제목 줄 오른쪽 — 참조의 「COPY PROMPT」 자리. */
  action?: ReactNode
  dots?: boolean
  children?: ReactNode
  className?: string
}) {
  return (
    <section className={cn(TINT_PANEL.root, `tone-${tone}`, className)}>
      {(title || action) && (
        <div className={cn(TINT_PANEL.head, dots && 'dots')}>
          <div className="min-w-0">
            {title && <h3 className={TINT_PANEL.title}>{title}</h3>}
            {note && <p className={TINT_PANEL.note}>{note}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children && <div className={TINT_PANEL.body}>{children}</div>}
    </section>
  )
}

/** 본문 안 작은 제목 — 참조의 「What this prompt builds」. */
export function DialogSection({
  label,
  children,
  className,
}: {
  label: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex flex-col gap-2.5', className)}>
      <h3 className={DIALOG.sectionLabel}>{label}</h3>
      {children}
    </section>
  )
}
