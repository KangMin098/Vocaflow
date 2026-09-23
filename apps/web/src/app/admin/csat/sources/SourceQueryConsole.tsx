// apps/web/src/app/admin/csat/sources/SourceQueryConsole.tsx
//
// 소재 적격 **조회 콘솔** — 참조(Tines 3B) 앱 화면의 판면을 관리자 화면에 옮긴 것.
// 골격 네 층은 `/csat/space` 와 같다: ① 무늬 띠 + 명령 상자 ② 개수 뱃지 탭 ③ 거르개 줄
// ④ 한 줄이 한 작업인 표. 팝업은 `components/ui/Dialog`(§28) 하나만 쓴다.
//
// ── 왜 만드는가 (2026-09-23 실측) ───────────────────────────────────────────
// 이 화면은 87,720편을 판정해 놓고도 **큐 프리셋 14개와 제목 검색**으로만 물을 수 있었다.
// 프리셋은 서로 곱해지지 않아서 「usable 인데 문항이 없는 것」·「argument 재료가 있는 B1 원문」
// 같은, 실제로 교재를 짤 때 던지는 질문이 하나도 안 됐다. API 는 `cefr` 를 이미 받고 있었는데
// 화면이 한 번도 보내지 않았다 — 기능이 없던 게 아니라 **닿는 길이 없었다.**
//
// 무늬 띠는 장식이 아니다. 원 하나가 지금 거른 결과의 한 묶음이고 지름이 그 편수다 —
// 거르개를 바꾸면 무늬가 바뀐다. 「보고 있는 것이 달라졌다」를 글자 없이 말하는 자리다.

'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Search, X } from 'lucide-react'

import { Dialog, DialogColumns, DialogSection, DialogTintPanel } from '@/components/ui/Dialog'
import { PatternBand } from '@/components/csat/space/PatternBand'
import { patternShapes } from '@/lib/csat/space-model'
import {
  SOURCE_QUEUES, SOURCE_GRADES, SOURCE_STATUSES, SOURCE_USE_TAGS, SOURCE_USE_LABELS,
  SOURCE_LIST_SORTS, SOURCE_LIST_SORT_LABELS, SOURCE_PAGE_SIZES, SOURCE_PAGE_SIZE,
  SOURCE_REASON_LABELS, sourceNextAction,
  type SourceQueue, type SourceGrade, type SourceStatus, type SourceUseTag,
  type SourceListSort, type SourcePageSize, type SourceOperationRow, type SourceInspectorData,
} from '@/lib/textbook/source-operations'
import type { DrainRunView } from '@/components/admin/csat/StageFrame'
import styles from './source-query.module.css'

const API = '/api/admin/csat/sources'
const n = (v: number) => v.toLocaleString()

async function get<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const data = await response.json()
  // ⚠️ 400 을 빈 목록으로 삼키지 않는다 — 「그 조건으로 걸러 0편」과 「조건이 틀렸다」는 정반대다.
  if (!response.ok) throw new Error(data.error ?? '조회하지 못했습니다.')
  return data as T
}

type ListReply = { rows: SourceOperationRow[]; count: number; page: number; pageSize: number }

/** 거르개 한 벌. URL 로 나가지 않는 화면 안의 상태다(탭·큐는 바깥이 쥔다). */
type Filters = {
  grade: SourceGrade | ''
  status: SourceStatus | ''
  band: string
  cefr: string
  uses: SourceUseTag[]
  sort: SourceListSort
  pageSize: SourcePageSize
  q: string
}
const EMPTY: Filters = { grade: '', status: '', band: '', cefr: '', uses: [], sort: 'items', pageSize: SOURCE_PAGE_SIZE, q: '' }

function queryString(queue: SourceQueue, f: Filters, page: number) {
  const p = new URLSearchParams({ queue, page: String(page), pageSize: String(f.pageSize), sort: f.sort })
  if (f.grade) p.set('grade', f.grade)
  if (f.status) p.set('status', f.status)
  if (f.band) p.set('band', f.band)
  if (f.cefr) p.set('cefr', f.cefr)
  if (f.uses.length) p.set('uses', f.uses.join(','))
  if (f.q.trim()) p.set('q', f.q.trim())
  return p.toString()
}

