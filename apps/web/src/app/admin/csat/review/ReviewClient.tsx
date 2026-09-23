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
//
// ── 무엇이 바뀌었나 (2026-09-23 · DD-74) ────────────────────────────
// 여기까지 이 화면이 읽는 것은 **조판 시각에 얼린 요약**뿐이었다(`colophon.review`).
// 그래서 실제 판정 963행(pass 303 · revise 501 · fail 159)과 **미해소 결함 292문항**이
// 어느 화면에도 없었다 — 조판기만 그것을 알고 말없이 문항을 건너뛰었고, 관리자는 권이
// 왜 안 차는지 모른 채 집필을 더 돌렸다(고칠 것이 아니라 만들 것을 늘린다).
// 이제 `csat_item_reviews` 를 **직접** 읽어 ③ 상태 매트릭스와 ⑤ 실패 목록을 낸다.

'use client'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import {
  StageFailures,
  StageFrame,
  type FailureRow,
  type StageBlock,
} from '@/components/admin/csat/StageFrame'
import { FACTORY_STAGES, judgeStage, type StageStatus } from '@/lib/csat/factory-model'
import type { ReviewView } from '@/lib/csat/factory-line-model'
import {
  PERSONA_KO,
  UNREAD_REVIEW_DEFECTS,
  VERDICT_KO,
  type ReviewDefectView,
} from '@/lib/csat/review-defects-model'

import { ReviewStack } from './ReviewStack'

const STAGE = FACTORY_STAGES.find((s) => s.id === 'review')!

/** 층 판정에서 단계 상태를 접는다 — 현황판과 같은 규칙(가장 나쁜 것이 이긴다). */
function statusOf(layers: ReviewView['layers']): StageStatus {
  return judgeStage(
    layers.map((l) => ({
      label: l.id,
      num: l.passed,
      den: l.total,
      unit: 'ratio' as const,
      unmeasuredReason: l.unmeasuredReason ?? undefined,
    })),
  )
}

