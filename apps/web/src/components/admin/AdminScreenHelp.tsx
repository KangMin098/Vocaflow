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

/* ─────────────────────── 글자 안의 강조 ─────────────────────── */
//
// ⚠️ **별표가 글자로 새고 있었다** — 실측 2026-09-23: 교재 공장 11화면 + 탭 6개의 렌더
//    결과에 `**` 가 **1,164개** 그대로 찍혔다(= 굵게 표시 582군데). 도움말 본문은 처음부터
//    마크다운처럼 쓰여 있었는데 그리는 쪽이 그냥 문자열로 내보냈기 때문이다.
//    그래서 가장 중요한 문장이 `**실측이지 캐시가 아니다.**` 처럼 보였다 —
//    강조가 오히려 **읽기를 방해하는** 상태였고, 이것이 「도움말이 어렵다」의 1순위 원인이다.
//
// 고치는 방법은 둘이었다: ① 1,164곳에서 별표를 지운다 ② 그리는 쪽이 읽는다.
// ②를 골랐다 — ①은 본문에서 **무엇이 중요한지의 표시를 잃는** 일이고, 다음 사람이 다시
// 별표를 쓰기 시작하면 원점이다.
//
// `dangerouslySetInnerHTML` 은 쓰지 않는다. 문자열을 조각으로 잘라 React 원소로 만든다 —
// 도움말 본문은 저장소 안의 상수지만, HTML 을 그리는 경로를 하나 더 내지 않는다.
// ⚠️ 굵게 안쪽에 **홑별표가 들어갈 수 있다** — `docs/reports/vocab-*-benchmark.json` 처럼
//    글로브 패턴을 적은 자리가 실제로 있다(실측: 처음 규칙 `[^*\n]+` 은 그 한 줄을 못 읽고
//    별표를 그대로 흘렸다). 그래서 「`**` 가 아닌 글자」로 받는다. 줄바꿈은 여전히 경계다 —
//    여러 줄에 걸친 강조는 대개 짝이 깨진 것이고, 그런 것은 눈에 띄어야 고쳐진다.
const EMPHASIS = /(\*\*(?:(?!\*\*)[^\n])+\*\*|`[^`\n]+`)/g

/**
 * `**굵게**` 와 `` `코드` `` 만 읽는다. 그 밖의 마크다운은 본문에 쓰지 않는다.
 *
 * ⚠️ **조각이 아니라 한 덩이를 돌려준다.** 배열을 그대로 돌려주면 `display:flex` 인 문단에
 *    넣었을 때 조각마다 flex 아이템이 되어 390px 에서 한 낱말씩 세로로 쪼개진다
 *    (실측 캡처 2026-09-23 — 레일 아래 규칙 한 줄이 그렇게 무너졌다). 부르는 쪽이 매번
 *    감싸는 것을 기억할 수는 없으므로 **여기서** 감싼다.
 */
export function richText(text: string): React.ReactNode {
  if (!text.includes('**') && !text.includes('`')) return text
  const parts = text.split(EMPHASIS).filter((p) => p !== '')
  return <span>{parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-[800] text-[var(--t1)]">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={i}
          className="rounded-[var(--r-sm)] bg-[var(--bg3)] px-1 py-[1px] font-mono text-[0.92em] font-[500] text-[var(--t2)]"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    return <span key={i}>{part}</span>
  })}</span>
}

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
    'inline-flex items-center gap-1 font-display text-[12px] font-[700] text-[var(--p-hover)] underline decoration-[color-mix(in_srgb,var(--p)_40%,transparent)] underline-offset-2 hover:decoration-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]'
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
          <AlertTriangle size={13} aria-hidden className="mt-1 shrink-0 text-[var(--warning)]" />
          <span>{richText(c)}</span>
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
  pass: { label: '통과', color: 'var(--memory-stable)', mark: '●' },
  short: { label: '몫 남음', color: 'var(--memory-shaky)', mark: '◐' },
  blocked: { label: '막힘', color: 'var(--memory-risk)', mark: '■' },
  unmeasured: { label: '못 잼', color: 'var(--memory-new)', mark: '○' },
}

/** 칸 안의 항목 목록 — 「받는 것 셋」처럼 셀 수 있는 것. 문장이 아니라 눈금이다. */
function NodeItems({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((it) => (
        <li
          key={it}
          className="flex gap-1.5 break-keep font-body text-[11px] leading-[1.5] text-[var(--t2)]"
        >
          <span aria-hidden className="mt-[5px] h-[3px] w-[3px] shrink-0 rounded-full bg-[var(--t3)]" />
          <span className="min-w-0">{richText(it)}</span>
        </li>
      ))}
    </ul>
  )
}

