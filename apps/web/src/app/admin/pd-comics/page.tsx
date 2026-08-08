// apps/web/src/app/admin/pd-comics/page.tsx
//
// PDCP Admin — 퍼블릭도메인 스캔 만화 큐. **`/admin/comic`(AI 생성 CCP)과 별도 화면.**
//
// 왜 별도인가: 단계가 다르다.
//   CCP  도서 선택 → 큐 적재 → 생성 → QC(정본 일치) → 발행
//   PDCP 취득 → 복원 → 컷분할 → 대사추출 → 검수 → 발행  + **법적 게이트**
// 한 화면에 섞으면 stepper·QC 카드·액션이 전부 분기투성이가 된다.
//
// 스키마 미적용 상태(마이그레이션 승인 전)에서도 열려야 하므로,
// 테이블 부재를 정상 상태로 보고 온보딩 안내를 띄운다.

import { BookImage } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listPdComicsAdmin, PD_STAGES, stageIndex } from '@/lib/pd-comic/queries'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'PD Comic Pipeline · Admin' }

export default async function AdminPdComicsPage() {
  await requireAdmin('/admin/pd-comics')
  const client = (await createClient()) as unknown as SupabaseClient
  const { ready, data: rows } = await listPdComicsAdmin(client)

  const counts = PD_STAGES.map((s) => ({
    ...s,
    n: rows.filter((r) => r.status === s.key).length,
  }))
  const blocked = rows.filter((r) => r.status !== 'published' && !r.pdBasis).length

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <AdminPageHeader
        icon={BookImage}
        title="PD Comic Pipeline"
        description="퍼블릭도메인 스캔 만화 — 취득·복원·컷분할·대사추출·검수·발행 (AI 생성 만화와 별도)"
      />

      {!ready ? (
        <SchemaNotReady />
      ) : (
        <>
          <section aria-label="단계별 현황" className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {counts.map((s) => (
              <div
                key={s.key}
                className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2.5"
              >
                <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t3)]">
                  {s.key}
                </p>
                <p className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="font-display text-[20px] font-[800] tabular-nums text-[var(--t1)]">{s.n}</span>
                  <span className="font-body text-[12px] text-[var(--t2)]">{s.label}</span>
                </p>
              </div>
            ))}
          </section>

          {blocked > 0 && (
            <p
              role="status"
              className="mb-4 rounded-[var(--r-md)] border border-[var(--warning)] bg-[var(--warning-light)] px-4 py-3 font-body text-[13px] text-[var(--t1)]"
            >
              <b>{blocked}건</b>이 PD 근거 미기재 상태입니다. 근거·검증자·출처URL 이 채워지기 전에는
              DB 제약이 발행을 거부합니다(저작권 사고 방지).
            </p>
          )}

          {rows.length === 0 ? (
            <EmptyQueue />
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">{r.title}</h2>
                    {r.publishedYear && (
                      <span className="font-mono text-[11px] text-[var(--t3)]">{r.publishedYear}</span>
                    )}
                    <span className="font-mono text-[11px] text-[var(--t3)]">
                      {r.sourceAdapter} · {r.sourceIdentifier}
                    </span>
                    <span className="ml-auto font-mono text-[11px] text-[var(--t2)]">{r.panelsTotal}컷</span>
                  </div>
                  <Stepper status={r.status} />
                  <p className="mt-1.5 font-body text-[12px] text-[var(--t2)]">
                    PD 근거{' '}
                    {r.pdBasis ? (
                      <b className="text-[var(--success)]">{r.pdBasis}</b>
                    ) : (
                      <b className="text-[var(--warning)]">미기재 — 발행 차단</b>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function Stepper({ status }: { status: string }) {
  const cur = stageIndex(status)
  return (
    <ol className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="파이프라인 단계">
      {PD_STAGES.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span
            className={`rounded-[var(--r-full)] px-2 py-0.5 font-mono text-[10px] font-[700] ${
              i < cur
                ? 'bg-[var(--success-light)] text-[var(--success)]'
                : i === cur
                  ? 'bg-[var(--p-light)] text-[var(--p)]'
                  : 'bg-[var(--bg2)] text-[var(--t4)]'
            }`}
          >
            {s.label}
          </span>
          {i < PD_STAGES.length - 1 && (
            <span aria-hidden className="text-[10px] text-[var(--t4)]">
              ›
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}

/** 마이그레이션 미적용 — 에러가 아니라 "아직 준비 안 됨" 상태로 안내한다. */
function SchemaNotReady() {
  return (
    <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] px-5 py-6">
      <h2 className="font-display text-[15px] font-[800] text-[var(--t1)]">스키마 미적용</h2>
      <p className="mt-1.5 font-body text-[13px] leading-relaxed text-[var(--t2)]">
        PDCP 테이블(<code>pd_comic_issues</code> · <code>pd_comic_panels</code>)이 아직 없습니다.
        승인 후 마이그레이션을 적용하면 이 화면이 큐로 바뀝니다.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-[var(--r-md)] bg-[var(--bg3)] px-3 py-2 font-mono text-[11px] text-[var(--t2)]">
        scripts/comic/pd/migration.sql
      </pre>
      <p className="mt-3 font-body text-[12px] text-[var(--t3)]">
        그 전에도 파이프라인은 CLI 로 돌려볼 수 있습니다 —{' '}
        <code className="font-mono">node scripts/comic/pd/pipeline.mjs --doctor</code> ·{' '}
        <code className="font-mono">--test</code>
      </p>
    </section>
  )
}

function EmptyQueue() {
  return (
    <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] px-5 py-8 text-center">
      <p className="font-display text-[15px] font-[700] text-[var(--t1)]">큐가 비어 있습니다</p>
      <p className="mt-1.5 font-body text-[13px] text-[var(--t2)]">
        CLI 로 소재를 취득하면 여기에 나타납니다.
      </p>
      <pre className="mx-auto mt-3 w-fit rounded-[var(--r-md)] bg-[var(--bg3)] px-3 py-2 text-left font-mono text-[11px] text-[var(--t2)]">
        {'node scripts/comic/pd/pipeline.mjs \\\n  --source internet-archive --id <식별자> --test'}
      </pre>
    </section>
  )
}
