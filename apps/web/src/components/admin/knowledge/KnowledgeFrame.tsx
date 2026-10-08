// apps/web/src/components/admin/knowledge/KnowledgeFrame.tsx
// 학습 원리 화면 공용 판면 — 제목 · 이 화면이 답하는 질문 · 화면도움말 · 불러오기 실패 상태.
import Link from 'next/link'
import type { ReactNode } from 'react'

interface KnowledgeFrameProps {
  title: string
  /** 이 화면이 답하는 질문 한 줄 — 제목을 되풀이하지 않는다. */
  question: string
  /**
   * 화면도움말 요소. 문자열 키가 아니라 AdminScreenHelp 요소를 **화면 파일에 키를 적은 채로** 받는다 —
   * help-registry 회귀가 화면 파일의 그 리터럴을 읽어 키 계약(고아 항목·없는 키)을 검사하기 때문이다.
   * (이 주석에 요소 모양을 그대로 적으면 검사기가 주석을 키로 읽는다.)
   */
  help: ReactNode
  back?: { href: string; label: string }
  children: ReactNode
}

export function KnowledgeFrame({ title, question, help, back, children }: KnowledgeFrameProps) {
  return (
    <div className="break-keep p-4 md:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={back?.href ?? '/admin/knowledge'}
            className="inline-flex min-h-11 items-center text-sm text-[var(--t2)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
          >
            ← {back?.label ?? '원리 운영실'}
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--t1)]">{title}</h1>
          <p className="mt-1 text-[var(--t2)]">{question}</p>
        </div>
        {help}
      </header>
      {children}
    </div>
  )
}

/** DB 를 못 읽었을 때 — 빈 목록으로 위장하지 않는다. */
export function LoadFailed({ what, href }: { what: string; href: string }) {
  return (
    <section aria-live="polite" className="border-y border-[var(--bd)] py-8">
      <h2 className="font-semibold text-[var(--t1)]">{what}을(를) 불러오지 못했습니다</h2>
      <p className="my-3 text-[var(--t2)]">
        DB 연결 또는 권한 문제입니다. 목록이 비어 있는 것과 다릅니다 — 이 상태의 수치는 믿지 마세요.
      </p>
      <Link
        href={href}
        className="inline-flex min-h-11 items-center underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
      >
        다시 불러오기
      </Link>
    </section>
  )
}

/** 비어 있음 — 「0」이 아니라 무엇을 하면 채워지는지를 말한다. */
export function EmptyState({ title, next }: { title: string; next: string }) {
  return (
    <section className="border-y border-dashed border-[var(--bd)] py-8">
      <h2 className="font-semibold text-[var(--t1)]">{title}</h2>
      <p className="mt-2 text-[var(--t2)]">{next}</p>
    </section>
  )
}

/** 등급 표지 — 색만으로 전하지 않도록 글자(A/B/C/G)를 항상 함께 쓴다. */
export function GradeMark({ grade, label }: { grade: 'A' | 'B' | 'C' | 'G'; label: string }) {
  const tone =
    grade === 'A'
      ? 'border-[var(--p)] text-[var(--p)]'
      : grade === 'G'
        ? 'border-dashed border-[var(--bd)] text-[var(--t3)]'
        : 'border-[var(--bd)] text-[var(--t2)]'
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-xs ${tone}`}
      title={label}
    >
      <b className="font-mono">{grade}</b>
      <span>{label}</span>
    </span>
  )
}
