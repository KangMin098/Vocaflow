// apps/web/src/components/home/TodayPrescriptionCard.tsx
//
// hub "오늘"의 스마트 기본값 — CTP prescribe_today 5블록 처방 카드 (server component).
// META 확정(2026-07-11 · Opt A): 진단 완료 + 오늘 수동계획 없음 → 이 카드가 hub "오늘"의 정본.
//   수동계획(study_plan_items 오늘)이 있으면 그게 우선(TodayPlanCard) — 사용자 의지 존중(Empathetic).
//
// 5블록: ① 복습(FSRS due) ② 듣기(EchoMatch) ③ 읽기(stage 후보) ④ 연습(DCP→/practice/dcp) ⑤ 점검(ScriptQuiz).
// Calm UI · Implicit Progress(번호 스텝) · 색+아이콘 이중부호 · 컴팩트 sm 런처(36px, 형제 홈카드 일관) · 다크 토큰 대응.
// Phase 2: ④ 연습 블록이 active 면 /practice/dcp(order/insert·채점·error_cause) 로 진입.

import {
  BookOpenText,
  ClipboardCheck,
  Headphones,
  ListOrdered,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'

import type { PrescriptionCandidate, TodayPrescription } from '@/lib/learner/prescription-actions'

import { PrescriptionArticleLaunch } from './PrescriptionArticleLaunch'

const REGISTER_LABEL: Record<string, string> = {
  expository: '설명문',
  argumentative: '논증문',
  narrative: '서사',
  academic: '학술',
  reference: '자료',
}

export function TodayPrescriptionCard({ data }: { data: TodayPrescription }) {
  const listeningHref = data.listeningTextId ? `/text/${data.listeningTextId}/echo` : '/library/books'
  const candidates = data.input.candidates.slice(0, 4)

  return (
    <section
      aria-label="오늘의 학습 처방"
      className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--p)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)]"
    >
      <header className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10.5px] font-[700] uppercase tracking-[0.10em] text-[var(--p)]">
            오늘의 맞춤 학습
          </p>
          <h2 className="mt-0.5 font-display text-[14px] font-[800] text-[var(--t1)]">
            학습 흐름에 맞춘 오늘 분량
          </h2>
        </div>
        <span
          className="shrink-0 rounded-[var(--r-sm)] bg-[var(--p-light)] px-2 py-0.5 font-mono text-[11px] font-[700] text-[var(--on-p-tint)]"
          title={`학습 스테이지 ${data.stage}`}
        >
          {data.stage}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-[var(--t2)]">약 {data.totalMinutes}분</span>
      </header>

      <ol className="flex flex-col gap-2">
        {/* ① 복습 — FSRS due */}
        <BlockRow
          step={1}
          icon={RotateCcw}
          title="복습"
          meta={data.dueCount > 0 ? `기억이 흐려지는 ${data.dueCount}개 · 10분` : '오늘 복습할 단어는 없어요 · 10분'}
        >
          {data.dueCount > 0 ? (
            <LaunchLink href="/flashcard/play" label="시작" />
          ) : (
            <StatusPill label="완료" tone="ok" />
          )}
        </BlockRow>

        {/* ② 듣기 — EchoMatch */}
        <BlockRow step={2} icon={Headphones} title="따라읽기" meta="원어민 음성으로 소리내어 · 10분">
          <LaunchLink href={listeningHref} label="시작" />
        </BlockRow>

        {/* ③ 읽기 — stage_band 후보 */}
        <BlockRow
          step={3}
          icon={BookOpenText}
          title="읽기"
          meta={`${data.input.stageBand} 수준 지문 · 30분`}
        >
          {candidates.length === 0 && <LaunchLink href="/library/books" label="자료 보기" />}
        </BlockRow>
        {candidates.length > 0 && (
          <li className="ml-[38px] flex flex-col gap-1.5">
            {candidates.map((c) => (
              <CandidateRow key={`${c.kind}:${c.id}`} candidate={c} />
            ))}
          </li>
        )}

        {/* ④ 연습(DCP) — 문장 배열·삽입 인터랙션(Phase 2) */}
        <BlockRow
          step={4}
          icon={ListOrdered}
          title="구문 연습"
          meta={
            data.practiceActive
              ? `문장 배열·삽입 ${data.practiceCount}개 · 15분`
              : '이 단계에서는 아직 열리지 않았어요'
          }
        >
          {data.practiceActive ? (
            <LaunchLink href="/practice/dcp" label="시작" />
          ) : (
            <StatusPill label="—" tone="muted" />
          )}
        </BlockRow>

        {/* ⑤ 점검 — ScriptQuiz */}
        <BlockRow step={5} icon={ClipboardCheck} title="점검" meta="의미 통합 확인 · 10분">
          <LaunchLink href="/scriptquiz" label="시작" />
        </BlockRow>
      </ol>

      <p className="font-body text-[11px] leading-relaxed text-[var(--t2)]">
        학습 흔적에 맞춰 매일 새로 짜여요.{' '}
        <Link
          href="/plan"
          className="font-[700] text-[var(--p)] no-underline transition-colors hover:text-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          직접 계획을 짜면
        </Link>{' '}
        그날은 계획이 우선돼요.
      </p>
    </section>
  )
}

