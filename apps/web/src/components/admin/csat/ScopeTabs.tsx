// apps/web/src/components/admin/csat/ScopeTabs.tsx
//
// 기출 관리자 화면의 **집합 범위 탭** — 평가원 / 학평 고1·고2·고3. 같은 화면을 집합만 바꿔 본다.
// 범위는 URL(`?set=hakpyeong&grade=N`)이 정본이다(scope.ts). 평가원이 기본이라 URL 에 싣지 않는다.
// 통계(유형 수·출제 지형·유형 리포트)는 집합끼리 섞지 않는다 — 학평을 고르면 그 학년의 수치만 보인다.

import Link from 'next/link'

import { SCOPES, sameScope, scopeLabel, withScope, type CsatScope } from '@/lib/csat/scope'

export function ScopeTabs({ scope, basePath, className = '' }: { scope: CsatScope; basePath: string; className?: string }) {
  return (
    <div className={className}>
      <nav aria-label="기출 집합" className="flex flex-wrap gap-2">
        {SCOPES.map((s) => {
          const on = sameScope(s, scope)
          return (
            <Link
              key={scopeLabel(s)}
              href={withScope(basePath, s)}
              aria-current={on ? 'page' : undefined}
              data-testid={`scope-${s.set === 'kice' ? 'kice' : `h${s.grade}`}`}
              className={`inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-[600] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin)] ${
                on ? 'border-[var(--t1)] bg-[var(--t1)] text-[var(--bg)]' : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]'
              }`}
            >
              {scopeLabel(s)}
            </Link>
          )
        })}
      </nav>
      {scope.set === 'hakpyeong' ? (
        <p className="mt-2 break-keep text-xs text-[var(--t2)]">
          학평 고{scope.grade} — 교육청 학력평가. 출제 수·지형은 이 학년 회차 전체로 세고, 평가원 통계와 섞지 않아요. 유형 리포트는 이 학년 리포트가
          쌓인 뒤에 보여요.
        </p>
      ) : null}
    </div>
  )
}
