// apps/web/src/components/library/textbooks/LevelChart.tsx
//
// **교재 레벨 차트** — "우리 애가 몇 단계인가" 에 답하는 자리.
//
// ── 왜 이 화면이 생겼나 ────────────────────────────────────────────
// 상업 교재 카탈로그가 빠짐없이 내는 것이 레벨 차트다(NE_Books '교재 레벨 차트' 관측 2026-08-30).
// 교재를 고르는 첫 질문이 학년-단계 대응이기 때문이다. 우리 매대에는 그게 없었다 —
// 실측한 매대 지수에서 C5 축이 **0/1** 이었다(`scripts/textbook/catalog-benchmark.mjs`).
//
// ── 저쪽 차트와 다른 점 ────────────────────────────────────────────
// 상업 사이트의 레벨 차트는 **그림 한 장**이다 — 출판사가 자기 시리즈를 자기 기준으로
// 배치한 것이라 학습자가 검증할 방법이 없다. 여기 것은 **시중 교재 79종 5,214쪽에서 잰
// 지문 어수 분포** 위에 우리 계단을 얹는다. 근거를 차트 밑에 그대로 적는다.
//
// ⚠️ 막대를 **색으로만** 가르지 않는다 — 숫자(p10~p90·중앙값)를 함께 인쇄한다.
// ⚠️ 지문을 쓰지 않는 계단(초등 소리·낱말)은 막대를 그리지 않고 **왜 없는지 적는다.**
//    0 폭 막대는 "지문이 0어" 라는 거짓이다.

import type { LevelChart as LevelChartData } from '@vocaflow/library-pipeline'

export function LevelChart({ chart }: { chart: LevelChartData }) {
  const { rows, scale, provenance } = chart
  const pct = (n: number) => `${((n / scale.max) * 100).toFixed(1)}%`

  return (
    <section
      aria-labelledby="level-chart-title"
      className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3
          id="level-chart-title"
          className="font-editorial text-[17px] font-[500] leading-none text-[var(--t1)]"
        >
          교재 레벨 차트
        </h3>
        <p className="min-w-0 flex-1 font-body text-[11.5px] leading-[1.6] text-[var(--t2)] [word-break:keep-all]">
          막대는 <strong className="font-display text-[var(--t1)]">시중 교재의 지문 길이</strong>입니다 —
          같은 학년대 교재가 실제로 몇 낱말짜리 글을 싣는지. 우리 계단을 그 위에 얹었어요.
        </p>
      </div>

      {/* ⚠️ 표로 낸다 — 막대만 그리면 스크린리더에 아무것도 안 남는다.
          시각적으로는 막대, 프로그램적으로는 행과 열이다. */}
      <table className="w-full border-collapse">
        <caption className="sr-only">
          계단별 대상 학년과 시중 교재 지문 어수 분포 (하위 10% · 중앙값 · 상위 10%)
        </caption>
        <thead>
          <tr className="border-b border-[var(--bd)]">
            <th scope="col" className="pb-1.5 text-left font-mono text-[9.5px] font-[700] uppercase tracking-[0.12em] text-[var(--t2)]">
              계단
            </th>
            <th scope="col" className="pb-1.5 text-left font-mono text-[9.5px] font-[700] uppercase tracking-[0.12em] text-[var(--t2)]">
              대상
            </th>
            <th scope="col" className="pb-1.5 text-left font-mono text-[9.5px] font-[700] uppercase tracking-[0.12em] text-[var(--t2)]">
              지문 어수 (시중 교재 실측)
            </th>
            <th scope="col" className="pb-1.5 text-right font-mono text-[9.5px] font-[700] uppercase tracking-[0.12em] text-[var(--t2)]">
              문항
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.step} className="border-b border-[var(--bd)] last:border-0">
              <th scope="row" className="py-2 pr-3 text-left align-middle">
                <span className="font-mono text-[11px] font-[700] tabular-nums text-[var(--t1)]">
                  {r.step}
                </span>
                <span className="ml-1.5 font-mono text-[10px] tabular-nums text-[var(--t2)]">
                  V{r.vLevels.join('·V')}
                </span>
              </th>
              <td className="py-2 pr-3 align-middle font-display text-[11.5px] font-[700] text-[var(--t2)] [word-break:keep-all]">
                {r.schoolBand}
              </td>
              <td className="py-2 pr-3 align-middle">
                {r.words ? (
                  <div className="flex items-center gap-2">
                    {/* 막대 = p10~p90 구간, 눈금 = 중앙값 */}
                    <div className="relative h-[10px] min-w-[90px] flex-1 rounded-[var(--r-full)] bg-[var(--bg3)]">
                      <div
                        className="absolute top-0 h-full rounded-[var(--r-full)]"
                        style={{
                          left: pct(r.words.p10),
                          width: pct(r.words.p90 - r.words.p10),
                          background: r.ready ? 'var(--p)' : 'var(--bd)',
                        }}
                      />
                      <div
                        className="absolute top-[-2px] h-[14px] w-[2px] bg-[var(--t1)]"
                        style={{ left: pct(r.words.median) }}
                      />
                    </div>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--t2)]">
                      {r.words.p10}–{r.words.p90}
                      <span className="ml-1 text-[var(--t1)]">중앙 {r.words.median}</span>
                    </span>
                  </div>
                ) : (
                  // 지문을 안 쓰는 계단 — 왜 비었는지 적는다. 빈칸으로 두면 '없는 교재' 로 읽힌다.
                  <span className="font-body text-[11px] text-[var(--t2)] [word-break:keep-all]">
                    지문 없이 소리·낱말 단위로 배우는 계단이에요
                  </span>
                )}
              </td>
              <td className="py-2 text-right align-middle font-mono text-[11px] tabular-nums text-[var(--t2)]">
                {r.itemCount.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 근거를 차트에 붙여 둔다 — 출처 없는 레벨 차트는 그림이다. */}
      <p className="font-body text-[11px] leading-[1.6] text-[var(--t2)] [word-break:keep-all]">
        기준: 시중 영어 교재{' '}
        <strong className="font-mono tabular-nums text-[var(--t1)]">
          {provenance.documentsMeasured}종 · {provenance.pagesMeasured.toLocaleString()}쪽
        </strong>{' '}
        실측 ({provenance.generatedAt.slice(0, 10)}).
        {rows.some((r) => r.borrowedFrom) && ' 표본이 얇은 학년대는 이웃 학년 규격을 빌려 왔어요.'}
      </p>
    </section>
  )
}
