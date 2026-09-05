// apps/web/src/app/(main)/comics/restored/page.tsx — /comics/restored
//
// 복원 만화 서가 — PDCP 학습자 진입면. **CCP(도서→AI 생성 만화)와 별도 메뉴.**
//
// 왜 별도인가:
//   CCP 만화는 도서의 챕터에 종속돼 `/text/[id]/comic` 으로만 들어간다(도서 안의 한 모드).
//   PD 만화는 **호(issue) 단위 독립 콘텐츠**다. 원작이 없어도 존재하고, 먼저 매력적이어야
//   그다음 원작으로 데려갈 수 있다. 그래서 자기 서가와 자기 리더를 가진다.
//
// ── 왜 평면 격자가 아니라 유형 → 시리즈 2단인가 (v06.35) ──────────
//   적재된 원본이 969호 · 101시리즈다. 이걸 호 단위 평면 격자로 깔면 학습자가 보는 것은
//   "Whiz Comics 001, 002, 003 …" 이 화면 몇 장을 채우는 광경이고, 그건 카탈로그이지 서가가 아니다.
//   학습자가 고르는 단위는 **시리즈**이고, 시리즈를 고르는 기준은 **유형**이다 —
//   유형은 취향 분류가 아니라 어휘 도메인 축이라(서부물의 ain't/reckon vs SF 의 과학 어휘)
//   "무엇을 배우게 되는가" 가 유형에서 갈린다. 그래서 유형마다 학습 노트를 함께 보여준다.
//
//   `?series=` 가 있으면 그 시리즈의 호 목록으로 좁힌다(팝업의 "이 시리즈 N권"이 여기로 온다).
//
// 마이그레이션 미적용 상태에서도 열려야 하므로 스키마 부재를 정상 상태로 안내한다.

import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'

import { ComicInfoDialog } from '@/components/comic/ComicInfoDialog'
import { Screen } from '@/components/ui/ios'
import { listPdComics, listPdComicShelf } from '@/lib/pd-comic/queries'
import type { PdComicIssue, PdComicShelfKind } from '@/lib/pd-comic/model'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: '복원 만화',
  description: '퍼블릭 도메인 만화를 디지털 복원해 읽습니다',
}

export default async function PdComicsPage({
  searchParams,
}: {
  searchParams: { series?: string }
}) {
  const client = (await createClient()) as unknown as SupabaseClient
  const seriesKey = searchParams.series

  // 시리즈 지정이 있으면 그 안의 호 목록, 없으면 유형 → 시리즈 서가.
  const [shelf, issues] = await Promise.all([
    listPdComicShelf(client),
    seriesKey ? listPdComics(client, seriesKey) : Promise.resolve(null),
  ])

  return (
    <Screen width="wide" background="bg2" padX="md">
      <div className="flex flex-col gap-5 py-6 md:py-8">
        <header>
          <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.16em] text-[var(--active-ink)]">
            Vintage Comics
          </p>
          <h1 className="mt-1 font-display text-[26px] font-[800] tracking-tight text-[var(--t1)] md:text-[30px]">
            옛 영어 만화책
          </h1>
          {/* 화면 문구는 **실제로 배달되는 것**을 말해야 한다. 지금 발행되는 것은 복원된 원본
              페이지다(컷 분할본이 아니라). 예전 문구는 "컷 단위로 나눠 폰에서도 읽힌다"고
              약속했는데, 전면 페이지를 그대로 보내면서 그 말을 두면 지키지 못할 약속이 된다. */}
          <p className="mt-2 max-w-[60ch] break-keep font-body text-[14px] leading-relaxed text-[var(--t2)]">
            저작권이 만료된 1940~50년대 만화를 디지털 복원했습니다. 종이 변색과 인쇄 망점을 걷어내고
            해상도를 두 배로 올려, 원본 지면 그대로 읽습니다.
          </p>
        </header>

        {!shelf.ready ? (
          <NotReady />
        ) : seriesKey ? (
          <SeriesView
            seriesKey={seriesKey}
            issues={issues?.data ?? []}
            shelf={shelf.data}
          />
        ) : shelf.data.length === 0 ? (
          <Empty />
        ) : (
          <>
            <KindNav kinds={shelf.data} />
            <div className="flex flex-col gap-8">
              {shelf.data.map((k) => (
                <KindSection key={k.kind} kind={k} />
              ))}
            </div>
          </>
        )}
      </div>
    </Screen>
  )
}

