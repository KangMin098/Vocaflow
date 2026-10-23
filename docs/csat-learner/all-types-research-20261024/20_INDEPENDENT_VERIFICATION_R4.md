# 독립 검증 R4 — 2bd99a0f1 (lecture-learner-control)

검증자: 독립 읽기 전용(작성 코드 없음) · 2026-10-24 · 워크트리 `D:/workspace/Vocaflow-lecture-learner-control`

## 판정: PARTIAL

R3 세 건은 의도대로 고쳐졌지만, 새 렌더 조건 `lec && status !== 'idle'`이 `loading`·`error` 상태도 포함해 학습자가 강의를 시작하지 않았는데 안내 줄이 생겼다 사라지는 경로가 새로 생겼다.

## 실행 결과(HEAD 2bd99a0f1)

| 검사 | 결과 |
|---|---|
| `tsc --noEmit -p .` | exit 0 |
| eslint(AnalysisTheater.tsx, LectureStage.tsx) | exit 0 |
| vitest theater-delivery-guard | 9/9 통과 |
| LectureStage 하네스(build+run, 별도 scratch) | 32/32 통과 |

## R3 해소 확인

- P2-1: 종료(`ended`) 뒤에도 줄이 남는다. 처음부터 다시 시작해도 `start()`는 `setFollowing(true)`만 하고 줄은 유지되어 이동이 없다. **해소**
- P2-2: 라벨은 「설명 위치 따라가기」로 고정되고 상태는 `aria-pressed`로만 표시된다. **해소**
- P2-3: `aria-live` 영역이 `lec`가 있으면 줄 바깥에 늘 있다(AnalysisTheater.tsx:1051-1056). 내용은 `lectureElsewhere`(:849-850, playing/paused 상태에서 장면이 다를 때만)에서 나오므로 장면이 바뀔 때만 갱신된다. ended가 되면 빈 문자열이 되어 읽지 않는다. **해소**

## 새 발견

### P2-4 — 읽기 강의 탭을 열 때 안내 줄이 깜박이며 본문을 민다(강의가 원인인 레이아웃 이동)
- AnalysisTheater.tsx:867: 탭이 `script`이면 `lec.load()`가 호출된다. 이어 LectureStage.tsx:155에서 `setStatus('loading')`이 되어 :1024 조건이 참이 되고, 56px 줄이 삽입된다. 불러오기가 끝나면 LectureStage.tsx:225에서 `loading → idle`로 돌아가 줄이 **비동기로 사라진다**.
- 탭 전환은 학습자 동작이지만, 줄이 사라지는 것은 강의 불러오기의 결과다. 강의를 재생하지 않았는데 본문이 두 번 밀린다. 목표인 "학습자 동작 없이 레이아웃을 바꾸지 않는다"에 어긋난다.
- 첫 재생(idle→loading)에서는 줄이 학습자 클릭 직후에 생기므로 문제가 없다.

### P2-5 — `error` 상태에서도 줄이 남아 쓸모없는 따라가기 단추만 보인다
- 불러오기 실패(LectureStage.tsx:191) 뒤 `status==='error'`이면 :1024에 따라 줄이 계속 보인다. 이때 따라가기 토글은 아무 효과가 없고, 다시 시작하면(:1014 `lec.start`) `loading`으로 바뀐다. 레이아웃 이동은 없지만 의미 없는 컨트롤이 노출된다.
- 제안: 조건을 "학습자가 재생을 시작한 적 있음"(예: `started` ref/state 또는 `status ∈ {playing, paused, ended}` + 시작 후 loading)으로 좁힌다. 탭 `load()` 경로는 줄을 만들지 않아야 한다.

### 그 밖
- 훅 규칙 위반이나 새 a11y 회귀는 찾지 못했다. 다른 장면 보기 단추를 누르면 그 단추가 사라지므로 포커스를 `offerRef`로 옮긴다(:1042). 줄이 유지되므로 포커스 대상도 유효하다.
- P0/P1: 없음.

## 검증하지 못한 것(BLOCKED_AUTH)
- 실계정 E2E와 AnalysisTheater 전체 화면(실제 스크롤·포커스·장면 전환·스크린리더 낭독)은 인증이 필요해 실행하지 않았다. 인증 우회는 시도하지 않았다. 위 P2-4·P2-5는 코드를 읽고 추론한 결과이며 화면에서 재현하지 않았다. 하네스는 LectureStage 단위만 다루고 AnalysisTheater의 안내 줄 렌더는 다루지 않는다.
