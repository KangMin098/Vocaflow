// apps/web/src/components/teacher/SentAssignments.tsx
//
// 보낸 단어 과제 + 수행 현황 (교사).
//
// 왜 "열어 봤다" 와 "담았다" 를 나눠 보여주는가:
//   교사에게 가장 쓸모 있는 신호는 **"봤는데 안 했다"** 다. 하나로 합치면 그게 사라지고,
//   남는 건 "몇 명 했는지" 뿐이라 다음 수업에서 무엇을 할지 알 수 없다.
//   DB 도 같은 이유로 `opened_at` · `collected_at` 을 따로 둔다.
//
// 규약: 진행 막대는 색만이 아니라 **숫자로도** 읽힌다(색맹 대응).
//
// 조회 실패는 0 과 다르다: 목록 실패(`failed`)는 빈 목록처럼 숨기지 않고, 집계 실패
// (`progress: null`)는 과제는 그대로 보이되 인원·열람·담기 수·막대·학생 행동 문장을 그리지 않는다.

'use client'

import { Send, Users } from 'lucide-react'

import type { AssignmentProgress, ClassAssignment } from '@/lib/teacher/assignment-actions'

export interface SentAssignmentRow {
  assignment: ClassAssignment
  /** `null` = 인원 또는 진도 조회 실패 — 0명으로 읽으면 안 된다. */
  progress: AssignmentProgress | null
}

interface Props {
  rows: SentAssignmentRow[]
  /** 목록 조회 실패 — 빈 목록이 "보낸 게 없다" 로 읽히지 않게 한다. */
  failed?: boolean
}

export function SentAssignments({ rows, failed = false }: Props) {
  if (failed) {
    return (
      <p
        role="status"
        className="break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 font-body text-[13.5px] text-[var(--t2)]"
      >
        보낸 과제를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.
      </p>
    )
  }

  if (rows.length === 0) return null

  return (
    <section aria-label="보낸 단어 과제" className="flex flex-col gap-3">
      <h2 className="m-0 font-display text-[15px] font-[700] text-[var(--t1)]">보낸 단어</h2>

      <ul className="flex flex-col gap-3">
        {rows.map(({ assignment: a, progress: p }) => {
          if (!p) {
            return (
              <li
                key={a.id}
                className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4"
              >
                <AssignmentHeading a={a} />
                <p
                  role="status"
                  className="m-0 break-keep font-body text-[12.5px] leading-[1.6] text-[var(--t2)]"
                >
                  지금은 수행 현황을 확인할 수 없어요. 잠시 뒤 새로고침해 주세요.
                </p>
              </li>
            )
          }

          const denom = Math.max(1, p.memberCount)
          const collectedPct = Math.min(100, (p.collectedCount / denom) * 100)
          const openedPct = Math.min(100, (p.openedCount / denom) * 100)
          // 봤는데 안 한 사람 — 이 수가 다음 수업의 할 일이다.
          const seenNotDone = Math.max(0, p.openedCount - p.collectedCount)

          return (
            <li
              key={a.id}
              className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <AssignmentHeading a={a} />
                <p className="m-0 flex items-center gap-2 font-display text-[13px] font-[700] tabular-nums text-[var(--t1)]">
                  <Users size={13} aria-hidden className="text-[var(--t3)]" />
                  {p.collectedCount} / {p.memberCount}
                </p>
              </div>

              {/* 담은 사람 / 열어만 본 사람 — 두 층으로 겹쳐 그린다 */}
              <div
                role="img"
                aria-label={`${p.memberCount}명 중 ${p.openedCount}명이 열어 봤고 ${p.collectedCount}명이 담았어요.`}
                className="relative h-2.5 overflow-hidden rounded-[var(--r-full)] bg-[var(--bg3)]"
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 opacity-30"
                  style={{ width: `${openedPct}%`, background: 'var(--memory-shaky)' }}
                />
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0"
                  style={{ width: `${collectedPct}%`, background: 'var(--memory-stable)' }}
                />
              </div>

              <p className="m-0 font-body text-[12.5px] leading-[1.6] text-[var(--t2)]">
                {p.memberCount === 0 ? (
                  <>아직 학생이 없어요 — 초대코드를 나눠 주세요.</>
                ) : seenNotDone > 0 ? (
                  <>
                    <b className="tabular-nums">{seenNotDone}명</b>이 열어만 보고 아직 담지
                    않았어요.
                  </>
                ) : p.collectedCount === 0 ? (
                  <>아직 아무도 열어 보지 않았어요.</>
                ) : (
                  <>열어 본 학생은 모두 담았어요.</>
                )}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function AssignmentHeading({ a }: { a: ClassAssignment }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="m-0 flex min-w-0 items-center gap-2 break-keep font-display text-[14px] font-[700] text-[var(--t1)] [overflow-wrap:anywhere]">
        <Send size={13} aria-hidden className="shrink-0 text-[var(--t3)]" />
        {a.title}
      </p>
      <p className="m-0 break-keep font-body text-[12px] text-[var(--t3)] [overflow-wrap:anywhere]">
        {a.className} · 단어 {a.words.length}개
      </p>
    </div>
  )
}