/** 걸린 거르개를 사람 말로 — 「무엇을 보고 있는가」를 표 위에 한 줄로 둔다. */
function describe(queue: SourceQueue, f: Filters): string[] {
  const out: string[] = [SOURCE_QUEUES[queue]]
  if (f.grade) out.push(`등급 ${f.grade}`)
  if (f.status) out.push(`판정 ${f.status}`)
  if (f.band) out.push(`V${f.band}`)
  if (f.cefr) out.push(f.cefr === 'unknown' ? 'CEFR 미측정' : `CEFR ${f.cefr}`)
  for (const u of f.uses) out.push(`재료 ${SOURCE_USE_LABELS[u]}`)
  if (f.q.trim()) out.push(`제목 “${f.q.trim()}”`)
  return out
}

/**
 * 마지막 드레인 실행 한 줄.
 *
 * ⚠️ 「표가 없다」와 「한 번도 안 돌렸다」를 **다르게 적는다.** 둘을 같은 문구로 쓰면
 *   마이그레이션을 안 올린 것을 「아직 안 돌렸다」로 읽고 있지도 않은 기록을 기다리게 된다.
 * 건너뜀도 마찬가지 — null 은 「안 셌다」라 아예 안 적고, 0 은 적는다(0 이 곧 경고다).
 */
const DRAIN_MODE: Record<string, string> = {
  export: '뽑기', agent: '채우기', validate: '예행', import: '적재', render: '조판',
}
const DRAIN_STATE: Record<string, string> = {
  running: '도는 중', ok: '끝남', failed: '실패',
}

function LastDrain({ view }: { view: DrainRunView }) {
  if (!view.available)
    return <p className={styles.drain}>실행 기록 표가 아직 없습니다 — 마이그레이션 적용 전입니다.</p>
  if (!view.run)
    return <p className={styles.drain}>이 단계의 드레인을 아직 한 번도 돌리지 않았습니다.</p>
  const { mode, status, startedAt, itemsDone, itemsTotal, itemsSkipped, error } = view.run
  return (
    <p className={styles.drain} data-status={status} role="status">
      마지막 {DRAIN_MODE[mode] ?? mode} · {DRAIN_STATE[status]} ·{' '}
      {startedAt.slice(0, 16).replace('T', ' ')} UTC
      {itemsTotal != null ? ` · ${n(itemsDone ?? 0)}/${n(itemsTotal)}편` : null}
      {itemsSkipped != null ? ` · 건너뜀 ${n(itemsSkipped)}` : null}
      {error ? ` · ${error.slice(0, 120)}` : null}
    </p>
  )
}

