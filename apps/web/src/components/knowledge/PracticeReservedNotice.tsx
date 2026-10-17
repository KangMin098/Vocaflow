// apps/web/src/components/knowledge/PracticeReservedNotice.tsx
//
// 연습할 문항이 지금 없을 때(#281) — 남은 문항이 모두 「처음 보는 문항으로 확인」에 쓰일 예약이라 연습으로 먼저 열지 않는다.
// 숨기지 않고 이유와 대체 경로(학습 지도의 확인 과제)를 보인다. 수치는 서버가 센 실제 예약 수만.
import Link from 'next/link'
import { ArrowRight, Map } from 'lucide-react'

import s from './practice.module.css'

export function PracticeReservedNotice({ reservedCount, ledgerError }: { reservedCount: number; ledgerError: boolean }) {
  return (
    <div className={s.page} data-testid="practice-content-needed" data-reason={ledgerError ? 'ledger_error' : 'reserved_for_check'} data-reserved={reservedCount}>
      <header className={s.head}>
        <p className={s.eyebrow}>연습 · 주장과 근거</p>
        <h1 className="break-keep">지금은 연습할 문항이 없어요</h1>
        <p className={`${s.why} break-keep`}>
          {ledgerError
            ? '어떤 문항을 이미 봤는지 기록을 다 읽지 못했어요. 처음 보는 문항으로 확인할 기회를 잃지 않도록 연습을 잠시 열지 않아요.'
            : `남은 문항 ${reservedCount}개는 처음 보는 문항으로 실력을 확인하는 데 쓰여요. 연습으로 먼저 보면 그 확인을 할 수 없어서 아껴 두었어요.`}
        </p>
      </header>
      <section className={s.state} aria-labelledby="practice-next">
        <h2 id="practice-next">이렇게 이어 가요</h2>
        <p className="break-keep">학습 지도에서 「주장과 근거」 확인 과제를 먼저 풀어 보세요. 확인을 마친 문항은 그다음부터 여기서 연습할 수 있어요.</p>
        <p>
          <Link href="/csat/diagnosis" className={s.link} data-testid="practice-content-needed-map">
            <Map size={14} aria-hidden="true" />&nbsp;학습 지도로 가기&nbsp;<ArrowRight size={14} aria-hidden="true" />
          </Link>
        </p>
      </section>
    </div>
  )
}
