// apps/web/src/app/admin/csat/help/page.tsx
//
// **교재 공장 용어집.** 공장 화면의 점선 밑줄 낱말을 모두 여기서 푼다.
// 내용은 `factory-glossary.ts` 한 곳에서 온다 — 이 화면도 툴팁도 거기서만 읽는다.
//
// 「옛 말」 칸은 일부러 둔다: 실행 줄 · 운영자용 현황판 · 문서에는 코드의 말이 남아 있어서,
// 그 말을 만난 사람이 여기서 쉬운 말을 찾아갈 수 있어야 한다.

import Link from 'next/link'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { WhoChip } from '@/components/admin/factory/WhoChip'
import { requireAdmin } from '@/lib/auth/require-admin'
import { GLOSSARY, GLOSSARY_GROUPS, type GlossaryTerm, type TermId } from '@/lib/csat/factory-glossary'
import { PLAIN_STEPS } from '@/lib/csat/factory-plain'

export default async function AdminCsatHelpPage() {
  await requireAdmin('/admin/csat/help')
  const entries = Object.entries(GLOSSARY) as [TermId, GlossaryTerm][]
  const groups = Object.entries(GLOSSARY_GROUPS) as [GlossaryTerm['group'], string][]

  return (
    <div className="flex max-w-[860px] flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link
            href="/admin/csat"
            className="inline-flex min-h-[44px] w-fit items-center font-display text-[12.5px] font-[700] text-[var(--admin)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin)]"
          >
            ← 공장 지도로
          </Link>
          <h2 className="font-display text-[18px] font-[800] text-[var(--t1)]">용어집</h2>
          <p className="break-keep font-body text-[14px] leading-relaxed text-[var(--t1)]">
            공장 화면에서 점선 밑줄이 있는 낱말을 여기서 모두 풀어요. 실행 줄이나 예전 화면에 나오는 말이 무엇을 뜻하는지도 「예전 말」에서 찾을 수 있어요.
          </p>
        </div>
        <AdminScreenHelp screen="csat-glossary" />
      </div>

      {/* 여덟 걸음 한 줄 요약 — 낱말을 찾으러 온 사람도 흐름을 한 번 보고 간다. */}
      <section aria-labelledby="steps-title" className="flex flex-col gap-2">
        <h3 id="steps-title" className="font-display text-[15px] font-[800] text-[var(--t1)]">
          여덟 걸음 한눈에
        </h3>
        <ol className="flex flex-col divide-y divide-[var(--bd)] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]">
          {PLAIN_STEPS.map((s) => (
            <li key={s.key} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-3">
              <Link
                href={s.href}
                className="inline-flex min-h-[44px] shrink-0 items-center font-display text-[13.5px] font-[800] text-[var(--admin)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin)] sm:w-[150px]"
              >
                {s.no != null ? `${s.no}. ` : '↺ '}
                {s.name}
              </Link>
              <span className="flex flex-col gap-1">
                <span className="break-keep font-body text-[13px] leading-relaxed text-[var(--t1)]">{s.says}</span>
                <WhoChip who={s.who} />
              </span>
            </li>
          ))}
        </ol>
      </section>

      {groups.map(([g, label]) => (
        <section key={g} aria-labelledby={`g-${g}`} className="flex flex-col gap-2">
          <h3 id={`g-${g}`} className="font-display text-[15px] font-[800] text-[var(--t1)]">
            {label}
          </h3>
          <dl className="flex flex-col divide-y divide-[var(--bd)] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]">
            {entries
              .filter(([, t]) => t.group === g)
              .map(([id, t]) => (
                <div key={id} id={id} className="flex scroll-mt-20 flex-col gap-1 px-4 py-3 target:bg-[var(--bg2)]">
                  <dt className="font-display text-[14px] font-[800] text-[var(--t1)]">{t.word}</dt>
                  <dd className="break-keep font-body text-[13px] leading-relaxed text-[var(--t1)]">{t.plain}</dd>
                  {t.example ? (
                    <dd className="break-keep font-body text-[12.5px] leading-relaxed text-[var(--t2)]">예) {t.example}</dd>
                  ) : null}
                  {t.aka?.length ? (
                    <dd className="font-body text-[11.5px] text-[var(--t3)]">
                      예전 말 · <span className="font-mono">{t.aka.join(' · ')}</span>
                    </dd>
                  ) : null}
                </div>
              ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
