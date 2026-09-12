// apps/web/src/components/admin/AdminScreenHelp.tsx
//
// 관리자 화면도움말 — 헤더의 `?` 버튼 → 인라인 펼침 패널.
//
// 왜 모달이 아닌가: 관리자는 도움말을 **보면서** 화면을 조작한다. 모달은 그걸 막고,
// CLAUDE.md 도 "모달 오버레이로 작업을 끊지 마라"를 요구한다. 인라인이라 열어 둔 채로
// 다음 단계를 눌러도 된다.
//
// 탭이 있는 화면은 `tab` 을 넘기면 그 탭의 도움말로 바뀐다 — 탭을 옮기면 내용도 따라간다.
// 열림 상태는 화면별로 localStorage 에 기억한다(늘 여는 사람과 늘 접는 사람이 갈린다).
//
// ⚠️ 2026-09-05 수정 — **화면 단위 도움말이 통째로 사문화돼 있었다.**
//   예전 코드는 `const body = (tab && entry.tabs?.[tab]) || entry.screen` 한 줄로 **둘 중 하나만**
//   골랐다. 그런데 탭을 넘기는 화면들은 활성 탭 라벨이 항상 정의돼 있어(첫 탭이 기본값)
//   `entry.screen` 가지에 **한 번도 닿지 않았다.** 거기에는 "채움률을 품질로 읽지 마라",
//   "이 배지가 0 이면 조회 실패일 수 있다" 같은 **오조작 방지 경고**가 들어 있었다.
//   지금은 탭 본문을 그린 뒤 화면 전체 경고를 항상 덧붙인다 — 탭을 어디로 옮겨도 사라지지 않는다.

'use client'

import { useEffect, useId, useState } from 'react'
import { AlertTriangle, ChevronDown, CircleHelp, ExternalLink, Terminal } from 'lucide-react'
import Link from 'next/link'

import { HELP_REGISTRY } from '@/lib/admin/help'
import type { HelpActor, HelpDiagram, HelpNode, ScreenHelp } from '@/lib/admin/help/types'

const STORE = 'vocaflow-admin-help-open'

function readOpen(screen: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return (JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, boolean>)[screen] === true
  } catch {
    return false
  }
}

function writeOpen(screen: string, open: boolean) {
  if (typeof window === 'undefined') return
  try {
    const all = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, boolean>
    all[screen] = open
    localStorage.setItem(STORE, JSON.stringify(all))
  } catch {
    /* private mode — 세션 한정 */
  }
}

/** 앱 안 경로면 Link(전체 리로드 없음), 밖이면 a. 도움말이 화면 간 유일 통로인 곳이 있다. */
/**
 * **저장소 문서는 링크가 아니다.**
 *
 * `seeAlso` 에 `/docs/CSAT_TYPE_BLUEPRINTS.md` 같은 항목이 7개 있었고 전부 `<Link>` 로
 * 그려져 **누르면 404** 였다(실측 2026-09-05 — 링크 그래프 감사). 파일은 저장소에 멀쩡히
 * 있지만 `public/` 이 아니라 서버가 주지 않는다. 관리자는 눌러 보고 나서야 안다.
 *
 * 서빙 라우트를 새로 내는 것은 노출 면이 늘어나는 일이라, 여기서는 **정직하게** 누를 수 없는
 * 경로 표기로 그린다. 같은 실수가 다시 나지 않도록 데이터 타입을 갈라 뒀다 —
 * `HelpRef` 의 `doc` 가지(`lib/admin/help/types.ts`).
 */
function DocRef({ label, doc }: { label: string; doc: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-display text-[12px] font-[700] text-[var(--t2)]">
      {label}
      <code className="rounded bg-[var(--bg3)] px-1 py-[1px] font-mono text-[11px] font-[500] text-[var(--t3)]">
        {doc}
      </code>
    </span>
  )
}

