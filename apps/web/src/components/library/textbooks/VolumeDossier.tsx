// apps/web/src/components/library/textbooks/VolumeDossier.tsx
//
// **교재 한 권의 구성요소를 지면으로 편다.**
//
// ── 왜 이 파일이 생겼나 (2026-09-06) ────────────────────────────────
// 상세면이 시중 교재의 구성요소 **14축 중 1축**만 갖고 있었다(난이도 표시).
// 시중 20종은 중앙값 5축 · 최다 8축이다(`apparatus.ts` — 코퍼스 실측).
// 그래서 학습자에게 이 화면은 교재가 아니라 **재고 요약표**로 읽혔다.
//
// ── 내용은 여기서 짓지 않는다 ───────────────────────────────────────
// 문장·수치·계획표는 전부 `buildDossier()`(파이프라인)가 만든다. 이 파일은 **지면**만
// 담당한다 — 권이 일곱인데 화면이 글을 지으면 일곱 번 손으로 적게 되고, 한 권만 고쳐도
// 나머지 여섯이 어긋난다.
//
// ── `data-apparatus` 는 장식이 아니라 계약이다 ──────────────────────
// `scripts/textbook/apparatus-surface-probe.mjs` 가 이 속성만 센다. 정규식으로 세면
// 도움말에 "목차" 라는 낱말이 한 번 나오는 것만으로 목차가 생겨 버린다.
// **붙이려면 그 자리에 실제 내용이 있어야 한다** — 그것이 이 속성의 쓸모다.
// 열쇠는 `APPARATUS_KEYS` 에 있는 것만 쓴다(없는 열쇠는 probe 가 세지 않고 경고한다).

import Link from 'next/link'
import { ArrowRight, BookOpen, CalendarDays, ChevronsDown, ChevronsUp, Layers } from 'lucide-react'

import type { VolumeDossier } from '@vocaflow/library-pipeline'

import { VolumeCover } from '@/components/library/textbooks/ShelfControls'
import type { ShelfVolume } from '@/lib/textbook/shelf'

/** 지면 한 장. 상세면의 모든 절이 같은 그릇을 쓴다 — 다르면 한 권으로 안 읽힌다. */
function Sheet({
  apparatus,
  label,
  children,
  className = '',
}: {
  /** `APPARATUS_KEYS` 의 열쇠. 이 절이 어떤 구성요소인지 **선언**한다. */
  apparatus: string
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      data-apparatus={apparatus}
      aria-label={label}
      className={`rounded-ios-2xl bg-[var(--bg)] px-5 py-6 shadow-ios-2 md:px-8 ${className}`}
    >
      {children}
    </section>
  )
}

/** 절 머리 — 작은 라벨 + 큰 제목. 시중 교재의 절 표제와 같은 자리다. */
function SheetHead({ kicker, title, lead }: { kicker: string; title: string; lead?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t2)]">
        {kicker}
      </p>
      <h2 className="font-editorial text-[22px] font-[500] leading-[1.2] tracking-[-0.012em] text-[var(--t1)]">
        {title}
      </h2>
      {lead && (
        <p className="mt-1 max-w-[62ch] font-body text-[13px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
          {lead}
        </p>
      )}
    </div>
  )
}

/**
 * 굵게 표시(`**말**`)를 살린다.
 *
 * ⚠️ 서지 산문은 저장소 관행대로 `**` 를 쓴다. 예전 상세면은 그것을 **지웠고**
 *   (별표 두 개를 지우는 `replace` 를 걸고 있었다), 그래서 글쓴이가 강조한 자리가 화면에서 사라졌다.
 *   ⚠️ 그 정규식을 이 주석에 **그대로 적으면 안 된다** — 리터럴 안의 별표와 빗금이
 *   블록 주석을 조기에 닫아 파일 전체가 구문 오류가 된다(실측 2026-09-06, 이 파일에서).
 *   지우지 말고 **살린다** — 다만 HTML 을 넣지 않고 조각으로 나눈다(주입 여지 0).
 */
