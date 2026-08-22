// apps/web/src/components/wordvault/WordRow.tsx
//
// 단어 행 v4 (v06.21.5) — 펼침 메커니즘 제거 + 예문 우측 정렬 + 학습 효율 강화
//
// 변경 (v06.21.5):
//   - 행 펼침/접힘 chevron 제거 — 모든 정보가 항상 한 행에 노출
//   - 예문 우측 정렬 (text-right) — 시선 흐름: 영단어 → 뜻 → 예문
//   - 예문 하단 메타("N일 전·N일 후 복습·마스터 N/5") 제거 — Calm UI (압박 ↓)
//
// 학습 효과 강화:
//   - 행 클릭 시 발음 자동 재생 (중복 클릭 비용 제거 — Fitts's law)
//   - Memory state 좌측 1~2px 엣지 색상 항상 노출 (4색 토큰 시각 인지)
//   - 영단어/뜻/예문 시각 위계 명확화 — 영단어(t1 600 16px) > 뜻(t1 500 13px) > 예문(t3 italic 12.5px)
//   - hover 시 행 미세 hover-lift bg2/60 + 좌측 엣지 풀 opacity
//   - 예문 우측 정렬 → 영어 본문 line-end가 시각 흐름 안정 (좌→우→완결)

'use client'

import { MemoryBadge } from '@/components/ui/MemoryBadge'
import { cn } from '@/lib/utils/cn'
import { Play } from 'lucide-react'
import { getMemoryState, type MemoryState } from '@/lib/srs'
import type { HideStates, WordItem } from './types'

const MEMORY_EDGE_COLOR: Record<MemoryState, string> = {
  stable: 'var(--memory-stable)',
  shaky: 'var(--memory-shaky)',
  risk: 'var(--memory-risk)',
  new: 'var(--memory-new)',
}

export interface WordRowProps {
  word: WordItem
  isSelected: boolean
  isPlaying: boolean
  hideStates: HideStates
  onToggleSelect: (id: number) => void
  onPlayWord: (id: number) => void
}

