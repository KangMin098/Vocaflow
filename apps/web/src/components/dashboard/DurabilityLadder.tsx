// apps/web/src/components/dashboard/DurabilityLadder.tsx
//
// Growth 히어로 — **기억이 버티는 시간**.
//
// 무엇을 대체했나: `user_stats.known_word_count` 를 읽어 "마음에 자리잡은 단어 0개" 를
// 띄우던 그라데이션 상자. 그 컬럼은 정상적으로 갱신되고 있었고 0도 정직한 값이었다 —
// 정의가 `stability >= 21`(Anki mature)이라 21일을 버티는 단어가 실제로 없었을 뿐이다.
// 문제는 **그 지표를 주인공으로 세운 것**이다: 신규~중급 학습자는 몇 달 동안 0을 본다.
// 회고 화면의 주인공 자리에 몇 달간 0을 두는 것은 "당신은 아무것도 이루지 못했다" 를
// 매일 반복하는 것과 같다. (자세한 경위는 memory-horizon.ts 머리주석 ①)
//
// 왜 하필 지속 시간인가:
//   개수는 노력의 양을 말하지만 **질을 말하지 못한다**. 같은 252개라도 하루면 흐려지는 252개와
//   한 달을 버티는 252개는 완전히 다른 학습이고, 학습자는 그 차이를 알 방법이 없었다.
//   FSRS 의 stability(S) 는 정확히 그 값이다 — R(t)=0.9^(t/S) 에서 S 는 회상률이 90%로
//   떨어지기까지의 일수, 즉 **기억의 반감기**다. 우리는 단어마다 그 값을 이미 갖고 있다.
//
// 평가하지 않는다:
//   추세선(좋아졌다/나빠졌다)을 그리지 않는다. 정답률이 낮은 구간에서는 FSRS 가 S 를 낮추므로
//   추세가 정직하게 하락으로 나오는데, 회고 화면이 그걸 들이미는 것은 철학 ③ 위반이다.
//   대신 **지금 어디에 있는지**를 보여주고, 사다리를 올리는 방법 한 문장을 붙인다.
//
// 색: 단일 액센트(--p)의 밝기 변조만 — 사다리는 순서가 있는 축이라 4색 상태 토큰을 쓰면
// 안 된다(그 토큰은 R(t) 4상태 전용이고, 여기 5칸과 의미가 다르다).

import { RUNGS, formatDuration, type Ladder } from '@/lib/learner/growth-math'

/** 칸이 오를수록 진해진다 — 순서 있는 축의 시각 부호. */
const RUNG_ALPHA: Record<string, number> = {
  day: 0.28,
  few: 0.45,
  week: 0.62,
  month: 0.8,
  season: 1,
}