// ────────────────────────────────────────────────────────────
// 블록 행 — 번호 스텝 + 아이콘 + 제목/메타 + 우측 런처/상태
// ────────────────────────────────────────────────────────────
function BlockRow({
  step,
  icon: Icon,
  title,
  meta,
  children,
}: {
  step: number
  icon: LucideIcon
  title: string
  meta: string
  children?: React.ReactNode
}) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[var(--bg3)] font-mono text-[11px] font-[700] text-[var(--t2)]"
        aria-hidden
      >
        {step}
      </span>
      <span
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[var(--p-light)] text-[var(--on-p-tint)]"
        aria-hidden
      >
        <Icon size={16} strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[13px] font-[800] text-[var(--t1)]">{title}</span>
        <span className="block truncate font-body text-[11.5px] text-[var(--t2)]">{meta}</span>
      </span>
      {children && <span className="shrink-0">{children}</span>}
    </li>
  )
}

function LaunchLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[36px] items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 font-display text-[12px] font-[700] text-[var(--t2)] no-underline transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:border-[var(--p)] hover:bg-[var(--p-light)] hover:text-[var(--on-p-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] active:translate-y-0"
    >
      {label}
    </Link>
  )
}

function StatusPill({ label, tone }: { label: string; tone: 'ok' | 'soon' | 'muted' }) {
  const styleByTone: Record<typeof tone, { bg: string; color: string }> = {
    ok: { bg: 'var(--success-light)', color: 'var(--success-ink)' },
    soon: { bg: 'var(--p-light)', color: 'var(--on-p-tint)' },
    muted: { bg: 'var(--bg3)', color: 'var(--t2)' },
  }
  const s = styleByTone[tone]
  return (
    <span
      className="inline-flex min-h-[28px] items-center rounded-[var(--r-sm)] px-2 font-display text-[11px] font-[700]"
      style={{ background: s.bg, color: s.color }}
    >
      {label}
    </span>
  )
}

// ────────────────────────────────────────────────────────────
// 읽기 후보 행 — book 은 Link 직결, article 은 client 런처(texts 변환)
// ────────────────────────────────────────────────────────────
function CandidateRow({ candidate: c }: { candidate: PrescriptionCandidate }) {
  const registerLabel = c.register ? (REGISTER_LABEL[c.register] ?? c.register) : null
  return (
    <span className="flex items-center gap-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[12px] font-[700] text-[var(--t1)]">{c.title}</span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--t2)]">
          {c.vLevel != null && <span>V{c.vLevel}</span>}
          {registerLabel && <span>· {registerLabel}</span>}
          {c.cefrLevel && <span>· {c.cefrLevel}</span>}
        </span>
      </span>
      {c.kind === 'book' ? (
        <Link
          href={`/library/books/${c.id}`}
          aria-label={`${c.title} 읽기`}
          className="inline-flex min-h-[36px] shrink-0 items-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-2.5 font-display text-[12px] font-[700] text-[var(--t2)] no-underline transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:border-[var(--p)] hover:bg-[var(--p-light)] hover:text-[var(--on-p-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] active:translate-y-0"
        >
          읽기
        </Link>
      ) : (
        <PrescriptionArticleLaunch articleId={c.id} />
      )}
    </span>
  )
}
