// apps/web/src/app/admin/video/VideoConsoleClient.tsx
//
// 영상 공장 콘솔의 화면부. **수치는 하나도 여기서 만들지 않는다** —
// 전부 `lib/admin/video-console.ts` 가 실측해 넘긴 값이다.
//
// ── 레이아웃 원칙 ─────────────────────────────────────────────────
//  · **볼 것이 없으면 접어 둔다.** 문제가 0건이면 경보 칸을 펴지 않는다(`/admin/db` 와 같은 판단).
//  · 상태는 **색만으로** 말하지 않는다 — 기호와 글자를 함께 낸다(색약 대응).
//  · 표의 한 행은 **구성요소**다. 영상이 아니라. 없는 영상도 행으로 보여야 "밀린 것"이 보인다.

'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Clapperboard, Copy, Check } from 'lucide-react'

import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { KIND_LABEL, KIND_ORDER } from '@/lib/video/catalog'
import {
  JOB_STAGES,
  JOB_STAGE_KO,
  type EvalSummary,
  type EvidenceDrift,
  type JobQueue,
  type PlanBoard,
  type VideoConsole,
  type VideoRow,
} from '@/lib/admin/video-console-shape'
import type { RequestBoard } from '@/lib/admin/video-requests'

import { RequestsPanel, type RequestPrefill } from './RequestsPanel'
import { VideoActions } from './VideoActions'

// 종류 순서는 `KIND_LABEL` 의 키 순서다 — **여기서 다시 적지 않는다.**
// 손으로 적었더니 종류를 둘 더한 날 `/video` 에서 11편이 조용히 사라졌고, 이 화면의
// 구성요소 탭도 같은 목록을 따로 갖고 있어 같은 방식으로 새 종류를 빠뜨리고 있었다.
const ORDER = KIND_ORDER

// 순서는 파이프라인 순서다 — 요청 → 기획 → (제작) → 평가. 「현황」이 제작 관측이다.
// 「요청」이 맨 앞인 이유: 이 화면에서 사람이 **결정하는** 곳은 거기뿐이다(나머지는 관측).
const TABS = ['요청', '현황', '기획', '평가', '구성요소', '수치 낡음', '내보내기'] as const
type Tab = (typeof TABS)[number]