export function DurabilityLadder({ ladder }: { ladder: Ladder }) {
  const { counts, unseen, onLadder, medianDays, champion } = ladder

  // 사다리에 아무도 없다 — 숫자를 나열하지 않고 문장 하나로 바꾼다(상태 띠와 같은 규칙).
  if (onLadder === 0) {
    return (
      <section
        aria-label="기억이 버티는 시간"
        className="rounded-ios-2xl bg-[var(--bg)] px-5 py-6 shadow-ios-2 md:px-8 md:py-8"
      >
        <Eyebrow />
        <p className="mt-4 max-w-[42ch] font-editorial text-[24px] font-[500] leading-[1.3] tracking-[-0.014em] text-[var(--t1)] [word-break:keep-all] md:text-[30px]">
          {unseen > 0
            ? '아직 한 번도 다시 만난 단어가 없어요.'
            : '단어를 담으면 여기서 기억이 자라는 걸 볼 수 있어요.'}
        </p>
        <p className="mt-3 max-w-[46ch] font-body text-[14px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
          {unseen > 0
            ? `담아 둔 ${unseen.toLocaleString()}개를 한 번 복습하면, 그때부터 단어마다 "며칠을 버티는지"가 기록되기 시작해요.`
            : '글을 읽고 모르는 단어를 담는 것이 첫걸음이에요.'}
        </p>
      </section>
    )
  }

  const rungs = RUNGS.map((r) => ({ ...r, count: counts[r.key] }))
  // 무게 중심 — 가장 많은 단어가 앉아 있는 칸. 안내 문장이 여기에 맞춰 달라진다.
  const heaviest = rungs.reduce((a, b) => (b.count > a.count ? b : a))

  return (
    <section
      aria-label="기억이 버티는 시간"
      className="rounded-ios-2xl bg-[var(--bg)] px-5 py-6 shadow-ios-2 md:px-8 md:py-8"
    >
      <Eyebrow />

      {/* 히어로 수치 — 중앙값. 평균이 아니라 중앙값인 이유: 한 단어가 유난히 오래 버티면
          평균이 통째로 끌려가 "내 기억이 이만큼 간다" 는 착각을 만든다. */}
      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-editorial text-[40px] font-[500] leading-[0.98] tracking-[-0.022em] text-[var(--t1)] md:text-[54px]">
          {medianDays !== null ? formatDuration(medianDays) : '—'}
        </h2>
        <p className="font-body text-[14px] leading-snug text-[var(--t2)]">
          단어 절반이 이만큼 버텨요
        </p>
      </div>

      {/* 사다리 — 누적 막대 하나. 게이지·퍼센트 없음(철학 ④). */}
      <div
        className="mt-6 flex h-3 w-full overflow-hidden rounded-[var(--r-full)] bg-[var(--bg3)]"
        role="img"
        aria-label={rungs
          .filter((r) => r.count > 0)
          .map((r) => `${r.label} ${r.count}개`)
          .join(', ')}
      >
        {rungs.map((r) =>
          r.count > 0 ? (
            <div
              key={r.key}
              style={{
                width: `${(r.count / onLadder) * 100}%`,
                background: `color-mix(in srgb, var(--p) ${RUNG_ALPHA[r.key] * 100}%, var(--bg3))`,
              }}
              title={`${r.label} ${r.count}개`}
            />
          ) : null,
        )}
      </div>

      {/* 칸 이름 — 색만으로 알리지 않는다. 이름 + 숫자 + 설명 3중.
          라벨과 숫자를 같은 줄 양끝에 두면 5열 데스크톱에서 둘 사이가 100px 넘게 벌어져
          서로 다른 항목처럼 읽힌다(라운드 1 실측). 숫자를 아래로 내려 한 덩어리로 묶는다. */}
      <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        {rungs.map((r) => (
          <div key={r.key} className="flex min-w-0 flex-col gap-1">
            <dt className="flex flex-col gap-1">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-[var(--r-sm)]"
                  style={{
                    background: `color-mix(in srgb, var(--p) ${RUNG_ALPHA[r.key] * 100}%, var(--bg3))`,
                  }}
                />
                <span className="font-display text-[12px] font-[700] text-[var(--t2)]">
                  {r.label}
                </span>
              </span>
              <span
                className={`font-display text-[20px] font-[800] leading-none tabular-nums ${
                  r.count > 0 ? 'text-[var(--t1)]' : 'text-[var(--t3)]'
                }`}
              >
                {r.count.toLocaleString()}
              </span>
            </dt>
            <dd className="font-body text-[11px] leading-snug text-[var(--t2)] [word-break:keep-all]">
              {r.note}
            </dd>
          </div>
        ))}
      </dl>

      {/* 지금 무엇을 하면 사다리가 오르는가 — 회고 화면이 채점이 아니라 안내가 되는 지점.
          무게 중심이 어디냐에 따라 말이 달라진다. */}
      <footer className="mt-5 border-t border-[var(--bd)] pt-4">
        <p className="max-w-[58ch] font-english text-[14px] italic leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
          {heaviest.key === 'day' || heaviest.key === 'few'
            ? '간격을 두고 다시 만날수록 버티는 시간이 늘어나요. 오늘 다 하지 않아도 괜찮아요 — 내일 다시 만나는 편이 오히려 오래 남아요.'
            : '한 번 올라간 칸은 잘 내려오지 않아요. 지금 속도면 충분해요.'}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums text-[var(--t3)]">
          <span>사다리 위 {onLadder.toLocaleString()}개</span>
          {unseen > 0 && <span>· 아직 만나기 전 {unseen.toLocaleString()}개</span>}
        </p>
      </footer>

      {/* 사다리 꼭대기 — **단어 자체**.
          이 자리에는 원래 "가장 오래 버티는 단어 2일" 이라는 숫자만 있었다. 그건 이 재설계가
          이전 화면을 비판한 것과 똑같은 결함이다(개수는 있고 단어가 없다). 회고에서 남는 것은
          수치가 아니라 "언제 처음 만나 몇 번을 다시 만났나" 라는 자기 이력이다. */}
      {champion && (
        <aside className="mt-4 rounded-[var(--r-lg)] bg-[var(--bg2)] px-4 py-4">
          <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.16em] text-[var(--t3)]">
            가장 멀리 온 단어
          </p>
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-editorial text-[22px] font-[500] text-[var(--t1)]">
              {champion.word}
            </span>
            <span className="min-w-0 font-body text-[13px] text-[var(--t2)]">
              {champion.meaning}
            </span>
          </p>
          <p className="mt-1.5 font-body text-[12px] leading-[1.65] text-[var(--t2)] [word-break:keep-all]">
            {fmtFirstMet(champion.firstMet)}에 처음 만나
            {champion.reviewCount > 0 && ` ${champion.reviewCount}번을 다시 만났고,`} 지금{' '}
            <strong className="font-display font-[700] text-[var(--t1)]">
              {formatDuration(champion.days)}
            </strong>
            을 버텨요.
          </p>
        </aside>
      )}
    </section>
  )
}

/** 'YYYY-MM-DD' → "8월 5일". 연도는 빼도 회고 맥락에서 모호하지 않다. */
function fmtFirstMet(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일`
}

function Eyebrow() {
  return (
    <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t3)]">
      기억이 버티는 시간
    </p>
  )
}
