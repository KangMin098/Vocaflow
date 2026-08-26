// apps/web/src/app/__tests__/landing-contract.test.ts
//
// **랜딩은 서버에서 그려져야 한다** — 검색이 도착하는 유일한 정문이기 때문이다.
//
// 2026-08-26 이전 이 자리에는 개발용 화면 인덱스가 있었다(`'use client'`, 307줄).
// sitemap 은 같은 경로를 **priority 1.0** 으로 광고하고 있었고, 같은 날 콘텐츠 상세 123개를
// sitemap 에 올렸으니 **문 132개가 전부 개발자용 인덱스를 가리키던** 셈이다.
// 게다가 클라이언트 컴포넌트라 초기 HTML 에 읽을 내용이 거의 없었다.
//
// 그래서 이 파일은 "랜딩이 예쁜가" 가 아니라 **크롤러가 볼 것이 있는가**를 지킨다.
// 누군가 이 자리를 다시 클라이언트 화면으로 바꾸면 아무 에러 없이 검색만 조용히 죽는다.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const LANDING = join(process.cwd(), 'src', 'app', 'page.tsx')
const source = readFileSync(LANDING, 'utf8')

describe('랜딩 계약', () => {
  it("서버 컴포넌트다 — 'use client' 면 초기 HTML 에 읽을 내용이 남지 않는다", () => {
    const firstLines = source.split('\n').slice(0, 40).join('\n')
    expect(firstLines).not.toMatch(/^\s*'use client'/m)
  })

  it('metadata 를 내보낸다 — 제목이 없으면 검색 결과에서 이름이 없다', () => {
    expect(source).toMatch(/export const metadata/)
    expect(source).toMatch(/canonical/)
  })

  it('가입 전에 가치를 보여주는 화면(/fit)으로 가는 길이 있다', () => {
    // 교사 채널(CAC 0)의 전제다 — 로그인 없이 써 볼 수 있어야 교사가 반 아이들에게 권한다.
    expect(source).toMatch(/href="\/fit"/)
  })

  it('지어낸 신뢰 지표를 걸지 않는다 — 이용자 수·평점·도입 기관', () => {
    // 2026-08-16 진단에서 /pricing 이 "학습자 12,000+ / 평점 4.8 / 학교 34곳" 을 걸고 있었다.
    // 같은 시각 실측은 3 / 0 / 0. 표시광고법이 정면으로 다루는 항목이라 랜딩에도 못 박는다.
    const code = source
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n')
    expect(code).not.toMatch(/평점\s*[0-9]/)
    expect(code).not.toMatch(/학습자\s*[0-9][0-9,]*\s*\+/)
    expect(code).not.toMatch(/학교\s*[0-9][0-9,]*\s*곳/)
  })

  it('수치를 소스에 적지 않는다 — 서버가 DB 에서 읽어야 한다', () => {
    expect(source).toMatch(/fetchTrustSignals/)
  })
})
