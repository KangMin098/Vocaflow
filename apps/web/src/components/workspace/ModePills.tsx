// apps/web/src/components/workspace/ModePills.tsx
//
// 읽기 화면의 활동 선택 — **현재 활동 하나 + 그룹 펼침 메뉴 셋**(2026-10-19 · learner-tines-audit S4).
//
// 예전(v06.32)에는 활동 12개를 한 줄에 다 늘어놓고 사이사이 ▸ 화살표로 「다음 단계」를 보였다.
// 1440 에서도 두 줄로 넘쳤고(「Game Lab」 줄바꿈), 화살표는 정해진 순서가 있다고 말했지만 실제로는 아무 활동이나 고를 수 있다.
// 그래서: 지금 하는 활동은 늘 보이는 알약 하나, 나머지는 기존 3 그룹(읽기·듣기 / 단어 / 연습)의 펼침 메뉴로.
//
// 보존한 계약 — 목적지(`hrefFor`)는 예전 분기 그대로다:
//   comic → /text/[id]/comic · shadow → ?mode=shadow · listen/read/spellforge → ?mode=
//   words/flashcard/wordblitz/arcade → 자료 스코프(?set/?text) href + from= 복귀
//   pairflip/dictation → ?text=<id> + from= · quiz → /scriptquiz(스코프 없는 허브)
// 상태 표시(현재 · 완료 · 미시작 점)와 그룹 색도 그대로다. 메뉴는 닫혀 있어도 DOM 에 남는다(`hidden`) —
// 링크 목록을 읽는 검사(e2e 12-navigation)가 닫힌 상태에서도 전부 본다.

'use client'

import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

import { POPOVER_MENU } from '@/components/ui/tines-kit'
import { useEscapeKey } from '@/lib/ui/use-escape-key'
import type { ModeKey, ModeStatus } from '@/types/library'

type GroupKey = 'input' | 'study' | 'practice'

interface Mode {
  key: ModeKey
  label: string
  group: GroupKey
}

// 알약은 짧은 쪽을 고른다 — 모듈 정식명(SpellForge)이 아니라 그 활동을 가리키는 한 단어.
// PLAN_ACTIVITIES 와 같은 활동을 가리키는 항목은 같은 말을 쓴다(Listen·Read·Words·Flashcard…).
const MODES: Mode[] = [
  { key: 'listen', label: 'Listen', group: 'input' },
  { key: 'read', label: 'Read', group: 'input' },
  { key: 'comic', label: 'Comic', group: 'input' },
  { key: 'shadow', label: 'Shadow', group: 'input' },
  { key: 'words', label: 'Words', group: 'study' },
  { key: 'flashcard', label: 'Cards', group: 'study' },
  { key: 'spellforge', label: 'Spell', group: 'practice' },
  { key: 'wordblitz', label: 'Blitz', group: 'practice' },
  // ADR 0006 D1 — 사이드바를 4표면으로 줄이려면 7 모듈 전부가 여기서 열려야 한다.
  { key: 'pairflip', label: 'Pairs', group: 'practice' },
  { key: 'arcade', label: 'Game Lab', group: 'practice' },
  { key: 'quiz', label: 'Quiz', group: 'practice' },
  { key: 'dictation', label: 'Dictate', group: 'practice' },
]

const GROUPS: { key: GroupKey; label: string; color: string }[] = [
  { key: 'input', label: '읽기·듣기', color: 'var(--p)' },
  { key: 'study', label: '단어', color: 'var(--learn-fresh)' },
  { key: 'practice', label: '연습', color: 'var(--accent-plum)' },
]

const MODULE_ROUTES: Partial<Record<ModeKey, string>> = {
  quiz: '/scriptquiz',
}

/** 자료 스코프(`?text=`)를 붙여 여는 모듈 — 라우트 계약은 기존 런처와 같다. */
const TEXT_SCOPED_ROUTES: Partial<Record<ModeKey, (textId: string) => string>> = {
  pairflip: (id) => `/pairflip/play?text=${id}`,
  dictation: (id) => `/dictate/setup?text=${id}`,
}

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'

interface ModePillsProps {
  textId: string
  currentMode: ModeKey
  modeStatus: Record<ModeKey, ModeStatus>
  isFocusMode: boolean
  /** "단어" 목적지 — 본문 모드가 아니라 해당 자료의 단어장(WordVault) 으로 이동 */
  wordsHref: string
  /** "카드" 목적지 — 해당 자료의 단어로 Flashcard 세션 진입 (?set/?text 스코프) */
  flashcardHref: string
  /** "블리츠" 목적지 — 해당 자료의 단어로 WordBlitz 진입 (?set/?text 스코프) */
  wordblitzHref: string
  /**
   * "Game Lab" 목적지 — 같은 스코프를 아케이드 허브로 넘긴다.
   * 허브가 ?set/?text 를 받아 모든 카드에 실어주므로(v07.8) 이 자료의 단어가 게임 19종 전부에 연결된다.
   */
  arcadeHref: string
}

/** 상태 점 — 현재(흰 점 · 그룹색 바탕 위) · 완료(그룹색 채움) · 미시작(그룹색 테두리) */
function StatusDot({ color, active, done }: { color: string; active: boolean; done: boolean }) {
  return (
    <span
      aria-hidden
      className="h-2 w-2 shrink-0 rounded-full"
      style={{
        backgroundColor: active ? '#FFFFFF' : done ? color : 'transparent',
        border: active || done ? 'none' : `1.5px solid ${color}`,
      }}
    />
  )
}

