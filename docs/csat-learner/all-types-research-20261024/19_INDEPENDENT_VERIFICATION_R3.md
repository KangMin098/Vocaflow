# 19 · 독립 검증 R3 — learner-control 6f7fbe1ce

- 대상: `D:/workspace/Vocaflow-lecture-learner-control` 커밋 `6f7fbe1ce` (18_R2 의 P2-c · P2-d · P2-e 대응)
- 검증자: 읽기 전용 독립 검증(작성 코드 없음) · 2026-10-24
- 판정: **PARTIAL** — P0/P1 없음. 통합 차단 결함은 없으나 P2 4건이 남고, 안내 줄(AnalysisTheater) 동작은 하네스·실행된 테스트 어디에도 검증되지 않았다.

## 재실행 결과

| 검사 | 결과 |
|---|---|
| `pnpm exec tsc --noEmit -p .` | exit 0 |
| `eslint AnalysisTheater.tsx LectureStage.tsx` | 출력 없음(통과) |
| `vitest run theater-delivery-guard.test.ts` | 9/9 통과 |
| 하네스(scratch 복사본에서 재빌드·실행) | 32/32 통과 |
| 실계정 E2E `csat-lecture-learner-control.spec.ts` | **BLOCKED**(계정 없음, 우회 시도 안 함) |

## 점검 항목

1. **hooks 규칙** — `offerRef = useRef` (AnalysisTheater.tsx:851)보다 앞(192–851)에 컴포넌트 수준의 조건부 early return 없음. 그 사이 `return` 은 모두 effect·콜백 내부. 통과.
2. **고정 높이 안내 줄** — 재생/일시정지 동안 항상 렌더 + `min-height:56px` 로 장면 갈림에 따른 밀림(P2-c)은 해소. 다만 아래 P2-1.
3. **토글** — `aria-pressed` + 라벨 교체(AnalysisTheater.tsx:1031) → P2-2.
4. **장면 이동 뒤 포커스** — `tabIndex=-1` 컨테이너에 `focus()` + `:focus-visible` 외곽선(theater.module.css:95). 누른 단추가 사라져도 포커스가 body 로 빠지지 않음. 통과(E2E 단언 추가됨, 미실행).
5. **aria-live** — 장면이 갈릴 때만 문구가 바뀜. 단 P2-3.
6. **unfollow** — `useCallback(() => setFollowing(false), [])` (LectureStage.tsx:356), ctx 의존성 배열에 포함. 정확.
7. **E2E 스펙** — `toBeHidden` → `aria-pressed` 'false'/'true' + `toBeFocused` 로 일관되게 갱신(spec:72–101). 실행은 BLOCKED.

## 발견

- **P2-1 (레이아웃 · 학습자 동작 아닌 변화)** AnalysisTheater.tsx:1023 — 줄의 존재 조건이 `status === 'playing' || 'paused'`. idle→playing 삽입은 학습자의 재생 동작이라 허용 가능하나, **강의가 끝나 `ended` 가 되면 56px 줄이 사라져 본문이 위로 밀린다**(학습자 동작 없음). 그 순간 포커스가 줄 안에 있었으면 body 로 잃는다. 목표 "강의가 레이아웃·포커스를 바꾸지 않음"의 잔여 위반. 대안: `ended` 에도 줄 유지(빈 상태/다시 듣기) 또는 공간 예약.
- **P2-2 (a11y 안티패턴)** AnalysisTheater.tsx:1028–1033 — 토글 단추에 `aria-pressed` 를 쓰면서 라벨도 바꿈(「지금 설명 위치로」↔「…따라가는 중 · 끄기」). 스크린리더가 "따라가는 중·끄기, 눌림"처럼 이중 상태를 읽는다. 라벨 고정(예: 「설명 위치 따라가기」) + `aria-pressed`, 또는 라벨 교체 + `aria-pressed` 제거 중 하나로.
- **P2-3 (낭독 누락 가능)** AnalysisTheater.tsx:1049 — live region 이 조건부로 렌더되는 줄 내부에 있다. 재생 시작 시점에 이미 `lectureElsewhere` 가 있으면 region 이 처음부터 그 텍스트를 갖고 마운트되어 대부분의 스크린리더가 읽지 않는다. region 을 항상 마운트된 위치로 올리면 해결.
- **P2-4 (검증 공백 · P2-e 부분 해소)** 하네스 `entry.tsx` 는 LectureStage 만 장착하고 AnalysisTheater/안내 줄을 전혀 포함하지 않는다(`lecture-offer` 0회). 새 검사 둘의 의미:
  - 「학습자가 닫은 층을 강의가 다시 열지 않음(같은 큐 재방문)」(run.mjs:78/82) — **의미 있음**: 전제 실패를 FAIL 로 처리하고 실제 `details.open` 을 본다.
  - 「큐 진행이 포커스를 옮기지 않음」(run.mjs:115) — **약함**: `activeElement.id || tagName` 비교라 id 없는 단추 간 이동(BUTTON→BUTTON)을 못 잡는다. 요소 동일성(참조 저장 후 `===`)으로 비교해야 한다.
  - 이번 커밋의 실질 변경(고정 줄 · 토글 · 장면 이동 포커스 · live region)은 실계정 E2E 에만 단언이 있고 그 E2E 는 BLOCKED → 현재 **실행된 증거 0**.
- 사소: theater.module.css:93 주석("…껐을 때만")이 새 동작(재생 중 항상)과 어긋남.

## 판정

"HEAD 6f7fbe1ce 는 실계정 E2E 만 남기고 main 통합 준비 완료" → **PARTIAL**. P2-1·P2-2·P2-3 은 작은 수정으로 닫히며, 안내 줄을 하네스(AnalysisTheater 장착 또는 최소 offer 컴포넌트)로 검증하면 실계정 E2E 없이도 증거가 생긴다.
