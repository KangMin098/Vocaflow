// apps/web/src/app/(main)/comics/restored/page.tsx — /comics/restored
//
// 복원 만화 서가 — PDCP 학습자 진입면. **CCP(도서→AI 생성 만화)와 별도 메뉴.**
//
// 왜 별도인가:
//   CCP 만화는 도서의 챕터에 종속돼 `/text/[id]/comic` 으로만 들어간다(도서 안의 한 모드).
//   PD 만화는 **호(issue) 단위 독립 콘텐츠**다. 원작이 없어도 존재하고, 먼저 매력적이어야
//   그다음 원작으로 데려갈 수 있다. 그래서 자기 서가와 자기 리더를 가진다.
//
// 마이그레이션 미적용 상태에서도 열려야 하므로 스키마 부재를 정상 상태로 안내한다.

import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'

import { Screen } from '@/components/ui/ios'
import { listPdComics } from '@/lib/pd-comic/queries'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: '복원 만화 · Vocaflow',
  description: '퍼블릭 도메인 만화를 디지털 복원해 읽습니다',
}

export default async function PdComicsPage() {
  const client = (await createClient()) as unknown as SupabaseClient
  const { ready, data: issues } = await listPdComics(client)

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
          <p className="mt-2 max-w-[60ch] font-body text-[14px] leading-relaxed text-[var(--t2)]">
            저작권이 만료된 1940~50년대 만화를 디지털 복원했습니다. 종이 변색과 인쇄 망점을 걷어내고
            컷 단위로 나눠, 폰에서도 대사가 그대로 읽힙니다.
          </p>
        </header>

        {!ready ? (
          <NotReady />
        ) : issues.length === 0 ? (
          <Empty />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {issues.map((it) => (
              <li key={it.id}>
                <Link
                  href={`/comics/restored/${it.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] transition-transform duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden bg-[var(--bg3)]">
                    {it.coverUrl ? (
                      // 표지는 복원된 첫 컷. next/image 최적화 대상이 아닌 외부 버킷이라 img 사용.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.coverUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center font-mono text-[11px] text-[var(--t2)]">
                        no cover
                      </span>
                    )}
                    {/* 복원됨은 숨길 게 아니라 파는 포인트다 */}
                    {it.publishedYear && (
                      <span className="absolute left-2 top-2 rounded-[var(--r-full)] bg-[rgba(23,17,10,.82)] px-2 py-0.5 font-mono text-[10px] font-[700] text-[#E6C275] backdrop-blur">
                        {it.publishedYear} 원본 · 복원
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 px-3 py-2.5">
                    {it.seriesTitle && (
                      <p className="truncate font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t2)]">
                        {it.seriesTitle}
                        {it.issueNo != null && ` #${it.issueNo}`}
                      </p>
                    )}
                    <h2 className="line-clamp-2 font-display text-[14px] font-[700] leading-snug text-[var(--t1)]">
                      {it.title}
                    </h2>
                    <p className="mt-auto font-mono text-[11px] tabular-nums text-[var(--t2)]">
                      {it.panelsTotal}컷
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Screen>
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

function Empty() {
  return (
    <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-5 py-8 text-center">
      <p className="font-display text-[15px] font-[700] text-[var(--t1)]">아직 발행된 만화가 없어요</p>
      <p className="mt-1.5 font-body text-[13px] text-[var(--t2)]">첫 복원본을 준비하고 있습니다.</p>
    </section>
  )
}