function pct(n: number, d: number): string {
  if (d === 0) return '—'
  return `${Math.round((n / d) * 100)}%`
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

/** 규격 셋이 전부 살아 있는가. null 은 **못 잼**이지 0 이 아니다. */
function liveAll(row: VideoRow): boolean | null {
  if (!row.live) return null
  return row.live.wide && row.live.vertical && row.live.square
}

function Signal({
  label,
  value,
  sub,
  warn,
}: {
  label: string
  value: string
  sub?: string
  warn?: boolean
}) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3">
      <p className="font-body text-[11px] text-[var(--t3)]">{label}</p>
      <p
        className={`font-display text-[24px] font-[800] tabular-nums ${
          warn ? 'text-[var(--warning)]' : 'text-[var(--t1)]'
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 font-mono text-[10px] text-[var(--t3)]">{sub}</p>}
    </div>
  )
}

function CommandBlock({ title, lines }: { title: string; lines: string[] }) {
  const [copied, setCopied] = useState(false)
  const text = lines.join('\n')
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)]">
      <div className="flex items-center justify-between border-b border-[var(--bd)] px-3 py-2">
        <p className="font-body text-[12px] font-[600] text-[var(--t1)]">{title}</p>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(text).then(() => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            })
          }}
          // 44px — 손가락이 닿는 최소 크기(CLAUDE.md). 32px 로 두고 있었다.
          // 글자를 키우는 대신 **여백으로** 넓힌다 — 머리글 줄 높이를 흩뜨리지 않는다.
          className="-my-1 inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-[var(--r-sm)] px-2 font-body text-[12px] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
        >
          {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2 font-mono text-[12px] leading-relaxed text-[var(--t2)]">
        {text}
      </pre>
    </div>
  )
}

export function VideoConsoleClient({
  data,
  drift,
  queue,
  evaluation,
  plan,
  requests,
  initialTab = '요청',
  prefill = null,
}: {
  data: VideoConsole
  drift: EvidenceDrift[]
  /** 마이그레이션 전이면 null — 그때는 패널을 아예 안 그린다(빈 표는 "큐가 비었다" 로 읽힌다). */
  queue: JobQueue | null
  /** 평가 열이 아직 없으면 null — 같은 이유로 통째로 안 그린다. */
  evaluation: EvalSummary | null
  plan: PlanBoard
  requests: RequestBoard
  /** 처음 펼칠 탭. 테스트가 서버 렌더로 다른 탭을 보려고 쓴다 */
  initialTab?: Tab
  /** 「교체 요청」에서 넘어왔을 때 폼에 미리 채울 값 */
  prefill?: RequestPrefill | null
}) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const waiting = requests.requests.filter((r) => r.phase === 'designed').length

  const stat = useMemo(() => {
    const total = data.rows.length
    const published = data.rows.filter((r) => r.published).length
    const live = data.rows.filter((r) => liveAll(r) === true).length
    const thumbs = data.rows.filter((r) => r.thumb === true).length
    const captions = data.rows.filter((r) => r.captions === true).length
    const bytes = data.rows.reduce((n, r) => n + (r.bytes ?? 0), 0)
    const seconds = data.rows.reduce((n, r) => n + (r.seconds ?? 0), 0)
    const starts = data.views.byId
      ? Object.values(data.views.byId).reduce((a, b) => a + b, 0)
      : null
    return { total, published, live, thumbs, captions, bytes, seconds, starts }
  }, [data])

  // 내린 편은 「안 만듦」이 아니다 — 일부러 뺀 것이다. 따로 센다.
  // 요청 편은 구성요소 목록에 없으므로 「고아」가 아니다 — 요청이 주인이다.
  const retiredIds = requests.retired
  const requestVideoIds = new Set(requests.requests.map((r) => r.video_id).filter((v): v is string => v !== null))
  const issues = data.issues.filter(
    (i) => !retiredIds[i.id] && !(i.kind === 'orphan' && requestVideoIds.has(i.id)),
  )
  const retiredCount = Object.keys(retiredIds).length
  const missing = issues.filter((i) => i.kind === 'missing')
  const lost = issues.filter((i) => i.kind === 'lost')
  const orphan = issues.filter((i) => i.kind === 'orphan')
  const problems = issues.length

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <AdminPageHeader
        icon={Clapperboard}
        title="영상 공장"
        description="요청 → 기획 → 설계 → 검토 → 적용 → 평가. 사람은 요청과 검토를, 드레인과 공장이 나머지를 한다."
        actions={<AdminScreenHelp screen="video" tab={tab} />}
      />

      <nav className="mb-5 flex gap-1 border-b border-[var(--bd)]" aria-label="화면 전환">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-current={tab === t ? 'page' : undefined}
            className={`min-h-[44px] px-4 font-body text-[13px] font-[600] transition-colors duration-[var(--dur-normal)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--p)] ${
              tab === t
                ? 'border-b-2 border-[var(--p)] text-[var(--t1)]'
                : 'text-[var(--t3)] hover:text-[var(--t2)]'
            }`}
          >
            {t}
            {t === '현황' && problems > 0 ? ` · ${problems}` : ''}
            {t === '요청' && waiting > 0 ? ` · 검토 ${waiting}` : ''}
          </button>
        ))}
      </nav>

      {/* 발행 전이면 다른 무엇보다 이것부터 — 화면에 영상이 한 편도 안 뜬다. */}
      {!data.baseUrl && (
        <p className="mb-4 rounded-[var(--r-md)] border border-[var(--bde)] bg-[var(--error-light)] px-4 py-3 font-body text-[13px] text-[var(--error-ink)]">
          발행 기준 URL이 없습니다 — 학습자 화면에 영상이 <strong>한 편도 안 뜹니다</strong>.
          내보내기 탭의 마지막 단계(publish)를 돌리고 manifest를 커밋하세요.
        </p>
      )}

      {tab === '요청' && <RequestsPanel board={requests} prefill={prefill} />}

      {tab === '현황' && retiredCount > 0 && (
        <p className="mb-4 break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-2 font-body text-[13px] text-[var(--t2)]">
          ⊘ 내린 편 {retiredCount} — 「안 만듦」으로 세지 않습니다. 구성요소 탭에서 되살릴 수 있습니다.
        </p>
      )}

      {tab === '현황' && (
        <section>
          {/*
            ── 큐 ──
            아래 신호들은 manifest 와 파일을 비교해 **추론**한 것이다. 그건 "지금 어떤 상태인가"
            는 답해도 **"어떻게 여기 왔는가"** 는 못 답한다 — 실패가 있었는지, 언제 찍었는지.
            큐가 없으면(마이그레이션 전) 이 칸이 통째로 안 뜬다.
          */}
          {queue && (
            <div className="mb-5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]">
              <p className="flex flex-wrap items-baseline gap-x-3 border-b border-[var(--bd)] px-4 py-2">
                <span className="font-body text-[13px] font-[700] text-[var(--t1)]">큐</span>
                <span className="font-mono text-[11px] text-[var(--t3)]">
                  {queue.total}편
                  {queue.lastMovedAt
                    ? ` · 마지막 움직임 ${new Date(queue.lastMovedAt).toLocaleString('ko-KR')}`
                    : ''}
                </span>
              </p>
              <ul className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-3">
                {JOB_STAGES.map((st) => (
                  <li key={st} className="font-mono text-[12px] tabular-nums">
                    {/* 0 인 단계도 자리를 지킨다 — 빠지면 그 단계가 사라진 걸로 읽힌다. */}
                    <span
                      className={
                        st === 'failed' && queue.counts[st] > 0
                          ? 'text-[var(--error)]'
                          : 'text-[var(--t3)]'
                      }
                    >
                      {JOB_STAGE_KO[st]}
                    </span>{' '}
                    <span
                      className={
                        st === 'failed' && queue.counts[st] > 0
                          ? 'font-[700] text-[var(--error)]'
                          : 'text-[var(--t1)]'
                      }
                    >
                      {queue.counts[st]}
                    </span>
                  </li>
                ))}
              </ul>

              {queue.failed.length > 0 && (
                <ul className="divide-y divide-[var(--bd)] border-t border-[var(--bd)]">
                  {queue.failed.map((j) => (
                    <li key={j.video_id} className="px-4 py-2 font-body text-[13px]">
                      <span className="mr-2 font-mono text-[11px] text-[var(--error)]">● 실패</span>
                      <span className="text-[var(--t1)]">{j.video_id}</span>
                      {j.stage_before_fail && (
                        <span className="ml-2 font-mono text-[11px] text-[var(--t3)]">
                          {JOB_STAGE_KO[j.stage_before_fail as keyof typeof JOB_STAGE_KO] ??
                            j.stage_before_fail}
                          에서 멈춤
                        </span>
                      )}
                      {j.error && (
                        <span className="ml-2 break-keep text-[var(--t2)]">— {j.error}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Signal
              label="구성요소"
              value={String(stat.total)}
              sub="영상이 있어야 할 것"
            />
            <Signal
              label="영상 있음"
              value={`${stat.published}/${stat.total}`}
              sub={pct(stat.published, stat.total)}
              warn={stat.published < stat.total}
            />
            <Signal
              label="파일 살아 있음"
              value={data.storageError ? '못 읽음' : `${stat.live}/${stat.published}`}
              sub={data.storageError ? '스토리지 조회 실패' : '규격 3종 전부'}
              warn={!data.storageError && stat.live < stat.published}
            />
            <Signal
              label="썸네일"
              value={data.storageError ? '—' : `${stat.thumbs}/${stat.published}`}
              sub="YouTube 목록용"
              warn={!data.storageError && stat.thumbs < stat.published}
            />
            <Signal
              label="자막"
              value={data.storageError ? '—' : `${stat.captions}/${stat.published}`}
              sub="WebVTT"
              warn={!data.storageError && stat.captions < stat.published}
            />
            <Signal
              label="재생 시작"
              value={stat.starts === null ? '못 읽음' : String(stat.starts)}
              sub={stat.starts === 0 ? '아직 0회 — 본 사람이 없다' : '누적'}
              warn={stat.starts === 0}
            />
          </div>

          <p className="mb-5 font-mono text-[11px] text-[var(--t3)]">
            발행본 기준 {new Date(data.builtAt).toLocaleString('ko-KR')} · 총{' '}
            {Math.round(stat.seconds / 60)}분 · {mb(stat.bytes)}
          </p>

          {/* 볼 것이 없으면 펴지 않는다. */}
          {problems === 0 ? (
            <p className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3 font-body text-[13px] text-[var(--t2)]">
              구성요소·발행본·실제 파일 셋이 일치합니다. 지금 할 일은 없습니다.
            </p>
          ) : (
            <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]">
              <p className="flex items-center gap-2 border-b border-[var(--bd)] px-4 py-2 font-body text-[13px] font-[700] text-[var(--t1)]">
                <AlertTriangle size={14} className="text-[var(--warning)]" aria-hidden />
                지금 볼 것 {problems}
              </p>
              <ul className="divide-y divide-[var(--bd)]">
                {missing.map((i) => (
                  <li key={`m-${i.id}`} className="px-4 py-2 font-body text-[13px]">
                    <span className="mr-2 font-mono text-[11px] text-[var(--warning)]">◔ 안 만듦</span>
                    <span className="text-[var(--t1)]">{i.name}</span>
                    <span className="ml-2 font-mono text-[11px] text-[var(--t3)]">{i.id}</span>
                    <span className="ml-2 text-[var(--t3)]">
                      — 플랫폼에 있는데 영상이 없습니다
                    </span>
                  </li>
                ))}
                {lost.map((i, n) => (
                  <li key={`l-${i.id}-${n}`} className="px-4 py-2 font-body text-[13px]">
                    <span className="mr-2 font-mono text-[11px] text-[var(--error)]">● 유실</span>
                    <span className="text-[var(--t1)]">{i.id}</span>
                    <span className="ml-2 text-[var(--t3)]">
                      — manifest에 있는데 {i.what} 파일이 없습니다 (화면에서 깨집니다)
                    </span>
                  </li>
                ))}
                {orphan.map((i) => (
                  <li key={`o-${i.id}`} className="px-4 py-2 font-body text-[13px]">
                    <span className="mr-2 font-mono text-[11px] text-[var(--t3)]">· 고아</span>
                    <span className="text-[var(--t1)]">{i.id}</span>
                    <span className="ml-2 text-[var(--t3)]">
                      — 영상은 있는데 그 구성요소가 플랫폼에서 사라졌습니다
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/*
        ── 기획 ──
        「밀린 것」과 다르다. 공장은 번들에 있는 것을 전부 설계도로 만들므로 「안 만든 편」은
        정상 상태에서 늘 0 이고 화면은 "다 했다" 고 말한다. 그런데 **설계도 규칙이 아직 없는
        후보**가 남아 있다 — 없는 것이 목록에 안 보이면 영원히 안 만들어진다.
      */}
      {tab === '기획' && (
        <section>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Signal label="주소 가능한 자리" value={String(plan.addressable)} />
            <Signal label="설계도 있음" value={String(plan.covered)} />
            <Signal
              label="다음에 찍을 것"
              value={String(plan.next.length)}
              warn={plan.next.length > 0}
            />
            <Signal
              label="덮개"
              value={plan.coverage === null ? '—' : `${Math.round(plan.coverage * 100)}%`}
              sub="막힌 자리는 분모에서 뺀다"
            />
          </div>

          {plan.next.length === 0 ? (
            <p className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3 font-body text-[13px] text-[var(--t2)]">
              주소 가능한 자리가 전부 설계도로 있습니다. 새 구성요소가 생기면 여기 뜹니다.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--r-md)] border border-[var(--bd)]">
              <table className="w-full min-w-[640px] border-collapse">
                <caption className="border-b border-[var(--bd)] px-4 py-2 text-left font-body text-[12px] text-[var(--t3)]">
                  재고 큰 순 — 보여 줄 것이 많은 자리를 먼저 찍습니다. 재생 수로 정하는 것이
                  맞지만 <strong>지금 재생은 0</strong> 이라 없는 신호로 순위를 매기지 않습니다.
                </caption>
                <thead>
                  <tr className="border-b border-[var(--bd)] bg-[var(--bg2)] text-left font-body text-[11px] text-[var(--t3)]">
                    <th className="px-4 py-2 font-[600]">구성요소</th>
                    <th className="px-4 py-2 font-[600]">종류</th>
                    <th className="px-4 py-2 text-right font-[600]">재고</th>
                    <th className="px-4 py-2 font-[600]">무엇을 센 수인가</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.next.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--bd)] last:border-0">
                      <td className="break-keep px-4 py-2 font-body text-[13px] text-[var(--t1)]">
                        {r.name}
                        <span className="ml-2 font-mono text-[11px] text-[var(--t3)]">{r.id}</span>
                      </td>
                      <td className="px-4 py-2 font-mono text-[12px] text-[var(--t2)]">{r.kind}</td>
                      <td className="px-4 py-2 text-right font-mono text-[12px] tabular-nums text-[var(--t1)]">
                        {/* null 은 **못 잼**이지 0 이 아니다. */}
                        {r.backing === null ? '못 잼' : r.backing.toLocaleString('ko-KR')}
                      </td>
                      <td className="break-keep px-4 py-2 font-body text-[12px] text-[var(--t3)]">
                        {r.backingLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {plan.blocked.length > 0 && (
            <div className="mt-5 rounded-[var(--r-md)] border border-[var(--warning)] bg-[var(--warning-light)] px-4 py-3">
              <p className="font-body text-[13px] font-[700] text-[var(--warning-ink)]">
                지금 찍으면 안 되는 자리 {plan.blocked.length}
              </p>
              <ul className="mt-2 space-y-1">
                {plan.blocked.map((r) => (
                  <li key={r.id} className="break-keep font-body text-[12px] text-[var(--warning-ink)]">
                    <span className="font-mono">{r.id}</span> · {r.name}
                    <span className="block pl-4 text-[var(--t2)]">— {r.blockedWhy}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/*
        ── 평가 ──
        외부에 **공개된 규격**이 있는 축만 합격/불합격을 매긴다. 없는 축(첫 컷 길이 등)은
        재기만 한다 — 숫자를 지어 놓으면 그게 다음 사람에게 근거처럼 보인다.
      */}
      {tab === '평가' && (
        <section>
          {!evaluation ? (
            <p className="break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3 font-body text-[13px] text-[var(--t2)]">
              평가 기록이 아직 없습니다 — <code className="font-mono">video_jobs</code> 의 평가 열
              마이그레이션 전입니다. <strong>빈 표를 그리지 않는 이유</strong>: 「전부 통과」로
              읽히는데 사실은 판정 자체가 없습니다.
            </p>
          ) : (
            <>
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Signal
                  label="평가한 편"
                  value={`${evaluation.evaluated} / ${evaluation.total}`}
                  sub={
                    evaluation.lastAt
                      ? new Date(evaluation.lastAt).toLocaleString('ko-KR')
                      : '아직 안 돌림'
                  }
                  warn={evaluation.evaluated < evaluation.total}
                />
                <Signal label="전부 통과" value={String(evaluation.clean)} />
                <Signal
                  label="어긋남 있음"
                  value={String(evaluation.failing)}
                  warn={evaluation.failing > 0}
                />
                <Signal
                  label="못 잰 축 있음"
                  value={String(evaluation.incomplete)}
                  sub="합격으로 세지 않음"
                  warn={evaluation.incomplete > 0}
                />
              </div>

              {evaluation.evaluated === 0 ? (
                <p className="break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3 font-body text-[13px] text-[var(--t2)]">
                  아직 한 편도 평가하지 않았습니다. 내보내기 탭의{' '}
                  <code className="font-mono">pnpm video evaluate</code> 를 돌리세요.
                </p>
              ) : evaluation.rows.length === 0 ? (
                <p className="break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3 font-body text-[13px] text-[var(--t2)]">
                  규격을 어긴 편이 없습니다. 판정하는 축은 전부 외부에 공개된 규격을 근거로
                  씁니다 — YouTube 라우드니스·Shorts 길이·Netflix 자막 규격.
                </p>
              ) : (
                <ul className="space-y-3">
                  {evaluation.rows.map((r) => (
                    <li
                      key={r.video_id}
                      className="rounded-[var(--r-md)] border border-[var(--bde)] bg-[var(--bg)]"
                    >
                      <p className="flex flex-wrap items-baseline gap-x-3 border-b border-[var(--bd)] px-4 py-2">
                        <span className="font-body text-[13px] font-[700] text-[var(--t1)]">
                          {r.video_id}
                        </span>
                        <span className="font-mono text-[11px] text-[var(--t3)]">
                          {r.kind} · 통과 {r.eval_pass ?? 0} · 어긋남 {r.eval_fail ?? 0}
                          {(r.eval_unknown ?? 0) > 0 ? ` · 못 잼 ${r.eval_unknown}` : ''}
                        </span>
                      </p>
                      <ul className="space-y-2 px-4 py-3">
                        {(r.eval_axes ?? [])
                          .filter((a) => a.verdict === 'fail' || a.verdict === 'unknown')
                          .map((a) => (
                            <li key={a.id} className="break-keep font-body text-[12px]">
                              {/* 기호 + 글자 — 색만으로 말하지 않는다(색약 대응). */}
                              <span className="font-mono text-[var(--t2)]">
                                {a.verdict === 'fail' ? '✗ 어긋남' : '? 못 잼'}
                              </span>{' '}
                              <span className="text-[var(--t1)]">{a.label}</span>{' '}
                              <span className="text-[var(--t2)]">{a.value}</span>
                              {a.limit && (
                                <span className="text-[var(--t3)]"> · 규격 {a.limit}</span>
                              )}
                              {a.offenders.length > 0 && (
                                <span className="block pl-5 font-mono text-[11px] text-[var(--t3)]">
                                  {a.offenders.slice(0, 6).join(' · ')}
                                  {a.offenders.length > 6
                                    ? ` 외 ${a.offenders.length - 6}건`
                                    : ''}
                                </span>
                              )}
                            </li>
                          ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      {tab === '구성요소' && (
        <section>
          {ORDER.map((kind) => {
            const rows = data.rows.filter((r) => r.kind === kind)
            if (rows.length === 0) return null
            const ok = rows.filter((r) => r.published).length
            return (
              <div key={kind} className="mb-6">
                <h2 className="mb-2 font-display text-[14px] font-[700] text-[var(--t1)]">
                  {KIND_LABEL[kind]}{' '}
                  <span className="font-mono text-[12px] font-[400] tabular-nums text-[var(--t3)]">
                    {ok}/{rows.length}
                  </span>
                </h2>
                <div className="overflow-x-auto rounded-[var(--r-md)] border border-[var(--bd)]">
                  <table className="w-full border-collapse font-body text-[13px]">
                    <thead>
                      <tr className="bg-[var(--bg2)] text-left text-[var(--t3)]">
                        <th className="px-3 py-2 font-[600]">구성요소</th>
                        <th className="px-3 py-2 font-[600]">영상</th>
                        <th className="px-3 py-2 font-[600]">길이</th>
                        <th className="px-3 py-2 font-[600]">규격</th>
                        <th className="px-3 py-2 font-[600]">썸네일·자막</th>
                        <th className="px-3 py-2 font-[600]">재생</th>
                        <th className="px-3 py-2 font-[600]">조치</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const all = liveAll(r)
                        const starts = data.views.byId?.[r.id] ?? null
                        return (
                          <tr key={r.id} className="border-t border-[var(--bd)]">
                            <td className="px-3 py-2">
                              <span className="text-[var(--t1)]">{r.name}</span>
                              <span className="ml-2 font-mono text-[11px] text-[var(--t3)]">
                                {r.id}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono text-[12px]">
                              {retiredIds[r.id] ? (
                                <span className="text-[var(--warning)]">⊘ 내림</span>
                              ) : r.published ? (
                                <span className="text-[var(--success)]">● 있음</span>
                              ) : (
                                <span className="text-[var(--warning)]">◔ 없음</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-[12px] tabular-nums text-[var(--t2)]">
                              {r.seconds === null ? '—' : `${r.seconds.toFixed(1)}초`}
                            </td>
                            <td className="px-3 py-2 font-mono text-[12px]">
                              {all === null ? (
                                <span className="text-[var(--t3)]">? 못 잼</span>
                              ) : all ? (
                                <span className="text-[var(--success)]">● 3/3</span>
                              ) : (
                                <span className="text-[var(--error)]">
                                  ●{' '}
                                  {
                                    (['wide', 'vertical', 'square'] as const).filter(
                                      (f) => r.live?.[f],
                                    ).length
                                  }
                                  /3
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-[12px]">
                              {r.thumb === null ? (
                                <span className="text-[var(--t3)]">? 못 잼</span>
                              ) : (
                                <span
                                  className={
                                    r.thumb && r.captions
                                      ? 'text-[var(--success)]'
                                      : 'text-[var(--error)]'
                                  }
                                >
                                  {r.thumb ? '●' : '○'} {r.captions ? '●' : '○'}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-[12px] tabular-nums text-[var(--t2)]">
                              {starts === null ? '—' : starts}
                            </td>
                            <td className="px-3 py-1">
                              <VideoActions
                                videoId={r.id}
                                published={r.published}
                                retired={retiredIds[r.id] ?? null}
                                compact
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </section>
      )}

      {tab === '수치 낡음' && (
        <section>
          <p className="mb-5 break-keep font-body text-[13px] leading-relaxed text-[var(--t2)]">
            영상은 <strong>찍은 날의 스냅샷</strong>입니다. DB 는 계속 자라므로 화면에 박힌 수는
            반드시 묵습니다 — 그래서 &quot;틀렸다&quot; 가 아니라 <strong>얼마나 달라졌는지</strong>만
            보여 줍니다. 다시 찍을지는 사람이 정합니다.
            <br />
            <span className="text-[var(--t3)]">
              임계값을 두지 않았습니다 — 근거 없이 정한 경계는 판단을 대신해 주지 않습니다.
              많이 달라진 것부터 나옵니다.
            </span>
          </p>

          {drift.length === 0 ? (
            <p className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3 font-body text-[13px] text-[var(--t2)]">
              발행본의 수치가 지금 값과 같습니다. 다시 찍을 이유가 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--r-md)] border border-[var(--bd)]">
              <table className="w-full border-collapse font-body text-[13px]">
                <thead>
                  <tr className="bg-[var(--bg2)] text-left text-[var(--t3)]">
                    <th className="px-3 py-2 font-[600]">영상</th>
                    <th className="px-3 py-2 font-[600]">수치</th>
                    <th className="px-3 py-2 font-[600]">박힌 값</th>
                    <th className="px-3 py-2 font-[600]">지금</th>
                    <th className="px-3 py-2 font-[600]">차이</th>
                  </tr>
                </thead>
                <tbody>
                  {drift.map((d) => (
                    <tr key={`${d.id}-${d.label}`} className="border-t border-[var(--bd)]">
                      <td className="px-3 py-2">
                        <span className="text-[var(--t1)]">{d.title}</span>
                        <span className="ml-2 font-mono text-[11px] text-[var(--t3)]">{d.id}</span>
                      </td>
                      <td className="px-3 py-2 text-[var(--t2)]">{d.label}</td>
                      <td className="px-3 py-2 font-mono text-[12px] tabular-nums text-[var(--t3)]">
                        {d.published.toLocaleString('ko-KR')}
                      </td>
                      <td className="px-3 py-2 font-mono text-[12px] tabular-nums text-[var(--t1)]">
                        {d.now.toLocaleString('ko-KR')}
                      </td>
                      <td className="px-3 py-2 font-mono text-[12px] tabular-nums">
                        {/* 색만으로 말하지 않는다 — 부호를 함께 낸다. */}
                        <span
                          className={
                            d.ratio > 0 ? 'text-[var(--success)]' : 'text-[var(--warning)]'
                          }
                        >
                          {d.ratio > 0 ? '▲ +' : '▼ '}
                          {Math.round(d.ratio * 100)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === '내보내기' && (
        <section className="flex flex-col gap-4">
          <p className="font-body text-[13px] leading-relaxed text-[var(--t2)]">
            렌더는 헤드리스 크롬으로 프레임을 한 장씩 찍습니다 — 전량이면 약 90분, 177MB.
            서버에서 돌릴 수 있는 일이 아니라 <strong>로컬에서 아래 순서로</strong> 실행합니다.
            앞 두 단계는 재실행 안전이라 몇 번 돌려도 결과가 같습니다.
          </p>

          <CommandBlock
            title="⓪ 기획 → ⑧ 평가 (전량)"
            lines={[
              'pnpm video plan',
              'pnpm video:source',
              'pnpm video voice',
              'pnpm video render-all',
              'pnpm video loudness --fix',
              'pnpm video thumbs',
              'pnpm --filter @vocaflow/video-factory package',
              'pnpm --filter @vocaflow/video-factory publish',
              'pnpm video evaluate',
              '# 그리고 apps/web/src/lib/video/manifest.json 을 커밋해야 화면에 뜬다',
            ]}
          />

          {missing.length > 0 && (
            <CommandBlock
              title={`② 밀린 것만 (${missing.length}편)`}
              lines={[
                'pnpm video:source',
                `pnpm video voice ${missing.map((m) => m.id).join(' ')}`,
                `pnpm video render ${missing.map((m) => m.id).join(' ')}`,
                'pnpm video loudness --fix',
                `pnpm video thumbs ${missing.map((m) => m.id).join(' ')}`,
                'pnpm --filter @vocaflow/video-factory package',
                'pnpm --filter @vocaflow/video-factory publish',
              ]}
            />
          )}

          <CommandBlock
            title="③ 어긋남만 확인 (렌더 안 함)"
            lines={[
              'pnpm video plan',
              'pnpm video evaluate --full',
              'pnpm video stale',
              'pnpm video list',
              'pnpm video loudness',
            ]}
          />

          {/*
            **여기부터는 기계가 못 한다.** 채널 개설과 업로드는 그 계정의 주인만 할 수 있다.
            할 수 없는 일을 버튼으로 만들어 두면 눌러 보고 나서야 안 된다는 걸 알게 된다.
          */}
          <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
            <p className="mb-2 font-body text-[13px] font-[700] text-[var(--t1)]">
              YouTube 업로드 — 사람이 해야 하는 단계
            </p>
            <ol className="mb-3 flex list-decimal flex-col gap-1 pl-5 font-body text-[13px] leading-relaxed text-[var(--t2)]">
              <li>채널 개설 (계정 주인만 가능)</li>
              <li>
                <code className="font-mono text-[12px]">dist-media/youtube.json</code> 의 편마다
                본편(가로) 업로드 → 제목·설명·태그 붙여넣기
              </li>
              <li>자막(.vtt)과 썸네일(1280×720) 첨부 — 자동 자막보다 정확합니다</li>
              <li>세로(Shorts)는 같은 편을 Shorts 로 따로 올립니다</li>
            </ol>
            <p className="font-body text-[13px] leading-relaxed text-[var(--t2)]">
              포장 단계가 <code className="font-mono text-[12px]">dist-media/youtube.json</code> 에
              편당 제목·설명·태그·자막·썸네일과 본편(가로)·Shorts(세로) 경로를 적어 둡니다.
              설명란에는 화면에 나온 수치의 <strong>출처와 측정일</strong>이 함께 들어갑니다 —
              근거 없는 수치를 올리지 않기 위해서입니다.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
