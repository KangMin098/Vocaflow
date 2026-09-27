// packages/library-pipeline/src/ingest-article/storyweaver-embed.test.ts
//
// **본문 URL 에 `?embed=true` 가 붙어 있는지 고정한다.**
//
// ── 왜 이 검사가 있나 (2026-09-24 실측) ──────────────────────────────
// 상류가 `/api/v1/stories/<slug>/read` 에 로그인 게이팅을 걸었다:
//   `read`            → **401** `"You are not authorized to read this story."`
//   `read?embed=true` → **200** (응답 모양 동일: `data.pages[]` · `pageType` · `html`)
//
// 그 사이 `ingestStoryweaverArticle()` 은 **한 편도 못 받고 있었다.** 재고 136편이
// 2026-09-05 에 멈춰 있던 이유가 이것이다. 어댑터가 오류를 던지긴 했지만(조용한 실패는
// 아니었다) **아무도 안 돌려서** 몰랐다.
//
// ⚠️ 이 검사는 **네트워크를 타지 않는다.** 상류 상태를 검사할 수는 없고(그건 CI 를
//    상류 장애에 묶는다), 대신 **요구사항이 코드에 남아 있는지**를 고정한다.
//    다음 사람이 「쿼리가 지저분하다」며 지우면 여기서 걸린다.
//
// 상류가 게이팅을 풀어 `?embed=true` 가 불필요해지면, **실측을 남기고** 이 검사를 지운다.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = readFileSync(join(__dirname, 'storyweaver.ts'), 'utf8')

describe('StoryWeaver 어댑터 — 본문 경로', () => {
  it('본문 요청에 `?embed=true` 가 붙어 있다', () => {
    const call = SRC.match(/fetchWithTimeout\(`\$\{API\}\/stories\/\$\{slug\}\/read([^`]*)`\)/)
    expect(call, '본문 요청 줄을 못 찾았다 — 경로가 바뀌었으면 이 검사도 고쳐라').toBeTruthy()
    expect(
      call?.[1],
      '`?embed=true` 가 없다. 그대로 두면 상류가 401 을 내고 한 편도 못 받는다 (2026-09-24 실측)',
    ).toContain('embed=true')
  })

  it('왜 필요한지가 코드에 적혀 있다', () => {
    // 이유 없는 쿼리 문자열은 다음 사람이 지운다. 실측 근거를 파일 안에 둔다.
    expect(SRC).toContain('401')
    expect(SRC, '`embed=true` 의 근거가 주석에 없다').toMatch(/embed=true[\s\S]{0,400}401|401[\s\S]{0,400}embed=true/)
  })
})
