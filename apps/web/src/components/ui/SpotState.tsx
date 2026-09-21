// apps/web/src/components/ui/SpotState.tsx
//
// 빈 상태 · 오류 · 없음 화면의 공통 틀(DD-68 · tines-mapping §13-2 · §14) — 참조 404 · 빈 결과 문법:
// **가운데 소품 하나**(물건 삽화, 104–160px) · 세리프 제목 · 한 문단 · 알약 단추(1차 + 2차). 상자·점선 테두리 없이 판면 위에 선다.
// 용도별 소품: empty-shelf · empty-vault · empty-page · search · offline · error · loading · locked · review-done
// (파일이 있는 것만 — 생성기 목록의 lost · welcome · calendar 는 무료 한도 소진으로 아직 없다, 2026-09-21).
// 서버 · 클라이언트 어디서나 쓴다(상태 없음).

import Image from 'next/image'
import Link from 'next/link'

import { BTN } from './tines-kit'

export type SpotArt =
  | 'empty-shelf' | 'empty-vault' | 'empty-page' | 'search' | 'offline' | 'error' | 'loading' | 'locked' | 'review-done'

type Action = { label: string; href?: string; onClick?: () => void }

export function SpotState({
  art,
  title,
  body,
  primary,
  secondary,
  size = 'md',
  role,
  align = 'center',
}: {
  art: SpotArt
  title: React.ReactNode
  body?: React.ReactNode
  primary?: Action
  secondary?: Action
  /** sm — 목록 안 빈 칸(104px) · md — 화면 가운데(140px) · lg — 전면(오류 · 404, 180px) */
  size?: 'sm' | 'md' | 'lg'
  /** 오류는 'alert', 비었음은 'status' — 스크린리더가 화면 변화를 알린다 */
  role?: 'alert' | 'status'
  align?: 'center' | 'start'
}) {
  const w = size === 'sm' ? 'w-[104px]' : size === 'lg' ? 'w-[180px]' : 'w-[140px]'
  const t = size === 'lg' ? 'text-[32px] md:text-[44px]' : size === 'sm' ? 'text-[20px]' : 'text-[24px] md:text-[28px]'
  const center = align === 'center'
  return (
    <div role={role} className={`flex flex-col gap-3 py-6 ${center ? 'items-center text-center' : 'items-start text-left'}`}>
      <Image src={`/illustrations/tines/spot-${art}.webp`} alt="" width={1328} height={1328} className={`${w} select-none`} />
      <h3 className={`mt-1 break-keep font-serif font-[400] leading-[1.15] text-[var(--t1)] ${t}`}>{title}</h3>
      {body && <p className={`max-w-[46ch] break-keep font-body text-[15px] leading-[1.65] text-[var(--t2)]`}>{body}</p>}
      {(primary || secondary) && (
        <div className={`mt-2 flex flex-wrap gap-2 ${center ? 'justify-center' : ''}`}>
          {primary && <ActionButton a={primary} cls={BTN.primary} />}
          {secondary && <ActionButton a={secondary} cls={BTN.secondary} />}
        </div>
      )}
    </div>
  )
}

function ActionButton({ a, cls }: { a: Action; cls: string }) {
  if (a.href) return <Link href={a.href} className={cls}>{a.label}</Link>
  return <button type="button" onClick={a.onClick} className={cls}>{a.label}</button>
}
