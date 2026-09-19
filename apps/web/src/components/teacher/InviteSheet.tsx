// apps/web/src/components/teacher/InviteSheet.tsx
//
// **교실에 붙일 초대장** — `/teacher` 의 골격(2026-09-19 화면 재설계 DD-33 · docs/design/compare/teacher.md 발산 A).
//
// 교사 화면의 첫 시선은 같은 폭 입력 폼 두 장과 점선 빈 상자였다(감사 평균). 이 화면이 만드는 **사물**은
// 학생 30명을 데려오는 종이 한 장이다 — 반 이름 · 큰 초대코드 · QR(`/join/<code>`, 복사본에서도 읽히는 길이).
// 반이 없으면 같은 종이가 **미리보기**로 선다: 반 이름을 적는 칸이 곧 종이의 제목이고, 적는 대로 채워진다
// (`/text/new` · `/fit` 의 「입력칸이 곧 결과」 와 같은 몸짓). 모션 0.
//
// QR 은 브라우저에서 만든다 — 초대 주소는 접속한 origin 을 담아야 스캔된다(서버 렌더 때는 자리만).

'use client'

import { useEffect, useState } from 'react'

import { inviteUrl } from '@/lib/teacher/invite-link'
import { qrSvg } from '@/lib/worksheet/qr'

export function InviteSheet({
  name,
  code,
  memberCount,
  editable = false,
  onNameChange,
}: {
  /** 반 이름 — 미리보기면 입력 중인 값 */
  name: string
  /** 초대코드 — 아직 없으면(미리보기) null */
  code: string | null
  memberCount?: number
  /** 반 이름을 종이 위에서 적는다(반이 없을 때) */
  editable?: boolean
  onNameChange?: (next: string) => void
}) {
  const [origin, setOrigin] = useState<string | null>(null)
  useEffect(() => setOrigin(window.location.origin), [])

  const url = code && origin ? inviteUrl(origin, code) : null
  const qr = url ? qrSvg(url) : null

  return (
    <figure
      data-invite-sheet={code ? 'class' : 'preview'}
      className="m-0 border border-[var(--t1)] bg-[var(--bg)] px-5 py-6 md:px-8 md:py-8"
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-[var(--t1)] pb-2">
        <span className="font-display text-[12px] font-[700] text-[var(--t1)]">초대장</span>
        <span className="font-body text-[11px] text-[var(--t2)]">Vocaflow 클래스</span>
      </div>

      {editable ? (
        <>
          <label htmlFor="invite-class-name" className="sr-only">
            클래스 이름
          </label>
          <input
            id="invite-class-name"
            value={name}
            onChange={(e) => onNameChange?.(e.target.value)}
            placeholder="반 이름 — 예: 3-2반 영어"
            maxLength={60}
            className="mt-4 w-full border-0 border-b-2 border-dashed border-[var(--bd)] bg-transparent px-0 pb-1 font-ko-display text-[26px] font-[600] leading-[1.25] text-[var(--t1)] placeholder:text-[var(--t3)] focus:border-[var(--ju)] focus:outline-none md:text-[32px]"
          />
        </>
      ) : (
        <p className="m-0 mt-4 break-keep font-ko-display text-[26px] font-[600] leading-[1.25] text-[var(--t1)] md:text-[32px]">
          {name}
        </p>
      )}

      <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <p className="m-0 font-body text-[13px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
            휴대폰 카메라로 QR 을 찍거나, 초대 링크를 누르면 바로 이 반에 들어와요.
          </p>
          <p className="m-0 mt-3 font-display text-[11px] font-[700] text-[var(--t2)]">초대코드</p>
          <p
            data-invite-code=""
            className={`m-0 font-mono text-[36px] font-[700] leading-none tracking-[0.18em] md:text-[44px] ${code ? 'text-[var(--t1)]' : 'text-[var(--t3)]'}`}
          >
            {code ?? '······'}
          </p>
          {memberCount != null && (
            <p className="m-0 mt-2 font-body text-[12px] text-[var(--t2)]">
              지금 들어온 학생 <b className="font-mono text-[var(--t1)]">{memberCount}</b>명
            </p>
          )}
        </div>

        <div
          aria-hidden={!qr}
          className="flex h-[120px] w-[120px] items-center justify-center border border-[var(--bd)] bg-white p-2"
        >
          {qr ? (
            <span
              role="img"
              aria-label={`초대 링크 QR — 코드 ${code}`}
              className="block h-full w-full [&>svg]:h-full [&>svg]:w-full"
              // 인코더가 만든 SVG(라이브러리 산출물, 사용자 입력 아님 — 주소는 우리가 조립한다)
              dangerouslySetInnerHTML={{ __html: qr.markup }}
            />
          ) : (
            <span className="text-center font-body text-[11px] leading-[1.5] text-[#555] [word-break:keep-all]">
              {code ? 'QR 준비 중' : '반을 만들면 QR 이 생겨요'}
            </span>
          )}
        </div>
      </div>
    </figure>
  )
}
