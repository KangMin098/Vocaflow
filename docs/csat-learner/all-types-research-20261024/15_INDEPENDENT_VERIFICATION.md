# 15 — 독립 검증(읽기 전용) · 2026-10-24

> 검증자는 대상 코드·문서의 작성자가 아니다. 쓰기는 이 파일뿐. 브라우저 E2E 는 계정 비밀번호가 없어 **실행하지 못했다**.

## (1) 코드 커밋 d9fd35a66 (feat/lecture-learner-control) — 판정: **PARTIAL**

직접 실행: `tsc --noEmit -p .` 통과(exit 0) · `vitest run theater-delivery-guard.test.ts` 9/9 통과.

확인된 것
- 자동 장면 교체 effect 삭제 확인(`AnalysisTheater.tsx` 구 851 `selectScene(target,'replace')`). 강의 진행으로 장면이 바뀌는 경로가 사라졌으므로 「고른 의미·구절 소거」 는 강의 진행으로 더는 일어나지 않는다. 이동은 `lecture-offer-scene` 단추 클릭뿐.
- 가드 1 은 구 코드(main e3e0a6a0e 851행 문자열 존재)에서 실패한다 — 유효. 가드 2 는 새 문자열 존재 검사라 구 코드에서도 실패하지만, 동작이 아니라 소스 문자열 계약이다(리팩터에 취약, 동작 증명 아님).
- `.lectureOfferBtn` min-height 44px · focus-visible 있음(theater.module.css:95–101).
- `holdLecture` 는 죽은 코드 아님 — `pickScene`(AnalysisTheater.tsx:943)이 여전히 사용.
- 프로그램 `scrollIntoView` 는 wheel/touchmove 를 발생시키지 않으므로 자기 스크롤로 따라가기가 꺼지는 순환은 없음. `follow()` 는 activeKey null 이면 상태만 켜고 이동 없음 — 정상.

발견
- **P1** `LectureStage.tsx:285–288` — 강의 cue 가 접힌 `details` 를 `det.open = true` 로 연다. `following` 과 무관하게 매 cue 실행 → 학습자가 닫은 층을 강의가 다시 연다. 「명시적 선택 없이 탐색 상태 변경 금지」(결정) 위반이 남아 있다. 14 §3.2 는 이를 P2 후보로만 적었다 — 결정 문구 기준 P1.
- **P2** `LectureStage.tsx:316` SCROLL_KEYS 에 Space/Shift+Space 없음, 스크롤바 드래그·중간 클릭 자동 스크롤·Tab 포커스 이동도 감지 못함 → 이런 방식으로 읽던 학습자는 다음 cue 에서 다시 끌려간다. `scroll` 이벤트 + 프로그램 스크롤 플래그 방식이 더 확실.
- **P2** 같은 keydown 핸들러가 입력창·플레이어 단추 위 ArrowUp/Down 도 「스크롤」 로 간주(오탐, 기능 영향은 작음).
- **P2** `AnalysisTheater.tsx:870–873` 차례 줄 스크롤 차단은 `status==='playing'` 일 때만. 일시정지 중이면 `following=false` 여도 cursor 변경 시 `scrollIntoView({block:'nearest'})` 가 세로 창 스크롤을 일으킬 수 있다(cursor 는 학습자 조작이므로 영향 작음).
- **P2** 안내 줄 `role="status"`(AnalysisTheater.tsx ~1020): 재생 중 강의 장면이 바뀔 때마다 문구가 바뀌어 스크린리더가 반복 낭독할 수 있다(소음). 장면 변경 시만 polite 1회가 바람직.
- **P2** E2E `csat-lecture-learner-control.spec.ts` 는 장면 불변·휠 후 scroll 불변·follow 버튼 숨김을 검사해 주장과 대체로 일치하나, `details` 열림·Space/스크롤바·선택 소거(msPick 유지) 자체는 검사하지 않는다. **미실행.**

## (2) 문서 12 · 14 — 판정: **PARTIAL**

실측 일치: main=e3e0a6a0e · `AnalysisTheater.tsx:851` selectScene · `LectureStage.tsx:303` scrollIntoView · `20261005170000_csat_ec_reveal_gate.sql` 377–378 `status='published' and not embargoed` 모두 사실.

발견
- **P2** 12 E2 「20개 파일 확인, 회차당 23~29회」 — main `lecture-data/` json 은 30개, 그중 29개가 23~**30**(1개 0, 비대본 파일로 보임). 범위·파일 수 과소 기재. 14 §1.2 도 같은 수치 인용.
- **P1** 14 §3.2 「lint 통과 · csat 테스트 391/393」 은 이 검증에서 재현하지 않았다(tsc·가드 9/9 만 재현). 자체 보고로 표기 필요.
- **P1** 14 §3.2 가 `details.open` 을 「판단 필요(P2 후보)」 로 둔 것은 결정(시스템이 탐색 상태 변경 금지)과 어긋난다 — 위 (1) P1.
- 결정 1 반영: 14 R1–R5 가 강제 순서 없음·구간 전 안내·4종 기록 분리를 충실히 담음. 12 §4-A 의 LOCKED→COMMITTED→REVEALED 강제 순서는 14 머리말에서 「대체」 를 명시 — 모순은 처리됨. 단 12 본문에는 대체 표시가 없어 12 만 읽으면 오독 가능(P2).
- 결정 2 반영: D2-A/B/C/D 분리·DB/RLS 무변경·실계정 검증 BLOCKED 명시 — 충실. 12 P1 「answer 컬럼」 을 결함 아님으로 종결한 것도 결정과 일치.
- 결정 3 반영: T-0136 forbidden `apps/` 기재, 단일 owner 브랜치 명시 — 일치(AI-Control 원본은 이 검증에서 열람하지 않음). 12 §7 「Codex 조정 후 착수」 와 14 §3.1 「충돌 없음 확인」 은 순서상 정합.
- 수치 3,714/3,595/302/186/3 은 DB 재질의하지 않음(검증 범위 밖으로 남김).

## 종합
코드: 장면 탈취 P0 해소는 확인, 스크롤 탈취는 부분 해소, `details` 자동 열기 남음 → PARTIAL. 문서: 결정 1·2·3 반영은 충실, 수치 소폭 과소·자체 검증 표기 부족 → PARTIAL.
