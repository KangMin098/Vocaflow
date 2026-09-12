// apps/web/src/components/wordvault/MemoryFilterBar.tsx
//
// 기억 상태로 걸러 들어왔을 때의 **머리말 한 줄** — `?filter=state:*` 전용.
//
// ── 왜 필요한가 (실측 2026-08-29) ────────────────────────────────────
// 리본의 "새 단어 11" 칩을 누른 학습자가 `/wordvault/browse` 에 도착하면, 그 화면에는
// **학습으로 나가는 문이 하나도 없었다.** 칩 네비·듣기·검색·목록뿐이고, 풀스크린이라
// 세그먼트 컨트롤도 없다. 세어 준 11개를 보고도 시작할 수가 없어서, 학습자는 뒤로 가
// 허브를 거쳐 다시 들어와야 했다(3클릭 뒤 원점).
//
// 이 줄이 세 가지를 답한다:
//   ① 지금 무엇을 보고 있나 — 상태 이름 + 개수
//   ② 바로 시작할 수 있나 — 이 묶음 그대로 학습 세션으로
//   ③ 여기서 나가는 길 — 전체 목록
//
// 색만으로 알리지 않는다(색맹 대응): 점 + 라벨 + 숫자 3중.
// 상태 이름·색은 여기서 짓지 않는다 — `state-filter.ts` 를 거쳐 `memory-labels.ts` 가 소유한다.

'use client'

import { Play } from 'lucide-react'
import Link from 'next/link'

import {
  stateFilterLabel,
  stateFilterSays,
  stateFilterToken,
  toStateFilterValue,
  type StateFilterKey,
} from '@/lib/wordvault/state-filter'

interface MemoryFilterBarProps {
  filterKey: StateFilterKey
  /** 이 필터에 걸린 단어 수 — 0이면 학습 시작을 내지 않는다 */
  count: number
  /** 전체로 돌아가기 */
  onClear: () => void
}

export function MemoryFilterBar({ filterKey, count, onClear }: MemoryFilterBarProps) {
  const label = stateFilterLabel(filterKey)
  const token = stateFilterToken(filterKey)

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2">
      <span className="flex min-w-0 items-center gap-2">
        {/* 색 + 라벨 + 숫자 3중 — 점 하나로는 알리지 않는다 */}
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: `var(${token})` }}
        />
        <span className="font-display text-[14px] font-[700] text-[var(--t1)]">
          {label}{' '}
          <span className="tabular-nums text-[var(--t2)]">{count.toLocaleString()}개</span>
        </span>
      </span>

      <span className="font-english text-[12.5px] italic text-[var(--t2)] [word-break:keep-all]">
        {stateFilterSays(filterKey)}
      </span>

      <span className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] px-3 font-display text-[13px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] active:scale-[0.98]"
        >
          전체 보기
        </button>

        {/*
          이 묶음 그대로 학습으로. 0개면 버튼을 내지 않는다 —
          누를 수 없는 버튼을 흐리게 세워 두는 것보다 없는 편이 조용하다(철학 ①·②).
        */}
        {count > 0 && (
          <Link
            href={`/wordvault/study?filter=${encodeURIComponent(toStateFilterValue(filterKey))}`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] bg-[var(--p)] px-4 font-display text-[13px] font-[700] text-[var(--on-p)] transition-[filter,transform] duration-[var(--dur-normal)] ease-[var(--ease)] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 active:scale-[0.98]"
          >
            <Play size={13} aria-hidden />이 단어로 학습 시작
          </Link>
        )}
      </span>
    </div>
  )
}
