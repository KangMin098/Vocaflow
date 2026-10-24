// apps/web/src/app/dev/f08/page.tsx
// F08 후보 목록 — 세 후보는 같은 문항(2026 수능 34번)·같은 과제로 비교한다.

import Link from 'next/link'

import { CANDIDATES } from '@/lib/csat/f08-proto/types'

const TASK = [
  '발문이 무엇을 판단하라고 하는지 확인한다',
  '빈칸 앞 부정(cannot be)과 If 조건의 범위를 원문에서 찾는다',
  '정답 후보와 가까운 오답(1번·3번)을 완성 명제로 비교한다',
  '각 선지의 근거 문장을 원문에 연결한다',
  '원하면 정답·해설을 열고, 원문과 오가며 판단을 고친다',
  '출제 원리가 통하지 않는 경우를 확인한다',
]

export default function F08Index() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 break-keep">
      <h1 className="text-2xl font-semibold">F08 화면 후보 비교 — 2026 수능 34번</h1>
      <p className="text-sm text-[var(--csat-ink2)]">내부 비교용 프로토타입이다. 최종 배치는 정하지 않았다. 실제 학습 효과: NOT_EVALUATED.</p>
      <section aria-labelledby="task">
        <h2 id="task" className="mb-2 font-semibold">세 후보에 같은 과제</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm">{TASK.map((t) => <li key={t}>{t}</li>)}</ol>
      </section>
      <ul className="grid grid-cols-3 gap-3">
        {CANDIDATES.map((c) => (
          <li key={c.id}>
            <Link href={`/dev/f08/${c.id}`} className="block min-h-[44px] rounded-md border border-[var(--csat-edge)] bg-white p-4 hover:bg-[var(--csat-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--csat-accent)]">
              <span className="block font-semibold">후보 {c.id.toUpperCase()}</span>
              <span className="block text-sm">{c.name}</span>
              <span className="mt-1 block text-xs text-[var(--csat-muted)]">{c.idea}</span>
            </Link>
          </li>
        ))}
      </ul>
      <section aria-labelledby="faults" className="text-sm">
        <h2 id="faults" className="mb-1 font-semibold">오류 상태 보기</h2>
        <p>후보 주소 뒤에 <code>?fault=no-source</code> · <code>reveal-refused</code> · <code>reveal-error</code> · <code>lecture-fail</code></p>
      </section>
    </main>
  )
}
