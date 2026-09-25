// apps/web/src/components/library/vocab/VocabSeriesHeader.tsx
//
// 단어장 서가의 **머리 — 여기가 한 출판사의 서가임을 말하는 자리.**
//
// ── 왜 이 형태인가 ──────────────────────────────────────────────────
// 시중 단어장을 집으면 표지가 세 가지를 즉시 말한다: 시리즈 이름 · 이 권의 자리 ·
// 다음 권이 무엇인지. `/library/vocab` 은 셋 다 없이 제목과 이모지만 있었고,
// 그래서 70권이 **한 출판사의 서가가 아니라 낱권 더미**로 읽혔다.
//
// 교재 서가(`TextbookShelf`)가 같은 문제를 사다리로 풀었다. 여기서도 사다리를 쓰되
// **재고를 실측해 얹는다** — 계단마다 몇 권이 실제로 있는지.
//
// ⚠️ 빈 계단을 숨기지 않는다. 교재 서가가 배운 것과 같다: 숨기면 학습자는
//    "내 학년이 없다" 가 아니라 "이 브랜드는 이상하다" 로 읽는다.
// ⚠️ 계단에 못 앉힌 권도 센다. 분모가 안 맞으면 사다리를 믿을 수 없다.
// ⚠️ 상태를 **색으로만** 가르지 않는다(색맹 대응) — 숫자·라벨을 함께 쓴다.

import { VOCAB_SERIES_BRAND } from '@vocaflow/library-pipeline/vocab-brand'

import type { LadderFill } from '@/lib/library/vocab/rung'

