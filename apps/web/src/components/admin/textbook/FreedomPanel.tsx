// apps/web/src/components/admin/textbook/FreedomPanel.tsx
//
// **자유도 — "아무 유형으로나 교재를 낼 수 있는가".**
//
// ── 왜 이 패널이 생겼나 (실측 2026-09-15) ───────────────────────────
// 바로 아래 「제작 단계」 패널은 밴드마다 **60문항 한 권**을 재고 전 밴드 초록을 띄운다
// (스냅샷 실측: 7밴드 전부 renderable 60/60 · explained 60/60). 그 판정은 맞다 —
// 다만 **"한 권을 낼 수 있는가"** 에만 맞다.
//
// 같은 날 재고를 유형별로 세면 다른 세상이 나온다. V7(고3/수능)은 총 229,608문항인데
// 이해·추론형은 long_reference **4** · mood **8** · claim 13 · blank **71** 이다.
// 재고가 기계 변환형(blank_word 92,956 · grammar_fix 56,565)에 몰려 있고, 시장이 교재를
// 고르는 기준인 이해형은 두 자리다. 그래서 V2·V7 은 **서로 겹치지 않는 권을 딱 하나**밖에
// 못 낸다.
//
// 「제작 단계」는 한 권만 보므로 이것을 **구조적으로** 못 본다 — 한 권이 초록이면
// 두 권째가 불가능해도 초록이다. 이 패널이 그 사각을 채운다. 그래서 위에 둔다.
//
// ⚠️ **색만으로 가르지 않는다**(색맹 대응) — 칸마다 수와 `title` 이 함께 붙는다.
// ⚠️ **"못 쟀다" 를 "0" 으로 그리지 않는다** — 옆 패널과 같은 규칙이다.

import { AlertTriangle, BookOpen, Layers } from 'lucide-react'

import { SERIES_TYPE_LABEL_KO } from '@vocaflow/library-pipeline/textbook-series'

import type { FreedomView } from '@/lib/textbook/freedom-view'

/** 그 수가 목표에 얼마나 못 미치는가를 색+굵기로. 값은 늘 글자로도 적는다. */
function tone(ok: boolean | null): { fg: string; mark: string } {
  if (ok === null) return { fg: 'var(--t3)', mark: '—' }
  return ok ? { fg: '#2E7D5A', mark: '됨' } : { fg: '#9C3A30', mark: '아직' }
}

// 이름표 정본은 패키지 하나다 — 여기서 새로 지으면 리포트·청크와 다른 유형을 말하게 된다.
const labelOf = (type: string): string =>
  (SERIES_TYPE_LABEL_KO as Record<string, string>)[type] ?? type

