// apps/web/src/components/dashboard/RecentActivity.tsx
//
// 최근 학습 활동 v3 — Phase 3-3: useHubData 연동.
//
// 디자인 (CLAUDE.md §13 / v06.21):
//   [Activity 아이콘 · 최근 N건]  [chip][chip][chip][chip][chip]  [전체 →]
//
//   chip = [모듈 dot] [짧은 라벨] [본문(점수/✓✗)] [· 시간]
//   - 좁은 viewport: 가로 스크롤
//   - 빈 상태: "아직 학습 활동이 없어요" 격려형 안내

'use client'

import { Activity } from 'lucide-react'

import { activityLabel } from '@/lib/framework/registry'
import { useHubData, type ModuleId } from '@/hooks/useHubData'

// ════════════════════════════════════════════════════════════
// 모듈별 시각 매핑 (FlowNav 단계 accent 정합)
// ════════════════════════════════════════════════════════════
// ⚠️ 키는 `ModuleId` 가 아니라 **런타임 module 문자열**이다.
// `packages/types` 의 module_id 는 25종인데 DB enum 은 28종이라(2026-08-13 실측) 타입이
// 실제 값을 다 담지 못한다 — 실데이터가 쓰는 `'pirate-quest'`(하이픈)는 타입에 아예 없다.
// 타입 재생성(`pnpm db:types`)이 근본 해결이고, 그 전까지는 문자열 키로 정직하게 둔다.
const MODULE_COLOR: Record<string, string> = {
  textviewer: '#8B5CF6', // purple (스크립트)
  workspace: '#8B5CF6',
  wordvault: '#6366F1', // indigo (단어)
  flashcard: '#EC4899', // pink (익히기)
  spellforge: '#EC4899',
  wordblitz: '#EC4899',
  pairflip: '#EC4899',
  scriptquiz: 'var(--memory-shaky)', // amber (정복)
  dictation: '#06B6D4', // cyan (완성)
  // 실데이터가 쓰는 라벨은 하이픈 쪽이다 — 언더스코어는 enum 에만 있고 전 테이블 0행.
  'pirate-quest': 'var(--memory-stable)',
}

// 여기에 없는 모듈은 **레지스트리에서 이름을 가져온다**(activityLabel).
// 표를 다시 늘리지 않는 이유: 이 표에 아케이드 19종이 없어서 학습자에게 raw 슬러그
// (`pirate-quest`·`cascade`)가 그대로 노출되고 있었다(2026-08-13 실측). 활동 이름의
// 출처는 레지스트리 하나여야 한다 — 아래 표는 **모듈에만** 붙는 짧은 별칭이다.
const MODULE_SHORT: Partial<Record<ModuleId, string>> = {
  textviewer: '스크립트',
  workspace: '워크',
  wordvault: '단어장',
  flashcard: '플래시',
  spellforge: '스펠',
  wordblitz: '블리츠',
  pairflip: '페어',
  scriptquiz: '퀴즈',
  dictation: '딕테',
}

// ════════════════════════════════════════════════════════════
// RecentActivity — useHubData 자가 페치
// ════════════════════════════════════════════════════════════
export function RecentActivity() {
  const { data, isLoading } = useHubData()

  if (isLoading) {
    return (
      <div
        aria-hidden
        className="h-[58px] animate-pulse rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)]"
      />
    )
  }

  const activities = data?.recentActivities ?? []
  const groups = groupRuns(activities)

  return (
    <section
      aria-label={`최근 학습 활동 ${activities.length}건`}
      className="flex items-center gap-3 rounded-ios-xl bg-[var(--bg)] px-4 py-3 shadow-ios-1"
    >
      {/* Header */}
      <header className="flex shrink-0 items-center gap-2 border-r border-[var(--bd)] pr-3">
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p-light)] text-[var(--on-p-tint)]"
          aria-hidden="true"
        >
          <Activity size={12} strokeWidth={2.2} />
        </span>
        <div className="flex flex-col leading-none">
          <span className="font-display text-[12px] font-[700] text-[var(--t1)]">최근</span>
          <span className="mt-0.5 font-mono text-[10px] font-[600] text-[var(--t2)]">
            {activities.length}건
          </span>
        </div>
      </header>

      {/* Chip row */}
      <ul
        // 가로 스크롤 영역은 키보드로도 스크롤할 수 있어야 한다(axe scrollable-region-focusable).
        tabIndex={0}
        className="flex flex-1 items-center gap-2 overflow-x-auto rounded-[var(--r-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]/40 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
      >
        {groups.length === 0 ? (
          <li className="font-body text-[12px] text-[var(--t2)]">
            아직 학습 활동이 없어요 · 첫 학습을 시작해보세요
          </li>
        ) : (
          groups.map((g) => <ActivityChip key={g.head.id} item={g.head} runLength={g.length} />)
        )}
      </ul>
    </section>
  )
}