function HelpLink({ href, label }: { href: string; label: string }) {
  const cls =
    'inline-flex items-center gap-1 font-display text-[12px] font-[700] text-[#6D28D9] underline decoration-[#8B5CF6]/40 underline-offset-2 hover:decoration-[#8B5CF6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]'
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={cls}>
        {label}
      </Link>
    )
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {label}
      <ExternalLink size={11} aria-hidden />
    </a>
  )
}

function SeeAlso({ items }: { items: NonNullable<ScreenHelp['seeAlso']> }) {
  return (
    <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
      {items.map((s) =>
        'doc' in s && s.doc ? (
          <DocRef key={s.doc} label={s.label} doc={s.doc} />
        ) : 'href' in s && s.href ? (
          <HelpLink key={s.href} href={s.href} label={s.label} />
        ) : null,
      )}
    </p>
  )
}

function Cautions({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-3 flex flex-col gap-1">
      {items.map((c) => (
        <li key={c} className="flex gap-2 font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">
          <AlertTriangle size={13} aria-hidden className="mt-1 shrink-0 text-[#B45309]" />
          <span>{c}</span>
        </li>
      ))}
    </ul>
  )
}

/* ─────────────────────────── 도식 ─────────────────────────── */

const ACTOR: Record<HelpActor, { label: string; mark: string }> = {
  script: { label: '스크립트', mark: '>_' },
  claude: { label: 'Claude Code', mark: '✦' },
  user: { label: '사람', mark: '◉' },
  auto: { label: '자동', mark: '⟳' },
}

/**
 * 상태 — **색 + 기호 + 글자 셋을 함께** 낸다.
 *
 * 색만 쓰지 않는 이유는 실측이다: 공정 4색을 팔레트 검증기에 넣으면 「통과(초록)」와
 * 「몫 남음(주황)」의 색약 분리가 ΔE 7.8(protan)로 경고 대역이다. 현황판의 라인 도식이
 * 같은 이유로 모양을 갈랐고, 도움말도 같은 규약을 쓴다.
 */
const STATE: Record<NonNullable<HelpNode['state']>, { label: string; color: string; mark: string }> = {
  pass: { label: '통과', color: '#2E7D5A', mark: '●' },
  short: { label: '몫 남음', color: '#B5803A', mark: '◐' },
  blocked: { label: '막힘', color: '#9C3A30', mark: '■' },
  unmeasured: { label: '못 잼', color: '#8A8278', mark: '○' },
}

function NodeCard({ n }: { n: HelpNode }) {
  const st = n.state ? STATE[n.state] : null
  const ac = n.actor ? ACTOR[n.actor] : null
  return (
    <div
      className="flex min-w-0 flex-1 flex-col gap-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] p-2"
      style={st ? { borderColor: `${st.color}66` } : undefined}
    >
      <p className="flex items-center gap-1 break-keep font-display text-[12px] font-[700] leading-snug text-[var(--t1)]">
        {st && (
          <span aria-hidden className="shrink-0 text-[11px]" style={{ color: st.color }}>
            {st.mark}
          </span>
        )}
        {n.label}
      </p>
      {/* 라벨이 이미 그 상태 이름이면 두 번 적지 않는다 — 기호표에서 「통과 / 통과」가 된다. */}
      {st && st.label !== n.label && (
        <span className="font-mono text-[10px] font-[700]" style={{ color: st.color }}>
          {st.label}
        </span>
      )}
      {n.says && (
        <p className="break-keep font-body text-[11px] leading-[1.55] text-[var(--t2)]">{n.says}</p>
      )}
      {ac && (
        <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-1 py-0.5 font-mono text-[9.5px] font-[700] text-[var(--t3)]">
          <span aria-hidden>{ac.mark}</span>
          {ac.label}
        </span>
      )}
    </div>
  )
}

/**
 * 도식 하나.
 *
 * ⚠️ **가로 스크롤은 이 그림 안에서만 난다.** 칸이 여덟이면 390px 에 안 들어가는데,
 *   본문이 옆으로 밀리면 화면 전체가 망가진다(CLAUDE.md 모바일 퍼스트). 그래서 흐름은
 *   좁은 화면에서 **세로로 쌓고**(화살표도 아래를 가리킨다) 넓어지면 가로로 눕는다.
 */