export function WordRow({
  word,
  isSelected,
  isPlaying,
  hideStates,
  onToggleSelect,
  onPlayWord,
}: WordRowProps) {
  const stopBubble = (e: React.MouseEvent) => e.stopPropagation()

  const memoryState = word.srs ? getMemoryState(word.srs) : 'new'
  const edgeColor = MEMORY_EDGE_COLOR[memoryState]

  return (
    <div
      className={cn(
        'group relative transition-colors duration-fast',
        // 부드러운 gradient bottom border
        'after:pointer-events-none after:absolute after:bottom-0 after:left-3 after:right-3 after:h-px',
        'after:bg-gradient-to-r after:from-transparent after:via-bd after:to-transparent',
        'last:after:hidden',
        isPlaying && 'bg-learn-fresh-light/50',
        isSelected && !isPlaying && 'bg-learn-mastered-light/30',
        !isPlaying && !isSelected && 'hover:bg-bg2/60'
      )}
      data-id={word.id}
      // 회귀 스펙(01-wordvault-browse)이 찾는 선언. 이게 없어서 그 스펙이 클래스 이름
      // 추측(`[class*="WordRow"]`)에 기대다가 조용히 깨져 있었다(실측 2026-08-15).
      // 마크업을 바꿔도 테스트가 살아 있으려면 선언이 있어야 한다.
      data-testid="word-row"
    >
      {/* 좌측 Memory state 엣지 — 4색 시각 단서 */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute bottom-0 left-0 top-0 transition-all duration-normal',
          isPlaying ? 'w-[2px]' : 'w-px opacity-50 group-hover:opacity-100'
        )}
        style={{ backgroundColor: isPlaying ? 'var(--memory-stable)' : edgeColor }}
      />

      {/* ── 메인 행 (8 column grid) ── */}
      <div
        onClick={() => onPlayWord(word.id)}
        className={cn('grid cursor-pointer items-center gap-3 px-4 py-2.5 md:gap-4')}
        style={{
          gridTemplateColumns:
            'auto auto minmax(0, 200px) minmax(0, 130px) minmax(0, 1fr) auto auto',
        }}
      >
        {/* 1. 체크박스 */}
        <button
          type="button"
          onClick={(e) => {
            stopBubble(e)
            onToggleSelect(word.id)
          }}
          aria-label={isSelected ? '선택 해제' : '선택'}
          aria-pressed={isSelected}
          // ⚠️ 실측 14x14 — 이 목록에서 가장 작은 타깃이었다(기준 44px).
          //    보이는 상자 14px 는 행 밀도가 정한 값이라 그대로 두고, 누르는 자리만 44px 로.
          className="group/check -m-[15px] flex h-11 w-11 shrink-0 items-center justify-center"
        >
          <span
            aria-hidden
            className={cn(
              'flex h-[14px] w-[14px] items-center justify-center rounded-[3px] border-[1.5px] transition-all duration-fast',
              isSelected
                ? 'border-learn-mastered bg-learn-mastered'
                : 'border-bd-strong bg-bg group-hover/check:border-learn-mastered'
            )}
          >
          {isSelected && (
            <span
              className="block h-[3.5px] w-[7px] -translate-y-[0.5px] rotate-[-45deg]"
              style={{
                borderLeft: '1.5px solid white',
                borderBottom: '1.5px solid white',
              }}
            />
          )}
          </span>
        </button>

        {/*
          2. 재생 — **진짜 버튼이다.**

          이전에는 `<span aria-hidden>` 장식이었고 재생은 행 `div` 의 `onClick` 하나뿐이었다.
          그런데 단어·뜻·예문 열은 텍스트 선택을 위해 `stopPropagation` 을 건다. 결과:
            · 키보드·스크린리더로는 **단어를 재생할 방법이 아예 없었다**(행에 role·tabIndex 없음)
            · 마우스로도 학습자가 가장 누를 법한 **단어 글자를 누르면 아무 일도 안 났다**
          실측 2026-08-17 — TTS 회귀 스펙을 붙이다 드러났다(자동화가 아니었으면 계속 몰랐다).
          행 클릭은 편의로 남기고, 이 버튼이 정식 경로가 된다.
        */}
        <button
          type="button"
          onClick={(e) => {
            stopBubble(e)
            onPlayWord(word.id)
          }}
          aria-label={`${word.word} 발음 듣기`}
          // ⚠️ 보이는 크기는 28px 인데 **누르는 영역이 28px 이면 안 된다**(기준 44px).
          //    실측 2026-08-22: `/wordvault/browse` 한 화면에서만 44px 미만 타깃 **278개**가
          //    나왔고 대부분이 이 버튼이다(단어 252개 × 1). 이 화면은 접근성 스윕의
          //    손으로 적은 목록에 없어서 **한 번도 안 재졌다**.
          //
          //    ⚠️ 처음엔 `::after` 로 히트영역만 얹었다. 실제 탭은 커졌지만 **계측기가 못 본다** —
          //       요소의 bounding rect 는 그대로 28px 이라 278건이 그대로 찍혔다.
          //       "고쳤는데 안 세어지는" 것은 다음 사람에게 "안 고쳤다" 와 같다.
          //    → **버튼 자체를 44px** 로 만들고, 음수 마진으로 **차지하는 자리는 28px** 로 되돌린다.
          //       행 밀도(이 목록의 읽기 속도를 정한다)와 시각 크기는 그대로다.
          className="group/play -m-2 flex h-11 w-11 shrink-0 items-center justify-center focus-visible:outline-none"
        >
          <span
            aria-hidden
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md transition-all duration-fast',
              'group-focus-visible/play:ring-2 group-focus-visible/play:ring-learn-fresh',
              isPlaying
                ? 'ring-learn-fresh/20 bg-learn-fresh text-white shadow-sm ring-2'
                : 'text-t3 group-hover:bg-learn-fresh-light group-hover:text-learn-fresh'
            )}
          >
            <Play size={10} fill="currentColor" aria-hidden />
          </span>
        </button>

        {/* 3. 영단어 + Memory dot + POS */}
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span
            onClick={stopBubble}
            className={cn(
              'truncate font-serif text-[16px] font-[600] leading-tight tracking-[-0.015em] text-t1',
              'transition-[filter] duration-normal',
              hideStates.word && 'cursor-pointer select-none blur-[8px] hover:blur-0'
            )}
          >
            {word.word}
          </span>
          <MemoryBadge srs={word.srs} size="xs" />
          <sup className="font-mono text-[9px] font-[700] uppercase tracking-[0.06em] text-t3">
            {word.pos.replace(/\.$/, '')}
          </sup>
        </div>

        {/* 4. 뜻 */}
        <div
          onClick={stopBubble}
          className={cn(
            'min-w-0 truncate font-body text-[13px] font-[500] leading-snug text-t1',
            'transition-[filter] duration-normal',
            hideStates.meaning && 'cursor-pointer select-none blur-[8px] hover:blur-0'
          )}
        >
          {word.meaning}
        </div>

        {/* 5. 예문 — 우측 정렬 (Lora italic + ❝❞) */}
        <div className="hidden min-w-0 md:block" onClick={stopBubble}>
          {word.exampleEn ? (
            <p
              className={cn(
                'truncate text-right font-serif text-[12.5px] font-[500] italic leading-[1.55] tracking-[0.005em] text-t3',
                'before:mr-[1px] before:font-[700] before:text-t3 before:content-["\\201C"]',
                'after:ml-[1px] after:font-[700] after:text-t3 after:content-["\\201D"]'
              )}
            >
              {word.exampleEn}
            </p>
          ) : (
            <span className="block text-right font-body text-[12px] text-t3">—</span>
          )}
        </div>

        {/* 6. 마스터 5점 dot */}
        <div
          className="flex shrink-0 items-center gap-[3px]"
          title={`마스터 ${word.mastery}/5`}
          aria-label={`마스터 ${word.mastery} of 5`}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className={cn(
                'h-[5px] w-[5px] rounded-full transition-all duration-normal',
                i > word.mastery && 'bg-bg3',
                i <= word.mastery && word.mastery === 1 && 'bg-t4',
                i <= word.mastery && word.mastery === 2 && 'bg-learn-fresh',
                i <= word.mastery && word.mastery === 3 && 'bg-learn-progress',
                i <= word.mastery && word.mastery === 4 && 'bg-learn-known',
                i <= word.mastery && word.mastery === 5 && 'bg-learn-mastered'
              )}
            />
          ))}
        </div>

        {/* 7. 레벨 칩 */}
        <span
          className={cn(
            'shrink-0 rounded-[3px] px-1.5 py-px font-mono text-[10px] font-[700] tracking-wide',
            `bg-level-${word.levelClass}-light text-level-${word.levelClass}`
          )}
        >
          {word.level}
        </span>
      </div>
    </div>
  )
}
