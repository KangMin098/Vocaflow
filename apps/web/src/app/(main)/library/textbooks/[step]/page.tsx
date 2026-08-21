// apps/web/src/app/(main)/library/textbooks/[step]/page.tsx
//
// 교재 한 권의 **상세** — 서점에서 책을 집어 펼쳐 보는 자리.
//
// ── 왜 만들었나 ─────────────────────────────────────────────────────
// 서가의 "지금 펼치기" 가 **아무 데도 가지 않는 죽은 버튼**이었다(v06.337 실측).
// 보이는데 눌리지 않는 것은 이 저장소가 가장 나쁜 결함으로 못 박은 종류다(CONVENTIONS).
//
// ── 무엇을 보여주고 무엇을 보여주지 않는가 ──────────────────────────
// 보여준다: 대상 학령 · 수록 유형과 **유형별 실제 문항 수** · 각 유형이 시키는 것 ·
//           단원 규격(순서 2 + 삽입 2 · 3분/문항) · 만들 수 있는 **최대** 단원 수.
// 보여주지 않는다: **가짜 목차.** 실제 단원 조합은 길이 게이트(90~200어)와
//           "한 단원의 문항은 서로 다른 원글에서" 규칙을 더 걸기 때문에, 재고만으로
//           목차를 지어내면 실제보다 부풀려진다. 상한만 말하고 그것이 상한임을 밝힌다.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, BookOpen, ChevronsDown, ChevronsUp } from 'lucide-react'

import {
  COMPOSE_MINUTES_PER_ITEM,
  DEFAULT_SLOTS,
  MINUTES_PER_ITEM,
} from '@vocaflow/library-pipeline'

import { Screen } from '@/components/ui/ios'
import { TextbookPickButton } from '@/components/library/textbooks/TextbookPickButton'
import { fetchMyTextbooks } from '@/lib/textbook/my-shelf-query'
import { fetchTextbookShelf } from '@/lib/textbook/shelf-query'
import { STAGE_LABEL, neighborsOf, stageOf } from '@/lib/textbook/shelf-stage'
import type { ShelfVolume } from '@/lib/textbook/shelf'
import { TYPE_GUIDE } from '@/lib/textbook/type-guide'

/**
 * 권마다 다른 제목·설명.
 *
 * ⚠️ 정적 `metadata` 였을 때 일곱 권이 **전부 '교재 · Vocaflow'** 였다. 이 화면은 비로그인에도
 * 열려 있는 발견 표면이라(apps/web/CLAUDE.md 공개 표면 표), 같은 제목 일곱 개는
 * 브라우저 탭·북마크·공유 카드·검색 결과에서 **서로 구별되지 않는다** — 링크를 받은 사람은
 * 어떤 권인지 열어 봐야 안다.
 *
 * 제목·학령은 `SERIES_SPINE` 이 소유한다. 여기서 짓지 않고 서가에서 읽어 온다.
 * 없는 권이면 정적 문구로 떨어진다 — `notFound()` 는 본문이 판정한다.
 */
/**
 * 없는 권의 제목.
 *
 * ⚠️ 여기 있던 값이 `'교재 · Vocaflow'` 였다 — 404 화면인데 **교재 페이지인 척**했다.
 *    브라우저 탭·북마크·공유 카드에서 없는 권이 있는 권처럼 보인다.
 *
 * ⚠️ **`robots: noindex` 를 넣었다가 뺐다(실측 2026-08-22).** Next 가 `notFound()` 렌더에
 *    이미 `<meta name="robots" content="noindex">` 를 넣는다 — 커스텀 메타데이터가 없는
 *    이웃 라우트에서도 확인했다. 더하면 robots 태그가 **둘**이 된다.
 *    "고쳐야 할 것 같다" 로 손대기 전에 **이미 되고 있는지 확인할 것.**
 *
 * ── 상태 코드는 남은 문제다(앱 전역) ────────────────────────────────
 * 이 라우트는 없는 step 에 404 화면을 그리지만 **HTTP 상태는 200** 이다.
 * 루트 `loading.tsx` 때문에 모든 페이지가 스트리밍이라 200 셸이 먼저 나간 뒤에는
 * `notFound()` 가 상태를 못 바꾼다(없는 **라우트**는 정상 404 다).
 * `loading.tsx` 는 "수정·삭제 금지" 로 못 박힌 파일이라 여기서 구조를 바꾸지 않는다.
 * 색인은 Next 의 noindex 가 막고 있어 실질 피해는 크지 않다 — 기록만 남긴다.
 */