function Diagram({ d }: { d: HelpDiagram }) {
  return (
    <figure className="m-0 mt-3 flex flex-col gap-2 rounded-[var(--r-md)] border border-[#8B5CF6]/20 bg-[var(--bg)]/60 p-3">
      <figcaption className="break-keep font-display text-[11.5px] font-[800] text-[var(--t2)]">
        {d.caption}
      </figcaption>

      <div className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:items-stretch">
        {d.nodes.map((n, i) => (
          <div key={n.label} className="flex min-w-0 flex-1 flex-col items-stretch gap-1.5 sm:flex-row">
            {i > 0 && d.kind === 'flow' && (
              <span
                aria-hidden
                className="self-center font-mono text-[12px] leading-none text-[var(--t3)] sm:self-center"
              >
                <span className="sm:hidden">↓</span>
                <span className="hidden sm:inline">→</span>
              </span>
            )}
            <NodeCard n={n} />
          </div>
        ))}
      </div>

      {d.kind === 'flow' && d.branch && d.branch.length > 0 && (
        <ul className="flex flex-col gap-1">
          {d.branch.map((b) => (
            <li
              key={b.when}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 break-keep border-l-2 border-[var(--bd)] pl-2 font-body text-[11.5px] leading-[1.55] text-[var(--t2)]"
            >
              <span className="font-mono text-[10px] font-[700] text-[var(--t3)]">{b.when}</span>
              <span>{b.then}</span>
            </li>
          ))}
        </ul>
      )}

      {d.kind === 'flow' && d.loop && (
        <p className="flex items-start gap-1.5 break-keep font-body text-[11.5px] leading-[1.55] text-[var(--t2)]">
          <span aria-hidden className="font-mono text-[12px] text-[#8B5CF6]">
            ↺
          </span>
          {d.loop}
        </p>
      )}
    </figure>
  )
}

/**
 * 접히는 절 — **글자의 77%가 여기 있다**(실측 2026-09-12: `fields` 41% · `drain` 36%).
 *
 * 지우지 않고 접는다. 그 안에는 실측 근거와 사고 기록이 들어 있어서, 지우면 다음 사람이
 * 같은 사고를 다시 낸다. 다만 **열었을 때 먼저 오는 것**이 그 벽이어서는 안 된다.
 *
 * `<details>` 를 쓰는 이유: 키보드·스크린리더가 그냥 되고, JS 상태가 하나도 안 늘고,
 * `renderToString` 으로 **닫힌 상태의 글자 수를 잴 수 있다**(회귀가 그것을 잰다).
 */
function Fold({
  label,
  count,
  children,
}: {
  label: string
  count: number
  children: React.ReactNode
}) {
  return (
    <details className="mt-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]/50">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-3 font-display text-[12px] font-[700] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] motion-reduce:transition-none">
        <ChevronDown size={13} aria-hidden className="shrink-0" />
        {label}
        <span className="font-mono text-[10.5px] font-[400] text-[var(--t3)]">{count}</span>
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  )
}

/**
 * 도움말 본문 한 덩이 — 화면 단위든 탭 단위든 같은 모양으로 그린다.
 *
 * ⚠️ **내보내는 이유는 회귀 때문이다.** 패널 전체(`AdminScreenHelp`)는 `useState(false)` 로
 * 시작하므로 `renderToString` 이 늘 **닫힌 버튼만** 그린다 — 그 결과로는 「열었을 때 보이는
 * 글자」를 잴 수 없고, 없는 문자열을 「없다」고 확인하는 빈 검사가 된다. 본문을 따로 내보내면
 * 접힘이 실제로 닫혀 있는지, 그림이 산문보다 위에 오는지를 **렌더 결과로** 잰다
 * (`help-diagram.test.ts`).
 */
