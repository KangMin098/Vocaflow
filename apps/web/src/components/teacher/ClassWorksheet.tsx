// apps/web/src/components/teacher/ClassWorksheet.tsx
//
// **학급 유인물** — 종이 한 장이 학생 30명을 데려오는 자리.
//
// ── 왜 여기인가 ─────────────────────────────────────────────────────
// 분기 진단의 산술은 하나의 경로만 성립한다고 했다 — 교사 3,500명 × **학급 30명**.
// 그 30배가 실제로 일어나는 곳은 교실에서 나눠 주는 종이다. 그런데 그 종이에
// 학생이 돌아올 길이 없었다.
//
// `/fit` 의 학습지는 **아직 학급이 없는 교사**의 것이라 QR 이 `/fit` 을 가리킨다
// (다음 독자가 학생이 아니라 옆자리 교사다). 여기는 다르다 — 이 교사는 학급이 있고,
// 이 종이를 받는 사람은 **그 반 학생**이다. 그래서 QR 이 학급 초대를 가리킨다.
//
// ── 왜 초대 링크를 QR 에 담나 ───────────────────────────────────────
// 실측: `/fit/s/<payload>`(결과 공유 링크)는 434자 → QR 81×81 → 30mm 에서 0.37mm/모듈.
// **복사본에서 읽히지 않는다.** 교실에 도는 유인물은 대개 복사본이다.
// `/join/ABC123` 은 32자 → 29×29 → 1.03mm/모듈이고, 독립 디코더로 10mm 상당까지 읽혔다.
//
// 그리고 낱말은 이미 종이에 인쇄돼 있다. 학생이 QR 로 얻어야 하는 것은 낱말이 아니라
// **자기 반에 들어가는 길**이다 — 들어가면 교사가 보낸 과제로 같은 낱말을 받는다.

'use client'

import { useMemo, useState } from 'react'
import { Printer } from 'lucide-react'

import { PrintSheet, type SheetMode, type SheetRow } from '@/components/worksheet/PrintSheet'
import type { AssignmentWord } from '@/lib/teacher/assignment-actions'
import type { TeacherClass } from '@/lib/teacher/class-actions'
import { inviteUrl } from '@/lib/teacher/invite-link'

const MODES: ReadonlyArray<{ key: SheetMode; label: string; hint: string }> = [
  { key: 'both', label: '둘 다', hint: '목록 1장 + 빈칸 1장' },
  { key: 'list', label: '어휘 목록', hint: '뜻이 적힌 나눠 주는 유인물' },
  { key: 'quiz', label: '빈칸 확인', hint: '뜻을 비운 쪽지시험' },
]

export function ClassWorksheet({
  classes,
  words,
  title,
}: {
  classes: TeacherClass[]
  words: AssignmentWord[]
  /** 유인물 머리에 쓸 이름 (예: 글 제목). */
  title?: string
}) {
  const [mode, setMode] = useState<SheetMode>('both')
  const [classId, setClassId] = useState<string>('')

  // 학급이 하나뿐이면 고를 것이 없다 — 그때는 그것을 쓴다.
  const chosen = useMemo(
    () => classes.find((c) => c.id === classId) ?? classes[0] ?? null,
    [classes, classId],
  )

  const rows: SheetRow[] = useMemo(
    () => words.map((w) => ({ word: w.w, meaning: w.m ?? null })),
    [words],
  )

  if (rows.length === 0) return null

  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const qr = chosen ? { url: inviteUrl(origin, chosen.invite_code), caption: '우리 반에\n들어오기' } : null

  const meta = [
    title?.trim() || null,
    chosen ? chosen.name : null,
    `낱말 ${Math.min(rows.length, 24)}개`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section
      aria-label="유인물 인쇄"
      className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="m-0 font-display text-[13px] font-[700] text-[var(--t1)]">
          유인물로 뽑기
        </h3>
        <span className="font-mono text-[10.5px] text-[var(--t3)]">A4 · 낱말 {Math.min(rows.length, 24)}개</span>
      </div>

      {classes.length > 1 && (
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-[var(--t3)]">
            QR 이 가리킬 학급
          </span>
          <select
            value={chosen?.id ?? ''}
            onChange={(e) => setClassId(e.target.value)}
            className="h-11 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-body text-[13.5px] text-[var(--t1)] focus:border-[var(--p)] focus:outline-none"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div role="radiogroup" aria-label="유인물 종류" className="flex flex-wrap gap-2">
        {MODES.map((m) => {
          const on = m.key === mode
          return (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={on}
              title={m.hint}
              onClick={() => setMode(m.key)}
              className={`inline-flex min-h-11 items-center rounded-[var(--r-md)] border px-4 font-display text-[13px] font-[600] transition-colors duration-[var(--dur-normal)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none ${
                on
                  ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]'
                  : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t1)] hover:bg-[var(--bg3)]'
              }`}
            >
              {m.label}
            </button>
          )
        })}
      </div>

      <p className="m-0 font-body text-[12.5px] leading-[1.65] text-[var(--t2)]">
        {chosen ? (
          <>
            종이 구석에 <b>{chosen.name} 초대 QR</b>이 찍혀요. 학생이 찍으면 바로 참여 화면으로
            가고, 들어오면 보낸 단어를 받습니다.
          </>
        ) : (
          <>학급을 만들면 초대 QR 이 함께 찍혀요. 지금은 낱말 표만 나옵니다.</>
        )}
        {' '}
        <b>지문은 인쇄되지 않아요.</b>
      </p>

      <button
        type="button"
        onClick={() => window.setTimeout(() => window.print(), 0)}
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--p)] px-5 font-display text-[13px] font-[700] text-[var(--on-p)] transition-opacity duration-[var(--dur-normal)] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
      >
        <Printer size={15} aria-hidden />
        인쇄 · PDF 저장
      </button>

      {/* 화면에 안 보인다 — 인쇄에서만 켜진다(globals.css 의 .vf-sheet). */}
      <PrintSheet
        heading={{ list: '어휘 목록', quiz: '어휘 확인' }}
        meta={meta}
        rows={rows}
        mode={mode}
        qr={qr}
        showMarkColumn={false}
      />
    </section>
  )
}
