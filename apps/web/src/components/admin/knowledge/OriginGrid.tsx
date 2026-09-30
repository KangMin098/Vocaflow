// apps/web/src/components/admin/knowledge/OriginGrid.tsx
// 기출 원천 격자 — 시험(행) × 문항 번호(열). 칸 = 등급 글자(A/B/C/G). 지문은 없다.
// 보기 전용(링크 없음). 빈칸은 DB 에 문항이 없는 자리, 「·」는 미확인(G)이다.
import { buildOriginGrid } from '@/lib/knowledge/grid'
import { GRADE_LABEL, type Grade } from '@/lib/knowledge/labels'

const TONE: Record<Grade, string> = {
  A: 'border-[var(--p)] font-semibold text-[var(--p)]',
  B: 'border-[var(--t2)] text-[var(--t1)]',
  C: 'border-[var(--bd)] text-[var(--t2)]',
  G: 'border-transparent text-[var(--t3)]',
}

export function OriginGrid({ origins }: { origins: { itemIds: string[]; grade: Grade }[] }) {
  const g = buildOriginGrid(origins)
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0.5 text-xs">
        <caption className="sr-only">시험 × 문항 번호별 원천 등급</caption>
        <thead>
          <tr>
            <th scope="col" className="pr-2 text-left font-medium text-[var(--t2)]">시험</th>
            {g.numbers.map((n) => (
              <th key={n} scope="col" className="w-7 text-center font-mono font-normal text-[var(--t3)]">
                {n}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {g.exams.map((exam) => (
            <tr key={exam}>
              <th scope="row" className="pr-2 text-left font-mono font-normal text-[var(--t1)]">
                {exam}
              </th>
              {g.numbers.map((n) => {
                const grade = g.gradeAt(exam, n)
                if (!grade) return <td key={n} aria-label={`${exam} ${n}번 문항 없음`} />
                const cell = `flex h-7 w-7 items-center justify-center rounded border font-mono ${TONE[grade]}`
                const label = `${exam} ${n}번 — ${grade} ${GRADE_LABEL[grade]}`
                // 칸은 보기 전용이다 — 28px 칸에 링크를 걸면 44px 터치 타겟 규칙을 깬다. 이동은 아래 표가 맡는다.
                return (
                  <td key={n}>
                    <span className={cell} title={label} aria-label={label}>
                      {grade === 'G' ? '·' : grade}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
