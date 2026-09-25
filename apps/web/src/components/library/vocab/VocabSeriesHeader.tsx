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
import { AreaHero } from '@/components/layout/AreaHero'
import { MATERIAL_TONE, TINT_CLASS, TINT_ROTATION } from '@/lib/design/tone'

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
  return (
    <header className="flex flex-col gap-3 md:gap-4">
      {/*
        이웃 서가(도서 · 기사 · 교재)와 **같은 판**(DD-68 · tines-mapping §24) — 범주 색 진한 면에
        눈썹 · 제목 · 한 줄 · 수치 알약. 눈썹의 시리즈 이름은 판권면 브랜드와 같은 상수에서 온다
        (여기에 문자열을 적으면 정본이 둘이 된다). 타일은 390px 에서 판이 알아서 숨긴다.
        못 앉힌 권도 알약으로 센다 — 학령 사다리 밖(성인 수준)이라는 사실 자체가 정보다.
      */}
      <AreaHero
        kicker={VOCAB_SERIES_BRAND}
        title="단어장"
        sub="한 낱말을 여러 각도로 다시 만나게 엮은 서가입니다. 뜻마다 예문을 따로 두고, 함께 쓰이는 말과 갈라져 나온 말을 같이 싣습니다."
        tile="tile-decks"
        tint={MATERIAL_TONE.word_set.tint}
        stats={[
          { label: '전체', value: `${totalVolumes}권` },
          { label: '표제어', value: totalWords.toLocaleString() },
          { label: '사다리', value: `${fill.rungs.length}단` },
          ...(fill.unplaced > 0 ? [{ label: '학령 밖', value: `${fill.unplaced}권` }] : []),
        ]}
      />

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
      // DD-68 · tines-mapping §17 — 참조 격자처럼 칸마다 옅은 면을 돌린다(면 안 글자는 그 색상의 짙은 글자).
      className={`${TINT_CLASS[TINT_ROTATION[(step - 1) % TINT_ROTATION.length]]} flex min-w-[104px] flex-col gap-1 rounded-[12px] border px-3 py-2.5 transition-colors ${
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
