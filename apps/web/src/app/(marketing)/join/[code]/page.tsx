// apps/web/src/app/(marketing)/join/[code]/page.tsx — /join/[code]
//
// **초대 링크** — 교사가 공유하는 것이 코드가 아니라 이 주소가 된다.
//
// ── 무엇이 끊겨 있었나 (2026-08-26 실측) ────────────────────────────
// 교사 허브의 복사 버튼은 **맨 코드 6자**(`ABC123`)를 클립보드에 넣었다. 그것을 받은 학생은
//   ① vocaflow.app 을 찾아 ② 가입하고 ③ `클래스` 라는 화면을 찾아 ④ 코드를 붙여넣어야 한다.
// ③ 은 학생이 스스로 도달할 이유가 없는 화면이고, 넷 중 하나만 틀려도 끝이다.
// 분기 진단이 "교사 3,500명 × 학급 30명 경로만 성립한다" 고 계산한 그 경로의 한가운데다.
//
// ② 에서 한 번 더 끊겼다 — 가입 화면이 복귀 경로(`?next=`)를 버리고 무조건 `/hub` 로 보냈다.
// **초대받은 학생은 전원 신규 가입자**이므로, 링크만 만들었다면 가입하는 순간 학급 연결이
// 사라졌을 것이다. 같은 커밋에서 함께 고쳤다(`(auth)/signup/page.tsx`).
//
// ── 왜 가입 전에 학급을 보여주나 ────────────────────────────────────
// 코드가 틀렸거나 오래됐을 때 가입을 마친 뒤에 알려 주면 그 사람은 계정만 만들고 떠난다.
// `peek_class_by_code`(익명 허용, 이름·인원만)로 **먼저** 보여준다. 교사 신원은 담기지 않는다.
//
// ── 왜 자동으로 넣지 않나 ───────────────────────────────────────────
// 참여는 버튼 한 번을 거친다. 이 주소는 공개라 링크 미리보기·브라우저 prefetch 가 그냥 열 수
// 있고, GET 이 학급 가입을 일으키면 마우스를 올린 것만으로 들어가게 된다.
//
// ⚠️ sitemap 에 넣지 않는다 — 초대는 **받은 사람의 것**이지 검색될 것이 아니다.
//    `robots` 로도 색인을 막는다(코드가 검색 결과에 실리면 초대가 초대가 아니게 된다).

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'

import { RETURN_PARAM } from '@/lib/auth/redirect'
import { invitePath, normalizeInviteCode } from '@/lib/teacher/invite-link'
import { joinClassByCode, peekClassByCode } from '@/lib/teacher/class-actions'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  params: { code: string }
}

export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: PageProps): Metadata {
  return {
    title: '클래스 초대',
    description: '선생님이 보낸 초대 링크로 학급에 참여합니다.',
    // 초대 코드가 검색 결과에 실리면 안 된다.
    robots: { index: false, follow: false },
    alternates: { canonical: `/join/${params.code}` },
  }
}

export default async function JoinPage({ params }: PageProps) {
  const code = normalizeInviteCode(decodeURIComponent(params.code ?? ''))
  const [peek, client] = await Promise.all([peekClassByCode(code), createClient()])
  const {
    data: { user },
  } = await client.auth.getUser()

  // 코드가 가리키는 학급이 없다 — 가입을 권하지 않는다.
  if (!peek) return <UnknownCode code={code} />

  /** 참여 — 서버에서 `auth.uid()` 로 찍는다. 멱등(이미 멤버면 아무 일도 안 일어난다). */
  async function join() {
    'use server'
    const res = await joinClassByCode(code)
    // 실패해도 목적지는 같다 — `/teacher` 가 참여 목록으로 사실을 보여준다.
    // (여기서 에러 문구를 따로 띄우면 같은 사실을 두 곳에서 말하게 된다.)
    void res
    redirect('/teacher')
  }

  // 가입·로그인이 들고 갈 복귀 경로 — 교사가 복사한 링크와 **같은 모양**이어야 한다.
  const next = invitePath(code)

  return (
    <main className="mx-auto flex w-full max-w-[520px] flex-col gap-6 px-4 py-12 md:py-16">
      <section className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6">
        <p className="font-display text-[11px] font-[800] uppercase tracking-[0.14em] text-[var(--p)]">
          클래스 초대
        </p>
        <h1 className="m-0 font-display text-[26px] font-[800] leading-[1.15] tracking-tight text-[var(--t1)] md:text-[30px]">
          {peek.name}
        </h1>
        <p className="m-0 inline-flex items-center gap-2 font-mono text-[12px] text-[var(--t2)]">
          <Users size={13} aria-hidden />
          {peek.memberCount > 0 ? `학생 ${peek.memberCount}명이 참여 중` : '첫 번째 참여자예요'}
          <span aria-hidden>·</span>
          <span className="tracking-[0.08em]">{code}</span>
        </p>

        {user ? (
          <form action={join} className="mt-2">
            <button
              type="submit"
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--r-md)] bg-[var(--p)] px-6 font-display text-[14px] font-[700] text-[var(--on-p)] transition-opacity duration-[var(--dur-normal)] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
            >
              이 클래스에 참여하기
            </button>
          </form>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {/*
              가입·로그인 둘 다 이 주소를 들고 간다. 가입 화면이 `next` 를 지키도록
              같은 커밋에서 고쳤다 — 그전에는 여기로 돌아오지 못했다.
            */}
            <Link
              href={`/signup?${RETURN_PARAM}=${encodeURIComponent(next)}`}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--r-md)] bg-[var(--p)] px-6 font-display text-[14px] font-[700] text-[var(--on-p)] transition-opacity duration-[var(--dur-normal)] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
            >
              가입하고 참여하기
            </Link>
            <Link
              href={`/login?${RETURN_PARAM}=${encodeURIComponent(next)}`}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--r-md)] border border-[var(--bd)] px-6 font-display text-[13px] font-[600] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
            >
              이미 계정이 있어요
            </Link>
          </div>
        )}
      </section>

      <p className="m-0 text-center font-body text-[12px] leading-relaxed text-[var(--t3)]">
        참여하면 선생님이 보낸 단어와 지문을 받아볼 수 있어요. 언제든 나갈 수 있습니다.
      </p>
    </main>
  )
}

/**
 * 코드가 어떤 학급도 가리키지 않을 때.
 *
 * **가입을 권하지 않는다** — 잘못된 코드로 계정을 만들게 하면 그 사람은 학급에도 못 들어가고
 * 계정만 하나 남긴 채 떠난다. 대신 손으로 다시 넣어 볼 자리(`/teacher`)를 알려 준다.
 */
function UnknownCode({ code }: { code: string }) {
  return (
    <main className="mx-auto flex w-full max-w-[520px] flex-col gap-4 px-4 py-12 md:py-16">
      <h1 className="m-0 font-display text-[22px] font-[800] tracking-tight text-[var(--t1)]">
        이 초대 링크는 확인할 수 없어요
      </h1>
      <p className="m-0 font-body text-[13.5px] leading-relaxed text-[var(--t2)]">
        코드 <strong className="font-mono tracking-[0.08em]">{code || '(없음)'}</strong> 에 해당하는
        클래스를 찾지 못했어요. 링크가 잘리지 않았는지, 선생님이 보낸 코드가 맞는지 확인해 주세요.
      </p>
      <Link
        href="/"
        className="inline-flex min-h-[44px] w-fit items-center rounded-[var(--r-md)] border border-[var(--bd)] px-5 font-display text-[13px] font-[600] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
      >
        Vocaflow 둘러보기
      </Link>
    </main>
  )
}
