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
  return (
    <header className="flex flex-col gap-4 px-1">
      <div className="flex flex-col gap-1.5">
        {/*
          시리즈 이름 — 판권면의 브랜드와 **같은 상수**에서 온다.
          여기에 문자열을 적으면 정본이 둘이 된다.
        */}
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--t3)]">
          {VOCAB_SERIES_BRAND}
        </p>
        <h1 className="font-editorial text-[40px] font-[500] leading-[1.04] tracking-[-0.012em] text-[var(--t1)] md:text-[52px]">
          단어장
        </h1>
        {/*
          방향성 한 줄 — **시중 단어장이 못 하는 것만** 적는다.
          종이책은 한 권에 묶음 원리를 네댓 개밖에 못 싣는다(실측: 시중 PART 축 7종).
        */}
        <p className="font-body max-w-[62ch] text-[15px] leading-[1.6] text-[var(--t2)]">
          한 낱말을 여러 각도로 다시 만나게 엮은 서가입니다. 뜻마다 예문을 따로 두고,
          함께 쓰이는 말과 갈라져 나온 말을 같이 싣습니다.
        </p>
      </div>

      <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-[var(--bd)] py-3">
        <Stat label="전체" value={`${totalVolumes}권`} />
        <Stat label="표제어" value={totalWords.toLocaleString()} />
        <Stat label="사다리" value={`${fill.rungs.length}단`} />
        {/* 못 앉힌 권을 숨기지 않는다 — 학령 사다리 밖(성인 수준)이라는 사실 자체가 정보다. */}
        {fill.unplaced > 0 && (
          <Stat label="학령 밖" value={`${fill.unplaced}권`} muted />
        )}
      </dl>

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

function Stat({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="font-body text-[12px] text-[var(--t3)]">{label}</dt>
      <dd
        className={`font-mono text-[13px] tabular-nums ${
          muted ? 'text-[var(--t3)]' : 'text-[var(--t1)]'
        }`}
      >
        {value}
      </dd>
    </div>
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
      className={`flex min-w-[104px] flex-col gap-1 rounded-ios-sm border px-3 py-2.5 transition-colors ${
        isLearner
          ? 'border-[var(--p)] bg-[var(--p-light,var(--bg3))]'
          : 'border-[var(--bd)] bg-[var(--bg)]'
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
