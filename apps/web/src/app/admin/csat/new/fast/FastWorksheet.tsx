// apps/web/src/app/admin/csat/new/fast/FastWorksheet.tsx
'use client'
// FAST 빠른 학습지 — 묶음 하나를 열어 순서 · 발문 · 선지를 고치고, 새 바이트의 신규 검수를 가져와 문제지 · 해설지를 내려받는다.
// 판정은 전부 서버(/api/admin/csat/fast-worksheet)가 한다. 이 화면은 Node crypto · Gold helper 를 import 하지 않는다.

import { useState } from 'react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import type { FastView } from '@/lib/csat/map/v62/factory-bridge/fast-worksheet'

type Bundle = Record<string, unknown> & { edit: Edit | null; review: unknown }
interface Edit {
  order: string[]
  items: Record<string, { stem?: string; choices?: string[] }>
  editor: { kind: 'ai' | 'human'; agent: string; session: string | null; note: string }
}
type Reply = { status: string; code?: string; detail?: string[]; error?: string; view?: FastView; files?: { name: string; content: string }[] }

const TYPE_LABEL: Record<string, string> = { topic: '주제', main_point: '요지', title: '제목' }
const REVIEW_LABEL: Record<string, string> = {
  review_required: '검수 필요 — 아직 이 바이트를 검수한 기록이 없어요',
  review_rejected: '검수 거절 — 가져온 검수가 지금 바이트 · 문항과 맞지 않아요',
  review_not_pass: '검수 결론이 pass 가 아니에요',
  reviewed: '신규 검수 통과(로컬 초안)',
}
const box = 'rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] p-3'
const btn =
  'min-h-[44px] rounded-[var(--r-md)] border border-[var(--line)] px-3 font-body text-[13px] text-[var(--t1)] hover:bg-[var(--bg-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)] disabled:opacity-50'

function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
const readFile = (f: File) => f.text().then((t) => JSON.parse(t) as unknown)

