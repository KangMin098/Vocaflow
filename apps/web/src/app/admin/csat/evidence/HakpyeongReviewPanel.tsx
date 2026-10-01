// apps/web/src/app/admin/csat/evidence/HakpyeongReviewPanel.tsx
'use client'

// 「검수 진행」 탭 — 학평 독립 검수 모니터(읽기 전용).
// 대상 문항 → 막힌 이유 → 검수 근거 → 다음 조치. 판정 재료는 DB·CLI 값(유효 승인 = 발행 게이트 함수, 사전 검사 = CLI 기록)이고,
// 이 화면은 reviewBlock 으로 우선순위 하나를 고를 뿐이다(lib/csat/hakpyeong-review.ts).
import { useMemo, useState } from 'react'
import {
  BLOCK_STATES,
  batchTokens,
  reviewBlock,
  reviewCounts,
  type BlockState,
  type HakReviewData,
} from '@/lib/csat/hakpyeong-review'
import s from './evidence.module.css'

const nf = new Intl.NumberFormat('ko-KR')
const when = (v: string) => new Date(v).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })
const ORDER: BlockState[] = ['rejected', 'fixFirst', 'precheckStale', 'waiting', 'noAnalysis', 'chart', 'published']
const VERDICT = { pass: '통과', revise: '반려(수정)', fail: '반려(실패)' } as const
const KIND = { blind: '블라인드', rereview: '재검수' } as const
const PAGE = 60

