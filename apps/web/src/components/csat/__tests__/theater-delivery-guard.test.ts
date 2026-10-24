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
    // 2026-10-24 정답 공개 경로 — 읽기 강의도 학습자가 고른 범위(full · until)만 불러온다
    expect(theater).toMatch(/lec\.load\(lecturePath\)/)
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

describe('정답 공개 경로(2026-10-24 P1~P5)', () => {
  it('재생 단추 · Space 는 경로 선택을 거친다 — 고르기 전에는 강의를 받지도 틀지도 않는다', () => {
    expect(theater).not.toMatch(/lec\.start\(cursor, 'start'\)/)
    expect(theater.match(/requestPlay\(cursor\)/g)?.length).toBeGreaterThanOrEqual(2)
    expect(theater).toMatch(/data-testid="lecture-path-self"/)
    expect(theater).toMatch(/data-testid="lecture-path-full"/)
    // 「정답 직접 안내 전까지」 는 검증된 경계가 있을 때만
    const until = theater.indexOf('data-testid="lecture-path-until"')
    expect(until).toBeGreaterThan(0)
    expect(theater.lastIndexOf('{untilOk ? (', until)).toBeGreaterThan(theater.lastIndexOf('</button>', until))
  })

  it('읽기 강의 탭도 고른 범위만 불러온다', () => {
    expect(theater).not.toMatch(/lec\.load\(\)/)
    expect(theater).toMatch(/lec\.load\(lecturePath\)/)
  })

  it('경계 정지 — 계속 · 건너뛰기 · 멈춤 · 원문을 학습자가 고르고, 경계 뒤 차례로 건너뛰지 않는다', () => {
    expect(theater).toMatch(/data-testid="lecture-boundary-continue"/)
    expect(theater).toMatch(/data-testid="lecture-boundary-stop"/)
    expect(theater).toMatch(/data-testid="lecture-boundary-skip"/)
    // 재생 · 일시정지 · 끝남 어느 상태에서도 경계 뒤 차례는 묻는다 — `playing &&` 조건이 붙으면 끝난 뒤 레일로 건너뛴다
    expect(theater).toMatch(/if \(boundaryGate\(index, answerGate\) === 'boundary'\) \{\s*pauseLecture\(\)/)
    // D6-02 — ←/→ · 이전/다음 차례(move)도 재생 중이 아니면 goto 의 경계 검사를 지난다(setCursor 로 바로 옮기지 않는다)
    const move = theater.slice(theater.indexOf('const move = '), theater.indexOf('const goto = '))
    expect(move).toMatch(/return goto\(to\)/)
    expect(move).not.toMatch(/setCursor/)
    // D6-03 — 건너뛰기는 공개 동의를 켜지 않는다(동의는 「계속 듣기(정답 공개)」 · 「정답 보기」 · 「전체(정답 포함)」 선택만)
    const skip = theater.slice(theater.indexOf('data-testid="lecture-boundary-stop"'), theater.indexOf('data-testid="lecture-boundary-skip"'))
    expect(skip).toMatch(/setBoundaryNote\('closed'\)/)
    // R3 건너뛰기 = 정답 없이 강의 마치기 — 정답 구간 이동 · 장면 · 포커스 · 스크롤 변경 없음
    expect(skip).not.toMatch(/goto\(|setScene|pickScene|\.focus\(|scrollIntoView|stopAt\)/)
    expect(theater).toMatch(/data-testid="lecture-boundary-skip"\s*>\s*정답 없이 강의 마치기/)
    expect(skip).not.toMatch(/setAnswerConsent|setLecturePath|lec\.start|setCursor/)
    // (b) — 공개 동의는 서버 판단 라우트가 노출 원장을 커밋해 공개 자료를 돌려준 뒤에만 켠다(requestReveal 안의 두 곳)
    expect(theater.match(/setAnswerConsent\(true\)/g)?.length).toBe(2)
    const reveal = theater.slice(theater.indexOf('const requestReveal = async'), theater.indexOf('const revealButton = ('))
    expect(reveal.match(/setAnswerConsent\(true\)/g)?.length).toBe(2)
    expect(reveal).toMatch(/setRevealed\(body\.reveal\)\s*setAnswerConsent\(true\)/)
    // 「계속 듣기(정답 공개)」 · 「전체(정답 포함)」 · 「정답 보기」 만 요청한다 — 마운트 효과 · prefetch 로 요청하지 않는다
    // R147-03 — 정답이 담긴 강의(전체 · 경계 계속)는 기록 성공(ok) 뒤에만 경로를 정하고 받는다
    const cont = theater.slice(theater.indexOf('const continuePastBoundary = () => {'), theater.indexOf('const move = '))
    expect(cont).toMatch(/void requestReveal\('lecture_continue'\)\.then\(\(ok\) => \{\s*if \(!ok\) return setAtBoundary\(true\)\s*setLecturePath\('full'\)\s*if \(lec && stopAt != null\) lec\.start\(stopAt, 'start', 'full'\)/)
    const choose = theater.slice(theater.indexOf('const choosePath = '), theater.indexOf('const continuePastBoundary = () => {'))
    expect(choose).toMatch(/void requestReveal\('lecture_full'\)\.then\(\(ok\) => \{\s*if \(!ok\) return setChooser\([^)]*\)\s*setLecturePath\('full'\)\s*lec\?\.start\(from, 'start', 'full'\)/)
    expect(choose.match(/'start', 'full'\)/g)?.length).toBe(1)
    expect(theater).toMatch(/onClick=\{\(\) => void requestReveal\('judgment_scene'\)\}/)
    // 호출은 위 세 곳뿐 — 효과(useEffect) 안에서 부르지 않는다
    expect(theater.match(/requestReveal\(/g)?.length).toBe(3)
    expect(theater).not.toMatch(/useEffect\(\(\) => \{[^}]*requestReveal/)
    // 받은 공개 자료는 컴포넌트 상태에만 — 저장소에 쓰지 않는다(기존 REVEAL_KEY 는 공개 시각 기록 재전송 대기열이고 정답 자료가 아니다)
    expect(reveal).not.toMatch(/setItem|localStorage|sessionStorage|indexedDB/)
    expect(theater).not.toMatch(/setItem\([^)]*(revealed|body\.reveal)/)
    // r4 R4-02 — 강의 오류로 경로가 풀려도 감춤은 남는다(감춤은 경로가 아니라 answerHide 로 정한다)
    expect(theater).toMatch(/hideAnswer: answerHide/)
    const onError = theater.slice(theater.indexOf("if (lec.status === 'error') {"), theater.indexOf("if (lec.status === 'ended') setAtBoundary(true)"))
    expect(onError).not.toMatch(/setAnswerHide\(false\)|setAnswerConsent/)
    // r4 R4-01 · R4-03 — 판단 · 오답 설계 · 이해 확인 · 비교 패널도 동의 전에는 자리표시
    for (const id of ['judgment', 'distractors', 'checks', 'compare']) expect(theater).toContain(`withheldPanel('${id}'`)
    expect(theater).toMatch(/scene === 'judgment' && v3 && !withheld \? <V3Judgment/)
    expect(theater).toMatch(/sceneChecks\.length && !withheld \? \(\s*<UnderstandingChecks/)
    expect(theater).toMatch(/scene === 'compare' && !withheld \? \(\s*<V3CompareExplorer/)
    expect(theater).toMatch(/withheld \? withheldPanel\('distractors', '오답 설계'\) : <DistractorDesign/)
    // r6 R6-01 — 저장된 예측 대조 카드 · 완료 카드 채점도 동의 전에는 없다
    // (b) — 대조 · 채점은 서버가 정답을 돌려준(revealed) 뒤에만
    expect(theater).toMatch(/const diff = mine && !withheld && revealed \? <GateDiff/)
    expect(theater).toMatch(/result=\{committed && !isSkipPrediction\(committed\) && mine && !withheld && revealed \? grade/)
    // r5 R5-01~03 — 동의 전 장면은 허용 목록(유형 단위 탐구 질문 + 자리표시)만. 지도 · 설계 · 원리 · 정리 · 과제는 그 분기 밖
    const allow = theater.slice(theater.indexOf("withheldPanel('scene'") - 600, theater.indexOf("withheldPanel('scene'") + 200)
    for (const c of ['<PassageMap', '<V3Design', '<V3Task', '<V3Meaning', '<PrincipleDesign', '<SystemLearningSummary', 'renderBlock']) expect(allow).not.toContain(c)
    expect(theater).toMatch(/\{withheld \? \(\s*<p className=\{styles\.quiet\} data-testid="map-withheld">[\s\S]*?\) : showRelation \? \(\s*relation\s*\) : map \? \(\s*<PassageMap/)
    // 일시정지에서 toggle 하면 다시 튼다 — 경계 처리 · 멈춤 · 건너뛰기 · 원문은 재생 중일 때만 멈추는 pauseLecture 를 쓴다(T-0140 Codex r2)
    const boundary = theater.slice(theater.indexOf('data-testid="lecture-boundary"'), theater.indexOf('data-testid="lecture-boundary-self"'))
    expect(boundary.match(/pauseLecture\(\)/g)?.length).toBe(3)
    expect(theater).toMatch(/const pauseLecture = \(\) => \{[^}]*if \(lec\?\.status === 'playing'\) lec\.toggle\(\)/)
  })

  it('레일 차례는 오답 소거 번호를 지운 채 서버가 넘긴다 · 경계는 결속 확인을 거친다', () => {
    expect(page).toMatch(/maskDisclosureSteps\(theaterSteps\(outline\)\)/)
    // (b) — 페이지는 정답 자료를 서버 로더의 첫 응답(initial)으로만 넘긴다. 정답 번호 · 앵커 · 확인 과제를 직접 만들지 않는다
    expect(page).toMatch(/await loadTheaterAnswer\(item\)/)
    for (const p of ['blocks={initial.blocks}', 'checks={initial.checks}', 'comparePairs={initial.comparePairs}', 'v3Pairs={initial.v3Pairs}', 'inquiry={initial.inquiry}', 'gate={initial.gate}'])
      expect(page).toContain(p)
    expect(page).not.toMatch(/theaterBlocks\(|buildChecks\(|item\.why_correct|item\.answer\b|loaded\.reveal|\.reveal\b/)
    expect(page).toMatch(/lectureDisclosure\(item\.id, loadLecture\(item\.id\)\)/)
  })
})
