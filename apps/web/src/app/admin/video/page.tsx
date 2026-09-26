// apps/web/src/app/admin/video/page.tsx
//
// **영상 공장 콘솔 (VFP)** — 플랫폼 PR 영상이 어디까지 왔는지 보는 곳.
//
// 왜 "조작" 이 아니라 "관측 + 다음 명령" 인가:
//   렌더는 헤드리스 크롬을 띄워 프레임을 한 장씩 찍는다(186편 · 약 90분 · 177MB).
//   서버리스 런타임에서 돌릴 수 있는 일이 아니고, 돌릴 수 있게 만들어도 **관리자가
//   기다릴 수 있는 시간이 아니다.** 그래서 이 저장소의 다른 드레인과 같은 모양을 쓴다 —
//   화면은 **무엇이 밀렸는지**를 보여 주고, 실행할 명령을 그대로 건넨다.
//
// 화면이 답하는 세 질문:
//   ① 플랫폼 구성요소 중 영상이 없는 것은 무엇인가 (= 다음에 찍을 것)
//   ② 발행했다고 적혔는데 파일이 없는 것은 무엇인가 (= 화면에서 깨지는 것)
//   ③ 어떤 영상이 실제로 보이고 있는가 (= 더 만들 것을 정하는 근거)
//   ④ 영상에 박힌 수가 지금과 얼마나 다른가 (= 다시 찍을지 정하는 근거)
//   ⑤ 어느 편이 어느 단계에 있고 **무엇이 실패했는가** (= 큐. 파일이 아니라 기록이 말한다)
//   ⑥ 다음에 무엇을 찍어야 하는가 (= **기획**. 설계도 규칙이 아직 없는 후보까지 센다)
//   ⑦ 찍은 것이 규격 안인가 (= **평가**. 외부에 공개된 규격이 있는 축만 판정한다)

import type { Metadata } from 'next'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  evidenceDrift,
  loadEvaluation,
  loadJobQueue,
  loadPlan,
  loadVideoConsole,
} from '@/lib/admin/video-console'
import { loadRequestBoard, type RequestBoard } from '@/lib/admin/video-requests'

import type { RequestPrefill } from './RequestsPanel'

import { VideoConsoleClient } from './VideoConsoleClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: '영상 공장' }

/**
 * 「교체 요청」 링크(`?replace=<id>`) → 요청 폼에 채울 값.
 * 분야는 대상 종류를 품은 첫 분야, 요청 편이면 그 요청의 분야. 못 찾으면 null(폼은 비어서 뜬다).
 */
function replacePrefill(board: RequestBoard, id: string | undefined): RequestPrefill | null {
  if (!id) return null
  const target = board.targets.find((t) => t.key === id)
  if (target) {
    const domain = board.domains.find((d) => d.enabled && d.target_kinds.includes(target.kind))
    return domain ? { domainId: domain.id, targetKey: id, targetLabel: target.label, mode: 'replace' } : null
  }
  const req = board.requests.find((r) => r.video_id === id)
  return req ? { domainId: req.domain_id, targetKey: id, targetLabel: req.target_label, mode: 'replace' } : null
}

export default async function AdminVideoPage({
  searchParams,
}: {
  searchParams: { replace?: string }
}) {
  await requireAdmin('/admin/video')

  const db = createAdminClient()
  const [console_, drift, queue, evaluation, plan] = await Promise.all([
    loadVideoConsole(db),
    evidenceDrift(db),
    loadJobQueue(db),
    loadEvaluation(db),
    loadPlan(db),
  ])
  // 요청 대상은 기획 보드와 같은 출처 — 그래서 plan 을 받은 뒤에 읽는다
  const requests = await loadRequestBoard(db as never, plan)

  return (
    <VideoConsoleClient
      data={console_}
      drift={drift}
      queue={queue}
      evaluation={evaluation}
      plan={plan}
      requests={requests}
      prefill={replacePrefill(requests, searchParams.replace)}
    />
  )
}
