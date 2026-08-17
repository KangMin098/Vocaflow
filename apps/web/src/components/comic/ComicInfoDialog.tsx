// apps/web/src/components/comic/ComicInfoDialog.tsx
//
// 콘텐츠 정보 팝업 — 학습자가 **읽기 전에** "이게 뭔지" 판단할 근거 한 벌.
//
// ── 왜 팝업인가 (Progressive Disclosure) ─────────────────────────
// 서가 카드에 출처·PD 근거·분량·학습 노트를 다 적으면 카드가 문서가 된다. 학습자가 고르는
// 순간에 필요한 것은 제목·표지·분량뿐이고, 나머지는 **물었을 때** 나와야 한다(철학 2번).
// 그래서 카드에는 최소한만, 자세한 것은 "정보" 버튼 → 이 팝업.
//
// ── 왜 출처와 PD 근거를 학습자에게 보여주나 ──────────────────────
// 복원 만화는 "왜 이걸 공짜로 읽을 수 있는가"가 곧 신뢰의 문제다. 1940년대 만화를 출처 없이
// 올려두면 정당하게 확보한 콘텐츠도 해적판처럼 보인다. 원본 링크와 근거를 **먼저** 내보인다.
//
// 접근성: 네이티브 <dialog> 를 쓰지 않는다(Safari 지원·스타일 제약). 대신
// role="dialog" + aria-modal + Esc 닫기 + 포커스 트랩 + 열기 전 포커스 복원을 직접 구현한다.

'use client'

import { BookOpen, ExternalLink, Info, ShieldCheck, X } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { pdBasisLabel, type PdComicInfo } from '@/lib/pd-comic/model'

