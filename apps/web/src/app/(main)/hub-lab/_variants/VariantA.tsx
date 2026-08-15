// apps/web/src/app/(main)/hub-lab/_variants/VariantA.tsx
//
// 후보 A — "오늘 하나" (Single-Focus).
//
// 현행 /hub 의 결함을 정면으로 겨냥한다:
//   ① 히어로가 인사말 하나에 140px 를 쓴다        → 히어로가 오늘의 진행·지금 할 일·시작을 전부 진다
//   ② 처방 5블록이 전부 같은 무게로 나열된다      → 하나만 크게, 나머지 넷은 종속 스트립
//   ③ 빈 상태 카드가 페이지 중앙을 점거한다        → 데이터 없으면 그 자리를 아예 만들지 않는다
//   ④ 7개 동일 카드에 "아직 학습 전" 이 다섯 번    → 그리드 폐기. 도구는 사이드바가 이미 판다
//   ⑦ "V-Level 갱신 확인" 이 학습 진입면에 있다    → 관리 기능 제거
//
// 설계 원칙: 진입면이 답해야 하는 질문은 "무엇이 있나" 가 아니라 **"지금 뭘 하지"** 하나다.
// 나머지는 전부 그 질문에 종속시킨다. Calm UI 를 "조용한 장식" 이 아니라 "선택지 축소" 로 읽는다.

'use client'

import { useState } from 'react'

import {
  ArrowRight,
  BookOpenText,
  Check,
  ClipboardCheck,
  Compass,
  Headphones,
  ListOrdered,
  Loader2,
  Lock,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useHubData } from '@/hooks/useHubData'
import { startArticleLearning } from '@/lib/articles/start-learning'
import { PRESCRIPTION_BLOCK_NAME } from '@/lib/learner/prescription-blocks'
import type { TodayPrescription } from '@/lib/learner/prescription-actions'

// ────────────────────────────────────────────────────────────
// 블록 정의 — 처방 5블록. 순서가 곧 오늘의 흐름이다.
// ────────────────────────────────────────────────────────────
interface Block {
  key: string
  icon: LucideIcon
  /** 표시 이름 — prescription-blocks 레지스트리에서 온다(화면에서 짓지 않는다) */
  short: string
  /** 지금 할 일로 승격됐을 때 쓰는 문장 — 명사가 아니라 "무엇을 왜" */
  headline: string
  minutes: number
  href: string
  /**
   * article 후보로 진입하는 블록. article 은 URL 직결이 불가하고
   * startArticleLearning 이 texts 행으로 변환한 뒤에야 /text/[id] 가 생긴다
   * (PrescriptionArticleLaunch 와 같은 계약). 이 값이 있으면 CTA 는 버튼이 된다.
   */
  articleId?: string
  done: boolean
  locked: boolean
}

/** KST 오늘 00:00 (UTC ms) — 활동이 "오늘" 것인지 판정한다. */
function kstTodayStartMs(): number {
  const KST = 9 * 3_600_000
  return Math.floor((Date.now() + KST) / 86_400_000) * 86_400_000 - KST
}