function NodeCard({ n, order }: { n: HelpNode; order?: number }) {
  const st = n.state ? STATE[n.state] : null
  const ac = n.actor ? ACTOR[n.actor] : null
  return (
    <div
      className="flex min-w-0 flex-1 flex-col gap-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] p-2"
      style={st ? { borderColor: `color-mix(in srgb, ${st.color} 40%, transparent)` } : undefined}
    >
      <p className="flex items-center gap-1 break-keep font-display text-[12px] font-[700] leading-snug text-[var(--t1)]">
        {/* 순서가 있는 그림에서는 몇 번째인지를 **숫자로** 낸다 — 화살표만으로는
            390px 에서 세로로 접힌 뒤 순서가 흐려진다(실측). */}
        {order !== undefined && (
          <span
            aria-hidden
            className="inline-flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--p)_12%,transparent)] font-mono text-[9.5px] font-[800] text-[var(--p-hover)]"
          >
            {order}
          </span>
        )}
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
        <p className="break-keep font-body text-[11px] leading-[1.55] text-[var(--t2)]">{richText(n.says)}</p>
      )}
      {n.items && n.items.length > 0 && <NodeItems items={n.items} />}
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
 * 공정 레일 — 칸이 여덟이어도 한 눈에 들어오게.
 *
 * `flow` 로 여덟 칸을 그리면 1440px 에서 상자 하나가 160px 이 되고 390px 에서는 세로로
 * 여덟 번 접힌다(그 상한이 회귀에 6칸으로 박힌 이유다). 레일은 알약이라 줄바꿈으로 흐른다.
 * **지금 손댈 칸 하나**만 크게 그린다 — 관리자가 이 화면에서 묻는 것이 그것 하나다.
 */
