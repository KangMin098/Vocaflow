// apps/web/src/app/dev/vocab-practice/page.tsx
//
// v6.2 P-F8d — 어휘 `vocab_choice` 연습 실행기 **격리 개발 화면**. 합성 문항 · 로컬 채점 · 기록 없음.
// 왜 격리인가: DB 채점(`grade_dcp_item`)이 이 유형을 모른다 — 채점 확장은 승인 대상 SQL. 공급 자격도 없다.
// 프로덕션 빌드에서는 열리지 않는다(`DEV_PRACTICE_ROUTES=on` 을 명시적으로 켠 경우만).
import { notFound } from 'next/navigation'

import { VocabPracticeDev } from './VocabPracticeDev'

export const metadata = { title: '어휘 연습 실행기(개발)', robots: { index: false } }

export default function Page() {
  if (process.env.NODE_ENV === 'production' && process.env.DEV_PRACTICE_ROUTES !== 'on') notFound()
  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-4 px-6 py-10">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] text-[var(--t3)]">DEV · 격리 화면 · 합성 문항 · 기록 없음</p>
        <h1 className="font-display text-[20px] font-[800] text-[var(--t1)]">어휘 — 문맥에 맞지 않는 낱말 찾기</h1>
        <p className="break-keep font-body text-[13px] text-[var(--t2)]">
          교재 「Vocaflow Vocab」 의 vocab_choice 유형을 기존 연습 플레이어로 푸는 화면입니다. 학습자 공개 전 — DB 채점 확장 · 공급 자격 승인 대기.
        </p>
      </header>
      <VocabPracticeDev />
    </main>
  )
}
