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

'use client'

import { useEffect, useId, useState } from 'react'
import { AlertTriangle, ChevronDown, CircleHelp, ExternalLink, Terminal } from 'lucide-react'

import { HELP_REGISTRY } from '@/lib/admin/help'
import type { ScreenHelp } from '@/lib/admin/help/types'

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

  const body: ScreenHelp | undefined = (tab && entry.tabs?.[tab]) || entry.screen
  const scoped = tab && entry.tabs?.[tab] ? entry.tabs[tab] : null

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

          <p className="mt-1.5 font-body text-[13.5px] leading-[1.7] text-[var(--t1)]">{body.summary}</p>
          {body.when && (
            <p className="mt-1 font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">
              <span className="font-[700] text-[var(--t1)]">언제 </span>
              {body.when}
            </p>
          )}

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
            <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_1fr]">
              {body.fields.map((f) => (
                <div key={f.label} className="contents">
                  <dt className="font-display text-[12.5px] font-[700] text-[var(--t1)]">{f.label}</dt>
                  <dd className="font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">{f.detail}</dd>
                </div>
              ))}
            </dl>
          )}

          {body.drain && (
            <section className="mt-3 rounded-[var(--r-md)] border border-[#B0843A]/35 bg-[#B0843A]/[0.06] p-3">
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
          )}

          {body.cautions && body.cautions.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1">
              {body.cautions.map((c) => (
                <li key={c} className="flex gap-2 font-body text-[12.5px] leading-[1.7] text-[var(--t2)]">
                  <AlertTriangle size={13} aria-hidden className="mt-1 shrink-0 text-[#B45309]" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          )}

          {body.seeAlso && body.seeAlso.length > 0 && (
            <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
              {body.seeAlso.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  className="inline-flex items-center gap-1 font-display text-[12px] font-[700] text-[#6D28D9] underline decoration-[#8B5CF6]/40 underline-offset-2 hover:decoration-[#8B5CF6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
                >
                  {s.label}
                  <ExternalLink size={11} aria-hidden />
                </a>
              ))}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
