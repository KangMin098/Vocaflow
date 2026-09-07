// apps/web/src/app/admin/csat/blueprint/BlueprintClient.tsx
//
// **설계 — 이원목적분류표.**
//
// 시중 출판사가 원고를 쓰기 전에 만드는 표다: **어느 학년(연령)에 · 어느 수준(V-Level)으로 ·
// 어느 유형을 몇 개** 낼 것인가. 이 표가 없으면 집필은 있는 소재대로 쓰게 되고, 그러면 학년별
// 난이도 사다리가 들쭉날쭉해진다 — 시장의 사다리가 촘촘한 이유가 그것이다.
//
// 화면은 세 가지를 한눈에 보인다:
//   ① 계단이 끊긴 자리 — 그 학년에서 학습자는 다른 출판사로 갈아탄다.
//   ② **셀 수 없는 칸과 재고 0 칸의 구분** — 초등 3종은 사전의 순수 함수라 DB 에 없다.
//      그 셋을 0 으로 그리면 초등 계단이 거짓으로 끊겨 보이고, 있지도 않은 구멍을 메우게 된다.
//   ③ 단계 게이트 임계 — 설계가 정한 합격선(커버리지·WPM·정답률). 근거 없이 정한 값이 아니다.

'use client'

import { Lock } from 'lucide-react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import type { BlueprintCell, BlueprintView } from '@/lib/csat/factory-lab-model'

const METRIC_KO: Record<string, string> = {
  coverage: '어휘 커버리지',
  wpm: '유효 WPM',
  item_accuracy: '문항 정답률',
  listening: '듣기 정합',
}

function cellTone(c: BlueprintCell): { bg: string; fg: string; text: string; title: string } {
  if (!c.countable)
    return {
      bg: 'transparent',
      fg: '#8A8278',
      text: '함수',
      title: '사전에서 그 자리에서 생성한다 — DB 에 저장하지 않으므로 재고라는 개념이 없다',
    }
  if (c.count == null)
    return { bg: 'transparent', fg: '#8A8278', text: '못 잼', title: '재고를 못 셌다' }
  if (c.count === 0)
    return { bg: '#9C3A3014', fg: '#9C3A30', text: '0', title: '이 칸이 비면 그 학년 책이 반쪽이다' }
  return {
    bg: '#2E7D5A14',
    fg: '#2E7D5A',
    text: c.count.toLocaleString(),
    title: `재고 ${c.count.toLocaleString()}문항`,
  }
}

