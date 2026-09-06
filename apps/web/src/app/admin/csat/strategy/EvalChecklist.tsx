// apps/web/src/app/admin/csat/strategy/EvalChecklist.tsx
//
// **벤치마크가 안 보는 축.**
//
// 위 일곱 축(A1~A7)은 코퍼스에서 실측한 값이고, 여기 열한 축은 **사람이 판정한 표**다.
// 둘을 같은 무게로 걸면 사고가 난다 — 실측이 아닌 값이 지수에 섞이면 1.200 이 오르는데
// 그건 개선이 아니라 분식이다. 그래서 이 표는 **지수에 안 들어가고**, 아래 두 가지만 한다:
//
//   1. 지수가 1.200 을 넘겨도 **아직 안 본 자리가 열한 개** 라는 것을 잊지 않게 한다.
//   2. 그중 **지고 있는 것**을 이름으로 짚는다 — 다음에 할 일이 거기다.
//
// 실측 7축과 겹치는 넷(해설·지문 규격·유형 수·오답)은 `benchAxis` 로 표시돼 여기서 빠진다.
// 겹친 것을 나란히 걸면 값이 어긋날 때 관리자가 **손으로 적은 쪽**을 근거로 쓴다.
//
// TBP 콘솔(`/admin/textbook`)에 있던 「평가 요소 15」를 여기로 옮긴 것이다(2026-09-06).
// 그 화면은 우위를 **33% (5/15)** 라는 손 계산으로 말했고 이 화면은 구속점 1.199 로 말했다 —
// 한 제품의 우위가 두 화면에서 다른 근거로 두 번 주장되고 있었다.

'use client'

import type { EvalDimension, Standing } from '@vocaflow/library-pipeline/textbook-evaluation'
import { CATEGORY_KO, type EvalCategory } from '@vocaflow/library-pipeline/textbook-evaluation'

/**
 * 판정 4색 + **글자 없는 기호를 쓰지 않는다.** 색만으로 말하면 색각 이상에서 사라지고,
 * 기호만으로 말하면 처음 여는 사람이 못 읽는다 — 기호·글자·색 셋을 함께 낸다.
 */
const STANDING_KO: Record<Standing, { mark: string; label: string; color: string }> = {
  superior: { mark: '▲', label: '우위', color: '#2E7D5A' },
  parity: { mark: '●', label: '대등', color: '#8A8278' },
  inferior: { mark: '▼', label: '열위', color: '#9C3A30' },
  absent: { mark: '✕', label: '없음', color: '#9C3A30' },
  unmeasured: { mark: '?', label: '못 잼', color: '#8A8278' },
}

/**
 * 정본(`evaluation.ts`)의 서술은 마크다운 강조를 쓴다 — 화면에서는 `**` 와 백틱이 그대로 보여
 * 오히려 읽기가 나빠진다. 뜻은 안 바꾸고 표시만 벗긴다.
 */
function plain(t: string): string {
  return t.replace(/\*\*/g, '').replace(/`/g, '')
}

const ORDER: readonly Standing[] = ['inferior', 'absent', 'unmeasured', 'parity', 'superior']

function StandingMark({ s }: { s: Standing }) {
  const k = STANDING_KO[s]
  return (
    <span className="whitespace-nowrap" style={{ color: k.color }}>
      <span aria-hidden className="font-mono">
        {k.mark}
      </span>{' '}
      {k.label}
    </span>
  )
}

export function EvalChecklist({ dimensions }: { dimensions: readonly EvalDimension[] }) {
  const tally = ORDER.map((s) => ({ s, n: dimensions.filter((d) => d.standing === s).length })).filter(
    (t) => t.n > 0,
  )
  const losing = dimensions.filter((d) => d.standing === 'inferior' || d.standing === 'absent')
  const categories = (Object.keys(CATEGORY_KO) as EvalCategory[])
    .map((c) => ({ c, rows: dimensions.filter((d) => d.category === c) }))
    .filter((g) => g.rows.length > 0)

  return (
    <div className="flex flex-col gap-2">
      <h4 className="break-keep font-display text-[12.5px] font-[700] text-[var(--t1)]">
        종이도 하는 자리인데 안 재는 것 — {dimensions.length}축
      </h4>
      <p className="break-keep font-body text-[11.5px] leading-snug text-[var(--t2)]">
        지수는 코퍼스 <strong>실측</strong>이고 이 표는 <strong>손 판정</strong>이라 지수에 안 넣는다 —
        넣으면 1.200 이 오르지만 그건 분식이다.
      </p>

      <ul className="flex flex-wrap gap-x-3 gap-y-1 font-body text-[12px]">
        {tally.map((t) => (
          <li key={t.s} className="whitespace-nowrap">
            <StandingMark s={t.s} />{' '}
            <span className="font-mono tabular-nums text-[var(--t1)]">{t.n}</span>
          </li>
        ))}
      </ul>

      {losing.length ? (
        <p className="break-keep rounded-[var(--r-sm)] bg-[var(--bg2)] p-2 font-body text-[11.5px] leading-snug text-[var(--t2)]">
          <strong className="text-[var(--t1)]">지고 있는 것</strong> — {losing.map((d) => d.label).join(' · ')}
        </p>
      ) : null}

      {/*
        열한 줄 전부는 접어 둔다(철학 2). 판정 요약과 「지고 있는 것」만으로 다음 행동이 정해지고,
        근거(시중은 어떻게 하나 · 우리는 · 어떻게 쟀나)는 그것을 의심할 때만 필요하다.
      */}
      <details className="group">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center font-display text-[11.5px] font-[600] text-[#8B5CF6] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[#A78BFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]">
          {dimensions.length}축 전부 — 무엇을 어떻게 쟀나
        </summary>
        <div className="mt-1 flex flex-col gap-3">
          {categories.map((g) => (
            <div key={g.c} className="flex flex-col gap-1">
              <h4 className="font-display text-[11.5px] font-[700] text-[var(--t2)]">
                {CATEGORY_KO[g.c]}
              </h4>
              <ul className="flex flex-col gap-1.5">
                {g.rows.map((d) => (
                  <li key={d.key} className="break-keep font-body text-[11.5px] leading-snug">
                    <span className="font-[600] text-[var(--t1)]">{d.label}</span>{' '}
                    <StandingMark s={d.standing} />
                    <span className="block text-[var(--t3)]">{plain(d.howMeasured)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
