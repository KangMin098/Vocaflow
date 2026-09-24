// apps/web/src/app/admin/video/requests/[id]/RequestDetailClient.tsx
//
// 요청 한 건의 순환 — 칸마다 **현재 상태 · 결과물 · 사람이 할 결정**.
//
// ⚠️ 미리보기에 `ComponentVideo` 를 쓰지 않는다. 그건 재생 계측(video_started/completed)을 쏘고,
//    요청 편의 목적 평가가 바로 그 계측을 센다 — 관리자가 검토하며 튼 재생이 「목적 달성」에 섞인다.

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ArrowLeft, Clapperboard, Copy, Check } from 'lucide-react'
import {
  AUDIENCE_LABEL,
  CYCLE_STEPS,
  NEEDS,
  NEXT_STEP,
  PHASE_LABEL,
  PURPOSE_LABEL,
  cycleStepOf,
  nextStepText,
  type DraftScene,
  type ReviewDecision,
} from '@vocaflow/video-factory/requests'

import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import type { RequestDetail } from '@/lib/admin/video-requests'
import type { ResolvedVideo } from '@/lib/video/catalog'
import { cancelVideoRequestAction, reviewVideoRequestAction } from '../../actions'

const card = 'rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4'
const h2 = 'mb-3 font-display text-[15px] font-[800] text-[var(--t1)]'

const ROLE_LABEL: Record<DraftScene['role'], string> = {
  problem: '문제',
  solution: '해결',
  proof: '근거',
  action: '다음 행동',
}

/**
 * 시각을 KST 로 — 로케일 API 를 쓰지 않는다. 서버(Node)와 브라우저의 로케일 데이터가 달라
 * 「PM」과 「오후」로 갈리면 hydration 이 깨진다(실측 2026-09-24).
 */
function kst(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 3600_000)
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} KST`
}

const DECISION_LABEL: Record<ReviewDecision, string> = { approve: '승인', revise: '수정 요청', reject: '반려' }

function Stepper({ phase }: { phase: RequestDetail['request']['phase'] }) {
  const cur = cycleStepOf(phase)
  const at = CYCLE_STEPS.indexOf(cur.step)
  return (
    <ol className="mb-5 grid grid-cols-5 gap-1" aria-label="순환 단계">
      {CYCLE_STEPS.map((s, i) => {
        const done = i < at || (i === at && cur.done)
        const now = i === at && !cur.done
        return (
          <li
            key={s}
            aria-current={now ? 'step' : undefined}
            className={`rounded-[var(--r-sm)] border px-2 py-2 text-center font-body text-[12px] ${
              now
                ? 'border-[var(--p)] bg-[var(--p-light)] font-[800] text-[var(--t1)]'
                : done
                  ? 'border-[var(--bd)] text-[var(--t2)]'
                  : 'border-dashed border-[var(--bd)] text-[var(--t3)]'
            }`}
          >
            {done ? '✓ ' : now ? '● ' : '○ '}
            {s}
          </li>
        )
      })}
    </ol>
  )
}

function Command({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-start gap-2 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2">
      <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-[12px] text-[var(--t2)]">{text}</pre>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(text).then(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
          })
        }}
        className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1 rounded-[var(--r-sm)] px-2 font-body text-[12px] text-[var(--t2)] hover:bg-[var(--bg3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
      >
        {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
        {copied ? '복사됨' : '복사'}
      </button>
    </div>
  )
}

function SceneRow({
  s,
  i,
  facts,
  resolved,
}: {
  s: DraftScene
  i: number
  facts: Record<string, string>
  /** 원료로 채운 자막·소리 — 있으면 이것이 실제로 나갈 문장이다 */
  resolved?: { caption: string; narration?: string }
}) {
  const extra =
    s.kind === 'hook'
      ? s.line
      : s.kind === 'statement'
        ? `${s.title} — ${s.body} (근거: ${s.basis})`
        : s.kind === 'stat'
          ? s.stats.map((x) => `${x.label} ← ${facts[x.fact] ?? x.fact}`).join(' · ')
          : s.kind === 'closing'
            ? `${s.cta} → ${s.url}`
            : `빌린 장면: ${s.videoId} #${s.sceneIndex}`
  return (
    <li className="grid grid-cols-[2rem_4.5rem_1fr] gap-2 py-2">
      <span className="font-mono text-[11px] text-[var(--t3)]">{i + 1}</span>
      <span className="font-body text-[11px] font-[700] text-[var(--t2)]">
        {ROLE_LABEL[s.role]}
        <br />
        <span className="font-mono font-[400] text-[var(--t3)]">{s.kind}</span>
      </span>
      <div className="min-w-0">
        <p className="break-keep font-body text-[13px] text-[var(--t1)]">자막 · {resolved?.caption ?? s.caption}</p>
        {(resolved?.narration ?? s.narration) && (
          <p className="break-keep font-body text-[12px] text-[var(--t2)]">소리 · {resolved?.narration ?? s.narration}</p>
        )}
        {resolved && resolved.caption !== s.caption && (
          <p className="break-keep font-mono text-[10px] text-[var(--t3)]">초안 · {s.caption}</p>
        )}
        <p className="break-keep font-body text-[11px] text-[var(--t3)]">{extra}</p>
      </div>
    </li>
  )
}

