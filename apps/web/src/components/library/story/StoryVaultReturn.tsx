// apps/web/src/components/library/story/StoryVaultReturn.tsx
//
// LCP-D5-I02 — WordVault Browse 맨 위의 작은 Story 복귀 줄(서버 렌더 · 상호작용은 링크뿐). Story 에서 **명시적으로** 온 경우에만 그려진다.
// - 공개 서가 메타로 확인한 것만 말한다(작품 제목 · n번째 단위). 단어장 내용은 본인 전체 목록이며 「이 이야기 단어 목록」이 아니다.
// - 돌아가기 = 같은 발행본 · 단위의 **첫머리**(문장 · 스크롤 위치가 아니다). 돌아가면 Story 서버가 로그인 · 발행 · 권리를 다시 확인한다.
// - 열 수 없는 발행본 · 범위 밖 단위 · 서가 조회 실패 · 지도 복귀와 섞인 주소는 각각 다른 한 줄로 안전하게 말한다(지어낸 제목 · 링크 없음).
// - 지도 복귀 줄(MapReturnBar)과 같은 자리 · 같은 모양 규칙(44px 링크 · 보이는 초점)을 쓰되 지도처럼 보이게 하지 않는다.

import Link from 'next/link'

import type { StoryReturnTarget } from '@/lib/library/story/learner'
import { storyReturnHref } from '@/lib/library/story/return-context'

const BAR = 'mx-auto mt-s-4 flex max-w-[680px] flex-wrap items-center justify-between gap-s-3 rounded-xl border border-bd bg-bg px-s-5 py-s-3'
const NOTE = 'min-w-0 break-keep font-body text-[13px] text-t2'
const LINK =
  'inline-flex min-h-[44px] items-center rounded-md bg-bg2 px-s-4 font-display text-[13px] font-semibold text-t1 no-underline transition-colors duration-normal hover:bg-bg3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'

export type StoryVaultReturnState = StoryReturnTarget | { status: 'conflict' }

export function StoryVaultReturnBar({ state }: { state: StoryVaultReturnState }) {
  if (state.status === 'conflict') {
    return (
      <div className={BAR} data-story-vault-return="conflict" role="note">
        <p className={NOTE}>돌아갈 곳 정보가 서로 섞여 있어 어느 쪽으로도 안내하지 않아요. 일반 단어장으로 열었어요.</p>
      </div>
    )
  }
  if (state.status === 'unavailable') {
    return (
      <div className={BAR} data-story-vault-return="unavailable" role="note">
        <p className={NOTE}>읽던 이야기는 지금 열 수 없어요. 단어장은 그대로 쓸 수 있어요.</p>
        <Link href="/library/stories" className={LINK} data-story-vault-return-link="catalog">
          Stories 서가로
        </Link>
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className={BAR} data-story-vault-return="error" role="note">
        <p className={NOTE}>읽던 이야기 정보를 지금 확인하지 못했어요. 돌아가면 이야기 화면이 다시 확인해요.</p>
        <Link href={storyReturnHref(state)} className={LINK} data-story-vault-return-link="story">
          Story로 돌아가기
        </Link>
      </div>
    )
  }
  if (state.status === 'bad_unit') {
    return (
      <div className={BAR} data-story-vault-return="bad_unit" role="note">
        <p className={NOTE}>
          읽던 이야기 · <span lang="en">{state.title}</span> — 그 단위를 찾을 수 없어요.
        </p>
        <Link href={`/library/stories/${encodeURIComponent(state.releaseKey)}`} className={LINK} data-story-vault-return-link="entry">
          판본 입구로
        </Link>
      </div>
    )
  }
  return (
    <div className={BAR} data-story-vault-return="ok" role="note" aria-label="읽던 이야기로 돌아가기">
      <p className={NOTE}>
        읽던 이야기 · <span lang="en">{state.title}</span> · {state.unitIndex + 1}번째 단위 <span className="text-t3">(단위 첫머리로 돌아가요)</span>
      </p>
      <Link href={storyReturnHref(state)} className={LINK} data-story-vault-return-link="story">
        Story로 돌아가기
      </Link>
    </div>
  )
}