export function HelpBody({ body }: { body: ScreenHelp }) {
  return (
    <>
      <p className="mt-1.5 font-body text-[13.5px] leading-[1.7] text-[var(--t1)]">{body.summary}</p>
      {body.when && (
        <p className="mt-1 font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">
          <span className="font-[700] text-[var(--t1)]">언제 </span>
          {body.when}
        </p>
      )}

      {/* 산문보다 **위에** 그린다 — 관리자가 묻는 「지금 어느 칸이고 다음은 무엇인가」가
          4,000자 안에 섞여 있던 것이 이 화면의 원래 문제였다. */}
      {body.diagrams?.map((d) => <Diagram key={d.caption} d={d} />)}

      {body.steps && body.steps.length > 0 && (
        <ol className="mt-3 flex flex-col gap-2">
          {body.steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--r-full)] bg-[#8B5CF6] font-mono text-[11px] font-[800] text-white"
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="font-display text-[13px] font-[700] text-[var(--t1)]">{s.title}</span>
                <span className="ml-1.5 font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">{s.detail}</span>
                {s.done && (
                  <span className="mt-0.5 block font-body text-[12px] text-[var(--t3)]">
                    완료 신호 — {s.done}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}

      {body.fields && body.fields.length > 0 && (
        <Fold label="지표·버튼이 뜻하는 것" count={body.fields.length}>
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_1fr]">
            {body.fields.map((f) => (
              <div key={f.label} className="contents">
                <dt className="font-display text-[12.5px] font-[700] text-[var(--t1)]">{f.label}</dt>
                <dd className="font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">{f.detail}</dd>
              </div>
            ))}
          </dl>
        </Fold>
      )}

      {body.drain && (
        <Fold label="Claude Code 드레인 절차" count={body.drain.procedure.length}>
        <section className="rounded-[var(--r-md)] border border-[#B0843A]/35 bg-[#B0843A]/[0.06] p-3">
          <h3 className="flex items-center gap-2 font-display text-[12.5px] font-[800] text-[var(--t1)]">
            <Terminal size={13} aria-hidden className="text-[#B0843A]" />
            Claude Code 드레인 절차
          </h3>
          <p className="mt-1 font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">{body.drain.what}</p>

          <p className="mt-2 font-display text-[11.5px] font-[800] uppercase tracking-[0.08em] text-[var(--t3)]">
            시작 전 확인
          </p>
          <ul className="mt-0.5 list-disc pl-4 font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">
            {body.drain.prerequisites.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>

          <p className="mt-2 font-display text-[11.5px] font-[800] uppercase tracking-[0.08em] text-[var(--t3)]">
            절차
          </p>
          <ol className="mt-0.5 flex flex-col gap-2">
            {body.drain.procedure.map((s, i) => (
              <li key={s.title} className="flex gap-2">
                <span aria-hidden className="font-mono text-[11.5px] font-[800] text-[#B0843A]">
                  {i + 1}.
                </span>
                <span className="min-w-0">
                  <span className="font-display text-[12.5px] font-[700] text-[var(--t1)]">{s.title}</span>
                  <span className="ml-1.5 font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">{s.detail}</span>
                  {s.done && (
                    <span className="mt-0.5 block font-body text-[12px] text-[var(--t3)]">완료 신호 — {s.done}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-2 font-display text-[11.5px] font-[800] uppercase tracking-[0.08em] text-[var(--t3)]">
            끝났는지 확인
          </p>
          <ul className="mt-0.5 list-disc pl-4 font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">
            {body.drain.verify.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>

          {body.drain.recovery && body.drain.recovery.length > 0 && (
            <>
              <p className="mt-2 font-display text-[11.5px] font-[800] uppercase tracking-[0.08em] text-[var(--t3)]">
                멈췄을 때
              </p>
              <ul className="mt-0.5 list-disc pl-4 font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">
                {body.drain.recovery.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </>
          )}
        </section>
        </Fold>
      )}

      {/* ⚠️ **경고는 접지 않는다.** 접는 기준은 「길이」가 아니라 「안 읽으면 무슨 일이
          벌어지는가」다 — 여기 있는 것은 전부 실제로 사고가 난 지점이고(이 저장소의 작성
          원칙), 안 보이면 그 사고가 다시 난다. 글자의 15%를 차지하지만 그 값은 낸다. */}
      {body.cautions && body.cautions.length > 0 && <Cautions items={body.cautions} />}
      {body.seeAlso && body.seeAlso.length > 0 && <SeeAlso items={body.seeAlso} />}
    </>
  )
}

export function AdminScreenHelp({
  screen,
  tab,
  className,
}: {
  /** HELP_REGISTRY 키 (라우트 슬러그: 'articles' · 'comic-drain' …) */
  screen: string
  /** 탭 라벨 — 화면에 보이는 그대로. 탭이 있는 화면만. */
  tab?: string
  className?: string
}) {
  const entry = HELP_REGISTRY[screen]
  const [open, setOpen] = useState(false)
  const panelId = useId()

  useEffect(() => {
    setOpen(readOpen(screen))
  }, [screen])

  // 도움말이 아직 없는 화면에서는 버튼 자체를 그리지 않는다 — 빈 패널이 더 나쁘다.
  if (!entry) return null

  const scoped: ScreenHelp | null = (tab && entry.tabs?.[tab]) || null

  // 탭 도움말을 그릴 때도 화면 전체 경고는 남긴다. 탭마다 되풀이해 적으면 낡을 때 한쪽만
  // 낡으므로, 화면 단위 항목은 여기 한 곳에서만 관리하고 어느 탭에서든 같은 것을 보여준다.
  const screenLevel = entry.screen
  const showScreenFooter =
    !!scoped &&
    ((screenLevel.cautions?.length ?? 0) > 0 ||
      (screenLevel.seeAlso?.length ?? 0) > 0 ||
      !!screenLevel.summary)

  const toggle = () => {
    setOpen((v) => {
      writeOpen(screen, !v)
      return !v
    })
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        // min-h-[36px] 이었다 — 44px 미만 탭 대상(CLAUDE.md 절대 금지).
        // 이 버튼은 **모든 관리자 화면**에 있어서 하나 고치면 26곳이 함께 낫는다
        // (실측 2026-08-26 · 390px). 관리자가 폰에서 처음 누르는 것이 대개 이것이다.
        className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-display text-[12px] font-[700] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:border-[#8B5CF6] hover:bg-[#8B5CF6]/8 hover:text-[#6D28D9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] active:scale-[0.97] disabled:opacity-50 motion-reduce:transition-none"
      >
        <CircleHelp size={14} aria-hidden />
        화면 도움말
        <ChevronDown
          size={13}
          aria-hidden
          className={`transition-transform duration-[var(--dur-normal)] motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={`${entry.title} 화면 도움말`}
          className="mt-2 rounded-[var(--r-lg)] border border-[#8B5CF6]/25 bg-[#8B5CF6]/[0.04] p-4"
        >
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="font-display text-[14px] font-[800] text-[var(--t1)]">{entry.title}</h2>
            {scoped && (
              <span className="rounded-[var(--r-full)] bg-[#8B5CF6]/14 px-2 py-1 font-display text-[11px] font-[700] text-[#6D28D9]">
                {tab}
              </span>
            )}
          </div>

          <HelpBody body={scoped ?? screenLevel} />

          {showScreenFooter && (
            <section className="mt-4 border-t border-[#8B5CF6]/20 pt-3">
              <h3 className="font-display text-[11.5px] font-[800] uppercase tracking-[0.08em] text-[var(--t3)]">
                이 화면 전체
              </h3>
              <p className="mt-1 font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">
                {screenLevel.summary}
              </p>
              {screenLevel.cautions && screenLevel.cautions.length > 0 && (
                <Cautions items={screenLevel.cautions} />
              )}
              {screenLevel.seeAlso && screenLevel.seeAlso.length > 0 && (
                <SeeAlso items={screenLevel.seeAlso} />
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