export function VariantA({
  prescription,
  hasTodayPlan,
}: {
  prescription: TodayPrescription | null
  hasTodayPlan: boolean
}) {
  const { data, isLoading } = useHubData()

  // 오늘 이미 손댄 모듈 — 처방에는 완료 상태가 없으므로 활동 기록에서 읽는다.
  // (여기서 상수를 쓰면 이 화면은 다시 "누구에게나 같은 숫자" 가 된다.)
  const todayStart = kstTodayStartMs()
  const touchedToday = new Set(
    (data?.recentActivities ?? [])
      .filter((a) => new Date(a.createdAt).getTime() >= todayStart)
      .map((a) => String(a.module)),
  )

  // ── 미진단: 오늘 분량 자체가 없다. 진단 하나만 남긴다.
  if (!prescription?.isDiagnosed) {
    return <UndiagnosedFocus />
  }

  const p = prescription
  const blocks: Block[] = [
    {
      key: 'review',
      icon: RotateCcw,
      short: PRESCRIPTION_BLOCK_NAME.review,
      headline:
        p.dueCount > 0
          ? `기억이 흐려진 단어 ${p.dueCount}개를 다시 만나요`
          : '오늘 복습할 단어는 없어요',
      minutes: 10,
      href: '/flashcard/play',
      done: p.dueCount === 0,
      locked: false,
    },
    {
      key: 'listen',
      icon: Headphones,
      short: PRESCRIPTION_BLOCK_NAME.listen,
      headline: '원어민 음성을 따라 소리 내어 읽어요',
      minutes: 10,
      href: p.listeningTextId ? `/text/${p.listeningTextId}/echo` : '/library/books',
      done: touchedToday.has('echomatch'),
      locked: false,
    },
    {
      key: 'read',
      icon: BookOpenText,
      short: PRESCRIPTION_BLOCK_NAME.read,
      headline: `${p.input.stageBand} 수준 지문을 하나 읽어요`,
      minutes: 30,
      href: readHref(p),
      articleId: readArticleId(p),
      done: touchedToday.has('textviewer'),
      locked: false,
    },
    {
      key: 'practice',
      icon: ListOrdered,
      short: PRESCRIPTION_BLOCK_NAME.syntax,
      headline: `문장 배열·삽입 ${p.practiceCount}개로 구조를 잡아요`,
      minutes: 15,
      href: '/practice/dcp',
      done: false,
      locked: !p.practiceActive,
    },
    {
      key: 'check',
      icon: ClipboardCheck,
      short: PRESCRIPTION_BLOCK_NAME.check,
      headline: '오늘 읽은 것이 남았는지 확인해요',
      minutes: 10,
      href: '/scriptquiz',
      done: touchedToday.has('scriptquiz'),
      locked: false,
    },
  ]

  const now = blocks.find((b) => !b.done && !b.locked) ?? null
  const doneCount = blocks.filter((b) => b.done).length

  const cont = data?.continueCard ?? null

  return (
    <div className="flex flex-col gap-5">
      {/* ═══════════ 오늘의 무대 ═══════════
          C1 에서 히어로는 좌측 40% 만 쓰고 우측이 비었고, 잔여 블록은 아래에서 거의 안 보였고,
          1440×900 하단 60% 가 공백이었다. 셋 다 원인이 같다 — **오늘 전체가 한 장면이 아니었다.**
          그래서 진행·지금 할 일·나머지를 하나의 무대 안에 넣는다:
            좌 = 지금 할 일 하나 (이 화면에서 가장 큰 글자)
            우 = 오늘의 흐름 5블록 (진행 표시이자 이동 수단)
          인사말은 없다 — 매일 같은 문장이 화면에서 가장 큰 글자일 이유가 없다.

          min-h 가 46dvh 인 이유: C2 에서 56dvh 로 뒀더니 콘텐츠(≈250px)보다 훨씬 커서
          무대 안쪽 위아래에 130px 짜리 빈 띠가 생겼고, 그게 여백이 아니라 버그로 읽혔다. */}
      <section
        aria-label="오늘"
        className="relative overflow-hidden rounded-ios-2xl px-6 py-8 text-[var(--ti)] shadow-ios-3 md:px-9 md:py-10 lg:grid lg:min-h-[46dvh] lg:grid-cols-[1.5fr_minmax(268px,1fr)] lg:gap-10"
        style={{
          backgroundImage:
            'linear-gradient(135deg, var(--p-dark) 0%, var(--p) 62%, var(--p) 100%)',
        }}
      >
        {/* ── 좌: 지금 ── */}
        <div className="flex flex-col lg:justify-center">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.16em] opacity-70">
              오늘
            </span>
            <span
              className="rounded-ios-pill px-2 py-0.5 font-mono text-[10.5px] font-[700] tabular-nums"
              style={{ background: 'rgb(255 255 255 / 0.16)' }}
              title={`학습 스테이지 ${p.stage}`}
            >
              {p.stage}
            </span>
            <span className="font-mono text-[11px] tabular-nums opacity-70">
              약 {p.totalMinutes}분
            </span>
          </div>

          {now ? (
            <>
              {/* 한국어 줄바꿈: keep-all 이 없으면 조사가 다음 줄 첫 글자로 떨어진다
                  (C1 실측 — "…단어 242개 / 를 다시 만나요"). balance 로 줄 길이도 고르게. */}
              <h1 className="mt-5 max-w-[17ch] font-editorial text-[30px] font-[500] leading-[1.18] tracking-[-0.014em] [word-break:keep-all] [text-wrap:balance] md:text-[40px]">
                {now.headline}
              </h1>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <StartNow block={now} />
                <span className="font-mono text-[11.5px] tabular-nums opacity-70">
                  {now.short} · {now.minutes}분
                </span>
              </div>
            </>
          ) : (
            <p className="mt-5 max-w-[20ch] font-editorial text-[26px] font-[500] leading-[1.25] tracking-[-0.012em] [word-break:keep-all] [text-wrap:balance] md:text-[32px]">
              오늘 분량은 다 했어요. 여기서 멈춰도 괜찮아요.
            </p>
          )}

          {/* 처방 계산 실패 — 폴백임을 말한다. 침묵하면 "할 게 없다" 로 읽힌다. */}
          {p.unavailable && (
            <p
              role="status"
              className="mt-6 max-w-[46ch] rounded-[var(--r-md)] px-3 py-2 font-body text-[12px] leading-[1.6] [word-break:keep-all]"
              style={{ background: 'rgb(255 255 255 / 0.12)' }}
            >
              지금 오늘 분량을 계산하지 못했어요. 위 내용은 기본 안내라 내 상태와 다를 수 있어요.
            </p>
          )}
        </div>

        {/* ── 우: 오늘의 흐름 ──
            진행 막대가 아니라 흐름 자체를 보여준다. 지나온 것·지금·남은 것이 한 열에 있고,
            남은 것은 눌러서 건너뛸 수도 있다(자율성). 완료는 색+체크 이중부호. */}
        <div className="mt-8 lg:mt-0 lg:flex lg:flex-col lg:justify-center">
          <div
            className="mb-3 flex items-baseline gap-2 border-b pb-2"
            style={{ borderColor: 'rgb(255 255 255 / 0.16)' }}
          >
            <h2 className="font-mono text-[10px] font-[700] uppercase tracking-[0.16em] opacity-85">
              오늘의 흐름
            </h2>
            <span className="ml-auto font-mono text-[11px] font-[700] tabular-nums opacity-75">
              <span className="sr-only">진행 </span>
              {doneCount}/{blocks.length}
            </span>
          </div>

          <ol className="flex flex-col">
            {blocks.map((b, i) => (
              <FlowRow
                key={b.key}
                block={b}
                isNow={b === now}
                isLast={i === blocks.length - 1}
              />
            ))}
          </ol>
        </div>
      </section>

      {/* ═══════════ 이어하기 ═══════════
          데이터가 없으면 자리 자체를 만들지 않는다. 빈 카드가 공간을 먹는 것이 결함 ③ 이었다. */}
      {cont && (
        <section aria-label="이어하기">
          <h2 className="mb-2 font-body text-[11.5px] text-[var(--t3)]">읽던 것</h2>
          <Link
            href={`/text/${cont.textId}`}
            className="group flex items-center gap-3 rounded-ios-2xl bg-[var(--bg)] px-4 py-3.5 no-underline shadow-ios-1 motion-safe:transition-all motion-safe:duration-[var(--dur-ios-normal)] motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-ios-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <span className="text-[20px]" aria-hidden>
              {cont.coverEmoji ?? '📄'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-[13.5px] font-[700] text-[var(--t1)]">
                {cont.title}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
                {cont.progressPercent}% · {cont.relativeTime}
              </span>
            </span>
            <ArrowRight
              size={16}
              className="shrink-0 text-[var(--t3)] transition-colors group-hover:text-[var(--p)]"
              aria-hidden
            />
          </Link>
        </section>
      )}

      {/* 계획을 직접 짠 날이면 그 사실만 한 줄로 — 처방과 경쟁시키지 않는다 */}
      {hasTodayPlan && (
        <p className="font-body text-[11.5px] text-[var(--t3)]">
          오늘은 직접 짠 계획이 있어요.{' '}
          <Link
            href="/plan"
            className="font-[700] text-[var(--p)] no-underline hover:text-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            계획 보기
          </Link>
        </p>
      )}

      {isLoading && <span className="sr-only">학습 기록을 불러오는 중</span>}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 시작 버튼 — 이 화면의 유일한 1차 행동. 골드는 여기에만 쓴다.
// article 후보는 링크가 아니라 서버액션을 거쳐야 /text/[id] 가 생긴다.
// ────────────────────────────────────────────────────────────
const START_CLASS =
  'inline-flex min-h-[48px] items-center gap-2 rounded-ios-pill px-5 font-display text-[14px] font-[700] no-underline shadow-[0_4px_18px_rgb(0_0_0_/_0.22)] motion-safe:transition-all motion-safe:duration-[var(--dur-ios-normal)] motion-safe:hover:brightness-110 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-progress disabled:opacity-70'

function StartNow({ block }: { block: Block }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const Icon = block.icon

  if (!block.articleId) {
    return (
      <Link href={block.href} className={START_CLASS} style={{ background: 'var(--active)', color: 'var(--p-dark)' }}>
        <Icon size={16} strokeWidth={2} aria-hidden />
        지금 시작
        <ArrowRight size={15} aria-hidden />
      </Link>
    )
  }

  async function launch() {
    if (busy || !block.articleId) return
    setBusy(true)
    setError(null)
    const res = await startArticleLearning(block.articleId)
    if (res.ok) {
      router.push(`/text/${res.textId}?mode=read`)
      return
    }
    setError(res.error)
    setBusy(false)
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={launch}
        disabled={busy}
        className={START_CLASS}
        style={{ background: 'var(--active)', color: 'var(--p-dark)' }}
      >
        {busy ? (
          <Loader2 size={16} strokeWidth={2} className="animate-spin" aria-hidden />
        ) : (
          <Icon size={16} strokeWidth={2} aria-hidden />
        )}
        지금 시작
        <ArrowRight size={15} aria-hidden />
      </button>
      {error && (
        <span role="alert" className="font-body text-[11.5px] opacity-90">
          {error}
        </span>
      )}
    </span>
  )
}

// ────────────────────────────────────────────────────────────
// 오늘의 흐름 한 줄 — 무대(딥잉크) 안에서 렌더된다.
//
// 진행 막대가 아니라 "흐름" 인 이유: 막대는 몇 % 인지만 말하고, 학습자가 실제로 궁금한
// "뭘 지나왔고 뭐가 남았나" 는 말하지 않는다. 지나온 것은 흐리게 남겨 두고(완료의 흔적),
// 남은 것은 눌러서 건너뛸 수 있게 둔다(SDT 자율성 — 순서를 강제하지 않는다).
// 상태는 색 + 아이콘 + 불투명도 3중 부호 (색만으로 전달 금지).
// ────────────────────────────────────────────────────────────
function FlowRow({ block: b, isNow, isLast }: { block: Block; isNow: boolean; isLast: boolean }) {
  const StateIcon = b.done ? Check : b.locked ? Lock : b.icon
  const state = b.done ? '완료' : b.locked ? '아직 열리지 않음' : isNow ? '지금' : `${b.minutes}분`

  const marker = (
    <span className="relative flex flex-col items-center self-stretch" aria-hidden>
      <span
        className="mt-[9px] inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
        style={{
          background: b.done
            ? 'var(--active)'
            : isNow
              ? 'rgb(255 255 255 / 0.92)'
              : 'rgb(255 255 255 / 0.16)',
          color: b.done ? 'var(--p-dark)' : isNow ? 'var(--p)' : 'rgb(255 255 255 / 0.78)',
        }}
      >
        <StateIcon size={12} strokeWidth={2.2} />
      </span>
      {/* 연결선 — C2 에서 0.14 로 뒀더니 사실상 안 보여서 타임라인이 그냥 목록으로 읽혔다.
          이 선이 "지나온 것 → 지금 → 남은 것" 이라는 시간 축을 만드는 유일한 장치다. */}
      {!isLast && (
        <span
          className="w-px flex-1"
          style={{ background: b.done ? 'rgb(176 132 58 / 0.65)' : 'rgb(255 255 255 / 0.26)' }}
        />
      )}
    </span>
  )

  const label = (
    <span className="flex min-w-0 flex-1 items-baseline gap-2 pb-3 pt-2">
      <span
        className={`min-w-0 truncate font-display text-[13px] ${isNow ? 'font-[800]' : 'font-[600]'}`}
        style={{ opacity: b.done ? 0.62 : b.locked ? 0.45 : 1 }}
      >
        {b.short}
      </span>
      <span
        className="ml-auto shrink-0 font-mono text-[10.5px] tabular-nums"
        style={{ opacity: b.done ? 0.5 : b.locked ? 0.4 : isNow ? 0.85 : 0.6 }}
      >
        {state}
      </span>
    </span>
  )

  const rowBase = 'flex items-stretch gap-3 rounded-[var(--r-md)] pl-2 pr-2.5'

  // 지금 · 완료 · 잠김은 이동 대상이 아니다(지금은 위 CTA 가, 나머지는 열려 있지 않다).
  if (isNow || b.done || b.locked) {
    return (
      <li
        className={rowBase}
        style={isNow ? { background: 'rgb(255 255 255 / 0.07)' } : undefined}
        aria-label={`${b.short} — ${state}`}
        aria-current={isNow ? 'step' : undefined}
      >
        {marker}
        {label}
      </li>
    )
  }

  return (
    <li>
      <Link
        href={b.href}
        aria-label={`${b.short} ${b.minutes}분 먼저 하기`}
        className={`${rowBase} text-[var(--ti)] no-underline motion-safe:transition-colors motion-safe:duration-[var(--dur-ios-fast)] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}
      >
        {marker}
        {label}
      </Link>
    </li>
  )
}

// ────────────────────────────────────────────────────────────
// 미진단 — 오늘 분량이 존재하지 않는다. 화면에 남길 것은 하나뿐이다.
// ────────────────────────────────────────────────────────────
function UndiagnosedFocus() {
  return (
    <section
      aria-label="진단 안내"
      className="relative overflow-hidden rounded-ios-2xl px-6 py-9 text-[var(--ti)] shadow-ios-3 md:px-9 md:py-12"
      style={{ backgroundImage: 'linear-gradient(135deg, var(--p-dark) 0%, var(--p) 70%)' }}
    >
      <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.16em] opacity-70">
        시작
      </span>
      <h1 className="mt-4 max-w-[18ch] font-editorial text-[30px] font-[500] leading-[1.16] tracking-[-0.014em] md:text-[36px]">
        어디서 시작할지부터 정해요
      </h1>
      <p className="mt-3 max-w-[34ch] font-body text-[13.5px] leading-[1.7] opacity-80">
        10분이면 지금 읽을 수 있는 수준을 알 수 있어요. 그 다음부터는 오늘 분량이 매일 자동으로
        짜여요.
      </p>
      <Link
        href="/diagnostic"
        className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-ios-pill px-5 font-display text-[14px] font-[700] no-underline shadow-[0_4px_18px_rgb(0_0_0_/_0.22)] motion-safe:transition-all motion-safe:duration-[var(--dur-ios-normal)] motion-safe:hover:brightness-110 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        style={{ background: 'var(--active)', color: 'var(--p-dark)' }}
      >
        <Compass size={16} strokeWidth={2} aria-hidden />
        진단 시작
        <ArrowRight size={15} aria-hidden />
      </Link>
    </section>
  )
}

// ────────────────────────────────────────────────────────────
/** 읽기 블록의 진입 경로 — 후보 1순위 도서. 후보가 없거나 article 이면 서재(=article 은 버튼이 처리). */
function readHref(p: TodayPrescription): string {
  const first = p.input.candidates[0]
  if (first?.kind === 'book') return `/library/books/${first.id}`
  return '/library/books'
}

/** 후보 1순위가 article 이면 그 id — CTA 가 서버액션 경유로 바뀐다. */
function readArticleId(p: TodayPrescription): string | undefined {
  const first = p.input.candidates[0]
  return first?.kind === 'article' ? first.id : undefined
}
