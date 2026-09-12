// apps/web/src/components/teacher/TeacherClient.tsx
// 교사 허브 — 클래스 개설/목록(초대코드·멤버수) + 초대코드 참여. Calm UI. P4.2.

'use client'

import { ArrowRight, Check, Copy, GraduationCap, Plus, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import {
  createClass,
  joinClassByCode,
  noteInviteShared,
  type MyMembership,
  type TeacherClass,
} from '@/lib/teacher/class-actions'
import { inviteUrl } from '@/lib/teacher/invite-link'

export function TeacherClient({
  classes,
  memberships,
  hasReceived = false,
  unavailable = false,
}: {
  classes: TeacherClass[]
  memberships: MyMembership[]
  /**
   * 받은 과제가 하나라도 있는가.
   *
   * 없으면 참여 중인 학급 아래에 **무엇을 기다리는 중인지** 적는다 —
   * `ReceivedAssignments` 는 빈 목록에서 `return null` 이라 아무것도 그리지 않고,
   * 학생 화면에는 반 이름 하나만 남는다(2026-08-27 실측).
   */
  hasReceived?: boolean
  /**
   * 목록을 **불러오지 못했는가**. true 면 빈 목록은 "클래스가 없다" 가 아니다.
   *
   * 이 구별이 없어서 classes/class_members 가 삭제된 동안(20260719 → 20260812)
   * 교사에게 "개설한 클래스가 없어요" 로 보였다 — 조회 실패가 정상 상태를 흉내 냈다.
   */
  unavailable?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  /** 내 학급 중 한 곳이라도 학생이 있는가 — "다음 할 일" 이 갈리는 기준. */
  const hasStudents = classes.some((c) => c.member_count > 0)

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

  /**
   * 초대코드 복사 — **여기가 교사 퍼널의 4.5단계다.**
   *
   * noteInviteShared() 가 없으면 funnel_events.invite_shared 는 영원히 0행이고,
   * 그러면 대시보드의 "초대코드를 공유했고 → 학생이 왔다" **분모가 0** 이라 그 구간을
   * 아예 못 읽는다. 복사는 클라이언트에서 끝나 어떤 표에도 흔적이 남지 않는다 —
   * 파생으로 대체할 수 없는 둘 중 하나다(lib/analytics/funnel.ts 참조).
   *
   * 2026-08-26 프로덕션 빌드가 이 누락을 no-unused-vars 로 잡았다. import 만 있고
   * 호출이 없었다 — 화면은 멀쩡히 돌고 계측만 조용히 죽어 있는 모양이었다.
   *
   * ── 복사되는 것: **코드가 아니라 링크다** (2026-08-26) ──────────────
   * 그전에는 `ABC123` 여섯 글자만 클립보드에 들어갔다. 그것을 받은 학생은
   * ① 주소를 찾아 ② 가입하고 ③ `클래스` 화면을 찾아 ④ 코드를 붙여넣어야 했다 —
   * ③ 은 학생이 스스로 도달할 이유가 없는 화면이다.
   * 이제 `/join/ABC123` 이 그 넷을 한 번의 클릭으로 만든다.
   *
   * 코드 자체는 화면에 계속 보인다 — 링크를 못 여는 상황(칠판·인쇄물·구두 전달)에서
   * 손으로 넣을 수 있어야 하고, 그 입력창도 이 화면에 그대로 있다.
   */
  function copy(c: string) {
    // clipboard 가 없는 환경(비보안 컨텍스트 등)에서는 undefined 라 .then 이 터진다.
    const origin = typeof window === 'undefined' ? '' : window.location.origin
    const written = navigator.clipboard?.writeText(inviteUrl(origin, c))
    if (!written) return

    void written.then(() => {
      setCopied(c)
      setTimeout(() => setCopied(null), 1500)
      // 복사가 실제로 끝난 뒤에만 기록한다 — 실패한 복사는 공유가 아니다.
      // 기록이 실패해도 화면은 아무 영향을 받지 않는다(서버 액션이 삼킨다).
      void noteInviteShared()
    })
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center gap-2">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] bg-[var(--p-light)] text-[var(--on-p-tint)]"
          aria-hidden
        >
          <GraduationCap size={18} strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="font-display text-[20px] font-[800] text-[var(--t1)]">클래스</h1>
          <p className="font-body text-[12px] text-[var(--t2)]">
            클래스를 만들어 초대코드로 학생을 모아요
          </p>
        </div>
      </header>

      {/* 조회 실패 고지 — 빈 목록이 "클래스가 없음" 으로 읽히지 않게. 개설·참여 자체는
          막지 않는다(쓰기 경로는 별개로 살아 있을 수 있다). */}
      {unavailable && (
        <p
          role="status"
          className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 font-body text-[12.5px] leading-[1.6] text-[var(--t2)]"
        >
          클래스 목록을 지금 불러오지 못했어요. 아래가 비어 있어도{' '}
          <b className="text-[var(--t1)]">클래스가 사라진 것은 아니에요</b> — 잠시 후 새로고침해 주세요.
        </p>
      )}

      {error && (
        <p role="alert" className="font-body text-[13px] text-[var(--error-ink)]">
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
            className="h-11 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 font-body text-[14px] text-[var(--t1)] focus:border-[var(--p)] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || pending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--p)] font-display text-[13px] font-[700] text-[var(--on-p)] transition-colors hover:bg-[var(--p-hover)] disabled:opacity-50"
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
            className="h-11 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 font-mono text-[14px] uppercase tracking-[0.15em] text-[var(--t1)] focus:border-[var(--p)] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleJoin}
            disabled={code.trim().length < 4 || pending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] font-display text-[13px] font-[700] text-[var(--t2)] transition-colors hover:border-[var(--p)] hover:text-[var(--p)] disabled:opacity-50"
          >
            참여하기
          </button>
        </section>
      </div>

      {/* 내가 만든 클래스 */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[13px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
          내가 만든 클래스 ({classes.length})
        </h2>
        {classes.length === 0 ? (
          <p className="rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg)] px-5 py-8 text-center font-body text-[13px] text-[var(--t2)]">
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
                  <p className="mt-0.5 inline-flex items-center gap-1 font-body text-[12px] text-[var(--t2)]">
                    <Users size={11} aria-hidden /> 학생 {c.member_count}명
                  </p>
                  {/*
                    학생이 없는 학급은 **아직 아무 일도 일어나지 않은 학급**이다.
                    "학생 0명" 만 쓰고 옆에 코드 칩을 두면 처음 온 교사는 그 칩이 무엇인지
                    알 수 없다 — 실측했을 때 첫 화면에 `TSTEM1` 만 덩그러니 있었다.
                  */}
                  {c.member_count === 0 && (
                    <p className="m-0 mt-1 font-body text-[11.5px] leading-[1.55] text-[var(--t3)]">
                      코드를 누르면 <b className="text-[var(--t2)]">초대 링크</b>가 복사돼요 — 반
                      채팅방에 붙여넣으면 학생이 눌러서 들어옵니다.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => copy(c.invite_code)}
                  className="inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 font-mono text-[13px] font-[700] tracking-[0.12em] text-[var(--t1)] transition-colors hover:border-[var(--p)]"
                  aria-label={`${c.name} 초대 링크 복사 (코드 ${c.invite_code})`}
                  title="초대 링크가 복사돼요 — 학생이 누르면 바로 참여 화면으로 갑니다"
                >
                  {c.invite_code}
                  {copied === c.invite_code ? (
                    <Check size={13} className="text-[var(--success)]" aria-hidden />
                  ) : (
                    <Copy size={13} className="text-[var(--t2)]" aria-hidden />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/*
        **이 화면의 유일한 출구.**

        2026-08-26 실측: `/teacher` 에는 나가는 링크가 **하나도 없었다.** 학급을 만들고
        초대 링크를 나눠 준 교사가 그다음 할 일이 화면 어디에도 없었다 —
        "보낸 단어" 구역은 보낸 것이 없으면 `return null` 이라 기능이 있는지조차 안 보인다.

        보내는 기능은 이미 있다. `/text/new` 에서 지문을 붙여넣고 단어를 뽑으면
        `SendToClassButton` 이 나온다. 그런데 링크가 **한 방향뿐이었다** —
        추출 화면은 학급을 알고(학급이 없으면 여기로 보낸다), 학급 화면은 추출을 몰랐다.

        학급이 있을 때만 보여준다. 없으면 먼저 만드는 것이 순서다.
      */}
      {/*
        학생이 한 명도 없으면 **다음 할 일은 보내기가 아니라 부르기**다.
        보낼 대상이 없는데 "단어를 보내세요" 라고 하면 그 화면은 틀린 말을 하는 것이고,
        교사는 시킨 대로 해도 아무 일이 안 일어난다(2026-08-27 실측: 학생 0명인 첫 화면이
        정확히 그 상태였다).
      */}
      {classes.length > 0 && !hasStudents && (
        <section className="flex flex-col gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-4">
          <h2 className="m-0 font-display text-[13px] font-[700] text-[var(--t1)]">
            다음 — 학생 부르기
          </h2>
          <p className="m-0 font-body text-[12.5px] leading-[1.65] text-[var(--t2)]">
            위 <b>초대코드를 누르면 링크가 복사</b>돼요. 반 채팅방이나 알림장에 붙여넣으면 학생이
            눌러서 바로 들어옵니다. 학생이 들어온 뒤에 단어를 보낼 수 있어요.
          </p>
        </section>
      )}

      {classes.length > 0 && hasStudents && (
        <section className="flex flex-col gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-4">
          <h2 className="m-0 font-display text-[13px] font-[700] text-[var(--t1)]">
            다음 — 우리 반에 단어 보내기
          </h2>
          <p className="m-0 font-body text-[12.5px] leading-[1.65] text-[var(--t2)]">
            교과서 지문이나 수업 프린트를 붙여넣으면 어려운 낱말을 골라 줘요. 그중 보낼 것만
            추려 학급에 보내면 학생 화면에 <strong>받은 단어</strong>로 도착합니다.
          </p>
          <Link
            href="/text/new"
            className="mt-1 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-[var(--r-md)] bg-[var(--p)] px-4 font-display text-[13px] font-[700] text-[var(--on-p)] transition-opacity duration-[var(--dur-normal)] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
          >
            지문 붙여넣기
            <ArrowRight size={14} aria-hidden />
          </Link>
        </section>
      )}

      {/* 참여 중인 클래스 */}
      {memberships.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-[13px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
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
          {/*
            **받은 것이 없는 학생은 막다른 골목에 있다.**
            들어온 직후가 정확히 그 상태이고, 그때 아무 말도 없으면 학생은
            잘못 들어온 줄 안다(실측: 반 이름 한 줄 말고는 화면에 아무것도 없었다).
          */}
          {!hasReceived && (
            <p className="m-0 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 font-body text-[12.5px] leading-[1.65] text-[var(--t2)]">
              선생님이 단어를 보내면 여기에 <b className="text-[var(--t1)]">받은 단어</b>로
              도착해요. 그때까지는 <b className="text-[var(--t1)]">내 단어장</b>으로 하던 학습을
              이어가면 됩니다.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