// ─── 유형 바로가기 ────────────────────────────────────────────────
//
// 유형이 10종까지 늘면 세로로 쌓인 서가는 스크롤 몇 화면이 된다. 학습자가 고르는 첫 단위는
// 유형이므로, **무엇이 있는지 한 줄로 먼저 보이고** 원하는 데로 건너뛸 수 있어야 한다.
// 앵커 링크라 JS 없이도 동작한다(서버 컴포넌트 유지).
function KindNav({ kinds }: { kinds: PdComicShelfKind[] }) {
  if (kinds.length < 2) return null
  return (
    <nav aria-label="유형 바로가기" className="flex flex-wrap gap-2">
      {kinds.map((k) => (
        <a
          key={k.kind}
          href={`#kind-${k.kind}`}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-display text-[12.5px] font-[700] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--t3)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          {k.label}
          <span className="font-mono text-[11px] tabular-nums text-[var(--t3)]">{k.issuesPublished}</span>
        </a>
      ))}
    </nav>
  )
}

// ─── 유형 묶음 ────────────────────────────────────────────────────
function KindSection({ kind }: { kind: PdComicShelfKind }) {
  return (
    <section aria-labelledby={`kind-${kind.kind}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2
          id={`kind-${kind.kind}`}
          // 앵커로 건너뛸 때 제목이 화면 맨 위에 딱 붙지 않게 — 위 여백을 남긴다.
          className="scroll-mt-6 font-display text-[19px] font-[800] tracking-tight text-[var(--t1)]"
        >
          {kind.label}
        </h2>
        <span className="font-mono text-[11.5px] tabular-nums text-[var(--t2)]">
          {kind.series.length}시리즈 · {kind.issuesPublished}권
        </span>
      </div>
      {/* 학습 노트 — 이 유형을 왜 따로 묶었는지가 여기 있다 */}
      {kind.learnerNote && (
        <p className="mt-1 max-w-[68ch] font-body text-[13px] italic leading-relaxed text-[var(--t2)]">
          {kind.learnerNote}
        </p>
      )}

      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {kind.series.map((s) => (
          <li key={s.seriesKey}>
            <Link
              href={`/comics/restored?series=${encodeURIComponent(s.seriesKey)}`}
              className="group flex h-full flex-col overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] transition-transform duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-[var(--bg3)]">
                {s.coverUrl ? (
                  // 외부 스토리지 버킷이라 next/image 최적화 대상이 아니다.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center font-mono text-[11px] text-[var(--t2)]">
                    no cover
                  </span>
                )}
                <span className="absolute left-2 top-2 rounded-[var(--r-full)] bg-[rgba(23,17,10,.82)] px-2 py-1 font-mono text-[10px] font-[700] text-[#E6C275] backdrop-blur">
                  {s.yearFrom === s.yearTo || !s.yearTo
                    ? `${s.yearFrom ?? '연도 미상'}${s.yearFrom ? ' 원본' : ''}`
                    : `${s.yearFrom}–${s.yearTo} 원본`}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-1 px-3 py-3">
                {s.publisher && (
                  <p className="truncate font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t2)]">
                    {s.publisher}
                  </p>
                )}
                <h3 className="line-clamp-2 font-display text-[14px] font-[700] leading-snug text-[var(--t1)]">
                  {s.seriesTitle}
                </h3>
                <p className="mt-auto font-mono text-[11px] tabular-nums text-[var(--t2)]">
                  {s.issuesPublished}권 · {s.panelsTotal}쪽
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ─── 시리즈 안 — 호 목록 ──────────────────────────────────────────
function SeriesView({
  seriesKey,
  issues,
  shelf,
}: {
  seriesKey: string
  issues: PdComicIssue[]
  shelf: PdComicShelfKind[]
}) {
  const meta = shelf.flatMap((k) => k.series).find((s) => s.seriesKey === seriesKey)

  if (issues.length === 0) {
    return (
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-5 py-8 text-center">
        <p className="font-display text-[15px] font-[700] text-[var(--t1)]">
          아직 발행된 호가 없어요
        </p>
        <p className="mt-1.5 font-body text-[13px] text-[var(--t2)]">
          이 시리즈는 복원 작업 중입니다.
        </p>
        <Link
          href="/comics/restored"
          className="mt-4 inline-flex min-h-[44px] items-center rounded-[var(--r-full)] border border-[var(--bd)] px-5 font-display text-[13px] font-[700] text-[var(--t1)]"
        >
          서가로 돌아가기
        </Link>
      </section>
    )
  }

  return (
    <section>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {/* 이 화면에서 돌아나가는 유일한 수단이라 히트영역만 44px 로 키운다(시각 크기는 그대로). */}
        <Link
          href="/comics/restored"
          className="inline-flex min-h-11 items-center font-body text-[12.5px] text-[var(--t2)] underline underline-offset-2 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          ← 전체 서가
        </Link>
        {meta && (
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--active-ink)]">
            {meta.kindLabel}
          </span>
        )}
      </div>
      <h2 className="mt-1 font-display text-[21px] font-[800] tracking-tight text-[var(--t1)]">
        {meta?.seriesTitle ?? seriesKey}
      </h2>
      {meta && (
        <p className="mt-1 font-mono text-[11.5px] tabular-nums text-[var(--t2)]">
          {meta.publisher ? `${meta.publisher} · ` : ''}
          {meta.yearFrom}
          {meta.yearTo && meta.yearTo !== meta.yearFrom ? `–${meta.yearTo}` : ''} · {issues.length}권
        </p>
      )}

      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {issues.map((it) => (
          <li key={it.id} className="relative">
            <Link
              href={`/comics/restored/${it.slug}`}
              className="group flex h-full flex-col overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] transition-transform duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-[var(--bg3)]">
                {it.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center font-mono text-[11px] text-[var(--t2)]">
                    no cover
                  </span>
                )}
                {it.publishedYear && (
                  <span className="absolute left-2 top-2 rounded-[var(--r-full)] bg-[rgba(23,17,10,.82)] px-2 py-1 font-mono text-[10px] font-[700] text-[#E6C275] backdrop-blur">
                    {it.publishedYear} 원본 · 복원
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 px-3 py-3">
                {it.issueNo != null && (
                  <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t2)]">
                    제 {it.issueNo}호
                  </p>
                )}
                <h3 className="line-clamp-2 font-display text-[14px] font-[700] leading-snug text-[var(--t1)]">
                  {it.title}
                </h3>
                <p className="mt-auto font-mono text-[11px] tabular-nums text-[var(--t2)]">
                  {it.panelsTotal}쪽
                </p>
              </div>
            </Link>
            {/* 정보 버튼은 카드 링크 **밖**에 둔다 — 중첩 인터랙티브는 스크린리더에서 깨진다. */}
            <div className="absolute right-1 top-1">
              <ComicInfoDialog
                slug={it.slug}
                label={it.title}
                className="bg-[rgba(23,17,10,.6)] text-white backdrop-blur hover:bg-[rgba(23,17,10,.8)] hover:text-white"
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function NotReady() {
  return (
    <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-5 py-8 text-center">
      <p className="font-display text-[15px] font-[700] text-[var(--t1)]">준비 중이에요</p>
      <p className="mx-auto mt-1.5 max-w-[46ch] font-body text-[13px] leading-relaxed text-[var(--t2)]">
        복원 만화 서가를 만들고 있습니다. 곧 1940년대 고전 만화를 여기서 만나볼 수 있어요.
      </p>
      <Link
        href="/library/books"
        className="mt-4 inline-flex min-h-[44px] items-center rounded-[var(--r-full)] bg-[var(--p)] px-5 font-display text-[13px] font-[700] text-[var(--on-p)]"
      >
        도서 라이브러리로
      </Link>
    </section>
  )
}

/**
 * 서가는 열렸는데 발행된 호가 0 인 상태.
 *
 * ⚠️ 바로 위 `NotReady()` 는 `/library/books` 링크를 가졌는데 여기만 빠져 있었다 —
 *    나란히 있는 두 빈 상태 중 하나만 막다른 길이었다는 뜻이다(2026-09-05 감사 · CLAUDE.md D4).
 */
function Empty() {
  return (
    <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-5 py-8 text-center">
      <p className="break-keep font-display text-[15px] font-[700] text-[var(--t1)]">
        아직 발행된 만화가 없어요
      </p>
      <p className="mx-auto mt-1.5 max-w-[46ch] break-keep font-body text-[13px] leading-relaxed text-[var(--t2)]">
        첫 복원본을 준비하고 있습니다. 1940년대 영어는 지금 쓰는 말과 결이 달라서, 그동안 원서
        쪽에서 읽어 두면 만화가 올라왔을 때 훨씬 편하게 넘어갈 수 있어요.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/library/books"
          className="inline-flex min-h-[44px] items-center rounded-[var(--r-full)] bg-[var(--p)] px-5 font-display text-[13px] font-[700] text-[var(--on-p)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
        >
          도서 라이브러리로
        </Link>
        <Link
          href="/comics/adapted"
          className="inline-flex min-h-[44px] items-center rounded-[var(--r-full)] border border-[var(--bd)] px-5 font-display text-[13px] font-[700] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          책 만화 보러 가기
        </Link>
      </div>
    </section>
  )
}