export function RequestDetailClient({ detail, video }: { detail: RequestDetail; video: ResolvedVideo | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { request: r, revisions, reviews, evaluations, job, domain } = detail
  const latest = revisions[0] ?? null
  const [shownRev, setShownRev] = useState<number | null>(latest?.rev ?? null)
  const shown = revisions.find((v) => v.rev === shownRev) ?? latest
  const need = NEEDS[r.purpose][r.audience]
  const next = NEXT_STEP[r.phase]
  const canReview = r.phase === 'designed' && latest !== null && shown?.rev === latest.rev
  const canCancel = ['requested', 'designed', 'changes_requested', 'approved'].includes(r.phase)
  const checks = shown && 'items' in shown.checks ? shown.checks : null
  const factsShown: Record<string, string> = Object.fromEntries(
    (shown?.design.facts ?? []).map((f) => [f.name, `${f.label} (${f.path})`]),
  )

  const decide = (decision: ReviewDecision) => {
    if (!latest) return
    setError(null)
    start(async () => {
      const res = await reviewVideoRequestAction(r.id, latest.rev, decision, comment)
      if (!res.ok) {
        setError(res.error ?? '기록하지 못했습니다')
        return
      }
      setComment('')
      router.refresh()
    })
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Link
        href="/admin/video"
        className="mb-3 inline-flex min-h-[44px] items-center gap-1 font-body text-[13px] text-[var(--t2)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
      >
        <ArrowLeft size={14} aria-hidden /> 영상 공장
      </Link>
      <AdminPageHeader
        icon={Clapperboard}
        title={r.target_label}
        description={`${domain?.label ?? r.domain_id} · ${PURPOSE_LABEL[r.purpose]} · ${AUDIENCE_LABEL[r.audience]} · ${r.formats.join(' · ')}`}
        actions={<AdminScreenHelp screen="video-request" />}
      />

      <Stepper phase={r.phase} />

      {/* 지금 상태와 다음 할 일 — 가장 먼저 읽히게 */}
      <div className={`${card} mb-5`}>
        <p className="font-body text-[13px] text-[var(--t1)]">
          <strong>{r.phase === 'failed' ? '✗ ' : ''}{PHASE_LABEL[r.phase]}</strong>
          {r.video_id && <span className="ml-2 font-mono text-[12px] text-[var(--t3)]">{r.video_id}</span>}
          {job && <span className="ml-2 font-body text-[12px] text-[var(--t3)]">큐: {job.stage}</span>}
        </p>
        {r.error && <p className="mt-1 break-keep font-body text-[12px] text-[var(--error-ink)]">✗ {r.error}</p>}
        <p className="mb-2 mt-2 font-body text-[12px] font-[600] text-[var(--t2)]">
          {next.who === 'admin' ? '▶ 내 차례' : next.who === 'agent' ? '⚙ 터미널에서 실행' : '다음 할 일 없음'}
        </p>
        {next.who === 'agent' ? (
          <Command text={nextStepText(r.phase, r.video_id)} />
        ) : (
          <p className="break-keep font-body text-[13px] text-[var(--t2)]">{next.text}</p>
        )}
        {canCancel && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm('이 요청을 거둡니다. 되돌릴 수 없습니다.')) return
              start(async () => {
                const res = await cancelVideoRequestAction(r.id)
                if (!res.ok) setError(res.error ?? '거두지 못했습니다')
                else router.refresh()
              })
            }}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-[var(--r-sm)] px-2 font-body text-[12px] text-[var(--t3)] underline hover:text-[var(--t2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
          >
            요청 거두기
          </button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── 기획 ── */}
        <section className={card}>
          <h2 className={h2}>기획</h2>
          <p className="mb-2 font-body text-[11px] font-[700] text-[var(--t3)]">수요자 니즈(정의)</p>
          <p className="mb-3 break-keep font-body text-[12px] text-[var(--t2)]">
            {need.wants} · 문제: {need.pain} · 망설임: {need.doubt}
          </p>
          {r.memo && (
            <p className="mb-3 break-keep rounded-[var(--r-sm)] bg-[var(--bg2)] px-3 py-2 font-body text-[12px] text-[var(--t2)]">
              메모 · {r.memo}
            </p>
          )}
          {shown ? (
            <dl className="grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1.5 font-body text-[13px]">
              <dt className="text-[var(--t3)]">니즈</dt><dd className="break-keep">{shown.plan.need}</dd>
              <dt className="text-[var(--t3)]">문제</dt><dd className="break-keep">{shown.plan.problem}</dd>
              <dt className="text-[var(--t3)]">해결</dt><dd className="break-keep">{shown.plan.promise}</dd>
              <dt className="text-[var(--t3)]">메시지</dt><dd className="break-keep font-[700]">{shown.plan.message}</dd>
              <dt className="text-[var(--t3)]">다음 행동</dt><dd className="break-keep">{shown.plan.action}</dd>
            </dl>
          ) : (
            <p className="break-keep font-body text-[13px] text-[var(--t3)]">아직 기획이 없습니다 — 설계 드레인이 기획과 설계를 함께 씁니다.</p>
          )}
        </section>

        {/* ── 검토 ── */}
        <section className={card}>
          <h2 className={h2}>검토</h2>
          {canReview ? (
            <>
              <label htmlFor="vr-comment" className="mb-1 block font-body text-[12px] font-[600] text-[var(--t2)]">
                코멘트 — 수정 요청·반려는 필수. 다음 설계가 그대로 받는다
              </label>
              <textarea
                id="vr-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[96px] w-full rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-body text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending || (checks !== null && !checks.ok)}
                  onClick={() => decide('approve')}
                  className="min-h-[44px] rounded-[var(--r-sm)] bg-[var(--p)] px-4 font-body text-[13px] font-[700] text-[var(--on-p)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
                >
                  ✓ 승인 — rev {latest?.rev} 적용
                </button>
                <button
                  type="button"
                  disabled={pending || !comment.trim()}
                  onClick={() => decide('revise')}
                  className="min-h-[44px] rounded-[var(--r-sm)] border border-[var(--p)] px-4 font-body text-[13px] font-[700] text-[var(--t1)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
                >
                  ↺ 수정 요청
                </button>
                <button
                  type="button"
                  disabled={pending || !comment.trim()}
                  onClick={() => {
                    if (window.confirm('반려하면 이 요청은 끝납니다. 되돌릴 수 없습니다.')) decide('reject')
                  }}
                  className="min-h-[44px] rounded-[var(--r-sm)] border border-[var(--bd)] px-4 font-body text-[13px] text-[var(--t2)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
                >
                  ✗ 반려
                </button>
              </div>
            </>
          ) : (
            <p className="break-keep font-body text-[13px] text-[var(--t3)]">
              {r.phase === 'designed' ? '최신 rev 를 보고 있을 때만 결정할 수 있습니다.' : '지금은 검토할 설계가 없습니다.'}
            </p>
          )}
          {error && <p role="alert" className="mt-2 break-keep font-body text-[13px] text-[var(--error-ink)]">✗ {error}</p>}
          {reviews.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-[var(--bd)] pt-3">
              {reviews.map((v, i) => (
                <li key={i} className="font-body text-[12px]">
                  <span className="font-[700] text-[var(--t1)]">rev {v.rev} · {DECISION_LABEL[v.decision]}</span>
                  <span className="ml-2 text-[var(--t3)]">{kst(v.created_at)}</span>
                  {v.comment && <p className="break-keep text-[var(--t2)]">{v.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── 설계 ── */}
      <section className={`${card} mt-5`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="font-display text-[15px] font-[800] text-[var(--t1)]">설계</h2>
          {revisions.length > 1 && (
            <select
              aria-label="rev 고르기"
              value={shown?.rev ?? ''}
              onChange={(e) => setShownRev(Number(e.target.value))}
              className="min-h-[44px] rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-body text-[12px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
            >
              {revisions.map((v) => (
                <option key={v.rev} value={v.rev}>rev {v.rev}{v.rev === latest?.rev ? ' (최신)' : ''}</option>
              ))}
            </select>
          )}
          {checks && (
            <span className="font-body text-[12px] text-[var(--t2)]">
              {checks.ok ? '✓ 자동 검사 통과' : '✗ 자동 검사 탈락'} · 예상 {checks.seconds}초
            </span>
          )}
        </div>
        {shown ? (
          <>
            {!checks?.preview && (
              <p className="mb-2 break-keep font-body text-[12px] text-[var(--warning)]">
                ! 원료로 채운 미리보기가 없습니다 — 아래 {'{{…}}'} 자리는 적용 때 값이 들어갑니다.
              </p>
            )}
            <p className="font-body text-[14px] font-[700] text-[var(--t1)]">{checks?.preview?.title ?? shown.design.title}</p>
            <p className="mb-2 break-keep font-body text-[12px] text-[var(--t2)]">{checks?.preview?.subtitle ?? shown.design.subtitle}</p>
            <ol className="divide-y divide-[var(--bd)]">
              {shown.design.scenes.map((s, i) => (
                <SceneRow key={i} s={s} i={i} facts={factsShown} resolved={checks?.preview?.scenes[i]} />
              ))}
            </ol>
            {shown.design.facts.length > 0 && (
              <>
                <p className="mt-3 font-body text-[11px] font-[700] text-[var(--t3)]">
                  인용 수치 — 원료(DB 실측)에서 온다. 적용 때 그날의 원료로 다시 채운다
                </p>
                <ul className="font-mono text-[11px] text-[var(--t2)]">
                  {shown.design.facts.map((f) => {
                    const ev = checks?.preview?.evidence.find((e) => e.label === f.label)
                    return (
                      <li key={f.name}>
                        {`{{${f.name}}}`} = <strong className="text-[var(--t1)]">{ev?.value ?? '?'}</strong> · {f.label} · {f.path}
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
            {checks && checks.items.length > 0 && (
              <ul className="mt-3 space-y-1 font-body text-[12px]">
                {checks.items.map((c, i) => (
                  <li key={i} className={c.level === 'error' ? 'text-[var(--error-ink)]' : 'text-[var(--warning)]'}>
                    {c.level === 'error' ? '✗' : '!'} [{c.rule}] {c.detail}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="break-keep font-body text-[13px] text-[var(--t3)]">아직 설계가 없습니다.</p>
        )}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* ── 적용 ── */}
        <section className={card}>
          <h2 className={h2}>적용</h2>
          {video ? (
            // 계측 없는 재생 — 머리말 참조
            <video
              controls
              preload="metadata"
              poster={video.poster}
              className="w-full rounded-[var(--r-sm)] border border-[var(--bd)]"
            >
              <source src={video.src} type="video/mp4" />
              {/* default 를 걸지 않는다 — 자막이 화면에 구워져 있어 두 번 그려진다(VIDEO_FACTORY §자막) */}
              <track kind="captions" srcLang="ko" label="한국어" src={video.captions} />
            </video>
          ) : (
            <p className="break-keep font-body text-[13px] text-[var(--t3)]">
              {r.video_id ? '아직 발행 목록(manifest)에 없습니다 — 발행 뒤 여기서 재생됩니다.' : '승인 뒤 requests:pull 이 영상 id 를 붙입니다.'}
            </p>
          )}
          {job && (
            <p className="mt-2 font-body text-[12px] text-[var(--t2)]">
              큐 단계 {job.stage}
              {job.seconds !== null ? ` · ${job.seconds}초` : ''}
              {job.error ? ` · ✗ ${job.error}` : ''}
            </p>
          )}
        </section>

        {/* ── 평가 ── */}
        <section className={card}>
          <h2 className={h2}>평가</h2>
          {evaluations.length === 0 ? (
            <p className="break-keep font-body text-[13px] text-[var(--t3)]">아직 평가가 없습니다 — 발행 뒤 pnpm video evaluate.</p>
          ) : (
            evaluations.map((e) => (
              <div key={e.rev} className="mb-3 font-body text-[12px]">
                <p className="font-[700] text-[var(--t1)]">
                  rev {e.rev} · 규격 통과 {e.spec.pass ?? '—'} · 어긋남 {e.spec.fail ?? '—'} · 못 잼 {e.spec.unknown ?? '—'}
                </p>
                <p className="break-keep text-[var(--t2)]">
                  목적 — 재생 {e.outcome.started ?? '못 셈'} · 완주 {e.outcome.completed ?? '못 셈'} · 완주율{' '}
                  {e.outcome.completionRate !== null && e.outcome.completionRate !== undefined
                    ? `${Math.round(e.outcome.completionRate * 100)}%`
                    : '못 잼'}
                </p>
                {e.outcome.note && <p className="break-keep text-[var(--t3)]">{e.outcome.note}</p>}
                {e.outcome.cta && <p className="break-keep text-[var(--t3)]">행동(CTA) — {e.outcome.cta.note}</p>}
                <p className="text-[var(--t3)]">{kst(e.measured_at)}</p>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  )
}