export function VocabSeriesHeader({
  fill,
  /** 학습자의 현재 계단. 진단 전이면 null — 표시하지 않는다(짐작으로 세우지 않는다). */
  learnerStep = null,
  totalVolumes,
  totalWords,
}: {
  fill: LadderFill
  learnerStep?: number | null
  totalVolumes: number
  totalWords: number
}) {
  // ⚠️ **모바일에서 크롬을 줄인다 — 첫 화면에 상품이 없으면 매대가 아니다.**
  // 실측 2026-09-01(390px): 첫 상품이 **y=913(1.08화면)** 이라 첫 화면에 상품이 **0개**였다.
  // 상품 위를 차지한 것: 헤더 309px(제목 40px + 설명 72px) · 카테고리 200px · 정렬 100px.
  // 같은 자로 잰 NE능률 모바일은 첫 상품 0.29화면 · 상품 3개다.
  // 데스크톱은 이미 시장을 넘으므로(이미지 면적 22.0%) **모바일에서만** 줄인다.
  const stats = [
    { label: '전체 권수', value: `${totalVolumes}권` },
    { label: '표제어', value: totalWords.toLocaleString() },
    { label: '학령 사다리', value: `${fill.rungs.length}단` },
    ...(fill.unplaced > 0 ? [{ label: '학령 밖', value: `${fill.unplaced}권` }] : []),
  ]
  return (
    <header className="flex flex-col gap-3 md:gap-4">
      {/*
        shopify.com 메인 히어로 문법(skins/shop.css) — 검정 판 · 무게 330 초대형 제목 · 흰 알약 CTA ·
        「What winning looks like」 처럼 큰 숫자 + 작은 라벨의 지표 줄. 눈썹의 시리즈 이름은 판권면
        브랜드와 같은 상수에서 온다. 수치는 모두 실측(I5) — 못 앉힌 권도 센다.
        모바일에서 판 높이를 억제한다(첫 화면에 상품이 보여야 한다 — 위 실측 참조).
      */}
      <section className="relative overflow-hidden rounded-[16px] bg-black px-5 py-7 text-white sm:px-10 sm:py-12 md:px-14 md:py-16">
        {/* 레퍼런스 히어로의 흐린 타원 빛 — 장식 */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-32 h-[420px] w-[420px] rounded-full bg-[radial-gradient(rgba(193,251,212,0.28),transparent_65%)]"
        />
        <p className="font-body relative text-[13px] font-[500] text-[#a1a1aa]">{VOCAB_SERIES_BRAND}</p>
        <h1 className="shop-dsp relative mt-3 max-w-[16ch] break-keep text-[40px] sm:text-[56px] md:text-[72px]">
          다시 만나게 엮은 단어장
        </h1>
        <p className="font-body relative mt-4 max-w-[52ch] break-keep text-[15px] leading-relaxed text-[#d4d4d8] sm:text-[17px]">
          뜻마다 예문을 따로 두고, 함께 쓰이는 말과 갈라져 나온 말을 같이 싣습니다.
        </p>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <a
            href="#vocab-shelf"
            className="font-body inline-flex min-h-[44px] items-center rounded-full bg-white px-6 text-[15px] font-[600] text-black transition-colors hover:bg-[#d4d4d8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            서가 둘러보기
          </a>
        </div>
        <dl className="relative mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[#3f3f46] pt-6 sm:mt-12 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="font-body text-[12px] text-[#a1a1aa]">{s.label}</dt>
              <dd className="shop-dsp mt-1 text-[26px] tabular-nums sm:text-[34px]">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/*
        사다리 — 가로 스크롤. 모바일에서 7칸을 우겨넣으면 글자가 깨지므로
        칸 너비를 지키고 넘치는 쪽을 **자기 컨테이너 안에서** 스크롤시킨다.
      */}
      <nav aria-label="학령 사다리" className="-mx-1 overflow-x-auto px-1 pb-1">
        <ol className="flex min-w-max items-stretch gap-2">
          {fill.rungs.map((r) => (
            <RungTile
              key={r.rung.step}
              step={r.rung.step}
              schoolBand={r.rung.schoolBand}
              volumes={r.volumes}
              wordsPerDay={r.rung.wordsPerDay}
              isLearner={learnerStep === r.rung.step}
            />
          ))}
        </ol>
      </nav>
    </header>
  )
}

function RungTile({
  step,
  schoolBand,
  volumes,
  wordsPerDay,
  isLearner,
}: {
  step: number
  schoolBand: string
  volumes: number
  wordsPerDay: number
  isLearner: boolean
}) {
  const empty = volumes === 0
  return (
    <li
      // 내 계단은 테두리 + 글자 + `aria-current` 3중으로 말한다. 색 하나로만 가르면
      // 색맹 학습자에게는 아무 표시도 없는 것과 같다.
      aria-current={isLearner ? 'step' : undefined}
      // shop 스킨 — 레퍼런스 카드처럼 shade-10 면 한 가지(색 면을 돌리지 않는다).
      className={`flex min-w-[112px] flex-col gap-1 rounded-[16px] border bg-[var(--bg3)] px-4 py-3 transition-colors ${
        isLearner ? 'border-[var(--t1)] ring-2 ring-[var(--t1)]' : 'border-transparent'
      }`}
    >
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-[16px] font-[600] tabular-nums text-[var(--t1)]">
          {step}
        </span>
        <span className="font-body text-[11px] text-[var(--t3)]">단</span>
        {isLearner && (
          <span className="font-body ml-auto text-[10px] font-[600] text-[var(--p)]">지금</span>
        )}
      </div>
      <span className="font-body text-[12px] leading-tight text-[var(--t2)]">{schoolBand}</span>
      {/* 재고를 정직하게. '없음' 이 아니라 '근간 예정' 이다 — 교재 서가와 같은 말을 쓴다. */}
      <span
        className={`font-mono text-[11px] tabular-nums ${
          empty ? 'text-[var(--t3)]' : 'text-[var(--t2)]'
        }`}
      >
        {empty ? '근간 예정' : `${volumes}권 · 하루 ${wordsPerDay}`}
      </span>
    </li>
  )
}
