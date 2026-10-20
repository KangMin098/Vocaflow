// apps/web/src/components/csat/diagnosis/map/VocabLearningCard.tsx
//
// T-0069 — V1(v.core_meaning · 기본 의미 접근) 학습 진입. 정본 자산은 창작 세트가 아니라 기존 WordVault 복습(FSRS)이라
// AuthoredSupplyCard 대신 이 카드가 「내 단어 복습」 으로 보내고, 그 화면의 「학습 지도로」 가 같은 TASK · Workspace 로 돌려준다.
// 숫자(단어 수 · 오늘 복습 수 · 시험 빈도)는 여기서 세지 않는다 — 조회 없이 만들지 않는다. 빈 단어 · 조회 실패는 복습 화면이 실제 조회로 가른다.
// 복습 · 뜻 보기 · 자기 평가는 학습 활동이다 — 지도의 독립 확인 · 해소 · 유지 근거가 아니며, V1 직접 확인 도구는 아직 없다.

import { BookOpen } from 'lucide-react'
import Link from 'next/link'

import { withMapReturn, type MapReturnCtx } from '@/lib/csat/map-return'

import p from './popup.module.css'

export function VocabLearningCard({ kind, taskName, ctx }: { kind: 'core' | 'support'; taskName: string; ctx: MapReturnCtx }) {
  const href = withMapReturn('/wordvault/review', { ...ctx, mapItem: null, mapAttempt: null })
  return (
    <section className={p.card} aria-labelledby="ws-vocab-h" data-testid="ws-vocab" data-task="v.core_meaning">
      <div className={p.cardHead}>
        <div>
          <h3 id="ws-vocab-h" className={p.cardTitle}>내 단어 복습 · {kind === 'support' ? '보조 TASK' : '핵심 TASK'} {taskName}</h3>
          <p className={p.cardDesc}>기본 뜻을 떠올리는 연습은 내 단어장(WordVault)의 복습에서 해요. 복습이 끝나면 「학습 지도로」 를 눌러 이 묶음으로 돌아와요.</p>
        </div>
        <Link className={p.whitePill} href={href} data-testid="ws-vocab-review">
          <BookOpen size={14} strokeWidth={1.9} aria-hidden="true" />
          내 단어 복습하기
        </Link>
      </div>
      <p className={p.cardDesc} data-testid="ws-vocab-note">
        복습 · 뜻 보기 · 스스로 매긴 기억 정도는 학습 활동이에요. 지도의 확인 · 해소 근거로 세지 않고, 기본 의미를 따로 재는 확인 도구는 아직 없어요.
      </p>
      <p className={p.cardDesc}>
        복습할 단어가 없으면 <Link href="/wordvault/browse" data-testid="ws-vocab-browse">내 단어장</Link>에서 먼저 단어를 모아 주세요.
      </p>
    </section>
  )
}
