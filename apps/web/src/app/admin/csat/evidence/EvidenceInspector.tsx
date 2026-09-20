// apps/web/src/app/admin/csat/evidence/EvidenceInspector.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { X, ExternalLink, TriangleAlert, CheckCircle2 } from 'lucide-react'
import type { EvidenceItem } from '@/lib/csat/evidence-fold'
import type { CsatItemFull } from '@/lib/csat/items'
import { kiceSourceOf } from '@/lib/csat/kice-source'
import {
  LEARNER_FIELDS,
  WORK_ISSUES,
  hasIssue,
  makeWorkPackage,
  type OperationsState,
  type ReadinessIndex,
  type WorkIssue,
} from '@/lib/csat/evidence-operations'
import { ACTIONS, ALERT, BAD, BADGE, BTN, CODE, EYEBROW, GOOD, INSPECTOR, INSPECTOR_BODY, MUTED, ROW, SECTION } from './evidence-ui'

export function EvidenceInspector({
  item,
  index,
  state,
  generatedAt,
  onClose,
  onVerify,
  busy,
  onRelated,
  verifyMessage,
  verifyError,
}: {
  item: EvidenceItem
  index: ReadinessIndex
  state: OperationsState
  generatedAt: string
  onClose: () => void
  onVerify: () => void
  busy: boolean
  onRelated: (issue: WorkIssue) => void
  verifyMessage: string
  verifyError: string
}) {
  const [full, setFull] = useState<CsatItemFull | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [notice, setNotice] = useState('')
  const panel = useRef<HTMLElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const source = kiceSourceOf(item.examId)
  const issues = WORK_ISSUES.filter((i) => hasIssue(item, i, index)).sort(
    (a, b) => a.priority - b.priority
  )
  useEffect(() => {
    const abort = new AbortController()
    let active = true
    setFull(null)
    setError('')
    const timeout = setTimeout(() => abort.abort(), 45000)
    void (async () => {
      try {
        const response = await fetch(`/api/admin/csat/items?item=${encodeURIComponent(item.id)}`, {
          cache: 'no-store',
          signal: abort.signal,
        })
        const result = await response.json()
        if (!response.ok || !result.ok || !result.item)
          throw new Error(result.error ?? '분석을 읽지 못했습니다.')
        if (active) setFull(result.item)
      } catch (e) {
        if (active)
          setError(
            abort.signal.aborted
              ? '응답이 지연되었습니다. 다시 읽어 주세요.'
              : e instanceof Error
                ? e.message
                : '분석을 읽지 못했습니다.'
          )
      } finally {
        clearTimeout(timeout)
      }
    })()
    return () => {
      active = false
      clearTimeout(timeout)
      abort.abort()
    }
  }, [item.id, attempt])
  useEffect(() => {
    closeRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
      }
      // Modal drawer on all widths: background remains visible but is not an extra tab sequence.
      if (e.key === 'Tab') {
        const elements = [
          ...(panel.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], summary, [tabindex="0"]'
          ) ?? []),
        ].filter((el) => el.getClientRects().length)
        const first = elements[0],
          last = elements[elements.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('keydown', key)
      document.body.style.overflow = previousOverflow
    }
  }, [])
  function exportItem() {
    const blob = new Blob(
      [
        JSON.stringify(
          makeWorkPackage([item], { ...state, item: item.id }, generatedAt, index),
          null,
          2
        ),
      ],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob),
      link = document.createElement('a')
    link.href = url
    link.download = 'csat-evidence-item-work.json'
    link.click()
    URL.revokeObjectURL(url)
    setNotice('이 문항의 작업 대상을 내려받았습니다. 재분석은 아직 실행되지 않았습니다.')
  }
  return (
    <aside
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-inspector-title"
      className={INSPECTOR}
    >
      <header>
        <div>
          <p className={EYEBROW}>문항 검토 · {item.id}</p>
          <h2 id="evidence-inspector-title">
            {item.examLabel} {item.no}번
          </h2>
          <p className={MUTED}>
            {item.typeName} · {item.points}점 · 분석{' '}
            {item.analysisVersion ? `v${item.analysisVersion}` : '없음'}
          </p>
        </div>
        <button ref={closeRef} className={BTN} onClick={onClose} aria-label="문항 검토 닫기">
          <X size={18} aria-hidden />
        </button>
      </header>
      <div className={INSPECTOR_BODY}>
        {verifyMessage ? (
          <p role="status" className={MUTED}>
            {verifyMessage}
          </p>
        ) : null}
        {verifyError ? (
          <p role="alert" className={ALERT}>
            최신 판정 보류 · {verifyError}
          </p>
        ) : null}
        <section className={SECTION}>
          <h3>현재 판단</h3>
          <p className={`${BADGE} ${index.ready.has(item.id) ? GOOD : BAD}`}>
            {index.ready.has(item.id) ? (
              <CheckCircle2 size={16} aria-hidden />
            ) : (
              <TriangleAlert size={16} aria-hidden />
            )}
            {index.ready.has(item.id)
              ? '학습 준비됨'
              : index.missing.has(item.id)
                ? '학습 후보 제외'
                : '학습 상태 미확인'}
          </p>
          <p className={MUTED}>
            {index.missing
              .get(item.id)
              ?.map((f) => LEARNER_FIELDS[f] ?? f)
              .join(' · ')}
          </p>
          <p className={MUTED}>
            원천 검토 {item.defects.length}건 · 최신 판 3인 검수{' '}
            {item.reviewed3 ? '통과' : '확인 필요'}
          </p>
          {issues.slice(0, 1).map((i) => (
            <div className="mt-3" key={i.id}>
              <button className={ROW} onClick={() => onRelated(i)}>
                <span>
                  P{i.priority} · {i.label}
                </span>
                <span>관련 문항 →</span>
              </button>
              <p className={MUTED}>{i.action}</p>
            </div>
          ))}
          {issues.length > 1 ? (
            <details>
              <summary>전체 문제 {issues.length}건과 영향</summary>
              {issues.slice(1).map((i) => (
                <div key={i.id}>
                  <button className={ROW} onClick={() => onRelated(i)}>
                    <span>
                      P{i.priority} · {i.label}
                    </span>
                    <span>관련 문항 →</span>
                  </button>
                  <p className={MUTED}>{i.action}</p>
                </div>
              ))}
            </details>
          ) : null}
        </section>
        <details open>
          <summary>원문과 추출 상태</summary>
          <p>
            {item.bodyOk ? '✓ 추출 본문 정상' : '△ 추출 본문 검토 필요'} ·{' '}
            {item.quoteLocated ? '인용 대조 일치' : '인용 대조 불일치'}
          </p>
          <a
            className={BTN}
            href={source.paperUrl ?? source.listUrl}
            target="_blank"
            rel="noreferrer"
          >
            {source.paperUrl ? '공식 문제지 열기' : '공식 자료 안내 열기'}
            <ExternalLink size={14} aria-hidden />
          </a>
          {source.reason ? (
            <p className={MUTED}>{source.reason} · 안내에서 해당 회차를 확인하세요.</p>
          ) : null}
          <p className={MUTED}>
            추출 정상은 원문의 재사용 허가를 뜻하지 않습니다. 원문 전문은 이 패널로 복제하지
            않습니다.
          </p>
        </details>
        {error ? (
          <div role="alert" className={ALERT}>
            <p>{error}</p>
            <button className={BTN} onClick={() => setAttempt((v) => v + 1)}>
              분석 다시 읽기
            </button>
          </div>
        ) : !full ? (
          <p role="status" className="py-4">
            분석과 변경 이력을 읽는 중…
          </p>
        ) : (
          <>
            <details open>
              <summary>현재 분석과 근거</summary>
              <dl>
                <dt>출제 의도</dt>
                <dd>{full.design_intent || '분석 없음'}</dd>
                <dt>근거 인용</dt>
                <dd>
                  {full.quote ? (
                    <blockquote className="font-editorial">{full.quote}</blockquote>
                  ) : (
                    '인용 없음'
                  )}
                </dd>
                <dt>근거 설명</dt>
                <dd>{full.reasoning || '설명 없음'}</dd>
              </dl>
              <h4 className="mt-4 text-sm font-semibold">문장 앵커</h4>
              {full.anchors?.length ? (
                <ul>
                  {full.anchors.map((a) => (
                    <li key={a.id}>
                      {a.id === 'answer' ? '정답 근거' : a.id} · 문장{' '}
                      {a.sentences.map((n) => n + 1).join(', ') || '미연결'}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>연결된 앵커가 없습니다.</p>
              )}
              <a
                className={`${BTN} mt-3`}
                href={`/admin/kice/item/${encodeURIComponent(item.id.replace('#', '-'))}`}
                target="_blank"
                rel="noreferrer"
              >
                전체 분석 뷰 <ExternalLink size={14} aria-hidden />
              </a>
            </details>
            <details>
              <summary>선지·풀이 절차·학습 메타</summary>
              <ol>
                {full.choices.map((c) => (
                  <li key={c.n} className="my-3">
                    <strong>
                      {c.n}번 {c.n === full.answer ? '정답' : '오답'}
                      {c.trap ? ` · ${c.trap}` : ''}
                    </strong>
                    <p>{c.text || '배제 설명 없음'}</p>
                  </li>
                ))}
              </ol>
              <h4 className="mt-3 font-semibold">풀이 절차</h4>
              <ol>
                {full.procedure.map((p, n) => (
                  <li key={n}>
                    {n + 1}. {p.step}
                    {p.on_fail ? ` · 막히면 ${p.on_fail}` : ''}
                  </li>
                ))}
              </ol>
              <dl>
                <dt>재는 능력</dt>
                <dd>{full.measured_ability || '없음'}</dd>
                <dt>소재 · 형식 · 공식</dt>
                <dd>
                  {full.metadata
                    ? `${full.metadata.topic} · ${full.metadata.format} · ${full.metadata.formula}`
                    : '검토된 메타데이터 없음'}
                </dd>
                <dt>필수 어휘</dt>
                <dd>{full.required_vocab.join(' · ') || '없음'}</dd>
                <dt>권장 시간 · 예측 정답률</dt>
                <dd>
                  {full.time_budget_sec ?? '미확인'}초 ·{' '}
                  {full.predicted == null ? '미확인' : `${Math.round(full.predicted * 100)}%`}
                </dd>
              </dl>
            </details>
            <details>
              <summary>분석 변경 이력 · {full.history?.length ?? 0}개 버전</summary>
              {full.historyError ? (
                <p role="alert">이력을 읽지 못했습니다. {full.historyError}</p>
              ) : (
                <ul>
                  {full.history?.map((h) => (
                    <li key={h.version}>
                      v{h.version} · {h.status} ·{' '}
                      {new Date(h.updated_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}{' '}
                      KST
                    </li>
                  ))}
                </ul>
              )}
              <p className={MUTED}>
                DB에 남은 분석 버전 이력입니다. 정적 앵커·메타데이터 변경과 실행하지 않은 작업은
                포함하지 않습니다.
              </p>
            </details>
          </>
        )}
        <details>
          <summary>조치와 재검증</summary>
          {issues.map((i) => (
            <div key={i.id} className="my-3">
              <h4 className="font-semibold">{i.label}</h4>
              <p>{i.technical}</p>
              <p className={CODE}>{i.location}</p>
            </div>
          ))}
          <div className={`${ACTIONS} mt-3`}>
            <button className={BTN} onClick={exportItem}>
              이 문항 작업 대상 내보내기
            </button>
            <button className={BTN} disabled={busy} onClick={onVerify}>
              {busy ? '재검증 중…' : '지금 재검증'}
            </button>
          </div>
          <p role="status" className={MUTED}>
            {notice}
          </p>
          <p className={MUTED}>
            재검증은 현재 전체 기준을 다시 읽습니다. 재분석·DB 수정은 자동 실행하지 않습니다.
          </p>
        </details>
      </div>
    </aside>
  )
}
