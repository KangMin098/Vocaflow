// apps/web/src/components/wordvault/ListenPanel.tsx
// 듣기 패널 v2 (v06.21.7) — 설정 토글 제거 · 항상 노출
//
// 변경:
//   - settingsOpen 상태 + 기어 버튼 제거 — 설정 옵션이 항상 노출되어 즉시 사용 가능
//   - 4그룹(듣기 내용 / 속도 / 간격 / 반복) 컴팩트 한 줄 인라인 레이아웃 + 모바일 wrap

'use client'

import { cn } from '@/lib/utils/cn'
import {
  Headphones,
  Pause,
  Play,
  Shuffle,
  SkipBack,
  SkipForward,
  Square,
} from 'lucide-react'
import type {
  ListenContent,
  ListenGap,
  ListenRepeat,
  ListenSettings,
  ListenSpeed,
  WordItem,
} from './types'

export interface ListenPanelProps {
  /** 전체 단어 (전체 듣기용) */
  allWords: WordItem[]
  /** 선택된 단어 ID 집합 */
  selectedIds: Set<number>
  /** 현재 듣기 설정 */
  settings: ListenSettings
  /** 설정 변경 콜백 */
  onSettingsChange: (next: ListenSettings) => void
  /** 재생 시작 (전체 또는 선택) */
  onStartPlay: (queue: WordItem[]) => void
  /** 정지 */
  onStop: () => void
  /** 일시정지/재개 */
  onTogglePause: () => void
  /** 다음 */
  onNext: () => void
  /** 이전 */
  onPrev: () => void
  /** 재생 중 여부 */
  isPlaying: boolean
  /** 일시정지 중 여부 */
  isPaused: boolean
  /** 현재 재생 인덱스 */
  currentIndex: number
  /** 큐 길이 */
  queueLength: number
  /** 현재 재생 단어 */
  currentWord: WordItem | null
  /**
   * 이 브라우저에 **영어 음성이 설치돼 있는가**. 재생은 브라우저 TTS 가 맡으므로,
   * 영어 음성이 없으면 소리는 나도 영어를 영어로 읽지 않을 수 있다.
   * 그 사실을 말해 주지 않으면 학습자는 "발음이 이상하다" 를 자기 귀 탓으로 돌린다.
   */
  englishVoice?: boolean
}

const CONTENT_OPTS: { value: ListenContent; label: string }[] = [
  { value: 'word', label: 'Word only' },
  { value: 'word-example', label: 'Word + example' },
]
const SPEED_OPTS: ListenSpeed[] = [0.75, 1.0, 1.25, 1.5]
const GAP_OPTS: ListenGap[] = [0.5, 1.0, 2.0]
const REPEAT_OPTS: { value: ListenRepeat; label: string }[] = [
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 999, label: 'Loop' },
]