export function SourceQueryConsole({ queue, onQueue }: {
  queue: SourceQueue
  onQueue: (next: SourceQueue) => void
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY)
  const [page, setPage] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)

  const patch = (next: Partial<Filters>) => { setFilters(prev => ({ ...prev, ...next })); setPage(0) }
  const toggleUse = (tag: SourceUseTag) =>
    patch({ uses: filters.uses.includes(tag) ? filters.uses.filter(x => x !== tag) : [...filters.uses, tag] })

  const { data, error, isLoading, mutate } = useSWR<ListReply>(`${API}?${queryString(queue, filters, page)}`, get, { keepPreviousData: true })
  const { data: counts } = useSWR<{ counts: Record<SourceQueue, number>; drain: DrainRunView }>(`${API}?summary=1`, get)

  // 띠는 **지금 쪽에 실제로 온 행**을 그린다 — 원 하나가 한 편, 지름이 그 편에 붙은 문항 수다.
  // 전체 집계로 그리면 거르개를 바꿔도 무늬가 안 변해서 띠가 거짓말을 한다.
  const shapes = useMemo(
    () => patternShapes((data?.rows ?? []).map(r => (r.linked_items ?? 0) + 1), (data?.rows ?? []).length * 37 + 11),
    [data?.rows],
  )

  const total = data?.count ?? 0
  const size = data?.pageSize ?? filters.pageSize
  const lastPage = Math.max(0, Math.ceil(total / size) - 1)
  const active = describe(queue, filters)
  const dirty = JSON.stringify({ ...filters, q: filters.q.trim() }) !== JSON.stringify(EMPTY)

  return (
    <section className={styles.root} aria-label="소재 적격 조회">
      {/* ── ① 무늬 띠 + 명령 상자 ───────────────────────────────────────── */}
      <div className={styles.band}>
        <PatternBand shapes={shapes} className={styles.bandArt} />
        <div className={styles.bandVeil} aria-hidden="true" />
        <div className={styles.bandBody}>
          <p className={styles.eyebrow}>SOURCE → QUERY</p>
          <h2 className={styles.bandTitle}>원문을 조건으로 찾습니다</h2>
          <p className={styles.bandNote}>
            큐·등급·판정·학령·CEFR·교재 재료를 곱해서 겁니다. 띠의 원 하나가 지금 쪽의 원문 한 편이고,
            지름은 그 원문에 붙은 문항 수입니다.
          </p>
          <div className={styles.commandBox}>
            <Search size={16} aria-hidden="true" />
            <input
              className={styles.command}
              value={filters.q}
              onChange={e => patch({ q: e.target.value })}
              placeholder="제목으로 찾기 — 본문은 찾지 않습니다"
              aria-label="원문 제목 검색"
            />
            {filters.q ? (
              <button type="button" className={styles.commandClear} onClick={() => patch({ q: '' })} aria-label="검색어 지우기">
                <X size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* 마지막 드레인 — 「이 명령을 돌려라」 옆에 「이미 돌았는가」를 둔다. */}
      {counts?.drain ? <LastDrain view={counts.drain} /> : null}

      {/* ── ② 개수 뱃지 탭 ─────────────────────────────────────────────── */}
      <div className={styles.tabs} role="tablist" aria-label="검토 큐">
        {(Object.keys(SOURCE_QUEUES) as SourceQueue[]).map(key => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={queue === key}
            className={styles.tab}
            onClick={() => { onQueue(key); setPage(0) }}
          >
            {SOURCE_QUEUES[key]}
            <span className={styles.tabCount}>{counts ? n(counts.counts[key] ?? 0) : '…'}</span>
          </button>
        ))}
      </div>

      {/* ── ③ 거르개 줄 ────────────────────────────────────────────────── */}
      <div className={styles.filters}>
        <label className={styles.field}>
          <span>등급</span>
          <select value={filters.grade} onChange={e => patch({ grade: e.target.value as SourceGrade | '' })}>
            <option value="">전체</option>
            {SOURCE_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>판정</span>
          <select value={filters.status} onChange={e => patch({ status: e.target.value as SourceStatus | '' })}>
            <option value="">전체</option>
            {SOURCE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>학령</span>
          <select value={filters.band} onChange={e => patch({ band: e.target.value })}>
            <option value="">전체</option>
            {Array.from({ length: 12 }, (_, i) => <option key={i} value={String(i)}>V{i}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>CEFR</span>
          <select value={filters.cefr} onChange={e => patch({ cefr: e.target.value })}>
            <option value="">전체</option>
            {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(c => <option key={c} value={c}>{c}</option>)}
            <option value="unknown">미측정</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>정렬</span>
          <select value={filters.sort} onChange={e => patch({ sort: e.target.value as SourceListSort })}>
            {(Object.keys(SOURCE_LIST_SORTS) as SourceListSort[]).map(s => <option key={s} value={s}>{SOURCE_LIST_SORT_LABELS[s]}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>쪽</span>
          <select value={filters.pageSize} onChange={e => patch({ pageSize: Number(e.target.value) as SourcePageSize })}>
            {SOURCE_PAGE_SIZES.map(s => <option key={s} value={s}>{s}편</option>)}
          </select>
        </label>
      </div>

      {/* 교재 재료 — 오늘 생긴 축이라 별도 줄로 둔다(드롭다운에 섞으면 여러 개를 못 고른다). */}
      <div className={styles.uses} role="group" aria-label="교재 재료로 거르기">
        <span className={styles.usesLabel}>교재 재료</span>
        {SOURCE_USE_TAGS.map(tag => (
          <button
            key={tag}
            type="button"
            className={styles.useChip}
            aria-pressed={filters.uses.includes(tag)}
            onClick={() => toggleUse(tag)}
          >
            {SOURCE_USE_LABELS[tag]}
          </button>
        ))}
        {dirty ? (
          <button type="button" className={styles.reset} onClick={() => { setFilters(EMPTY); setPage(0) }}>
            거르개 지우기
          </button>
        ) : null}
      </div>

      <p className={styles.active} role="status">
        {active.join(' · ')} — {isLoading && !data ? '세는 중' : `${n(total)}편`}
      </p>

      {/* ── ④ 한 줄이 한 작업인 표 ─────────────────────────────────────── */}
      {error ? (
        <p className={styles.notice} role="alert">
          {error instanceof Error ? error.message : '조회하지 못했습니다.'}{' '}
          <button type="button" onClick={() => void mutate()}>다시 읽기</button>
        </p>
      ) : !data ? (
        <p className={styles.notice} role="status">원문을 찾고 있습니다.</p>
      ) : data.rows.length === 0 ? (
        <p className={styles.notice} role="status">
          이 조건에 맞는 원문이 없습니다. 거르개를 하나 풀어 보세요 — 조건은 서로 곱해서 걸립니다.
        </p>
      ) : (
        <>
          <ol className={styles.rows} aria-label="조회된 원문">
            {data.rows.map(row => {
              const action = sourceNextAction(row)
              return (
                <li key={row.article_id}>
                  <button type="button" className={styles.row} onClick={() => setOpenId(row.article_id)}>
                    <span className={styles.rowMain}>
                      <strong className={styles.rowTitle}>{row.input.title ?? '(제목 없음)'}</strong>
                      <span className={styles.rowMeta}>
                        {row.source} · V{row.input.articleVLevel ?? '—'} · {row.input.cefrLevel ?? 'CEFR 미측정'}
                        {' · '}{n(row.input.wordCount ?? 0)}어 · 문항 {n(row.linked_items ?? 0)}
                      </span>
                      {row.uses?.length ? (
                        <span className={styles.rowUses}>
                          {row.uses.map(u => (
                            <span key={u} className={styles.useTag}>{SOURCE_USE_LABELS[u as SourceUseTag] ?? u}</span>
                          ))}
                        </span>
                      ) : null}
                    </span>
                    <span className={styles.rowRight}>
                      <span className={styles.grade} data-grade={row.result.grade}>{row.result.grade}</span>
                      <span className={styles.rowNext}>{action.what}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
          <div className={styles.pager}>
            <button type="button" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>이전</button>
            <span>{n(page + 1)} / {n(lastPage + 1)} 쪽</span>
            <button type="button" onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page >= lastPage}>다음</button>
          </div>
        </>
      )}

      {openId ? <SourceDialog id={openId} onClose={() => setOpenId(null)} /> : null}
    </section>
  )
}

/** 상세 — 참조 팝업 골격(§28) 그대로. 머리는 크림, 본문은 2열(왼쪽 판단 근거 · 오른쪽 수치). */
function SourceDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, error } = useSWR<SourceInspectorData>(`${API}?id=${id}`, get)
  const title = data?.row.input.title ?? '원문'
  return (
    <Dialog
      onClose={onClose}
      crumbs={['Admin', '소재 적격']}
      title={title}
      byline={data ? `${data.row.source} · V${data.row.input.articleVLevel ?? '—'} · ${data.row.input.cefrLevel ?? 'CEFR 미측정'}` : '읽는 중'}
      tags={data ? [data.row.result.grade, `문항 ${data.linkedItems}`, `${(data.row.input.wordCount ?? 0).toLocaleString()}어`] : undefined}
      meta={data?.stale ? '캐시가 원문보다 오래됨' : undefined}
      size="lg"
    >
      {error ? (
        <p role="alert">{error instanceof Error ? error.message : '원문을 읽지 못했습니다.'}</p>
      ) : !data ? (
        <p role="status">원문을 읽고 있습니다.</p>
      ) : (
        <DialogColumns
          main={
            <>
              <DialogTintPanel tone={data.row.result.grade === 'usable' ? 'green' : 'peach'} title="지금 상태">
                <p>{data.current.reason ?? data.row.result.grade}</p>
                {data.row.result.blockers.length ? (
                  <ul>
                    {data.row.result.blockers.map(code => (
                      <li key={code}>{SOURCE_REASON_LABELS[code] ?? code}</li>
                    ))}
                  </ul>
                ) : <p>차단 사유 없음</p>}
              </DialogTintPanel>
              <DialogSection label="본문">
                <p className={styles.body}>{data.content?.slice(0, 2400) ?? '본문 없음'}</p>
              </DialogSection>
            </>
          }
          side={
            <>
              <DialogSection label="교재 재료">
                {data.row.uses?.length ? (
                  <p>{data.row.uses.map(u => SOURCE_USE_LABELS[u as SourceUseTag] ?? u).join(' · ')}</p>
                ) : (
                  <p>아직 실리지 않았습니다 — 내용 판정이 `uses` 를 매기기 전의 원문이거나, 버린 원문입니다.</p>
                )}
              </DialogSection>
              <DialogSection label="쓰임">
                <p>연결 문항 {data.linkedItems.toLocaleString()} · 시도 {data.attempts == null ? '못 잼' : data.attempts.toLocaleString()}</p>
                <p>{data.historicalRendersUnknown ? '과거 조판 기록은 알 수 없습니다.' : `조판 ${data.renders.length}회`}</p>
              </DialogSection>
              {data.sourceUrl ? (
                <DialogSection label="출처">
                  <a href={data.sourceUrl} target="_blank" rel="noreferrer noopener">원문 열기</a>
                </DialogSection>
              ) : null}
            </>
          }
        />
      )}
    </Dialog>
  )
}