export function HakpyeongReviewPanel({ data }: { data: HakReviewData | null | undefined }) {
  const [only, setOnly] = useState<BlockState | 'all'>('all')
  const [limit, setLimit] = useState(PAGE)
  const rows = useMemo(
    () =>
      (data?.items ?? [])
        .map((it) => ({ it, block: reviewBlock(it) }))
        .sort((a, b) => ORDER.indexOf(a.block.state) - ORDER.indexOf(b.block.state) || a.it.itemId.localeCompare(b.it.itemId)),
    [data],
  )
  if (!data) {
    return (
      <div role="alert" className={s.alert}>
        <strong>검수 진행을 읽지 못했습니다</strong>
        <p>문항 데이터를 먼저 읽지 못해 검수 상태를 판정하지 않았습니다. 지금 재검증으로 다시 확인하세요.</p>
      </div>
    )
  }
  if (data.error) {
    // 읽기 실패 — 경고만 보인다. 아래 숫자·「없습니다」를 그리면 실패가 0건처럼 읽힌다(브라우저 확인에서 발견)
    return (
      <div role="alert" className={s.alert} data-testid="hakpyeong-review">
        <strong>판정 보류 · 검수 기록을 확인하지 못했습니다</strong>
        <p>{data.error}</p>
        <p className={s.muted}>조회 실패를 「검수 대기」나 0건으로 처리하지 않습니다. 지금 재검증으로 다시 확인하세요.</p>
      </div>
    )
  }
  const counts = reviewCounts(data.items)
  const shown = rows.filter((r) => only === 'all' || r.block.state === only)
  const open = data.followups.filter((f) => f.status === 'open' || f.status === 'in_correction')

  return (
    <div data-testid="hakpyeong-review">
      <section className={s.section} aria-labelledby="review-counts">
        <h3 id="review-counts" className="text-xl font-semibold">검수 진행 · {nf.format(data.items.length)}문항</h3>
        <p className={s.muted}>
          유효 승인은 발행 게이트와 같은 DB 함수로 셉니다(과거 pass 개수가 아닙니다). 막힌 이유는 우선순위가 가장 높은 하나만 보입니다.
        </p>
        <div className={s.chips} role="group" aria-label="막힌 이유로 거르기">
          <button type="button" className="min-h-[44px]" aria-pressed={only === 'all'} onClick={() => { setOnly('all'); setLimit(PAGE) }}>
            전체 {nf.format(data.items.length)}
          </button>
          {ORDER.map((k) => (
            <button type="button" className="min-h-[44px]" key={k} aria-pressed={only === k} onClick={() => { setOnly(k); setLimit(PAGE) }} data-state={k}>
              {BLOCK_STATES[k]} {nf.format(counts[k])}
            </button>
          ))}
        </div>
      </section>

      <section className={s.section} aria-labelledby="review-items">
        <h3 id="review-items" className="sr-only">문항별 막힌 이유</h3>
        {shown.length ? (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">문항</th>
                  <th scope="col">분석</th>
                  <th scope="col">유효 승인</th>
                  <th scope="col">막힌 이유 · 검수 근거 · 다음 조치</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, limit).map(({ it, block }) => (
                  <tr key={it.itemId} data-item={it.itemId} data-state={block.state}>
                    <td className={s.code}>{it.itemId}<br /><span className={s.muted}>{it.typeId}</span></td>
                    <td>{it.version ? `v${it.version}` : '없음'}{it.unitsBased ? <><br /><span className={s.muted}>근거 단위</span></> : null}</td>
                    <td>{it.analysisId ? `${it.validPersonas.length}/3` : '—'}</td>
                    <td>
                      <span className={`${s.badge} ${block.state === 'published' ? s.good : block.state === 'waiting' ? s.warn : s.bad}`}>
                        {BLOCK_STATES[block.state]}
                      </span>{' '}
                      <span className="break-keep">{block.reason}</span>
                      <details>
                        <summary>검수 근거 · 다음 조치</summary>
                        {it.verdicts.length ? (
                          <ul className="mt-2 space-y-1 text-sm">
                            {it.verdicts.map((v, i) => (
                              <li key={i}>
                                <strong>{v.persona}</strong> · {KIND[v.kind]} · {VERDICT[v.verdict]}
                                {v.counted ? ' · 이 페르소나 유효 승인 있음' : ' · 이 페르소나 유효 승인 없음'} · {when(v.reviewedAt)} KST
                                {v.findings.length ? <div className={s.muted}>{v.findings.slice(0, 3).join(' / ')}</div> : null}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className={s.muted}>현재 분석 버전에 대한 독립 검수 기록이 없습니다.</p>
                        )}
                        <p className="mt-2 text-sm">
                          사전 검사:{' '}
                          {it.precheck
                            ? `${it.precheck.errors.length ? `실패 ${it.precheck.errors.length}건` : '통과'} · ${when(it.precheck.checkedAt)} KST · 검사기 v${it.precheck.precheckVersion}${it.precheck.commit ? ` (${it.precheck.commit})` : ''}${it.precheck.current ? '' : ' · 오래된 결과(분석이나 근거 단위가 그 뒤 바뀜)'}`
                            : '기록 없음'}
                        </p>
                        {it.precheck?.errors.length ? (
                          <ul className={`${s.muted} text-sm`}>{it.precheck.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                        ) : null}
                        <p className={`${s.code} mt-2`}>{block.next}</p>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length > limit ? (
              <button type="button" className={`${s.button} mt-3 min-h-[44px]`} onClick={() => setLimit((n) => n + PAGE)}>
                {nf.format(shown.length - limit)}문항 더 보기
              </button>
            ) : null}
          </div>
        ) : (
          <div className={s.empty}>이 조건에 해당하는 문항이 없습니다.</div>
        )}
      </section>

      <section className={s.section} aria-labelledby="review-batches">
        <h3 id="review-batches" className="text-lg font-semibold">배치 비용</h3>
        <p className={s.muted}>토큰을 기록하지 않은 배치는 「미기록」입니다(0이 아닙니다). 학년과 무관하게 전체 배치를 보여 줍니다.</p>
        {data.batches.length ? (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">배치</th><th scope="col">날짜</th><th scope="col">종류</th><th scope="col">문항</th>
                  <th scope="col">토큰(문항당)</th><th scope="col">발행 · 거부 · 재반려</th>
                </tr>
              </thead>
              <tbody>
                {data.batches.map((b) => {
                  const t = batchTokens(b)
                  return (
                    <tr key={b.batch}>
                      <td className={s.code}>{b.batch}</td>
                      <td>{b.runDate}</td>
                      <td>{b.kind}{b.chunkSize ? ` · ${b.chunkSize}문항 청크` : ''}</td>
                      <td>{nf.format(b.items)}</td>
                      <td>{t === null ? '미기록' : `${nf.format(t)} (${nf.format(Math.round(t / Math.max(1, b.items)))})`}</td>
                      <td>{[b.published, b.refused, b.reRejected].map((v) => (v === null ? '—' : nf.format(v))).join(' · ')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={s.empty}>기록된 배치가 없습니다.</div>
        )}
      </section>

      <section className={s.section} aria-labelledby="review-followups">
        <h3 id="review-followups" className="text-lg font-semibold">추적 목록 · 열린 것 {nf.format(open.length)}</h3>
        {data.followups.length ? (
          <ul className="space-y-2 text-sm">
            {[...open, ...data.followups.filter((f) => !open.includes(f))].map((f, i) => (
              <li key={i}>
                <span className={`${s.badge} ${f.status === 'open' ? s.warn : f.status === 'in_correction' ? s.warn : s.good}`}>{f.status}</span>{' '}
                <span className={s.code}>{f.itemId}</span> · {f.severity} · <span className="break-keep">{f.finding}</span>{' '}
                <span className={s.muted}>({f.source} · {f.notedOn})</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className={s.empty}>추적 항목이 없습니다.</div>
        )}
      </section>
    </div>
  )
}