function notFoundMeta(): Metadata {
  return { title: '찾을 수 없는 교재 · Vocaflow' }
}

export async function generateMetadata({
  params,
}: {
  params: { step: string }
}): Promise<Metadata> {
  const step = Number(params.step)
  if (!Number.isInteger(step)) return notFoundMeta()

  const shelf = await fetchTextbookShelf()
  const v = shelf.volumes.find((x) => x.step === step)
  if (!v) return notFoundMeta()

  // 조사를 붙이지 않는 형태로 잇는다 — 영문 권명에 한국어 조사를 붙일 수 없다.
  const types = v.types.map((t) => TYPE_GUIDE[t]?.label ?? t).join(' · ')
  // 못 잰 재고를 개수로 적지 않는다 — 검색 결과·공유 카드에 "문항 0개" 가 박히면
  // 그 문장은 화면보다 오래 남는다(캐시·인덱스). 레이아웃이 접미사를 붙이므로 여기서 안 붙인다.
  const count = v.status === 'unmeasured' ? '' : ` 문항 ${v.itemCount.toLocaleString()}개.`
  return {
    title: `${v.title} — ${v.schoolBand} 독해 교재`,
    description: `${v.schoolBand} 대상. 수록 유형 ${types}.${count}`,
  }
}

/**
 * 앞/뒤 권 한 칸.
 *
 * ⚠️ 없는 쪽은 **빈 칸으로 두지 않고 이유를 적는다.** 첫 권·마지막 권이라는 사실 자체가
 *    학습자에게 필요한 정보다("더 쉬운 게 없다" 는 것을 알아야 다른 선택을 한다).
 */
function NeighborCard({
  volume: v,
  direction,
}: {
  volume: ShelfVolume | null
  direction: 'down' | 'up'
}) {
  const lead = direction === 'down' ? '어렵다면 한 계단 아래' : '쉽다면 한 계단 위'
  const Icon = direction === 'down' ? ChevronsDown : ChevronsUp

  if (!v) {
    return (
      <p className="flex items-center gap-2.5 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 font-body text-[12px] leading-[1.6] text-[var(--t2)] [word-break:keep-all]">
        <Icon size={15} aria-hidden className="shrink-0" />
        {direction === 'down' ? '시리즈의 첫 권이에요.' : '시리즈의 마지막 권이에요.'}
      </p>
    )
  }

  return (
    <Link
      href={`/library/textbooks/${v.step}`}
      className="group flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 no-underline transition-colors hover:border-[var(--p)] hover:bg-[var(--bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
    >
      <span
        aria-hidden
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p-light)] text-[var(--on-p-tint)]"
      >
        <Icon size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[11.5px] font-[700] text-[var(--t2)]">{lead}</span>
        {/* 조사를 붙이지 않는 형태로 잇는다 — 영문 권명에 한국어 조사를 붙일 수 없다. */}
        <span className="mt-0.5 block font-editorial text-[15px] font-[500] leading-snug text-[var(--t1)]">
          {v.title}
        </span>
        <span className="mt-0.5 block font-mono text-[10px] tabular-nums text-[var(--t2)]">
          STEP {v.step} · {v.schoolBand}
        </span>
      </span>
      <ArrowRight
        size={15}
        aria-hidden
        className="shrink-0 text-[var(--t2)] motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
      />
    </Link>
  )
}