export function ListenPanel({
  allWords,
  selectedIds,
  settings,
  onSettingsChange,
  onStartPlay,
  onStop,
  onTogglePause,
  onNext,
  onPrev,
  isPlaying,
  isPaused,
  currentIndex,
  queueLength,
  currentWord,
  englishVoice = true,
}: ListenPanelProps) {
  const selectedCount = selectedIds.size

  const handleToggleAll = () => {
    if (isPlaying) onStop()
    else onStartPlay(allWords)
  }

  const handlePlaySelected = () => {
    if (selectedCount === 0) return
    const queue = allWords.filter((w) => selectedIds.has(w.id))
    onStartPlay(queue)
  }

  const updateSettings = <K extends keyof ListenSettings>(key: K, value: ListenSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  const toggleShuffle = () => updateSettings('shuffle', !settings.shuffle)

  return (
    <div
      className={cn(
        'mb-s-3 rounded-xl border bg-bg px-s-4 py-s-3',
        'transition-all duration-normal',
        isPlaying ? 'border-learn-fresh shadow-[0_0_0_4px_rgba(59,130,246,0.15)]' : 'border-bd'
      )}
    >
      {/* 상단 — 타이틀 + 액션 */}
      <div className="flex flex-wrap items-center justify-between gap-s-3">
        <div className="flex items-center gap-s-3">
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-[10px] transition-all duration-normal',
              isPlaying
                ? 'bg-learn-fresh animate-[soft-pulse_1.8s_ease-in-out_infinite] text-white'
                : 'bg-bg2 text-t2'
            )}
          >
            <Headphones size={15} />
          </div>
          <div>
            <div className="font-display text-sm font-bold tracking-[-0.01em] text-t1">
              듣기 모드
            </div>
            <div
              className={cn(
                'mt-px text-xs font-medium',
                isPlaying ? 'text-learn-fresh font-semibold' : 'text-t3'
              )}
            >
              {isPlaying ? (
                <>
                  <span
                    className="bg-learn-known mr-[5px] inline-block h-[6px] w-[6px] animate-[pulse-dot_1.2s_ease-in-out_infinite] rounded-full"
                    aria-hidden
                  />
                  재생 중
                </>
              ) : (
                '대기 중'
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-s-2">
          <button
            type="button"
            onClick={handleToggleAll}
            className={cn(
              'inline-flex items-center gap-s-2',
              'min-h-[44px] rounded-md px-s-4 py-s-2',
              // ⚠️ 흰 글자를 --learn-fresh(#3B82F6) 위에 얹어 3.68:1 이었다(실측 2026-08-22).
              //    색을 새로 고르지 않는다 — 저장소에 이미 두 테마 모두 계산된 짝이 있다.
              'font-display text-[13px] font-bold tracking-[-0.01em] text-[var(--on-p)]',
              'shadow-sm transition-all duration-fast hover:shadow-md',
              isPlaying ? 'bg-[var(--error)] hover:opacity-90' : 'bg-[var(--p)] hover:opacity-90'
            )}
          >
            {isPlaying ? <Square size={13} /> : <Play size={13} />}
            <span>{isPlaying ? '정지' : '전체 듣기'}</span>
          </button>

          <button
            type="button"
            onClick={handlePlaySelected}
            disabled={selectedCount === 0}
            className={cn(
              'inline-flex items-center gap-s-2',
              'min-h-[44px] rounded-md px-s-3 py-s-2',
              'border font-display text-[13px] font-semibold tracking-[-0.01em]',
              'transition-all duration-fast',
              'disabled:cursor-not-allowed disabled:opacity-40',
              selectedCount > 0
                ? 'bg-learn-mastered-light border-learn-mastered text-learn-mastered'
                : 'border-bd bg-bg text-t2 hover:bg-bg2 hover:text-t1'
            )}
          >
            <span>선택 듣기</span>
            <span
              className={cn(
                'px-s-1.5 inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-[10px]',
                'font-mono text-[11px] font-bold',
                selectedCount > 0 ? 'bg-learn-mastered text-white' : 'bg-bg2 text-t3'
              )}
            >
              {selectedCount}
            </span>
          </button>

        </div>
      </div>

      {/*
        영어 음성 없음 — 재생은 되지만 영어를 영어로 읽지 않을 수 있다.
        모달로 막지 않는다(학습 중단 금지). 무엇을 하면 되는지까지 한 줄로 말한다.
      */}
      {!englishVoice && (
        <p className="mt-s-3 rounded-[var(--r-md)] bg-bg2 px-s-3 py-s-2 text-xs font-medium leading-relaxed text-t2">
          이 브라우저에 영어 음성이 없어요. 소리는 나지만 발음이 정확하지 않을 수 있어요 — 기기 설정에서
          영어 음성을 추가하면 자연스럽게 들려요.
        </p>
      )}

      {/* 진행률 (재생 중에만) */}
      {isPlaying && (
        <div className="mt-s-3">
          <div className="mb-s-2 h-[4px] overflow-hidden rounded-[2px] bg-bg2">
            <div
              className="h-full rounded-[2px] shadow-[0_0_8px_rgba(59,130,246,0.3)] transition-all duration-normal"
              style={{
                width: `${queueLength > 0 ? ((currentIndex + 1) / queueLength) * 100 : 0}%`,
                background: 'linear-gradient(90deg, var(--learn-fresh), var(--learn-mastered))',
              }}
            />
          </div>
          <div className="flex items-center justify-between font-display text-xs font-medium text-t3">
            <span>
              {currentIndex + 1} / {queueLength}
            </span>
            <span className="text-learn-fresh font-bold">
              {currentWord ? `▶ ${currentWord.word}` : '대기 중'}
            </span>
          </div>
        </div>
      )}

      {/* 재생 컨트롤 (재생 중에만) */}
      {isPlaying && (
        <div className="mt-s-3 flex items-center justify-center gap-s-1 border-t border-bd pt-s-3">
          <button
            type="button"
            onClick={onPrev}
            className="flex h-11 w-11 items-center justify-center rounded-md text-t2 transition-all duration-fast hover:bg-bg2 hover:text-t1"
            aria-label="이전"
          >
            <SkipBack size={13} />
          </button>
          <button
            type="button"
            onClick={onTogglePause}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-p text-bg shadow-sm transition-all duration-fast hover:bg-p-hover hover:shadow-md"
            aria-label="일시정지/재개"
          >
            {isPaused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex h-11 w-11 items-center justify-center rounded-md text-t2 transition-all duration-fast hover:bg-bg2 hover:text-t1"
            aria-label="다음"
          >
            <SkipForward size={13} />
          </button>
          <button
            type="button"
            onClick={toggleShuffle}
            className={cn(
              'flex h-[34px] w-[34px] items-center justify-center rounded-md transition-all duration-fast',
              settings.shuffle
                ? 'bg-learn-mastered text-white'
                : 'text-t2 hover:bg-bg2 hover:text-t1'
            )}
            aria-label="셔플"
          >
            <Shuffle size={13} />
          </button>
          <button
            type="button"
            onClick={onStop}
            className="flex h-11 w-11 items-center justify-center rounded-md text-t2 transition-all duration-fast hover:bg-bg2 hover:text-t1"
            aria-label="정지"
          >
            <Square size={13} />
          </button>
        </div>
      )}

      {/* 설정 패널 — 항상 노출 (v06.21.7) · 한 줄 인라인 + 모바일 wrap */}
      <div className="mt-s-3 flex flex-wrap items-center gap-x-s-5 gap-y-s-3 border-t border-bd pt-s-3">
        <SettingGroup label="듣기 내용">
          {CONTENT_OPTS.map((opt) => (
            <OptBtn
              key={opt.value}
              active={settings.content === opt.value}
              onClick={() => updateSettings('content', opt.value)}
            >
              {opt.label}
            </OptBtn>
          ))}
        </SettingGroup>

        <SettingGroup label="속도">
          {SPEED_OPTS.map((s) => (
            <OptBtn
              key={s}
              active={settings.speed === s}
              onClick={() => updateSettings('speed', s)}
            >
              {s}x
            </OptBtn>
          ))}
        </SettingGroup>

        <SettingGroup label="간격">
          {GAP_OPTS.map((g) => (
            <OptBtn
              key={g}
              active={settings.gap === g}
              onClick={() => updateSettings('gap', g)}
            >
              {g}초
            </OptBtn>
          ))}
        </SettingGroup>

        <SettingGroup label="반복">
          {REPEAT_OPTS.map((opt) => (
            <OptBtn
              key={opt.value}
              active={settings.repeat === opt.value}
              onClick={() => updateSettings('repeat', opt.value)}
            >
              {opt.label}
            </OptBtn>
          ))}
        </SettingGroup>
      </div>
    </div>
  )
}

// ─── 보조 컴포넌트 ───
function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-s-2">
      <div className="font-display text-[11px] font-semibold uppercase tracking-[0.05em] text-t3">
        {label}
      </div>
      <div className="flex flex-wrap gap-s-1">{children}</div>
    </div>
  )
}

function OptBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // ⚠️ 실측 26px 였다(기준 44px) — 속도·간격·반복·내용 칩 **8종 전부**.
      //    칩 자체를 44px 로 키우면 설정 줄이 두 배가 돼 화면을 잡아먹는다.
      //    → 보이는 알약은 그대로 두고 **세로 패딩으로 히트영역만** 44px 로 만든다.
      //      `::after` 가 아니라 요소 자체의 크기여야 계측기가 본다(WordRow 에서 겪었다).
      className="group/opt -m-2.5 flex min-h-[44px] min-w-[44px] items-center justify-center p-2.5"
    >
      <span
        className={cn(
          'px-s-2.5 rounded-sm border py-s-1',
          'font-display text-xs font-semibold',
          'transition-all duration-fast',
          active
            ? 'border-p bg-p text-bg'
            : 'border-bd bg-bg text-t2 group-hover/opt:bg-bg2 group-hover/opt:text-t1'
        )}
      >
        {children}
      </span>
    </button>
  )
}