// ════════════════════════════════════════════════════════════
// ActivityChip
// ════════════════════════════════════════════════════════════
type ActivityItem = NonNullable<
  ReturnType<typeof useHubData>['data']
>['recentActivities'][number]

/**
 * 연속으로 같은 활동을 접는다.
 *
 * ⚠️ 접기 전에는 이 줄이 **정보량 0**이었다: 한 세션에서 같은 모듈을 여러 번 하면
 * `딕테 X · 11분 전` 이 다섯 칸에 똑같이 찍혔다(2026-08-15 실측 — 다섯 칸 전부 동일).
 * "최근 5건" 이라는 라벨만 맞고 학습자가 얻는 것은 아무것도 없었다.
 *
 * 연속(run)만 접고 재정렬하지 않는 이유: 모듈별로 묶어 버리면 시간 순서가 사라져
 * "최근" 이라는 이름이 거짓이 된다. 붙어 있는 것만 접는다.
 */
function groupRuns(items: readonly ActivityItem[]): { head: ActivityItem; length: number }[] {
  const runs: { head: ActivityItem; length: number }[] = []
  for (const item of items) {
    const last = runs[runs.length - 1]
    if (last && last.head.module === item.module && last.head.score === item.score) {
      last.length += 1
      continue
    }
    runs.push({ head: item, length: 1 })
  }
  return runs
}

function ActivityChip({ item, runLength }: { item: ActivityItem; runLength: number }) {
  const color = MODULE_COLOR[item.module] ?? 'var(--t3)'
  // 모듈 별칭 → 레지스트리 이름 → (그래도 없으면) id. 예전에는 마지막 단계가 곧바로
  // 학습자 화면에 슬러그를 뱉었다.
  const short = MODULE_SHORT[item.module] ?? activityLabel(item.module)

  // 본문 라벨 — 게임 점수 우선, 학습 기록은 ✓/✗
  let body: string
  if (item.score !== null) {
    body = `${item.score}점`
  } else if (item.isCorrect === true) {
    body = '✓'
  } else if (item.isCorrect === false) {
    body = '✗'
  } else {
    body = ''
  }

  const runLabel = runLength > 1 ? `×${runLength}` : ''

  return (
    <li>
      <span
        title={`${short}${runLabel && ` ${runLabel}`} · ${item.textTitle} · ${item.relativeTime}`}
        className="group inline-flex h-7 shrink-0 items-center gap-2 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg2)] px-3"
        aria-label={`${short} ${runLength > 1 ? `${runLength}회 ` : ''}${body}, ${item.relativeTime} — ${item.textTitle}`}
      >
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        {/* 모듈 구분은 왼쪽 점이 맡는다 — 라벨까지 원색으로 칠하면 11px 글자가 AA(4.5)를 못 넘는다.
            (2026-08-13 axe 실측: dictation #06B6D4 on --bg2 = 2.13:1. 받아쓰기가 기록을 남기기
            시작하면서 처음 렌더돼 드러났다. 다른 모듈 원색도 같은 구조라 잠재 위반이었다.)
            §"색상만으로 정보 전달 금지" 관점에서도 텍스트 라벨이 비색 채널이므로 이쪽이 옳다. */}
        <span className="font-display text-[11px] font-[700] text-[var(--t1)]">{short}</span>
        {runLabel && (
          <span className="font-mono text-[10px] font-[700] tabular-nums text-[var(--t2)]">
            {runLabel}
          </span>
        )}
        {body && (
          <span className="font-display text-[11px] font-[600] text-[var(--t1)]">{body}</span>
        )}
        <span className="font-mono text-[10px] tabular-nums text-[var(--t2)]">
          · {item.relativeTime}
        </span>
      </span>
    </li>
  )
}