export function ReviewClient({
  layers,
  volumes,
  loadError,
  // ⚠️ 기본값이 **「못 읽음」**이다 — 빈 결과(0건)가 아니다. 배선을 빠뜨린 호출부가
  //    「막힌 문항 0」이라는 거짓 안심을 그리지 않게 한다.
  defects = UNREAD_REVIEW_DEFECTS,
}: ReviewView & { defects?: ReviewDefectView }) {
  const measured = layers.filter((l) => l.passed != null && l.total != null)
  const clean = measured.filter((l) => l.total! > 0 && l.passed! >= l.total!)

  // ── ② 막힌 것 ──────────────────────────────────────────────────────
  // 「덜 봤다」와 「봤는데 막혔다」를 가른다 — 할 일이 정반대다(전자는 검수를 돌리고,
  // 후자는 문항을 고친다). 이 화면이 그 둘을 섞던 것이 B4 0점의 실체였다.
  const blocks: StageBlock[] = [
    {
      what: '3인 판정에서 막힌 문항 (revise · fail 미해소)',
      count: defects.available ? defects.itemsBlocked : null,
      unmeasuredReason: defects.loadError ?? '검수 기록을 못 읽었다',
    },
    {
      what: '아직 안 잰 층',
      count: layers.length - measured.length,
    },
    {
      what: '검수 기록이 아예 없는 조판 권',
      count: volumes.filter((v) => v.personaReview == null).length,
    },
  ]

  const failureRows: FailureRow[] = defects.rows.map((d) => ({
    id: `${d.itemId}:${d.persona}`,
    label: d.itemId.slice(0, 8),
    tags: [
      VERDICT_KO[d.verdict] ?? d.verdict,
      PERSONA_KO[d.persona] ?? d.persona,
      d.type ?? '유형 못 찾음',
      d.vLevel != null ? `V${d.vLevel}` : 'V 못 찾음',
    ],
    says: d.says,
  }))

  return (
    <StageFrame
      stage={STAGE}
      status={statusOf(layers)}
      help={<AdminScreenHelp screen="csat-review" />}
      blocks={blocks}
      // ⚠️ `why` 에 `looksAt` 을 다시 적지 않는다 — 층 도식이 이미 그것을 말한다.
      //    같은 문장을 두 곳에 두면 한쪽만 고쳐져 갈린다(명령을 한자리로 모은 것과 같은 이유).
      commands={layers.map((l) => ({
        cmd: l.cmd,
        why: `${l.id} ${l.name} 층을 돌린다`,
        writes: l.cmd.includes('--commit'),
        claudeCode: l.id === 'L2',
      }))}
      approvalNote={
        '문항을 고쳤으면 그 문항의 검수 행을 지우고 다시 받아야 한다 — 안 지우면 옛 문항에 대한 판정이 새 문항을 계속 막는다. 삭제는 되돌릴 수 없다.'
      }
      failures={
        <StageFailures
          title="막힌 문항 — 개별 판정"
          total={defects.available ? (defects.byVerdict.revise ?? 0) + (defects.byVerdict.fail ?? 0) : null}
          rows={failureRows}
          emptyNote={
            defects.available
              ? '미해소 판정이 없다 — 검수된 문항은 전부 통과했거나, 아직 아무도 안 봤다(위 「막힌 것」의 미검수 수를 본다).'
              : '검수 기록을 못 읽었다 — 0건이 아니다.'
          }
        />
      }
    >
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

      {/* ③ 상태 매트릭스 — 밴드 × 판정. **검수 표를 직접 세서** 조판 시각에 얼린 값과
          갈라져 있던 것을 여기서 드러낸다. */}
      <section
        aria-label="밴드별 판정"
        className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
      >
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-[13px] font-[700] text-[var(--t1)]">밴드 × 판정</h3>
          <span className="font-mono text-[11.5px] tabular-nums text-[var(--t2)]">
            {defects.available ? (
              <>
                문항 {defects.itemsReviewed?.toLocaleString()} · 3인 전원 통과{' '}
                {defects.itemsAllPass?.toLocaleString()}
              </>
            ) : (
              <span className="text-[#8A8278]">못 잼</span>
            )}
          </span>
        </div>
        <p className="mb-3 break-keep font-body text-[11.5px] text-[var(--t3)]">
          위 권별 표는 <strong>조판 시각에 얼린 값</strong>이고, 이 표는 <strong>지금 검수 표</strong>다.
          둘이 갈라져 있으면 조판 뒤에 들어온 판정이 있다는 뜻이다 — 다시 찍어야 한다.
        </p>
        {!defects.available ? (
          <p className="font-body text-[12px] text-[#8A8278]">
            {defects.loadError ?? '검수 기록을 못 읽었다'} — 0건이 아니다.
          </p>
        ) : defects.matrix.length === 0 ? (
          <p className="font-body text-[12px] text-[var(--t3)]">판정이 아직 하나도 없다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-[var(--bd)] text-[11px] text-[var(--t3)]">
                  <th className="py-2 pr-3 font-[500]">밴드</th>
                  <th className="py-2 pr-3 font-[500]">문항</th>
                  <th className="py-2 pr-3 font-[500]">통과</th>
                  <th className="py-2 pr-3 font-[500]">수정</th>
                  <th className="py-2 font-[500]">반려</th>
                </tr>
              </thead>
              <tbody>
                {defects.matrix.map((m) => (
                  <tr key={String(m.vLevel)} className="border-b border-[var(--bd)] last:border-0">
                    <td className="py-2 pr-3 font-mono text-[var(--t1)]">
                      {m.vLevel == null ? (
                        // 문항을 못 찾은 판정 — 「없다」가 아니라 「못 찾았다」.
                        <span className="text-[#8A8278]">못 찾음</span>
                      ) : (
                        `V${m.vLevel}`
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono tabular-nums text-[var(--t2)]">{m.items}</td>
                    <td className="py-2 pr-3 font-mono tabular-nums" style={{ color: '#2E7D5A' }}>
                      {m.pass}
                    </td>
                    <td className="py-2 pr-3 font-mono tabular-nums" style={{ color: '#B5803A' }}>
                      {m.revise}
                    </td>
                    <td className="py-2 font-mono tabular-nums" style={{ color: '#9C3A30' }}>
                      {m.fail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 2차: 조판 시각에 얼린 값 ───────────────────────────────────
          위의 「밴드 × 판정」이 **지금** 값이고 이 표는 **찍을 때** 값이다. 둘을 나란히
          펼쳐 두면 어느 쪽이 현재인지 안 읽히므로, 지금 값을 펴고 얼린 값을 접는다
          (접힌 것은 밀집도에서 안 센다 — ④ 소재가 같은 판단을 먼저 했다). */}
      <details className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center break-keep font-display text-[13px] font-[700] text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]">
          조판 시각에 얼린 권별 기록 {volumes.length}권 ▾
        </summary>
        <p className="mb-3 mt-2 break-keep font-body text-[11.5px] text-[var(--t3)]">
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
                <th className="py-2 pr-3 font-[500]">3인 검수</th>
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
                  {/* 3인 검수 — **조판기가 잰 값을 그대로 읽는다.** 여기서 다시 세면 분모가
                      달라진다(어느 문항이 그 권에 실렸는지는 조판기만 안다).
                      「덜 봤다」와 「봤는데 막혔다」를 가른다 — 할 일이 정반대다. */}
                  <td className="py-2 pr-3 font-mono tabular-nums">
                    {v.personaReview == null ? (
                      <span className="text-[#8A8278]">기록 없음</span>
                    ) : (
                      <>
                        <span
                          style={{
                            color:
                              v.personaReview.passed >= v.personaReview.items ? '#2E7D5A' : '#B5803A',
                          }}
                        >
                          {v.personaReview.passed}/{v.personaReview.items}
                        </span>
                        {v.personaReview.settled != null &&
                        v.personaReview.settled > v.personaReview.passed ? (
                          <span className="ml-1 break-keep text-[10.5px] text-[#9C3A30]">
                            {v.personaReview.settled - v.personaReview.passed}건 막힘
                          </span>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td className="break-keep py-2 text-[var(--t3)]">{v.passageSpec ?? '기록 없음'}</td>
                </tr>
              ))}
              {!volumes.length ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-[var(--t3)]">
                    조판된 권이 없다 — 검수할 원고가 아직 없다는 뜻이다
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </details>
    </StageFrame>
  )
}