export default async function TextbookVolumePage({ params }: { params: { step: string } }) {
  const step = Number(params.step)
  if (!Number.isInteger(step)) notFound()

  const [shelf, mine] = await Promise.all([fetchTextbookShelf(), fetchMyTextbooks()])
  const v = shelf.volumes.find((x) => x.step === step)
  if (!v) notFound()

  // ⚠️ 여기 `3` 이 **손으로 적혀** 있었고 주석은 `compose-unit.MINUTES_PER_ITEM` 을 가리켰다.
  //    확인해 보니 패키지 안에 같은 이름의 상수가 **둘**이고 값이 다르다(실측 2026-08-22):
  //      assemble-unit 2분(지문에 문항을 붙이는 모델) · compose-unit 3분(문항이 곧 지문인 모델)
  //    어느 하나를 골라 단일 숫자로 인쇄하면 **근거 없는 정밀함**이 된다. 범위로 말한다.
  const itemsPerUnit = Object.values(DEFAULT_SLOTS).reduce((a, b) => a + b, 0)
  const totalItems = v.maxUnits * itemsPerUnit
  const minMinutes = totalItems * MINUTES_PER_ITEM
  const maxMinutes = totalItems * COMPOSE_MINUTES_PER_ITEM
  const { prev, next } = neighborsOf(shelf.volumes, v.step)
  const stage = stageOf(v.schoolBand)

  return (
    <Screen width="wide" background="bg2" padX="md">
      <div className="flex flex-col gap-4 py-6 md:py-8">
        <Link
          href="/library/textbooks"
          className="inline-flex min-h-[44px] w-fit items-center gap-1.5 font-display text-[13px] font-[700] text-[var(--p)] no-underline transition-colors hover:text-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <ArrowLeft size={14} aria-hidden />
          교재 서가
        </Link>

        <section
          aria-label="교재 표지"
          className="rounded-ios-2xl bg-[var(--bg)] px-5 py-6 shadow-ios-2 md:px-8 md:py-8"
        >
          <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t2)]">
            {shelf.brand} · STEP {v.step}
          </p>
          <h1 className="mt-2 font-editorial text-[30px] font-[500] leading-[1.1] tracking-[-0.018em] text-[var(--t1)] md:text-[38px]">
            {v.title}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 font-mono text-[11.5px] tabular-nums text-[var(--t2)]">
            <span>{v.schoolBand}</span>
            <span>· V{v.vLevels.join('·V')}</span>
            <span>· 수록 문항 {v.itemCount.toLocaleString()}</span>
          </p>

          <p className="mt-4 max-w-[58ch] font-body text-[14px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
            {v.rationale.replace(/\*\*/g, '')}
          </p>
        </section>

        <section
          aria-label="수록 구성"
          className="rounded-ios-2xl bg-[var(--bg)] px-5 py-6 shadow-ios-2 md:px-8"
        >
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">수록 구성</h2>
          <ul className="mt-4 flex flex-col divide-y divide-[var(--bd)]">
            {v.types.map((t) => {
              const g = TYPE_GUIDE[t]
              const n = v.byType[t] ?? 0
              return (
                <li key={t} className="flex items-baseline gap-3 py-3">
                  <span className="min-w-[92px] shrink-0 font-display text-[13.5px] font-[700] text-[var(--t1)]">
                    {g?.label ?? t}
                  </span>
                  <span className="min-w-0 flex-1 font-body text-[12.5px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
                    {g?.says ?? '—'}
                  </span>
                  <span className="shrink-0 font-mono text-[12px] font-[700] tabular-nums text-[var(--t1)]">
                    {n > 0 ? n.toLocaleString() : '준비 중'}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <section
          aria-label="분량"
          className="rounded-ios-2xl bg-[var(--bg)] px-5 py-6 shadow-ios-2 md:px-8"
        >
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">분량</h2>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-2.5">
            <span className="font-editorial text-[32px] font-[500] leading-none tabular-nums text-[var(--t1)]">
              최대 {v.maxUnits.toLocaleString()}
            </span>
            <span className="font-body text-[13px] text-[var(--t2)]">단원</span>
            {maxMinutes > 0 && (
              <span className="ml-2 font-mono text-[11.5px] tabular-nums text-[var(--t2)]">
                약 {Math.round(minMinutes / 60)}~{Math.round(maxMinutes / 60)}시간
              </span>
            )}
          </p>
          {/* 상한을 예측처럼 보이게 두지 않는다 — 그 순간 과장 광고가 된다. */}
          <p className="mt-3 max-w-[58ch] font-body text-[12.5px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
            한 단원은{' '}
            <strong className="font-display text-[var(--t1)]">
              문항 {itemsPerUnit}개(약 {itemsPerUnit * MINUTES_PER_ITEM}~
              {itemsPerUnit * COMPOSE_MINUTES_PER_ITEM}분)
            </strong>
            로 짭니다. 위 숫자는 <strong className="font-display text-[var(--t1)]">상한</strong>이에요 —
            실제로는 지문 길이(90~200어)와 “한 단원의 문항은 서로 다른 글에서” 규칙을 더 걸기 때문에
            이보다 적게 나옵니다.
          </p>
        </section>

        {/* 사다리에서의 자리 — 실제 교재의 뒤표지에 해당한다.
            서점에서 책을 집은 사람이 가장 먼저 하는 판단이 "나한테 맞나" 이고,
            안 맞을 때 서가로 되돌아가게 만들면 대개 안 돌아온다. */}
        {(prev || next) && (
          <section
            aria-label="계단 안내"
            className="rounded-ios-2xl bg-[var(--bg)] px-5 py-6 shadow-ios-2 md:px-8"
          >
            <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
              이 권이 안 맞는다면
            </h2>
            <p className="mt-3 max-w-[58ch] font-body text-[13px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
              한 계단은 <strong className="font-display text-[var(--t1)]">학년 하나</strong>에
              해당합니다{stage ? ` — 지금 보는 권은 ${STAGE_LABEL[stage]} 매대에 있어요.` : '.'}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <NeighborCard volume={prev} direction="down" />
              <NeighborCard volume={next} direction="up" />
            </div>
          </section>
        )}

        <section
          aria-label="학습 시작"
          className="rounded-ios-2xl bg-[var(--bg)] px-5 py-6 shadow-ios-2 md:px-8"
        >
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">어떻게 학습하나요</h2>
          {/* ⚠️ 여기 있던 문장은 **사실이 아니었다** (실측 2026-08-22).
              "이 권의 문항은 오늘의 학습에 섞여 나옵니다. 지금 수준에 맞는 단원부터 자동으로 배정돼요."
              `prescribe_today` 를 읽어 보니 셋 다 틀렸다:
                ① 담은 교재를 **보지 않는다** — `user_textbook_selections` 를 읽는 곳이 조회·쓰기뿐이다.
                ② '단원' 이라는 단위가 배정에 없다 — stage_band 로 거르고 무작위 5문항이다.
                ③ 유형이 `order`·`insert` 로 제한된다 — 문항 5,952개 중 **오늘의 학습이 닿는 건 895개(15%)**.
                   어휘 추론·어법·흐름 무관은 이 경로로는 한 번도 안 나온다(2,830개).
              화면이 시스템보다 앞서 말하면 그건 광고지 안내가 아니다. 지금 참인 것만 적는다.
              배정이 실제로 담은 교재를 보게 되면 그때 이 문단을 되돌린다. */}
          <p className="mt-3 max-w-[58ch] font-body text-[13px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
            담아 두면 <strong className="font-display text-[var(--t1)]">내 교재</strong>에 쌓입니다 —
            어디까지 왔는지 한자리에서 보기 위한 것이에요.
          </p>
          <p className="mt-2 max-w-[58ch] font-body text-[12.5px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
            아직 <strong className="font-display text-[var(--t1)]">담기가 오늘의 학습을 바꾸지는
            않습니다.</strong> 오늘의 학습에는 글 순서·문장 삽입 문항이 진단 단계에 맞춰 섞여 나오고,
            그 밖의 유형은 각 모듈에서 따로 만납니다.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Link
              href="/hub"
              className="group inline-flex min-h-[48px] w-fit items-center gap-2 rounded-ios-pill bg-[var(--p)] px-5 font-display text-[14px] font-[700] text-[var(--on-p)] no-underline motion-safe:transition-all motion-safe:hover:brightness-110 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
            >
              <BookOpen size={15} aria-hidden />
              오늘의 학습으로
            </Link>
            {/* 담기는 서가와 **같은 버튼**을 쓴다 — 두 곳에서 다르게 생기면 같은 동작으로 안 읽힌다. */}
            {mine.available && (
              <TextbookPickButton
                step={v.step}
                title={v.title}
                picked={mine.steps.includes(v.step)}
                signedIn={mine.signedIn}
              />
            )}
          </div>
        </section>
      </div>
    </Screen>
  )
}