function Emphasized({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-display font-[700] text-[var(--t1)]">
            {p}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 표지 히어로 — 표지 + 난이도
// ══════════════════════════════════════════════════════════════════════

export function VolumeHero({
  volume: v,
  dossier: d,
  brand,
  children,
}: {
  volume: ShelfVolume
  dossier: VolumeDossier
  brand: string
  /** 담기·공유 같은 조작. 서버 컴포넌트가 클라이언트 단추를 꽂는 자리. */
  children?: React.ReactNode
}) {
  const explainedPct =
    v.explainedCount !== null && v.itemCount > 0
      ? Math.round((v.explainedCount / v.itemCount) * 100)
      : null

  return (
    <section
      data-apparatus="cover"
      aria-label="교재 표지"
      className="rounded-ios-2xl bg-[var(--bg)] px-5 py-6 shadow-ios-2 md:px-8 md:py-8"
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[212px_minmax(0,1fr)] md:gap-10">
        {/* 표지 — 매대와 **같은 함수**가 그린다(`cover.ts`). 서점에서 본 표지와
            펼친 책의 표지가 다르면 같은 상품으로 안 읽힌다. */}
        <div className="mx-auto flex w-[168px] flex-col gap-3 md:mx-0 md:w-full">
          <VolumeCover volume={v} size="full" />
          <p className="text-center font-mono text-[10px] tabular-nums text-[var(--t2)]">
            일곱 단 중 <span className="font-[700] text-[var(--t1)]">{d.difficulty.step}단</span>
          </p>
        </div>

        <div className="flex min-w-0 flex-col">
          <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t2)]">
            {brand} · Step {v.step}
          </p>
          <h1 className="mt-2 font-editorial text-[30px] font-[500] leading-[1.06] tracking-[-0.02em] text-[var(--t1)] md:text-[42px]">
            {v.title}
          </h1>

          {/* 난이도 — **색만으로 말하지 않는다.** 학령·V레벨·유형 수를 글자로 함께 적는다. */}
          <div data-apparatus="difficulty" className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-ios-pill bg-[var(--p-light)] px-3 py-1.5 font-display text-[12px] font-[700] text-[var(--on-p-tint)]">
              {v.schoolBand}
            </span>
            <span className="inline-flex items-center rounded-ios-pill bg-[var(--active-light)] px-3 py-1.5 font-display text-[12px] font-[700] text-[var(--active-ink)]">
              V-Level {v.vLevels.join('·')}
            </span>
            <span className="inline-flex items-center rounded-ios-pill border border-[var(--bd)] px-3 py-1.5 font-display text-[12px] font-[700] text-[var(--t2)]">
              수록 유형 {v.types.length}
            </span>
          </div>

          <p className="mt-4 max-w-[60ch] font-body text-[14px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
            <Emphasized text={v.rationale} />
          </p>

          {/* 실측 수치 — **못 잰 것은 칸을 비우지 않고 뺀다.** 0 으로 적으면 거짓이 된다. */}
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bd)] sm:grid-cols-3">
            {v.status !== 'unmeasured' && (
              <div className="flex flex-col gap-0.5 bg-[var(--bg)] px-4 py-3.5">
                <dd className="font-mono text-[24px] font-[700] leading-none tabular-nums text-[var(--t1)]">
                  {v.itemCount.toLocaleString()}
                </dd>
                <dt className="font-body text-[11.5px] text-[var(--t2)]">수록 문항</dt>
              </div>
            )}
            <div className="flex flex-col gap-0.5 bg-[var(--bg)] px-4 py-3.5">
              <dd className="font-mono text-[24px] font-[700] leading-none tabular-nums text-[var(--t1)]">
                {d.studyPlan.units}
              </dd>
              <dt className="font-body text-[11.5px] text-[var(--t2)]">한 권 단원 수</dt>
            </div>
            {explainedPct !== null && (
              <div className="flex flex-col gap-0.5 bg-[var(--bg)] px-4 py-3.5">
                <dd className="font-mono text-[24px] font-[700] leading-none tabular-nums text-[var(--t1)]">
                  {explainedPct}%
                </dd>
                <dt className="font-body text-[11.5px] text-[var(--t2)]">해설이 붙은 문항</dt>
              </div>
            )}
          </dl>

          {children && <div className="mt-6 flex flex-wrap items-center gap-3">{children}</div>}
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 머리말
// ══════════════════════════════════════════════════════════════════════

