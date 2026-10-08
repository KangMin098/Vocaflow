// apps/web/src/app/admin/knowledge/page.tsx
// A 원리 운영실 — 탐구 → 근거 → 원리 → 설계 → 배포 → 수행 → 검증 단계마다 몇 개이고 어디서 막혔는지, 다음에 누를 곳.
// 수치는 열 때마다 DB 를 다시 센 값이다(I5). 숫자마다 그 병목을 푸는 화면 링크가 붙는다.
// 2026-10-08 vNext: 이 경로의 옛 「원리 지도」 격자는 /admin/knowledge/map 으로 옮겼다.
import Link from 'next/link'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { KnowledgeFrame, LoadFailed } from '@/components/admin/knowledge/KnowledgeFrame'
import { requireAdmin } from '@/lib/auth/require-admin'
import { LAYER_LABEL } from '@/lib/knowledge/labels'
import { DESIGN_STATUS_LABEL, INQUIRY_STATUS_LABEL, RESEARCH_LEVEL_LABEL, VERDICT_LABEL } from '@/lib/knowledge/vnext'
import { loadOpsSummary, type OpsSummary } from '@/lib/knowledge/vnext-server'

export const dynamic = 'force-dynamic'

const link =
  'inline-flex min-h-11 items-center text-sm underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]'

interface Bottleneck {
  title: string
  detail: string
  href: string
  action: string
}

/** 막힌 곳을 순서대로 — 고리의 앞쪽이 막히면 뒤쪽 숫자는 의미가 없다. */
function bottlenecks(s: OpsSummary): Bottleneck[] {
  const out: Bottleneck[] = []
  const research = s.evidenceByLevel
    .filter((e) => ['meta_analysis', 'systematic_review', 'rct', 'quasi_experimental', 'correlational'].includes(e.level))
    .reduce((a, e) => a + e.n, 0)
  if (research === 0) {
    out.push({ title: '연구 근거가 0건', detail: `근거 ${s.evidenceTotal}건이 모두 강사 주장·관찰·미평가다. 원리는 연구 서지 없이 채택하지 않는다.`, href: '/admin/knowledge/lab', action: '탐구 질문에 연구 근거 붙이기' })
  }
  const upper = s.items.filter((i) => i.layer !== 'practice')
  const upperNoEv = upper.reduce((a, i) => a + i.noEvidence, 0)
  if (upperNoEv > 0) {
    out.push({ title: `근거 없는 역량·원리·방법론 ${upperNoEv}개`, detail: '근거가 0 이면 DB 가 채택을 거부한다 — 설계를 배포할 수 없다.', href: '/admin/knowledge/map', action: '지도에서 비어 있는 노드 보기' })
  }
  if (s.principlesWithoutFacet > 0) {
    out.push({ title: `면이 없는 원리 ${s.principlesWithoutFacet}개`, detail: '언어 처리 기제인지 학습 기제인지 정하지 않으면 지도가 섞인다.', href: '/admin/knowledge/map', action: '원리 노드를 열어 면 고르기' })
  }
  const review = s.items.reduce((a, i) => a + i.needsReview, 0)
  if (review > 0) {
    out.push({ title: `사람 판정을 기다리는 항목 ${review}개`, detail: '채택은 사람만 한다. 설계에 연결된 항목부터 본다.', href: '/admin/knowledge/review', action: '검토 대기 열기' })
  }
  if (s.designs.ready + s.designs.deployed === 0) {
    out.push({ title: '배포할 수 있는 학습 설계가 없다', detail: '원리가 학습 행동이 되는 자리가 설계다.', href: '/admin/knowledge/design', action: '학습 설계 보기' })
  }
  for (const p of s.pausedByEvidence) {
    out.push({ title: `근거 변화로 멈춘 설계: ${p.title}`, detail: p.reason ?? '', href: `/admin/knowledge/design/${p.slug}`, action: '설계 열기' })
  }
  if (s.openDeployments > 0 && s.runs7d.real === 0) {
    out.push({ title: '배포 중인데 최근 7일 실학습 기록 0', detail: '학습자가 과제에 닿지 않는다 — 진입 경로를 본다.', href: '/admin/knowledge/quality', action: '제품 적용·품질 열기' })
  }
  return out
}

