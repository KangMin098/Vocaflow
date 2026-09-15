// apps/web/src/components/csat/PassageMap.tsx
//
// **지문 지도 — 클릭 하나로 «근거가 지문의 어디인가» 가 보이는 조작면.**
//
// ── 무엇이 새로운가 ───────────────────────────────────────────────────
// 이전 화면은 산문 네 덩어리를 세로로 쌓았다. 학습자는 «무엇에 대한 해설인지» 를 머릿속에
// 들고 있어야 했고, 지문은 평가원 저작물이라 실을 수 없으니 달리 방법이 없었다.
//
// 여기서는 **글자 대신 모양**을 그린다. 문장마다 길이에 비례한 막대가 쌓이면 지문이 몇
// 문장인지, 어디가 길고 어디가 짧은지가 **보인다**. 그리고 칩을 누르면 그 근거가 든 막대가
// **그 자리에서** 열려 인용문이 글자로 드러난다 — 막대 안의 정확한 위치에.
// (설계 렌즈 §C-2 「지문이 곧 인터페이스」 — 컨트롤을 지문 바깥 툴바에 두지 않는다.)
//
// ── 판단은 여기 없다 ──────────────────────────────────────────────────
// 「어느 막대가 열리는가」는 `lib/csat/passage-map-model.ts` 가 정한다. 이 저장소는
// 컴포넌트를 `renderToString` 으로만 검사하므로, 판단을 여기 두면 검사할 길이 없어진다.
//
// ── 색만으로 말하지 않는다 ────────────────────────────────────────────
// 표식은 **기호 + 글자 + 색** 셋을 함께 낸다. 색약 학습자에게 색은 없는 것과 같고,
// 이 화면은 «어느 줄인가» 가 전부라 색 하나에 걸면 화면이 통째로 빈다.
//
// ── 모션 ──────────────────────────────────────────────────────────────
// `opacity` 전환 하나뿐이고 `--dur-normal` 안이다. 학습 중 화이트리스트 밖의 장식 모션은
// 넣지 않는다(CLAUDE.md 모션 예산). `motion-reduce` 에서는 전환을 끈다.

'use client'

import { useMemo, useRef, useState } from 'react'

import { track } from '@/lib/analytics/client'
import {
  countsAsOpen,
  initialAnchorId,
  mapState,
  segments,
  widthPct,
  type MapAnchor,
  type MapPlacement,
} from '@/lib/csat/passage-map-model'
import type { SkeletonSentence } from '@/lib/csat/passage-skeleton'

export type { MapAnchor, MapPlacement }

export interface PassageMapProps {
  sentences: SkeletonSentence[]
  anchors: MapAnchor[]
  placements: MapPlacement[]
  /** 칩을 누를 때마다 부른다 — 계측용. */
  onSelect?: (anchorId: string, found: boolean) => void
}

const GREEN = '#2E7D5A'
const RED = '#9C3A30'