/** 포커스 가능한 요소 — 트랩이 순환시킬 대상. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function ComicInfoDialog({
  slug,
  label,
  className,
}: {
  slug: string
  /** 버튼 스크린리더 문구에 쓰는 콘텐츠 이름 — "정보" 만으로는 목록에서 구분이 안 된다. */
  label: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<PdComicInfo | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  // 정보는 **열 때** 가져온다 — 서가에 카드가 100개면 미리 받는 것은 100번의 낭비다.
  const load = useCallback(async () => {
    if (info) return
    setState('loading')
    try {
      const r = await fetch(`/api/comics/pd/${encodeURIComponent(slug)}/info`, {
        cache: 'force-cache',
      })
      if (!r.ok) throw new Error('info')
      setInfo((await r.json()) as PdComicInfo)
      setState('idle')
    } catch {
      setState('error')
    }
  }, [info, slug])

  useEffect(() => {
    if (!open) return
    // 정리 시점에 ref.current 는 이미 바뀌어 있을 수 있다 — 지금 값을 붙잡아 둔다.
    const opener = openerRef.current
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        return
      }
      if (e.key !== 'Tab') return
      // 포커스 트랩 — 모달 밖으로 새면 뒤 화면을 조작하게 된다.
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (!nodes?.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    // 배경 스크롤 잠금 — 팝업 위에서 스크롤하면 뒤 목록이 밀린다.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      // 닫으면 원래 있던 버튼으로 포커스를 되돌린다 — 키보드 사용자가 목록의 자리를 잃지 않게.
      opener?.focus()
    }
  }, [open])

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={() => {
          setOpen(true)
          void load()
        }}
        aria-haspopup="dialog"
        aria-label={`${label} 상세 정보`}
        className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-[var(--r-full)] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg3)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] active:scale-[0.97] ${className ?? ''}`}
      >
        <Info size={16} aria-hidden />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(23,17,10,.55)] p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[88vh] w-full max-w-[520px] overflow-y-auto rounded-t-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-lg sm:rounded-[var(--r-lg)]"
          >
            <header className="sticky top-0 flex items-start gap-3 border-b border-[var(--bd)] bg-[var(--bg)] px-5 py-4">
              <div className="min-w-0 flex-1">
                {info?.kindLabel && (
                  <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-[var(--active-ink)]">
                    {info.kindLabel}
                  </p>
                )}
                <h2
                  id={titleId}
                  className="mt-0.5 font-display text-[17px] font-[800] leading-snug text-[var(--t1)]"
                >
                  {info?.title ?? label}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="-mr-2 -mt-1 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--r-full)] text-[var(--t2)] transition-colors hover:bg-[var(--bg3)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
              >
                <X size={18} aria-hidden />
              </button>
            </header>

            <div className="px-5 py-4">
              {state === 'loading' && (
                <p className="py-6 text-center font-body text-[13px] text-[var(--t2)]">
                  정보를 불러오는 중…
                </p>
              )}
              {state === 'error' && (
                <p className="py-6 text-center font-body text-[13px] text-[var(--t2)]">
                  정보를 가져오지 못했어요. 잠시 뒤 다시 열어 보세요.
                </p>
              )}
              {info && state === 'idle' && <InfoBody info={info} />}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function InfoBody({ info }: { info: PdComicInfo }) {
  return (
    <div className="flex flex-col gap-4">
      {/* 서지 — 학습자가 "언제 것인지"를 먼저 본다 */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        <Row label="시리즈" value={info.seriesTitle} />
        <Row label="호수" value={info.issueNo != null ? `제 ${info.issueNo}호` : '단행본'} />
        <Row label="원본 발행" value={info.publishedYear ? `${info.publishedYear}년` : '연도 미상'} />
        <Row label="발행사" value={info.publisher} />
        {/* 발행본의 `panelsTotal` 은 **페이지 수**다 — publish-upload 가 페이지 행으로 교체한다.
            컷(패널)이라고 부르면 학습자가 받는 것과 다른 것을 말하게 된다. */}
        <Row label="분량" value={`${info.panelsTotal}쪽`} />
        <Row label="대사" value={info.bubbleCount > 0 ? `${info.bubbleCount}개` : '검수 중'} />
      </dl>

      {/* 학습 노트 — 이 유형을 읽으면 어떤 영어를 얻나. 서가의 유형 구분이 존재하는 이유. */}
      {info.kindLearnerNote && (
        <section className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3">
          <h3 className="flex items-center gap-1.5 font-display text-[12.5px] font-[700] text-[var(--t1)]">
            <BookOpen size={14} aria-hidden />
            이 유형으로 배우는 것
          </h3>
          <p className="mt-1.5 font-body text-[13px] leading-relaxed text-[var(--t2)]">
            {info.kindLearnerNote}
          </p>
          {info.seriesBlurb && (
            <p className="mt-2 font-body text-[12.5px] leading-relaxed text-[var(--t3)]">
              {info.seriesBlurb}
            </p>
          )}
        </section>
      )}

      {/* 출처·저작권 — 신뢰의 문제라 숨기지 않는다 */}
      <section className="rounded-[var(--r-md)] border border-[var(--bd)] px-4 py-3">
        <h3 className="flex items-center gap-1.5 font-display text-[12.5px] font-[700] text-[var(--t1)]">
          <ShieldCheck size={14} aria-hidden />
          출처와 이용 근거
        </h3>
        <p className="mt-1.5 font-body text-[13px] leading-relaxed text-[var(--t2)]">
          {pdBasisLabel(info.pdBasis)}
        </p>
        {info.sourceUrl && (
          <a
            href={info.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 font-body text-[12.5px] font-[600] text-[var(--active-ink)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            원본 스캔 보기
            {info.sourceArchive === 'internet-archive' && ' (Internet Archive)'}
            <ExternalLink size={13} aria-hidden />
          </a>
        )}
      </section>

      {/* 이어서 읽을 곳 */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/comics/restored/${info.slug}`}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-[var(--r-full)] bg-[var(--p)] px-5 font-display text-[13px] font-[700] text-[var(--on-p)] transition-transform duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-px active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
        >
          읽기
        </Link>
        {info.seriesKey && info.seriesIssuesPublished > 1 && (
          <Link
            href={`/comics/restored?series=${encodeURIComponent(info.seriesKey)}`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--r-full)] border border-[var(--bd)] px-4 font-display text-[13px] font-[700] text-[var(--t1)] transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            이 시리즈 {info.seriesIssuesPublished}권
          </Link>
        )}
        {info.libraryBookId && (
          <Link
            href={`/library/books/${info.libraryBookId}`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--r-full)] border border-[var(--bd)] px-4 font-display text-[13px] font-[700] text-[var(--t1)] transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            원작 도서
          </Link>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | number | null }) {
  if (value == null || value === '') return null
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--t3)]">{label}</dt>
      <dd className="mt-0.5 font-body text-[13px] font-[600] text-[var(--t1)]">{value}</dd>
    </div>
  )
}
