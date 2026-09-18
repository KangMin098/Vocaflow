// apps/web/src/app/admin/csat/sources/SourceInventoryTable.tsx
'use client'
import Link from 'next/link'
import type { RefObject } from 'react'
import { ArrowUpRight, CircleAlert, X } from 'lucide-react'
import type { SourceInventoryRow } from '@/lib/textbook/source-inventory-view'
import { sourceArticlesHref, sourceClues } from '@/lib/textbook/source-workspace'
import styles from './sources.module.css'

const STATUS_LABEL: Record<string, string> = {
  ready: '검수 대기',
  published: '발행',
  failed: '실패',
  archived: '보관',
  queued: '처리 대기',
  analyzing: '분석 중',
  collecting: '수집 중',
}
export function SourceInventoryTable({
  rows,
  selected,
  onSelect,
}: {
  rows: SourceInventoryRow[]
  selected: string | null
  onSelect: (source: string, button: HTMLButtonElement) => void
}) {
  return (
    <table className={styles.table}>
      <caption className="sr-only">원천별 재고와 확인할 항목</caption>
      <thead>
        <tr>
          <th scope="col">원천 · 재고</th>
          <th scope="col">확인할 항목</th>
          <th scope="col" className={styles.progress}>
            분석 · 판정 기록
          </th>
          <th scope="col">
            <span className="sr-only">검토</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const clues = sourceClues(row)
          return (
            <tr key={row.source} data-source={row.source} data-selected={selected === row.source}>
              <th scope="row">
                <span>{row.label}</span>
                <small>
                  {row.source} · {row.total.toLocaleString()}편
                </small>
              </th>
              <td>
                {clues.length ? (
                  <>
                    <span className={styles.clue}>
                      <CircleAlert size={14} aria-hidden />
                      {clues[0].label} <b>{clues[0].count.toLocaleString()}</b>
                    </span>
                    {clues[1] ? (
                      <small>
                        {clues[1].label} {clues[1].count.toLocaleString()}
                        {clues.length > 2 ? ` 외 ${clues.length - 2}항목` : ''}
                      </small>
                    ) : null}
                  </>
                ) : (
                  <span>재고상 결손 없음</span>
                )}
              </td>
              <td className={styles.progress}>
                학령 {row.levelledPct}%<small>내용 판정 {row.judgedPct}%</small>
              </td>
              <td>
                <button
                  className={styles.review}
                  aria-label={`${row.label} 검토`}
                  aria-expanded={selected === row.source}
                  aria-controls={selected === row.source ? 'source-detail' : undefined}
                  onClick={(event) => onSelect(row.source, event.currentTarget)}
                >
                  검토
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function SourceDetail({
  row,
  headingRef,
  onClose,
  onCriteria,
}: {
  row: SourceInventoryRow
  headingRef: RefObject<HTMLHeadingElement>
  onClose: () => void
  onCriteria: () => void
}) {
  const clues = sourceClues(row)
  const failed = row.byStatus.find((item) => item.status === 'failed')?.count ?? 0
  return (
    <aside id="source-detail" aria-labelledby="source-detail-title" className={styles.detail}>
      <header>
        <div>
          <p className={styles.eyebrow}>선택한 원천 · {row.total.toLocaleString()}편</p>
          <h3 id="source-detail-title" ref={headingRef} tabIndex={-1}>
            {row.label}
          </h3>
        </div>
        <button className={styles.close} onClick={onClose} aria-label="원천 상세 닫기">
          <X size={18} aria-hidden />
        </button>
      </header>
      <p className={styles.detailIntro}>
        원천별 적격 통과 수는 미측정입니다. 아래 기록으로 검수 대상을 정한 뒤 원문을 확인하세요.
      </p>
      <Link className={styles.primary} href={sourceArticlesHref(row.source)}>
        원문 검수하기 <ArrowUpRight size={16} aria-hidden />
      </Link>
      <p className={styles.footnote}>이 원천의 모든 수집 상태를 포함해 엽니다.</p>
      {failed > 0 ? (
        <Link className={styles.textAction} href={sourceArticlesHref(row.source, 'failed')}>
          실패한 원문 {failed.toLocaleString()}편만 보기 <ArrowUpRight size={14} aria-hidden />
        </Link>
      ) : null}
      <section>
        <h4>먼저 확인할 것</h4>
        {clues.length ? (
          <ul className={styles.issues}>
            {clues.map((clue) => (
              <li key={clue.issue}>
                <b>
                  {clue.label} · {clue.count.toLocaleString()}편
                </b>
                <p>{clue.reason}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>집계된 결손 항목은 없습니다. 개별 원문의 적격 여부는 별도로 확인하세요.</p>
        )}
      </section>
      <section>
        <h4>원문 준비 상태</h4>
        <dl className={styles.factors}>
          <div>
            <dt>학령 분석 기록</dt>
            <dd>
              {row.levelled.toLocaleString()} / {row.total.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt>내용 판정 기록</dt>
            <dd>
              {row.judged.toLocaleString()} / {row.total.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt>마지막 등록</dt>
            <dd>{row.lastGet ? `${row.lastGet.slice(0, 10)} UTC` : '기록 없음'}</dd>
          </div>
        </dl>
        <p className={styles.footnote}>
          마지막 등록은 created_at 기준이며, 수정·검수 시각이 아닙니다.
        </p>
        <button className={styles.textAction} onClick={onCriteria}>
          교재 적격 판정 기준 보기 <ArrowUpRight size={14} aria-hidden />
        </button>
      </section>
      <details>
        <summary>수집 상태와 차단 기록</summary>
        <dl className={styles.factors}>
          {row.byStatus.map((item) => (
            <div key={item.status}>
              <dt>{STATUS_LABEL[item.status] ?? item.status}</dt>
              <dd>{item.count.toLocaleString()}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.footnote}>검수 대기(ready)는 교재 적격 통과를 뜻하지 않습니다.</p>
        {row.topBlocked.length ? (
          <>
            <h4>상위 차단 사유</h4>
            <dl className={styles.factors}>
              {row.topBlocked.map((item) => (
                <div key={item.reason}>
                  <dt>
                    <code>{item.reason}</code>
                  </dt>
                  <dd>{item.count.toLocaleString()}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}
      </details>
    </aside>
  )
}
