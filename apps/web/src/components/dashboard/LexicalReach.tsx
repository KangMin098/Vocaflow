// apps/web/src/components/dashboard/LexicalReach.tsx
//
// 어휘의 무게중심 — 내가 붙잡고 있는 단어는 **어디쯤**인가.
//
// 왜 이 카드가 있나:
//   회고 화면이 "몇 개" 만 말하면 학습자는 자기 어휘의 성격을 영원히 모른다. 흔한 단어
//   1,000개와 드문 단어 1,000개는 같은 1,000개가 아니다. `shared_dictionary.frequency_rank`
//   가 이미 있으므로(실측: 45,292행 중 순위 보유 약 29k, 이 계정 252개 중 227개 매칭)
//   추가 파이프라인 없이 바로 말할 수 있다.
//
// ⚠️ **커버리지 %로 환산하지 않는다.**
//   "이 단어들로 일반 텍스트의 92%를 읽어요" 류의 문장은 학습자가 *아는 전체 어휘*를
//   알아야 성립한다(Nation 계열 연구의 95%/98% 임계도 어휘 **크기** 추정이 전제다).
//   우리가 가진 것은 학습자가 **담아 둔** 단어뿐이라, 환산하면 실제보다 훨씬 낮은 숫자가
//   나오고 그건 격려가 아니라 오보다. 그래서 이 카드는 분포만 말하고 능력을 주장하지 않는다.

import type { Reach } from '@/lib/learner/growth-math'

export function LexicalReach({ reach }: { reach: Reach }) {
  if (reach.ranked === 0) return null

  const max = Math.max(...reach.bands.map((b) => b.count), 1)

  return (
    <section
      aria-label="어휘의 무게중심"
      className="flex flex-col rounded-ios-2xl bg-[var(--bg)] px-5 py-5 shadow-ios-2 md:px-6"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t3)]">
          어휘의 무게중심
        </p>
        <span className="font-mono text-[10px] tabular-nums text-[var(--t3)]">
          순위를 아는 {reach.ranked.toLocaleString()}개 기준
        </span>
      </header>

      {reach.medianRank !== null && (
        <p className="mt-3 max-w-[38ch] font-editorial text-[19px] font-[500] leading-[1.35] tracking-[-0.01em] text-[var(--t1)] [word-break:keep-all]">
          담아 둔 단어의 절반이{' '}
          <span className="tabular-nums">{Math.round(reach.medianRank).toLocaleString()}위</span>{' '}
          밖이에요.
        </p>
      )}

      {/* 가로 막대 — 밴드는 순서 있는 축이라 단일 액센트 밝기 변조만 쓴다.
          ⚠️ 막대는 **자기 트랙 안에서만** 자란다. 트랙 없이 막대와 숫자를 같은 flex 줄에
          두면 100%짜리 막대가 숫자를 밖으로 밀어내 문서가 가로로 넘친다(390px 실측 20px). */}
      <dl className="mt-4 flex flex-col gap-2.5">
        {reach.bands.map((b, i) => (
          <div key={b.key} className="flex items-center gap-3">
            <dt className="w-[62px] shrink-0 font-display text-[12px] font-[700] text-[var(--t2)]">
              {b.label}
            </dt>
            <dd className="flex min-w-0 flex-1 items-center gap-2">
              <span aria-hidden className="h-2 min-w-0 flex-1">
                <span
                  className="block h-2 rounded-[var(--r-full)]"
                  style={{
                    width: `${Math.max(b.count > 0 ? 3 : 0, (b.count / max) * 100)}%`,
                    background: `color-mix(in srgb, var(--p) ${100 - i * 15}%, var(--bg3))`,
                  }}
                />
              </span>
              <span className="w-[44px] shrink-0 text-right font-display text-[12px] font-[700] tabular-nums text-[var(--t1)]">
                {b.count.toLocaleString()}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 border-t border-[var(--bd)] pt-3.5 font-body text-[12px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
        순위가 낮을수록 글에서 자주 만나는 단어예요. 뒤쪽 칸이 두꺼워졌다면 흔한 단어는 이미
        넘어섰다는 뜻이에요.
      </p>
    </section>
  )
}
