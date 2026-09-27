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
// 접근성: 네이티브 <dialog> 를 쓰지 않는다(Safari 지원·스타일 제약). role="dialog" +
// aria-modal + Esc + 포커스 트랩 + 포커스 복원은 `ui/Dialog` 가 한 곳에서 보장한다
// (DD-68 · tines-mapping §28, 2026-09-23 — 예전에는 이 파일이 그 규칙을 혼자 구현했다).

'use client'

import { BookOpen, ExternalLink, Info, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useState } from 'react'

import { Dialog, DialogSection, DialogTintPanel } from '@/components/ui/Dialog'
import { BTN } from '@/components/ui/tines-kit'
import { pdBasisLabel, type PdComicInfo } from '@/lib/pd-comic/model'

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

  return (
    <>
      <button
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
        <Dialog
          onClose={() => setOpen(false)}
          size="lg"
          crumbs={['복원 만화', '서가', info?.kindLabel ?? '콘텐츠 정보']}
          title={info?.title ?? label}
          byline={
            info
              ? [info.seriesTitle, info.publisher, info.publishedYear ? `${info.publishedYear}년` : null]
                  .filter(Boolean)
                  .join(' · ')
              : undefined
          }
          tags={
            info
              ? [
                  info.issueNo != null ? `제 ${info.issueNo}호` : '단행본',
                  `${info.panelsTotal}쪽`,
                  info.bubbleCount > 0 ? `대사 ${info.bubbleCount}개` : '대사 검수 중',
                ]
              : undefined
          }
          footer={
            info ? (
              <>
                <Link href={`/comics/restored/${info.slug}`} className={BTN.primary}>
                  읽기
                </Link>
                {info.seriesKey && info.seriesIssuesPublished > 1 && (
                  <Link
                    href={`/comics/restored?series=${encodeURIComponent(info.seriesKey)}`}
                    className={BTN.secondary}
                  >
                    이 시리즈 {info.seriesIssuesPublished}권
                  </Link>
                )}
                {info.libraryBookId && (
                  <Link href={`/library/books/${info.libraryBookId}`} className={`${BTN.secondary} ml-auto`}>
                    원작 도서
                  </Link>
                )}
              </>
            ) : undefined
          }
        >
          {state === 'loading' && (
            <p className="py-6 text-center font-body text-[13px] text-[var(--t2)]">정보를 불러오는 중…</p>
          )}
          {state === 'error' && (
            <p className="py-6 text-center font-body text-[13px] text-[var(--t2)]">
              정보를 가져오지 못했어요. 잠시 뒤 다시 열어 보세요.
            </p>
          )}
          {info && state === 'idle' && <InfoBody info={info} />}
        </Dialog>
      )}
    </>
  )
}

// 본문 — 서지 일부와 호수·분량은 머리의 「By」 줄·태그가 이미 말한다. 여기 남는 것은
// **판단의 근거** 둘: 무엇을 배우는가(옅은 살구 패널 — 참조의 「Starting prompt」 자리)와
// 왜 읽어도 되는가(출처). 이어서 읽을 곳은 바닥 버튼 줄로 갔다.
function InfoBody({ info }: { info: PdComicInfo }) {
  return (
    <div className="flex flex-col gap-5">
      {/* 학습 노트 — 이 유형을 읽으면 어떤 영어를 얻나. 서가의 유형 구분이 존재하는 이유. */}
      {info.kindLearnerNote && (
        <DialogTintPanel
          tone="peach"
          dots
          title={
            <span className="inline-flex items-center gap-2">
              <BookOpen size={15} aria-hidden />이 유형으로 배우는 것
            </span>
          }
        >
          <p className="font-body text-[13.5px] leading-relaxed text-[var(--t1)] break-keep">
            {info.kindLearnerNote}
          </p>
          {info.seriesBlurb && (
            <p className="mt-2 font-body text-[12.5px] leading-relaxed text-[var(--t2)] break-keep">
              {info.seriesBlurb}
            </p>
          )}
        </DialogTintPanel>
      )}

      {/* 서지 — 발행본의 `panelsTotal` 은 **페이지 수**다(publish-upload 가 페이지 행으로
          교체한다). 컷(패널)이라고 부르면 학습자가 받는 것과 다른 것을 말하게 된다. */}
      <DialogSection label="서지">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Row label="시리즈" value={info.seriesTitle} />
          <Row label="호수" value={info.issueNo != null ? `제 ${info.issueNo}호` : '단행본'} />
          <Row label="원본 발행" value={info.publishedYear ? `${info.publishedYear}년` : '연도 미상'} />
          <Row label="발행사" value={info.publisher} />
          <Row label="분량" value={`${info.panelsTotal}쪽`} />
          <Row label="대사" value={info.bubbleCount > 0 ? `${info.bubbleCount}개` : '검수 중'} />
        </dl>
      </DialogSection>

      {/* 출처·저작권 — 신뢰의 문제라 숨기지 않는다 */}
      <DialogSection label="출처와 이용 근거">
        <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3">
          <p className="flex items-start gap-2 font-body text-[13px] leading-relaxed text-[var(--t1)] break-keep">
            <ShieldCheck size={15} aria-hidden className="mt-0.5 shrink-0" />
            {pdBasisLabel(info.pdBasis)}
          </p>
          {info.sourceUrl && (
            <a href={info.sourceUrl} target="_blank" rel="noopener noreferrer" className={BTN.text}>
              원본 스캔 보기
              {info.sourceArchive === 'internet-archive' && ' (Internet Archive)'}
              <ExternalLink size={13} aria-hidden />
            </a>
          )}
        </div>
      </DialogSection>

      {/* 이어서 읽을 곳은 바닥 버튼 줄(`Dialog` 의 footer) — 참조도 결정을 바닥에 모은다. */}
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
