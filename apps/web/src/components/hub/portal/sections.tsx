// apps/web/src/components/hub/portal/sections.tsx
//
// 플랫폼 메인(`/hub`)의 면들 — 서버 컴포넌트. 나가는 링크만 `PromoLink`(클라이언트)가 센다.
//
// ── 참조 홈의 띠 문법을 그대로 따른다 (DD-68 · docs/design/refs/tines) ─────────────────────
//   실측(components-summary · dna · 홈 캡처 8장)에서 옮긴 값:
//   · 구획 눈썹 `HomeSectionKicker` = 모노 13px/700 대문자 넓은 자간
//   · 구획 제목 `HomeSectionHeading` = 산세리프 56px/400 · 자간 −0.03em · 부제 `HomeSectionByline` = 세리프 24px/400
//   · 구획 사이 156px · 그림자 0 · 카드 모서리 14px · 통판 `HomeSolutionSection` 모서리 48px
//   · 제품 액자 `ThreeBProductVisual` = 라벤더 이중 테두리 + 안쪽 앱 화면(레일 · KPI 줄 · 도넛 · 표)
//   · USP 카드 = 보라 면 · 세리프 굵은 첫 문장 + 이어지는 보통 굵기 문장 · 왼쪽 아래 소품
//   면의 **내용**은 전부 우리 것이다 — 수치는 `hub-portal-query` · 셸 나침반이 센 것만, 못 셌으면 그 말을 뺀다(I5).

import { ArrowRight, Check, Hash } from 'lucide-react'
import Image from 'next/image'
import type { CSSProperties } from 'react'

import { vocabCategoryMeta } from '@/components/library/vocab/categories'
import { BTN, CHIP } from '@/components/ui/tines-kit'
import type { ToneTab } from '@/components/ui/ToneTabs'
import { SOURCE_TRACKS } from '@/lib/articles/source-map'
import { TINT_CLASS, TINT_ROTATION } from '@/lib/design/tone'
import {
  MEMORY_ATTENTION_LABEL,
  MEMORY_LABEL,
  MEMORY_ORDER,
} from '@/lib/framework/memory-labels'
import type { HubPortal, PortalBook } from '@/lib/learner/hub-portal-query'
import type { WayfinderModel } from '@/lib/learner/wayfinder'

import { PortalArticles } from './PortalArticles'
import { PromoLink } from './PromoLink'

const ILLO = '/illustrations/tines'
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'
const fmt = (n: number) => n.toLocaleString('ko-KR')
/** 책 한 권은 수천 분이다 — 한 시간을 넘으면 시간으로 읽는다. */
const readTime = (m: number) => (m < 60 ? `${m}분` : `${fmt(Math.round(m / 60))}시간`)

/** 참조 `HomeSectionKicker` — 모노 13px/700 대문자. */
export const KICKER = 'font-mono text-[13px] font-[700] uppercase tracking-[0.08em]'

// ── 구획 머리 ─────────────────────────────────────────────────────────

export function SectionHead({ kicker, title, byline, align = 'left' }: {
  kicker: string
  title: string
  byline?: string
  align?: 'left' | 'center'
}) {
  const center = align === 'center'
  return (
    <header className={center ? 'mx-auto max-w-[44rem] text-center' : 'max-w-[52rem]'}>
      <p className={`${KICKER} text-[var(--ju)]`}>{kicker}</p>
      <h2 className="mt-6 whitespace-pre-line break-keep font-display text-[36px] font-[400] leading-[1.08] tracking-[-0.03em] text-[var(--t1)] md:text-[56px]">
        {title}
      </h2>
      {byline && (
        <p className={`mt-6 break-keep font-serif text-[20px] leading-[1.3] text-[var(--ju)] md:text-[24px] ${center ? '' : 'max-w-[40rem]'}`}>{byline}</p>
      )}
    </header>
  )
}

// ── 제품 액자 — 참조 ThreeBProductVisual ─────────────────────────────

/**
 * 히어로 아래 앱 화면. 참조는 여기에 **자기 제품의 실제 화면**을 둔다 — 우리도 이 학습자의 오늘을 그대로 둔다.
 * 「오늘」 정의는 셸 나침반과 같은 모델(`buildWayfinder`)이다 — 레일의 `data-today-flow` 를 e2e 22-H · 23-② 가 띠와 비교한다.
 */
export function ProductFrame({ model, books, facts }: { model: WayfinderModel | null; books: PortalBook[]; facts: HubPortal['facts'] }) {
  return (
    <div
      className="vf-rise rounded-[28px] border-2 border-[var(--bd)] bg-[var(--tint-lavender)] p-1.5"
      style={{ '--rise-y': '16px', '--rise-dur': '600ms' } as CSSProperties}
    >
      <div className="grid overflow-hidden rounded-[22px] border border-[var(--bd)] bg-[color-mix(in_srgb,var(--tint-lavender)_40%,var(--bg))] md:grid-cols-[232px_minmax(0,1fr)]">
        <FrameRail model={model} facts={facts} />
        <div className="grid min-w-0 content-start gap-4 p-3 md:p-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          {model && <KpiRow model={model} />}
          {model && <MemoryCard model={model} />}
          <NewBooksTable books={books} tall={!!model} />
          {model && <ForecastCard model={model} />}
        </div>
      </div>
    </div>
  )
}