export function FreedomPanel({ view }: { view: FreedomView }) {
  const i = view.index
  const soloPct = i.soloMeasured ? Math.round((100 * i.soloOk) / i.soloMeasured) : null

  return (
    <section
      aria-label="교재 자유도"
      className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">
          자유도 — 아무 유형으로나 낼 수 있는가
        </h3>
        {/* 집계표 갱신 시각 — 공정 ⑤·⑥과 같은 표다. 날짜만 적으면 30분 주기가 안 보이므로 시각까지. */}
        <p className="break-keep font-body text-[11.5px] text-[var(--t3)]">
          {view.measuredAt
            ? `재고 집계 ${new Date(view.measuredAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}`
            : '재고 집계 시각 모름'}
        </p>
      </header>

      {/* 재고를 못 읽었으면 아래 수는 전부 빈손이다 — 0 권처럼 읽히지 않게 이유를 먼저 적는다. */}
      {view.loadError ? (
        <p
          role="alert"
          className="flex items-start gap-1.5 rounded-[var(--r-sm)] border border-[#B5803A] bg-[#B5803A]/8 p-2 font-body text-[12px] text-[#B5803A]"
        >
          <AlertTriangle size={13} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
          <span className="break-keep">{view.loadError}</span>
        </p>
      ) : null}

      {/* 스냅샷과 우리 계산이 갈리면 그 사실이 가장 먼저 떠야 한다 — 조용히 다른 수를
          말하는 것이 최악이다. 정상이면 이 줄은 아예 없다. */}
      {view.drift.length > 0 ? (
        <p
          role="alert"
          className="flex items-start gap-1.5 rounded-[var(--r-sm)] border border-[#9C3A30] bg-[#9C3A30]/8 p-2 font-body text-[12px] text-[#9C3A30]"
        >
          <AlertTriangle size={13} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
          <span className="break-keep">
            권 수 계산 두 벌이 갈린다 —{' '}
            {view.drift.map((d) => `V${d.vLevel} 배합식 ${d.snapshot} vs 패키지 ${d.ours ?? '못 잼'}`).join(' · ')}
            . 둘 중 하나가 틀렸다.
          </span>
        </p>
      ) : null}

      {/* 두 수를 맨 위에 — 이 화면이 답하는 질문이 둘이기 때문이다. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex items-start gap-2 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
          <Layers size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#8B5CF6]" aria-hidden />
          <div className="min-w-0">
            <p className="font-display text-[18px] font-[800] leading-none text-[var(--t1)]">
              {i.soloOk}
              <span className="text-[13px] font-[600] text-[var(--t3)]">/{i.soloMeasured}</span>
              {soloPct !== null ? (
                <span className="ml-1.5 text-[12px] font-[600] text-[var(--t3)]">{soloPct}%</span>
              ) : null}
            </p>
            <p className="mt-1 break-keep font-body text-[11.5px] leading-snug text-[var(--t2)]">
              단일유형 {view.soloSize}문항 특강을 낼 수 있는 칸 — 이해·추론형 11종 ×{' '}
              {i.bands.length}밴드
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
          <BookOpen size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#8B5CF6]" aria-hidden />
          <div className="min-w-0">
            <p className="font-display text-[18px] font-[800] leading-none text-[var(--t1)]">
              {i.mixVolumes}
              <span className="ml-1 text-[13px] font-[600] text-[var(--t3)]">권</span>
            </p>
            <p className="mt-1 break-keep font-body text-[11.5px] leading-snug text-[var(--t2)]">
              배합을 지켜 <strong className="font-[700] text-[var(--t1)]">겹치지 않게</strong> 낼 수
              있는 권의 합
              {i.narrowest ? (
                <>
                  {' '}— 가장 좁은 곳은 <strong className="font-[700] text-[#9C3A30]">V{i.narrowest.vLevel}</strong>{' '}
                  {i.narrowest.mix.volumes}권
                </>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      {/* 밴드별 — 개수만 세면 무엇을 만들지 알 수 없으므로 **묶는 유형과 결핍**을 함께 적는다. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse font-body text-[12px]">
          <caption className="sr-only">밴드별 교재 자유도</caption>
          <thead>
            <tr className="border-b border-[var(--bd)] text-left text-[11px] text-[var(--t3)]">
              <th scope="col" className="py-1.5 pr-2 font-[600]">밴드</th>
              <th scope="col" className="py-1.5 pr-2 font-[600]">특강 가능</th>
              <th scope="col" className="py-1.5 pr-2 font-[600]">겹치지 않는 권</th>
              <th scope="col" className="py-1.5 pr-2 font-[600]">여기서 멈춘다</th>
              <th scope="col" className="py-1.5 font-[600]">가장 모자란 유형</th>
            </tr>
          </thead>
          <tbody>
            {i.bands.map((b) => {
              const t = tone(b.solo.ok > 0 ? true : false)
              return (
                <tr key={b.vLevel} className="border-b border-[var(--bd)] last:border-0">
                  <th scope="row" className="py-1.5 pr-2 text-left font-display font-[700] text-[var(--t1)]">
                    V{b.vLevel}
                  </th>
                  <td className="py-1.5 pr-2 tabular-nums" style={{ color: t.fg }}>
                    {b.solo.ok}/{b.solo.measured}
                    {b.solo.unmeasured ? (
                      <span className="ml-1 text-[var(--t3)]" title="못 잰 칸">
                        (못 잼 {b.solo.unmeasured})
                      </span>
                    ) : null}
                  </td>
                  <td
                    className="py-1.5 pr-2 tabular-nums font-[700]"
                    style={{ color: (b.mix.volumes ?? 99) <= 1 ? '#9C3A30' : 'var(--t1)' }}
                    title={b.mix.volumes === null ? '못 잼' : `${b.mix.volumes}권`}
                  >
                    {b.mix.volumes === null ? '— 못 잼' : `${b.mix.volumes}권`}
                  </td>
                  <td className="py-1.5 pr-2 text-[var(--t2)]">
                    {b.mix.binding ? labelOf(b.mix.binding) : '—'}
                  </td>
                  <td className="py-1.5 text-[var(--t3)]">
                    {b.solo.gaps.slice(0, 3).map((g) => (
                      <span key={g.type} className="mr-1.5 whitespace-nowrap">
                        {labelOf(g.type)}
                        <span className="tabular-nums"> {g.items}</span>
                      </span>
                    ))}
                    {b.solo.gaps.length === 0 ? '없음' : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 범위 밖 밴드를 말하지 않으면 분모가 왜 6 인지 알 수 없다. */}
      {view.outOfScope.length > 0 ? (
        <p className="break-keep font-body text-[11.5px] leading-snug text-[var(--t3)]">
          V{view.outOfScope.join(' · V')} 는 분모에서 뺐다 — 배합에 수능 이해형이 없다(초등은
          그것을 내지 않는 것이 설계다). 넣어 세면 「초1용 빈칸추론이 없다」가 할 일로 올라온다.
        </p>
      ) : null}
    </section>
  )
}
