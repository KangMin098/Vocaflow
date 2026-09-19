// apps/web/src/app/admin/csat/FactoryLineDiagram.tsx
//
// **공정 라인 도식** — 여덟 칸을 한 그림으로.
//
// ── 왜 표가 아니라 그림인가 ──────────────────────────────────────────
// 이 화면은 카드 8장이었다(덩어리 284 · 글자 2,171 — 다른 화면의 2~4배). 카드마다 제목·눈금·
// 게이트·병목·명령이 다 펼쳐져 있어서, **한 번에 다 보이지만 아무것도 안 보였다.**
// 공정은 본래 **순서가 있는 한 줄**이므로 줄로 그리면 세 가지가 글자 없이 읽힌다:
//   ① 어디가 막혔나(색+모양) ② 그 뒤로 원고가 안 넘어간다(레일이 점선으로 끊긴다) ③ 어디까지 왔나.
// 상세는 고른 칸 하나만 아래에 편다 — 철학 2 Progressive Disclosure.
//
// ── 색만으로 말하지 않는다 ───────────────────────────────────────────
// 상태 4색을 `dataviz` 검증기에 넣으면 **amber↔green 의 CVD 분리가 ΔE 7.8**(protan)로 경고 대역이다.
// 즉 색약인 사람에게 「통과」와 「몫 남음」이 같아 보일 수 있다. 팔레트는 정본이라 바꾸지 않고
// (CLAUDE.md Memory Decay 4색), 대신 **칸마다 모양과 글자를 함께** 싣는다 —
// 채운 원 / 반쯤 채운 원 / 사각 / 점선 원. 회귀가 이 이중 부호화를 강제한다.
//
// ── 모션 ─────────────────────────────────────────────────────────────
// 상태가 바뀔 때만 움직인다(`--dur-normal` 200ms · `transform`·`opacity` 만). 쉬지 않는
// 미세 모션은 금지 — 학습 제품의 Calm UI 는 콘솔에도 적용된다.

'use client'

import { STATUS_KO, type StageState, type StageStatus } from '@/lib/csat/factory-model'

/**
 * 상태마다 **다른 모양**. 색이 안 보여도 이것으로 갈린다.
 *
 * `pass` 채운 원 · `short` 반달(반쯤 찬) · `blocked` 사각 · `unmeasured` 점선 원.
 * 모양이 겹치면 이중 부호화가 아니라 장식이 되므로 네 개가 서로 확실히 다르게 골랐다.
 */
function StatusGlyph({ status, size = 18 }: { status: StageStatus; size?: number }) {
  const color = STATUS_KO[status].color
  const c = size / 2
  const r = size / 2 - 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden focusable="false">
      {status === 'pass' ? (
        <circle cx={c} cy={c} r={r} fill={color} />
      ) : status === 'short' ? (
        <>
          <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth="2" />
          {/* 반쯤 찬 원 — 「몫이 남았다」를 모양으로 말한다 */}
          <path d={`M ${c} ${c - r} A ${r} ${r} 0 0 1 ${c} ${c + r} Z`} fill={color} />
        </>
      ) : status === 'blocked' ? (
        <rect x={2} y={2} width={size - 4} height={size - 4} rx={2} fill={color} />
      ) : (
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeDasharray="3 3"
        />
      )}
    </svg>
  )
}

interface Props {
  stages: StageState[]
  selectedId: string
  onSelect: (id: string) => void
  /** 병목 칸 — 이 뒤로는 원고가 안 넘어간다는 것을 레일로 보인다. */
  bottleneckOrd: number | null
}

const LANE_LABEL = { lab: '전략 연구소', line: '생산 라인' } as const

export function FactoryLineDiagram({ stages, selectedId, onSelect, bottleneckOrd }: Props) {
  const ordered = [...stages].sort((a, b) => a.def.ord - b.def.ord)
  const labCount = ordered.filter((s) => s.def.lane === 'lab').length

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        {/* ── 레인 머리 — 어느 구간이 무엇을 하는 곳인지 ── */}
        <div
          className="mb-1.5 grid gap-1"
          style={{ gridTemplateColumns: `repeat(${ordered.length}, minmax(0, 1fr))` }}
          aria-hidden
        >
          <div
            className="rounded-t-[var(--r-sm)] border-b-2 border-[#8B5CF6]/40 pb-1 text-center font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[#8B5CF6]"
            style={{ gridColumn: `span ${labCount}` }}
          >
            {LANE_LABEL.lab}
          </div>
          <div
            className="rounded-t-[var(--r-sm)] border-b-2 border-[var(--bd)] pb-1 text-center font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t3)]"
            style={{ gridColumn: `span ${ordered.length - labCount}` }}
          >
            {LANE_LABEL.line}
          </div>
        </div>

        {/* ── 라인 ── */}
        <ol
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${ordered.length}, minmax(0, 1fr))` }}
        >
          {ordered.map((s, i) => {
            const on = s.def.id === selectedId
            const isBottleneck = bottleneckOrd != null && s.def.ord === bottleneckOrd
            // 병목 **뒤**의 연결은 끊어진 것으로 그린다 — 앞이 막히면 뒤로 원고가 안 넘어간다.
            const afterBlock = bottleneckOrd != null && s.def.ord > bottleneckOrd
            const st = STATUS_KO[s.status]
            return (
              <li key={s.def.id} className="relative flex flex-col items-center">
                {/* 연결 레일 — 칸 사이를 잇는다. 첫 칸 왼쪽은 없다. */}
                {i > 0 ? (
                  <span
                    aria-hidden
                    className="absolute left-[-50%] top-[21px] h-[2px] w-full"
                    style={{
                      background: afterBlock ? 'transparent' : 'var(--bd)',
                      borderTop: afterBlock ? '2px dashed var(--bd)' : undefined,
                    }}
                  />
                ) : null}

                <button
                  type="button"
                  onClick={() => onSelect(s.def.id)}
                  aria-current={on ? 'true' : undefined}
                  aria-label={`${s.def.ord}. ${s.def.name} — ${st.label}${isBottleneck ? ' · 지금 라인을 막고 있다' : ''}`}
                  className={`relative z-10 flex min-h-[44px] w-full flex-col items-center gap-1 rounded-[var(--r-md)] border bg-[var(--bg)] px-1 py-2 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] ${
                    on
                      ? 'border-[#8B5CF6] bg-[#8B5CF6]/8'
                      : 'border-[var(--bd)] hover:bg-[var(--bg2)] active:bg-[var(--bd)]'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <span className="font-mono text-[10px] text-[var(--t3)]">{s.def.ord}</span>
                    <StatusGlyph status={s.status} />
                  </span>
                  <span className="w-full truncate break-keep text-center font-display text-[12px] font-[600] text-[var(--t1)]">
                    {s.def.name}
                  </span>
                  {/* 색이 안 보여도 상태를 읽을 수 있게 **글자로도** 적는다 */}
                  <span className="font-body text-[10px]" style={{ color: st.color }}>
                    {st.label}
                  </span>
                </button>

                {isBottleneck ? (
                  <span className="mt-1 break-keep rounded-[var(--r-full)] bg-[#B5803A]/15 px-1.5 py-0.5 font-display text-[9.5px] font-[700] text-[#B5803A]">
                    여기서 막힘
                  </span>
                ) : null}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
