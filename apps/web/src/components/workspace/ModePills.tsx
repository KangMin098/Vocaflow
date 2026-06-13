// apps/web/src/components/workspace/ModePills.tsx
//
// v06.32 — 단계적 학습 흐름 ModePills.
// - 3 그룹 (입력 → 학습 → 연습) 단계 명확화
// - 그룹별 컬러 (보라/인디고/핑크) — Sidebar 그룹 accent 정합
// - 모드 라벨 항상 노출 + 사이사이 ▸ chevron (다음 단계 시각화)
// - 상태 3종: 활성 (알약 그룹색 배경) · 완료 (채워진 dot) · 미시작 (빈 dot)
// - 그룹 라벨 작게 위에 (INPUT / STUDY / PRACTICE)

'use client'

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

import type { ModeKey, ModeStatus } from '@/types/library'

type GroupKey = 'input' | 'study' | 'practice'

interface Mode {
  key: ModeKey
  label: string
  group: GroupKey
}

const MODES: Mode[] = [
  { key: 'listen', label: '듣기', group: 'input' },
  { key: 'read', label: '읽기', group: 'input' },
  { key: 'shadow', label: '따라읽기', group: 'input' },
  { key: 'words', label: '단어', group: 'study' },
  { key: 'flashcard', label: '카드', group: 'study' },
  { key: 'spellforge', label: '스펠', group: 'practice' },
  { key: 'wordblitz', label: '블리츠', group: 'practice' },
  { key: 'quiz', label: '퀴즈', group: 'practice' },
]

const GROUPS: { key: GroupKey; label: string; color: string; colorLight: string }[] = [
  { key: 'input', label: '본문', color: '#8B5CF6', colorLight: '#F5F3FF' },
  { key: 'study', label: '단어 학습', color: '#6366F1', colorLight: '#EEF2FF' },
  { key: 'practice', label: '연습', color: '#EC4899', colorLight: '#FDF2F8' },
]

// 워크스페이스 본문 모드가 아니라 각 학습 모듈로 이동하는 pill.
//   listen/read = 워크스페이스 본문 모드 (?mode=) · spellforge = 인라인 렌더 (page.tsx)
//   shadow = 인라인 따라읽기 (?mode=shadow) · words = wordsHref · flashcard = flashcardHref · wordblitz = wordblitzHref (자료 스코프)
//   quiz = 해당 모듈 hub (스크립트 기반 AI 문제 생성 필요 — 미연결)
const MODULE_ROUTES: Partial<Record<ModeKey, string>> = {
  quiz: '/scriptquiz',
}

interface ModePillsProps {
  textId: string
  currentMode: ModeKey
  modeStatus: Record<ModeKey, ModeStatus>
  isFocusMode: boolean
  /** "단어" pill 목적지 — 본문 모드가 아니라 해당 자료의 단어장(WordVault) 으로 이동 */
  wordsHref: string
  /** "카드" pill 목적지 — 해당 자료의 단어로 Flashcard 세션 진입 (?set/?text 스코프) */
  flashcardHref: string
  /** "블리츠" pill 목적지 — 해당 자료의 단어로 WordBlitz 진입 (?set/?text 스코프) */
  wordblitzHref: string
}

export function ModePills({
  textId,
  currentMode,
  modeStatus,
  isFocusMode,
  wordsHref,
  flashcardHref,
  wordblitzHref,
}: ModePillsProps) {
  // 그룹별 modes 분리
  const grouped = GROUPS.map((g) => ({
    ...g,
    modes: MODES.filter((m) => m.group === g.key),
  }))

  // 풀스크린 세션(단어·카드·블리츠·따라읽기)으로 나갈 때 출처를 실어, 닫기/Esc 시 이 워크스페이스로 복귀.
  const fromParam = `from=${encodeURIComponent(`/text/${textId}`)}`
  const withReturn = (href: string): string =>
    `${href}${href.includes('?') ? '&' : '?'}${fromParam}`

  return (
    <nav
      aria-label="학습 단계 선택"
      // UnifiedHeader 부모가 이미 sticky — 자체 sticky 제거 (stacking context 충돌 차단)
      className={`relative border-b border-[var(--bd)]/40 bg-[var(--reading-bg)]/95 backdrop-blur-[16px] transition-all duration-[var(--dur-slower)] ${
        isFocusMode
          ? '-translate-y-1 opacity-40 hover:translate-y-0 hover:opacity-100'
          : 'opacity-100'
      }`}
    >
      <div className="mx-auto flex max-w-[1080px] items-center justify-center gap-0.5 px-4 py-1.5 md:gap-1.5 md:px-8">
        {grouped.map((group, gIdx) => (
          <div key={group.key} className="flex items-center gap-0.5">
            {gIdx > 0 && (
              <span aria-hidden className="mx-1.5 h-4 w-px shrink-0 bg-[var(--bd)] md:mx-2" />
            )}
            {/* 모드 pills — 그룹 라벨 제거(컴팩트). divider + pill 색으로 그룹 구분 */}
            {group.modes.map((mode, mIdx) => {
                  const isActive = currentMode === mode.key
                  const status = modeStatus[mode.key]
                  const isDone = status === 'done'
                  // 모드별 목적지:
                  //   shadow → 같은 페이지 인라인 따라읽기 (?mode=shadow) · words → 단어장(WordVault) · 게임 → 모듈 hub
                  //   listen/read/spellforge → 워크스페이스 내부 (?mode=)
                  const href =
                    mode.key === 'shadow'
                      ? `/text/${textId}?mode=shadow`
                      : mode.key === 'words'
                        ? withReturn(wordsHref)
                        : mode.key === 'flashcard'
                          ? withReturn(flashcardHref)
                          : mode.key === 'wordblitz'
                            ? withReturn(wordblitzHref)
                            : (MODULE_ROUTES[mode.key] ?? `/text/${textId}?mode=${mode.key}`)
                  return (
                    <span key={mode.key} className="inline-flex items-center">
                      {mIdx > 0 && (
                        <ChevronRight
                          size={11}
                          aria-hidden
                          className="mx-0.5 shrink-0 text-[var(--t4)]"
                        />
                      )}
                      <Link
                        href={href}
                        aria-current={isActive ? 'page' : undefined}
                        className={`inline-flex items-center gap-1.5 rounded-[var(--r-full)] px-2.5 py-1 font-display text-[12px] font-[700] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] ${
                          isActive
                            ? 'text-white shadow-[var(--sh-sm)]'
                            : isDone
                            ? 'text-[var(--t1)] hover:bg-[var(--bg2)]'
                            : 'text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--bg2)]'
                        }`}
                        style={
                          isActive
                            ? {
                                backgroundColor: group.color,
                                boxShadow: `0 1px 8px ${group.color}55`,
                              }
                            : undefined
                        }
                      >
                        {/* Status dot */}
                        <span
                          aria-hidden
                          className="h-2 w-2 shrink-0 rounded-full transition-all"
                          style={{
                            backgroundColor: isActive
                              ? '#FFFFFF'
                              : isDone
                              ? group.color
                              : 'transparent',
                            border: isActive || isDone ? 'none' : `1.5px solid ${group.color}`,
                            boxShadow:
                              isActive && !isDone
                                ? `0 0 0 2px ${group.color}66`
                                : undefined,
                          }}
                        />
                        <span>{mode.label}</span>
                      </Link>
                    </span>
                  )
                })}
          </div>
        ))}
      </div>
    </nav>
  )
}
