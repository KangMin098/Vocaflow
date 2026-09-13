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

import type { Metadata } from 'next'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { evidenceDrift, loadJobQueue, loadVideoConsole } from '@/lib/admin/video-console'

import { VideoConsoleClient } from './VideoConsoleClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: '영상 공장' }

export default async function AdminVideoPage() {
  await requireAdmin('/admin/video')

  const db = createAdminClient()
  const [console_, drift, queue] = await Promise.all([
    loadVideoConsole(db),
    evidenceDrift(db),
    loadJobQueue(db),
  ])

  return <VideoConsoleClient data={console_} drift={drift} queue={queue} />
}
