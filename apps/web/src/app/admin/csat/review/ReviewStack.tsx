// apps/web/src/app/admin/csat/review/ReviewStack.tsx
//
// **검수 4층 — 원고가 통과해야 하는 체 넷을 위에서 아래로.**
//
// ── 왜 카드 넷이 아니라 층인가 ───────────────────────────────────────
// 「다층 검수」가 이 파이프라인의 차별점인데, 카드 네 장을 나란히 두면 **넷이 서로 무슨 관계인지**
// 안 보인다. 실제 구조는 나란함이 아니라 **순서**다 — 기계 게이트를 통과한 것만 사람이 읽고,
// 사람이 통과시킨 것만 조판에 올라가고, 조판된 것만 시중과 견줄 수 있다.
//
// 그래서 위에서 아래로 쌓고, **처음 막히는 층 아래는 흐리게** 그린다. 원고가 거기까지 못 온다는
// 뜻이고, 그러면 아래 층의 수치는 「좋아 보여도 의미가 없다」 — 표본이 안 온 것뿐이다.
//
// ⚠️ 층마다 **무엇을 보는지**를 지운 적이 없다. 넷이 같은 것을 보면 층이 넷이 아니라 하나이고,
//   그게 이 화면이 막아야 하는 거짓 안심이다. 명령은 접어 둔다(깊이).

'use client'

import type { ReviewLayer } from '@/lib/csat/factory-line-model'

/** 층 하나의 판정. `null` 은 실패가 아니라 **안 잰 것**이다 — 0 과 다르다. */
function judge(l: ReviewLayer): { done: boolean; measured: boolean; pct: number | null } {
  const measured = l.passed != null && l.total != null
  if (!measured) return { done: false, measured: false, pct: null }
  const total = l.total ?? 0
  const passed = l.passed ?? 0
  return {
    done: total > 0 && passed >= total,
    measured: true,
    pct: total > 0 ? Math.round((100 * passed) / total) : null,
  }
}

/** 모양으로도 가른다 — 색약에서 초록↔주황이 겹친다(ΔE 7.8). */
function LayerGlyph({ done, measured }: { done: boolean; measured: boolean }) {
  const color = !measured ? '#8A8278' : done ? '#2E7D5A' : '#B5803A'
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden focusable="false">
      {!measured ? (
        <circle cx="7" cy="7" r="5" fill="none" stroke={color} strokeWidth="2" strokeDasharray="3 3" />
      ) : done ? (
        <circle cx="7" cy="7" r="5" fill={color} />
      ) : (
        <>
          <circle cx="7" cy="7" r="5" fill="none" stroke={color} strokeWidth="2" />
          <path d="M 7 2 A 5 5 0 0 1 7 12 Z" fill={color} />
        </>
      )}
    </svg>
  )
}

export function ReviewStack({ layers }: { layers: ReviewLayer[] }) {
  // 원고가 처음 걸리는 층. 그 아래는 표본이 안 오므로 수치를 곧이곧대로 읽으면 안 된다.
  const stopAt = layers.findIndex((l) => !judge(l).done)

  return (
    <ol className="flex flex-col gap-1.5">
      {layers.map((l, i) => {
        const { done, measured, pct } = judge(l)
        const below = stopAt >= 0 && i > stopAt
        const color = !measured ? '#8A8278' : done ? '#2E7D5A' : '#B5803A'
        return (
          <li
            key={l.id}
            className={`rounded-[var(--r-md)] border bg-[var(--bg)] p-3 transition-opacity duration-[var(--dur-normal)] ease-[var(--ease)] ${
              i === stopAt ? 'border-[#B5803A]' : 'border-[var(--bd)]'
            } ${below ? 'opacity-55' : ''}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="flex items-center gap-1.5 font-display text-[13px] font-[700] text-[var(--t1)]">
                <LayerGlyph done={done} measured={measured} />
                <span className="font-mono text-[11px] text-[#8B5CF6]">{l.id}</span>
                {l.name}
              </h3>
              <span className="font-mono text-[13px] tabular-nums text-[var(--t1)]">
                {measured ? (
                  <>
                    {l.passed!.toLocaleString()} / {l.total!.toLocaleString()}
                    {pct != null ? (
                      <span className="ml-1 text-[11px] text-[var(--t3)]">({pct}%)</span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-[#8A8278]">못 잼</span>
                )}
              </span>
            </div>

            {measured && l.total! > 0 ? (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bd)]">
                <div
                  className="h-full rounded-full transition-[width] duration-[var(--dur-normal)] ease-[var(--ease)]"
                  style={{ width: `${Math.min(100, pct ?? 0)}%`, background: color }}
                />
              </div>
            ) : null}

            <p className="mt-1.5 break-keep font-body text-[11px] leading-snug text-[var(--t2)]">
              <span className="text-[var(--t3)]">보는 것 · </span>
              {l.looksAt}
            </p>

            {l.unmeasuredReason ? (
              <p className="mt-1 break-keep font-body text-[11px] leading-snug text-[#8A8278]">
                {l.unmeasuredReason}
              </p>
            ) : null}

            {below ? (
              <p className="mt-1 break-keep font-body text-[10.5px] leading-snug text-[var(--t3)]">
                위 층에서 걸린 원고는 여기까지 오지 않는다 — 이 수치는 통과율이 아니라 **온 것만**의 값이다.
              </p>
            ) : null}

            <details className="mt-1">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center font-display text-[11px] font-[600] text-[#8B5CF6] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[#A78BFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]">
                이 층을 돌리는 명령
              </summary>
              <code className="mt-1 block break-all rounded-[var(--r-sm)] bg-[var(--bg2)] p-1.5 font-mono text-[11px] text-[var(--t1)]">
                {l.cmd}
              </code>
            </details>
          </li>
        )
      })}
    </ol>
  )
}
