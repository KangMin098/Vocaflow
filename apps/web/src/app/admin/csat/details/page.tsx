// apps/web/src/app/admin/csat/details/page.tsx
//
// 교재 공장 — **숫자로 자세히 (운영자용 현황판).**
//
// ── 왜 `/admin/csat` 에서 내려왔나 (2026-09-24) ──────────────────────
// 이 화면은 공장의 첫 화면이었다. 그런데 첫 줄부터 「게이트 · 청크 · 밴드 · 드레인」과 터미널 명령이라,
// 처음 온 사람은 「교재 한 권이 어떻게 만들어지는가」를 읽어 내지 못했다. 첫 화면은 쉬운 말로 된
// **공장 지도**(`../page.tsx`)가 맡고, 이 화면은 눈금 · 명령 · 자유도 · 권별 제작 단계를 그대로 들고
// 한 칸 아래로 내려왔다. 지운 것은 없다 — 지도 맨 아래 「숫자로 자세히 보기」가 여기로 온다.
//
// 이 자리는 오래 「기출 분석 조회 표 세 개」였다. 표는 "지금 몇 개인가" 에는 답하지만
// **"다음에 무엇을 돌려야 하는가"** 에는 답하지 않아서, 관리자는 화면을 보고도 터미널로 가
// 스크립트 197개(csat 131 · textbook 66)를 뒤져야 했다. 기출 표는 `/admin/csat/evidence` 로
// 옮겼고 — 그것은 공정 ①이지 공장 전체가 아니다 — 이 자리에는 공정 8칸이 선다.
//
// 조작 버튼은 여전히 없다. 교재 생성은 사전·재고 전체를 훑는 일이라 웹 요청 시간 안에 안 끝난다.
// 대신 **각 공정이 다음에 돌릴 명령을 그대로 들고 있다** — 그것이 이 화면이 파이프라인인 방식이다.

import Link from 'next/link'

import { FreedomPanel } from '@/components/admin/textbook/FreedomPanel'
import { TextbookProductionPanel } from '@/components/admin/textbook/TextbookProductionPanel'
import { requireAdmin } from '@/lib/auth/require-admin'
import { loadFactoryLine } from '@/lib/csat/factory'
import { loadFreedomView } from '@/lib/textbook/freedom-load'
import { measureProduction } from '@/lib/textbook/production-stages'
import { fetchTextbookShelf } from '@/lib/textbook/shelf-query'

import { FactoryLineClient } from '../FactoryLineClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatDetailsPage() {
  await requireAdmin('/admin/csat/details')
  // ⚠️ 둘을 **같이** 기다린다 — 순서대로 걸면 서가 조회(재고 전량 집계)가 공정 조회 뒤에
  //    붙어 첫 픽셀이 그만큼 늦는다.
  //    자유도도 같은 물결에 싣는다 — 공정 ⑤·⑥과 **같은 집계표**를 읽으므로 한 화면이 한 시점의
  //    재고를 말한다(예전에는 저장소 스냅샷을 읽어 공정보다 38,421문항 낡아 있었다 · 2026-09-16).
  const [line, shelf, freedom] = await Promise.all([
    loadFactoryLine(),
    fetchTextbookShelf(),
    loadFreedomView(),
  ])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link
          href="/admin/csat"
          className="inline-flex min-h-[44px] w-fit items-center font-display text-[12.5px] font-[700] text-[var(--admin)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin)]"
        >
          ← 공장 지도로
        </Link>
        <h2 className="font-display text-[18px] font-[800] text-[var(--t1)]">숫자로 자세히</h2>
        <p className="break-keep font-body text-[12.5px] text-[var(--t2)]">
          운영자용이에요. 걸음마다 재는 숫자와 터미널에서 돌릴 실행 줄을 그대로 보여 줘요.
        </p>
      </div>
      <FactoryLineClient stages={line.stages} loadError={line.loadError} />
      {/* ⚠️ **자유도가 제작 단계보다 위에 있다.** 아래 패널은 밴드마다 60문항 **한 권**을
          재고 전 밴드 초록을 띄우는데, 실측(2026-09-15)으로 V2·V7 은 겹치지 않는 권을
          하나밖에 못 낸다. 한 권만 보는 잣대는 그 사실을 구조적으로 못 본다 — 먼저 읽히는
          자리에 "한 권은 된다" 를 두면 관리자가 거기서 멈춘다. 재고는 공정 ⑤·⑥과 같은
          집계표(30분 갱신)에서 온다 — 조회 1회 · 약 1.2초. */}
      <FreedomPanel view={freedom} />
      {/* 공정 8칸은 **우리 화면·큐**의 상태다. 그 아래 이 패널은 **권마다** 어디까지 왔고
          지금 누구 차례인가를 말한다 — 축이 다르므로 한 화면에 둘 다 있어야 한다. */}
      <TextbookProductionPanel report={measureProduction(shelf.volumes)} />
    </div>
  )
}