function FrameRail({ model, facts }: { model: WayfinderModel | null; facts: HubPortal['facts'] }) {
  const shelves = [
    { href: '/library/books', label: '도서', count: facts.books },
    { href: '/library/scripts', label: '글', count: facts.articles },
    { href: '/comics', label: '만화', count: facts.comics },
    { href: '/library/vocab', label: '단어장', count: facts.curatedSets },
    { href: '/csat', label: '수능 기출', count: null },
    { href: '/arcade', label: '아케이드', count: null },
  ]
  return (
    <nav aria-label="Vocaflow 둘러보기" className="hidden flex-col gap-1 border-r border-[var(--bd)] bg-[color-mix(in_srgb,var(--tint-lavender)_70%,var(--bg))] p-3 md:flex">
      {model && model.steps.length > 0 && (
        <>
          <div className="flex items-center justify-between px-2 pb-1 pt-1">
            <span className="font-display text-[12px] font-[600] text-[var(--ju)]">오늘의 흐름</span>
            <span data-today-flow className="font-mono text-[12px] font-[700] tabular-nums text-[var(--ju)]">
              {model.done}/{model.total}
            </span>
          </div>
          <ol className="relative flex flex-col gap-0.5">
            {/* 오늘의 흐름을 잇는 선 — 점선이 아래로 흐른다(`.vf-flow`). 참조가 연결선에
                `stroke-dashoffset` 를 흘려 「지금 돌고 있다」를 말하는 자리와 같은 뜻이다.
                왼쪽 16px = 단계 동그라미의 중심(px-2 8px + 동그라미 반지름 8px). */}
            {model.steps.length > 1 && (
              <span aria-hidden className="vf-flow absolute bottom-3 left-4 top-3 w-px -translate-x-1/2 text-[var(--ju)] opacity-40" />
            )}
            {model.steps.map((s) => (
              <li key={s.key} className="relative">
                <PromoLink
                  href={s.href}
                  slot="panel"
                  index={2}
                  className={`flex min-h-[40px] items-center gap-2.5 rounded-[8px] px-2 font-display text-[14px] ${
                    s.current ? 'bg-[var(--tint-lavender)] font-[600] text-[var(--t1)]' : 'font-[500] text-[var(--ju)] hover:bg-[var(--tint-lavender)]'
                  } ${FOCUS}`}
                >
                  <span
                    aria-hidden
                    /* 면을 채운다 — 뒤로 흐르는 선이 동그라미를 **관통하지 않고 잇는다**. */
                    className={`relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                      s.done ? 'border-[var(--ju)] bg-[var(--ju)] text-[var(--bg)]' : 'border-[var(--ju)] bg-[var(--bg)]'
                    }`}
                  >
                    {s.done ? (
                      <Check size={10} strokeWidth={3} />
                    ) : s.current ? (
                      /* 「지금 할 차례」만 숨쉰다 — 색 말고도 구별되는 표식이다(색만으로 정보 금지).
                         읽는 글이 아니라 **한 점**이라 주의를 끌되 방해하지 않는다. */
                      <span className="vf-breathe h-1.5 w-1.5 rounded-full bg-[var(--ju)]" />
                    ) : null}
                  </span>
                  <span className={s.done ? 'line-through opacity-70' : ''}>{s.name}</span>
                  <span className="sr-only">{s.done ? '완료' : s.current ? '지금 할 차례' : '남음'}</span>
                </PromoLink>
              </li>
            ))}
          </ol>
          <hr className="mx-2 my-3 border-[var(--bd)]" />
        </>
      )}
      <span className="px-2 pb-1 font-display text-[12px] font-[600] text-[var(--ju)]">서가</span>
      <ul className="flex flex-col gap-0.5">
        {shelves.map((s, i) => (
          <li key={s.href}>
            <PromoLink
              href={s.href}
              slot="panel"
              index={10 + i}
              className={`flex min-h-[40px] items-center gap-2.5 rounded-[8px] px-2 font-display text-[14px] font-[500] text-[var(--ju)] hover:bg-[var(--tint-lavender)] ${FOCUS}`}
            >
              <Hash size={14} aria-hidden className="shrink-0" />
              <span className="flex-1">{s.label}</span>
              {s.count !== null && <span className="font-mono text-[11px] tabular-nums">{fmt(s.count)}</span>}
            </PromoLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

const FRAME_CARD = 'rounded-[12px] border border-[var(--bd)] bg-[var(--bg)]'

function KpiRow({ model }: { model: WayfinderModel }) {
  const { past, counts, reach } = model
  const kpis = [
    { label: '연속 학습', value: `${past.streak}일` },
    { label: `${MEMORY_ATTENTION_LABEL} 단어`, value: fmt(counts.attention) },
    { label: MEMORY_LABEL.new.label, value: fmt(counts.fresh) },
    { label: '읽을 수 있는 책', value: reach.vLevel === null ? '진단 후' : fmt(reach.open) },
  ]
  return (
    <div className={`${FRAME_CARD} flex flex-wrap items-center justify-between gap-4 px-4 py-3 xl:col-span-2`}>
      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        {kpis.map((k, i) => (
          <div key={k.label}>
            <dt className="font-display text-[12px] text-[var(--ju)]">{k.label}</dt>
            {/* 숫자가 아래에서 올라와 앉는다 — 창(`overflow-hidden`) 덕에 「굴러 들어온」 것처럼 읽힌다.
                뜻이 있는 연출이다: 이 값은 **방금 계산된 것**이고(`buildWayfinder`), 실제로 그렇다. */}
            <dd className="overflow-hidden font-display text-[22px] font-[500] tabular-nums leading-tight tracking-[-0.01em] text-[var(--t1)]">
              <span className="vf-rise block" style={{ '--rise-y': '100%', '--rise-delay': `${250 + i * 60}ms` } as CSSProperties}>
                {k.value}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      {reach.vLevel !== null && (
        <span className="inline-flex h-9 items-center rounded-[8px] border border-[var(--bd)] px-3 font-display text-[13px] font-[500] text-[var(--ju)]">
          내 수준 V{reach.vLevel}
        </span>
      )}
    </div>
  )
}

/**
 * 기억 4상태의 이름·색은 **레지스트리에서 받는다**(`lib/framework/memory-labels.ts`).
 *
 * 처음에는 이 파일이 네 이름을 직접 지었다 — `위급` · `신규`. 그래서 플랫폼 메인이
 * `/wordvault` · `TodayQueue` 와 **다른 어휘로 같은 네 칸**을 불렀다(레지스트리는
 * `흐릿함` · `새 단어`). 학습자에게는 그 둘이 같은 칸인지 알 길이 없다 —
 * 레지스트리가 존재하는 이유가 바로 그 드리프트다(회귀 `memory-labels.test.ts`).
 *
 * `key` 는 이 화면의 값 묶음 이름이라 레지스트리 상태 이름과 하나만 다르다(`new` → `fresh`).
 */
const VALUE_KEY = { stable: 'stable', shaky: 'shaky', risk: 'risk', new: 'fresh' } as const

const MEMORY = MEMORY_ORDER.map((state) => ({
  key: VALUE_KEY[state],
  label: MEMORY_LABEL[state].label,
  color: `var(${MEMORY_LABEL[state].token})`,
}))

/** 기억 4색 도넛 — 참조의 「Spend vs limits」 자리. 값은 예보 0일째(= 지금)의 R(t) 동적 계산 + 신규 수. */
function MemoryCard({ model }: { model: WayfinderModel }) {
  const today = model.forecast.days[0]
  const values = {
    stable: today?.stable ?? 0,
    shaky: today?.shaky ?? 0,
    risk: today?.risk ?? 0,
    fresh: model.counts.fresh,
  }
  const total = values.stable + values.shaky + values.risk + values.fresh
  const R = 62
  const C = 2 * Math.PI * R
  const GAP = total > 0 ? 4 : 0
  let offset = 0
  const arcs = MEMORY.map((m) => {
    const len = total > 0 ? (values[m.key] / total) * C : 0
    const arc = { ...m, len: Math.max(0, len - GAP), offset }
    offset += len
    return arc
  })
  const summary = MEMORY.map((m) => `${m.label} ${values[m.key]}`).join(', ')

  return (
    <section aria-label="기억 상태" className={`${FRAME_CARD} p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-[13px] font-[600] text-[var(--ju)]">기억 상태</h3>
          <p className="font-display text-[22px] font-[500] tabular-nums tracking-[-0.01em] text-[var(--t1)]">단어 {fmt(total)}</p>
        </div>
        <span className={CHIP.soft}>지금</span>
      </div>
      <div className="mt-2 flex justify-center">
        <svg viewBox="0 0 160 160" className="h-[150px] w-[150px]" role="img" aria-label={`기억 상태 — ${summary}`}>
          <circle cx="80" cy="80" r={R} fill="none" stroke="var(--tint-lavender)" strokeWidth="9" />
          {arcs.map((a, i) =>
            a.len > 0 ? (
              <circle
                key={a.key}
                /* 호가 그려지며 들어온다 — 기하(`strokeDasharray`·`strokeDashoffset`)는 그대로 두고
                   §4.5 `.vf-arc` 가 **시작 지점만** 호 길이만큼 밀어 숨겼다가 제자리로 되돌린다.
                   자리잡기용 `strokeDashoffset` 를 덮으면 조각이 엉뚱한 각도에 붙는다. */
                className="vf-arc"
                style={{ '--arc-offset': `${-a.offset}px`, '--arc-len': `${a.len}px`, '--arc-delay': `${300 + i * 80}ms` } as CSSProperties}
                cx="80"
                cy="80"
                r={R}
                fill="none"
                stroke={a.color}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${a.len} ${C - a.len}`}
                strokeDashoffset={-a.offset}
                transform="rotate(-90 80 80)"
              />
            ) : null,
          )}
          <text x="80" y="74" textAnchor="middle" fill="var(--ju)" fontSize="11">{MEMORY_ATTENTION_LABEL}</text>
          <text x="80" y="98" textAnchor="middle" fill="var(--t1)" fontSize="24" fontWeight="500">
            {fmt(values.shaky + values.risk)}
          </text>
        </svg>
      </div>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {MEMORY.map((m) => (
          <li key={m.key} className="inline-flex items-center gap-1.5 font-display text-[12px] text-[var(--ju)]">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: m.color }} />
            {m.label} <span className="tabular-nums">{fmt(values[m.key])}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** 7일 예보 — 참조의 「Spend by model」 분절 막대 자리. */
function ForecastCard({ model }: { model: WayfinderModel }) {
  const { forecast } = model
  const last = forecast.days[forecast.days.length - 1]
  if (!last) return null
  // 예보는 신규를 세지 않는다(아직 D/S 가 없다) — 앞 세 상태만, 이름·색은 레지스트리에서.
  const parts = (['stable', 'shaky', 'risk'] as const).map((state) => ({
    label: MEMORY_LABEL[state].label,
    v: last[state],
    color: `var(${MEMORY_LABEL[state].token})`,
  }))
  const sum = parts.reduce((s, p) => s + p.v, 0)
  return (
    <section aria-label={`${forecast.horizonDays}일 예보`} className={`${FRAME_CARD} p-4`}>
      <h3 className="font-display text-[13px] font-[600] text-[var(--ju)]">{forecast.horizonDays}일 안에 흐려질 단어</h3>
      <p className="font-display text-[22px] font-[500] tabular-nums tracking-[-0.01em] text-[var(--t1)]">{fmt(forecast.fadingSoon)}</p>
      {sum > 0 && (
        <>
          {/* 막대가 왼쪽에서 자란다(`.vf-grow`) — 「7일 뒤」라는 예보가 지금 그려지는 중이라는 뜻. */}
          <div aria-hidden className="vf-grow mt-4 flex h-1.5 gap-1" style={{ '--grow-delay': '420ms' } as CSSProperties}>
            {parts.map((p) =>
              p.v > 0 ? <span key={p.label} className="rounded-full" style={{ flexGrow: p.v, background: p.color }} /> : null,
            )}
          </div>
          <p className="mt-2 font-display text-[12px] text-[var(--ju)]">{forecast.horizonDays}일 뒤 기억 분포</p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {parts.map((p) => (
              <li key={p.label} className="inline-flex items-center gap-1.5 font-display text-[12px] text-[var(--ju)]">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                {p.label} <span className="tabular-nums">{fmt(p.v)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <PromoLink href="/dashboard" slot="panel" index={3} className={`${BTN.text} mt-2`}>
        내 성장 보기 <ArrowRight size={14} aria-hidden />
      </PromoLink>
    </section>
  )
}

/** 새로 들어온 고전 — 참조의 「Models」 표 자리. e2e 23-① 이 `aria-label` 로 찾는다. */
function NewBooksTable({ books, tall }: { books: PortalBook[]; tall: boolean }) {
  if (books.length === 0) return null
  const rows = books.slice(0, tall ? 7 : 8)
  return (
    <section aria-label="새로 들어온 고전" className={`${FRAME_CARD} p-4 ${tall ? 'xl:col-start-2 xl:row-span-2 xl:row-start-2' : 'xl:col-span-2'}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-[13px] font-[600] text-[var(--t1)]">새로 들어온 고전</h3>
        <PromoLink href="/library/books" slot="shelf" index={99} className={`${BTN.text} text-[13px]`}>
          서가 전체 <ArrowRight size={13} aria-hidden />
        </PromoLink>
      </div>
      <p className="-mt-2 font-display text-[12px] text-[var(--ju)]">최근 발행된 책 — 수준과 읽는 시간</p>
      <table className="mt-3 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-[var(--bd)] font-display text-[12px] text-[var(--ju)]">
            <th scope="col" className="py-2 font-[500]">책</th>
            <th scope="col" className="py-2 text-right font-[500]">수준</th>
            <th scope="col" className="hidden py-2 text-right font-[500] sm:table-cell">읽는 시간</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b, i) => (
            /* 행이 차례로 켜진다. **이동 없이 페이드만** — `display: table-row` 의 `transform` 은
               브라우저마다 다르게 취급돼 표가 어긋난다(`--rise-y: 0`). */
            <tr
              key={b.id}
              className="vf-rise border-b border-[var(--bd)] last:border-0"
              style={{ '--rise-y': '0px', '--rise-dur': '320ms', '--rise-delay': `${360 + i * 40}ms` } as CSSProperties}
            >
              <td className="py-2 pr-3">
                <PromoLink href={`/library/books/${b.id}`} slot="shelf" index={i} className={`group flex min-h-[44px] items-center gap-3 rounded-[6px] ${FOCUS}`}>
                  {/* 표지 호스트가 여러 곳이라 원본 그대로 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.cover} alt="" loading="lazy" className="h-10 w-7 shrink-0 rounded-[3px] border border-[var(--bd)] object-cover" />
                  <span className="min-w-0">
                    <span className="block truncate font-display text-[14px] font-[500] text-[var(--t1)] group-hover:underline">{b.title}</span>
                    {b.author && <span className="block truncate font-display text-[12px] text-[var(--ju)]">{b.author}</span>}
                  </span>
                </PromoLink>
              </td>
              <td className="py-2 text-right font-mono text-[12px] tabular-nums text-[var(--t1)]">{b.cefr ?? '—'}</td>
              <td className="hidden py-2 text-right font-mono text-[12px] tabular-nums text-[var(--t1)] sm:table-cell">
                {b.minutes ? readTime(b.minutes) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

// ── 색 탭 패널 — 참조 HomeUseCasesSection ────────────────────────────

/** 패널 안 액자(참조: 패널 안 앱 화면이 옅은 테두리 액자에 담긴다). */
const PANEL_FRAME = 'rounded-[18px] border-2 border-[color-mix(in_srgb,var(--on-deep)_40%,transparent)] bg-[color-mix(in_srgb,var(--on-deep)_14%,transparent)] p-1.5'
const PANEL_INNER = 'rounded-[12px] bg-[var(--on-deep)] p-4 md:p-5'

function PanelCopy({ title, body, cta, href, index }: { title: string; body: string; cta: string; href: string; index: number }) {
  return (
    <div>
      <h3 className="break-keep font-display text-[30px] font-[400] leading-[1.1] tracking-[-0.02em] md:text-[40px]">{title}</h3>
      <p className="mt-4 max-w-[34ch] break-keep font-serif text-[19px] leading-[1.45] md:text-[21px]">{body}</p>
      <PromoLink href={href} slot="bento" index={index} className={`${BTN.onDeep} mt-8`}>
        {cta}
      </PromoLink>
    </div>
  )
}

const GAMES = [
  { href: '/wordblitz', name: '워드블리츠', body: '뜻을 보고 빠르게 고르는 속도전', tile: 'tile-wordblitz' },
  { href: '/pairflip', name: '페어플립', body: '단어와 뜻, 뒤집어 짝 맞추기', tile: 'tile-pairflip' },
  { href: '/spellforge', name: '스펠포지', body: '뜻을 보고 철자를 직접 써 보기', tile: 'tile-spellforge' },
] as const

export function platformTabs(p: HubPortal): ToneTab[] {
  const tabs: ToneTab[] = []

  tabs.push({
    id: 'books',
    label: '서가',
    summary: p.facts.books ? `고전 ${fmt(p.facts.books)}권을 챕터별 어휘와 함께.` : '고전을 챕터별 어휘와 함께.',
    tone: 'green',
    spot: 'spot-reading',
    panel: (
      <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <PanelCopy title="읽을 수 있는 책부터 펼칩니다." body="챕터마다 어휘가 미리 뽑혀 있어요. 읽다가 모르는 단어는 문장째 보관함에 담깁니다." cta="서가 둘러보기" href="/library/books" index={0} />
        {p.newBooks.length > 0 && (
          <div className={PANEL_FRAME}>
            <ul className={`${PANEL_INNER} grid grid-cols-3 gap-3 sm:grid-cols-4`}>
              {p.newBooks.slice(0, 8).map((b, i) => (
                <li key={b.id} className={i >= 6 ? 'hidden sm:block' : ''}>
                  <PromoLink href={`/library/books/${b.id}`} slot="bento" index={20 + i} className={`group block rounded-[6px] ${FOCUS}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.cover} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-[6px] border border-[var(--bd)] object-cover" />
                    <span className="mt-1.5 block truncate font-display text-[12px] font-[500] text-[var(--on-ju)] group-hover:underline">{b.title}</span>
                  </PromoLink>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    ),
  })

  const comics = p.comics.filter((c) => c.cover)
  tabs.push({
    id: 'comics',
    label: '만화',
    summary: p.facts.comics ? `원서 만화와 복원 만화 ${fmt(p.facts.comics)}편.` : '원서 만화와 복원 만화.',
    tone: 'orange',
    spot: 'spot-comic',
    panel: (
      <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <PanelCopy title="같은 책을, 그림으로 먼저." body="줄거리를 그림으로 먼저 알고 나면 원문이 훨씬 가벼워집니다. 오래된 만화는 복원해서 담았어요." cta="만화 보기" href="/comics" index={1} />
        {comics.length > 0 ? (
          <div className={PANEL_FRAME}>
            <ul className={`${PANEL_INNER} grid grid-cols-3 gap-3`}>
              {comics.slice(0, 3).map((c, i) => (
                <li key={c.href}>
                  <PromoLink href={c.href} slot="bento" index={30 + i} className={`group block rounded-[6px] ${FOCUS}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.cover!} alt="" loading="lazy" className="aspect-[3/4] w-full rounded-[6px] border border-[var(--bd)] object-cover" />
                    <span className="mt-1.5 block truncate font-display text-[12px] font-[500] text-[var(--on-ju)] group-hover:underline">{c.title}</span>
                  </PromoLink>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Image src={`${ILLO}/tile-comics.webp`} alt="" width={1328} height={1328} className="w-[260px] justify-self-center rounded-[14px]" />
        )}
      </div>
    ),
  })

  tabs.push({
    id: 'csat',
    label: '수능 기출',
    summary: '평가원 기출을 유형별로 해부.',
    tone: 'purple',
    spot: 'spot-quiz',
    panel: (
      <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
        <PanelCopy title="출제자가 왜 그 선택지를 만들었는지까지." body="문항마다 근거를 지문 위에서 따라 읽고, 오답이 어디서 갈라지는지 확인합니다." cta="기출 시작" href="/csat" index={2} />
        <Image src={`${ILLO}/tile-csat.webp`} alt="" width={1328} height={1328} className="w-[220px] justify-self-center rounded-[14px] md:w-[300px]" />
      </div>
    ),
  })

  tabs.push({
    id: 'arcade',
    label: '아케이드',
    summary: '담은 단어로 게임 한 판.',
    tone: 'magenta',
    spot: 'spot-wordblitz',
    panel: (
      <div className="grid items-center gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <PanelCopy title="복습이 지루할 때는 게임으로." body="문제는 내 보관함의 단어로 나옵니다. 속도 · 짝 맞추기 · 철자 — 세 가지로 같은 단어를 다시 꺼내요." cta="아케이드 입장" href="/arcade" index={3} />
        <ul className="grid grid-cols-3 gap-3">
          {GAMES.map((g, i) => (
            <li key={g.href}>
              <PromoLink href={g.href} slot="arcade" index={2 + i} className={`group flex h-full flex-col rounded-[14px] bg-[var(--on-deep)] p-2 ${FOCUS}`}>
                <Image src={`${ILLO}/${g.tile}.webp`} alt="" width={1328} height={1328} sizes="200px" className="aspect-square w-full select-none rounded-[10px] object-cover" />
                <span className="mt-2 px-1 break-keep font-serif text-[16px] font-[700] text-[var(--on-ju)] md:text-[18px]">{g.name}</span>
                <span className="mb-1 hidden px-1 break-keep font-body text-[13px] leading-snug text-[var(--on-ju)] sm:block">{g.body}</span>
              </PromoLink>
            </li>
          ))}
        </ul>
      </div>
    ),
  })

  const cats = p.setCategories
    .map((c) => ({ ...c, meta: vocabCategoryMeta(c.id) }))
    .filter((c): c is typeof c & { meta: NonNullable<typeof c.meta> } => c.meta !== null)
  tabs.push({
    id: 'vocab',
    label: '단어장',
    summary: p.facts.curatedSets ? `목적별 단어장 ${fmt(p.facts.curatedSets)}개.` : '목적별 단어장.',
    tone: 'ink',
    spot: 'spot-vault',
    panel: (
      <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <PanelCopy title="시험 · 학년 · 주제별로 골라 담습니다." body="담은 단어장은 보관함으로 들어와 간격 복습을 따라갑니다. 단어장을 따로 외울 필요가 없어요." cta="단어장 보기" href="/library/vocab" index={4} />
        {cats.length > 0 && (
          <div className={PANEL_FRAME}>
            <ul className={`${PANEL_INNER} divide-y divide-[var(--bd)]`}>
              {cats.slice(0, 6).map((c, i) => (
                <li key={c.id}>
                  <PromoLink href="/library/vocab" slot="vocab" index={i} className={`flex min-h-[48px] items-center gap-3 ${FOCUS}`}>
                    <span className="flex-1">
                      <span className="font-display text-[15px] font-[600] text-[var(--on-ju)]">{c.meta.label}</span>
                      <span className="ml-2 font-display text-[12px] text-[var(--on-ju)]">{c.meta.hint}</span>
                    </span>
                    <span className="font-mono text-[13px] font-[700] tabular-nums text-[var(--on-ju)]">{fmt(c.count)}세트</span>
                  </PromoLink>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    ),
  })

  return tabs
}

// ── 보라 통판 — 참조 HomeSolutionSection ─────────────────────────────

const PROPS = [
  { title: '읽다가, 문장째 담습니다', body: '모르는 단어를 누르면 그 문장과 함께 보관함에 들어가요. 뜻은 문맥과 같이 남습니다.' },
  { title: '잊을 때쯤 다시 꺼냅니다', body: '복습 간격은 단어마다 FSRS 가 계산합니다. 외운 단어를 매일 다시 볼 필요가 없어요.' },
  { title: '아는 비율로 고릅니다', body: '글의 난이도가 아니라 이 글에서 내가 이미 아는 비율로 다음 읽을 것을 정합니다.' },
  { title: '읽은 글이 문제가 됩니다', body: '지문 퀴즈 · 받아쓰기 · 게임이 같은 글과 같은 단어에서 나옵니다.' },
]

const SLAB_TILES = [
  { illo: 'tile-books', tilt: -6, lift: 0 },
  { illo: 'tile-comics', tilt: 3, lift: -10 },
  { illo: 'tile-csat', tilt: -2, lift: 4 },
  { illo: 'tile-wordblitz', tilt: 5, lift: -14 },
  { illo: 'tile-vault', tilt: -4, lift: 2 },
] as const

export function SolutionSlab({ facts }: { facts: HubPortal['facts'] }) {
  const lines = [
    facts.books ? `고전 ${fmt(facts.books)}권.` : null,
    facts.articles ? `글 ${fmt(facts.articles)}편.` : null,
    facts.comics ? `만화 ${fmt(facts.comics)}편.` : null,
  ].filter(Boolean) as string[]
  return (
    <div className="relative overflow-hidden rounded-[32px] bg-[var(--ju)] text-[var(--on-ju)] md:rounded-[48px]">
      <div className="relative z-10 grid gap-12 px-6 pb-10 pt-12 md:px-14 lg:grid-cols-[1fr_1.15fr] lg:pb-14">
        <div className="flex flex-col">
          <p className={KICKER}>지금 서가에는</p>
          <h2 className="mt-10 whitespace-pre-line break-keep font-display text-[40px] font-[400] leading-[1.08] tracking-[-0.03em] md:text-[56px]">
            {lines.length > 0 ? lines.join('\n') : '읽을 것, 외울 것,\n풀 것이 한 곳에.'}
          </h2>
          {/* 참조 통판 왼쪽 아래 삽화 자리. 꽃밭은 랜딩 전용이라(tines-mapping §20) 서가의 물건 — 플랫폼 타일 — 을 세운다. */}
          <ul aria-hidden className="mt-12 flex items-end lg:mt-auto lg:pt-16">
            {SLAB_TILES.map((t, i) => (
              <li
                key={t.illo}
                className={i > 0 ? '-ml-5 md:-ml-6' : ''}
                style={{ transform: `rotate(${t.tilt}deg) translateY(${t.lift}px)`, zIndex: SLAB_TILES.length - i }}
              >
                <Image src={`${ILLO}/${t.illo}.webp`} alt="" width={1328} height={1328} sizes="130px" className="w-[72px] select-none rounded-[14px] border-2 border-[var(--on-ju)] md:w-[120px]" />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {PROPS.map((p) => (
              <article key={p.title}>
                <h3 className="break-keep font-serif text-[24px] font-[700] leading-[1.12] tracking-[-0.01em]">{p.title}</h3>
                <p className="mt-4 break-keep font-body text-[15px] leading-[1.6]">{p.body}</p>
              </article>
            ))}
          </div>
          <div className="mt-14 flex flex-col items-start gap-5 lg:pl-[50%]">
            <p className="break-keep font-serif text-[19px] leading-[1.35]">
              <strong className="font-[700]">한 글</strong>에서 시작해 읽기 · 단어 · 복습 · 퀴즈로 이어집니다.
            </p>
            <PromoLink
              href="/library/books"
              slot="bento"
              index={40}
              className={`inline-flex min-h-[44px] items-center rounded-full border border-[var(--on-ju)] px-5 font-display text-[14px] font-[700] tracking-[0.02em] text-[var(--on-ju)] transition-colors hover:bg-[color-mix(in_srgb,var(--on-ju)_14%,transparent)] ${FOCUS}`}
            >
              서가 둘러보기
            </PromoLink>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 읽을거리 ─────────────────────────────────────────────────────────

/** 주제 트랙 → 소품. 저장소에 커밋된 그림만 쓴다. */
const TRACK_SPOT: Record<string, string> = {
  listen: 'spot-listening',
  easy: 'spot-reading',
  topic: 'spot-search',
  news: 'spot-empty-page',
  argue: 'spot-echomatch',
  data: 'spot-dashboard',
  reference: 'spot-dictionary',
}

export function ReadingSection({ portal }: { portal: HubPortal }) {
  const { articles, facts } = portal
  return (
    <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
      {articles.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between gap-4 border-b-2 border-[var(--t1)] pb-3">
            <h3 className={`${KICKER} text-[var(--t1)]`}>새로 올라온 글</h3>
            {facts.articles !== null && <span className="font-mono text-[12px] font-[700] tabular-nums text-[var(--ju)]">전체 {fmt(facts.articles)}편</span>}
          </div>
          <PortalArticles articles={articles} />
          <PromoLink href="/library/scripts" slot="reading" index={99} className={`${BTN.text} mt-4`}>
            글 전체 보기 <ArrowRight size={14} aria-hidden />
          </PromoLink>
        </div>
      )}
      <div>
        <div className="border-b-2 border-[var(--t1)] pb-3">
          <h3 className={`${KICKER} text-[var(--t1)]`}>주제별 시리즈 · {SOURCE_TRACKS.length}</h3>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {SOURCE_TRACKS.map((t, i) => (
            <li key={t.key}>
              <PromoLink
                href={`/library/scripts?series=${encodeURIComponent(t.key)}`}
                slot="reading"
                index={articles.length + i}
                className={`${TINT_CLASS[TINT_ROTATION[i % TINT_ROTATION.length]]} group flex h-full min-h-[96px] items-center gap-3 rounded-[14px] p-4 transition-[filter] duration-[var(--dur-quick)] hover:brightness-[1.03] ${FOCUS}`}
              >
                <Image src={`${ILLO}/${TRACK_SPOT[t.key] ?? 'spot-reading'}.webp`} alt="" width={1328} height={1328} sizes="56px" className="h-14 w-14 shrink-0 select-none object-contain" />
                <span className="min-w-0">
                  <span className="block break-keep font-serif text-[16px] font-[700] leading-snug text-[var(--t1)]">{t.title}</span>
                  <span className="mt-1 line-clamp-2 block break-keep font-body text-[13px] leading-snug text-[var(--t1)]">{t.oneLine}</span>
                </span>
              </PromoLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ── WHY + 보라 카드 넷 — 참조 HomeUSPSection ─────────────────────────

const USP = [
  { lead: '진단은 5분.', rest: '몇 개의 단어를 아는지만 재면, 지금 읽을 수 있는 책과 오늘 만날 단어가 정해집니다.', spot: 'spot-search', href: '/diagnostic' },
  { lead: '기억은 네 색으로.', rest: '안정 · 흔들림 · 위급 · 신규 — 단어마다 지금의 기억을 계산해서 보여 줍니다.', spot: 'spot-memory', href: '/wordvault' },
  { lead: '듣고, 따라 말하고.', rest: '받아쓰기로 소리를 잡고, 따라 말한 억양을 원문과 겹쳐 비교합니다.', spot: 'spot-listening', href: '/dictate' },
  { lead: '학급과 함께.', rest: '초대코드 하나로 학생을 모으고, 학급의 어휘 진행을 한 화면에서 봅니다.', spot: 'spot-teacher', href: '/teacher' },
]

export function UspCards() {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
      {USP.map((u, i) => (
        <li key={u.href}>
          <PromoLink
            href={u.href}
            slot="bento"
            index={50 + i}
            className={`group flex h-full min-h-[320px] flex-col rounded-[14px] bg-[var(--ju)] p-6 text-[var(--on-ju)] transition-[filter] duration-[var(--dur-quick)] hover:brightness-110 lg:min-h-[400px] ${FOCUS}`}
          >
            <p className="break-keep font-serif text-[23px] leading-[1.22] md:text-[25px]">
              <strong className="font-[700]">{u.lead}</strong> {u.rest}
            </p>
            <Image src={`${ILLO}/${u.spot}.webp`} alt="" width={1328} height={1328} sizes="120px" className="mt-auto w-[108px] select-none pt-6" />
          </PromoLink>
        </li>
      ))}
    </ul>
  )
}

// ── 마지막 CTA — 참조 「Built by you」 흩어진 물건 띠 ─────────────────

/** 공개 화면 끝 CTA(`site/ScatterCta`)와 같은 골격 — 알약만 학습자의 「지금」 으로 바꾼다(tines-mapping §20). */
export function FinalCta({ primary }: { primary: { label: string; href: string } }) {
  return (
    <div className="relative">
      <Image
        src={`${ILLO}/band-scatter.webp`}
        alt=""
        width={1664}
        height={928}
        sizes="(min-width: 1360px) 1280px, 100vw"
        className="pointer-events-none absolute inset-0 hidden h-full w-full select-none object-cover md:block"
      />
      <div className="relative mx-auto flex min-h-[360px] max-w-[460px] items-center py-10 md:min-h-[560px]">
        <div className="w-full rounded-[14px] border border-[var(--bd)] bg-[var(--bg)] px-7 py-10 text-center">
          <p className={`${KICKER} text-[var(--ju)]`}>Start today</p>
          <h2 className="mt-4 break-keep font-serif text-[32px] font-[400] leading-[1.12] text-[var(--t1)] md:text-[40px]">오늘 읽을 글부터.</h2>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <PromoLink href={primary.href} slot="hero" index={9} className={BTN.primary}>
              {primary.label}
            </PromoLink>
            <PromoLink href="/library/books" slot="hero" index={10} className={BTN.secondary}>
              서가 둘러보기
            </PromoLink>
          </div>
        </div>
      </div>
    </div>
  )
}
