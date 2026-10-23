// apps/web/src/components/csat/__tests__/theater-delivery-guard.test.ts
//
// 해설 극장의 전달 계약(2026-10-10 · F01 · F03 · F04 · F12 · F13) — 이 화면은 문제를 푸는 곳이 아니라
// 출제 설계를 읽는 곳이다. 기존 테스트 1,781개가 모두 통과하는 동안 아래 넷이 깨져 있었다:
//   F01 근거 · 정답 · 확신도를 확정해야 해설이 열렸다(PredictGate)
//   F03 블록이 강의 큐가 가리켜야 열렸다(hidden={!shownOpen.has(...)}) — 큐가 안 가리키는 블록은 영영 닫혔다
//   F12 ←/→ 를 극장과 강의 무대가 둘 다 받아 두 칸씩 갔다 · 멈춤 상태에서 본문을 누르면 소리가 다시 났다
//   F13 앞 차례 추정 초의 합을 「지난 시간」이라 불렀다
// 컴포넌트 전체를 띄우려면 IndexedDB · 강의 API · Supabase 를 다 흉내내야 해서, 계약을 소스에서 지킨다.
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '../../..')
const read = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf8')
const theater = read('components/csat/theater/AnalysisTheater.tsx')
const stage = read('components/csat/lecture/LectureStage.tsx')
const page = read('app/(app)/csat/item/[slug]/page.tsx')

describe('해설 극장 전달 계약', () => {
  it('F01 — 학습용 예측 관문을 그리지 않는다(보류 관문은 page 의 embargo 가 따로 맡는다)', () => {
    expect(theater).not.toMatch(/<PredictGate\b/)
    expect(theater).not.toMatch(/disabled=\{!revealed\}/)
    expect(page).toMatch(/canRevealItem|held/)
  })

  it('F03 — 분석 블록을 차례로 여닫지 않는다', () => {
    expect(theater).not.toMatch(/hidden=\{!shownOpen/)
    expect(theater).not.toMatch(/OPEN_BEFORE_COMMIT/)
  })

  it('F04 — 같은 대상의 요소를 모두 켠다(첫 DOM 요소만 잡지 않는다)', () => {
    expect(stage).not.toMatch(/all\.find\(\(el\) => el\.dataset\.lectureTarget === activeKey\)/)
    expect(stage).toMatch(/const targets = all\.filter/)
  })

  it('F12 — 학습자 화면의 전역 키 소유자는 극장 하나다', () => {
    expect(page).toMatch(/<LectureStage[^>]*keys=\{false\}/)
    expect(stage).toMatch(/if \(!keys\) return/)
    expect(theater).toMatch(/e\.key === ' '/)
  })

  it('F12 — 재생 중이 아닐 때 본문 클릭은 소리를 내지 않는다 · 텍스트 선택은 읽기다', () => {
    expect(stage).toMatch(/getState\(\)\.status !== 'playing'/)
    expect(stage).toMatch(/getSelection\(\)/)
  })

  it('F13 — 추정 위치를 「지난 시간」이라 부르지 않는다 · 완주는 들은 큐로 센다', () => {
    expect(theater).not.toMatch(/지난 시간|지남/)
    expect(stage).toMatch(/complete: cues\.length > 0 && heard\.current\.size >= cues\.length/)
  })
})

describe('읽기 강의(M2 · 2026-10-10)', () => {
  it('음성 없이도 같은 대본을 읽는 탭이 있고, 대본은 강의 API 응답에서만 온다(서버 초기 HTML 에 없음)', () => {
    expect(theater).toMatch(/id: 'script', label: '읽기 강의'/)
    expect(theater).toMatch(/lec\.load\(\)/)
    expect(stage).toMatch(/text: c\.segments\.map/)
    // page(서버)는 대본을 넘기지 않는다 — 개요(역할 · 타깃)만
    expect(page).not.toMatch(/segments/)
  })
})

describe('강의 학습자 제어(2026-10-24 사용자 결정 1·3)', () => {
  it('강의 진행이 장면을 저절로 바꾸지 않는다 — 장면을 바꾸면 고른 의미 · 구절이 지워진다. 옮기는 것은 안내 단추(학습자 선택)뿐', () => {
    expect(theater).not.toMatch(/selectScene\(target, 'replace'\)/)
    expect(theater).not.toMatch(/useEffect\(\(\) => \{[^}]*lec\?\.status !== 'playing'[^}]*selectScene/)
    expect(theater).toMatch(/data-testid="lecture-offer-scene"[^>]*|onClick=\{\(\) => selectScene\(lectureElsewhere\.id\)\}/)
  })

  it('학습자가 스크롤하면 따라가기가 꺼지고, 강의는 따라가기 중에만 화면을 옮긴다', () => {
    expect(stage).toMatch(/if \(!active \|\| !following\) return/)
    expect(stage).toMatch(/addEventListener\('wheel', stop/)
    // 접힌 층을 여는 것도 따라가기 중에만 — 학습자가 닫아 둔 층을 강의가 다시 열지 않는다
    expect(stage).toMatch(/if \(active && following\) \{/)
    expect(stage).toMatch(/following,\s*follow,/)
    expect(theater).toMatch(/data-testid="lecture-offer-follow"/)
    expect(theater).toMatch(/lec\?\.status === 'playing' && !lec\.following\) return/)
  })
})
