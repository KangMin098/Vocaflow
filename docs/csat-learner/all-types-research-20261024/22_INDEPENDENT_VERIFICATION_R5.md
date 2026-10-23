# 독립 검증 R5 — 0e36138e3 (feat/lecture-learner-control)

검증자: 읽기 전용 독립 검증자(작성 코드 없음). 대상 `git show 0e36138e3`, 범위 `main...0e36138e3`.

## 판정: ACCEPT (검증 가능 범위 안에서 HEAD 0e36138e3 코드 정확)

## R4 지적 처리
- **P2-4 해소** — 줄 조건이 `lec && status !== 'idle'`에서 `lec && lectureStarted`로 바뀌었다(AnalysisTheater.tsx:1030). `lectureStarted`는 `lec.status === 'playing'`일 때만 true가 된다(:854-857). 탭 `load()` 경로(:873, idle→loading→idle)는 playing을 거치지 않으므로 줄을 만들지 않는다.
- **P2-5 해소** — 첫 재생 전에 불러오기가 실패하면(error) playing에 닿지 않아 줄이 없다. 재생한 뒤에 오류가 나면 줄은 남는다. 이는 "시작 뒤에는 같은 자리에 남는다"는 설계와 일치한다.

## 초기화(문항 전환)
- page.tsx:372 `<LectureStage key={item.id} …>`가 theater를 감싼다. 문항이 바뀌면 key가 바뀌어 하위 AnalysisTheater가 다시 마운트되고 `lectureStarted`는 false로 돌아간다. 동적 세그먼트 slug가 바뀌어도 페이지가 다시 마운트된다. 문항 사이에 값이 새지 않는다.

## React 정확성
- `useState` + `useEffect([lec?.status])`. 훅은 조건 없이 호출된다(조기 반환보다 앞, 기존 훅 순서 안). 값은 false→true로 한 번만 바뀌어 루프가 없다. eslint(react-hooks)를 통과했다.
- 작은 점(P3, 결함 아님): 줄은 클릭 직후가 아니라 loading→playing 때 생긴다. 즉 대본 불러오기 시간만큼 늦게 한 번 끼어든다. 학습자 동작에 따른 결과이고 한 번뿐이다. effect라서 한 프레임 늦게 렌더되는데, 이를 피하려면 렌더 중 파생하면 된다. 선택 사항이다.

## 강의만으로 바뀌는 것(학습자 동작 없이)
- 장면·스크롤·레이어·선택: 이번 diff는 바꾸지 않는다. 자동 이동은 기존처럼 `following`일 때만 일어난다(:878).
- 레이아웃: 줄은 재생 시작 뒤에만 생기고 이후 그대로 남는다. 강의 진행·종료·오류로는 끼었다 빠지지 않는다.
- 포커스: 다른 장면 보기 단추를 누르면 `offerRef`로 포커스가 간다(R4 확인). 줄이 유지되므로 포커스 대상도 유효하다.
- `aria-live` 문구는 `lectureElsewhere`가 바뀔 때 갱신된다(강의 진행이 원인인 낭독이지만 R3/R4에서 의도된 알림으로 수용됨).

## R1–R4 잔여
- 코드상 열린 P0/P1/P2: **없음**. R4의 P2-1~P2-3은 해소, P2-4·P2-5는 이번 커밋으로 해소.
- 열린 항목은 검증 공백 하나다. AnalysisTheater 실화면(스크롤·포커스·장면 전환·낭독)을 실계정 E2E로 확인하지 못했다(BLOCKED_AUTH).

## 실행 결과 (apps/web, HEAD 0e36138e3)
- `pnpm exec tsc --noEmit -p .` → exit 0
- `pnpm exec eslint AnalysisTheater.tsx LectureStage.tsx` → exit 0
- `vitest run theater-delivery-guard.test.ts` → 1 file, 9/9 pass
- LectureStage 하네스(scratch 복사본) → 32/32 pass. LectureStage 단위만 다루며 로그인 화면 검증이 아니다.

## 검증하지 못한 것
- 실계정 AnalysisTheater E2E: BLOCKED_AUTH(자격 증명 없음, 우회 시도 없음). 안내 줄 동작은 코드를 읽고 추론한 결과다.
