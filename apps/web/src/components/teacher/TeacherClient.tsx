// apps/web/src/components/teacher/TeacherClient.tsx
// 교사 허브 — 클래스 개설/목록(초대코드·멤버수) + 초대코드 참여. Calm UI. P4.2.

'use client'

import { Check, Copy, GraduationCap, Plus, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import {
  createClass,
  joinClassByCode,
  type MyMembership,
  type TeacherClass,
} from '@/lib/teacher/class-actions'

export function TeacherClient({
  classes,
  memberships,
}: {
  classes: TeacherClass[]
  memberships: MyMembership[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  function handleCreate() {
    setError(null)
    startTransition(async () => {
      const res = await createClass(name)
      if (res.ok) {
        setName('')
        router.refresh()
      } else setError(res.error ?? '개설에 실패했어요.')
    })
  }

  function handleJoin() {
    setError(null)
    startTransition(async () => {
      const res = await joinClassByCode(code)
      if (res.ok) {
        setCode('')
        router.refresh()
      } else setError(res.error ?? '참여에 실패했어요.')
    })
  }

  function copy(c: string) {
    void navigator.clipboard?.writeText(c).then(() => {
      setCopied(c)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center gap-2">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] bg-[var(--p-light)] text-[var(--p)]"
          aria-hidden
        >
          <GraduationCap size={18} strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="font-display text-[20px] font-[800] text-[var(--t1)]">클래스</h1>
          <p className="font-body text-[12px] text-[var(--t3)]">
            클래스를 만들어 초대코드로 학생을 모아요
          </p>
        </div>
      </header>

      {error && (
        <p role="alert" className="font-body text-[13px] text-[var(--error)]">
          {error}
        </p>
      )}

      {/* 개설 / 참여 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="flex flex-col gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4">
          <span className="font-display text-[13px] font-[700] text-[var(--t1)]">클래스 만들기</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 3-2반 영어"
            aria-label="클래스 이름"
            className="h-10 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 font-body text-[14px] text-[var(--t1)] focus:border-[var(--p)] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || pending}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[var(--r-md)] bg-[var(--p)] font-display text-[13px] font-[700] text-[var(--ti)] transition-colors hover:bg-[var(--p-hover)] disabled:opacity-50"
          >
            <Plus size={14} strokeWidth={2} aria-hidden /> 개설
          </button>
        </section>

        <section className="flex flex-col gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4">
          <span className="font-display text-[13px] font-[700] text-[var(--t1)]">초대코드로 참여</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            aria-label="초대코드"
            maxLength={6}
            className="h-10 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 font-mono text-[14px] uppercase tracking-[0.15em] text-[var(--t1)] focus:border-[var(--p)] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleJoin}
            disabled={code.trim().length < 4 || pending}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] font-display text-[13px] font-[700] text-[var(--t2)] transition-colors hover:border-[var(--p)] hover:text-[var(--p)] disabled:opacity-50"
          >
            참여하기
          </button>
        </section>
      </div>

      {/* 내가 만든 클래스 */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[13px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]">
          내가 만든 클래스 ({classes.length})
        </h2>
        {classes.length === 0 ? (
          <p className="rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg)] px-5 py-8 text-center font-body text-[13px] text-[var(--t3)]">
            아직 만든 클래스가 없어요. 위에서 첫 클래스를 만들어 보세요.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {classes.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[14px] font-[700] text-[var(--t1)]">
                    {c.name}
                  </p>
                  <p className="mt-0.5 inline-flex items-center gap-1 font-body text-[12px] text-[var(--t3)]">
                    <Users size={11} aria-hidden /> 학생 {c.member_count}명
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copy(c.invite_code)}
                  className="inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 font-mono text-[13px] font-[700] tracking-[0.12em] text-[var(--t1)] transition-colors hover:border-[var(--p)]"
                  aria-label={`초대코드 ${c.invite_code} 복사`}
                >
                  {c.invite_code}
                  {copied === c.invite_code ? (
                    <Check size={13} className="text-[var(--success)]" aria-hidden />
                  ) : (
                    <Copy size={13} className="text-[var(--t3)]" aria-hidden />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 참여 중인 클래스 */}
      {memberships.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-[13px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]">
            참여 중인 클래스 ({memberships.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {memberships.map((m) => (
              <li
                key={m.class_id}
                className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3 font-display text-[14px] font-[700] text-[var(--t1)]"
              >
                {m.class_name}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