export function BlueprintClient({ rungs, gates, typeAxis, loadError }: BlueprintView) {
  const broken = rungs.filter((r) => r.emptyTypes.length)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
            ③ 설계 — 이원목적분류표
          </h2>
          <p className="font-body text-[12px] text-[var(--t2)]">
            시중: 이원목적분류표 · 목차 설계 — 연령 × 수준 × 유형
          </p>
        </div>
        <AdminScreenHelp screen="csat-blueprint" />
      </div>

      {loadError ? (
        <p
          role="alert"
          className="rounded-[var(--r-md)] border border-[#9C3A30] bg-[var(--bg)] p-3 font-body text-[13px] text-[#9C3A30]"
        >
          {loadError}
        </p>
      ) : null}

      <section className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        {broken.length ? (
          <>
            <p className="font-body text-[12px] text-[var(--t3)]">끊긴 계단</p>
            <p className="mt-1 break-keep font-display text-[16px] font-[800] text-[#9C3A30]">
              {broken.map((r) => `${r.schoolBand}(${r.emptyTypes.join('·')})`).join(' · ')}
            </p>
            <p className="mt-1.5 break-keep font-body text-[12px] text-[var(--t3)]">
              계단 하나가 비면 학습자는 그 학년에서 다른 출판사로 갈아탄다. 시장의 사다리가 촘촘한
              이유가 그것이다.
            </p>
          </>
        ) : (
          <p className="font-display text-[15px] font-[700] text-[#2E7D5A]">
            학령 {rungs.length}단이 끊긴 데 없이 이어진다
          </p>
        )}
      </section>

      {/* ── 이원목적분류표 ── */}
      <section className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <h3 className="mb-1 font-display text-[13px] font-[700] text-[var(--t1)]">
          학령 × 수준 × 유형
        </h3>
        <p className="mb-3 break-keep font-body text-[11.5px] text-[var(--t3)]">
          빈 칸(회색 점선)은 그 계단이 <strong>쓰지 않기로 한</strong> 유형이다 — 재고가 없는 것이
          아니라 규격에서 뺀 것이다. 「함수」는 사전에서 그 자리에서 만들어 DB 에 저장하지 않는
          초등 3종이다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-[var(--bd)] text-[11px] text-[var(--t3)]">
                <th className="sticky left-0 z-10 bg-[var(--bg)] py-2 pr-3 text-left font-[500]">
                  계단 · 학령 · 수준
                </th>
                {typeAxis.map((t) => (
                  <th key={t.type} className="px-2 py-2 text-center font-[500]" title={t.type}>
                    <span className="break-keep">{t.typeKo}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rungs.map((r) => (
                <tr key={r.step} className="border-b border-[var(--bd)] last:border-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-[var(--bg)] py-2 pr-3 text-left align-top font-[500]"
                  >
                    <span className="font-mono text-[10px] text-[var(--t3)]">{r.step}</span>{' '}
                    <span className="text-[var(--t1)]">{r.schoolBand}</span>
                    <span className="ml-1 font-mono text-[10px] text-[var(--t3)]">
                      V{r.vLevels.join('·')}
                    </span>
                    <p className="mt-0.5 font-body text-[10.5px] font-[400] text-[var(--t3)]">
                      {r.volumeTitle}
                    </p>
                  </th>
                  {typeAxis.map((t) => {
                    const cell = r.cells.find((c) => c.type === t.type)
                    if (!cell)
                      return (
                        <td key={t.type} className="px-2 py-2 text-center">
                          <span
                            className="inline-block h-5 w-full rounded border border-dashed border-[var(--bd)]"
                            title="이 계단은 이 유형을 쓰지 않는다"
                            aria-label="규격 밖"
                          />
                        </td>
                      )
                    const tone = cellTone(cell)
                    return (
                      <td key={t.type} className="px-2 py-2 text-center" title={tone.title}>
                        <span
                          className="inline-block min-w-[46px] rounded-[var(--r-sm)] px-1.5 py-1 font-mono text-[11.5px] tabular-nums"
                          style={{ background: tone.bg, color: tone.fg }}
                        >
                          {tone.text}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 계단 근거 ── */}
      <section className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <h3 className="mb-2 font-display text-[13px] font-[700] text-[var(--t1)]">
          계단마다 그 유형을 쓰는 이유
        </h3>
        <ul className="flex flex-col gap-2">
          {rungs.map((r) => (
            <li key={r.step} className="border-b border-[var(--bd)] pb-2 last:border-0 last:pb-0">
              <p className="font-display text-[12px] font-[600] text-[var(--t1)]">
                {r.step}. {r.schoolBand} · {r.volumeTitle}
              </p>
              <p className="mt-0.5 break-keep font-body text-[11.5px] leading-snug text-[var(--t2)]">
                {r.rationale}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 단계 게이트 ── */}
      <section className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <h3 className="mb-1 font-display text-[13px] font-[700] text-[var(--t1)]">
          단계 게이트 임계 {gates.length}개
        </h3>
        <p className="mb-3 break-keep font-body text-[11.5px] text-[var(--t3)]">
          읽기 단계마다 넘어야 하는 합격선. 잠금(자물쇠)은 근거가 확정돼 더 못 움직인다는 뜻이다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-[var(--bd)] text-[11px] text-[var(--t3)]">
                <th className="py-1.5 pr-3 font-[500]">단계</th>
                <th className="py-1.5 pr-3 font-[500]">지표</th>
                <th className="py-1.5 pr-3 font-[500]">임계</th>
                <th className="py-1.5 font-[500]">근거</th>
              </tr>
            </thead>
            <tbody>
              {gates.map((g) => (
                <tr key={`${g.stage}-${g.metric}`} className="border-b border-[var(--bd)] last:border-0">
                  <td className="py-1.5 pr-3 font-mono text-[var(--t1)]">{g.stage}</td>
                  <td className="py-1.5 pr-3 text-[var(--t2)]">{METRIC_KO[g.metric] ?? g.metric}</td>
                  <td className="py-1.5 pr-3 font-mono tabular-nums text-[var(--t1)]">
                    {g.metric === 'wpm' ? g.threshold : `${Math.round(g.threshold * 100)}%`}
                    {g.isLocked ? (
                      <Lock size={11} strokeWidth={2} className="ml-1 inline text-[#8B5CF6]" aria-label="잠김" />
                    ) : null}
                  </td>
                  <td className="break-keep py-1.5 text-[var(--t3)]">{g.note ?? '—'}</td>
                </tr>
              ))}
              {!gates.length ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-[var(--t3)]">
                    게이트가 하나도 없다 — 합격선 없이 찍으면 무엇이 통과인지 아무도 모른다
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
