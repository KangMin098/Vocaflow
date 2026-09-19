// apps/web/src/components/teacher/TeacherClient.tsx
// 교사 허브 — 클래스 개설/목록(초대코드·멤버수) + 초대코드 참여. Calm UI. P4.2.
//
// 2026-09-19 화면 재설계(DD-33 · docs/design/compare/teacher.md 발산 A 「교실에 붙일 초대장」):
//   첫 시선이 같은 폭 입력 폼 두 장 + 점선 빈 상자였다(감사 평균). 지금은 **초대장 한 장**(`InviteSheet` —
//   반 이름 · 큰 코드 · QR)이 골격이다. 반이 없으면 같은 종이가 미리보기로 서고, 반 이름을 적는 칸이 곧 종이의 제목이다.
//   참여(학생 쪽)는 한 줄 폼으로 내렸다 — 교사 화면의 1차가 아니다.

'use client'

import { ArrowRight, Check, Copy, Plus, Users } from 'lucide-react'
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

import { InviteSheet } from './InviteSheet'

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

  // 초대장에 올릴 반 — 여러 반이면 고른다(처음엔 학생이 가장 적은 반: 부를 일이 남은 곳)
  const [chosenId, setChosenId] = useState<string | null>(null)
  const chosen =
    classes.find((c) => c.id === chosenId) ??
    [...classes].sort((a, b) => a.member_count - b.member_count)[0] ??
    null

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 md:py-10">
      <header className="border-b-2 border-[var(--t1)] pb-3">
        <h1 className="font-editorial text-[26px] font-[500] leading-[1.15] text-[var(--t1)] md:text-[30px]">클래스</h1>
        <p className="mt-1 font-body text-[13px] text-[var(--t2)] [word-break:keep-all]">
          학급에 나눠 줄 초대장 한 장 — 학생은 QR 이나 초대 링크로 바로 들어와요.
        </p>
      </header>

      {/* 조회 실패 고지 — 빈 목록이 "클래스가 없음" 으로 읽히지 않게. 개설·참여 자체는
          막지 않는다(쓰기 경로는 별개로 살아 있을 수 있다). */}
      {unavailable && (
        <p
          role="status"
          className="border-l-2 border-[var(--bd)] py-1 pl-3 font-body text-[12.5px] leading-[1.6] text-[var(--t2)]"
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

      {/* ── 골격: 초대장 ── 반이 있으면 그 반의 초대장, 없으면 적는 대로 채워지는 미리보기 */}
      {chosen ? (
        <section aria-label="초대장" className="flex flex-col gap-3">
          <InviteSheet name={chosen.name} code={chosen.invite_code} memberCount={chosen.member_count} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={() => copy(chosen.invite_code)}
              aria-label={`${chosen.name} 초대 링크 복사 (코드 ${chosen.invite_code})`}
              className={PRIMARY}
            >
              {copied === chosen.invite_code ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
              {copied === chosen.invite_code ? '복사했어요' : '초대 링크 복사'}
            </button>
            {/*
              학생이 없는 학급은 **아직 아무 일도 일어나지 않은 학급**이다 — 코드가 무엇인지,
              어디에 붙이는지 말한다(실측: 첫 화면에 `TSTEM1` 만 덩그러니 있었다).
            */}
            {chosen.member_count === 0 && (
              <p className="m-0 max-w-[46ch] font-body text-[12.5px] leading-[1.6] text-[var(--t2)] [word-break:keep-all]">
                <b className="text-[var(--t1)]">초대 링크</b>를 반 채팅방에 붙여넣거나 이 종이를 인쇄해 붙이면 학생이 들어옵니다.
              </p>
            )}
          </div>
        </section>
      ) : (
        <section aria-label="초대장 미리보기" className="flex flex-col gap-3">
          <InviteSheet name={name} code={null} editable onNameChange={setName} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button type="button" onClick={handleCreate} disabled={!name.trim() || pending} className={PRIMARY}>
              <Plus size={15} strokeWidth={2} aria-hidden />
              {pending ? '만드는 중…' : '이 반 만들기'}
            </button>
            <p className="m-0 font-body text-[12.5px] text-[var(--t2)] [word-break:keep-all]">
              {name.trim() ? '만들면 초대코드와 QR 이 이 종이에 채워져요.' : '반 이름을 적으면 개설할 수 있어요.'}
            </p>
          </div>
        </section>
      )}

      {/* 내가 만든 클래스 — 두 개 이상이면 고르는 괘선 목록 + 새 반 */}
      {classes.length > 0 && (
        <section aria-label={`내가 만든 클래스 ${classes.length}개`} className="flex flex-col">
          <h2 className="mb-1 font-display text-[12px] font-[700] text-[var(--t2)]">
            내가 만든 클래스 ({classes.length})
          </h2>
          <ul className="border-t border-[var(--bd)]">
            {classes.map((c) => {
              const on = chosen?.id === c.id
              return (
                <li key={c.id} className="border-b border-[var(--bd)]">
                  <button
                    type="button"
                    onClick={() => setChosenId(c.id)}
                    aria-pressed={on}
                    className={`flex min-h-[44px] w-full items-center gap-3 px-1 text-left transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--p)] active:translate-y-px ${on ? 'border-l-2 border-[var(--ju)] pl-2' : ''}`}
                  >
                    <span className="min-w-0 flex-1 truncate font-display text-[14px] font-[700] text-[var(--t1)]">{c.name}</span>
                    <span className="inline-flex items-center gap-1 font-body text-[12px] text-[var(--t2)]">
                      <Users size={11} aria-hidden /> 학생 {c.member_count}명
                    </span>
                    <span className="font-mono text-[12px] tracking-[0.12em] text-[var(--t2)]">{c.invite_code}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {/* 새 반 — 한 줄 */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleCreate()
            }}
            className="mt-2 flex flex-wrap items-center gap-2"
          >
            <label htmlFor="new-class-name" className="sr-only">
              새 클래스 이름
            </label>
            <input
              id="new-class-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="새 반 이름 — 예: 3-3반 영어"
              className={FIELD}
            />
            <button type="submit" disabled={!name.trim() || pending} className={QUIET}>
              <Plus size={14} strokeWidth={2} aria-hidden /> 개설
            </button>
          </form>
        </section>
      )}

      {/*
        학생이 한 명도 없으면 **다음 할 일은 보내기가 아니라 부르기**다(2026-08-27 실측).
        학생이 있으면 보내기 — `/text/new` 가 붙여 넣은 글을 칠하고, 거기서 학급에 보낸다.
      */}
      {classes.length > 0 && !hasStudents && (
        <section className="border-l-2 border-[var(--ju)] py-1 pl-4">
          <h2 className="m-0 font-display text-[13px] font-[700] text-[var(--t1)]">다음 — 학생 부르기</h2>
          <p className="m-0 mt-1 font-body text-[12.5px] leading-[1.65] text-[var(--t2)] [word-break:keep-all]">
            위 <b>초대 링크를 복사</b>해 반 채팅방이나 알림장에 붙여넣으면 학생이 눌러서 바로 들어옵니다. 학생이
            들어온 뒤에 단어를 보낼 수 있어요.
          </p>
        </section>
      )}

      {classes.length > 0 && hasStudents && (
        <section className="border-l-2 border-[var(--ju)] py-1 pl-4">
          <h2 className="m-0 font-display text-[13px] font-[700] text-[var(--t1)]">다음 — 우리 반에 단어 보내기</h2>
          <p className="m-0 mt-1 font-body text-[12.5px] leading-[1.65] text-[var(--t2)] [word-break:keep-all]">
            교과서 지문이나 수업 프린트를 붙여넣으면 이 글이 어느 학년에게 맞는지 칠해지고, 어려운 낱말을 골라
            학급에 보내면 학생 화면에 <strong>받은 단어</strong>로 도착합니다.
          </p>
          <Link href="/text/new" className={`${QUIET} mt-2 w-fit`}>
            지문 붙여넣기
            <ArrowRight size={14} aria-hidden />
          </Link>
        </section>
      )}

      {/* 초대코드로 참여 — 학생 쪽 입구. 교사 화면의 1차가 아니라 한 줄 */}
      <section aria-label="초대코드로 참여" className="border-t border-[var(--bd)] pt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleJoin()
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <label htmlFor="join-code" className="font-display text-[13px] font-[700] text-[var(--t1)]">
            초대코드로 참여
          </label>
          <input
            id="join-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            className={`${FIELD} w-[9.5rem] font-mono uppercase tracking-[0.15em]`}
          />
          <button type="submit" disabled={code.trim().length < 4 || pending} className={QUIET}>
            참여하기
          </button>
        </form>
      </section>

      {/* 참여 중인 클래스 */}
      {memberships.length > 0 && (
        <section className="flex flex-col">
          <h2 className="mb-1 font-display text-[12px] font-[700] text-[var(--t2)]">
            참여 중인 클래스 ({memberships.length})
          </h2>
          <ul className="border-t border-[var(--bd)]">
            {memberships.map((m) => (
              <li
                key={m.class_id}
                className="flex min-h-[44px] items-center border-b border-[var(--bd)] px-1 font-display text-[14px] font-[700] text-[var(--t1)]"
              >
                {m.class_name}
              </li>
            ))}
          </ul>
          {/* 받은 것이 없는 학생은 막다른 골목에 있다 — 무엇을 기다리는지 말한다 */}
          {!hasReceived && (
            <p className="m-0 mt-2 border-l-2 border-[var(--bd)] py-1 pl-3 font-body text-[12.5px] leading-[1.65] text-[var(--t2)] [word-break:keep-all]">
              선생님이 단어를 보내면 여기에 <b className="text-[var(--t1)]">받은 단어</b>로 도착해요. 그때까지는{' '}
              <b className="text-[var(--t1)]">내 단어장</b>으로 하던 학습을 이어가면 됩니다.
            </p>
          )}
        </section>
      )}
    </div>
  )
}

const PRIMARY =
  'inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] bg-[var(--ju)] px-5 font-display text-[14px] font-[700] text-[var(--on-ju)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--ju-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50'
const QUIET =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[13px] font-[700] text-[var(--t1)] no-underline transition-colors duration-[var(--dur-normal)] hover:border-[var(--p)] hover:text-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50'
const FIELD =
  'h-11 min-w-0 flex-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-body text-[14px] text-[var(--t1)] placeholder:text-[var(--t3)] focus:border-[var(--p)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]/30'