export function FastWorksheet() {
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [reply, setReply] = useState<Reply | null>(null)
  const [busy, setBusy] = useState(false)
  const [netError, setNetError] = useState<string | null>(null)
  const view = reply?.status === 'ok' ? reply.view ?? null : null
  const [lastView, setLastView] = useState<FastView | null>(null)
  const shown = view ?? lastView

  async function call(action: 'preview' | 'export', b: Bundle) {
    setBusy(true)
    setNetError(null)
    try {
      const res = await fetch('/api/admin/csat/fast-worksheet', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, bundle: b }) })
      const r = (await res.json()) as Reply
      setReply(r)
      if (r.view) setLastView(r.view)
      return r
    } catch {
      setNetError('요청이 서버에 닿지 않았어요. 같은 묶음으로 다시 시도해도 안전해요(쓰기 없음).')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function open(f: File | undefined) {
    if (!f) return
    try {
      const b = (await readFile(f)) as Bundle
      setBundle(b)
      setLastView(null)
      await call('preview', b)
    } catch {
      setNetError('JSON 묶음 파일을 읽지 못했어요.')
    }
  }

  function edited(mut: (e: Edit) => void) {
    if (!bundle || !shown) return
    const e: Edit = bundle.edit ? structuredClone(bundle.edit) : { order: shown.items.map((i) => i.id), items: {}, editor: { kind: 'human', agent: 'admin-ui', session: null, note: '' } }
    mut(e)
    e.editor = { kind: 'human', agent: 'admin-ui', session: null, note: '관리자 화면 편집' }
    const next = { ...bundle, edit: e }
    setBundle(next)
    void call('preview', next)
  }
  const move = (id: string, d: -1 | 1) =>
    edited((e) => {
      const i = e.order.indexOf(id)
      const j = i + d
      if (i < 0 || j < 0 || j >= e.order.length) return
      ;[e.order[i], e.order[j]] = [e.order[j]!, e.order[i]!]
    })

  async function importReview(f: File | undefined) {
    if (!f || !bundle) return
    try {
      const next = { ...bundle, review: await readFile(f) }
      setBundle(next)
      await call('preview', next)
    } catch {
      setNetError('검수 JSON 을 읽지 못했어요.')
    }
  }

  async function exportFiles() {
    if (!bundle) return
    const r = await call('export', bundle)
    for (const f of r?.files ?? []) download(f.name, f.content, f.name.endsWith('.html') ? 'text/html' : 'application/json')
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[20px] font-[800] text-[var(--t1)]">빠른 학습지 (FAST)</h1>
          <p className="break-keep font-body text-[13px] text-[var(--t2)]">
            지원 범위: 한 원천의 지도 연습 × 중심 의미(주제 · 요지 · 제목) 팩 <b>전체</b>. 문항 수는 원래 팩 그대로이고, 결과는 <b>로컬 검수 초안</b>이에요(FQ 자격 · 등록 · 출시 아님).
          </p>
        </div>
        <AdminScreenHelp screen="csat-fast" />
      </header>

      <section className={`${box} flex flex-wrap items-center gap-2`} aria-label="묶음">
        <label className={`${btn} inline-flex cursor-pointer items-center`}>
          묶음 열기
          <input type="file" accept="application/json" className="sr-only" onChange={(e) => void open(e.target.files?.[0])} />
        </label>
        <button type="button" className={btn} disabled={!bundle} onClick={() => bundle && download('fast-bundle.json', `${JSON.stringify(bundle, null, 2)}\n`)}>
          묶음 저장
        </button>
        <button type="button" className={btn} disabled={!bundle || busy} onClick={() => bundle && void call('preview', bundle)}>
          다시 판정
        </button>
        <span className="font-body text-[12px] text-[var(--t3)]">묶음은 CLI `fast-worksheet.mts bundle` 로 기존 패킷 · 출력 · 원천 snapshot 에서 만들어요.</span>
      </section>

      {busy ? <p className="font-body text-[13px] text-[var(--t2)]" role="status">판정 중…</p> : null}
      {netError ? <p role="alert" className={`${box} font-body text-[13px] text-[var(--memory-risk)]`}>{netError}</p> : null}
      {reply && reply.status !== 'ok' ? (
        <div role="alert" className={`${box} flex flex-col gap-2 font-body text-[13px] text-[var(--memory-risk)]`}>
          <p>
            거절: <code>{reply.code ?? reply.status}</code> {reply.detail?.length ? `(${reply.detail.join(', ')})` : ''} {reply.error ?? ''}
          </p>
          <button type="button" className={`${btn} self-start`} disabled={!bundle || busy} onClick={() => bundle && void call('preview', bundle)}>
            같은 묶음으로 다시 시도
          </button>
        </div>
      ) : null}

      {shown ? (
        <>
          <section className={box} aria-label="원천">
            <h2 className="font-display text-[15px] font-[800] text-[var(--t1)]">{shown.source.title}</h2>
            <p className="font-body text-[12px] text-[var(--t3)]">
              원천 판정 {shown.source.eligibility} · 차이 {shown.source.drift === 'none' ? '없음' : '재고 사실(has_items)만 — 두 관측 기록'} · 원본 {String(shown.source.observations.original.has_items)} → 현재 {String(shown.source.observations.current.has_items)}
            </p>
            <div className="mt-2 flex max-h-56 flex-col gap-2 overflow-auto font-body text-[14px] leading-relaxed text-[var(--t1)]">
              {shown.source.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </section>

          <section className="flex flex-col gap-3" aria-label="문항 편집">
            {shown.items.map((it, i) => (
              <article key={it.id} className={box} data-item-id={it.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-body text-[13px] font-[700] text-[var(--t1)]">{i + 1}. {TYPE_LABEL[it.type] ?? it.type} <span className="font-[400] text-[var(--t3)]">{it.id}</span></p>
                  <div className="flex gap-1">
                    <button type="button" className={btn} aria-label={`${it.id} 위로`} disabled={i === 0 || busy} onClick={() => move(it.id, -1)}>↑</button>
                    <button type="button" className={btn} aria-label={`${it.id} 아래로`} disabled={i === shown.items.length - 1 || busy} onClick={() => move(it.id, 1)}>↓</button>
                  </div>
                </div>
                <label className="mt-2 flex flex-col gap-1 font-body text-[12px] text-[var(--t2)]">
                  발문
                  <input
                    className="min-h-[44px] rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-2 text-[14px] text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
                    defaultValue={it.stem}
                    onBlur={(e) => e.target.value !== it.stem && edited((ed) => void (ed.items[it.id] = { ...ed.items[it.id], stem: e.target.value }))}
                  />
                </label>
                <ol className="mt-2 flex flex-col gap-1">
                  {it.choices.map((c, k) => (
                    <li key={c.key} className="flex items-center gap-2 font-body text-[13px]">
                      <span className={c.key === it.answer ? 'font-[700] text-[var(--memory-stable)]' : 'text-[var(--t3)]'}>{c.key}{c.key === it.answer ? ' 정답' : ''}</span>
                      <input
                        aria-label={`${it.id} 선지 ${c.key}`}
                        className="min-h-[44px] flex-1 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-2 text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
                        defaultValue={c.text}
                        onBlur={(e) =>
                          e.target.value !== c.text &&
                          edited((ed) => {
                            const cur = ed.items[it.id]?.choices ?? it.choices.map((x) => x.text)
                            cur[k] = e.target.value
                            ed.items[it.id] = { ...ed.items[it.id], choices: cur }
                          })
                        }
                      />
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </section>

          <section className={`${box} flex flex-col gap-2`} aria-label="검수">
            <h2 className="font-display text-[15px] font-[800] text-[var(--t1)]">필수 검수</h2>
            <p className="font-body text-[13px] text-[var(--t1)]" data-review-status={shown.review.status}>
              {REVIEW_LABEL[shown.review.status]}
              {shown.review.status === 'review_rejected' ? <> — <code>{shown.review.code}</code> {shown.review.detail.join(', ')}</> : null}
              {shown.review.status === 'reviewed' ? <> — {shown.review.model} 세션 {shown.review.session} · 보류 축 {shown.review.held_axes.join(', ') || '없음'}</> : null}
            </p>
            <p className="font-body text-[12px] text-[var(--t3)]">
              편집 {shown.diff.fields.length}곳 · 순서 {shown.diff.reordered ? '바뀜' : '그대로'} · 출력 sha256 {shown.output_sha256.slice(0, 16)}… (편집 전 {shown.base_output_sha256.slice(0, 16)}…). 편집하면 이전 검수는 상속되지 않아요.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn} disabled={busy} onClick={() => void exportFiles()}>
                {shown.review.status === 'reviewed' ? '문제지 · 해설지 · manifest 내려받기' : '검수 요청 내려받기(새 세션용)'}
              </button>
              <label className={`${btn} inline-flex cursor-pointer items-center`}>
                검수 결과 가져오기
                <input type="file" accept="application/json" className="sr-only" onChange={(e) => void importReview(e.target.files?.[0])} />
              </label>
            </div>
          </section>

          {shown.student_html && shown.teacher_html ? (
            <section className="grid grid-cols-2 gap-3" aria-label="미리보기">
              <figure className="flex flex-col gap-1">
                <figcaption className="font-body text-[12px] text-[var(--t2)]">학생용 문제지(정답 · 해설 없음)</figcaption>
                <iframe title="학생용 문제지" sandbox="" srcDoc={shown.student_html} className="h-[520px] w-full rounded-[var(--r-md)] border border-[var(--line)] bg-white" />
              </figure>
              <figure className="flex flex-col gap-1">
                <figcaption className="font-body text-[12px] text-[var(--t2)]">교사용 해설지</figcaption>
                <iframe title="교사용 해설지" sandbox="" srcDoc={shown.teacher_html} className="h-[520px] w-full rounded-[var(--r-md)] border border-[var(--line)] bg-white" />
              </figure>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
