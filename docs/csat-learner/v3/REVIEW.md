# v3 설계 교차 리뷰·검증 기록

2026-10-12 · 대상은 여섯 설계 문서와 `.agent-goal.md`. Codex 작성, **반대 Claude Code CLI** 읽기 전용 검토. 사용자 첨부 §8의 명시 요청으로 실행했으며 자동 Codex 리뷰/구현 PR 전역 리뷰 의무를 추가하지 않는다.

## 1. 방법과 범위

초회: 2026-10-12 08:27 KST 시작. Claude CLI `--print --tools Read,Grep,Glob --permission-mode plan --no-session-persistence --output-format text --max-turns 8`. 전체 문서 본문/줄 번호·목적·수용 기준·금지사항을 제공하고 실제 파일 경로/계약의 불확실한 부분만 읽게 했다. 저장소/DB/작업 상태를 수정할 권한은 주지 않았다. 프로세스 exit0, 형식에 맞는 P2 네 건/P3 두 건을 반환했다. exit0만으로 무결함이라 판단하지 않았다.

현재 `review.mjs --plan`은 인자를 처리하지 않으므로 그 명령이 설계 본문을 검토했다는 허위 보고 대신 위 직접 교차 검토를 사용했다. 기존 goal-review의 결함/목적 이탈 기준을 적용했다. 리뷰 입력/결과 임시 파일은 저장소 밖에 두고 이 문서에 결과/조치를 기록한다.

## 2. 초회 지적과 조치

| 등급/원 지적 위치 | 내용 | 조치·판정 |
|---|---|---|
| P2 PLAN:27 | 없는 `session/dissect.ts`를 수정 대상으로 적음 | 실제 `lib/csat/dissect.ts`와 `session/{model,sync,store}.ts`로 수정. EXPLAIN_MAX/DissectionRecord 정본 명시 |
| P2 PLAN:100,137 / INSTRUCTIONS:92 | 후속 구현 PR마다 자동 교차 리뷰 의무를 부활시킬 수 있음 | 이번 설계의 명시 리뷰 요청과 후속 사용자 요청 시 리뷰를 분리. 완료는 테스트/타입/lint/수용 기준/Goal Check로 명시 |
| P2 PLAN:111 / INSTRUCTIONS:60,94 | 최신 v1.1 승인 정책과 옛 30파일/main 별도 확인 혼동 | 최신 main은 DB 변경/삭제 승인, 30파일 추가 검증, safe-merge라는 사실 기록. 이번 사용자 제공 지침과 design-only/no-main-merge scope는 별도 출처로 분리. secret/실패 push는 안전 중단 |
| P2 UX:40 | 권한 실패와 독립 확인/저장 실패의 해설 접근 의미 충돌 | 권한/보류는 비공개, 미응답/오답은 설명 가능, 기록 실패는 설명 가능+pending/재시도+독립 판정 제외로 구분 |
| P3 DATA:28 | 평가원에도 학년을 일괄 필수화할 위험 | 기관 discriminated union으로 학평 학년 필수, 평가원은 실제 DB grade3 adapter만 optional. 기관별 공개/검수 집합 유지 |
| P3 DATA:127 | note의 viewed_first 상수로 확인 중 도움 이력이 소실될 위험 | afterExplanation=true, origin session/check ID·실제 HelpLevel snapshot. 원시도 help를 덮어쓰지 않으며 note는 독립 수행 아님 |

## 3. 재검토와 문서 검증

3회차는 P2 한 건: M2 대표 공개보다 M3 공개 가드가 늦게 오는 순서 충돌이다. 명시 pass·writer≠reviewer·현재 hash/binding 검사와 실패→성공 회귀를 M2 첫 공개 전에 완성하도록 이동했고, 그 전 대표 v3 콘텐츠는 비공개 preview만 허용한다. M3은 이 가드가 확장 경로를 모두 덮는지 검증하고 전량을 확장한다.

마지막 원격 상태 재조회에서 PR #222/main `c206b405d`의 inquiry 통합을 발견해 감사/실행계획의 ‘진행 브랜치에만 있음’을 최신 main 재사용으로 갱신했다. 이 추가 diff는 앞서 읽은 inquiry HEAD `4cb0b32bc`의 통합이며 `analysis_version`·데이터·도식·build 가드를 원격 파일에서 재확인했다. `DistractorDesign/PrincipleDesign`도 별도 파일이 아니라 SceneDiagrams.tsx의 함수라는 실제 경로를 수정했다. docs-only 소유 branch에는 upstream 앱/배치 파일을 변경하지 않았다.

2회차 재검토는 P2 세 건/P3 한 건을 반환했다. (1) PLAN이 참조한 홈 상태별 UX 표가 없어 익명/기록 없음/미완료/관찰/처방/재확인/복귀/오류와 우선순위 표를 UX §7에 추가했다. (2) 실패 push의 ‘사용자 확인 없이’ 표현을 안전 중단으로 통일했다. (3) 사용자 제공 AGENTS 출처를 대화 메시지 제목/세션 날짜/정확한 문구로 인용하고 최신 저장소 v1.1과 분리했다. (4) schema3 역할 표는 고정 계약, 길이 상수 개정만 파일럿으로 구분했다. 실제 변경을 다시 읽기 전용으로 확인한다.

수정한 전체 여섯 문서와 이 조치표를 같은 읽기 전용 Claude에 새 세션으로 제공했다. **4회차 최종 결과(2026-10-12 08:39:05 KST): `NO_FINDINGS`, 프로세스 exit0.** 최신 main 통합 상태와 M2 공개 가드 순서를 포함한 최종 본문을 검토했다. 초회/재검토 지적은 모두 조치했으며 남은 P1/P2는 없다. 아직 실행하지 않은 검사/실화면/교육 효과는 통과로 쓰지 않는다.

문서 구조 검사: 여섯 요청 문서+README/REVIEW 총8개, 내부 상대 링크20개, 26유형 고유 키/실제 teaching registry26개, 7장면/F01~F16 존재, 명시된 기존 코드/테스트 경로21개, UTF-8/fence/행 끝 공백 검사 **PASS**. `node agents/scripts/check.mjs` **15/15 PASS**. `git diff --check` **PASS**. 이 검사는 UI/본문 의미의 전량 검수나 실제 교육 효과를 대신하지 않는다.

설계-only 작업이므로 앱 unit/E2E/build와 실제 localhost/TTS QA는 후속 구현 검수다. 이번 작업에서는 문서 경로/내부 링크·코드 계약 경로·26유형/장면 coverage·목적 대조·diff whitespace·에이전트 설정 정합성을 확인한다. DB는 읽기만 수행했다.
