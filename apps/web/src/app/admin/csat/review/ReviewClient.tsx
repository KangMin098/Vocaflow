// apps/web/src/app/admin/csat/review/ReviewClient.tsx
//
// **⑦ 검수 — 다층 · 다각도.**
//
// 시중 교재는 한 원고가 **초교 · 재교 · 삼교**를 지나고 그 위에 감수위원이 붙는다. 같은 사람이
// 세 번 읽는 것이 아니라 **보는 것이 다른 눈이 여러 번** 지나가는 것이 요점이다 — 오탈자를 보는
// 눈은 논리 오류를 못 보고, 논리를 보는 눈은 정답 쏠림을 못 본다.
//
// 그래서 이 화면은 통과율 하나를 안 보여 준다. **층마다 무엇을 보는지**를 함께 적고, 층이 겹치지
// 않는다는 것을 관리자가 눈으로 확인하게 한다. 한 층만 통과한 것은 통과가 아니다.
//
// ⚠️ 옛 조판 기록에는 검수 항목이 **없다**. null 을 0 으로 채우면 "지적 0건" 이라는 거짓말이 되고,
//   화면은 검수가 돌았다고 믿게 된다. 그래서 「기록 없음」과 「지적 0건」을 색과 글자로 가른다.

'use client'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import type { ReviewView } from '@/lib/csat/factory-line-model'

import { ReviewStack } from './ReviewStack'


export function ReviewClient({ layers, volumes, loadError }: ReviewView) {
  const measured = layers.filter((l) => l.passed != null && l.total != null)
  const clean = measured.filter((l) => l.total! > 0 && l.passed! >= l.total!)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">⑦ 검수 — 다층 · 다각도</h2>
          <p className="font-body text-[12px] text-[var(--t2)]">시중: 초교 · 재교 · 삼교 + 감수</p>
        </div>
        <AdminScreenHelp screen="csat-review" />
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
        <p className="font-body text-[12px] text-[var(--t3)]">통과한 층</p>
        <p className="mt-1 font-display text-[18px] font-[800] text-[var(--t1)]">
          {clean.length} / {layers.length}
          <span className="ml-2 font-body text-[13px] font-[400] text-[var(--t2)]">
            {measured.length < layers.length
              ? `· ${layers.length - measured.length}개 층은 아직 안 쟀다`
              : ''}
          </span>
        </p>
        <p className="mt-1.5 break-keep font-body text-[12px] text-[var(--t3)]">
          층마다 <strong>보는 것이 다르다</strong> — 오탈자를 보는 눈은 논리 오류를 못 보고, 논리를 보는
          눈은 정답 쏠림을 못 본다. 한 층만 통과한 원고는 검수를 받은 것이 아니다.
        </p>
      </section>

      <ReviewStack layers={layers} />

      <section className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <h3 className="mb-1 font-display text-[13px] font-[700] text-[var(--t1)]">
          조판된 권별 검수 기록 {volumes.length}권
        </h3>
        <p className="mb-3 break-keep font-body text-[11.5px] text-[var(--t3)]">
          「기록 없음」과 「지적 0건」은 다르다 — 앞은 <strong>검사가 안 돌았다</strong>는 뜻이고 뒤는
          돌았는데 깨끗했다는 뜻이다. 옛 조판물에는 이 항목이 아예 없어서 회색으로 남는다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-[var(--bd)] text-[11px] text-[var(--t3)]">
                <th className="py-2 pr-3 font-[500]">권</th>
                <th className="py-2 pr-3 font-[500]">문항</th>
                <th className="py-2 pr-3 font-[500]">자동 검사</th>
                <th className="py-2 pr-3 font-[500]">정답 쏠림 (χ² · V)</th>
                <th className="py-2 pr-3 font-[500]">교정</th>
                <th className="py-2 font-[500]">지문 규격</th>
              </tr>
            </thead>
            <tbody>
              {volumes.map((v) => (
                <tr key={v.band} className="border-b border-[var(--bd)] last:border-0">
                  <td className="py-2 pr-3 text-[var(--t1)]">
                    <span className="font-mono text-[10px] text-[var(--t3)]">V{v.band}</span>{' '}
                    {v.volumeTitle ?? '—'}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-[var(--t2)]">{v.items}</td>
                  <td className="py-2 pr-3 font-mono tabular-nums">
                    <span style={{ color: v.autoPassed >= v.autoTotal ? '#2E7D5A' : '#B5803A' }}>
                      {v.autoPassed}/{v.autoTotal}
                    </span>
                    {v.failedChecks.length ? (
                      <span className="ml-1 break-keep text-[10.5px] text-[#B5803A]">
                        {v.failedChecks.join(' · ')}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums">
                    {v.answerBias == null ? (
                      <span className="text-[#8A8278]">기록 없음</span>
                    ) : (
                      <span style={{ color: v.answerBias.biased ? '#9C3A30' : '#2E7D5A' }}>
                        {v.answerBias.chi2.toFixed(1)} · {v.answerBias.cramersV.toFixed(3)}
                        {v.answerBias.biased ? ' 편향' : ' 균등'}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums">
                    {v.proofread == null ? (
                      <span className="text-[#8A8278]">기록 없음</span>
                    ) : (
                      <span style={{ color: v.proofread.defective ? '#B5803A' : '#2E7D5A' }}>
                        {v.proofread.defective}/{v.proofread.passages}
                      </span>
                    )}
                  </td>
                  <td className="break-keep py-2 text-[var(--t3)]">{v.passageSpec ?? '기록 없음'}</td>
                </tr>
              ))}
              {!volumes.length ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-[var(--t3)]">
                    조판된 권이 없다 — 검수할 원고가 아직 없다는 뜻이다
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
