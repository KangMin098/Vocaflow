import Link from 'next/link'
import { Layers, ExternalLink, ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { fetchVcbCollections } from '@/lib/vcb/server/runs'

export const dynamic = 'force-dynamic'

export default async function VcbCollectionsPage() {
  const collections = await fetchVcbCollections()

  return (
    <div>
      <AdminPageHeader
        icon={Layers}
        title="발행 컬렉션"
        description="VCB 가 발행한 공용 단어장 — 8-step run 산출물 + 단어장 Studio 산출물"
        actions={
          <Link
            href="/admin/vocab/runs"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-[var(--r-md)] font-display text-sm border"
            style={{ color: 'var(--t2)', borderColor: 'var(--bd)', background: 'var(--bg)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            Runs
          </Link>
        }
      />

      <AdminScreenHelp screen="vocab-collections" className="mb-6" />

      {collections.length > 0 ? (
        <div className="flex flex-col gap-3 mt-8">
          {collections.map((c) => {
            const mismatch = c.actual_word_count !== c.word_count
            return (
              <div
                key={c.set_id}
                className="flex items-start gap-4 p-4 rounded-[var(--r-lg)] border"
                style={{ background: 'var(--bg)', borderColor: 'var(--bd)' }}
              >
                <div
                  className="w-10 h-10 rounded-[var(--r-md)] flex items-center justify-center shrink-0"
                  style={{
                    background: c.is_published ? 'var(--success-light)' : 'var(--bg3)',
                    color: c.is_published ? 'var(--success)' : 'var(--t3)',
                  }}
                >
                  {c.is_published ? <CheckCircle2 className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-semibold text-base" style={{ color: 'var(--t1)' }}>
                      {c.title}
                    </span>
                    <span
                      className="text-[11px] font-mono px-2 py-0.5 rounded-[var(--r-full)]"
                      style={{ background: 'var(--bg3)', color: 'var(--t3)' }}
                    >
                      {c.category}
                    </span>
                    <span
                      className="text-[11px] font-display font-medium px-2 py-0.5 rounded-[var(--r-full)]"
                      style={{ background: 'var(--bg2)', color: 'var(--t2)' }}
                    >
                      {c.producer === 'run' ? 'run' : 'Studio'}
                    </span>
                    <span
                      className="text-[11px] font-display font-medium px-2 py-0.5 rounded-[var(--r-full)]"
                      style={{
                        background: c.is_published ? 'var(--success-light)' : 'var(--bg2)',
                        color: c.is_published ? 'var(--success)' : 'var(--t3)',
                      }}
                    >
                      {c.is_published ? '발행됨' : '비공개'}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs flex-wrap" style={{ color: 'var(--t3)' }}>
                    <span className="font-mono">{c.slug}</span>
                    <span>·</span>
                    <span>
                      <b style={{ color: 'var(--t1)' }}>{c.actual_word_count.toLocaleString()}</b> 단어
                    </span>
                    {mismatch && (
                      <span className="inline-flex items-center gap-1 font-display" style={{ color: 'var(--warning)' }}>
                        <AlertTriangle className="w-3 h-3" />
                        캐시 {c.word_count.toLocaleString()} 불일치
                      </span>
                    )}
                    <span>·</span>
                    {c.producer === 'run' ? (
                      <Link
                        href={`/admin/vocab/runs/${c.source_run_id}`}
                        className="font-display underline-offset-2 hover:underline"
                        style={{ color: 'var(--p)' }}
                      >
                        Run #{c.source_run_id}
                      </Link>
                    ) : (
                      <Link
                        href="/admin/vocab/studio"
                        className="font-display underline-offset-2 hover:underline"
                        style={{ color: 'var(--p)' }}
                      >
                        Studio · {c.blueprint}
                      </Link>
                    )}
                  </div>
                </div>
                <Link
                  href={`/library/vocab#set-${c.set_id}`}
                  target="_blank"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-[var(--r-md)] border font-display text-sm shrink-0"
                  style={{ borderColor: 'var(--bd)', color: 'var(--p)', background: 'var(--bg)' }}
                >
                  라이브러리에서 보기
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            )
          })}
        </div>
      ) : (
        <div
          className="mt-8 rounded-[var(--r-lg)] border p-12 text-center"
          style={{ background: 'var(--bg)', borderColor: 'var(--bd)' }}
        >
          <p className="font-display text-base font-semibold m-0 mb-2" style={{ color: 'var(--t1)' }}>
            아직 발행된 컬렉션이 없습니다
          </p>
          <p className="font-body text-sm m-0" style={{ color: 'var(--t3)' }}>
            run 을 Publish 단계까지 완료하면 여기에 발행 컬렉션이 표시됩니다.
          </p>
        </div>
      )}
    </div>
  )
}