export function VolumePreface({ dossier: d }: { dossier: VolumeDossier }) {
  return (
    <Sheet apparatus="preface" label="머리말">
      <SheetHead kicker="머리말" title={d.preface.title} />
      <div className="mt-4 flex max-w-[62ch] flex-col gap-3">
        {d.preface.paragraphs.map((p, i) => (
          <p key={i} className="font-body text-[14px] leading-[1.85] text-[var(--t2)] [word-break:keep-all]">
            <Emphasized text={p} />
          </p>
        ))}
        {/* 마지막 한 줄은 "사람의 말투" 다 — Lora italic (CLAUDE.md 철학 3). */}
        <p className="mt-1 font-editorial text-[15px] italic leading-[1.8] text-[var(--active-ink)] [word-break:keep-all]">
          {d.preface.closing}
        </p>
      </div>
    </Sheet>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 이 책의 구성과 특징
// ══════════════════════════════════════════════════════════════════════

export function VolumeFeatures({ dossier: d }: { dossier: VolumeDossier }) {
  if (d.features.length === 0) return null
  return (
    <Sheet apparatus="features" label="이 책의 구성과 특징">
      <SheetHead kicker="이 책의 구성과 특징" title="어디부터 어떻게 쓰나요" />
      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {d.features.map((f) => (
          <li
            key={f.no}
            className="flex gap-4 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-4"
          >
            <span
              aria-hidden
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[var(--p)] font-mono text-[14px] font-[700] tabular-nums text-[var(--on-p)]"
            >
              {String(f.no).padStart(2, '0')}
            </span>
            <span className="min-w-0">
              <span className="block font-display text-[13.5px] font-[700] text-[var(--t1)]">
                {f.title}
              </span>
              <span className="mt-1 block font-body text-[12.5px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
                {f.body}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 학습 계획표
// ══════════════════════════════════════════════════════════════════════

export function VolumeStudyPlan({ dossier: d }: { dossier: VolumeDossier }) {
  const [lo, hi] = d.studyPlan.minutesPerUnit
  return (
    <Sheet apparatus="studyplan" label="학습 계획표">
      <SheetHead
        kicker="학습 계획표"
        title="2주 기본안"
        lead={`하루 한 단원(약 ${lo}~${hi}분), 주 5일. 남는 이틀은 밀린 날을 메우는 자리로 비워 두었어요 — 빈칸이 있어야 한 번 빠져도 계획을 버리지 않습니다.`}
      />
      <div className="mt-5 flex flex-col gap-4">
        {d.studyPlan.weeks.map((w) => (
          <div key={w.label}>
            <p className="mb-2 font-display text-[11.5px] font-[700] tracking-[0.06em] text-[var(--p)]">
              {w.label}
            </p>
            <ol className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {w.days.map((day, i) => {
                const isReview = day.task?.startsWith('복습') ?? false
                return (
                  <li
                    key={i}
                    className={`flex min-h-[76px] flex-col gap-1 rounded-[var(--r-md)] border px-2.5 py-2 ${
                      day.task === null
                        ? 'border-dashed border-[var(--bd)] bg-transparent'
                        : isReview
                          ? 'border-[var(--p)] bg-[var(--bg2)]'
                          : 'border-[var(--bd)] bg-[var(--bg2)]'
                    }`}
                  >
                    <span className="font-mono text-[10px] font-[700] tracking-[0.1em] text-[var(--t2)]">
                      {day.day}
                    </span>
                    {day.task && (
                      <span
                        className={`font-display text-[12px] font-[700] ${isReview ? 'text-[var(--p)]' : 'text-[var(--t1)]'}`}
                      >
                        {day.task}
                      </span>
                    )}
                    <span className="font-body text-[10.5px] leading-[1.5] text-[var(--t2)] [word-break:keep-all]">
                      {day.note}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        ))}
      </div>
    </Sheet>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 부록 · 부가 자료
// ══════════════════════════════════════════════════════════════════════

export function VolumeBackMatter({ dossier: d }: { dossier: VolumeDossier }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Sheet apparatus="appendix" label="부록">
        <SheetHead kicker="부록" title="본문 뒤에 붙는 것" />
        <ul className="mt-4 flex flex-col divide-y divide-[var(--bd)]">
          {d.appendix.map((a) => (
            <li key={a.label} className="flex flex-col gap-1 py-3">
              <span className="inline-flex items-center gap-2 font-display text-[13px] font-[700] text-[var(--t1)]">
                <Layers size={14} aria-hidden className="text-[var(--t2)]" />
                {a.label}
              </span>
              <span className="font-body text-[12.5px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
                {a.detail}
              </span>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet apparatus="extras" label="부가 자료">
        <SheetHead kicker="부가 자료" title="책 밖에서 따라오는 것" />
        <ul className="mt-4 flex flex-col divide-y divide-[var(--bd)]">
          {d.extras.map((e) => (
            <li key={e.label} className="flex flex-col gap-1 py-3">
              <span className="inline-flex items-center gap-2 font-display text-[13px] font-[700] text-[var(--t1)]">
                <CalendarDays size={14} aria-hidden className="text-[var(--t2)]" />
                {e.label}
              </span>
              <span className="font-body text-[12.5px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
                {e.detail}
              </span>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 판권
// ══════════════════════════════════════════════════════════════════════

export function VolumeColophon({ dossier: d, passageSpec }: { dossier: VolumeDossier; passageSpec: string | null }) {
  return (
    <Sheet apparatus="colophon" label="판권">
      <SheetHead kicker="판권" title="누가 언제 무엇을 근거로 냈나" />
      <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <dt className="font-mono text-[9.5px] font-[700] uppercase tracking-[0.16em] text-[var(--p)]">제목</dt>
          <dd className="font-body text-[12.5px] text-[var(--t2)]">{d.colophon.title}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="font-mono text-[9.5px] font-[700] uppercase tracking-[0.16em] text-[var(--p)]">사다리</dt>
          <dd className="font-body text-[12.5px] text-[var(--t2)]">
            {d.colophon.ladder} — 일곱 단 중 {d.difficulty.step}단
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="font-mono text-[9.5px] font-[700] uppercase tracking-[0.16em] text-[var(--p)]">판차</dt>
          <dd className="font-body text-[12.5px] text-[var(--t2)]">{d.colophon.edition}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="font-mono text-[9.5px] font-[700] uppercase tracking-[0.16em] text-[var(--p)]">발행</dt>
          <dd className="font-mono text-[12.5px] tabular-nums text-[var(--t2)]">{d.colophon.issued}</dd>
        </div>
        {/* 규격은 **조판이 실제로 쓴 창**이어야 한다. 못 받았으면 적지 않는다 —
            예전 판권장이 전 밴드에 `90~200어` 를 박아 네 권이 오기였다(2026-08-31). */}
        {passageSpec && (
          <div className="flex flex-col gap-0.5">
            <dt className="font-mono text-[9.5px] font-[700] uppercase tracking-[0.16em] text-[var(--p)]">규격</dt>
            <dd className="font-body text-[12.5px] text-[var(--t2)]">지문 {passageSpec}</dd>
          </div>
        )}
        <div className="flex flex-col gap-0.5 sm:col-span-2">
          <dt className="font-mono text-[9.5px] font-[700] uppercase tracking-[0.16em] text-[var(--p)]">지문 출처</dt>
          <dd className="font-body text-[12.5px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
            {d.colophon.sourcePolicy}
          </dd>
        </div>
      </dl>
    </Sheet>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 사다리 — 앞뒤 권
//
// ⚠️ **`data-apparatus` 를 붙이지 않는다.** 이 절은 시중의 「복습·단원 평가」가 아니라
//   다른 권으로 가는 길이다. 비슷해 보인다고 열쇠를 붙이면 자가 스스로를 속인다 —
//   그 축은 실제 복습 문항이 생길 때 붙인다.
// ══════════════════════════════════════════════════════════════════════

/** 앞/뒤 권 한 칸. 없는 쪽은 **빈 칸으로 두지 않고 이유를 적는다.** */
export function NeighborCard({
  volume: v,
  direction,
}: {
  volume: ShelfVolume | null
  direction: 'down' | 'up'
}) {
  const lead = direction === 'down' ? '어렵다면 한 계단 아래' : '쉽다면 한 계단 위'
  const Icon = direction === 'down' ? ChevronsDown : ChevronsUp

  if (!v) {
    return (
      <p className="flex items-center gap-3 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 font-body text-[12px] leading-[1.6] text-[var(--t2)] [word-break:keep-all]">
        <Icon size={15} aria-hidden className="shrink-0" />
        {direction === 'down' ? '시리즈의 첫 권이에요.' : '시리즈의 마지막 권이에요.'}
      </p>
    )
  }

  return (
    <Link
      href={`/library/textbooks/${v.step}`}
      className="group flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 no-underline transition-colors hover:border-[var(--p)] hover:bg-[var(--bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
    >
      <span className="w-11 shrink-0">
        <VolumeCover volume={v} size="full" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[11.5px] font-[700] text-[var(--t2)]">{lead}</span>
        <span className="mt-0.5 block font-editorial text-[15px] font-[500] leading-snug text-[var(--t1)]">
          {v.title}
        </span>
        <span className="mt-0.5 block font-mono text-[10px] tabular-nums text-[var(--t2)]">
          STEP {v.step} · {v.schoolBand}
        </span>
      </span>
      <ArrowRight
        size={15}
        aria-hidden
        className="shrink-0 text-[var(--t2)] motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
      />
    </Link>
  )
}

export { BookOpen }