export function ModePills({
  textId,
  currentMode,
  modeStatus,
  isFocusMode,
  wordsHref,
  flashcardHref,
  wordblitzHref,
  arcadeHref,
}: ModePillsProps) {
  const [openGroup, setOpenGroup] = useState<GroupKey | null>(null)
  const navRef = useRef<HTMLElement>(null)
  const triggers = useRef<Partial<Record<GroupKey, HTMLButtonElement | null>>>({})
  const baseId = useId()

  // 풀스크린 세션으로 나갈 때 출처를 실어, 닫기/Esc 시 이 워크스페이스로 복귀.
  const fromParam = `from=${encodeURIComponent(`/text/${textId}`)}`
  const withReturn = (href: string): string => `${href}${href.includes('?') ? '&' : '?'}${fromParam}`

  const hrefFor = (key: ModeKey): string =>
    key === 'comic'
      ? `/text/${textId}/comic`
      : key === 'shadow'
        ? `/text/${textId}?mode=shadow`
        : key === 'words'
          ? withReturn(wordsHref)
          : key === 'flashcard'
            ? withReturn(flashcardHref)
            : key === 'wordblitz'
              ? withReturn(wordblitzHref)
              : key === 'arcade'
                ? withReturn(arcadeHref)
                : TEXT_SCOPED_ROUTES[key]
                  ? withReturn(TEXT_SCOPED_ROUTES[key]!(textId))
                  : (MODULE_ROUTES[key] ?? `/text/${textId}?mode=${key}`)

  // 바깥을 누르면 닫는다 · Esc 는 닫고 연 단추로 포커스를 돌려준다
  useEffect(() => {
    if (!openGroup) return
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [openGroup])
  useEscapeKey(openGroup !== null, () => {
    const g = openGroup
    setOpenGroup(null)
    if (g) triggers.current[g]?.focus()
  })

  const current = MODES.find((m) => m.key === currentMode)
  const currentGroup = GROUPS.find((g) => g.key === current?.group)

  return (
    <nav
      ref={navRef}
      aria-label="학습 단계 선택"
      // UnifiedHeader 부모가 이미 sticky — 자체 sticky 제거 (stacking context 충돌 차단)
      className={`relative border-b border-[color-mix(in_srgb,var(--bd)_40%,transparent)] bg-[color-mix(in_srgb,var(--reading-bg)_95%,transparent)] backdrop-blur-[16px] transition-all duration-[var(--dur-slower)] motion-reduce:transition-none ${
        isFocusMode ? '-translate-y-1 opacity-40 hover:translate-y-0 hover:opacity-100' : 'opacity-100'
      }`}
    >
      <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-center gap-2 px-4 py-1.5 md:px-8">
        {/* 지금 하는 활동 — 늘 보인다 */}
        {current && currentGroup && (
          <Link
            href={hrefFor(current.key)}
            aria-current="page"
            className={`inline-flex min-h-11 items-center gap-2 rounded-[var(--r-full)] px-4 font-display text-[13px] font-[700] text-white ${FOCUS}`}
            style={{ backgroundColor: currentGroup.color }}
          >
            <StatusDot color={currentGroup.color} active done={false} />
            {current.label}
          </Link>
        )}
        <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-[var(--bd)]" />

        {/* 나머지 — 그룹 펼침 메뉴 셋 */}
        {GROUPS.map((group) => {
          const modes = MODES.filter((m) => m.group === group.key)
          const done = modes.filter((m) => modeStatus[m.key] === 'done').length
          const open = openGroup === group.key
          const panelId = `${baseId}-${group.key}`
          const hasCurrent = modes.some((m) => m.key === currentMode)
          return (
            <div key={group.key} className="relative">
              <button
                ref={(el) => { triggers.current[group.key] = el }}
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenGroup(open ? null : group.key)}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-[var(--r-full)] px-3.5 font-display text-[13px] font-[600] transition-colors duration-[var(--dur-quick)] ${
                  open || hasCurrent ? 'bg-[var(--bg2)] text-[var(--t1)]' : 'text-[var(--t2)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]'
                } ${FOCUS}`}
              >
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                {group.label}
                <span className="font-mono text-[11px] font-[600] text-[var(--t2)]" aria-label={`${modes.length}개 중 ${done}개 완료`}>
                  {done}/{modes.length}
                </span>
                <ChevronDown size={14} aria-hidden className={`transition-transform duration-[var(--dur-quick)] ${open ? 'rotate-180' : ''}`} />
              </button>
              <div
                id={panelId}
                hidden={!open}
                className={`absolute left-1/2 top-[calc(100%+6px)] z-[75] w-[220px] -translate-x-1/2 p-1.5 ${POPOVER_MENU}`}
              >
                <ul aria-label={`${group.label} 활동`} className="flex flex-col">
                  {modes.map((mode) => {
                    const isActive = mode.key === currentMode
                    const isDone = modeStatus[mode.key] === 'done'
                    return (
                      <li key={mode.key}>
                        <Link
                          href={hrefFor(mode.key)}
                          aria-current={isActive ? 'page' : undefined}
                          onClick={() => setOpenGroup(null)}
                          className={`flex min-h-11 items-center justify-between gap-2 rounded-[8px] px-3 font-display text-[13.5px] font-[600] transition-colors duration-[var(--dur-quick)] ${
                            isActive ? 'bg-[var(--bg2)] text-[var(--t1)]' : 'text-[var(--t1)] hover:bg-[var(--bg2)]'
                          } ${FOCUS}`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <StatusDot color={group.color} active={false} done={isDone || isActive} />
                            <span
                              className={
                                mode.key === 'comic' && !isActive
                                  ? 'underline decoration-2 underline-offset-4 decoration-[var(--active)]'
                                  : undefined
                              }
                            >
                              {mode.label}
                            </span>
                          </span>
                          <span className="font-mono text-[11px] font-[500] text-[var(--t2)]">
                            {isActive ? '지금' : isDone ? '완료' : ''}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
    </nav>
  )
}