function Lane({
  nodes,
  bottleneck,
  rule,
}: {
  nodes: readonly HelpNode[]
  bottleneck?: string
  rule?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-wrap items-stretch gap-1">
        {nodes.map((n, i) => {
          const st = n.state ? STATE[n.state] : null
          const here = bottleneck === n.label
          return (
            <li key={n.label} className="flex items-stretch gap-1">
              {i > 0 && (
                <span aria-hidden className="self-center font-mono text-[11px] leading-none text-[var(--t3)]">
                  ›
                </span>
              )}
              <div
                className={
                  'flex min-w-0 flex-col justify-center gap-0.5 rounded-[var(--r-md)] border px-2 py-1.5 ' +
                  (here
                    ? 'border-[var(--p)] bg-[color-mix(in_srgb,var(--p)_10%,transparent)] ring-2 ring-[color-mix(in_srgb,var(--p)_25%,transparent)]'
                    : 'border-[var(--bd)] bg-[var(--bg)]')
                }
                style={!here && st ? { borderColor: `color-mix(in srgb, ${st.color} 40%, transparent)` } : undefined}
              >
                <p className="flex items-center gap-1 whitespace-nowrap font-display text-[11.5px] font-[700] text-[var(--t1)]">
                  {st && (
                    <span aria-hidden className="text-[10px]" style={{ color: st.color }}>
                      {st.mark}
                    </span>
                  )}
                  {n.label}
                </p>
                {here && (
                  <span className="whitespace-nowrap font-mono text-[9.5px] font-[800] text-[var(--p-hover)]">
                    ▲ 여기부터
                  </span>
                )}
                {n.says && (
                  <span className="break-keep font-body text-[10px] leading-[1.45] text-[var(--t3)]">
                    {richText(n.says)}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {rule && (
        <p className="flex items-start gap-1.5 break-keep font-body text-[11.5px] leading-[1.55] text-[var(--t2)]">
          <span aria-hidden className="font-mono text-[11px] text-[var(--p)]">
            ▲
          </span>
          {/* ⚠️ `richText` 는 조각 배열을 돌려준다 — flex 컨테이너에 그대로 넣으면 **조각마다
              flex 아이템**이 되어 390px 에서 한 낱말씩 세로로 쪼개진다(실측 캡처 2026-09-23).
              한 겹 감싸서 문단으로 되돌린다. */}
          <span className="min-w-0">{richText(rule)}</span>
        </p>
      )}
    </div>
  )
}

/**
 * 화면의 계약 — 받는 것 → 하는 일 → 내놓는 것.
 *
 * 가운데 칸만 테두리를 진하게 준다: 세 칸이 같은 무게면 「이 화면이 무엇인가」가 안 보이고
 * 그냥 상자 셋이 된다.
 */
const IO_ROLE = ['받는 것', '하는 일', '내놓는 것'] as const

function Io({ nodes, gate }: { nodes: readonly HelpNode[]; gate?: string }) {
  return (
    <>
    <div className="flex flex-col items-stretch gap-1.5 sm:flex-row">
      {nodes.slice(0, 3).map((n, i) => (
        <div key={n.label} className="flex min-w-0 flex-1 flex-col items-stretch gap-1.5 sm:flex-row">
          {i > 0 && (
            <span aria-hidden className="self-center font-mono text-[12px] leading-none text-[var(--t3)]">
              <span className="sm:hidden">↓</span>
              <span className="hidden sm:inline">→</span>
            </span>
          )}
          <div
            className={
              'flex min-w-0 flex-1 flex-col gap-1 rounded-[var(--r-sm)] border p-2 ' +
              (i === 1 ? 'border-[color-mix(in_srgb,var(--p)_45%,transparent)] bg-[color-mix(in_srgb,var(--p)_6%,transparent)]' : 'border-[var(--bd)] bg-[var(--bg)]')
            }
          >
            <span className="font-mono text-[9.5px] font-[800] uppercase tracking-[0.08em] text-[var(--t3)]">
              {IO_ROLE[i]}
            </span>
            <NodeCardBody n={n} />
          </div>
        </div>
      ))}
    </div>
    {/* 게이트 — 세 칸 아래 한 줄. 「내놓는 것」과 붙여 두면 산출물 설명으로 읽힌다. */}
    {gate && (
      <p className="mt-1.5 flex items-start gap-1.5 break-keep rounded-[var(--r-sm)] border border-dashed border-[var(--bd)] px-2 py-1.5 font-body text-[11.5px] leading-[1.55] text-[var(--t2)]">
        <span aria-hidden className="mt-[1px] font-mono text-[10px] font-[800] text-[var(--t3)]">
          관문
        </span>
        <span className="min-w-0">{richText(gate)}</span>
      </p>
    )}
    </>
  )
}

/** `Io` 안에서는 테두리를 바깥 칸이 이미 그렸다 — 속만 다시 쓴다. */
function NodeCardBody({ n }: { n: HelpNode }) {
  const ac = n.actor ? ACTOR[n.actor] : null
  return (
    <>
      <p className="break-keep font-display text-[12px] font-[700] leading-snug text-[var(--t1)]">{n.label}</p>
      {n.says && (
        <p className="break-keep font-body text-[11px] leading-[1.55] text-[var(--t2)]">{richText(n.says)}</p>
      )}
      {n.items && n.items.length > 0 && <NodeItems items={n.items} />}
      {ac && (
        <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-1 py-0.5 font-mono text-[9.5px] font-[700] text-[var(--t3)]">
          <span aria-hidden>{ac.mark}</span>
          {ac.label}
        </span>
      )}
    </>
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
    <figure className="m-0 mt-3 flex flex-col gap-2 rounded-[var(--r-md)] border border-[color-mix(in_srgb,var(--p)_20%,transparent)] bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] p-3">
      <figcaption className="break-keep font-display text-[11.5px] font-[800] text-[var(--t2)]">
        {richText(d.caption)}
      </figcaption>

      {d.kind === 'lane' ? (
        <Lane nodes={d.nodes} bottleneck={d.bottleneck} rule={d.rule} />
      ) : d.kind === 'io' ? (
        <Io nodes={d.nodes} gate={d.gate} />
      ) : (
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
              <NodeCard n={n} order={d.kind === 'flow' ? i + 1 : undefined} />
            </div>
          ))}
        </div>
      )}

      {d.kind === 'flow' && d.branch && d.branch.length > 0 && (
        <ul className="flex flex-col gap-1">
          {d.branch.map((b) => (
            <li
              key={b.when}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 break-keep border-l-2 border-[var(--bd)] pl-2 font-body text-[11.5px] leading-[1.55] text-[var(--t2)]"
            >
              <span className="font-mono text-[10px] font-[700] text-[var(--t3)]">{b.when}</span>
              <span>{richText(b.then)}</span>
            </li>
          ))}
        </ul>
      )}

      {d.kind === 'flow' && d.loop && (
        <p className="flex items-start gap-1.5 break-keep font-body text-[11.5px] leading-[1.55] text-[var(--t2)]">
          <span aria-hidden className="font-mono text-[12px] text-[var(--p)]">
            ↺
          </span>
          {/* 위 `Lane` 과 같은 이유로 한 겹 감싼다 — 조각이 flex 아이템이 되면 안 된다. */}
          <span className="min-w-0">{richText(d.loop)}</span>
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
    <details className="mt-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[color-mix(in_srgb,var(--bg)_50%,transparent)]">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-3 font-display text-[12px] font-[700] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] motion-reduce:transition-none">
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
      <p className="mt-1.5 font-body text-[13.5px] leading-[1.7] text-[var(--t1)]">{richText(body.summary)}</p>
      {body.when && (
        <p className="mt-1 font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">
          <span className="font-[700] text-[var(--t1)]">언제 </span>
          {richText(body.when)}
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
                className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--r-full)] bg-[var(--p)] font-mono text-[11px] font-[800] text-[var(--on-p)]"
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="font-display text-[13px] font-[700] text-[var(--t1)]">{richText(s.title)}</span>
                <span className="ml-1.5 font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">{richText(s.detail)}</span>
                {s.done && (
                  <span className="mt-0.5 block font-body text-[12px] text-[var(--t3)]">
                    완료 신호 — {richText(s.done)}
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
                <dt className="font-display text-[12.5px] font-[700] text-[var(--t1)]">{richText(f.label)}</dt>
                <dd className="font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">{richText(f.detail)}</dd>
              </div>
            ))}
          </dl>
        </Fold>
      )}

      {body.drain && (
        <Fold label="Claude Code 드레인 절차" count={body.drain.procedure.length}>
        <section className="rounded-[var(--r-md)] border border-[color-mix(in_srgb,var(--active)_35%,transparent)] bg-[color-mix(in_srgb,var(--active)_6%,transparent)] p-3">
          <h3 className="flex items-center gap-2 font-display text-[12.5px] font-[800] text-[var(--t1)]">
            <Terminal size={13} aria-hidden className="text-[var(--active)]" />
            Claude Code 드레인 절차
          </h3>
          <p className="mt-1 font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">{richText(body.drain.what)}</p>

          <p className="mt-2 font-display text-[11.5px] font-[800] uppercase tracking-[0.08em] text-[var(--t3)]">
            시작 전 확인
          </p>
          <ul className="mt-0.5 list-disc pl-4 font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">
            {body.drain.prerequisites.map((p) => (
              <li key={p}>{richText(p)}</li>
            ))}
          </ul>

          <p className="mt-2 font-display text-[11.5px] font-[800] uppercase tracking-[0.08em] text-[var(--t3)]">
            절차
          </p>
          <ol className="mt-0.5 flex flex-col gap-2">
            {body.drain.procedure.map((s, i) => (
              <li key={s.title} className="flex gap-2">
                <span aria-hidden className="font-mono text-[11.5px] font-[800] text-[var(--active)]">
                  {i + 1}.
                </span>
                <span className="min-w-0">
                  <span className="font-display text-[12.5px] font-[700] text-[var(--t1)]">{richText(s.title)}</span>
                  <span className="ml-1.5 font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">{richText(s.detail)}</span>
                  {s.done && (
                    <span className="mt-0.5 block font-body text-[12px] text-[var(--t3)]">완료 신호 — {richText(s.done)}</span>
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
              <li key={v}>{richText(v)}</li>
            ))}
          </ul>

          {body.drain.recovery && body.drain.recovery.length > 0 && (
            <>
              <p className="mt-2 font-display text-[11.5px] font-[800] uppercase tracking-[0.08em] text-[var(--t3)]">
                멈췄을 때
              </p>
              <ul className="mt-0.5 list-disc pl-4 font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">
                {body.drain.recovery.map((r) => (
                  <li key={r}>{richText(r)}</li>
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
        className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-display text-[12px] font-[700] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:border-[var(--p)] hover:bg-[color-mix(in_srgb,var(--p)_8%,transparent)] hover:text-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] active:scale-[0.97] disabled:opacity-50 motion-reduce:transition-none"
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
          className="mt-2 rounded-[var(--r-lg)] border border-[color-mix(in_srgb,var(--p)_25%,transparent)] bg-[color-mix(in_srgb,var(--p)_4%,transparent)] p-4"
        >
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="font-display text-[14px] font-[800] text-[var(--t1)]">{entry.title}</h2>
            {scoped && (
              <span className="rounded-[var(--r-full)] bg-[color-mix(in_srgb,var(--p)_14%,transparent)] px-2 py-1 font-display text-[11px] font-[700] text-[var(--p-hover)]">
                {tab}
              </span>
            )}
          </div>

          <HelpBody body={scoped ?? screenLevel} />

          {showScreenFooter && (
            <section className="mt-4 border-t border-[color-mix(in_srgb,var(--p)_20%,transparent)] pt-3">
              <h3 className="font-display text-[11.5px] font-[800] uppercase tracking-[0.08em] text-[var(--t3)]">
                이 화면 전체
              </h3>
              <p className="mt-1 font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">
                {richText(screenLevel.summary)}
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