export default async function KnowledgeOpsPage() {
  await requireAdmin('/admin/knowledge')
  let s: OpsSummary
  try {
    // 시각은 여기서 한 번 읽어 넘긴다(로더는 시계를 직접 읽지 않는다)
    s = await loadOpsSummary(new Date())
  } catch {
    return (
      <KnowledgeFrame title="원리 운영실" question="지금 어디서 막혔고, 다음에 무엇을 하나" help={<AdminScreenHelp screen="knowledge-ops" />} back={{ href: '/admin', label: '관리자' }}>
        <LoadFailed what="학습 원리 운영 현황" href="/admin/knowledge" />
      </KnowledgeFrame>
    )
  }
  const queue = bottlenecks(s)
  const stages: { label: string; value: string; sub: string; href: string }[] = [
    { label: '탐구', value: String(Object.values(s.inquiries).reduce((a, b) => a + b, 0)), sub: `결론 ${s.inquiries.concluded} · 진행 ${s.inquiries.open + s.inquiries.collecting + s.inquiries.synthesizing}`, href: '/admin/knowledge/lab' },
    { label: '근거', value: String(s.evidenceTotal), sub: s.evidenceByLevel.slice(0, 2).map((e) => `${RESEARCH_LEVEL_LABEL[e.level]} ${e.n}`).join(' · ') || '없음', href: '/admin/knowledge/sources' },
    { label: '채택', value: String(s.items.reduce((a, i) => a + i.adopted, 0)), sub: s.items.map((i) => `${LAYER_LABEL[i.layer]} ${i.adopted}/${i.total}`).join(' · '), href: '/admin/knowledge/map' },
    { label: '설계', value: String(Object.values(s.designs).reduce((a, b) => a + b, 0)), sub: `준비 ${s.designs.ready} · ${DESIGN_STATUS_LABEL.deployed} ${s.designs.deployed} · 중단 ${s.designs.paused}`, href: '/admin/knowledge/design' },
    { label: '수행(7일)', value: String(s.runs7d.real), sub: `미리보기 ${s.runs7d.preview} · 합성 ${s.runs7d.synthetic}`, href: '/admin/knowledge/quality' },
    { label: '검증', value: String(s.latestVerdicts.filter((v) => !v.synthetic && v.verdict !== 'insufficient_data').length), sub: `판정 낸 설계 / 기록 ${s.latestVerdicts.length}`, href: '/admin/knowledge/quality' },
  ]

  return (
    <KnowledgeFrame title="원리 운영실" question="지금 어디서 막혔고, 다음에 무엇을 하나" help={<AdminScreenHelp screen="knowledge-ops" />} back={{ href: '/admin', label: '관리자' }}>
      <section aria-labelledby="loop" className="mb-10">
        <h2 id="loop" className="mb-3 text-lg font-semibold text-[var(--t1)]">고리 — 탐구에서 검증까지</h2>
        <ol className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {stages.map((st, i) => (
            <li key={st.label} className="rounded-[var(--r-lg)] border border-[var(--bd)] p-4">
              <p className="text-xs font-semibold text-[var(--t3)]">
                {i + 1} · {st.label}
              </p>
              <p className="text-2xl font-semibold tabular-nums text-[var(--t1)]">{st.value}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--t2)]">{st.sub}</p>
              <Link href={st.href} className={link}>
                열기
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="queue" className="mb-10">
        <h2 id="queue" className="mb-3 text-lg font-semibold text-[var(--t1)]">
          우선 처리 <span className="tabular-nums text-[var(--t2)]">{queue.length}</span>
        </h2>
        {queue.length === 0 ? (
          <p className="text-sm text-[var(--t2)]">막힌 곳이 없다.</p>
        ) : (
          <ol className="divide-y divide-[var(--bd)] border-y border-[var(--bd)]">
            {queue.map((q, i) => (
              <li key={q.title} className="grid gap-1 py-4 md:grid-cols-[2rem_1fr_auto] md:items-center">
                <span className="font-mono text-sm text-[var(--t3)]">{i + 1}</span>
                <div>
                  <p className="font-semibold text-[var(--t1)]">{q.title}</p>
                  <p className="text-sm text-[var(--t2)]">{q.detail}</p>
                </div>
                <Link href={q.href} className={link}>
                  {q.action}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="verdicts">
        <h2 id="verdicts" className="mb-3 text-lg font-semibold text-[var(--t1)]">최근 검증 판정</h2>
        {s.latestVerdicts.length === 0 ? (
          <p className="text-sm text-[var(--t2)]">아직 검증 실행이 없다. 실학습 기록이 쌓이면 제품 적용·품질에서 남긴다.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {s.latestVerdicts.map((v) => (
              <li key={v.designSlug}>
                <Link href={`/admin/knowledge/design/${v.designSlug}`} className={link}>
                  {v.designSlug}
                </Link>{' '}
                — {VERDICT_LABEL[v.verdict]}
                {v.synthetic ? ' (합성 — 효과 판정 아님)' : ''}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-xs text-[var(--t3)]">탐구 질문 상태: {Object.entries(s.inquiries).map(([k, n]) => `${INQUIRY_STATUS_LABEL[k as keyof typeof INQUIRY_STATUS_LABEL]} ${n}`).join(' · ')}</p>
      </section>
    </KnowledgeFrame>
  )
}
