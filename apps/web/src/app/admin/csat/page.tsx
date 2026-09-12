// apps/web/src/app/admin/csat/page.tsx
//
// 교재 공장 — **공정 현황판.**
//
// 이 자리는 오래 「기출 분석 조회 표 세 개」였다. 표는 "지금 몇 개인가" 에는 답하지만
// **"다음에 무엇을 돌려야 하는가"** 에는 답하지 않아서, 관리자는 화면을 보고도 터미널로 가
// 스크립트 197개(csat 131 · textbook 66)를 뒤져야 했다. 기출 표는 `/admin/csat/evidence` 로
// 옮겼고 — 그것은 공정 ①이지 공장 전체가 아니다 — 이 자리에는 공정 8칸이 선다.
//
// 조작 버튼은 여전히 없다. 교재 생성은 사전·재고 전체를 훑는 일이라 웹 요청 시간 안에 안 끝난다.
// 대신 **각 공정이 다음에 돌릴 명령을 그대로 들고 있다** — 그것이 이 화면이 파이프라인인 방식이다.

import { TextbookProductionPanel } from '@/components/admin/textbook/TextbookProductionPanel'
import { requireAdmin } from '@/lib/auth/require-admin'
import { loadFactoryLine } from '@/lib/csat/factory'
import { measureProduction } from '@/lib/textbook/production-stages'
import { fetchTextbookShelf } from '@/lib/textbook/shelf-query'

import { FactoryLineClient } from './FactoryLineClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatPage() {
  await requireAdmin('/admin/csat')
  // ⚠️ 둘을 **같이** 기다린다 — 순서대로 걸면 서가 조회(재고 전량 집계)가 공정 조회 뒤에
  //    붙어 첫 픽셀이 그만큼 늦는다.
  const [line, shelf] = await Promise.all([loadFactoryLine(), fetchTextbookShelf()])

  return (
    <div className="flex flex-col gap-4">
      <FactoryLineClient stages={line.stages} loadError={line.loadError} />
      {/* 공정 8칸은 **우리 화면·큐**의 상태다. 그 아래 이 패널은 **권마다** 어디까지 왔고
          지금 누구 차례인가를 말한다 — 축이 다르므로 한 화면에 둘 다 있어야 한다. */}
      <TextbookProductionPanel report={measureProduction(shelf.volumes)} />
    </div>
  )
}