export function PassageMap({ sentences, anchors, placements, onSelect }: PassageMapProps) {
  const [activeId, setActiveId] = useState<string | null>(() => initialAnchorId(anchors))
  const { active, lit, notFound } = useMemo(
    () => mapState(anchors, placements, activeId),
    [anchors, placements, activeId],
  )
  const maxChars = useMemo(() => Math.max(...sentences.map((s) => s.chars), 1), [sentences])
  const found = useMemo(() => new Map(placements.map((p) => [p.id, p.sentences.length > 0])), [placements])
  const tone = active?.kind === 'answer' ? GREEN : RED

  // 「클릭/클릭/클릭」이 실제로 일어나는지는 **몇 번째인지**를 세야 안다. 첫 근거는 서버가
  // 이미 펴 둔 채로 오므로 세지 않는다 — 세면 모든 방문이 최소 1이 되어 «눌렀다» 와
  // «떠 있었다» 가 구별되지 않는다.
  const opened = useRef(0)

  function pick(id: string) {
    if (!countsAsOpen(activeId, id)) return
    setActiveId(id)
    const hit = found.get(id) === true
    opened.current += 1
    const kind = anchors.find((a) => a.id === id)?.kind ?? 'reject'
    track({ name: 'csat_evidence_opened', props: { kind, found: hit, seq: opened.current } })
    onSelect?.(id, hit)
  }

  if (!sentences.length) return null

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-sm font-bold text-[var(--t1)]">지문 지도</h2>
        <p className="break-keep text-xs text-[var(--t3)]">{sentences.length}문장 · 눌러서 근거 자리 보기</p>
      </div>

      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="근거 고르기">
        {anchors.map((a) => {
          const on = a.id === activeId
          const has = found.get(a.id) === true
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => pick(a.id)}
              aria-pressed={on}
              className={[
                'inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-md)] border px-3 text-sm',
                'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] motion-reduce:transition-none',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]',
                on
                  ? 'bg-[var(--sf-2)] text-[var(--t1)]'
                  : 'border-[var(--bd)] bg-[var(--sf)] text-[var(--t2)] hover:border-[var(--p)] hover:bg-[var(--sf-2)] active:bg-[var(--bd)]',
              ].join(' ')}
              style={on ? { borderColor: a.kind === 'answer' ? GREEN : RED } : undefined}
            >
              <span aria-hidden className="font-display font-bold tabular-nums">
                {a.kind === 'answer' ? '✓' : a.label}
              </span>
              <span className="break-keep">
                {a.kind === 'answer' ? `답이 왜 ${a.label}인가` : `${a.label} 아닌 이유`}
              </span>
              {!has ? <span className="break-keep text-[10px] text-[var(--t3)]">위치 없음</span> : null}
            </button>
          )
        })}
      </div>

      <ol className="space-y-1.5" aria-label="지문의 문장">
        {sentences.map((s, i) => {
          const isLit = lit.includes(i)
          const reveals = isLit && activeId ? s.reveals.filter((r) => r.anchorId === activeId) : []

          return (
            <li
              key={i}
              aria-label={`${i + 1}번째 문장${isLit ? ' — 지금 보는 근거가 여기 있어요' : ''}`}
              className="flex items-center gap-2"
            >
              <span
                aria-hidden
                className="w-5 shrink-0 text-right font-display text-[10px] tabular-nums text-[var(--t3)]"
              >
                {isLit ? (active?.kind === 'answer' ? '✓' : active?.label) : i + 1}
              </span>

              {isLit && reveals.length ? (
                <span
                  className="flex min-w-0 flex-1 flex-wrap items-center gap-px rounded-[var(--r-sm)] bg-[var(--sf-2)] px-1 py-1"
                  style={{ boxShadow: `inset 0 0 0 1px ${tone}` }}
                >
                  {segments(s, reveals).map((seg, k) =>
                    seg.text ? (
                      <span key={k} className="font-display text-[13px] leading-relaxed text-[var(--t1)]">
                        {seg.text}
                      </span>
                    ) : (
                      <span
                        key={k}
                        aria-hidden
                        className="inline-block h-2 rounded-[2px] bg-[var(--bd)]"
                        style={{ width: `${Math.min(seg.chars * 0.42, 40)}ch`, maxWidth: '60%' }}
                      />
                    ),
                  )}
                </span>
              ) : (
                <span
                  aria-hidden
                  className="h-2 rounded-full bg-[var(--bd)] transition-opacity duration-[var(--dur-normal)] ease-[var(--ease)] motion-reduce:transition-none"
                  style={{ width: `${widthPct(s.chars, maxChars)}%`, opacity: activeId && !isLit ? 0.45 : 0.8 }}
                />
              )}
            </li>
          )
        })}
      </ol>

      {active ? (
        <div className="mt-4 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4">
          {notFound ? (
            // **막다른 화면을 만들지 않는다.** 못 찾았다는 사실을 말하고 설명은 그대로 준다.
            <p className="mb-2 break-keep text-sm leading-relaxed text-[var(--t2)]">
              이 근거는 지문에서 위치를 찾지 못했어요. 설명은 아래 그대로 읽을 수 있어요.
            </p>
          ) : null}
          {active.tempting ? (
            <p className="mb-2 break-keep text-sm leading-relaxed text-[var(--t2)]">{active.tempting}</p>
          ) : null}
          {active.detail ? (
            <p
              className="break-keep border-l-2 pl-3 text-sm leading-relaxed text-[var(--t1)]"
              style={{ borderColor: active.kind === 'answer' ? GREEN : RED }}
            >
              {active.detail}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
